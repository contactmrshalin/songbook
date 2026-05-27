"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const TUNINGS = [
  { label: "Pa Sa Sa Sa", key: "pa", intervals: [7, 0, 0, -12] },
  { label: "Ma Sa Sa Sa", key: "ma", intervals: [5, 0, 0, -12] },
  { label: "Ni Sa Sa Sa", key: "ni", intervals: [-1, 0, 0, -12] },
];

const PITCH_OPTIONS = [
  { label: "C", hz: 130.81 },
  { label: "C#", hz: 138.59 },
  { label: "D", hz: 146.83 },
  { label: "D#", hz: 155.56 },
  { label: "E", hz: 164.81 },
  { label: "F", hz: 174.61 },
  { label: "F#", hz: 185.0 },
  { label: "G", hz: 196.0 },
  { label: "G#", hz: 207.65 },
  { label: "A", hz: 220.0 },
  { label: "A#", hz: 233.08 },
  { label: "B", hz: 246.94 },
  { label: "C (Mid)", hz: 261.63 },
];

function createTanpuraString(ctx: AudioContext, freq: number, time: number, vol: number) {
  const dur = 4.0;
  const master = ctx.createGain();
  master.gain.setValueAtTime(vol * 0.6, time);
  master.gain.exponentialRampToValueAtTime(vol * 0.3, time + 0.8);
  master.gain.exponentialRampToValueAtTime(0.001, time + dur);
  master.connect(ctx.destination);

  const harmonics = [1, 2, 3, 4, 5, 6, 7, 8];
  const amplitudes = [1.0, 0.7, 0.45, 0.35, 0.25, 0.18, 0.12, 0.08];

  for (let i = 0; i < harmonics.length; i++) {
    const hFreq = freq * harmonics[i];
    if (hFreq > 4000) continue;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(hFreq, time);

    // Javari effect: slight frequency wobble on upper harmonics
    if (i > 1) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.5 + i * 0.3, time);
      lfoGain.gain.setValueAtTime(hFreq * 0.002, time);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(time);
      lfo.stop(time + dur);
    }

    gain.gain.setValueAtTime(amplitudes[i] * vol * 0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(time);
    osc.stop(time + dur);
  }
}

export default function TanpuraPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [tuningIndex, setTuningIndex] = useState(0);
  const [pitchIndex, setPitchIndex] = useState(9); // A = 220 Hz
  const [volume, setVolume] = useState(0.7);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentStringRef = useRef(0);

  const tuning = TUNINGS[tuningIndex];
  const pitch = PITCH_OPTIONS[pitchIndex];

  const pluckString = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const stringIdx = currentStringRef.current;
    const semitones = tuning.intervals[stringIdx];
    const freq = pitch.hz * Math.pow(2, semitones / 12);
    createTanpuraString(ctx, freq, ctx.currentTime, volume);
    currentStringRef.current = (stringIdx + 1) % 4;
  }, [tuning, pitch, volume]);

  const startTanpura = useCallback(() => {
    audioCtxRef.current = new AudioContext();
    currentStringRef.current = 0;
    pluckString();
    timerRef.current = setInterval(pluckString, 1500);
    setIsPlaying(true);
  }, [pluckString]);

  const stopTanpura = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    return () => { stopTanpura(); };
  }, [stopTanpura]);

  // Restart on tuning/pitch change while playing
  useEffect(() => {
    if (isPlaying) {
      stopTanpura();
      // Small delay before restart
      const t = setTimeout(startTanpura, 100);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuningIndex, pitchIndex]);

  return (
    <div className="flex flex-col items-center gap-8">
      <h2 className="text-2xl font-bold text-[var(--text-primary)]">Tanpura Drone</h2>
      <p className="text-sm text-[var(--text-muted)]">
        Continuous drone accompaniment for practice
      </p>

      {/* String visualization */}
      <div className="w-full max-w-sm">
        <div className="flex justify-between items-end h-32 px-4">
          {tuning.intervals.map((semitones, idx) => {
            const isActive = isPlaying && currentStringRef.current === idx;
            const note = semitones === 0 ? "Sa" : semitones === -12 ? "Sa'" : 
              ["Sa", "Re♭", "Re", "Ga♭", "Ga", "Ma", "Ma#", "Pa", "Dha♭", "Dha", "Ni♭", "Ni"][((semitones % 12) + 12) % 12];
            return (
              <div key={idx} className="flex flex-col items-center gap-2">
                <div
                  className="w-1 rounded-full transition-all duration-300"
                  style={{
                    height: `${60 + idx * 10}px`,
                    backgroundColor: isActive ? "var(--accent-primary)" : "var(--border-medium)",
                    boxShadow: isActive ? "0 0 12px var(--accent-primary)" : "none",
                  }}
                />
                <span className="text-xs text-[var(--text-muted)]">{note}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tuning Selection */}
      <div className="space-y-2 w-full max-w-sm">
        <label className="text-sm font-medium text-[var(--text-secondary)]">Tuning</label>
        <div className="flex gap-2">
          {TUNINGS.map((t, idx) => (
            <button
              key={t.key}
              onClick={() => setTuningIndex(idx)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                idx === tuningIndex
                  ? "bg-[var(--accent-primary)] text-white shadow-md"
                  : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border-light)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pitch Selection */}
      <div className="space-y-2 w-full max-w-sm">
        <label className="text-sm font-medium text-[var(--text-secondary)]">
          Base Pitch (Sa = {pitch.label}, {pitch.hz} Hz)
        </label>
        <div className="flex flex-wrap gap-2">
          {PITCH_OPTIONS.map((p, idx) => (
            <button
              key={p.label}
              onClick={() => setPitchIndex(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                idx === pitchIndex
                  ? "bg-[var(--accent-primary)] text-white shadow-md"
                  : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border-light)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Volume */}
      <div className="space-y-2 w-full max-w-sm">
        <label className="text-sm font-medium text-[var(--text-secondary)]">
          Volume: {Math.round(volume * 100)}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={volume * 100}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          className="w-full accent-[var(--accent-primary)]"
        />
      </div>

      {/* Play Button */}
      <button
        onClick={isPlaying ? stopTanpura : startTanpura}
        className={`px-8 py-3 rounded-xl text-white font-medium text-lg shadow-lg transition-all ${
          isPlaying
            ? "bg-[var(--accent-secondary)] hover:opacity-90"
            : "bg-[var(--accent-primary)] hover:opacity-90"
        }`}
      >
        {isPlaying ? "Stop Tanpura" : "Start Tanpura"}
      </button>
    </div>
  );
}
