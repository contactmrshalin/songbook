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

  // Indian note → MIDI mapping
  var NOTE_TO_MIDI = {
    Sa: 60, Re: 62, Ga: 64, ma: 65, Ma: 66, Pa: 67, Dha: 69, Ni: 71,
    pa: 55, dha: 57, ni: 59,
    "Sa'": 72, "Re'": 74, "Ga'": 76, "ma'": 77, "Pa'": 79, "Dha'": 81, "Ni'": 83,
    "Re(k)": 61, "Ga(k)": 63, "Dha(k)": 68, "Ni(k)": 70, "Ma(T)": 66
  };

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function resolveTokenMidi(token) {
    var clean = token.replace(/:/g, "").replace(/\./g, "").replace(/~/g, "").replace(/\^/g, "").replace(/\(/g, "").replace(/\)/g, "");
    var midi = NOTE_TO_MIDI[clean];
    if (midi === undefined) {
      var base = clean.replace(/'/g, "");
      midi = NOTE_TO_MIDI[base];
      if (midi !== undefined && clean.indexOf("'") >= 0) midi += 12;
    }
    return midi;
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

      var noteDuration = (60 / tempo) * 0.8;
      var noteIntervalMs = noteDuration * 1000;

      tokens.forEach(function(token, tokenIdx) {
        var delay = tokenIdx * noteIntervalMs;
        var tid = setTimeout(function() {
          if (!isPlaying) return;
          highlightToken(lineIdx, tokenIdx);

          var isBarOrRest = (token === "|" || token === "." || token === "_" || token === "-" || token === "—");
          if (!isBarOrRest) {
            var isHold = token.indexOf(":") >= 0;
            var midi = resolveTokenMidi(token);
            if (midi !== undefined) {
              playNote(midi, isHold ? noteDuration * 1.5 : noteDuration);
            }
          }
        }, delay);
        noteTimeouts.push(tid);
      });

      // Advance after all tokens
      var totalDuration = tokens.length * noteIntervalMs;
      var gapMs = noteIntervalMs * 0.5;
      lineAdvanceTimeout = setTimeout(function() {
        if (isPlaying) advanceToNextLine();
      }, totalDuration + gapMs);
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
