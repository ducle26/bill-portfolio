/* Price guide tool for the Melbourne housing case study (CS-04).
   The page hands over the regression as JSON (the #pg-data block, written by the
   R code). This script turns it into a small drawing board: a plan view of real
   sales with a ring for distance, an elevation of the home, and a bill of
   materials that prices the home one factor at a time. */
(function () {
  var root = document.getElementById("price-guide");
  var dataEl = document.getElementById("pg-data");
  if (!root || !dataEl) return;
  var G;
  try { G = JSON.parse(dataEl.textContent); } catch (e) { return; }
  root.hidden = false;

  var NS = "http://www.w3.org/2000/svg";
  var C = G.coef, TYPES = G.types, REGIONS = G.regions;
  var LIMITS = { rooms: [1, 6], bath: [1, 4], car: [0, 4], dist: [1, 30] };
  var NOUN = { rooms: ["room", "rooms"], bath: ["bathroom", "bathrooms"], car: ["parking spot", "parking spots"] };
  // The reference home every price is built up from.
  var REF = { type: 0, rooms: 3, bath: 1, car: 1, dist: 10, region: REGIONS.indexOf("Eastern") };
  var START = { type: 0, rooms: 3, bath: 2, car: 2, dist: 9, region: REGIONS.indexOf("Southern") };
  var state = copy(START);
  state.land = null;     // null means "typical for the type"
  var real = null;       // the real sale being tested, if any
  var tally = [];        // misses on the real sales tested so far
  var angle = -Math.PI / 4; // where the home sits on the ring (north-east to start)

  function copy(o) { var c = {}; for (var k in o) c[k] = o[k]; return c; }
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, parent, text) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function plural(n, key) { return n + " " + NOUN[key][n === 1 ? 0 : 1]; }
  function money(v) {
    if (v >= 1e6) return "A$" + (v / 1e6).toFixed(2) + "M";
    return "A$" + Math.round(v / 1000) + "K";
  }
  function moneyFull(v) { return "A$" + (Math.round(v / 1000) * 1000).toLocaleString("en-US"); }
  function pct(delta) {
    var p = (Math.exp(delta) - 1) * 100;
    if (Math.abs(p) < 0.05) return "0%";
    return (p > 0 ? "+" : "−") + Math.abs(p).toFixed(1) + "%";
  }
  function landFor(s) { return s.land == null ? G.land[TYPES[s.type]] : s.land; }

  /* ---------- The model ---------- */
  // Each step is one line of the bill of materials: what changed from the
  // reference home, and what the regression says that does to log price.
  function steps(s) {
    var refLand = G.land[TYPES[REF.type]], land = landFor(s);
    return [
      { item: "Type", spec: TYPES[s.type], delta: C.type[TYPES[s.type]] - C.type[TYPES[REF.type]] },
      { item: "Land", spec: Math.round(land).toLocaleString("en-US") + " m²" + (s.land == null ? ", typical for a " + TYPES[s.type].toLowerCase() : ", this sale's block"),
        delta: C.logLand * (Math.log(1 + land) - Math.log(1 + refLand)) },
      { item: "Rooms", spec: String(s.rooms), delta: C.rooms * (s.rooms - REF.rooms) },
      { item: "Bathrooms", spec: String(s.bath), delta: C.bath * (s.bath - REF.bath) },
      { item: "Parking", spec: String(s.car), delta: C.car * (s.car - REF.car) },
      { item: "Distance", spec: s.dist + " km from the city", delta: C.dist * (s.dist - REF.dist) },
      { item: "Region", spec: REGIONS[s.region], delta: C.region[REGIONS[s.region]] - C.region[REGIONS[REF.region]] }
    ];
  }
  function refPrice() {
    var land = G.land[TYPES[REF.type]];
    return Math.exp(C.intercept + C.type[TYPES[REF.type]] + C.rooms * REF.rooms + C.bath * REF.bath +
      C.car * REF.car + C.logLand * Math.log(1 + land) + C.dist * REF.dist + C.region[REGIONS[REF.region]]);
  }
  function price(s) {
    return steps(s).reduce(function (p, st) { return p * Math.exp(st.delta); }, refPrice());
  }

  /* ---------- Plan view ---------- */
  var map = $("pg-map-svg"), CX = 200, CY = 200, VIEW_KM = 31, S = 200 / VIEW_KM;
  var regionGroups = [], ring, handle, handleHit, ringHit, distLabel, realMark;
  (function buildMap() {
    // Reference rings
    [10, 20, 30].forEach(function (km) {
      el("circle", { cx: CX, cy: CY, r: km * S, class: "pg-ref" }, map);
      el("text", { x: CX, y: CY - km * S + 13, class: "pg-t pg-t-mid pg-t-halo" }, map, km + " km");
    });
    // Sales, one group per region, shaded by price quartile
    var prices = G.sales.map(function (r) { return r[2]; }).sort(function (a, b) { return a - b; });
    var q = [0.25, 0.5, 0.75].map(function (p) { return prices[Math.floor(p * prices.length)]; });
    REGIONS.forEach(function (name, i) { regionGroups[i] = el("g", { class: "pg-reg" }, map); });
    G.sales.forEach(function (r) {
      var k = r[2] < q[0] ? 0 : r[2] < q[1] ? 1 : r[2] < q[2] ? 2 : 3;
      el("circle", { cx: (CX + r[0] * S).toFixed(1), cy: (CY - r[1] * S).toFixed(1), r: 1.9, class: "pg-dot q" + k }, regionGroups[r[9]]);
    });
    // City center, bay, north arrow, scale bar
    el("path", { d: "M" + (CX - 7) + " " + CY + "H" + (CX + 7) + "M" + CX + " " + (CY - 7) + "V" + (CY + 7), class: "pg-ink" }, map);
    el("text", { x: CX + 9, y: CY + 15, class: "pg-t pg-t-halo" }, map, "City");
    el("text", { x: CX - 9.5 * S, y: CY + 17 * S, class: "pg-t pg-t-mid pg-t-soft" }, map, "Port Phillip Bay");
    el("path", { d: "M372 44 V20 M366 28 L372 18 L378 28", class: "pg-ink" }, map);
    el("text", { x: 372, y: 56, class: "pg-t pg-t-mid" }, map, "N");
    el("path", { d: "M18 380 v-5 M18 377.5 H" + (18 + 10 * S).toFixed(1) + " M" + (18 + 10 * S).toFixed(1) + " 380 v-5", class: "pg-ink" }, map);
    el("text", { x: 18 + 5 * S, y: 371, class: "pg-t pg-t-mid" }, map, "10 km");
    // Price key
    var key = el("g", { transform: "translate(16 22)" }, map);
    el("text", { x: 0, y: 0, class: "pg-t" }, key, "Sale price");
    ["Low", "", "", "High"].forEach(function (t, i) {
      el("circle", { cx: 4 + i * 12, cy: 11, r: 3.2, class: "pg-dot q" + i }, key);
    });
    el("text", { x: 52, y: 14, class: "pg-t pg-t-soft" }, key, "low to high");
    // The real sale marker (hidden until a test)
    realMark = el("g", { class: "pg-real-mark", visibility: "hidden" }, map);
    el("circle", { r: 9 }, realMark);
    el("path", { d: "M-13 0H-5M5 0H13M0 -13V-5M0 5V13" }, realMark);
    // The ring the visitor drags
    ring = el("circle", { cx: CX, cy: CY, class: "pg-ring" }, map);
    ringHit = el("circle", { cx: CX, cy: CY, class: "pg-ring-hit" }, map);
    distLabel = el("text", { class: "pg-t pg-t-ring" }, map);
    handle = el("g", { class: "pg-handle" }, map);
    el("circle", { r: 7 }, handle);
    el("path", { d: "M-3.5 1.5 L0 -2.5 L3.5 1.5 V4 H-3.5 Z" }, handle);
    handleHit = el("circle", { r: 20, class: "pg-ring-hit pg-fill-hit" }, handle);
  })();

  function kmFromEvent(e) {
    var b = map.getBoundingClientRect(), k = 400 / b.width;
    var x = (e.clientX - b.left) * k - CX, y = (e.clientY - b.top) * k - CY;
    angle = Math.atan2(y, x);
    return Math.hypot(x, y) / S;
  }
  function setDistFromEvent(e) {
    var km = clamp(Math.round(kmFromEvent(e) * 2) / 2, LIMITS.dist[0], LIMITS.dist[1]);
    change({ dist: km });
  }
  var dragging = false;
  [ringHit, handleHit].forEach(function (t) {
    t.addEventListener("pointerdown", function (e) {
      dragging = true; root.classList.add("pg-dragging");
      try { t.setPointerCapture(e.pointerId); } catch (err) {}
      setDistFromEvent(e); e.preventDefault();
    });
    t.addEventListener("pointermove", function (e) { if (dragging) setDistFromEvent(e); });
    ["pointerup", "pointercancel"].forEach(function (ev) {
      t.addEventListener(ev, function () { dragging = false; root.classList.remove("pg-dragging"); });
    });
  });
  // A plain tap anywhere on the map also moves the ring there.
  map.addEventListener("click", function (e) { if (!dragging) setDistFromEvent(e); });

  function drawMap() {
    var r = state.dist * S;
    ring.setAttribute("r", r); ringHit.setAttribute("r", r);
    var hx = CX + r * Math.cos(angle), hy = CY + r * Math.sin(angle);
    handle.setAttribute("transform", "translate(" + hx.toFixed(1) + " " + hy.toFixed(1) + ")");
    // Keep the label inside the frame and off the handle
    var lx = clamp(hx + (Math.cos(angle) >= 0 ? 14 : -14), 34, 366), ly = clamp(hy - 12, 14, 392);
    distLabel.setAttribute("x", lx); distLabel.setAttribute("y", ly);
    distLabel.setAttribute("text-anchor", Math.cos(angle) >= 0 ? "start" : "end");
    distLabel.textContent = state.dist + " km";
    regionGroups.forEach(function (g, i) { g.classList.toggle("on", i === state.region); });
    if (real) {
      realMark.setAttribute("transform", "translate(" + (CX + real[0] * S).toFixed(1) + " " + (CY - real[1] * S).toFixed(1) + ")");
      realMark.setAttribute("visibility", "visible");
    } else realMark.setAttribute("visibility", "hidden");
  }

  /* ---------- Elevation ---------- */
  var elev = $("pg-elev-svg"), GROUND = 178;
  (function defs() {
    var d = el("defs", {}, elev);
    var p = el("pattern", { id: "pg-hatch", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, d);
    el("line", { x1: 0, y1: 0, x2: 0, y2: 6, class: "pg-hatch-line" }, p);
  })();
  var drawing = el("g", {}, elev);

  function rect(x, y, w, h, cls, parent) { return el("rect", { x: x, y: y, width: w, height: h, class: cls || "pg-ln" }, parent || drawing); }
  function line(x1, y1, x2, y2, cls, parent) { return el("line", { x1: x1, y1: y1, x2: x2, y2: y2, class: cls || "pg-ln" }, parent || drawing); }
  function windowAt(x, y, w, h, cls) {
    rect(x, y, w, h, cls || "pg-ln pg-thin");
    line(x + w / 2, y, x + w / 2, y + h, "pg-ln pg-hair");
    line(x, y + h / 2, x + w, y + h / 2, "pg-ln pg-hair");
  }
  function garageDoor(x, y, w, h) {
    rect(x, y, w, h, "pg-ln pg-thin");
    for (var i = 1; i < 4; i++) line(x, y + (h * i) / 4, x + w, y + (h * i) / 4, "pg-ln pg-hair");
  }
  function vent(x, y) { // a plumbing vent through the roof: one per bathroom
    line(x, y, x, y - 11, "pg-ln pg-thin");
    line(x - 3.5, y - 11, x + 3.5, y - 11, "pg-ln pg-thin");
  }
  function ground(x1, x2) {
    line(14, GROUND, 406, GROUND, "pg-ln");
    rect(14, GROUND, 392, 7, "pg-earth");
    // Dimension line under the home
    var y = GROUND + 22;
    line(x1, y, x2, y, "pg-ln pg-hair");
    line(x1, y - 4, x1, y + 4, "pg-ln pg-hair"); line(x2, y - 4, x2, y + 4, "pg-ln pg-hair");
    line(x1, GROUND + 9, x1, y - 6, "pg-ln pg-hair pg-dash"); line(x2, GROUND + 9, x2, y - 6, "pg-ln pg-hair pg-dash");
    el("text", { x: 210, y: y + 15, class: "pg-t pg-t-mid" }, drawing,
      plural(state.rooms, "rooms") + " · " + plural(state.bath, "bath") + " · " + plural(state.car, "car"));
  }
  function extra(n, shown, x, y) { // "×5" when there are more than we can draw
    if (n > shown) el("text", { x: x, y: y, class: "pg-t" }, drawing, "×" + n);
  }

  function drawHouse(s) {
    var rooms = Math.min(s.rooms, 6), cars = Math.min(s.car, 3);
    var bodyW = 96 + rooms * 26, bodyH = 60, garW = cars ? cars * 42 + 10 : 0;
    var x0 = (420 - bodyW - garW) / 2, top = GROUND - bodyH;
    rect(x0, top, bodyW, bodyH);
    // Gable roof and chimney
    var peakX = x0 + bodyW / 2, peakY = top - 44;
    el("path", { d: "M" + (x0 - 10) + " " + top + " L" + peakX + " " + peakY + " L" + (x0 + bodyW + 10) + " " + top + " Z", class: "pg-ln" }, drawing);
    rect(x0 + bodyW * 0.72, top - 44 * 0.56 - 14, 11, 20, "pg-ln pg-paper");
    // One roof vent per bathroom, on the left slope
    for (var b = 0; b < Math.min(s.bath, 4); b++) {
      var vx = x0 + 14 + b * 15, vy = top - ((vx - (x0 - 10)) / (peakX - (x0 - 10))) * 44;
      vent(vx, vy);
    }
    // Door in the middle slot, one window per room around it
    var slots = rooms + 1, slotW = bodyW / slots, doorSlot = Math.floor(slots / 2);
    for (var i = 0; i < slots; i++) {
      var cx = x0 + slotW * (i + 0.5);
      if (i === doorSlot) { rect(cx - 8, GROUND - 36, 16, 36, "pg-ln pg-thin"); el("circle", { cx: cx + 4.5, cy: GROUND - 18, r: 1, class: "pg-ln pg-hair" }, drawing); }
      else windowAt(cx - 9, top + 16, 18, 22);
    }
    // Garage, one door per parking spot
    if (cars) {
      var gx = x0 + bodyW, gh = 44;
      rect(gx, GROUND - gh, garW, gh);
      line(gx, GROUND - gh - 4, gx + garW + 5, GROUND - gh - 4, "pg-ln pg-thin");
      for (var c = 0; c < cars; c++) garageDoor(gx + 8 + c * 42, GROUND - 32, 36, 32);
      extra(s.car, cars, gx + garW + 8, GROUND - 14);
    }
    ground(x0, x0 + bodyW + garW);
  }

  function drawTownhouse(s) {
    var rooms = Math.min(s.rooms, 6), w = 92 + rooms * 6, h = 104, x0 = (420 - w) / 2, top = GROUND - h;
    // Neighbors on both sides, drawn dashed
    [[x0 - 70, x0], [x0 + w, x0 + w + 70]].forEach(function (n) {
      el("path", { d: "M" + n[0] + " " + GROUND + " V" + (top + 8) + " H" + n[1], class: "pg-ln pg-thin pg-dash" }, drawing);
    });
    rect(x0, top, w, h);
    line(x0 - 4, top, x0 + w + 4, top, "pg-ln");
    line(x0, top + h / 2, x0 + w, top + h / 2, "pg-ln pg-hair");
    for (var b = 0; b < Math.min(s.bath, 4); b++) vent(x0 + 14 + b * 14, top);
    // Ground floor: door, then a garage door if there is parking
    rect(x0 + 10, GROUND - 36, 16, 36, "pg-ln pg-thin");
    var used = 0;
    if (s.car > 0) { garageDoor(x0 + w - 46, GROUND - 32, 36, 32); extra(s.car, 1, x0 + w + 8, GROUND - 14); }
    else if (rooms > 3) { windowAt(x0 + w - 34, GROUND - 40, 18, 22); used = 1; }
    // Upper floor takes the rest of the windows
    var up = rooms - used, gap = (w - up * 16) / (up + 1);
    for (var i = 0; i < up; i++) windowAt(x0 + gap + i * (16 + gap), top + 14, 16, 24);
    ground(x0, x0 + w);
  }

  function drawUnit(s) {
    var bays = 3, floors = 4, bw = 58, fh = 33, w = bays * bw, h = floors * fh;
    var x0 = (420 - w) / 2 - (s.car ? 22 : 0), top = GROUND - h, rooms = Math.min(s.rooms, 6);
    rect(x0, top, w, h, "pg-ln pg-thin");
    line(x0 - 4, top, x0 + w + 4, top, "pg-ln pg-thin");
    for (var f = 1; f < floors; f++) line(x0, top + f * fh, x0 + w, top + f * fh, "pg-ln pg-hair pg-dash");
    for (var b = 1; b < bays; b++) line(x0 + b * bw, top, x0 + b * bw, GROUND, "pg-ln pg-hair pg-dash");
    for (var v = 0; v < Math.min(s.bath, 4); v++) vent(x0 + bw + 12 + v * 12, top);
    // The other units, drawn faint
    var mine = { bay: 1, floor: 1 };
    for (f = 0; f < floors; f++) for (b = 0; b < bays; b++) {
      if (f === mine.floor && b === mine.bay) continue;
      if (f === floors - 1 && b === 1) { rect(x0 + b * bw + 21, GROUND - 26, 16, 26, "pg-ln pg-hair"); continue; } // front door
      rect(x0 + b * bw + 12, top + f * fh + 9, 12, 15, "pg-ln pg-hair pg-soft");
      rect(x0 + b * bw + 34, top + f * fh + 9, 12, 15, "pg-ln pg-hair pg-soft");
    }
    // This unit: solid outline, one window per room
    var ux = x0 + mine.bay * bw, uy = top + mine.floor * fh;
    rect(ux, uy, bw, fh, "pg-ln pg-mine");
    var gap = (bw - rooms * 6) / (rooms + 1);
    for (var i = 0; i < rooms; i++) rect(ux + gap + i * (6 + gap), uy + 9, 6, 15, "pg-ln pg-thin");
    el("path", { d: "M" + (ux + bw) + " " + (uy + fh / 2) + " H" + (x0 + w + 16), class: "pg-ln pg-hair" }, drawing);
    el("text", { x: x0 + w + 19, y: uy + fh / 2 + 3.5, class: "pg-t" }, drawing, "This unit");
    // Parking bays beside the block
    var cars = Math.min(s.car, 2);
    for (var c = 0; c < cars; c++) {
      var px = x0 + w + 12 + c * 26;
      el("path", { d: "M" + px + " " + GROUND + " V" + (GROUND - 16) + " H" + (px + 22) + " V" + GROUND, class: "pg-ln pg-thin pg-dash" }, drawing);
      el("text", { x: px + 11, y: GROUND - 4.5, class: "pg-t pg-t-mid" }, drawing, "P");
    }
    extra(s.car, cars, x0 + w + 14 + cars * 26, GROUND - 5);
    ground(x0, x0 + w);
  }

  function drawElevation() {
    while (drawing.firstChild) drawing.removeChild(drawing.firstChild);
    [drawHouse, drawTownhouse, drawUnit][state.type](state);
    drawing.classList.remove("pg-in"); void drawing.getBoundingClientRect(); drawing.classList.add("pg-in");
  }

  /* ---------- Controls ---------- */
  function segment(host, names, key) {
    names.forEach(function (name, i) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = name; b.dataset.i = i;
      b.addEventListener("click", function () { var c = {}; c[key] = i; change(c); });
      host.appendChild(b);
    });
  }
  segment($("pg-type"), TYPES, "type");
  segment($("pg-region"), REGIONS, "region");
  Array.prototype.forEach.call(root.querySelectorAll(".pg-step"), function (host) {
    var key = host.dataset.key;
    [-1, 0, 1].forEach(function (dir) {
      if (dir === 0) { var o = document.createElement("output"); o.id = "pg-" + key; host.appendChild(o); return; }
      var b = document.createElement("button");
      b.type = "button"; b.textContent = dir < 0 ? "−" : "+"; b.dataset.dir = dir;
      b.setAttribute("aria-label", (dir < 0 ? "One fewer " : "One more ") + NOUN[key][0]);
      b.addEventListener("click", function () { var c = {}; c[key] = clamp(state[key] + dir, LIMITS[key][0], LIMITS[key][1]); change(c); });
      host.appendChild(b);
    });
  });
  var slider = $("pg-dist");
  slider.addEventListener("input", function () { change({ dist: +slider.value }); });

  function drawControls() {
    [["pg-type", state.type], ["pg-region", state.region]].forEach(function (p) {
      Array.prototype.forEach.call($(p[0]).children, function (b) { b.setAttribute("aria-pressed", +b.dataset.i === p[1] ? "true" : "false"); });
    });
    ["rooms", "bath", "car"].forEach(function (key) {
      $("pg-" + key).textContent = state[key];
      Array.prototype.forEach.call($("pg-" + key).parentNode.querySelectorAll("button"), function (b) {
        b.disabled = state[key] + (+b.dataset.dir) < LIMITS[key][0] || state[key] + (+b.dataset.dir) > LIMITS[key][1];
      });
    });
    slider.value = state.dist;
    $("pg-dist-v").textContent = state.dist + " km";
  }

  /* ---------- Price, range, bill of materials ---------- */
  function drawPrice() {
    var p = price(state), e = G.err.p50;
    $("pg-price").textContent = moneyFull(p);
    $("pg-range").textContent = "Half the test homes sold within " + Math.round(e * 100) + "% of the regression's guide. Here that is " +
      money(p * (1 - e)) + " to " + money(p * (1 + e)) + ".";
    // Bill of materials
    var body = $("pg-bom"), running = refPrice(), rows = [];
    rows.push(["00", "Reference home", TYPES[REF.type] + " · " + REF.rooms + " rooms · " + REF.bath + " bath · " + REF.car + " parking · " +
      REF.dist + " km · " + REGIONS[REF.region], "", money(running), ""]);
    steps(state).forEach(function (st, i) {
      running *= Math.exp(st.delta);
      var p = pct(st.delta);
      rows.push(["0" + (i + 1), st.item, st.spec, p, money(running), p === "0%" ? "pg-zero" : ""]);
    });
    body.innerHTML = "";
    rows.forEach(function (r) {
      var tr = document.createElement("tr"); if (r[5]) tr.className = r[5];
      [r[0] + " · " + r[1], r[2], r[3], r[4]].forEach(function (t, i) {
        var td = document.createElement(i === 0 ? "th" : "td"); if (i === 0) td.scope = "row"; td.textContent = t; tr.appendChild(td);
        if (i === 0) { // on a phone the spec sits under the item name
          var small = document.createElement("small"); small.className = "pg-spec-m"; small.textContent = r[2]; td.appendChild(small);
        }
      });
      body.appendChild(tr);
    });
    var total = document.createElement("tr"); total.className = "pg-total";
    total.innerHTML = '<th scope="row" colspan="2">Guide price</th><td class="pg-spacer"></td><td></td>';
    total.lastChild.textContent = money(p);
    body.appendChild(total);
    // Warn when the spec sits outside what the data covers
    var range = G.regionRange[REGIONS[state.region]], warn = $("pg-warn");
    if (state.dist < range[0] || state.dist > range[1]) {
      warn.textContent = "Few sales to go on here. Nearly all " + REGIONS[state.region] + " sales in the data sit between " +
        range[0] + " and " + range[1] + " km out, so at " + state.dist + " km the model is guessing.";
      warn.hidden = false;
    } else warn.hidden = true;
  }

  /* ---------- Real sale test ---------- */
  var pool = G.sales.filter(function (r) {
    return r[4] >= LIMITS.rooms[0] && r[4] <= LIMITS.rooms[1] && r[5] >= LIMITS.bath[0] && r[5] <= LIMITS.bath[1] &&
      r[6] >= LIMITS.car[0] && r[6] <= LIMITS.car[1] && r[8] >= LIMITS.dist[0] && r[8] <= LIMITS.dist[1];
  });
  $("pg-real").addEventListener("click", function () {
    var r = pool[Math.floor(Math.random() * pool.length)];
    real = r;
    state = { type: r[3], rooms: r[4], bath: r[5], car: r[6], dist: r[8], region: r[9], land: r[7] };
    angle = Math.atan2(-r[1], r[0]);
    var guide = price(state), actual = r[2] * 1000, miss = (guide - actual) / actual;
    tally.push(Math.abs(miss));
    var sorted = tally.slice().sort(function (a, b) { return a - b; });
    var med = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    var how = Math.abs(miss) < 0.005 ? "right on it" : Math.round(Math.abs(miss) * 100) + "% " + (miss > 0 ? "over" : "under");
    $("pg-real-out").innerHTML = "";
    var out = $("pg-real-out"), strong = document.createElement("strong");
    strong.textContent = "It sold for " + money(actual) + ". The guide says " + money(guide) + ", " + how + ".";
    var where = REGIONS[r[9]] + (REGIONS[r[9]].indexOf("Regional") === 0 ? "" : " region");
    out.appendChild(document.createTextNode("A real sale from the test set: a " + r[4] + "-room " + TYPES[r[3]].toLowerCase() + ", " +
      where + ", " + r[8] + " km out, with " + plural(r[5], "bath") + " and " + plural(r[6], "car") + ". "));
    out.appendChild(strong);
    if (tally.length > 1) out.appendChild(document.createTextNode(" Sales tested: " + tally.length + ". Median miss so far: " + Math.round(med * 100) + "%."));
    $("pg-real").textContent = "Test another sale";
    render();
  });
  $("pg-reset").addEventListener("click", function () {
    state = copy(START); state.land = null; real = null; angle = -Math.PI / 4;
    $("pg-real-out").textContent = "";
    render();
  });

  // Any manual change ends a real-sale test and goes back to typical land.
  function change(patch) {
    if (real) { real = null; state.land = null; $("pg-real-out").textContent = ""; }
    for (var k in patch) state[k] = patch[k];
    render();
  }
  function render() { drawControls(); drawMap(); drawElevation(); drawPrice(); }
  render();
})();
