import { sectionAudience, AGENT_HEADING, type DocSection } from '../../../src/scope-doc.js'

const AGENT_COLUMN = /^(?:files?|checks?|tests?|files and (?:checks|tests))$/i
const chevron = '<svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>'
const storeKey = (slug: string, key: string) => `scope:agents:${slug}:${key}`

function read(key: string) { try { return localStorage.getItem(key) } catch { return null } }
function write(key: string, value: string) { try { localStorage.setItem(key, value) } catch {} }

function records(nodes: Element[]) {
  const all = (selector: string) => nodes.flatMap(n => [...(n.matches(selector) ? [n] : []), ...n.querySelectorAll(selector)])
  const headings = all('h3,h4').length
  if (headings) return headings
  const rows = all('tbody tr').length
  if (rows) return rows
  const slices = all('pre').reduce((sum, pre) => sum + (pre.textContent || '').split('\n').filter(line => /^[A-Z]{1,3}\d+\b/.test(line)).length, 0)
  if (slices) return slices
  const items = all('li').length
  return items || nodes.length
}

function fold(label: string, count: number, key: string, slug: string, onToggle: () => void, extra = '') {
  const details = document.createElement('details')
  details.className = `agents-fold${extra ? ` ${extra}` : ''}`
  details.dataset.agentsKey = key
  if (read(storeKey(slug, key)) === '1') details.open = true
  const summary = document.createElement('summary')
  summary.className = 'agents-row'
  summary.dataset.cmSkip = ''
  summary.innerHTML = `${chevron}<span>For agents · ${label.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)} · ${count} ${count === 1 ? 'record' : 'records'}</span>`
  summary.addEventListener('click', () => { details.dataset.user = '1' })
  details.addEventListener('toggle', () => {
    if (details.dataset.user) { write(storeKey(slug, key), details.open ? '1' : '0'); delete details.dataset.user }
    onToggle()
  })
  const content = document.createElement('div')
  content.className = 'agents-content'
  details.append(summary, content)
  return { details, content }
}

const plain = (el: Element) => (el.textContent || '').trim()

function splitTable(wrap: Element, index: number, sectionId: string, slug: string, onToggle: () => void) {
  const table = wrap.querySelector('table')
  if (!table) return
  const head = [...table.querySelectorAll('thead th')]
  const agent = head.map((th, i) => i > 0 && AGENT_COLUMN.test(plain(th)) ? i : -1).filter(i => i >= 0)
  if (!agent.length || agent.length >= head.length - 1) return
  const rows = [...table.querySelectorAll('tbody tr')]
  const detail = document.createElement('table')
  const keep = [0, ...agent]
  detail.innerHTML = `<thead><tr>${keep.map(i => `<th>${head[i].innerHTML}</th>`).join('')}</tr></thead><tbody></tbody>`
  detail.querySelectorAll('thead th').forEach((th, i) => { if (i === 0) th.setAttribute('data-cm-skip', '') })
  const body = detail.querySelector('tbody')!
  for (const row of rows) {
    const cells = [...row.children]
    const tr = document.createElement('tr')
    keep.forEach((i, position) => {
      const td = cells[i]
      if (!td) return
      if (position === 0) { const copy = td.cloneNode(true) as Element; copy.setAttribute('data-cm-skip', ''); tr.append(copy) }
      else tr.append(td)
    })
    body.append(tr)
  }
  const label = agent.map(i => plain(head[i])).join(' and ')
  for (const i of [...agent].reverse()) head[i].remove()
  const { details, content } = fold(label, rows.length, `${sectionId}/table-${index}`, slug, onToggle, 'sub')
  const detailWrap = document.createElement('div'); detailWrap.className = 'table-wrap'; detailWrap.append(detail)
  content.append(detailWrap)
  wrap.after(details)
}

export function foldAgents(section: HTMLElement, s: DocSection, slug: string, onToggle: () => void) {
  const body = section.querySelector<HTMLElement>(':scope > .body')
  if (!body || s.id === 'title' || s.id === 'ask') return
  if (sectionAudience(s) === 'agents') {
    const h2 = section.querySelector(':scope > h2')
    const { details, content } = fold(s.heading, records([...body.children]), s.id, slug, onToggle, 'whole')
    section.prepend(details)
    if (h2) content.append(h2)
    content.append(body)
    return
  }
  body.querySelectorAll(':scope > .table-wrap').forEach((wrap, index) => splitTable(wrap, index, s.id, slug, onToggle))
  const children = [...body.children]
  for (let i = 0; i < children.length; i++) {
    const heading = children[i]
    if (!/^H[34]$/.test(heading.tagName) || !AGENT_HEADING.test(plain(heading))) continue
    const level = Number(heading.tagName[1])
    const group: Element[] = [heading]
    let j = i + 1
    while (j < children.length && !(/^H[34]$/.test(children[j].tagName) && Number(children[j].tagName[1]) <= level)) group.push(children[j++])
    const key = `${s.id}/${plain(heading).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`
    const { details, content } = fold(plain(heading), records(group.slice(1)), key, slug, onToggle, 'sub')
    heading.before(details)
    content.append(...group)
    i = j - 1
  }
}

export function openFoldsAround(node: Element | null) {
  let opened = false
  for (let el = node?.closest('details.agents-fold'); el; el = el.parentElement?.closest('details.agents-fold')) {
    const details = el as HTMLDetailsElement
    if (!details.open) { details.open = true; opened = true }
  }
  return opened
}

export function openFoldsWithQuestions(root: ParentNode, slug: string) {
  let opened = false
  root.querySelectorAll<HTMLDetailsElement>('details.agents-fold:not([data-auto])').forEach(details => {
    details.dataset.auto = '1'
    if (details.open || !details.querySelector('mark.hl.open')) return
    if (read(storeKey(slug, details.dataset.agentsKey || '')) === '0') return
    details.open = true; opened = true
  })
  return opened
}
