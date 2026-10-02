/* Steer the bit: a one-button drilling game.
   Hold to steer right, let go to drift left. Pick up parts to keep drilling.
   Land inside the target zone at 5,000 ft. */
(function () {
  "use strict";
  var wrap = document.getElementById("game");
  var canvas = document.getElementById("game-canvas");
  if (!wrap || !canvas) return;
  var ctx = canvas.getContext("2d");

  var TD = 5000;              // total depth, ft
  var PX_PER_FT = 0.55;       // vertical scale
  var DRAIN = 7.5;            // parts used per second
  var WAIT_TIME = 2.2;        // seconds lost waiting on a supplier
  var ROCK = {
    sand:    { name: "Sandstone", vi: "Sa thạch", speed: 1.0 },
    shale:   { name: "Shale",     vi: "Đá phiến", speed: 0.85 },
    lime:    { name: "Limestone", vi: "Đá vôi",   speed: 0.62 },
    granite: { name: "Granite",   vi: "Đá granit", speed: 0.5 }
  };

  /* ---------- Sound effects (off when the visitor turned music off) ---------- */
  var sfx = { ctx: null, hum: null, humGain: null };
  function sfxOn() { try { return localStorage.getItem("bl-music") !== "off"; } catch (e) { return true; } }
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
    sfx.humGain.gain.setTargetAtTime(0.05, c.currentTime, 0.3);
  }
  function sfxHum(speed, quiet) {
    if (!sfx.hum) return;
    var t = sfx.ctx.currentTime;
    sfx.hum.frequency.setTargetAtTime(40 + speed * 28, t, 0.2);
    sfx.humGain.gain.setTargetAtTime(quiet ? 0.008 : 0.05, t, 0.1);
  }
  function sfxStopHum() {
    if (!sfx.hum) return;
    var h = sfx.hum, g = sfx.humGain; g.gain.setTargetAtTime(0, sfx.ctx.currentTime, 0.15);
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
  }
  var SFX = {
    part: function () { tone(1318.5, 0, 0.18, "sine", 0.07); tone(1975.5, 0.06, 0.22, "sine", 0.05); },
    hit: thump,
    wait: function () { tone(233, 0, 0.18, "square", 0.025); tone(196, 0.16, 0.3, "square", 0.025); },
    refill: function () { tone(784, 0, 0.12, "sine", 0.05); tone(1047, 0.08, 0.2, "sine", 0.05); },
    win: function () { [523.3, 659.3, 784, 1046.5].forEach(function (f, i) { tone(f, i * 0.09, 0.5, "triangle", 0.07); }); },
    miss: function () { tone(392, 0, 0.25, "triangle", 0.06); tone(311, 0.18, 0.45, "triangle", 0.06); }
  };

  var W = 720, H = 480, dpr = 1;
  var colors = {}, patterns = {}, themeKey = "";
  var state = "idle", hold = false, lastT = 0;
  var g = null;

  function vi() { return document.documentElement.getAttribute("lang") === "vi"; }
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#13233A"; }

  /* ---------- Size and theme ---------- */
  function resize() {
    var w = wrap.clientWidth;
    W = w;
    H = Math.round(Math.max(340, Math.min(520, w * 0.66, window.innerHeight - 120)));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (state !== "running") draw();
  }

  function makePattern(kind) {
    var c = document.createElement("canvas");
    var s = { sand: 10, shale: 7, lime: 24, granite: 12 }[kind];
    var w = kind === "lime" ? 24 : s, h = kind === "lime" ? 14 : s;
    c.width = w; c.height = h;
    var p = c.getContext("2d");
    p.strokeStyle = colors.hatch; p.fillStyle = colors.hatch; p.lineWidth = 1;
    if (kind === "sand") { p.beginPath(); p.arc(2.5, 2.5, 1, 0, 6.3); p.arc(7.5, 7.5, 1, 0, 6.3); p.fill(); }
    if (kind === "shale") { p.beginPath(); p.moveTo(0, 0.5); p.lineTo(w, 0.5); p.stroke(); }
    if (kind === "lime") {
      p.beginPath(); p.moveTo(0, 0.5); p.lineTo(w, 0.5); p.moveTo(0, 7.5); p.lineTo(w, 7.5);
      p.moveTo(0.5, 0); p.lineTo(0.5, 7); p.moveTo(12.5, 7); p.lineTo(12.5, 14); p.stroke();
    }
    if (kind === "granite") { p.beginPath(); p.moveTo(0, s); p.lineTo(s, 0); p.moveTo(0, 0); p.lineTo(s, s); p.stroke(); }
    return ctx.createPattern(c, "repeat");
  }

  function readTheme() {
    var key = document.body.className;
    if (key === themeKey && patterns.sand) return;
    themeKey = key;
    colors = {
      paper: css("--paper"), paper2: css("--paper-2"), ink: css("--ink"), ink2: css("--ink-2"), ink3: css("--ink-3"),
      orange: css("--orange"), hatch: css("--hatch"), grid: css("--grid-strong"), scrim: css("--scrim")
    };
    ["sand", "shale", "lime", "granite"].forEach(function (k) { patterns[k] = makePattern(k); });
  }

  /* ---------- New run ---------- */
  function rand(a, b) { return a + Math.random() * (b - a); }

  function newGame() {
    var layers = [], d = 0, kinds = ["sand", "shale", "lime", "sand", "granite", "shale", "lime", "granite"];
    var k = 0;
    layers.push({ top: 0, bottom: 320, kind: "sand" });
    d = 320;
    while (d < TD + 400) {
      var t = rand(260, 560);
      var kind = kinds[(k++ + Math.floor(rand(0, 2))) % kinds.length];
      layers.push({ top: d, bottom: d + t, kind: kind });
      d += t;
    }
    var boulders = [], parts = [];
    layers.forEach(function (L) {
      if (L.top < 350) return;
      var hard = L.kind === "lime" || L.kind === "granite";
      var n = hard ? Math.floor(rand(2, 4)) : Math.floor(rand(0, 2));
      for (var i = 0; i < n; i++) {
        var depth = rand(L.top + 30, Math.min(L.bottom - 30, TD - 250));
        if (depth > L.top) boulders.push({ x: rand(30, W - 30), depth: depth, r: rand(14, 26), hit: false });
      }
    });
    for (var pd = 260; pd < TD - 120; pd += rand(140, 210)) {
      var px = rand(24, W - 24), tries = 0;
      while (tries++ < 8 && boulders.some(function (b) { return Math.abs(b.depth - pd) < 50 && Math.abs(b.x - px) < b.r + 26; })) px = rand(24, W - 24);
      parts.push({ x: px, depth: pd, got: false, spin: rand(0, 6) });
    }
    var tw = Math.max(110, W * 0.26);
    g = {
      x: W / 2, depth: 0, angle: 0, parts: 100, picked: 0, waits: 0, time: 0,
      stall: 0, wait: 0, shake: 0, trail: [{ x: W / 2, depth: 0 }],
      layers: layers, boulders: boulders, items: parts,
      target: { x: rand(W * 0.08, W * 0.92 - tw), w: tw }
    };
  }

  function layerAt(depth) {
    for (var i = 0; i < g.layers.length; i++) if (depth < g.layers[i].bottom) return g.layers[i];
    return g.layers[g.layers.length - 1];
  }

  /* ---------- Update ---------- */
  function update(dt) {
    g.time += dt;
    var L = layerAt(g.depth), rock = ROCK[L.kind];

    if (g.wait > 0) {                       // waiting on a supplier
      g.wait -= dt; sfxHum(0, true);
      if (g.wait <= 0) { g.parts = 45; SFX.refill(); }
      return;
    }
    if (g.stall > 0) { g.stall -= dt; g.shake = g.stall; sfxHum(0, true); return; }
    sfxHum(rock.speed, false);

    var maxA = 0.8, turn = 2.0;
    var targetA = hold ? maxA : -maxA;
    g.angle += Math.max(-turn * dt, Math.min(turn * dt, targetA - g.angle));

    var down = 205 * rock.speed * (0.55 + 0.45 * Math.cos(g.angle));
    var side = 200 * Math.sin(g.angle) * (0.6 + 0.4 * rock.speed);
    g.depth = Math.min(TD, g.depth + down * dt);
    g.x += side * dt;
    if (g.x < 10) { g.x = 10; g.angle = Math.max(g.angle, 0); }
    if (g.x > W - 10) { g.x = W - 10; g.angle = Math.min(g.angle, 0); }

    var last = g.trail[g.trail.length - 1];
    if (Math.abs(last.depth - g.depth) * PX_PER_FT + Math.abs(last.x - g.x) > 3) g.trail.push({ x: g.x, depth: g.depth });

    g.parts -= DRAIN * dt;
    if (g.parts <= 0) { g.parts = 0; g.waits++; g.wait = WAIT_TIME; SFX.wait(); }

    g.items.forEach(function (p) {
      if (p.got) return;
      var dy = (p.depth - g.depth) * PX_PER_FT, dx = p.x - g.x;
      if (dx * dx + dy * dy < 17 * 17) { p.got = true; g.picked++; g.parts = Math.min(100, g.parts + 22); SFX.part(); g.flash = 0.25; }
    });
    g.boulders.forEach(function (b) {
      if (b.hit) return;
      var dy = (b.depth - g.depth) * PX_PER_FT, dx = b.x - g.x;
      var rr = b.r + 6;
      if (dx * dx + dy * dy < rr * rr) {
        b.hit = true; g.stall = 0.7; g.parts = Math.max(0, g.parts - 15); SFX.hit();
        g.x += dx > 0 ? -10 : 10;
      }
    });

    var tb = document.querySelector(".title-block-fixed .tb-depth");
    if (tb) tb.textContent = Math.round(g.depth).toLocaleString("en-US") + " ft";

    if (g.depth >= TD) finish();
  }

  /* ---------- Draw ---------- */
  function sy(depth) { return H * 0.32 + (depth - (g ? g.depth : 0)) * PX_PER_FT; }

  function draw() {
    readTheme();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = colors.paper; ctx.fillRect(0, 0, W, H);
    if (!g) newGame();

    var camDepth = g.depth;
    var topDepth = camDepth - (H * 0.32) / PX_PER_FT, botDepth = camDepth + (H * 0.68) / PX_PER_FT;

    // Sky above the surface
    // Rock layers with hatch
    ctx.save();
    ctx.translate(0, H * 0.32 - camDepth * PX_PER_FT);
    g.layers.forEach(function (L) {
      if (L.bottom < topDepth || L.top > botDepth) return;
      ctx.fillStyle = patterns[L.kind];
      ctx.fillRect(0, L.top * PX_PER_FT, W, (L.bottom - L.top) * PX_PER_FT);
    });
    ctx.restore();

    ctx.font = "10px 'Space Mono', monospace";
    ctx.textBaseline = "bottom";
    g.layers.forEach(function (L) {
      if (L.top < topDepth - 10 || L.top > botDepth) return;
      var y = Math.round(sy(L.top)) + 0.5;
      ctx.strokeStyle = colors.ink3; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      if (L.top > 0) {
        var label = (vi() ? ROCK[L.kind].vi : ROCK[L.kind].name).toUpperCase() + " · " + Math.round(L.top).toLocaleString("en-US") + " FT";
        ctx.fillStyle = colors.paper; ctx.fillRect(6, y + 3, ctx.measureText(label).width + 8, 14);
        ctx.fillStyle = colors.ink3; ctx.textBaseline = "top"; ctx.fillText(label, 10, y + 5); ctx.textBaseline = "bottom";
      }
    });

    // Surface and rig
    var sY = sy(0);
    if (sY > -40) {
      ctx.fillStyle = colors.paper; ctx.fillRect(0, 0, W, Math.max(0, sY));
      ctx.strokeStyle = colors.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, sY); ctx.lineTo(W, sY); ctx.stroke();
      var rx = g.trail[0].x;
      ctx.beginPath(); ctx.moveTo(rx - 18, sY); ctx.lineTo(rx, sY - 46); ctx.lineTo(rx + 18, sY);
      ctx.moveTo(rx - 12, sY - 15); ctx.lineTo(rx + 12, sY - 15); ctx.moveTo(rx - 7, sY - 30); ctx.lineTo(rx + 7, sY - 30); ctx.stroke();
      ctx.fillStyle = colors.ink3; ctx.font = "10px 'Space Mono', monospace";
      ctx.fillText(vi() ? "MẶT ĐẤT · 0 FT" : "SURFACE · 0 FT", 10, sY - 6);
    }

    // Target zone
    var tTop = sy(TD - 160), tBot = sy(TD);
    if (tTop < H + 10) {
      ctx.save();
      ctx.setLineDash([6, 5]); ctx.strokeStyle = colors.orange; ctx.lineWidth = 2;
      ctx.strokeRect(g.target.x, tTop, g.target.w, tBot - tTop);
      ctx.globalAlpha = 0.12; ctx.fillStyle = colors.orange; ctx.fillRect(g.target.x, tTop, g.target.w, tBot - tTop);
      ctx.restore();
      ctx.fillStyle = colors.orange; ctx.font = "11px 'Space Mono', monospace"; ctx.textBaseline = "bottom";
      ctx.fillText(vi() ? "MỤC TIÊU" : "TARGET", g.target.x + 4, tTop - 4);
      ctx.strokeStyle = colors.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, tBot); ctx.lineTo(W, tBot); ctx.stroke();
      ctx.fillStyle = colors.ink3; ctx.font = "10px 'Space Mono', monospace";
      ctx.fillText("TD · 5,000 FT", W - 110, tBot - 4);
    }

    // Boulders
    g.boulders.forEach(function (b) {
      var y = sy(b.depth);
      if (y < -40 || y > H + 40) return;
      ctx.beginPath();
      for (var a = 0; a <= 7; a++) {
        var ang = a / 7 * Math.PI * 2, rr = b.r * (0.82 + 0.18 * Math.sin(a * 2.3 + b.depth));
        var px = b.x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr;
        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = colors.paper2; ctx.fill();
      ctx.strokeStyle = b.hit ? colors.orange : colors.ink; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.save(); ctx.clip(); ctx.strokeStyle = colors.hatch; ctx.lineWidth = 1;
      for (var k = -b.r; k < b.r * 2; k += 5) { ctx.beginPath(); ctx.moveTo(b.x - b.r + k, y - b.r); ctx.lineTo(b.x - b.r + k - b.r, y + b.r); ctx.stroke(); }
      ctx.restore();
    });

    // Parts (small machined rings)
    g.items.forEach(function (p) {
      if (p.got) return;
      var y = sy(p.depth);
      if (y < -20 || y > H + 20) return;
      ctx.strokeStyle = colors.orange; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, y, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, y, 2.5, 0, Math.PI * 2); ctx.stroke();
    });

    // Well path
    ctx.strokeStyle = colors.ink; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
    ctx.beginPath();
    var started = false;
    for (var i = 0; i < g.trail.length; i++) {
      var t = g.trail[i], ty = sy(t.depth);
      if (ty < -20 && i < g.trail.length - 1 && sy(g.trail[i + 1].depth) < -20) continue;
      if (!started) { ctx.moveTo(t.x, ty); started = true; } else ctx.lineTo(t.x, ty);
    }
    ctx.lineTo(g.x, sy(g.depth));
    ctx.stroke();

    // Pickup flash
    if (g.flash > 0) {
      g.flash -= 1 / 60;
      ctx.strokeStyle = colors.orange; ctx.lineWidth = 2; ctx.globalAlpha = Math.max(0, g.flash * 4);
      ctx.beginPath(); ctx.arc(g.x, sy(g.depth), 10 + (0.25 - g.flash) * 80, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Bit
    var shake = g.shake > 0 ? Math.sin(g.time * 90) * 3 : 0;
    var bx = g.x + shake, by = sy(g.depth);
    ctx.save();
    ctx.translate(bx, by); ctx.rotate(-g.angle);
    ctx.fillStyle = colors.ink; ctx.fillRect(-4, -18, 8, 14);
    ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(8, -4); ctx.lineTo(0, 9); ctx.closePath();
    ctx.fillStyle = colors.orange; ctx.fill();
    ctx.restore();

    drawHud();
  }

  function drawHud() {
    ctx.font = "11px 'Space Mono', monospace"; ctx.textBaseline = "top";
    var L = layerAt(g.depth);
    var lines = [
      (vi() ? "ĐỘ SÂU " : "DEPTH ") + Math.round(g.depth).toLocaleString("en-US") + " FT",
      (vi() ? "ĐÁ " : "ROCK ") + (vi() ? ROCK[L.kind].vi : ROCK[L.kind].name).toUpperCase()
    ];
    ctx.fillStyle = colors.paper; ctx.fillRect(8, 8, 168, 40);
    ctx.strokeStyle = colors.ink; ctx.lineWidth = 1; ctx.strokeRect(8.5, 8.5, 168, 40);
    ctx.fillStyle = colors.ink; ctx.fillText(lines[0], 16, 14); ctx.fillStyle = colors.ink3; ctx.fillText(lines[1], 16, 30);

    var bw = 120, x0 = W - bw - 20;
    ctx.fillStyle = colors.paper; ctx.fillRect(x0 - 8, 8, bw + 20, 40);
    ctx.strokeStyle = colors.ink; ctx.strokeRect(x0 - 7.5, 8.5, bw + 20, 40);
    ctx.fillStyle = colors.ink3; ctx.fillText((vi() ? "LINH KIỆN" : "PARTS") + "  ·  " + (vi() ? "CHỜ " : "WAITS ") + g.waits, x0, 14);
    ctx.strokeStyle = colors.ink; ctx.strokeRect(x0 + 0.5, 30.5, bw, 10);
    ctx.fillStyle = g.parts < 25 ? colors.orange : colors.ink; ctx.fillRect(x0 + 2, 32, (bw - 3) * g.parts / 100, 7);

    if (g.wait > 0) {
      var msg = vi() ? "ĐANG CHỜ NHÀ CUNG CẤP" : "WAITING ON SUPPLIER";
      var sub = (vi() ? "Thời gian chờ " : "Lead time ") + Math.max(0, g.wait).toFixed(1) + " s";
      ctx.fillStyle = colors.scrim; ctx.fillRect(W / 2 - 150, H / 2 - 36, 300, 72);
      ctx.strokeStyle = colors.orange; ctx.lineWidth = 2; ctx.strokeRect(W / 2 - 150, H / 2 - 36, 300, 72);
      ctx.textAlign = "center"; ctx.fillStyle = colors.orange; ctx.font = "13px 'Space Mono', monospace";
      ctx.fillText(msg, W / 2, H / 2 - 22);
      ctx.fillStyle = colors.ink; ctx.font = "11px 'Space Mono', monospace"; ctx.fillText(sub, W / 2, H / 2 + 4);
      ctx.textAlign = "start";
    }
  }

  /* ---------- Loop ---------- */
  function frame(t) {
    if (state !== "running") return;
    var dt = Math.min(0.05, (t - lastT) / 1000 || 0);
    lastT = t;
    update(dt);
    draw();
    if (state === "running") requestAnimationFrame(frame);
  }

  function start() {
    newGame();
    sfxInit();
    state = "running"; hold = false;
    document.getElementById("game-start").hidden = true;
    document.getElementById("game-end").hidden = true;
    lastT = performance.now();
    document.body.classList.add("playing");
    var r = wrap.getBoundingClientRect();
    if (r.top < 60 || r.bottom > window.innerHeight) window.scrollTo({ top: window.scrollY + r.top - (window.innerHeight - r.height) / 2, behavior: "smooth" });
    canvas.focus && canvas.focus();
    requestAnimationFrame(frame);
  }

  function finish() {
    state = "done"; hold = false; draw();
    document.body.classList.remove("playing");
    var hit = g.x >= g.target.x && g.x <= g.target.x + g.target.w;
    var V = vi();
    document.getElementById("st-time").textContent = g.time.toFixed(1) + " s";
    document.getElementById("st-parts").textContent = g.picked;
    document.getElementById("st-waits").textContent = g.waits;
    document.getElementById("st-target").textContent = hit ? (V ? "Trúng" : "Hit") : (V ? "Trượt" : "Missed");
    document.getElementById("end-title").textContent = hit ? (V ? "Vào đúng mục tiêu" : "You landed in the target") : (V ? "Suýt nữa thì trúng" : "Close. You missed the target");
    var line;
    if (g.waits === 0) line = V ? "Không mất giây nào để chờ linh kiện." : "No time lost waiting on parts.";
    else line = V ? ("Bạn đã chờ nhà cung cấp " + g.waits + " lần, mất " + (g.waits * WAIT_TIME).toFixed(1) + " giây thời gian giàn khoan.")
                  : ("You waited on suppliers " + g.waits + (g.waits === 1 ? " time" : " times") + ". That's " + (g.waits * WAIT_TIME).toFixed(1) + " s of rig time.");
    document.getElementById("end-line").textContent = line;
    sfxStopHum();
    if (hit) SFX.win(); else SFX.miss();
    var best = null, isBest = false;
    try { best = parseFloat(localStorage.getItem("bl-best")); } catch (e) {}
    if (hit && (!best || g.time < best)) { isBest = true; best = g.time; try { localStorage.setItem("bl-best", best.toFixed(1)); } catch (e) {} }
    document.getElementById("st-best").textContent = best ? best.toFixed(1) + " s" : (V ? "Chưa có" : "None yet");
    document.getElementById("end-tag").textContent = isBest ? (V ? "Kỷ lục mới" : "New personal best") : (V ? "Tới đáy giếng" : "Total depth");
    var share = hit
      ? "I landed the bit in the target in " + g.time.toFixed(1) + " s with " + g.waits + " supplier wait" + (g.waits === 1 ? "" : "s") + " on Bill Le's site."
      : "I drilled to 5,000 ft in " + g.time.toFixed(1) + " s on Bill Le's site but missed the target.";
    document.getElementById("game-share").setAttribute("data-share", share);
    updateBestLine();
    document.getElementById("game-end").hidden = false;
    if (window.BL) { window.BL.store.set("bl-td", "1"); document.documentElement.classList.add("td-reached"); }
  }

  /* ---------- Input ---------- */
  function isSteerKey(e) { return e.code === "Space" || e.code === "ArrowRight" || e.code === "KeyD"; }
  window.addEventListener("keydown", function (e) {
    if (state === "running" && isSteerKey(e)) { hold = true; e.preventDefault(); }
  });
  window.addEventListener("keyup", function (e) { if (isSteerKey(e)) hold = false; });
  canvas.addEventListener("pointerdown", function (e) { if (state === "running") { hold = true; e.preventDefault(); } });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { canvas.addEventListener(ev, function () { hold = false; }); });
  window.addEventListener("blur", function () { hold = false; });

  function updateBestLine() {
    var el = document.getElementById("best-line"); if (!el) return;
    var b = null; try { b = parseFloat(localStorage.getItem("bl-best")); } catch (e) {}
    el.textContent = b ? (vi() ? "Kỷ lục của bạn: " : "Your best: ") + b.toFixed(1) + " s" : "";
  }
  updateBestLine();
  document.getElementById("game-share").addEventListener("click", function () {
    var b = this, text = b.getAttribute("data-share") || "";
    function ok() { var o = b.textContent; b.textContent = vi() ? "Đã sao chép" : "Copied"; setTimeout(function () { b.textContent = o; }, 1500); }
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(ok, function () {}); 
  });
  document.getElementById("game-go").addEventListener("click", start);
  document.getElementById("game-again").addEventListener("click", start);
  window.addEventListener("resize", resize);
  document.addEventListener("bl:lang", function () { if (state !== "running") draw(); });
  new MutationObserver(function () { if (state !== "running") draw(); }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  resize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
})();
