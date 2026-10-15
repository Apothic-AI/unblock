import { ask, check, main, origin, sandbox, setFocus, startDaemon } from './e2e-lib.mjs'

await main(async () => {
  const box = sandbox('gate')
  setFocus(box, ['recruiter'])
  const daemon = await startDaemon(box, { UNBLOCK_HELD_ASKS: '/usr/bin/false' })
  try {
    const filed = await daemon.api('/api/asks', { ask: ask('Cos sign-in call'), origin: origin(box, 'cos') })
    check(filed.status === 202, `gate error answers 202 (${filed.status})`)
    const stored = await daemon.api(`/api/asks/${filed.body.ticket}`)
    check(stored.body.set_aside_reason === 'focus_gate_unavailable', `ask is set aside as ${stored.body.set_aside_reason}`)
    const view = await daemon.api('/api/asks?view=alex')
    check(view.body.asks.length === 0 && view.body.error, `absent from view=alex, which fails closed: ${view.body.error}`)
    const raw = await daemon.api('/api/asks')
    check(!raw.body.asks.some((a) => a.ticket === filed.body.ticket), 'absent from the plain listing')
    const loose = await daemon.api('/api/asks', { ask: ask('Prod checkout down'), origin: origin(box, 'factory'), emergency: 'prod checkout returns 500 for every user' })
    check(loose.status === 400 && loose.body.code === 'EMERGENCY_NEEDS_P0', `emergency without P0 is refused (${loose.status})`)
    const p0 = await daemon.api('/api/asks', { ask: ask('Prod checkout down', { level: 'P0' }), origin: origin(box, 'factory'), emergency: 'prod checkout returns 500 for every user' })
    check(p0.status === 201, `P0 emergency files (${p0.status})`)
  } finally {
    await daemon.stop()
  }
})
