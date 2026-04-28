import fs from "fs";
import path from "path";
import type { Song, BookMeta } from "@/types/song";

const SONGS_DIR = path.join(process.cwd(), "..", "songs");
const BOOK_JSON = path.join(process.cwd(), "..", "book.json");
const NOTATION_MAPPING = path.join(
  process.cwd(),
  "..",
  "notation_mapping.json"
);

let cachedSongs: Song[] | null = null;
let cachedBookMeta: BookMeta | null = null;

export function getNotationMapping() {
  const raw = fs.readFileSync(NOTATION_MAPPING, "utf-8");
  return JSON.parse(raw);
}

export function getBookMeta(): BookMeta {
  if (cachedBookMeta) return cachedBookMeta;
  const raw = fs.readFileSync(BOOK_JSON, "utf-8");
  cachedBookMeta = JSON.parse(raw) as BookMeta;
  return cachedBookMeta;
}

export function getAllSongs(): Song[] {
  if (cachedSongs) return cachedSongs;

  const bookMeta = getBookMeta();
  const songFiles = fs.readdirSync(SONGS_DIR).filter((f) => f.endsWith(".json"));

  const songsMap = new Map<string, Song>();

  for (const file of songFiles) {
    const raw = fs.readFileSync(path.join(SONGS_DIR, file), "utf-8");
    const song = JSON.parse(raw) as Song;
    // Normalize song data - handle missing optional fields
    if (!Array.isArray(song.info)) song.info = [];
    if (!Array.isArray(song.sections)) song.sections = [];
    for (const section of song.sections) {
      if (!section.name) section.name = "Untitled";
      if (!Array.isArray(section.lines)) section.lines = [];
    }
    // Only include exported songs (default is true)
    if (song.export !== false) {
      songsMap.set(song.id, song);
    }
  }

  // Order songs according to book.json song_order
  const ordered: Song[] = [];
  for (const id of bookMeta.song_order) {
    const song = songsMap.get(id);
    if (song) {
      ordered.push(song);
      songsMap.delete(id);
    }
  }
  // Append any songs not in the order
  for (const song of songsMap.values()) {
    ordered.push(song);
  }

  cachedSongs = ordered;
  return ordered;
}

export function getSongById(id: string): Song | undefined {
  const songPath = path.join(SONGS_DIR, `${id}.json`);
  if (fs.existsSync(songPath)) {
    const raw = fs.readFileSync(songPath, "utf-8");
    const song = JSON.parse(raw) as Song;
    if (!Array.isArray(song.info)) song.info = [];
    if (!Array.isArray(song.sections)) song.sections = [];
    for (const section of song.sections) {
      if (!section.name) section.name = "Untitled";
      if (!Array.isArray(section.lines)) section.lines = [];
    }
    return song;
  }
  // Try searching all songs
  return getAllSongs().find((s) => s.id === id);
}

export function searchSongs(query: string): Song[] {
  const q = query.toLowerCase();
  return getAllSongs().filter((song) => {
    const searchable = [
      song.title,
      ...song.info,
      ...song.sections.flatMap((s) => s.lines.map((l) => l.lyrics)),
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(q);
  });
}

// Extract metadata from info array
export function extractMeta(info: string[]): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const line of info) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();
      if (key.includes("movie") || key.includes("film")) meta.movie = value;
      else if (key.includes("singer") || key.includes("artist"))
        meta.singer = value;
      else if (key.includes("music") || key.includes("composer"))
        meta.music = value;
      else if (key.includes("scale")) meta.scale = value;
      else if (key.includes("raag")) meta.raag = value;
      else if (key.includes("lyric")) meta.lyricist = value;
      else if (key.includes("source")) meta.source = value;
      else if (key.includes("difficulty")) meta.difficulty = value;
      else meta[key] = value;
    }
  }
  return meta;
}

// Convert Indian notation to ABC notation for ABCjs rendering
export function indianToABC(indianNotation: string): string {
  // Map sargam to ABC note letters
  const noteMap: Record<string, string> = {
    Sa: "C",
    Re: "D",
    Ga: "E",
    ma: "F",
    Ma: "^F",
    Pa: "G",
    Dha: "A",
    Ni: "B",
    // Low octave
    pa: "G,",
    dha: "A,",
    ni: "B,",
    // Komal
    "Re(k)": "_D",
    "Ga(k)": "_E",
    "Dha(k)": "_A",
    "Ni(k)": "_B",
    // Tivra
    "Ma(T)": "^F",
  };

  // Simple tokenizer - split on spaces, map tokens
  const tokens = indianNotation.split(/\s+/);
  const abcNotes: string[] = [];

  for (const token of tokens) {
    if (!token || token === "." || token === "|") {
      if (token === "|") abcNotes.push("|");
      continue;
    }

    // Check for high octave marker
    let note = token.replace(/'+/g, "").replace(/\.+/g, "").replace(/:/g, "");
    const isHigh = token.includes("'");
    const isHold = token.includes(":") || token.includes("..");

    // Remove ornament markers for ABC conversion
    note = note.replace(/~/g, "").replace(/\(/g, "").replace(/\)/g, "");

    if (noteMap[note]) {
      let abcNote = noteMap[note];
      if (isHigh) {
        // ABC uses lowercase for octave up
        abcNote = abcNote.toLowerCase();
      }
      if (isHold) {
        abcNote += "2";
      }
      abcNotes.push(abcNote);
    }
  }

  return abcNotes.join(" ");
}

// Convert Indian sargam to MIDI note numbers for audio playback
export function indianToMidi(
  indianNotation: string,
  baseOctave: number = 4
): number[] {
  const noteToSemitone: Record<string, number> = {
    Sa: 0,
    Re: 2,
    Ga: 4,
    ma: 5,
    Ma: 6,
    Pa: 7,
    Dha: 9,
    Ni: 11,
    pa: -5,
    dha: -3,
    ni: -1,
    "Re(k)": 1,
    "Ga(k)": 3,
    "Dha(k)": 8,
    "Ni(k)": 10,
    "Ma(T)": 6,
  };

  const baseMidi = 60 + (baseOctave - 4) * 12; // C4 = 60
  const tokens = indianNotation.split(/\s+/);
  const midiNotes: number[] = [];

  for (const token of tokens) {
    if (!token || token === "." || token === "|" || token === "") continue;

    let note = token
      .replace(/'+/g, "")
      .replace(/\.+/g, "")
      .replace(/:/g, "")
      .replace(/~/g, "")
      .replace(/\^/g, "");
    const isHigh = token.includes("'");

    // Try matching the note
    let semitone = noteToSemitone[note];
    if (semitone !== undefined) {
      let midi = baseMidi + semitone;
      if (isHigh) midi += 12;
      midiNotes.push(midi);
    }
  }

  return midiNotes;
}
