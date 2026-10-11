#!/usr/bin/env node
import readline from 'node:readline'
import { api } from './paths.js'
import { activeProfile } from './herdr.js'
import { applyKey, initialValues, missingFor, redactValue, sortAsks } from './queue-model.js'
import { levelOf } from '../src/queue-model.js'
import { APPROVAL_PURPOSES } from '../src/schema.js'

// Consent, spend, message and permission asks refuse every local write with
// 403 HUMAN_ONLY — drafts included — because the TUI carries the same bearer
// an agent does and the daemon cannot tell them apart. So never send those
// writes: say it once instead of surfacing a raw 403 on every keystroke.
const APPROVAL_NOTICE = 'an approval only counts from the page — press l for a link'
const isApproval = (ask) => APPROVAL_PURPOSES.includes(ask?.purpose)

const stdin = process.stdin
const stdout = process.stdout
const interactive = Boolean(stdin.isTTY)
const color = !process.env.NO_COLOR && stdout.isTTY

/** ANSI style helpers. Every styled run is closed with reset so lines can be
 * truncated at any point without bleeding attributes into the next line. */
const style = (code) => (color ? `\x1b[${code}m` : '')
const reset = style('0')
const bold = style('1')
const dim = style('2')
const inverse = style('7')
const fg = (n) => style(`38;5;${n}`)

const accent = fg(202) // the gating dot's orange, #ff4d00 territory
const ok = fg(71)
const bad = fg(203)
const faint = fg(240)

/** One visual identity with the web panel: same kinds, same hues. */
const KINDS = {
  key: { glyph: '⚿', label: 'key', color: fg(202) },
  click: { glyph: '➤', label: 'to do', color: fg(202) },
  decision: { glyph: '◆', label: 'decision', color: fg(141) },
  question: { glyph: '?', label: 'question', color: fg(141) },
  consent: { glyph: '✓', label: 'consent', color: fg(39) },
  spend: { glyph: '$', label: 'spend', color: fg(178) },
  message: { glyph: '✉', label: 'message', color: fg(205) },
  permission: { glyph: '⚠', label: 'permission', color: fg(203) },
}
const kindOf = (ask) =>
  KINDS[ask.purpose !== 'blocker' ? ask.purpose : (ask.fields || []).some((f) => f.type === 'secret') ? 'key' : 'click']

let restored = false
function restore() {
  if (restored) return
  restored = true
  if (interactive && stdin.isRaw) stdin.setRawMode(false)
  if (interactive) stdout.write('\x1b[?25h\x1b[?1049l')
}
process.once('exit', restore)
process.once('SIGINT', () => { restore(); process.exit(0) })
process.once('SIGTERM', () => { restore(); process.exit(0) })
process.once('uncaughtException', (error) => {
  restore()
  console.error(error?.stack || error)
  process.exit(1)
})

function age(createdAt) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`
  return `${Math.round(seconds / 86400)}d ago`
}

const oneLine = (value) => String(value || '').replace(/\s+/g, ' ').trim()
function meta(ask) {
  const origin = ask.origin || {}
  const parts = [origin.workspace_name || 'workspace']
  if (origin.pane_id) parts.push(`pane ${origin.pane_id}`)
  parts.push(age(ask.created_at))
  return parts.join(' · ')
}

/**
 * Lines are built as styled segments and flattened with a visible-width
 * budget, so a narrow terminal clips text but never cuts an escape sequence.
 */
const ANSI_RE = /\x1b\[[0-9;]*m/g
const visible = (text) => [...text.replace(ANSI_RE, '')].length
const s = (text, tone = '') => ({ text: String(text), tone })
function flat(segments, width) {
  if (width <= 0) return ''
  const over = segments.reduce((sum, { text }) => sum + visible(text), 0) > width
  const budget = over ? width - 1 : width // leave a column for the ellipsis
  let out = ''
  let used = 0
  for (const { text, tone } of segments) {
    const room = budget - used
    if (room <= 0) break
    const take = [...text].slice(0, room).join('')
    if (take) out += tone ? tone + take + reset : take
    used += visible(take)
  }
  // Clip with an ellipsis instead of cutting a word in half.
  return over ? out + faint + '…' + reset : out
}
/** Word-wrap plain text; each result is short enough for one row. */
function wrap(text, width) {
  const words = oneLine(text).split(' ').filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    if (line && visible(line) + 1 + visible(word) > width) { lines.push(line); line = word }
    else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function headerLines(width, queue, scope) {
  const gating = queue.filter((ask) => ask.gating).length
  const right = [
    queue.length ? `${queue.length} waiting` : 'clear',
    gating ? `${gating} gating` : '',
    `profile ${scope}`,
  ].filter(Boolean).join(' · ')
  const left = [s(' ▌', accent), s(' unblock', bold)]
  const leftWidth = 2 + visible(' unblock')
  const gap = Math.max(1, width - leftWidth - visible(right))
  return [
    flat([...left, s(' '.repeat(gap)), s(right, dim)], width),
    flat([s(' ' + '─'.repeat(Math.max(0, width - 1)), faint)], width),
  ]
}

function askLines(ask, { focused, open, width }) {
  const kind = kindOf(ask)
  const level = levelOf(ask)
  const marker = focused ? [s(' ▸', accent)] : [s('  ')]
  const badge = ask.gating ? s(' !', accent) : s('  ')
  const lines = []
  const head = [
    ...marker, badge,
    s(` ${kind.glyph} `, kind.color), s(kind.label, kind.color),
    s(`  ${meta(ask)}`, dim), s(`  ${level}`, faint),
  ]
  lines.push(head)
  const titleTone = focused ? bold + (color ? kind.color : '') : bold
  lines.push([s('     '), s(oneLine(ask.title), titleTone)])
  const why = oneLine(ask.summary || ask.why)
  if (why) lines.push([s('     '), s(why, dim)])
  if (!open) {
    const needs = (ask.fields || []).filter((f) => !(f.name in (ask.answers || {})))
    if (needs.length) lines.push([s('     '), s(`needs: ${needs.map((f) => f.label || f.name).join(', ')}`, faint)])
    lines.push([s('')])
    return lines
  }

  if (oneLine(ask.why) && ask.summary && oneLine(ask.why) !== why) {
    for (const row of wrap(ask.why, Math.max(20, width - 7))) lines.push([s('     '), s(row, dim)])
  }
  for (const step of ask.steps || []) lines.push([s('       '), s('· ', faint), s(oneLine(step), dim)])
  for (const link of ask.links || []) {
    lines.push([s('       '), s('↗ ', kind.color), s(oneLine(link.label || link.url), dim), s(`  ${link.url}`, faint)])
  }
  const fields = unansweredFields(ask)
  if (fields.length) lines.push([s('')])
  fields.forEach((field, i) => {
    const isFocus = focused && i === fieldIndex
    const state = states.get(`${ask.ticket}:${field.name}`) || { value: undefined }
    const pointer = isFocus ? s('    › ', accent) : s('      ')
    const label = `${field.label || field.name}${field.required ? ' *' : ''}`
    if (field.type === 'choice') {
      const value = state.value
      const picked = (field.choices || []).map((choice, n) => {
        const on = Array.isArray(value) ? value.includes(choice.value) : value === choice.value
        const radio = field.multi ? (on ? '▣' : '□') : (on ? '●' : '○')
        return `${radio} ${n + 1}:${choice.label}`
      }).join('   ')
      lines.push([pointer, s(label, isFocus ? bold : ''), s(`  ${picked}`, dim)])
      if (isFocus) lines.push([s('         '), s('←/→ or number to choose · tab next field', faint)])
    } else if (field.type === 'confirm') {
      lines.push([pointer, s(label, isFocus ? bold : ''), s(`  ${state.value ? '▣ yes' : '□ no'}`, state.value ? ok : dim)])
      if (isFocus) lines.push([s('         '), s('space to toggle · tab next field', faint)])
    } else {
      const shown = redactValue(field, state.value)
      const valueSeg = shown
        ? s(`  ${shown}`, isFocus ? inverse : '')
        : s('  type here', faint)
      lines.push([pointer, s(label, isFocus ? bold : ''), valueSeg])
      if (field.type === 'paste' && field.command) {
        lines.push([s('         '), s('run: ', faint), s(field.command, dim)])
      }
    }
  })
  lines.push([s('')])
  return lines
}

function keyChip(key, action) {
  return [s(` ${key} `, inverse), s(` ${action}   `, dim)]
}

function footerLines(width) {
  const ask = selectedAsk()
  const missing = ask && expanded === ask.ticket ? missingFor(ask, valuesFor(ask)) : []
  let status = footer
  let tone = footerKind === 'error' ? bad : footerKind === 'ok' ? ok : accent
  if (!status && missing.length) { status = `still needed: ${missing.join(', ')}`; tone = bad }
  const keys = expanded === ask?.ticket
    ? [keyChip('tab', 'fields'), keyChip('␣/←/→', 'answer'), keyChip('^⏎', 'submit'), keyChip('esc', 'fold'), keyChip('q', 'quit')]
    : [keyChip('j/k', 'move'), keyChip('⏎', 'open'), keyChip('r', 'refresh'), keyChip('p', 'scope'), keyChip('l', 'link'), keyChip('q', 'quit')]
  return [
    flat([s(' ' + '─'.repeat(Math.max(0, width - 1)), faint)], width),
    status ? flat([s(' '), s(status, tone)], width) : '',
    flat([s(' '), ...keys.flat()], width),
  ]
}

function plainListing(data) {
  const queue = sortAsks((data.asks || []).filter((ask) => ask.status === 'open'))
  const width = Math.max(40, stdout.columns || Number(process.env.COLUMNS) || 100)
  const lines = [...headerLines(width, queue, data.profile || '*'), '']
  if (queue.length === 0) {
    lines.push(flat([s('   ✔ ', ok), s('Queue is clear — nothing needs you.', dim)], width), '')
  }
  queue.forEach((ask) => {
    for (const segments of askLines(ask, { focused: false, open: false, width })) {
      lines.push(flat(segments, width))
    }
  })
  return lines.join('\n') + '\n'
}

const activeScope = await activeProfile()
let profile = activeScope || '*'
let data = { asks: [], hidden: 0, profile }
let selected = 0
let expanded = null
let fieldIndex = 0
let states = new Map()
let footer = ''
let footerKind = 'info'
let draftTimer
let isEditing = false
let busy = false
let scroll = 0

const asks = () => sortAsks((data.asks || []).filter((ask) => ask.status === 'open'))
const selectedAsk = () => asks()[selected]

function valuesFor(ask) {
  return Object.fromEntries(
    (ask.fields || []).map((field) => [field.name, states.get(`${ask.ticket}:${field.name}`)?.value])
      .filter(([, value]) => value !== undefined),
  )
}

function initialize() {
  for (const ask of asks()) {
    const values = initialValues(ask)
    for (const field of ask.fields || []) {
      const key = `${ask.ticket}:${field.name}`
      if (!states.has(key)) states.set(key, { value: values[field.name] })
    }
  }
}

function setFooter(text, kind = 'info') {
  footer = text
  footerKind = kind
}

async function refresh({ renderAfter = true } = {}) {
  if (isEditing || busy) return
  busy = true
  try {
    data = await api(`/api/asks?profile=${encodeURIComponent(profile)}`)
    selected = Math.min(selected, Math.max(0, asks().length - 1))
    initialize()
    setFooter('')
  } catch (error) {
    setFooter(error.message, 'error')
  } finally {
    busy = false
    if (renderAfter && interactive) render()
  }
}

if (!interactive) {
  data = await api(`/api/asks?profile=${encodeURIComponent(profile)}`)
  data.profile = profile
  stdout.write(plainListing(data))
  process.exit(0)
}

function unansweredFields(ask) {
  return (ask.fields || []).filter((field) => !(field.name in (ask.answers || {})))
}

function render() {
  const width = Math.max(24, stdout.columns || Number(process.env.COLUMNS) || 100)
  const rows = Math.max(10, stdout.rows || Number(process.env.LINES) || 40)
  const queue = asks()
  const header = headerLines(width, queue, profile)
  const foot = footerLines(width)
  const budget = Math.max(1, rows - header.length - foot.length - 1)

  const body = []
  let selectedStart = 0
  queue.forEach((ask, index) => {
    if (index === selected) selectedStart = body.length
    for (const segments of askLines(ask, {
      focused: index === selected, open: expanded === ask.ticket, width,
    })) body.push(segments)
  })
  if (queue.length === 0) {
    body.push([s('')])
    body.push([s('     ✔ ', ok), s('Queue is clear — nothing needs you.', dim)])
    body.push([s(''), s('       Agents file here when only you can clear the way.', faint)])
  }

  // Keep the selection inside the window; fold an open card upward when it
  // overflows so its fields stay reachable instead of falling off the screen.
  if (selectedStart < scroll) scroll = selectedStart
  const endOfSelected = body.length && queue.length
    ? Math.min(body.length, selectedStart + askLines(selectedAsk() || queue[0], {
        focused: true, open: expanded === (selectedAsk() || queue[0])?.ticket, width,
      }).length)
    : 0
  if (endOfSelected - scroll > budget) scroll = endOfSelected - budget
  scroll = Math.max(0, Math.min(scroll, Math.max(0, body.length - budget)))

  const windowLines = body.slice(scroll, scroll + budget).map((segments) => flat(segments, width))
  while (windowLines.length < budget) windowLines.push('')
  const more = body.length > budget
    ? flat([s(` ${scroll > 0 ? '↑' : ' '} ${scroll + budget < body.length ? '↓' : ' '} `, faint)], width)
    : ''
  const screen = [...header, ...windowLines, ...[more, ...foot].filter(Boolean)]
  stdout.write(`\x1b[H\x1b[2J${screen.join('\n')}`)
}

function safeDraft(ask) {
  const secretNames = new Set((ask.fields || []).filter((field) => field.type === 'secret').map((field) => field.name))
  return Object.fromEntries(Object.entries(valuesFor(ask)).filter(([name]) => !secretNames.has(name)))
}

function scheduleDraft(ask, field) {
  if (field.type === 'secret' || isApproval(ask)) return
  clearTimeout(draftTimer)
  draftTimer = setTimeout(async () => {
    try { await api(`/api/asks/${encodeURIComponent(ask.ticket)}/draft`, { values: safeDraft(ask) }) }
    catch (error) { setFooter(error.message, 'error'); render() }
  }, 700)
}

async function submit() {
  const ask = selectedAsk()
  if (!ask || expanded !== ask.ticket) return
  if (isApproval(ask)) { setFooter(APPROVAL_NOTICE, 'info'); return render() }
  const missing = missingFor(ask, valuesFor(ask))
  if (missing.length) { setFooter(`still needed: ${missing.join(', ')}`, 'error'); return render() }
  busy = true
  try {
    const result = await api(`/api/asks/${encodeURIComponent(ask.ticket)}/answer`, { values: valuesFor(ask) })
    setFooter(result.complete && ask.gating ? `waking ${ask.origin?.agent || 'agent'}` : result.complete ? 'answered' : 'saved', 'ok')
    expanded = null
    data.asks = data.asks.filter((item) => item.ticket !== ask.ticket || !result.complete)
  } catch (error) { setFooter(error.message, 'error') }
  finally { busy = false; render() }
}

async function mintLink() {
  try {
    const result = await api('/api/links', { ttl_seconds: 3600 })
    setFooter(`${result.url} (expires ${result.expires_at})`, 'ok')
  } catch (error) { setFooter(error.message, 'error') }
  render()
}

function finishEditingSoon() {
  isEditing = true
  clearTimeout(finishEditingSoon.timer)
  finishEditingSoon.timer = setTimeout(() => { isEditing = false }, 700)
}

readline.emitKeypressEvents(stdin)
stdin.setRawMode(true)
stdout.write('\x1b[?1049h\x1b[?25l')
process.on('SIGWINCH', render)
stdin.on('keypress', (_text, key) => {
  if (busy) return
  if ((key.ctrl && key.name === 'c') || key.name === 'q') { restore(); process.exit(0) }
  if (key.ctrl && (key.name === 'return' || key.name === 'enter')) return void submit()
  if (key.name === 'escape' && expanded) {
    expanded = null
    setFooter('')
    return render()
  }
  const queue = asks()
  const ask = selectedAsk()
  const fields = ask ? unansweredFields(ask) : []

  if (expanded === ask?.ticket && fields.length) {
    if (key.name === 'tab') {
      fieldIndex = (fieldIndex + (key.shift ? -1 : 1) + fields.length) % fields.length
      setFooter('')
      return render()
    }
    const field = fields[fieldIndex]
    const stateKey = `${ask.ticket}:${field.name}`
    const previous = states.get(stateKey) || { value: undefined }
    const next = applyKey(previous, key, field)
    if (next !== previous) {
      states.set(stateKey, next)
      finishEditingSoon()
      scheduleDraft(ask, field)
      setFooter('')
      return render()
    }
  }

  if (key.name === 'j' || key.name === 'down') selected = Math.min(queue.length - 1, selected + 1)
  else if (key.name === 'k' || key.name === 'up') selected = Math.max(0, selected - 1)
  else if (key.name === 'return' || key.name === 'enter') {
    expanded = expanded === ask?.ticket ? null : ask?.ticket
    fieldIndex = 0
  } else if (key.name === 's') return void submit()
  else if (key.name === 'r') return void refresh()
  else if (key.name === 'p') { profile = profile === '*' ? (activeScope || '*') : '*'; return void refresh() }
  else if (key.name === 'l') return void mintLink()
  else return
  setFooter('')
  render()
})

await refresh()
setInterval(() => { if (!isEditing) void refresh() }, 6000).unref()
