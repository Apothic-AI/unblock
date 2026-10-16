import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const daemonJs = join(dirname(dirname(fileURLToPath(import.meta.url))), 'src', 'daemon.js')

async function freePort() {
  const server = createServer()
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address()
  await new Promise((r) => server.close(r))
  return port
}

function run(port, state, extra = {}) {
  const env = {
    ...process.env, UNBLOCK_PORT: String(port), UNBLOCK_STATE_DIR: state, UNBLOCK_CONFIG_DIR: join(state, 'config'),
    UNBLOCK_SECRET_BACKEND: 'env', UNBLOCK_SCOPING_DIR: join(state, 'scopes'), UNBLOCK_ALEX_FEED: '0',
    UNBLOCK_LIVEDOC_APPROVALS: '0', UNBLOCK_SUPERVISED: '', ...extra,
  }
  const child = spawn(process.execPath, [daemonJs], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  child.output = ''
  child.stdout.on('data', (d) => { child.output += d })
  child.stderr.on('data', (d) => { child.output += d })
  child.exited = new Promise((r) => child.once('exit', (code) => r(code)))
  return child
}

async function healthyOn(port, ms = 10000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    const ok = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) }).then((r) => r.ok, () => false)
    if (ok) return true
    await new Promise((r) => setTimeout(r, 100))
  }
  return false
}


test('a supervised start evicts an orphaned unblock daemon that has no daemon.json record and takes the port', async () => {
  const root = mkdtempSync(join(tmpdir(), 'unblock-squat-'))
  const port = await freePort()
  const orphan = run(port, join(root, 'orphan'))
  let supervised
  try {
    assert.ok(await healthyOn(port), orphan.output)
    supervised = run(port, join(root, 'supervised'), { UNBLOCK_SUPERVISED: '1' })
    const orphanCode = await Promise.race([orphan.exited, new Promise((r) => setTimeout(() => r('alive'), 15000))])
    assert.notEqual(orphanCode, 'alive', `orphan still holds the port\n${supervised.output}`)
    assert.ok(await healthyOn(port), supervised.output)
    assert.equal(supervised.exitCode, null, supervised.output)
  } finally {
    orphan.kill('SIGKILL')
    supervised?.kill('SIGKILL')
    await Promise.all([orphan.exited, supervised?.exited])
    rmSync(root, { recursive: true, force: true })
  }
})

test('an unsupervised start beside a healthy daemon exits 0 instead of crashing', async () => {
  const root = mkdtempSync(join(tmpdir(), 'unblock-squat-'))
  const port = await freePort()
  const first = run(port, join(root, 'first'))
  try {
    assert.ok(await healthyOn(port), first.output)
    const second = run(port, join(root, 'second'))
    assert.equal(await second.exited, 0, second.output)
    assert.ok(await healthyOn(port, 2000))
  } finally {
    first.kill('SIGKILL')
    await first.exited
    rmSync(root, { recursive: true, force: true })
  }
})
