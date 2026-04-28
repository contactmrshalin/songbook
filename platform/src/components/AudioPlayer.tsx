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

// Indian note → MIDI mapping
const NOTE_TO_MIDI: Record<string, number> = {
  Sa: 60, Re: 62, Ga: 64, ma: 65, Ma: 66, Pa: 67, Dha: 69, Ni: 71,
  pa: 55, dha: 57, ni: 59,
  "Sa'": 72, "Re'": 74, "Ga'": 76, "ma'": 77, "Pa'": 79, "Dha'": 81, "Ni'": 83,
  "Re(k)": 61, "Ga(k)": 63, "Dha(k)": 68, "Ni(k)": 70,
  "Ma(T)": 66,
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Tokenize notation — keeps spaces and bar lines as separate tokens for display,
// but we also return the "playable" index mapping
export function tokenizeNotation(indian: string): string[] {
  if (!indian) return [];
  return indian.split(/\s+/).filter(Boolean);
}

function resolveTokenMidi(token: string): number | undefined {
  const clean = token.replace(/:/g, "").replace(/\./g, "").replace(/~/g, "").replace(/\^/g, "").replace(/\(/g, "").replace(/\)/g, "");
  let midi = NOTE_TO_MIDI[clean];
  if (midi === undefined) {
    // Try without octave markers
    const base = clean.replace(/'/g, "");
    midi = NOTE_TO_MIDI[base];
    if (midi !== undefined && clean.includes("'")) {
      midi += 12;
    }
  }
  return midi;
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

    const noteDuration = (60 / tempoRef.current) * 0.8; // seconds per note
    const noteIntervalMs = noteDuration * 1000;

    // Schedule each token
    tokens.forEach((token, tokenIdx) => {
      const delay = tokenIdx * noteIntervalMs;

      const tid = setTimeout(() => {
        if (!isPlayingRef.current) return;

        // Highlight this token
        setCurrentTokenIndex(tokenIdx);

        // Play sound if it's a real note (not a bar line or rest)
        const isBarOrRest = token === "|" || token === "." || token === "_" || token === "-" || token === "—";
        if (!isBarOrRest) {
          const isHold = token.includes(":");
          const midi = resolveTokenMidi(token);
          if (midi !== undefined) {
            const dur = isHold ? noteDuration * 1.5 : noteDuration;
            playNote(midi, dur);
          }
        }
      }, delay);

      noteTimeoutsRef.current.push(tid);
    });

    // After all tokens finish, add a small gap then advance to next line
    const totalLineDuration = tokens.length * noteIntervalMs;
    const gapMs = noteIntervalMs * 0.5; // half-beat gap between lines

    lineAdvanceTimeoutRef.current = setTimeout(() => {
      if (isPlayingRef.current) {
        advanceToNextLineFnRef.current();
      }
    }, totalLineDuration + gapMs);
  }, [allLines, playNote, cancelPendingTimers, setCurrentNoteIndex, setCurrentTokenIndex]);

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
