"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import type { NotationMode } from "@/types/song";

export default function NotationToggle() {
  const { notationMode, setNotationMode } = useAppStore();

  // On first client mount, restore saved preference from localStorage.
  // The store initialises with "indian" (SSR-safe); this corrects it immediately
  // after hydration so there is at most one brief render with the default.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("notationMode") as NotationMode | null;
      if (saved && saved !== notationMode) {
        setNotationMode(saved);
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — use default
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modes: { key: NotationMode; label: string }[] = [
    { key: "indian",  label: "Sargam"  },
    { key: "western", label: "Western" },
    { key: "both",    label: "Both"    },
    { key: "sheet",   label: "Sheet"   },
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
