/**
 * toMusicXml.ts
 *
 * Converts a Song's Indian sargam (word-token notation) into MusicXML 3.1.
 *
 * This is a TypeScript port of scripts/build_songbook.py :: make_musicxml_per_song(),
 * but uses a direct word-token → pitch lookup table instead of the Python
 * intermediate letter-notation step, thereby avoiding the Ma/ma ambiguity bug
 * (Python's re.IGNORECASE conflates tivra Ma with shuddh ma).
 *
 * Token conventions (follows toAbc.ts TOKEN_TO_ABC_PITCH):
 *   Ma  (bare)  = tivra Ma = F#   ← NOT F♮ (Python bug)
 *   ma  (bare)  = shuddh ma = F♮
 *   sa/re/ga/pa/dha/ni = mandra saptak (lower octave)
 *   Sa'/Re'/…   = taar saptak (upper octave, apostrophe suffix)
 *   Re(k)/Ga(k)/Dha(k)/Ni(k) = komal (flat) variants
 *   Ma(T)       = tivra Ma, explicit
 *   (X)Y        = kan ornament: grace note X then main note Y
 *   :           = hold — each colon doubles duration (eighth → quarter → half …)
 *   ~           = meend (stripped — see Notes below)
 *   |           = explicit bar line → start new measure
 *   - _ 0       = rest
 *
 * Notes / limitations:
 * - All base notes are eighth notes (1 unit); hold ':' doubles duration.
 * - Meend '~' marks are stripped (slurs not generated — keeps output simple).
 * - Grace notes (kan) have no duration in MusicXML per spec.
 * - Automatic bar lines are inserted every 8 eighth-note units (one 4/4 bar)
 *   when the source data has no explicit '|' tokens.
 * - Each SongSection name is emitted as a direction text in the measure where
 *   the section begins.
 */

import type { Song } from "@/types/song";

// ── Pitch descriptor ──────────────────────────────────────────────────────────

interface PitchInfo {
  step: string;         // C D E F G A B
  alter: number;        // -1 flat  0 natural  +1 sharp
  octaveOffset: number; // relative to DEFAULT_OCTAVE (0 → 4, -1 → 3, +1 → 5)
}

// ── Word-token → pitch lookup table ──────────────────────────────────────────

const WORD_TO_PITCH: Record<string, PitchInfo> = {
  // Madhya saptak — middle octave (C4–B4)
  Sa:        { step: "C", alter:  0, octaveOffset:  0 },
  Re:        { step: "D", alter:  0, octaveOffset:  0 },
  Ga:        { step: "E", alter:  0, octaveOffset:  0 },
  ma:        { step: "F", alter:  0, octaveOffset:  0 },  // shuddh ma = F♮
  Ma:        { step: "F", alter:  1, octaveOffset:  0 },  // tivra Ma  = F#
  Pa:        { step: "G", alter:  0, octaveOffset:  0 },
  Dha:       { step: "A", alter:  0, octaveOffset:  0 },
  Ni:        { step: "B", alter:  0, octaveOffset:  0 },

  // Mandra saptak — lower octave (C3–B3)
  sa:        { step: "C", alter:  0, octaveOffset: -1 },
  re:        { step: "D", alter:  0, octaveOffset: -1 },
  ga:        { step: "E", alter:  0, octaveOffset: -1 },
  // lowercase 'ma' already covers shuddh middle; no lowercase mandra 'ma' defined
  pa:        { step: "G", alter:  0, octaveOffset: -1 },
  dha:       { step: "A", alter:  0, octaveOffset: -1 },
  ni:        { step: "B", alter:  0, octaveOffset: -1 },

  // Taar saptak — upper octave (C5–B5), apostrophe suffix
  "Sa'":     { step: "C", alter:  0, octaveOffset:  1 },
  "Re'":     { step: "D", alter:  0, octaveOffset:  1 },
  "Ga'":     { step: "E", alter:  0, octaveOffset:  1 },
  "ma'":     { step: "F", alter:  0, octaveOffset:  1 },
  "Ma'":     { step: "F", alter:  1, octaveOffset:  1 },
  "Pa'":     { step: "G", alter:  0, octaveOffset:  1 },
  "Dha'":    { step: "A", alter:  0, octaveOffset:  1 },
  "Ni'":     { step: "B", alter:  0, octaveOffset:  1 },

  // Komal (flat) variants
  "Re(k)":   { step: "D", alter: -1, octaveOffset:  0 },
  "Ga(k)":   { step: "E", alter: -1, octaveOffset:  0 },
  "Dha(k)":  { step: "A", alter: -1, octaveOffset:  0 },
  "Ni(k)":   { step: "B", alter: -1, octaveOffset:  0 },

  // Tivra Ma — explicit (same pitch as bare Ma)
  "Ma(T)":   { step: "F", alter:  1, octaveOffset:  0 },

  // Single-letter abbreviations (uppercase = middle octave, per toAbc.ts)
  S:         { step: "C", alter:  0, octaveOffset:  0 },
  R:         { step: "D", alter:  0, octaveOffset:  0 },
  G:         { step: "E", alter:  0, octaveOffset:  0 },
  M:         { step: "F", alter:  1, octaveOffset:  0 },  // tivra by convention
  P:         { step: "G", alter:  0, octaveOffset:  0 },
  D:         { step: "A", alter:  0, octaveOffset:  0 },
  N:         { step: "B", alter:  0, octaveOffset:  0 },
};

// ── Constants ─────────────────────────────────────────────────────────────────

const DIVISIONS        = 2;                        // quarter note = 2 units
const BEATS            = 4;
const BEAT_TYPE        = 4;
const UNITS_PER_MEASURE = BEATS * DIVISIONS;       // 8 eighth-note units per measure
const DEFAULT_OCTAVE   = 4;

// ── XML utilities ─────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function indentBlock(xml: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return xml
    .split("\n")
    .map((l) => (l.trim() ? pad + l : l))
    .join("\n");
}

function durationToType(units: number): string {
  if (units >= 8) return "whole";
  if (units >= 4) return "half";
  if (units >= 2) return "quarter";
  return "eighth";
}

// ── XML block builders ────────────────────────────────────────────────────────

function buildNoteXml(
  pitch: PitchInfo,
  duration: number,
  lyric: string,
  isGrace: boolean
): string {
  const octave = DEFAULT_OCTAVE + pitch.octaveOffset;
  const lines: string[] = ["<note>"];

  if (isGrace) {
    lines.push("  <grace/>");
  }

  lines.push("  <pitch>");
  lines.push(`    <step>${pitch.step}</step>`);
  if (pitch.alter !== 0) {
    lines.push(`    <alter>${pitch.alter}</alter>`);
  }
  lines.push(`    <octave>${octave}</octave>`);
  lines.push("  </pitch>");

  if (!isGrace) {
    lines.push(`  <duration>${duration}</duration>`);
    lines.push(`  <type>${durationToType(duration)}</type>`);
  }

  if (lyric) {
    lines.push(`  <lyric number="1">`);
    lines.push(`    <syllabic>single</syllabic>`);
    lines.push(`    <text>${escapeXml(lyric)}</text>`);
    lines.push("  </lyric>");
  }

  lines.push("</note>");
  return lines.join("\n");
}

function buildRestXml(duration: number): string {
  return [
    "<note>",
    "  <rest/>",
    `  <duration>${duration}</duration>`,
    `  <type>${durationToType(duration)}</type>`,
    "</note>",
  ].join("\n");
}

function buildDirectionXml(text: string): string {
  return [
    '<direction placement="above">',
    "  <direction-type>",
    `    <words>${escapeXml(text)}</words>`,
    "  </direction-type>",
    "</direction>",
  ].join("\n");
}

// ── Token parser ──────────────────────────────────────────────────────────────

type TokenItem =
  | { kind: "note";  token: string; duration: number; lyric: string; isGrace: boolean }
  | { kind: "rest";  duration: number }
  | { kind: "bar" };

/** Strip ornament characters, leaving the canonical note name. */
function cleanToken(raw: string): string {
  return raw.replace(/[:/~^.]/g, "").trim();
}

/** Parse a single space-separated raw token into one or more token items. */
function parseToken(raw: string): TokenItem[] {
  // Explicit bar line
  if (raw === "|") return [{ kind: "bar" }];

  // Explicit rest
  if (raw === "-" || raw === "_" || raw === "0") {
    return [{ kind: "rest", duration: 1 }];
  }

  // Kan grace note: (X)Y  →  grace note X  +  main note Y
  const kanMatch = raw.match(/^\(([^)]+)\)(.+)$/);
  if (kanMatch) {
    const graceClean = cleanToken(kanMatch[1]);
    const mainItems  = parseMainToken(kanMatch[2]);
    if (graceClean && mainItems.length > 0) {
      return [
        { kind: "note", token: graceClean, duration: 1, lyric: graceClean, isGrace: true },
        ...mainItems,
      ];
    }
    return mainItems;
  }

  return parseMainToken(raw);
}

function parseMainToken(raw: string): TokenItem[] {
  // Count hold markers: each ':' doubles duration
  const holdCount = (raw.match(/:/g) ?? []).length;
  const clean     = cleanToken(raw);
  if (!clean) return [];
  const duration  = holdCount > 0 ? Math.pow(2, holdCount) : 1;
  return [{ kind: "note", token: clean, duration, lyric: clean, isGrace: false }];
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Convert a Song into a MusicXML 3.1 document string.
 *
 * Called by the admin publish route to regenerate the .musicxml file every
 * time a song's sargam notation is saved.
 */
export function songToMusicXml(song: Song): string {
  // Each measure holds a list of pre-built XML block strings (unindented)
  const measures: string[][] = [[]];
  let unitsInMeasure = 0;

  function cur(): string[] { return measures[measures.length - 1]; }

  function startNewMeasure(): void {
    measures.push([]);
    unitsInMeasure = 0;
  }

  function addBlock(xml: string, units: number, isGrace: boolean): void {
    // Auto-bar: if non-grace note would overflow current measure, open a new one first
    if (!isGrace && unitsInMeasure > 0 && unitsInMeasure + units > UNITS_PER_MEASURE) {
      startNewMeasure();
    }
    cur().push(xml);
    if (!isGrace) unitsInMeasure += units;
  }

  // ── Process all sections ─────────────────────────────────────────────────
  for (const section of song.sections) {
    // Section name → direction in the measure where this section starts
    cur().push(buildDirectionXml(section.name));

    for (const songLine of section.lines) {
      const indian = (songLine.indian ?? "").trim();
      if (!indian) continue;

      for (const raw of indian.split(/\s+/).filter(Boolean)) {
        for (const item of parseToken(raw)) {
          if (item.kind === "bar") {
            startNewMeasure();
            continue;
          }
          if (item.kind === "rest") {
            addBlock(buildRestXml(item.duration), item.duration, false);
            continue;
          }
          // Note (regular or grace)
          const pitch = WORD_TO_PITCH[item.token];
          if (!pitch) {
            // Unknown token → silent rest (grace notes silently skipped)
            if (!item.isGrace) {
              addBlock(buildRestXml(item.duration), item.duration, false);
            }
            continue;
          }
          addBlock(
            buildNoteXml(pitch, item.duration, item.lyric, item.isGrace),
            item.duration,
            item.isGrace
          );
        }
      }
    }
  }

  // ── Assemble <measure> elements ──────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const measureLines: string[] = [];
  let displayNum = 0;

  for (let i = 0; i < measures.length; i++) {
    const blocks = measures[i];
    // Skip empty non-first measures (artefacts of back-to-back explicit bar lines)
    if (blocks.length === 0 && i > 0) continue;

    displayNum++;
    measureLines.push(`    <measure number="${displayNum}">`);

    // First measure always gets the attribute block
    if (displayNum === 1) {
      measureLines.push(
        "      <attributes>",
        `        <divisions>${DIVISIONS}</divisions>`,
        "        <key>",
        "          <fifths>0</fifths>",
        "        </key>",
        "        <time>",
        `          <beats>${BEATS}</beats>`,
        `          <beat-type>${BEAT_TYPE}</beat-type>`,
        "        </time>",
        "        <clef>",
        "          <sign>G</sign>",
        "          <line>2</line>",
        "        </clef>",
        "      </attributes>"
      );
    }

    for (const block of blocks) {
      measureLines.push(indentBlock(block, 6));
    }

    measureLines.push("    </measure>");
  }

  // ── Build complete document ──────────────────────────────────────────────
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC',
    '  "-//Recordare//DTD MusicXML 3.1 Partwise//EN"',
    '  "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="3.1">',
    "  <work>",
    `    <work-title>${escapeXml(song.title)}</work-title>`,
    "  </work>",
    "  <identification>",
    "    <encoding>",
    "      <software>Songbook Pipeline</software>",
    `      <encoding-date>${today}</encoding-date>`,
    "    </encoding>",
    "  </identification>",
    "  <part-list>",
    '    <score-part id="P1">',
    "      <part-name>Voice</part-name>",
    "    </score-part>",
    "  </part-list>",
    '  <part id="P1">',
    ...measureLines,
    "  </part>",
    "</score-partwise>",
  ].join("\n");
}
