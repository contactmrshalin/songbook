"use client";

import { useMemo } from "react";

interface FingeringDiagramProps {
  notation: string;
  compact?: boolean;
}

// Flute fingering chart: 6 holes (top to bottom = hole 1 to 6)
// 0 = open, 1 = closed, 0.5 = half-closed
const FINGERINGS: Record<string, number[]> = {
  Sa:  [1, 1, 1, 1, 1, 1],       // C - all closed
  Re:  [1, 1, 1, 1, 1, 0],       // D
  Ga:  [1, 1, 1, 1, 0, 0],       // E
  ma:  [1, 1, 1, 0, 1, 1],       // F
  Ma:  [1, 1, 1, 0, 0, 0],       // F#
  Pa:  [1, 1, 0, 0, 0, 0],       // G
  Dha: [1, 0, 0, 0, 0, 0],       // A
  Ni:  [0, 1, 0, 0, 0, 0],       // B
  // Low octave (same fingerings, different breath)
  pa:  [1, 1, 0, 0, 0, 0],
  dha: [1, 0, 0, 0, 0, 0],
  ni:  [0, 1, 0, 0, 0, 0],
  // Komal variants
  "Re(k)": [1, 1, 1, 1, 1, 0.5], // Db
  "Ga(k)": [1, 1, 1, 1, 0.5, 0], // Eb
  "Dha(k)": [1, 0.5, 0, 0, 0, 0],// Ab
  "Ni(k)": [0, 0.5, 0, 0, 0, 0], // Bb
  "Ma(T)": [1, 1, 1, 0, 0, 0],   // F# (Tivra)
};

// Extract the first note from a notation string
function getFirstNote(notation: string): string | null {
  const tokens = notation.split(/\s+/);
  for (const token of tokens) {
    // Clean the token
    const clean = token.replace(/:/g, "").replace(/'/g, "").replace(/\./g, "");
    if (clean && FINGERINGS[clean]) return clean;
  }
  return null;
}

function HoleDiagram({ holes, label }: { holes: number[]; label?: string }) {
  return (
    <div className="fingering-diagram" title={label || ""}>
      {label && (
        <span className="text-[0.6rem] text-[var(--text-muted)] mb-0.5 font-mono">
          {label}
        </span>
      )}
      <div className="flex flex-col items-center gap-[3px]">
        {holes.map((state, i) => (
          <div
            key={i}
            className={`fingering-hole ${
              state === 1 ? "closed" : state === 0.5 ? "half" : ""
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function FingeringDiagram({
  notation,
  compact = true,
}: FingeringDiagramProps) {
  const diagrams = useMemo(() => {
    if (!notation) return [];

    if (compact) {
      // Just show the first note's fingering
      const firstNote = getFirstNote(notation);
      if (!firstNote) return [];
      return [{ note: firstNote, holes: FINGERINGS[firstNote] }];
    }

    // Show all unique notes in the line
    const tokens = notation.split(/\s+/);
    const seen = new Set<string>();
    const result: { note: string; holes: number[] }[] = [];

    for (const token of tokens) {
      const clean = token.replace(/:/g, "").replace(/'/g, "").replace(/\./g, "");
      if (clean && FINGERINGS[clean] && !seen.has(clean)) {
        seen.add(clean);
        result.push({ note: clean, holes: FINGERINGS[clean] });
      }
    }

    return result;
  }, [notation, compact]);

  if (diagrams.length === 0) return null;

  return (
    <div className="flex gap-1.5">
      {diagrams.map((d, i) => (
        <HoleDiagram key={`${d.note}-${i}`} holes={d.holes} label={d.note} />
      ))}
    </div>
  );
}
