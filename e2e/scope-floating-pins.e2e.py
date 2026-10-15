#!/usr/bin/env python3
import os, shutil, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright

E = os.path.dirname(os.path.abspath(__file__))
WT = os.path.abspath(next((a for a in sys.argv[1:] if not a.startswith("--")), os.path.join(E, "..")))
DIST = os.path.join(WT, 'web', 'dist-scope')
OUT = os.environ.get('E2E_OUT') or os.path.join(os.environ.get('TMPDIR', '/tmp'), 'unblock-e2e')
W = os.path.join(OUT, 'work-scope-floating-pins')
SHOTS = os.path.join(OUT, 'shots-floating-pins')
PORT = 4633
URL = f'http://127.0.0.1:{PORT}/scope/demo'
results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail and not ok else ''), flush=True)


GEOMETRY = """() => {
  const doc = document.querySelector('#doc').getBoundingClientRect()
  const cards = [...document.querySelectorAll('.cards')].map(n => n.getBoundingClientRect().width)
  const open = [...new Set([...document.querySelectorAll('mark.hl[data-t]:not(.resolved)')].filter(m => m.getClientRects().length).map(m => m.dataset.t))]
  const pins = open.map(id => {
    const list = [...document.querySelectorAll(`.pin[data-pin="${id}"]:not([hidden])`)]
    const marks = [...document.querySelectorAll(`mark.hl[data-t="${id}"]`)]
    const line = [...marks.at(-1).getClientRects()].filter(r => r.width > 0).at(-1)
    const pin = list[0]?.getBoundingClientRect()
    return { id, count: list.length, dy: pin ? Math.abs((pin.top + pin.height / 2) - (line.top + line.height / 2)) : null, atEnd: pin ? pin.left >= line.right - 4 && pin.left <= line.right + 48 : false, inMargin: pin ? pin.left >= doc.right - 1 : false }
  })
  return { docCenter: (doc.left + doc.right) / 2, width: innerWidth, docWidth: doc.width, cards, pins, popovers: document.querySelectorAll('.cards > .card').length }
}"""


def pop(page):
    return page.evaluate("() => { const c = document.querySelector('.cards > .card'); if (!c) return null; const r = c.getBoundingClientRect(), d = document.querySelector('#doc').getBoundingClientRect(); return { t: c.dataset.t || null, composer: c.classList.contains('composer'), left: r.left, right: r.right, top: r.top, bottom: r.bottom, overDoc: r.left < d.right && r.right > d.left, inView: r.top >= 0 && r.bottom <= innerHeight + 1, text: c.textContent } }")


def desktop(page, label, scheme):
    page.wait_for_selector('.pin[data-pin="T1"]:not([hidden])')
    page.wait_for_timeout(600)
    g = page.evaluate(GEOMETRY)
    check(f'{label}: no comment column (every .cards box is 0 wide)', all(w == 0 for w in g['cards']), g['cards'])
    check(f'{label}: the doc column is centred on the page', abs(g['docCenter'] - g['width'] / 2) <= 4, g)
    check(f'{label}: nothing is open on load', g['popovers'] == 0, g['popovers'])
    check(f'{label}: each open anchor has exactly one pin on its line, at the end of the text or in the margin when the line is full',
          g['pins'] and all(p['count'] == 1 and p['dy'] is not None and p['dy'] <= 20 and (p['atEnd'] or p['inMargin']) for p in g['pins']), g['pins'])
    check(f'{label}: a sentence with room pins right after its text', any(p['atEnd'] and not p['inMargin'] for p in g['pins']), g['pins'])
    fills = page.evaluate("() => [...document.querySelectorAll('.pin .avatar')].filter(a => !a.querySelector('img')).map(a => { const [r, g, b] = getComputedStyle(a).backgroundColor.match(/[\\d.]+/g).map(Number); return 0.2126 * r + 0.7152 * g + 0.0722 * b })")
    check(f'{label}: initials sit on a properly tinted circle, not a pale one', fills and all(l < 200 for l in fills) if scheme == 'light' else bool(fills), fills)
    check(f'{label}: a comment on the title pins beside the title', page.evaluate("() => { const p = document.querySelector('.pin[data-pin=\"T3\"]:not([hidden])')?.getBoundingClientRect(), t = document.querySelector('.pc-title').getBoundingClientRect(); return !!p && p.top < t.bottom && p.bottom > t.top }"))
    page.screenshot(path=os.path.join(SHOTS, f'{label}-closed.png'))
    page.click('.pin[data-pin="T1"]')
    page.wait_for_timeout(400)
    p = pop(page)
    check(f'{label}: the question pin opens its thread over the doc', p and p['t'] == 'T1' and p['overDoc'] and p['inView'], p)
    check(f'{label}: the popover leads with Recommended and Take recommendation', p and 'Recommended' in p['text'] and page.locator('.cards > .card button[data-action="take"]', has_text='Take recommendation').is_visible(), p and p['text'][:200])
    page.screenshot(path=os.path.join(SHOTS, f'{label}-open.png'))
    page.keyboard.press('Escape')
    page.wait_for_timeout(250)
    check(f'{label}: Escape closes it', pop(page) is None)
    for tid in ('T1', 'T4'):
        page.click(f'.pin[data-pin="{tid}"]')
        page.wait_for_timeout(400)
        clear = page.evaluate("(id) => { const c = document.querySelector('.cards > .card')?.getBoundingClientRect(); return !!c && [...document.querySelectorAll(`mark.hl[data-t=\"${id}\"]`)].flatMap(m => [...m.getClientRects()]).every(r => r.right <= c.left || r.left >= c.right || r.bottom <= c.top || r.top >= c.bottom) }", tid)
        check(f'{label}: the {tid} popover leaves its sentence readable', clear)
        page.keyboard.press('Escape')
        page.wait_for_timeout(250)
    page.click('.pin[data-pin="T2"]')
    page.wait_for_timeout(300)
    check(f'{label}: a comment pin opens its own thread', (pop(page) or {}).get('t') == 'T2')
    page.mouse.click(40, 860)
    page.wait_for_timeout(250)
    check(f'{label}: a click outside closes it', pop(page) is None)
    count = page.locator('.pin-nav .pin-count').inner_text()
    check(f'{label}: the header shows a quiet open count', count.strip() == '4 open', count)
    page.click('.pin-nav [data-nav="1"]')
    page.wait_for_timeout(700)
    p = pop(page)
    check(f'{label}: the header arrow opens the next pin', p and p['t'], p)
    page.click('.cards > .card [data-action="close-pop"]')
    page.wait_for_timeout(250)
    check(f'{label}: the close button closes it', pop(page) is None)
    page.evaluate("() => { const m = document.querySelector('#doc section[data-section] p:not(:has(mark))') || [...document.querySelectorAll('#doc p')].at(-1); const r = document.createRange(); const t = [...m.childNodes].find(n => n.nodeType === 3 && n.data.trim().length > 8); r.setStart(t, 0); r.setEnd(t, Math.min(t.data.length, 18)); getSelection().removeAllRanges(); getSelection().addRange(r); document.dispatchEvent(new MouseEvent('mouseup')) }")
    page.wait_for_selector('button.add[data-action="comment"]')
    page.click('button.add[data-action="comment"]')
    page.wait_for_timeout(300)
    p = pop(page)
    check(f'{label}: a selection opens the composer as a popover', p and p['composer'] and p['inView'], p)
    page.fill('.cards > .card.composer textarea', '[rails test] floating pin')
    page.screenshot(path=os.path.join(SHOTS, f'{label}-composer.png'))
    page.click('.cards > .card.composer [data-action="post"]')
    page.wait_for_function("() => [...document.querySelectorAll('.pin:not([hidden])')].length === 5", timeout=8000)
    page.wait_for_timeout(400)
    p = pop(page)
    check(f'{label}: posting turns it into a pin with its thread open', p and p['t'] and not p['composer'] and '[rails test]' in p['text'], p)
    new = p and p['t']
    page.click(f'.cards > .card[data-t="{new}"] [data-action="menu"]')
    page.click(f'.cards > .card[data-t="{new}"] .menu [data-action="delete"]')
    page.click(f'.cards > .card[data-t="{new}"] .menu [data-action="confirm-delete"]')
    page.wait_for_function("() => [...document.querySelectorAll('.pin:not([hidden])')].length === 4", timeout=8000)
    check(f'{label}: deleting the test comment removes its pin', True)
    page.keyboard.press('Escape')
    urllib.request.urlopen(f'http://127.0.0.1:{PORT}/__lane_answer?thread=T2').read()
    urllib.request.urlopen(f'http://127.0.0.1:{PORT}/__agent_resolve?thread=T2').read()
    page.wait_for_function("() => !document.querySelector('.pin[data-pin=\"T2\"]:not([hidden])')", timeout=8000)
    page.wait_for_timeout(300)
    check(f'{label}: a resolved thread with an unread reply shows no pin', page.locator('.pin:not([hidden])').count() == 3, page.locator('.pin:not([hidden])').count())
    check(f'{label}: the header count marks the unread reply quietly', page.evaluate("() => document.querySelector('.pin-nav .pin-count').classList.contains('has-new')"))
    page.click('.pin-nav .pin-count')
    page.wait_for_timeout(250)
    menu = page.locator('.pin-menu').inner_text()
    check(f'{label}: the count menu lists the resolved reply', 'New replies on resolved' in menu, menu[:300])
    page.screenshot(path=os.path.join(SHOTS, f'{label}-menu.png'))
    page.keyboard.press('Escape')
    page.mouse.click(40, 860)
    page.mouse.wheel(0, 400)
    page.wait_for_timeout(500)
    bar = page.evaluate("() => document.querySelector('#page > .pc-bar').getBoundingClientRect().height")
    check(f'{label}: the top bar collapses to 48px or less on scroll', bar <= 48, bar)
    page.screenshot(path=os.path.join(SHOTS, f'{label}-scrolled.png'))


def phone(page, label, scheme):
    page.wait_for_selector('mark.hl[data-t="T1"]')
    page.wait_for_timeout(500)
    check(f'{label}: the page never scrolls sideways', page.evaluate("() => document.documentElement.scrollWidth <= innerWidth"))
    visible = page.evaluate("() => [...document.querySelectorAll('.pin')].filter(p => p.getClientRects().length).length")
    check(f'{label}: no pins crowd the phone gutter', visible == 0, visible)
    page.screenshot(path=os.path.join(SHOTS, f'{label}-closed.png'))
    (page.click if page.context.browser.browser_type.name == 'webkit' else page.tap)('mark.hl[data-t="T1"]')
    page.wait_for_timeout(600)
    ok = page.evaluate("() => document.body.classList.contains('sheet-open') && !!document.querySelector('.sheet .card[data-t=\"T1\"]')")
    check(f'{label}: a tap opens the thread as a bottom sheet', ok)
    check(f'{label}: the sheet offers Take recommendation', page.locator('.sheet button[data-action="take"]', has_text='Take recommendation').is_visible())
    page.screenshot(path=os.path.join(SHOTS, f'{label}-open.png'))
    page.click('.sheet [data-action="close"]')
    page.wait_for_timeout(300)
    check(f'{label}: the sheet closes', not page.evaluate("() => document.body.classList.contains('sheet-open')"))
    page.mouse.wheel(0, 400)
    page.evaluate("() => scrollBy(0, 400)")
    page.wait_for_timeout(500)
    bar = page.evaluate("() => document.querySelector('#page > .pc-bar').getBoundingClientRect().height")
    check(f'{label}: the top bar collapses to 48px or less on scroll', bar <= 48, bar)


def run():
    subprocess.run(['pkill', '-f', f'scope-stub.mjs {PORT}'], capture_output=True)
    shutil.rmtree(W, ignore_errors=True)
    shutil.rmtree(SHOTS, ignore_errors=True)
    os.makedirs(W)
    os.makedirs(SHOTS)
    if '--no-build' not in sys.argv:
        b = subprocess.run(['npm', 'run', 'build:scope-bundle'], cwd=WT, capture_output=True, text=True)
        check('bundle builds', b.returncode == 0, (b.stdout + b.stderr)[-1500:])
        if b.returncode:
            return
    stub = subprocess.Popen(['node', os.path.join(E, 'scope-stub.mjs'), str(PORT), WT, DIST, os.path.join(W, 'stub.log'), 'solo'],
                            stdout=open(os.path.join(W, 'stub.out'), 'w'), stderr=subprocess.STDOUT)
    try:
        for _ in range(50):
            try:
                urllib.request.urlopen(URL).read()
                break
            except Exception:
                time.sleep(0.2)
        with sync_playwright() as pw:
            for engine in ('chromium', 'webkit'):
                browser = getattr(pw, engine).launch()
                for width in (1440, 390):
                    for scheme in ('light', 'dark'):
                        urllib.request.urlopen(f'http://127.0.0.1:{PORT}/__reset').read()
                        label = f'{engine}-{width}-{scheme}'
                        context = browser.new_context(viewport={'width': width, 'height': 900}, color_scheme=scheme,
                                                      has_touch=width < 600, is_mobile=width < 600 and engine == 'chromium')
                        page = context.new_page()
                        errors = []
                        page.on('pageerror', lambda e: errors.append(str(e)))
                        page.goto(URL)
                        try:
                            (phone if width < 600 else desktop)(page, label, scheme)
                        except Exception as e:
                            check(f'{label}: steps ran to the end', False, str(e)[:600])
                        check(f'{label}: no page error', not errors, errors)
                        context.close()
                browser.close()
        print('shots:', SHOTS, flush=True)
    finally:
        stub.terminate()


run()
bad = [r for r in results if not r[1]]
print(f'\n{len(results) - len(bad)}/{len(results)} passed')
sys.exit(1 if bad else 0)
