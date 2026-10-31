#!/usr/bin/env python3
# /shaken/（車検を通す？売る？判定）を本物のブラウザで動かして確かめる。数字は国の資料の値から手で計算して比べる。
#   ~/test/instagram/.venv/bin/python tests/shaken_e2e.py [URL]   （既定は手元の devserve http://localhost:8951/shaken/）
import sys, datetime, re
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8951/shaken/'
fails = []

def check(name, got, want):
    ok = got == want
    print(('ok   ' if ok else 'FAIL ') + name + ('' if ok else f'  got={got!r} want={want!r}'))
    if not ok: fails.append(name)

def yen(n): return f'{round(n):,}円'

today = datetime.date.today()
Y = today.year
# 自賠責24か月（損害保険料率算出機構）：2026-11-01 から新料率
JIBA_F = 18560 if today >= datetime.date(2026, 11, 1) else 17650
JIBA_K = 18660 if today >= datetime.date(2026, 11, 1) else 17540

with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    pg = b.new_page(viewport={'width': 375, 'height': 812})
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.route('**/*', lambda r: r.abort() if any(h in r.request.url for h in ('googlesyndication', 'googletagmanager', 'doubleclick')) else r.continue_())
    pg.goto(URL)
    head = lambda: pg.inner_text('#vHead')
    def fill(i, v): pg.fill('#' + i, str(v))

    # 初期値＝普通車・9年目・1.5トン → 重量税24,600円（13年未満）
    legal = 24600 + JIBA_F + 1800
    check('最初は見積を求める', head(), '見積額を入れてください')
    fill('est', 15)
    check('売値なし', head(), '今の売値が分かると判定できます')
    check('法定費用', pg.inner_text('#tLegal').split('\n')[0], yen(legal))
    check('整備・部品代', pg.inner_text('#tShop'), yen(150000 - legal))

    fill('sale', 40)
    check('見積15万・売値40万＝通して乗る', head(), '通して乗るのが自然')
    check('通す判定では売却の案内を出さない', pg.is_visible('#sell'), False)
    fill('sale', 25)
    check('見積15万・売値25万＝迷いどころ', head(), '迷いどころ')
    check('迷いどころで売却の案内', pg.is_visible('#sell'), True)
    fill('sale', 12)
    check('見積15万・売値12万＝売る', head(), '売るのを考えてよい')
    fill('sale', 15)
    check('同額は売る側', head(), '売るのを考えてよい')
    fill('opt', 4)
    check('急がない整備を外した判定', '見積は11万円です。判定は「迷いどころ」です。' in pg.inner_text('#flags'), True)
    fill('opt', '')
    pg.click('#yrs [data-v="1"]')
    tax1 = int(re.search(r'<small>([\d,]+)円', pg.inner_html('#tTax')).group(1).replace(',', ''))
    check('1年で手放す（見積15万＋税1年）', f'約{int((150000 + tax1) / 1000 + 0.5) / 10:g}万円' in pg.inner_text('#flags'), True)
    pg.click('#yrs [data-v="1"]')
    check('もう一度押すと外れる', '1年で手放すなら' in pg.inner_text('#flags'), False)
    pg.click('#later summary'); fill('sale2', 20)
    check('通してから売る比較（売値15万→通して20万・見積15万）', '今売るほうが10万円多く残ります。' in pg.inner_text('#flags'), True)
    fill('sale2', '')

    # 13年目：重量税 34,200円・自動車税は1.15倍（2013年登録＝引下げ前 1,500cc 34,500→39,600円）
    pg.click('#more summary')
    pg.select_option('#year', str(Y - 13))
    check('13年経過の重量税', pg.inner_text('#tLegal').split('\n')[0], yen(34200 + JIBA_F + 1800))
    check('13年超の自動車税（2年分）', pg.inner_text('#tTax').split('\n')[0], yen(39600 * 2))
    pg.check('#eco')
    check('エコカーは本則', pg.inner_text('#tLegal').split('\n')[0], yen(15000 + JIBA_F + 1800))
    pg.uncheck('#eco')

    # 軽自動車：重量税 13年未満6,600円
    pg.select_option('#year', str(Y - 9))
    pg.click('#kind [data-v="kei"]')
    check('軽の法定費用', pg.inner_text('#tLegal').split('\n')[0], yen(6600 + JIBA_K + 1800))
    check('軽では重さ・排気量を隠す', pg.is_visible('#weight'), False)

    # 例ボタン
    pg.click('#kind [data-v="futsu"]')
    pg.click('.ex button >> nth=1')
    check('例（見積18万・売値15万）', head(), '売るのを考えてよい')

    fill('est', 3)
    check('法定費用より安い見積は注意を出す', pg.is_visible('#err'), True)

    # 3月：名義変更の期限の注意（自動車税は4月1日の持ち主に1年分）
    pg2 = b.new_page(viewport={'width': 375, 'height': 812})
    pg2.clock.set_fixed_time(datetime.datetime(Y + 1, 3, 10, 12))
    pg2.route('**/*', lambda r: r.abort() if any(h in r.request.url for h in ('googlesyndication', 'googletagmanager', 'doubleclick')) else r.continue_())
    pg2.goto(URL); pg2.fill('#est', '15'); pg2.fill('#sale', '12')
    check('3月は名義変更の期限を出す', '3月31日まで' in pg2.inner_text('#flags'), True)
    pg2.close()
    if today.month > 3: check('4〜12月は出さない', '3月31日まで' in pg.inner_text('#flags'), False)
    check('横にはみ出さない', pg.evaluate('document.documentElement.scrollWidth <= innerWidth'), True)
    check('JS のエラーなし', errors, [])
    b.close()

print('\n' + ('すべて合格' if not fails else f'{len(fails)}件 不合格'))
sys.exit(1 if fails else 0)
