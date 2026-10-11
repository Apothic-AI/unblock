import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const lanesRoot = () => process.env.AGENT_RAILS_LANES || join(homedir(), '.agent-rails', 'lanes')
const laneName = name => typeof name === 'string' && name !== '.' && name !== '..' && !/[\\/]/.test(name) && name.length > 0
function metadata(lane, root) {
  try { return JSON.parse(readFileSync(join(root, lane, 'lane.json'), 'utf8')) } catch { return {} }
}
function laneExists(lane, root) {
  if (!laneName(lane)) return false
  try { return statSync(join(root, lane)).isDirectory() } catch { return false }
}

export function laneForAsk(ask, root = lanesRoot()) {
  if (laneExists(ask.origin?.lane_name, root)) return ask.origin.lane_name
  const pane = ask.origin?.pane_id
  if (!pane) return null
  try {
    for (const lane of readdirSync(root)) {
      if (!laneExists(lane, root)) continue
      const info = metadata(lane, root)
      if ([info.owner_pane, info.pane].some(value => typeof value === 'string' && value.toLowerCase() === pane.toLowerCase())) return lane
    }
  } catch {}
  return null
}

export function laneClosed(lane, root = lanesRoot()) {
  if (!laneExists(lane, root)) return false
  const closedAt = metadata(lane, root).closed_at
  if (typeof closedAt === 'string' && closedAt.trim()) return true
  return ['RESULT.md', 'STATE.md'].some(file => {
    const path = join(root, lane, file)
    if (!existsSync(path)) return false
    try {
      return readFileSync(path, 'utf8').split(/\r?\n/).filter(line => line.trim()).slice(-5)
        .some(line => /the lane is closed|handed to \S+/i.test(line))
    } catch { return false }
  })
}
