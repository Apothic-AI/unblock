import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const cli = join(dirname(dirname(fileURLToPath(import.meta.url))), 'bin', 'unblock.js')

test('a list whose connection drops while the daemon restarts retries and still answers', async () => {
  const state = mkdtempSync(join(tmpdir(), 'unblock-retry-'))
  let asksCalls = 0
  const server = createServer((req, res) => {
    if (req.url.startsWith('/api/asks')) {
      asksCalls += 1
      if (asksCalls === 1) return req.socket.destroy()
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ asks: [{ ticket: 'u-1', status: 'open', title: 'Still here', set_aside_at: null, weekly_at: null }] }))
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, public_origin: null }))
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  try {
    const env = { ...process.env, UNBLOCK_STATE_DIR: state, UNBLOCK_PORT: String(server.address().port), UNBLOCK_AUTH: 'test' }
    const child = spawn(process.execPath, [cli, 'list', '--json'], { env })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { err += d })
    const code = await new Promise((r) => child.once('exit', r))
    assert.equal(code, 0, err)
    assert.deepEqual(JSON.parse(out).asks.map((ask) => ask.ticket), ['u-1'])
    assert.equal(asksCalls, 2)
  } finally {
    server.close()
    rmSync(state, { recursive: true, force: true })
  }
})
