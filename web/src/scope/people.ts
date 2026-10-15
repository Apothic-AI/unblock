import { normalizePerson, normalizeHandling, type Thread, type ThreadMessage, type Person } from '../../../src/scope-doc.js'
import { esc } from './markdown.ts'

const railsMark = '<svg class="rails-mark" viewBox="0 0 120 120" fill="currentColor" aria-hidden="true"><path d="M23.75 105H41.75L63.75 33H45.75Z"/><path d="M56.25 87H74.25L96.25 15H78.25Z"/></svg>'
const authorKey = (person: Person) => `${person.kind}:${person.id}`

export function author(thread: Thread, index: number): Person {
  const message = thread.messages[index]
  return normalizePerson(message?.by) || (index === 0 ? normalizePerson(thread.by) : undefined) || (message?.from === 'alex'
    ? { kind: 'person', id: 'alex', name: 'Alex' }
    : { kind: 'agent', id: 'rails', name: 'Lane' })
}

function privateThread(thread: Thread) {
  const people = new Map(thread.messages.map((_, index) => { const by = author(thread, index); return [authorKey(by), by] }))
  return people.size === 2 && [...people.values()].some(by => by.kind === 'person' && (by.id.toLowerCase() === 'alex' || by.name.trim().toLowerCase() === 'alex')) && [...people.values()].filter(by => by.kind === 'agent').length === 1
}

export function avatarHtml(person: Person) {
  const tint = [...person.id].reduce((hash, char) => (hash * 31 + char.codePointAt(0)!) >>> 0, 0) % 3
  const initials = person.name.trim().split(/\s+/).slice(0, 2).map(word => [...word][0]).join('').toUpperCase()
  return `<span class="avatar tint-${tint}${person.kind === 'agent' ? ' agent' : ''}" role="img" aria-label="${esc(person.name)}" title="${esc(person.name)}">${person.photo_url ? `<img src="${esc(person.photo_url)}" alt="" referrerpolicy="no-referrer">` : person.kind === 'agent' ? railsMark : esc(initials)}</span>`
}

// Each message keeps its own live-update anchor, even when its author header is shared.
export function chatMessageHtml(thread: Thread, index: number, body: string, classes = '', attributes = '', previousIndex = index - 1) {
  const message: ThreadMessage = thread.messages[index], by = author(thread, index)
  const grouped = previousIndex >= 0 && authorKey(author(thread, previousIndex)) === authorKey(by)
  return `<div class="msg chat-row${grouped ? ' continued' : ''}${classes ? ` ${classes}` : ''}" title="${esc(message.at)}"${message.from === 'alex' ? ` data-alex-at="${esc(message.at)}"` : ''}${attributes}>${grouped ? '' : avatarHtml(by)}<div class="chat-content">${grouped || privateThread(thread) ? '' : `<div class="from">${esc(by.name)}</div>`}${body}</div></div>`
}

export function handlingChipHtml(thread: Thread) {
  const handling = normalizeHandling(thread.handling)
  if (!handling) return ''
  const label = { workflow: 'Waiting on workflow', teammate: 'Waiting on teammate', research: 'Researching' }[handling.state]
  return `<span class="handling-chip"${handling.note ? ` title="${esc(handling.note)}"` : ''}>${label}</span>`
}

export function alexWordsHtml(thread: Thread) {
  const words = thread.resolution?.alex_words?.trim()
  return words && words.toLowerCase() !== thread.resolution?.decision.trim().toLowerCase() ? `<p class="alex-words">Alex: <q>${esc(words)}</q></p>` : ''
}
