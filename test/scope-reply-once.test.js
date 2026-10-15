import assert from 'node:assert/strict'
import test from 'node:test'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { anchorInSection } from '../src/scope-doc.js'
import { human, startScopeHarness } from './scope-harness.js'

const at = '2026-10-15T17:34:27.859Z'
const sections = [{ id: 'title', heading: 'Work in Rails', body_md: 'Views.' }, { id: 'model', heading: 'Model', body_md: 'The sidebar, Today and Needs you follow it.' }]
const scope = {
  version: 2, slug: 'demo', title: 'Work in Rails', pane: 'w5H:pT1', revision: 1, updated_at: at,
  doc: { sections },
  threads: [{
    id: 'T3', anchor: anchorInSection(sections[1], 'The sidebar, Today and Needs you follow it.'),
    author: 'agent', intent: 'ask', kind: 'question', status: 'open', created_at: at,
    messages: [{ from: 'agent', text: 'Should Today and Needs you narrow to the view you are in?', at }, { from: 'alex', text: 'make it prettier', at }],
  }],
}
const answer = 'Yes, Today and Needs you narrow to the view you are in.'

function reply(port, text) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(import.meta.dirname, '..', 'bin', 'unblock.js'), 'scope', 'reply', 'demo', 'T3', text], { env: { ...process.env, UNBLOCK_PORT: String(port) } })
    let stderr = ''
    child.stderr.on('data', data => { stderr += data })
    child.on('error', reject)
    child.on('close', status => resolve({ status, stderr }))
  })
}

test('the same lane reply sent twice, in parallel or in a row, lands once', async () => {
  const h = await startScopeHarness(scope)
  const replies = async () => (await h.request('/api/scope/demo', { headers: human })).json.scope.threads[0].messages.filter(m => m.from === 'agent' && m.text === answer)
  try {
    const both = await Promise.all([reply(h.port, answer), reply(h.port, answer)])
    for (const r of both) assert.equal(r.status, 0, r.stderr)
    assert.equal((await reply(h.port, answer)).status, 0)
    assert.equal((await replies()).length, 1)

    const r = await h.request('/api/scope/demo/threads/T3/reply', { method: 'POST', headers: h.bearer, body: { text: answer } })
    assert.equal(r.status, 200, r.text)
    assert.equal(r.json.duplicate, true)
    assert.equal((await replies()).length, 1)

    assert.equal((await h.request('/api/scope/demo/threads/T3/reply', { method: 'POST', headers: human, body: { text: 'and the picker too' } })).status, 200)
    assert.equal((await reply(h.port, answer)).status, 0)
    assert.equal((await replies()).length, 2)
  } finally { await h.close() }
})
