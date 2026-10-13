// Integration: owner feedback crosses the HTTP daemon and real lane-post journal even
// after this scope sender has exhausted its agent interrupt allowance. Existing
// comment tests replace lane-post, so they cannot catch a missing owner-words flag.
import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { human, startScopeHarness } from './scope-harness.js'

const at = '2026-10-13T14:47:00Z'
const scope = {
  version: 2, slug: 'deck', title: 'Deck', kind: 'visual', pane: 'w5Z:p2', revision: 1, updated_at: at,
  doc: { sections: [{ id: 'title', heading: 'Deck', body_md: 'The company.' }] }, threads: [],
}

const lanePost = process.env.SCOPE_TEST_LANE_POST_BIN || join(process.env.HOME, '.agent-rails/factory-runtime/bin/lane-post')

test('a general comment and its reply reach the lane despite a saturated interrupt cap', async () => {
  const h = await startScopeHarness(scope)
  const dir = dirname(process.env.HERDR_BIN_PATH), lanes = join(dir, 'lanes')
  const saved = Object.fromEntries(['LANE_BULLETIN_HOME', 'FACTORY_HOST', 'FACTORY_FILE', 'FACTORY_MACHINES', 'HERDR_BIN', 'UNBLOCK_LANE_POST_BIN', 'LANE_POST_INTERRUPT_CAP', 'UNBLOCK_SUPERVISED'].map(key => [key, process.env[key]]))
  const machineFile = join(dir, 'machines.json'), factoryFile = join(dir, 'factory.toml')
  writeFileSync(machineFile, JSON.stringify([{ name: 'sandbox', job_host: true }]))
  writeFileSync(factoryFile, '')
  writeFileSync(process.env.HERDR_BIN_PATH, `#!/bin/sh\ncase "$1 $2" in\n'pane list') echo '{"result":{"panes":[{"pane_id":"w5Z:p2","agent":"claude"}]}}';;\n 'tab list') echo '{"result":{"tabs":[]}}';;\n*) echo '{"result":{}}';;\nesac\n`)
  Object.assign(process.env, { LANE_BULLETIN_HOME: lanes, FACTORY_HOST: 'sandbox', FACTORY_FILE: factoryFile,
    FACTORY_MACHINES: machineFile, HERDR_BIN: process.env.HERDR_BIN_PATH,
    UNBLOCK_LANE_POST_BIN: lanePost, LANE_POST_INTERRUPT_CAP: '1', UNBLOCK_SUPERVISED: '1' })
  const journal = () => existsSync(join(lanes, 'bulletin.jsonl')) ? readFileSync(join(lanes, 'bulletin.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : []
  const post = text => spawnSync(lanePost, ['post', '--to', 'w5Z:p2', '--from', 'scope:deck', '--kind', 'task', '--class', 'interrupt', '--wake', 'never', '--text', text], { encoding: 'utf8', timeout: 30000, env: { ...process.env, HERDR_PANE_ID: '', FACTORY_PANE_OWNER: '', FACTORY_BOX_SESSION: '' } })
  const until = async (condition, label) => {
    const end = Date.now() + 15000
    while (Date.now() < end) {
      if (await condition()) return
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    assert.fail(`${label} did not reach the durable lane journal`)
  }
  try {
    const first = post('agent capacity fixture')
    assert.equal(first.status, 0, first.stderr)
    const blocked = post('another agent interrupt')
    assert.equal(blocked.status, 5, blocked.stderr)
    assert.match(blocked.stderr, /interrupt cap/)

    const comment = await h.request('/api/scope/deck/threads', { method: 'POST', headers: human,
      body: { anchor: { section: 'title', quote: 'Deck', prefix: '', suffix: '', general: true }, text: 'The whole company story is missing.', client_id: 'general' } })
    assert.equal(comment.status, 201, comment.text)
    const id = comment.json.thread.id
    const reply = await h.request(`/api/scope/deck/threads/${id}/reply`, { method: 'POST', headers: human,
      body: { text: 'Did you get this?', client_id: 'follow-up' } })
    assert.equal(reply.status, 200, reply.text)
    await until(() => journal().some(row => row.text.includes('The whole company story is missing.')) && journal().some(row => row.text.includes('Did you get this?')), 'general comment and reply')
    const relayed = journal().filter(row => row.text.includes('[scoping deck]'))
    assert.ok(relayed.every(row => row.owner_words === true))
    assert.ok(relayed.every(row => row.to.some(pane => pane.endsWith('/w5Z:p2')) || row.to.includes('w5Z:p2')))
    await until(async () => {
      const state = await h.request('/api/scope/deck', { headers: human })
      const notes = state.json.notes.filter(note => note.thread === id)
      return notes.length === 2 && notes.every(note => note.delivery === 'delivered' && note.bulletin)
    }, 'both delivery receipts')
    assert.equal(post('agent interrupt still capped').status, 5, 'owner feedback must not disable the agent cap')
  } finally {
    await h.close()
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
