"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const TUNINGS = [
  { label: "Pa Sa Sa Sa", notes: "Pa Sa Sa Sa", key: "pa", intervals: [7, 0, 0, -12] },
  { label: "Ma Sa Sa Sa", notes: "Ma Sa Sa Sa", key: "ma", intervals: [5, 0, 0, -12] },
  { label: "Ni Sa Sa Sa", notes: "Ni Sa Sa Sa", key: "ni", intervals: [-1, 0, 0, -12] },
  { label: "Malkauns", notes: "Sa Ma Sa Sa", key: "malkauns", intervals: [0, 5, 0, -12] },
  { label: "Yaman", notes: "Ni Sa Sa Sa", key: "yaman", intervals: [11, 0, 0, -12] },
];

const PITCH_OPTIONS = [
  { label: "C (Low)", value: "C3", hz: 130.81 },
  { label: "C#", value: "C#3", hz: 138.59 },
  { label: "D", value: "D3", hz: 146.83 },
  { label: "D#", value: "D#3", hz: 155.56 },
  { label: "E", value: "E3", hz: 164.81 },
  { label: "F", value: "F3", hz: 174.61 },
  { label: "F#", value: "F#3", hz: 185.0 },
  { label: "G", value: "G3", hz: 196.0 },
  { label: "G#", value: "G#3", hz: 207.65 },
  { label: "A", value: "A3", hz: 220.0 },
  { label: "A#", value: "A#3", hz: 233.08 },
  { label: "B", value: "B3", hz: 246.94 },
  { label: "C (Mid)", value: "C4", hz: 261.63 },
];

const STRING_COLORS = ["#D4A574", "#E8C99A", "#E8C99A", "#C49A6C"];

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

    // Javari effect: LFO on upper harmonics
    if (i > 1) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.5 + i * 0.3, time);
      lfoGain.gain.setValueAtTime(hFreq * 0.002, time);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(time);
      lfo.stop(time + dur + 0.1);
    }

    // Harmonics swell (javari shimmer)
    const amp = amplitudes[i];
    if (i > 2) {
      gain.gain.setValueAtTime(amp * 0.3, time);
      gain.gain.linearRampToValueAtTime(amp, time + 0.3 + i * 0.1);
      gain.gain.linearRampToValueAtTime(amp * 0.5, time + 1.5);
      gain.gain.linearRampToValueAtTime(amp * 0.8, time + 2.5);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    } else {
      gain.gain.setValueAtTime(amp, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    }

    osc.connect(gain);
    gain.connect(master);
    osc.start(time);
    osc.stop(time + dur + 0.1);
  }

  // Pluck noise burst
  const bufSize = ctx.sampleRate * 0.02;
  const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let j = 0; j < bufSize; j++) data[j] = (Math.random() * 2 - 1) * 0.3;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(vol * 0.15, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(time);
  noise.stop(time + 0.06);
}

export default function TanpuraPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [tuningIndex, setTuningIndex] = useState(0);
  const [pitchIndex, setPitchIndex] = useState(9); // A = 220Hz
  const [volume, setVolume] = useState(0.7);
  const [tempo, setTempo] = useState(60);
  const [activeString, setActiveString] = useState(-1);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentStringRef = useRef(0);
  const configRef = useRef({ tuningIndex, pitchIndex, volume, tempo });

  useEffect(() => {
    configRef.current = { tuningIndex, pitchIndex, volume, tempo };
  }, [tuningIndex, pitchIndex, volume, tempo]);

  const pluckString = useCallback(() => {
    if (!audioCtxRef.current) return;
    const { tuningIndex: ti, pitchIndex: pi, volume: v } = configRef.current;
    const ctx = audioCtxRef.current;
    const stringIdx = currentStringRef.current;
    const semitones = TUNINGS[ti].intervals[stringIdx];
    const freq = PITCH_OPTIONS[pi].hz * Math.pow(2, semitones / 12);
    createTanpuraString(ctx, freq, ctx.currentTime, v);
    setActiveString(stringIdx);
    currentStringRef.current = (stringIdx + 1) % 4;
  }, []);

  const startTanpura = useCallback(() => {
    audioCtxRef.current = new AudioContext();
    currentStringRef.current = 0;
    pluckString();
    const intervalMs = (60 / configRef.current.tempo) * 1000;
    timerRef.current = setInterval(pluckString, intervalMs);
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
    setActiveString(-1);
  }, []);

  // Restart interval when tempo changes while playing
  useEffect(() => {
    if (isPlaying && timerRef.current) {
      clearInterval(timerRef.current);
      const intervalMs = (60 / tempo) * 1000;
      timerRef.current = setInterval(pluckString, intervalMs);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempo]);

  useEffect(() => {
    return () => { stopTanpura(); };
  }, [stopTanpura]);

  const getStringLabel = (idx: number): string => {
    const semitones = TUNINGS[tuningIndex].intervals[idx];
    if (semitones === -12 || semitones === -24) return "Sa\u2193";
    if (semitones === 0) return "Sa";
    if (semitones === 7) return "Pa";
    if (semitones === 5) return "Ma";
    if (semitones === 11 || semitones === -1) return "Ni";
    return "Sa";
  };

  return (
    <div className="flex flex-col items-center gap-6 -mx-4 -mt-8 pb-12" style={{ background: "#0d0705", minHeight: "100vh" }}>
      {/* Header */}
      <div className="text-center pt-8">
        <h2 className="text-3xl font-bold tracking-wide" style={{ color: "#E8C99A" }}>
          🎵 Tanpura
        </h2>
        <p className="text-sm italic mt-1" style={{ color: "#8B7355" }}>
          Continuous drone for riyaaz practice
        </p>
      </div>

      {/* Instrument Graphic */}
      <div
        className="relative rounded-2xl border overflow-hidden"
        style={{
          width: "min(280px, 80vw)",
          background: "linear-gradient(180deg, #1a0f05, #2d1a0a, #1a0f05)",
          borderColor: "#3d2b1a",
        }}
      >
        {/* Neck */}
        <div className="flex justify-center pt-5">
          <div
            className="rounded-sm flex items-center justify-center"
            style={{
              width: 50,
              height: 36,
              background: "linear-gradient(90deg, #8B5E3C, #6B3A1F, #4A2510, #6B3A1F, #8B5E3C)",
            }}
          >
            {/* Tuning pegs */}
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-full border"
                  style={{ width: 8, height: 8, backgroundColor: "#C49A6C", borderColor: "#8B5E3C" }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Strings */}
        <div className="flex justify-center gap-5 py-3" style={{ height: 180 }}>
          {[0, 1, 2, 3].map((i) => {
            const isActive = isPlaying && activeString === i;
            return (
              <div key={i} className="flex flex-col items-center justify-end h-full">
                <div
                  className="rounded-sm transition-all duration-150"
                  style={{
                    width: isActive ? 5 : 2,
                    height: "85%",
                    backgroundColor: STRING_COLORS[i],
                    opacity: isActive ? 1 : 0.7,
                    boxShadow: isActive ? "0 0 12px #FFD700" : "none",
                  }}
                />
                <div
                  className="mt-2 px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{ backgroundColor: "rgba(30,20,10,0.8)", color: "#E8C99A" }}
                >
                  {getStringLabel(i)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bridge */}
        <div
          className="mx-auto rounded-sm"
          style={{
            width: "70%",
            height: 8,
            background: "linear-gradient(90deg, #5C3D1E, #8B5E3C, #5C3D1E)",
          }}
        />

        {/* Gourd (resonator) */}
        <div className="flex justify-center py-4">
          <div
            className="rounded-full border-2 flex items-center justify-center"
            style={{
              width: 100,
              height: 100,
              background: "radial-gradient(circle at 35% 35%, #D2691E, #A0522D, #6B3A1F)",
              borderColor: "#4A2510",
            }}
          >
            <div
              className="rounded-full border"
              style={{ width: 50, height: 50, borderColor: "rgba(212,165,116,0.3)" }}
            />
          </div>
        </div>

        {/* Now playing badge */}
        {isPlaying && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: "rgba(39,174,96,0.2)", color: "#27AE60" }}>
            ♪ {TUNINGS[tuningIndex].notes}
          </div>
        )}
      </div>

      {/* Play/Stop Button */}
      <button
        onClick={isPlaying ? stopTanpura : startTanpura}
        className="flex items-center gap-3 px-8 py-4 rounded-2xl text-white font-bold text-lg shadow-xl transition-transform hover:scale-105 active:scale-95"
        style={{
          background: isPlaying
            ? "linear-gradient(135deg, #E74C3C, #C0392B)"
            : "linear-gradient(135deg, #27AE60, #1E8449)",
        }}
      >
        <span className="text-xl">{isPlaying ? "⏹" : "▶"}</span>
        {isPlaying ? "Stop" : "Play Tanpura"}
      </button>

      {/* Controls Card */}
      <div
        className="w-full max-w-md rounded-2xl p-5 space-y-5"
        style={{ backgroundColor: "#1a1008", border: "1px solid #3d2b1a" }}
      >
        {/* Pattern */}
        <div>
          <label className="text-xs font-bold tracking-widest mb-2 block" style={{ color: "#8B7355" }}>
            PATTERN
          </label>
          <div className="flex flex-wrap gap-2">
            {TUNINGS.map((t, idx) => (
              <button
                key={t.key}
                onClick={() => setTuningIndex(idx)}
                className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: idx === tuningIndex ? "#D4A574" : "#2d1a0a",
                  color: idx === tuningIndex ? "#1a0f05" : "#8B7355",
                  border: `1px solid ${idx === tuningIndex ? "#D4A574" : "#3d2b1a"}`,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pitch */}
        <div>
          <label className="text-xs font-bold tracking-widest mb-2 block" style={{ color: "#8B7355" }}>
            BASE PITCH — Sa = {PITCH_OPTIONS[pitchIndex].label} ({PITCH_OPTIONS[pitchIndex].hz} Hz)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PITCH_OPTIONS.map((p, idx) => (
              <button
                key={p.value}
                onClick={() => setPitchIndex(idx)}
                className="px-2.5 py-1.5 rounded text-xs font-medium transition-all"
                style={{
                  backgroundColor: idx === pitchIndex ? "#D4A574" : "#2d1a0a",
                  color: idx === pitchIndex ? "#1a0f05" : "#8B7355",
                  border: `1px solid ${idx === pitchIndex ? "#D4A574" : "#3d2b1a"}`,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Volume */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold tracking-widest" style={{ color: "#8B7355" }}>
              🔊 VOLUME
            </label>
            <span className="text-xs font-medium" style={{ color: "#E8C99A" }}>
              {Math.round(volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={volume * 100}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #D4A574 ${volume * 100}%, #3d2b1a ${volume * 100}%)`,
            }}
          />
        </div>

        {/* Tempo */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold tracking-widest" style={{ color: "#8B7355" }}>
              ⏱ CYCLE SPEED
            </label>
            <span className="text-xs font-medium" style={{ color: "#E8C99A" }}>
              {tempo} BPM
            </span>
          </div>
          <input
            type="range"
            min={30}
            max={120}
            value={tempo}
            onChange={(e) => setTempo(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #D4A574 ${((tempo - 30) / 90) * 100}%, #3d2b1a ${((tempo - 30) / 90) * 100}%)`,
            }}
          />
        </div>
      </div>

      {/* Info */}
      <p className="text-center text-xs max-w-sm px-4" style={{ color: "#5c4a35" }}>
        Tanpura provides the essential Sa (tonic) drone for vocal and instrumental practice.
        Match your pitch with the tanpura to stay in tune.
      </p>
    </div>
  );
}
