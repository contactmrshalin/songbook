import { useState } from 'react';
import type { ParsedNote } from '../types';

/** Pitch options: token -> { step, alter }; display label for UI */
const PITCH_OPTIONS: { value: string; step: string; alter: number; label: string }[] = [
  { value: 'S', step: 'C', alter: 0, label: 'Sa' },
  { value: 'R', step: 'D', alter: 0, label: 'Re' },
  { value: 'G', step: 'E', alter: 0, label: 'Ga' },
  { value: 'm', step: 'F', alter: 0, label: 'Ma' },
  { value: 'M', step: 'F', alter: 1, label: 'Ma(T)' },
  { value: 'P', step: 'G', alter: 0, label: 'Pa' },
  { value: 'D', step: 'A', alter: 0, label: 'Dha' },
  { value: 'N', step: 'B', alter: 0, label: 'Ni' },
  { value: 'r', step: 'D', alter: -1, label: 'Re(k)' },
  { value: 'g', step: 'E', alter: -1, label: 'Ga(k)' },
  { value: 'd', step: 'A', alter: -1, label: 'Dha(k)' },
  { value: 'n', step: 'B', alter: -1, label: 'Ni(k)' },
];

const OCTAVES = [
  { value: 3, label: 'Low' },
  { value: 4, label: 'Mid' },
  { value: 5, label: 'High' },
];

function findPitchOption(note: ParsedNote): string {
  const o = PITCH_OPTIONS.find(
    (p) => p.step === note.step && p.alter === note.alter
  );
  return o ? o.value : 'S';
}

interface NoteEditorProps {
  notes: ParsedNote[];
  divisions?: number;
  onNotesChange: (notes: ParsedNote[]) => void;
  playingNoteIndex?: number | null;
}

export function NoteEditor({ notes, onNotesChange, playingNoteIndex = null }: NoteEditorProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const updateDuration = (index: number, delta: number) => {
    const next = notes.map((n, i) =>
      i === index ? { ...n, duration: Math.max(1, Math.min(16, n.duration + delta)) } : n
    );
    onNotesChange(next);
  };

  const updatePitch = (index: number, value: string, octave: number) => {
    const opt = PITCH_OPTIONS.find((p) => p.value === value);
    if (!opt) return;
    const next = notes.map((n, i) =>
      i === index
        ? {
            ...n,
            step: opt.step,
            alter: opt.alter,
            octave,
            indianLabel: `${opt.label}${octave === 3 ? '.' : octave === 5 ? "'" : ''}`,
          }
        : n
    );
    onNotesChange(next);
  };

  const addNote = (afterIndex: number) => {
    const template: ParsedNote = {
      step: 'C',
      alter: 0,
      octave: 4,
      duration: 2,
      indianLabel: 'S',
    };
    const next = [...notes];
    next.splice(afterIndex + 1, 0, template);
    onNotesChange(next);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'note', index }));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) setDropTargetIndex(index);
  };

  const handleDragLeave = () => {
    setDropTargetIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDropTargetIndex(null);
    const from = draggedIndex ?? parseInt(e.dataTransfer.getData('text/plain'), 10);
    setDraggedIndex(null);
    if (from === dropIndex || Number.isNaN(from)) return;
    const arr = [...notes];
    const [removed] = arr.splice(from, 1);
    arr.splice(dropIndex, 0, removed);
    onNotesChange(arr);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const removeNote = (index: number) => {
    onNotesChange(notes.filter((_, i) => i !== index));
  };

  if (notes.length === 0) {
    return (
      <div className="note-editor note-editor--empty">
        <p className="note-editor-empty">No notes to edit. Playback uses the current rhythm (tempo and note durations).</p>
        <button type="button" className="btn btn-primary" onClick={() => addNote(-1)}>
          + Add first note
        </button>
      </div>
    );
  }

  return (
    <div className="note-editor">
      <div className="note-editor-toolbar">
        <p className="note-editor-hint">
          Drag the <span className="drag-handle-demo">⋮⋮</span> handle to reorder. Change pitch from the dropdown. Use ± for duration.
        </p>
        <button type="button" className="btn btn-outline" onClick={() => addNote(notes.length - 1)}>
          + Add note at end
        </button>
      </div>
      <ul className="note-list">
        {notes.map((n, i) => (
          <li
            key={i}
            data-note-index={i}
            className={[
              'note-list-item',
              draggedIndex === i ? 'note-list-item--dragging' : '',
              dropTargetIndex === i ? 'note-list-item--drop-target' : '',
              playingNoteIndex === i ? 'note-list-item--playing' : '',
            ].filter(Boolean).join(' ')}
            onDragOver={(e) => handleDragOver(e, i)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, i)}
          >
            {playingNoteIndex === i && (
              <span className="note-playing-indicator" aria-label="Currently playing">▶</span>
            )}
            <span
              className="note-drag-handle"
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragEnd={handleDragEnd}
              title="Drag to reorder"
            >
              ⋮⋮
            </span>
            <span className="note-index">{i + 1}</span>
            <select
              className="note-pitch-select"
              value={findPitchOption(n)}
              onChange={(e) => updatePitch(i, e.target.value, n.octave)}
              aria-label="Note name"
            >
              {PITCH_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <select
              className="note-octave-select"
              value={n.octave}
              onChange={(e) => updatePitch(i, findPitchOption(n), Number(e.target.value))}
              aria-label="Octave"
            >
              {OCTAVES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} ({o.value})
                </option>
              ))}
            </select>
            <span className="note-duration">
              <button type="button" className="note-duration-btn" onClick={() => updateDuration(i, -1)} aria-label="Shorter">
                −
              </button>
              <span className="note-duration-value">{n.duration}</span>
              <button type="button" className="note-duration-btn" onClick={() => updateDuration(i, 1)} aria-label="Longer">
                +
              </button>
            </span>
            <button type="button" className="btn-add-note-after" onClick={() => addNote(i)} title="Add note after">
              +
            </button>
            <button type="button" className="btn-remove-note" onClick={() => removeNote(i)} aria-label="Remove note">
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
