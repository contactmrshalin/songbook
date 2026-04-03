import { useState, useRef, useEffect, useCallback } from 'react';
import type { ParsedNote } from '../types';

// ─── Grid constants ───────────────────────────────────────────────────────────
const BEAT_DIVS = 4;                                    // 1 quarter note = 4 divisions
const BEATS_PER_MEASURE = 4;                            // 4/4 time
const SUBDIV = 2;                                       // grid cell = 1 eighth note (2 divs)
const CELLS_PER_BEAT = BEAT_DIVS / SUBDIV;              // 2 cells per beat
const CELLS_PER_MEASURE = BEATS_PER_MEASURE * CELLS_PER_BEAT; // 8 cells per measure
const CELL_W = 58;                                      // px per grid cell
const NOTE_ROW_H = 70;                                  // px: height of notes row
const HDR_MEASURE_H = 22;
const HDR_BEAT_H = 20;

// ─── Pitch / octave options ───────────────────────────────────────────────────
const PITCH_OPTIONS = [
  { token: 'S', step: 'C', alter: 0,  label: 'Sa' },
  { token: 'r', step: 'D', alter: -1, label: 'Re(k)' },
  { token: 'R', step: 'D', alter: 0,  label: 'Re' },
  { token: 'g', step: 'E', alter: -1, label: 'Ga(k)' },
  { token: 'G', step: 'E', alter: 0,  label: 'Ga' },
  { token: 'm', step: 'F', alter: 0,  label: 'Ma' },
  { token: 'M', step: 'F', alter: 1,  label: 'Ma(T)' },
  { token: 'P', step: 'G', alter: 0,  label: 'Pa' },
  { token: 'd', step: 'A', alter: -1, label: 'Dha(k)' },
  { token: 'D', step: 'A', alter: 0,  label: 'Dha' },
  { token: 'n', step: 'B', alter: -1, label: 'Ni(k)' },
  { token: 'N', step: 'B', alter: 0,  label: 'Ni' },
];
const OCTAVES = [
  { value: 3, label: '↓ Low' },
  { value: 4, label: '─ Mid' },
  { value: 5, label: '↑ High' },
];

function pitchOf(n: ParsedNote) {
  return PITCH_OPTIONS.find(p => p.step === n.step && p.alter === n.alter) ?? PITCH_OPTIONS[0];
}

function octaveMark(octave: number) {
  if (octave <= 3) return '·';
  if (octave >= 5) return "'";
  return '';
}

// ─── Grid math ────────────────────────────────────────────────────────────────
/** Cumulative start-cell index for every note in the array. */
function cellStarts(notes: ParsedNote[]): number[] {
  const out: number[] = [];
  let div = 0;
  for (const n of notes) {
    out.push(Math.round(div / SUBDIV));
    div += n.duration;
  }
  return out;
}

/** How many grid cells does this note span? */
function cellSpan(n: ParsedNote) {
  return Math.max(1, Math.round(n.duration / SUBDIV));
}

/** Total cells needed to hold all notes + one extra measure of empty slots. */
function totalCells(notes: ParsedNote[]) {
  const totalDiv = notes.reduce((s, n) => s + n.duration, 0);
  const used = Math.ceil(totalDiv / SUBDIV);
  return Math.max(CELLS_PER_MEASURE, used) + CELLS_PER_MEASURE;
}

/** Given a set of existing notes (without the dragged one), find the insert
 *  index such that the note will start at `targetCell`. */
function insertIndexForCell(notes: ParsedNote[], skipIdx: number, targetCell: number): number {
  const targetDiv = targetCell * SUBDIV;
  let cumDiv = 0;
  for (let i = 0; i < notes.length; i++) {
    if (i === skipIdx) continue;
    if (cumDiv >= targetDiv) return i;
    cumDiv += notes[i].duration;
  }
  return notes.length;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface NoteGridProps {
  notes: ParsedNote[];
  playingNoteIndex: number | null;
  onNotesChange: (notes: ParsedNote[]) => void;
}

export function NoteGrid({ notes, playingNoteIndex, onNotesChange }: NoteGridProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dropCell, setDropCell] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Close editor on outside click
  useEffect(() => {
    if (editingIdx === null) return;
    const handler = (e: MouseEvent) => {
      if (editorRef.current && !editorRef.current.contains(e.target as Node)) {
        setEditingIdx(null);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [editingIdx]);

  // Auto-scroll to playing note
  useEffect(() => {
    if (playingNoteIndex === null || !scrollRef.current) return;
    const starts = cellStarts(notes);
    const cell = starts[playingNoteIndex];
    if (cell === undefined) return;
    const left = cell * CELL_W;
    const { scrollLeft, clientWidth } = scrollRef.current;
    if (left < scrollLeft || left + CELL_W > scrollLeft + clientWidth) {
      scrollRef.current.scrollLeft = Math.max(0, left - 100);
    }
  }, [playingNoteIndex, notes]);

  const starts = cellStarts(notes);
  const nCells = totalCells(notes);
  const nMeasures = Math.ceil(nCells / CELLS_PER_MEASURE);

  // Build occupied cell set (every cell covered by any note)
  const occupiedCells = new Set<number>();
  notes.forEach((n, i) => {
    const s = starts[i];
    const span = cellSpan(n);
    for (let c = s; c < s + span; c++) occupiedCells.add(c);
  });

  // ─── Drag handlers ──────────────────────────────────────────────────────────
  const getCellFromX = useCallback((clientX: number): number => {
    const el = scrollRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + el.scrollLeft;
    return Math.max(0, Math.min(nCells - 1, Math.floor(x / CELL_W)));
  }, [nCells]);

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragFromIdx(idx);
    setEditingIdx(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (dragFromIdx === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropCell(getCellFromX(e.clientX));
  }, [dragFromIdx, getCellFromX]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const from = dragFromIdx ?? parseInt(e.dataTransfer.getData('text/plain'), 10);
    const cell = dropCell ?? getCellFromX(e.clientX);
    setDragFromIdx(null);
    setDropCell(null);
    if (Number.isNaN(from) || from < 0 || from >= notes.length) return;

    // Remove the note, recompute positions, find correct insert slot
    const arr = [...notes];
    const [removed] = arr.splice(from, 1);
    const insertAt = insertIndexForCell(arr, -1, cell);
    arr.splice(insertAt, 0, removed);
    onNotesChange(arr);
  }, [notes, dragFromIdx, dropCell, getCellFromX, onNotesChange]);

  const handleDragEnd = useCallback(() => {
    setDragFromIdx(null);
    setDropCell(null);
  }, []);

  // ─── Edit helpers ────────────────────────────────────────────────────────────
  const updateNote = (idx: number, patch: Partial<ParsedNote>) => {
    onNotesChange(notes.map((n, i) => i === idx ? { ...n, ...patch } : n));
  };

  const updatePitch = (idx: number, token: string, octave: number) => {
    const opt = PITCH_OPTIONS.find(p => p.token === token);
    if (!opt) return;
    const mark = octaveMark(octave);
    updateNote(idx, { step: opt.step, alter: opt.alter, octave, indianLabel: opt.label + mark });
  };

  const changeDuration = (idx: number, delta: number) => {
    const n = notes[idx];
    updateNote(idx, { duration: Math.max(SUBDIV, Math.min(BEAT_DIVS * 4, n.duration + delta * SUBDIV)) });
  };

  const removeNote = (idx: number) => {
    setEditingIdx(null);
    onNotesChange(notes.filter((_, i) => i !== idx));
  };

  const addNoteAtCell = (cell: number) => {
    const arr = [...notes];
    const targetDiv = cell * SUBDIV;
    let cumDiv = 0;
    let insertAt = arr.length;
    for (let i = 0; i < arr.length; i++) {
      if (cumDiv >= targetDiv) { insertAt = i; break; }
      cumDiv += arr[i].duration;
    }
    const newNote: ParsedNote = { step: 'C', alter: 0, octave: 4, duration: SUBDIV * 2, indianLabel: 'Sa' };
    arr.splice(insertAt, 0, newNote);
    onNotesChange(arr);
    setEditingIdx(insertAt);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  const gridWidth = nCells * CELL_W;

  return (
    <div className="note-grid-wrap">
      <div className="note-grid-scroll" ref={scrollRef}>
        <div className="note-grid" style={{ width: gridWidth }}>

          {/* ── Row 1: measure headers ───────────────────────── */}
          <div className="ngr ngr--measures" style={{ height: HDR_MEASURE_H }}>
            {Array.from({ length: nMeasures }, (_, m) => (
              <div
                key={m}
                className="ng-measure-label"
                style={{ left: m * CELLS_PER_MEASURE * CELL_W, width: CELLS_PER_MEASURE * CELL_W }}
              >
                M {m + 1}
              </div>
            ))}
          </div>

          {/* ── Row 2: beat labels ───────────────────────────── */}
          <div className="ngr ngr--beats" style={{ height: HDR_BEAT_H }}>
            {Array.from({ length: nCells }, (_, c) => {
              const sub = c % CELLS_PER_BEAT;
              const beat = Math.floor(c / CELLS_PER_BEAT) % BEATS_PER_MEASURE;
              return (
                <div
                  key={c}
                  className={`ng-beat-label ${sub === 0 ? 'ng-beat-label--strong' : ''}`}
                  style={{ left: c * CELL_W, width: CELL_W }}
                >
                  {sub === 0 ? beat + 1 : '·'}
                </div>
              );
            })}
          </div>

          {/* ── Row 3: notes ─────────────────────────────────── */}
          <div
            className="ngr ngr--notes"
            style={{ height: NOTE_ROW_H + (editingIdx !== null ? 130 : 0) }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropCell(null);
            }}
          >
            {/* Cell backgrounds + empty-slot buttons */}
            {Array.from({ length: nCells }, (_, c) => {
              const isOccupied = occupiedCells.has(c);
              const isMeasureStart = c % CELLS_PER_MEASURE === 0;
              const isBeatStart = c % CELLS_PER_BEAT === 0;
              const isDropTarget = dropCell === c;
              return (
                <div
                  key={c}
                  className={[
                    'ng-cell',
                    isMeasureStart ? 'ng-cell--measure' : '',
                    isBeatStart ? 'ng-cell--beat' : '',
                    isDropTarget ? 'ng-cell--drop' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ left: c * CELL_W, width: CELL_W, height: NOTE_ROW_H }}
                >
                  {!isOccupied && (
                    <button
                      type="button"
                      className="ng-add-btn"
                      onClick={() => addNoteAtCell(c)}
                      title={`Add note at beat ${Math.floor(c / CELLS_PER_BEAT) % BEATS_PER_MEASURE + 1}`}
                    >+</button>
                  )}
                </div>
              );
            })}

            {/* Drop position line */}
            {dropCell !== null && (
              <div className="ng-drop-line" style={{ left: dropCell * CELL_W }} />
            )}

            {/* Note cards */}
            {notes.map((note, i) => {
              const left = starts[i] * CELL_W;
              const width = cellSpan(note) * CELL_W - 4;
              const pitch = pitchOf(note);
              const isPlaying = playingNoteIndex === i;
              const isDragging = dragFromIdx === i;
              const isEditing = editingIdx === i;
              return (
                <div
                  key={i}
                  className={[
                    'ng-note',
                    isPlaying ? 'ng-note--playing' : '',
                    isDragging ? 'ng-note--dragging' : '',
                    isEditing ? 'ng-note--editing' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ left, width, height: NOTE_ROW_H - 8, top: 4 }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingIdx(isEditing ? null : i);
                  }}
                  title={`${pitch.label} (${OCTAVES.find(o => o.value === note.octave)?.label}) — click to edit, drag to move`}
                >
                  <span className="ng-note-label">
                    {octaveMark(note.octave)}{pitch.label}
                  </span>
                  <span className="ng-note-dur">
                    {note.duration / BEAT_DIVS}b
                  </span>
                  {isPlaying && <span className="ng-note-pulse" />}

                  {/* Inline editor popup */}
                  {isEditing && (
                    <div
                      className="ng-editor"
                      ref={editorRef}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="ng-editor-row">
                        <label className="ng-editor-label">Pitch</label>
                        <select
                          className="ng-editor-select"
                          value={pitch.token}
                          onChange={(e) => updatePitch(i, e.target.value, note.octave)}
                        >
                          {PITCH_OPTIONS.map(p => (
                            <option key={p.token} value={p.token}>{p.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="ng-editor-row">
                        <label className="ng-editor-label">Octave</label>
                        <select
                          className="ng-editor-select"
                          value={note.octave}
                          onChange={(e) => updatePitch(i, pitch.token, Number(e.target.value))}
                        >
                          {OCTAVES.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="ng-editor-row">
                        <label className="ng-editor-label">Duration</label>
                        <div className="ng-editor-dur">
                          <button type="button" onClick={() => changeDuration(i, -1)}>−</button>
                          <span>{note.duration / BEAT_DIVS}b</span>
                          <button type="button" onClick={() => changeDuration(i, +1)}>+</button>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ng-editor-delete"
                        onClick={() => removeNote(i)}
                      >
                        Remove note
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {notes.length === 0 && (
        <div className="ng-empty">
          <p>No notes yet. Click any <strong>+</strong> above to add the first note.</p>
        </div>
      )}
    </div>
  );
}
