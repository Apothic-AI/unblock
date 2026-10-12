/**
 * Alex, 2026-10-09 ~15:30 ET: "i dont need to see unblocks for things we didnt say were our
 * focus that day." Every filed ask passes this gate: outside today's focus it is held by the
 * command in UNBLOCK_HELD_ASKS (agent-rails scripts/held_asks.py) and surfaces when Alex makes
 * that work focus. A stated emergency (production down or broken, a security incident) and the
 * held-ask surfacer itself pass, as do permission prompts and herdr-detected waits. With no command configured, or if it fails, the ask is filed.
 */
import { execFile } from 'node:child_process'

const GENERIC = new Set(['claude', 'cli', 'codex', 'unknown', 'agent'])

/** Names an ask can match today's focus by: project, lane, agent, pane (held_asks.ask_keys). */
export function askKeys(ask, origin = {}) {
  const values = [ask?.project, origin.owner, origin.agent, origin.lane_name, origin.pane_id]
  const keys = values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim().toLowerCase())
  return [...new Set(keys.filter((key) => !GENERIC.has(key)))]
}

export function emergencyReason(value) {
  return typeof value === 'string' && value.trim().length >= 12 ? value.trim() : null
}

function run(command, args, input) {
  return new Promise((resolve, reject) => {
    const [file, ...rest] = command.split(/\s+/)
    const child = execFile(file, [...rest, ...args], { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) return reject(new Error((stderr.trim().split('\n').pop() || error.message)))
      try { resolve(JSON.parse(stdout)) } catch { reject(new Error('held asks gave no JSON')) }
    })
    child.stdin.end(input ?? '')
  })
}

/**
 * Decide one filing. Returns { file: true } to file it, or { held, owner, keys } once held.
 * body: the POST /api/asks body ({ ask, origin, emergency?, focus? }); ask is the validated ask.
 */
export async function focusGate(body, ask, origin, env = process.env, log = console.error) {
  const command = (env.UNBLOCK_HELD_ASKS || '').trim()
  if (!command || body?.focus === 'surface' || emergencyReason(body?.emergency)) return { file: true }
  // A permission prompt or a pane herdr saw waiting holds a live session; those reach Alex as before.
  if (ask.purpose === 'permission' || body?.origin?.detected === true) return { file: true }
  const keys = askKeys(ask, origin)
  const exempt = (env.UNBLOCK_FOCUS_EXEMPT ?? 'cos').split(',').map((key) => key.trim().toLowerCase()).filter(Boolean)
  if (keys.some((key) => exempt.includes(key))) return { file: true }
  try {
    if (keys.length && (await run(command, ['in-focus', ...keys])).in_focus) return { file: true }
    const owner = keys[0] ?? 'unknown'
    const held = await run(command, ['hold'], JSON.stringify({
      owner, keys, kind: ask.purpose, title: ask.title, tried: ask.tried ?? [],
      reason: "not in today's focus", ask: { ...body.ask }, origin,
    }))
    return { held: held.id, owner, keys }
  } catch (error) {
    log(`unblock: focus gate unavailable, filing anyway: ${error.message}`)
    return { file: true }
  }
}
