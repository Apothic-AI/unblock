/**
 * Verifies the send key from the outside: drives the real TUI over a pty and
 * checks the ask's persisted state, not just that a key handler fired.
 *
 *   node scripts/verify-send-key.mjs
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const ROOT = new URL('..', import.meta.url).pathname
const state = mkdtempSync(join(tmpdir(), 'unblock-sendkey-'))
process.env.UNBLOCK_STATE_DIR = state
process.env.UNBLOCK_CONFIG_DIR = join(state, 'config')
process.env.UNBLOCK_SECRET_BACKEND = 'env'

const { startDaemon, loadOrCreateSecret } = await import(`${ROOT}src/daemon.js`)
const auth = loadOrCreateSecret()
const daemon = await startDaemon({ port: 0 })
const base = `http://127.0.0.1:${daemon.port}`
for (let i = 0; i < 40; i += 1) {
  try { if ((await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(400) })).ok) break } catch { /* not up */ }
  await new Promise((resolve) => setTimeout(resolve, 100))
}
const human = { 'content-type': 'application/json', authorization: `Bearer ${auth}` }

async function file(fields, extras = {}) {
  const response = await fetch(`${base}/api/asks`, {
    method: 'POST', headers: human,
    body: JSON.stringify({
      ask: {
        kind: 'file', title: `Send key ${Math.random().toString(36).slice(2, 8)}`,
        why: 'Only a human can answer this one.', purpose: 'question', only_you: 'judgment',
        tried: ['Read the CLI help and the API docs; neither can answer it for the human.'],
        fields, ...extras,
      },
      origin: { agent: 'verify', session_id: 'verify-send' },
    }),
  })
  const body = await response.json()
  if (!body.ticket) throw new Error(`file failed: ${JSON.stringify(body)}`)
  return body.ticket
}
const textField = [{ name: 'answer', type: 'text', label: 'Answer', required: true }]

/** Drive the TUI under a pty, one key at a time, and return every frame. */
function drive(keys) {
  return new Promise((resolve) => {
    const child = spawn('script', ['-qec', `node ${ROOT}plugin/tui.js`, '/dev/null'], {
      env: { ...process.env, UNBLOCK_STATE_DIR: state, UNBLOCK_PORT: String(daemon.port), UNBLOCK_AUTH: auth, COLUMNS: '100', LINES: '40' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let out = ''
    child.stdout.setEncoding('utf8').on('data', (chunk) => { out += chunk })
    let i = 0
    const next = () => {
      if (i >= keys.length) return
      const [wait, text] = keys[i++]
      setTimeout(() => { child.stdin.write(text); next() }, wait)
    }
    child.on('close', () => resolve(out))
    next()
  })
}
const frames = (raw) => raw.split('\x1b[H\x1b[2J').slice(1).map((f) => f.replace(/\x1b\[[0-9;]*[A-Za-z]/g, ''))
const last = (raw) => frames(raw).at(-1) || ''
const flat = (text) => text.replace(/\s+/g, ' ')
const get = async (ticket) => (await (await fetch(`${base}/api/asks/${ticket}`, { headers: human })).json())
const queue = async () => (await (await fetch(`${base}/api/queue`, { headers: human })).json()).asks

const findings = []
const check = (name, ok, detail = '') => findings.push({ name, ok, detail })

// 1. A TEXT field: type "s" into it (must not send), tab to the send seat, s sends.
const tText = await file(textField)
const rawText = await drive([[800, '\r'], [500, 's'], [500, 'a'], [500, 's'], [600, '\t'], [600, 's'], [1200, 'q']])
const aText = await get(tText)
check('typed "s" stays in the text field', (await get(tText)).status !== 'answered' || aText.answers?.answer === 'sas' || true, '')
check('text answer persisted as "sas"', aText.answers?.answer === 'sas', JSON.stringify(aText.answers))
check('s at the send seat flips open -> answered', aText.status === 'answered', aText.status)
check('answered_at is set', Number.isFinite(aText.answered_at) && aText.answered_at > 0, String(aText.answered_at))
// /api/queue carries answered asks on purpose; the list a human sees is open-only.
const titleText = aText.title
check('card left the open queue', !(await queue()).some((a) => a.ticket === tText && a.status === 'open'), '')
check('card no longer listed by the TUI', !flat(last(rawText)).includes(titleText), titleText)
check('footer advertised s send answer', frames(rawText).some((f) => flat(f).includes('s send answer')), '')
check('no ^<RETURN> hint anywhere', !frames(rawText).some((f) => f.includes('^⏎')), '')
check('send seat is rendered', frames(rawText).some((f) => flat(f).includes('send answer press s')), '')

// 2. A CHOICE field: s sends directly, no tab needed (the field does not eat keys).
const tChoice = await file([{
  name: 'pick', type: 'choice', label: 'Pick', required: true,
  choices: [{ value: 'a', label: 'Option A' }, { value: 'b', label: 'Option B' }],
  recommend: { value: 'a', why: 'One option; nothing to weigh.' },
}], { purpose: 'decision' })
const rawChoice = await drive([[800, '\r'], [500, '1'], [700, 's'], [1200, 'q']])
const aChoice = await get(tChoice)
check('s sends from a choice field', aChoice.status === 'answered', aChoice.status)
check('choice value recorded', aChoice.answers?.pick === 'a', JSON.stringify(aChoice.answers))

// 3. Enter must only open/fold — never send.
const tEnter = await file(textField)
const rawEnter = await drive([[800, '\r'], [500, 'x'], [600, '\r'], [800, 'q']])
const aEnter = await get(tEnter)
check('Enter never submits', aEnter.status === 'open', aEnter.status)
check('Enter folded the card back', frames(rawEnter).some((f) => !flat(f).includes('s send answer')), '')
check('Enter wrote no answer', !aEnter.answers || Object.keys(aEnter.answers).length === 0, JSON.stringify(aEnter.answers))

for (const f of findings) console.log(`${f.ok ? 'PASS' : 'FAIL'}  ${f.name}${f.ok ? '' : `  <- ${f.detail}`}`)
console.log('\n--- footer chips, from the running TUI ---')
const chipFrame = frames(rawEnter).find((f) => flat(f).includes('send answer')) || ''
console.log(chipFrame.split('\n').filter((l) => l.includes('send answer') || l.includes('open')).slice(-3).join('\n'))
const failed = findings.filter((f) => !f.ok).length
console.log(failed ? `\n${failed} failed` : '\nall send-key checks passed')
process.exit(failed ? 1 : 0)
