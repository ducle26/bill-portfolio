/* Forecast replay for the rig count case study (CS-01).
   The page hands over the rig count and every ARIMA forecast from the replay as
   JSON (the #rf-data block, written by the R code). This script lets a visitor
   stand at any month, see the forecast the model made then, pick how far ahead
   they need to see, and reveal what happened. */
(function () {
  var root = document.getElementById("rig-replay");
  var dataEl = document.getElementById("rf-data");
  if (!root || !dataEl) return;
  var G;
  try { G = JSON.parse(dataEl.textContent); } catch (e) { return; }
  root.hidden = false;

  var NS = "http://www.w3.org/2000/svg";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var startYear = +G.start.slice(0, 4), startMonth = +G.start.slice(5, 7) - 1;
  var N = G.rigs.length, nOrigins = G.forecast.length, H = 12;
  var svg = document.getElementById("rf-svg");
  var state = { o: 0, ahead: 6, revealed: false, always: false };

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, parent, text) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function num(v) { return Math.round(v).toLocaleString("en-US"); }
  // idx counts months from the start of the series
  function monthOf(idx) { var m = startMonth + idx; return { y: startYear + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }; }
  function label(idx, long) { var d = monthOf(idx); return MONTHS[d.m] + " " + d.y; }
  function indexOf(ym) { return (+ym.slice(0, 4) - startYear) * 12 + (+ym.slice(5, 7) - 1 - startMonth); }
  function originIdx() { return G.firstOrigin + state.o; }       // position of "today" in the series
  function known(idx) { return idx < N ? G.rigs[idx] : null; }

  function call(o, a) {
    var today = G.rigs[G.firstOrigin + o], lo = G.low[o][a - 1], hi = G.high[o][a - 1];
    return lo > today ? "up" : hi < today ? "down" : "none";
  }

  /* ---------- Chart ---------- */
  var geo = null, dragging = false;
  function draw() {
    var wide = root.clientWidth >= 560;
    var W = wide ? 760 : 340, Ht = wide ? 350 : 290, HIST = wide ? 24 : 12;
    var m = { l: wide ? 46 : 40, r: wide ? 16 : 10, t: 26, b: 30 };
    svg.setAttribute("viewBox", "0 0 " + W + " " + Ht);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var o = state.o, t0 = originIdx(), today = G.rigs[t0];
    var fc = G.forecast[o], lo = G.low[o], hi = G.high[o];
    var show = state.revealed || state.always;

    // What is on screen sets the scale
    var vals = [today];
    for (var r = -HIST; r <= 0; r++) if (t0 + r >= 0) vals.push(G.rigs[t0 + r]);
    for (var a = 0; a < H; a++) { vals.push(lo[a], hi[a]); if (show && known(t0 + a + 1) != null) vals.push(known(t0 + a + 1)); }
    var vmin = Math.min.apply(null, vals), vmax = Math.max.apply(null, vals);
    var pad = (vmax - vmin) * 0.08 || 10; vmin = Math.max(0, vmin - pad); vmax += pad;
    var step = niceStep((vmax - vmin) / 5);
    vmin = Math.floor(vmin / step) * step; vmax = Math.ceil(vmax / step) * step;

    var x = function (rel) { return m.l + ((rel + HIST) / (HIST + H)) * (W - m.l - m.r); };
    var y = function (v) { return Ht - m.b - ((v - vmin) / (vmax - vmin)) * (Ht - m.t - m.b); };
    geo = { x: x, W: W, HIST: HIST, m: m };

    // Grid and axes
    for (var v = vmin; v <= vmax + 1e-9; v += step) {
      el("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: "rf-grid" }, svg);
      el("text", { x: m.l - 7, y: y(v) + 3.5, class: "rf-t rf-t-end" }, svg, num(v));
    }
    for (r = -HIST; r <= H; r++) {
      var d = monthOf(t0 + r);
      var tick = wide ? d.m % 6 === 0 : d.m === 0;
      if (!tick) continue;
      el("line", { x1: x(r), x2: x(r), y1: Ht - m.b, y2: Ht - m.b + 4, class: "rf-axis" }, svg);
      el("text", { x: x(r), y: Ht - m.b + 16, class: "rf-t rf-t-mid" }, svg, wide ? MONTHS[d.m] + " " + d.y : String(d.y));
    }
    el("line", { x1: m.l, x2: W - m.r, y1: Ht - m.b, y2: Ht - m.b, class: "rf-axis" }, svg);

    // The future, as seen from "today"
    el("rect", { x: x(0), y: m.t, width: x(H) - x(0), height: Ht - m.t - m.b, class: "rf-future" }, svg);
    el("line", { x1: x(0), x2: x(H), y1: y(today), y2: y(today), class: "rf-today" }, svg);

    // 80% range and the forecast line
    var band = "M" + x(0) + " " + y(today);
    for (a = 0; a < H; a++) band += " L" + x(a + 1) + " " + y(hi[a]);
    for (a = H - 1; a >= 0; a--) band += " L" + x(a + 1) + " " + y(lo[a]);
    el("path", { d: band + " Z", class: "rf-band" }, svg);
    var line = "M" + x(0) + " " + y(today);
    for (a = 0; a < H; a++) line += " L" + x(a + 1) + " " + y(fc[a]);
    el("path", { d: line, class: "rf-fc" }, svg);

    // History up to today
    var hist = "";
    for (r = -HIST; r <= 0; r++) if (t0 + r >= 0) hist += (hist ? " L" : "M") + x(r) + " " + y(G.rigs[t0 + r]);
    el("path", { d: hist, class: "rf-hist" }, svg);
    el("line", { x1: x(0), x2: x(0), y1: m.t, y2: Ht - m.b, class: "rf-now" }, svg);
    el("text", { x: x(0) - 6, y: m.t + 10, class: "rf-t rf-t-end rf-t-strong" }, svg, "You are here");
    el("circle", { cx: x(0), cy: y(today), r: 3.6, class: "rf-dot" }, svg);

    // What happened, once revealed
    if (show) {
      var act = "M" + x(0) + " " + y(today), any = false;
      for (a = 1; a <= H; a++) {
        var kv = known(t0 + a); if (kv == null) break;
        act += " L" + x(a) + " " + y(kv); any = true;
      }
      if (any) {
        el("path", { d: act, class: "rf-actual" }, svg);
        var ka = known(t0 + state.ahead);
        if (ka != null) {
          el("circle", { cx: x(state.ahead), cy: y(ka), r: 5, class: "rf-actual-dot" }, svg);
          el("text", { x: x(state.ahead) + 8, y: y(ka) + 4, class: "rf-t rf-t-strong rf-t-halo" }, svg, num(ka));
        }
      }
    }

    // The "need to see" line the visitor drags
    var nx = x(state.ahead), ai = state.ahead - 1;
    el("line", { x1: nx, x2: nx, y1: m.t - 6, y2: Ht - m.b, class: "rf-need" }, svg);
    el("line", { x1: nx, x2: nx, y1: y(hi[ai]), y2: y(lo[ai]), class: "rf-need-range" }, svg);
    el("circle", { cx: nx, cy: y(fc[ai]), r: 4, class: "rf-need-dot" }, svg);
    var grip = el("g", { class: "rf-grip", transform: "translate(" + nx + " " + (m.t - 6) + ")" }, svg);
    el("rect", { x: -13, y: -11, width: 26, height: 16, rx: 2 }, grip);
    el("path", { d: "M-7 -3 L-3 -6.5 V0.5 Z M7 -3 L3 -6.5 V0.5 Z" }, grip);
    var hit = el("rect", { x: x(0), y: 0, width: x(H) - x(0) + m.r, height: Ht - m.b, class: "rf-hit" }, svg);
    hit.addEventListener("pointerdown", function (e) {
      dragging = true; try { hit.setPointerCapture(e.pointerId); } catch (err) {}
      setAheadFromEvent(e); e.preventDefault();
    });
    hit.addEventListener("pointermove", function (e) { if (dragging) setAheadFromEvent(e); });
    ["pointerup", "pointercancel"].forEach(function (ev) { hit.addEventListener(ev, function () { dragging = false; }); });
  }
  function niceStep(raw) {
    var p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
  }
  function setAheadFromEvent(e) {
    var b = svg.getBoundingClientRect(), px = (e.clientX - b.left) * (geo.W / b.width);
    var rel = ((px - geo.m.l) / (geo.W - geo.m.l - geo.m.r)) * (geo.HIST + H) - geo.HIST;
    var a = clamp(Math.round(rel), 1, H);
    if (a !== state.ahead) { state.ahead = a; render(true); }
  }

  /* ---------- Words around the chart ---------- */
  function words() {
    var o = state.o, a = state.ahead, t0 = originIdx(), today = G.rigs[t0];
    var fc = G.forecast[o][a - 1], lo = G.low[o][a - 1], hi = G.high[o][a - 1];
    $("rf-origin-v").textContent = label(t0) + ", with " + num(today) + " rigs running";
    $("rf-ahead-v").textContent = a + (a === 1 ? " month" : " months") + " ahead, to " + label(t0 + a);
    $("rf-origin").value = o; $("rf-ahead").value = a;
    $("rf-prev").disabled = o === 0; $("rf-next").disabled = o === nOrigins - 1;

    $("rf-fc-l").textContent = "Forecast for " + label(t0 + a);
    $("rf-fc").textContent = num(fc) + " rigs";
    $("rf-fc-range").textContent = "80% range: " + num(lo) + " to " + num(hi) + ".";

    var c = call(o, a);
    $("rf-call").textContent = c === "up" ? "Up" : c === "down" ? "Down" : "No call";
    $("rf-call-why").textContent = c === "up" ? "The whole range sits above today's " + num(today) + "."
      : c === "down" ? "The whole range sits below today's " + num(today) + "."
      : "The range includes today's " + num(today) + ", so the model can't say which way.";

    var tm = G.typical.arima[a - 1], ts = G.typical.same[a - 1];
    $("rf-track").textContent = "Typical miss " + tm + "%";
    $("rf-track-why").textContent = "Assuming no change, it is " + ts + "%. " +
      (tm < ts * 0.75 ? "The model helps at this distance." : tm < ts * 0.9 ? "The model helps a little at this distance." :
        tm <= ts ? "The model barely helps at this distance." : "The model is no help at this distance.") +
      " Its range held " + G.held[a - 1] + "% of the time.";

    // Reveal
    var btn = $("rf-reveal"), out = $("rf-result"), actual = known(t0 + a), anyKnown = known(t0 + 1) != null;
    var show = state.revealed || state.always;
    btn.disabled = !anyKnown || show;
    btn.textContent = !anyKnown ? "Not known yet" : "Reveal what happened";
    if (!anyKnown) { out.textContent = "This is the latest month of data. Nobody knows what happens next, the model included."; return; }
    if (!show) { out.textContent = ""; return; }
    if (actual == null) { out.textContent = label(t0 + a) + " hasn't happened yet. The line shows the months that have."; return; }
    var miss = Math.abs(fc - actual) / actual * 100, inside = actual >= lo && actual <= hi;
    var text = "What happened: " + num(actual) + " rigs in " + label(t0 + a) + ". The forecast missed by " +
      (miss < 0.5 ? "less than 1%" : Math.round(miss) + "%") + ", and the count landed " + (inside ? "inside" : "outside") + " the range.";
    if (c !== "none") text += " The call was " + (((c === "up") === (actual > today)) ? "right." : "wrong.");
    out.textContent = text;
  }

  function render(keepReveal) {
    if (!keepReveal) state.revealed = false;
    draw(); words();
  }

  /* ---------- Controls ---------- */
  var originInput = $("rf-origin"), aheadInput = $("rf-ahead");
  originInput.max = nOrigins - 1;
  originInput.addEventListener("input", function () { state.o = +originInput.value; render(false); });
  aheadInput.addEventListener("input", function () { state.ahead = +aheadInput.value; render(true); });
  $("rf-prev").addEventListener("click", function () { state.o = clamp(state.o - 1, 0, nOrigins - 1); render(false); });
  $("rf-next").addEventListener("click", function () { state.o = clamp(state.o + 1, 0, nOrigins - 1); render(false); });
  $("rf-reveal").addEventListener("click", function () { state.revealed = true; render(true); });
  $("rf-always").addEventListener("change", function () { state.always = this.checked; render(true); });
  Array.prototype.forEach.call(root.querySelectorAll("[data-jump]"), function (b) {
    b.addEventListener("click", function () {
      var j = b.dataset.jump;
      state.o = j === "latest" ? nOrigins - 1 : clamp(indexOf(j) - G.firstOrigin, 0, nOrigins - 1);
      render(false);
    });
  });
  var resizeTimer = null;
  window.addEventListener("resize", function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(function () { draw(); }, 150); });

  state.o = clamp(indexOf("2014-10") - G.firstOrigin, 0, nOrigins - 1);
  render(false);
})();
