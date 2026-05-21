/**
 * Sargam chromatic transpose utility
 *
 * Maps each sargam syllable to a semitone offset (0–11) and back,
 * allowing per-section or full-song transposition in the admin editor.
 *
 * Chromatic scale used:
 *   Sa(0)  Re(k)(1)  Re(2)  Ga(k)(3)  Ga(4)  ma(5)  Ma(6)
 *   Pa(7)  Dha(k)(8) Dha(9) Ni(k)(10) Ni(11)
 */

// Longer variants must come before shorter ones so the regex prefers them.
const NOTE_ORDER = [
  "Re(k)", "Ga(k)", "Ma(T)", "Dha(k)", "Ni(k)",
  "Sa", "Re", "Ga", "ma", "Ma", "Pa", "Dha", "Ni",
];

const NOTE_SEMITONE: Record<string, number> = {
  "Sa":    0,
  "Re(k)": 1,
  "Re":    2,
  "Ga(k)": 3,
  "Ga":    4,
  "ma":    5,
  "Ma":    6,
  "Ma(T)": 6, // alternate spelling — maps same semitone
  "Pa":    7,
  "Dha(k)":8,
  "Dha":   9,
  "Ni(k)":10,
  "Ni":   11,
};

// Canonical name for each semitone (used when mapping back from semitone → note)
const SEMITONE_NOTE = [
  "Sa", "Re(k)", "Re", "Ga(k)", "Ga", "ma", "Ma",
  "Pa", "Dha(k)", "Dha", "Ni(k)", "Ni",
];

// Build a single alternation regex from longest-first note names
const NOTE_PATTERN = NOTE_ORDER
  .map((n) => n.replace(/[()]/g, "\\$&"))
  .join("|");

const NOTE_REGEX = new RegExp(NOTE_PATTERN, "g");

/**
 * Transpose a single sargam note by `semitones` steps (positive = up, negative = down).
 * Octave markers (`.` prefix / suffix) are preserved.
 * Returns the input unchanged if it is not a recognised note.
 */
function transposeNote(note: string, semitones: number): string {
  // Strip leading/trailing octave dots so we can look up the base note
  const leadingDots  = note.match(/^\.*/)?.[0] ?? "";
  const trailingDots = note.match(/\.*$/)?.[0] ?? "";
  const base = note.slice(leadingDots.length, note.length - trailingDots.length);

  const semitone = NOTE_SEMITONE[base];
  if (semitone === undefined) return note; // not a note token, leave as-is

  const shifted = ((semitone + semitones) % 12 + 12) % 12;
  return leadingDots + SEMITONE_NOTE[shifted] + trailingDots;
}

/**
 * Transpose all sargam notes in a notation string by `semitones` semitones.
 *
 * Non-note characters (lyrics hints, slashes, dashes, spaces, brackets for
 * groupings, etc.) are left untouched.
 *
 * @param indian   Raw sargam string, e.g. "Sa Re Ga ma Pa"
 * @param semitones Integer semitone shift (positive = up, negative = down)
 * @returns Transposed sargam string
 */
export function transposeNotation(indian: string, semitones: number): string {
  if (!semitones) return indian;
  return indian.replace(NOTE_REGEX, (match) => transposeNote(match, semitones));
}
