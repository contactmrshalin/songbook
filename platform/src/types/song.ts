// Song data types matching the existing JSON schema

export interface SongLine {
  lyrics: string;
  indian: string;
  western?: string;
  tokens?: string;
}

export interface SongSection {
  name: string;
  lines: SongLine[];
}

export interface Song {
  id: string;
  title: string;
  subtitle?: string;
  export?: boolean;
  info: string[];
  thumbnail: string;
  background: string;
  background_mode?: "cover" | "tile" | "contain";
  sections: SongSection[];
  /** Short engaging description of the song (AI-generated, user-editable) */
  description?: string;
  /** Interesting trivia facts about the song (AI-generated, user-editable) */
  trivia?: string[];
  /** Structured meaning with core theme and lyric symbolism (AI-generated, user-editable). Legacy: plain string. */
  meaning?: string | { coreTheme: string; lyricSymbolism: string };
  /**
   * Path to a MusicXML file for this song, relative to the data/ directory.
   * Set by scrape_musicxml.py (downloaded from URL) or build_songbook.py
   * (auto-generated from sargam).  Served via GET /api/musicxml/[id].
   * Example: "musicxml/pal-pal-dil-ke-paas.musicxml"
   */
  musicxml?: string;
}

export interface BookMeta {
  title: string;
  creator: string;
  publisher: string;
  language: string;
  cover_image: string;
  song_order: string[];
}

export type NotationMode = "indian" | "western" | "sheet";

export type SongStatus = "published" | "pending_review" | "draft";

export interface SongSubmission {
  id: string;
  songId: string;
  title: string;
  content: Song;
  status: SongStatus;
  authorId: string;
  authorName: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  reviewNotes?: string;
}
