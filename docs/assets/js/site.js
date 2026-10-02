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
  tools.appendChild(langBtn);
  var navTarget = document.querySelector(".quarto-navbar-tools") || document.querySelector("#navbarCollapse");
  if (navTarget) navTarget.insertBefore(tools, navTarget.firstChild);

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

  /* ---------- Record player: music starts softly a couple of seconds in ---------- */
  // Browsers only allow sound after the visitor clicks, taps, or presses a key.
  // If they already have, music starts on time; otherwise it starts on their first click.
  // A-side: the site's own music (assets/js/field.js). B-side: Bill's picks on YouTube.
  var PICKS = ["XutKfAL7wx8", "IuyJKdTCrE4", "kldpcaGtnb8", "T-U3jBF-Fac", "9FMFzHt5v6s", "FpAItpyVLUg"]; // YouTube video ids, in play order
  var DEFAULT_VOL = 35;
  var music = { ctx: null, player: null, on: false, armed: false, saveTimer: null, side: "a" };
  var bc = null, myId = Math.random().toString(36).slice(2);
  try { bc = new BroadcastChannel("bill-radio"); } catch (e) {}

  var rp = el("div", "record-player");
  rp.innerHTML =
    '<button class="rp-deck music-btn" type="button" aria-pressed="false" aria-label="Play or pause music">' +
      '<svg viewBox="0 0 80 80" aria-hidden="true">' +
        '<rect class="rp-plinth" x="2" y="2" width="76" height="76" rx="7"/>' +
        '<circle class="rp-mat" cx="34" cy="43" r="28"/>' +
        '<g class="rp-disc"><circle class="rp-vinyl" cx="34" cy="43" r="25"/>' +
          '<circle class="rp-groove" cx="34" cy="43" r="20"/><circle class="rp-groove" cx="34" cy="43" r="15.5"/>' +
          '<circle class="rp-label" cx="34" cy="43" r="9.5"/><line class="rp-mark" x1="34" y1="43" x2="34" y2="35.5"/>' +
          '<circle class="rp-hole" cx="34" cy="43" r="1.6"/></g>' +
        '<g class="rp-arm"><line x1="67" y1="14" x2="52" y2="45"/><rect x="47.5" y="43" width="7" height="9" rx="1.5" transform="rotate(26 51 47)"/></g>' +
        '<circle class="rp-pivot" cx="67" cy="14" r="5"/><circle class="rp-knob" cx="68" cy="60" r="3"/><circle class="rp-knob" cx="68" cy="70" r="3"/>' +
      "</svg></button>" +
    '<button class="rp-more" type="button" aria-label="Open music controls" aria-expanded="false">···</button>' +
    '<div class="rp-now" aria-live="polite"></div>' +
    '<div class="rp-panel" hidden>' +
      '<div class="rp-head"><span class="label" data-rp="head">Bill\'s record player</span><button class="rp-close" type="button" aria-label="Close">×</button></div>' +
      '<div class="rp-sides" role="group" aria-label="Record side"><button type="button" data-side="a" aria-pressed="true">A-side · Field</button><button type="button" data-side="b" aria-pressed="false">B-side · Bill\'s picks</button></div>' +
      '<div class="rp-a"><div class="rp-title">Sunny side</div><div class="rp-sub label">Track 1</div>' +
        '<div class="rp-ctl"><button type="button" data-act="prev" aria-label="Previous track">◀◀</button><button type="button" data-act="toggle" class="rp-play" aria-label="Play">▶</button><button type="button" data-act="next" aria-label="Next track">▶▶</button>' +
        '<label class="rp-vol"><span class="label">Vol</span><input type="range" id="rp-vol" min="0" max="100" step="1" value="' + DEFAULT_VOL + '" aria-label="Volume"></label></div>' +
        '<p class="rp-note" data-rp="a-note">Made live in your browser. The six tracks play in a loop.</p></div>' +
      '<div class="rp-b" hidden><div class="rp-yt"></div><p class="rp-note"><span data-rp="b-note">My real favorites, played by YouTube.</span> <a class="rp-pop" href="' + ROOT + 'radio/index.html" target="bill-radio">Pop out ↗</a></p></div>' +
    "</div>";
  document.body.appendChild(rp);
  var musicBtn = rp.querySelector(".rp-deck"), rpMore = rp.querySelector(".rp-more"), rpPanel = rp.querySelector(".rp-panel");
  var rpNow = rp.querySelector(".rp-now"), rpVol = rp.querySelector("#rp-vol"), nowTimer = null;

  function musicPref() { return store.get("bl-music") !== "off"; }
  function radioAlive() { var t = +store.get("bl-radio-alive") || 0; return Date.now() - t < 4000; }
  function getVol() { var v = parseInt(store.get("bl-vol"), 10); return isNaN(v) ? DEFAULT_VOL : Math.max(0, Math.min(100, v)); }
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
    music.player.setVolume(getVol() / 100);
    music.player.onTrack = function () { updateMusicUi(); showNow(); };
    return music.ctx;
  }
  function showNow() {
    if (!music.player) return;
    rpNow.textContent = "♪ " + music.player.state().title;
    rpNow.classList.add("show");
    clearTimeout(nowTimer); nowTimer = setTimeout(function () { rpNow.classList.remove("show"); }, 5000);
  }
  function updateMusicUi() {
    rp.classList.toggle("on", music.on);
    musicBtn.setAttribute("aria-pressed", music.on ? "true" : "false");
    var st = music.player ? music.player.state() : { title: "Sunny side", track: 0 };
    var total = window.FieldEngine ? window.FieldEngine.TRACKS.length : 6;
    musicBtn.title = music.on ? (isVi() ? "Đang phát: " : "Now playing: ") + st.title + (isVi() ? ". Bấm để dừng." : ". Press to pause.") : (isVi() ? "Bật nhạc" : "Play music");
    rp.querySelector(".rp-title").textContent = st.title;
    rp.querySelector(".rp-sub").textContent = (isVi() ? "Bài " : "Track ") + (st.track + 1) + (isVi() ? " trên " : " of ") + total;
    var pb = rp.querySelector(".rp-play"); pb.textContent = music.on ? "❚❚" : "▶"; pb.setAttribute("aria-label", music.on ? "Pause" : "Play");
    rp.querySelector('[data-rp="head"]').textContent = isVi() ? "Máy hát của Bill" : "Bill's record player";
    rp.querySelector('[data-rp="a-note"]').textContent = isVi() ? "Nhạc được tạo trực tiếp trong trình duyệt. Sáu bài phát lặp lại." : "Made live in your browser. The six tracks play in a loop.";
    rp.querySelector('[data-rp="b-note"]').textContent = isVi() ? "Những bài mình thích nhất, phát qua YouTube." : "My real favorites, played by YouTube.";
  }
  function startMusic(fade, announce, track) {
    if (!music.ctx) return;
    if (music.on && track == null) return;
    var pos = readPos();
    if (track != null) music.player.play(track, 0, fade);
    else music.player.play(pos.t || 0, pos.on ? pos.s : 0, fade);
    music.on = true; updateMusicUi(); savePos(true);
    clearInterval(music.saveTimer); music.saveTimer = setInterval(function () { savePos(true); }, 1000);
    if (bc) bc.postMessage({ type: "playing", id: myId });
    if (announce) showNow();
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
      if (e && e.target && e.target.closest && e.target.closest(".record-player")) return; // the player handles itself
      ["pointerdown", "keydown", "touchend"].forEach(function (t) { window.removeEventListener(t, go, true); });
      music.armed = false;
      if (!musicPref() || music.on || radioAlive() || music.side === "b") return;
      music.ctx.resume().then(function () { startMusic(2.5, announce); });
    }
    ["pointerdown", "keydown", "touchend"].forEach(function (t) { window.addEventListener(t, go, true); });
  }
  function tryAutoplay() {
    if (!musicPref() || radioAlive()) return;
    loadField(function () {
      if (!ensureCtx()) return;
      updateMusicUi();
      var pos = readPos(), announce = true;
      if (music.ctx.state === "running") return startMusic(pos.on ? 1.2 : 2.5, announce);
      music.ctx.resume().then(function () { if (music.ctx.state === "running") startMusic(pos.on ? 1.2 : 2.5, announce); });
      setTimeout(function () { if (!music.on) armGesture(announce); }, 200);
    });
  }
  function withAudio(fn) { loadField(function () { if (ensureCtx()) music.ctx.resume().then(fn, fn); }); }
  function toggleMusic() {
    withAudio(function () {
      if (music.on) { stopMusic(0.5); store.set("bl-music", "off"); }
      else { setSide("a"); store.set("bl-music", "on"); startMusic(1.2, true); }
    });
  }
  function skip(dir) {
    withAudio(function () {
      var n = window.FieldEngine.TRACKS.length, cur = music.player.state().track;
      store.set("bl-music", "on");
      startMusic(0.8, true, (cur + dir + n) % n);
    });
  }
  function setSide(side) {
    music.side = side;
    rp.querySelectorAll("[data-side]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.side === side ? "true" : "false"); });
    rp.querySelector(".rp-a").hidden = side !== "a"; rp.querySelector(".rp-b").hidden = side !== "b";
    var yt = rp.querySelector(".rp-yt");
    if (side === "b") {
      stopMusic(0.4);
      if (!yt.firstChild) {
        var f = document.createElement("iframe");
        f.src = "https://www.youtube-nocookie.com/embed/" + PICKS[0] + "?playlist=" + PICKS.slice(1).join(",") + "&loop=1&rel=0";
        f.title = "Bill's picks on YouTube"; f.allow = "autoplay; encrypted-media; picture-in-picture"; f.allowFullscreen = true;
        yt.appendChild(f);
      }
    } else { yt.innerHTML = ""; }
  }
  function openPanel(open) {
    rpPanel.hidden = !open; rpMore.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) { loadField(function () { updateMusicUi(); }); rpNow.classList.remove("show"); }
  }
  musicBtn.addEventListener("click", toggleMusic);
  rpMore.addEventListener("click", function () { openPanel(rpPanel.hidden); });
  rp.querySelector(".rp-close").addEventListener("click", function () { openPanel(false); });
  rp.querySelectorAll("[data-side]").forEach(function (b) { b.addEventListener("click", function () { setSide(b.dataset.side); }); });
  rp.querySelectorAll("[data-act]").forEach(function (b) {
    b.addEventListener("click", function () {
      var a = b.dataset.act;
      if (a === "toggle") toggleMusic(); else skip(a === "next" ? 1 : -1);
    });
  });
  rpVol.value = getVol();
  rpVol.addEventListener("input", function () { store.set("bl-vol", this.value); if (music.player) music.player.setVolume(this.value / 100); });
  rp.querySelector(".rp-pop").addEventListener("click", function (e) {
    e.preventDefault(); setSide("a");
    var w = window.open(this.href, "bill-radio", "width=420,height=700,menubar=no,toolbar=no,location=no");
    if (!w) window.location.href = this.href;
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !rpPanel.hidden) openPanel(false); });
  if (bc) bc.onmessage = function (ev) { if (ev.data && ev.data.type === "playing" && ev.data.id !== myId) stopMusic(0.6); };
  window.addEventListener("pagehide", function () { savePos(music.on); });
  document.addEventListener("bl:lang", function () { updateMusicUi(); });
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

  /* ---------- Page extras: live well view, journey map, career log ---------- */
  [["drill-canvas", "drillview.js"], ["journey-map", "journeymap.js"], ["career-log", "careerlog.js"]].forEach(function (pair) {
    if (!document.getElementById(pair[0])) return;
    var s = document.createElement("script");
    s.src = ROOT + "assets/js/" + pair[1]; document.body.appendChild(s);
  });
})();
