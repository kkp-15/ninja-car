#!/usr/bin/env python3
# /drive/・/shaken/ の出典リンクと data/drive_cars.json の出典が切れていないか確かめる（月1回・価格更新のときに）。
#   python3 tests/check_links.py
# enecho.meti.go.jp はプログラムからの取得を 403 で断るので、ブラウザで開けるかを手で見る。
import json, re, subprocess, sys
SKIP = ('fonts.googleapis.com', 'fonts.gstatic.com', 'kkpwebninja.com', 'x.com', 'enecho.meti.go.jp')
urls = set()
for f in ('drive/index.html', 'shaken/index.html'):
    urls |= set(re.findall(r'href="(https?://[^"]+)"', open(f, encoding='utf-8').read()))
urls |= {c['source'] for c in json.load(open('data/drive_cars.json', encoding='utf-8'))['cars']}
bad = []
for u in sorted(urls):
    if any(s in u for s in SKIP): continue
    code = subprocess.run(['curl', '-sL', '-o', '/dev/null', '-m', '20', '-A', 'Mozilla/5.0', '-w', '%{http_code}', u], capture_output=True, text=True).stdout
    if code != '200': bad.append((code, u))
for c, u in bad: print('FAIL', c, u)
print(f'{len(urls)}件中 {len(bad)}件 切れ' if bad else f'{len(urls)}件 すべて開ける')
sys.exit(1 if bad else 0)
