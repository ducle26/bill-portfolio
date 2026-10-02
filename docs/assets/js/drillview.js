/* Home page: a live cross-section of the well that drills as you scroll.
   The bit follows the page depth, mud pulses carry data up the pipe,
   and cuttings rise while you're moving. Press a rock layer to jump to it. */
(function () {
  "use strict";
  var canvas = document.getElementById("drill-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var readout = document.getElementById("drill-readout");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TD = 5000;

  // Layers line up with the home page sections.
  var LAYERS = [
    { top: 0, bottom: 500, kind: "soil", name: "Surface", vi: "Mặt đất", target: ".hero" },
    { top: 500, bottom: 1200, kind: "sand", name: "About", vi: "Giới thiệu", target: "#about-me" },
    { top: 1200, bottom: 2400, kind: "shale", name: "Journey", vi: "Hành trình", target: "#journey" },
    { top: 2400, bottom: 3600, kind: "lime", name: "Core samples", vi: "Mẫu lõi", target: "#samples" },
    { top: 3600, bottom: 4200, kind: "granite", name: "Toolkit", vi: "Bộ công cụ", target: "#skills" },
    { top: 4200, bottom: 4600, kind: "shale", name: "Now", vi: "Bây giờ", target: "#now" },
    { top: 4600, bottom: 5000, kind: "target", name: "Target", vi: "Mục tiêu", target: "#contact" }
  ];
  var ROCK = { soil: "Topsoil", sand: "Sandstone", shale: "Shale", lime: "Limestone", granite: "Granite", target: "Pay zone" };
  var ROCK_VI = { soil: "Đất mặt", sand: "Sa thạch", shale: "Đá phiến", lime: "Đá vôi", granite: "Đá granit", target: "Tầng sản phẩm" };

  var W = 300, H = 600, dpr = 1, colors = {}, pats = {}, themeKey = "";
  var shown = 0, pulses = [], cuttings = [], spin = 0, lastT = performance.now();
  var TOP = 70, BOT = 30; // room for rig and readout

  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function vi() { return document.documentElement.getAttribute("lang") === "vi"; }

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

  function resize() {
    var r = canvas.parentNode.getBoundingClientRect();
    W = Math.max(200, r.width); H = Math.max(300, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function yOf(d) { return TOP + (d / TD) * (H - TOP - BOT); }
  // A J-shaped well: straight down, then it builds angle toward the target after 3,000 ft.
  var KOP = 3000;
  function xOf(d) {
    var cx = W * 0.42;
    if (d <= KOP) return cx;
    var f = (d - KOP) / (TD - KOP);
    return cx + (W * 0.22) * f * f;
  }
  function incAt(d) { if (d <= KOP) return 0; var f = (d - KOP) / (TD - KOP); return Math.round(Math.atan((W * 0.44 * f) / ((H - TOP - BOT) / TD * (TD - KOP))) * 57.3); }

  function layerAt(d) { for (var i = 0; i < LAYERS.length; i++) if (d < LAYERS[i].bottom) return LAYERS[i]; return LAYERS[LAYERS.length - 1]; }

  function draw(now) {
    readTheme();
    var dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    var target = (window.BL && window.BL.depth) || 0;
    var prev = shown;
    shown += (target - shown) * Math.min(1, dt * 6);
    var moving = Math.abs(shown - prev) > 0.5;
    if (!reduceMotion) spin += dt * (moving ? 18 : 3);

    ctx.clearRect(0, 0, W, H);
    var left = 34, right = W - 4;

    // Rock layers
    LAYERS.forEach(function (L) {
      var y0 = yOf(L.top), y1 = yOf(L.bottom);
      ctx.fillStyle = pats[L.kind]; ctx.fillRect(left, y0, right - left, y1 - y0);
      var active = shown >= L.top && shown < L.bottom || (L.bottom === TD && shown >= TD - 1);
      if (active) { ctx.fillStyle = colors.shade; ctx.fillRect(left, y0, right - left, y1 - y0); }
      ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(left, Math.round(y0) + 0.5); ctx.lineTo(right, Math.round(y0) + 0.5); ctx.stroke();
      // Section label on the right, with a little paper behind it
      if (L.top > 0) {
        ctx.font = "10px 'Space Mono', monospace";
        var label = (vi() ? L.vi : L.name).toUpperCase();
        var tw = ctx.measureText(label).width;
        ctx.fillStyle = colors.paper; ctx.fillRect(right - tw - 10, y0 + 4, tw + 8, 14);
        ctx.fillStyle = active ? colors.orange : colors.ink3; ctx.textBaseline = "top";
        ctx.fillText(label, right - tw - 6, y0 + 6);
      }
    });
    ctx.strokeStyle = colors.ink; ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, yOf(0) + 0.5, right - left - 1, yOf(TD) - yOf(0));

    // Depth scale
    ctx.font = "10px 'Space Mono', monospace"; ctx.textBaseline = "middle"; ctx.fillStyle = colors.ink3;
    for (var d = 0; d <= TD; d += 500) {
      var y = Math.round(yOf(d)) + 0.5;
      ctx.strokeStyle = colors.ink3; ctx.beginPath(); ctx.moveTo(left - (d % 1000 ? 4 : 8), y); ctx.lineTo(left, y); ctx.stroke();
      if (d % 1000 === 0) { ctx.textAlign = "right"; ctx.fillText(d === 0 ? "0" : (d / 1000) + "k", left - 10, y); ctx.textAlign = "left"; }
    }

    // Rig at the surface
    var sx = xOf(0), sy = yOf(0);
    ctx.strokeStyle = colors.ink; ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(sx - 22, sy); ctx.lineTo(sx - 4, sy - 52); ctx.lineTo(sx + 4, sy - 52); ctx.lineTo(sx + 22, sy);
    for (var k = 1; k < 4; k++) { var yy = sy - k * 13, wv = 22 - k * 4.5; ctx.moveTo(sx - wv, yy); ctx.lineTo(sx + wv, yy); }
    ctx.moveTo(sx - 18, sy - 13); ctx.lineTo(sx + 13.5, sy - 26); ctx.moveTo(sx + 18, sy - 13); ctx.lineTo(sx - 13.5, sy - 26);
    ctx.moveTo(sx - 34, sy); ctx.lineTo(sx + 40, sy);
    ctx.stroke();
    ctx.fillStyle = colors.ink; ctx.fillRect(sx + 26, sy - 10, 14, 10); // doghouse
    ctx.font = "9px 'Space Mono', monospace"; ctx.fillStyle = colors.ink3; ctx.textBaseline = "alphabetic";
    ctx.fillText(vi() ? "GIÀN KHOAN" : "RIG", sx + 44, sy - 2);

    // Planned path (dashed) and drilled hole (solid)
    ctx.setLineDash([3, 4]); ctx.strokeStyle = colors.ink3; ctx.lineWidth = 1;
    ctx.beginPath(); for (var p = 0; p <= TD; p += 50) { var px = xOf(p), py = yOf(p); if (!p) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke();
    ctx.setLineDash([]);
    // target box
    var tx = xOf(TD), ty = yOf(TD);
    ctx.strokeStyle = colors.orange; ctx.lineWidth = 1.5; ctx.strokeRect(tx - 14, yOf(4700), 28, ty - yOf(4700));

    ctx.strokeStyle = colors.ink; ctx.lineWidth = 6; ctx.lineCap = "round";
    ctx.beginPath(); for (var q = 0; q <= shown; q += 25) { var qx = xOf(q), qy = yOf(q); if (!q) ctx.moveTo(qx, qy); else ctx.lineTo(qx, qy); }
    ctx.lineTo(xOf(shown), yOf(shown)); ctx.stroke();
    ctx.strokeStyle = colors.paper; ctx.lineWidth = 2;
    ctx.beginPath(); for (var q2 = 0; q2 <= shown; q2 += 25) { var q2x = xOf(q2), q2y = yOf(q2); if (!q2) ctx.moveTo(q2x, q2y); else ctx.lineTo(q2x, q2y); }
    ctx.lineTo(xOf(shown), yOf(shown)); ctx.stroke();
    ctx.lineCap = "butt";

    // Mud pulses: data travelling up the pipe from the bit
    if (!reduceMotion && shown > 60) {
      if (!pulses.length || pulses[pulses.length - 1].d < shown - 260) pulses.push({ d: shown });
      pulses.forEach(function (pl) { pl.d -= dt * 900; });
      pulses = pulses.filter(function (pl) { return pl.d > 0 && pl.d <= shown; });
      ctx.fillStyle = colors.orange;
      pulses.forEach(function (pl) { ctx.beginPath(); ctx.arc(xOf(pl.d), yOf(pl.d), 2.2, 0, 6.3); ctx.fill(); });
    }

    // Cuttings rise while you scroll
    if (!reduceMotion && moving && cuttings.length < 60) {
      for (var c = 0; c < 2; c++) cuttings.push({ d: shown, off: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 3), life: 1 });
    }
    cuttings.forEach(function (ct) { ct.d -= dt * 260; ct.life -= dt * 0.9; });
    cuttings = cuttings.filter(function (ct) { return ct.life > 0 && ct.d > 0; });
    ctx.fillStyle = colors.ink2;
    cuttings.forEach(function (ct) { ctx.globalAlpha = Math.max(0, ct.life); ctx.fillRect(xOf(ct.d) + ct.off, yOf(ct.d), 1.6, 1.6); });
    ctx.globalAlpha = 1;

    // The bit
    var bx = xOf(shown), by = yOf(shown);
    var ang = shown > KOP ? -Math.atan2(xOf(shown) - xOf(shown - 40), yOf(shown) - yOf(shown - 40)) : 0;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(ang);
    ctx.fillStyle = colors.ink; ctx.fillRect(-4, -16, 8, 10);
    ctx.beginPath(); ctx.moveTo(-7, -6); ctx.lineTo(7, -6); ctx.lineTo(0, 8); ctx.closePath();
    ctx.fillStyle = colors.orange; ctx.fill();
    // spinning teeth
    ctx.strokeStyle = colors.paper; ctx.lineWidth = 1;
    for (var tth = 0; tth < 3; tth++) { var o = ((spin + tth * 2.1) % 6.3) / 6.3; var tx2 = -6 + o * 12; ctx.beginPath(); ctx.moveTo(tx2, -5); ctx.lineTo(tx2 * 0.5, 4); ctx.stroke(); }
    ctx.restore();
    // depth flag
    ctx.font = "10px 'Space Mono', monospace";
    var flag = Math.round(shown).toLocaleString("en-US") + " FT";
    var fw = ctx.measureText(flag).width + 10, fx = Math.min(bx + 12, W - fw - 4);
    ctx.fillStyle = colors.orange; ctx.fillRect(fx, by - 8, fw, 16);
    ctx.fillStyle = colors.paper; ctx.textBaseline = "middle"; ctx.fillText(flag, fx + 5, by);

    if (readout) {
      var L = layerAt(Math.min(shown, TD - 1));
      readout.innerHTML =
        "<span>" + (vi() ? "Sâu" : "Depth") + " <b>" + Math.round(shown).toLocaleString("en-US") + " ft</b></span>" +
        "<span>" + (vi() ? "Đá" : "Rock") + " <b>" + (vi() ? ROCK_VI[L.kind] : ROCK[L.kind]) + "</b></span>" +
        "<span>" + (vi() ? "Góc" : "Inc") + " <b>" + incAt(shown) + "°</b></span>" +
        "<span>ROP <b>" + Math.round((window.BL && window.BL.rop) || 0).toLocaleString("en-US") + " ft/s</b></span>";
    }
    requestAnimationFrame(draw);
  }

  // Press a layer to jump there
  canvas.addEventListener("click", function (e) {
    var r = canvas.getBoundingClientRect(), y = e.clientY - r.top;
    var d = (y - TOP) / (H - TOP - BOT) * TD;
    if (d < 0) d = 0;
    var L = layerAt(Math.min(d, TD - 1)), node = document.querySelector(L.target);
    if (node) node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  });
  canvas.addEventListener("mousemove", function (e) {
    var r = canvas.getBoundingClientRect(), y = e.clientY - r.top;
    canvas.style.cursor = y > TOP ? "pointer" : "default";
  });

  window.addEventListener("resize", resize);
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas.parentNode);
  resize();
  requestAnimationFrame(draw);
})();
