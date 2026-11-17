/* 文章頁的「🔗 分享連結」與「☆ 收藏」按鈕。
   分享連結＝這篇文章自己的網址（例如 …/cad2d/t30764/），對方點開就直接到這篇文章，不需要登島。
   收藏存在這台裝置的瀏覽器（localStorage 'aikb-fav-art'，格式和首頁的瀏覽紀錄相同：{h,t,at}），首頁「⭐ 我的收藏」會列出來。 */
(function () {
  'use strict';
  var shareBtn = document.getElementById('tShare'), favBtn = document.getElementById('tFav');
  if (!shareBtn && !favBtn) return;
  var m = location.pathname.match(/([^\/]+)\/(t\d+)\/(?:index\.html)?$/);
  if (!m) return;
  var href = m[1] + '/' + m[2] + '/index.html';
  var url = location.origin + location.pathname.replace(/index\.html$/, '');
  var title = (document.title || '').split(' | ')[0] || m[2];
  var KEY = 'aikb-fav-art';
  var toastEl = null, toastTimer = 0;

  function toast(msg) {
    try {
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.className = 'ta-toast';
        toastEl.setAttribute('role', 'status');
        document.body.appendChild(toastEl);
      }
      toastEl.textContent = msg;
      toastEl.classList.add('on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 2600);
    } catch (e) {}
  }
  function load() {
    try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter(function (x) { return x && typeof x.h === 'string'; }) : []; } catch (e) { return []; }
  }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, 300))); return true; } catch (e) { return false; } }
  function isFav() { return load().some(function (x) { return x.h === href; }); }
  function paintFav() {
    if (!favBtn) return;
    var on = isFav();
    favBtn.classList.toggle('on', on);
    favBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    favBtn.textContent = on ? '⭐ 已收藏' : '☆ 收藏';
  }
  function copy(text, done) {
    function fallback() {
      var t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(t); t.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(t); done(ok);
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    else fallback();
  }

  if (shareBtn) shareBtn.addEventListener('click', function () {
    if (navigator.share && window.matchMedia && matchMedia('(pointer: coarse)').matches) {
      navigator.share({ title: title + '｜論壇資源島', url: url }).catch(function () {});
      return;
    }
    copy(url, function (ok) {
      toast(ok ? '🔗 已複製這篇文章的連結，貼給朋友點開就會直接到這篇' : '⚠️ 無法自動複製，請手動複製網址列的連結');
    });
  });
  if (favBtn) {
    favBtn.addEventListener('click', function () {
      var a = load(), i = -1;
      a.forEach(function (x, k) { if (x.h === href) i = k; });
      if (i >= 0) { a.splice(i, 1); toast('已取消收藏'); }
      else { a.unshift({ h: href, t: title.slice(0, 120), at: Date.now() }); toast('⭐ 已收藏，到首頁的「⭐ 我的收藏」就找得到'); }
      if (!save(a)) toast('⚠️ 這個瀏覽器不允許儲存收藏（可能是無痕模式）');
      paintFav();
    });
    window.addEventListener('storage', function (e) { if (e.key === KEY) paintFav(); });
    paintFav();
  }
})();
