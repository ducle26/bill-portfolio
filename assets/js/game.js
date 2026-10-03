/* Steer the bit: a one-button drilling game.
   Part 1, the vertical section: hold to steer right, let go to drift left.
   Pick up approved parts, skip the counterfeits, dodge boulders, and land the
   well inside the landing window at 4,000 ft.
   Part 2, the lateral: the well turns sideways. Hold to climb, let go to sink,
   and stay inside the pay zone for 1,000 ft.
   Everyone drills the same well each day (the layout is seeded by the date). */
(function () {
  "use strict";
  var wrap = document.getElementById("game");
  var canvas = document.getElementById("game-canvas");
  if (!wrap || !canvas) return;
  var ctx = canvas.getContext("2d");
  function $(id) { return document.getElementById(id); }

  /* ---------- Tuning ---------- */
  var V_TD = 4000, LAT_LEN = 1000;     // feet
  var PX_V = 0.55, PX_L = 2.4;         // pixels per foot in each phase
  var DRAIN = 7.5, WAIT_TIME = 2.2;
  var ROCK = {
    sand:    { name: "Sandstone", speed: 1.0 },
    shale:   { name: "Shale",     speed: 0.85 },
    lime:    { name: "Limestone", speed: 0.62 },
    granite: { name: "Granite",   speed: 0.5 }
  };
  var PTS = { ft: 1, good: 150, bad: -200, hit: -100, wait: -250, power: 50, land: 500, miss: -300, zone: 1500, timeMax: 2500, timePer: 30 };

  /* ---------- Seeded random: the same well for everyone today ---------- */
  var today = new Date(), DAY = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  function seedFrom(str) { var h = 1779033703 ^ str.length; for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return h >>> 0; }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var rnd = Math.random;
  function rand(a, b) { return a + rnd() * (b - a); }

  /* ---------- Sound effects (follow the site's sound choice) ---------- */
  var sfx = { ctx: null, hum: null, humGain: null };
  function sfxOn() { return !(window.BL && window.BL.music && window.BL.music.prefOn) || window.BL.music.prefOn(); }
  function sfxInit() {
    if (!sfxOn()) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!sfx.ctx) sfx.ctx = new AC();
    sfx.ctx.resume();
    var c = sfx.ctx;
    sfx.hum = c.createOscillator(); sfx.hum.type = "triangle"; sfx.hum.frequency.value = 52;
    var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260;
    sfx.humGain = c.createGain(); sfx.humGain.gain.value = 0;
    sfx.hum.connect(lp); lp.connect(sfx.humGain); sfx.humGain.connect(c.destination);
    sfx.hum.start();
  }
  function sfxHum(speed, quiet) {
    if (!sfx.hum) return;
    var t = sfx.ctx.currentTime;
    sfx.hum.frequency.setTargetAtTime(40 + speed * 28, t, 0.2);
    sfx.humGain.gain.setTargetAtTime(quiet ? 0.008 : 0.05, t, 0.1);
  }
  function sfxStopHum() {
    if (!sfx.hum) return;
    var h = sfx.hum; sfx.humGain.gain.setTargetAtTime(0, sfx.ctx.currentTime, 0.15);
    setTimeout(function () { try { h.stop(); } catch (e) {} }, 600);
    sfx.hum = null;
  }
  function tone(freq, start, dur, type, vol) {
    if (!sfx.ctx || !sfxOn()) return;
    var c = sfx.ctx, t = c.currentTime + (start || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || 0.08, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function thump() {
    if (!sfx.ctx || !sfxOn()) return;
    var c = sfx.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.32);
    if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) {}
  }
  var SFX = {
    part: function () { tone(1318.5, 0, 0.18, "sine", 0.07); tone(1975.5, 0.06, 0.22, "sine", 0.05); },
    bad: function () { tone(311, 0, 0.16, "sawtooth", 0.03); tone(277, 0.1, 0.25, "sawtooth", 0.03); },
    hit: thump,
    wait: function () { tone(233, 0, 0.18, "square", 0.025); tone(196, 0.16, 0.3, "square", 0.025); },
    refill: function () { tone(784, 0, 0.12, "sine", 0.05); tone(1047, 0.08, 0.2, "sine", 0.05); },
    power: function () { [659.3, 880, 1318.5].forEach(function (f, i) { tone(f, i * 0.06, 0.25, "triangle", 0.06); }); },
    land: function () { tone(523.3, 0, 0.3, "triangle", 0.06); tone(784, 0.12, 0.4, "triangle", 0.06); },
    win: function () { [523.3, 659.3, 784, 1046.5].forEach(function (f, i) { tone(f, i * 0.09, 0.5, "triangle", 0.07); }); },
    miss: function () { tone(392, 0, 0.25, "triangle", 0.06); tone(311, 0.18, 0.45, "triangle", 0.06); }
  };

  /* ---------- Size and theme ---------- */
  var W = 720, H = 480, dpr = 1, colors = {}, patterns = {}, themeKey = "";
  var state = "idle", hold = false, lastT = 0, g = null;
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#13233A"; }
  function resize() {
    var keep = state === "running";
    W = wrap.clientWidth;
    H = Math.round(Math.max(340, Math.min(520, W * 0.66, window.innerHeight - 120)));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!keep) { g = null; draw(); }
  }
  function makePattern(kind) {
    var c = document.createElement("canvas");
    var s = { sand: 10, shale: 7, lime: 24, granite: 12, pay: 10 }[kind];
    var w = kind === "lime" ? 24 : s, h = kind === "lime" ? 14 : s;
    c.width = w; c.height = h;
    var p = c.getContext("2d");
    p.strokeStyle = kind === "pay" ? colors.orange : colors.hatch; p.fillStyle = p.strokeStyle; p.lineWidth = 1;
    if (kind === "sand") { p.beginPath(); p.arc(2.5, 2.5, 1, 0, 6.3); p.arc(7.5, 7.5, 1, 0, 6.3); p.fill(); }
    if (kind === "shale") { p.beginPath(); p.moveTo(0, 0.5); p.lineTo(w, 0.5); p.stroke(); }
    if (kind === "lime") { p.beginPath(); p.moveTo(0, 0.5); p.lineTo(w, 0.5); p.moveTo(0, 7.5); p.lineTo(w, 7.5); p.moveTo(0.5, 0); p.lineTo(0.5, 7); p.moveTo(12.5, 7); p.lineTo(12.5, 14); p.stroke(); }
    if (kind === "granite") { p.beginPath(); p.moveTo(0, s); p.lineTo(s, 0); p.moveTo(0, 0); p.lineTo(s, s); p.stroke(); }
    if (kind === "pay") { p.globalAlpha = 0.5; p.beginPath(); p.moveTo(0, s); p.lineTo(s, 0); p.stroke(); }
    return ctx.createPattern(c, "repeat");
  }
  function readTheme() {
    var key = document.body.className;
    if (key === themeKey && patterns.sand) return;
    themeKey = key;
    colors = { paper: css("--paper"), paper2: css("--paper-2"), ink: css("--ink"), ink2: css("--ink-2"), ink3: css("--ink-3"), orange: css("--orange"), hatch: css("--hatch"), grid: css("--grid-strong"), scrim: css("--scrim") };
    ["sand", "shale", "lime", "granite", "pay"].forEach(function (k) { patterns[k] = makePattern(k); });
  }

  /* ---------- Build today's well ---------- */
  function newGame() {
    rnd = mulberry(seedFrom("well-" + DAY));
    var layers = [{ top: 0, bottom: 320, kind: "sand" }], d = 320, kinds = ["sand", "shale", "lime", "sand", "granite", "shale", "lime", "granite"], k = 0;
    while (d < V_TD + 900) { var t = rand(260, 560); layers.push({ top: d, bottom: d + t, kind: kinds[(k++ + Math.floor(rand(0, 2))) % kinds.length] }); d += t; }
    // positions are stored as a share of the width so the well is the same on any screen
    var boulders = [], items = [];
    layers.forEach(function (L) {
      if (L.top < 350) return;
      var hard = L.kind === "lime" || L.kind === "granite", n = hard ? Math.floor(rand(2, 4)) : Math.floor(rand(0, 2));
      for (var i = 0; i < n; i++) {
        var depth = rand(L.top + 30, Math.min(L.bottom - 30, V_TD - 300));
        if (depth > L.top) boulders.push({ fx: rand(0.06, 0.94), depth: depth, r: rand(14, 26), hidden: hard && rnd() < 0.55, hit: false });
      }
    });
    var forced = { 4: "svy", 9: "exp", 15: "svy", 19: "exp" }, n = 0;
    for (var pd = 260; pd < V_TD - 160; pd += rand(140, 210)) {
      var roll = rnd(), type = forced[n] || (roll < 0.74 ? "good" : "bad");
      items.push({ fx: rand(0.05, 0.95), depth: pd, type: type, got: false });
      n++;
    }
    var p1 = rand(0, 6.28), p2 = rand(0, 6.28), latItems = [];
    for (var lx = 110; lx < LAT_LEN - 40; lx += rand(90, 140)) latItems.push({ lx: lx, off: rand(-0.55, 0.55), type: rnd() < 0.72 ? "good" : "bad", got: false });
    var lw = 0.24;
    g = {
      phase: "vert", x: W / 2, depth: 0, angle: 0, lx: 0, ly: H / 2, vy: 0,
      parts: 100, good: 0, bad: 0, waits: 0, hits: 0, time: 0, score: 0, landed: null,
      stall: 0, wait: 0, shake: 0, flash: 0, expedite: 0, survey: 0, failIn: 0, failMsg: 0, turn: 0,
      zoneTime: 0, latTime: 0,
      trail: [{ x: W / 2, depth: 0 }], ltrail: [], popups: [], bits: [],
      layers: layers, boulders: boulders, items: items, latItems: latItems,
      landing: { fx: rand(0.08, 0.92 - lw), fw: lw }, p1: p1, p2: p2
    };
    rnd = Math.random; // effects after this point don't need to be repeatable
  }
  function layerAt(depth) { for (var i = 0; i < g.layers.length; i++) if (depth < g.layers[i].bottom) return g.layers[i]; return g.layers[g.layers.length - 1]; }
  function zoneC(lx) { return H * 0.54 + H * 0.15 * Math.sin(lx / 170 + g.p1) + H * 0.06 * Math.sin(lx / 71 + g.p2); }
  function zoneH(lx) { return 36 - 11 * Math.min(1, lx / LAT_LEN); }

  function add(points, text, x, y) {
    g.score += points;
    g.popups.push({ x: x, y: y, text: text || ((points > 0 ? "+" : "") + points), life: 1.1, good: points >= 0 });
  }

  /* ---------- Update ---------- */
  function pickup(type, x, y) {
    if (type === "good") { g.good++; g.parts = Math.min(100, g.parts + 22); g.flash = 0.25; SFX.part(); add(PTS.good, null, x, y); }
    if (type === "bad") { g.bad++; g.failIn = 2.4; SFX.bad(); g.popups.push({ x: x, y: y, text: "counterfeit!", life: 1.3, good: false }); }
    if (type === "exp") { g.expedite = 5; g.parts = 100; SFX.power(); add(PTS.power, "expedited +50", x, y); }
    if (type === "svy") { g.survey = 6; SFX.power(); add(PTS.power, "survey +50", x, y); }
  }
  function commonTimers(dt) {
    g.time += dt;
    g.expedite = Math.max(0, g.expedite - dt); g.survey = Math.max(0, g.survey - dt); g.failMsg = Math.max(0, g.failMsg - dt);
    g.popups.forEach(function (p) { p.life -= dt; p.y -= dt * 34; });
    g.popups = g.popups.filter(function (p) { return p.life > 0; });
    g.bits.forEach(function (b) { b.life -= dt * 1.6; b.x += b.vx * dt; b.y += b.vy * dt; });
    g.bits = g.bits.filter(function (b) { return b.life > 0; });
    if (g.failIn > 0) {
      g.failIn -= dt;
      if (g.failIn <= 0) { g.stall = 1.4; g.failMsg = 1.4; SFX.hit(); add(PTS.bad, null, bitScreen().x, bitScreen().y - 16); }
    }
  }
  function partsTick(dt, mult) {
    if (g.expedite > 0) return false;
    g.parts -= DRAIN * dt * (mult || 1);
    if (g.parts <= 0) { g.parts = 0; g.waits++; g.wait = WAIT_TIME; SFX.wait(); add(PTS.wait, null, bitScreen().x, bitScreen().y - 16); return true; }
    return false;
  }
  function bitScreen() { return g.phase === "lat" ? { x: W * 0.3, y: g.ly } : { x: g.x, y: H * 0.32 }; }

  function update(dt) {
    commonTimers(dt);
    if (g.phase === "turn") {
      g.turn -= dt; sfxHum(0.4, true);
      if (g.turn <= 0) { g.phase = "lat"; g.lx = 0; g.ly = zoneC(0) + (g.landed ? 0 : -zoneH(0) - 26); g.vy = 0; g.ltrail = [{ lx: 0, ly: g.ly }]; }
      return;
    }
    if (g.wait > 0) { g.wait -= dt; sfxHum(0, true); if (g.wait <= 0) { g.parts = 45; SFX.refill(); } return; }
    if (g.stall > 0) { g.stall -= dt; g.shake = g.stall; sfxHum(0, true); return; }
    if (g.phase === "vert") updateVert(dt); else updateLat(dt);
  }

  function updateVert(dt) {
    var rock = ROCK[layerAt(g.depth).kind];
    sfxHum(rock.speed, false);
    var maxA = 0.8, turn = 2.0, targetA = hold ? maxA : -maxA;
    g.angle += Math.max(-turn * dt, Math.min(turn * dt, targetA - g.angle));
    var down = 205 * rock.speed * (0.55 + 0.45 * Math.cos(g.angle));
    var before = g.depth;
    g.depth = Math.min(V_TD, g.depth + down * dt);
    g.score += (g.depth - before) * PTS.ft;
    g.x += 200 * Math.sin(g.angle) * (0.6 + 0.4 * rock.speed) * dt;
    if (g.x < 10) { g.x = 10; g.angle = Math.max(g.angle, 0); }
    if (g.x > W - 10) { g.x = W - 10; g.angle = Math.min(g.angle, 0); }
    var last = g.trail[g.trail.length - 1];
    if (Math.abs(last.depth - g.depth) * PX_V + Math.abs(last.x - g.x) > 3) g.trail.push({ x: g.x, depth: g.depth });
    if (Math.random() < 0.5) g.bits.push({ x: g.x + (Math.random() - 0.5) * 10, y: H * 0.32 - 4, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 40, life: 1 });
    if (partsTick(dt)) return;

    g.items.forEach(function (p) {
      if (p.got) return;
      var px = p.fx * W, dy = (p.depth - g.depth) * PX_V, dx = px - g.x;
      if (dx * dx + dy * dy < 17 * 17) { p.got = true; pickup(p.type, g.x, H * 0.32 - 14); }
    });
    g.boulders.forEach(function (b) {
      if (b.hit) return;
      var bx = b.fx * W, dy = (b.depth - g.depth) * PX_V, dx = bx - g.x, rr = b.r + 6;
      if (dx * dx + dy * dy < rr * rr) {
        b.hit = true; g.hits++; g.stall = 0.7; g.parts = Math.max(0, g.parts - 15); SFX.hit();
        add(PTS.hit, null, g.x, H * 0.32 - 14);
        g.x += dx > 0 ? -10 : 10;
      }
    });
    setTbDepth(g.depth);
    if (g.depth >= V_TD) {
      var lx0 = g.landing.fx * W, lx1 = lx0 + g.landing.fw * W;
      g.landed = g.x >= lx0 && g.x <= lx1;
      add(g.landed ? PTS.land : PTS.miss, g.landed ? "landed +500" : "missed the window −300", g.x, H * 0.32 - 20);
      if (g.landed) SFX.land(); else SFX.miss();
      g.phase = "turn"; g.turn = 1.3; hold = false;
    }
  }

  function updateLat(dt) {
    var c = zoneC(g.lx), h = zoneH(g.lx), inZone = Math.abs(g.ly - c) <= h;
    sfxHum(inZone ? 1 : 0.55, false);
    var target = hold ? -150 : 150;
    g.vy += (target - g.vy) * Math.min(1, dt * 5);
    g.ly = Math.max(26, Math.min(H - 18, g.ly + g.vy * dt));
    var before = g.lx;
    g.lx = Math.min(LAT_LEN, g.lx + 95 * (inZone ? 1 : 0.7) * dt);
    g.score += (g.lx - before) * PTS.ft;
    g.latTime += dt; if (inZone) g.zoneTime += dt;
    var last = g.ltrail[g.ltrail.length - 1];
    if ((g.lx - last.lx) * PX_L + Math.abs(g.ly - last.ly) > 3) g.ltrail.push({ lx: g.lx, ly: g.ly });
    if (Math.random() < 0.5) g.bits.push({ x: W * 0.3 - 6, y: g.ly + (Math.random() - 0.5) * 8, vx: -60 - Math.random() * 50, vy: (Math.random() - 0.5) * 30, life: 1 });
    if (!inZone) g.shake = 0.08;
    if (partsTick(dt, inZone ? 1 : 1.8)) return;
    g.latItems.forEach(function (p) {
      if (p.got) return;
      var px = W * 0.3 + (p.lx - g.lx) * PX_L, py = zoneC(p.lx) + p.off * zoneH(p.lx), dx = px - W * 0.3, dy = py - g.ly;
      if (dx * dx + dy * dy < 17 * 17) { p.got = true; pickup(p.type, W * 0.3, g.ly - 14); }
    });
    setTbDepth(V_TD + g.lx);
    if (g.lx >= LAT_LEN) finish();
  }
  function setTbDepth(d) { var tb = document.querySelector(".title-block-fixed .tb-depth"); if (tb) tb.textContent = Math.round(d).toLocaleString("en-US") + " ft"; }

  /* ---------- Draw ---------- */
  function sy(depth) { return H * 0.32 + (depth - (g ? g.depth : 0)) * PX_V; }
  function drawItem(type, x, y) {
    if (type === "good" || type === "bad") {
      ctx.strokeStyle = colors.orange; ctx.lineWidth = 2.5;
      if (type === "bad") ctx.setLineDash([4, 3.2]);
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.stroke();
    } else if (type === "exp") {
      ctx.fillStyle = colors.orange; ctx.fillRect(x - 9, y - 9, 18, 18);
      ctx.strokeStyle = colors.paper; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 2, y - 6); ctx.lineTo(x - 3, y + 1); ctx.lineTo(x + 3, y + 1); ctx.lineTo(x - 2, y + 7); ctx.stroke();
    } else {
      ctx.fillStyle = colors.paper; ctx.strokeStyle = colors.ink; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x + 12, y); ctx.moveTo(x, y - 12); ctx.lineTo(x, y + 12); ctx.stroke();
      ctx.fillStyle = colors.orange; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawBit(x, y, rot) {
    var shake = g.shake > 0 ? Math.sin(g.time * 90) * 3 : 0;
    if (g.flash > 0) {
      g.flash -= 1 / 60;
      ctx.strokeStyle = colors.orange; ctx.lineWidth = 2; ctx.globalAlpha = Math.max(0, g.flash * 4);
      ctx.beginPath(); ctx.arc(x, y, 10 + (0.25 - g.flash) * 80, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    ctx.save(); ctx.translate(x + shake, y); ctx.rotate(rot);
    ctx.fillStyle = colors.ink; ctx.fillRect(-4, -18, 8, 14);
    ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(8, -4); ctx.lineTo(0, 9); ctx.closePath();
    ctx.fillStyle = colors.orange; ctx.fill();
    if (g.expedite > 0) { ctx.strokeStyle = colors.orange; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(0, -4, 17, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
  }
  function drawFx() {
    ctx.fillStyle = colors.ink2;
    g.bits.forEach(function (b) { ctx.globalAlpha = Math.max(0, b.life) * 0.8; ctx.fillRect(b.x, b.y, 2, 2); });
    ctx.globalAlpha = 1;
    ctx.font = "12px 'Space Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    g.popups.forEach(function (p) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      var w = ctx.measureText(p.text).width + 8, px = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, p.x));
      ctx.fillStyle = colors.paper; ctx.fillRect(px - w / 2, p.y - 12, w, 16);
      ctx.fillStyle = p.good ? colors.orange : colors.ink; ctx.fillText(p.text, px, p.y);
    });
    ctx.globalAlpha = 1; ctx.textAlign = "start";
  }

  function drawVert() {
    var camDepth = g.depth, topDepth = camDepth - (H * 0.32) / PX_V, botDepth = camDepth + (H * 0.68) / PX_V;
    ctx.save(); ctx.translate(0, H * 0.32 - camDepth * PX_V);
    g.layers.forEach(function (L) {
      if (L.bottom < topDepth || L.top > botDepth) return;
      ctx.fillStyle = patterns[L.kind]; ctx.fillRect(0, L.top * PX_V, W, (L.bottom - L.top) * PX_V);
    });
    ctx.restore();
    ctx.font = "10px 'Space Mono', monospace";
    g.layers.forEach(function (L) {
      if (L.top < topDepth - 10 || L.top > botDepth) return;
      var y = Math.round(sy(L.top)) + 0.5;
      ctx.strokeStyle = colors.ink3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      if (L.top > 0) {
        var label = ROCK[L.kind].name.toUpperCase() + " · " + Math.round(L.top).toLocaleString("en-US") + " FT";
        ctx.fillStyle = colors.paper; ctx.fillRect(6, y + 3, ctx.measureText(label).width + 8, 14);
        ctx.fillStyle = colors.ink3; ctx.textBaseline = "top"; ctx.fillText(label, 10, y + 5);
      }
    });
    // surface and rig
    var sY = sy(0);
    if (sY > -40) {
      ctx.fillStyle = colors.paper; ctx.fillRect(0, 0, W, Math.max(0, sY));
      ctx.strokeStyle = colors.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, sY); ctx.lineTo(W, sY); ctx.stroke();
      var rx = g.trail[0].x;
      ctx.beginPath(); ctx.moveTo(rx - 18, sY); ctx.lineTo(rx, sY - 46); ctx.lineTo(rx + 18, sY);
      ctx.moveTo(rx - 12, sY - 15); ctx.lineTo(rx + 12, sY - 15); ctx.moveTo(rx - 7, sY - 30); ctx.lineTo(rx + 7, sY - 30); ctx.stroke();
      ctx.fillStyle = colors.ink3; ctx.font = "10px 'Space Mono', monospace"; ctx.textBaseline = "bottom";
      ctx.fillText("WELL OF THE DAY · " + DAY, 10, sY - 6);
    }
    // landing window at 4,000 ft
    var lTop = sy(V_TD - 170), lBot = sy(V_TD), lx0 = g.landing.fx * W, lw = g.landing.fw * W;
    if (lTop < H + 10) {
      ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = colors.orange; ctx.lineWidth = 2; ctx.strokeRect(lx0, lTop, lw, lBot - lTop);
      ctx.globalAlpha = 0.12; ctx.fillStyle = colors.orange; ctx.fillRect(lx0, lTop, lw, lBot - lTop); ctx.restore();
      ctx.fillStyle = colors.orange; ctx.font = "11px 'Space Mono', monospace"; ctx.textBaseline = "bottom"; ctx.fillText("LANDING WINDOW", lx0 + 4, lTop - 4);
      ctx.strokeStyle = colors.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, lBot); ctx.lineTo(W, lBot); ctx.stroke();
    }
    if (g.survey > 0) { // survey: a guide line to the landing window
      ctx.save(); ctx.setLineDash([2, 5]); ctx.strokeStyle = colors.orange; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(g.x, sy(g.depth)); ctx.lineTo(lx0 + lw / 2, lTop); ctx.stroke(); ctx.restore();
    }
    // boulders (some stay hidden until you're close, unless a survey is running)
    g.boulders.forEach(function (b) {
      var y = sy(b.depth), bx = b.fx * W;
      if (y < -40 || y > H + 40) return;
      var alpha = 1;
      if (b.hidden && !b.hit && g.survey <= 0) alpha = Math.max(0, Math.min(1, (150 - (y - H * 0.32)) / 60));
      if (alpha <= 0) return;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (var a = 0; a <= 7; a++) { var ang = a / 7 * Math.PI * 2, rr = b.r * (0.82 + 0.18 * Math.sin(a * 2.3 + b.depth)), px = bx + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr; if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.closePath(); ctx.fillStyle = colors.paper2; ctx.fill();
      ctx.strokeStyle = b.hit || (b.hidden && g.survey > 0) ? colors.orange : colors.ink; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.save(); ctx.clip(); ctx.strokeStyle = colors.hatch; ctx.lineWidth = 1;
      for (var k = -b.r; k < b.r * 2; k += 5) { ctx.beginPath(); ctx.moveTo(bx - b.r + k, y - b.r); ctx.lineTo(bx - b.r + k - b.r, y + b.r); ctx.stroke(); }
      ctx.restore(); ctx.globalAlpha = 1;
    });
    g.items.forEach(function (p) { if (p.got) return; var y = sy(p.depth); if (y < -20 || y > H + 20) return; drawItem(p.type, p.fx * W, y); });
    // well path
    ctx.strokeStyle = colors.ink; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.beginPath();
    var started = false;
    for (var i = 0; i < g.trail.length; i++) {
      var t = g.trail[i], ty = sy(t.depth);
      if (ty < -20 && i < g.trail.length - 1 && sy(g.trail[i + 1].depth) < -20) continue;
      if (!started) { ctx.moveTo(t.x, ty); started = true; } else ctx.lineTo(t.x, ty);
    }
    ctx.lineTo(g.x, sy(g.depth)); ctx.stroke();
    drawBit(g.x, sy(g.depth), -g.angle);
  }

  function drawLat() {
    var bx = W * 0.3;
    function X(lx) { return bx + (lx - g.lx) * PX_L; }
    ctx.fillStyle = patterns.shale; ctx.fillRect(0, 0, W, H);
    // pay zone band
    var from = Math.max(0, g.lx - bx / PX_L - 20), to = Math.min(LAT_LEN + 40, g.lx + (W - bx) / PX_L + 20), step = 8;
    ctx.beginPath();
    for (var a = from; a <= to; a += step) { var xa = X(a), ya = zoneC(a) - zoneH(a); if (a === from) ctx.moveTo(xa, ya); else ctx.lineTo(xa, ya); }
    for (var b = to; b >= from; b -= step) ctx.lineTo(X(b), zoneC(b) + zoneH(b));
    ctx.closePath(); ctx.fillStyle = colors.paper; ctx.fill(); ctx.fillStyle = patterns.pay; ctx.fill();
    ctx.strokeStyle = colors.orange; ctx.lineWidth = 1.5; ctx.stroke();
    // start and end markers
    ctx.strokeStyle = colors.ink; ctx.lineWidth = 1.5; ctx.font = "10px 'Space Mono', monospace"; ctx.textBaseline = "top";
    [[0, "HEEL · 4,000 FT"], [LAT_LEN, "TD · 5,000 FT"]].forEach(function (m) {
      var x = X(m[0]); if (x < -80 || x > W + 10) return;
      ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = colors.paper; ctx.fillRect(x + 4, H - 20, ctx.measureText(m[1]).width + 8, 14); ctx.fillStyle = colors.ink3; ctx.fillText(m[1], x + 8, H - 18);
    });
    g.latItems.forEach(function (p) { if (p.got) return; var x = X(p.lx); if (x < -20 || x > W + 20) return; drawItem(p.type, x, zoneC(p.lx) + p.off * zoneH(p.lx)); });
    // well path: down from the surface, round the curve, then along the lateral
    ctx.strokeStyle = colors.ink; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.beginPath();
    var x0 = X(0), y0 = g.ltrail[0].ly;
    ctx.moveTo(x0 - 46, -4); ctx.lineTo(x0 - 46, y0 - 46); ctx.quadraticCurveTo(x0 - 46, y0, x0, y0);
    g.ltrail.forEach(function (t) { ctx.lineTo(X(t.lx), t.ly); });
    ctx.lineTo(bx, g.ly); ctx.stroke();
    drawBit(bx, g.ly, -Math.PI / 2 + Math.max(-0.5, Math.min(0.5, g.vy / 260)));
  }

  function draw() {
    readTheme();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = colors.paper; ctx.fillRect(0, 0, W, H);
    if (!g) newGame();
    if (g.phase === "lat") drawLat(); else drawVert();
    drawFx();
    drawHud();
  }

  function box(x, y, w, h) { ctx.fillStyle = colors.paper; ctx.fillRect(x, y, w, h); ctx.strokeStyle = colors.ink; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w, h); }
  function banner(title, sub, color) {
    ctx.fillStyle = colors.scrim; ctx.fillRect(W / 2 - 160, H / 2 - 36, 320, 72);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(W / 2 - 160, H / 2 - 36, 320, 72);
    ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = color; ctx.font = "13px 'Space Mono', monospace"; ctx.fillText(title, W / 2, H / 2 - 22);
    ctx.fillStyle = colors.ink; ctx.font = "11px 'Space Mono', monospace"; ctx.fillText(sub, W / 2, H / 2 + 4); ctx.textAlign = "start";
  }
  function drawHud() {
    ctx.font = "11px 'Space Mono', monospace"; ctx.textBaseline = "top";
    var small = W < 480;
    var l1 = g.phase === "lat" ? "LATERAL " + Math.round(g.lx).toLocaleString("en-US") + " / 1,000 FT" : "DEPTH " + Math.round(g.depth).toLocaleString("en-US") + " FT";
    var l2 = g.phase === "lat" ? "IN ZONE " + (g.latTime ? Math.round(g.zoneTime / g.latTime * 100) : 100) + "%" : "ROCK " + ROCK[layerAt(g.depth).kind].name.toUpperCase();
    box(8, 8, small ? 150 : 190, 40);
    ctx.fillStyle = colors.ink; ctx.fillText(l1, 16, 14); ctx.fillStyle = colors.ink3; ctx.fillText(l2, 16, 30);
    // score
    var sc = "SCORE " + Math.round(g.score).toLocaleString("en-US");
    if (!small) { var sw = ctx.measureText(sc).width + 20; box(W / 2 - sw / 2, 8, sw, 22); ctx.fillStyle = colors.orange; ctx.textAlign = "center"; ctx.fillText(sc, W / 2, 14); ctx.textAlign = "start"; }
    // parts
    var bw = small ? 96 : 120, x0 = W - bw - 20;
    box(x0 - 8, 8, bw + 20, 40);
    ctx.fillStyle = colors.ink3; ctx.fillText(small ? sc : "PARTS  ·  WAITS " + g.waits, x0, 14);
    ctx.strokeStyle = colors.ink; ctx.strokeRect(x0 + 0.5, 30.5, bw, 10);
    ctx.fillStyle = g.expedite > 0 || g.parts < 25 ? colors.orange : colors.ink; ctx.fillRect(x0 + 2, 32, (bw - 3) * g.parts / 100, 7);
    // active boosts
    var tags = [];
    if (g.expedite > 0) tags.push("EXPEDITED " + g.expedite.toFixed(0) + "s");
    if (g.survey > 0) tags.push("SURVEY " + g.survey.toFixed(0) + "s");
    if (g.failIn > 0) tags.push("BAD PART ON BOARD");
    tags.forEach(function (t, i) { var tw = ctx.measureText(t).width + 12; ctx.fillStyle = colors.orange; ctx.fillRect(8, 54 + i * 20, tw, 16); ctx.fillStyle = colors.paper; ctx.fillText(t, 14, 57 + i * 20); });

    if (g.phase === "turn") banner(g.landed ? "LANDED IN THE WINDOW" : "MISSED THE WINDOW", "Turning the well sideways. Hold to climb.", colors.orange);
    else if (g.wait > 0) banner("WAITING ON SUPPLIER", "Lead time " + Math.max(0, g.wait).toFixed(1) + " s", colors.orange);
    else if (g.failMsg > 0) banner("TOOL FAILURE", "A counterfeit part gave out", colors.orange);
    else if (g.phase === "lat" && g.latTime > 0.4 && Math.abs(g.ly - zoneC(g.lx)) > zoneH(g.lx)) { ctx.fillStyle = colors.orange; ctx.textAlign = "center"; ctx.fillText("OUT OF ZONE", W / 2, 40); ctx.textAlign = "start"; }
  }

  /* ---------- Loop ---------- */
  function frame(t) {
    if (state !== "running") return;
    var dt = Math.min(0.05, (t - lastT) / 1000 || 0);
    lastT = t;
    update(dt);
    if (state === "running") { draw(); requestAnimationFrame(frame); }
  }
  function start() {
    newGame(); sfxInit();
    state = "running"; hold = false;
    $("game-start").hidden = true; $("game-end").hidden = true;
    lastT = performance.now();
    document.body.classList.add("playing");
    var r = wrap.getBoundingClientRect();
    if (r.top < 60 || r.bottom > window.innerHeight) window.scrollTo({ top: window.scrollY + r.top - (window.innerHeight - r.height) / 2, behavior: "smooth" });
    requestAnimationFrame(frame);
  }

  function getNum(k) { try { var v = parseFloat(localStorage.getItem(k)); return isNaN(v) ? null : v; } catch (e) { return null; } }
  function finish() {
    state = "done"; hold = false;
    var zonePct = g.latTime ? g.zoneTime / g.latTime : 0;
    var zoneBonus = Math.round(PTS.zone * zonePct), timeBonus = Math.max(0, Math.round(PTS.timeMax - PTS.timePer * g.time));
    g.score += zoneBonus + timeBonus;
    var score = Math.round(g.score);
    draw(); document.body.classList.remove("playing"); sfxStopHum();
    if (zonePct >= 0.6) SFX.win(); else SFX.miss();

    var best = getNum("bl-best-score"), isBest = best == null || score > best;
    if (isBest) { best = score; try { localStorage.setItem("bl-best-score", String(score)); } catch (e) {} }
    $("end-tag").textContent = isBest ? "New personal best" : "Total depth · 5,000 ft";
    $("end-score").textContent = score.toLocaleString("en-US");
    $("st-time").textContent = g.time.toFixed(1) + " s  (+" + timeBonus.toLocaleString("en-US") + ")";
    $("st-parts").textContent = g.good + " approved";
    $("st-bad").textContent = g.bad === 0 ? "None" : g.bad + " taken";
    $("st-waits").textContent = g.waits;
    $("st-zone").textContent = Math.round(zonePct * 100) + "%  (+" + zoneBonus.toLocaleString("en-US") + ")";
    $("st-land").textContent = g.landed ? "In the window" : "Missed";
    $("st-best").textContent = best.toLocaleString("en-US");
    var line;
    if (g.bad > 0) line = "You took " + g.bad + " counterfeit part" + (g.bad === 1 ? "" : "s") + ". This is why suppliers get audited.";
    else if (g.waits > 0) line = "You waited on suppliers " + g.waits + (g.waits === 1 ? " time" : " times") + ". That's " + (g.waits * WAIT_TIME).toFixed(1) + " s of rig time.";
    else line = "No counterfeits and no waiting on parts. A clean supply chain.";
    $("end-line").textContent = line;
    $("game-share").setAttribute("data-share", "I scored " + score.toLocaleString("en-US") + " on the well of the day (" + DAY + ") on Bill Le's site, with " + Math.round(zonePct * 100) + "% in the pay zone.");
    $("game-end").hidden = false;
    updateBestLine();
    if (window.BL) { window.BL.store.set("bl-td", "1"); document.documentElement.classList.add("td-reached"); }
  }
  function updateBestLine() {
    var node = $("best-line"); if (!node) return;
    var b = getNum("bl-best-score");
    node.textContent = "Well of the day · " + DAY + (b != null ? " · Your best: " + b.toLocaleString("en-US") : "");
  }

  /* ---------- Input ---------- */
  function isKey(e) { return e.code === "Space" || e.code === "ArrowRight" || e.code === "ArrowUp" || e.code === "KeyD" || e.code === "KeyW"; }
  window.addEventListener("keydown", function (e) { if (state === "running" && isKey(e)) { hold = true; e.preventDefault(); } });
  window.addEventListener("keyup", function (e) { if (isKey(e)) hold = false; });
  canvas.addEventListener("pointerdown", function (e) { if (state === "running") { hold = true; e.preventDefault(); } });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { canvas.addEventListener(ev, function () { hold = false; }); });
  window.addEventListener("blur", function () { hold = false; });
  $("game-share").addEventListener("click", function () {
    var b = this, text = b.getAttribute("data-share") || "";
    function ok() { var o = b.textContent; b.textContent = "Copied"; setTimeout(function () { b.textContent = o; }, 1500); }
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(ok, function () {});
  });
  $("game-go").addEventListener("click", start);
  $("game-again").addEventListener("click", start);
  window.addEventListener("resize", resize);
  new MutationObserver(function () { if (state !== "running") draw(); }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  updateBestLine();
  resize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (state !== "running") draw(); });
})();
