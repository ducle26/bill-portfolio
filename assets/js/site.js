/* Shared behavior for every page.
   Each page carries a hidden tag like:
   <div id="sheet-meta" data-sheet="02" data-title="About" data-top="500" data-bottom="1200"></div>
   which drives the depth gauge, the title block, and the sheet log. */
(function () {
  "use strict";
  var ROOT = window.SITE_ROOT || "./";
  var TOTAL_SHEETS = "08";
  var LOG_TOTAL = 11; // pages that count toward "Logged"
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Storage can throw in private windows, so wrap every call.
  var store = {
    get: function (k, s) { try { return (s ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } },
    set: function (k, v, s) { try { (s ? sessionStorage : localStorage).setItem(k, v); } catch (e) {} }
  };
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function fmtFt(n) { return Math.round(n).toLocaleString("en-US") + " ft"; }
  function isVi() { return document.documentElement.getAttribute("lang") === "vi"; }
  var BL = window.BL = { store: store, root: ROOT, depth: 0, rop: 0 };

  /* ---------- Toasts ---------- */
  var toastBox = el("div", "toasts");
  toastBox.setAttribute("aria-live", "polite");
  document.body.appendChild(toastBox);
  function toast(html, ms, actions) {
    var t = el("div", "toast", "<span>" + html + "</span>");
    (actions || []).forEach(function (a) {
      var b = el("button", "toast-btn", a.label); b.type = "button";
      b.addEventListener("click", function () { a.run(); close(); });
      t.appendChild(b);
    });
    var x = el("button", "toast-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Close");
    x.addEventListener("click", close); t.appendChild(x);
    toastBox.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("in"); });
    var timer = setTimeout(close, ms || 5000);
    function close() { clearTimeout(timer); t.classList.remove("in"); setTimeout(function () { t.remove(); }, 300); }
    return close;
  }
  BL.toast = toast;

  /* ---------- Sheet info ---------- */
  var metaEl = document.getElementById("sheet-meta");
  var sheet = {
    no: metaEl ? metaEl.dataset.sheet : "--",
    title: metaEl ? metaEl.dataset.title : document.title,
    top: metaEl ? +metaEl.dataset.top : 0,
    bottom: metaEl ? +metaEl.dataset.bottom : 0,
    gauge: metaEl ? metaEl.dataset.gauge !== "off" : false,
    counts: metaEl ? metaEl.dataset.log !== "off" : false
  };

  /* ---------- Mud-pulse bar: a quick row of dots on page load ---------- */
  var bar = el("div", "pulse-bar");
  for (var i = 0; i < 14; i++) { var d = el("span"); d.style.animationDelay = (i * 35) + "ms"; bar.appendChild(d); }
  document.body.appendChild(bar);
  requestAnimationFrame(function () { bar.classList.add("go"); });

  /* ---------- Sheet log: which pages this visitor has seen ---------- */
  var logged = [];
  try { logged = JSON.parse(store.get("bl-logged") || "[]"); } catch (e) { logged = []; }
  if (sheet.counts && metaEl) {
    var key = sheet.no + ":" + sheet.title;
    if (logged.indexOf(key) === -1) {
      logged.push(key);
      store.set("bl-logged", JSON.stringify(logged));
      if (logged.length === LOG_TOTAL) {
        store.set("bl-td", "1");
        setTimeout(function () {
          toast(isVi() ? "Bạn đã xem hết " + LOG_TOTAL + " trang. Nhật ký khoan đã mở." : "All " + LOG_TOTAL + " sheets logged. The drill log is open.", 7000,
            [{ label: isVi() ? "Mở" : "Open it", run: function () { location.href = ROOT + "drill-log.html"; } }]);
        }, 1200);
      } else if (logged.length > 1) {
        setTimeout(function () { toast((isVi() ? "Đã ghi nhận trang " : "Sheet logged · ") + Math.min(logged.length, LOG_TOTAL) + " / " + LOG_TOTAL, 2600); }, 900);
      }
    }
  }
  if (store.get("bl-td") === "1") document.documentElement.classList.add("td-reached");

  /* ---------- Depth gauge and title block ---------- */
  var marker = null, tbDepth = null, tbRop = null;
  if (sheet.gauge && sheet.bottom > sheet.top) {
    var gauge = el("div", "depth-gauge");
    gauge.setAttribute("aria-hidden", "true");
    gauge.appendChild(el("div", "dg-top", fmtFt(sheet.top)));
    gauge.appendChild(el("div", "dg-bottom", fmtFt(sheet.bottom)));
    marker = el("div", "dg-marker", fmtFt(sheet.top));
    gauge.appendChild(marker);
    document.body.appendChild(gauge);
    document.body.classList.add("has-gauge");
  }

  if (metaEl) {
    var tb = el("div", "title-block-fixed");
    tb.setAttribute("role", "button");
    tb.setAttribute("tabindex", "0");
    tb.setAttribute("aria-label", "Drawing title block. Press to expand or shrink.");
    tb.innerHTML =
      '<div class="tb-name">Duc (Bill) Le</div>' +
      "<div>Sheet</div><div>" + sheet.no + " / " + TOTAL_SHEETS + "</div>" +
      "<div>Title</div><div>" + sheet.title + "</div>" +
      '<div class="tb-k-depth">Depth</div><div class="tb-depth">' + (sheet.bottom ? fmtFt(sheet.top) : "n/a") + "</div>" +
      '<div title="Rate of penetration: how fast you are scrolling">ROP</div><div class="tb-rop">0 ft/s</div>' +
      '<div title="Pages you have seen">Logged</div><div class="tb-log">' + Math.min(logged.length, LOG_TOTAL) + " / " + LOG_TOTAL + "</div>" +
      "<div>Rev</div><div>2026.10</div>";
    var small = store.get("bl-tb") === "small";
    if (small) tb.classList.add("small");
    function toggleTb() { tb.classList.toggle("small"); store.set("bl-tb", tb.classList.contains("small") ? "small" : "big"); }
    tb.addEventListener("click", toggleTb);
    tb.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleTb(); } });
    document.body.appendChild(tb);
    tbDepth = tb.querySelector(".tb-depth");
    tbRop = tb.querySelector(".tb-rop");
  }

  // Sections marked with data-depth make the gauge match their labels.
  var anchors = Array.prototype.slice.call(document.querySelectorAll("[data-depth]"));
  function anchorDepth() {
    var y = window.scrollY + window.innerHeight * 0.35;
    var pts = anchors.map(function (a) { return { y: a.getBoundingClientRect().top + window.scrollY, d: +a.dataset.depth }; });
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (window.scrollY >= max - 2) return sheet.bottom;
    if (y <= pts[0].y) return pts[0].d;
    for (var i = 1; i < pts.length; i++) {
      if (y < pts[i].y) return pts[i - 1].d + (pts[i].d - pts[i - 1].d) * (y - pts[i - 1].y) / (pts[i].y - pts[i - 1].y);
    }
    var last = pts[pts.length - 1];
    var rest = (y - last.y) / Math.max(1, document.documentElement.scrollHeight - last.y);
    return last.d + (sheet.bottom - last.d) * Math.min(1, rest);
  }
  function onScroll() {
    if (!sheet.bottom) return;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    var depth = anchors.length ? anchorDepth() : sheet.top + p * (sheet.bottom - sheet.top);
    BL.depth = depth;
    p = (depth - sheet.top) / (sheet.bottom - sheet.top);
    if (marker) {
      marker.style.top = (24 + p * (window.innerHeight - 64 - 120)) + "px";
      marker.textContent = fmtFt(depth);
    }
    if (tbDepth && !document.body.classList.contains("playing")) tbDepth.textContent = fmtFt(depth);
  }
  if (sheet.bottom) {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    // Rate of penetration: how fast the visitor is "drilling" (scrolling), in ft/hr.
    var lastD = BL.depth, lastT = performance.now(), ropSmooth = 0;
    setInterval(function () {
      var now = performance.now(), dt = (now - lastT) / 1000;
      var rate = Math.abs(BL.depth - lastD) / dt; // ft per second
      ropSmooth = ropSmooth * 0.6 + rate * 0.4; if (ropSmooth < 1) ropSmooth = 0;
      BL.rop = ropSmooth; lastD = BL.depth; lastT = now;
      if (tbRop) tbRop.textContent = Math.round(ropSmooth).toLocaleString("en-US") + " ft/s";
    }, 250);
  }

  /* ---------- Navbar tools: language, music, radio ---------- */
  var NAV_VI = {
    "Surface": "Mặt đất", "About": "Giới thiệu", "Core samples": "Mẫu lõi", "Resume": "Hồ sơ",
    "Notes": "Ghi chép", "Play": "Chơi", "Off the clock": "Ngoài giờ"
  };
  var tools = el("div", "nav-tools");
  var langBtn = el("button", "nav-tool", '<span data-l="en">EN</span> / <span data-l="vi">VI</span>');
  langBtn.type = "button"; langBtn.setAttribute("aria-label", "Switch language between English and Vietnamese");
  var musicBtn = el("button", "nav-tool music-btn", '<span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="mlabel">Music</span>');
  musicBtn.type = "button"; musicBtn.setAttribute("aria-pressed", "false"); musicBtn.setAttribute("aria-label", "Play or pause music");
  var radioBtn = el("button", "nav-tool", "Radio ↗");
  radioBtn.type = "button"; radioBtn.setAttribute("aria-label", "Open the full radio in a small window");
  tools.appendChild(langBtn); tools.appendChild(musicBtn); tools.appendChild(radioBtn);
  var navTarget = document.querySelector(".quarto-navbar-tools") || document.querySelector("#navbarCollapse");
  if (navTarget) navTarget.insertBefore(tools, navTarget.firstChild);

  radioBtn.addEventListener("click", function () {
    var url = ROOT + "radio/index.html";
    var w = window.open(url, "bill-radio", "width=420,height=680,menubar=no,toolbar=no,location=no");
    if (!w) window.location.href = url; // popup blocked: open in this tab
  });

  /* ---------- Language toggle ---------- */
  var viNodes = Array.prototype.slice.call(document.querySelectorAll("[data-vi]"));
  viNodes.forEach(function (n) { n._en = n.innerHTML; });
  var navTexts = Array.prototype.slice.call(document.querySelectorAll(".navbar .menu-text"));
  navTexts.forEach(function (n) { n._en = n.textContent.trim(); });
  function setLang(lang) {
    document.documentElement.setAttribute("lang", lang === "vi" ? "vi" : "en");
    viNodes.forEach(function (n) { n.innerHTML = lang === "vi" ? n.getAttribute("data-vi") : n._en; });
    navTexts.forEach(function (n) { n.textContent = lang === "vi" && NAV_VI[n._en] ? NAV_VI[n._en] : n._en; });
    langBtn.querySelectorAll("[data-l]").forEach(function (s) { s.classList.toggle("on", s.dataset.l === lang); });
    store.set("bl-lang", lang);
    document.dispatchEvent(new CustomEvent("bl:lang", { detail: lang }));
  }
  langBtn.addEventListener("click", function () { setLang(isVi() ? "en" : "vi"); });
  setLang(store.get("bl-lang") === "vi" ? "vi" : "en");

  /* ---------- Music: starts softly a couple of seconds in ---------- */
  // Browsers only allow sound after the visitor clicks, taps, or presses a key.
  // If they already have, music starts on time; otherwise it starts on their first click.
  var music = { ctx: null, player: null, on: false, armed: false, saveTimer: null, firstShown: false };
  var bc = null, myId = Math.random().toString(36).slice(2);
  try { bc = new BroadcastChannel("bill-radio"); } catch (e) {}
  function musicPref() { return store.get("bl-music") !== "off"; }
  function radioAlive() { var t = +store.get("bl-radio-alive") || 0; return Date.now() - t < 4000; }
  function readPos() { try { return JSON.parse(store.get("bl-music-pos", true) || "{}"); } catch (e) { return {}; } }
  function savePos(on) {
    if (!music.player) return;
    var s = music.player.state();
    store.set("bl-music-pos", JSON.stringify({ t: s.track, s: s.step, on: on }), true);
  }
  function loadField(cb) {
    if (window.FieldEngine) return cb();
    var s = document.createElement("script");
    s.src = ROOT + "assets/js/field.js"; s.onload = cb; document.body.appendChild(s);
  }
  function ensureCtx() {
    if (music.ctx) return music.ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    music.ctx = new AC();
    music.player = window.FieldEngine.create(music.ctx);
    music.player.setVolume(0.5);
    music.player.onTrack = function () { updateMusicUi(); toast((isVi() ? "Đang phát · " : "Now playing · ") + music.player.state().title, 3000); };
    return music.ctx;
  }
  function updateMusicUi() {
    musicBtn.classList.toggle("on", music.on);
    musicBtn.setAttribute("aria-pressed", music.on ? "true" : "false");
    musicBtn.title = music.on ? (isVi() ? "Đang phát: " : "Now playing: ") + music.player.state().title + (isVi() ? ". Bấm để tắt." : ". Press to pause.") : (isVi() ? "Bật nhạc" : "Play music");
  }
  function startMusic(fade, announce) {
    if (music.on || !music.ctx) return;
    var pos = readPos();
    music.player.play(pos.t || 0, pos.on ? pos.s : 0, fade);
    music.on = true; updateMusicUi(); savePos(true);
    clearInterval(music.saveTimer); music.saveTimer = setInterval(function () { savePos(true); }, 1000);
    if (bc) bc.postMessage({ type: "playing", id: myId });
    if (announce) {
      toast((isVi() ? "Đang phát · " : "Now playing · ") + music.player.state().title, 6000,
        [{ label: isVi() ? "Tắt nhạc" : "Mute", run: function () { stopMusic(0.4); store.set("bl-music", "off"); } }]);
    }
  }
  function stopMusic(fade) {
    if (!music.on) return;
    music.player.stop(fade == null ? 0.6 : fade);
    music.on = false; clearInterval(music.saveTimer); savePos(false); updateMusicUi();
  }
  function armGesture(announce) {
    if (music.armed) return;
    music.armed = true;
    function go(e) {
      if (e && e.target && e.target.closest && e.target.closest(".music-btn")) return; // the button handles itself
      ["pointerdown", "keydown", "touchend"].forEach(function (t) { window.removeEventListener(t, go, true); });
      music.armed = false;
      if (!musicPref() || music.on || radioAlive()) return;
      music.ctx.resume().then(function () { startMusic(2.5, announce); });
    }
    ["pointerdown", "keydown", "touchend"].forEach(function (t) { window.addEventListener(t, go, true); });
  }
  function tryAutoplay() {
    if (!musicPref() || radioAlive()) return;
    loadField(function () {
      if (!ensureCtx()) return;
      var pos = readPos(), announce = !pos.on;
      if (music.ctx.state === "running") return startMusic(pos.on ? 1.2 : 2.5, announce);
      music.ctx.resume().then(function () { if (music.ctx.state === "running") startMusic(pos.on ? 1.2 : 2.5, announce); });
      setTimeout(function () { if (!music.on) armGesture(announce); }, 200);
    });
  }
  musicBtn.addEventListener("click", function () {
    loadField(function () {
      if (!ensureCtx()) return;
      if (music.on) { stopMusic(0.5); store.set("bl-music", "off"); }
      else { store.set("bl-music", "on"); music.ctx.resume().then(function () { startMusic(1.5, false); }); }
    });
  });
  if (bc) bc.onmessage = function (ev) { if (ev.data && ev.data.type === "playing" && ev.data.id !== myId) stopMusic(0.6); };
  window.addEventListener("pagehide", function () { savePos(music.on); });
  document.addEventListener("bl:lang", function () { if (music.player) updateMusicUi(); });
  // Continue right away when coming from another page; otherwise wait about 2.5 seconds.
  setTimeout(tryAutoplay, readPos().on ? 150 : 2500);
  BL.music = { stop: stopMusic, isOn: function () { return music.on; } };

  /* ---------- Intro: the drawing sets itself up (home, once per visit) ---------- */
  var intro = document.getElementById("intro");
  var picker = document.getElementById("picker");
  function afterIntro() {
    if (picker && !store.get("bl-visitor", true)) openPicker();
  }
  if (intro) {
    if (store.get("bl-intro", true) || reduceMotion) { intro.remove(); afterIntro(); }
    else {
      store.set("bl-intro", "1", true);
      var ft = intro.querySelector("#intro-ft"), t0 = performance.now(), done = false;
      (function count(t) {
        var p = Math.min(1, (t - t0) / 1500), v = Math.round(5000 * (1 - Math.pow(1 - p, 3)));
        if (ft) ft.textContent = String(v).padStart(4, "0");
        if (p < 1 && !done) requestAnimationFrame(count);
      })(t0);
      function finish() {
        if (done) return; done = true;
        intro.classList.add("done");
        setTimeout(function () { intro.remove(); afterIntro(); }, 450);
      }
      setTimeout(finish, 2100);
      intro.addEventListener("click", finish);
      window.addEventListener("keydown", finish, { once: true });
    }
  }

  /* ---------- Visitor picker (home only) ---------- */
  function openPicker() { if (picker) { picker.classList.add("open"); var b = picker.querySelector(".picker-opt"); if (b) b.focus(); } }
  function closePicker() { if (picker) picker.classList.remove("open"); }
  function setVisitor(v) {
    if (v) document.documentElement.setAttribute("data-visitor", v);
    else document.documentElement.removeAttribute("data-visitor");
  }
  if (picker) {
    var saved = store.get("bl-visitor", true);
    if (saved && saved !== "skip") setVisitor(saved);
    if (!saved && !intro) openPicker();
    picker.querySelectorAll("[data-visitor-pick]").forEach(function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-visitor-pick");
        store.set("bl-visitor", v, true);
        setVisitor(v === "skip" ? null : v);
        closePicker();
      });
    });
    picker.addEventListener("keydown", function (e) { if (e.key === "Escape") { store.set("bl-visitor", "skip", true); closePicker(); } });
  }
  document.querySelectorAll("[data-open-picker]").forEach(function (a) {
    a.addEventListener("click", function (e) { e.preventDefault(); openPicker(); });
  });

  /* ---------- Cycling greeting ---------- */
  document.querySelectorAll(".greet .word[data-words]").forEach(function (w) {
    var words = w.getAttribute("data-words").split("|"), idx = 0;
    if (reduceMotion || words.length < 2) return;
    setInterval(function () {
      w.classList.add("swap");
      setTimeout(function () { idx = (idx + 1) % words.length; w.textContent = words[idx]; w.classList.remove("swap"); }, 300);
    }, 2600);
  });

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    reveals.forEach(function (r) { io.observe(r); });
  } else {
    reveals.forEach(function (r) { r.classList.add("in"); });
  }

  /* ---------- Copy buttons ---------- */
  document.querySelectorAll("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var text = b.getAttribute("data-copy");
      var note = b.parentNode.querySelector(".copy-note");
      function done() { if (note) { note.classList.add("show"); setTimeout(function () { note.classList.remove("show"); }, 1800); } }
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { window.location.href = "mailto:" + text; });
      else window.location.href = "mailto:" + text;
    });
  });

  /* ---------- Print button ---------- */
  document.querySelectorAll("[data-print]").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll("details.role").forEach(function (d) { d.open = true; });
      window.print();
    });
  });

  /* ---------- Home: the live drilling view ---------- */
  if (document.getElementById("drill-canvas")) {
    var s = document.createElement("script");
    s.src = ROOT + "assets/js/drillview.js"; document.body.appendChild(s);
  }
})();
