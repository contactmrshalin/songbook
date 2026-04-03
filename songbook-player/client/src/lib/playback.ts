import * as Tone from 'tone';

const stepToMidi: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function noteToFrequency(step: string, alter: number, octave: number): number {
  const midi = (octave + 1) * 12 + stepToMidi[step] + alter;
  return midiToFreq(midi);
}

export interface PlaybackNote {
  step: string;
  alter: number;
  octave: number;
  duration: number; // in divisions
}

/** Seconds per division at given tempo. divisions = 4 means quarter = 4. */
export function getSecondsPerDivision(tempoBpm: number, divisions: number): number {
  return 60 / tempoBpm / (4 / (divisions / 4));
}

/** Total playback duration in seconds. */
export function getPlaybackDurationSeconds(
  notes: PlaybackNote[],
  tempoBpm: number,
  divisions: number
): number {
  const spd = getSecondsPerDivision(tempoBpm, divisions);
  return notes.reduce((sum, n) => sum + n.duration * spd, 0);
}

export interface PlaybackHandle {
  /** Call to stop playback early. */
  stop: () => void;
  /** Resolves when playback finishes naturally or is stopped. */
  finished: Promise<void>;
}

/**
 * Start playback with per-note callbacks.
 * Returns a handle for stopping and a promise that resolves on end.
 * onNoteIndex fires with the current note index as playback progresses; null when done.
 */
export async function startPlayback(
  notes: PlaybackNote[],
  tempoBpm: number,
  divisions: number,
  onNoteIndex: (index: number | null) => void
): Promise<PlaybackHandle> {
  await Tone.start();

  const spd = getSecondsPerDivision(tempoBpm, divisions);
  let synth: Tone.Synth | null = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.4, release: 0.3 },
  }).toDestination();

  const startToneTime = Tone.now();

  // Schedule all notes in Tone.js (step 'Z' = rest — advance time, no sound)
  let toneT = startToneTime;
  for (const n of notes) {
    if (n.step !== 'Z') {
      const dur = Math.max(0.05, n.duration * spd * 0.9);
      const freq = noteToFrequency(n.step, n.alter, n.octave);
      if (synth) synth.triggerAttackRelease(freq, dur, toneT);
    }
    toneT += n.duration * spd;
  }

  // Compute per-note wall-clock ms offset from start
  const offsets: number[] = [];
  let offsetT = 0;
  for (const n of notes) {
    offsets.push(offsetT * 1000);
    offsetT += n.duration * spd;
  }
  const totalMs = offsetT * 1000;

  let stopped = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let resolveFn: () => void;
  const finished = new Promise<void>((resolve) => { resolveFn = resolve; });

  // setTimeout per note to fire onNoteIndex
  offsets.forEach((offsetMs, i) => {
    const t = setTimeout(() => {
      if (!stopped) onNoteIndex(i);
    }, offsetMs);
    timers.push(t);
  });

  // Final timer — playback done
  const endTimer = setTimeout(() => {
    if (!stopped) {
      onNoteIndex(null);
      resolveFn();
    }
  }, totalMs + 150);
  timers.push(endTimer);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    timers.forEach(clearTimeout);
    try { synth?.dispose(); } catch (_) {}
    synth = null;
    onNoteIndex(null);
    resolveFn();
  };

  return { stop, finished };
}

/** Legacy fire-and-forget playback. */
export async function playNoteList(
  notes: PlaybackNote[],
  tempoBpm: number,
  divisions: number
): Promise<void> {
  const handle = await startPlayback(notes, tempoBpm, divisions, () => {});
  return handle.finished;
}

export function stopPlayback(): void {
  Tone.getTransport().stop();
  Tone.getTransport().cancel();
}
