"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const TIME_SIGNATURES = [
  { beats: 4, label: "4/4" },
  { beats: 3, label: "3/4" },
  { beats: 6, label: "6/8" },
  { beats: 7, label: "7/8" },
];

export default function MetronomePage() {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [tsIndex, setTsIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const tapTimesRef = useRef<number[]>([]);

  const ts = TIME_SIGNATURES[tsIndex];

  const playClick = useCallback((beat: number) => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.value = beat === 0 ? 1000 : 600;
    gain.gain.setValueAtTime(beat === 0 ? 0.5 : 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }, []);

  const startMetronome = useCallback(() => {
    const intervalMs = (60 / bpm) * 1000;
    let beat = 0;
    setCurrentBeat(0);
    playClick(0);

    intervalRef.current = setInterval(() => {
      beat = (beat + 1) % ts.beats;
      setCurrentBeat(beat);
      playClick(beat);
    }, intervalMs);

    setIsPlaying(true);
  }, [bpm, ts.beats, playClick]);

  const stopMetronome = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
    setCurrentBeat(0);
  }, []);

  useEffect(() => {
    return () => { stopMetronome(); };
  }, [stopMetronome]);

  // Restart on BPM/TS change while playing
  useEffect(() => {
    if (isPlaying) {
      stopMetronome();
      startMetronome();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, tsIndex]);

  const handleTap = () => {
    const now = Date.now();
    tapTimesRef.current.push(now);
    if (tapTimesRef.current.length > 5) tapTimesRef.current.shift();
    if (tapTimesRef.current.length >= 2) {
      const times = tapTimesRef.current;
      const intervals = [];
      for (let i = 1; i < times.length; i++) intervals.push(times[i] - times[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const tappedBpm = Math.round(60000 / avg);
      if (tappedBpm >= 30 && tappedBpm <= 240) setBpm(tappedBpm);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <h2 className="text-2xl font-bold text-[var(--text-primary)]">Metronome</h2>

      {/* BPM Display */}
      <div className="text-center">
        <div className="text-6xl font-bold text-[var(--accent-primary)]">{bpm}</div>
        <div className="text-sm text-[var(--text-muted)] mt-1">BPM</div>
      </div>

      {/* BPM Slider */}
      <input
        type="range"
        min={30}
        max={240}
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
        className="w-full max-w-sm accent-[var(--accent-primary)]"
      />

      {/* BPM Quick Buttons */}
      <div className="flex gap-2">
        {[-10, -1, 1, 10].map((delta) => (
          <button
            key={delta}
            onClick={() => setBpm((b) => Math.max(30, Math.min(240, b + delta)))}
            className="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-medium hover:bg-[var(--border-light)] transition-colors"
          >
            {delta > 0 ? `+${delta}` : delta}
          </button>
        ))}
      </div>

      {/* Time Signature */}
      <div className="flex gap-2">
        {TIME_SIGNATURES.map((sig, idx) => (
          <button
            key={sig.label}
            onClick={() => setTsIndex(idx)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              idx === tsIndex
                ? "bg-[var(--accent-primary)] text-white shadow-md"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border-light)]"
            }`}
          >
            {sig.label}
          </button>
        ))}
      </div>

      {/* Beat Indicators */}
      <div className="flex gap-3">
        {Array.from({ length: ts.beats }).map((_, idx) => (
          <div
            key={idx}
            className="w-8 h-8 rounded-full border-2 transition-all duration-100"
            style={{
              backgroundColor: idx === currentBeat && isPlaying
                ? idx === 0 ? "var(--accent-primary)" : "var(--accent-warm)"
                : "var(--bg-card)",
              borderColor: idx === currentBeat && isPlaying
                ? idx === 0 ? "var(--accent-primary)" : "var(--accent-warm)"
                : "var(--border-medium)",
              transform: idx === currentBeat && isPlaying ? "scale(1.2)" : "scale(1)",
            }}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        <button
          onClick={isPlaying ? stopMetronome : startMetronome}
          className={`px-8 py-3 rounded-xl text-white font-medium text-lg shadow-lg transition-all ${
            isPlaying
              ? "bg-[var(--accent-secondary)] hover:opacity-90"
              : "bg-[var(--accent-primary)] hover:opacity-90"
          }`}
        >
          {isPlaying ? "Stop" : "Start"}
        </button>
        <button
          onClick={handleTap}
          className="px-6 py-3 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-medium text-lg border border-[var(--border-medium)] hover:bg-[var(--border-light)] transition-colors"
        >
          Tap
        </button>
      </div>
    </div>
  );
}
