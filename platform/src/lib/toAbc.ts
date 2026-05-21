/**
 * toAbc.ts
 * Converts a Song's Indian sargam notation into ABC notation format
 * for rendering via abcjs.
 *
 * ABC notation reference:
 *   - Uppercase letters (C D E F G A B) = middle octave (C4–B4)
 *   - Lowercase letters (c d e f g a b) = upper octave (C5–B5)
 *   - Comma suffix (C, D, etc.)         = lower octave (C3–B3)
 *   - Caret prefix (^F)                 = sharp (F#)
 *   - Underscore prefix (_D)            = flat (Db)
 *   - Number suffix (C2, C4)            = duration multiplier (base = L:1/8)
 *   - z                                 = rest
 *   - |                                 = bar line
 */

import type { Song } from "@/types/song";

// ── Token → ABC pitch mapping ───────────────────────────────────────────────
const TOKEN_TO_ABC_PITCH: Record<string, string> = {
  // Madhya saptak — middle octave (C4–B4)
  Sa: "C",
  Re: "D",
  Ga: "E",
  ma: "F",
  Ma: "^F",
  Pa: "G",
  Dha: "A",
  Ni: "B",

  // Mandra saptak — lower octave (C3–B3), lower-case convention in data
  sa: "C,",
  re: "D,",
  ga: "E,",
  // 'ma' lowercase conflicts with shuddh ma above; treat as rest
  pa: "G,",
  dha: "A,",
  ni: "B,",

  // Taar saptak — upper octave (C5–B5), trailing apostrophe in data
  "Sa'": "c",
  "Re'": "d",
  "Ga'": "e",
  "ma'": "f",
  "Ma'": "^f",
  "Pa'": "g",
  "Dha'": "a",
  "Ni'": "b",

  // Komal (flat) variants
  "Re(k)": "_D",
  "Ga(k)": "_E",
  "Dha(k)": "_A",
  "Ni(k)": "_B",

  // Tivra Ma (same pitch as Ma but explicit)
  "Ma(T)": "^F",

  // Single-letter abbreviations (uppercase = middle octave defaults)
  S: "C",
  R: "D",
  G: "E",
  M: "^F",
  P: "G",
  D: "A",
  N: "B",
};

// ── Single token → ABC note string ─────────────────────────────────────────
function tokenToAbc(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Pass bar lines through
  if (trimmed === "|") return " | ";

  // Explicit rest markers
  if (trimmed === "-" || trimmed === "_" || trimmed === "0") return "z";

  // Count hold markers (each ':' doubles the note duration)
  const holdCount = (trimmed.match(/:/g) ?? []).length;

  // Strip ornament/modifier chars to get the canonical note name:
  //   ':' = hold/sustain  '~' = meend/glide  '^' = accent  '.' = dot separator
  const clean = trimmed
    .replace(/:/g, "")
    .replace(/~/g, "")
    .replace(/\^/g, "")
    .replace(/\./g, "")
    .trim();

  const pitch = TOKEN_TO_ABC_PITCH[clean];
  if (!pitch) return "z"; // unrecognised token → rest

  // Duration: base 1 (= one eighth note when L:1/8)
  // Each ':' doubles it: Sa: → 2, Sa:: → 4
  const duration = holdCount > 0 ? Math.pow(2, holdCount) : 1;
  return duration > 1 ? `${pitch}${duration}` : pitch;
}

// ── Lyric word helper ───────────────────────────────────────────────────────
// Strips ornament markers, leaving just the readable sargam syllable.
function cleanLyricWord(token: string): string {
  return token
    .replace(/:/g, "")
    .replace(/~/g, "")
    .replace(/\^/g, "")
    .replace(/\./g, "")
    .trim();
}

// ── Main export ─────────────────────────────────────────────────────────────
/**
 * Convert a Song object into an ABC notation string suitable for abcjs.
 *
 * Notes / limitations:
 * - All tokens are eighth notes (L:1/8) by default; hold ':' doubles duration.
 * - Meend '~' marks are stripped (no slur generated — keeps output simple).
 * - Kan/grace-note patterns like "(Re)Ga" are not yet rendered as grace notes;
 *   the parenthesised prefix is dropped.
 * - Automatic bar lines are inserted every 8 eighth-note units (= one 4/4 bar)
 *   when the source data contains no explicit '|' tokens.
 * - Each notation line from the song becomes one ABC "voice line" followed by
 *   an aligned w: lyric line.
 */
export function songToAbc(song: Song): string {
  const lines: string[] = [
    "X:1",
    `T:${song.title.replace(/\n/g, " ")}`,
    "M:4/4",
    "L:1/8",
    "Q:1/4=76",
    "%%staffwidth 95%",
    "K:C",
  ];

  for (const section of song.sections) {
    // Section heading as an ABC text annotation
    lines.push(`"_${section.name}" z4 |`);

    for (const songLine of section.lines) {
      const indian = (songLine.indian ?? "").trim();
      if (!indian) continue;

      const tokens = indian.split(/\s+/).filter(Boolean);

      const abcNotes: string[] = [];
      const lyricWords: string[] = [];

      // Track eighth-note units within the current measure for auto-barring
      const hasExplicitBars = tokens.includes("|");
      let unitsSinceBar = 0;
      const UNITS_PER_BAR = 8; // 8 eighths = one 4/4 measure

      for (const token of tokens) {
        if (token === "|") {
          // Explicit bar from source data
          abcNotes.push("|");
          lyricWords.push("|");
          unitsSinceBar = 0;
          continue;
        }

        const abc = tokenToAbc(token);

        if (abc === " | ") {
          abcNotes.push("|");
          lyricWords.push("|");
          unitsSinceBar = 0;
          continue;
        }

        if (!abc) continue;

        // Estimate duration units consumed (parse trailing number)
        const durationMatch = abc.match(/(\d+)$/);
        const units = durationMatch ? parseInt(durationMatch[1], 10) : 1;

        // Auto-insert bar line before this note if it would overflow the measure
        if (!hasExplicitBars && unitsSinceBar > 0 && unitsSinceBar + units > UNITS_PER_BAR) {
          abcNotes.push("|");
          lyricWords.push("|");
          unitsSinceBar = 0;
        }

        abcNotes.push(abc);
        unitsSinceBar += units;

        // Build lyric word
        const word = cleanLyricWord(token);
        lyricWords.push(word || "*");
      }

      // Close the last measure
      if (abcNotes.length > 0 && abcNotes[abcNotes.length - 1] !== "|") {
        abcNotes.push("|");
      }

      if (abcNotes.length === 0) continue;

      // Emit note line
      lines.push(abcNotes.join(" "));

      // Emit lyric line (skip if all words are '*' placeholders)
      const hasRealWords = lyricWords.some((w) => w !== "|" && w !== "*");
      if (hasRealWords) {
        lines.push(`w: ${lyricWords.join(" ")}`);
      }
    }
  }

  return lines.join("\n");
}
