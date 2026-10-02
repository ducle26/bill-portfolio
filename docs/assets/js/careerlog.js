/* Career log: the resume drawn as a strip log. Time runs left to right.
   Press a bar to jump to that entry in the list below. Dates come from the resume. */
(function () {
  "use strict";
  var box = document.getElementById("career-log");
  if (!box) return;
  var NS = "http://www.w3.org/2000/svg";
  var START = 2023, END = 2027.5;           // January 2023 to mid 2027
  var now = new Date(), TODAY = Math.min(END, Math.max(START, now.getFullYear() + now.getMonth() / 12));
  function ym(s) { if (s === "now") return TODAY; var p = s.split("-"); return +p[0] + (+p[1] - 1) / 12; }

  var TRACKS = [
    { name: "Work", fill: "url(#cl-diag)", bars: [
      { label: "State of Oregon", s: "2023-06", e: "2023-10", tip: "State of Oregon, Dept. of Administrative Services · Procurement and Contract Assistant · June to Sept 2023", target: "role-oregon" },
      { label: "Oregon State", s: "2023-11", e: "2024-07", tip: "Oregon State University · Financial Strategic Services Assistant · Nov 2023 to June 2024", target: "role-osu" },
      { label: "Oliden Technology", s: "2024-09", e: "2025-07", tip: "Oliden Technology · Procurement Specialist · Sept 2024 to June 2025", target: "role-oliden-1" },
      { label: "Oliden", s: "2026-06", e: "2026-09", tip: "Oliden Technology · Procurement Specialist · June to Aug 2026", target: "role-oliden-2" }
    ] },
    { name: "School", fill: "url(#cl-dots)", bars: [
      { label: "Oregon State · BS", s: "2023-01", e: "2024-07", open: true, tip: "Oregon State University · BS, Supply Chain and Logistics Management · finished June 2024", target: "edu-osu" },
      { label: "University of Houston · MS", s: "2025-08", e: "2027-06", tip: "University of Houston, Bauer College of Business · MS, Supply Chain Management · Aug 2025 to May 2027", target: "edu-uh" }
    ] },
    { name: "Teaching", fill: "url(#cl-lines)", bars: [
      { label: "IA · SCM 4330", s: "2025-10", e: "now", tip: "University of Houston · Instructional Assistant, SCM 4330 · Oct 2025 to now", target: "role-ia" }
    ] },
    { name: "Certificates", marks: [
      { at: 2023.5, label: "ASCM Procurement", tip: "ASCM Supply Chain Procurement Certificate · 2023" },
      { at: 2024.5, label: "ASCM Planning", tip: "ASCM Supply Chain Planning Certificate · 2024" },
      { at: 2026.5, label: "AI for supply chains", tip: "Artificial Intelligence for Supply Chains and Logistics · 2026" }
    ] }
  ];

  var W = 880, LEFT = 112, RIGHT = 14, ROW = 42, TOP = 26, H = TOP + TRACKS.length * ROW + 8;
  function x(t) { return LEFT + (t - START) / (END - START) * (W - LEFT - RIGHT); }
  function mk(tag, attrs, parent, text) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  var svg = mk("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Timeline of work, school, teaching, and certificates from 2023 to 2027" });
  var defs = mk("defs", {}, svg);
  var p1 = mk("pattern", { id: "cl-diag", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
  mk("rect", { width: 6, height: 6, style: "fill:var(--paper)" }, p1); mk("line", { x1: 0, y1: 0, x2: 0, y2: 6, style: "stroke:var(--hatch);stroke-width:1.6" }, p1);
  var p2 = mk("pattern", { id: "cl-dots", width: 6, height: 6, patternUnits: "userSpaceOnUse" }, defs);
  mk("rect", { width: 6, height: 6, style: "fill:var(--paper)" }, p2); mk("circle", { cx: 2, cy: 2, r: 0.9, style: "fill:var(--hatch)" }, p2);
  var p3 = mk("pattern", { id: "cl-lines", width: 6, height: 5, patternUnits: "userSpaceOnUse" }, defs);
  mk("rect", { width: 6, height: 5, style: "fill:var(--paper)" }, p3); mk("line", { x1: 0, y1: 0.5, x2: 6, y2: 0.5, style: "stroke:var(--hatch);stroke-width:1" }, p3);

  // Year lines
  for (var y = START; y <= Math.floor(END); y++) {
    mk("line", { class: "yr", x1: x(y), y1: TOP - 6, x2: x(y), y2: H - 6 }, svg);
    mk("text", { x: x(y) + 4, y: 14 }, svg, String(y));
  }

  var tip = document.createElement("div");
  tip.className = "clog-tip"; tip.textContent = "Press a bar to jump to that entry.";
  function show(t) { tip.textContent = t; }
  function jump(id) {
    var node = document.getElementById(id); if (!node) return;
    if (node.tagName === "DETAILS") node.open = true;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.classList.remove("flash"); void node.offsetWidth; node.classList.add("flash");
  }

  TRACKS.forEach(function (tr, i) {
    var y0 = TOP + i * ROW;
    mk("line", { class: "trk", x1: 0, y1: y0, x2: W, y2: y0 }, svg);
    mk("text", { class: "trk-name", x: 8, y: y0 + ROW / 2 + 4 }, svg, tr.name);
    (tr.bars || []).forEach(function (b) {
      var x0 = x(ym(b.s)), x1 = x(ym(b.e));
      var g = mk("g", { class: "bar", tabindex: "0", role: "button", "aria-label": b.tip }, svg);
      mk("rect", { x: x0, y: y0 + 8, width: Math.max(6, x1 - x0), height: ROW - 16, fill: tr.fill }, g);
      if (b.open) mk("path", { d: "M" + x0 + " " + (y0 + 8) + " l5 6.5 l-5 6.5 l5 6.5 l-5 6.5", style: "fill:none;stroke:var(--paper);stroke-width:3" }, g);
      var room = x1 - x0 - 10, label = b.label;
      if (label.length * 6.4 <= room) {
        var t = mk("text", { x: x0 + 6, y: y0 + ROW / 2 + 4 }, g, label);
        var bb = { w: label.length * 6.4 + 6 };
        var bg = mk("rect", { x: x0 + 3, y: y0 + ROW / 2 - 7, width: bb.w, height: 14, style: "fill:var(--paper);stroke:none" }, g);
        g.insertBefore(bg, t);
      }
      function on() { show(b.tip); }
      g.addEventListener("mouseenter", on); g.addEventListener("focus", on);
      g.addEventListener("click", function () { show(b.tip); jump(b.target); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jump(b.target); } });
    });
    (tr.marks || []).forEach(function (m) {
      var g = mk("g", { class: "bar", tabindex: "0", role: "img", "aria-label": m.tip }, svg);
      var cx = x(m.at), cy = y0 + ROW / 2;
      mk("rect", { class: "mk", x: cx - 5, y: cy - 5, width: 10, height: 10, transform: "rotate(45 " + cx + " " + cy + ")", fill: "none" }, g);
      mk("text", { x: cx + 11, y: cy + 4 }, g, m.label);
      function on() { show(m.tip); }
      g.addEventListener("mouseenter", on); g.addEventListener("focus", on); g.addEventListener("click", on);
    });
  });
  mk("line", { class: "trk", x1: 0, y1: TOP + TRACKS.length * ROW, x2: W, y2: TOP + TRACKS.length * ROW }, svg);
  mk("line", { class: "trk", x1: LEFT - 8, y1: TOP, x2: LEFT - 8, y2: TOP + TRACKS.length * ROW }, svg);

  // Today
  mk("line", { class: "today", x1: x(TODAY), y1: TOP - 8, x2: x(TODAY), y2: H - 6 }, svg);
  mk("text", { class: "today-t", x: x(TODAY) + 4, y: TOP - 1 }, svg, "TODAY");

  box.appendChild(svg);
  box.appendChild(tip);
})();
