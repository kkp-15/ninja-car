// data/*.json の検証。出典のない値・壊れた値があれば失敗させる（公開前に必ず通す）
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = new URL('..', import.meta.url).pathname;
const html = fs.readFileSync(root + 'index.html', 'utf8');
const block = html.slice(html.indexOf('// CALC_START'), html.indexOf('// CALC_END'));
const C = new Function(block + '; return {weightTaxNew3y, carTaxAnnual, fuelPrice};')();
const rates = JSON.parse(fs.readFileSync(root + 'data/public_rates.json', 'utf8'));
const doc = JSON.parse(fs.readFileSync(root + 'data/cars.json', 'utf8'));
const resale = JSON.parse(fs.readFileSync(root + 'data/resale_gulliver_2026-09-02.json', 'utf8'));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s);

t('公的料率に出典URLと確認日がある', () => {
  for (const k of ['car_tax_annual', 'weight_tax', 'jibaiseki_private_passenger', 'gasoline_regular', 'gasoline_premium', 'diesel', 'loan_rate_default']) {
    assert.ok(rates[k] && rates[k]._source && /^https:\/\//.test(rates[k]._source.url), k + ' の出典URL');
    assert.ok(isDate(rates[k]._source['確認日']), k + ' の確認日');
  }
});
t('台数は25台・idが重複しない', () => {
  assert.equal(doc.cars.length, 25);
  assert.equal(new Set(doc.cars.map(c => c.id)).size, 25);
});
const REQ = ['id','name','name_gulliver','maker','model','grade','powertrain','fuel','price_yen','displacement_cc','wltc_km_l','weight_kg','weight_tax','resale3y_min','resale3y_max','sources'];
for (const c of doc.cars) {
  t(c.id + ': 必須項目・出典・値の範囲', () => {
    for (const k of REQ) assert.ok(c[k] !== undefined && c[k] !== null && c[k] !== '', c.id + ' ' + k);
    assert.ok(c.sources.length >= 2, c.id + ' 出典が2つ以上（価格と諸元）');
    for (const s of c.sources) { assert.ok(/^https:\/\//.test(s.url), c.id + ' 出典URL'); assert.ok(isDate(s.checked), c.id + ' 確認日'); assert.ok(s.label); }
    assert.ok(Number.isInteger(c.price_yen) && c.price_yen > 1000000 && c.price_yen < 50000000, c.id + ' 価格');
    assert.ok(Number.isInteger(c.displacement_cc) && c.displacement_cc > 900 && c.displacement_cc < 6000, c.id + ' 排気量');
    assert.ok(c.wltc_km_l > 5 && c.wltc_km_l < 40, c.id + ' 燃費');
    assert.ok(Number.isInteger(c.weight_kg) && c.weight_kg > 900 && c.weight_kg < 3000, c.id + ' 重量');
    assert.ok(['レギュラー','ハイオク','軽油'].includes(c.fuel), c.id + ' 燃料');
    C.fuelPrice(c.fuel, rates); C.carTaxAnnual(c.displacement_cc, rates.car_tax_annual.brackets_cc);
    assert.ok(['当分の間','本則'].includes(c.weight_tax.rate), c.id + ' 重量税の区分');
    assert.ok(c.weight_tax.basis, c.id + ' 重量税の根拠');
    if (c.weight_tax.rate === '当分の間') assert.equal(c.weight_tax.reduction, 0);
    else assert.ok([0, 0.25, 0.5, 0.75, 1].includes(c.weight_tax.reduction), c.id + ' 減税率は財務省の区分のどれか');
    // ガリバーの元データと一致
    const g = resale.cars.find(x => x.name === c.name_gulliver);
    assert.ok(g, c.id + ' ガリバーに同名がある');
    assert.equal(c.resale3y_min, g.resale3y_min); assert.equal(c.resale3y_max, g.resale3y_max);
    assert.ok(c.resale3y_min <= c.resale3y_max);
  });
}
t('メーカー公式の重量税額がある車は計算と一致', () => {
  const withOfficial = doc.cars.filter(c => c.weight_tax.official_yen !== undefined);
  assert.ok(withOfficial.length >= 9);
  for (const c of withOfficial) assert.equal(C.weightTaxNew3y(c.weight_kg, c.weight_tax, rates.weight_tax.passenger_private_per_0_5t_per_year), c.weight_tax.official_yen, c.id);
});
t('メルセデス公式の自動車税65,500円（G 63）と総務省区分が一致', () => {
  const g = doc.cars.find(c => c.id === 'g-class');
  assert.equal(C.carTaxAnnual(g.displacement_cc, rates.car_tax_annual.brackets_cc), 65500);
});
t('除外した車がデータに入っていない', () => {
  const names = doc.cars.map(c => c.name_gulliver);
  for (const x of ['ＧＴ－Ｒ', 'スイフトスポーツ', 'マカン', 'ハイラックス', 'ディフェンダー']) assert.ok(!names.includes(x), x);
});
t('JSON-LDの著者は「web忍者の砦」、個人名が入っていない', () => {
  assert.ok(html.includes('"author":{"@type":"Organization","name":"web忍者の砦"}'));
  assert.ok(!html.includes('\u3053\u30fc\u304d\u3063\u307a')); // 個人名（文字コードで書く）
});
t('Geminiの未検証の数字が残っていない', () => {
  for (const s of ['オイル交換3', '3〜5万円', '車両保険を断', 'フェラーリ']) assert.ok(!html.includes(s), s);
});
t('details は初期状態で閉じている', () => assert.ok(!/<details[^>]*\bopen\b/.test(html)));
t('更新日がJSON-LD・画面・sitemapでそろっている', () => {
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const app = ld['@graph'].find(g => g['@type'] === 'WebApplication');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(app.dateModified), 'dateModified');
  assert.ok(app.datePublished <= app.dateModified);
  const shown = html.match(/<time id="pageUpdated" datetime="([\d-]+)">([\d-]+)<\/time>/);
  assert.ok(shown, '画面の更新日');
  assert.equal(shown[1], app.dateModified); assert.equal(shown[2], app.dateModified);
  const sm = fs.readFileSync(root + 'sitemap.xml', 'utf8');
  assert.ok(sm.includes('<loc>https://car.kkpwebninja.com/</loc><lastmod>' + app.dateModified + '</lastmod>'), 'sitemap の lastmod');
});
t('title と h1 が検索語「車の維持費シミュレーション」で始まる', () => {
  assert.ok(/<title>車の維持費シミュレーション/.test(html));
  assert.ok(/<h1>車の維持費シミュレーション</.test(html));
});
t('結果の要約が入力欄より上にあり、共通5欄は畳んだ details の中', () => {
  const iSum = html.indexOf('id="sum"'), iCar = html.indexOf('id="car-a"'), iRes = html.indexOf('id="result"');
  assert.ok(iSum > 0 && iSum < iCar && iCar < iRes);
  const box = html.slice(html.indexOf('<details class="common"'), html.indexOf('</details>', html.indexOf('<details class="common"')));
  for (const id of ['down', 'rate', 'months', 'km', 'parking']) assert.ok(box.includes('id="' + id + '"'), id);
});
t('シェアボタンを戻していない（2026-09-15 に撤去）', () => {
  for (const x of ['fortress-share', 'twitter.com/intent', 'x.com/intent', 'social-plugins.line.me']) assert.ok(!html.includes(x), x);
});
console.log(`\n${n} tests passed`);
