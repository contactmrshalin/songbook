"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import type { SongLine } from "@/types/song";

interface NotationLineProps {
  line: SongLine;
  lineIndex: number;
  isActive?: boolean;
  onClick?: () => void;
}

// Tokenize notation into display tokens (same logic as AudioPlayer)
function tokenizeNotation(indian: string): string[] {
  if (!indian) return [];
  return indian.split(/\s+/).filter(Boolean);
}

// Simple Indian-to-Western conversion per token
const INDIAN_TO_WESTERN: Record<string, string> = {
  Sa: "C", Re: "D", Ga: "E", ma: "F", Ma: "F#", Pa: "G", Dha: "A", Ni: "B",
  pa: "g", dha: "a", ni: "b",
  "Re(k)": "Db", "Ga(k)": "Eb", "Dha(k)": "Ab", "Ni(k)": "Bb", "Ma(T)": "F#",
};

function tokenToWestern(token: string): string {
  // Strip ornaments for lookup
  const clean = token.replace(/:/g, "").replace(/~/g, "").replace(/\^/g, "").replace(/\./g, "");
  const western = INDIAN_TO_WESTERN[clean];
  if (western) {
    // Preserve ornament markers in display
    let display = western;
    if (token.includes(":")) display += "—";
    if (token.includes("~")) display = "~" + display;
    return display;
  }
  // Keep as-is for bars, rests, compound tokens
  return token;
}

export default function NotationLine({
  line,
  lineIndex,
  isActive = false,
  onClick,
}: NotationLineProps) {
  const { notationMode, currentTokenIndex } = useAppStore();

  const hasLyrics = line.lyrics && line.lyrics.trim().length > 0;
  const hasNotation = line.indian && line.indian.trim().length > 0;

  // Tokenize once
  const indianTokens = useMemo(() => tokenizeNotation(line.indian || ""), [line.indian]);
  const westernTokens = useMemo(
    () => indianTokens.map(tokenToWestern),
    [indianTokens]
  );

  if (!hasLyrics && !hasNotation) return null;

  return (
    <div
      className={`notation-line cursor-pointer ${isActive ? "active" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Line ${lineIndex + 1}: ${line.lyrics || "Notation"}`}
    >
      {/* Lyrics */}
      {hasLyrics && (
        <div className="lyrics-text">
          {line.lyrics}
        </div>
      )}

      {/* Notation — rendered as individual tokens */}
      {hasNotation && (
        <div className="flex flex-wrap gap-x-1">
          {/* Indian notation tokens */}
          {(notationMode === "indian" || notationMode === "both") && (
            <div className="notation-text flex flex-wrap gap-x-1 items-center">
              {indianTokens.map((token, idx) => {
                const isCurrentToken = isActive && currentTokenIndex === idx;
                const isPastToken = isActive && currentTokenIndex > idx && currentTokenIndex >= 0;
                const isBar = token === "|";

                return (
                  <span
                    key={idx}
                    className={`
                      inline-block transition-all duration-150 rounded px-0.5
                      ${isBar ? "text-[var(--text-muted)] mx-0.5" : ""}
                      ${isCurrentToken
                        ? "bg-[var(--accent-primary)] text-white scale-110 shadow-md font-bold"
                        : isPastToken
                          ? "opacity-50"
                          : ""
                      }
                    `}
                  >
                    {token}
                  </span>
                );
              })}
            </div>
          )}

          {/* Western notation tokens */}
          {(notationMode === "western" || notationMode === "both") && (
            <div className="notation-text western flex flex-wrap gap-x-1 items-center">
              {notationMode === "both" && (
                <span className="text-[var(--text-muted)] mx-1">|</span>
              )}
              {westernTokens.map((token, idx) => {
                const isCurrentToken = isActive && currentTokenIndex === idx;
                const isPastToken = isActive && currentTokenIndex > idx && currentTokenIndex >= 0;
                const isBar = token === "|";

                return (
                  <span
                    key={idx}
                    className={`
                      inline-block transition-all duration-150 rounded px-0.5
                      ${isBar ? "text-[var(--text-muted)] mx-0.5" : ""}
                      ${isCurrentToken
                        ? "bg-[var(--accent-secondary)] text-white scale-110 shadow-md font-bold"
                        : isPastToken
                          ? "opacity-50"
                          : ""
                      }
                    `}
                  >
                    {token}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
