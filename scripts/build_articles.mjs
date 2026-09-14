// 記事の数字は手で書かない。data/*.json とツール（index.html）と同じ計算関数から生成する。
// 使い方: node scripts/build_articles.mjs   → articles/*.html を書き出す
// テスト（tests/articles.test.mjs）が、書き出し済みのファイルと生成結果の一致、数字とツール計算の一致を確かめる。
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = new URL('..', import.meta.url).pathname;
const read = p => fs.readFileSync(ROOT + p, 'utf8');

export function loadCalc(html) {
  const block = html.slice(html.indexOf('// CALC_START'), html.indexOf('// CALC_END'));
  return new Function(block + '; return {loanMonthly, loanBalanceAfter, carTaxAnnual, weightTaxNew3y, jibaiseki37, fuelPrice, compare3y};')();
}

// ツールの初期値を index.html から読む（記事の条件をツールと同じにするため）
export function toolDefaults(html) {
  const pick = (re, name) => { const m = html.match(re); if (!m) throw new Error('初期値が見つからない: ' + name); return parseFloat(m[1]); };
  return {
    downMan: pick(/id="down"[^>]*value="([\d.]+)"/, 'down'),
    ratePct: pick(/id="rate"[^>]*value="([\d.]+)"/, 'rate'),
    months: pick(/<option value="(\d+)" selected>/, 'months'),
    kmPerMonth: pick(/id="km"[^>]*value="([\d.]+)"/, 'km'),
    parkingMonth: pick(/id="parking"[^>]*value="([\d.]+)"/, 'parking')
  };
}

// ツールと同じ既定の条件で1台を計算する（残価率の初期値＝中央を0.1%単位に丸めた値）
export function toolCase(C, car, rates, defaults, dateStr) {
  const opt = {
    price: car.price_yen,
    down: defaults.downMan * 10000,
    ratePct: defaults.ratePct,
    months: defaults.months,
    kmPerMonth: defaults.kmPerMonth,
    parkingMonth: defaults.parkingMonth,
    insuranceMonth: null,
    resalePct: Math.round((car.resale3y_min + car.resale3y_max) / 2 * 10) / 10
  };
  return { opt, r: C.compare3y(car, opt, rates, dateStr) };
}

const yen = n => Math.round(n).toLocaleString('ja-JP') + '円';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const at = (rows, from) => rows.find(r => r.from === from).yen;
const pct1 = (a, b) => Math.round((b - a) / a * 1000) / 10;
const ymdJa = s => { const [y, m, d] = s.split('-').map(Number); return `${y}年${m}月${d}日`; };

export function buildJibaiseki({ rates, carsDoc, C, defaults }) {
  const SLUG = 'jibaiseki-neage-2026';
  const URL = 'https://car.kkpwebninja.com/articles/' + SLUG;
  const PUBLISHED = '2026-09-14';
  const UPDATED = '2026-09-14';
  const REV = rates.jibaiseki_revision_2026;
  const NEW = REV['適用開始'];
  const BEFORE_DATE = '2026-10-31';
  const P = rates.jibaiseki_private_passenger, K = rates.jibaiseki_kei_inspected;
  const src = P._source;

  const rateRows = [];
  for (const [label, table] of [['自家用乗用車', P], ['軽自動車（検査対象車）', K]]) {
    for (const term of ['24m', '25m', '37m']) {
      const before = at(table[term], null), after = at(table[term], NEW);
      rateRows.push({ label, months: parseInt(term, 10), before, after, diff: after - before, pct: pct1(before, after) });
    }
  }
  const p24 = rateRows.find(r => r.label === '自家用乗用車' && r.months === 24);
  const p37 = rateRows.find(r => r.label === '自家用乗用車' && r.months === 37);
  const k24 = rateRows.find(r => r.label.startsWith('軽') && r.months === 24);

  const pair = ['yaris', 'harrier'].map(id => carsDoc.cars.find(c => c.id === id));
  const cases = pair.map(car => {
    const b = toolCase(C, car, rates, defaults, BEFORE_DATE);
    const a = toolCase(C, car, rates, defaults, NEW);
    return { car, before: b.r, after: a.r, opt: a.opt };
  });
  const perMonthDiff = Math.round(p37.diff / 36 * 10) / 10;
  const toolUrl = '/?a=' + pair[0].id + '&b=' + pair[1].id;

  // テストで「記事の数字＝ツール計算」を突き合わせるための一覧
  const facts = {
    rateRows, perMonthDiff,
    cases: cases.map(x => ({ id: x.car.id, jibaiBefore: x.before.jibai, jibaiAfter: x.after.jibai, perMonthBefore: Math.round(x.before.perMonth), perMonthAfter: Math.round(x.after.perMonth), total3yBefore: Math.round(x.before.total3y), total3yAfter: Math.round(x.after.total3y) }))
  };

  const title = '自賠責は2026年11月から値上げ｜いつから・いくら上がる？乗用車と軽の保険料';
  const desc = `自賠責保険の基準料率が${ymdJa(NEW)}以降に始まる契約から上がります。自家用乗用車は24か月${yen(p24.before)}→${yen(p24.after)}、新車で払う37か月は${yen(p37.before)}→${yen(p37.after)}。軽自動車も含め、損害保険料率算出機構の料率表で改定前と改定後を並べました。`;
  const faq = [
    ['自賠責の値上げはいつの契約からですか',
     `${ymdJa(NEW)}以降に保険期間が始まる契約から新しい料率になります。${ymdJa(BEFORE_DATE)}以前に保険期間が始まる契約は改定前の料率です（損害保険料率算出機構の基準料率表の適用条件）。`],
    ['軽自動車の自賠責はいくら上がりますか',
     `軽自動車（検査対象車）の24か月契約は${yen(k24.before)}から${yen(k24.after)}へ、${yen(k24.diff)}上がります。離島以外の地域（沖縄県を除く）の基準料率です。`],
    ['自賠責はなぜ値上げになるのですか',
     `損害保険料率算出機構によると、過去の契約から生じた滞留資金を充てて安く設定していた料率について、その資金が保険金の支払いで減ってきたことと、物価・賃金の上昇で経費が増えたことが理由です。基準料率は平均${REV['平均改定率_pct']}%の引き上げで、内訳は純保険料率が${REV['純保険料率_改定率_pct']}%、社費と代理店手数料が${REV['社費と代理店手数料_改定率_pct']}%の引き上げです。`]
  ];

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Article', '@id': URL + '#article', headline: title, description: desc, datePublished: PUBLISHED, dateModified: UPDATED, inLanguage: 'ja',
        mainEntityOfPage: URL, image: 'https://car.kkpwebninja.com/ogp.png?d=20260914',
        author: { '@type': 'Organization', name: 'web忍者の砦' }, publisher: { '@type': 'Organization', name: 'web忍者の砦', url: 'https://kkpwebninja.com/' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: '本命vs夢枠 車コスト比較', item: 'https://car.kkpwebninja.com/' },
        { '@type': 'ListItem', position: 2, name: '自賠責の値上げ（2026年11月）' } ] },
      { '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }
    ]
  };

  const rateTable = rateRows.map(r =>
    `<tr><th>${esc(r.label)}</th><td>${r.months}か月</td><td>${yen(r.before)}</td><td>${yen(r.after)}</td><td>+${yen(r.diff)}</td><td>${r.pct.toFixed(1)}%</td></tr>`).join('\n');
  const caseRows = cases.map(x =>
    `<tr><th>${esc(x.car.name)}<small>${esc(x.car.grade)}</small></th><td>${yen(x.before.jibai)}<small>月々 ${yen(x.before.perMonth)}</small></td><td>${yen(x.after.jibai)}<small>月々 ${yen(x.after.perMonth)}</small></td></tr>`).join('\n');
  const cond = `頭金${defaults.downMan}円・ローン${defaults.months}回・年${defaults.ratePct}%・月${defaults.kmPerMonth}km・駐車場代${defaults.parkingMonth}円・任意保険なし・3年後に売れる割合はガリバーの実績の幅の中央（${cases.map(x => esc(x.car.name) + ' ' + x.opt.resalePct.toFixed(1) + '%').join('、')}）`;
  const tlink = (u, t) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`;

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- このファイルは scripts/build_articles.mjs が生成する。直接編集しない -->
<title>${esc(title)}｜本命vs夢枠 車コスト比較</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${URL}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#ff8a3d">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${URL}">
<meta property="og:site_name" content="本命vs夢枠 車コスト比較">
<meta property="og:locale" content="ja_JP">
<meta property="og:image" content="https://car.kkpwebninja.com/ogp.png?d=20260914">
<meta name="twitter:card" content="summary_large_image">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-2LM85GJN0L"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-2LM85GJN0L');
</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1298304917726270" crossorigin="anonymous"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;700;800&display=swap" rel="stylesheet">
<script type="application/ld+json">
${JSON.stringify(ld, null, 1)}
</script>
<style>
:root{--orange:#ff8a3d;--pink:#ff6b9d;--cream:#fff9ec;--paper:#fffdf8;--ink:#3b2c22;--ink-soft:#7a6656;--line:#f0e0c4;--line-soft:#f6ecda}
*{box-sizing:border-box}
body{margin:0;background:var(--cream);color:var(--ink);font-family:"M PLUS Rounded 1c","Hiragino Maru Gothic ProN","Hiragino Sans","Meiryo",sans-serif;line-height:1.8}
.wrap{max-width:760px;margin:0 auto;padding:18px 16px 0}
.breadcrumb{font-size:12px;color:var(--ink-soft);margin:0 0 10px}
.breadcrumb a{color:var(--ink-soft)}
h1{font-size:1.4rem;line-height:1.45;margin:.2rem 0 .3rem;font-weight:800}
.dates{font-size:.78rem;color:var(--ink-soft);margin:0 0 1rem}
h2{font-size:1.12rem;margin:2rem 0 .7rem;font-weight:800;padding-left:.6rem;border-left:5px solid var(--orange)}
p{margin:.5rem 0}
a{color:#1565c0}
.answer{background:#fff;border:2px solid #ffc79e;border-radius:18px;padding:.9rem 1rem}
.answer ul{margin:.3rem 0;padding-left:1.2rem}
.answer li{margin:.3rem 0}
.today{background:#fff4cf;border-radius:10px;padding:.4rem .7rem;font-size:.88rem;margin:.6rem 0 0}
.cta{display:inline-block;margin:.8rem 0 .2rem;background:var(--orange);color:#fff;font-weight:800;text-decoration:none;border-radius:999px;padding:.6rem 1.3rem;min-height:44px}
.scroll{overflow-x:auto}
table{width:100%;border-collapse:collapse;background:#fff;font-size:.88rem}
th,td{border-bottom:1px solid var(--line-soft);padding:.45rem .5rem;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
th{text-align:left;font-weight:700}
thead th{background:#fff3df;font-size:.8rem;text-align:right}
thead th:first-child{text-align:left}
td small,th small{display:block;font-size:.72rem;color:var(--ink-soft);font-weight:400;white-space:normal}
.note{font-size:.78rem;color:var(--ink-soft)}
.box{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:.7rem 1rem;font-size:.9rem}
.box ul{margin:.2rem 0;padding-left:1.2rem}
.faq details{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:.4rem .9rem;margin:.5rem 0}
.faq summary{cursor:pointer;font-weight:700}
.kkp-ad{text-align:center;margin:1.4rem auto 0;max-width:680px;min-height:288px;padding-top:6px}
.kkp-ad-label{font-size:11px;color:#999;letter-spacing:.08em;margin:0 0 6px;line-height:1}
.kkp-ad ins.adsbygoogle{display:block;width:300px;height:250px;margin:0 auto}
@media(min-width:768px){.kkp-ad{min-height:318px}.kkp-ad ins.adsbygoogle{width:336px;height:280px}}
</style>
</head>
<body>
<div class="wrap">
<nav class="breadcrumb"><a href="/">本命vs夢枠 車コスト比較</a> &gt; 読み物 &gt; 自賠責の値上げ</nav>
<h1>自賠責は2026年11月から値上げ<br>いつから・いくら上がる？乗用車と軽の保険料</h1>
<p class="dates">公開 ${ymdJa(PUBLISHED)}／更新 ${ymdJa(UPDATED)}／数字の確認日 ${ymdJa(src['確認日'])}</p>

<div class="answer">
  <p style="margin-top:0"><b>${ymdJa(NEW)}以降に保険期間が始まる契約から</b>、自賠責保険の基準料率が上がります（損害保険料率算出機構の届出）。</p>
  <ul>
    <li>自家用乗用車 24か月：${yen(p24.before)} → <b>${yen(p24.after)}</b>（+${yen(p24.diff)}）</li>
    <li>自家用乗用車 37か月（新車の購入時）：${yen(p37.before)} → <b>${yen(p37.after)}</b>（+${yen(p37.diff)}）</li>
    <li>軽自動車 24か月：${yen(k24.before)} → <b>${yen(k24.after)}</b>（+${yen(k24.diff)}）</li>
  </ul>
  <p class="today" id="today" hidden></p>
</div>

<h2>改定前と改定後の保険料</h2>
<div class="scroll">
<table>
<thead><tr><th>車種</th><th>保険期間</th><th>${ymdJa(BEFORE_DATE)}まで</th><th>${ymdJa(NEW)}から</th><th>差</th><th>上がる割合</th></tr></thead>
<tbody>
${rateTable}
</tbody>
</table>
</div>
<p class="note">離島以外の地域（沖縄県を除く）の基準料率です。軽自動車は検査対象車の料率。「上がる割合」は表の金額から計算した値で、自家用乗用車24か月の${p24.pct.toFixed(1)}%は、損害保険料率算出機構の案内にある「${REV['自家用乗用24か月_改定率_pct']}％（${REV['自家用乗用24か月_引上げ額_yen']}円）の引上げ」と一致します。</p>

<h2>いつから変わる？</h2>
<p>新しい料率は、<b>${ymdJa(NEW)}以降に保険期間が始まる契約</b>に適用されます。${ymdJa(BEFORE_DATE)}以前に保険期間が始まる契約は、改定前の料率です。</p>
<p>損害保険料率算出機構が${ymdJa(REV['届出日'])}に金融庁長官へ届け出て、${ymdJa(REV['適合性審査終了'])}に適合性審査が終わっています。</p>

<h2>なぜ上がる？</h2>
<p>損害保険料率算出機構の案内では、基準料率は<b>平均${REV['平均改定率_pct']}%の引き上げ</b>です。</p>
<ul>
  <li><b>純保険料率（${REV['純保険料率_改定率_pct']}%の引き上げ）</b>：いまの料率は、過去の契約から生じた滞留資金を充てて安く設定されていました。その資金が保険金の支払いで減ったため、収支を合わせるために引き上げます。</li>
  <li><b>社費と代理店手数料（${REV['社費と代理店手数料_改定率_pct']}%の引き上げ）</b>：物価・賃金の上昇で、契約の管理や保険金の支払いにかかる経費が増えたためです。</li>
</ul>

<h2>新車で買うと、3年間の負担はどれだけ変わる？</h2>
<p>新車は購入時に37か月分の自賠責を払います。<a href="/">本命vs夢枠 車コスト比較</a>と同じ計算で、購入日が${ymdJa(BEFORE_DATE)}の場合と${ymdJa(NEW)}の場合を並べました。</p>
<div class="scroll">
<table>
<thead><tr><th>車種</th><th>${ymdJa(BEFORE_DATE)}に購入</th><th>${ymdJa(NEW)}に購入</th></tr></thead>
<tbody>
${caseRows}
</tbody>
</table>
</div>
<p class="note">上段は購入時に払う自賠責（37か月）、下段は3年乗って売ったときの月々の実質負担。条件：${cond}。</p>
<p>自賠責の差は${yen(p37.diff)}なので、3年（36か月）でならすと<b>月あたり${perMonthDiff}円</b>です。月々の実質負担に占める割合は小さく、差が大きく出るのはローンや3年後に売れる額のほうです。</p>
<a class="cta" href="${toolUrl}" data-cta="${SLUG}" data-a="${pair[0].id}" data-b="${pair[1].id}">この2台をツールで比べる</a>
<p class="note">ツールは開いた日の自賠責で計算します。${ymdJa(BEFORE_DATE)}までは左の列、${ymdJa(NEW)}からは右の列と同じ数字が出ます。頭金や回数を変えると、数字も変わります。</p>

<div class="kkp-ad">
  <div class="kkp-ad-label">広告</div>
  <ins class="adsbygoogle" style="display:block"
       data-ad-client="ca-pub-1298304917726270"
       data-ad-slot="2937937957"
       data-ad-format="rectangle"
       data-full-width-responsive="false"></ins>
</div>

<h2>この記事で扱っていないこと</h2>
<div class="box"><ul>
  <li>離島地域・沖縄県の料率（別の表があります）</li>
  <li>自動車重量税や自動車税など、自賠責以外の費用の変更</li>
  <li>車検の費用や、保険会社ごとの手続きの違い</li>
</ul></div>

<h2>よくある質問</h2>
<div class="faq">
${faq.map(([q, a]) => `  <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}
</div>

<h2>出典</h2>
<div class="box"><ul>
  <li>${tlink(src.tables[0].url, '損害保険料率算出機構 自賠責保険基準料率表（' + src.tables[0]['届出'] + '届出）')}：${esc(src.tables[0]['適用'])}の料率</li>
  <li>${tlink(src.tables[1].url, '損害保険料率算出機構 自賠責保険基準料率表（' + src.tables[1]['届出'] + '届出）')}：${esc(src.tables[1]['適用'])}の料率</li>
  <li>${tlink(REV._source.page, REV._source['資料'])}</li>
</ul>
<p class="note">いずれも${ymdJa(src['確認日'])}に確認。数字の誤りに気づいたら、下の「お問い合わせ」から教えてください。</p></div>

<p style="text-align:center"><a class="cta" href="${toolUrl}" data-cta="${SLUG}" data-a="${pair[0].id}" data-b="${pair[1].id}">車2台の月々の実質負担を比べる</a></p>

<!-- WEBNINJA_UNIFIED_FOOTER -->
<footer style="text-align:center;padding:2rem 1rem 2.5rem;font-size:0.78rem;color:#94a3b8;line-height:2;border-top:1px solid #f0e6d2;margin-top:1.6rem;background:#fffcf7;">
  <div style="font-weight:800;color:#8b6b3d;font-size:0.85rem;margin-bottom:0.4rem;">web忍者の砦</div>
  <div>
    <a href="https://kkpwebninja.com/" target="_blank" rel="noopener" style="color:#8b6b3d;text-decoration:none;margin:0 0.5rem;">本丸トップ</a>·
    <a href="https://privacypolicy.kkpwebninja.com/" target="_blank" rel="noopener" style="color:#8b6b3d;text-decoration:none;margin:0 0.5rem;">プライバシーポリシー</a>·
    <a href="https://kkpwebninja.com/otoiawase" target="_blank" rel="noopener" style="color:#8b6b3d;text-decoration:none;margin:0 0.5rem;">お問い合わせ</a>·
    <a href="https://x.com/kkp_webninja" target="_blank" rel="noopener" style="color:#8b6b3d;text-decoration:none;margin:0 0.5rem;">@kkp_webninja</a>
  </div>
  <div style="margin-top:0.5rem;color:#bfa97a;">© 2025-2026 web忍者の砦</div>
</footer>
</div>
<script>
(function(){
  // 今日始まる契約がどちらの料率かを表示する（記事は静的なので、改定前後の両方の値を本文に書いてある）
  var today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  var el = document.getElementById('today');
  el.hidden = false;
  el.textContent = today >= '${NEW}'
    ? '今日（' + today + '）時点では改定後です。いま保険期間が始まる契約は新しい料率です。'
    : '今日（' + today + '）時点では改定前です。${ymdJa(NEW)}以降に保険期間が始まる契約から新しい料率になります。';
  document.querySelectorAll('[data-cta]').forEach(function(a){
    a.addEventListener('click', function(){
      if (typeof gtag === 'function') gtag('event', 'article_cta', { slug: a.dataset.cta, a: a.dataset.a, b: a.dataset.b });
    });
  });
  var slots = document.querySelectorAll('ins.adsbygoogle');
  for (var i = 0; i < slots.length; i++) { try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {} }
})();
</script>
</body>
</html>
`;
  return { slug: SLUG, path: 'articles/' + SLUG + '.html', html, facts };
}

export function buildAll() {
  const indexHtml = read('index.html');
  const ctx = { rates: JSON.parse(read('data/public_rates.json')), carsDoc: JSON.parse(read('data/cars.json')), C: loadCalc(indexHtml), defaults: toolDefaults(indexHtml) };
  return [buildJibaiseki(ctx)];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(ROOT + 'articles', { recursive: true });
  for (const a of buildAll()) {
    fs.writeFileSync(ROOT + a.path, a.html);
    console.log('wrote', a.path);
  }
}
