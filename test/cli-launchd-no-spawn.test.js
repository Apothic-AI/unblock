import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const cli = join(dirname(dirname(fileURLToPath(import.meta.url))), 'bin', 'unblock.js')

async function freePort() {
  const server = createServer()
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address()
  await new Promise((r) => server.close(r))
  return port
}

function listeners(port) {
  const out = spawnSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout
  return out.split('\n').map(Number).filter(Boolean)
}

test('with the launchd job loaded, the CLI waits for launchd and never starts its own daemon', { skip: process.platform !== 'darwin' }, async () => {
  const home = mkdtempSync(join(tmpdir(), 'unblock-launchd-'))
  const bin = join(home, 'bin')
  mkdirSync(bin)
  writeFileSync(join(bin, 'launchctl'), '#!/bin/sh\n[ "$1" = print ] && exit 0\nexit 1\n')
  chmodSync(join(bin, 'launchctl'), 0o755)
  const port = await freePort()
  const env = { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}`, UNBLOCK_PORT: String(port),
    UNBLOCK_START_TIMEOUT_MS: '1500', UNBLOCK_SECRET_BACKEND: 'env', UNBLOCK_ALEX_FEED: '0' }
  for (const key of ['UNBLOCK_STATE_DIR', 'UNBLOCK_CONFIG_DIR', 'XDG_STATE_HOME', 'XDG_CONFIG_HOME', 'UNBLOCK_AUTH']) delete env[key]
  try {
    const result = spawnSync(process.execPath, [cli, 'list', '--json'], { env, encoding: 'utf8', timeout: 60000 })
    await new Promise((r) => setTimeout(r, 2000))
    assert.deepEqual(listeners(port), [], 'the CLI started a daemon beside the launchd job')
    assert.notEqual(result.status, 0)
    assert.match(result.stderr + result.stdout, /launchd/)
  } finally {
    for (const pid of listeners(port)) { try { process.kill(pid, 'SIGKILL') } catch {} }
    rmSync(home, { recursive: true, force: true })
  }
})
