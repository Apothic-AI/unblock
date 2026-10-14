import assert from 'node:assert/strict'
import test from 'node:test'
import { validateScope } from '../src/scope-doc.js'
// Like answerHtml, these are the production HTML entries used by page.ts, with no DOM substitute.
import { chatMessageHtml, handlingChipHtml, alexWordsHtml } from '../web/src/scope/people.ts'

// Protects the additive reader contract: authors survive normalization and appear in the
// rendered conversation. Existing answer tests do not exercise author or handling metadata.
test('scope conversations distinguish people and agents, show handling and retain Alex’s resolution words', () => {
  const at = '2026-10-03T12:00:00Z'
  const alex = { kind: 'person', id: 'alex', name: 'Alex', photo_url: 'https://example.com/alex.jpg' }
  const nate = { kind: 'person', id: 'nate', name: 'Nate' }
  const rails = { kind: 'agent', id: 'rails', name: 'Rails' }
  const thread = { id: 'T1', anchor: { section: 'title', quote: 'Plan', prefix: '', suffix: '' }, author: 'alex', by: alex, kind: 'comment', status: 'open', created_at: at,
    messages: [{ from: 'alex', text: 'Can we use icons?', at }, { from: 'alex', by: nate, text: 'Yes, and group replies.', at }, { from: 'alex', by: nate, text: 'Keep it compact.', at }, { from: 'agent', by: rails, text: 'I am checking the workflow.', at }],
    handling: { state: 'workflow', note: 'Waiting for the review workflow', at, by: rails } }
  const resolved = { ...structuredClone(thread), id: 'T2', status: 'resolved', resolution: { decision: 'Use compact conversations.', alex_words: 'Keep our own words visible.', by: 'alex', at, confirmed_at: null, revision: null } }
  const doc = { version: 2, slug: 'people', title: 'Plan', pane: '', revision: 1, updated_at: at, doc: { sections: [{ id: 'title', heading: 'Plan', body_md: '' }] }, threads: [thread, resolved] }
  assert.deepEqual(validateScope(doc), [])
  const render = t => t.messages.map((m, i) => chatMessageHtml(t, i, m.text)).join('') + handlingChipHtml(t) + alexWordsHtml(t)
  const html = render(thread) + render(resolved)
  assert.match(html, /src="https:\/\/example.com\/alex.jpg"/)
  assert.match(html, /aria-label="Nate"[^>]*>N<\/span>/)
  assert.match(html, /class="rails-mark"/)
  assert.match(html, /Waiting on workflow/)
  assert.match(html, /title="Waiting for the review workflow"/)
  assert.match(html, /Alex: <q>Keep our own words visible\.<\/q>/)
  assert.equal((render(thread).match(/aria-label="Nate"/g) || []).length, 1, 'consecutive messages share the author header')
  assert.match(render(thread), /class="from">Rails<\/div>/)
  assert.match(render(thread), /title="2026-10-03T12:00:00Z"/)

  thread.messages[1].by.photo_url = 'http://example.com/nate.jpg'
  thread.handling.note = 'x'.repeat(140)
  resolved.handling.state = 'unknown'
  assert.deepEqual(validateScope(doc), [])
  assert.equal(thread.messages[1].by.photo_url, undefined)
  assert.equal(thread.handling.note.length, 120)
  assert.equal(resolved.handling, undefined)
  assert.doesNotMatch(render(thread), /http:\/\/example.com/)
  for (const [state, label] of [['teammate', 'Waiting on teammate'], ['research', 'Researching']]) {
    thread.handling.state = state
    assert.ok(render(thread).includes(label))
  }
  resolved.resolution.alex_words = '  USE COMPACT CONVERSATIONS.  '
  assert.doesNotMatch(render(resolved), /alex-words/)

  // Old v2 documents retain their text and fallback identities, with no new status copy.
  const legacy = structuredClone(thread)
  delete legacy.by
  delete legacy.handling
  legacy.messages = [{ from: 'alex', text: 'Old comment', at }, { from: 'agent', text: 'Old reply', at }]
  doc.threads = [legacy]
  assert.deepEqual(validateScope(doc), [])
  const oldHtml = render(legacy)
  assert.match(oldHtml, /aria-label="Alex"[^>]*>A<\/span>/)
  assert.match(oldHtml, /aria-label="Lane"/)
  assert.match(oldHtml, /Old comment/)
  assert.match(oldHtml, /Old reply/)
  assert.doesNotMatch(oldHtml, /class="from"|handling-chip|alex-words/)
})
