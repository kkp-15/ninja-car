/* kkp-kit 共通の動き（D4）。<script src="kit/kit.js" defer></script> で読む。
   - 季節: <html data-k-season="..."> を月で付ける（10〜11月=紅葉 / 12月=雪 / 1月=松竹梅 / 3〜4月=桜）。?season=momiji で確認できる
   - 墨のはね: .k-btn と .k-ink-on を押すと墨の粒が6つはねる
   - 霞の奥行き: .k-par を付けた飾りがスクロールでほんの少し遅れて動く
   - 動き: .k-play-on を付けた要素が画面に入ったら .k-play を付ける（巻物・判子のアニメ）
   動きを減らす設定（prefers-reduced-motion）では、季節以外は何もしない。 */
(function () {
  var root = document.documentElement;
  var m = /[?&]season=([a-z]+)/.exec(location.search);
  var month = new Date().getMonth() + 1;
  var season = m ? m[1] : ({ 10: 'momiji', 11: 'momiji', 12: 'yuki', 1: 'shochikubai', 3: 'sakura', 4: 'sakura' }[month] || '');
  if (season) root.setAttribute('data-k-season', season);

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('.k-btn,.k-ink-on');
    if (!b) return;
    for (var k = 0; k < 6; k++) {
      var d = document.createElement('span');
      d.className = 'k-ink';
      var a = Math.PI * 2 * k / 6 + Math.random() * .6, r = 18 + Math.random() * 16;
      d.style.left = e.pageX + 'px';
      d.style.top = e.pageY + 'px';
      d.style.setProperty('--dx', Math.cos(a) * r + 'px');
      d.style.setProperty('--dy', Math.sin(a) * r + 'px');
      document.body.appendChild(d);
      setTimeout(function (x) { return function () { x.remove(); }; }(d), 600);
    }
  }, { passive: true });

  function start() {
    var pars = document.querySelectorAll('.k-par'), ticking = false;
    if (pars.length) {
      var par = function () {
        ticking = false;
        var k = window.innerWidth < 600 ? .03 : .06;
        pars.forEach(function (el) {
          var box = el.parentNode.getBoundingClientRect();
          el.style.transform = 'translateY(' + (-box.top * k).toFixed(1) + 'px)';
        });
      };
      window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(par); } }, { passive: true });
      par();
    }
    var plays = document.querySelectorAll('.k-play-on');
    if (plays.length && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('k-play'); io.unobserve(e.target); } });
      }, { threshold: .1 });
      plays.forEach(function (el) { io.observe(el); });
    } else {
      plays.forEach(function (el) { el.classList.add('k-play'); });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
