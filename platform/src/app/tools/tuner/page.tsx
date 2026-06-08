"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE_SCALES = [
  { label: "C",  freq: 261.63 },
  { label: "C#", freq: 277.18 },
  { label: "D",  freq: 293.66 },
  { label: "D#", freq: 311.13 },
  { label: "E",  freq: 329.63 },
  { label: "F",  freq: 349.23 },
  { label: "F#", freq: 369.99 },
  { label: "G",  freq: 392.0  },
  { label: "G#", freq: 415.3  },
  { label: "A",  freq: 440.0  },
  { label: "A#", freq: 466.16 },
  { label: "B",  freq: 493.88 },
];

const SARGAM_NOTES = [
  { sargam: "Sa",   semitones: 0  },
  { sargam: "Re\u266D",  semitones: 1  },
  { sargam: "Re",   semitones: 2  },
  { sargam: "Ga\u266D",  semitones: 3  },
  { sargam: "Ga",   semitones: 4  },
  { sargam: "Ma",   semitones: 5  },
  { sargam: "Ma#",  semitones: 6  },
  { sargam: "Pa",   semitones: 7  },
  { sargam: "Dha\u266D", semitones: 8  },
  { sargam: "Dha",  semitones: 9  },
  { sargam: "Ni\u266D",  semitones: 10 },
  { sargam: "Ni",   semitones: 11 },
];

const CIRCLE_NOTES = ["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni"];

/**
 * Bansuri range across three octaves.
 * semitone = distance in semitones from Madhya Sa (the selected base note).
 *
 * Mandra Saptak  (lower, -5 to -1)  : Pa → Ni  — 5 notes
 * Madhya Saptak  (middle, 0 to 11)  : Sa → Ni  — 12 notes  (full chromatic)
 * Taar Saptak    (higher, 12 to 19) : Sa → Pa  — 8 notes
 * ─────────────────────────────────────────────────────
 * Total: 25 notes  (matches standard 6-hole Bansuri capability)
 */
const BANSURI_OCTAVES = [
  {
    id: "mandra",
    name: "Mandra Saptak",
    subtitle: "Lower Octave  (overblown / overblow reach)",
    notes: [
      { sargam: "Pa",   display: "Pa",     semitone: -5, komal: false },
      { sargam: "Dha\u266D", display: "Dha\u266D", semitone: -4, komal: true  },
      { sargam: "Dha",  display: "Dha",    semitone: -3, komal: false },
      { sargam: "Ni\u266D",  display: "Ni\u266D",  semitone: -2, komal: true  },
      { sargam: "Ni",   display: "Ni",     semitone: -1, komal: false },
    ],
  },
  {
    id: "madhya",
    name: "Madhya Saptak",
    subtitle: "Middle Octave  (primary register)",
    notes: [
      { sargam: "Sa",   display: "Sa",     semitone: 0,  komal: false },
      { sargam: "Re\u266D",  display: "Re\u266D",  semitone: 1,  komal: true  },
      { sargam: "Re",   display: "Re",     semitone: 2,  komal: false },
      { sargam: "Ga\u266D",  display: "Ga\u266D",  semitone: 3,  komal: true  },
      { sargam: "Ga",   display: "Ga",     semitone: 4,  komal: false },
      { sargam: "Ma",   display: "Ma",     semitone: 5,  komal: false },
      { sargam: "Ma#",  display: "Ma#",    semitone: 6,  komal: true  },
      { sargam: "Pa",   display: "Pa",     semitone: 7,  komal: false },
      { sargam: "Dha\u266D", display: "Dha\u266D", semitone: 8,  komal: true  },
      { sargam: "Dha",  display: "Dha",    semitone: 9,  komal: false },
      { sargam: "Ni\u266D",  display: "Ni\u266D",  semitone: 10, komal: true  },
      { sargam: "Ni",   display: "Ni",     semitone: 11, komal: false },
    ],
  },
  {
    id: "taar",
    name: "Taar Saptak",
    subtitle: "Higher Octave  (high-pressure register)",
    notes: [
      { sargam: "Sa\u02D9",  display: "Sa\u02D9",  semitone: 12, komal: false },
      { sargam: "Re\u266D\u02D9", display: "Re\u266D\u02D9", semitone: 13, komal: true  },
      { sargam: "Re\u02D9",  display: "Re\u02D9",  semitone: 14, komal: false },
      { sargam: "Ga\u266D\u02D9", display: "Ga\u266D\u02D9", semitone: 15, komal: true  },
      { sargam: "Ga\u02D9",  display: "Ga\u02D9",  semitone: 16, komal: false },
      { sargam: "Ma\u02D9",  display: "Ma\u02D9",  semitone: 17, komal: false },
      { sargam: "Ma#\u02D9", display: "Ma#\u02D9", semitone: 18, komal: true  },
      { sargam: "Pa\u02D9",  display: "Pa\u02D9",  semitone: 19, komal: false },
    ],
  },
] as const;

const TOTAL_NOTES = BANSURI_OCTAVES.reduce((s, o) => s + o.notes.length, 0); // 25

/**
 * How many consecutive detection frames (≈16ms each) a note must ring
 * at |cents| ≤ 15 before it is marked "played".
 * 15 frames ≈ 250 ms — long enough to suppress glides / accidentals.
 */
const HIT_FRAMES = 15;

// ── Pitch detection ───────────────────────────────────────────────────────────

function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.008) return -1;

  let r1 = 0, r2 = SIZE - 1;
  const thr = 0.15;
  for (let i = 0; i < SIZE / 2; i++) { if (Math.abs(buf[i]) >= thr) { r1 = i; break; } }
  for (let i = 1; i < SIZE / 2; i++) { if (Math.abs(buf[SIZE - i]) >= thr) { r2 = SIZE - i; break; } }

  const tb = buf.slice(r1, r2);
  const ts = tb.length;
  if (ts < 64) return -1;

  const c = new Float32Array(ts);
  for (let i = 0; i < ts; i++) {
    let s = 0;
    for (let j = 0; j < ts - i; j++) s += tb[j] * tb[j + i];
    c[i] = s;
  }

  let d = 0;
  while (c[d] > c[d + 1] && d < ts / 2) d++;

  let mv = -1, mp = -1;
  for (let i = d; i < ts / 2; i++) {
    if (c[i] > mv) { mv = c[i]; mp = i; }
  }
  if (mp === -1 || mv < 0.01 * c[0]) return -1;

  const y1 = c[mp - 1] || 0, y2 = c[mp], y3 = c[mp + 1] || 0;
  const sh = (y3 - y1) / (2 * (2 * y2 - y1 - y3));
  return sampleRate / (mp + (isFinite(sh) ? sh : 0));
}

/**
 * Maps a detected frequency to the nearest sargam note.
 * Returns absolute semitone offset from base (not reduced to 0-11) so
 * the Range Trainer can determine which octave the note belongs to.
 */
function findClosestNote(freq: number, baseFreq: number) {
  const absoluteSemitones = 12 * Math.log2(freq / baseFreq);
  const rounded = Math.round(absoluteSemitones);
  const noteIndex = ((rounded % 12) + 12) % 12;
  const cents = Math.round((absoluteSemitones - rounded) * 100);
  return {
    ...SARGAM_NOTES[noteIndex],
    cents,
    detectedFreq: freq,
    absoluteSemitone: rounded,
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

type View = "tuner" | "range";

type DetectedNote = {
  sargam: string;
  cents: number;
  detectedFreq: number;
  absoluteSemitone: number;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function TunerPage() {
  const [view, setView]               = useState<View>("tuner");
  const [isListening, setIsListening] = useState(false);
  const [baseScaleIndex, setBaseScaleIndex] = useState(0);
  const [detectedNote, setDetectedNote]     = useState<DetectedNote | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [masteredNotes, setMasteredNotes]   = useState<Set<number>>(new Set());

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef     = useRef<AnalyserNode | null>(null);
  const sourceRef       = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  const rafRef          = useRef<number>(0);
  const silenceCountRef = useRef(0);
  const baseScaleIndexRef = useRef(baseScaleIndex);
  baseScaleIndexRef.current = baseScaleIndex;

  // Range trainer: sustain tracking — requires N consecutive frames in-tune
  const sustainRef  = useRef<{ semitone: number; count: number } | null>(null);
  const masteredRef = useRef<Set<number>>(new Set());

  const detect = useCallback(() => {
    if (!analyserRef.current || !audioContextRef.current) return;

    const buf = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(buf);
    const freq = autoCorrelate(buf, audioContextRef.current.sampleRate);

    if (freq > 50 && freq < 2000) {
      silenceCountRef.current = 0;
      const note = findClosestNote(freq, BASE_SCALES[baseScaleIndexRef.current].freq);
      setDetectedNote(note);

      // Range trainer: mark note as "played" after HIT_FRAMES consecutive
      // frames within ±15¢ of the same semitone.
      if (Math.abs(note.cents) <= 15) {
        if (sustainRef.current?.semitone === note.absoluteSemitone) {
          sustainRef.current.count++;
          if (
            sustainRef.current.count >= HIT_FRAMES &&
            !masteredRef.current.has(note.absoluteSemitone)
          ) {
            const next = new Set(masteredRef.current);
            next.add(note.absoluteSemitone);
            masteredRef.current = next;
            setMasteredNotes(next);
          }
        } else {
          sustainRef.current = { semitone: note.absoluteSemitone, count: 1 };
        }
      } else {
        sustainRef.current = null;
      }
    } else {
      silenceCountRef.current++;
      if (silenceCountRef.current > 20) {
        setDetectedNote(null);
        sustainRef.current = null;
      }
    }

    rafRef.current = requestAnimationFrame(detect);
  }, []);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const ctx = new AudioContext({ sampleRate: 44100 });
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = ctx;
      analyserRef.current     = analyser;
      sourceRef.current       = source;
      streamRef.current       = stream;

      setIsListening(true);
      setError(null);
      rafRef.current = requestAnimationFrame(detect);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Microphone access denied");
    }
  }, [detect]);

  const stopListening = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current     = null;
    sourceRef.current       = null;
    streamRef.current       = null;
    setIsListening(false);
    setDetectedNote(null);
    sustainRef.current = null;
  }, []);

  const resetMastery = useCallback(() => {
    masteredRef.current = new Set();
    setMasteredNotes(new Set());
    sustainRef.current = null;
  }, []);

  useEffect(() => { return () => { stopListening(); }; }, [stopListening]);

  // ── Derived display values ──────────────────────────────────────────────────

  const getCentsColor = (cents: number) => {
    const abs = Math.abs(cents);
    if (abs <= 5)  return "var(--accent-success)";
    if (abs <= 15) return "var(--accent-warm)";
    return "var(--accent-secondary)";
  };

  const activeCircleIdx = detectedNote
    ? CIRCLE_NOTES.findIndex((n) => detectedNote.sargam.startsWith(n))
    : -1;

  // Semitone currently sounding (within ±30¢ = rough detection)
  const activeSemitone =
    detectedNote && Math.abs(detectedNote.cents) <= 30
      ? detectedNote.absoluteSemitone
      : null;

  // Semitone within the ±15¢ hit window (building toward mastery)
  const hitCandidateSemitone =
    detectedNote && Math.abs(detectedNote.cents) <= 15
      ? detectedNote.absoluteSemitone
      : null;

  const masteredCount = masteredNotes.size;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-6">
      <h2 className="text-2xl font-bold text-[var(--text-primary)]">Flute Tuner</h2>

      {/* View toggle */}
      <div className="flex rounded-xl overflow-hidden border border-[var(--border-medium)]">
        {(["tuner", "range"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-5 py-2 text-sm font-medium transition-colors ${
              view === v
                ? "bg-[var(--accent-primary)] text-white"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border-light)]"
            }`}
          >
            {v === "tuner" ? "Tuner" : "Range Trainer"}
          </button>
        ))}
      </div>

      {/* Base scale selector — shared across both views */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-sm text-[var(--text-secondary)] font-medium">Sa =</span>
        {BASE_SCALES.map((scale, idx) => (
          <button
            key={scale.label}
            onClick={() => setBaseScaleIndex(idx)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              idx === baseScaleIndex
                ? "bg-[var(--accent-primary)] text-white shadow-md"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border-light)]"
            }`}
          >
            {scale.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════
          TUNER VIEW  — circular note display
          ════════════════════════════════════════════════ */}
      {view === "tuner" && (
        <>
          <p className="text-sm text-[var(--text-muted)]">
            Detects pitch from your microphone and shows the nearest sargam note
          </p>

          {/* Circular note display */}
          <div className="relative w-72 h-72 sm:w-80 sm:h-80">
            <svg viewBox="0 0 300 300" className="w-full h-full">
              <circle
                cx="150" cy="150" r="140"
                fill="var(--bg-secondary)"
                stroke="var(--border-light)"
                strokeWidth="2"
              />
              {CIRCLE_NOTES.map((note, idx) => {
                const angle = (idx / CIRCLE_NOTES.length) * 2 * Math.PI - Math.PI / 2;
                const r = 110;
                const x = 150 + Math.cos(angle) * r;
                const y = 150 + Math.sin(angle) * r;
                const isActive = idx === activeCircleIdx;
                return (
                  <g key={note}>
                    <circle
                      cx={x} cy={y} r={22}
                      fill={isActive ? "var(--accent-primary)" : "var(--bg-card)"}
                      stroke={isActive ? "var(--accent-primary)" : "var(--border-medium)"}
                      strokeWidth="2"
                      style={{ transition: "all 0.15s ease" }}
                    />
                    <text
                      x={x} y={y}
                      textAnchor="middle" dominantBaseline="central"
                      className="text-sm font-bold"
                      fill={isActive ? "white" : "var(--text-secondary)"}
                      style={{ transition: "all 0.15s ease" }}
                    >
                      {note}
                    </text>
                  </g>
                );
              })}
              {/* Centre: note name / status */}
              <text
                x="150" y={detectedNote ? "140" : "155"}
                textAnchor="middle" dominantBaseline="central"
                className="text-2xl font-bold"
                fill="var(--text-primary)"
              >
                {detectedNote
                  ? detectedNote.sargam
                  : isListening ? "Listening\u2026" : "Tap Start"}
              </text>
              {detectedNote && (
                <>
                  <text x="150" y="165" textAnchor="middle" className="text-xs" fill="var(--text-muted)">
                    {detectedNote.detectedFreq.toFixed(1)} Hz
                  </text>
                  <text
                    x="150" y="185" textAnchor="middle"
                    className="text-xs font-medium"
                    fill={getCentsColor(detectedNote.cents)}
                  >
                    {Math.abs(detectedNote.cents) <= 5
                      ? "\u2713 In Tune"
                      : detectedNote.cents < 0
                      ? `\u266D ${Math.abs(detectedNote.cents)}\u00A2`
                      : `\u266F ${detectedNote.cents}\u00A2`}
                  </text>
                </>
              )}
            </svg>
          </div>

          {/* Cents bar */}
          {detectedNote && (
            <div className="w-full max-w-xs flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">-50</span>
              <div className="flex-1 h-3 rounded-full bg-[var(--bg-secondary)] relative overflow-hidden">
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-[var(--border-medium)]" />
                <div
                  className="absolute top-0.5 w-3 h-2 rounded-full transition-all duration-100"
                  style={{
                    left: `${Math.max(0, Math.min(100, 50 + detectedNote.cents))}%`,
                    transform: "translateX(-50%)",
                    backgroundColor: getCentsColor(detectedNote.cents),
                  }}
                />
              </div>
              <span className="text-xs text-[var(--text-muted)]">+50</span>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════
          RANGE TRAINER VIEW  — 3-octave bansuri grid
          ════════════════════════════════════════════════ */}
      {view === "range" && (
        <div className="w-full max-w-2xl flex flex-col gap-5">

          {/* Progress header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {masteredCount} / {TOTAL_NOTES} notes played this session
              </span>
              <div className="w-52 h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(masteredCount / TOTAL_NOTES) * 100}%`,
                    backgroundColor:
                      masteredCount === TOTAL_NOTES
                        ? "var(--accent-success)"
                        : "var(--accent-primary)",
                  }}
                />
              </div>
            </div>
            <button
              onClick={resetMastery}
              className="shrink-0 px-3 py-1.5 text-xs rounded-lg border border-[var(--border-medium)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Full-range celebration */}
          {masteredCount === TOTAL_NOTES && (
            <div className="text-center py-3 px-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
              🎉 Full range achieved! You have played all {TOTAL_NOTES} notes across all three octaves.
            </div>
          )}

          {/* One row per octave */}
          {BANSURI_OCTAVES.map((octave) => {
            const octaveMastered = octave.notes.filter((n) => masteredNotes.has(n.semitone)).length;

            return (
              <div key={octave.id} className="flex flex-col gap-2">
                {/* Octave label */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {octave.name}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{octave.subtitle}</span>
                  </div>
                  <span className="text-xs tabular-nums text-[var(--text-muted)]">
                    {octaveMastered}/{octave.notes.length}
                  </span>
                </div>

                {/* Note cells */}
                <div className="flex flex-wrap gap-2">
                  {octave.notes.map((note) => {
                    const isHit       = masteredNotes.has(note.semitone);
                    const isCandidate = hitCandidateSemitone === note.semitone;
                    const isDetecting = !isCandidate && activeSemitone === note.semitone;

                    // Sustain progress: how many consecutive frames so far (0-HIT_FRAMES)
                    const sustainCount =
                      isCandidate && sustainRef.current?.semitone === note.semitone
                        ? Math.min(HIT_FRAMES, sustainRef.current.count)
                        : 0;
                    const sustainPct = (sustainCount / HIT_FRAMES) * 100;

                    return (
                      <div
                        key={note.semitone}
                        className={[
                          "relative flex flex-col items-center justify-center",
                          "rounded-xl select-none transition-all duration-150 overflow-hidden",
                          note.komal ? "w-10 h-10" : "w-12 h-12",
                          isHit
                            ? "bg-green-500 text-white shadow-md"
                            : isCandidate
                            ? "text-white shadow-md scale-105"
                            : isDetecting
                            ? "border-2 border-[var(--accent-primary)] bg-[var(--bg-card)] text-[var(--text-primary)]"
                            : note.komal
                            ? "bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-light)] opacity-80"
                            : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-light)]",
                        ].join(" ")}
                        style={
                          isCandidate && !isHit
                            ? { backgroundColor: "var(--accent-warm)" }
                            : undefined
                        }
                      >
                        {/* Sustain fill — grows from bottom while holding the note */}
                        {isCandidate && !isHit && (
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-white/20 transition-none"
                            style={{ height: `${sustainPct}%` }}
                          />
                        )}

                        {/* Note label */}
                        <span
                          className={[
                            "relative z-10 font-semibold leading-tight text-center",
                            note.komal ? "text-[0.6rem]" : "text-[0.7rem]",
                          ].join(" ")}
                        >
                          {note.display}
                        </span>

                        {/* Sub-label */}
                        {isHit && (
                          <span className="relative z-10 text-[0.5rem] opacity-90">✓</span>
                        )}
                        {!isHit && note.komal && !isCandidate && !isDetecting && (
                          <span className="relative z-10 text-[0.45rem] opacity-40 leading-none italic">
                            komal
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2 border-t border-[var(--border-light)]">
            {[
              { bg: "bg-[var(--bg-secondary)] border border-[var(--border-light)]", label: "Not yet played" },
              { bg: "border-2 border-[var(--accent-primary)] bg-[var(--bg-card)]",  label: "Detecting (±30¢)" },
              { bg: "bg-[var(--accent-warm)]",                                      label: "In range — hold ~250 ms" },
              { bg: "bg-green-500",                                                  label: "Played ✓" },
            ].map(({ bg, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <div className={`w-3.5 h-3.5 rounded ${bg}`} />
                {label}
              </div>
            ))}
          </div>

          {/* Instruction text when mic is off */}
          {!isListening && (
            <p className="text-sm text-center text-[var(--text-muted)] leading-relaxed">
              Start the tuner and play each note of your bansuri across all three octaves.<br />
              Hold each note steadily for ~250 ms within ±15¢ to mark it as played.
            </p>
          )}

          {/* Live mini-tuner bar while listening */}
          {isListening && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-light)]">
              <span className="text-base font-bold text-[var(--text-primary)] w-12 shrink-0">
                {detectedNote ? detectedNote.sargam : "\u2013"}
              </span>
              <div className="flex-1 flex flex-col gap-1">
                <div className="w-full h-2 rounded-full bg-[var(--bg-card)] relative overflow-hidden">
                  <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-[var(--border-medium)]" />
                  {detectedNote && (
                    <div
                      className="absolute top-0 h-2 w-2.5 rounded-full transition-all duration-75"
                      style={{
                        left: `${Math.max(0, Math.min(100, 50 + detectedNote.cents))}%`,
                        transform: "translateX(-50%)",
                        backgroundColor: getCentsColor(detectedNote.cents),
                      }}
                    />
                  )}
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {detectedNote
                    ? `${detectedNote.detectedFreq.toFixed(1)} Hz \u00B7 ${
                        Math.abs(detectedNote.cents) <= 5
                          ? "\u2713 In Tune"
                          : detectedNote.cents < 0
                          ? `\u266D ${Math.abs(detectedNote.cents)}\u00A2 flat`
                          : `\u266F ${detectedNote.cents}\u00A2 sharp`
                      }`
                    : isListening
                    ? "Listening\u2026"
                    : ""}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-[var(--accent-secondary)] bg-red-50 px-4 py-2 rounded-lg">
          {error}
        </p>
      )}

      {/* Start / Stop — persists across both views */}
      <button
        onClick={isListening ? stopListening : startListening}
        className={`px-8 py-3 rounded-xl text-white font-medium text-lg shadow-lg transition-all ${
          isListening
            ? "bg-[var(--accent-secondary)] hover:opacity-90"
            : "bg-[var(--accent-primary)] hover:opacity-90"
        }`}
      >
        {isListening ? "Stop Tuner" : "Start Tuner"}
      </button>
    </div>
  );
}
