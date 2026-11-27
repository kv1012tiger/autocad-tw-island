/* 金幣與登島碼：暱稱註冊、登島碼跨裝置、每日登島、在線、爬文送金幣；下載扣金幣；排行榜。
   金幣以蘋果爸的 Google 試算表（Apps Script）為準，瀏覽器只暫存一份顯示用。首頁與文章頁共用。 */
(function () {
  var API = 'https://script.google.com/macros/s/AKfycbyvv3G6pw8MywtKOpG4pSCu79lsYvDbxDlsMSrUOYsPVCOirw5v1m1rLeyfm_4Dbm84/exec';
  var LINE = 'https://lin.ee/4xw8yKI';
  var KEY = 'aikb-player';
  var TOP = window.top === window;
  var guestMode = false; try { guestMode = sessionStorage.getItem('cw-guest-mode') === '1'; } catch (e) {}
  function setGuest(on) { guestMode = !!on; try { sessionStorage.setItem('cw-guest-mode', on ? '1' : '0'); } catch (e) {} load(); emit({ t: 'identity' }); }
  var ONLINE_MS = 5 * 60 * 1000, ONLINE_MAX = 3, READ_EVERY = 2, READ_MAX = 6;

  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- 本機暫存 ---------- */
  var P = null, started = false, listeners = [];
  function blank() { return { code: '', nick: '', bal: 0, earned: 0, streak: 0, admin: false, onl: { d: '', ms: 0, n: 0 }, rd: { d: '', seen: [], n: 0 } }; }
  function load() {
    if (guestMode) { P = blank(); return P; }
    try { P = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { P = null; }
    if (!P || typeof P.bal !== 'number') P = blank();
    if (!P.onl) P.onl = { d: '', ms: 0, n: 0 };
    if (!P.rd) P.rd = { d: '', seen: [], n: 0 };
    return P;
  }
  function save() { if (guestMode) return; try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} }
  function emit(ev) { listeners.forEach(function (f) { try { f(ev, P); } catch (e) {} }); }
  function apply(p) {
    if (!p) return;
    P.code = p.code; P.nick = p.nick; P.bal = p.bal; P.earned = p.earned; P.streak = p.streak; P.admin = !!p.admin; P.qa = p.qa || [];
    ['av', 'fid', 'bag', 'dia', 'tres', 'tdia', 'today', 'gLast', 'trades', 'tradeMax', 'swaps', 'swapMax', 'diaSells', 'diaSellMax', 'buys', 'buyMax', 'diaBuyMax', 'bbag', 'bsell', 'bsellIv', 'bcol', 'bt', 'bin', 'unread', 'friends', 'fl', 'veg', 'score', 'open', 'annSeen', 'ann', 'dr', 'drMax', 'qs', 'qCoin', 'ship', 'cd', 'pg', 'starterGuide'].forEach(function (k) { if (p[k] !== undefined) P[k] = p[k]; });
    if (p.cd !== undefined) P.cdT = Date.now();
    save(); emit({ t: 'sync' });
  }

  /* ---------- 呼叫試算表（長文字用 POST） ---------- */
  var READ_ONLY = { me: 1, login: 1, island: 1, isles: 1, top: 1, msgs: 1, mimg: 1, visitors: 1, visall: 1, friends: 1, anns: 1, voyage: 1, drops: 1, isl: 1, unread: 1 };
  function call(o, post, retried) {
    var req = post ? fetch(API, { method: 'POST', body: JSON.stringify(o), cache: 'no-store' })
      : fetch(API + '?q=' + encodeURIComponent(JSON.stringify(o)), { cache: 'no-store' });
    return req.then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
      .catch(function (e) {
        // 只讀的查詢偶爾遇到 Google 忙線，等一下自動再試一次
        if (retried || !READ_ONLY[o.a]) throw e;
        return new Promise(function (ok) { setTimeout(ok, 900); }).then(function () { return call(o, post, true); });
      });
  }
  /* 帶登島碼呼叫，自動更新錢包；登島碼失效就登出 */
  function api(o, post, busyTry) {
    var requestedCode = P.code; o.code = requestedCode;
    return call(o, post).then(function (j) {
      /* v75：伺服器排不到寫入鎖（busy）時什麼都還沒寫入，等一下自動再送一次 */
      if (j && !j.ok && j.err === 'busy' && !busyTry) { toast('⏳ 伺服器忙線，自動再試一次…'); return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () { return api(o, post, true); }); }
      if (P.code !== requestedCode) return j;
      if (j && j.p) apply(j.p);
      if (j && !j.ok && j.err === 'nocode') { logout(); toast('請重新登島'); }
      if (j && j.add) emit({ t: 'add', n: j.add });
      return j;
    });
  }
  var ERR = {
    short: '暱稱至少要 2 個字', taken: '這個暱稱已經有人用了，換一個吧', reserved: '這個暱稱保留給站長，換一個吧',
    nocode: '找不到這組登島碼，請再確認一次',
    pgnot: '累積拿滿 5 枚金幣才能領提示詞禮物包',
    building: '這項還在施工中，等蓋好才能再蓋', owned: '這艘船你已經有了', notown: '你還沒有這艘船', nocoin: '金幣不夠喔',
    noinv: '封測期間要有邀請碼才能登島，請向蘋果爸索取一組', badinv: '邀請碼不正確，請再確認一次（英文字母和數字）', invfull: '這組邀請碼名額已滿（每組限 2 位），請向蘋果爸索取新的一組', bad: '資料有誤，請重新整理後再試',
    nofid: '找不到這個海島編號，請再確認一次', self: '這是你自己的海島編號喔', fmax: '好友最多 50 位',
    notfriend: '要先互加好友才行', gifted: '今天已經送過這位好友了，明天再送', few: '數量不夠喔',
    trademax: '今天的兌換次數用完了，明天再來', nobeast: '神獸收藏裡沒有這隻了', nogift: '這份神獸禮物已經處理過或退回了', binfull: '對方還有 10 份神獸禮物沒處理，等他處理完再送', noshard: '碎片不夠，要同一隻神獸的頭、身、腳各一片', nobfruit: '沒有神獸果了：神獸試煉島、扭蛋島、拉霸都拿得到', bfedmax: '這隻神獸今天已經吃了 2 顆神獸果，明天再餵', gamecool: '太快了，休息幾秒再試', gachamax: '今天 3 次扭蛋抽完了，明天再來', swapmax: '今天的物資互換次數用完了（每天 5 次），明天再來', diamax: '今天的鑽石換金幣次數用完了（每天 3 次），明天再來', buymax: '今天買這樣東西的次數用完了，明天再來', notemax: '今天的悄悄話已經用完了，明天再聊',
    busy: '伺服器忙線中，請稍等一下再試', likeself: '不能幫自己按讚喔', likefast: '按太快了，等一下再按', likemax: '今天按讚次數用完了，明天再來', msgshort: '留言至少要 2 個字', imgbad: '圖片格式不對或太大，換一張試試', imgfail: '圖片存檔失敗，請稍後再試', msgmax: '今天的留言次數用完了，明天再來', admin: '只有站長可以這樣做',
    tired: '今天在這座島採夠了，明天再來', closed: '這座島的資源剛消失了，每 20 分鐘會隨機換一批，到地圖上找有徽章的島吧', empty: '這座島今天的物資被採光了，明天會再長出來',
    maxed: '已經蓋到最高級了', busy: '這塊田已經種了東西', notyet: '還沒長好喔，再等等', nohouse: '要先蓋小屋才能領養寵物',
    petowned: '這種動物已經領養過了', petmax: '小屋住滿了，升級小屋就能多養一隻', nocoin: '金幣不夠喔', petfull: '牠已經吃得飽飽的了', patted: '今天已經摸過牠了',
    watered: '今天已經幫他澆過水了', nocrop: '他的田裡現在沒有在長的菜', closed: '這座島的主人沒有開放參觀', nodrop: '這個寶物已經被海浪沖走了', chestmax: '今天的寶箱都撿完了，明天再來', chestidle: '要在島上有動作才撿得到寶箱', got: '你已經領過了', dropmax: '今天撿到的寶物夠多了，明天再來', notyet: '這個任務還沒完成喔', annshort: '公告內容至少要 2 個字'
  };
  function errText(j) {
    if (!j) return ERR.bad;
    if (j.err === 'cool') return '休息一下，' + j.wait + ' 秒後再採集';
    if (j.err === 'msgcool') return '留言太快了，' + j.wait + ' 秒後再試';
    if (j.err === 'few' && j.miss && Object.keys(j.miss).length) {
      var N = { fruit: '🍎 水果', iron: '🔩 鐵礦', wood: '🪵 木材', stone: '🪨 石頭', dia: '💎 鑽石' };
      return '材料不夠，還缺 ' + Object.keys(j.miss).map(function (k) { return (N[k] || k) + ' ×' + j.miss[k]; }).join('、');
    }
    return ERR[j.err] || ERR.bad;
  }
  var AVATARS = ['🐱', '🐶', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐧', '🦉', '🐢'];
  var RES = { fruit: ['🍎', '水果', '果園島'], iron: ['🔩', '鐵礦', '礦山島'], wood: ['🪵', '木材', '森林島'], stone: ['🪨', '石頭', '採石島'] };
  var RES_KEYS = ['fruit', 'iron', 'wood', 'stone'];
  function av(x) { return esc(x && x.av ? x.av : '🙂'); }
  function netFail() { toast('⚠️ 暫時連不上金幣小島，請稍後再試'); }

  /* ---------- 送金幣 ---------- */
  function earn(kind, msg, key) {
    if (!P.code) return Promise.resolve(0);
    return call({ a: 'earn', k: kind, code: P.code, key: key }).then(function (j) {
      if (!j.ok) { if (j.err === 'nocode') logout(); return 0; }
      apply(j.p);
      if (j.add) { emit({ t: 'add', n: j.add }); toast('🪙 +' + j.add + '　' + msg); }
      return j.add;
    }).catch(function () { return 0; });
  }
  function daily() {
    if (!P.code) return Promise.resolve();
    return call({ a: 'daily', code: P.code }).then(function (j) {
      if (!j.ok) { if (j.err === 'nocode') logout(); return; }
      apply(j.p);
      if (j.add) { emit({ t: 'add', n: j.add }); toast('🪙 +' + j.add + '　' + (j.p.streak > 1 ? '每日登島（連續 ' + j.p.streak + ' 天）' : '每日登島')); }
    }).catch(function () {});
  }
  /* v77 新悄悄話：網頁開著、人在畫面上時每 60 秒問一次（只讀、很輕），有新的就跳通知、更新紅點；背包開著就順便刷新收件匣 */
  var INBOX_LIVE = null;
  function unreadPoll() {
    setInterval(function () {
      if (!P.code || (document.visibilityState && document.visibilityState !== 'visible')) return;
      var c0 = P.code;
      call({ a: 'unread', code: c0 }).then(function (j) {
        if (!j || !j.ok || P.code !== c0) return;
        var n = num(j.unread), was = num(P.unread);
        if (n === was) return;
        P.unread = n; save(); emit({ t: 'sync' });
        if (n > was) { toast('✉️ 你有 ' + n + ' 則新悄悄話，打開背包看看'); if (INBOX_LIVE) INBOX_LIVE(); }
      }).catch(function () {});
    }, 60000);
  }
  function online() {
    var tick = 15000;
    setInterval(function () {
      if (!P.code || (document.visibilityState && document.visibilityState !== 'visible')) return;
      var t = today();
      if (P.onl.d !== t) P.onl = { d: t, ms: 0, n: 0 };
      if (P.onl.n >= ONLINE_MAX) return;
      P.onl.ms += tick;
      if (P.onl.ms >= ONLINE_MS * (P.onl.n + 1)) { P.onl.n++; save(); earn('online', '在島上待滿 ' + (5 * P.onl.n) + ' 分鐘'); }
      else save();
    }, tick);
  }
  /* ---------- v72 寶箱：網頁開著＋3 分鐘內有點擊／觸控／捲動／按鍵才算在線；累計 15 分鐘就有一個寶箱漂到地圖上隨機一座島（首頁畫，位置存在 k）。
     離開 30 分鐘以上再回來算新來訪，只要 5 分鐘（常來的人機會多）；每天最多 4 個，伺服器再檢查一次 ---------- */
  var CK_KEY = 'cw-chest', CK_TICK = 15000, CK_IDLE = 180000, CK_VISIT = 1800000, CK_FIRST = 5 * 60000, CK_EVERY = 15 * 60000, CK_MAX = 4;
  var ckAct = Date.now(), ckBusy = false;
  ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(function (ev) { addEventListener(ev, function () { ckAct = Date.now(); }, { passive: true, capture: true }); });
  function num(x) { return Number(x) || 0; }
  function ckGet() {
    var s = null, t = today(); try { s = JSON.parse(localStorage.getItem(CK_KEY) || 'null'); } catch (e) {}
    if (!s || s.d !== t) s = { d: t, n: 0, ms: 0, need: CK_FIRST, last: s ? num(s.last) : 0, up: false, id: '', k: '' };
    return s;
  }
  function ckSave(s) { try { localStorage.setItem(CK_KEY, JSON.stringify(s)); } catch (e) {} }
  function ckTick() {
    if (!P.code || (document.visibilityState && document.visibilityState !== 'visible')) return;
    var now = Date.now(); if (now - ckAct > CK_IDLE) return;   // 閒置（掛網）不累計
    var s = ckGet();
    if (now - num(s.last) > CK_VISIT && s.need - s.ms > CK_FIRST) s.ms = s.need - CK_FIRST;   // 新來訪：只要再 5 分鐘
    s.last = now;
    if (s.n < CK_MAX && !s.up) {
      s.ms += CK_TICK;
      if (s.ms >= s.need) {
        s.up = true; s.k = ''; ckSave(s); emit({ t: 'chest' });
        toast(window.CHEST_MAP ? '🎁 有寶箱漂到地圖上的某座島了，快去找找！' : '🎁 有寶箱漂到島嶼地圖上了，回地圖找找看！');
        return;
      }
    }
    ckSave(s);
  }
  var CK_NAME = { coin: ['🪙', '金幣'], wood: ['🪵', '木材'], iron: ['🔩', '鐵礦'], stone: ['🪨', '石頭'], dia: ['💎', '鑽石'] }, CK_PART = { head: '頭', body: '身', foot: '腳' };
  function ckText(c) { return c.k === 'shard' ? '🧩 ' + (c.name || '神獸') + '的' + (CK_PART[c.part] || '') + '碎片 ×1' : (CK_NAME[c.k] || ['🎁', ''])[0] + ' ' + (CK_NAME[c.k] || ['', '資源'])[1] + ' ×' + c.n; }
  /* 打開寶箱：回傳 {ok, chest, text, n, max} 或 {ok:false, msg}；畫面由地圖頁決定怎麼顯示 */
  function ckOpen() {
    if (ckBusy) return Promise.resolve({ ok: false, busy: 1 });
    if (!P.code) return Promise.resolve({ ok: false, msg: '請先登島' });
    ckBusy = true;
    var s = ckGet(); if (!s.id) { s.id = 'ck-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); ckSave(s); }
    var id = s.id;
    function go(retry) {
      return api({ a: 'chest', id: id }).then(function (j) {
        if (j && !j.ok && j.err === 'chestidle' && !retry) return api({ a: 'me' }).then(function () { return go(true); });   // 剛剛有點擊：先回報在線再開一次
        return j;
      });
    }
    return go(false).then(function (j) {
      ckBusy = false; var s = ckGet();
      if (j && j.ok && j.chest) {
        s.n = num(j.ck && j.ck.n); s.up = false; s.ms = 0; s.need = CK_EVERY; s.id = ''; s.k = ''; ckSave(s); emit({ t: 'chest' });
        return { ok: true, chest: j.chest, text: ckText(j.chest), n: s.n, max: CK_MAX };
      }
      if (j && j.err === 'chestmax') { s.n = CK_MAX; s.up = false; s.id = ''; s.k = ''; ckSave(s); emit({ t: 'chest' }); return { ok: false, msg: ERR.chestmax }; }
      if (j && j.err === 'chestwait') return { ok: false, msg: '寶箱還在漂過來，' + Math.max(1, Math.ceil(num(j.wait) / 60)) + ' 分鐘後再打開' };
      return { ok: false, msg: errText(j) };
    }, function () { ckBusy = false; return { ok: false, msg: '網路不穩，等一下再打開寶箱' }; });
  }
  function chest() { setInterval(ckTick, CK_TICK); if (ckGet().up) emit({ t: 'chest' }); }
  function read(href) {
    if (!href || !P.code) return;
    var m = String(href).match(/([^\/]+\/t\d+)\//);
    href = m ? m[1] : String(href);
    var t = today();
    if (P.rd.d !== t) P.rd = { d: t, seen: [], n: 0 };
    if (P.rd.seen.indexOf(href) >= 0) return;
    P.rd.seen.push(href); save();
    // 隱藏優惠：看文章有機率撿到鑽石（說明裡不寫；中獎才會跳提示）
    call({ a: 'readres', code: P.code, key: href }).then(function (j) {
      if (!j || !j.ok) { if (j && j.err === 'nocode') logout(); return; }
      apply(j.p);
      if (j.got && j.got.dia) toast('🎁 隱藏優惠！看文章時撿到 💎 鑽石 +' + j.got.dia);
    }).catch(function () {});
    if (P.rd.seen.length % READ_EVERY === 0 && P.rd.n < READ_MAX) {
      if (Math.random() < 0.7) { P.rd.n++; save(); earn('read', '爬文好運（今天第 ' + P.rd.seen.length + ' 篇）'); }
      else toast('🍀 看了 ' + P.rd.seen.length + ' 篇，這次沒抽中金幣，再看 2 篇再抽一次');
    }
  }
  function logout() { P = blank(); save(); emit({ t: 'logout' }); }

  /* ---------- 介面 ---------- */
  var CSS =
    '.cw-toast{position:fixed;left:50%;top:calc(70px + env(safe-area-inset-top));transform:translate(-50%,-20px);z-index:9999;padding:10px 18px;border-radius:999px;background:rgba(3,42,60,.95);border:2px solid #ffd166;color:#fff8e7;font:700 16px/1.4 "Noto Sans TC",sans-serif;opacity:0;transition:.3s;pointer-events:none;max-width:92vw;text-align:center}' +
    '.cw-toast.on{opacity:1;transform:translate(-50%,0)}' +
    '.cw-ov{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,20,32,.72)}' +
    '.cw-box{width:100%;max-width:420px;max-height:86vh;overflow:auto;padding:22px 20px 18px;border-radius:22px;background:#0b4660;border:2px solid #ffd166;color:#fff8e7;font:16px/1.6 "Noto Sans TC",sans-serif;text-align:center;box-shadow:0 18px 40px rgba(0,0,0,.5)}' +
    '.cw-box h3{margin:4px 0 8px;font-size:22px;font-weight:900}.cw-box p{margin:6px 0}.cw-ic{font-size:46px;line-height:1.1}' +
    '.cw-box small{display:block;color:#b9d8e4;font-size:13.5px;line-height:1.5;margin-top:10px}.cw-box small a,.cw-box p a{color:#7fd8ff}' +
    '.cw-in{width:100%;box-sizing:border-box;margin:10px 0 4px;padding:12px 14px;border-radius:14px;border:2px solid #ffd166;background:#06344a;color:#fff;font:700 18px "Noto Sans TC",sans-serif;text-align:center}' +
    '.cw-in.code{letter-spacing:.3em;text-transform:uppercase;font-size:22px}' +
    '.cw-err{color:#ffb4b4;font-size:14px;min-height:20px}' +
    '.cw-row{display:flex;gap:10px;justify-content:center;margin-top:12px;flex-wrap:wrap}' +
    '.cw-row.cw-fl{position:sticky;bottom:-8px;z-index:6;justify-content:flex-start;margin:12px -6px -8px;padding:0 0 8px;pointer-events:none}.cw-row.cw-fl .cw-b{pointer-events:auto;min-width:0;padding:8px 18px;font-size:15px;box-shadow:0 6px 18px rgba(0,0,0,.55)}' +   // 背包、排行榜的關閉：一直浮在左下角
    '.cw-b{min-width:110px;padding:11px 18px;border-radius:999px;border:2px solid #ffd166;background:transparent;color:#fff8e7;font:900 16px "Noto Sans TC",sans-serif;cursor:pointer}' +
    '.cw-b.p{border-color:transparent;background:linear-gradient(135deg,#ffb347,#ff5e62);color:#fff}.cw-b[disabled]{opacity:.6}' +
    '.cw-code{display:inline-block;margin:8px 0;padding:8px 18px;border-radius:14px;background:#06344a;border:2px dashed #ffd166;font:900 30px/1.3 Consolas,monospace;letter-spacing:.25em;color:#ffd166}' +
    '.cw-lb{list-style:none;margin:12px 0 0;padding:0;text-align:left}' +
    '.cw-lb li{display:flex;align-items:center;gap:10px;padding:8px 12px;margin-bottom:6px;border-radius:12px;background:rgba(255,255,255,.06)}' +
    '.cw-lb li.me{background:rgba(255,209,102,.2);outline:1.5px solid #ffd166}' +
    '.cw-lb li[data-sail]{cursor:pointer;transition:background .15s}.cw-lb li[data-sail]:hover{background:rgba(255,255,255,.13)}.cw-lb .go{flex:none;font-size:15px;opacity:.75}' +
    '.cw-lb .r{flex:none;width:30px;font-weight:900;text-align:center}.cw-lb .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cw-lb .c{flex:none;font-weight:900;color:#ffd166}' +
    '.cw-me{margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.15);font-size:15px;color:#ffe2a8}' +
    '.cw-vis{margin:8px 0 12px;padding:9px 12px;border-radius:14px;background:rgba(3,42,60,.55);border:1px solid rgba(255,209,102,.35);color:#fff8e7;font:15px/1.6 "Noto Sans TC",sans-serif}' +
    '.cw-vis b{color:#ffd166}.cw-vis i{display:inline-block;font-style:normal;margin:3px 4px 0 0;padding:1px 9px;border-radius:999px;background:rgba(255,255,255,.1);font-size:14px}.cw-vis i small{opacity:.7;margin-left:4px;font-size:12px}' +
    '.cw-link{background:none;border:0;color:#7fd8ff;text-decoration:underline;cursor:pointer;font:inherit;padding:0 4px}' +
    '.cw-box.wide{max-width:480px}' +
    '.cw-avs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 4px}' +
    '.cw-avs button{font-size:34px;line-height:1;padding:10px 0;border-radius:16px;border:2px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);cursor:pointer}' +
    '.cw-avs button.on{border-color:#ffd166;background:rgba(255,209,102,.22)}' +
    '.cw-tabs{display:flex;gap:6px;justify-content:center;margin:6px 0 2px;flex-wrap:wrap}' +
    '.cw-tabs button{padding:7px 14px;border-radius:999px;border:1.5px solid rgba(255,209,102,.5);background:transparent;color:#fff8e7;font:800 14.5px "Noto Sans TC",sans-serif;cursor:pointer}' +
    '.cw-tabs button.on{background:#ffd166;color:#3a1a08;border-color:#ffd166}' +
    '.cw-lb .lbtg{display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;gap:3px 4px;margin-top:3px;white-space:nowrap}.cw-lb .on,.cw-lb .fr{display:inline-block;padding:0 6px;border-radius:999px;font-size:11.5px;font-weight:700;line-height:1.5}.cw-lb .on{background:rgba(74,222,128,.18);color:#86efac}.cw-lb .fr{background:rgba(196,181,253,.2);color:#ddd6fe}.cw-lb li.frd{box-shadow:inset 3px 0 0 #a78bfa}' +
    '.cw-lb .a{flex:none;font-size:22px;width:28px;text-align:center}.cw-lb .s{display:block;font-size:12px;color:#b9d8e4;font-weight:400}' +
    '.cw-lb .bsl{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;white-space:normal}.cw-lb .bsl i{font-style:normal;padding:1px 8px;border-radius:8px;background:rgba(255,255,255,.09);font-size:12.5px;line-height:1.6;color:#cfe6ef}.cw-lb .bsl b{color:#ffd166;font-weight:700;white-space:nowrap}.cw-lb .bsl u{text-decoration:none;white-space:nowrap}' +
    '.cw-sec{margin-top:14px;padding:12px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,209,102,.25);text-align:left}' +
    '.cw-sec h4{margin:0 0 8px;font-size:16px;color:#ffd166}' +
    '.cw-bag{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;text-align:center}' +
    '.cw-bag div{padding:8px 2px;border-radius:12px;background:rgba(0,0,0,.2)}.cw-bag i{display:block;font-style:normal;font-size:24px}.cw-bag b{display:block;font-size:17px;color:#ffd166}.cw-bag small{margin:0;font-size:11.5px;color:#b9d8e4}' +
    '.cw-trade{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}' +
    '.cw-trade button{padding:8px 6px;border-radius:12px;border:1.5px solid rgba(255,209,102,.45);background:rgba(255,209,102,.08);color:#fff8e7;font:700 13.5px "Noto Sans TC",sans-serif;cursor:pointer}' +
    '.cw-trade button[disabled]{opacity:.45;cursor:default}' +
    '.cw-fid{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.cw-fid b{font:900 20px Consolas,monospace;letter-spacing:.12em;color:#ffd166}' +
    '.cw-mini{padding:5px 12px;border-radius:999px;border:1.5px solid rgba(255,209,102,.6);background:transparent;color:#fff8e7;font:700 13.5px "Noto Sans TC",sans-serif;cursor:pointer}' +
    '.cw-mini.p{background:#ffd166;color:#3a1a08;border-color:#ffd166}.cw-mini[disabled]{opacity:.4;cursor:default}' +
    '.cw-add{display:flex;gap:6px;margin-top:8px}.cw-add input{flex:1;min-width:0;margin:0;padding:8px 10px;font-size:16px;letter-spacing:.12em;text-transform:uppercase}' +
    '.cw-fr{display:flex;flex-direction:column;gap:6px;margin-top:8px}' +
    '.cw-fr>div{padding:9px 10px;border-radius:12px;background:rgba(0,0,0,.2)}' +
    '.cw-fr .h{display:flex;align-items:center;gap:8px}.cw-fr .h i{font-style:normal;font-size:24px}.cw-fr .h b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.cw-fr .d{font-size:13px;color:#b9d8e4;margin:3px 0 6px}.cw-fr .k{display:flex;gap:6px;flex-wrap:wrap}' +
    '.cw-pager{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:10px}.cw-pager small{margin:0;font-size:13px}' +
    '.cw-pwrow{background:rgba(255,209,102,.14);border:1.5px dashed #ffd166;border-radius:12px;padding:8px 12px;word-break:break-all}.cw-pw{font:700 1.05em ui-monospace,Consolas,monospace;background:rgba(0,0,0,.25);padding:2px 8px;border-radius:6px;user-select:all;-webkit-user-select:all}.cw-pwc{margin-left:6px;padding:4px 12px;border-radius:999px;border:0;background:#ffd166;color:#3a1a08;font:700 13.5px "Noto Sans TC",sans-serif;cursor:pointer}' +
    '.cw-note{margin-top:6px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.07);font-size:14px;line-height:1.5}.cw-note small{display:inline;margin:0;font-size:12px}' +
    '.cw-dot{display:inline-block;min-width:18px;padding:0 5px;margin-left:4px;border-radius:999px;background:#ff5e62;color:#fff;font:800 12px/18px sans-serif;text-align:center}' +
    '.cw-ta{width:100%;box-sizing:border-box;min-height:70px;margin:6px 0 2px;padding:8px 10px;border-radius:12px;border:1.5px solid #ffd166;background:#06344a;color:#fff;font:15px/1.5 "Noto Sans TC",sans-serif;resize:vertical}' +
    '.cw-q{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid rgba(255,255,255,.1);text-align:left}.cw-q:first-of-type{border-top:0}' +
    '.cw-q i{font-style:normal;font-size:22px}.cw-q span{flex:1;font-size:15px;line-height:1.5}.cw-q em{font-style:normal;font-size:13px;color:#b9d8e4;white-space:nowrap}.cw-q.got span{opacity:.55;text-decoration:line-through}' +
    '.ann{margin-top:10px;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,209,102,.3);text-align:left}' +
    '.ann.new{border-color:#ffd166;background:rgba(255,209,102,.12)}' +
    '.ann h4{margin:0 0 2px;font-size:17px}.ann h4 em{margin-left:6px;padding:0 7px;border-radius:999px;font-style:normal;font-size:11px;background:#ff5e62;color:#fff}' +
    '.ann small{display:block;margin:0 0 6px;font-size:12.5px;color:#b9d8e4}' +
    '.ann-t{font-size:15px;line-height:1.7;word-break:break-word;overflow-wrap:anywhere}.ann-t a{color:#7fd8ff}' +
    '.ann-k{display:flex;gap:8px;margin-top:8px}.ann-list{max-height:48vh;overflow-y:auto;-webkit-overflow-scrolling:touch;text-align:left;margin-top:8px}';
  function injectCSS() { var st = document.createElement('style'); st.textContent = CSS; (document.head || document.documentElement).appendChild(st); }
  var toastEl, toastT;
  function toast(msg) {
    if (!TOP) { try { window.top.postMessage({ cw: 'toast', msg: msg }, location.origin); return; } catch (e) {} }
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'cw-toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 3400);
  }
  function modal(html, onReady, lock, cls) {
    var ov = document.createElement('div'); ov.className = 'cw-ov';
    ov.innerHTML = '<div class="cw-box' + (cls ? ' ' + cls : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(ov);
    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    ov.addEventListener('click', function (e) { if (e.target === ov && !lock) close(); });
    if (onReady) onReady(ov, close);
    return close;
  }
  var HELP = '<small>忘記登島碼？把你的暱稱傳到 <a href="' + LINE + '" target="_blank" rel="noopener">蘋果爸 LINE 官方帳號</a>，幫你查。</small>';

  /* ---------- 封測邀請碼：網址帶 ?inv=XXXX-XXXX 會自動記起來、自動填入 ---------- */
  try { var uq = new URLSearchParams(location.search).get('inv'); if (uq) localStorage.setItem('aikb-inv', uq.slice(0, 20)); } catch (e) {}
  function savedInv() { try { return localStorage.getItem('aikb-inv') || ''; } catch (e) { return ''; } }
  /* ---------- 登島：取暱稱 / 輸入登島碼 ---------- */
  function welcome(done, mode) {
    var initQa = 0;
    try { var old = JSON.parse(localStorage.getItem('aikb-progress-v1') || 'null'); initQa = old && old.c ? Object.keys(old.c).length : 0; } catch (e) {}
    function regHTML() {
      return '<div class="cw-ic">🏝️</div><h3>歡迎登島！取個暱稱</h3>' +
        '<p>有暱稱才能收集金幣、上排行榜、下載資源。</p>' +
        '<input class="cw-in" maxlength="12" placeholder="例如：圖塊小達人">' +
        '<div class="cw-err"></div>' +
        '<div class="cw-row"><button class="cw-b p" type="button" data-ok>確定</button></div>' +
        '<p style="margin-top:10px">已經有登島碼？<button class="cw-link" type="button" data-sw>輸入登島碼</button></p>' +
        '<p><button class="cw-link" type="button" data-x>👀 我是訪客，先逛逛（可看地圖、讀全部文章）</button></p>' +
        '<small>請不要填真實姓名、電話或 Email。暱稱、金幣與下載紀錄會存到蘋果爸的統計表。</small>';
    }
    function loginHTML() {
      return '<div class="cw-ic">🔑</div><h3>輸入登島碼</h3>' +
        '<p>換手機或電腦時，輸入登島碼就能接回你的暱稱和金幣。</p>' +
        '<input class="cw-in code" maxlength="6" placeholder="6 碼" autocapitalize="characters"><div class="cw-err"></div>' +
        '<div class="cw-row"><button class="cw-b p" type="button" data-ok>登島</button></div>' +
        '<p style="margin-top:10px">還沒有暱稱？<button class="cw-link" type="button" data-sw>取個新暱稱</button></p>' +
        '<p><button class="cw-link" type="button" data-x>先逛逛</button></p>' + HELP;
    }
    modal(mode === 'login' ? loginHTML() : regHTML(), function (ov, close) {
      var inp = ov.querySelector('.cw-in'), err = ov.querySelector('.cw-err'), ok = ov.querySelector('[data-ok]');
      inp.addEventListener('input', function () { err.textContent = ''; });
      var invIn = ov.querySelector('.cw-in.inv');
      if (invIn) {
        invIn.addEventListener('input', function () { err.textContent = ''; });
        invIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      }
      ov.querySelector('[data-sw]').addEventListener('click', function () { close(); welcome(done, mode === 'login' ? 'reg' : 'login'); });
      ov.querySelector('[data-x]').addEventListener('click', function () { close(); if (done) done(false); });
      function submit() {
        var v = inp.value.replace(/\s+/g, mode === 'login' ? '' : ' ').trim();
        if (mode === 'login') { v = v.toUpperCase(); if (v.length !== 6) { err.textContent = '登島碼是 6 個字'; return; } }
        else if (v.length < 2) { err.textContent = ERR.short; return; }
        var inv = invIn ? invIn.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '';
        ok.disabled = true; ok.textContent = '連線中…';
        call(mode === 'login' ? { a: 'login', code: v } : { a: 'reg', nick: v, init: initQa, inv: inv }).then(function (j) {
          ok.disabled = false; ok.textContent = mode === 'login' ? '登島' : '確定';
          if (!j.ok) { err.textContent = ERR[j.err] || ERR.bad; return; }
          try { localStorage.removeItem('aikb-inv'); } catch (e) {}
          guestMode = false; try { sessionStorage.setItem('cw-guest-mode', '0'); } catch (e) {}
          P = blank(); apply(j.p); close();
          if (mode === 'login') { toast('👋 歡迎回來，' + P.nick + '！'); if (done) done(true); }
          else showCode(true, function () { pickAvatar(function () { if (done) done(true); }, true); });
        }).catch(function () { ok.disabled = false; ok.textContent = '再試一次'; err.textContent = '連不上金幣小島，請稍後再試'; });
      }
      ok.addEventListener('click', submit);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      setTimeout(function () { inp.focus(); }, 60);
    }, true);
  }
  function showCode(isNew, done) {
    modal('<div class="cw-ic">🗝️</div><h3>' + (isNew ? '登島成功，' + esc(P.nick) + '！' : '我的登島碼') + '</h3>' +
      '<p>這是你的登島碼，請<b>截圖或抄下來</b>：</p><div class="cw-code">' + esc(P.code) + '</div>' +
      '<p>換手機或電腦時輸入它，就能接回暱稱和金幣。登島碼不要給別人。</p>' +
      '<div class="cw-row"><button class="cw-b p" type="button" data-x>我記下來了</button></div>' + HELP,
      function (ov, close) { ov.querySelector('[data-x]').addEventListener('click', function () { close(); if (done) done(); }); }, isNew);
  }
  function rename() {
    modal('<div class="cw-ic">✏️</div><h3>修改暱稱</h3><input class="cw-in" maxlength="12" value="' + esc(P.nick) + '"><div class="cw-err"></div>' +
      '<div class="cw-row"><button class="cw-b p" type="button" data-ok>確定</button><button class="cw-b" type="button" data-x>取消</button></div>',
      function (ov, close) {
        var inp = ov.querySelector('.cw-in'), err = ov.querySelector('.cw-err'), ok = ov.querySelector('[data-ok]');
        ov.querySelector('[data-x]').addEventListener('click', close);
        ok.addEventListener('click', function () {
          var v = inp.value.replace(/\s+/g, ' ').trim();
          if (v.length < 2) { err.textContent = ERR.short; return; }
          ok.disabled = true;
          call({ a: 'nick', code: P.code, nick: v }).then(function (j) {
            ok.disabled = false;
            if (!j.ok) { err.textContent = ERR[j.err] || ERR.bad; return; }
            apply(j.p); close(); toast('✏️ 暱稱改成「' + P.nick + '」');
          }).catch(function () { ok.disabled = false; err.textContent = '連不上金幣小島，請稍後再試'; });
        });
      });
  }

  /* ---------- 下載扣 1 枚 ---------- */
  var HOST = /(drive\.google\.com\/(file|uc|open)|docs\.google\.com\/uc|(^|\.)box\.com\/s\/|dropbox\.com|db\.tt|mediafire\.com|mega\.nz|1drv\.ms|onedrive\.live\.com|wetransfer\.com|we\.tl)/i;
  var EXT = /\.(zip|rar|7z|dwg|dxf|dwt|pdf|lsp|vlx|fas|arx|dvb|exe|msi|ctb|stb|pat|shx|ttf)(\?|#|$)/i;
  function isDownload(a) {
    if (!a || !a.getAttribute('href')) return false;
    if (a.classList.contains('dl-item') || a.classList.contains('dl-btn') || a.hasAttribute('download') || a.hasAttribute('data-download')) return true;
    if (!a.closest('.content')) return false;
    return HOST.test(a.href) || EXT.test(a.href.split('?')[0]);
  }
  function fileName(a) {
    var n = a.getAttribute('download') || (a.querySelector('.dl-n') && a.querySelector('.dl-n').textContent) ||
      [].map.call(a.children.length ? a.children : [a], function (c) { return c.textContent.trim(); }).filter(Boolean).join(' · ') || a.href;
    return String(n).replace(/^⬇️?\s*下載\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  }
  var EARN_HTML = '<p style="text-align:left;margin-top:12px">賺金幣的方法：<br>📅 每天登島送 3 枚（連續第 2 天 4 枚，第 3 天起每天 5 枚）<br>🎮 打遊戲：每場 150 分送 1 枚、500 分 2 枚、1000 分 3 枚（每款每天最多 8 枚）<br>📖 爬文：每看 2 篇有 7 成機率送 1 枚（每天最多 6 枚）<br>⏱️ 在島上每待 5 分鐘送 1 枚（每天最多 3 枚）<br>💬 翻開一座問答島的 3 張問答卡送 1 枚</p>';
  function noCoin() {
    modal('<div class="cw-ic">🪙</div><h3>金幣不足</h3><p>下載一個資源需要 <b>1 枚金幣</b>，你目前有 <b>' + P.bal + '</b> 枚。</p>' + EARN_HTML +
      '<div class="cw-row"><button class="cw-b p" type="button" data-x>知道了</button></div>',
      function (ov, close) { ov.querySelector('[data-x]').addEventListener('click', close); });
  }
  /* v71：解壓縮密碼（後端在下載成功後才給；記在這台裝置，之後打開文章就直接顯示，可一鍵複製） */
  var PW_TIP = '檔案有解壓縮密碼，下載後會顯示在這裡';
  function pwPage() { var pg = location.pathname.replace(/^.*?\/([^\/]+\/t\d+\/)/, '$1'); if (/\/$/.test(pg)) pg += 'index.html'; return pg; }
  function pwGet() { try { return localStorage.getItem('cw-pw:' + pwPage()) || ''; } catch (e) { return ''; } }
  function pwCopy(pw, btn) {
    function done() { if (btn) { btn.textContent = '✅ 已複製'; setTimeout(function () { btn.textContent = '📋 複製'; }, 1800); } toast('🔑 密碼已複製，解壓縮時貼上就好'); }
    function old() { var t = document.createElement('textarea'); t.value = pw; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('請長按密碼自行複製'); } t.remove(); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(pw).then(done, old); else old();
  }
  function pwBox(pw) { return '🔑 解壓縮密碼：<code class="cw-pw">' + esc(pw) + '</code> <button class="cw-pwc" type="button">📋 複製</button>'; }
  function pwPaint() {
    var pw = pwGet(); if (!pw) return;
    [].forEach.call(document.querySelectorAll('p,li,span'), function (el) {
      if (el.dataset.cwPw || el.children.length > 2 || (el.textContent || '').indexOf(PW_TIP) < 0) return;
      el.dataset.cwPw = '1'; el.classList.add('cw-pwrow'); el.innerHTML = pwBox(pw);
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.cw-pwc'); if (!b) return;
    var c = b.parentNode.querySelector('.cw-pw'); if (c) pwCopy(c.textContent, b);
  });
  function pwShow(pw) {
    try { localStorage.setItem('cw-pw:' + pwPage(), pw); } catch (e) {}
    pwPaint();
    modal('<div class="cw-ic">🔑</div><h3>解壓縮密碼</h3><p class="cw-pwrow" style="font-size:17px">' + pwBox(pw) + '</p><p>解壓縮時貼上這組密碼。之後打開這篇文章也會顯示在文章裡。</p>' +
      '<div class="cw-row"><button class="cw-b" type="button" data-x>關閉</button></div>',
      function (ov, close) { ov.querySelector('[data-x]').addEventListener('click', close); });
  }
  function confirmDownload(a) {
    if (!P.code) { welcome(function (ok) { if (ok) confirmDownload(a); }); return; }
    /* 網址可能是 …/memberb/t30372/ 或 …/memberb/t30372/index.html，兩種都算會員島（免扣金幣） */
    var memberIsland = /\/(memberb|sponsora)\/t[0-9]+\/(index\.html)?$/.test(location.pathname);
    if (!memberIsland && !P.admin && P.bal < 1) { noCoin(); return; }
    var name = fileName(a);
    modal('<div class="cw-ic">📦</div><h3>下載資源</h3><p style="word-break:break-all">' + esc(name) + '</p>' +
      (memberIsland ? '<p>會員島免扣金幣，將記錄下載連結點擊。</p>' : P.admin ? '<p>管理員帳號下載不扣金幣</p>' : '<p>下載會扣 <b>1 枚金幣</b>（目前 <b>' + P.bal + '</b> 枚）</p>') +
      '<div class="cw-row"><button class="cw-b p" type="button" data-ok>' + (memberIsland || P.admin ? '⬇️ 下載' : '🪙 扣 1 枚並下載') + '</button><button class="cw-b" type="button" data-x>取消</button></div>',
      function (ov, close) {
        ov.querySelector('[data-x]').addEventListener('click', close);
        ov.querySelector('[data-ok]').addEventListener('click', function () {
          var external = !a.hasAttribute('download');
          var win = external ? window.open('about:blank', '_blank') : null; // 先在點擊當下開分頁，避免被擋
          close();
          var page = location.pathname.replace(/^.*?\/([^\/]+\/t\d+\/)/, '$1');
          if (/\/$/.test(page)) page += 'index.html';   /* 後端認的是 …/index.html 格式 */
          call({ a: memberIsland ? 'memberdl' : 'dl', code: P.code, page: page, title: (document.title || '').split(' | ')[0], file: name }).then(function (j) {
            if (!j.ok) {
              if (win) win.close();
              if (j.p) apply(j.p);
              if (j.err === 'nocoin') noCoin(); else if (j.err === 'nocode') { logout(); toast('請重新登島'); } else toast(ERR.bad);
              return;
            }
            apply(j.p);
            toast(memberIsland ? '📦 已記錄點擊，請以會員 Google 帳號開啟' : P.admin ? '📦 開始下載' : '📦 已扣 1 枚金幣，開始下載（剩 ' + P.bal + ' 枚）');
            if (win) { try { win.opener = null; } catch (e) {} win.location.href = a.href; }
            else { a.dataset.cwPaid = '1'; a.click(); setTimeout(function () { delete a.dataset.cwPaid; }, 500); }
            if (j.pw) pwShow(j.pw);
          }).catch(function () { if (win) win.close(); netFail(); });
        });
      });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a || a.dataset.cwPaid === '1' || !isDownload(a)) return;
    e.preventDefault(); e.stopPropagation();
    load(); confirmDownload(a);
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pwPaint); else pwPaint();

  /* ---------- 排行榜 ---------- */
  var TABS = [['coin', '🪙 金幣'], ['res', '🧺 物資'], ['dia', '💎 鑽石'], ['isle', '🏝️ 島主'], ['beast', '🐲 神獸']];
  var TAB_NOTE = { beast: '神獸戰力＝小島上每隻神獸的 HP 加總（個體值 IV、等級愈高，種類愈多，戰力愈高）', coin: '依目前金幣排名', res: '依累計採集的物資排名（兌換、送禮不會掉名次）', dia: '依你現在手上有幾顆鑽石排名（拉霸、扭蛋、撿到的都算；換成金幣或送人就會少）', isle: '島主分＝小屋等級×10＋裝飾＋寵物親密度' };
  /* 排行榜快取：三頁一次拿回來，存在這台裝置；打開時先顯示，再背景更新 */
  var TKEY = 'cw-top', TOPC = null, topReq = null;
  try { TOPC = JSON.parse(localStorage.getItem(TKEY) || 'null'); } catch (e) { TOPC = null; }
  function fetchTop() {
    if (topReq) return topReq;
    topReq = call({ a: 'top', k: 'all', code: P.code }).then(function (j) {
      topReq = null;
      if (!j || !j.all) throw new Error('top');
      TOPC = { t: Date.now(), all: j.all, n: j.n != null ? j.n : (TOPC && TOPC.n), on: j.on != null ? j.on : (TOPC && TOPC.on) };
      try { localStorage.setItem(TKEY, JSON.stringify(TOPC)); } catch (e) {}
      return TOPC;
    }, function (e) { topReq = null; throw e; });
    return topReq;
  }
  function openLabel() { return P.open === false ? '🔒 小島只給好友看' : '🔓 小島開放參觀'; }
  function bagTotal() { var b = P.bag || {}; return RES_KEYS.reduce(function (a, k) { return a + (b[k] || 0); }, 0); }
  function bagLine(b) { return RES_KEYS.map(function (k) { return RES[k][0] + ' ' + ((b && b[k]) || 0); }).join('　'); }
  function board(tab) {
    if (!P.code) { welcome(function (ok) { if (ok) board(tab); }); return; }
    tab = tab || 'coin';
    modal('<div class="cw-ic">🏆</div><h3>排行榜</h3>' +
      '<small class="cw-nn" style="display:block;margin:-6px 0 8px;color:#ffd166;font-weight:700"></small>' +
      '<div class="cw-tabs">' + TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<small class="cw-tn" style="margin-top:4px"></small><div class="cw-body"><p>載入中…</p></div>' +
      '<div class="cw-me">' + av(P) + ' 你是 <b>' + esc(P.nick) + '</b>' + (P.admin ? '（管理員，不列入排行）' : '') + '<br>現有：🪙 <b>' + P.bal + '</b>・🧺 ' + bagTotal() + '・💎 ' + (P.dia || 0) + '・連續登島 ' + (P.streak || 0) + ' 天<br>排行榜累計：🧺 ' + (P.tres || 0) + ' 個物資・💎 ' + (P.tdia || 0) + ' 顆鑽石<br>' +
      '<button class="cw-link" type="button" data-bag>🎒 背包與好友</button>・<button class="cw-link" type="button" data-av>換頭像</button>・<button class="cw-link" type="button" data-open>' + openLabel() + '</button>・<button class="cw-link" type="button" data-code>看登島碼</button>・<button class="cw-link" type="button" data-nick>改暱稱</button>・<button class="cw-link" type="button" data-sw>換帳號</button></div>' +
      '<div class="cw-row cw-fl"><button class="cw-b p" type="button" data-x>✕ 關閉</button></div>',
      function (ov, close) {
        ov.querySelector('[data-x]').addEventListener('click', close);
        ov.querySelector('[data-bag]').addEventListener('click', function () { close(); bag(); });
        ov.querySelector('[data-av]').addEventListener('click', function () { close(); pickAvatar(); });
        var ob = ov.querySelector('[data-open]');
        ob.addEventListener('click', function () {
          ob.disabled = true;
          api({ a: 'setopen', o: P.open === false ? 1 : 0 }).then(function (j) {
            ob.disabled = false; ob.textContent = openLabel();
            if (j.ok) toast(P.open === false ? '🔒 現在只有好友能參觀你的小島' : '🔓 已開放別人參觀你的小島'); else toast('⚠️ ' + errText(j));
          }).catch(function () { ob.disabled = false; netFail(); });
        });
        ov.querySelector('[data-code]').addEventListener('click', function () { close(); showCode(false); });
        ov.querySelector('[data-nick]').addEventListener('click', function () { close(); rename(); });
        ov.querySelector('[data-sw]').addEventListener('click', function () { close(); welcome(function (ok) { if (ok) daily(); }, 'login'); });
        var body = ov.querySelector('.cw-body'), cur = tab;
        function paint(k) {
          var nn = ov.querySelector('.cw-nn'); // 登島船長總人數（沒有數字就不顯示）
          if (nn) nn.textContent = TOPC && TOPC.n != null ? (TOPC.on != null ? '🟢 現在 ' + TOPC.on + ' 位在線・' : '') + '⚓ 共 ' + TOPC.n + ' 位船長' : '';
          var rows = TOPC && TOPC.all && TOPC.all[k];
          if (!rows) { body.innerHTML = '<p>載入中…</p>'; return; }
          if (!rows.length) { body.innerHTML = '<p>' + (k === 'coin' ? '還沒有人上榜，你來當第一名！' : k === 'isle' ? '還沒有人蓋小島，去我的小島蓋一間小屋吧！' : k === 'beast' ? '還沒有人擁有神獸，去神獸試煉島合成第一隻吧！' : '還沒有人上榜，去物資島採集吧！') + '</p>'; return; }
          body.innerHTML = '<ol class="cw-lb">' + rows.map(function (r, i) {
            var v = k === 'res' ? '🧺 ' + r.v : k === 'dia' ? '💎 ' + r.v : k === 'isle' ? '🏝️ ' + r.v : k === 'beast' ? '⚔️ ' + r.v : '🪙 ' + r.v;
            var go = r.fid && window.ISLE_VISIT, sail = go ? '<span class="go" aria-hidden="true">⛵</span>' : '';   // 整列可點：航向他的小島參觀
            var isFr = r.fid && (P.fl || []).indexOf(String(r.fid)) >= 0, tg = (isFr ? '<span class="fr">👥 好友</span>' : '') + (r.on ? '<span class="on">🟢 在線</span>' : '');   // 標記放在名字下方一行，名字不會被擠掉
            return '<li class="' + (r.nick === P.nick ? 'me' : '') + (isFr ? ' frd' : '') + '"' + (go ? ' data-sail="' + esc(r.fid) + '" data-n="' + esc(r.nick) + '" role="button" tabindex="0"' : '') + '><span class="r">' + (['🥇', '🥈', '🥉'][i] || (i + 1)) + '</span><span class="a">' + av(r) + '</span><span class="n">' + esc(r.nick) + (tg ? '<span class="lbtg">' + tg + '</span>' : '') +
              (k === 'res' ? '<span class="s">' + bagLine(r.bag) + '</span>' : '') + (k === 'beast' && r.bs ? '<span class="bsl">' + r.bs.map(function (b) { return '<i><u>' + ({ dragon: '🐉 水靈龍', phoenix: '🔥 火鳳凰', qilin: '🦌 木麒麟', tiger: '🐯 金白虎', tortoise: '🐢 土靈龜' }[b.k] || '🐲 神獸') + '</u> <u>IV' + b.iv + '・Lv' + b.lv + '</u>' + (b.hp != null ? ' <b>HP ' + b.hp + '</b>' : '') + '</i>'; }).join('') + '</span>' : '') + '</span><span class="c">' + v + '</span>' + sail + '</li>';
          }).join('') + '</ol>';
        }
        function show(k) {
          cur = k;
          [].forEach.call(ov.querySelectorAll('[data-tab]'), function (b) { b.classList.toggle('on', b.dataset.tab === k); });
          ov.querySelector('.cw-tn').textContent = TAB_NOTE[k];
          paint(k);
        }
        ov.addEventListener('click', function (e) {
          var b = e.target.closest('[data-tab]'); if (b) { show(b.dataset.tab); return; }
          var sl = e.target.closest('[data-sail]'); if (sl) { close(); if (sl.dataset.sail === P.fid) location.hash = '#mine'; else window.ISLE_VISIT(sl.dataset.sail, sl.dataset.n, cur); }
        });
        show(tab);
        // 先顯示上次存的名單，背景再更新成最新的
        fetchTop().then(function () { if (ov.parentNode) paint(cur); })
          .catch(function () { if (ov.parentNode && !(TOPC && TOPC.all)) body.innerHTML = '<p>排行榜暫時連不上，稍後再試。</p>'; });
      });
  }

  /* ---------- 動物頭像 ---------- */
  function pickAvatar(done, isNew) {
    if (!P.code) { welcome(function (ok) { if (ok) pickAvatar(done); }); return; }
    modal('<div class="cw-ic">' + av(P) + '</div><h3>' + (isNew ? '選一個動物頭像' : '換頭像') + '</h3><p>頭像會出現在排行榜、留言碼頭和好友名單。</p>' +
      '<div class="cw-avs">' + AVATARS.map(function (a) { return '<button type="button" data-a="' + a + '" class="' + (a === P.av ? 'on' : '') + '" aria-label="頭像 ' + a + '">' + a + '</button>'; }).join('') + '</div><div class="cw-err"></div>' +
      '<div class="cw-row"><button class="cw-b" type="button" data-x>' + (isNew ? '之後再選' : '取消') + '</button></div>',
      function (ov, close) {
        var err = ov.querySelector('.cw-err'), busy = false;
        ov.querySelector('[data-x]').addEventListener('click', function () { close(); if (done) done(); });
        ov.querySelector('.cw-avs').addEventListener('click', function (e) {
          var b = e.target.closest('[data-a]'); if (!b || busy) return;
          busy = true; err.textContent = '儲存中…';
          api({ a: 'avatar', av: b.dataset.a }).then(function (j) {
            busy = false;
            if (!j.ok) { err.textContent = errText(j); return; }
            close(); toast(P.av + ' 頭像換好了！'); if (done) done();
          }).catch(function () { busy = false; err.textContent = '連不上金幣小島，請稍後再試'; });
        });
      }, !!isNew);
  }

  /* ---------- 背包：物資、兌換所、海島編號、好友、悄悄話 ---------- */
  function copy(s, msg) {
    function fb() { var ta = document.createElement('textarea'); ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); toast(msg); }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(s).then(function () { toast(msg); }, fb); else fb();
  }
  var INBOX_MEM = null;   /* 上次抓到的悄悄話：再開背包時先秀這份，背景再更新 */
  /* 好友清單：記在這台裝置（依登島碼），打開背包先秀出來，背景再更新；登島後也會先在背景抓一次 */
  var FR_MEM = null;
  function frLoad() { if (FR_MEM && FR_MEM.c === P.code) return FR_MEM.l; try { var o = JSON.parse(localStorage.getItem('cw-fr') || 'null'); return o && P.code && o.c === P.code && Array.isArray(o.l) ? (FR_MEM = o).l : null; } catch (e) { return null; } }
  function frSave(l) { if (!Array.isArray(l) || !P.code) return; FR_MEM = { c: P.code, l: l }; try { localStorage.setItem('cw-fr', JSON.stringify(FR_MEM)); } catch (e) {} }
  function frFetch() { var c0 = P.code; return api({ a: 'friends' }).then(function (j) { if (j && j.ok && j.friends && P.code === c0) frSave(j.friends); return j; }); }
  function bag(focus) {
    if (!P.code) { welcome(function (ok) { if (ok) bag(focus); }); return; }
    modal('<div class="cw-ic">🎒</div><h3>' + av(P) + ' ' + esc(P.nick) + ' 的背包</h3><div data-box></div>' +
      '<div class="cw-row cw-fl"><button class="cw-b p" type="button" data-x>✕ 關閉</button></div>',
      function (ov, close) {
        var box = ov.querySelector('[data-box]'), FR = frLoad(), INBOX = INBOX_MEM, inboxFail = false, open = {}, inPg = 0, rOpen = -1;
        ov.querySelector('[data-x]').addEventListener('click', close);
        function questHTML() {
          var qs = P.qs || [];
          if (!qs.length) return '';
          var left = qs.filter(function (x) { return !x.got; }).length;
          return '<div class="cw-sec"><h4>📋 今日任務<small style="display:inline;margin-left:6px">完成一個領 ' + (P.qCoin || 1) + ' 🪙・還有 ' + left + ' 個</small></h4>' +
            qs.map(function (q) {
              return '<div class="cw-q' + (q.got ? ' got' : '') + '"><i>' + q.e + '</i><span>' + esc(q.t) + '</span>' +
                (q.got ? '<em>✅ 已領</em>' : q.ok ? '<button class="cw-mini p" type="button" data-qclaim="' + esc(q.id) + '">領 ' + (P.qCoin || 1) + ' 🪙</button>' : '<em>進行中</em>') + '</div>';
            }).join('') + '<small>每天 0 點換新的任務。去地圖上走走、採集、留言、拜訪，就會慢慢完成。</small></div>';
        }
        function paint() {
          var b = P.bag || {}, left = Math.max(0, (P.tradeMax || 3) - (P.trades || 0)), dleft = Math.max(0, (P.diaSellMax || 3) - (P.diaSells || 0));
          var h = questHTML() + (P.earned >= 5 ? '<div class="cw-sec"><h4>🎁 提示詞禮物包</h4><small style="margin-bottom:8px">累積拿滿 5 枚金幣就能領；<b>領取要花 5 枚金幣</b>，領一次之後可以免費重複查看。</small><button class="cw-b p" type="button" data-giftpack>🎁 領取禮物包（5 枚金幣）</button></div>' : '') + '<div class="cw-sec"><h4>🧺 我的物資</h4><div class="cw-bag">' +
            RES_KEYS.map(function (k) { return '<div><i>' + RES[k][0] + '</i><b>' + (b[k] || 0) + '</b><small>' + RES[k][1] + '</small></div>'; }).join('') +
            '<div><i>💎</i><b>' + (P.dia || 0) + '</b><small>鑽石</small></div></div>' +
            '<small style="margin-top:6px">🥕 ' + ((P.veg || {}).carrot || 0) + '　🥬 ' + ((P.veg || {}).cabbage || 0) + '　🎃 ' + ((P.veg || {}).pumpkin || 0) + '（菜園收成，用來餵寵物）</small>' +
            '<small>累計採集 ' + (P.tres || 0) + ' 個物資、撿到 ' + (P.tdia || 0) + ' 顆鑽石。去地圖上的礦山島、森林島、採石島採集；水果可以在扭蛋島抽、商店島買。</small></div>';
          h += '<div class="cw-sec"><h4>🏪 兌換所<small style="display:inline;margin-left:6px">物資今天還能換 ' + left + ' 次・💎 還能換 ' + dleft + ' 次</small></h4><div class="cw-trade">' +
            RES_KEYS.map(function (k) { return '<button type="button" data-trade="' + k + '"' + (left && (b[k] || 0) >= 10 ? '' : ' disabled') + '>10 ' + RES[k][0] + ' → 1 🪙</button>'; }).join('') +
            '<button type="button" data-trade="dia"' + (dleft && (P.dia || 0) >= 1 ? '' : ' disabled') + '>1 💎 → 10 🪙</button>' +
            '<button type="button" data-trade="pumpkin"' + (left && ((P.veg || {}).pumpkin || 0) >= 5 ? '' : ' disabled') + '>5 🎃 → 1 🪙</button></div></div>';
          h += '<div class="cw-sec"><h4>🪪 我的海島編號</h4><div class="cw-fid"><b>#' + esc(P.fid || '……') + '</b>' + (P.fid ? '<button class="cw-mini" type="button" data-copyfid>複製</button>' : '') + '</div>' +
            '<small>把海島編號給朋友，對方在這裡輸入就能互加好友。登島碼是你的鑰匙，不要給別人。</small>' +
            '<div class="cw-add"><input class="cw-in" maxlength="6" placeholder="輸入好友的海島編號" autocapitalize="characters" data-fidin><button class="cw-mini p" type="button" data-fadd>加好友</button></div><div class="cw-err" data-ferr></div></div>';
          if (P.bin && P.bin.length) h += '<div class="cw-sec"><h4>🐲 待接收的神獸<span class="cw-dot">' + P.bin.length + '</span></h4>' + binHTML() + '</div>';   /* v78 */
          h += '<div class="cw-sec"><h4>👥 好友' + (FR ? '（' + FR.length + '）' : '') + '</h4>' + friendsHTML() + '</div>';
          h += '<div class="cw-sec"><h4>✉️ 悄悄話' + (P.unread ? '<span class="cw-dot">' + P.unread + '</span>' : '') + '</h4>' + inboxHTML() + '</div>';
          var keep = ov.querySelector('[data-fidin]'), kv = keep ? keep.value : '', rk = ov.querySelector('[data-rt]'), rv = rk ? rk.value : '';
          box.innerHTML = h;
          if (kv) ov.querySelector('[data-fidin]').value = kv;
          var rk2 = ov.querySelector('[data-rt]'); if (rk2 && rv) rk2.value = rv;   // 重畫時保留正在打的回覆
        }
        function friendsHTML() {
          if (!FR) return '<small>載入中…</small>';
          if (!FR.length) return '<small>還沒有好友。把你的海島編號分享給朋友，或輸入朋友的海島編號。</small>';
          return '<div class="cw-fr">' + FR.map(function (f) {
            var o = open[f.fid] || '';
            return '<div><div class="h"><i>' + av(f) + '</i><b>' + esc(f.nick) + '</b><small style="margin:0">#' + esc(f.fid) + '</small></div>' +
              '<div class="d">🪙 ' + f.bal + '　' + bagLine(f.bag) + '　💎 ' + f.dia + (f.seen ? '・最近上島 ' + esc(f.seen) : '') + '</div>' +
              '<div class="k">' + (f.gifted ? '<span class="cw-mini" style="opacity:.6;cursor:default">🎁 今天送過了</span>' : '<button class="cw-mini" type="button" data-op="gift" data-f="' + esc(f.fid) + '">🎁 送禮</button>') +
              (window.ISLE_VISIT ? '<button class="cw-mini" type="button" data-visit="' + esc(f.fid) + '">🏝️ 參觀</button>' : '') +
              '<button class="cw-mini" type="button" data-op="note" data-f="' + esc(f.fid) + '">✉️ 悄悄話</button><button class="cw-mini" type="button" data-fdel="' + esc(f.fid) + '" data-n="' + esc(f.nick) + '">移除</button></div>' +
              (o === 'gift' ? '<div class="k" style="margin-top:6px">' + RES_KEYS.map(function (k) { return '<button class="cw-mini p" type="button" data-gift="' + k + '" data-f="' + esc(f.fid) + '"' + '>' + RES[k][0] + ' 送 5 個</button>'; }).join('') + '</div><small>每天可以送每位好友 5 個物資（從你的背包扣）。</small>' + beastGiftHTML(f.fid) : '') +
              (o === 'note' ? '<textarea class="cw-ta" maxlength="100" placeholder="寫給 ' + esc(f.nick) + ' 的悄悄話（100 字內）" data-nt="' + esc(f.fid) + '"></textarea><button class="cw-mini p" type="button" data-send="' + esc(f.fid) + '">送出</button>' : '') +
              '</div>';
          }).join('') + '</div>';
        }
        /* 神獸收藏（重複抽到的）可以送給好友；不算每天送禮次數，互送就是交換 */
        var BNAME = { dragon: ['🐉', '水靈龍'], phoenix: ['🔥', '火鳳凰'], qilin: ['🦌', '木麒麟'], tiger: ['🐯', '金白虎'], tortoise: ['🐢', '土靈龜'] };
        /* v78 好友送的神獸要自己接受：住進小島或收藏起來，也可以婉拒（退回）；都不會讓試煉島變難 */
        function binHTML() {
          return (P.bin || []).map(function (g) {
            var bn = BNAME[g.k] || ['🐲', g.k], days = Math.max(1, Math.ceil((g.left || 0) / 86400000));
            return '<div style="padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.07);margin-bottom:8px"><div><b>' + bn[0] + ' ' + bn[1] + '</b> <small style="display:inline">IV ' + g.iv + '・來自 ' + esc(g.nick || '好友') + '・' + days + ' 天內要決定</small></div>' +
              '<div class="k" style="margin-top:6px"><button class="cw-mini p" type="button" data-bin="' + esc(g.id) + '" data-do="pet">🏝️ 住進小島</button>' +
              '<button class="cw-mini p" type="button" data-bin="' + esc(g.id) + '" data-do="bag">📦 收藏起來</button>' +
              '<button class="cw-mini" type="button" data-bin="' + esc(g.id) + '" data-do="no">↩️ 婉拒</button></div></div>';
          }).join('') + '<small>住進小島時，如果島上已經有同一種，原本那隻會放進收藏。收下好友送的神獸不會讓試煉島變難。</small>';
        }
        function beastGiftHTML(fid) {
          var bb = P.bbag || {}, ks = Object.keys(bb).filter(function (k) { return bb[k] > 0 && BNAME[k]; });
          if (!ks.length) return '';
          return '<div class="k" style="margin-top:6px">' + ks.map(function (k) { return '<button class="cw-mini p" type="button" data-bgift="' + k + '" data-f="' + esc(fid) + '">' + BNAME[k][0] + ' 送' + BNAME[k][1] + '（收藏 ' + bb[k] + '）</button>'; }).join('') + '</div><small>🐲 神獸收藏可以送給好友：對方會收到通知，自己選住進小島或收藏起來（7 天內沒回應會退回）。互送就是交換。</small>';
        }
        function inboxHTML() {
          if (!INBOX) return inboxFail ? '<button class="cw-mini" type="button" data-inbox>打開收件匣</button>' : '<small>載入中…</small>';
          if (!INBOX.length) return '<small>還沒有人傳悄悄話給你。</small>';
          var IN_PER = 5, pages = Math.ceil(INBOX.length / IN_PER); if (inPg >= pages) inPg = pages - 1; if (inPg < 0) inPg = 0;   /* 悄悄話 5 則一頁 */
          return INBOX.slice(inPg * IN_PER, inPg * IN_PER + IN_PER).map(function (n, i) {
            var ix = inPg * IN_PER + i, isFr = n.fid && (P.fl || []).indexOf(String(n.fid)) >= 0, dock = String(n.text || '').indexOf('📮 回覆了你的留言：') === 0;
            /* v77 每則悄悄話可以直接回覆（對方要是好友；就是寄一則悄悄話給他） */
            var btns = (dock ? '<button class="cw-mini" type="button" data-msgdock>📮 前往留言碼頭</button>' : '') + (isFr ? '<button class="cw-mini" type="button" data-rp="' + ix + '">↩️ 回覆</button>' : '');
            return '<div class="cw-note">' + av(n) + ' <b>' + esc(n.nick) + '</b> <small>' + esc(n.t) + '</small><br>' + linkify(n.text) + (btns ? '<div class="k" style="margin-top:6px">' + btns + '</div>' : '') +
              (rOpen === ix && isFr ? '<textarea class="cw-ta" maxlength="98" placeholder="回覆 ' + esc(n.nick) + '（100 字內）" data-rt="' + ix + '"></textarea><button class="cw-mini p" type="button" data-rsend="' + ix + '">送出回覆</button>' : '') + '</div>';
          }).join('') + (pages > 1 ? '<div class="cw-pager"><button class="cw-mini" type="button" data-inpg="-1"' + (inPg ? '' : ' disabled') + '>‹ 上一頁</button><small>' + (inPg + 1) + ' / ' + pages + '</small><button class="cw-mini" type="button" data-inpg="1"' + (inPg < pages - 1 ? '' : ' disabled') + '>下一頁 ›</button></div>' : '');
        }
        function busy(btn) { if (btn) { btn.disabled = true; btn.textContent = '…'; } }
        function fail(j) { toast('⚠️ ' + errText(j)); paint(); }
        function loadInbox() { api({ a: 'inbox' }).then(function (j) { INBOX = INBOX_MEM = (j && j.inbox) || []; inboxFail = false; paint(); }).catch(function () { inboxFail = true; if (!INBOX) paint(); }); }
        ov.addEventListener('click', function (e) {
          var t = e.target.closest('button'); if (!t || !box.contains(t)) return;
          var d = t.dataset;
          if (d.inpg != null) { inPg += +d.inpg; paint(); var pg = ov.querySelector('.cw-pager'), nt = pg && pg.parentNode.querySelector('.cw-note'); if (nt) nt.scrollIntoView({ block: 'nearest' }); return; }
          if (d.msgdock != null) { close(); if (location.hash !== '#msg') location.hash = '#msg'; else window.dispatchEvent(new Event('hashchange')); }
          else if (d.qclaim) {
            busy(t);
            api({ a: 'qclaim', id: d.qclaim }).then(function (j) {
              if (!j.ok) return fail(j);
              toast('📋 任務完成！領到 ' + (j.add || 1) + ' 枚金幣'); paint();
            }).catch(function () { netFail(); paint(); });
          } else if (d.trade) {
            busy(t);
            api({ a: 'trade', k: d.trade }).then(function (j) {
              if (!j.ok) return fail(j);
              toast('🏪 換到 ' + j.add + ' 枚金幣！'); paint();
              if (window.TRADE_FX) { var tg = d.trade === 'dia' ? ['💎', 1] : d.trade === 'pumpkin' ? ['🎃', 5] : [RES[d.trade][0], 10]; window.TRADE_FX([tg], [['🪙', j.add]], d.trade === 'dia'); }
            }).catch(function () { netFail(); paint(); });
          } else if (d.visit) { close(); window.ISLE_VISIT(d.visit, '', 'bag'); }   // 參觀頁會出現「🎒 返回我的背包」
          else if (d.giftpack != null) { close(); if (window.COINS && window.COINS.giftOpen) window.COINS.giftOpen(function () { bag(); }); }
          else if (d.copyfid != null) copy('#' + P.fid, '🪪 已複製海島編號 #' + P.fid);
          else if (d.fadd != null) {
            var inp = ov.querySelector('[data-fidin]'), v = inp.value.replace(/[^0-9a-z]/gi, '').toUpperCase(), fe = ov.querySelector('[data-ferr]');
            if (v.length !== 5) { fe.textContent = '海島編號是 5 個字'; return; }
            busy(t);
            api({ a: 'fadd', fid: v }).then(function (j) {
              if (!j.ok) { paint(); ov.querySelector('[data-ferr]').textContent = errText(j); return; }
              FR = j.friends || FR; frSave(FR); ov.querySelector('[data-fidin]').value = ''; paint();
              toast('👥 和 ' + j.added.nick + ' 成為好友了！');
            }).catch(function () { netFail(); paint(); });
          } else if (d.fdel) {
            if (!confirm('要把「' + d.n + '」從好友移除嗎？')) return;
            busy(t);
            api({ a: 'fdel', fid: d.fdel }).then(function (j) { if (j.ok) { FR = j.friends; frSave(FR); } paint(); }).catch(function () { netFail(); paint(); });
          } else if (d.op) { open[d.f] = open[d.f] === d.op ? '' : d.op; paint(); var ta = ov.querySelector('[data-nt="' + d.f + '"]'); if (ta) ta.focus(); }
          else if (d.bin) {
            var bdo = d.do;
            if (bdo === 'no' && !confirm('要婉拒這隻神獸嗎？牠會退回給送的人。')) return;
            busy(t);
            api({ a: 'bin', id: d.bin, do: bdo }).then(function (j) {
              if (!j.ok) return fail(j);
              var bi = j.bin || {}, bn2 = BNAME[bi.k] || ['🐲', bi.name || ''];
              paint();
              toast(bdo === 'no' ? '↩️ 已婉拒，' + bn2[1] + '退回給好友了' : bdo === 'bag' ? '📦 ' + bn2[1] + '放進神獸收藏了' : bi.to === 'swap' ? '🏝️ ' + bn2[1] + '住進小島了，原本那隻放進收藏' : '🏝️ ' + bn2[1] + '住進你的小島了！');
            }).catch(function () { netFail(); paint(); });
          }
          else if (d.bgift) {
            var bk = d.bgift, bf = d.f, bn = BNAME[bk] || ['🐲', ''];
            busy(t);
            api({ a: 'bgift', fid: bf, k: bk }).then(function (j) {
              if (!j.ok) return fail(j);
              FR = j.friends || FR; frSave(FR); open[bf] = ''; paint();
              toast('🐲 已把' + bn[1] + '送出，等好友接受（7 天內沒回應會退回你的收藏）');
            }).catch(function () { netFail(); paint(); });
          }
          else if (d.gift) {
            if (((P.bag || {})[d.gift] || 0) < 5) { toast('⚠️ ' + RES[d.gift][1] + '不足 5 個，無法送禮'); return; }
            /* 先在畫面上扣掉、標成「今天送過了」並提示成功；伺服器說不行再復原 */
            var gk = d.gift, gf = d.f, bagBak = P.bag ? JSON.parse(JSON.stringify(P.bag)) : null, fo = (FR || []).filter(function (x) { return x.fid === gf; })[0], gBak = fo ? fo.gifted : false;
            if (P.bag) P.bag[gk] = Math.max(0, (P.bag[gk] || 0) - 5);
            if (fo) fo.gifted = true;
            open[gf] = ''; paint(); toast('🎁 送出 5 個' + RES[gk][1] + '！');
            function undo(msg) { if (bagBak) P.bag = bagBak; if (fo) fo.gifted = gBak; paint(); toast(msg); }
            api({ a: 'gift', fid: gf, k: gk }).then(function (j) {
              if (!j.ok) return undo('⚠️ 送禮沒成功：' + errText(j));
              FR = j.friends || FR; frSave(FR); paint();
            }).catch(function () { undo('⚠️ 暫時連不上金幣小島，這次送禮沒有送出，請再試一次'); });
          } else if (d.send) {
            var tx = ov.querySelector('[data-nt="' + d.send + '"]'), msg = tx ? tx.value.trim() : '';
            if (!msg) { if (tx) tx.focus(); return; }
            busy(t);
            api({ a: 'note', fid: d.send, text: msg }, true).then(function (j) {
              if (!j.ok) return fail(j);
              open[d.send] = ''; paint(); toast('✉️ 悄悄話送出了');
            }).catch(function () { netFail(); paint(); });
          } else if (d.inbox != null) { busy(t); inboxFail = false; loadInbox(); }
          else if (d.rp != null) { var ri = +d.rp; rOpen = rOpen === ri ? -1 : ri; paint(); var rta = ov.querySelector('[data-rt]'); if (rta) rta.focus(); }
          else if (d.rsend != null) {
            var rn = INBOX && INBOX[+d.rsend], rta2 = ov.querySelector('[data-rt]'), rmsg = rta2 ? rta2.value.trim() : '';
            if (!rn) return;
            if (!rmsg) { if (rta2) rta2.focus(); return; }
            busy(t);
            api({ a: 'note', fid: rn.fid, text: '↩️ ' + rmsg }, true).then(function (j) {
              if (!j.ok) return fail(j);
              rOpen = -1; paint(); toast('↩️ 已回覆 ' + rn.nick);
            }).catch(function () { netFail(); paint(); });
          }
        });
        INBOX_LIVE = function () { if (!ov.parentNode) { INBOX_LIVE = null; return; } if (rOpen < 0) loadInbox(); };   // 背包開著收到新悄悄話就刷新（正在打回覆時不打斷）
        paint();
        var frScrolled = false;
        function frScroll() { if (focus !== 'friends' || frScrolled || !FR) return; var s = [].filter.call(ov.querySelectorAll('.cw-sec'), function (x) { var h = x.querySelector('h4'); return h && h.textContent.indexOf('好友') >= 0; })[0]; if (s) { s.scrollIntoView(); frScrolled = true; } }
        frScroll();
        frFetch().then(function (j) { if (j && j.friends) FR = j.friends; else if (!FR) FR = []; if (!ov.parentNode) return; var bx = ov.querySelector('.cw-box'), y = bx ? bx.scrollTop : 0; paint(); if (bx && frScrolled) bx.scrollTop = y; frScroll(); }).catch(function () { FR = FR || []; if (ov.parentNode) paint(); });
        loadInbox();   /* 一打開背包就在背景抓悄悄話，不用再按「打開收件匣」等它 */
      }, false, 'wide');
  }

  /* 文字裡的網址變成可點的連結（先跳脫，再找網址） */
  function linkify(s) {
    return esc(s).replace(/(https?:\/\/|www\.)[^\s<>"'，。、！？；：）」』】]+/gi, function (u) {
      var tail = '';
      while (/[.,;:!?)\]]$/.test(u)) { tail = u.slice(-1) + tail; u = u.slice(0, -1); }
      var href = /^www\./i.test(u) ? 'https://' + u : u;
      return '<a href="' + href + '" target="_blank" rel="noopener nofollow ugc">' + u + '</a>' + tail;
    }).replace(/\n/g, '<br>');
  }

  /* ---------- 小島造訪紀錄：先秀上次看到的、背景更新；「我來過」改成背景記錄，不讓畫面等 ---------- */
  var VKEY = 'cw-vis', VIS = { t: 0, vs: null }, visReq = null;
  try { var vc = JSON.parse(localStorage.getItem(VKEY) || 'null'); if (vc && vc.vs) VIS = { t: 0, vs: vc.vs }; } catch (e) {}
  function loadVisAll() {
    if (visReq) return visReq;
    visReq = call({ a: 'visall' }).then(function (j) {
      visReq = null;
      if (!j || !j.ok || !j.vs) throw new Error('visall');
      VIS = { t: Date.now(), vs: j.vs };
      try { localStorage.setItem(VKEY, JSON.stringify({ vs: j.vs })); } catch (e) {}
      return VIS.vs;
    }, function (e) { visReq = null; throw e; });
    return visReq;
  }
  function paintVis(el, v) {
    if (!el || !el.isConnected) return;
    if (!v || !v.total) { el.innerHTML = '👣 還沒有人留下足跡，' + (P.code ? '你是第一位登島的船長！' : '取個暱稱，當第一位登島的船長！'); return; }
    el.innerHTML = '👣 <b>' + v.total + '</b> 位船長造訪過・最近登島：<br>' +
      v.list.map(function (x) { return '<i>' + esc(x.nick) + '<small>' + esc(x.d) + '</small></i>'; }).join('');
  }
  function visitedToday(isle) {
    try { var o = JSON.parse(localStorage.getItem('cw-visd') || 'null'); return !!(o && o.d === today() && o.c === P.code && o.i.indexOf(isle) >= 0); } catch (e) { return false; }
  }
  function markVisited(isle) {
    try {
      var o = JSON.parse(localStorage.getItem('cw-visd') || 'null');
      if (!o || o.d !== today() || o.c !== P.code) o = { d: today(), c: P.code, i: [] };
      if (o.i.indexOf(isle) < 0) o.i.push(isle);
      localStorage.setItem('cw-visd', JSON.stringify(o));
    } catch (e) {}
  }
  function visit(isle, name, el) {
    if (!el) return;
    el.className = 'cw-vis';
    if (VIS.vs) paintVis(el, VIS.vs[isle]); else el.innerHTML = '👣 載入造訪紀錄…';
    if (!(VIS.vs && VIS.t && Date.now() - VIS.t < 90000)) {
      loadVisAll().then(function (vs) { paintVis(el, vs[isle]); }).catch(function () {
        // 舊版後台沒有 visall：退回單座島查詢
        call({ a: 'visitors', isle: isle }).then(function (j) { paintVis(el, j && j.v); })
          .catch(function () { if (!VIS.vs && el.isConnected) el.innerHTML = '👣 造訪紀錄暫時連不上'; });
      });
    }
    if (P.code && !visitedToday(isle)) {
      call({ a: 'visit', code: P.code, isle: isle, name: name }).then(function (j) {
        if (j && j.p) apply(j.p);
        if (j && j.ok !== false) { markVisited(isle); if (j.v) { if (VIS.vs) VIS.vs[isle] = j.v; paintVis(el, j.v); } }
      }).catch(function () {});
    }
  }

  /* ---------- 公告：站長發布，大家登島時收到通知 ---------- */
  var ANN = { list: [], max: 0 }, ANN_KEY = 'cw-ann-seen', ANN_CACHE = 'cw-ann-cache';
  try { var ac = JSON.parse(localStorage.getItem(ANN_CACHE) || 'null'); if (ac && Array.isArray(ac.list)) { ANN.list = ac.list; ANN.max = ac.max || 0; } } catch (e) {} // 上次的公告先放著，點開馬上看得到
  function annSeen() {
    var s = P.code ? (+P.annSeen || 0) : 0;
    try { s = Math.max(s, +localStorage.getItem(ANN_KEY) || 0); } catch (e) {}
    return s;
  }
  function annUnread() { var s = annSeen(); return ANN.list.filter(function (a) { return a.id > s; }); }
  function annDot() {
    var d = document.getElementById('annDot'); if (!d) return;
    var n = annUnread().length; d.hidden = !n; d.textContent = n;
  }
  function annLoad() {
    return call({ a: 'anns' }).then(function (j) {
      if (j && j.ok) { ANN.list = j.list || []; ANN.max = j.max || 0; annDot(); try { localStorage.setItem(ANN_CACHE, JSON.stringify({ list: ANN.list, max: ANN.max })); } catch (e) {} }
      return ANN;
    });
  }
  function annMark() {
    try { localStorage.setItem(ANN_KEY, String(ANN.max)); } catch (e) {}
    if (P.code && (+P.annSeen || 0) < ANN.max) api({ a: 'annread', seq: ANN.max }).catch(function () {});
    annDot();
  }
  function annItem(a, isNew, edit) {
    return '<article class="ann' + (isNew ? ' new' : '') + '"><h4>' + esc(a.title) + (isNew ? '<em>新</em>' : '') + '</h4><small>' + esc(a.t) + '・' + esc(a.by) + (a.re ? '・已編輯 ' + esc(a.re) : '') + '</small><div class="ann-t">' + linkify(a.text) + '</div>' +
      (edit ? '<div class="ann-k"><button class="cw-mini" type="button" data-aedit="' + a.id + '">✏️ 編輯</button><button class="cw-mini" type="button" data-adel="' + a.id + '">🗑️ 刪除</button></div>' : '') + '</article>';
  }
  function annShow(popup) {
    var seen = annSeen(), list = popup ? annUnread().slice(0, 5) : ANN.list, canPost = !!(P.code && P.ann);
    if (!popup && list.length) annMark(); // 打開公告清單就算看過
    return modal('<div class="cw-ic">📢</div><h3>' + (popup ? '站長公告' : '公告') + '</h3><div class="ann-list">' +
      (list.length ? list.map(function (a) { return annItem(a, a.id > seen, canPost && !popup); }).join('') : '<p>目前沒有公告。</p>') + '</div>' +
      (canPost && !popup ? '<div class="cw-row"><button class="cw-b" type="button" data-anew>＋ 新增公告</button></div>' : '') +
      '<div class="cw-row"><button class="cw-b p" type="button" data-x>' + (popup ? '知道了' : '關閉') + '</button>' + (popup && ANN.list.length > list.length ? '<button class="cw-b" type="button" data-aall>看全部公告</button>' : '') + '</div>',
      function (ov, close) {
        ov.querySelector('[data-x]').addEventListener('click', function () { close(); if (popup) annMark(); });
        var all = ov.querySelector('[data-aall]'); if (all) all.addEventListener('click', function () { close(); annShow(false); });
        ov.addEventListener('click', function (e) {
          var t = e.target.closest('button'); if (!t) return;
          if (t.dataset.anew != null) { close(); annEdit(null); }
          else if (t.dataset.aedit) { close(); annEdit(+t.dataset.aedit); }
          else if (t.dataset.adel) {
            if (!confirm('要刪除這則公告嗎？')) return;
            t.disabled = true;
            api({ a: 'anndel', id: +t.dataset.adel }).then(function (j) {
              if (!j.ok) { toast('⚠️ ' + errText(j)); t.disabled = false; return; }
              toast('🗑️ 公告已刪除'); close(); annLoad().then(function () { annShow(false); });
            }).catch(function () { t.disabled = false; netFail(); });
          }
        });
      }, popup, 'wide');
  }
  function annEdit(id) {
    var cur = id ? ANN.list.filter(function (a) { return a.id === id; })[0] : null;
    modal('<div class="cw-ic">✍️</div><h3>' + (cur ? '編輯公告' : '新增公告') + '</h3>' +
      '<input class="cw-in" maxlength="40" placeholder="標題（40 字內）" value="' + esc(cur ? cur.title : '') + '">' +
      '<textarea class="cw-ta" maxlength="500" placeholder="公告內容（500 字內，可以貼網址）" style="min-height:130px">' + esc(cur ? cur.text : '') + '</textarea><div class="cw-err"></div>' +
      '<div class="cw-row"><button class="cw-b p" type="button" data-ok>' + (cur ? '儲存' : '發布') + '</button><button class="cw-b" type="button" data-x>取消</button></div>' +
      '<small>發布後，所有人下次登島都會收到通知。</small>',
      function (ov, close) {
        var ti = ov.querySelector('.cw-in'), tx = ov.querySelector('.cw-ta'), err = ov.querySelector('.cw-err'), ok = ov.querySelector('[data-ok]');
        ov.querySelector('[data-x]').addEventListener('click', function () { close(); annShow(false); });
        ok.addEventListener('click', function () {
          if (tx.value.trim().length < 2) { err.textContent = ERR.annshort; return; }
          ok.disabled = true; ok.textContent = '送出中…';
          api({ a: cur ? 'annedit' : 'annpost', id: id || 0, title: ti.value.trim(), text: tx.value }, true).then(function (j) {
            ok.disabled = false; ok.textContent = cur ? '儲存' : '發布';
            if (!j.ok) { err.textContent = errText(j); return; }
            toast(cur ? '✏️ 公告已更新' : '📢 公告發布了！'); close(); annLoad().then(function () { annShow(false); });
          }).catch(function () { ok.disabled = false; ok.textContent = cur ? '儲存' : '發布'; err.textContent = '連不上金幣小島，請稍後再試'; });
        });
        setTimeout(function () { ti.focus(); }, 60);
      }, true, 'wide');
  }
  /* 點公告：先用上次存的內容馬上打開，背景再更新；有新內容就重畫（不用空等網路） */
  function annOpen() {
    var had = ANN.list.length > 0 || ANN.max > 0, before = JSON.stringify(ANN.list), close = null;
    if (had) close = annShow(false);
    annLoad().then(function () {
      if (!had) { annShow(false); return; }
      if (JSON.stringify(ANN.list) !== before && close && document.querySelector('.cw-ov .ann-list')) { close(); annShow(false); }
    }).catch(function () { if (!had) toast('⚠️ 暫時連不上公告，請稍後再試'); });
  }
  function whenIdle(fn, tries) {
    tries = tries || 0;
    if (document.querySelector('#mission:not([hidden]),#intro:not([hidden]),.cw-ov') && tries < 120) { setTimeout(function () { whenIdle(fn, tries + 1); }, 1000); return; }
    fn();
  }
  function annCheck() {
    return annLoad().then(function () {
      if (!annUnread().length) return;
      whenIdle(function () { if (annUnread().length) annShow(true); });
    });
  }

  /* ---------- 啟動 ---------- */
  load();
  injectCSS();
  if (TOP) {
    window.addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.cw === 'toast') toast(e.data.msg); });
    window.addEventListener('storage', function (e) { if (e.key === KEY) { load(); emit({ t: 'ext' }); } });
  }

  window.COINS = {
    get: function () { return P; },
    setGuest: setGuest,
    on: function (f) { listeners.push(f); },
    earn: earn,
    stats: function (cb) { if (TOPC) cb(TOPC); fetchTop().then(cb).catch(function () {}); },
    read: read,
    board: board,
    bag: bag,
    ann: { open: annOpen, check: annCheck },
    avatar: pickAvatar,
    visit: visit,
    toast: toast,
    api: api,
    call: call,
    esc: esc,
    av: av,
    linkify: linkify,
    errText: errText,
    welcome: welcome,
    chest: { get: ckGet, save: ckSave, open: ckOpen, max: CK_MAX },
    RES: RES,
    RES_KEYS: RES_KEYS,
    // 已登島就直接做，還沒有暱稱就先請他取暱稱
    need: function (f) { if (P.code) f(); else welcome(function (ok) { if (ok) { daily(); f(); } }); },
    // 首頁或直接開啟的文章頁才發登島、在線獎勵；閱讀器 iframe 內不重複計算
    start: function (opt) {
      opt = opt || {};
      if (!TOP || started) { if (opt.done) opt.done(); return; }
      started = true;
      var begin = function () {
        var d = daily(); online(); chest(); unreadPoll();
        // 首頁：先在背景把排行榜抓好，按 🏆 時就不用等
        if (opt.ask !== false) setTimeout(function () { fetchTop().catch(function () {}); }, 2500);
        if (opt.ask !== false) setTimeout(function () { loadVisAll().catch(function () {}); }, 1800);
        if (opt.ask !== false) setTimeout(function () { if (P.code) frFetch().catch(function () {}); }, 3200);   // 好友清單先在背景抓好，打開背包不用等
        if (opt.ask !== false && d) d.then(annCheck).catch(function () {});
        // 老玩家還沒選頭像：這次瀏覽提醒一次
        if (opt.ask !== false && d) d.then(function () {
          var asked = false; try { asked = sessionStorage.getItem('cw-av') === '1'; sessionStorage.setItem('cw-av', '1'); } catch (e) {}
          if (!P.code || P.av || asked) return;
          var tries = 0;
          (function wait() { // 等探險任務、開場畫面關掉再問
            if (document.querySelector('#mission:not([hidden]),#intro:not([hidden]),.cw-ov') && tries++ < 120) { setTimeout(wait, 1000); return; }
            if (!P.av) pickAvatar(null, true);
          })();
        });
        if (opt.done) opt.done();
      };
      var asked = false; try { asked = sessionStorage.getItem('cw-asked') === '1'; sessionStorage.setItem('cw-asked', '1'); } catch (e) {}
      if (!P.code && opt.ask !== false && (!asked || opt.forceAsk)) welcome(begin); else begin();
    }
  };
})();
