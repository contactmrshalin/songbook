import type { NotationMapping } from '../types';
import type { ParsedNote } from '../types';

const TOKEN_TO_WESTERN_DEFAULT: Record<string, { step: string; alter: number }> = {
  S: { step: 'C', alter: 0 },
  R: { step: 'D', alter: 0 },
  G: { step: 'E', alter: 0 },
  m: { step: 'F', alter: 0 },
  M: { step: 'F', alter: 1 },
  P: { step: 'G', alter: 0 },
  D: { step: 'A', alter: 0 },
  N: { step: 'B', alter: 0 },
  r: { step: 'D', alter: -1 },
  g: { step: 'E', alter: -1 },
  d: { step: 'A', alter: -1 },
  n: { step: 'B', alter: -1 },
};

/** Full sargam names (some songs use Sa, Re, Ga instead of S, R, G) */
const FULL_NAME_TO_TOKEN: Record<string, string> = {
  Sa: 'S', Re: 'R', Ga: 'G', Ma: 'm', Pa: 'P', Dha: 'D', Ni: 'N',
};

/** Normalize base to single-letter token: full names, (k)/(T), lowercase p for low Pa */
function normalizeBase(raw: string): { token: string; low?: boolean } | null {
  const r = raw.trim();
  if (!r) return null;
  const komalK = r.match(/^(Re|Ga|Dha|Ni)\(k\)$/i);
  if (komalK) return { token: komalK[1].charAt(0).toLowerCase() };
  if (/^Ma\(T\)$/i.test(r)) return { token: 'M' };
  const fullName = r.match(/^(Sa|Re|Ga|Ma|Pa|Dha|Ni)$/i);
  if (fullName) {
    const key = fullName[1].charAt(0).toUpperCase() + fullName[1].slice(1).toLowerCase();
    const token = FULL_NAME_TO_TOKEN[key];
    if (token) return { token };
  }
  if (r === 'p') return { token: 'P', low: true };
  if (r.length === 1) return { token: r };
  return null;
}

function getMapping(mapping: NotationMapping | null): Record<string, { step: string; alter: number }> {
  const tw = mapping?.token_to_western;
  return tw && typeof tw === 'object' ? tw : TOKEN_TO_WESTERN_DEFAULT;
}

/**
 * Split a run-together token into individual note tokens.
 * Handles: "Sa..Re..Ga" (dots), "Sa'~Pa" (tilde glide), "_ReSa" (underscore rest prefix).
 */
function splitRunTogether(part: string): string[] {
  // Tilde = glide separator: "Sa'~Pa" → ["Sa'", "Pa"]
  if (part.includes('~')) {
    return part.split('~').flatMap((p) => (p ? splitRunTogether(p) : []));
  }
  // Dots before a new note: "Sa..Re.." → "Sa..  Re.."
  let s = part.replace(/(\.+)(?=[A-Za-z'(])/g, '$1 ');
  // Single dot between letters: "Sa.Re" → keep dot attached to Sa
  s = s.replace(/(?<![.])(\.)(?=[A-Za-z'(])(?!\.)/g, ' . ');
  // Underscore run-together: "_ReSa" → "_ Re Sa"
  s = s.replace(/(_+)(?=[A-Za-z'(])/g, '$1 ');
  return s.split(/\s+/).filter((tok) => tok && tok !== '.');
}

/**
 * Tokenize one Indian notation line.
 * Handles: | and , (phrase separators), … (Unicode ellipsis → dots),
 * standalone colon(s) (merged into previous token as duration suffix).
 */
function tokenize(indian: string): string[] {
  const s = indian
    .replace(/[|,]/g, ' ')       // phrase separators → space
    .replace(/…/g, ' ... ')      // Unicode ellipsis → 3 dots
    .replace(/'/g, "'")          // curly apostrophe → straight
    .trim();
  const parts = s.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    // Standalone colon(s) = duration hold marker for the previous token ("Dha :" → "Dha:")
    if (/^:+$/.test(t)) {
      if (out.length > 0) out[out.length - 1] += t;
      continue;
    }
    // Standalone 2+ dots = duration hold for previous note ("Ma ..." → "Ma...")
    // Single dot alone is discarded (just a phrase separator in some notations)
    if (/^\.{2,}$/.test(t)) {
      if (out.length > 0) out[out.length - 1] += t;
      continue;
    }
    for (const tok of splitRunTogether(t)) {
      if (tok && tok !== '.') out.push(tok);
    }
  }
  return out;
}

type ParsedTokenResult = {
  step: string; alter: number; octave: number; duration: number; indianLabel: string;
};

/**
 * Parse one token into pitch + duration.
 *
 * Duration suffix rules (applied in order of priority):
 *   Colon(s)     :=quarter(4)  ::=half(8)  :::=dotted-half(12)  ::::+=whole(16)
 *   Underscore(s) _=quarter(4) __=half(8)  ___=dotted-half(12)
 *   Dots(2+)     ..=quarter(4) ...=6  ....=half(8)  etc.
 *   Single dot   .=low-octave marker only (no duration change)
 *
 * @param lineDurationDefault  Fallback for notes with no suffix (2=eighth, 4=quarter)
 */
function parseToken(
  token: string,
  defaultOctave: number,
  mapping: NotationMapping | null,
  lineDurationDefault = 2,
): ParsedTokenResult | null {
  const map = getMapping(mapping);
  let raw = token.replace(/'/g, "'").trim();

  // Standalone rest/silence tokens: -, --, _, __, ___
  if (/^[-_]+$/.test(raw)) {
    const len = raw.length;
    const dur = len >= 4 ? 16 : len >= 3 ? 12 : len >= 2 ? 8 : 4;
    return { step: 'Z', alter: 0, octave: 4, duration: dur, indianLabel: '—' };
  }

  let low = false, high = false;
  if (raw.startsWith(',')) { low = true; raw = raw.slice(1); }
  if (raw.startsWith("'")) { high = true; raw = raw.slice(1); }

  // Extract trailing duration suffix: dots, colons, underscores
  const suffixMatch = raw.match(/[.:_]+$/);
  let duration = lineDurationDefault;
  if (suffixMatch) {
    const suffix = suffixMatch[0];
    raw = raw.slice(0, -suffix.length);
    const dots = (suffix.match(/\./g) ?? []).length;
    const colons = (suffix.match(/:/g) ?? []).length;
    const underscores = (suffix.match(/_/g) ?? []).length;

    if (colons > 0) {
      // Colon notation: 1=4, 2=8, 3=12, 4+=16
      duration = Math.min(16, colons * 4);
    } else if (underscores > 0) {
      // Trailing underscores: same scale as colons
      duration = Math.min(16, underscores * 4);
    } else if (dots === 1) {
      // Single dot = low-octave marker, no duration change
      low = true;
    } else if (dots >= 2) {
      // 2 dots = quarter(4), 3 = 6, 4 = 8, ...
      duration = Math.min(16, 2 + (dots - 1) * 2);
    }
  }

  if (raw.endsWith("'")) { high = true; raw = raw.slice(0, -1); }

  const normalized = normalizeBase(raw);
  let base: string;
  if (normalized) {
    base = normalized.token;
    if (normalized.low) low = true;
  } else {
    const komalMatch = raw.match(/^([RGDN])\(k\)$/i);
    base = komalMatch ? komalMatch[1].toLowerCase() : raw;
  }
  const w = map[base];
  if (!w) return null;
  const octave = defaultOctave + (high ? 1 : 0) - (low ? 1 : 0);
  return { step: w.step, alter: w.alter, octave, duration, indianLabel: token };
}

/**
 * Detect the best default note duration for a single notation line.
 *
 * Logic:
 *   - If the line uses dot notation (two or more dots attached to notes) → keep
 *     eighth (2) as default so that `..` creates quarters and bare notes are eighths.
 *   - Otherwise (colon / underscore / no markers) → quarter (4) as default so that
 *     unmarked notes fill beats naturally rather than becoming tiny eighth notes.
 */
function detectLineDuration(indian: string): number {
  const hasDots = /[A-Za-z']\.\.|\.{3}/.test(indian);
  return hasDots ? 2 : 4;
}

const DEFAULT_DIVISIONS = 4;

/** Convert indian notation string to flat list of ParsedNote. */
export function indianToNotes(
  indian: string,
  defaultOctave: number = 4,
  mapping: NotationMapping | null,
  divisions: number = DEFAULT_DIVISIONS
): ParsedNote[] {
  const tokens = tokenize(indian);
  const notes: ParsedNote[] = [];
  const scale = divisions / 4;
  const lineDur = detectLineDuration(indian);
  for (const t of tokens) {
    const parsed = parseToken(t, defaultOctave, mapping, lineDur);
    if (!parsed) continue;
    const dur = Math.max(1, Math.round(parsed.duration * scale));
    notes.push({ step: parsed.step, alter: parsed.alter, octave: parsed.octave, duration: dur, indianLabel: parsed.indianLabel });
  }
  return notes;
}

/** Convert full song (sections/lines) to flat list of notes. */
export function songToNoteList(
  sections: { name: string; lines: { lyrics: string; indian: string }[] }[],
  defaultOctave: number,
  mapping: NotationMapping | null,
  divisions: number = DEFAULT_DIVISIONS
): ParsedNote[] {
  const out: ParsedNote[] = [];
  for (const section of sections) {
    for (const line of section.lines || []) {
      for (const n of indianToNotes(line.indian || '', defaultOctave, mapping, divisions)) {
        out.push({ ...n, lyric: (line.lyrics || undefined) as string | undefined });
      }
    }
  }
  return out;
}

function stepAlterToLabel(step: string, alter: number): string {
  if (alter === 1) return step + '♯';
  if (alter === -1) return step + '♭';
  return step;
}

/** Convert one line of Indian notation to Western (e.g. "C D E F G") for display. */
export function indianToWestern(
  indian: string,
  defaultOctave: number = 4,
  mapping: NotationMapping | null,
  withOctave: boolean = false
): string {
  const tokens = tokenize(indian);
  const parts: string[] = [];
  for (const t of tokens) {
    const parsed = parseToken(t, defaultOctave, mapping);
    if (!parsed || parsed.step === 'Z') continue;
    parts.push(withOctave ? stepAlterToLabel(parsed.step, parsed.alter) + parsed.octave : stepAlterToLabel(parsed.step, parsed.alter));
  }
  return parts.join(' ');
}
