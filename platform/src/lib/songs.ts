import type { Song, BookMeta } from "@/types/song";
import bundle from "@/generated/song-bundle.json";

// All data comes from the pre-generated bundle (built by scripts/prebuild.mjs).
// No `fs` calls — works on Vercel, local dev, and any static host.

const allSongs: Song[] = bundle.songs as unknown as Song[];
const bookMeta: BookMeta = bundle.bookMeta as unknown as BookMeta;
const notationMapping: Record<string, unknown> =
  bundle.notationMapping as unknown as Record<string, unknown>;

export function getNotationMapping() {
  return notationMapping;
}

export function getBookMeta(): BookMeta {
  return bookMeta;
}

export function getAllSongs(): Song[] {
  return allSongs;
}

export function getSongById(id: string): Song | undefined {
  return allSongs.find((s) => s.id === id);
}

export function searchSongs(query: string): Song[] {
  const q = query.toLowerCase();
  return allSongs.filter((song) => {
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
  const noteMap: Record<string, string> = {
    Sa: "C",
    Re: "D",
    Ga: "E",
    ma: "F",
    Ma: "^F",
    Pa: "G",
    Dha: "A",
    Ni: "B",
    pa: "G,",
    dha: "A,",
    ni: "B,",
    "Re(k)": "_D",
    "Ga(k)": "_E",
    "Dha(k)": "_A",
    "Ni(k)": "_B",
    "Ma(T)": "^F",
  };

  const tokens = indianNotation.split(/\s+/);
  const abcNotes: string[] = [];

  for (const token of tokens) {
    if (!token || token === "." || token === "|") {
      if (token === "|") abcNotes.push("|");
      continue;
    }

    let note = token.replace(/'+/g, "").replace(/\.+/g, "").replace(/:/g, "");
    const isHigh = token.includes("'");
    const isHold = token.includes(":") || token.includes("..");

    note = note.replace(/~/g, "").replace(/\(/g, "").replace(/\)/g, "");

    if (noteMap[note]) {
      let abcNote = noteMap[note];
      if (isHigh) {
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

  const baseMidi = 60 + (baseOctave - 4) * 12;
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

    const semitone = noteToSemitone[note];
    if (semitone !== undefined) {
      let midi = baseMidi + semitone;
      if (isHigh) midi += 12;
      midiNotes.push(midi);
    }
  }

  return midiNotes;
}
