/* Home page: a live cross-section of the well that drills as you scroll.
   - The bit follows the page depth. Drag it to scroll the page.
   - Mud pulses carry data up the pipe; cuttings rise while you move.
   - Four sidetracks branch off toward the projects and light up once visited.
   - A log curve on the right draws itself from how much content sits at each depth.
   - Casing is set as sections are passed, and the rig's block moves with the pipe.
   - At the target the well comes on production: oil flows to a small plant
     at the surface, the tanks fill, and the flare lights.
   Press a rock layer to jump to it.
   Below 1200px wide the view shrinks to a small card in the corner;
   press it to open the full view. */
(function () {
  "use strict";
  var canvas = document.getElementById("drill-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var readout = document.getElementById("drill-readout");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ROOT = (window.BL && window.BL.root) || "./";
  var TD = 5000, KOP = 3000, PAY = 4600;

  // Layers line up with the home page sections.
  var LAYERS = [
    { top: 0, bottom: 500, kind: "soil", name: "Surface", target: ".hero" },
    { top: 500, bottom: 1200, kind: "sand", name: "About", target: "#about-me" },
    { top: 1200, bottom: 2400, kind: "shale", name: "Journey", target: "#journey" },
    { top: 2400, bottom: 3600, kind: "lime", name: "Core samples", target: "#samples" },
    { top: 3600, bottom: 4200, kind: "granite", name: "Toolkit", target: "#skills" },
    { top: 4200, bottom: 4600, kind: "shale", name: "Now", target: "#now" },
    { top: 4600, bottom: 5000, kind: "target", name: "Target", target: "#contact" }
  ];
  var ROCK = { soil: "Topsoil", sand: "Sandstone", shale: "Shale", lime: "Limestone", granite: "Granite", target: "Pay zone" };
  // Sidetracks: one per project. "key" matches the sheet log kept by site.js.
  var LATERALS = [
    { code: "CS-01", depth: 2620, key: "04:CS-01", href: "projects/rig-count.html" },
    { code: "CS-02", depth: 2860, key: "04:CS-02", href: "projects/late-delivery.html" },
    { code: "CS-03", depth: 3100, key: "04:CS-03", href: "projects/ofs-financials.html" },
    { code: "CS-04", depth: 3340, key: "04:CS-04", href: "projects/melbourne-housing.html" }
  ];
  var CASING = [500, 1200, 2400, 3600];

  var W = 300, H = 600, dpr = 1, colors = {}, pats = {}, themeKey = "";
  var shown = 0, pulses = [], cuttings = [], oil = [], spin = 0, lastT = performance.now(), clock = 0;
  var tank = 0, flare = 0, dragging = false, dragged = false, visited = {};
  var TOP = 112, BOT = 22, LEFT = 34;
  var logBins = null, lastReadout = "";
  var compact = false; // true while the canvas is the small corner card
  var view = canvas.closest ? canvas.closest(".drill-view") : null;
  var smallMq = window.matchMedia ? window.matchMedia("(max-width: 1199.98px)") : null;
  function isSmall() { return !!(smallMq && smallMq.matches); }
  function isOpen() { return !!(view && view.classList.contains("open")); }

  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  function pattern(kind) {
    var c = document.createElement("canvas"), p = c.getContext("2d");
    var size = { soil: 9, sand: 8, shale: 6, lime: 20, granite: 10, target: 10 }[kind];
    c.width = size; c.height = kind === "lime" ? 12 : size;
    p.strokeStyle = kind === "target" ? colors.orange : colors.hatch;
    p.fillStyle = p.strokeStyle; p.lineWidth = 1;
    if (kind === "soil") { p.beginPath(); p.moveTo(0, 8); p.lineTo(4, 4); p.stroke(); }
    if (kind === "sand") { p.beginPath(); p.arc(2, 2, 0.9, 0, 6.3); p.arc(6, 6, 0.9, 0, 6.3); p.fill(); }
    if (kind === "shale") { p.beginPath(); p.moveTo(0, 0.5); p.lineTo(size, 0.5); p.stroke(); }
    if (kind === "lime") { p.beginPath(); p.moveTo(0, 0.5); p.lineTo(20, 0.5); p.moveTo(0, 6.5); p.lineTo(20, 6.5); p.moveTo(0.5, 0); p.lineTo(0.5, 6); p.moveTo(10.5, 6); p.lineTo(10.5, 12); p.stroke(); }
    if (kind === "granite") { p.beginPath(); p.moveTo(0, size); p.lineTo(size, 0); p.moveTo(0, 0); p.lineTo(size, size); p.stroke(); }
    if (kind === "target") { p.globalAlpha = 0.55; p.beginPath(); p.moveTo(0, size); p.lineTo(size, 0); p.stroke(); }
    return ctx.createPattern(c, "repeat");
  }
  function readTheme() {
    if (document.body.className === themeKey && pats.sand) return;
    themeKey = document.body.className;
    colors = { paper: css("--paper"), ink: css("--ink"), ink2: css("--ink-2"), ink3: css("--ink-3"), orange: css("--orange"), hatch: css("--hatch"), grid: css("--grid-strong"), shade: css("--shade") };
    ["soil", "sand", "shale", "lime", "granite", "target"].forEach(function (k) { pats[k] = pattern(k); });
  }
  function readVisited() {
    visited = {};
    try { JSON.parse(localStorage.getItem("bl-logged") || "[]").forEach(function (k) { visited[k] = true; }); } catch (e) {}
  }

  function resize() {
    var r = canvas.parentNode.getBoundingClientRect();
    compact = r.width < 140;
    W = Math.max(compact ? 40 : 220, r.width); H = Math.max(compact ? 70 : 200, r.height);
    TOP = compact ? 30 : (H < 420 ? 84 : 112); BOT = compact ? 5 : 22; LEFT = compact ? 0 : 34;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildLog();
  }

  /* ---------- Geometry ---------- */
  function right() { return compact ? W : W - 4; }
  function trackX() { return compact ? right() : right() - 30; } // log track on the right edge
  function yOf(d) { return TOP + (d / TD) * (H - TOP - BOT); }
  function dOfY(y) { return Math.max(0, Math.min(TD, (y - TOP) / (H - TOP - BOT) * TD)); }
  // A J-shaped well: straight down, then it builds angle toward the target after 3,000 ft.
  function xOf(d) {
    var cx = LEFT + (trackX() - LEFT) * 0.46;
    if (d <= KOP) return cx;
    var f = (d - KOP) / (TD - KOP);
    return cx + (trackX() - LEFT) * 0.24 * f * f;
  }
  function incAt(d) { if (d <= KOP + 40) return 0; return Math.round(Math.atan2(xOf(d) - xOf(d - 40), yOf(d) - yOf(d - 40)) * 57.3); }
  function layerAt(d) { for (var i = 0; i < LAYERS.length; i++) if (d < LAYERS[i].bottom) return LAYERS[i]; return LAYERS[LAYERS.length - 1]; }
  function latNode(L) { return { x: xOf(L.depth) - 44, y: yOf(L.depth) + 15 }; }

  /* ---------- Page position <-> depth (matches site.js) ---------- */
  function anchorPts() {
    return Array.prototype.map.call(document.querySelectorAll("[data-depth]"), function (a) {
      return { y: a.getBoundingClientRect().top + window.scrollY, d: +a.dataset.depth };
    });
  }
  function depthToPageY(d) {
    var pts = anchorPts(), docH = document.documentElement.scrollHeight;
    if (!pts.length) return 0;
    if (d <= pts[0].d) return pts[0].y;
    for (var i = 1; i < pts.length; i++) if (d < pts[i].d) return pts[i - 1].y + (pts[i].y - pts[i - 1].y) * (d - pts[i - 1].d) / (pts[i].d - pts[i - 1].d);
    var last = pts[pts.length - 1];
    return last.y + (docH - last.y) * Math.min(1, (d - last.d) / Math.max(1, TD - last.d));
  }
  function pageYToDepth(y) {
    var pts = anchorPts(), docH = document.documentElement.scrollHeight;
    if (!pts.length) return 0;
    if (y <= pts[0].y) return pts[0].d;
    for (var i = 1; i < pts.length; i++) if (y < pts[i].y) return pts[i - 1].d + (pts[i].d - pts[i - 1].d) * (y - pts[i - 1].y) / (pts[i].y - pts[i - 1].y);
    var last = pts[pts.length - 1];
    return last.d + (TD - last.d) * Math.min(1, (y - last.y) / Math.max(1, docH - last.y));
  }

  /* ---------- Log curve: how much content sits at each depth ---------- */
  function buildLog() {
    var n = 125, bins = new Array(n).fill(0);
    var nodes = document.querySelectorAll("main p, main h2, main h3, main li, main img, main .card-bp, main .bha-row, main svg");
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.closest(".drill-view") || node.closest(".picker") || node.closest(".intro")) return;
      var r = node.getBoundingClientRect();
      if (!r.height) return;
      var weight = node.tagName === "IMG" || node.tagName === "svg" ? 260 : Math.min(420, (node.textContent || "").trim().length);
      var d = pageYToDepth(r.top + window.scrollY + r.height / 2);
      var b = Math.max(0, Math.min(n - 1, Math.floor(d / TD * n)));
      bins[b] += weight;
    });
    var sm = bins.map(function (_, i) { var s = 0, c = 0; for (var k = -2; k <= 2; k++) if (bins[i + k] != null) { s += bins[i + k] * (3 - Math.abs(k)); c += 3 - Math.abs(k); } return s / c; });
    var max = Math.max.apply(null, sm) || 1;
    logBins = sm.map(function (v) { return v / max; });
  }

  /* ---------- Drawing ---------- */
  function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

  function drawSky() {
    var h = new Date().getHours(), day = h >= 6 && h < 19, x = LEFT + 14, y = 22;
    ctx.strokeStyle = colors.ink3; ctx.fillStyle = colors.ink3; ctx.lineWidth = 1;
    if (day) {
      ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.3); ctx.stroke();
      for (var i = 0; i < 8; i++) { var a = i / 8 * 6.283 + (reduceMotion ? 0 : clock * 0.15); line(x + Math.cos(a) * 9, y + Math.sin(a) * 9, x + Math.cos(a) * 12, y + Math.sin(a) * 12); }
    } else {
      ctx.beginPath(); ctx.arc(x, y, 7, 0.6, 5.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 3.5, y - 1.5, 5.5, 1.0, 4.6); ctx.stroke();
      [[40, 10], [70, 26], [108, 12], [150, 20], [200, 8]].forEach(function (s, i) {
        ctx.globalAlpha = reduceMotion ? 0.7 : 0.45 + 0.4 * Math.sin(clock * 1.3 + i * 1.7);
        ctx.fillRect(LEFT + s[0], s[1], 1.5, 1.5);
      });
      ctx.globalAlpha = 1;
    }
  }

  function drawRig(sx0, sy0) {
    var rs = compact ? 0.44 : 1, sx = 0, sy = 0;
    ctx.save(); ctx.translate(sx0, sy0); ctx.scale(rs, rs);
    ctx.strokeStyle = colors.ink; ctx.lineWidth = compact ? 2.5 : 1.3;
    ctx.beginPath();
    ctx.moveTo(sx - 20, sy); ctx.lineTo(sx - 4, sy - 58); ctx.lineTo(sx + 4, sy - 58); ctx.lineTo(sx + 20, sy);
    for (var k = 1; k < 4; k++) { var yy = sy - k * 14.5, wv = 20 - k * 4; ctx.moveTo(sx - wv, yy); ctx.lineTo(sx + wv, yy); }
    ctx.moveTo(sx - 16, sy - 14.5); ctx.lineTo(sx + 12, sy - 29); ctx.moveTo(sx + 16, sy - 14.5); ctx.lineTo(sx - 12, sy - 29);
    ctx.stroke();
    ctx.fillStyle = colors.ink; ctx.fillRect(sx - 6, sy - 62, 12, 4);          // crown
    ctx.fillRect(sx - 40, sy - 9, 13, 9);                                       // doghouse
    // Traveling block: one stand of pipe is about 90 ft, so it cycles as you drill
    var frac = (shown % 90) / 90, by = sy - 52 + frac * 30;
    ctx.strokeStyle = colors.ink2; ctx.lineWidth = 1; line(sx, sy - 58, sx, by);
    ctx.fillStyle = colors.orange; ctx.fillRect(sx - 4, by, 8, 6);
    ctx.strokeStyle = colors.ink; ctx.lineWidth = 2; line(sx, by + 6, sx, sy);
    ctx.restore();
  }

  function drawPlant(sx, sy, dt, producing) {
    var x0 = sx + 30, sep = sx + 44, t1 = sx + 84, t2 = sx + 106, fx = Math.min(trackX() + 22, W - 10);
    ctx.strokeStyle = colors.ink; ctx.lineWidth = 1.2; ctx.fillStyle = colors.paper;
    // flowline from the wellhead
    line(sx + 6, sy - 4, x0, sy - 4); line(x0, sy - 4, x0, sy - 13); line(x0, sy - 13, sep, sy - 13);
    // separator: a horizontal vessel on two legs
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(sep, sy - 20, 30, 13, 6) : ctx.rect(sep, sy - 20, 30, 13); ctx.fill(); ctx.stroke();
    line(sep + 6, sy - 7, sep + 6, sy); line(sep + 24, sy - 7, sep + 24, sy);
    line(sep + 15, sy - 20, sep + 15, sy - 30); line(sep + 15, sy - 30, fx, sy - 30);   // gas line to the flare
    line(sep + 30, sy - 12, t1, sy - 12);                                               // oil line to the tanks
    // two storage tanks with a level that rises on production
    [t1, t2].forEach(function (tx, i) {
      var w = 18, h = 30;
      ctx.fillStyle = colors.paper; ctx.fillRect(tx, sy - h, w, h);
      var lvl = Math.max(0, Math.min(1, tank - i * 0.35)) * (h - 4);
      ctx.globalAlpha = 0.75; ctx.fillStyle = colors.orange; ctx.fillRect(tx + 1, sy - 1 - lvl, w - 2, lvl); ctx.globalAlpha = 1;
      ctx.strokeRect(tx + 0.5, sy - h + 0.5, w - 1, h - 1);
      line(tx, sy - h, tx + w / 2, sy - h - 4); line(tx + w / 2, sy - h - 4, tx + w, sy - h);
    });
    line(t1 + 18, sy - 6, t2, sy - 6);
    // flare stack
    ctx.lineWidth = 1.6; line(fx, sy, fx, sy - 52); ctx.lineWidth = 1.2;
    flare += ((producing ? 1 : 0.22) - flare) * Math.min(1, dt * 2);
    var fl = flare * (reduceMotion ? 1 : 0.8 + 0.25 * Math.sin(clock * 17) + 0.12 * Math.sin(clock * 31));
    ctx.fillStyle = colors.orange;
    ctx.beginPath(); ctx.moveTo(fx - 4 * fl, sy - 52);
    ctx.quadraticCurveTo(fx - 5 * fl, sy - 52 - 9 * fl, fx + (reduceMotion ? 0 : Math.sin(clock * 9) * 2.5), sy - 52 - 17 * fl);
    ctx.quadraticCurveTo(fx + 5 * fl, sy - 52 - 9 * fl, fx + 4 * fl, sy - 52); ctx.closePath(); ctx.fill();
    // oil moving along the surface lines
    if (producing && !reduceMotion) {
      var path = [[sx + 6, sy - 4], [x0, sy - 4], [x0, sy - 13], [sep, sy - 13], [sep + 30, sy - 12], [t1, sy - 12]];
      var total = 0, segs = [];
      for (var i = 1; i < path.length; i++) { var l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); segs.push(l); total += l; }
      for (var k = 0; k < 4; k++) {
        var at = ((clock * 30 + k * total / 4) % total), j = 0;
        while (at > segs[j]) { at -= segs[j]; j++; }
        var a = path[j], b = path[j + 1], f = at / segs[j];
        ctx.beginPath(); ctx.arc(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 1.8, 0, 6.3); ctx.fill();
      }
    }
    ctx.font = "9px 'Space Mono', monospace"; ctx.fillStyle = colors.ink3; ctx.textBaseline = "alphabetic";
    ctx.fillText("PLANT", sep, sy - 36);
  }

  function boreTo(d, step) {
    ctx.beginPath();
    for (var q = 0; q <= d; q += step) { var qx = xOf(q), qy = yOf(q); if (!q) ctx.moveTo(qx, qy); else ctx.lineTo(qx, qy); }
    ctx.lineTo(xOf(d), yOf(d)); ctx.stroke();
  }

  function draw(now) {
    readTheme();
    var dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; clock += dt;
    var target = (window.BL && window.BL.depth) || 0;
    var prev = shown;
    shown += (target - shown) * Math.min(1, dt * 6);
    var moving = Math.abs(shown - prev) > 0.5;
    var producing = shown >= PAY;
    if (!reduceMotion) spin += dt * (moving ? 18 : 3);
    if (producing) tank = Math.min(1.25, tank + dt * 0.07);

    ctx.clearRect(0, 0, W, H);
    var R = right(), TX = trackX();

    // Rock layers
    LAYERS.forEach(function (L) {
      var y0 = yOf(L.top), y1 = yOf(L.bottom);
      ctx.fillStyle = pats[L.kind]; ctx.fillRect(LEFT, y0, TX - LEFT, y1 - y0);
      var active = (shown >= L.top && shown < L.bottom) || (L.bottom === TD && shown >= TD - 1);
      if (active) { ctx.fillStyle = colors.shade; ctx.fillRect(LEFT, y0, TX - LEFT, y1 - y0); }
      ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; line(LEFT, Math.round(y0) + 0.5, TX, Math.round(y0) + 0.5);
      if (L.top > 0 && !compact) {
        ctx.font = "10px 'Space Mono', monospace";
        var label = L.name.toUpperCase(), tw = ctx.measureText(label).width;
        ctx.fillStyle = colors.paper; ctx.fillRect(LEFT + 4, y0 + 4, tw + 8, 14);
        ctx.fillStyle = active ? colors.orange : colors.ink3; ctx.textBaseline = "top";
        ctx.fillText(label, LEFT + 8, y0 + 6);
      }
    });

    // Log track on the right: a curve shaped by the page's own content
    if (!compact) {
    ctx.fillStyle = colors.paper; ctx.fillRect(TX, yOf(0), R - TX, yOf(TD) - yOf(0));
    ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
    line(TX + (R - TX) / 2, yOf(0), TX + (R - TX) / 2, yOf(TD));
    }
    if (logBins && !compact) {
      ctx.strokeStyle = colors.ink; ctx.lineWidth = 1.2; ctx.beginPath();
      var n = logBins.length, lastI = Math.floor(shown / TD * n);
      for (var i = 0; i <= Math.min(n - 1, lastI); i++) {
        var lx = TX + 3 + logBins[i] * (R - TX - 6), ly = yOf((i + 0.5) / n * TD);
        if (!i) ctx.moveTo(lx, ly); else ctx.lineTo(lx, ly);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = colors.ink; ctx.lineWidth = 1;
    ctx.strokeRect(LEFT + 0.5, yOf(0) + 0.5, R - LEFT - 1, yOf(TD) - yOf(0));
    if (!compact) {
      line(TX + 0.5, yOf(0), TX + 0.5, yOf(TD));
      ctx.font = "9px 'Space Mono', monospace"; ctx.fillStyle = colors.ink3; ctx.textBaseline = "top";
      ctx.fillText("LOG", TX + 5, yOf(TD) + 5);
    }

    // Depth scale
    ctx.font = "10px 'Space Mono', monospace"; ctx.textBaseline = "middle"; ctx.fillStyle = colors.ink3;
    for (var d = 0; d <= TD && !compact; d += 500) {
      var y = Math.round(yOf(d)) + 0.5;
      ctx.strokeStyle = colors.ink3; line(LEFT - (d % 1000 ? 4 : 8), y, LEFT, y);
      if (d % 1000 === 0) { ctx.textAlign = "right"; ctx.fillText(d === 0 ? "0" : (d / 1000) + "k", LEFT - 10, y); ctx.textAlign = "left"; }
    }

    // Surface: sky, rig, and the plant
    var sx = xOf(0), sy = yOf(0);
    if (!compact) {
      if (TOP > 100) drawSky();
      ctx.strokeStyle = colors.ink; ctx.lineWidth = 1.3; line(LEFT - 8, sy, R + 2, sy);
      drawPlant(sx, sy, dt, producing);
    } else if (producing) {
      // Small card: a flare beside the rig says the well is on production
      flare += (1 - flare) * Math.min(1, dt * 2);
      var cfx = W - 9, cfl = flare * (reduceMotion ? 1 : 0.8 + 0.25 * Math.sin(clock * 17));
      ctx.strokeStyle = colors.ink; ctx.lineWidth = 1.2; line(cfx, sy, cfx, sy - 14);
      ctx.fillStyle = colors.orange; ctx.beginPath();
      ctx.moveTo(cfx - 2.5 * cfl, sy - 14); ctx.quadraticCurveTo(cfx, sy - 14 - 16 * cfl, cfx + 2.5 * cfl, sy - 14); ctx.closePath(); ctx.fill();
    }
    drawRig(sx, sy);

    // Planned path (dashed) and the target box
    ctx.setLineDash([3, 4]); ctx.strokeStyle = colors.ink3; ctx.lineWidth = 1;
    ctx.beginPath(); for (var p = 0; p <= TD; p += 50) { var px = xOf(p), py = yOf(p); if (!p) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke();
    ctx.setLineDash([]);
    var tbw = compact ? 7 : 14;
    ctx.strokeStyle = colors.orange; ctx.lineWidth = 1.5; ctx.strokeRect(xOf(TD) - tbw, yOf(4700), tbw * 2, yOf(TD) - yOf(4700));

    // Sidetracks to the projects
    ctx.font = "9px 'Space Mono', monospace"; ctx.textBaseline = "middle";
    (compact ? [] : LATERALS).forEach(function (L) {
      var bx0 = xOf(L.depth), by0 = yOf(L.depth), nd = latNode(L), seen = visited[L.key], passed = shown >= L.depth;
      ctx.strokeStyle = seen ? colors.orange : (passed ? colors.ink : colors.ink3);
      ctx.lineWidth = seen || passed ? 2 : 1; ctx.setLineDash(seen || passed ? [] : [3, 3]);
      ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.quadraticCurveTo(bx0 - 6, nd.y, nd.x + 5, nd.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(nd.x, nd.y, 4.5, 0, 6.3);
      ctx.fillStyle = seen ? colors.orange : colors.paper; ctx.fill(); ctx.lineWidth = 1.3; ctx.stroke();
      var tw = ctx.measureText(L.code).width;
      ctx.fillStyle = colors.paper; ctx.fillRect(nd.x - 9 - tw - 3, nd.y - 6, tw + 5, 12);
      ctx.fillStyle = seen ? colors.orange : colors.ink2; ctx.textAlign = "right"; ctx.fillText(L.code, nd.x - 9, nd.y + 0.5); ctx.textAlign = "left";
    });

    // Casing set above each section already passed
    ctx.strokeStyle = colors.ink2; ctx.lineWidth = 1;
    CASING.forEach(function (shoe, i) {
      if (compact || shown < shoe + 80) return;
      var hw = 8.5 - i * 1.2, x = xOf(shoe), ys = yOf(shoe);
      line(x - hw, yOf(0), x - hw, ys); line(x + hw, yOf(0), x + hw, ys);
      ctx.fillStyle = colors.ink2;
      ctx.beginPath(); ctx.moveTo(x - hw, ys); ctx.lineTo(x - hw - 4, ys); ctx.lineTo(x - hw, ys - 5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + hw, ys); ctx.lineTo(x + hw + 4, ys); ctx.lineTo(x + hw, ys - 5); ctx.closePath(); ctx.fill();
    });

    // The drilled hole
    ctx.strokeStyle = colors.ink; ctx.lineWidth = compact ? 4 : 6; ctx.lineCap = "round"; boreTo(shown, 25);
    ctx.strokeStyle = producing ? colors.orange : colors.paper; ctx.lineWidth = compact ? 1.3 : 2; boreTo(shown, 25);
    ctx.lineCap = "butt";

    // Mud pulses while drilling, oil flowing up once the well is on production
    if (!reduceMotion && shown > 60) {
      if (!producing) {
        if (!pulses.length || pulses[pulses.length - 1].d < shown - 260) pulses.push({ d: shown });
        pulses.forEach(function (pl) { pl.d -= dt * 900; });
        pulses = pulses.filter(function (pl) { return pl.d > 0 && pl.d <= shown; });
        ctx.fillStyle = colors.orange;
        pulses.forEach(function (pl) { ctx.beginPath(); ctx.arc(xOf(pl.d), yOf(pl.d), compact ? 1.5 : 2.2, 0, 6.3); ctx.fill(); });
      } else {
        if (!oil.length || oil[oil.length - 1].d < shown - 330) oil.push({ d: shown });
        oil.forEach(function (o) { o.d -= dt * 620; });
        oil = oil.filter(function (o) { return o.d > 0; });
        ctx.fillStyle = colors.paper;
        oil.forEach(function (o) { ctx.beginPath(); ctx.arc(xOf(o.d), yOf(o.d), compact ? 1.1 : 1.6, 0, 6.3); ctx.fill(); });
      }
    }

    // Cuttings rise while you scroll
    if (!reduceMotion && moving && cuttings.length < 60) {
      for (var c = 0; c < 2; c++) cuttings.push({ d: shown, off: (Math.random() < 0.5 ? -1 : 1) * (compact ? 3 + Math.random() * 2 : 5 + Math.random() * 3), life: 1 });
    }
    cuttings.forEach(function (ct) { ct.d -= dt * 260; ct.life -= dt * 0.9; });
    cuttings = cuttings.filter(function (ct) { return ct.life > 0 && ct.d > 0; });
    ctx.fillStyle = colors.ink2;
    cuttings.forEach(function (ct) { ctx.globalAlpha = Math.max(0, ct.life); ctx.fillRect(xOf(ct.d) + ct.off, yOf(ct.d), 1.6, 1.6); });
    ctx.globalAlpha = 1;

    // The bit (drag it to scroll)
    var bx = xOf(shown), by = yOf(shown);
    var ang = shown > KOP + 40 ? -Math.atan2(xOf(shown) - xOf(shown - 40), yOf(shown) - yOf(shown - 40)) : 0;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(ang);
    if (compact) ctx.scale(0.62, 0.62);
    if (dragging) { ctx.strokeStyle = colors.orange; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 6.3); ctx.stroke(); }
    ctx.fillStyle = colors.ink; ctx.fillRect(-4, -16, 8, 10);
    ctx.beginPath(); ctx.moveTo(-7, -6); ctx.lineTo(7, -6); ctx.lineTo(0, 8); ctx.closePath();
    ctx.fillStyle = colors.orange; ctx.fill();
    ctx.strokeStyle = colors.paper; ctx.lineWidth = 1;
    for (var tth = 0; tth < 3; tth++) { var o2 = ((spin + tth * 2.1) % 6.3) / 6.3, tx2 = -6 + o2 * 12; line(tx2, -5, tx2 * 0.5, 4); }
    ctx.restore();
    // depth flag (the small card shows the depth under the picture instead)
    if (!compact) {
      ctx.font = "10px 'Space Mono', monospace";
      var flag = Math.round(shown).toLocaleString("en-US") + " FT";
      var fw = ctx.measureText(flag).width + 10, fx = Math.min(bx + 12, TX - fw - 2);
      ctx.fillStyle = colors.orange; ctx.fillRect(fx, by - 8, fw, 16);
      ctx.fillStyle = colors.paper; ctx.textBaseline = "middle"; ctx.fillText(flag, fx + 5, by);
    }

    if (readout) {
      var L = layerAt(Math.min(shown, TD - 1)), html;
      if (compact) {
        html = "<span><b>" + Math.round(shown).toLocaleString("en-US") + " ft</b></span>";
      } else {
        html =
          "<span>Depth <b>" + Math.round(shown).toLocaleString("en-US") + " ft</b></span>" +
          "<span>Rock <b>" + ROCK[L.kind] + "</b></span>" +
          "<span>Inc <b>" + incAt(shown) + "°</b></span>" +
          "<span>ROP <b>" + Math.round((window.BL && window.BL.rop) || 0).toLocaleString("en-US") + " ft/s</b></span>" +
          "<span>Status <b>" + (producing ? "Producing" : (moving ? "Drilling" : "On bottom")) + "</b></span>";
      }
      if (html !== lastReadout) { readout.innerHTML = html; lastReadout = html; }
    }
    requestAnimationFrame(draw);
  }

  /* ---------- Small screens: a corner card that opens into the full view ---------- */
  var scrim = null, toggle = null;
  // The page's main column is its own layer, so the view moves to <body> on small
  // screens (to sit above the page and its backdrop) and back into the grid on wide ones.
  var home = view ? view.parentNode : null;
  function place() {
    if (!view || !home) return;
    var want = isSmall() ? document.body : home;
    if (view.parentNode !== want) want.appendChild(view);
  }
  function label() {
    if (!toggle) return;
    var open = isOpen();
    toggle.textContent = open ? "\u00d7" : "\u2922";
    toggle.setAttribute("aria-label", open ? "Close the live view" : "Open the live view");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function openView() {
    if (!view || !isSmall() || isOpen()) return;
    view.classList.add("open"); if (scrim) scrim.classList.add("on");
    label(); resize();
  }
  function closeView() {
    if (!isOpen()) return;
    view.classList.remove("open"); if (scrim) scrim.classList.remove("on");
    label(); resize();
  }
  if (view) {
    place();
    scrim = document.createElement("div"); scrim.className = "dv-scrim";
    scrim.addEventListener("click", closeView);
    document.body.appendChild(scrim);
    toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "dv-toggle";
    toggle.addEventListener("click", function (e) { e.stopPropagation(); if (isOpen()) closeView(); else openView(); });
    view.appendChild(toggle); label();
    // Anywhere on the small card opens it.
    view.addEventListener("click", function () { if (isSmall() && !isOpen()) openView(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeView(); });
    var onMq = function () { if (!isSmall()) closeView(); place(); resize(); };
    if (smallMq) { if (smallMq.addEventListener) smallMq.addEventListener("change", onMq); else if (smallMq.addListener) smallMq.addListener(onMq); }
  }

  /* ---------- Pointer: drag the bit, press a sidetrack, press a layer ---------- */
  function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function nearBit(p) { return Math.hypot(p.x - xOf(shown), p.y - yOf(shown)) < 18; }
  function lateralAt(p) { for (var i = 0; i < LATERALS.length; i++) { var n = latNode(LATERALS[i]); if (Math.hypot(p.x - n.x, p.y - n.y) < 13 || (Math.abs(p.y - n.y) < 8 && p.x < n.x && p.x > n.x - 46)) return LATERALS[i]; } return null; }
  function scrollToDepth(d, smooth) {
    var y = depthToPageY(d) - window.innerHeight * 0.35;
    window.scrollTo({ top: Math.max(0, y), behavior: smooth && !reduceMotion ? "smooth" : "auto" });
  }
  canvas.addEventListener("pointerdown", function (e) {
    var p = pos(e);
    dragged = false;
    if (compact) return; // the small card opens on a press; no dragging there
    if (nearBit(p)) { dragging = true; canvas.setPointerCapture(e.pointerId); e.preventDefault(); }
  });
  canvas.addEventListener("pointermove", function (e) {
    var p = pos(e);
    if (dragging) { dragged = true; scrollToDepth(dOfY(p.y), false); return; }
    canvas.style.cursor = nearBit(p) ? "grab" : (lateralAt(p) || p.y > TOP ? "pointer" : "default");
  });
  function endDrag() { dragging = false; }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("click", function (e) {
    if (isSmall() && !isOpen()) return; // the small card opens first
    e.stopPropagation();
    if (dragged) { dragged = false; return; }
    var p = pos(e), lat = lateralAt(p);
    if (lat) { window.location.href = ROOT + lat.href; return; }
    if (p.y < TOP) return;
    var L = layerAt(Math.min(dOfY(p.y), TD - 1)), node = document.querySelector(L.target);
    closeView();
    if (node) node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  });
  canvas.style.touchAction = "none";

  window.addEventListener("resize", resize);
  window.addEventListener("load", buildLog);
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas.parentNode);
  readVisited();
  resize();
  setTimeout(buildLog, 1500);
  requestAnimationFrame(draw);
})();
