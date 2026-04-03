import { useState, useCallback } from 'react';
import { playNoteList, stopPlayback } from '../lib/playback';
import type { ParsedNote } from '../types';

interface PlaybackControlsProps {
  notes: ParsedNote[];
  tempoBpm: number;
  onTempoChange: (bpm: number) => void;
  divisions: number;
  disabled?: boolean;
}

export function PlaybackControls({
  notes,
  tempoBpm,
  onTempoChange,
  divisions,
  disabled = false,
}: PlaybackControlsProps) {
  const [playing, setPlaying] = useState(false);

  const handlePlay = useCallback(async () => {
    if (notes.length === 0) return;
    setPlaying(true);
    try {
      await playNoteList(
        notes.map((n) => ({ step: n.step, alter: n.alter, octave: n.octave, duration: n.duration })),
        tempoBpm,
        divisions
      );
    } finally {
      setPlaying(false);
    }
  }, [notes, tempoBpm, divisions]);

  const handleStop = useCallback(() => {
    stopPlayback();
    setPlaying(false);
  }, []);

  return (
    <div className="playback-controls">
      <label>
        Tempo (BPM):{' '}
        <input
          type="number"
          min={40}
          max={200}
          value={tempoBpm}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v)) onTempoChange(v);
          }}
        />
      </label>
      <button type="button" onClick={handlePlay} disabled={disabled || playing || notes.length === 0}>
        {playing ? 'Playing…' : 'Play'}
      </button>
      <button type="button" onClick={handleStop} disabled={!playing}>
        Stop
      </button>
    </div>
  );
}
