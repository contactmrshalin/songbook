"use client";

import { useState, useEffect, useCallback } from "react";
import { Shuffle, Music2 } from "lucide-react";
import SongCard from "./SongCard";
import type { Song } from "@/types/song";

interface RandomSongSuggestionsProps {
  /** All songs excluding the current one */
  songs: Song[];
  /** How many suggestions to show */
  count?: number;
}

/**
 * Displays a randomly picked set of song suggestions.
 * Random selection happens only on the client (useEffect) to avoid
 * React hydration mismatch on statically generated pages.
 */
export default function RandomSongSuggestions({
  songs,
  count = 3,
}: RandomSongSuggestionsProps) {
  const [picks, setPicks] = useState<Song[] | null>(null);

  const shuffle = useCallback(() => {
    if (songs.length === 0) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    setPicks(shuffled.slice(0, Math.min(count, shuffled.length)));
  }, [songs, count]);

  // Hydration-safe: only run on client
  useEffect(() => {
    shuffle();
  }, [shuffle]);

  if (songs.length === 0) return null;

  return (
    <section className="mt-10 mb-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Music2 className="w-4 h-4 text-[var(--accent-primary)]" />
          <h2
            className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider"
          >
            Try Another Song
          </h2>
        </div>
        <button
          onClick={shuffle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                     bg-[var(--bg-secondary)] text-[var(--text-muted)]
                     hover:bg-[var(--accent-primary)] hover:text-white
                     transition-colors duration-200"
          title="Show different suggestions"
        >
          <Shuffle className="w-3.5 h-3.5" />
          Shuffle
        </button>
      </div>

      {/* Cards grid — placeholder skeleton until client picks are ready */}
      {picks === null ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-[var(--bg-secondary)] animate-pulse"
              style={{ height: "180px" }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {picks.map((song) => (
            <SongCard key={song.id} song={song} />
          ))}
        </div>
      )}
    </section>
  );
}
