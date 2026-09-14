// 記事の検証。記事の数字＝データとツール計算、書き出し済みファイル＝生成結果、を全件確かめる
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { ROOT, buildAll, loadCalc, toolDefaults, toolCase } from '../scripts/build_articles.mjs';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const indexHtml = fs.readFileSync(ROOT + 'index.html', 'utf8');
const rates = JSON.parse(fs.readFileSync(ROOT + 'data/public_rates.json', 'utf8'));
const carsDoc = JSON.parse(fs.readFileSync(ROOT + 'data/cars.json', 'utf8'));
const C = loadCalc(indexHtml);
const defaults = toolDefaults(indexHtml);
const yen = v => Math.round(v).toLocaleString('ja-JP') + '円';

t('ツールの初期値（頭金0・年2.55%・60回・月500km・駐車場0）', () => {
  assert.deepEqual(defaults, { downMan: 0, ratePct: 2.55, months: 60, kmPerMonth: 500, parkingMonth: 0 });
  assert.equal(defaults.ratePct, rates.loan_rate_default.annual_pct);
});

// 損害保険料率算出機構の料率表（PDFを画像で目視した値）。データを書き換えたらここで止まる
const GIROJ = {
  jibaiseki_private_passenger: { '24m': [17650, 18560], '25m': [18160, 19070], '37m': [24190, 25180] },
  jibaiseki_kei_inspected: { '24m': [17540, 18660], '25m': [18040, 19170], '37m': [24010, 25330] }
};
t('自賠責の料率がGIROJの表と一致（改定前・2026-11-01以降）', () => {
  for (const [k, terms] of Object.entries(GIROJ)) for (const [term, [b, a]] of Object.entries(terms)) {
    assert.equal(rates[k][term].find(r => r.from === null).yen, b, k + term + ' 改定前');
    assert.equal(rates[k][term].find(r => r.from === '2026-11-01').yen, a, k + term + ' 改定後');
  }
  assert.ok(rates.jibaiseki_private_passenger._source.tables.every(x => /^https:\/\/www\.giroj\.or\.jp\//.test(x.url)));
});
t('GIROJの案内の「5.2％（910円）」と表の差が一致', () => {
  const R = rates.jibaiseki_revision_2026, P = rates.jibaiseki_private_passenger['24m'];
  const diff = P[1].yen - P[0].yen;
  assert.equal(diff, R['自家用乗用24か月_引上げ額_yen']);
  assert.equal(Math.round(diff / P[0].yen * 1000) / 10, R['自家用乗用24か月_改定率_pct']);
});

const articles = buildAll();
for (const a of articles) {
  const file = ROOT + a.path;
  t(a.slug + ': 書き出し済みファイルが生成結果と一致（データ更新後の生成忘れを止める）', () => {
    assert.ok(fs.existsSync(file), '記事ファイルが無い: node scripts/build_articles.mjs を実行');
    assert.equal(fs.readFileSync(file, 'utf8'), a.html);
  });
  const html = a.html;
  t(a.slug + ': 料率表の数字が記事に出ている', () => {
    for (const r of a.facts.rateRows) {
      assert.ok(html.includes(`<td>${r.months}か月</td><td>${yen(r.before)}</td><td>${yen(r.after)}</td><td>+${yen(r.diff)}</td><td>${r.pct.toFixed(1)}%</td>`), r.label + r.months);
    }
  });
  t(a.slug + ': 記事の計算例＝同じ条件のツール計算（改定前・改定後）', () => {
    for (const c of a.facts.cases) {
      const car = carsDoc.cars.find(x => x.id === c.id);
      const before = toolCase(C, car, rates, defaults, '2026-10-31').r;
      const after = toolCase(C, car, rates, defaults, '2026-11-01').r;
      assert.equal(c.jibaiBefore, 24190); assert.equal(c.jibaiAfter, 25180);
      assert.equal(c.perMonthBefore, Math.round(before.perMonth));
      assert.equal(c.perMonthAfter, Math.round(after.perMonth));
      // 自賠責以外は同じなので、3年合計の差は自賠責の差だけ
      assert.ok(Math.abs((after.total3y - before.total3y) - 990) < 1e-6);
      assert.ok(html.includes(`${yen(before.jibai)}<small>月々 ${yen(before.perMonth)}</small>`), c.id + ' 改定前');
      assert.ok(html.includes(`${yen(after.jibai)}<small>月々 ${yen(after.perMonth)}</small>`), c.id + ' 改定後');
    }
    assert.equal(a.facts.perMonthDiff, 27.5);
    assert.ok(html.includes('月あたり27.5円'));
  });
  t(a.slug + ': 記事のボタンの比較が計算例と同じ2台', () => {
    const ids = a.facts.cases.map(c => c.id);
    assert.ok(html.includes(`href="/?a=${ids[0]}&b=${ids[1]}"`));
    assert.ok(html.includes("gtag('event', 'article_cta'"));
  });
  t(a.slug + ': 構造化データ・著者・更新日・出典', () => {
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    const types = ld['@graph'].map(g => g['@type']);
    assert.deepEqual(types, ['Article', 'BreadcrumbList', 'FAQPage']);
    assert.equal(ld['@graph'][0].author.name, 'web忍者の砦');
    assert.ok(ld['@graph'][0].dateModified);
    assert.ok(html.includes('更新 '));
    assert.ok(html.includes('giroj.or.jp/ratemaking/cali/pdf/202301_table.pdf') && html.includes('giroj.or.jp/ratemaking/cali/pdf/202604_table.pdf'));
    assert.ok(html.includes(`<link rel="canonical" href="https://car.kkpwebninja.com/articles/${a.slug}">`));
  });
  t(a.slug + ': 書かないこと（断定・残クレの月額・年収の目安・個人名）が無い', () => {
    const body = html.replace(/<script[\s\S]*?<\/script>/g, '');
    for (const w of ['お得', '損する', '損です', '残クレ', '残価設定', '年収', '手取りの', '\u3053\u30fc\u304d\u3063\u307a']) assert.ok(!body.includes(w), w);
    assert.ok(!/<details[^>]*\bopen\b/.test(html));
  });
  t(a.slug + ': 11月1日の前後どちらでも正しい（両方の値を本文に書き、今日の表示は日付で切り替え）', () => {
    assert.ok(html.includes('2026年10月31日まで') && html.includes('2026年11月1日から'));
    assert.ok(html.includes("today >= '2026-11-01'"));
  });
  t(a.slug + ': sitemapとトップからリンクされている', () => {
    assert.ok(fs.readFileSync(ROOT + 'sitemap.xml', 'utf8').includes(`https://car.kkpwebninja.com/articles/${a.slug}<`));
    assert.ok(indexHtml.includes(`href="/articles/${a.slug}"`));
  });
}
console.log(`\n${n} tests passed`);
