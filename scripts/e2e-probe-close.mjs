import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ask, check, main, origin, sandbox, startDaemon } from './e2e-lib.mjs'

await main(async () => {
  const box = sandbox('probe')
  const flag = join(box.root, 'flag')
  const daemon = await startDaemon(box, { UNBLOCK_HELD_ASKS: '', UNBLOCK_SWEEP_MS: '500', UNBLOCK_PROBE_MS: '300' })
  writeFileSync(join(box.config, 'probes.json'), JSON.stringify({ flag: ['test', '-f', flag] }))
  try {
    const filed = await daemon.api('/api/asks', { ask: ask('Railway billing fixed?', { closes_on: ['probe:flag'] }), origin: origin(box, 'rails') })
    check(filed.status === 201, `ask with probe:flag filed (${filed.status})`)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    check((await daemon.api(`/api/asks/${filed.body.ticket}`)).body.status === 'open', 'stays open while the probe fails')
    writeFileSync(flag, '')
    let closed
    for (let i = 0; i < 50 && closed?.status !== 'cancelled'; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      closed = (await daemon.api(`/api/asks/${filed.body.ticket}`)).body
    }
    check(closed.status === 'cancelled' && closed.close_reason === 'probe_passed', `closed as ${closed.status}/${closed.close_reason} within 5 s`)
  } finally {
    await daemon.stop()
  }
  const box2 = sandbox('unconfirmed')
  const second = await startDaemon(box2, { UNBLOCK_HELD_ASKS: '', UNBLOCK_SWEEP_MS: '300', UNBLOCK_UNCONFIRMED_MS: '500' })
  try {
    const plain = await second.api('/api/asks', { ask: ask('Token still needed?'), origin: origin(box2, 'rails') })
    let row
    for (let i = 0; i < 30 && !row?.set_aside_reason; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      row = (await second.api(`/api/asks/${plain.body.ticket}`)).body
    }
    check(row.set_aside_reason === 'unconfirmed', `an ask with no probe and no keep is set aside as ${row.set_aside_reason}`)
  } finally {
    await second.stop()
  }
})
