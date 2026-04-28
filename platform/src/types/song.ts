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
}

export interface BookMeta {
  title: string;
  creator: string;
  publisher: string;
  language: string;
  cover_image: string;
  song_order: string[];
}

export type NotationMode = "indian" | "western" | "both";

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
