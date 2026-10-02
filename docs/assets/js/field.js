/* Field: a small chill music engine that runs in the browser.
   Warm electric-piano chords, soft bass, a light lo-fi beat, and a few
   melody notes. Nothing is recorded, so there's no copyright to clear.
   Used by the site's music button and by the radio page. */
(function () {
  "use strict";

  // Each track: tempo, chords (2 bars each), and a pentatonic scale for the melody.
  var TRACKS = [
    { title: "Sunny side", bpm: 84,
      chords: [{ keys: [52, 55, 59, 62], bass: 36 }, { keys: [55, 59, 60, 64], bass: 33 },
               { keys: [53, 57, 60, 64], bass: 41 }, { keys: [55, 59, 62, 64], bass: 43 }],
      scale: [72, 74, 76, 79, 81, 84] },
    { title: "Easy Sunday", bpm: 78,
      chords: [{ keys: [54, 57, 61, 64], bass: 38 }, { keys: [54, 57, 59, 62], bass: 35 },
               { keys: [55, 59, 62, 66], bass: 43 }, { keys: [57, 61, 64, 66], bass: 45 }],
      scale: [74, 76, 78, 81, 83, 86] },
    { title: "Golden hour", bpm: 86,
      chords: [{ keys: [58, 62, 65, 69], bass: 34 }, { keys: [57, 60, 64, 67], bass: 33 },
               { keys: [55, 58, 62, 65], bass: 43 }, { keys: [52, 58, 62, 64], bass: 36 }],
      scale: [72, 74, 77, 79, 81, 84] },
    { title: "Porch light", bpm: 76,
      chords: [{ keys: [51, 55, 58, 62], bass: 39 }, { keys: [51, 55, 58, 60], bass: 36 },
               { keys: [51, 55, 56, 60], bass: 44 }, { keys: [53, 55, 58, 62], bass: 34 }],
      scale: [70, 72, 75, 77, 79, 82] }
  ];

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function create(ctx) {
    // Signal chain: voices -> bus -> warm filter -> gentle compressor -> volume -> analyser -> speakers
    var bus = ctx.createGain(); bus.gain.value = 0.9;
    var warm = ctx.createBiquadFilter(); warm.type = "lowpass"; warm.frequency.value = 7000;
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    var vol = ctx.createGain(); vol.gain.value = 0;
    var analyser = ctx.createAnalyser(); analyser.fftSize = 128;
    bus.connect(warm); warm.connect(comp); comp.connect(vol); vol.connect(analyser); analyser.connect(ctx.destination);

    // Room reverb
    var verb = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = ir.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    verb.buffer = ir;
    var verbSend = ctx.createGain(); verbSend.gain.value = 0.35; verbSend.connect(verb); verb.connect(bus);

    // Echo for melody notes
    var echo = ctx.createDelay(1.5), fb = ctx.createGain(), echoOut = ctx.createGain();
    fb.gain.value = 0.32; echoOut.gain.value = 0.35;
    echo.connect(fb); fb.connect(echo); echo.connect(echoOut); echoOut.connect(bus);

    // Shared noise buffer for drums and vinyl
    var nbuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nbuf.getChannelData(0);
    for (var n = 0; n < nd.length; n++) nd[n] = Math.random() * 2 - 1;

    var vinyl = null;
    var track = 0, step = 0, nextTime = 0, timer = null, playing = false, volume = 0.5;
    var nodes = []; // things to stop on pause

    function keysNote(midi, t, dur, vel, dest) {
      var g = ctx.createGain(), f = mtof(midi);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07 * vel, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.04 * vel, t + 0.6);
      g.gain.setValueAtTime(0.04 * vel, t + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.2);
      var trem = ctx.createGain(); trem.gain.value = 1;
      var lfo = ctx.createOscillator(), lfoAmt = ctx.createGain();
      lfo.frequency.value = 4.2; lfoAmt.gain.value = 0.12; lfo.connect(lfoAmt); lfoAmt.connect(trem.gain);
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
      [[1, 1], [2, 0.18], [3, 0.04]].forEach(function (h) {
        var o = ctx.createOscillator(), og = ctx.createGain();
        o.type = "sine"; o.frequency.value = f * h[0]; og.gain.value = h[1];
        o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 1.3); nodes.push(o);
      });
      // short bell-like tine
      var tine = ctx.createOscillator(), tg = ctx.createGain();
      tine.frequency.value = f * 7; tg.gain.setValueAtTime(0.02 * vel, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      tine.connect(tg); tg.connect(lp); tine.start(t); tine.stop(t + 0.15); nodes.push(tine);
      lp.connect(trem); trem.connect(g); g.connect(dest || bus); g.connect(verbSend);
      lfo.start(t); lfo.stop(t + dur + 1.3); nodes.push(lfo);
    }

    function bassNote(midi, t, dur) {
      var o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = "sine"; o2.type = "triangle"; o.frequency.value = mtof(midi); o2.frequency.value = mtof(midi);
      var g2 = ctx.createGain(); g2.gain.value = 0.25;
      lp.type = "lowpass"; lp.frequency.value = 420;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.02);
      g.gain.setValueAtTime(0.22, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp); lp.connect(bus);
      o.start(t); o2.start(t); o.stop(t + dur + 0.2); o2.stop(t + dur + 0.2); nodes.push(o, o2);
    }

    function kick(t) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.4); nodes.push(o);
    }
    function noiseHit(t, type, freq, gain, decay) {
      var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = nbuf; f.type = type; f.frequency.value = freq; if (type === "bandpass") f.Q.value = 0.9;
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + decay + 0.02); nodes.push(s);
      if (type === "bandpass") g.connect(verbSend);
    }

    function startVinyl() {
      vinyl = ctx.createBufferSource(); vinyl.buffer = nbuf; vinyl.loop = true;
      var f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = "bandpass"; f.frequency.value = 3200; f.Q.value = 0.6; g.gain.value = 0.006;
      vinyl.connect(f); f.connect(g); g.connect(bus); vinyl.start();
    }

    // One 8th-note step
    function schedule(s, t) {
      var T = TRACKS[track], beat = 60 / T.bpm, eighth = beat / 2;
      var pos = s % 8, bar = Math.floor(s / 8), chord = T.chords[Math.floor(bar / 2) % T.chords.length];
      var swing = pos % 2 === 1 ? eighth * 0.16 : 0, tt = t + swing;

      // Keys: strike at the start of each chord, a lighter touch halfway, little pushes on the "and" of 4
      if (pos === 0 && bar % 2 === 0) chord.keys.forEach(function (k) { keysNote(k, tt, beat * 3.5, 1); });
      if (pos === 0 && bar % 2 === 1) chord.keys.forEach(function (k) { keysNote(k, tt, beat * 2.5, 0.6); });
      if (pos === 7 && Math.random() < 0.35) keysNote(chord.keys[chord.keys.length - 1], tt, beat * 0.5, 0.5);

      // Bass
      if (pos === 0) bassNote(chord.bass, tt, beat * 1.4);
      if (pos === 5) bassNote(chord.bass + (Math.random() < 0.5 ? 7 : 12), tt, beat * 0.45);

      // Drums (laid back)
      if (pos === 0 || pos === 3 || (pos === 5 && Math.random() < 0.4)) kick(tt);
      if (pos === 2 || pos === 6) noiseHit(tt, "bandpass", 1900, 0.09, 0.16);
      noiseHit(tt, "highpass", 7500, pos % 2 ? 0.018 : 0.03, 0.045);

      // Melody: a few notes, more often in the second half of the loop
      var loopBar = bar % (T.chords.length * 2);
      var p = loopBar >= 4 ? 0.22 : 0.1;
      if (Math.random() < p) {
        var note = T.scale[Math.floor(Math.random() * T.scale.length)];
        keysNote(note, tt, beat * 0.8, 0.55, echo);
        keysNote(note, tt, beat * 0.8, 0.55);
      }
    }

    function tick() {
      var T = TRACKS[track], eighth = 60 / T.bpm / 2;
      while (nextTime < ctx.currentTime + 0.15) {
        if (step >= 8 * 48) { // about two and a half minutes, then the next track
          track = (track + 1) % TRACKS.length; step = 0;
          if (api.onTrack) setTimeout(api.onTrack, 0);
        }
        schedule(step, nextTime);
        nextTime += eighth; step++;
      }
      if (nodes.length > 400) nodes = nodes.slice(-200);
    }

    function play(t, s, fadeSec) {
      stop(0);
      track = ((t || 0) % TRACKS.length + TRACKS.length) % TRACKS.length;
      step = s ? Math.floor(s / 8) * 8 : 0; // resume at the start of a bar
      nextTime = ctx.currentTime + 0.08;
      var now = ctx.currentTime;
      vol.gain.cancelScheduledValues(now); vol.gain.setValueAtTime(0, now);
      vol.gain.linearRampToValueAtTime(volume, now + (fadeSec == null ? 2.5 : fadeSec));
      startVinyl();
      timer = setInterval(tick, 25); tick();
      playing = true;
    }

    function stop(fadeSec) {
      if (timer) { clearInterval(timer); timer = null; }
      var now = ctx.currentTime, f = fadeSec || 0;
      vol.gain.cancelScheduledValues(now);
      vol.gain.setValueAtTime(vol.gain.value, now);
      vol.gain.linearRampToValueAtTime(0, now + Math.max(0.02, f));
      var old = nodes, v = vinyl; nodes = []; vinyl = null;
      setTimeout(function () {
        old.forEach(function (o) { try { o.stop(); } catch (e) {} });
        if (v) try { v.stop(); } catch (e) {}
      }, f * 1000 + 60);
      playing = false;
    }

    var api = {
      play: play, stop: stop, analyser: analyser, onTrack: null,
      setVolume: function (v) { volume = v; if (playing) { var now = ctx.currentTime; vol.gain.cancelScheduledValues(now); vol.gain.setTargetAtTime(v, now, 0.05); } },
      state: function () { return { track: track, step: step, playing: playing, title: TRACKS[track].title }; }
    };
    return api;
  }

  window.FieldEngine = { TRACKS: TRACKS, create: create };
})();
