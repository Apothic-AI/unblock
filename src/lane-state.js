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

export function lanePanes(info) {
  const history = Array.isArray(info?.panes) ? info.panes : []
  return [info?.owner_pane, info?.pane, info?.herdr?.pane_id, ...history].filter(value => typeof value === 'string' && value.trim())
}

function laneFromPath(path, root) {
  if (typeof path !== 'string' || !path.startsWith(`${root}/`)) return null
  const name = path.slice(root.length + 1).split('/')[0]
  return laneExists(name, root) ? name : null
}

export function laneForAsk(ask, root = lanesRoot()) {
  if (laneExists(ask.origin?.lane_name, root)) return ask.origin.lane_name
  const fromPath = laneFromPath(ask.origin?.cwd, root) || laneFromPath(ask.origin?.repo, root)
  if (fromPath) return fromPath
  const pane = ask.origin?.pane_id
  if (!pane) return null
  try {
    for (const lane of readdirSync(root)) {
      if (!laneExists(lane, root)) continue
      if (lanePanes(metadata(lane, root)).some(value => value.toLowerCase() === pane.toLowerCase())) return lane
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
