import type { ParsedNote } from '../types';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function durationToType(divisions: number, dur: number): string {
  const quarter = divisions;
  if (dur <= quarter / 2) return 'eighth';
  if (dur <= quarter) return 'quarter';
  if (dur <= quarter * 2) return 'half';
  return 'whole';
}

/** Build MusicXML (score-partwise) from a flat list of notes. */
export function notesToMusicXML(
  notes: ParsedNote[],
  title: string,
  options: { divisions?: number; beats?: number; beatType?: number } = {}
): string {
  const divisions = options.divisions ?? 4;
  const beats = options.beats ?? 4;
  const beatType = options.beatType ?? 4;
  const notesPerMeasure = beats * (divisions / (beatType === 4 ? 1 : 2));
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">'
  );
  lines.push('<score-partwise version="3.1">');
  lines.push(`  <work><work-title>${esc(title)}</work-title></work>`);
  lines.push('  <identification><encoding><software>Songbook Player</software></encoding></identification>');
  lines.push('  <part-list><score-part id="P1"><part-name>Lead</part-name></score-part></part-list>');
  lines.push('  <part id="P1">');

  let measureNo = 1;
  let currentUnits = 0;

  function startMeasure(first: boolean) {
    lines.push(`    <measure number="${measureNo}">`);
    if (first) {
      lines.push('      <attributes>');
      lines.push(`        <divisions>${divisions}</divisions>`);
      lines.push('        <key><fifths>0</fifths></key>');
      lines.push(`        <time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>`);
      lines.push('        <clef><sign>G</sign><line>2</line></clef>');
      lines.push('      </attributes>');
    }
    currentUnits = 0;
  }

  function endMeasure() {
    lines.push('    </measure>');
  }

  function emitNote(n: ParsedNote) {
    const dur = Math.max(1, n.duration);
    const noteType = durationToType(divisions, dur);
    lines.push('      <note>');
    lines.push('        <pitch>');
    lines.push(`          <step>${n.step}</step>`);
    if (n.alter !== 0) lines.push(`          <alter>${n.alter}</alter>`);
    lines.push(`          <octave>${n.octave}</octave>`);
    lines.push('        </pitch>');
    lines.push(`        <duration>${dur}</duration>`);
    lines.push(`        <type>${noteType}</type>`);
    if (n.indianLabel) lines.push(`        <lyric number="1"><text>${esc(n.indianLabel)}</text></lyric>`);
    if (n.lyric) lines.push(`        <lyric number="2"><text>${esc(n.lyric)}</text></lyric>`);
    lines.push('      </note>');
  }

  startMeasure(true);
  for (const n of notes) {
    const dur = Math.max(1, n.duration);
    if (currentUnits + dur > notesPerMeasure) {
      endMeasure();
      measureNo++;
      startMeasure(false);
    }
    emitNote(n);
    currentUnits += dur;
  }
  endMeasure();
  lines.push('  </part>');
  lines.push('</score-partwise>');
  return lines.join('\n');
}
