/* Mini Bill: a small guide who hops between the sections of the home page.
   - He stands on each section heading as it comes into view, with one short line.
   - When the heading scrolls away he sits on the record player, so he is always in reach.
   - Press him and he sings a short tune. The tune and words are written for this site;
     the first line is a nod to the 1923 song "Yes! We Have No Bananas".
   - With "reduce motion" on, he stays on the record player and does not hop. */
(function () {
  "use strict";
  var BL = window.BL || {};
  if (document.getElementById("mini-me")) return;
  var hero = document.querySelector(".hero .greet");
  var player = document.querySelector(".record-player");
  if (!hero || !player) return;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var store = BL.store || { get: function () { return null; }, set: function () {} };
  var ROOT = BL.root || "./";

  var SVG = '<svg class="mm-svg" viewBox="0 0 120 152" aria-hidden="true">' +
  '<style>' +
    '.mm-svg{display:block;width:100%;height:auto;overflow:visible}' +
    '.mm-svg *{transform-box:view-box}' +
    '.mm-l{stroke:#3a2a2a;stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round}' +
    '.mm-n{stroke:none}' +
    '.mm-up{transform-origin:60px 132px;animation:mm-breathe 2.8s ease-in-out infinite}' +
    '.mm-head{transform-origin:60px 86px;animation:mm-tilt 4.6s ease-in-out infinite}' +
    '.mm-eye{animation:mm-blink 4.2s infinite}' +
    '.mm-eye.l{transform-origin:45px 58px}.mm-eye.r{transform-origin:75px 58px}' +
    '.mm-arm-r{transform-origin:79px 97px;transition:transform 260ms ease}' +
    '.mm-arm-l{transform-origin:42px 98px;transition:transform 320ms ease}' +
    '.mm-hat,.mm-o,.mm-note{opacity:0}' +
    '.mm-hat{transition:opacity 200ms ease}' +
    '[data-pose="hat"] .mm-hat{opacity:1}' +
    '[data-pose="call"] .mm-arm-l{transform:rotate(26deg) translate(7px,-9px)}' +
    '.wave .mm-arm-r{animation:mm-wave 1.4s ease-in-out}' +
    '.sing .mm-o{opacity:1}.sing .mm-smile{opacity:0}' +
    '.sing .mm-o{transform-origin:60px 76px;animation:mm-mouth .38s ease-in-out infinite}' +
    '.sing .mm-head{animation:mm-bob .76s ease-in-out infinite}' +
    '.sing .mm-note{animation:mm-float 1.5s ease-out infinite}' +
    '.sing .mm-note.n2{animation-delay:.5s}.sing .mm-note.n3{animation-delay:1s}' +
    '@keyframes mm-breathe{50%{transform:scaleY(1.018)}}' +
    '@keyframes mm-tilt{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}' +
    '@keyframes mm-blink{0%,92%,100%{transform:scaleY(1)}95.5%{transform:scaleY(.08)}}' +
    '@keyframes mm-wave{0%,100%{transform:rotate(0)}18%,58%{transform:rotate(-128deg)}38%,78%{transform:rotate(-100deg)}}' +
    '@keyframes mm-mouth{50%{transform:scale(.72,.5)}}' +
    '@keyframes mm-bob{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg) translateY(1.5px)}}' +
    '@keyframes mm-float{0%{opacity:0;transform:translateY(0)}20%{opacity:1}100%{opacity:0;transform:translateY(-26px)}}' +
  '</style>' +
  // legs and shoes
  '<g class="mm-l">' +
    '<path d="M47 118h12v20a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z" fill="#2c2c35"/>' +
    '<path d="M61 118h12v20a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z" fill="#2c2c35"/>' +
    '<path d="M42 146c0-4 4-6 9-6s8 2 8 6z" fill="#17171c"/>' +
    '<path d="M61 146c0-4 3-6 8-6s9 2 9 6z" fill="#17171c"/>' +
  '</g>' +
  '<g class="mm-up">' +
    // his left arm (on the viewer's right): the one that waves
    '<g class="mm-arm-r mm-l"><path d="M79 97q9 8 11 22" fill="none" stroke-width="12.5" stroke="#3a2a2a"/><path d="M79 97q9 8 11 22" fill="none" stroke-width="8" stroke="#34343f"/><circle cx="90.500" cy="122" r="5.4" fill="#fbd9b8"/></g>' +
    // jacket, shirt, tie
    '<g class="mm-l">' +
      '<path d="M41 94q0-7 8-7h22q8 0 8 7v24q0 6-6 6H47q-6 0-6-6z" fill="#34343f"/>' +
      '<path d="M50 87h20l-10 22z" fill="#dcd3f2"/>' +
      '<path d="M57 90h6l2.200 17-5.200 6-5.200-6z" fill="#b5364a"/>' +
      '<path d="M50 87l10 22-4 5-8-16zM70 87l-10 22 4 5 8-16z" fill="#3c3c48"/>' +
      '<path d="M44 121h32" stroke-width="1.6"/>' +
    '</g>' +
    '<g class="mm-n" fill="#f3c9cf"><circle cx="60" cy="96" r=".9"/><circle cx="58.600" cy="100" r=".9"/><circle cx="61.400" cy="103" r=".9"/><circle cx="59.500" cy="107" r=".9"/></g>' +
    '<g class="mm-n" fill="#17171c"><circle cx="63" cy="114" r="1.2"/><circle cx="63" cy="119" r="1.2"/></g>' +
    // his right arm (viewer's left), holding the phone
    '<g class="mm-arm-l mm-l">' +
      '<path d="M42 98q-9 8-15 4" fill="none" stroke-width="12.500" stroke="#3a2a2a"/><path d="M42 98q-9 8-15 4" fill="none" stroke-width="8" stroke="#34343f"/>' +
      '<rect x="15" y="76" width="14" height="24" rx="3" fill="#59688a" transform="rotate(-9 22 88)"/>' +
      '<rect class="mm-n" x="17.500" y="79" width="4" height="5" rx="1.200" fill="#2c3550" transform="rotate(-9 22 88)"/>' +
      '<circle cx="26" cy="100.500" r="5.600" fill="#fbd9b8"/>' +
    '</g>' +
    // head
    '<g class="mm-head">' +
      '<g class="mm-l">' +
        '<ellipse cx="25" cy="60" rx="5.500" ry="6.500" fill="#fbd9b8"/><ellipse cx="95" cy="60" rx="5.500" ry="6.500" fill="#fbd9b8"/>' +
        '<path d="M26 56c0-20 14-33 34-33s34 13 34 33c0 19-14 31-34 31S26 75 26 56z" fill="#fde0c2"/>' +
        // hair: one cap with a swept fringe
        '<path d="M24 58c-5-28 12-46 36-46s41 18 36 46c-3-9-8-15-15-19-6 5-13 7-22 5-5 3-11 2-16-2-9 3-15 9-19 16z" fill="#2a2630"/>' +
        '<path d="M63 13q5-9 11-1" fill="none"/>' +
      '</g>' +
      '<g class="mm-n" fill="#57515f"><ellipse cx="42" cy="24" rx="6.500" ry="2.800" transform="rotate(-28 42 24)"/><ellipse cx="76" cy="22" rx="4.500" ry="2.200" transform="rotate(22 76 22)"/><circle cx="53" cy="18.500" r="1.800"/></g>' +
      '<g class="mm-n" fill="#f6a7a7" opacity=".85"><ellipse cx="35.500" cy="70" rx="5.500" ry="3.200"/><ellipse cx="84.500" cy="70" rx="5.500" ry="3.200"/></g>' +
      '<path class="mm-l" d="M38 46.500q6-3.500 12-1M70 45.500q6-2.500 12 1" fill="none" stroke-width="2"/>' +
      '<g class="mm-eye l mm-n"><ellipse cx="45" cy="59" rx="5.800" ry="7.200" fill="#3a2a2a"/><ellipse cx="45" cy="60.500" rx="3.600" ry="4.600" fill="#6b4a3a"/><circle cx="43" cy="56" r="2.300" fill="#fff"/><circle cx="47.200" cy="62.500" r="1.100" fill="#fff"/></g>' +
      '<g class="mm-eye r mm-n"><ellipse cx="75" cy="59" rx="5.800" ry="7.200" fill="#3a2a2a"/><ellipse cx="75" cy="60.500" rx="3.600" ry="4.600" fill="#6b4a3a"/><circle cx="73" cy="56" r="2.300" fill="#fff"/><circle cx="77.200" cy="62.500" r="1.100" fill="#fff"/></g>' +
      // glasses
      '<g class="mm-l" fill="none" stroke-width="2.200"><rect x="32.500" y="49" width="25" height="19.500" rx="6.500"/><rect x="62.500" y="49" width="25" height="19.500" rx="6.500"/><path d="M57.500 57q2.500-1.500 5 0M32.500 55l-6-1M87.500 55l6-1"/></g>' +
      '<path class="mm-smile mm-l" d="M53.500 75.500q6.500 5.500 13 0" fill="none" stroke-width="2.200"/>' +
      '<ellipse class="mm-o mm-l" cx="60" cy="77.500" rx="4.200" ry="4.800" fill="#8a3038" stroke-width="2"/>' +
      // hard hat for the toolkit stop
      '<g class="mm-hat mm-l"><path d="M27 37c0-18 14-30 33-30s33 12 33 30z" fill="#F25C1F"/><path d="M21 37h78v3a3 3 0 0 1-3 3H24a3 3 0 0 1-3-3z" fill="#F25C1F"/><path d="M55 8v29M65 8v29" fill="none" stroke-width="1.600"/></g>' +
    '</g>' +
  '</g>' +
  '<g class="mm-n" font-family="serif" font-size="17"><text class="mm-note" x="98" y="34" fill="#F25C1F">♪</text><text class="mm-note n2" x="6" y="40" fill="#F25C1F">♫</text><text class="mm-note n3" x="104" y="58" fill="#F25C1F">♪</text></g>' +
'</svg>';

  /* ---------- Stops: where he stands, and what he says ---------- */
  // "say" can differ by visitor path (recruiter, classmate, explorer). "go" adds one link.
  var STOPS = [
    { id: "hero", say: {
        any: "Hi, I'm mini Bill. Press me for a song.",
        recruiter: "Short on time? Resume first.",
        classmate: "The R work lives in Core samples." },
      go: { recruiter: ["Resume", "resume.html"], classmate: ["Jump there", "#samples"] } },
    { id: "about-me", say: { any: "That's the full-size me." } },
    { id: "journey", say: { any: "Four stops so far. Press one on the map." } },
    { id: "samples", say: {
        any: "Four case studies. Each has something to try.",
        recruiter: "Start with the rig count forecast." },
      go: { recruiter: ["Open it", "projects/rig-count.html"] } },
    { id: "skills", pose: "hat", say: { any: "Every part links to where I used it." } },
    { id: "now", say: { any: "What's on my desk this month." } },
    { id: "contact", pose: "call", say: {
        any: "LinkedIn is the quickest way to reach me.",
        recruiter: "The resume downloads right here.",
        explorer: "You made it. Now steer the bit." },
      go: { explorer: ["Play", "play.html"] } }
  ];
  STOPS.forEach(function (s) { s.el = s.id === "hero" ? hero : document.getElementById(s.id); s.said = false; });
  STOPS = STOPS.filter(function (s) { return s.el; });

  /* ---------- Build ---------- */
  var mm = document.createElement("div");
  mm.id = "mini-me"; mm.className = "mm";
  mm.innerHTML = '<span class="mm-shadow" aria-hidden="true"></span>' +
    '<button type="button" class="mm-btn" aria-label="Mini Bill, the site guide. Press for a short song.">' + SVG + "</button>";
  var bubble = document.createElement("div");
  bubble.className = "mm-bubble"; bubble.setAttribute("role", "status"); bubble.setAttribute("aria-live", "polite");
  bubble.innerHTML = '<span class="mm-say"></span><a class="mm-go" hidden></a>' +
    '<button type="button" class="mm-x" aria-label="Stop the tour">×</button>';
  document.body.appendChild(mm); document.body.appendChild(bubble);
  var btn = mm.querySelector(".mm-btn"), svg = mm.querySelector("svg"), shadow = mm.querySelector(".mm-shadow");
  var sayEl = bubble.querySelector(".mm-say"), goEl = bubble.querySelector(".mm-go"), xEl = bubble.querySelector(".mm-x");

  var quiet = store.get("bl-mini", true) === "quiet";   // tour stopped for this visit
  var state = { at: null, mode: "perch", hopping: false, raf: null, singing: false, bubbleTimer: null, ready: false };

  function size() { var r = mm.getBoundingClientRect(); return { w: r.width || 60, h: r.height || 76 }; }
  function navBottom() { var h = document.getElementById("quarto-header"); return h ? Math.max(0, h.getBoundingClientRect().bottom) : 0; }
  function visitor() { return document.documentElement.getAttribute("data-visitor") || "any"; }

  /* ---------- Where to stand (screen coordinates of his feet) ---------- */
  function textRects(node) {
    var r = document.createRange(); r.selectNodeContents(node);
    return Array.prototype.slice.call(r.getClientRects()).filter(function (b) { return b.width > 1; });
  }
  function hits(rects, left, top, right, bottom) {
    return rects.some(function (b) { return b.right > left && b.left < right && b.bottom > top && b.top < bottom; });
  }
  function stopPoint(s) {
    var sz = size(), half = sz.w / 2;
    if (s.id === "hero") {
      var name = s.el.querySelector(".name") || s.el, rs = name.getClientRects(), r = rs[rs.length - 1];
      if (!r) return null;
      var limit = s.el.getBoundingClientRect().right;
      var x = r.right + 10 + half, y = r.bottom - r.height * 0.14;
      if (x + half > limit) { x = limit - half; y = r.top + 2; } // no room after the name: stand above it
      return { x: x, y: y, labels: [s.el.parentNode.querySelector(".label")] };
    }
    var h2 = s.el.querySelector("h2");
    if (!h2) return null;
    var hr = h2.getBoundingClientRect(), kick = s.el.querySelector(".kicker");
    var px = hr.right - half - 4, py = hr.bottom - 1;                 // on the rule under the heading
    var words = textRects(h2);
    if (hits(words, px - half - 8, py - sz.h, px + half, py)) {
      py = hr.top + 3;                                                  // heading is long: stand on top of it
      if (kick && hits(textRects(kick), px - half - 8, py - sz.h, px + half, py)) py = kick.getBoundingClientRect().top + 1;
    }
    return { x: px, y: py, labels: [kick, s.el.querySelector(".depth")] };
  }
  function perchPoint() {
    var r = player.querySelector(".rp-deck").getBoundingClientRect();
    return { x: r.left + r.width * 0.36, y: r.top + r.height * 0.045 };
  }
  function onScreen(p) {
    var sz = size();
    return p && p.y - sz.h > navBottom() + 6 && p.y < window.innerHeight - 6;
  }

  /* ---------- Placement ---------- */
  function setFixed(x, y) {
    var sz = size();
    mm.style.position = "fixed";
    mm.style.transform = "translate3d(" + (x - sz.w / 2).toFixed(1) + "px," + (y - sz.h).toFixed(1) + "px,0)";
  }
  function setInPage(x, y) {
    var sz = size();
    mm.style.position = "absolute";
    mm.style.transform = "translate3d(" + (x - sz.w / 2 + window.scrollX).toFixed(1) + "px," + (y - sz.h + window.scrollY).toFixed(1) + "px,0)";
  }
  function feet() { var r = mm.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom }; }
  function targetPoint() { return state.mode === "anchor" && state.at ? stopPoint(state.at) : perchPoint(); }
  function settle() {
    var p = targetPoint(); if (!p) return;
    if (state.mode === "anchor") setInPage(p.x, p.y); else setFixed(p.x, p.y);
    placeBubble();
  }

  /* ---------- Hop ---------- */
  function hopTo(done) {
    cancelAnimationFrame(state.raf);
    var from = feet(), sz = size();
    from.y = Math.max(-10, Math.min(window.innerHeight + sz.h + 10, from.y)); // come in from the edge of the screen
    var first = targetPoint(); if (!first) { if (done) done(); return; }
    var dist = Math.hypot(first.x - from.x, first.y - from.y);
    if (reduceMotion || dist < 3) { settle(); if (done) done(); return; }
    var hops = Math.max(1, Math.min(3, Math.round(dist / 300)));
    var dur = Math.max(480, Math.min(1150, 360 + dist * 0.75)), t0 = performance.now();
    var lift = Math.min(64, 26 + dist * 0.07) * (sz.h / 76);
    state.hopping = true; mm.classList.add("hop"); hideBubble();
    (function step(t) {
      var p = Math.min(1, (t - t0) / dur), to = targetPoint() || first;
      var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;   // ease along the line
      var air = Math.abs(Math.sin(hops * Math.PI * p));                 // 0 on the ground, 1 at the top
      setFixed(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e - lift * air);
      var sq = air < 0.22 ? 1 - air / 0.22 : 0;                         // squash near each landing
      btn.style.transform = "scale(" + (1 + 0.10 * sq - 0.03 * air).toFixed(3) + "," + (1 - 0.13 * sq + 0.05 * air).toFixed(3) + ")";
      shadow.style.transform = "scale(" + (1 - 0.45 * air).toFixed(3) + ")";
      shadow.style.opacity = (0.9 - 0.5 * air).toFixed(2);
      if (p < 1) { state.raf = requestAnimationFrame(step); return; }
      btn.style.transform = ""; shadow.style.transform = ""; shadow.style.opacity = "";
      state.hopping = false; mm.classList.remove("hop");
      settle(); if (done) done();
    })(t0);
  }

  /* ---------- Speech bubble ---------- */
  function placeBubble() {
    if (!bubble.classList.contains("show")) return;
    var r = mm.getBoundingClientRect(), bw = bubble.offsetWidth, bh = bubble.offsetHeight, vw = document.documentElement.clientWidth;
    var left, top, side;
    if (state.mode === "perch") {
      side = "left"; left = r.right + 10; top = r.top + r.height * 0.3 - bh / 2;
      if (left + bw > vw - 8) { side = "down"; left = Math.max(8, Math.min(vw - bw - 8, r.left)); top = r.top - bh - 10; }
    } else {
      side = "down"; top = r.top - bh - 10;
      // Beside a heading he is at the right edge, so the bubble opens to his left.
      // After the greeting there is room on both sides, so it sits more over him.
      left = state.at && state.at.id === "hero" ? r.left + r.width / 2 - bw * 0.3 : r.right + 4 - bw;
      left = Math.max(8, Math.min(vw - bw - 8, left));
      // Keep off the small labels above the heading: lift the bubble clear of any it would cover,
      // unless that would push it under the top bar.
      var p = state.at && stopPoint(state.at), lifted = top;
      ((p && p.labels) || []).forEach(function (lab) {
        if (lab && hits(textRects(lab), left - 6, lifted - 4, left + bw + 6, lifted + bh + 4)) lifted = Math.min(lifted, lab.getBoundingClientRect().top - bh - 8);
      });
      if (lifted >= navBottom() + 6) top = lifted;
      if (top < navBottom() + 6) { side = "up"; left = Math.max(8, Math.min(vw - bw - 8, r.right - bw)); top = r.bottom + 10; }
    }
    bubble.setAttribute("data-tail", side);
    var tail = Math.max(14, Math.min(bw - 14, r.left + r.width / 2 - left));
    bubble.style.setProperty("--tail", tail.toFixed(0) + "px");
    if (state.mode === "perch") { bubble.style.position = "fixed"; bubble.style.left = left.toFixed(0) + "px"; bubble.style.top = top.toFixed(0) + "px"; }
    else { bubble.style.position = "absolute"; bubble.style.left = (left + window.scrollX).toFixed(0) + "px"; bubble.style.top = (top + window.scrollY).toFixed(0) + "px"; }
  }
  function showBubble(text, go, ms, song) {
    clearTimeout(state.bubbleTimer);
    sayEl.textContent = text;
    if (go) { goEl.hidden = false; goEl.textContent = go[0] + " →"; goEl.setAttribute("href", go[1].charAt(0) === "#" ? go[1] : ROOT + go[1]); }
    else { goEl.hidden = true; goEl.removeAttribute("href"); }
    xEl.hidden = !!song;
    bubble.classList.toggle("song", !!song);
    bubble.classList.add("show"); placeBubble();
    if (ms) state.bubbleTimer = setTimeout(function () { hideBubble(); }, ms);
  }
  function hideBubble() {
    if (state.singing) return; // the song keeps its line while he moves
    clearTimeout(state.bubbleTimer); bubble.classList.remove("show");
  }
  function speak(s) {
    if (quiet || state.singing || s.said) return;
    s.said = true;
    var v = visitor();
    showBubble(s.say[v] || s.say.any, s.go ? s.go[v] : null, 6500);
  }
  xEl.addEventListener("click", function () {
    quiet = true; store.set("bl-mini", "quiet", true);
    clearTimeout(state.bubbleTimer); bubble.classList.remove("show");
    update(true);
  });
  goEl.addEventListener("click", function () { clearTimeout(state.bubbleTimer); bubble.classList.remove("show"); });

  /* ---------- Follow the page ---------- */
  function activeStop() {
    var line = window.innerHeight * 0.62, found = STOPS[0];
    for (var i = 1; i < STOPS.length; i++) {
      var h2 = STOPS[i].el.querySelector("h2") || STOPS[i].el;
      if (h2.getBoundingClientRect().top < line) found = STOPS[i];
    }
    return found;
  }
  function update(force) {
    if (!state.ready) return;
    var s = activeStop(), p = stopPoint(s);
    var mode = !quiet && !reduceMotion && onScreen(p) ? "anchor" : "perch";
    var moved = force || s !== state.at || mode !== state.mode;
    if (!moved) { if (!state.hopping) settle(); return; }
    var arrived = s !== state.at;
    state.at = s; state.mode = mode;
    svg.setAttribute("data-pose", mode === "anchor" && s.pose ? s.pose : "");
    hopTo(function () { if (arrived || !s.said) speak(s); });
  }
  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { ticking = false; update(false); });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  setInterval(function () { if (state.ready && !state.hopping) settle(); }, 500); // headings shift as sections fade in

  // The record player's panel opens right where he sits: step aside while it is open.
  var panel = player.querySelector(".rp-panel");
  if (panel && "MutationObserver" in window) {
    new MutationObserver(function () { mm.classList.toggle("aside", !panel.hidden && state.mode === "perch"); })
      .observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  }

  /* ---------- The song ---------- */
  // An original tune: [note, length in eighth notes]. Four lines of eight eighths each.
  var N = { A3: 220, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88,
            C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, C3: 130.81, D3: 146.83, F3: 174.61, G3: 196, G2: 98, C2: 65.41 };
  var TUNE = [
    ["G4",1],["C5",1],["E5",1],["G5",1],["E5",1],["C5",1],["D5",2],
    ["D5",1],["E5",1],["F5",1],["A5",2],["G5",1],["E5",2],
    ["G4",1],["C5",1],["E5",2],["F5",1],["E5",1],["D5",1],["C5",1],
    ["A4",1],["B4",1],["D5",1],["G5",1],["F5",1],["D5",1],["C5",2]
  ];
  var BASS = ["C3","G3","C3","G3", "D3","A3","G2","G3", "C3","G3","F3","C4", "G2","D3","C3","C3"]; // one per quarter note
  var WORDS = ["Yes, we have no bananas,", "but we've got parts on time.", "Welcome in, mind the drill floor,", "scroll on down, there's plenty more."];
  var EIGHTH = 0.2, audio = null, songTimers = [];
  function tone(ctx, out, type, freq, t, len, peak) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.02);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.5), t + len * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.02);
  }
  function stopSong(wave) {
    songTimers.forEach(clearTimeout); songTimers = [];
    if (audio) { try { audio.close(); } catch (e) {} audio = null; }
    if (BL.music && BL.music.duck) BL.music.duck(false);
    state.singing = false; svg.classList.remove("sing");
    btn.setAttribute("aria-pressed", "false");
    if (wave) {
      svg.classList.add("wave"); setTimeout(function () { svg.classList.remove("wave"); }, 1500);
      showBubble("Bananas: on order. ETA soon.", null, 3200);
    } else { clearTimeout(state.bubbleTimer); bubble.classList.remove("show"); }
  }
  function sing() {
    if (state.singing) { stopSong(false); return; }
    state.singing = true; svg.classList.add("sing"); btn.setAttribute("aria-pressed", "true");
    if (BL.music && BL.music.duck) BL.music.duck(true);
    var AC = window.AudioContext || window.webkitAudioContext, t = 0;
    if (AC) {
      try {
        audio = new AC();
        var vol = parseInt(store.get("bl-vol"), 10); if (isNaN(vol)) vol = 35;
        var master = audio.createGain(); master.gain.value = 0.5 * Math.max(0.35, Math.min(1.4, vol / 35));
        master.connect(audio.destination);
        if (audio.state === "suspended" && audio.resume) audio.resume();
        var start = audio.currentTime + 0.08, at = start;
        TUNE.forEach(function (n) {
          var len = n[1] * EIGHTH;
          tone(audio, master, "triangle", N[n[0]], at, len * 0.95, 0.30);
          tone(audio, master, "sine", N[n[0]] * 2, at, len * 0.5, 0.05);
          at += len;
        });
        BASS.forEach(function (b, i) { tone(audio, master, "sine", N[b], start + i * 2 * EIGHTH, EIGHTH * 1.7, 0.22); });
        ["C4","E4","G4","C5"].forEach(function (c) { tone(audio, master, "triangle", N[c], at + 0.02, 0.7, 0.13); }); // last chord
        t = at - start;
      } catch (e) { audio = null; }
    }
    if (!t) t = 32 * EIGHTH;
    WORDS.forEach(function (w, i) {
      songTimers.push(setTimeout(function () { showBubble("♪ " + w, null, 0, true); }, i * 8 * EIGHTH * 1000));
    });
    songTimers.push(setTimeout(function () { stopSong(true); }, (t + 0.75) * 1000));
  }
  btn.addEventListener("click", sing);

  /* ---------- Start once the entrance screens are out of the way ---------- */
  function clear() {
    var picker = document.getElementById("picker");
    return !document.getElementById("intro") && !(picker && picker.classList.contains("open"));
  }
  (function wait() {
    if (!clear()) { setTimeout(wait, 300); return; }
    var p = perchPoint(); setFixed(p.x, p.y);
    mm.classList.add("in");
    setTimeout(function () {
      state.ready = true; update(true);
      if (!reduceMotion) { svg.classList.add("wave"); setTimeout(function () { svg.classList.remove("wave"); }, 1500); }
    }, 700);
  })();

  BL.mini = { sing: sing, update: update };
})();
