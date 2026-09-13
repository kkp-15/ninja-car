import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = new URL('..', import.meta.url).pathname;
const src = fs.readFileSync(root + 'index.html', 'utf8');
const block = src.slice(src.indexOf('// CALC_START'), src.indexOf('// CALC_END'));
const C = new Function(block + '; return {loanMonthly, loanBalanceAfter, carTaxAnnual, weightTaxNew3y, jibaiseki37, fuelPrice, compare3y};')();
const rates = JSON.parse(fs.readFileSync(root + 'data/public_rates.json', 'utf8'));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} != ${b}`);
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

// 元利均等（参照値は Decimal 40桁の別実装）
t('月々ローン 300万・2.55%・60回', () => near(C.loanMonthly(3000000, 2.55, 60), 53308.25042751075, 1e-6, 'M60'));
t('月々ローン 300万・2.55%・84回', () => near(C.loanMonthly(3000000, 2.55, 84), 39034.39607117961, 1e-6, 'M84'));
// 3年時点残債（参照値は月ごとの償還表を36回まわした別実装）
t('36回後の残債 60回', () => near(C.loanBalanceAfter(3000000, 2.55, 60, 36), 1246031.0011795328, 1e-4, 'B60'));
t('36回後の残債 84回', () => near(C.loanBalanceAfter(3000000, 2.55, 84, 36), 1779467.2709165223, 1e-4, 'B84'));
// 端のケース
t('金利0%は元金÷回数', () => assert.equal(C.loanMonthly(1200000, 0, 24), 50000));
t('金利0%・60回の36回後残債', () => assert.equal(C.loanBalanceAfter(1200000, 0, 60, 36), 480000));
t('回数≦36なら残債0', () => { assert.equal(C.loanBalanceAfter(3000000, 2.55, 36, 36), 0); assert.equal(C.loanBalanceAfter(3000000, 2.55, 24, 36), 0); });
t('36回ちょうどは36回で完済（残債がほぼ0）', () => { const m = C.loanMonthly(3000000, 2.55, 36); let b = 3000000; for (let i = 0; i < 36; i++) b = b * (1 + 2.55/1200) - m; near(b, 0, 1e-4, 'b'); });
t('頭金=価格なら借入0', () => { assert.equal(C.loanMonthly(0, 2.55, 60), 0); assert.equal(C.loanBalanceAfter(0, 2.55, 60, 36), 0); });

// 自動車税の境界（総務省の区分）
const B = rates.car_tax_annual.brackets_cc;
t('自動車税の境界', () => {
  for (const [cc, yen] of [[996,25000],[1000,25000],[1001,30500],[1500,30500],[1501,36000],[2000,36000],[2001,43500],[2487,43500],[2500,43500],[2501,50000],[3444,57000],[3500,57000],[3501,65500],[3982,65500],[4000,65500],[4001,75500],[4500,75500],[4501,87000],[6000,87000],[6001,110000]])
    assert.equal(C.carTaxAnnual(cc, B), yen, `cc=${cc}`);
});
// 重量税（0.5t単位の切り上げ・当分の間・本則からの減税と100円未満切捨）
const W = rates.weight_tax.passenger_private_per_0_5t_per_year;
t('重量税 0.5t切り上げ', () => {
  assert.equal(C.weightTaxNew3y(1000, {rate:'当分の間',reduction:0}, W), 2*4100*3);
  assert.equal(C.weightTaxNew3y(1001, {rate:'当分の間',reduction:0}, W), 3*4100*3);
  assert.equal(C.weightTaxNew3y(1500, {rate:'当分の間',reduction:0}, W), 36900); // 財務省資料の1.5t・3年・当分の間
  assert.equal(C.weightTaxNew3y(1500, {rate:'本則',reduction:0}, W), 22500);     // 同 本則
});
t('重量税 メーカー公式の減税後税額と一致', () => {
  // [重量, 減税率, 公式の税額, 出典]
  for (const [kg, red, yen] of [[1650,0.75,7500],[2160,0.75,9300],[1470,0.75,5600],[1710,0.25,22500],[1940,0.75,7500],[1370,1,0]])
    assert.equal(C.weightTaxNew3y(kg, {rate:'本則',reduction:red}, W), yen, `kg=${kg} red=${red}`);
});
t('100円未満切捨（2,010kg・50%減は18,750→18,700。レクサス公式の「約18,800円」は表記上の丸め）', () => assert.equal(C.weightTaxNew3y(2010, {rate:'本則',reduction:0.5}, W), 18700));
t('財務省資料の計算例 1.4t・50%減=11,200円', () => assert.equal(C.weightTaxNew3y(1400, {rate:'本則',reduction:0.5}, W), 11200));
// 自賠責の日付切り替え
const J = rates.jibaiseki_private_passenger['37m'];
t('自賠責37か月の切り替え', () => {
  assert.equal(C.jibaiseki37('2026-10-31', J), 24190);
  assert.equal(C.jibaiseki37('2026-11-01', J), 25180);
  assert.equal(C.jibaiseki37('2027-04-01', J), 25180);
});
// 総合例（参照値は Decimal の別実装）
const harrier = {weight_kg:1650, weight_tax:{rate:'本則',reduction:0.75}, displacement_cc:2487, wltc_km_l:22.7, fuel:'レギュラー'};
const opt = {price:4396700, down:396700, ratePct:2.55, months:60, kmPerMonth:1000, parkingMonth:10000, insuranceMonth:null, resalePct:78.75};
t('総合例 ハリアー', () => {
  const r = C.compare3y(harrier, opt, rates, '2026-09-14');
  near(r.monthly, 71077.66723668101, 1e-6, 'monthly');
  near(r.balance, 1661374.668239377, 1e-4, 'balance');
  assert.equal(r.weightTax, 7500); assert.equal(r.jibai, 24190); assert.equal(r.carTax, 43500);
  near(r.fuelMonth*36, 269603.5242290749, 1e-6, 'fuel');
  near(r.resale, 3462401.25, 1e-6, 'resale');
  near(r.total3y, 1946262.962988968, 1e-3, 'total');
  near(r.perMonth, 54062.86008302689, 1e-4, 'perMonth');
  assert.equal(r.insuranceIncluded, false);
});
t('任意保険を入れると月額分だけ増える', () => {
  const a = C.compare3y(harrier, opt, rates, '2026-09-14');
  const b = C.compare3y(harrier, {...opt, insuranceMonth: 8000}, rates, '2026-09-14');
  near(b.perMonth - a.perMonth, 8000, 1e-6, 'ins'); assert.equal(b.insuranceIncluded, true);
});
t('頭金が価格を超えても借入は0', () => { const r = C.compare3y(harrier, {...opt, down: 9999999}, rates, '2026-09-14'); assert.equal(r.principal, 0); assert.equal(r.monthly, 0); assert.equal(r.down, 4396700); });
t('燃料の種類', () => { assert.equal(C.fuelPrice('ハイオク', rates), 180.9); assert.equal(C.fuelPrice('軽油', rates), 159.5); assert.throws(() => C.fuelPrice('電気', rates)); });
console.log(`\n${n} tests passed`);
