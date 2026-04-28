"use client";

import { useAppStore } from "@/lib/store";
import type { NotationMode } from "@/types/song";

export default function NotationToggle() {
  const { notationMode, setNotationMode } = useAppStore();

  const modes: { key: NotationMode; label: string }[] = [
    { key: "indian", label: "Sargam" },
    { key: "western", label: "Western" },
    { key: "both", label: "Both" },
  ];

  return (
    <div className="toggle-pill">
      {modes.map((mode) => (
        <button
          key={mode.key}
          className={notationMode === mode.key ? "active" : ""}
          onClick={() => setNotationMode(mode.key)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
