import { useRef, useState, useCallback, useEffect } from 'react';
import { startPlayback } from '../lib/playback';
import type { PlaybackHandle } from '../lib/playback';
import type { ParsedNote } from '../types';
import { NoteStaff } from './NoteStaff';

interface SheetMusicSectionProps {
  notes: ParsedNote[];
  tempoBpm: number;
  onTempoChange: (bpm: number) => void;
  onNotesChange: (notes: ParsedNote[]) => void;
  divisions: number;
}

export function SheetMusicSection({
  notes,
  tempoBpm,
  onTempoChange,
  onNotesChange,
  divisions,
}: SheetMusicSectionProps) {
  const playbackRef = useRef<PlaybackHandle | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playingNoteIndex, setPlayingNoteIndex] = useState<number | null>(null);

  useEffect(() => { return () => { playbackRef.current?.stop(); }; }, []);

  const handlePlay = useCallback(async () => {
    if (notes.length === 0 || playing) return;
    playbackRef.current?.stop();
    setPlaying(true);
    setPlayingNoteIndex(null);
    try {
      const handle = await startPlayback(
        notes.map((n) => ({ step: n.step, alter: n.alter, octave: n.octave, duration: n.duration })),
        tempoBpm,
        divisions,
        (idx) => setPlayingNoteIndex(idx),
      );
      playbackRef.current = handle;
      await handle.finished;
    } finally {
      setPlaying(false);
      setPlayingNoteIndex(null);
      playbackRef.current = null;
    }
  }, [notes, tempoBpm, divisions, playing]);

  const handleStop = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    setPlaying(false);
    setPlayingNoteIndex(null);
  }, []);

  return (
    <section className="sheet-music-section sheet-music-section--pro">

      {/* ── Header ── */}
      <header className="sheet-music-header">
        <h2 className="sheet-music-title">Sheet music</h2>
        <div className="sheet-music-controls">
          <label className="sheet-music-tempo">
            <span>Tempo</span>
            <input
              type="number" min={40} max={200} value={tempoBpm}
              onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) onTempoChange(v); }}
            />
            <span className="sheet-music-bpm">BPM</span>
          </label>
          <button
            type="button"
            className={`btn-sheet-play ${playing ? 'btn-sheet-play--active' : ''}`}
            onClick={handlePlay}
            disabled={notes.length === 0 || playing}
          >
            ▶ {playing ? 'Playing…' : 'Play'}
          </button>
          <button
            type="button"
            className="btn-sheet-stop"
            onClick={handleStop}
            disabled={!playing}
          >
            ■ Stop
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div
        className={`sheet-music-progress-bar ${playing ? 'sheet-music-progress-bar--playing' : ''}`}
        style={
          playing && notes.length > 0 && playingNoteIndex !== null
            ? ({ '--progress': `${((playingNoteIndex + 1) / notes.length) * 100}%` } as React.CSSProperties)
            : undefined
        }
      />

      {/* ── Interactive staff (replaces both OSMD score + beat grid) ── */}
      <div className="sheet-staff-area">
        <div className="sheet-staff-hint">
          Drag a note to move it (left/right = timing · up/down = pitch) · Click staff to add · Click note to edit
        </div>
        <NoteStaff
          notes={notes}
          playingNoteIndex={playingNoteIndex}
          onNotesChange={onNotesChange}
        />
      </div>

    </section>
  );
}
