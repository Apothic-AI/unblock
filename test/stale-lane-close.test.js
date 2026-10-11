// Integration owner: the real daemon sweep retires old asks only for closed lanes.
// Existing lifecycle coverage keeps filed asks alive after their filer exits, but
// does not exercise lane closure. No production seams are added for this test.
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'

const stateDir = mkdtempSync(join(tmpdir(), 'unblock-stale-lane-'))
const lanes = join(stateDir, 'lanes')
mkdirSync(lanes)
process.env.UNBLOCK_STATE_DIR = stateDir
process.env.UNBLOCK_CONFIG_DIR = join(stateDir, 'config')
process.env.UNBLOCK_SECRET_BACKEND = 'env'
process.env.UNBLOCK_LIVEDOC_APPROVALS = '0'
process.env.AGENT_RAILS_LANES = lanes
process.env.UNBLOCK_STALE_LANE_DAYS = '7'
for (const name of ['UNBLOCK_SWEEP_MS', 'UNBLOCK_RECHECK_AFTER_MS', 'UNBLOCK_RECHECK_REPLY_MS']) process.env[name] = String(60 * 60 * 1000)
for (const name of ['UNBLOCK_PORT', 'UNBLOCK_AUTH', 'UNBLOCK_ORIGIN_PID', 'HERDR_SESSION_ID', 'CLAUDE_SESSION_ID']) delete process.env[name]
const postLog = join(stateDir, 'posts')
const lanePost = join(stateDir, 'lane-post-stub')
writeFileSync(lanePost, `#!/bin/sh\nfor a in "$@"; do printf '%s\\037' "$a" >> '${postLog}'; done\nprintf '\\n' >> '${postLog}'\nexit 1\n`)
chmodSync(lanePost, 0o700)
process.env.UNBLOCK_LANE_POST_BIN = lanePost
const { startDaemon, loadOrCreateSecret } = await import('../src/daemon.js')
const authSecret = loadOrCreateSecret()

test('old asks of closed lanes leave the queue once, including set-aside and outbound asks', async () => {
  for (const [name, state, metadata] of [
    ['old-lane', 'Work completed.\nThe lane is closed.\n', {}],
    ['live-lane', 'Still working.\n', {}],
    ['pane-lane', '', { herdr: { pane_id: 'w5H:p15W' }, closed_at: '2026-10-01T00:00:00Z' }],
    ['handoff-lane', 'handed to factory\n', {}],
    ['historic-lane', 'The lane is closed.\n1\n2\n3\n4\n5\n', {}],
  ]) {
    mkdirSync(join(lanes, name))
    writeFileSync(join(lanes, name, 'STATE.md'), state)
    writeFileSync(join(lanes, name, 'lane.json'), JSON.stringify(metadata))
  }
  const daemon = await startDaemon({ port: 0 })
  const base = `http://127.0.0.1:${daemon.port}`
  const db = new DatabaseSync(join(stateDir, 'queue.db'))
  async function json(path, options = {}) {
    const response = await fetch(`${base}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSecret}` } })
    const body = await response.json()
    assert.ok(response.ok, JSON.stringify(body))
    return body
  }
  async function file(title, days, origin, aside = false, outbound = false) {
    const result = await json('/api/asks', { method: 'POST', body: JSON.stringify({
      ask: { kind: 'file', purpose: 'decision', title, why: 'Needs a judgment.', only_you: 'judgment', tried: ['The spec and past steers do not settle this.'], fields: [{ name: 'answer', type: 'text', label: 'Answer', required: true, recommend: { value: 'Keep it short', why: 'Matches the other tabs.' } }], ...(outbound ? { purpose: 'message', only_you: 'message', fields: undefined, message: { to: 'person@example.test', via: 'email', subject: 'Update', text: 'The requested update is ready.' } } : {}) }, origin,
    }) })
    db.prepare('UPDATE asks SET created_at = ?, set_aside_at = ? WHERE ticket = ?').run(Date.now() - days * 86400000, aside ? Date.now() : null, result.ticket)
    return result.ticket
  }
  try {
    const old = await file('Old decision', 8, { lane_name: 'old-lane', pane_id: 'w5H:pOLD' })
    const young = await file('Young decision', 2, { lane_name: 'old-lane' })
    const live = await file('Live lane', 8, { lane_name: 'live-lane' })
    const standing = await file('Standing agent', 8, { lane_name: 'recruiter' })
    const historical = await file('Old close line', 8, { lane_name: 'historic-lane' })
    const aside = await file('Set aside', 8, { lane_name: 'old-lane' }, true)
    const pane = await file('Pane matched', 8, { pane_id: 'w5h:p15w' })
    const handoff = await file('Handed off', 8, { lane_name: 'handoff-lane' })
    // Message approvals stay protected while their lane is live, not after it closes.
    const outbound = await file('Outbound approval', 8, { lane_name: 'old-lane' }, false, true)
    const outboundLive = await file('Live outbound approval', 8, { lane_name: 'live-lane' }, false, true)
    await daemon.sweep()
    for (const [ticket, lane] of [[old, 'old-lane'], [aside, 'old-lane'], [pane, 'pane-lane'], [handoff, 'handoff-lane'], [outbound, 'old-lane']]) {
      const ask = await json(`/api/asks/${ticket}`)
      assert.equal(ask.status, 'cancelled')
      assert.equal(ask.close_reason, 'stale_lane_closed')
      assert.equal(ask.note, `closed as stale: older than 7 days and lane ${lane} is closed; re-ask through unblock if it still matters`)
    }
    for (const ticket of [young, live, standing, historical, outboundLive]) assert.equal((await json(`/api/asks/${ticket}`)).status, 'open')
    const queue = (await json('/api/asks?profile=*')).asks.map(ask => ask.ticket)
    assert.ok(!queue.includes(old))
    assert.ok(queue.includes(young))
    const posts = readFileSync(postLog, 'utf8').trim().split('\n').map(line => line.split('\x1f').filter(Boolean))
    assert.equal(posts.length, 2, 'missing panes do not post; failed posts still close')
    const post = posts.find(args => args.includes('w5H:pOLD'))
    assert.equal(post[post.indexOf('--kind') + 1], 'info')
    assert.equal(post[post.indexOf('--from') + 1], 'unblock')
    assert.equal(post.at(-1), `${old} "Old decision" closed as stale: older than 7 days and lane old-lane is closed; re-ask through unblock if it still matters`)
    await daemon.sweep()
    assert.equal(readFileSync(postLog, 'utf8').trim().split('\n').length, 2, 'closed asks never notify twice')
  } finally {
    db.close()
    await daemon.close()
    rmSync(stateDir, { recursive: true, force: true })
  }
})
