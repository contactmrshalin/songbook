export interface SongSummary {
  id: string;
  title: string;
  info: string[];
  thumbnail?: string;
  background?: string;
}

export interface Song extends SongSummary {
  sections: Section[];
}

export interface Section {
  name: string;
  lines: Line[];
}

export interface Line {
  lyrics: string;
  indian: string;
}

export interface ParsedNote {
  step: string;
  alter: number;
  octave: number;
  duration: number; // in divisions (e.g. 2 = eighth, 4 = quarter)
  indianLabel: string;
  lyric?: string;
}

export interface Arrangement {
  id: number;
  song_id: string;
  name: string;
  tempo_bpm: number;
  divisions: number;
  beats: number;
  beat_type: number;
  note_data: NoteDataOverride | null;
  created_at: string;
  updated_at: string;
}

export interface NoteDataOverride {
  noteList?: ParsedNote[];
  tempoMap?: Record<string, number>;
}

export interface NotationMapping {
  token_to_western: Record<string, { step: string; alter: number }>;
  octave_markers?: { low?: string; middle?: string; high?: string };
}
