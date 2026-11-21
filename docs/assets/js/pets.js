/* 蘋果爸小島的三貓三狗：Q 版側面全身 SVG（大頭、毛色漸層、大眼睛反光、腮紅），
   走路時四隻腳交替擺動、尾巴搖、會眨眼、貓耳偶爾抖一下。p 用首頁 PETS 的欄位：
   kind（cat/dog）、base 主毛色、bp 身體花斑 [[色,x,y,r]]、hp 頭頂花色、tail 尾巴色、stripe 條紋色、ear 狗耳色、snout 狗嘴色、old 老狗。 */
(function () {
  var O = '#3b2414';
  /* 寵物圖裡面不放任何零件動畫：部分手機瀏覽器（Brave 等）在很多「各自在動的小零件」時會隨機漏畫頭、身體、尾巴。
     要動就讓「整隻」一起動（首頁的 .pw／.ring 負責）。ppFlip 給草地散步轉身用。 */
  var CSS =
    '.pq{overflow:visible}' +
    '@keyframes ppFlip{0%{transform:scaleX(1)}50%{transform:scaleX(-1)}}';

  function rgb(h) { h = String(h || '#888').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(h, to, t) { var a = rgb(h), b = rgb(to); var r = a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }); return '#' + r.map(function (v) { return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function lum(h) { var a = rgb(h); return (a[0] * .3 + a[1] * .59 + a[2] * .11) / 255; }
  function grad(id, c) {   // 由上到下：亮部 → 主色 → 暗部，讓毛有立體感
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + mix(c, '#ffffff', .28) + '"/><stop offset=".55" stop-color="' + c + '"/><stop offset="1" stop-color="' + mix(c, '#000000', .22) + '"/></linearGradient>';
  }

  var petId = 0;
  function pet(p, still) {
    var c = p.base, cat = p.kind === 'cat', u = 'pq' + (++petId), dark = lum(c) < .35;
    var line = dark ? '#000000' : O, sw = 1.3;
    var cB = u + 'cb', cH = u + 'ch';
    var s = '<svg class="pq' + (still ? ' still' : '') + (p.old ? ' old' : '') + '" viewBox="0 0 70 56" aria-hidden="true"><defs>' +   /* 不用漸層填色：部分手機會隨機漏畫 url(#漸層)，改成單色＋半透明亮面／暗面 */
      '<clipPath id="' + cB + '"><ellipse cx="29" cy="34" rx="17" ry="11"/></clipPath><clipPath id="' + cH + '"><circle cx="50" cy="22" r="14"/></clipPath></defs>';
    s += '<ellipse cx="33" cy="52.5" rx="21" ry="2.6" fill="rgba(0,0,0,.18)"/>';   // 影子
    function leg(x, cls, far) {   // 腳：短短圓圓，遠的兩隻顏色深一點
      var lc = far ? mix(c, '#000000', .2) : c, paw = mix(c, '#ffffff', cat ? .35 : .2);
      return '<g class="' + cls + '"><rect x="' + (x - 3.6) + '" y="36" width="7.2" height="13" rx="3.6" fill="' + lc + '" stroke="' + line + '" stroke-width="' + sw + '"/>' +
        '<ellipse cx="' + (x + .6) + '" cy="48.6" rx="4.3" ry="2.6" fill="' + (far ? mix(paw, '#000000', .15) : paw) + '" stroke="' + line + '" stroke-width="' + sw + '"/></g>';
    }
    s += leg(17, 'ppB', 1) + leg(37, 'ppA', 1);
    var tc = p.tail || c;   // 尾巴：貓長長捲起、狗短短毛茸茸
    s += cat
      ? '<g class="ppT"><path d="M14 31C5 30 2 20 6 12C8 8 12 8 12 11" stroke="' + line + '" stroke-width="7.4" fill="none" stroke-linecap="round"/><path d="M14 31C5 30 2 20 6 12C8 8 12 8 12 11" stroke="' + tc + '" stroke-width="4.6" fill="none" stroke-linecap="round"/></g>'
      : '<g class="ppT"><path d="M14 30C8 28 6 21 9 16" stroke="' + line + '" stroke-width="8.6" fill="none" stroke-linecap="round"/><path d="M14 30C8 28 6 21 9 16" stroke="' + tc + '" stroke-width="5.8" fill="none" stroke-linecap="round"/><circle cx="9" cy="16" r="2.2" fill="' + mix(tc, '#ffffff', .25) + '"/></g>';
    // 身體＋花斑＋條紋＋亮一點的肚子
    s += '<ellipse cx="29" cy="34" rx="17" ry="11" fill="' + c + '"/><g clip-path="url(#' + cB + ')">';
    (p.bp || []).forEach(function (q) { s += '<circle cx="' + (29 + (q[1] - 34) * .82).toFixed(1) + '" cy="' + (34 + (q[2] - 27)).toFixed(1) + '" r="' + (q[3] * .9).toFixed(1) + '" fill="' + q[0] + '"/>'; });
    if (p.stripe) [19, 26, 33].forEach(function (x) { s += '<path d="M' + x + ' 23q3 6 0 11" stroke="' + p.stripe + '" stroke-width="3.2" fill="none" stroke-linecap="round"/>'; });
    s += '<ellipse cx="31" cy="42" rx="12" ry="4.5" fill="' + mix(c, '#ffffff', cat ? .45 : .3) + '" opacity=".55"/></g>';
    s += '<ellipse cx="25" cy="27.5" rx="11" ry="3.6" fill="#fff" opacity="' + (dark ? .16 : .3) + '"/>';   // 背上的亮面
    s += '<ellipse cx="29" cy="34" rx="17" ry="11" fill="none" stroke="' + line + '" stroke-width="' + sw + '"/>';
    s += leg(23, 'ppA') + leg(42, 'ppB');
    s += '<g class="ppH">';
    if (cat) {   // 貓耳：外框＋粉紅內耳，左耳偶爾抖一下
      var ec = p.hp || c;
      s += '<g class="ppR"><path d="M38 14l2-13 10 8z" fill="' + ec + '" stroke="' + line + '" stroke-width="' + sw + '" stroke-linejoin="round"/><path d="M40.5 11.5l1.2-7 5.3 4.4z" fill="#f6a5b6"/></g>' +
        '<path d="M62 14l-1-13-10 7z" fill="' + c + '" stroke="' + line + '" stroke-width="' + sw + '" stroke-linejoin="round"/><path d="M59.8 11.5l-.7-7-5.4 3.8z" fill="#f6a5b6"/>';
    }
    if (!cat && p.prick) {   // 狗的立耳：畫在頭後面，尖端圓圓的，內耳淡一點；左耳會抖
      var pe = p.ear || c, pin = dark ? mix(c, '#ffffff', .22) : '#f3c6c6';
      s += '<g class="ppR"><path d="M37.5 15C36 8 37 2 40 .5c3 1.5 8 6 10 9.5z" fill="' + pe + '" stroke="' + line + '" stroke-width="' + sw + '" stroke-linejoin="round"/><path d="M40 11.5c-.6-4 0-7 1-8 2 1.4 4.6 4 5.6 6z" fill="' + pin + '"/></g>' +
        '<path d="M62.5 15c1.4-7 .6-13-2.3-14.6-3.2 1.4-8 5.6-10.2 9z" fill="' + pe + '" stroke="' + line + '" stroke-width="' + sw + '" stroke-linejoin="round"/><path d="M60 11.5c.6-4 .2-7-.9-8-2 1.3-4.6 3.8-5.6 5.8z" fill="' + pin + '"/>';
    }
    s += '<circle cx="50" cy="22" r="14" fill="' + c + '"/><g clip-path="url(#' + cH + ')">';
    if (cat && p.hp) s += '<path d="M34 22a16 16 0 0 1 16-16v15z" fill="' + p.hp + '"/>';   // 頭頂花色
    if (p.stripe) s += '<path d="M46 9v5M50 8v6M54 9v5" stroke="' + p.stripe + '" stroke-width="2.2" stroke-linecap="round"/>';
    s += '<ellipse cx="57" cy="29" rx="9" ry="6.5" fill="' + (cat ? mix(c, '#ffffff', .55) : (p.snout || mix(c, '#ffffff', .3))) + '" opacity="' + (cat ? .7 : 1) + '"/>';   // 嘴邊
    s += '<ellipse cx="47" cy="34" rx="15" ry="6" fill="#000" opacity=".1"/>';   // 下巴的暗面
    s += '</g><ellipse cx="45.5" cy="13.5" rx="7" ry="3.8" fill="#fff" opacity="' + (dark ? .18 : .32) + '" transform="rotate(-18 45.5 13.5)"/>';   // 頭頂的亮面
    s += '<circle cx="50" cy="22" r="14" fill="none" stroke="' + line + '" stroke-width="' + sw + '"/>';
    if (!cat) {   // 狗：立耳（prick）或垂耳、項圈（老狗紅、黑狗藍、白狗紅）＋金色名牌
      var ecol = p.ear || mix(c, '#000000', .15);
      if (!p.prick) s += '<path d="M41 11c-7 1-9 13-5 19 3 2 6-1 7-5 1-5 1-10-2-14z" fill="' + ecol + '" stroke="' + line + '" stroke-width="' + sw + '" stroke-linejoin="round"/>';
      var col = p.old ? '#e2453c' : dark ? '#3b82f6' : '#ef4444';
      s += '<path d="M39 32q9 6 20 2" stroke="' + col + '" stroke-width="3.2" fill="none" stroke-linecap="round"/><circle cx="50" cy="36.4" r="2" fill="#ffd166" stroke="#b8860b" stroke-width=".6"/>';
    }
    function eye(x, y, r) {   // 大眼睛：兩個反光點，會眨眼；黑毛的眼睛周圍亮一圈才看得到
      return '<g class="ppE">' + (dark ? '<ellipse cx="' + x + '" cy="' + y + '" rx="' + (r + .9) + '" ry="' + (r * 1.2 + .9) + '" fill="rgba(255,255,255,.35)"/>' : '') +
        '<ellipse cx="' + x + '" cy="' + y + '" rx="' + r + '" ry="' + (r * 1.2) + '" fill="#2a1a10"/><circle cx="' + (x + r * .35) + '" cy="' + (y - r * .45) + '" r="' + (r * .42) + '" fill="#fff"/><circle cx="' + (x - r * .35) + '" cy="' + (y + r * .45) + '" r="' + (r * .18) + '" fill="#fff"/></g>';
    }
    s += eye(53.5, 20.5, 2.5) + eye(60.5, 20.5, 2.2);
    if (p.old) s += '<path d="M51 15.5q2.5-1.6 5 0M58.5 15.8q2-1.2 4 .2" stroke="#d8d8d8" stroke-width="1.3" fill="none" stroke-linecap="round"/>';   // 老狗白眉毛
    s += '<ellipse cx="51.5" cy="26.5" rx="2.6" ry="1.5" fill="#ff8fa3" opacity=".55"/><ellipse cx="62.5" cy="26" rx="2" ry="1.3" fill="#ff8fa3" opacity=".55"/>';   // 腮紅
    if (cat) {   // 粉紅小鼻子、ω 嘴、鬍鬚
      s += '<path d="M60.6 24.6l3 0-1.5 1.8z" fill="#f28aa0" stroke="' + line + '" stroke-width=".7" stroke-linejoin="round"/>' +
        '<path d="M62.1 26.4q-.4 1.7-2 1.6M62.1 26.4q.4 1.7 2 1.6" stroke="' + line + '" stroke-width=".9" fill="none" stroke-linecap="round"/>' +
        '<path d="M64.2 24.8l5.8-1M64.4 26.2h6M64.2 27.6l5.6 1.2" stroke="' + (dark ? '#dddddd' : '#8a6a4a') + '" stroke-width=".7" stroke-linecap="round"/>';
    } else {   // 狗：亮亮的黑鼻子、微笑、粉紅小舌頭
      s += '<ellipse cx="64" cy="24.4" rx="3" ry="2.2" fill="#1a1110"/><ellipse cx="63.2" cy="23.6" rx="1" ry=".6" fill="#fff" opacity=".7"/>' +
        '<path d="M63.6 26.6q-.6 2.4-3.4 2.2M63.6 26.6q1.4 2 3 .8" stroke="' + line + '" stroke-width=".9" fill="none" stroke-linecap="round"/>' +
        '<path d="M61.2 28.6q.6 3.4 2.4 2.6q1.2-.8.4-2.8z" fill="#f47c93" stroke="' + line + '" stroke-width=".6"/>';
    }
    s += '</g>';
    return s + '</svg>';
  }

  var st = document.createElement('style');
  st.textContent = CSS;
  (document.head || document.documentElement).appendChild(st);

  window.PPL = { pet: pet };
})();
