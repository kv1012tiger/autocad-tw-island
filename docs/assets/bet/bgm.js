/* 拉霸島、猜拳島的背景音樂：全部用 Web Audio 即時合成（原創旋律，不用任何音檔）
   GBGM.start('slot'|'rps') 開始、stop() 停；tempo(x) 改速度；heart(true) 加心跳；riser／roll／boom 是緊張感音效 */
(function () {
  'use strict';
  var A = null, M = null, N = null, on = false, kind = '', step = 0, next = 0, timer = 0, tempo = 1, heart = false;
  function ac() {
    if (!A) { try { A = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (A.state === 'suspended') { try { A.resume(); } catch (e) {} }
    return A;
  }
  function out() { if (!M) { M = A.createGain(); M.gain.value = 0.55; M.connect(A.destination); } return M; }
  function osc(f, f2, t, d, type, vol) {
    var o = A.createOscillator(), g = A.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(out()); o.start(t); o.stop(t + d + 0.03);
  }
  function noise(t, d, vol, hp) {
    if (!N) { N = A.createBuffer(1, A.sampleRate * 0.5, A.sampleRate); var c = N.getChannelData(0); for (var i = 0; i < c.length; i++) c[i] = Math.random() * 2 - 1; }
    var s = A.createBufferSource(), f = A.createBiquadFilter(), g = A.createGain();
    s.buffer = N; f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(out()); s.start(t); s.stop(t + d + 0.03);
  }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  /* 拉霸：輕快賭場電子風（Am–F–C–G，每小節 16 拍） */
  var SR = [57, 53, 48, 55], ARP = [0, 7, 12, 7, 3, 7, 12, 15];
  function slotStep(s, t) {
    var bar = Math.floor(s / 16) % 4, i = s % 16, r = SR[bar];
    if (i % 4 === 0) { osc(130, 45, t, 0.14, 'sine', 0.16); osc(mtof(r - 12), 0, t, 0.22, 'triangle', 0.1); }
    if (i % 4 === 2) osc(mtof(r), 0, t, 0.1, 'triangle', 0.045);
    if (i % 2 === 0) noise(t, 0.03, 0.03, 7000);
    if (i % 8 === 4) noise(t, 0.12, 0.055, 1500);
    osc(mtof(r + 12 + ARP[i % 8]), 0, t, 0.09, 'square', 0.016);
  }
  /* 猜拳：海盜鼓聲＋小調旋律 */
  var MEL = [62, 0, 65, 0, 69, 67, 65, 0, 64, 0, 62, 0, 60, 62, 64, 0, 62, 0, 65, 0, 69, 72, 70, 0, 69, 67, 65, 64, 62, 0, 0, 0];
  function rpsStep(s, t) {
    var i = s % 16;
    if (i === 0 || i === 8 || i === 10) osc(110, 40, t, 0.2, 'sine', 0.2);
    if (i === 4 || i === 12) noise(t, 0.15, 0.065, 1200);
    if (i % 2 === 1) noise(t, 0.02, 0.018, 8000);
    if (i % 4 === 0) osc(mtof(38 + (Math.floor(s / 16) % 2 ? 3 : 0)), 0, t, 0.28, 'sawtooth', 0.028);
    var m = MEL[s % 32]; if (m) osc(mtof(m), 0, t, 0.16, 'triangle', 0.034);
  }
  function tick() {
    if (!on || !A) return;
    var spb = 60 / ((kind === 'slot' ? 128 : 100) * tempo) / 4;
    while (next < A.currentTime + 0.2) {
      (kind === 'slot' ? slotStep : rpsStep)(step, next);
      if (heart && step % 8 === 0) { osc(70, 45, next, 0.12, 'sine', 0.26); osc(60, 40, next + 0.18, 0.12, 'sine', 0.18); }
      next += spb; step++;
    }
  }
  window.GBGM = {
    start: function (k) { kind = k; if (on || !ac()) return; on = true; step = 0; next = A.currentTime + 0.08; clearInterval(timer); timer = setInterval(tick, 50); },
    stop: function () { on = false; clearInterval(timer); },
    tempo: function (x) { tempo = x; },
    heart: function (b) { heart = !!b; },
    riser: function (d) { if (!on || !ac()) return; var t = A.currentTime; osc(180, 1400, t, d, 'sawtooth', 0.03); noise(t, d, 0.018, 3000); },
    roll: function (d) { if (!on || !ac()) return; var t = A.currentTime; for (var x = 0; x < d; x += 0.06) noise(t + x, 0.05, 0.03 + x / d * 0.07, 900); },
    boom: function () { if (!on || !ac()) return; var t = A.currentTime; osc(90, 30, t, 0.6, 'sine', 0.35); noise(t, 0.5, 0.12, 200); }
  };
})();
