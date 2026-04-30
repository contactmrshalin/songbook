"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Volume2,
  VolumeX,
  Timer,
  Gauge,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Song } from "@/types/song";

interface AudioPlayerProps {
  song: Song;
}

// ── Indian note → MIDI mapping ─────────────────────────────────────
const NOTE_TO_MIDI: Record<string, number> = {
  // Middle octave (madhya saptak)
  Sa: 60, Re: 62, Ga: 64, ma: 65, Ma: 66, Pa: 67, Dha: 69, Ni: 71,
  // Lower octave (mandra saptak) — lowercase convention
  pa: 55, dha: 57, ni: 59, sa: 48,
  // Lowercase with komal modifiers (seen in data)
  "dha(k)": 56, "ni(k)": 58,
  // Single-letter lowercase (abbreviation for lower octave)
  p: 55, d: 57, n: 59, s: 48,
  // Upper octave (taar saptak) — trailing apostrophe
  "Sa'": 72, "Re'": 74, "Ga'": 76, "ma'": 77, "Ma'": 78,
  "Pa'": 79, "Dha'": 81, "Ni'": 83,
  // Komal (flat) variants
  "Re(k)": 61, "Ga(k)": 63, "Dha(k)": 68, "Ni(k)": 70,
  // Tivra (sharp) variant
  "Ma(T)": 66,
};

// Abbreviated single-letter → canonical note name
const ABBREV: Record<string, string> = {
  S: "Sa", R: "Re", G: "Ga", M: "Ma", P: "Pa", D: "Dha", N: "Ni", Dh: "Dha",
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function tokenizeNotation(indian: string): string[] {
  if (!indian) return [];
  return indian.split(/\s+/).filter(Boolean);
}

// ── Comprehensive notation parser ──────────────────────────────────
// Handles every pattern found across 152 song files:
//   Dot-compounds:  Sa.Re.Ga, Dha(k)..Sa..ma..Ga..Ga..
//   Unicode …:      Dha(k)…Ni(k)…Pa..
//   Meend/glide:    Ni~Dha, Ga~ (cross-token), Ma(T)~GaMa(T)
//   Holds:          Sa:, Pa::, Pa—
//   Grace notes:    (Re)Ga, Dha(Ni)Dha, (Dha) Ni (cross-token)
//   Compounds:      DhaPa, PaMa(T), Ga(k)ma, Ma(T)Ma(T)
//   Leading ':      'Sa, 'Dha (lower octave)
//   Abbreviated:    S, R, G, D, P, Dh, N
//   Rests:          _, __, ., -, —, /
//   Markers:        |, *, ^, ,, {}  (stripped/ignored)

type PlayEvent =
  | { type: "note"; midi: number; duration: number }
  | { type: "rest"; duration: number }
  | { type: "meend"; fromMidi: number; toMidi: number; duration: number };

interface ParsedToken {
  events: PlayEvent[];
  totalBeats: number;
}

// ── Note resolution ────────────────────────────────────────────────

/** Resolve a single note name (with octave/modifier) to MIDI number. */
function resolveSimpleNote(raw: string): number | undefined {
  let t = raw;
  // Strip decorative markers that don't affect pitch
  t = t.replace(/[*^,|/{}—–]/g, "");
  if (!t) return undefined;

  // Leading apostrophe → lower octave (-12)
  let octaveShift = 0;
  if (t.startsWith("'")) {
    octaveShift = -12;
    t = t.slice(1);
  }

  // Direct lookup (handles Sa, Re(k), Ma(T), Sa', etc.)
  let midi = NOTE_TO_MIDI[t];
  if (midi !== undefined) return midi + octaveShift;

  // Strip trailing apostrophe and shift up
  const base = t.replace(/'/g, "");
  midi = NOTE_TO_MIDI[base];
  if (midi !== undefined && t.includes("'")) return midi + 12 + octaveShift;
  if (midi !== undefined) return midi + octaveShift;

  // Try abbreviated note names: S→Sa, R→Re, Dh→Dha, etc.
  const canon = ABBREV[t] || ABBREV[base];
  if (canon) {
    midi = NOTE_TO_MIDI[canon];
    if (midi !== undefined) {
      const result = t.includes("'") ? midi + 12 : midi;
      return result + octaveShift;
    }
  }

  return undefined;
}

// ── Compound note splitting ────────────────────────────────────────

/** Regex for one Indian note name (longest alternatives first, then abbreviations). */
const NOTE_RE = /^(Dha|dha|Sa|sa|Re|Ga|Ma|ma|Pa|pa|Ni|ni|Dh|S|R|G|M|P|D|N|s|r|g|m|p|d|n)(\([kT]\))?(')?/;

/** Greedily split "DhaPa" or "PaMa(T)" into individual MIDI notes. */
function splitCompoundNotes(token: string): number[] {
  const midis: number[] = [];
  let remaining = token;

  while (remaining.length > 0) {
    const m = remaining.match(NOTE_RE);
    if (!m) break;
    const noteStr = m[0];
    const midi = resolveSimpleNote(noteStr);
    if (midi === undefined) break;
    midis.push(midi);
    remaining = remaining.slice(noteStr.length);
  }

  return remaining.length === 0 ? midis : [];
}

// ── Dot-compound detection ─────────────────────────────────────────
// Tokens like "Sa.Re.Ga", "Dha(k)..Sa..ma..Ga..Ga.." contain multiple
// notes separated by dots/ellipsis — played as rapid staccato sequence.

function tryParseDotCompound(token: string): ParsedToken | null {
  // Normalize Unicode ellipsis (…) to double ASCII dots
  const normalized = token.replace(/\u2026/g, "..");
  // Split on sequences of 1+ dots
  const segments = normalized.split(/\.+/).filter((s) => s.length > 0);
  if (segments.length < 2) return null;

  // Try resolving each segment as a note (with possible modifiers)
  const midis: number[] = [];
  for (const seg of segments) {
    // A segment may itself be a compound like "GaRe" or have modifiers
    const midi = resolveSimpleNote(seg);
    if (midi !== undefined) {
      midis.push(midi);
    } else {
      // Try as a sub-compound: "GaRe" within a dot-compound
      const sub = splitCompoundNotes(seg);
      if (sub.length > 0) {
        midis.push(...sub);
      } else {
        return null; // Unresolvable segment — bail out
      }
    }
  }

  // Each note gets 0.5 beats (rapid passage), minimum 1 beat total
  const perNote = Math.min(0.5, 1.0 / midis.length);
  const events: PlayEvent[] = midis.map((midi) => ({
    type: "note" as const,
    midi,
    duration: perNote * 0.85, // slightly shorter for staccato feel
  }));
  return { events, totalBeats: Math.max(1, midis.length * perNote) };
}

// ── Meend parsing ──────────────────────────────────────────────────

/** Parse a single-token meend: "Ni~Dha", "Ma(T)~GaMa(T)", "Ga~Re~Sa:" */
function parseMeendToken(token: string): ParsedToken {
  let work = token;
  let holdMult = 1.0;
  if (work.endsWith(":")) {
    holdMult = 1.5;
    work = work.slice(0, -1);
  }
  // Strip trailing dots/dashes
  work = work.replace(/[.—–]+$/, "");

  const parts = work.split("~").filter(Boolean);

  if (parts.length >= 2) {
    // Resolve first and last note for the glide
    const fromMidi = resolveSimpleNote(parts[0]);
    // The target may itself be a compound like "GaMa(T)" — take last note
    let toMidi: number | undefined;
    const lastPart = parts[parts.length - 1];
    toMidi = resolveSimpleNote(lastPart);
    if (toMidi === undefined) {
      const sub = splitCompoundNotes(lastPart);
      if (sub.length > 0) toMidi = sub[sub.length - 1];
    }

    if (fromMidi !== undefined && toMidi !== undefined) {
      return {
        events: [{ type: "meend", fromMidi, toMidi, duration: holdMult }],
        totalBeats: holdMult,
      };
    }
  }

  // Fallback: strip ~ and play as note/compound
  const clean = token.replace(/[~:—–.]+/g, "");
  const midi = resolveSimpleNote(clean);
  if (midi !== undefined) {
    return { events: [{ type: "note", midi, duration: holdMult }], totalBeats: holdMult };
  }
  const compound = splitCompoundNotes(clean);
  if (compound.length > 0) {
    const perNote = holdMult / compound.length;
    return {
      events: compound.map((m) => ({ type: "note" as const, midi: m, duration: perNote })),
      totalBeats: holdMult,
    };
  }
  return { events: [{ type: "rest", duration: 1 }], totalBeats: 1 };
}

// ── Main token parser ──────────────────────────────────────────────

function parseToken(token: string): ParsedToken {
  // Normalize: replace Unicode ellipsis with double dots
  const tok = token.replace(/\u2026/g, "..");

  // Bar lines and slashes — tiny gap, no sound
  if (tok === "|" || tok === "/") {
    return { events: [], totalBeats: 0.25 };
  }

  // Pure rest tokens: _, __, ., .., -, —, –, :
  if (/^[._\-—–:\/]+$/.test(tok)) {
    return { events: [{ type: "rest", duration: 1 }], totalBeats: 1 };
  }

  // Non-musical markers: (x2), (2x), (na-hi), etc.
  if (/^\([^)]*[0-9x\-][^)]*\)$/.test(tok)) {
    return { events: [{ type: "rest", duration: 0.5 }], totalBeats: 0.5 };
  }

  // Meend (frequency glide): tokens containing ~
  if (tok.includes("~")) {
    return parseMeendToken(tok);
  }

  // Dot-compound: Sa.Re.Ga, Dha(k)..Sa..ma..Ga..Ga.., etc.
  // Must check BEFORE stripping trailing dots
  const dotCompound = tryParseDotCompound(tok);
  if (dotCompound) return dotCompound;

  // ── Strip trailing modifiers ──
  let work = tok;
  let holdMult = 1.0;

  // Trailing colons → hold (each : adds 0.5×)
  const colonMatch = work.match(/:+$/);
  if (colonMatch) {
    holdMult += colonMatch[0].length * 0.5;
    work = work.slice(0, -colonMatch[0].length);
  }

  // Trailing em-dashes → hold
  const dashMatch = work.match(/[—–]+$/);
  if (dashMatch) {
    holdMult += dashMatch[0].length * 0.5;
    work = work.slice(0, -dashMatch[0].length);
  }

  // Trailing commas → brief pause
  let trailingPause = 0;
  const commaMatch = work.match(/,+$/);
  if (commaMatch) {
    trailingPause = commaMatch[0].length * 0.3;
    work = work.slice(0, -commaMatch[0].length);
  }

  // Trailing dots → pause beats
  let trailingDots = 0;
  const dotSuffix = work.match(/(\.+)$/);
  if (dotSuffix) {
    trailingDots = dotSuffix[1].length;
    work = work.slice(0, -trailingDots);
  }

  // Trailing bar lines, asterisks, carets
  work = work.replace(/[|*^]+$/, "");

  // Strip curly braces (treat content as notation)
  work = work.replace(/[{}]/g, "");

  // Leading underscore → rest prefix + compound
  if (work.startsWith("_") && work.length > 1) {
    const notesPart = work.slice(1);
    const compound = splitCompoundNotes(notesPart);
    if (compound.length > 0) {
      const events: PlayEvent[] = [{ type: "rest", duration: 0.5 }];
      const perNote = 0.5 / compound.length;
      compound.forEach((m) => events.push({ type: "note", midi: m, duration: perNote }));
      return { events, totalBeats: 1 };
    }
  }

  const totalExtra = trailingDots + trailingPause;

  // Leading dot → grace/pickup note (after totalExtra is computed)
  if (work.startsWith(".") && work.length > 1) {
    const notesPart = work.slice(1);
    const midi = resolveSimpleNote(notesPart);
    if (midi !== undefined) {
      return { events: [{ type: "note", midi, duration: holdMult }], totalBeats: holdMult };
    }
    const compound = splitCompoundNotes(notesPart);
    if (compound.length > 0) {
      const perNote = holdMult / compound.length;
      return {
        events: compound.map((m) => ({ type: "note" as const, midi: m, duration: perNote })),
        totalBeats: holdMult,
      };
    }
  }

  // Grace note prefix: (Re)Ga, (Re)Ga(k), (Ga)ReSa
  const gracePrefix = work.match(/^\(([^)]+)\)(.+)$/);
  if (gracePrefix && gracePrefix[1] !== "k" && gracePrefix[1] !== "T") {
    const graceMidi = resolveSimpleNote(gracePrefix[1]);
    // Main part might be compound: (Ga)ReSa
    let mainMidis: number[] = [];
    const mainSingle = resolveSimpleNote(gracePrefix[2]);
    if (mainSingle !== undefined) {
      mainMidis = [mainSingle];
    } else {
      mainMidis = splitCompoundNotes(gracePrefix[2]);
    }
    if (graceMidi !== undefined && mainMidis.length > 0) {
      const events: PlayEvent[] = [
        { type: "note", midi: graceMidi, duration: 0.15 * holdMult },
      ];
      const mainDur = (0.85 * holdMult) / mainMidis.length;
      mainMidis.forEach((m) => events.push({ type: "note", midi: m, duration: mainDur }));
      if (totalExtra > 0) events.push({ type: "rest", duration: totalExtra });
      return { events, totalBeats: holdMult + totalExtra };
    }
  }

  // Embedded grace: Re(Ga)Re, Dha(Ni)Dha — where inner is NOT (k)/(T)
  const embGrace = work.match(/^(.+?)\(([^)]+)\)(.+)$/);
  if (embGrace && embGrace[2] !== "k" && embGrace[2] !== "T") {
    const m1 = resolveSimpleNote(embGrace[1]);
    const gm = resolveSimpleNote(embGrace[2]);
    // Third part may be compound
    let m3list: number[] = [];
    const m3single = resolveSimpleNote(embGrace[3]);
    if (m3single !== undefined) m3list = [m3single];
    else m3list = splitCompoundNotes(embGrace[3]);

    if (m1 !== undefined && gm !== undefined && m3list.length > 0) {
      const events: PlayEvent[] = [
        { type: "note", midi: m1, duration: 0.4 * holdMult },
        { type: "note", midi: gm, duration: 0.15 * holdMult },
      ];
      const tailDur = (0.45 * holdMult) / m3list.length;
      m3list.forEach((m) => events.push({ type: "note", midi: m, duration: tailDur }));
      if (totalExtra > 0) events.push({ type: "rest", duration: totalExtra });
      return { events, totalBeats: holdMult + totalExtra };
    }
  }

  // Single known note
  const singleMidi = resolveSimpleNote(work);
  if (singleMidi !== undefined) {
    const events: PlayEvent[] = [{ type: "note", midi: singleMidi, duration: holdMult }];
    if (totalExtra > 0) events.push({ type: "rest", duration: totalExtra });
    return { events, totalBeats: holdMult + totalExtra };
  }

  // Compound note: DhaPa, PaMa(T), GaReSa, Ma(T)Ma(T), Ga(k)ma
  const compound = splitCompoundNotes(work);
  if (compound.length > 1) {
    const perNote = holdMult / compound.length;
    const events: PlayEvent[] = compound.map((midi) => ({
      type: "note" as const,
      midi,
      duration: perNote,
    }));
    if (totalExtra > 0) events.push({ type: "rest", duration: totalExtra });
    return { events, totalBeats: holdMult + totalExtra };
  }

  // Standalone grace marker: (Dha), (Ni)
  const standaloneGrace = work.match(/^\(([^)]+)\)$/);
  if (standaloneGrace && standaloneGrace[1] !== "k" && standaloneGrace[1] !== "T") {
    const midi = resolveSimpleNote(standaloneGrace[1]);
    if (midi !== undefined) {
      return { events: [{ type: "note", midi, duration: 0.5 }], totalBeats: 0.5 };
    }
  }

  // Last resort: strip ALL non-alphabetic chars (including mismatched parens) and try
  const stripped = work.replace(/[^A-Za-z']/g, "");
  if (stripped && stripped !== work) {
    const midi = resolveSimpleNote(stripped);
    if (midi !== undefined) {
      return { events: [{ type: "note", midi, duration: holdMult }], totalBeats: holdMult };
    }
    const sub = splitCompoundNotes(stripped);
    if (sub.length > 0) {
      const perNote = holdMult / sub.length;
      return {
        events: sub.map((m) => ({ type: "note" as const, midi: m, duration: perNote })),
        totalBeats: holdMult,
      };
    }
  }

  // Unrecognized — one beat of silence
  return { events: [{ type: "rest", duration: 1 }], totalBeats: 1 };
}

// ── Cross-token lookahead ──────────────────────────────────────────
// Handles ornaments that span two space-separated tokens:
//   "Ga~ Sa"   → meend from Ga to Sa
//   "(Dha) Ni" → grace note Dha before main note Ni

interface ScheduledEvent {
  displayTokenIdx: number;
  events: PlayEvent[];
  totalBeats: number;
}

function parseTokenSequence(tokens: string[]): ScheduledEvent[] {
  const result: ScheduledEvent[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    // Cross-token meend: "Ga~" followed by "Sa"
    if (token.length > 1 && token.endsWith("~") && i + 1 < tokens.length) {
      const sourceNote = token.slice(0, -1);
      const targetRaw = tokens[i + 1];
      const targetClean = targetRaw.replace(/:+$/, "").replace(/\.+$/, "").replace(/[—–]+$/, "");
      const fromMidi = resolveSimpleNote(sourceNote);
      const toMidi = resolveSimpleNote(targetClean);

      if (fromMidi !== undefined && toMidi !== undefined) {
        result.push({
          displayTokenIdx: i,
          events: [{ type: "meend", fromMidi, toMidi, duration: 2.0 }],
          totalBeats: 1.0,
        });
        result.push({
          displayTokenIdx: i + 1,
          events: [],
          totalBeats: 1.0,
        });
        i += 2;
        continue;
      }
    }

    // Cross-token grace: "(Dha)" followed by "Ni"
    if (/^\([^)]+\)$/.test(token) && i + 1 < tokens.length) {
      const inner = token.slice(1, -1);
      if (inner !== "k" && inner !== "T" && !/[0-9x]/.test(inner)) {
        const graceMidi = resolveSimpleNote(inner);
        if (graceMidi !== undefined) {
          const nextParsed = parseToken(tokens[i + 1]);
          result.push({
            displayTokenIdx: i,
            events: [{ type: "note", midi: graceMidi, duration: 0.15 }],
            totalBeats: 0.15,
          });
          result.push({
            displayTokenIdx: i + 1,
            events: nextParsed.events,
            totalBeats: nextParsed.totalBeats,
          });
          i += 2;
          continue;
        }
      }
    }

    // Regular token
    const parsed = parseToken(token);
    result.push({
      displayTokenIdx: i,
      events: parsed.events,
      totalBeats: parsed.totalBeats,
    });
    i++;
  }

  return result;
}

export default function AudioPlayer({ song }: AudioPlayerProps) {
  const {
    isPlaying, setIsPlaying,
    tempo, setTempo,
    currentNoteIndex, setCurrentNoteIndex,
    setCurrentTokenIndex,
    loopStart, loopEnd, setLoop,
    metronomeEnabled, setMetronomeEnabled,
    instrument, setInstrument,
  } = useAppStore();

  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  // Refs for stable access from timers
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const isPlayingRef = useRef(false);
  const currentLineRef = useRef(0);
  const tempoRef = useRef(tempo);
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  const instrumentRef = useRef(instrument);
  const isLoopingRef = useRef(false);
  const loopStartRef = useRef<number | null>(null);
  const loopEndRef = useRef<number | null>(null);
  // All pending timeouts for the current line so we can cancel on stop/skip
  const noteTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Timeout for advancing to next line
  const lineAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs to break circular useCallback dependency between playLine ↔ advanceToNextLine
  const playLineFnRef = useRef<(lineIndex: number) => void>(() => {});
  const advanceToNextLineFnRef = useRef<() => void>(() => {});

  const allLinesRef = useRef(
    song.sections.flatMap((section) => section.lines)
  );
  const allLines = allLinesRef.current;
  const totalLines = allLines.length;

  // Keep refs in sync
  useEffect(() => { tempoRef.current = tempo; }, [tempo]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { instrumentRef.current = instrument; }, [instrument]);
  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
  useEffect(() => { loopStartRef.current = loopStart; }, [loopStart]);
  useEffect(() => { loopEndRef.current = loopEnd; }, [loopEnd]);

  // AudioContext setup
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Play a single note oscillator
  const playNote = useCallback((midiNote: number, duration: number) => {
    const ctx = getAudioContext();
    if (!ctx || !gainNodeRef.current) return;

    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    const inst = instrumentRef.current;
    const vol = isMutedRef.current ? 0 : volumeRef.current;

    osc.type = inst === "flute" || inst === "piccolo" ? "sine" : "triangle";
    osc.frequency.value = midiToFreq(midiNote);

    // Envelope: attack → sustain → release
    noteGain.gain.setValueAtTime(0, ctx.currentTime);
    noteGain.gain.linearRampToValueAtTime(vol * 0.5, ctx.currentTime + 0.04);
    noteGain.gain.linearRampToValueAtTime(vol * 0.35, ctx.currentTime + duration * 0.6);
    noteGain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    osc.connect(noteGain);
    noteGain.connect(gainNodeRef.current);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }, [getAudioContext]);

  // Play a meend (frequency glide) between two notes
  const playMeend = useCallback((fromMidi: number, toMidi: number, duration: number) => {
    const ctx = getAudioContext();
    if (!ctx || !gainNodeRef.current) return;

    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    const inst = instrumentRef.current;
    const vol = isMutedRef.current ? 0 : volumeRef.current;

    osc.type = inst === "flute" || inst === "piccolo" ? "sine" : "triangle";
    // Start at the source frequency
    osc.frequency.setValueAtTime(midiToFreq(fromMidi), ctx.currentTime);
    // Glide to target over 80% of duration for a smooth meend
    osc.frequency.linearRampToValueAtTime(
      midiToFreq(toMidi),
      ctx.currentTime + duration * 0.8
    );

    // Envelope: attack → sustain → release
    noteGain.gain.setValueAtTime(0, ctx.currentTime);
    noteGain.gain.linearRampToValueAtTime(vol * 0.5, ctx.currentTime + 0.04);
    noteGain.gain.linearRampToValueAtTime(vol * 0.35, ctx.currentTime + duration * 0.6);
    noteGain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    osc.connect(noteGain);
    noteGain.connect(gainNodeRef.current);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }, [getAudioContext]);

  // Cancel all pending note and line-advance timers
  const cancelPendingTimers = useCallback(() => {
    for (const t of noteTimeoutsRef.current) {
      clearTimeout(t);
    }
    noteTimeoutsRef.current = [];
    if (lineAdvanceTimeoutRef.current) {
      clearTimeout(lineAdvanceTimeoutRef.current);
      lineAdvanceTimeoutRef.current = null;
    }
  }, []);

  // Play an entire line note-by-note, updating the token index for each note,
  // then schedule advance to the next line after all notes finish.
  const playLine = useCallback((lineIndex: number) => {
    cancelPendingTimers();

    const line = allLines[lineIndex];
    if (!line) return;

    // Set line-level highlight
    setCurrentNoteIndex(lineIndex);
    setCurrentTokenIndex(-1);

    const tokens = tokenizeNotation(line.indian || "");
    if (tokens.length === 0) {
      // No notation — advance after a short pause
      const pauseDuration = (60 / tempoRef.current) * 2 * 1000;
      lineAdvanceTimeoutRef.current = setTimeout(() => {
        if (isPlayingRef.current) {
          advanceToNextLineFnRef.current();
        }
      }, pauseDuration);
      return;
    }

    const beatDuration = (60 / tempoRef.current) * 0.8; // seconds per beat
    const beatMs = beatDuration * 1000; // ms per beat

    // Parse tokens with cross-token lookahead (meend: Ga~ Sa, grace: (Dha) Ni)
    const scheduled = parseTokenSequence(tokens);

    let cumulativeMs = 0;

    scheduled.forEach((se) => {
      const tokenStartMs = cumulativeMs;

      // Highlight the original display token
      const hTid = setTimeout(() => {
        if (!isPlayingRef.current) return;
        setCurrentTokenIndex(se.displayTokenIdx);
      }, tokenStartMs);
      noteTimeoutsRef.current.push(hTid);

      // Schedule play events within this token
      let eventOffsetMs = 0;
      for (const evt of se.events) {
        const evtStartMs = tokenStartMs + eventOffsetMs;
        const evtDurSec = evt.duration * beatDuration;

        if (evt.type === "note") {
          const tid = setTimeout(() => {
            if (!isPlayingRef.current) return;
            playNote(evt.midi, evtDurSec);
          }, evtStartMs);
          noteTimeoutsRef.current.push(tid);
        } else if (evt.type === "meend") {
          const tid = setTimeout(() => {
            if (!isPlayingRef.current) return;
            playMeend(evt.fromMidi, evt.toMidi, evtDurSec);
          }, evtStartMs);
          noteTimeoutsRef.current.push(tid);
        }
        // "rest" events: no sound, just advance time

        eventOffsetMs += evt.duration * beatMs;
      }

      cumulativeMs += se.totalBeats * beatMs;
    });

    // After all tokens finish, add a small gap then advance to next line
    const gapMs = beatMs * 0.5; // half-beat gap between lines

    lineAdvanceTimeoutRef.current = setTimeout(() => {
      if (isPlayingRef.current) {
        advanceToNextLineFnRef.current();
      }
    }, cumulativeMs + gapMs);
  }, [allLines, playNote, playMeend, cancelPendingTimers, setCurrentNoteIndex, setCurrentTokenIndex]);

  // Advance to the next line (uses playLineFnRef to avoid circular dependency)
  const advanceToNextLine = useCallback(() => {
    if (!isPlayingRef.current) return;

    let nextLine = currentLineRef.current;

    // Loop handling
    if (isLoopingRef.current && loopStartRef.current !== null && loopEndRef.current !== null) {
      if (nextLine > loopEndRef.current) {
        nextLine = loopStartRef.current;
        currentLineRef.current = nextLine;
      }
    }

    // End of song
    if (nextLine >= totalLines) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setCurrentNoteIndex(-1);
      setCurrentTokenIndex(-1);
      currentLineRef.current = 0;
      return;
    }

    currentLineRef.current = nextLine + 1;
    playLineFnRef.current(nextLine);
  }, [totalLines, setIsPlaying, setCurrentNoteIndex, setCurrentTokenIndex]);

  // Keep function refs in sync so timer callbacks always call the latest version
  useEffect(() => { playLineFnRef.current = playLine; }, [playLine]);
  useEffect(() => { advanceToNextLineFnRef.current = advanceToNextLine; }, [advanceToNextLine]);

  // Start / stop playback
  useEffect(() => {
    if (isPlaying) {
      isPlayingRef.current = true;

      if (currentLineRef.current >= totalLines || currentNoteIndex === -1) {
        currentLineRef.current = 0;
      }

      // Kick off playback from the current line
      const startLine = currentLineRef.current;
      currentLineRef.current = startLine + 1;
      playLine(startLine);
    } else {
      isPlayingRef.current = false;
      cancelPendingTimers();
    }

    return () => {
      cancelPendingTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // When tempo changes mid-playback, restart the current line with new timing
  useEffect(() => {
    if (isPlaying && currentNoteIndex >= 0) {
      // Replay current line with updated tempo
      cancelPendingTimers();
      const line = currentNoteIndex;
      currentLineRef.current = line + 1;
      playLine(line);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempo]);

  // Update gain node volume
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Cleanup
  useEffect(() => {
    return () => {
      cancelPendingTimers();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [cancelPendingTimers]);

  const handlePlayPause = () => {
    if (!isPlaying) {
      if (currentNoteIndex === -1 || currentNoteIndex >= totalLines) {
        currentLineRef.current = 0;
      }
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
      setCurrentTokenIndex(-1);
    }
  };

  const handlePrev = () => {
    cancelPendingTimers();
    const prev = Math.max(0, (currentLineRef.current || 1) - 2);
    currentLineRef.current = prev;
    setCurrentNoteIndex(prev);
    setCurrentTokenIndex(-1);
    if (isPlaying) {
      currentLineRef.current = prev + 1;
      playLine(prev);
    }
  };

  const handleNext = () => {
    cancelPendingTimers();
    const next = Math.min(totalLines - 1, currentLineRef.current);
    currentLineRef.current = next;
    setCurrentNoteIndex(next);
    setCurrentTokenIndex(-1);
    if (isPlaying) {
      currentLineRef.current = next + 1;
      playLine(next);
    }
  };

  const handleLoopToggle = () => {
    if (isLooping) {
      setIsLooping(false);
      setLoop(null, null);
    } else {
      setIsLooping(true);
      setLoop(0, totalLines - 1);
    }
  };

  const progressPercent =
    currentNoteIndex >= 0 ? ((currentNoteIndex + 1) / totalLines) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 player-bar">
      {/* Progress bar */}
      <div className="h-1 bg-white/10 w-full">
        <div
          className="h-full bg-[var(--accent-primary)] transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center gap-4">
          {/* Playback controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="p-2 text-white/60 hover:text-white transition-colors"
              title="Previous line"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={handlePlayPause}
              className="p-3 bg-[var(--accent-primary)] rounded-full text-white hover:bg-[var(--accent-primary)]/80 transition-colors shadow-lg"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </button>
            <button
              onClick={handleNext}
              className="p-2 text-white/60 hover:text-white transition-colors"
              title="Next line"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Current line info */}
          <div className="flex-1 min-w-0 hidden sm:block">
            <p className="text-sm text-white/90 truncate">
              {currentNoteIndex >= 0 && allLines[currentNoteIndex]
                ? allLines[currentNoteIndex].lyrics || "♪ Instrumental"
                : song.title}
            </p>
            <p className="text-xs text-white/50">
              Line {Math.max(1, currentNoteIndex + 1)} of {totalLines}
            </p>
          </div>

          {/* Tempo control */}
          <div className="hidden md:flex items-center gap-2">
            <Gauge className="w-4 h-4 text-white/50" />
            <input
              type="range"
              min={40}
              max={200}
              value={tempo}
              onChange={(e) => setTempo(Number(e.target.value))}
              className="w-20"
              title={`Tempo: ${tempo} BPM`}
            />
            <span className="text-xs text-white/50 w-12">{tempo} bpm</span>
          </div>

          {/* Instrument selector */}
          <div className="hidden lg:block">
            <select
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              className="bg-white/10 text-white text-xs rounded-lg px-2 py-1.5 border border-white/10 outline-none"
            >
              <option value="flute">🎵 Flute</option>
              <option value="piccolo">🎶 Piccolo</option>
              <option value="piano">🎹 Piano</option>
              <option value="harmonium">🪗 Harmonium</option>
            </select>
          </div>

          {/* Loop & Metronome */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleLoopToggle}
              className={`p-2 rounded-lg transition-colors ${
                isLooping
                  ? "bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]"
                  : "text-white/40 hover:text-white/70"
              }`}
              title="Loop"
            >
              <Repeat className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMetronomeEnabled(!metronomeEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                metronomeEnabled
                  ? "bg-[var(--accent-warm)]/20 text-[var(--accent-warm)]"
                  : "text-white/40 hover:text-white/70"
              }`}
              title="Metronome"
            >
              <Timer className="w-4 h-4" />
            </button>
          </div>

          {/* Volume */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 text-white/40 hover:text-white/70 transition-colors"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-16"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
