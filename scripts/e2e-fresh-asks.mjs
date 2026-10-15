import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ask, check, main, origin, sandbox, setFocus, startDaemon } from './e2e-lib.mjs'

await main(async () => {
  const box = sandbox('fresh-asks')
  setFocus(box, ['fresh-live'])
  for (const lane of ['fresh-live', 'fresh-closed']) {
    mkdirSync(join(box.lanes, lane), { recursive: true })
    writeFileSync(join(box.lanes, lane, 'lane.json'), JSON.stringify({
      ...(lane === 'fresh-closed' ? { closed_at: new Date().toISOString() } : {}),
    }))
  }
  mkdirSync(box.config, { recursive: true })
  writeFileSync(join(box.config, 'probes.json'), JSON.stringify({ 'invoice-paid': ['true'] }))
  const daemon = await startDaemon(box)
  try {
    const file = async (title, lane, extra = {}) => {
      const result = await daemon.api('/api/asks', {
        ask: ask(title, extra), origin: origin(box, lane), focus: 'surface',
      })
      check(result.status === 201, `${title} filed (${result.status})`)
      return result.body.ticket
    }
    const closed = await file('Closed lane call', 'fresh-closed')
    const paid = await file('Invoice payment call', 'fresh-live', { closes_on: ['probe:invoice-paid'] })
    const older = await file('Original product call', 'fresh-live', { target: 'product:launch' })
    await new Promise(resolve => setTimeout(resolve, 10))
    const newer = await file('Revised product call', 'fresh-live')
    const revision = await daemon.api(`/api/asks/${newer}/update`, { target: 'product:launch' })
    check(revision.status === 200, 'a revised ask shares the older ask target')
    const live = await file('Live lane call', 'fresh-live')
    const list = async () => {
      const result = await daemon.cli(['list', '--alex', '--json'])
      check(result.status === 0, 'list --alex --json succeeds')
      return JSON.parse(result.stdout)
    }
    const view = await list()
    check(!view.error, `freshness view is available: ${view.error ?? 'ok'}`)
    check(view.asks.length === 2 && [live, newer].every(ticket => view.asks.some(row => row.ticket === ticket)),
      'only the live ask and newest duplicate reach Alex')
    check(view.focus.includes('fresh-live'), 'view includes today\'s focus')
    for (const [ticket, reason] of [[closed, 'lane_closed:fresh-closed'], [paid, 'settled:probe_passed'], [older, `duplicate_of:${newer}`]]) {
      check(view.dropped.some(row => row.ticket === ticket && row.dropped_reason === reason), `${ticket} dropped as ${reason}`)
      const stored = (await daemon.api(`/api/asks/${ticket}`)).body
      check(stored.status === 'open' && stored.set_aside_reason === reason, `${reason} persists as a set-aside open ask`)
    }
    const again = await list()
    check(again.dropped.length === 3, 'later views retain all three drop receipts')
    const restored = await daemon.cli(['restore', older, '--json'])
    check(restored.status === 0, 'restore CLI succeeds')
    const row = JSON.parse(restored.stdout).ask
    check(row.restored_at > 0 && row.set_aside_at == null, 'restore clears set-aside and stamps restored_at')
    for (let i = 0; i < 2; i++) {
      const after = await list()
      check(after.asks.length === 3 && [older, newer, live].every(ticket => after.asks.some(row => row.ticket === ticket)),
        'restored duplicate survives the freshness pass')
      check(after.dropped.length === 2 && !after.dropped.some(row => row.ticket === older), 'restored duplicate leaves dropped')
    }
    console.log(JSON.stringify({ asks: view.asks.map(row => row.ticket), dropped: view.dropped, restored: older }))
  } finally {
    await daemon.stop()
  }
})
