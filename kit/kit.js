/* kkp-kit 共通の動き（D4）。<script src="kit/kit.js" defer></script> で読む。
   - 季節: <html data-k-season="..."> を月で付ける（10〜11月=紅葉 / 12月=雪 / 1月=松竹梅 / 3〜4月=桜）。?season=momiji で確認できる
   - 押したとき: 静かに沈むだけ（CSS）。墨の粒がはねる動きは 2026-10-20 にやめた（清潔感）
   - 霞の奥行き: .k-par を付けた飾りがスクロールでほんの少し遅れて動く
   - 動き: .k-play-on を付けた要素が画面に入ったら .k-play を付ける（巻物・判子のアニメ）
   - 部品の手伝い（2026-10-20〜）: KKit.toast / KKit.countdown / KKit.reveal / KKit.share / KKit.install。
     .k-install[data-k-key] と [data-k-share] は書いておくだけで自動でつながる
   - 演出の部品: KKit.fx.slash（札を刀で斬る）・KKit.fx.shuriken（手裏剣が飛んできて刺さる）。下の fxParts を見る
   - 配信の土台（2026-10-21〜）: KKit.stream / KKit.live / KKit.openView / KKit.view / KKit.resume / KKit.twice / KKit.fitText / KKit.streamTitle。下の streamParts を見る。
     読み込み時に使うページは kit.js を defer なしで <head> に置く（本体の script より先に KKit が要るため）
   - 遊びの部品（2026-10-22〜）: KKit.die（サイコロ）・KKit.wheel（ルーレット盤）・KKit.gateArt（ゲートの絵・canvas 用）。下の gameParts を見る
   動きを減らす設定（prefers-reduced-motion）では、季節と部品の手伝い以外は何もしない（演出の部品は動かさずに、すぐ結果の合図だけ出す）。 */
(function () {
  var root = document.documentElement;
  var m = /[?&]season=([a-z]+)/.exec(location.search);
  var month = new Date().getMonth() + 1;
  var season = m ? m[1] : ({ 10: 'momiji', 11: 'momiji', 12: 'yuki', 1: 'shochikubai', 3: 'sakura', 4: 'sakura' }[month] || '');
  if (season) root.setAttribute('data-k-season', season);

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  fxParts();
  helpers();
  streamParts();
  gameParts();
  if (reduce) return;

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

  /* ===== 部品の手伝い（2026-10-20〜） =====
     KKit.toast(文, ms)            画面の下に短い知らせ（既定 2200ms）。1つの札を使い回す
     KKit.countdown(n, { onDone, sound, step })  3・2・1 を真ん中に出す（step は1つの長さ ms・既定 800）。sound(数) で呼び出し側が鳴らす
     KKit.reveal(要素)             .k-reveal / .k-reveal-fuda / .k-reveal-stamp を出し直す（hidden も外す）
     KKit.share({ url, title, text })  端末の共有画面。なければ URL をコピーして toast。URL に ?d=YYYYMMDD を付ける
     KKit.install(要素, { key, desktop })  ホーム画面に追加バナー。.k-install[data-k-key] は自動で呼ばれる */
  function helpers() {
    var K = window.KKit = window.KKit || {};
    var toastEl = null, toastT = 0;
    K.toast = function (msg, ms) {
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.className = 'k-toast';
        toastEl.setAttribute('role', 'status');
        toastEl.setAttribute('aria-live', 'polite');
        document.body.appendChild(toastEl);
      }
      toastEl.textContent = msg == null ? '' : String(msg);
      toastEl.offsetWidth; // 出し直しのため
      toastEl.classList.add('k-on');
      clearTimeout(toastT);
      toastT = setTimeout(function () { toastEl.classList.remove('k-on'); }, ms || 2200);
      return toastEl;
    };

    K.countdown = function (n, o) {
      o = o || {};
      var step = o.step || 800, box = document.createElement('div'), span = document.createElement('span');
      box.className = 'k-countdown'; box.setAttribute('aria-live', 'assertive');
      box.appendChild(span); document.body.appendChild(box);
      var left = n || 3, t = 0, stopped = false;
      function tick() {
        if (stopped) return;
        if (left <= 0) { box.remove(); if (typeof o.onDone === 'function') o.onDone(); return; }
        span.textContent = left;
        span.classList.remove('k-on'); span.offsetWidth; span.classList.add('k-on');
        if (typeof o.sound === 'function') try { o.sound(left); } catch (e) {}
        left--; t = setTimeout(tick, step);
      }
      tick();
      return { stop: function () { stopped = true; clearTimeout(t); box.remove(); } };
    };

    K.reveal = function (el) {
      if (typeof el === 'string') el = document.querySelector(el);
      if (!el) return;
      el.hidden = false;
      el.classList.remove('k-on'); el.offsetWidth; el.classList.add('k-on');
      return el;
    };

    function ymd() { var d = new Date(); return '' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); }
    K.share = function (o) {
      o = o || {};
      var u;
      try { u = new URL(o.url || location.href, location.href); u.hash = ''; u.searchParams.set('d', ymd()); u = u.toString(); } catch (e) { u = o.url || location.href; }
      var data = { url: u, title: o.title || document.title };
      if (o.text) data.text = o.text;
      function copy() {
        var done = function () { K.toast(o.copied || 'リンクをコピーしました'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { K.toast(u, 5000); });
        else K.toast(u, 5000);
      }
      if (navigator.share) navigator.share(data).catch(function (e) { if (!e || e.name !== 'AbortError') copy(); });
      else copy();
    };

    K.install = function (el, o) {
      if (typeof el === 'string') el = document.querySelector(el);
      if (!el || el._kInstall) return; el._kInstall = true;
      o = o || {};
      var key = o.key || el.getAttribute('data-k-key') || 'kkp_install_dismissed';
      var desktop = o.desktop || el.getAttribute('data-k-desktop') === '1';
      var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
      if (standalone) return;
      try { if (localStorage.getItem(key) === '1') return; } catch (e) { return; }
      var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
      if (!ios && !touch && !desktop) return; // PC では出さない（浮いて見えるため）
      var go = el.querySelector('.k-install-go'), x = el.querySelector('.k-install-x'), how = el.querySelector('.k-install-how'), hint = el.querySelector('.k-install-t span');
      var deferred = null;
      // 2026-10-25 はじめて開いた画面ではすぐ出さない（設定や盤面にかぶるため）。
      // 「1回遊び終えたあと」（ページが KKit.installReady() を呼ぶ／document に 'kkp:done' を送る）か、
      // 「2回目に開いたとき」に出す。開いた回数は key + '_visits' に数える（この端末の中だけ）
      var visits = 1;
      try { visits = (parseInt(localStorage.getItem(key + '_visits'), 10) || 0) + 1; localStorage.setItem(key + '_visits', String(visits)); } catch (e) {}
      var ready = visits >= 2 || !!o.now || el.getAttribute('data-k-now') === '1';
      var waiting = null;   // まだ出せないときに、出す処理をしまっておく
      function whenReady(fn) { if (ready) fn(); else waiting = fn; }
      function release() { if (ready) return; ready = true; if (waiting) { var f = waiting; waiting = null; f(); } }
      K._installRelease = (K._installRelease || []).concat(release);
      function place() {
        var fix = document.querySelector('.k-fix');
        var h = fix && fix.offsetParent !== null ? fix.getBoundingClientRect() : null;
        el.style.setProperty('--k-install-bottom', (h && h.bottom >= window.innerHeight - 2 ? Math.round(h.height) + 12 : 12) + 'px');
      }
      function show() { place(); el.hidden = false; }
      function dismiss() { el.hidden = true; try { localStorage.setItem(key, '1'); } catch (e) {} }
      if (x) x.addEventListener('click', dismiss);
      if (ios) {
        if (hint && !hint.getAttribute('data-k-keep')) hint.textContent = 'Safari の共有ボタンから追加できます';
        if (go) { go.textContent = 'やり方'; go.addEventListener('click', function () { if (how) { how.hidden = !how.hidden; go.textContent = how.hidden ? 'やり方' : 'とじる'; } }); }
        whenReady(function () { setTimeout(show, o.delay == null ? 3000 : o.delay); });
      } else {
        window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; whenReady(show); });
        if (go) go.addEventListener('click', function () {
          if (!deferred) return;
          deferred.prompt();
          deferred.userChoice.then(function (c) { if (c.outcome === 'accepted') dismiss(); deferred = null; });
        });
      }
      window.addEventListener('resize', function () { if (!el.hidden) place(); }, { passive: true });
    };

    // 1回遊び終えたら呼ぶ（結果の画面など）。まだ出していないホーム画面追加の帯を、少し待ってから出す
    K.installReady = function () { (K._installRelease || []).forEach(function (f) { setTimeout(f, 1200); }); };
    document.addEventListener('kkp:done', function () { K.installReady(); });

    function auto() {
      [].forEach.call(document.querySelectorAll('.k-install[data-k-key]'), function (el) { K.install(el); });
      document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-k-share]');
        if (!b) return;
        e.preventDefault();
        K.share({ url: b.getAttribute('data-k-url') || undefined, title: b.getAttribute('data-k-title') || undefined, text: b.getAttribute('data-k-text') || undefined });
      });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
  }

  /* ===== 配信の土台（2026-10-21〜） =====
     KKit.stream.init({ key })      配信モードかどうか（PC幅768以上・?mode=stream で入る・?mode=normal で出る）。<html data-k-stream> を付ける
     KKit.stream.set(on, params)    切り替え。URL の #… と mode= を消してから読み直す（#付きだと読み直さない不具合の再発防止）
     KKit.stream.on / can() / noAds()  いま配信中か／PC幅か（?kkptest=1 ならスマホでも可）／広告を読まないか
     KKit.live({ ch, role, onState, onHello })  BroadcastChannel＋localStorage の同期。op は send(state)・hold(true/false)・connected()
                                    role: 'view'＝受け取って hello を出す（表示ページ）／'watch'＝受け取るだけ（設定の中の見本 iframe など。iframe の中の 'view' も自動で watch）
                                    .k-live[data-k-live="ch"] の札を自動で「つながっています／つながっていません」に
     KKit.openView({ url, ch, name })  表示ページを別窓 1280x720 で開く（開けたら true）。操作画面は動かさない
     .k-view-open[data-k-view][data-k-ch]  開く・URLをコピー・背景3択・OBS の1行を作る。開いたら 'k-view-open' の event
     KKit.view({ ch, def })         /view/ 側: 背景（?bg= ＞ 操作画面の選択 ＞ def〈既定 cream〉）を <html data-k-bg> に。idle(true/false) で待ち画面
                                    ?layout=v で body.vert（縦型 9:16）。背景は cream/green/clear/white/black/色（#rrggbb）
     KKit.view.fit(箱, { min, step, drop, after, first, hide })  箱の --f を下げて1画面に。縮めきっても入らなければ drop の行を順に外す
                                    （first: true で先に外す・hide: true で消さずに隠す）。測る間は動きを止める＝毎回呼ぶと動きが出直す
     KKit.view.refit(fn)            字のデータが後から届いた・窓の大きさが変わったときに fn を呼び直す
     KKit.viewBg.get(ch, def) / set(ch, 値) / css(値)  表示ページの背景の選択（操作画面と表示ページで共通のキー k-view-bg:<ch>）
     KKit.resume({ key, box, label, onResume, onDiscard, live, ttl })  続きから（既定12時間・この端末だけ）。選ぶまで live を止める
                                    dismiss() ＝続きからを選ばずに新しく始めたとき（箱を隠す・前の記録を消す・live を戻す）
     KKit.twice(要素, { text, ms, when, ok, guard, settle })  回が消える操作の2回押し。when() が false なら1回で ok
                                    text は関数でもよい（場面ごとの文）。guard＝連打の2回目を数えない（既定400ms）・settle＝出た直後は効かない（既定500ms）
     KKit.twice.block(ms)           画面を切り替えた直後に呼ぶ: その間はどの twice も効かない（既定600ms）
     KKit.fitText(要素, { min, max, lines })   字を縮めて lines 行（既定1）に収める。min（px）より小さくしない（縦型の表示ページでは min を窓の幅の比に＝KKit.view.minPx）
     KKit.settle(要素, ms)          場面で入れ替わる普通のボタン: 出た直後 ms（既定400）の押しを捨てる
     KKit.streamTitle(要素, { key, onChange })  「〇〇の」タイトル欄（12字・空なら「みんな」・端末に覚える） */
  function streamParts() {
    var K = window.KKit = window.KKit || {};
    var ls = {
      get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
      set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
      del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
    };
    function $el(x) { return typeof x === 'string' ? document.querySelector(x) : x; }
    function ready(f) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', f); else f(); }
    function call(f, a, b) { if (typeof f === 'function') try { return f(a, b); } catch (e) { setTimeout(function () { throw e; }); } }

    /* --- 配信モード --- */
    var ST = K.stream = {
      key: 'k-stream', on: false,
      can: function () { return !!window.__kkpTest || !!(window.matchMedia && matchMedia('(min-width:768px)').matches); },
      noAds: function () { return ST.on || !!window.__kkpTest; },
      init: function (o) {
        o = o || {}; if (o.key) ST.key = o.key;
        var q = location.search;
        if (/[?&]mode=normal\b/.test(q)) ls.del(ST.key);
        else if (/[?&]mode=stream\b/.test(q) && ST.can()) ls.set(ST.key, '1');
        ST.on = ST.can() && ls.get(ST.key) === '1';
        if (ST.on) {
          root.setAttribute('data-k-stream', '');
          try { history.scrollRestoration = 'manual'; } catch (e) {}
          ready(function () { window.scrollTo(0, 0); });
        } else root.removeAttribute('data-k-stream');
        return ST.on;
      },
      set: function (on, params) {
        on = !!on && ST.can();
        if (on) ls.set(ST.key, '1'); else ls.del(ST.key);
        var u;
        try { u = new URL(location.href); } catch (e) { location.reload(); return; }
        u.hash = ''; u.searchParams.delete('mode');
        if (params) Object.keys(params).forEach(function (k) { if (params[k] == null) u.searchParams.delete(k); else u.searchParams.set(k, params[k]); });
        try { history.replaceState(null, '', u.pathname + u.search); } catch (e) {}
        location.reload();
      }
    };

    /* --- 同期（操作画面 ⇄ 表示ページ。同じブラウザの中だけ） --- */
    var lives = {};
    K.live = function (o) {
      o = o || {};
      var ch = o.ch || 'k-live', key = 'k-live:' + ch, hkey = 'k-live-hello:' + ch, TTL = o.ttl || 12 * 3600 * 1000;
      var bc = null; try { bc = new BroadcastChannel(ch); } catch (e) {}
      function post(m) { try { if (bc) bc.postMessage(m); } catch (e) {} }
      var api = { ch: ch };
      var inFrame = false; try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }
      if (o.role === 'watch' || (o.role === 'view' && inFrame && !o.hello)) o.role = 'watch';
      if (o.role === 'view' || o.role === 'watch') {
        var talk = o.role === 'view';   // watch は hello を出さない（設定の中の見本が「つながっています」にならないように）
        var lastT = 0;
        var take = function (d) { if (!d || d.s === undefined || (d.t && d.t < lastT)) return; lastT = d.t || Date.now(); call(o.onState, d.s, d); };
        if (bc) bc.addEventListener('message', function (e) { var m = e.data || {}; if (m.k === 's') take(m.d); });
        window.addEventListener('storage', function (e) { if (e.key === key && e.newValue) { try { take(JSON.parse(e.newValue)); } catch (x) {} } });
        var hello = function () { post({ k: 'hello', t: Date.now() }); ls.set(hkey, String(Date.now())); };
        api.start = function () {
          try { var d = JSON.parse(ls.get(key) || 'null'); if (d && d.t && Date.now() - d.t < TTL) take(d); else call(o.onState, null); } catch (e) { call(o.onState, null); }
          if (talk) { hello(); setInterval(hello, 3000); }
          return api;
        };
        return api;
      }
      // op（操作画面）
      var last = 0, held = false, cur = null, pend = null, firstSent = 0;
      // 札は中身が変わったときだけ書き直す（毎秒書き直すと、1画面に縮める MutationObserver が毎秒動いてしまう）
      function paint() {
        var on = Date.now() - last < 7000, txt = '表示ページ：' + (on ? 'つながっています' : 'つながっていません');
        [].forEach.call(document.querySelectorAll('.k-live[data-k-live="' + ch + '"]'), function (b) {
          if (b.classList.contains('k-on') !== on) b.classList.toggle('k-on', on);
          if (b.textContent !== txt) b.textContent = txt;
        });
      }
      function heard() { var first = Date.now() - last > 7000; last = Date.now(); paint(); if (first) { call(o.onHello); if (cur && !held) post({ k: 's', d: cur }); } }
      if (bc) bc.addEventListener('message', function (e) { var m = e.data || {}; if (m.k === 'hello') heard(); });
      window.addEventListener('storage', function (e) { if (e.key === hkey) heard(); });
      setInterval(paint, 1000); ready(paint);
      api.send = function (state) {
        if (held) { pend = { s: state }; return; }
        cur = { t: Date.now(), s: state }; pend = null;
        ls.set(key, JSON.stringify(cur)); post({ k: 's', d: cur });
      };
      api.hold = function (b) { held = !!b; if (!held && pend) api.send(pend.s); };
      api.held = function () { return held; };
      api.connected = function () { return Date.now() - last < 7000; };
      api.paint = paint;
      lives[ch] = api;
      return api;
    };

    /* --- 表示ページを開く --- */
    // 背景: cream（既定）・green（クロマキー）・clear（透過）・white・black・任意の色（#rrggbb）
    var BG = ['cream', 'green', 'clear', 'white', 'black'], BGC = { cream: '#fbf3e4', green: '#00b140', clear: 'transparent', white: '#ffffff', black: '#000000' };
    function bgNorm(b) { b = String(b == null ? '' : b).trim().toLowerCase(); if (b === 'transparent') b = 'clear'; if (BG.indexOf(b) >= 0) return b; var m = /^#?([0-9a-f]{6})$/.exec(b); return m ? '#' + m[1] : ''; }
    function bgOf(ch, def) { return bgNorm(ls.get('k-view-bg:' + ch)) || bgNorm(def) || 'cream'; }
    function bgParam(b) { return b.charAt(0) === '#' ? b.slice(1) : b; }
    function viewUrl(o) {
      var b = bgOf(o.ch || '', o.def), d = bgNorm(o.def) || 'cream';
      return (o.url || '/view/') + (b === d ? '' : ((o.url || '').indexOf('?') >= 0 ? '&' : '?') + 'bg=' + bgParam(b));
    }
    K.viewBg = {
      list: BG.slice(),
      get: function (ch, def) { return bgOf(ch || '', def); },
      set: function (ch, v) { v = bgNorm(v); if (v) ls.set('k-view-bg:' + (ch || ''), v); return v; },
      css: function (v) { v = bgNorm(v) || 'cream'; return BGC[v] || v; },
      norm: bgNorm
    };
    K.openView = function (o) {
      o = o || {};
      var vert = !!o.vert, wh = vert ? 'width=405,height=720' : 'width=1280,height=720';
      // 別窓は同じブラウザなので背景は localStorage で届く。?bg= を付けると窓の背景が固定されて切り替えに付いてこないので付けない
      // （?bg= は「URLをコピー」＝OBS のブラウザソース用だけ）。前の版で開いた窓（?bg= 付き）も、操作画面から開いた窓なら KKit.view が付いていく
      var w = null; try { w = window.open(o.url || '/view/', o.name || 'kView', 'popup=yes,' + wh); } catch (e) {}
      if (w && o.ch && lives[o.ch]) setTimeout(function () { lives[o.ch].paint(); }, 600);
      return !!w;
    };
    var HOW = {
      cream: 'OBS の「ウィンドウキャプチャ」でこの窓を取り込む',
      green: 'ウィンドウキャプチャで取り込み、フィルタの「クロマキー」で緑を消す',
      clear: '背景なし（ウィンドウキャプチャでは白く映ります）',
      white: '白い背景のまま取り込む',
      black: '黒い背景のまま取り込む（OBS のフィルタ「ルマキー」で黒を消せます）',
      color: 'クロマキーで消すときは、配信の画面にない色を選ぶ'
    };
    K.viewOpen = function (el, o) {
      el = $el(el); if (!el || el._kvo) return; el._kvo = true; o = o || {};
      var url = o.url || el.getAttribute('data-k-view') || '/view/', ch = o.ch || el.getAttribute('data-k-ch') || '', name = o.name || el.getAttribute('data-k-name') || 'kView';
      var def = bgNorm(o.def || el.getAttribute('data-k-def')) || 'cream';
      // data-k-bgs="cream green clear white black color" で出す背景を選べる（既定は全部）。並びは既定を先頭に
      var bgs = String(o.bgs || el.getAttribute('data-k-bgs') || 'cream green clear white black color').split(/[\s,]+/);
      var NAME = { cream: 'クリーム', green: '緑', clear: '透過', white: '白', black: '黒' };
      var seg = bgs.filter(function (b) { return NAME[b]; }).map(function (b) { return '<button type="button" data-bg="' + b + '">' + NAME[b] + '</button>'; }).join('')
        + (bgs.indexOf('color') >= 0 ? '<label class="k-vo-color" data-bg="color"><span>色</span><input type="color" value="#ff8a3d" aria-label="背景の色を選ぶ"></label>' : '');
      el.innerHTML = '<button type="button" class="k-btn k-btn-sub k-vo-go">表示ページを別ウィンドウで開く</button>'
        + '<button type="button" class="k-btn k-btn-sub k-vo-copy">URLをコピー</button>'
        + '<div class="k-seg k-vo-bg" role="group" aria-label="表示ページの背景">' + seg + '</div>'
        + '<p class="k-vo-how"></p><p class="k-vo-msg" role="status" hidden>ポップアップを許可して、もう一度押してください</p>';
      var how = el.querySelector('.k-vo-how'), msg = el.querySelector('.k-vo-msg'), col = el.querySelector('.k-vo-color input');
      function paint() {
        var b = bgOf(ch, def), isC = b.charAt(0) === '#';
        [].forEach.call(el.querySelectorAll('[data-bg]'), function (x) { var k = x.getAttribute('data-bg'); x.setAttribute('aria-pressed', String(isC ? k === 'color' : k === b)); });
        if (col && isC && col.value !== b) col.value = b;
        how.textContent = HOW[isC ? 'color' : b];
      }
      if (col) {
        col.addEventListener('input', function () { ls.set('k-view-bg:' + ch, bgNorm(col.value)); paint(); el.dispatchEvent(new CustomEvent('k-view-bg', { bubbles: true, detail: { bg: bgOf(ch, def) } })); });
        col.addEventListener('click', function () { ls.set('k-view-bg:' + ch, bgNorm(col.value)); paint(); });
      }
      window.addEventListener('storage', function (e) { if (e.key === 'k-view-bg:' + ch) paint(); });
      el.querySelector('.k-vo-go').addEventListener('click', function () {
        var ok = K.openView({ url: url, ch: ch, name: name, def: def, vert: o.vert });
        msg.hidden = ok;
        el.dispatchEvent(new CustomEvent('k-view-open', { bubbles: true, detail: { ok: ok } }));
      });
      el.querySelector('.k-vo-copy').addEventListener('click', function () {
        var u = new URL(viewUrl({ url: url, ch: ch, def: def }), location.href).href;
        var done = function () { if (K.toast) K.toast('表示ページのURLをコピーしました'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { if (K.toast) K.toast(u, 6000); });
        else if (K.toast) K.toast(u, 6000);
      });
      el.querySelector('.k-vo-bg').addEventListener('click', function (e) {
        var b = e.target.closest('button[data-bg]'); if (!b) return;
        ls.set('k-view-bg:' + ch, b.getAttribute('data-bg')); paint();
        el.dispatchEvent(new CustomEvent('k-view-bg', { bubbles: true, detail: { bg: bgOf(ch, def) } }));
      });
      paint();
      return { paint: paint, bg: function () { return bgOf(ch, def); } };
    };

    /* --- 表示ページ側の枠 --- */
    K.view = function (o) {
      o = o || {};
      var ch = o.ch || '', q = new URLSearchParams(location.search), fixed = bgNorm(q.get('bg'));
      // 操作画面から開いた窓（同じサイトの opener がある）は ?bg= で固定せず、操作画面の切り替えに付いていく。
      // ?bg= で固定するのは、opener のない窓（OBS のブラウザソース・URL を貼って開いた窓）だけ
      var fromOp = false; try { fromOp = !!(window.opener && window.opener !== window && window.opener.location.origin === location.origin); } catch (e) {}
      if (fromOp) fixed = '';
      var prevBg = null;
      function apply() {
        var b = fixed || bgOf(ch, o.def), isC = b.charAt(0) === '#';
        root.setAttribute('data-k-bg', isC ? 'color' : b);
        if (isC) root.style.setProperty('--k-view-bg', b); else root.style.removeProperty('--k-view-bg');
        call(o.onBg, b);
        // 背景が変わると面の余白（クリーム以外は外側に 1cqw）が変わるので、refit に登録した描き直しを呼ぶ
        if (prevBg !== null && prevBg !== b) refitAll();
        prevBg = b;
      }
      apply();
      if (!fixed) window.addEventListener('storage', function (e) { if (e.key === 'k-view-bg:' + ch) apply(); });
      // 縦型（9:16）: ?layout=v で <html data-k-layout="v"> と body.vert を、その場で付ける（DOMContentLoaded を待たない。
      // 本体の script が最初に描くときにはもう縦型＝描き直しが要らない）。head で呼ばれたときは body ができた瞬間に付ける
      var vert = o.vert != null ? !!o.vert : q.get('layout') === 'v';
      if (vert) {
        root.setAttribute('data-k-layout', 'v');
        var addV = function () { if (document.body) { document.body.classList.add('vert'); return true; } return false; };
        if (!addV()) {
          if (typeof MutationObserver === 'function') { var mo = new MutationObserver(function () { if (addV()) mo.disconnect(); }); mo.observe(root, { childList: true }); }
          ready(addV);
        }
      }
      var stage = null, idleT = null;
      window.addEventListener('resize', function () { clearTimeout(idleT); idleT = setTimeout(function () { var t = stage && !stage.querySelector('.k-view-idle').hidden && stage.querySelector('.k-view-idle b,.k-view-idle-t'); if (t) K.fitText(t, { min: 42 }); }, 150); });
      return {
        bg: function () { return fixed || bgOf(ch, o.def); },
        vert: function () { return vert; },
        fit: function (box, fo) { return fitBox(box, fo); },
        idle: function (on, title) {
          stage = stage || document.querySelector(o.stage || '.k-view-stage');
          if (!stage) return;
          stage.classList.toggle('k-idle', !!on);
          var box = stage.querySelector('.k-view-idle');
          if (box) {
            box.hidden = !on;
            // 題字は HTML に最初から同じ文字で入っていることが多く、「文字が変わったときだけ」縮めると一度も縮まらず「…」で切れた（2026-10-30 ito 1280x720）。
            // 待ち画面に入るたびに縮め直す。字のデータが後から届いて幅が変わるので、少し遅れてもう一度
            if (on) { var t = box.querySelector('b,.k-view-idle-t'); if (t) { if (title != null && t.textContent !== title) t.textContent = title; K.fitText(t, { min: 42 }); clearTimeout(idleT); idleT = setTimeout(function () { if (!box.hidden) K.fitText(t, { min: 42 }); }, 600); } }
          }
        }
      };
    };

    /* --- 表示ページを1画面に収める手伝い ---
       箱（wrap）の CSS 変数 --f（既定）を 1 から下げて、はみ出さなくなるまで縮める（字は calc(… * var(--f)) で書いておく）。
       縮めきっても（min まで）入らないときは drop の行を順に外して縮め直す。drop は CSS セレクタか関数（何か外したら true を返す）。
       測る間は .k-fitting を付けて動き（出てくるときの拡大など）を止める（動きの途中は小さく見えて縮めそこねる）。
       ※ .k-fitting を外すと動きは頭から出直す。描き直しのたびに呼ぶと判子などの動きが毎回出直すので、中身が変わったときだけ呼ぶ
       first: true … 縮める前に drop を外す（字の大きさを優先。外して入ればそこで終わり、まだ入らなければ縮める）
       hide: true  … drop は消さずに .k-fit-hid で隠すだけ（id で描き直す要素が壊れない）。次の fit の最初に戻してから測り直す */
    function fitBox(box, fo) {
      box = $el(box); if (!box) return 1; fo = fo || {};
      var prop = fo.prop || '--f', min = fo.min || 0.4, step = fo.step || 0.04, f = 1;
      var over = fo.over || function () { return box.scrollHeight > box.clientHeight + 1 || (fo.x && box.scrollWidth > box.clientWidth + 1); };
      function shrink() {
        f = 1; box.style.setProperty(prop, '1');
        for (var i = 0; i < 40 && over() && f > min + 1e-6; i++) { f = Math.max(min, f - step); box.style.setProperty(prop, f.toFixed(3)); }
      }
      function off(x) { if (fo.hide) x.classList.add('k-fit-hid'); else x.remove(); }
      function dropOne(d) {
        if (typeof d === 'function') return !!call(d, box, fo.hide);
        var els = box.querySelectorAll(fo.hide ? d + ':not(.k-fit-hid)' : d); [].forEach.call(els, off); return els.length > 0;
      }
      box.classList.add('k-fitting');
      try {
        if (fo.hide) [].forEach.call(box.querySelectorAll('.k-fit-hid'), function (x) { x.classList.remove('k-fit-hid'); });
        f = 1; box.style.setProperty(prop, '1');
        if (fo.first) {
          (fo.drop || []).forEach(function (d) { if (over()) dropOne(d); });
          shrink();
        } else {
          shrink();
          (fo.drop || []).forEach(function (d) { if (over() && dropOne(d)) shrink(); });
        }
        call(fo.after, f, box);
      } finally { box.classList.remove('k-fitting'); }
      box._kFit = f;
      return f;
    }
    K.view.fit = fitBox;
    // 字の下限（px）を表示ページの大きさに合わせる。縦型（data-k-layout="v"）は窓の幅の比＝1080 幅でそのまま・405 幅で 0.375 倍（最低 14px）。
    // 横（16:9）とふつうのページはそのまま。KKit.fitText の min もこれを通る（縦型の {min:42} は 405x720 で約16px）
    K.view.minPx = function (px) {
      px = +px || 14;
      if (root.getAttribute('data-k-layout') !== 'v' || !document.body || !document.body.classList.contains('k-view')) return px;
      var st = document.querySelector('.k-view-stage'), w = (st && st.clientWidth) || window.innerWidth || 1080;
      return Math.max(14, Math.min(px, px * w / 1080));
    };
    // 字のデータ（日本語は字ごとに分かれて届く）が後から届いたとき・窓の大きさが変わったときに fn を呼び直す
    var refits = [];
    function refitAll() { refits.forEach(function (later) { later(30); }); }
    K.view.refitAll = refitAll;
    K.view.refit = function (fn, ro) {
      ro = ro || {}; var t = 0;
      var later = function (ms) { clearTimeout(t); t = setTimeout(function () { call(fn); }, ms); };
      if (ro.bg !== false) refits.push(later);   // 背景が変わったときも呼び直す（KKit.view の背景の切り替え）
      if (document.fonts) {
        if (document.fonts.ready) document.fonts.ready.then(function () { later(0); });
        if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', function () { later(ro.fontMs || 80); });
      }
      if (ro.resize !== false) window.addEventListener('resize', function () { later(ro.resizeMs || 120); }, { passive: true });
      return { now: function () { later(0); } };
    };

    /* --- 続きから --- */
    K.resume = function (o) {
      o = o || {};
      var key = o.key || 'k-resume', TTL = o.ttl || 12 * 3600 * 1000, live = o.live || null, api = { pending: false };
      api.save = function (data) { ls.set(key, JSON.stringify({ at: Date.now(), data: data })); };
      api.clear = function () { ls.del(key); };
      api.dismiss = function () { return false; };   // 続きがないときは何もしない
      var run = null; try { run = JSON.parse(ls.get(key) || 'null'); } catch (e) {}
      if (!run || !run.data || !run.at || Date.now() - run.at > TTL || (o.valid && !o.valid(run.data))) { if (run) ls.del(key); return api; }
      var box = $el(o.box);
      if (!box) return api;
      var ago = Math.max(0, Math.round((Date.now() - run.at) / 60000));
      var agoT = ago < 1 ? 'たった今' : ago < 60 ? ago + '分前' : Math.floor(ago / 60) + '時間前';
      var lab = call(o.label, run.data);
      box.classList.add('k-resume');
      box.innerHTML = '<p></p><button type="button" class="k-btn k-btn-main k-btn-sm" data-k-go>続きから</button><button type="button" class="k-btn k-btn-sub k-btn-sm" data-k-del>消して新しく</button>';
      box.querySelector('p').textContent = '前回の続きがあります（' + (lab ? lab + '・' : '') + agoT + '）';
      box.hidden = false; api.pending = true;
      if (live) live.hold(true);
      function close() { box.hidden = true; api.pending = false; }
      // 続きからを選ばずに新しく始めたとき: 箱を隠す・前の記録を消す・表示ページへの送信を戻す（onDiscard は呼ばない）
      api.dismiss = function () { if (!api.pending) return false; close(); ls.del(key); if (live) live.hold(false); return true; };
      box.querySelector('[data-k-go]').addEventListener('click', function () { close(); call(o.onResume, run.data); if (live) live.hold(false); });
      box.querySelector('[data-k-del]').addEventListener('click', function () { close(); ls.del(key); call(o.onDiscard); if (live) live.hold(false); });
      return api;
    };

    /* --- 出た直後は効かない（場面で入れ替わる普通のボタン） ---
       KKit.settle(要素, ms)  隠れていた要素が出てから ms（既定 400）の間の押しを捨てる（前の場面の連打・ダブルクリックの2回目）。
       要素はボタンでも、ボタンを入れる箱でもよい（箱なら中のどのボタンも）。戻り値の block(ms) で今から ms 効かなくする */
    // 出た瞬間を知らせる。IntersectionObserver の知らせは次の描画まで遅れるので、押された時に「映っているのにまだ知らせが来ていない」なら
    // その場で出たことにする（st.check()）。押しが出た瞬間と同じ frame でも捨てられる
    function seen(el, onShow, onHide) {
      var st = { gone: true };
      st.check = function () { if (st.gone && el.getClientRects().length) { st.gone = false; call(onShow); } };
      if (typeof IntersectionObserver !== 'function') return st;
      new IntersectionObserver(function (es) {
        es.forEach(function (x) {
          var r = x.boundingClientRect, gone = !r.width && !r.height;   // 隠れていた（hidden・display:none）か。スクロールで外れただけなら数えない
          if (x.isIntersecting) { if (st.gone) call(onShow); st.gone = false; }
          else { if (gone) st.gone = true; call(onHide); }
        });
      }).observe(el);
      return st;
    }
    K.settle = function (el, ms) {
      el = $el(el); if (!el) return null;
      if (el._kSettle) { el._kSettle.ms = ms == null ? 400 : ms; return el._kSettle; }
      var api = el._kSettle = { ms: ms == null ? 400 : ms, until: 0 };
      api.block = function (b) { api.until = Date.now() + (b == null ? api.ms : b); };
      var st = seen(el, function () { api.block(); });
      el.addEventListener('click', function (e) {
        st.check();
        if (Date.now() < api.until) { e.preventDefault(); e.stopImmediatePropagation(); }
      }, true);
      return api;
    };

    /* --- 2回押し --- */
    var twBlock = 0;
    K.twice = function (el, o) {
      el = $el(el); if (!el) return; o = o || {};
      var armed = false, t = 0, saved = '', shown = 0, armedAt = 0, blockTo = 0, txt = '';
      var guard = o.guard == null ? 400 : o.guard, settle = o.settle == null ? 500 : o.settle;
      function disarm() {
        if (!armed) return; armed = false; clearTimeout(t);
        if (el.textContent === txt) el.innerHTML = saved;
        el.classList.remove('k-twice-on');
      }
      // 出た瞬間（場面が切り替わってボタンが現れた直後）を覚える。その直後の押しは前の場面の連打なので効かせない
      var st = seen(el, function () { shown = Date.now(); }, disarm);
      el.addEventListener('click', function (e) {
        if (el.disabled) return;
        st.check();
        var now = Date.now();
        if (now < twBlock || now < blockTo || (shown && now - shown < settle)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
        if (o.when && !o.when()) { disarm(); call(o.ok, e); return; }
        // 映っていないボタン（hidden・display:none の中）を JS から押した（el.click()）ときは 1回目として数えない
        if (!el.getClientRects().length) { e.preventDefault(); e.stopImmediatePropagation(); return; }
        if (!armed) {
          armed = true; armedAt = now; saved = el.innerHTML;
          txt = String((typeof o.text === 'function' ? call(o.text, el) : o.text) || 'もう一度押すと決定');
          el.textContent = txt; el.classList.add('k-twice-on');
          t = setTimeout(disarm, o.ms || 3000); return;
        }
        if (now - armedAt < guard) return;   // 連打（ダブルクリック）の2回目は数えない
        disarm(); call(o.ok, e);
      }, true);
      return { disarm: disarm, armed: function () { return armed; }, block: function (ms) { disarm(); blockTo = Date.now() + (ms == null ? 600 : ms); } };
    };
    // 画面を切り替えた直後に呼ぶ: その間はどの twice も効かない
    K.twice.block = function (ms) { twBlock = Date.now() + (ms == null ? 600 : ms); };

    /* --- 字を縮めて収める --- */
    K.fitText = function (el, o) {
      el = $el(el); if (!el) return 0; o = o || {};
      var lines = o.lines || 1;
      el.style.fontSize = '';
      if (lines === 1) { el.style.whiteSpace = 'nowrap'; el.style.overflow = 'hidden'; el.style.textOverflow = 'ellipsis'; }
      var max = o.max || parseFloat(getComputedStyle(el).fontSize) || 16, min = Math.min(K.view.minPx(o.min || 14), max);
      function fits() {
        if (el.scrollWidth > el.clientWidth) return false;
        if (lines > 1) {
          var cs = getComputedStyle(el), lh = parseFloat(cs.lineHeight);
          if (isNaN(lh)) lh = parseFloat(cs.fontSize) * 1.3;
          if (el.scrollHeight > lh * lines + parseFloat(cs.paddingTop || 0) + parseFloat(cs.paddingBottom || 0) + 2) return false;
        }
        return true;
      }
      el.style.fontSize = max + 'px';
      if (!el.clientWidth || fits()) { el.style.fontSize = ''; return max; }
      var lo = min, hi = max;
      for (var i = 0; i < 12 && hi - lo > 0.5; i++) { var mid = (lo + hi) / 2; el.style.fontSize = mid + 'px'; if (fits()) lo = mid; else hi = mid; }
      lo = Math.max(min, Math.floor(lo) - (lines === 1 ? 1 : 0));   // 端数で「…」が出ないよう少し小さめに
      el.style.fontSize = lo + 'px';
      return lo;
    };

    /* --- 「〇〇の」タイトル --- */
    K.streamTitle = function (el, o) {
      el = $el(el); if (!el) return null; o = o || {};
      var key = o.key || el.getAttribute('data-k-key') || 'k-stream-title', inp = el.querySelector('input'), sp = el.querySelector('span');
      var suffix = o.suffix != null ? o.suffix : (sp ? sp.textContent : '');
      var max = o.max || 12;
      if (inp) { inp.maxLength = max; if (!inp.placeholder) inp.placeholder = 'みんな'; inp.value = (ls.get(key) || '').slice(0, max); }
      var api = {
        value: function () { return String(ls.get(key) || '').trim().slice(0, max); },
        text: function () { return (api.value() || 'みんな') + suffix; },
        set: function (v) { v = String(v || '').slice(0, max); ls.set(key, v.trim()); if (inp && inp.value !== v) inp.value = v; }
      };
      if (inp) {
        inp.addEventListener('input', function (e) { if (e.isComposing) return; ls.set(key, inp.value.trim().slice(0, max)); call(o.onChange, api.text()); });
        inp.addEventListener('compositionend', function () { ls.set(key, inp.value.trim().slice(0, max)); call(o.onChange, api.text()); });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); inp.blur(); } });
      }
      return api;
    };

    ready(function () {
      [].forEach.call(document.querySelectorAll('.k-view-open[data-k-view]'), function (el) { K.viewOpen(el); });
    });
  }

  /* ===== 演出の部品 =====
     どのサイトでも1行で呼べる形。絵は kit.css が img/ から読む（JS は絵の場所を知らない）。
     長さ: speed に 'short'（0.6倍）・'normal'・'long'（1.5倍）か倍率の数。音は鳴らさず opts.sound(種類) で呼び出し側に知らせる。
     動きを減らす設定のときは、何も描かずに onCut / onHit / onDone をすぐ呼ぶ（結果だけ一瞬で出る）。

     KKit.fx.slash(host, opts)   host は position のある箱。札が出る → 刀が一閃 → 札が斜めに斬れて左右へ → 消える
       opts: speed / wait（斬るまでの溜め ms・既定 450）/ size（札の幅 px）/ color（印の色）/ ang（斬る角度・既定 25）
             onCut（斬れた瞬間。ここで結果を出す）/ onDone / sound('fuda'|'slash')
       戻り値: { tint(色, グラデ), cut()（溜めを飛ばしてすぐ斬る）, skip()（演出を消して onCut・onDone）, destroy() }
     KKit.fx.shuriken(host, opts) 手裏剣が画面の外から回りながら飛んできて (x, y) に刺さる。刺さったまま残る
       opts: x, y（host の中の px）/ size / speed / from（'right'|'left'|'top'・既定 'right'）/ onHit / sound('throw'|'hit')
       戻り値: { remove() }
     KKit.fx.clear(host)  host の中の演出を全部消す
     KKit.fx.ms(基準ms, speed)  長さの倍率をかけた ms（呼び出し側で時間を合わせるとき） */
  function fxParts() {
    var K = window.KKit = window.KKit || {};
    var SP = { short: 0.6, normal: 1, long: 1.5 };
    function k(sp) { return typeof sp === 'number' ? sp : (SP[sp] || 1); }
    function ms(base, sp) { return Math.round(base * k(sp)); }
    function mk(cls, parent) { var e = document.createElement('div'); e.className = cls; if (parent) parent.appendChild(e); return e; }
    function anim(el, frames, o) { try { return el.animate(frames, o); } catch (e) { return null; } }
    function call(f, a) { if (typeof f === 'function') try { f(a); } catch (e) { /* 呼び出し側の失敗で演出を止めない */ } }

    function clear(host) {
      if (!host) return;
      [].slice.call(host.querySelectorAll(':scope > .k-fx')).forEach(function (n) { if (n._kfx) n._kfx.destroy(); else n.remove(); });
    }

    function slash(host, o) {
      o = o || {};
      var done = false, cut = false, timers = [], root = null;
      var h = { tint: function () {}, cut: function () {}, skip: function () {}, destroy: function () {} };
      function finishCut() { if (cut) return; cut = true; call(o.onCut); }
      function finish() { if (done) return; done = true; finishCut(); call(o.onDone); }
      if (reduce || !host) { setTimeout(finish, 0); h.skip = finish; return h; }
      var W = host.clientWidth || 600, H = host.clientHeight || 400;
      var fw = o.size || Math.max(80, Math.min(W * 0.26, H * 0.62 / 1.5));
      var ang = o.ang == null ? 25 : o.ang;
      root = mk('k-fx', host);
      root.style.setProperty('--k-fx-w', fw + 'px');
      root.style.setProperty('--k-fx-ang', ang + 'deg');
      root.style.setProperty('--k-fx-len', Math.hypot(W, H) * 1.2 + 'px');
      root.style.setProperty('--k-fx-bw', fw * 2.1 + 'px');
      root.style.setProperty('--k-fx-ll', fw * 1.9 + 'px');
      root.style.setProperty('--k-fx-lh', Math.max(3, fw * 0.025) + 'px');
      if (o.color) root.style.setProperty('--k-fx-c', o.color);
      var fuda = mk('k-fx-fuda', root), halves = [];
      ['a', 'b'].forEach(function (c) { var hf = mk('k-fx-half ' + c, fuda), f = mk('k-fx-face', hf); mk('k-fx-seal', f); halves.push(hf); });
      var track = mk('k-fx-track', root), line = mk('k-fx-line', track), blade = mk('k-fx-blade', track);
      function at(t, fn) { timers.push(setTimeout(fn, t)); }
      // 1) 札が上から下りてくる
      anim(fuda, [{ transform: 'translate(-50%,-80%) rotate(-4deg)', opacity: 0 }, { transform: 'translate(-50%,-48%) rotate(1deg)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%,-50%)', opacity: 1 }], { duration: ms(380, o.speed), easing: 'cubic-bezier(.2,.8,.3,1.2)', fill: 'both' });
      call(o.sound, 'fuda');
      var waitT = ms(380, o.speed) + (o.wait == null ? ms(450, o.speed) : o.wait), cutT = null;
      function doCut() {
        if (cutT !== null || done) return;
        timers.forEach(clearTimeout); timers = [];
        var sw = ms(240, o.speed);
        cutT = sw;
        // 2) 刀が一閃（左上から右下へ）と光の筋
        anim(blade, [{ left: '0%', opacity: 1 }, { left: '100%', opacity: 1, offset: 0.85 }, { left: '112%', opacity: 0 }], { duration: sw, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'both' });
        anim(line, [{ transform: 'translateY(-50%) scaleX(0)', opacity: 1 }, { transform: 'translateY(-50%) scaleX(1)', opacity: 1, offset: 0.55 }, { transform: 'translateY(-50%) scaleX(1)', opacity: 0 }], { duration: sw + ms(260, o.speed), easing: 'ease-out', fill: 'both' });
        call(o.sound, 'slash');
        // 3) 札が斜めにずれて左右へ離れ、消える（ここで結果を出す）
        at(Math.round(sw * 0.6), function () {
          var r = ang * Math.PI / 180, dx = Math.cos(r) * fw * 0.18, dy = Math.sin(r) * fw * 0.18, nx = Math.sin(r) * fw * 0.32, ny = Math.cos(r) * fw * 0.32;
          var d = ms(520, o.speed);
          anim(halves[0], [{ transform: 'none', opacity: 1 }, { transform: 'translate(' + (-dx * 0.4) + 'px,' + (-dy * 0.4) + 'px)', opacity: 1, offset: 0.25 }, { transform: 'translate(' + (-dx + nx) + 'px,' + (-dy - ny) + 'px) rotate(-7deg)', opacity: 0 }], { duration: d, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'both' });
          anim(halves[1], [{ transform: 'none', opacity: 1 }, { transform: 'translate(' + (dx * 0.4) + 'px,' + (dy * 0.4) + 'px)', opacity: 1, offset: 0.25 }, { transform: 'translate(' + (dx - nx) + 'px,' + (dy + ny + fw * 0.2) + 'px) rotate(6deg)', opacity: 0 }], { duration: d, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'both' });
          finishCut();
          at(d, function () { if (root && root.parentNode) root.remove(); finish(); });
        });
      }
      at(waitT, doCut);
      h.tint = function (c, g) {
        if (!root) return;
        if (c) root.style.setProperty('--k-fx-c', c);
        if (g) root.style.setProperty('--k-fx-g', g); else root.style.removeProperty('--k-fx-g');
        var ring = mk('k-fx-ring', root);
        var a = anim(ring, [{ transform: 'translate(-50%,-50%) scale(.6)', opacity: .9 }, { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 0 }], { duration: 520, easing: 'ease-out', fill: 'both' });
        if (a) a.onfinish = function () { ring.remove(); }; else ring.remove();
        anim(fuda, [{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: 'translate(-50%,-50%) scale(1.06)' }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 260, easing: 'ease-out' });
      };
      h.cut = doCut;
      h.destroy = function () { timers.forEach(clearTimeout); timers = []; done = true; if (root && root.parentNode) root.remove(); };
      h.skip = function () { h.destroy(); done = false; finish(); };
      root._kfx = h;
      return h;
    }

    function shuriken(host, o) {
      o = o || {};
      var h = { remove: function () {} };
      if (reduce || !host) { setTimeout(function () { call(o.onHit); }, 0); return h; }
      var W = host.clientWidth || 600, H = host.clientHeight || 400, s = o.size || Math.max(40, Math.min(W, H) * 0.12);
      var root = mk('k-fx', host);
      root.style.setProperty('--k-fx-s', s + 'px');
      var x = o.x == null ? W / 2 : o.x, y = o.y == null ? H / 2 : o.y;
      var star = mk('k-fx-star', root), hit = mk('k-fx-hit', root);
      star.style.left = hit.style.left = x + 'px'; star.style.top = hit.style.top = y + 'px';
      var from = o.from || 'right', sx, sy;
      if (from === 'left') { sx = -x - s; sy = -Math.min(y, H * 0.3); }
      else if (from === 'top') { sx = W * 0.1; sy = -y - s; }
      else { sx = W - x + s; sy = -Math.min(y + s, H * 0.35); }
      var fl = ms(420, o.speed), endRot = 16 + Math.random() * 20;
      call(o.sound, 'throw');
      var a = anim(star, [{ transform: 'translate(' + sx + 'px,' + sy + 'px) rotate(-900deg) scale(.8)' }, { transform: 'translate(0,0) rotate(' + endRot + 'deg) scale(1.12)', offset: 0.9 }, { transform: 'translate(0,0) rotate(' + endRot + 'deg) scale(1)' }], { duration: fl, easing: 'cubic-bezier(.25,.6,.35,1)', fill: 'both' });
      var hitDone = false;
      function onHit() {
        if (hitDone) return; hitDone = true;
        call(o.sound, 'hit');
        anim(hit, [{ transform: 'scale(.5)', opacity: .8 }, { transform: 'scale(1.9)', opacity: 0 }], { duration: 420, easing: 'ease-out', fill: 'both' });
        anim(star, [{ transform: 'rotate(' + endRot + 'deg) scale(1)' }, { transform: 'rotate(' + (endRot - 4) + 'deg) scale(.96)' }, { transform: 'rotate(' + endRot + 'deg) scale(1)' }], { duration: 180, fill: 'forwards' });
        call(o.onHit);
      }
      if (a) a.onfinish = onHit; else onHit();
      setTimeout(onHit, fl + 60);   // 背景のタブなどで onfinish が来ないときの保険
      h.remove = function () { if (root.parentNode) root.remove(); };
      h.destroy = h.remove;
      root._kfx = h;
      return h;
    }

    // 刀・手裏剣の絵は、最初に使う瞬間に読み込み・展開すると止まる直前にカクつく（2026-10-22 ルーレット）。手が空いたときに先に読んでおく
    function warm() {
      if (reduce || warm.done) return; warm.done = true;
      var sc = [].slice.call(document.scripts).filter(function (x) { return /\/kit\/kit\.js(\?|$)/.test(x.src); })[0];
      var base = sc ? sc.src.replace(/kit\.js(\?.*)?$/, '') : '/kit/';
      ['fx-shuriken.webp', 'fx-katana.webp'].forEach(function (f) { var im = new Image(); im.decoding = 'async'; im.src = base + 'img/' + f; if (im.decode) im.decode().catch(function () {}); });
    }
    (window.requestIdleCallback || function (f) { setTimeout(f, 1200); })(warm);
    K.fx = { slash: slash, shuriken: shuriken, clear: clear, ms: ms, speed: k, reduce: !!reduce, warm: warm };
  }

  /* ===== 遊びの部品（2026-10-22 第3波）: サイコロ・ルーレット盤・ゲートの絵 =====
     KKit.die(要素, 目, { roll, ms, onDone })  .k-die に目（1〜6）を SVG で描く。roll:true で1回だけ転がって止まる（動きを減らす設定では転がらない）
     KKit.wheel(要素, { items, colors, minPx })  .k-wheel にルーレット盤（D4 の濃淡で区切る・中央に家紋・上に墨の針）。
        items は文字か { label, weight }（weight＝マスの広さ＝当たりやすさ）。empty: '…' で項目がないときの字
        戻り値 { set(items), pick(回数, 番号?)→止まる角度, spin(from, to, ms, done, { onTick, onFrame }), spinTo(番号, { turns, ms, onDone }),
                 at(角度), point(番号, 角度, 半径の割合)→{x,y}, mark(番号), angle, spinning, win, opts }
        spin は表の速さの形（KKit.wheel.ease）で回すので、同じ from・to・ms を送れば表示ページも同じ所に止まる。止まったあと左半分の字を180度回して逆さまにしない
     KKit.gateArt(基準パス)  canvas のゲーム用。のれんと柱の絵を読み、tint(色) で色を染めたのれん（canvas）を返す */
  function gameParts() {
    var K = window.KKit = window.KKit || {};
    var NS = 'http://www.w3.org/2000/svg';
    function $el(x) { return typeof x === 'string' ? document.querySelector(x) : x; }
    function svg(tag, at, parent) { var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); if (parent) parent.appendChild(e); return e; }
    function call(f, a, b) { if (typeof f === 'function') try { f(a, b); } catch (e) { setTimeout(function () { throw e; }); } }

    /* --- サイコロ --- */
    var PIPS = { 1: [[50, 50]], 2: [[27, 27], [73, 73]], 3: [[27, 27], [50, 50], [73, 73]], 4: [[27, 27], [73, 27], [27, 73], [73, 73]],
      5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]], 6: [[27, 25], [73, 25], [27, 50], [73, 50], [27, 75], [73, 75]] };
    function dieDefs() {
      if (document.getElementById('k-die-defs')) return;
      var s = svg('svg', { id: 'k-die-defs', width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute;width:0;height:0;overflow:hidden' });
      s.innerHTML = '<defs><linearGradient id="k-die-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f6ecda"/></linearGradient>'
        + '<radialGradient id="k-die-pip" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#3a322c"/><stop offset=".7" stop-color="#1f1a17"/><stop offset="1" stop-color="#0d0b0a"/></radialGradient>'
        + '<radialGradient id="k-die-pip-shu" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#e0583c"/><stop offset=".7" stop-color="#c93b23"/><stop offset="1" stop-color="#9e2c18"/></radialGradient></defs>';
      (document.body || document.documentElement).appendChild(s);
    }
    function drawDie(el, n) {
      n = Math.max(1, Math.min(6, n | 0 || 1));
      var shu = el.classList.contains('k-die-shu'), one = !el.classList.contains('k-die-plain');
      var s = el.querySelector('svg') || svg('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true', focusable: 'false' }, el);
      while (s.firstChild) s.removeChild(s.firstChild);
      svg('rect', { x: 4, y: 8, width: 92, height: 88, rx: 18, fill: '#e3d3b6', stroke: '#1f1a17', 'stroke-width': 3 }, s);     // 下の厚み
      svg('rect', { x: 4, y: 4, width: 92, height: 88, rx: 18, fill: 'url(#k-die-face)', stroke: '#1f1a17', 'stroke-width': 3 }, s);
      svg('path', { d: 'M20 11 H80', stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: '.9' }, s);           // 上の光
      var red = shu || (one && n === 1), r = n === 1 ? (one ? 15 : 11) : 9.5;
      PIPS[n].forEach(function (p) {
        var cy = 4 + p[1] * 0.88;   // 面（高さ88）の中に置く
        svg('circle', { cx: p[0], cy: cy, r: r, fill: red ? 'url(#k-die-pip-shu)' : 'url(#k-die-pip)' }, s);
        svg('path', { d: 'M' + (p[0] - r * 0.55) + ' ' + (cy + r * 0.62) + ' A' + r * 0.85 + ' ' + r * 0.85 + ' 0 0 0 ' + (p[0] + r * 0.62) + ' ' + (cy - r * 0.5), fill: 'none', stroke: '#fff', 'stroke-width': Math.max(1.2, r * 0.16), opacity: '.35', 'stroke-linecap': 'round' }, s);
      });
      el.setAttribute('data-face', n);
      if (!el.hasAttribute('role')) el.setAttribute('role', 'img');
      el.setAttribute('aria-label', 'サイコロ ' + n);
    }
    K.die = function (el, n, o) {
      el = $el(el); o = o || {}; if (!el) return;
      dieDefs();
      if (el._kDieT) { clearInterval(el._kDieT); el._kDieT = 0; }
      if (!o.roll || reduce) { drawDie(el, n); el.classList.remove('k-die-roll'); call(o.onDone, n); return; }
      var ms = o.ms || 620, t0 = Date.now(), last = 0;
      el.style.setProperty('--k-die-ms', ms + 'ms');
      el.classList.remove('k-die-roll'); void el.offsetWidth; el.classList.add('k-die-roll');
      drawDie(el, 1 + Math.floor(Math.random() * 6));
      el._kDieT = setInterval(function () {
        if (Date.now() - t0 >= ms * 0.72) { clearInterval(el._kDieT); el._kDieT = 0; drawDie(el, n); return; }
        var f; do { f = 1 + Math.floor(Math.random() * 6); } while (f === last); last = f; drawDie(el, f);
      }, 85);
      setTimeout(function () { el.classList.remove('k-die-roll'); call(o.onDone, n); }, ms + 20);
    };
    K.die.draw = function (el, n) { el = $el(el); if (el) { dieDefs(); drawDie(el, n); } };

    /* --- ルーレット盤 --- */
    // 濃淡: 朱（白字）・生成り（墨字）・オレンジ（墨字）・薄いオレンジ（墨字）。隣どうし・最後と最初が同じにならないように
    var WCOL = [['#c93b23', '#fff'], ['#fbf3e4', '#1f1a17'], ['#ff8a3d', '#1f1a17'], ['#f9d9b6', '#1f1a17']];
    function wheelColors(n, pal) {
      var out = [], i; for (i = 0; i < n; i++) out.push(pal[i % pal.length]);
      if (n > 1 && out[n - 1] === out[0]) out[n - 1] = pal[(n - 1) % pal.length === 0 ? 2 % pal.length : 1];
      if (n > 2 && out[n - 1] === out[n - 2]) out[n - 1] = pal[3 % pal.length];
      return out;
    }
    // 回る速さの形: 最初の 8% で加速 → 長く減速（最後はゆっくり＝じらし）。表で持つので、操作画面と表示ページで同じ角度になる
    var WEASE = (function () {
      var N = 400, a = 0.08, p = 2.6, v = [], acc = [0], i, sum = 0;
      for (i = 0; i <= N; i++) { var t = i / N; v.push(t < a ? t / a : Math.pow(1 - (t - a) / (1 - a), p)); }
      for (i = 1; i <= N; i++) { sum += (v[i - 1] + v[i]) / 2; acc.push(sum); }
      return acc.map(function (x) { return x / sum; });
    })();
    function wEase(t) { if (t <= 0) return 0; if (t >= 1) return 1; var f = t * (WEASE.length - 1), i = Math.floor(f); return WEASE[i] + (WEASE[i + 1] - WEASE[i]) * (f - i); }
    K.wheel = function (el, o) {
      el = $el(el); o = o || {};
      // items は文字か { label, weight }（weight＝マスの広さ・当たりやすさ。既定 1）
      var W = { items: [], segs: [], angle: 0, el: el, spinning: false, opts: o, win: -1 }, R = 94, HUB = 20;   // HUB＝中央の家紋（ふちまで）の半径（盤の 200 単位で）。第5波で 27→20（字を置ける長さを増やす）
      el.classList.add('k-wheel'); el.innerHTML = '';
      var disc = document.createElement('div'); disc.className = 'k-wheel-disc'; el.appendChild(disc);
      var s = svg('svg', { viewBox: '-100 -100 200 200', 'aria-hidden': 'true', focusable: 'false' }, disc);
      var gSeg = svg('g', {}, s), gTxt = svg('g', {}, s);
      svg('circle', { r: R, fill: 'none', stroke: '#1f1a17', 'stroke-width': 4 }, s);
      var hub = document.createElement('div'); hub.className = 'k-wheel-hub'; el.appendChild(hub);
      var pin = document.createElement('div'); pin.className = 'k-wheel-pin'; el.appendChild(pin);
      var ps = svg('svg', { viewBox: '0 0 40 52', 'aria-hidden': 'true' }, pin);
      svg('path', { d: 'M20 50 L5 16 A16 16 0 1 1 35 16 Z', fill: '#1f1a17', stroke: '#fffdf8', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, ps);
      svg('circle', { cx: 20, cy: 15, r: 5.5, fill: '#c93b23' }, ps);
      var empty = document.createElement('div'); empty.className = 'k-wheel-empty'; empty.hidden = true; el.appendChild(empty);
      var texts = [], paths = [], raf = 0;
      function pt(a, r) { var t = a * Math.PI / 180; return [r * Math.sin(t), -r * Math.cos(t)]; }
      function scale() { var w = disc.clientWidth || el.clientWidth || 300; return w / 200; }
      function rot(a) { disc.style.transform = 'rotate(' + a + 'deg)'; }
      function layoutText() {
        var sc = scale(), min = (o.minPx || 14) / sc;
        texts.forEach(function (t, i) {
          var sg = W.segs[i], step = sg.a1 - sg.a0, mid = (sg.a0 + sg.a1) / 2, flip = Math.sin((mid + W.angle) * Math.PI / 180) < -0.02;
          var label = sg.label, len = Math.max(1, label.length);
          // 字の幅は1字＝1em とみなす。字の列の内側の端でも、隣のマスにはみ出さない大きさにする
          var half = Math.min(Math.PI / 2, step * Math.PI / 360);
          var fits = function (px, chars, rows) { var inner = R * 0.88 - px * chars; return inner >= HUB + 3 && 2 * inner * Math.sin(half) * 0.9 >= px * (rows * 1.12); };
          var best = function (chars, rows, top) { for (var p2 = top; p2 >= 6; p2 -= 0.5) if (fits(p2, chars, rows)) return p2; return 0; };
          var lines = [label], px = best(len, 1, 17);
          if (px < 15 / sc && len >= 4) {
            var h = Math.ceil(len / 2);
            while (h > 1 && /^[ーッャュョァィゥェォっゃゅょぁぃぅぇぉ、。）」]/.test(label.charAt(h))) h--;   // 2行目の頭に「ー」や小さい字を置かない
            var px2 = best(Math.max(h, len - h), 2, 16);
            if (px2 > px) { lines = [label.slice(0, h), label.slice(h)]; px = px2; }
          }
          if (px < min) {   // 入らない: 1行で末尾を省く。「…」の前に2字残らない細いマスは字を描かない（「1字＋…」は読めない）
            px = min;
            if (fits(px, len, 1)) lines = [label];
            else { var keep = 0; while (keep < len - 1 && fits(px, keep + 2, 1)) keep++; lines = keep < 2 ? [] : [label.slice(0, keep) + '…']; }
          }
          while (t.firstChild) t.removeChild(t.firstChild);
          // 左半分は180度回して、外側から中心へ読む向きに（逆さまにしない）
          var x = flip ? -(R * 0.88) : R * 0.88, lh = px * 1.12, y0 = -(lines.length - 1) * lh / 2;
          t.setAttribute('transform', 'rotate(' + (mid - 90 + (flip ? 180 : 0)) + ')');
          t.setAttribute('text-anchor', flip ? 'start' : 'end');
          lines.forEach(function (ln, k) {
            var tx = svg('text', { x: x.toFixed(2), y: (y0 + k * lh).toFixed(2), 'font-size': px.toFixed(2), 'dominant-baseline': 'central' }, t);
            tx.textContent = ln;
          });
        });
      }
      function norm(x) { var lab = x && typeof x === 'object' ? x.label : x, w = x && typeof x === 'object' ? +x.weight : 1; return { label: String(lab == null ? '' : lab), weight: w > 0 ? w : 1 }; }
      W.set = function (items) {
        W.items = (items || []).map(norm); var n = W.items.length, total = 0, a = 0;
        W.items.forEach(function (it) { total += it.weight; });
        W.segs = W.items.map(function (it) { var w = it.weight / total * 360, sg = { label: it.label, a0: a, a1: a + w }; a += w; return sg; });
        var cols = wheelColors(n, o.colors || WCOL);
        while (gSeg.firstChild) gSeg.removeChild(gSeg.firstChild);
        while (gTxt.firstChild) gTxt.removeChild(gTxt.firstChild);
        texts = []; paths = []; W.win = -1; el.classList.remove('k-wheel-won');
        empty.hidden = !!n || !o.empty; if (!n && o.empty) empty.textContent = o.empty;
        if (!n) { svg('circle', { r: R, fill: '#fbf3e4' }, gSeg); return W; }
        for (var i = 0; i < n; i++) {
          var sg = W.segs[i], step = sg.a1 - sg.a0, p0 = pt(sg.a0, R), p1 = pt(sg.a1, R);
          var d = n === 1 ? 'M0 -' + R + ' A' + R + ' ' + R + ' 0 1 1 0 ' + R + ' A' + R + ' ' + R + ' 0 1 1 0 -' + R + ' Z'
            : 'M0 0 L' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A' + R + ' ' + R + ' 0 ' + (step > 180 ? 1 : 0) + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) + ' Z';
          paths.push(svg('path', { d: d, fill: cols[i][0], stroke: '#1f1a17', 'stroke-width': 2, 'stroke-linejoin': 'round' }, gSeg));
          texts.push(svg('g', { fill: cols[i][1], class: 'k-wheel-t' }, gTxt));
        }
        layoutText();
        return W;
      };
      // 角度 a（盤の回転・度）のとき針の下にある番号
      W.at = function (a) {
        var n = W.segs.length; if (!n) return -1; var pos = ((360 - (a % 360)) % 360 + 360) % 360;
        for (var i = 0; i < n; i++) if (pos >= W.segs[i].a0 && pos < W.segs[i].a1) return i;
        return n - 1;
      };
      // 止まる角度を決める（当たりは weight どおり・止まる位置は境目を越えてすぐ＝最後に1マス進むじらし）。idx を渡せばその番号で
      W.pick = function (turns, idx) {
        var base = W.angle - (W.angle % 360), n = W.segs.length; turns = turns == null ? 5 : turns;
        if (!n) return base + 360 * turns;
        var i = idx;
        if (i == null || i < 0 || i >= n) {
          var total = 0, x; W.items.forEach(function (it) { total += it.weight; }); x = Math.random() * total;
          for (i = 0; i < n - 1; i++) { if (x < W.items[i].weight) break; x -= W.items[i].weight; }
        }
        var sg = W.segs[i], w = sg.a1 - sg.a0, pos = sg.a1 - w * (0.14 + Math.random() * 0.22);
        return base + 360 * turns + ((360 - pos) % 360 + 360) % 360;
      };
      // from → to（度）を ms かけて回す。速さの形は表（K.wheel.ease）なので、同じ from・to・ms なら別の窓でも同じ所に止まる
      // so: onTick(番号)＝針がマスの境目を越えたとき・onFrame(t, 経過ms)・ease(t)。止まると done(番号)
      // 針がマスの境目でぴくっと動く。クラスの付け直し（void offsetWidth）はページ全体の配置の計算をやり直させ、
      // スマホ（特にデスクトップ表示・配信モード）で回転がガタつくので、Web Animations で針の絵だけを動かす（2026-10-22）
      var pinAnim = null;
      function tickPin() {
        var g = pin.firstElementChild; if (!g || reduce) return;
        if (g.animate) { if (pinAnim) pinAnim.cancel(); pinAnim = g.animate([{ transform: 'none' }, { transform: 'rotate(-14deg)', offset: 0.4 }, { transform: 'none' }], { duration: 160, easing: 'ease-out' }); }
      }
      W.spin = function (from, to, ms, done, so) {
        so = so || {}; if (raf) cancelAnimationFrame(raf);
        var ez = so.ease || wEase, t0 = null, lastSeg = W.at(from);
        ms = reduce ? 0 : Math.max(0, ms || 0);
        W.spinning = true; W.win = -1; el.classList.remove('k-wheel-won'); paths.forEach(function (x) { x.classList.remove('k-wheel-win'); });
        disc.style.transition = 'none'; W.angle = from; rot(from);
        function end() { raf = 0; W.spinning = false; W.angle = to; rot(to); layoutText(); W.mark(W.at(to)); call(done, W.win); }
        if (!ms) { end(); return; }
        function frame(ts) {
          if (t0 === null) t0 = ts;
          var t = Math.min(1, (ts - t0) / ms);
          W.angle = from + (to - from) * ez(t); rot(W.angle);
          call(so.onFrame, t, ts - t0);
          var sg = W.at(W.angle);
          if (sg !== lastSeg) { lastSeg = sg; tickPin(); call(so.onTick || W.onTick, sg); }
          if (t < 1) raf = requestAnimationFrame(frame); else end();
        }
        raf = requestAnimationFrame(frame);
      };
      // 当たりのマスを目立たせる（-1 で消す）
      W.mark = function (i) {
        paths.forEach(function (x) { x.classList.remove('k-wheel-win'); });
        W.win = i; el.classList.toggle('k-wheel-won', i >= 0);
        if (i >= 0 && paths[i]) { paths[i].classList.add('k-wheel-win'); gSeg.appendChild(paths[i]); }
      };
      // 番号を決めて回す（前からの形）
      W.spinTo = function (idx, so) {
        so = so || {}; var n = W.segs.length; if (!n) return;
        var to = W.pick(so.turns, idx);
        W.spin(W.angle, to, so.ms || 3200, so.onDone, so);
      };
      // i 番目のマスの真ん中（半径の frac の位置）を、盤の要素の左上からの px で返す（手裏剣を刺す所など）。ang は盤の回転（度）
      W.point = function (i, ang, frac) {
        var w = el.clientWidth, c = w / 2, sc = scale(), sg = W.segs[i];
        if (!sg) return { x: c, y: c };
        var phi = ((sg.a0 + sg.a1) / 2 + (ang == null ? W.angle : ang)) * Math.PI / 180, r = R * (frac || 0.6) * sc;
        return { x: c + Math.sin(phi) * r, y: c - Math.cos(phi) * r };
      };
      W.relayout = function () { if (W.segs.length) layoutText(); };
      if (typeof ResizeObserver === 'function') new ResizeObserver(function () { if (W.segs.length) layoutText(); }).observe(el);
      W.set(o.items || []);
      return W;
    };
    K.wheel.ease = wEase;

    /* --- ゲートの絵（canvas 用） --- */
    K.gateArt = function (base) {
      base = base == null ? 'kit/img/' : base;
      var A = { ready: false, noren: null, post: null, cache: {} };
      var n = 0, done = function () { if (++n === 2) A.ready = !!(A.noren && A.post); };
      function load(k, f) { var im = new Image(); im.onload = function () { A[k] = im; done(); }; im.onerror = done; im.src = base + f; }
      load('noren', 'k-gate-noren.webp'); load('post', 'k-gate-post.webp');
      // のれんの白い布だけを色で染める（輪郭・竿の茶はそのまま）。白→その色・布の影→少し濃い色。色ごとに1回だけ作る
      A.tint = function (col) {
        if (!A.noren) return null; if (A.cache[col]) return A.cache[col];
        var im = A.noren, c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        var x = c.getContext('2d'); x.drawImage(im, 0, 0);
        var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(col);
        if (!m) return im;
        var cr = parseInt(m[1], 16), cg = parseInt(m[2], 16), cb = parseInt(m[3], 16);
        try {
          var d = x.getImageData(0, 0, c.width, c.height), p = d.data;
          for (var i = 0; i < p.length; i += 4) {
            var r = p[i], g = p[i + 1], b = p[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            if (mx < 150 || mx - mn > 28) continue;          // 色のある所（竿）・暗い所（輪郭）は染めない
            var l = mx / 255, t = Math.min(1, (mx - 150) / 60);  // 明るさを残して染める（影は濃い色）
            p[i] = r + (cr * l - r) * t; p[i + 1] = g + (cg * l - g) * t; p[i + 2] = b + (cb * l - b) * t;
          }
          x.putImageData(d, 0, 0);
        } catch (e) { return im; }
        return (A.cache[col] = c);
      };
      return A;
    };
  }
})();
