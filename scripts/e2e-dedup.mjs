import { ask, check, held, main, origin, sandbox, startDaemon } from './e2e-lib.mjs'

await main(async () => {
  const box = sandbox('dedup')
  const daemon = await startDaemon(box, { UNBLOCK_HELD_ASKS: '' })
  try {
    const first = await daemon.api('/api/asks', { ask: ask('Railway prod token', { project: 'Rails', target: 'railway:token' }), origin: origin(box, 'rails') })
    check(first.status === 201, `first Railway token ask filed (${first.status})`)
    const second = await daemon.api('/api/asks', { ask: ask('Need the Railway API token for deploys', { project: 'rails', target: 'railway:token' }), origin: origin(box, 'launch') })
    check(second.status === 409 && second.body.ticket === first.body.ticket, `same target under "rails" returns the first ticket (${second.status} ${second.body?.ticket})`)
    const cased = await daemon.api('/api/asks', { ask: ask('railway prod token!', { project: 'rails' }), origin: origin(box, 'rails') })
    check(cased.status === 409 && cased.body.ticket === first.body.ticket, 'same title under a different-case project returns the first ticket')
    const bundle = await daemon.api('/api/asks', { ask: ask('Bland number, ChatGPT seat', { project: 'connectors-store', purpose: 'decision', target: 'bland:number,chatgpt:test-seat' }), origin: origin(box, 'connectors-store') })
    check(bundle.status === 201, `bundle ask filed (${bundle.status})`)
    const covered = await daemon.api('/api/asks', { ask: ask('Approve an owned Bland test number', { project: 'store', target: 'bland:number' }), origin: origin(box, 'other') })
    const retarget = await daemon.api(`/api/asks/${first.body.ticket}/update`, { target: 'resend:api-key' })
    check(retarget.status === 200 && retarget.body.ask?.target === 'resend:api-key', `a revision sets the target (${retarget.status})`)
    check(covered.status === 409 && covered.body.ticket === bundle.body.ticket, `an ask the bundle covers returns the bundle ticket (${covered.status} ${covered.body?.ticket})`)
  } finally {
    await daemon.stop()
  }
  const telnyx = JSON.stringify({ owner: 'agent-reach', keys: ['agent-reach', 'w5h:p1ay'], kind: 'credential', title: 'Telnyx number',
    target: 'telnyx:number', ask: { title: 'Telnyx number', target: 'telnyx:number' } })
  const a = JSON.parse((await held(box, ['hold'], telnyx)).stdout).id
  const b = JSON.parse((await held(box, ['hold'], telnyx.replace('"Telnyx number",', '"Buy a Telnyx number",'))).stdout).id
  check(a === b, `the same Telnyx hold twice gives one held id (${a}, ${b})`)
  check(JSON.parse((await held(box, ['list'])).stdout).length === 1, 'held list has one row')
  const bundled = JSON.stringify({ owner: 'connectors-store', keys: ['connectors-store'], kind: 'decision', title: 'Bland number, ChatGPT seat, Granola key',
    target: 'bland:number,chatgpt:test-seat,granola:key' })
  const c = JSON.parse((await held(box, ['hold'], bundled)).stdout).id
  const d = JSON.parse((await held(box, ['hold'], JSON.stringify({ owner: 'connectors-store', keys: ['connectors-store'], kind: 'spend',
    title: 'Approve an owned Bland test number', target: 'bland:number' }))).stdout).id
  check(c === d, `a hold the bundle covers returns the bundle id (${c}, ${d})`)
})
