#!/usr/bin/env python3
# /drive/（ドライブのガソリン代）を本物のブラウザで動かして確かめる。数字は手で計算した値と比べる。
#   ~/test/instagram/.venv/bin/python tests/drive_e2e.py [URL]   （既定は手元の devserve http://localhost:8951/drive/）
#   本番を見るときは https://car.kkpwebninja.com/drive/?ads=0 など
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8951/drive/'
fails = []

def check(name, got, want):
    ok = got == want
    print(('ok   ' if ok else 'FAIL ') + name + ('' if ok else f'  got={got!r} want={want!r}'))
    if not ok: fails.append(name)

def yen(n): return f'約{round(n):,}円'

with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    pg = b.new_page(viewport={'width': 375, 'height': 812})
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    # 広告と GA4 は読まない（本番でも表示回数を水増ししない）
    pg.route('**/*', lambda r: r.abort() if any(h in r.request.url for h in ('googlesyndication', 'googletagmanager', 'doubleclick')) else r.continue_())
    pg.goto(URL); pg.wait_for_function("document.getElementById('car').options.length > 1")
    def fill(i, v): pg.fill('#' + i, str(v))
    def head(): return pg.inner_text('#vHead')
    price = float(pg.input_value('#price'))

    check('最初は距離を求める', head(), '走る距離を入れてください')
    fill('km', 100)
    check('往復100km・15km/L', head(), yen(200 / 15 * price))
    pg.click('#trip [data-v="1"]')
    check('片道', head(), yen(100 / 15 * price))
    pg.click('#trip [data-v="2"]')

    pg.click('#extra summary'); fill('toll', 3000); fill('people', 4)
    check('高速代を足す', head(), yen(200 / 15 * price + 3000))
    pg.check('#noDriver')
    check('運転する人を除いて3人で割る', '1人約' + f'{-(-(200 / 15 * price + 3000) // 3):,.0f}円' in pg.inner_text('#vWhy'), True)
    pg.uncheck('#noDriver'); fill('toll', 0); fill('people', 1)

    pg.select_option('#car', 'prius')
    check('車を選ぶと燃費が入る', pg.input_value('#kmpl'), '32.6')
    check('プリウス', head(), yen(200 / 32.6 * price))

    fill('times', 20)
    check('回数（月20日）', head(), yen(200 * 20 / 32.6 * price))
    fill('times', 1)

    # 電気自動車：単位と値段（31円/kWh）が切り替わり、ガソリンに戻すと値段も戻る
    pg.select_option('#car', '')
    pg.click('#fuel [data-v="electric"]'); fill('kmpl', 6.5)
    check('電気の値段', pg.input_value('#price'), '31')
    check('電費の見出し', pg.inner_text('#kmplL'), '電費')
    check('電気代', head(), yen(200 / 6.5 * 31))
    check('kWh で出る', 'kWh' in pg.inner_text('#tBody'), True)
    pg.click('#fuel [data-v="gasoline_regular"]')
    check('ガソリンに戻すと値段も戻る', float(pg.input_value('#price')), price)
    fill('kmpl', 15)

    # 2台比べ：比べる車のほうが安いときだけ売却の案内
    pg.check('#cmp'); pg.select_option('#car2', 'aqua')
    check('差が出る', 'アクアのほうが' in pg.inner_text('#diff'), True)
    check('売却の案内が出る', pg.is_visible('#sell'), True)
    fill('kmpl2', 10)
    check('比べる車が高いと売却の案内は出ない', pg.is_visible('#sell'), False)

    check('横にはみ出さない', pg.evaluate('document.documentElement.scrollWidth <= innerWidth'), True)
    check('JS のエラーなし', errors, [])
    b.close()

print('\n' + ('すべて合格' if not fails else f'{len(fails)}件 不合格'))
sys.exit(1 if fails else 0)
