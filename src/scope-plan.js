import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const PLAN_URL = /^https:\/\/[a-z0-9.-]+:8950\/plans\/[A-Za-z0-9_-]+$/

const DIAGRAM_CSS = `.ad svg{width:100%;height:auto;font-family:inherit}
.ad .box{fill:transparent;stroke:var(--wf-line);stroke-width:1}
.ad .core{fill:var(--wf-line);fill-opacity:.25;stroke:var(--wf-ink);stroke-width:1.2}
.ad .hd{font-size:13px;font-weight:600;letter-spacing:.04em;fill:var(--wf-muted)}
.ad .t{font-size:14px;font-weight:600;fill:var(--wf-ink)}
.ad .sm{font-size:12px;fill:var(--wf-ink)}
.ad .muted{fill:var(--wf-muted)}
.ad .wire{stroke:var(--wf-muted);stroke-width:1.2;fill:none}
.ad .wire.ac{stroke:var(--wf-ink)}`

export function plansPath(env = process.env) {
  return join(env.UNBLOCK_STATE_DIR || join(env.XDG_STATE_HOME || join(homedir(), '.local', 'state'), 'unblock'), 'scope-plans.json')
}

export function readPlans(path = plansPath()) {
  if (!existsSync(path)) return {}
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function planFor(slug, path = plansPath()) {
  const record = readPlans(path)[slug]
  return record && PLAN_URL.test(record.url ?? '') ? record : null
}

export function recordPlan(slug, record, path = plansPath()) {
  const plans = readPlans(path)
  plans[slug] = record
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(`${path}.tmp`, JSON.stringify(plans, null, 2))
  renameSync(`${path}.tmp`, path)
}

const attr = (value) => String(value).replace(/"/g, "'").replace(/[{}<>]/g, ' ').trim()
const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())

function convertBody(body, counter, assets) {
  const lines = String(body).split('\n'), out = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const image = line.match(/^!\[([^\]]*)\]\(asset:([0-9a-f]{16}\.(?:png|jpg|webp|gif|svg|mock))(?:\s+"[^"]*")?\)\s*$/)
    if (image) {
      assets.add(image[2])
      out.push(`<MockStill id="m${++counter.n}" src="asset:${image[2]}" alt="${attr(image[1]) || 'Figure'}" caption="${attr(image[1])}" />`)
      continue
    }
    if (line.startsWith('|') && /^\|[\s:|-]+\|$/.test((lines[i + 1] ?? '').trim())) {
      const columns = cells(line).map((cell, index) => cell || (index === 0 ? 'Item' : ' '))
      const rows = []
      i += 2
      while (i < lines.length && lines[i].startsWith('|')) rows.push(cells(lines[i++]))
      i--
      out.push(`<Table id="t${++counter.n}" columns={${JSON.stringify(columns)}} rows={${JSON.stringify(rows)}} />`)
      continue
    }
    if (line.trim() === '```svg') {
      const end = lines.indexOf('```', i + 1)
      if (end > i) {
        const svg = lines.slice(i + 1, end).join('\n')
        const label = svg.match(/aria-label="([^"]*)"/)?.[1] ?? ''
        out.push(`<Diagram id="d${++counter.n}" caption="${attr(label)}" frame="hide" renderMode="design">\n\n\`\`\`html\n<div class="ad">\n${svg}\n</div>\n\`\`\`\n\n\`\`\`css\n${DIAGRAM_CSS}\n\`\`\`\n\n</Diagram>`)
        i = end
        continue
      }
    }
    out.push(line)
  }
  return out.join('\n')
}

export function scopeToPlanMdx(scope) {
  const [title, ...sections] = scope.doc.sections
  const counter = { n: 0 }, assets = new Set()
  const lead = String(title?.body_md ?? '').split('\n\n').map((p) => p.trim()).find((p) => p && !/^[!|`<]/.test(p)) ?? ''
  const parts = [convertBody(title?.body_md ?? '', counter, assets)]
  for (const section of sections) parts.push(`## ${section.heading}\n\n${convertBody(section.body_md, counter, assets)}`)
  const mdx = `---\ntitle: ${JSON.stringify(scope.title || title?.heading || scope.slug)}\nbrief: ${JSON.stringify(lead.slice(0, 300))}\n---\n\n${parts.join('\n\n').trim()}\n`
  return { mdx, assets: [...assets] }
}

export function planQuestions(scope) {
  return (scope.threads ?? [])
    .filter((thread) => thread.kind === 'question' && thread.status === 'open' && thread.anchor?.quote && thread.recommendation)
    .map((thread) => ({
      quote: thread.anchor.quote,
      question: thread.messages?.[0]?.text ?? '',
      rec: thread.recommendation,
      ...(thread.why ? { context: thread.why } : {}),
      ...(Array.isArray(thread.options) && thread.options.length ? { options: thread.options.map((o) => (typeof o === 'string' ? o : o.text)).filter(Boolean) } : {}),
    }))
}
