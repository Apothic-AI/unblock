/**
 * E2E: `unblock file` through a real daemon and the real agent-rails held_asks.py. An ask outside
 * today's focus is held and never enters the queue; a stated emergency is filed; once the owner is
 * focus, held_asks surface files the held ask (Alex, 2026-10-09: only asks for that day's focus).
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const HELD = process.env.UNBLOCK_TEST_HELD_ASKS_PY || '/Volumes/StudioExt/repos/agent-rails/scripts/held_asks.py'
const state = mkdtempSync(join(process.env.UNBLOCK_TEST_TMPDIR || tmpdir(), 'unblock-focus-'))
const home = join(state, 'home')
process.env.UNBLOCK_STATE_DIR = state
process.env.UNBLOCK_CONFIG_DIR = join(state, 'config')
process.env.UNBLOCK_SECRET_BACKEND = 'env'
const cli = join(import.meta.dirname, '..', 'bin', 'unblock.js')

function run(command, args, input, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => child.kill(), 20000)
    child.stdout.setEncoding('utf8').on('data', (data) => { stdout += data })
    child.stderr.setEncoding('utf8').on('data', (data) => { stderr += data })
    child.on('error', reject)
    child.on('close', (status) => { clearTimeout(timer); resolve({ status, stdout, stderr }) })
    child.stdin.end(input ?? '')
  })
}
const unblock = (args, input) => run(process.execPath, [cli, ...args], input)
const held = (args) => run('python3', [HELD, ...args], '', { HOME: home, HELD_ASKS_UNBLOCK: `${process.execPath} ${cli}` })

const ask = (title) => JSON.stringify({
  title, why: 'The lane needs a product call before the next slice.', purpose: 'decision', only_you: 'judgment',
  tried: ['read the lane brief and the scope; neither settles this call'],
  fields: [{ name: 'go', type: 'confirm', label: 'Go ahead', recommend: { value: true, why: 'The brief points this way.' } }],
})
const etDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())

test('unblock file holds asks outside today\'s focus and files them once their owner is focus', { skip: !existsSync(HELD) && `no ${HELD}` }, async () => {
  mkdirSync(join(home, '.agent-rails', 'focus'), { recursive: true })
  process.env.UNBLOCK_HELD_ASKS = `env HOME=${home} python3 ${HELD}`
  const { startDaemon } = await import('../src/daemon.js')
  const daemon = await startDaemon({ port: 0 })
  process.env.UNBLOCK_PORT = String(daemon.port)
  try {
    const off = await unblock(['file', '-', '--origin', 'lane-off', '--json'], ask('Off-focus product call'))
    assert.equal(off.status, 0, off.stderr)
    const receipt = JSON.parse(off.stdout)
    assert.match(receipt.held, /^held-[a-f0-9]{8}$/)
    assert.equal(receipt.filed, false)

    const urgent = await unblock(['file', '-', '--origin', 'lane-off', '--emergency', 'prod checkout returns 500 for every user'], ask('Prod down call'))
    assert.equal(urgent.status, 0, urgent.stderr)
    assert.match(urgent.stdout, /ub_[a-z0-9]+/)

    const queue = async () => JSON.parse((await unblock(['list', '--json'])).stdout)
    const titles = async () => { let value = await queue(); while (!Array.isArray(value)) value = value.asks ?? value.result ?? []; return value.map((row) => row.title) }
    assert.deepEqual(await titles(), ['Prod down call'])
    const list = JSON.parse((await held(['list'])).stdout)
    assert.deepEqual(list.map((row) => [row.id, row.owner]), [[receipt.held, 'lane-off']])

    writeFileSync(join(home, '.agent-rails', 'focus', `${etDay()}.json`),
      JSON.stringify({ date: etDay(), items: [{ owner: 'lane-off', title: 'Ship the lane', by: 'cos' }] }))
    const surfaced = await held(['surface'])
    assert.equal(surfaced.status, 0, surfaced.stderr)
    assert.deepEqual(JSON.parse(surfaced.stdout).map((row) => row.id), [receipt.held])
    assert.deepEqual((await titles()).sort(), ['Off-focus product call', 'Prod down call'])

    const focused = await unblock(['file', '-', '--origin', 'lane-off'], ask('In-focus product call'))
    assert.match(focused.stdout, /ub_[a-z0-9]+/, focused.stderr)
  } finally {
    await daemon.close()
  }
})
