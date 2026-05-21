"use client";

/**
 * verovioPlay.ts
 * ─────────────
 * Browser-only MIDI playback engine for Verovio-rendered sheet music.
 *
 * Flow:
 *   1. Decodes the base64 MIDI produced by verovio.renderToMIDI()
 *   2. Parses it with @tonejs/midi
 *   3. Schedules all notes onto Tone.js Transport (PolySynth output)
 *   4. Runs a requestAnimationFrame loop that reads Transport.seconds and
 *      walks the Verovio timemap to highlight the current SVG note elements.
 *
 * Browser autoplay note:
 *   Tone.start() MUST be called inside a user-gesture handler (click / keydown).
 *   startPlayback() already calls it — callers only need to invoke startPlayback
 *   from within an onClick / onKeyDown callback.
 */

import type { RefObject } from "react";

// ── Timemap types (Verovio renderToTimemap output) ───────────────────────────
export interface TimemapEntry {
  /** Time in milliseconds (score tempo) */
  tstamp: number;
  /** SVG element IDs of notes turning ON at this timestamp */
  on?: string[];
  /** SVG element IDs of notes turning OFF at this timestamp */
  off?: string[];
}

// ── Public API ────────────────────────────────────────────────────────────────
export interface PlaybackControls {
  pause(): void;
  resume(): void;
  stop(): void;
  /** Whether the transport is currently playing (not paused / stopped) */
  isPlaying(): boolean;
}

// ── CSS cursor class injected once per page load ──────────────────────────────
const CURSOR_CLASS = "vv-cursor";
const CURSOR_STYLE_ID = "__verovio_cursor_style__";

function ensureCursorStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById(CURSOR_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = CURSOR_STYLE_ID;
  // Target notehead <use> elements and any <path>/<rect> inside the highlighted group
  style.textContent = [
    `.${CURSOR_CLASS} use { fill: #e04070 !important; }`,
    `.${CURSOR_CLASS} path { fill: #e04070 !important; }`,
    `.${CURSOR_CLASS} rect:not([class*="bounding"]) { fill: #e04070 !important; }`,
  ].join("\n");
  document.head.appendChild(style);
}

function clearCursor(container: HTMLElement) {
  container.querySelectorAll(`.${CURSOR_CLASS}`).forEach((el) => {
    el.classList.remove(CURSOR_CLASS);
  });
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * Start MIDI playback for a Verovio-rendered score.
 *
 * @param midiBase64   base64 string from verovio.renderToMIDI()
 * @param timemapJson  JSON string from verovio.renderToTimemap()
 * @param containerRef ref to the SheetMusicViewer's output container div
 * @param onStop       called when playback reaches the end (or is stopped)
 * @returns            controls to pause / resume / stop the playback
 *
 * IMPORTANT: call this function only from inside a user-gesture handler so
 * Tone.start() can unlock the Web Audio context.
 */
export async function startPlayback(
  midiBase64: string,
  timemapJson: string,
  containerRef: RefObject<HTMLDivElement | null>,
  onStop: () => void
): Promise<PlaybackControls> {
  ensureCursorStyle();

  // Decode base64 → Uint8Array
  const binary = atob(midiBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  // Parse timemap
  const timemap: TimemapEntry[] = JSON.parse(timemapJson);

  // ── Lazy-load Tone.js + @tonejs/midi (browser only, skip SSR) ──────────────
  const [toneModule, midiModule] = await Promise.all([
    import("tone"),
    import("@tonejs/midi"),
  ]);

  // Tone.js v15 named exports
  const {
    start: toneStart,
    getTransport,
    PolySynth,
    Synth,
    Frequency,
  } = toneModule;

  // Unlock Web Audio — MUST be called inside a user gesture
  await toneStart();

  const { Midi } = midiModule;
  const midi = new Midi(bytes.buffer);

  // ── Build synth ─────────────────────────────────────────────────────────────
  const synth = new PolySynth(Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.8 },
    volume: -6,
  }).toDestination();

  // ── Reset transport ─────────────────────────────────────────────────────────
  const transport = getTransport();
  transport.stop();
  transport.cancel();
  transport.position = 0;

  // ── Schedule MIDI notes ─────────────────────────────────────────────────────
  midi.tracks.forEach((track) => {
    track.notes.forEach((note) => {
      transport.schedule((time: number) => {
        synth.triggerAttackRelease(
          // @tonejs/midi gives note.midi (0-127) and note.duration in seconds
          Frequency(note.midi, "midi").toNote() as string,
          note.duration,
          time,
          note.velocity
        );
      }, note.time);
    });
  });

  // ── Schedule end-of-score stop ──────────────────────────────────────────────
  const totalDuration = midi.duration; // seconds
  let stopped = false;
  if (totalDuration > 0) {
    transport.schedule(() => {
      if (stopped) return;
      stopped = true;
      transport.stop();
      transport.cancel();
      cancelAnimationFrame(rafId);
      if (containerRef.current) clearCursor(containerRef.current);
      synth.dispose();
      onStop();
    }, `+${totalDuration + 0.5}`);
  }

  // ── Timemap cursor (requestAnimationFrame loop) ─────────────────────────────
  let timemapIdx = 0;
  let lastOnIds: string[] = [];
  let rafId = 0;

  const tick = () => {
    const container = containerRef.current;
    if (container && transport.state === "started") {
      const nowMs = transport.seconds * 1000;

      // Advance timemap pointer to match current playhead position
      while (
        timemapIdx < timemap.length - 1 &&
        (timemap[timemapIdx + 1].tstamp ?? Infinity) <= nowMs
      ) {
        timemapIdx++;
      }

      const entry = timemap[timemapIdx];
      const currentOnIds: string[] = entry?.on ?? [];

      // DOM update only when the highlighted set actually changes
      if (
        currentOnIds.length !== lastOnIds.length ||
        currentOnIds.some((id, i) => id !== lastOnIds[i])
      ) {
        // Remove previous highlights
        lastOnIds.forEach((id) => {
          container.querySelector(`[id="${CSS.escape(id)}"]`)?.classList.remove(CURSOR_CLASS);
        });
        // Apply new highlights
        currentOnIds.forEach((id) => {
          container.querySelector(`[id="${CSS.escape(id)}"]`)?.classList.add(CURSOR_CLASS);
        });
        lastOnIds = currentOnIds;
      }
    }

    rafId = requestAnimationFrame(tick);
  };

  transport.start();
  rafId = requestAnimationFrame(tick);

  // ── Return controls ─────────────────────────────────────────────────────────
  let paused = false;

  return {
    pause() {
      if (paused || stopped) return;
      transport.pause();
      cancelAnimationFrame(rafId);
      paused = true;
    },
    resume() {
      if (!paused || stopped) return;
      transport.start();
      rafId = requestAnimationFrame(tick);
      paused = false;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      transport.stop();
      transport.cancel();
      cancelAnimationFrame(rafId);
      if (containerRef.current) clearCursor(containerRef.current);
      try { synth.dispose(); } catch { /* already disposed */ }
      onStop();
    },
    isPlaying() {
      return !paused && !stopped && transport.state === "started";
    },
  };
}
