/* ==============================================
   SONGBOOK — Static Site JavaScript
   Search, notation toggle, audio player,
   per-token highlighting, section collapse
   ============================================== */

(() => {
  "use strict";

  // ========================================
  // 1. NOTATION MODE TOGGLE
  // ========================================
  const STORAGE_KEY = "songbook:notationMode";
  const MODES = new Set(["indian", "western", "both"]);

  function getInitialMode() {
    const saved = (localStorage.getItem(STORAGE_KEY) || "").toLowerCase();
    return MODES.has(saved) ? saved : "indian";
  }

  function applyMode(mode) {
    if (!MODES.has(mode)) mode = "indian";
    const root = document.documentElement;
    root.classList.remove("notation--indian", "notation--western", "notation--both");
    root.classList.add("notation--" + mode);
    localStorage.setItem(STORAGE_KEY, mode);

    document.querySelectorAll("button[data-notation-mode]").forEach(function(btn) {
      btn.classList.toggle("active", btn.getAttribute("data-notation-mode") === mode);
    });
  }

  function initNotationToggle() {
    applyMode(getInitialMode());
    document.addEventListener("click", function(e) {
      var btn = e.target && e.target.closest && e.target.closest("button[data-notation-mode]");
      if (!btn) return;
      applyMode((btn.getAttribute("data-notation-mode") || "").toLowerCase());
    });
  }

  // ========================================
  // 2. SEARCH (Home page)
  // ========================================
  function initSearch() {
    var input = document.querySelector("[data-songbook-search]");
    var cards = Array.from(document.querySelectorAll("[data-songbook-card]"));
    var countEl = document.querySelector("[data-songbook-count]");
    if (!input || cards.length === 0) return;

    function norm(s) { return (s || "").toLowerCase().trim(); }

    function applyFilter() {
      var q = norm(input.value);
      var visible = 0;
      for (var i = 0; i < cards.length; i++) {
        var hay = norm(cards[i].getAttribute("data-songbook-hay"));
        var show = !q || hay.includes(q);
        cards[i].style.display = show ? "" : "none";
        if (show) visible++;
      }
      if (countEl) countEl.textContent = String(visible);
    }

    input.addEventListener("input", applyFilter);
    applyFilter();
  }

  // ========================================
  // 3. SECTION COLLAPSE (Song page)
  // ========================================
  function initSectionCollapse() {
    document.addEventListener("click", function(e) {
      var btn = e.target && e.target.closest && e.target.closest("[data-section-toggle]");
      if (!btn) return;
      var idx = btn.getAttribute("data-section-toggle");
      var body = document.querySelector('[data-section-body="' + idx + '"]');
      if (!body) return;

      var hidden = body.hasAttribute("hidden");
      if (hidden) {
        body.removeAttribute("hidden");
        btn.querySelector(".icon").style.transform = "";
      } else {
        body.setAttribute("hidden", "");
        btn.querySelector(".icon").style.transform = "rotate(180deg)";
      }
    });
  }

  // ========================================
  // 4. SONG INFO PANEL TOGGLE
  // ========================================
  function initInfoToggle() {
    document.addEventListener("click", function(e) {
      var btn = e.target && e.target.closest && e.target.closest("[data-toggle-info]");
      if (!btn) return;
      var panel = document.getElementById("songInfoPanel");
      if (!panel) return;
      var visible = panel.classList.toggle("visible");
      btn.classList.toggle("active", visible);
    });
  }

  // ========================================
  // 5. NOTATION GUIDE MODAL
  // ========================================
  function initNotationGuideModal() {
    var modal = document.getElementById("notationGuideModal");
    if (!modal) return;

    function openModal() {
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
    function closeModal() {
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    document.addEventListener("click", function(e) {
      if (e.target.closest("[data-open-notation-guide]")) {
        e.preventDefault();
        openModal();
      }
      if (e.target.closest("[data-close-notation-guide]")) {
        closeModal();
      }
    });

    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") {
        closeModal();
      }
    });
  }

  // ========================================
  // 6. AUDIO PLAYER (Song page)
  //    Web Audio API oscillator playback
  //    with per-token highlighting
  // ========================================

  // ── Indian note → MIDI mapping ─────────────────────────────────────
  var NOTE_TO_MIDI = {
    Sa: 60, Re: 62, Ga: 64, ma: 65, Ma: 66, Pa: 67, Dha: 69, Ni: 71,
    pa: 55, dha: 57, ni: 59, sa: 48,
    "dha(k)": 56, "ni(k)": 58,
    p: 55, d: 57, n: 59, s: 48,
    "Sa'": 72, "Re'": 74, "Ga'": 76, "ma'": 77, "Ma'": 78,
    "Pa'": 79, "Dha'": 81, "Ni'": 83,
    "Re(k)": 61, "Ga(k)": 63, "Dha(k)": 68, "Ni(k)": 70, "Ma(T)": 66
  };
  var ABBREV = { S:"Sa",R:"Re",G:"Ga",M:"Ma",P:"Pa",D:"Dha",N:"Ni",Dh:"Dha" };

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // ── Comprehensive notation parser ──────────────────────────────────

  function resolveSimpleNote(raw) {
    var t = raw.replace(/[*^,|/{}—–]/g, "");
    if (!t) return undefined;
    var shift = 0;
    if (t.charAt(0) === "'") { shift = -12; t = t.slice(1); }
    var midi = NOTE_TO_MIDI[t];
    if (midi !== undefined) return midi + shift;
    var base = t.replace(/'/g, "");
    midi = NOTE_TO_MIDI[base];
    if (midi !== undefined && t.indexOf("'") >= 0) return midi + 12 + shift;
    if (midi !== undefined) return midi + shift;
    var canon = ABBREV[t] || ABBREV[base];
    if (canon) {
      midi = NOTE_TO_MIDI[canon];
      if (midi !== undefined) return (t.indexOf("'") >= 0 ? midi + 12 : midi) + shift;
    }
    return undefined;
  }

  var NOTE_RE = /^(Dha|dha|Sa|sa|Re|Ga|Ma|ma|Pa|pa|Ni|ni|Dh|S|R|G|M|P|D|N|s|r|g|m|p|d|n)(\([kT]\))?(')?/;

  function splitCompoundNotes(token) {
    var midis = [], remaining = token;
    while (remaining.length > 0) {
      var m = remaining.match(NOTE_RE);
      if (!m) break;
      var midi = resolveSimpleNote(m[0]);
      if (midi === undefined) break;
      midis.push(midi);
      remaining = remaining.slice(m[0].length);
    }
    return remaining.length === 0 ? midis : [];
  }

  function tryParseDotCompound(token) {
    var normalized = token.replace(/\u2026/g, "..");
    var segments = normalized.split(/\.+/).filter(function(s) { return s.length > 0; });
    if (segments.length < 2) return null;
    var midis = [];
    for (var i = 0; i < segments.length; i++) {
      var midi = resolveSimpleNote(segments[i]);
      if (midi !== undefined) { midis.push(midi); }
      else {
        var sub = splitCompoundNotes(segments[i]);
        if (sub.length > 0) { midis = midis.concat(sub); }
        else { return null; }
      }
    }
    var perNote = Math.min(0.5, 1.0 / midis.length);
    var events = midis.map(function(m) { return { type: "note", midi: m, duration: perNote * 0.85 }; });
    return { events: events, totalBeats: Math.max(1, midis.length * perNote) };
  }

  function parseMeendToken(token) {
    var work = token;
    var holdMult = 1.0;
    if (work.charAt(work.length - 1) === ":") { holdMult = 1.5; work = work.slice(0, -1); }
    work = work.replace(/[.—–]+$/, "");
    var parts = work.split("~").filter(Boolean);
    if (parts.length >= 2) {
      var fromMidi = resolveSimpleNote(parts[0]);
      var lastPart = parts[parts.length - 1];
      var toMidi = resolveSimpleNote(lastPart);
      if (toMidi === undefined) {
        var sub = splitCompoundNotes(lastPart);
        if (sub.length > 0) toMidi = sub[sub.length - 1];
      }
      if (fromMidi !== undefined && toMidi !== undefined) {
        return { events: [{ type: "meend", fromMidi: fromMidi, toMidi: toMidi, duration: holdMult }], totalBeats: holdMult };
      }
    }
    var clean = token.replace(/[~:.—–]+/g, "");
    var midi = resolveSimpleNote(clean);
    if (midi !== undefined) return { events: [{ type: "note", midi: midi, duration: holdMult }], totalBeats: holdMult };
    var compound = splitCompoundNotes(clean);
    if (compound.length > 0) {
      var pn = holdMult / compound.length;
      return { events: compound.map(function(m) { return { type: "note", midi: m, duration: pn }; }), totalBeats: holdMult };
    }
    return { events: [{ type: "rest", duration: 1 }], totalBeats: 1 };
  }

  function parseToken(token) {
    var tok = token.replace(/\u2026/g, "..");
    if (tok === "|" || tok === "/") return { events: [], totalBeats: 0.25 };
    if (/^[._\-\u2014\u2013:\/,]+$/.test(tok)) return { events: [{ type: "rest", duration: 1 }], totalBeats: 1 };
    if (/^\([^)]*[0-9x\-][^)]*\)$/.test(tok)) return { events: [{ type: "rest", duration: 0.5 }], totalBeats: 0.5 };
    if (tok.indexOf("~") >= 0) return parseMeendToken(tok);

    var dotCompound = tryParseDotCompound(tok);
    if (dotCompound) return dotCompound;

    var work = tok;
    var holdMult = 1.0;
    var colonMatch = work.match(/:+$/);
    if (colonMatch) { holdMult += colonMatch[0].length * 0.5; work = work.slice(0, -colonMatch[0].length); }
    var dashMatch = work.match(/[\u2014\u2013]+$/);
    if (dashMatch) { holdMult += dashMatch[0].length * 0.5; work = work.slice(0, -dashMatch[0].length); }
    var trailingPause = 0;
    var commaMatch = work.match(/,+$/);
    if (commaMatch) { trailingPause = commaMatch[0].length * 0.3; work = work.slice(0, -commaMatch[0].length); }
    var trailingDots = 0;
    var dotSuffix = work.match(/(\.+)$/);
    if (dotSuffix) { trailingDots = dotSuffix[1].length; work = work.slice(0, -trailingDots); }
    work = work.replace(/[|*^]+$/, "");
    work = work.replace(/[{}]/g, "");

    if (work.charAt(0) === "_" && work.length > 1) {
      var uCompound = splitCompoundNotes(work.slice(1));
      if (uCompound.length > 0) {
        var evts = [{ type: "rest", duration: 0.5 }];
        var up = 0.5 / uCompound.length;
        uCompound.forEach(function(m) { evts.push({ type: "note", midi: m, duration: up }); });
        return { events: evts, totalBeats: 1 };
      }
    }

    var totalExtra = trailingDots + trailingPause;

    if (work.charAt(0) === "." && work.length > 1) {
      var notesPart = work.slice(1);
      var lmidi = resolveSimpleNote(notesPart);
      if (lmidi !== undefined) return { events: [{ type: "note", midi: lmidi, duration: holdMult }], totalBeats: holdMult };
      var lcomp = splitCompoundNotes(notesPart);
      if (lcomp.length > 0) {
        var lp = holdMult / lcomp.length;
        return { events: lcomp.map(function(m) { return { type: "note", midi: m, duration: lp }; }), totalBeats: holdMult };
      }
    }

    var gracePrefix = work.match(/^\(([^)]+)\)(.+)$/);
    if (gracePrefix && gracePrefix[1] !== "k" && gracePrefix[1] !== "T") {
      var gMidi = resolveSimpleNote(gracePrefix[1]);
      var mainMidis = [];
      var mainSingle = resolveSimpleNote(gracePrefix[2]);
      if (mainSingle !== undefined) mainMidis = [mainSingle];
      else mainMidis = splitCompoundNotes(gracePrefix[2]);
      if (gMidi !== undefined && mainMidis.length > 0) {
        var gev = [{ type: "note", midi: gMidi, duration: 0.15 * holdMult }];
        var md = (0.85 * holdMult) / mainMidis.length;
        mainMidis.forEach(function(m) { gev.push({ type: "note", midi: m, duration: md }); });
        if (totalExtra > 0) gev.push({ type: "rest", duration: totalExtra });
        return { events: gev, totalBeats: holdMult + totalExtra };
      }
    }

    var embGrace = work.match(/^(.+?)\(([^)]+)\)(.+)$/);
    if (embGrace && embGrace[2] !== "k" && embGrace[2] !== "T") {
      var em1 = resolveSimpleNote(embGrace[1]);
      var egm = resolveSimpleNote(embGrace[2]);
      var em3list = [];
      var em3s = resolveSimpleNote(embGrace[3]);
      if (em3s !== undefined) em3list = [em3s]; else em3list = splitCompoundNotes(embGrace[3]);
      if (em1 !== undefined && egm !== undefined && em3list.length > 0) {
        var eev = [
          { type: "note", midi: em1, duration: 0.4 * holdMult },
          { type: "note", midi: egm, duration: 0.15 * holdMult }
        ];
        var td = (0.45 * holdMult) / em3list.length;
        em3list.forEach(function(m) { eev.push({ type: "note", midi: m, duration: td }); });
        if (totalExtra > 0) eev.push({ type: "rest", duration: totalExtra });
        return { events: eev, totalBeats: holdMult + totalExtra };
      }
    }

    var singleMidi = resolveSimpleNote(work);
    if (singleMidi !== undefined) {
      var sev = [{ type: "note", midi: singleMidi, duration: holdMult }];
      if (totalExtra > 0) sev.push({ type: "rest", duration: totalExtra });
      return { events: sev, totalBeats: holdMult + totalExtra };
    }

    var compound = splitCompoundNotes(work);
    if (compound.length > 1) {
      var cpn = holdMult / compound.length;
      var cev = compound.map(function(m) { return { type: "note", midi: m, duration: cpn }; });
      if (totalExtra > 0) cev.push({ type: "rest", duration: totalExtra });
      return { events: cev, totalBeats: holdMult + totalExtra };
    }

    var standaloneGrace = work.match(/^\(([^)]+)\)$/);
    if (standaloneGrace && standaloneGrace[1] !== "k" && standaloneGrace[1] !== "T") {
      var sgm = resolveSimpleNote(standaloneGrace[1]);
      if (sgm !== undefined) return { events: [{ type: "note", midi: sgm, duration: 0.5 }], totalBeats: 0.5 };
    }

    var stripped = work.replace(/[^A-Za-z']/g, "");
    if (stripped && stripped !== work) {
      var smidi = resolveSimpleNote(stripped);
      if (smidi !== undefined) return { events: [{ type: "note", midi: smidi, duration: holdMult }], totalBeats: holdMult };
      var ssub = splitCompoundNotes(stripped);
      if (ssub.length > 0) {
        var sp = holdMult / ssub.length;
        return { events: ssub.map(function(m) { return { type: "note", midi: m, duration: sp }; }), totalBeats: holdMult };
      }
    }

    return { events: [{ type: "rest", duration: 1 }], totalBeats: 1 };
  }

  // ── Cross-token lookahead ──────────────────────────────────────────

  function parseTokenSequence(tokens) {
    var result = [];
    var i = 0;
    while (i < tokens.length) {
      var token = tokens[i];

      if (token.length > 1 && token.charAt(token.length - 1) === "~" && i + 1 < tokens.length) {
        var sourceNote = token.slice(0, -1);
        var targetClean = tokens[i + 1].replace(/:+$/, "").replace(/\.+$/, "").replace(/[\u2014\u2013]+$/, "");
        var fromMidi = resolveSimpleNote(sourceNote);
        var toMidi = resolveSimpleNote(targetClean);
        if (fromMidi !== undefined && toMidi !== undefined) {
          result.push({ displayTokenIdx: i, events: [{ type: "meend", fromMidi: fromMidi, toMidi: toMidi, duration: 2.0 }], totalBeats: 1.0 });
          result.push({ displayTokenIdx: i + 1, events: [], totalBeats: 1.0 });
          i += 2; continue;
        }
      }

      if (/^\([^)]+\)$/.test(token) && i + 1 < tokens.length) {
        var inner = token.slice(1, -1);
        if (inner !== "k" && inner !== "T" && !/[0-9x]/.test(inner)) {
          var graceMidi = resolveSimpleNote(inner);
          if (graceMidi !== undefined) {
            var nextParsed = parseToken(tokens[i + 1]);
            result.push({ displayTokenIdx: i, events: [{ type: "note", midi: graceMidi, duration: 0.15 }], totalBeats: 0.15 });
            result.push({ displayTokenIdx: i + 1, events: nextParsed.events, totalBeats: nextParsed.totalBeats });
            i += 2; continue;
          }
        }
      }

      var parsed = parseToken(token);
      result.push({ displayTokenIdx: i, events: parsed.events, totalBeats: parsed.totalBeats });
      i++;
    }
    return result;
  }

  function tokenize(str) {
    if (!str) return [];
    return str.split(/\s+/).filter(function(s) { return s.length > 0; });
  }

  function initAudioPlayer() {
    var dataEl = document.getElementById("songData");
    if (!dataEl) return;

    var song;
    try { song = JSON.parse(dataEl.textContent); } catch(e) { return; }

    // Flatten all lines
    var allLines = [];
    (song.sections || []).forEach(function(sec) {
      (sec.lines || []).forEach(function(line) { allLines.push(line); });
    });
    var totalLines = allLines.length;
    if (totalLines === 0) return;

    // DOM refs
    var playerBar = document.getElementById("audioPlayer");
    var playBtn = document.getElementById("playBtn");
    var prevBtn = document.getElementById("prevBtn");
    var nextBtn = document.getElementById("nextBtn");
    var progressFill = document.getElementById("playerProgress");
    var lyricsEl = document.getElementById("playerLyrics");
    var lineCountEl = document.getElementById("playerLineCount");
    var tempoSlider = document.getElementById("tempoSlider");
    var tempoLabel = document.getElementById("tempoLabel");
    var loopBtn = document.getElementById("loopBtn");
    var muteBtn = document.getElementById("muteBtn");
    var volumeSlider = document.getElementById("volumeSlider");

    // All notation-line elements
    var lineEls = Array.from(document.querySelectorAll(".notation-line[data-line-index]"));

    // State
    var isPlaying = false;
    var currentLine = 0;
    var currentToken = -1;
    var tempo = 100;
    var volume = 0.7;
    var isMuted = false;
    var isLooping = false;
    var noteTimeouts = [];
    var lineAdvanceTimeout = null;
    var audioCtx = null;
    var gainNode = null;

    // Show player bar
    if (playerBar) playerBar.classList.add("visible");

    // Hide pause icon initially
    updatePlayIcon();

    function getAudioCtx() {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioCtx.createGain();
        gainNode.connect(audioCtx.destination);
      }
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    }

    function playNote(midiNote, duration) {
      var ctx = getAudioCtx();
      if (!ctx || !gainNode) return;
      var osc = ctx.createOscillator();
      var noteGain = ctx.createGain();
      var vol = isMuted ? 0 : volume;

      osc.type = "sine"; // flute-like
      osc.frequency.value = midiToFreq(midiNote);

      noteGain.gain.setValueAtTime(0, ctx.currentTime);
      noteGain.gain.linearRampToValueAtTime(vol * 0.5, ctx.currentTime + 0.04);
      noteGain.gain.linearRampToValueAtTime(vol * 0.35, ctx.currentTime + duration * 0.6);
      noteGain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

      osc.connect(noteGain);
      noteGain.connect(gainNode);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    }

    function playMeend(fromMidi, toMidi, duration) {
      var ctx = getAudioCtx();
      if (!ctx || !gainNode) return;
      var osc = ctx.createOscillator();
      var noteGain = ctx.createGain();
      var vol = isMuted ? 0 : volume;

      osc.type = "sine";
      osc.frequency.setValueAtTime(midiToFreq(fromMidi), ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(
        midiToFreq(toMidi),
        ctx.currentTime + duration * 0.8
      );

      noteGain.gain.setValueAtTime(0, ctx.currentTime);
      noteGain.gain.linearRampToValueAtTime(vol * 0.5, ctx.currentTime + 0.04);
      noteGain.gain.linearRampToValueAtTime(vol * 0.35, ctx.currentTime + duration * 0.6);
      noteGain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

      osc.connect(noteGain);
      noteGain.connect(gainNode);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    }

    function cancelTimers() {
      for (var i = 0; i < noteTimeouts.length; i++) clearTimeout(noteTimeouts[i]);
      noteTimeouts = [];
      if (lineAdvanceTimeout) { clearTimeout(lineAdvanceTimeout); lineAdvanceTimeout = null; }
    }

    // Highlight management
    function clearAllHighlights() {
      lineEls.forEach(function(el) { el.classList.remove("active"); });
      document.querySelectorAll(".note-token.playing, .note-token.past").forEach(function(el) {
        el.classList.remove("playing", "past");
      });
    }

    function highlightLine(lineIdx) {
      clearAllHighlights();
      var el = lineEls[lineIdx];
      if (el) {
        el.classList.add("active");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      // Update player info
      var line = allLines[lineIdx];
      if (lyricsEl) lyricsEl.textContent = (line && line.lyrics) || "♪ Instrumental";
      if (lineCountEl) lineCountEl.textContent = "Line " + (lineIdx + 1) + " of " + totalLines;
      if (progressFill) progressFill.style.width = ((lineIdx + 1) / totalLines * 100) + "%";
    }

    function highlightToken(lineIdx, tokenIdx) {
      var lineEl = lineEls[lineIdx];
      if (!lineEl) return;
      var tokens = lineEl.querySelectorAll(".notation-indian .note-token");
      tokens.forEach(function(t, i) {
        t.classList.remove("playing", "past");
        if (i === tokenIdx) t.classList.add("playing");
        else if (i < tokenIdx) t.classList.add("past");
      });
      // Also highlight western tokens
      var wTokens = lineEl.querySelectorAll(".western .note-token");
      wTokens.forEach(function(t, i) {
        t.classList.remove("playing", "past");
        if (i === tokenIdx) t.classList.add("playing");
        else if (i < tokenIdx) t.classList.add("past");
      });
    }

    // Play a line note-by-note
    function playLine(lineIdx) {
      cancelTimers();
      if (lineIdx < 0 || lineIdx >= totalLines) return;

      currentLine = lineIdx;
      highlightLine(lineIdx);

      var line = allLines[lineIdx];
      var tokens = tokenize(line.indian || "");

      if (tokens.length === 0) {
        // No notation — advance after short pause
        var pauseMs = (60 / tempo) * 2 * 1000;
        lineAdvanceTimeout = setTimeout(function() {
          if (isPlaying) advanceToNextLine();
        }, pauseMs);
        return;
      }

      var beatDuration = (60 / tempo) * 0.8; // seconds per beat
      var beatMs = beatDuration * 1000;

      // Parse tokens with cross-token lookahead (meend: Ga~ Sa, grace: (Dha) Ni)
      var scheduled = parseTokenSequence(tokens);
      var cumulativeMs = 0;

      scheduled.forEach(function(se) {
        var tokenStartMs = cumulativeMs;

        // Highlight the original display token
        (function(idx, delay) {
          var hTid = setTimeout(function() {
            if (!isPlaying) return;
            highlightToken(lineIdx, idx);
          }, delay);
          noteTimeouts.push(hTid);
        })(se.displayTokenIdx, tokenStartMs);

        // Schedule play events within this entry
        var eventOffsetMs = 0;
        for (var e = 0; e < se.events.length; e++) {
          var evt = se.events[e];
          var evtStartMs = tokenStartMs + eventOffsetMs;
          var evtDurSec = evt.duration * beatDuration;

          if (evt.type === "note") {
            (function(midi, dur, delay) {
              var tid = setTimeout(function() {
                if (!isPlaying) return;
                playNote(midi, dur);
              }, delay);
              noteTimeouts.push(tid);
            })(evt.midi, evtDurSec, evtStartMs);
          } else if (evt.type === "meend") {
            (function(from, to, dur, delay) {
              var tid = setTimeout(function() {
                if (!isPlaying) return;
                playMeend(from, to, dur);
              }, delay);
              noteTimeouts.push(tid);
            })(evt.fromMidi, evt.toMidi, evtDurSec, evtStartMs);
          }

          eventOffsetMs += evt.duration * beatMs;
        }

        cumulativeMs += se.totalBeats * beatMs;
      });

      // Advance after all tokens
      var gapMs = beatMs * 0.5;
      lineAdvanceTimeout = setTimeout(function() {
        if (isPlaying) advanceToNextLine();
      }, cumulativeMs + gapMs);
    }

    function advanceToNextLine() {
      if (!isPlaying) return;
      var next = currentLine + 1;

      if (isLooping && next >= totalLines) {
        next = 0;
      }

      if (next >= totalLines) {
        stopPlayback();
        return;
      }

      playLine(next);
    }

    function startPlayback() {
      isPlaying = true;
      updatePlayIcon();
      if (currentLine >= totalLines) currentLine = 0;
      playLine(currentLine);
    }

    function stopPlayback() {
      isPlaying = false;
      cancelTimers();
      updatePlayIcon();
    }

    function updatePlayIcon() {
      if (!playBtn) return;
      var playIcon = playBtn.querySelector(".play-icon");
      var pauseIcon = playBtn.querySelector(".pause-icon");
      if (playIcon) playIcon.style.display = isPlaying ? "none" : "block";
      if (pauseIcon) pauseIcon.style.display = isPlaying ? "block" : "none";
      playBtn.title = isPlaying ? "Pause" : "Play";
    }

    // Button handlers
    if (playBtn) playBtn.addEventListener("click", function() {
      if (isPlaying) stopPlayback();
      else startPlayback();
    });

    if (prevBtn) prevBtn.addEventListener("click", function() {
      cancelTimers();
      currentLine = Math.max(0, currentLine - 1);
      highlightLine(currentLine);
      if (isPlaying) playLine(currentLine);
    });

    if (nextBtn) nextBtn.addEventListener("click", function() {
      cancelTimers();
      currentLine = Math.min(totalLines - 1, currentLine + 1);
      highlightLine(currentLine);
      if (isPlaying) playLine(currentLine);
    });

    // Tempo
    if (tempoSlider) tempoSlider.addEventListener("input", function() {
      tempo = Number(this.value);
      if (tempoLabel) tempoLabel.textContent = tempo + " bpm";
      if (isPlaying) {
        cancelTimers();
        playLine(currentLine);
      }
    });

    // Loop
    if (loopBtn) loopBtn.addEventListener("click", function() {
      isLooping = !isLooping;
      this.classList.toggle("active", isLooping);
    });

    // Volume
    if (volumeSlider) volumeSlider.addEventListener("input", function() {
      volume = Number(this.value);
      if (isMuted) { isMuted = false; updateMuteIcon(); }
      if (gainNode) gainNode.gain.value = volume;
    });

    if (muteBtn) muteBtn.addEventListener("click", function() {
      isMuted = !isMuted;
      updateMuteIcon();
      if (gainNode) gainNode.gain.value = isMuted ? 0 : volume;
    });

    function updateMuteIcon() {
      if (!muteBtn) return;
      var volIcon = muteBtn.querySelector(".vol-icon");
      var muteIcon = muteBtn.querySelector(".mute-icon");
      if (volIcon) volIcon.style.display = isMuted ? "none" : "block";
      if (muteIcon) muteIcon.style.display = isMuted ? "block" : "none";
    }
    updateMuteIcon();

    // Click on notation line to jump
    lineEls.forEach(function(el) {
      el.addEventListener("click", function() {
        var idx = parseInt(el.getAttribute("data-line-index"), 10);
        if (isNaN(idx)) return;
        cancelTimers();
        currentLine = idx;
        highlightLine(idx);
        if (isPlaying) playLine(idx);
      });
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", function(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); if (isPlaying) stopPlayback(); else startPlayback(); }
      if (e.code === "ArrowLeft") { cancelTimers(); currentLine = Math.max(0, currentLine - 1); highlightLine(currentLine); if (isPlaying) playLine(currentLine); }
      if (e.code === "ArrowRight") { cancelTimers(); currentLine = Math.min(totalLines - 1, currentLine + 1); highlightLine(currentLine); if (isPlaying) playLine(currentLine); }
    });
  }

  // ========================================
  // INIT
  // ========================================
  function init() {
    initNotationToggle();
    initSearch();
    initSectionCollapse();
    initInfoToggle();
    initNotationGuideModal();
    initAudioPlayer();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
