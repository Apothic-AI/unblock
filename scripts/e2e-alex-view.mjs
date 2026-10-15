import { rmSync } from 'node:fs'
import { ask, check, held, main, origin, sandbox, setFocus, startDaemon } from './e2e-lib.mjs'

await main(async () => {
  const box = sandbox('alex-view')
  const focus = setFocus(box, ['recruiter'])
  const daemon = await startDaemon(box)
  try {
    const focused = await daemon.api('/api/asks', { ask: ask('Recruiter pricing call'), origin: origin(box, 'recruiter') })
    check(focused.status === 201, `focus ask filed (${focused.status})`)
    const off = await daemon.api('/api/asks', { ask: ask('Factory quota call'), origin: origin(box, 'factory') })
    check(off.status === 202 && off.body.held, `off-focus ask held (${off.status})`)
    const aside = await daemon.api('/api/asks', { ask: ask('Recruiter copy call'), origin: origin(box, 'recruiter') })
    await daemon.api(`/api/asks/${aside.body.ticket}/aside`, { reason: 'not_focus' })
    const surfaced = await daemon.api('/api/asks', { ask: ask('Factory disk call'), origin: origin(box, 'factory'), focus: 'surface' })
    check(surfaced.status === 201, 'an off-focus ask that bypassed the gate is in the store')

    const view = await daemon.api('/api/asks?view=alex')
    check(view.body.asks.length === 1 && view.body.asks[0].ticket === focused.body.ticket, `view=alex returns only the focus ask: ${view.body.asks.map((a) => a.title)}`)
    check(view.body.hidden.not_focus === 1 && view.body.hidden.aside === 1 && view.body.hidden.held === 1,
      `hidden counts not_focus/aside/held = 1/1/1: ${JSON.stringify(view.body.hidden)}`)
    const raw = await daemon.api('/api/asks')
    check(!raw.body.asks.some((a) => a.ticket === aside.body.ticket), 'plain GET /api/asks omits the set-aside ask')
    const withAside = await daemon.api('/api/asks?includeAside=1')
    check(withAside.body.asks.some((a) => a.ticket === aside.body.ticket), 'includeAside=1 returns it')
    const cli = await daemon.cli(['list', '--alex'])
    check(cli.status === 0 && cli.stdout.startsWith('1 for today; 1 held, 1 set aside'), `unblock list --alex: ${cli.stdout.split('\n')[0]}`)
    check((await held(box, ['list'])).stdout.includes('Factory quota call'), 'held list still has the inventory row for agents')

    rmSync(focus)
    const empty = await daemon.api('/api/asks?view=alex')
    check(empty.body.asks.length === 0, 'no focus file: view=alex returns []')
    const json = JSON.parse((await daemon.cli(['list', '--alex', '--json'])).stdout)
    check(json.asks.length === 0, 'unblock list --alex --json has 0 asks with no focus file')
  } finally {
    await daemon.stop()
  }
})
