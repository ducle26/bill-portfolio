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
  function isVi() { return false; } // English only for now
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

  /* ---------- Record player ---------- */
  // Browsers hold back sound until the visitor clicks, taps, or presses a key.
  // On the home page the "Who's coming down?" choice is that click. Anywhere else,
  // the music starts on the first click, and the player says so while it waits.
  // A-side: tracks listed in assets/audio/playlist.js, or the built-in music
  // (assets/js/field.js) when that list is empty. B-side: Bill's picks on YouTube.
  var PICKS = ["XutKfAL7wx8", "IuyJKdTCrE4", "kldpcaGtnb8", "T-U3jBF-Fac", "9FMFzHt5v6s", "FpAItpyVLUg"]; // YouTube video ids, in play order
  var DEFAULT_VOL = 35;
  var music = { backend: null, on: false, armed: false, saveTimer: null, side: "a", loading: null };
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
        '<p class="rp-note" data-rp="a-note"></p></div>' +
      '<div class="rp-b" hidden><div class="rp-yt"></div><p class="rp-note"><span data-rp="b-note">My real favorites, played by YouTube.</span> <a class="rp-pop" href="' + ROOT + 'radio/index.html" target="bill-radio">Pop out ↗</a></p></div>' +
    "</div>";
  document.body.appendChild(rp);
  var musicBtn = rp.querySelector(".rp-deck"), rpMore = rp.querySelector(".rp-more"), rpPanel = rp.querySelector(".rp-panel");
  var rpNow = rp.querySelector(".rp-now"), rpVol = rp.querySelector("#rp-vol"), nowTimer = null;

  // Pausing lasts for this visit only; a new visit starts with sound again.
  function musicPref() { return store.get("bl-music", true) !== "off"; }
  function setPref(on) { store.set("bl-music", on ? "on" : "off", true); }
  function radioAlive() { var t = +store.get("bl-radio-alive") || 0; return Date.now() - t < 4000; }
  function getVol() { var v = parseInt(store.get("bl-vol"), 10); return isNaN(v) ? DEFAULT_VOL : Math.max(0, Math.min(100, v)); }
  function readPos() { try { return JSON.parse(store.get("bl-music-pos", true) || "{}"); } catch (e) { return {}; } }
  function savePos(on) {
    if (!music.backend) return;
    var st = music.backend.state();
    store.set("bl-music-pos", JSON.stringify({ t: st.track, s: st.pos, on: on, k: music.backend.kind }), true);
  }
  function loadScript(src, cb) { var sc = document.createElement("script"); sc.src = src; sc.onload = cb; sc.onerror = cb; document.body.appendChild(sc); }

  // Backend 1: recorded tracks from assets/audio
  function fileBackend(tracks) {
    var a = new Audio(), idx = 0, vol = DEFAULT_VOL / 100, fadeT = null, api;
    a.preload = "none";
    function fadeTo(target, sec, done) {
      clearInterval(fadeT);
      var from = a.volume, t0 = performance.now();
      fadeT = setInterval(function () {
        var p = Math.min(1, (performance.now() - t0) / Math.max(50, sec * 1000));
        a.volume = Math.max(0, Math.min(1, from + (target - from) * p));
        if (p >= 1) { clearInterval(fadeT); if (done) done(); }
      }, 40);
    }
    function load(pos) {
      a.src = ROOT + tracks[idx].file;
      if (pos > 1) a.addEventListener("loadedmetadata", function h() { a.removeEventListener("loadedmetadata", h); try { a.currentTime = pos; } catch (e) {} });
    }
    a.addEventListener("ended", function () { idx = (idx + 1) % tracks.length; load(0); a.play(); if (api.onTrack) api.onTrack(); });
    a.addEventListener("error", function () { if (tracks.length > 1 && !a.paused) { idx = (idx + 1) % tracks.length; load(0); a.play().catch(function () {}); } });
    api = {
      kind: "file", tracks: tracks, onTrack: null,
      start: function (t, pos, fade) {
        idx = ((t || 0) % tracks.length + tracks.length) % tracks.length;
        load(pos || 0); a.volume = 0;
        return a.play().then(function () { fadeTo(vol, fade == null ? 2.5 : fade); return true; }, function () { return false; });
      },
      stop: function (fade) { fadeTo(0, fade || 0.05, function () { a.pause(); }); },
      setVolume: function (v) { vol = v; if (!a.paused) { clearInterval(fadeT); a.volume = v; } },
      state: function () { return { track: idx, pos: a.currentTime || 0, title: tracks[idx].title, artist: tracks[idx].artist || "" }; }
    };
    return api;
  }
  // Backend 2: the built-in music engine
  function engineBackend() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !window.FieldEngine) return null;
    var ctx = new AC(), player = window.FieldEngine.create(ctx), api;
    player.onTrack = function () { if (api.onTrack) api.onTrack(); };
    api = {
      kind: "engine", tracks: window.FieldEngine.TRACKS, onTrack: null,
      start: function (t, pos, fade) {
        var wait = new Promise(function (res) { setTimeout(function () { res(ctx.state === "running"); }, 300); });
        var ok = ctx.state === "running" ? Promise.resolve(true) : Promise.race([ctx.resume().then(function () { return ctx.state === "running"; }, function () { return false; }), wait]);
        return ok.then(function (running) { if (running) player.play(t || 0, pos || 0, fade); return running; });
      },
      stop: function (fade) { player.stop(fade); },
      setVolume: function (v) { player.setVolume(v); },
      state: function () { var st = player.state(); return { track: st.track, pos: st.step, title: st.title, artist: "" }; }
    };
    return api;
  }
  function ensureBackend(cb) {
    if (music.backend) return cb();
    if (music.loading) { music.loading.push(cb); return; }
    music.loading = [cb];
    function ready() {
      music.backend.setVolume(getVol() / 100);
      music.backend.onTrack = function () { updateMusicUi(); showNow(); };
      var q = music.loading; music.loading = null; q.forEach(function (f) { f(); });
    }
    loadScript(ROOT + "assets/audio/playlist.js", function () {
      var list = window.BL_TRACKS || [];
      if (list.length) { music.backend = fileBackend(list); return ready(); }
      loadScript(ROOT + "assets/js/field.js", function () { music.backend = engineBackend(); if (music.backend) ready(); else music.loading = null; });
    });
  }
  function showNow(text) {
    rpNow.textContent = text || ("♪ " + music.backend.state().title);
    rpNow.classList.add("show");
    clearTimeout(nowTimer); nowTimer = setTimeout(function () { rpNow.classList.remove("show"); }, text ? 7000 : 5000);
  }
  function updateMusicUi() {
    rp.classList.toggle("on", music.on);
    rp.classList.toggle("waiting", music.armed && !music.on);
    musicBtn.setAttribute("aria-pressed", music.on ? "true" : "false");
    if (!music.backend) return;
    var st = music.backend.state(), total = music.backend.tracks.length;
    musicBtn.title = music.on ? "Now playing: " + st.title + ". Press to pause." : "Play music";
    rp.querySelector(".rp-title").textContent = st.title;
    rp.querySelector(".rp-sub").textContent = "Track " + (st.track + 1) + " of " + total + (st.artist ? " · " + st.artist : "");
    var pb = rp.querySelector(".rp-play"); pb.textContent = music.on ? "❚❚" : "▶"; pb.setAttribute("aria-label", music.on ? "Pause" : "Play");
    rp.querySelector('[data-rp="a-note"]').textContent = music.backend.kind === "file"
      ? "Free-to-use tracks, credited on the drill log page. They play in a loop."
      : "Made live in your browser. The tracks play in a loop.";
  }
  // Try to start. Resolves true if sound is playing.
  function startMusic(fade, track) {
    if (!music.backend) return Promise.resolve(false);
    if (music.on && track == null) return Promise.resolve(true);
    var pos = readPos(), same = pos.k === music.backend.kind;
    var t = track != null ? track : (same ? pos.t || 0 : 0), at = track != null ? 0 : (same && pos.on ? pos.s || 0 : 0);
    return music.backend.start(t, at, fade).then(function (ok) {
      if (!ok) return false;
      music.on = true; music.armed = false; updateMusicUi(); savePos(true); showNow();
      clearInterval(music.saveTimer); music.saveTimer = setInterval(function () { savePos(true); }, 1000);
      if (bc) bc.postMessage({ type: "playing", id: myId });
      return true;
    });
  }
  function stopMusic(fade) {
    if (!music.on) return;
    music.backend.stop(fade == null ? 0.6 : fade);
    music.on = false; clearInterval(music.saveTimer); savePos(false); updateMusicUi();
  }
  // Wait for the first click, tap, or key press, then start.
  function armGesture() {
    if (music.armed) return;
    music.armed = true; updateMusicUi();
    showNow("♪ Click anywhere for sound");
    function go(e) {
      if (e && e.target && e.target.closest && e.target.closest(".record-player")) return; // the player handles itself
      ["pointerdown", "keydown", "touchend"].forEach(function (t) { window.removeEventListener(t, go, true); });
      music.armed = false;
      if (!musicPref() || music.on || radioAlive() || music.side === "b") { updateMusicUi(); return; }
      startMusic(1.5);
    }
    ["pointerdown", "keydown", "touchend"].forEach(function (t) { window.addEventListener(t, go, true); });
  }
  function tryAutoplay() {
    if (!musicPref() || radioAlive() || music.on) return;
    ensureBackend(function () {
      updateMusicUi();
      startMusic(readPos().on ? 1.2 : 2.5).then(function (ok) { if (!ok) armGesture(); });
    });
  }
  function toggleMusic() {
    ensureBackend(function () {
      if (music.on) { stopMusic(0.5); setPref(false); }
      else { setSide("a"); setPref(true); startMusic(1.2); }
    });
  }
  function skip(dir) {
    ensureBackend(function () {
      var n = music.backend.tracks.length, cur = music.backend.state().track;
      setPref(true); startMusic(0.8, (cur + dir + n) % n);
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
    if (open) { ensureBackend(updateMusicUi); rpNow.classList.remove("show"); }
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
  rpVol.addEventListener("input", function () { store.set("bl-vol", this.value); if (music.backend) music.backend.setVolume(this.value / 100); });
  rp.querySelector(".rp-pop").addEventListener("click", function (e) {
    e.preventDefault(); setSide("a");
    var w = window.open(this.href, "bill-radio", "width=420,height=700,menubar=no,toolbar=no,location=no");
    if (!w) window.location.href = this.href;
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !rpPanel.hidden) openPanel(false); });
  if (bc) bc.onmessage = function (ev) { if (ev.data && ev.data.type === "playing" && ev.data.id !== myId) stopMusic(0.6); };
  window.addEventListener("pagehide", function () { savePos(music.on); });
  // Start from a real click (the entrance choice on the home page).
  function startFromClick(withSound) {
    setPref(withSound);
    if (!withSound) { stopMusic(0.3); music.armed = false; updateMusicUi(); return; }
    ensureBackend(function () { startMusic(2).then(function (ok) { if (!ok) armGesture(); }); });
  }
  // Continue right away when coming from another page. On a first visit to the
  // home page, the entrance choice starts it instead.
  var gate = document.getElementById("picker") && !store.get("bl-visitor", true);
  if (!gate) setTimeout(tryAutoplay, readPos().on ? 150 : 2500);
  BL.music = {
    stop: stopMusic, isOn: function () { return music.on; }, prefOn: musicPref,
    // Turn the music down while mini Bill sings, then back up.
    duck: function (down) { if (music.backend && music.on) music.backend.setVolume(getVol() / 100 * (down ? 0.15 : 1)); }
  };

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
        var sw = document.getElementById("picker-sound");
        startFromClick(!sw || sw.checked);
      });
    });
    picker.addEventListener("keydown", function (e) { if (e.key === "Escape") { store.set("bl-visitor", "skip", true); closePicker(); tryAutoplay(); } });
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

  /* ---------- Page extras: live well view, journey map, career log, mini Bill ---------- */
  [["drill-canvas", "drillview.js"], ["journey-map", "journeymap.js"], ["career-log", "careerlog.js"], ["picker", "minime.js"]].forEach(function (pair) {
    if (!document.getElementById(pair[0])) return;
    var s = document.createElement("script");
    s.src = ROOT + "assets/js/" + pair[1]; document.body.appendChild(s);
  });
})();
