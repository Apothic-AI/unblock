// Owner: Opus (r43, canonical scoping links). Implementers make it pass and never edit it.
// Alex (2026-09-30 18:04 ET, via pJ0): every scoping link opens the Rails workspace, not :8797.
// Canonical: https://app.rails.so/workspace/rails-admin?route=scoping/<slug>. unblock reads the template from
// config (`scope_link_template`, env UNBLOCK_SCOPE_LINK_TEMPLATE, "{slug}" placeholder), health reports it, and
// `unblock scope list` / `unblock scope url` put it in `url`; the Studio page link stays as `studio_url`.
// With no template, or a template on a retired doc port (8797, 8799, 8844), `url` is the canonical Rails link (Alex, 2026-10-16).
import assert from 'node:assert/strict'
import test from 'node:test'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { human, startScopeHarness } from './scope-harness.js'
import { applyConfig } from '../src/config.js'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const at = '2026-09-30T01:00:00Z'
const scope = {
  version: 2, slug: 'demo', title: 'Scope demo', pane: 'w5H:pT1', revision: 1, updated_at: at,
  doc: { sections: [{ id: 'title', heading: 'Scope demo', body_md: 'A small page.' }] }, threads: [],
}
const TEMPLATE = 'https://app.rails.so/workspace/rails-admin?route=scoping/{slug}'

test('config: scope_link_template is one https URL with {slug}; anything else is ignored', () => {
  const dir = mkdtempSync(join(tmpdir(), 'unblock-r43-'))
  const at = (value) => {
    const path = join(dir, `c${Math.random()}.json`)
    writeFileSync(path, JSON.stringify({ scope_link_template: value }))
    const env = {}
    applyConfig({ env, path })
    return env.UNBLOCK_SCOPE_LINK_TEMPLATE
  }
  assert.equal(at(TEMPLATE), TEMPLATE)
  assert.equal(at('http://app.rails.so/x?route=scoping/{slug}'), undefined, 'http is refused')
  assert.equal(at('https://app.rails.so/workspace/rails-admin'), undefined, 'no {slug} is refused')
  assert.equal(at('javascript:alert(1)//{slug}'), undefined)
  assert.equal(at(42), undefined)
  for (const port of ['8797', '8799', '8844']) {
    assert.equal(at(`https://studio.tailf266ac.ts.net:${port}/s/{slug}`), undefined, `retired port ${port} is refused`)
  }
  const env = { UNBLOCK_SCOPE_LINK_TEMPLATE: 'https://example.com/{slug}' }
  const path = join(dir, 'win.json'); writeFileSync(path, JSON.stringify({ scope_link_template: TEMPLATE }))
  applyConfig({ env, path })
  assert.equal(env.UNBLOCK_SCOPE_LINK_TEMPLATE, 'https://example.com/{slug}', 'the environment still wins')
})

test('scope list and scope url emit the canonical link in url and keep the Studio link as studio_url', async () => {
  const saved = process.env.UNBLOCK_SCOPE_LINK_TEMPLATE
  delete process.env.UNBLOCK_SCOPE_LINK_TEMPLATE
  const h = await startScopeHarness(scope)
  const cli = (...args) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(import.meta.dirname, '..', 'bin', 'unblock.js'), ...args], { env: { ...process.env, UNBLOCK_PORT: String(h.port) } })
    let stdout = '', stderr = ''
    child.stdout.on('data', (c) => { stdout += c }); child.stderr.on('data', (c) => { stderr += c })
    child.on('error', reject); child.on('close', (status) => resolve({ status, stdout, stderr }))
  })
  try {
    const CANONICAL = 'https://app.rails.so/workspace/rails-admin?route=scoping/demo'
    let health = await h.request('/api/health', { headers: human })
    assert.equal(health.json.scope_link_template, TEMPLATE, 'no template: health reports the Rails template')
    let got = await cli('scope', 'url', 'demo', '--json')
    assert.equal(got.status, 0, got.stderr)
    const before = JSON.parse(got.stdout)
    assert.equal(before.url, CANONICAL)
    assert.match(before.studio_url, /\/s\/demo\?studio=1$/)
    got = await cli('scope', 'list', '--json')
    assert.equal(got.status, 0, got.stderr)
    let row = JSON.parse(got.stdout).scopes.find((r) => r.slug === 'demo')
    assert.equal(row.url, CANONICAL)

    process.env.UNBLOCK_SCOPE_LINK_TEMPLATE = 'https://studio.tailf266ac.ts.net:8797/s/{slug}'
    health = await h.request('/api/health', { headers: human })
    assert.equal(health.json.scope_link_template, TEMPLATE, 'a retired 8797 template is replaced by the Rails template')
    got = await cli('scope', 'url', 'demo')
    assert.equal(got.stdout.trim(), CANONICAL, 'scope url never prints a retired doc port')

    // 2. With the template (the daemon's config), health reports it and every link the CLI prints is canonical.
    process.env.UNBLOCK_SCOPE_LINK_TEMPLATE = TEMPLATE
    health = await h.request('/api/health', { headers: human })
    assert.equal(health.json.scope_link_template, TEMPLATE)
    got = await cli('scope', 'url', 'demo', '--json')
    assert.equal(got.status, 0, got.stderr)
    const after = JSON.parse(got.stdout)
    assert.equal(after.url, 'https://app.rails.so/workspace/rails-admin?route=scoping/demo')
    assert.match(after.studio_url, /\/s\/demo\?studio=1$/)
    got = await cli('scope', 'url', 'demo')
    assert.equal(got.stdout.trim(), 'https://app.rails.so/workspace/rails-admin?route=scoping/demo', 'plain output is the canonical link only (herdr shells out to it)')
    got = await cli('scope', 'list', '--json')
    row = JSON.parse(got.stdout).scopes.find((r) => r.slug === 'demo')
    assert.equal(row.url, 'https://app.rails.so/workspace/rails-admin?route=scoping/demo')
    assert.match(row.studio_url, /\/s\/demo\?studio=1$/)
    got = await cli('scope', 'list')
    assert.match(got.stdout, /route=scoping\/demo/)
    assert.doesNotMatch(got.stdout, /\/s\/demo/, 'the human list prints only the canonical link')

    const nav = await fetch(`http://127.0.0.1:${h.port}/s/demo`, { redirect: 'manual', headers: { ...human, 'Sec-Fetch-Dest': 'document' } })
    assert.equal(nav.status, 302, 'a browser opening an old /s/ link goes to Rails Scoping')
    assert.equal(nav.headers.get('location'), 'https://app.rails.so/workspace/rails-admin?route=scoping/demo')
    const kept = await fetch(`http://127.0.0.1:${h.port}/s/demo?studio=1`, { redirect: 'manual', headers: { ...human, 'Sec-Fetch-Dest': 'document' } })
    assert.equal(kept.status, 200, 'studio_url still opens the Studio page for agent checks')
    const headless = await fetch(`http://127.0.0.1:${h.port}/s/demo`, { redirect: 'manual', headers: { ...human, 'Sec-Fetch-Dest': 'document', 'User-Agent': 'Mozilla/5.0 HeadlessChrome/140.0' } })
    assert.equal(headless.status, 200, 'headless page checks keep the Studio page')
  } finally {
    if (saved === undefined) delete process.env.UNBLOCK_SCOPE_LINK_TEMPLATE; else process.env.UNBLOCK_SCOPE_LINK_TEMPLATE = saved
    await h.close()
  }
})
