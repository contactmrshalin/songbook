"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const BASE_SCALES = [
  { label: "C", freq: 261.63 },
  { label: "C#", freq: 277.18 },
  { label: "D", freq: 293.66 },
  { label: "D#", freq: 311.13 },
  { label: "E", freq: 329.63 },
  { label: "F", freq: 349.23 },
  { label: "F#", freq: 369.99 },
  { label: "G", freq: 392.0 },
  { label: "G#", freq: 415.3 },
  { label: "A", freq: 440.0 },
  { label: "A#", freq: 466.16 },
  { label: "B", freq: 493.88 },
];

const SARGAM_NOTES = [
  { sargam: "Sa", semitones: 0 },
  { sargam: "Re\u266D", semitones: 1 },
  { sargam: "Re", semitones: 2 },
  { sargam: "Ga\u266D", semitones: 3 },
  { sargam: "Ga", semitones: 4 },
  { sargam: "Ma", semitones: 5 },
  { sargam: "Ma#", semitones: 6 },
  { sargam: "Pa", semitones: 7 },
  { sargam: "Dha\u266D", semitones: 8 },
  { sargam: "Dha", semitones: 9 },
  { sargam: "Ni\u266D", semitones: 10 },
  { sargam: "Ni", semitones: 11 },
];

const CIRCLE_NOTES = ["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni"];

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

function findClosestNote(freq: number, baseFreq: number) {
  const semitones = 12 * Math.log2(freq / baseFreq);
  let noteIndex = Math.round(semitones) % 12;
  if (noteIndex < 0) noteIndex += 12;
  const cents = Math.round((semitones - Math.round(semitones)) * 100);
  const noteInfo = SARGAM_NOTES[noteIndex];
  return { ...noteInfo, cents, detectedFreq: freq };
}

export default function TunerPage() {
  const [isListening, setIsListening] = useState(false);
  const [baseScaleIndex, setBaseScaleIndex] = useState(0);
  const [detectedNote, setDetectedNote] = useState<{
    sargam: string;
    cents: number;
    detectedFreq: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const silenceCountRef = useRef(0);
  const baseScaleIndexRef = useRef(baseScaleIndex);
  baseScaleIndexRef.current = baseScaleIndex;

  const detect = useCallback(() => {
    if (!analyserRef.current || !audioContextRef.current) return;
    const buf = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(buf);
    const freq = autoCorrelate(buf, audioContextRef.current.sampleRate);

    if (freq > 50 && freq < 2000) {
      silenceCountRef.current = 0;
      const note = findClosestNote(freq, BASE_SCALES[baseScaleIndexRef.current].freq);
      setDetectedNote(note);
    } else {
      silenceCountRef.current++;
      if (silenceCountRef.current > 20) setDetectedNote(null);
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
      analyserRef.current = analyser;
      sourceRef.current = source;
      streamRef.current = stream;

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
    analyserRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    setIsListening(false);
    setDetectedNote(null);
  }, []);

  useEffect(() => {
    return () => { stopListening(); };
  }, [stopListening]);

  const getCentsColor = (cents: number) => {
    const abs = Math.abs(cents);
    if (abs <= 5) return "var(--accent-success)";
    if (abs <= 15) return "var(--accent-warm)";
    return "var(--accent-secondary)";
  };

  const activeCircleIdx = detectedNote
    ? CIRCLE_NOTES.findIndex((n) => detectedNote.sargam.startsWith(n))
    : -1;

  return (
    <div className="flex flex-col items-center gap-6">
      <h2 className="text-2xl font-bold text-[var(--text-primary)]">Flute Tuner</h2>
      <p className="text-sm text-[var(--text-muted)]">
        Detects pitch from your microphone and shows the nearest sargam note
      </p>

      {/* Base Scale Selector */}
      <div className="flex flex-wrap items-center gap-2">
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

      {/* Circular Note Display */}
      <div className="relative w-72 h-72 sm:w-80 sm:h-80">
        <svg viewBox="0 0 300 300" className="w-full h-full">
          {/* Background circle */}
          <circle cx="150" cy="150" r="140" fill="var(--bg-secondary)" stroke="var(--border-light)" strokeWidth="2" />

          {/* Notes around the circle */}
          {CIRCLE_NOTES.map((note, idx) => {
            const angle = (idx / CIRCLE_NOTES.length) * 2 * Math.PI - Math.PI / 2;
            const r = 110;
            const x = 150 + Math.cos(angle) * r;
            const y = 150 + Math.sin(angle) * r;
            const isActive = idx === activeCircleIdx;

            return (
              <g key={note}>
                <circle
                  cx={x}
                  cy={y}
                  r={22}
                  fill={isActive ? "var(--accent-primary)" : "var(--bg-card)"}
                  stroke={isActive ? "var(--accent-primary)" : "var(--border-medium)"}
                  strokeWidth="2"
                  style={{ transition: "all 0.15s ease" }}
                />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="text-sm font-bold"
                  fill={isActive ? "white" : "var(--text-secondary)"}
                  style={{ transition: "all 0.15s ease" }}
                >
                  {note}
                </text>
              </g>
            );
          })}

          {/* Center display */}
          <text x="150" y={detectedNote ? "140" : "155"} textAnchor="middle" dominantBaseline="central" className="text-2xl font-bold" fill="var(--text-primary)">
            {detectedNote ? detectedNote.sargam : isListening ? "Listening..." : "Tap Start"}
          </text>
          {detectedNote && (
            <>
              <text x="150" y="165" textAnchor="middle" className="text-xs" fill="var(--text-muted)">
                {detectedNote.detectedFreq.toFixed(1)} Hz
              </text>
              <text x="150" y="185" textAnchor="middle" className="text-xs font-medium" fill={getCentsColor(detectedNote.cents)}>
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

      {/* Cents Bar */}
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

      {error && (
        <p className="text-sm text-[var(--accent-secondary)] bg-red-50 px-4 py-2 rounded-lg">{error}</p>
      )}

      {/* Start/Stop Button */}
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
