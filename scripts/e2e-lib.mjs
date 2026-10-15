import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const REPO = join(import.meta.dirname, '..')
export const HELD = process.env.UNBLOCK_TEST_HELD_ASKS_PY || '/Volumes/StudioExt/repos/agent-rails/scripts/held_asks.py'
const CLI = join(REPO, 'bin', 'unblock.js')

export function check(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`)
  console.log(`ok   ${message}`)
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)) })
  })
}

export const etDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())

export function sandbox(name) {
  const root = mkdtempSync(join(tmpdir(), `unblock-${name}-`))
  const home = join(root, 'home')
  mkdirSync(join(home, '.agent-rails', 'focus'), { recursive: true })
  mkdirSync(join(home, '.agent-rails', 'lanes'), { recursive: true })
  return { root, home, lanes: join(home, '.agent-rails', 'lanes'), state: join(root, 'state'), config: join(root, 'config') }
}

export function setFocus(box, owners) {
  const path = join(box.home, '.agent-rails', 'focus', `${etDay()}.json`)
  writeFileSync(path, JSON.stringify({ items: owners.map((owner) => ({ owner })) }))
  return path
}

export async function startDaemon(box, env = {}) {
  const port = await freePort()
  mkdirSync(box.config, { recursive: true })
  const base = {
    ...process.env, HOME: box.home, UNBLOCK_STATE_DIR: box.state, UNBLOCK_CONFIG_DIR: box.config,
    UNBLOCK_SECRET_BACKEND: 'env', UNBLOCK_PORT: String(port), AGENT_RAILS_LANES: box.lanes,
    UNBLOCK_HELD_ASKS: `env HOME=${box.home} AGENT_RAILS_LANES=${box.lanes} python3 ${HELD}`,
    HELD_ASKS_UNBLOCK: `${process.execPath} ${CLI}`, UNBLOCK_LIVEDOC_APPROVALS: '0',
    ...env,
  }
  const child = spawn(process.execPath, [join(REPO, 'src', 'daemon.js')], { env: base, stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  child.stdout.on('data', (data) => { log += data })
  child.stderr.on('data', (data) => { log += data })
  const file = join(box.state, 'daemon.json')
  for (let i = 0; i < 100; i++) {
    if (existsSync(file)) {
      try {
        const info = JSON.parse(readFileSync(file, 'utf8'))
        const response = await fetch(`http://127.0.0.1:${info.port}/api/health`, { headers: { authorization: `Bearer ${info.auth}` } })
        if (response.ok) {
          const api = async (path, body, method) => {
            const res = await fetch(`http://127.0.0.1:${info.port}${path}`, {
              method: method ?? (body === undefined ? 'GET' : 'POST'),
              headers: { authorization: `Bearer ${info.auth}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
              body: body === undefined ? undefined : JSON.stringify(body),
            })
            return { status: res.status, body: await res.json().catch(() => null) }
          }
          const cli = (args, input) => run(process.execPath, [CLI, ...args], input, base)
          const stop = () => new Promise((resolve) => { child.once('exit', resolve); child.kill('SIGTERM') })
          return { api, cli, stop, env: base, log: () => log }
        }
      } catch {}
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  child.kill('SIGKILL')
  throw new Error(`daemon did not start:\n${log}`)
}

export function run(command, args, input, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => child.kill(), 30000)
    child.stdout.setEncoding('utf8').on('data', (data) => { stdout += data })
    child.stderr.setEncoding('utf8').on('data', (data) => { stderr += data })
    child.on('error', reject)
    child.on('close', (status) => { clearTimeout(timer); resolve({ status, stdout, stderr }) })
    child.stdin.end(input ?? '')
  })
}

export function held(box, args, input) {
  return run('python3', [HELD, ...args], input, {
    ...process.env, HOME: box.home, AGENT_RAILS_LANES: box.lanes, HELD_LANE_POST_BIN: 'true',
  })
}

export const ask = (title, extra = {}) => ({
  title, why: 'The lane needs a product call before the next slice.', purpose: 'decision', only_you: 'judgment',
  tried: ['read the lane brief and the scope; neither settles this call'],
  fields: [{ name: 'go', type: 'confirm', label: 'Go ahead', recommend: { value: true, why: 'The brief points this way.' } }],
  ...extra,
})

export const origin = (box, lane, extra = {}) => ({ agent: 'claude', lane_name: lane, cwd: box.root, ...extra })

export async function main(fn) {
  try {
    await fn()
    console.log('PASS')
  } catch (error) {
    console.error(error.message)
    console.log('FAIL')
    process.exitCode = 1
  }
}
