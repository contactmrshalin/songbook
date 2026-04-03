/**
 * NoteStaff – SVG-rendered interactive sheet music.
 *
 * - Treble-clef staff with barlines + beat guides
 * - Note heads (filled/open), stems, flags, ledger lines, accidentals
 * - Indian sargam label below each note
 * - Drag a note: X = timing position, Y = pitch
 * - Click empty staff area → add note at that pitch & beat
 * - Click existing note → open inline editor (pitch, octave, duration, delete)
 * - Playing note is highlighted with a pulsing ring
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ParsedNote } from '../types';

// ─── Grid / Staff constants ───────────────────────────────────────────────────
const LINE_SPACING = 14;                             // px between adjacent staff lines
const HALF = LINE_SPACING / 2;                       // px per diatonic step
const CELL_W = 68;                                   // px per grid cell (= 1 eighth note)
const BEATS_PER_MEASURE = 4;
const BEAT_DIVS = 4;                                 // divisions per quarter note
const SUBDIV = 2;                                    // grid cell = 1 eighth note (2 divs)
const CELLS_PER_BEAT = BEAT_DIVS / SUBDIV;           // 2
const CELLS_PER_MEASURE = BEATS_PER_MEASURE * CELLS_PER_BEAT; // 8

// Treble clef offset (space for the clef symbol + time signature)
const CLEF_W = 52;

// Staff lines: E4=2, G4=4, B4=6, D5=8, F5=10  (diatonic slots, C4=0)
const STAFF_LINES = [2, 4, 6, 8, 10];
const STAFF_TOP = 10;                                // topmost slot to display (above top line)
const STAFF_BOT = -8;                                // lowest slot (below low notes)
const SVG_PAD_TOP = 22;                              // px above STAFF_TOP slot
const SVG_PAD_BOT = 40;                              // px below STAFF_BOT (room for labels)
const SVG_H = SVG_PAD_TOP + (STAFF_TOP - STAFF_BOT) * HALF + SVG_PAD_BOT;

// ─── Pitch helpers ────────────────────────────────────────────────────────────
const DIA: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const DIA_STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** Diatonic slot: C4=0, D4=1, … B4=6, C5=7, … B3=-1, C3=-7 */
function noteSlot(step: string, octave: number) {
  return (octave - 4) * 7 + (DIA[step] ?? 0);
}

/** Slot → { step, octave } (no accidental) */
function slotToNote(slot: number) {
  const stepIdx = ((slot % 7) + 7) % 7;
  const octave = 4 + Math.floor(slot / 7);
  return { step: DIA_STEPS[stepIdx], octave };
}

/** Y coordinate for a slot on the SVG */
function slotY(slot: number) {
  return SVG_PAD_TOP + (STAFF_TOP - slot) * HALF;
}

/** Ledger line slots needed for a note at this slot */
function ledgerSlots(slot: number): number[] {
  const out: number[] = [];
  if (slot <= 0) {
    // slots 0, -2, -4 … down to slot
    for (let s = 0; s >= slot; s -= 2) out.push(s);
  }
  if (slot >= 12) {
    for (let s = 12; s <= slot; s += 2) out.push(s);
  }
  return out;
}

// ─── Pitch options ────────────────────────────────────────────────────────────
const PITCH_OPTIONS = [
  { token: '-', step: 'Z', alter: 0,  label: 'Rest' },
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
  { value: 3, label: '↓ Low (oct 3)' },
  { value: 4, label: '─ Mid (oct 4)' },
  { value: 5, label: '↑ High (oct 5)' },
];

function pitchOf(n: ParsedNote) {
  return PITCH_OPTIONS.find(p => p.step === n.step && p.alter === n.alter) ?? PITCH_OPTIONS[0];
}
function octaveMark(o: number) { return o <= 3 ? '·' : o >= 5 ? "'" : ''; }
function durLabel(divs: number) {
  const b = divs / BEAT_DIVS;
  if (b >= 4) return 'whole'; if (b >= 2) return 'half';
  if (b >= 1) return 'qtr'; return '8th';
}

// ─── Timeline helpers ─────────────────────────────────────────────────────────
function cellStarts(notes: ParsedNote[]) {
  const out: number[] = []; let d = 0;
  for (const n of notes) { out.push(Math.round(d / SUBDIV)); d += n.duration; }
  return out;
}
function cellSpan(n: ParsedNote) { return Math.max(1, Math.round(n.duration / SUBDIV)); }
function totalCells(notes: ParsedNote[]) {
  const used = Math.ceil(notes.reduce((s, n) => s + n.duration, 0) / SUBDIV);
  return Math.max(CELLS_PER_MEASURE, used) + CELLS_PER_MEASURE;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface NoteStaffProps {
  notes: ParsedNote[];
  playingNoteIndex: number | null;
  onNotesChange: (notes: ParsedNote[]) => void;
}

interface DragState {
  idx: number; startX: number; startY: number;
  startCell: number; startSlot: number;
}

export function NoteStaff({ notes, playingNoteIndex, onNotesChange }: NoteStaffProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Drag state split into two parts:
  //   dragInfo  – stable ref, never goes stale inside event handlers
  //   dragPreview – state only for triggering re-renders of the ghost note
  const dragInfoRef = useRef<DragState | null>(null);
  const dragPreviewRef = useRef<{ cell: number; slot: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState<{ cell: number; slot: number } | null>(null);

  // Keep a ref to the latest notes so event handlers never go stale
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const starts = useMemo(() => cellStarts(notes), [notes]);
  const nCells = useMemo(() => totalCells(notes), [notes]);
  const nMeasures = Math.ceil(nCells / CELLS_PER_MEASURE);
  const svgWidth = CLEF_W + nCells * CELL_W;

  // ── Close editor on outside click ──────────────────────────────────────────
  useEffect(() => {
    if (selectedIdx === null) return;
    const h = (e: MouseEvent) => {
      if (editorRef.current && !editorRef.current.contains(e.target as Node)) setSelectedIdx(null);
    };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [selectedIdx]);

  // ── Auto-scroll to playing note ────────────────────────────────────────────
  useEffect(() => {
    if (playingNoteIndex === null || !scrollRef.current) return;
    const c = starts[playingNoteIndex];
    if (c === undefined) return;
    const x = CLEF_W + c * CELL_W;
    const { scrollLeft, clientWidth } = scrollRef.current;
    if (x < scrollLeft || x + CELL_W * 2 > scrollLeft + clientWidth)
      scrollRef.current.scrollLeft = Math.max(0, x - 80);
  }, [playingNoteIndex, starts]);

  // ── Apply drag result (reads notesRef, so always fresh) ───────────────────
  const applyDrag = useCallback((d: DragState, newCell: number, newSlot: number) => {
    const arr = [...notesRef.current];
    const note = { ...arr[d.idx] };
    // Pitch change — rests keep same pitch
    if (note.step !== 'Z' && newSlot !== d.startSlot) {
      const { step, octave } = slotToNote(newSlot);
      const keepAlter = step === note.step ? note.alter : 0;
      note.step = step; note.octave = octave; note.alter = keepAlter;
      const opt = PITCH_OPTIONS.find(p => p.step === step && p.alter === keepAlter);
      note.indianLabel = (opt?.label ?? step) + octaveMark(octave);
    }
    // Timing change: re-insert at new position
    arr.splice(d.idx, 1);
    const targetDiv = newCell * SUBDIV;
    let cum = 0, insertAt = arr.length;
    for (let i = 0; i < arr.length; i++) {
      if (cum >= targetDiv) { insertAt = i; break; }
      cum += arr[i].duration;
    }
    arr.splice(insertAt, 0, note);
    onNotesChange(arr);
  }, [onNotesChange]);

  // ── Global drag listeners — only attached while dragging ──────────────────
  // The effect depends only on isDragging (a boolean), so it is set up once
  // when drag starts and torn down when drag ends. All mutable values
  // (drag position, latest notes, nCells) are read from refs so they never stale.
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      const d = dragInfoRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const maxCell = totalCells(notesRef.current) - 1;
      const cell = Math.max(0, Math.min(maxCell, d.startCell + Math.round(dx / CELL_W)));
      const slot = Math.max(STAFF_BOT, Math.min(STAFF_TOP, d.startSlot - Math.round(dy / HALF)));
      dragPreviewRef.current = { cell, slot };
      setDragPreview({ cell, slot }); // trigger re-render of ghost
    };

    const onUp = (e: MouseEvent) => {
      const d = dragInfoRef.current;
      const preview = dragPreviewRef.current;
      if (d) {
        const totalDx = Math.abs(e.clientX - d.startX);
        const totalDy = Math.abs(e.clientY - d.startY);
        const moved = totalDx > 5 || totalDy > 5;
        if (!moved) {
          // Treat as click → open editor
          setSelectedIdx(d.idx);
        } else if (preview) {
          applyDrag(d, preview.cell, preview.slot);
        }
      }
      dragInfoRef.current = null;
      dragPreviewRef.current = null;
      setIsDragging(false);
      setDragPreview(null);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, applyDrag]);

  // Prevents the SVG onClick from firing after a note head mousedown bubbles a click up
  const suppressNextClickRef = useRef(false);

  /** Start a drag. Called from note onMouseDown handlers. */
  const startDrag = useCallback((e: React.MouseEvent, idx: number, startCell: number, startSlot: number) => {
    e.stopPropagation();
    e.preventDefault();
    suppressNextClickRef.current = true;   // block the click that will bubble to SVG
    dragInfoRef.current = { idx, startX: e.clientX, startY: e.clientY, startCell, startSlot };
    dragPreviewRef.current = { cell: startCell, slot: startSlot };
    setDragPreview({ cell: startCell, slot: startSlot });
    setIsDragging(true);
    setSelectedIdx(null);
  }, []);

  // ── SVG click → add note ───────────────────────────────────────────────────
  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // Block clicks that bubbled up from a note/rest mousedown
    if (suppressNextClickRef.current) { suppressNextClickRef.current = false; return; }
    // Block if a drag with movement just finished
    if (isDragging) return;

    const scroll = scrollRef.current; if (!scroll) return;
    const rect = scroll.getBoundingClientRect();
    const x = e.clientX - rect.left + scroll.scrollLeft - CLEF_W;
    const y = e.clientY - rect.top;
    if (x < 0) return;

    const cell = Math.max(0, Math.min(nCells - 1, Math.floor(x / CELL_W)));
    const slot = Math.round(STAFF_TOP - (y - SVG_PAD_TOP) / HALF);
    const clamped = Math.max(STAFF_BOT, Math.min(STAFF_TOP, slot));

    const { step, octave } = slotToNote(clamped);
    const opt = PITCH_OPTIONS.find(p => p.step === step && p.alter === 0);
    const newNote: ParsedNote = {
      step, alter: 0, octave, duration: BEAT_DIVS,
      indianLabel: (opt?.label ?? step) + octaveMark(octave),
    };

    // Insert at the clicked beat position; existing notes after it shift right
    const arr = [...notes];
    const targetDiv = cell * SUBDIV;
    let cum = 0, ins = arr.length;
    for (let i = 0; i < arr.length; i++) {
      if (cum >= targetDiv) { ins = i; break; }
      cum += arr[i].duration;
    }
    arr.splice(ins, 0, newNote);
    onNotesChange(arr);
    setSelectedIdx(ins);
  }, [isDragging, notes, nCells, onNotesChange]);

  // ── Edit helpers ──────────────────────────────────────────────────────────
  const updateNote = (idx: number, patch: Partial<ParsedNote>) =>
    onNotesChange(notes.map((n, i) => i === idx ? { ...n, ...patch } : n));

  const updatePitch = (idx: number, token: string, octave: number) => {
    const opt = PITCH_OPTIONS.find(p => p.token === token); if (!opt) return;
    if (opt.step === 'Z') {
      updateNote(idx, { step: 'Z', alter: 0, octave: 4, indianLabel: '—' });
    } else {
      updateNote(idx, { step: opt.step, alter: opt.alter, octave, indianLabel: opt.label + octaveMark(octave) });
    }
  };

  const changeDur = (idx: number, delta: number) => {
    const n = notes[idx];
    updateNote(idx, { duration: Math.max(SUBDIV, Math.min(BEAT_DIVS * 4, n.duration + delta * SUBDIV)) });
  };

  const removeNote = (idx: number) => { setSelectedIdx(null); onNotesChange(notes.filter((_, i) => i !== idx)); };

  /** Insert a default quarter note at position `insertAt` and select it. */
  const insertNote = (insertAt: number) => {
    const ref = notes[selectedIdx!] ?? notes[0];
    const newNote: ParsedNote = {
      step: ref?.step === 'Z' ? 'C' : (ref?.step ?? 'C'),
      alter: ref?.step === 'Z' ? 0 : (ref?.alter ?? 0),
      octave: ref?.octave ?? 4,
      duration: BEAT_DIVS,
      indianLabel: (() => {
        const s = ref?.step === 'Z' ? 'C' : (ref?.step ?? 'C');
        const a = ref?.step === 'Z' ? 0 : (ref?.alter ?? 0);
        const o = ref?.octave ?? 4;
        const opt = PITCH_OPTIONS.find(p => p.step === s && p.alter === a);
        return (opt?.label ?? s) + octaveMark(o);
      })(),
    };
    const arr = [...notes];
    arr.splice(insertAt, 0, newNote);
    onNotesChange(arr);
    setSelectedIdx(insertAt);
  };

  // ─── Render a rest ────────────────────────────────────────────────────────
  const renderRest = (note: ParsedNote, i: number, ghost = false) => {
    const cell = ghost ? (dragPreview?.cell ?? starts[i]) : starts[i];
    const span = cellSpan(note);
    const rx = cell * CELL_W + 4;
    const rw = span * CELL_W - 8;
    const isPlaying = !ghost && playingNoteIndex === i;
    const isSelected = !ghost && selectedIdx === i;
    const isBeingDragged = isDragging && dragInfoRef.current?.idx === i;
    const midY = slotY(6); // middle of staff (B4)
    const top = slotY(9);
    const bot = slotY(3);
    const strokeColor = isPlaying ? '#b54a2c' : isSelected ? '#2a7ca8' : '#bbb';

    return (
      <g key={`${ghost ? 'ghost-rest' : 'rest'}-${i}`} opacity={isBeingDragged ? 0.25 : ghost ? 0.4 : 1}>
        {/* Rest background block */}
        <rect
          x={rx} y={top} width={rw} height={bot - top}
          fill={isPlaying ? 'rgba(181,74,44,0.07)' : isSelected ? 'rgba(42,124,168,0.07)' : 'rgba(160,160,160,0.08)'}
          stroke={strokeColor} strokeWidth={1.2} strokeDasharray="5,3" rx={3}
          style={{ cursor: ghost ? 'default' : (isDragging && dragInfoRef.current?.idx === i) ? 'grabbing' : 'grab' }}
          onMouseDown={ghost ? undefined : (e) => startDrag(e, i, starts[i], 6)}
        />
        {/* Rest symbol */}
        {!ghost && (
          <>
            {/* Quarter/eighth rest: draw a small "𝄽" symbol */}
            {note.duration <= 4 && (
              <text x={rx + rw / 2} y={midY + 6}
                textAnchor="middle" fontSize={20} fill={isPlaying ? '#b54a2c' : '#aaa'}
                style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {note.duration <= 2 ? '𝄾' : '𝄽'}
              </text>
            )}
            {/* Half rest: filled bar sitting on 3rd line */}
            {note.duration === 8 && (
              <rect x={rx + rw / 2 - 10} y={slotY(7)} width={20} height={5}
                fill={isPlaying ? '#b54a2c' : '#aaa'} rx={1}
                style={{ pointerEvents: 'none' }} />
            )}
            {/* Whole rest: filled bar hanging from 4th line */}
            {note.duration >= 16 && (
              <rect x={rx + rw / 2 - 10} y={slotY(8)} width={20} height={5}
                fill={isPlaying ? '#b54a2c' : '#aaa'} rx={1}
                style={{ pointerEvents: 'none' }} />
            )}
            {/* "Rest" label */}
            <text x={rx + rw / 2} y={bot + 12}
              textAnchor="middle" fontSize={9} fill={isPlaying ? '#b54a2c' : '#aaa'}
              style={{ pointerEvents: 'none', userSelect: 'none' }}>
              {durLabel(note.duration)} rest
            </text>
          </>
        )}
      </g>
    );
  };

  // ─── Render one note ───────────────────────────────────────────────────────
  const renderNote = (note: ParsedNote, i: number, ghost = false) => {
    if (note.step === 'Z') return renderRest(note, i, ghost);

    const cell = ghost ? (dragPreview?.cell ?? starts[i]) : starts[i];
    const slot = ghost ? (dragPreview?.slot ?? noteSlot(note.step, note.octave)) : noteSlot(note.step, note.octave);
    const cx = cell * CELL_W + CELL_W / 2;
    const cy = slotY(slot);
    const isPlaying = !ghost && playingNoteIndex === i;
    const isBeingDragged = isDragging && dragInfoRef.current?.idx === i;
    const isSelected = !ghost && selectedIdx === i;
    const accentColor = '#b54a2c';

    const filled = note.duration < 8;      // quarter + eighth = filled
    const isWhole = note.duration >= 16;
    const headColor = isPlaying ? accentColor : ghost ? '#2a7ca8' : '#1a1a1a';
    const RX = isWhole ? 7.5 : 5.5, RY = isWhole ? 4.8 : 3.8;

    const up = slot < 6;
    const STEM_LEN = LINE_SPACING * 3.5;
    const stemX = up ? cx + RX - 0.5 : cx - RX + 0.5;
    const stemY1 = up ? cy - RY + 0.5 : cy + RY - 0.5;
    const stemY2 = up ? cy - STEM_LEN : cy + STEM_LEN;
    const isEighth = note.duration <= SUBDIV;

    return (
      <g key={`${ghost ? 'ghost' : 'note'}-${i}`} opacity={isBeingDragged ? 0.25 : 1}>
        {/* Ledger lines */}
        {!ghost && ledgerSlots(slot).map(ls => (
          <line key={`l${ls}`} x1={cx - 10} y1={slotY(ls)} x2={cx + 10} y2={slotY(ls)}
            stroke="#444" strokeWidth={1.2} />
        ))}

        {/* Accidental */}
        {note.alter !== 0 && (
          <text x={cx - 13} y={cy + 4} fontSize={11} fill={headColor} textAnchor="middle"
            style={{ pointerEvents: 'none' }}>
            {note.alter > 0 ? '♯' : '♭'}
          </text>
        )}

        {/* Playing / selected ring */}
        {(isPlaying || isSelected) && (
          <ellipse cx={cx} cy={cy} rx={RX + 5} ry={RY + 5}
            fill="none" stroke={isPlaying ? accentColor : '#2a7ca8'}
            strokeWidth={2} opacity={0.5} style={{ pointerEvents: 'none' }}
            className={isPlaying ? 'ns-ring--playing' : ''} />
        )}

        {/* Note head */}
        <ellipse
          cx={cx} cy={cy} rx={RX} ry={RY}
          fill={filled && !ghost ? headColor : ghost ? 'rgba(42,124,168,0.15)' : 'white'}
          stroke={headColor} strokeWidth={1.8}
          transform={isWhole ? `rotate(-15 ${cx} ${cy})` : undefined}
          style={{ cursor: ghost ? 'default' : isBeingDragged ? 'grabbing' : 'grab' }}
          onMouseDown={ghost ? undefined : (e) => startDrag(e, i, starts[i], noteSlot(note.step, note.octave))}
        />

        {/* Stem */}
        {!isWhole && (
          <line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2}
            stroke={headColor} strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
        )}

        {/* Flag (eighth note) */}
        {isEighth && !isWhole && (
          <path d={up
            ? `M${stemX},${stemY2} C${stemX + 14},${stemY2 + 8} ${stemX + 10},${stemY2 + 20} ${stemX - 1},${stemY2 + 24}`
            : `M${stemX},${stemY2} C${stemX - 14},${stemY2 - 8} ${stemX - 10},${stemY2 - 20} ${stemX + 1},${stemY2 - 24}`
          } fill="none" stroke={headColor} strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
        )}

        {/* Sargam label below note */}
        {!ghost && (() => {
          const pitch = pitchOf(note);
          const labelY = up ? cy + 14 : slotY(slot - 1) - 2;
          return (
            <text x={cx} y={labelY} textAnchor="middle" fontSize={9}
              fill={isPlaying ? accentColor : '#888'}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >{octaveMark(note.octave)}{pitch.label}</text>
          );
        })()}
      </g>
    );
  };

  // ─── Editor popup ─────────────────────────────────────────────────────────
  const renderEditor = () => {
    if (selectedIdx === null || selectedIdx >= notes.length) return null;
    const note = notes[selectedIdx];
    const pitch = pitchOf(note);
    const cellX = CLEF_W + starts[selectedIdx] * CELL_W;
    const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
    const containerW = scrollRef.current?.clientWidth ?? 500;
    const rawLeft = cellX - scrollLeft;
    const left = Math.max(8, Math.min(containerW - 214, rawLeft));
    return (
      <div ref={editorRef} className="ns-editor" style={{ left }}>
        <div className="ns-editor-header">
          <span>{pitch.label}{octaveMark(note.octave)} · {durLabel(note.duration)}</span>
          <button className="ns-editor-close" onClick={() => setSelectedIdx(null)}>×</button>
        </div>
        <div className="ns-editor-row">
          <label>Pitch</label>
          <select value={pitch.token} onChange={e => updatePitch(selectedIdx, e.target.value, note.octave)}>
            {PITCH_OPTIONS.map(p => <option key={p.token} value={p.token}>{p.label}</option>)}
          </select>
        </div>
        {note.step !== 'Z' && (
          <div className="ns-editor-row">
            <label>Octave</label>
            <select value={note.octave} onChange={e => updatePitch(selectedIdx, pitch.token, +e.target.value)}>
              {OCTAVES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
        <div className="ns-editor-row">
          <label>Duration</label>
          <div className="ns-editor-dur">
            <button type="button" onClick={() => changeDur(selectedIdx, -1)}>−</button>
            <span>{note.duration / BEAT_DIVS}b</span>
            <button type="button" onClick={() => changeDur(selectedIdx, +1)}>+</button>
          </div>
        </div>
        <div className="ns-editor-insert-row">
          <button type="button" className="ns-editor-insert" onClick={() => insertNote(selectedIdx)}>
            ← Add before
          </button>
          <button type="button" className="ns-editor-insert" onClick={() => insertNote(selectedIdx + 1)}>
            Add after →
          </button>
        </div>
        <button className="ns-editor-delete" onClick={() => removeNote(selectedIdx)}>✕ Remove note</button>
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="ns-wrap">
      <div className="ns-scroll" ref={scrollRef}>
        <svg ref={svgRef} width={svgWidth} height={SVG_H} className="ns-svg"
          style={{ cursor: isDragging ? 'grabbing' : 'default' }}
          onClick={handleSvgClick}>

          {/* ── Staff lines (full width) ── */}
          {STAFF_LINES.map(s => (
            <line key={s} x1={0} y1={slotY(s)} x2={svgWidth} y2={slotY(s)}
              stroke="#333" strokeWidth={1} />
          ))}

          {/* ── Treble clef ── */}
          <text x={6} y={slotY(4) + LINE_SPACING * 0.6}
            fontSize={SVG_H * 0.52} fontFamily="serif" fill="#333"
            style={{ pointerEvents: 'none' }}>𝄞</text>

          {/* ── Measures: backgrounds, barlines, beat guides, numbers ── */}
          <g transform={`translate(${CLEF_W},0)`}>
            {Array.from({ length: nMeasures }, (_, m) => {
              const mx = m * CELLS_PER_MEASURE * CELL_W;
              return (
                <g key={m}>
                  {/* Alternate measure shade */}
                  <rect x={mx} y={slotY(STAFF_LINES[4] + 1)}
                    width={CELLS_PER_MEASURE * CELL_W}
                    height={slotY(STAFF_LINES[0] - 1) - slotY(STAFF_LINES[4] + 1)}
                    fill={m % 2 ? 'rgba(0,0,0,0.018)' : 'none'} />
                  {/* Beat dividers */}
                  {Array.from({ length: BEATS_PER_MEASURE }, (_, b) => {
                    if (b === 0) return null;
                    const bx = mx + b * CELLS_PER_BEAT * CELL_W;
                    return <line key={b} x1={bx} y1={slotY(STAFF_LINES[4])} x2={bx} y2={slotY(STAFF_LINES[0])}
                      stroke="#bbb" strokeWidth={0.8} strokeDasharray="3,3" />;
                  })}
                  {/* Barline */}
                  {m > 0 && <line x1={mx} y1={slotY(STAFF_LINES[4])} x2={mx} y2={slotY(STAFF_LINES[0])}
                    stroke="#555" strokeWidth={1.5} />}
                  {/* Measure number */}
                  <text x={mx + 4} y={slotY(STAFF_LINES[4]) - 5}
                    fontSize={9} fill="#aaa" style={{ pointerEvents: 'none' }}>{m + 1}</text>
                  {/* Beat numbers below staff */}
                  {Array.from({ length: BEATS_PER_MEASURE }, (_, b) => (
                    <text key={b} x={mx + b * CELLS_PER_BEAT * CELL_W + CELLS_PER_BEAT * CELL_W / 2}
                      y={slotY(STAFF_LINES[0]) + 14}
                      textAnchor="middle" fontSize={10}
                      fill={b === 0 ? '#666' : '#aaa'}
                      fontWeight={b === 0 ? '600' : '400'}
                      style={{ pointerEvents: 'none' }}>
                      {b + 1}
                    </text>
                  ))}
                </g>
              );
            })}
            {/* Final double barline */}
            <line x1={nCells * CELL_W - 3} y1={slotY(STAFF_LINES[4])} x2={nCells * CELL_W - 3} y2={slotY(STAFF_LINES[0])}
              stroke="#333" strokeWidth={1} />
            <line x1={nCells * CELL_W} y1={slotY(STAFF_LINES[4])} x2={nCells * CELL_W} y2={slotY(STAFF_LINES[0])}
              stroke="#333" strokeWidth={3} />
          </g>

          {/* ── "+" add hint — shown in cells with no note ── */}
          <g transform={`translate(${CLEF_W},0)`}>
            {Array.from({ length: nCells }, (_, c) => {
              const occ = notes.some((n, ni) => c >= starts[ni] && c < starts[ni] + cellSpan(n));
              if (occ) return null;
              return (
                <text key={c} x={c * CELL_W + CELL_W / 2} y={slotY(5) + 4}
                  textAnchor="middle" fontSize={16} fill="#ccc"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>+</text>
              );
            })}
          </g>

          {/* ── Notes ── */}
          <g transform={`translate(${CLEF_W},0)`}>
            {notes.map((n, i) => renderNote(n, i))}
            {/* Drag ghost — shown as soon as isDragging is true */}
            {isDragging && dragInfoRef.current && dragPreview &&
              renderNote(notes[dragInfoRef.current.idx], dragInfoRef.current.idx, true)}
          </g>
        </svg>
      </div>

      {/* Editor popup (outside SVG so it isn't clipped) */}
      <div className="ns-editor-anchor">
        {renderEditor()}
      </div>

      {notes.length === 0 && (
        <p className="ns-empty-hint">Click anywhere on the staff to add the first note.</p>
      )}
    </div>
  );
}
