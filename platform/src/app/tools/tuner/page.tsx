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
  { sargam: "Sa",        semitones: 0  },
  { sargam: "Re\u266D",  semitones: 1  },
  { sargam: "Re",        semitones: 2  },
  { sargam: "Ga\u266D",  semitones: 3  },
  { sargam: "Ga",        semitones: 4  },
  { sargam: "Ma",        semitones: 5  },
  { sargam: "Ma#",       semitones: 6  },
  { sargam: "Pa",        semitones: 7  },
  { sargam: "Dha\u266D", semitones: 8  },
  { sargam: "Dha",       semitones: 9  },
  { sargam: "Ni\u266D",  semitones: 10 },
  { sargam: "Ni",        semitones: 11 },
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
      { sargam: "Pa",        display: "Pa",        semitone: -5, komal: false },
      { sargam: "Dha\u266D", display: "Dha\u266D", semitone: -4, komal: true  },
      { sargam: "Dha",       display: "Dha",       semitone: -3, komal: false },
      { sargam: "Ni\u266D",  display: "Ni\u266D",  semitone: -2, komal: true  },
      { sargam: "Ni",        display: "Ni",        semitone: -1, komal: false },
    ],
  },
  {
    id: "madhya",
    name: "Madhya Saptak",
    subtitle: "Middle Octave  (primary register)",
    notes: [
      { sargam: "Sa",        display: "Sa",        semitone: 0,  komal: false },
      { sargam: "Re\u266D",  display: "Re\u266D",  semitone: 1,  komal: true  },
      { sargam: "Re",        display: "Re",        semitone: 2,  komal: false },
      { sargam: "Ga\u266D",  display: "Ga\u266D",  semitone: 3,  komal: true  },
      { sargam: "Ga",        display: "Ga",        semitone: 4,  komal: false },
      { sargam: "Ma",        display: "Ma",        semitone: 5,  komal: false },
      { sargam: "Ma#",       display: "Ma#",       semitone: 6,  komal: true  },
      { sargam: "Pa",        display: "Pa",        semitone: 7,  komal: false },
      { sargam: "Dha\u266D", display: "Dha\u266D", semitone: 8,  komal: true  },
      { sargam: "Dha",       display: "Dha",       semitone: 9,  komal: false },
      { sargam: "Ni\u266D",  display: "Ni\u266D",  semitone: 10, komal: true  },
      { sargam: "Ni",        display: "Ni",        semitone: 11, komal: false },
    ],
  },
  {
    id: "taar",
    name: "Taar Saptak",
    subtitle: "Higher Octave  (high-pressure register)",
    notes: [
      { sargam: "Sa\u02D9",        display: "Sa\u02D9",        semitone: 12, komal: false },
      { sargam: "Re\u266D\u02D9",  display: "Re\u266D\u02D9",  semitone: 13, komal: true  },
      { sargam: "Re\u02D9",        display: "Re\u02D9",        semitone: 14, komal: false },
      { sargam: "Ga\u266D\u02D9",  display: "Ga\u266D\u02D9",  semitone: 15, komal: true  },
      { sargam: "Ga\u02D9",        display: "Ga\u02D9",        semitone: 16, komal: false },
      { sargam: "Ma\u02D9",        display: "Ma\u02D9",        semitone: 17, komal: false },
      { sargam: "Ma#\u02D9",       display: "Ma#\u02D9",       semitone: 18, komal: true  },
      { sargam: "Pa\u02D9",        display: "Pa\u02D9",        semitone: 19, komal: false },
    ],
  },
] as const;

const TOTAL_NOTES = BANSURI_OCTAVES.reduce((s, o) => s + o.notes.length, 0); // 25

/**
 * 6-hole fingering for each absolute semitone. 1=closed, 0.5=half, 0=open.
 * Convention (as played):
 *   Holes 1-3 (left hand, nearest blow hole): close for Sa → Ga descending
 *   Holes 4-6 (right hand, nearest bell):     close for Pa → Ni ascending
 *   Ma# (tivra, semitone 6) = all open — the pivot between both hands
 *
 *   Sa:  [1,1,1, 0,0,0]   3 left closed
 *   Re:  [1,1,0, 0,0,0]   2 left closed
 *   Ga:  [1,0,0, 0,0,0]   1 left closed
 *   Ma#: [0,0,0, 0,0,0]   all open
 *   Pa:  [0,0,0, 0,0,1]   1 right closed
 *   Dha: [0,0,0, 0,1,1]   2 right closed
 *   Ni:  [0,0,0, 1,1,1]   3 right closed
 *
 * Komal (flat) notes use a half-hole (0.5) on the hole being opened/closed
 * to produce the intermediate pitch.
 * Mandra / Taar use the same fingering as Madhya — air pressure changes octave.
 * TODO: dedupe with FingeringDiagram.tsx once extracted to a shared lib.
 */
const SEMITONE_TO_FINGERING: Record<number, number[]> = {
  // Mandra Saptak (lighter breath, same fingerings as Madhya)
  [-5]: [0, 0, 0, 0, 0, 1],      // Pa
  [-4]: [0, 0, 0, 0, 0.5, 1],    // Dha♭  (half-close hole 5)
  [-3]: [0, 0, 0, 0, 1, 1],      // Dha
  [-2]: [0, 0, 0, 0.5, 1, 1],    // Ni♭   (half-close hole 4)
  [-1]: [0, 0, 0, 1, 1, 1],      // Ni
  // Madhya Saptak
  [0]:  [1, 1, 1, 0, 0, 0],      // Sa    — 3 left closed
  [1]:  [1, 1, 0.5, 0, 0, 0],    // Re♭   (half-close hole 3)
  [2]:  [1, 1, 0, 0, 0, 0],      // Re    — 2 left closed
  [3]:  [1, 0.5, 0, 0, 0, 0],    // Ga♭   (half-close hole 2)
  [4]:  [1, 0, 0, 0, 0, 0],      // Ga    — 1 left closed
  [5]:  [0, 0, 0, 1, 1, 0],      // Ma    (shuddha — cross fingering)
  [6]:  [0, 0, 0, 0, 0, 0],      // Ma#   — all open (pivot)
  [7]:  [0, 0, 0, 0, 0, 1],      // Pa    — 1 right closed
  [8]:  [0, 0, 0, 0, 0.5, 1],    // Dha♭  (half-close hole 5)
  [9]:  [0, 0, 0, 0, 1, 1],      // Dha   — 2 right closed
  [10]: [0, 0, 0, 0.5, 1, 1],    // Ni♭   (half-close hole 4)
  [11]: [0, 0, 0, 1, 1, 1],      // Ni    — 3 right closed
  // Taar Saptak (harder breath, same fingerings as Madhya)
  [12]: [1, 1, 1, 0, 0, 0],      // Sa˙
  [13]: [1, 1, 0.5, 0, 0, 0],    // Re♭˙
  [14]: [1, 1, 0, 0, 0, 0],      // Re˙
  [15]: [1, 0.5, 0, 0, 0, 0],    // Ga♭˙
  [16]: [1, 0, 0, 0, 0, 0],      // Ga˙
  [17]: [0, 0, 0, 1, 1, 0],      // Ma˙
  [18]: [0, 0, 0, 0, 0, 0],      // Ma#˙
  [19]: [0, 0, 0, 0, 0, 1],      // Pa˙
};

/**
 * X-coordinates of the 6 finger holes in the bansuri SVG (viewBox "0 0 660 80").
 * Holes 1-3 = left hand, 4-6 = right hand, ~84px gap between hands.
 */
const BANSURI_HOLE_X = [180, 248, 316, 400, 468, 536] as const;

/**
 * Hold-duration options for long note practice.
 * Frames = ms / 16.67 (≈ 60 fps RAF loop).
 */
const HOLD_OPTIONS = [
  { label: "250 ms", ms: 250  },
  { label: "2 s",    ms: 2000 },
  { label: "3 s",    ms: 3000 },
  { label: "5 s",    ms: 5000 },
] as const;
type HoldMs = (typeof HOLD_OPTIONS)[number]["ms"];

/** Duration of the Sa calibration window in milliseconds. */
const CALIBRATION_DURATION_MS = 10000;

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

/**
 * Describes a detected Sa frequency relative to equal-temperament chromatic notes.
 * Returns the nearest note name and how many cents the instrument deviates from it.
 */
function describeCalibration(saFreq: number): { label: string; cents: number } {
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  // C4 = 261.63 Hz as reference
  const semitones = 12 * Math.log2(saFreq / 261.63);
  const rounded   = Math.round(semitones);
  const noteIndex = ((rounded % 12) + 12) % 12;
  const cents     = Math.round((semitones - rounded) * 100);
  return { label: noteNames[noteIndex], cents };
}

// ── Types ─────────────────────────────────────────────────────────────────────

type View            = "tuner" | "range";
type RangeStyle      = "grid" | "bansuri";
type CalibrationPhase = "idle" | "sampling" | "done";

type DetectedNote = {
  sargam: string;
  cents: number;
  detectedFreq: number;
  absoluteSemitone: number;
};

// ── Octave design tokens ──────────────────────────────────────────────────────

const OCTAVE_THEME = {
  mandra: {
    accent:    "#818CF8",   // indigo-400
    glow:      "rgba(129, 140, 248, 0.35)",
    bg:        "rgba(129, 140, 248, 0.07)",
    border:    "rgba(129, 140, 248, 0.4)",
    dotActive: "#818CF8",
  },
  madhya: {
    accent:    "#FBBF24",   // amber-400
    glow:      "rgba(251, 191, 36, 0.35)",
    bg:        "rgba(251, 191, 36, 0.07)",
    border:    "rgba(251, 191, 36, 0.4)",
    dotActive: "#FBBF24",
  },
  taar: {
    accent:    "#F472B6",   // pink-400
    glow:      "rgba(244, 114, 182, 0.35)",
    bg:        "rgba(244, 114, 182, 0.07)",
    border:    "rgba(244, 114, 182, 0.4)",
    dotActive: "#F472B6",
  },
} as const;

type OctaveId = keyof typeof OCTAVE_THEME;

// ── Component ─────────────────────────────────────────────────────────────────

export default function TunerPage() {
  const [view, setView]                     = useState<View>("tuner");
  const [rangeStyle, setRangeStyle]         = useState<RangeStyle>("grid");
  const [isListening, setIsListening]       = useState(false);
  const [baseScaleIndex, setBaseScaleIndex] = useState(0);
  const [detectedNote, setDetectedNote]     = useState<DetectedNote | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [masteredNotes, setMasteredNotes]   = useState<Set<number>>(new Set());

  // Long note hold duration
  const [holdMs, setHoldMs] = useState<HoldMs>(250);

  // Bansuri calibration
  const [calibrationPhase, setCalibrationPhase] = useState<CalibrationPhase>("idle");
  const [calibratedSaFreq, setCalibratedSaFreq] = useState<number | null>(null);
  const [calibrationProgress, setCalibrationProgress] = useState(0);

  const audioContextRef    = useRef<AudioContext | null>(null);
  const analyserRef        = useRef<AnalyserNode | null>(null);
  const sourceRef          = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef          = useRef<MediaStream | null>(null);
  const rafRef             = useRef<number>(0);
  const silenceCountRef    = useRef(0);
  const baseScaleIndexRef  = useRef(baseScaleIndex);
  baseScaleIndexRef.current = baseScaleIndex;

  // Range trainer: sustain tracking — requires N consecutive frames in-tune
  const sustainRef  = useRef<{ semitone: number; count: number } | null>(null);
  const masteredRef = useRef<Set<number>>(new Set());

  // Calibration refs — mirror state into refs so detect() (RAF) stays current
  const isListeningRef          = useRef(false);
  isListeningRef.current        = isListening;
  const calibrationPhaseRef     = useRef<CalibrationPhase>("idle");
  calibrationPhaseRef.current   = calibrationPhase;
  const calibrationSamplesRef   = useRef<number[]>([]);
  const calibrationTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Effective base frequency: calibrated Sa if available, otherwise preset scale
  const effectiveBaseFreqRef    = useRef(BASE_SCALES[baseScaleIndex].freq);
  effectiveBaseFreqRef.current  = calibratedSaFreq ?? BASE_SCALES[baseScaleIndex].freq;

  // Required consecutive in-tune frames for the current hold duration
  const hitFramesRef    = useRef(Math.round(holdMs / (1000 / 60)));
  hitFramesRef.current  = Math.round(holdMs / (1000 / 60));

  const detect = useCallback(() => {
    if (!analyserRef.current || !audioContextRef.current) return;

    const buf = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(buf);
    const freq = autoCorrelate(buf, audioContextRef.current.sampleRate);

    if (freq > 50 && freq < 2000) {
      silenceCountRef.current = 0;

      // During calibration: collect raw frequency samples for the Sa median
      if (calibrationPhaseRef.current === "sampling") {
        calibrationSamplesRef.current.push(freq);
      }

      const note = findClosestNote(freq, effectiveBaseFreqRef.current);
      setDetectedNote(note);

      // Range trainer: mark note as "played" after hitFramesRef.current consecutive
      // frames within ±15¢ of the same semitone.
      if (Math.abs(note.cents) <= 15) {
        if (sustainRef.current?.semitone === note.absoluteSemitone) {
          sustainRef.current.count++;
          if (
            sustainRef.current.count >= hitFramesRef.current &&
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
      const ctx     = new AudioContext({ sampleRate: 44100 });
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      const source  = ctx.createMediaStreamSource(stream);
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
    // Cancel any in-progress calibration
    if (calibrationTimerRef.current) {
      clearTimeout(calibrationTimerRef.current);
      calibrationTimerRef.current = null;
    }
    setIsListening(false);
    setDetectedNote(null);
    sustainRef.current = null;
    if (calibrationPhaseRef.current === "sampling") {
      calibrationPhaseRef.current = "idle";
      setCalibrationPhase("idle");
    }
  }, []);

  const resetMastery = useCallback(() => {
    masteredRef.current = new Set();
    setMasteredNotes(new Set());
    sustainRef.current  = null;
  }, []);

  /**
   * Starts a 10-second window to collect the user's Sa frequency.
   * Automatically starts the tuner if it isn't already running.
   */
  const startCalibration = useCallback(async () => {
    calibrationSamplesRef.current = [];
    if (calibrationTimerRef.current) {
      clearTimeout(calibrationTimerRef.current);
    }

    if (!isListeningRef.current) {
      await startListening();
    }

    calibrationPhaseRef.current = "sampling";
    setCalibrationPhase("sampling");

    calibrationTimerRef.current = setTimeout(() => {
      const samples = calibrationSamplesRef.current;
      if (samples.length > 5) {
        // Use the median for robustness against outlier frames
        const sorted = [...samples].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        setCalibratedSaFreq(median);
      }
      calibrationPhaseRef.current = "done";
      setCalibrationPhase("done");
    }, CALIBRATION_DURATION_MS);
  }, [startListening]);

  const clearCalibration = useCallback(() => {
    if (calibrationTimerRef.current) {
      clearTimeout(calibrationTimerRef.current);
      calibrationTimerRef.current = null;
    }
    setCalibratedSaFreq(null);
    calibrationPhaseRef.current = "idle";
    setCalibrationPhase("idle");
    resetMastery();
  }, [resetMastery]);

  // Animate the calibration progress bar using setInterval
  useEffect(() => {
    if (calibrationPhase !== "sampling") {
      setCalibrationProgress(calibrationPhase === "done" ? 1 : 0);
      return;
    }
    setCalibrationProgress(0);
    const start    = Date.now();
    const interval = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / CALIBRATION_DURATION_MS);
      setCalibrationProgress(p);
      if (p >= 1) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [calibrationPhase]);

  // When the user changes the preset key, the calibration is for a different
  // instrument pitch so discard it and let them recalibrate.
  useEffect(() => {
    clearCalibration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseScaleIndex]);

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

  // ── Bansuri view derived values ─────────────────────────────────────────────

  const activeFingering =
    activeSemitone !== null ? (SEMITONE_TO_FINGERING[activeSemitone] ?? null) : null;
  const displayFingering = activeFingering ?? [0, 0, 0, 0, 0, 0];

  const hitFramesRequired = Math.round(holdMs / (1000 / 60));

  const sustainFraction =
    hitCandidateSemitone !== null &&
    sustainRef.current?.semitone === hitCandidateSemitone
      ? Math.min(1, sustainRef.current.count / hitFramesRequired)
      : 0;

  const masteredActive  = activeSemitone !== null && masteredNotes.has(activeSemitone);
  const candidateActive = hitCandidateSemitone !== null;

  const tubeGlowColor   = masteredActive ? "#22C55E" : candidateActive ? "#F5A623" : null;
  const tubeGlowOpacity = masteredActive
    ? 0.45
    : candidateActive
    ? 0.15 + sustainFraction * 0.55
    : 0;

  const currentOctaveName =
    activeSemitone !== null
      ? activeSemitone < 0
        ? "Mandra Saptak"
        : activeSemitone < 12
        ? "Madhya Saptak"
        : "Taar Saptak"
      : "";

  // ── Calibration result summary ──────────────────────────────────────────────

  const calibDesc = calibratedSaFreq ? describeCalibration(calibratedSaFreq) : null;
  const calibAbsCents = calibDesc ? Math.abs(calibDesc.cents) : 0;
  const calibQuality  = calibAbsCents <= 10 ? "well-tuned"
    : calibAbsCents <= 25 ? "slightly off"
    : "notably off";
  const calibQualityColor = calibAbsCents <= 10 ? "#22C55E"
    : calibAbsCents <= 25 ? "#F5A623"
    : "#EF4444";

  // Helper: octave theme for a given semitone
  const octaveThemeFor = (semitone: number) =>
    semitone < 0
      ? OCTAVE_THEME.mandra
      : semitone < 12
      ? OCTAVE_THEME.madhya
      : OCTAVE_THEME.taar;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-6 pb-8">

      {/* ── Header ── */}
      <div className="text-center">
        <h2
          className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent"
          style={{ backgroundImage: "linear-gradient(135deg, #6C63FF 0%, #FF6584 100%)" }}
        >
          Bansuri Studio
        </h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 tracking-widest uppercase">
          Pitch &middot; Tune &middot; Master
        </p>
      </div>

      {/* ── View toggle ── */}
      <div
        className="flex p-1 rounded-2xl border border-[var(--border-light)] shadow-sm"
        style={{ background: "var(--bg-secondary)" }}
      >
        {(["tuner", "range"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
            style={
              view === v
                ? {
                    background: "white",
                    color: "#6C63FF",
                    boxShadow: "0 2px 8px rgba(108,99,255,0.18)",
                  }
                : { color: "var(--text-muted)" }
            }
          >
            {v === "tuner" ? "🎵 Tuner" : "🎯 Range Trainer"}
          </button>
        ))}
      </div>

      {/* ── Sa selector ── */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs font-bold tracking-wider uppercase text-[var(--text-muted)]">
          Sa =
        </span>
        {BASE_SCALES.map((scale, idx) => (
          <button
            key={scale.label}
            onClick={() => setBaseScaleIndex(idx)}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150"
            style={
              idx === baseScaleIndex
                ? {
                    background: "linear-gradient(135deg, #6C63FF, #9B59B6)",
                    color: "white",
                    boxShadow: "0 3px 10px rgba(108,99,255,0.35)",
                  }
                : {
                    background: "var(--bg-secondary)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-light)",
                  }
            }
          >
            {scale.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════
          TUNER VIEW
          ════════════════════════════════════════════════ */}
      {view === "tuner" && (
        <>
          {/* Dark tuner orb */}
          <div
            className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-full flex items-center justify-center"
            style={{
              background: "radial-gradient(circle at 38% 32%, #1E1B4B 0%, #0C0A1A 100%)",
              boxShadow: detectedNote
                ? `0 0 40px 6px ${getCentsColor(detectedNote.cents)}40, 0 8px 40px rgba(0,0,0,0.45)`
                : "0 8px 40px rgba(0,0,0,0.35)",
              transition: "box-shadow 0.3s ease",
            }}
          >
            <svg viewBox="0 0 300 300" className="w-full h-full absolute inset-0">
              {/* Outer decorative ring */}
              <circle
                cx="150" cy="150" r="141"
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
              />
              <circle
                cx="150" cy="150" r="134"
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
              />

              {/* Accuracy ring — glows based on cents */}
              {detectedNote && (
                <circle
                  cx="150" cy="150" r="138"
                  fill="none"
                  stroke={getCentsColor(detectedNote.cents)}
                  strokeWidth="2.5"
                  opacity="0.7"
                  style={{
                    filter: `drop-shadow(0 0 7px ${getCentsColor(detectedNote.cents)})`,
                    transition: "stroke 0.2s ease, filter 0.2s ease",
                  }}
                />
              )}

              {/* Note dots around the ring */}
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
                      fill={isActive ? "#6C63FF" : "rgba(255,255,255,0.05)"}
                      stroke={isActive ? "#9B8EFF" : "rgba(255,255,255,0.1)"}
                      strokeWidth="1.5"
                      style={{
                        transition: "all 0.15s ease",
                        filter: isActive ? "drop-shadow(0 0 8px #6C63FF)" : "none",
                      }}
                    />
                    <text
                      x={x} y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="11"
                      fontWeight="700"
                      fill={isActive ? "white" : "rgba(255,255,255,0.38)"}
                      style={{ transition: "all 0.15s ease" }}
                    >
                      {note}
                    </text>
                  </g>
                );
              })}

              {/* Centre: note name */}
              <text
                x="150"
                y={detectedNote ? "135" : "155"}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={detectedNote ? "42" : "18"}
                fontWeight="800"
                fill={
                  detectedNote
                    ? getCentsColor(detectedNote.cents)
                    : "rgba(255,255,255,0.25)"
                }
                style={{
                  transition: "fill 0.2s ease, font-size 0.2s ease",
                  filter: detectedNote
                    ? `drop-shadow(0 0 12px ${getCentsColor(detectedNote.cents)})`
                    : "none",
                }}
              >
                {detectedNote
                  ? detectedNote.sargam
                  : isListening
                  ? "~"
                  : "\u266A"}
              </text>

              {!detectedNote && (
                <text
                  x="150" y="178"
                  textAnchor="middle"
                  fontSize="11"
                  fill="rgba(255,255,255,0.25)"
                >
                  {isListening ? "Listening\u2026" : "Tap Start"}
                </text>
              )}

              {detectedNote && (
                <>
                  <text
                    x="150" y="164"
                    textAnchor="middle"
                    fontSize="11"
                    fill="rgba(255,255,255,0.45)"
                  >
                    {detectedNote.detectedFreq.toFixed(1)} Hz
                  </text>
                  <text
                    x="150" y="183"
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="700"
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

          {/* Cents deviation bar */}
          {detectedNote && (
            <div className="w-full max-w-xs flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-[var(--text-muted)] w-6 text-right">-50</span>
                <div
                  className="flex-1 h-3 rounded-full relative overflow-hidden"
                  style={{
                    background: "var(--bg-secondary)",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.12)",
                  }}
                >
                  {/* ±5¢ safe zone */}
                  <div
                    className="absolute inset-y-0 rounded-full"
                    style={{
                      left: "calc(50% - 5%)",
                      width: "10%",
                      background: "rgba(39,174,96,0.18)",
                    }}
                  />
                  {/* Centre tick */}
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[var(--border-medium)]" />
                  {/* Glowing indicator dot */}
                  <div
                    className="absolute top-0.5 w-2 h-2 rounded-full transition-all duration-100"
                    style={{
                      left: `${Math.max(2, Math.min(96, 50 + detectedNote.cents))}%`,
                      transform: "translateX(-50%)",
                      backgroundColor: getCentsColor(detectedNote.cents),
                      boxShadow: `0 0 8px 2px ${getCentsColor(detectedNote.cents)}`,
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-[var(--text-muted)] w-6">+50</span>
              </div>
              <p className="text-center text-[0.7rem] text-[var(--text-muted)]">
                cents deviation from target
              </p>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════
          RANGE TRAINER VIEW
          ════════════════════════════════════════════════ */}
      {view === "range" && (
        <div className="w-full max-w-2xl flex flex-col gap-5">

          {/* ── Calibration card ── */}
          <div
            className="rounded-2xl p-4 shadow-sm"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-light)",
              borderLeft: "4px solid #6C63FF",
            }}
          >
            {/* idle */}
            {calibrationPhase === "idle" && (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)] mb-1">
                    🎋 Calibrate to your bansuri
                  </p>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-sm">
                    Play your <strong>Sa</strong> note for 10 s to detect your instrument&apos;s
                    actual tuning. Mastery tracking will be relative to your bansuri — not
                    equal temperament — so technique is assessed regardless of how the
                    instrument is tuned.
                  </p>
                </div>
                <button
                  onClick={startCalibration}
                  className="shrink-0 px-4 py-2 text-xs font-bold rounded-xl text-white whitespace-nowrap transition-opacity hover:opacity-90"
                  style={{
                    background: "linear-gradient(135deg, #6C63FF, #9B59B6)",
                    boxShadow: "0 3px 10px rgba(108,99,255,0.3)",
                  }}
                >
                  {isListening ? "Calibrate Sa" : "Start \u0026 Calibrate"}
                </button>
              </div>
            )}

            {/* sampling */}
            {calibrationPhase === "sampling" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {"Hold your "}
                    <strong style={{ color: "#6C63FF" }}>Sa</strong>
                    {" note steadily\u2026"}
                  </p>
                  <span className="text-xs tabular-nums text-[var(--text-muted)]">
                    {detectedNote
                      ? `${detectedNote.detectedFreq.toFixed(1)} Hz`
                      : "Listening\u2026"}
                  </span>
                </div>
                <div
                  className="h-2.5 rounded-full overflow-hidden"
                  style={{ background: "var(--bg-secondary)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${calibrationProgress * 100}%`,
                      background: "linear-gradient(90deg, #6C63FF, #FF6584)",
                      transition: "width 50ms linear",
                      boxShadow: "0 0 8px rgba(108,99,255,0.5)",
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>
                    {Math.round(calibrationProgress * CALIBRATION_DURATION_MS / 1000)}s / 10s
                  </span>
                  <button
                    onClick={clearCalibration}
                    className="hover:text-[var(--text-secondary)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* done + result */}
            {calibrationPhase === "done" && calibDesc && calibratedSaFreq && (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      {"Sa \u2192 "}
                      {calibratedSaFreq.toFixed(1)} Hz
                    </span>
                    <span
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${calibQualityColor}20`,
                        color: calibQualityColor,
                        border: `1px solid ${calibQualityColor}40`,
                      }}
                    >
                      {calibDesc.label}
                      {calibDesc.cents > 0
                        ? ` +${calibDesc.cents}\u00A2`
                        : calibDesc.cents < 0
                        ? ` ${calibDesc.cents}\u00A2`
                        : " \u2713"}
                    </span>
                    <span
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${calibQualityColor}20`,
                        color: calibQualityColor,
                        border: `1px solid ${calibQualityColor}40`,
                      }}
                    >
                      {calibQuality}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-sm">
                    {calibAbsCents <= 10
                      ? "Bansuri is close to equal temperament."
                      : `Bansuri is ${calibAbsCents}\u00A2 ${calibDesc.cents > 0 ? "sharp" : "flat"} of ${calibDesc.label} \u2014 a real-instrument offset.`}
                    {" "}Mastery and cents accuracy are now relative to your instrument&apos;s Sa.
                  </p>
                </div>
                <button
                  onClick={clearCalibration}
                  className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors hover:bg-[var(--bg-secondary)]"
                  style={{
                    border: "1px solid var(--border-medium)",
                    color: "var(--text-muted)",
                  }}
                >
                  Recalibrate
                </button>
              </div>
            )}

            {/* done but no samples */}
            {calibrationPhase === "done" && !calibratedSaFreq && (
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-[var(--text-muted)]">
                  No pitch detected during calibration. Make sure the tuner is on and play
                  your Sa clearly.
                </p>
                <button
                  onClick={startCalibration}
                  className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-xl text-white hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #6C63FF, #9B59B6)" }}
                >
                  Try Again
                </button>
              </div>
            )}
          </div>

          {/* ── Progress header ── */}
          <div
            className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-light)",
            }}
          >
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-[var(--text-primary)]">
                {masteredCount} / {TOTAL_NOTES}
                <span className="font-normal text-[var(--text-muted)] ml-1.5">
                  notes played this session
                </span>
              </span>
              <div
                className="w-52 h-2 rounded-full overflow-hidden"
                style={{ background: "var(--bg-secondary)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(masteredCount / TOTAL_NOTES) * 100}%`,
                    background:
                      masteredCount === TOTAL_NOTES
                        ? "linear-gradient(90deg, #22C55E, #16A34A)"
                        : "linear-gradient(90deg, #6C63FF, #FF6584)",
                    boxShadow:
                      masteredCount > 0
                        ? "0 0 6px rgba(108,99,255,0.4)"
                        : "none",
                  }}
                />
              </div>
            </div>
            <button
              onClick={resetMastery}
              className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors hover:bg-[var(--bg-secondary)]"
              style={{
                border: "1px solid var(--border-medium)",
                color: "var(--text-muted)",
              }}
            >
              Reset
            </button>
          </div>

          {/* ── Sub-toggle row: range style + hold duration ── */}
          <div className="flex flex-wrap items-center gap-3">
            {/* View style */}
            <div
              className="flex p-0.5 rounded-xl overflow-hidden"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-light)" }}
            >
              {(["grid", "bansuri"] as RangeStyle[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setRangeStyle(s)}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                  style={
                    rangeStyle === s
                      ? {
                          background: "white",
                          color: "#6C63FF",
                          boxShadow: "0 1px 4px rgba(108,99,255,0.2)",
                        }
                      : { color: "var(--text-muted)" }
                  }
                >
                  {s === "grid" ? "Grid" : "\uD83C\uDF8B Bansuri"}
                </button>
              ))}
            </div>

            {/* Hold duration */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--text-muted)] whitespace-nowrap font-medium">
                Hold:
              </span>
              <div
                className="flex p-0.5 rounded-xl overflow-hidden"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-light)" }}
              >
                {HOLD_OPTIONS.map((opt) => (
                  <button
                    key={opt.ms}
                    onClick={() => { setHoldMs(opt.ms); resetMastery(); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                    style={
                      holdMs === opt.ms
                        ? {
                            background: "white",
                            color: "#6C63FF",
                            boxShadow: "0 1px 4px rgba(108,99,255,0.2)",
                          }
                        : { color: "var(--text-muted)" }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Full-range celebration */}
          {masteredCount === TOTAL_NOTES && (
            <div
              className="text-center py-3 px-4 rounded-2xl text-sm font-bold"
              style={{
                background: "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(22,163,74,0.08))",
                border: "1px solid rgba(34,197,94,0.3)",
                color: "#16A34A",
              }}
            >
              {"🎉 Full range achieved! You played all "}
              {TOTAL_NOTES}
              {" notes across all three octaves."}
            </div>
          )}

          {/* ══ GRID VIEW ══ */}
          {rangeStyle === "grid" && (
            <>
              {BANSURI_OCTAVES.map((octave) => {
                const theme = OCTAVE_THEME[octave.id as OctaveId];
                const octaveMastered = octave.notes.filter((n) => masteredNotes.has(n.semitone)).length;

                return (
                  <div
                    key={octave.id}
                    className="flex flex-col gap-2 p-3 rounded-2xl"
                    style={{
                      background: theme.bg,
                      border: `1px solid ${theme.border}`,
                      borderLeft: `4px solid ${theme.accent}`,
                    }}
                  >
                    {/* Octave label */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span
                          className="text-sm font-bold"
                          style={{ color: theme.accent }}
                        >
                          {octave.name}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] ml-2">
                          {octave.subtitle}
                        </span>
                      </div>
                      <span
                        className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-full"
                        style={{
                          background: `${theme.accent}20`,
                          color: theme.accent,
                        }}
                      >
                        {octaveMastered}/{octave.notes.length}
                      </span>
                    </div>

                    {/* Note cells */}
                    <div className="flex flex-wrap gap-2">
                      {octave.notes.map((note) => {
                        const isHit       = masteredNotes.has(note.semitone);
                        const isCandidate = hitCandidateSemitone === note.semitone;
                        const isDetecting = !isCandidate && activeSemitone === note.semitone;

                        const sustainCount =
                          isCandidate && sustainRef.current?.semitone === note.semitone
                            ? Math.min(hitFramesRequired, sustainRef.current.count)
                            : 0;
                        const sustainPct = (sustainCount / hitFramesRequired) * 100;

                        let cellStyle: React.CSSProperties = {};
                        let textColor = "var(--text-secondary)";

                        if (isHit) {
                          cellStyle = {
                            background: "linear-gradient(135deg, #22C55E, #16A34A)",
                            boxShadow: "0 2px 10px rgba(34,197,94,0.35)",
                            border: "1px solid #22C55E",
                          };
                          textColor = "white";
                        } else if (isCandidate) {
                          cellStyle = {
                            background: "linear-gradient(135deg, #F5A623, #EF4444)",
                            boxShadow: `0 2px 12px rgba(245,166,35,0.45)`,
                            border: "1px solid #F5A623",
                            transform: "scale(1.07)",
                          };
                          textColor = "white";
                        } else if (isDetecting) {
                          cellStyle = {
                            background: "var(--bg-card)",
                            border: `2px solid ${theme.accent}`,
                            boxShadow: `0 0 8px ${theme.glow}`,
                          };
                          textColor = theme.accent;
                        } else if (note.komal) {
                          cellStyle = {
                            background: "var(--bg-secondary)",
                            border: "1px solid var(--border-light)",
                            opacity: 0.75,
                          };
                          textColor = "var(--text-muted)";
                        } else {
                          cellStyle = {
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-light)",
                            borderLeft: `3px solid ${theme.accent}`,
                          };
                          textColor = "var(--text-secondary)";
                        }

                        return (
                          <div
                            key={note.semitone}
                            className={[
                              "relative flex flex-col items-center justify-center",
                              "rounded-xl select-none overflow-hidden transition-all duration-150",
                              note.komal ? "w-10 h-10" : "w-12 h-12",
                            ].join(" ")}
                            style={cellStyle}
                          >
                            {/* Sustain fill rising from bottom */}
                            {isCandidate && !isHit && (
                              <div
                                className="absolute bottom-0 left-0 right-0 transition-none"
                                style={{
                                  height: `${sustainPct}%`,
                                  background: "rgba(255,255,255,0.22)",
                                }}
                              />
                            )}

                            <span
                              className="relative z-10 font-bold leading-tight text-center"
                              style={{
                                fontSize: note.komal ? "0.6rem" : "0.7rem",
                                color: textColor,
                              }}
                            >
                              {note.display}
                            </span>

                            {isHit && (
                              <span className="relative z-10 text-[0.5rem] text-white opacity-90">
                                {"\u2713"}
                              </span>
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
              <div
                className="flex flex-wrap gap-x-4 gap-y-1.5 pt-3 border-t"
                style={{ borderColor: "var(--border-light)" }}
              >
                {[
                  {
                    style: { background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 4 } as React.CSSProperties,
                    label: "Not yet played",
                  },
                  {
                    style: { background: "var(--bg-card)", border: `2px solid #6C63FF`, borderRadius: 4, boxShadow: "0 0 5px rgba(108,99,255,0.4)" } as React.CSSProperties,
                    label: "Detecting (\u00B130\u00A2)",
                  },
                  {
                    style: { background: "linear-gradient(135deg, #F5A623, #EF4444)", borderRadius: 4 } as React.CSSProperties,
                    label: `In range \u2014 hold ${HOLD_OPTIONS.find(o => o.ms === holdMs)?.label ?? ""}`,
                  },
                  {
                    style: { background: "linear-gradient(135deg, #22C55E, #16A34A)", borderRadius: 4 } as React.CSSProperties,
                    label: "Played \u2713",
                  },
                ].map(({ style, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <div className="w-3.5 h-3.5" style={style} />
                    {label}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ══ BANSURI VIEW ══ */}
          {rangeStyle === "bansuri" && (
            <div className="flex flex-col gap-4">

              {/* Current note + octave + cents */}
              <div
                className="flex items-baseline justify-center gap-3 py-3 px-4 rounded-2xl min-h-[3.5rem]"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-light)",
                }}
              >
                {activeSemitone !== null && (
                  <div
                    className="w-1.5 h-8 rounded-full shrink-0"
                    style={{
                      background: octaveThemeFor(activeSemitone).accent,
                      boxShadow: `0 0 8px ${octaveThemeFor(activeSemitone).glow}`,
                    }}
                  />
                )}
                <span
                  className="text-4xl font-extrabold tabular-nums transition-all duration-150"
                  style={{
                    color: masteredActive
                      ? "#22C55E"
                      : candidateActive
                      ? "#F5A623"
                      : activeSemitone !== null
                      ? octaveThemeFor(activeSemitone).accent
                      : "var(--text-primary)",
                    textShadow: candidateActive
                      ? "0 0 20px rgba(245,166,35,0.5)"
                      : masteredActive
                      ? "0 0 20px rgba(34,197,94,0.5)"
                      : "none",
                  }}
                >
                  {detectedNote ? detectedNote.sargam : "\u2014"}
                </span>
                {currentOctaveName && (
                  <span className="text-sm text-[var(--text-muted)]">{currentOctaveName}</span>
                )}
                {detectedNote && (
                  <span
                    className="text-sm font-bold"
                    style={{ color: getCentsColor(detectedNote.cents) }}
                  >
                    {Math.abs(detectedNote.cents) <= 5
                      ? "\u2713 in tune"
                      : detectedNote.cents < 0
                      ? `\u266D ${Math.abs(detectedNote.cents)}\u00A2`
                      : `\u266F ${detectedNote.cents}\u00A2`}
                  </span>
                )}
              </div>

              {/* SVG Bansuri */}
              <div
                className="w-full overflow-x-auto rounded-2xl p-3"
                style={{
                  background: "linear-gradient(160deg, #0F1020 0%, #141830 100%)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  boxShadow: tubeGlowColor && tubeGlowOpacity > 0
                    ? `0 0 30px ${tubeGlowColor}${Math.round(tubeGlowOpacity * 80).toString(16).padStart(2, "0")}`
                    : "none",
                  transition: "box-shadow 0.3s ease",
                }}
              >
                <svg
                  viewBox="0 0 660 80"
                  width="100%"
                  style={{ minWidth: 320 }}
                  aria-label="Bansuri fingering diagram"
                >
                  <defs>
                    <linearGradient id="bamboo-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#E8C97A" />
                      <stop offset="40%"  stopColor="#C8953E" />
                      <stop offset="100%" stopColor="#7A4A10" />
                    </linearGradient>
                    <linearGradient id="bamboo-cap-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#7A4A10" />
                      <stop offset="100%" stopColor="#3D2008" />
                    </linearGradient>
                    <radialGradient id="hole-glow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#F5A623" stopOpacity="0.7" />
                      <stop offset="100%" stopColor="#F5A623" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Tube ambient glow — scales with sustain */}
                  {tubeGlowColor && tubeGlowOpacity > 0 && (
                    <rect
                      x={4} y={10} width={652} height={60} rx={30}
                      fill={tubeGlowColor}
                      opacity={tubeGlowOpacity * 0.55}
                      style={{ filter: `blur(4px)` }}
                    />
                  )}

                  {/* Main tube body */}
                  <rect
                    x={15} y={20} width={630} height={40} rx={20}
                    fill="url(#bamboo-grad)"
                    stroke="#5C3208"
                    strokeWidth={1.5}
                  />

                  {/* Subtle grain lines */}
                  <line x1={15} y1={36} x2={645} y2={36} stroke="rgba(0,0,0,0.08)" strokeWidth={1} />
                  <line x1={15} y1={44} x2={645} y2={44} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

                  {/* Left end cap */}
                  <rect
                    x={15} y={20} width={28} height={40} rx={14}
                    fill="url(#bamboo-cap-grad)"
                    stroke="#3D2008"
                    strokeWidth={1.5}
                  />

                  {/* Bamboo knot rings */}
                  <rect x={345} y={22} width={4} height={36} rx={2} fill="#5C3208" opacity={0.6} />
                  <rect x={578} y={22} width={4} height={36} rx={2} fill="#5C3208" opacity={0.6} />

                  {/* Blow hole */}
                  <ellipse cx={90} cy={40} rx={14} ry={10}
                    fill="#110800"
                    stroke="#7A4A10"
                    strokeWidth={1.5}
                  />
                  <text x={90} y={74} textAnchor="middle" fontSize={7.5} fill="rgba(255,255,255,0.3)">
                    blow
                  </text>

                  {/* L/R label */}
                  <text x={358} y={13} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,0.3)">
                    {"L \u00B7 R"}
                  </text>

                  {/* 6 finger holes */}
                  {BANSURI_HOLE_X.map((hx, i) => {
                    const state    = displayFingering[i];
                    const isActive = activeFingering !== null;
                    const holeClosed = state === 1;
                    const holeHalf   = state === 0.5;

                    return (
                      <g key={i}>
                        {/* Glow halo when note active */}
                        {isActive && (
                          <circle
                            cx={hx} cy={40} r={16}
                            fill="none"
                            stroke={tubeGlowColor ?? "#6C63FF"}
                            strokeWidth={2}
                            opacity={0.4 + sustainFraction * 0.4}
                            style={{ filter: `blur(2px)` }}
                          />
                        )}

                        <circle
                          cx={hx} cy={40} r={9.5}
                          fill={holeClosed ? "#0D0600" : "#F5EDD8"}
                          stroke={holeClosed ? "#3D2008" : "#8C6030"}
                          strokeWidth={1.5}
                          style={{
                            filter: isActive && holeClosed
                              ? `drop-shadow(0 0 4px ${tubeGlowColor ?? "#F5A623"})`
                              : "none",
                          }}
                        />

                        {holeHalf && (
                          <>
                            <path
                              d={`M${hx},${40 - 9.5} A9.5,9.5 0 0,0 ${hx},${40 + 9.5} Z`}
                              fill="#0D0600"
                            />
                            <circle
                              cx={hx} cy={40} r={9.5}
                              fill="none"
                              stroke="#5C3D0F"
                              strokeWidth={1.5}
                            />
                          </>
                        )}

                        <text
                          x={hx} y={74}
                          textAnchor="middle"
                          fontSize={7.5}
                          fill="rgba(255,255,255,0.28)"
                        >
                          {i + 1}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Hole state legend */}
              <div className="flex items-center justify-center gap-6 text-xs text-[var(--text-muted)]">
                {([
                  { label: "Open",   closed: false, half: false },
                  { label: "Half",   closed: false, half: true  },
                  { label: "Closed", closed: true,  half: false },
                ] as const).map(({ label, closed, half }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <svg width={14} height={14} viewBox="-7 -7 14 14">
                      <circle
                        r={5.5}
                        fill={closed ? "#0D0600" : "#F5EDD8"}
                        stroke="#5C3D0F"
                        strokeWidth={1.2}
                      />
                      {half && <path d="M0,-5.5 A5.5,5.5 0 0,0 0,5.5 Z" fill="#0D0600" />}
                    </svg>
                    {label}
                  </div>
                ))}
              </div>

              {/* Mastery dots — octave-colored */}
              <div className="flex flex-col gap-2 pt-1">
                {BANSURI_OCTAVES.map((octave) => {
                  const theme = OCTAVE_THEME[octave.id as OctaveId];
                  return (
                    <div key={octave.id} className="flex items-center gap-2">
                      <span
                        className="text-[0.6rem] font-bold w-14 shrink-0 text-right"
                        style={{ color: theme.accent }}
                      >
                        {octave.name.split(" ")[0]}
                      </span>
                      <div className="flex gap-1.5 flex-wrap">
                        {octave.notes.map((note) => {
                          const isM = masteredNotes.has(note.semitone);
                          const isA = activeSemitone === note.semitone;
                          return (
                            <div
                              key={note.semitone}
                              title={note.display}
                              className="w-3.5 h-3.5 rounded-full transition-all duration-200"
                              style={{
                                backgroundColor: isM
                                  ? "#22C55E"
                                  : isA
                                  ? theme.accent
                                  : "rgba(255,255,255,0.12)",
                                boxShadow: isM
                                  ? "0 0 5px rgba(34,197,94,0.5)"
                                  : isA
                                  ? `0 0 6px ${theme.glow}`
                                  : "none",
                                transform: isA ? "scale(1.25)" : "scale(1)",
                              }}
                            />
                          );
                        })}
                      </div>
                      <span
                        className="text-[0.6rem] font-semibold"
                        style={{ color: theme.accent }}
                      >
                        {octave.notes.filter((n) => masteredNotes.has(n.semitone)).length}
                        {"/"}
                        {octave.notes.length}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Instruction text */}
          {!isListening && (
            <p className="text-sm text-center text-[var(--text-muted)] leading-relaxed">
              Start the tuner and play each note of your bansuri across all three octaves.
              <br />
              Hold each note steadily for{" "}
              {HOLD_OPTIONS.find((o) => o.ms === holdMs)?.label} within{" "}
              {"\u00B115\u00A2"} to mark it as played.
            </p>
          )}

          {/* Live mini-tuner bar */}
          {isListening && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-light)",
              }}
            >
              <span
                className="text-base font-extrabold w-12 shrink-0"
                style={{
                  color: detectedNote
                    ? getCentsColor(detectedNote.cents)
                    : "var(--text-primary)",
                }}
              >
                {detectedNote ? detectedNote.sargam : "\u2013"}
              </span>
              <div className="flex-1 flex flex-col gap-1">
                <div
                  className="w-full h-2 rounded-full relative overflow-hidden"
                  style={{ background: "var(--bg-card)", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.08)" }}
                >
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[var(--border-medium)]" />
                  {detectedNote && (
                    <div
                      className="absolute top-0 h-2 w-2.5 rounded-full transition-all duration-75"
                      style={{
                        left: `${Math.max(0, Math.min(100, 50 + detectedNote.cents))}%`,
                        transform: "translateX(-50%)",
                        backgroundColor: getCentsColor(detectedNote.cents),
                        boxShadow: `0 0 6px ${getCentsColor(detectedNote.cents)}`,
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
        <div
          className="text-sm px-4 py-3 rounded-xl flex items-center gap-2"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            color: "#EF4444",
          }}
        >
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Start / Stop */}
      <button
        onClick={isListening ? stopListening : startListening}
        className="px-10 py-3.5 rounded-2xl text-white font-bold text-base transition-all duration-200 hover:opacity-90 active:scale-95"
        style={
          isListening
            ? {
                background: "linear-gradient(135deg, #FF6584, #EF4444)",
                boxShadow: "0 4px 20px rgba(255,101,132,0.4)",
              }
            : {
                background: "linear-gradient(135deg, #6C63FF, #9B59B6)",
                boxShadow: "0 4px 20px rgba(108,99,255,0.4)",
              }
        }
      >
        {isListening ? "⏹ Stop Tuner" : "▶ Start Tuner"}
      </button>
    </div>
  );
}
