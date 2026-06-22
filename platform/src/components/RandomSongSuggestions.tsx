"use client";

import { useState, useEffect, useCallback } from "react";
import { Shuffle, Music2, Film } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Song } from "@/types/song";
import { withBasePath } from "@/lib/site.config";

interface RandomSongSuggestionsProps {
  /** All songs excluding the current one */
  songs: Song[];
  /** How many suggestions to show */
  count?: number;
}

function getMovie(info: string[]): string {
  for (const line of info) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.substring(0, idx).trim().toLowerCase();
      if (key.includes("movie") || key.includes("film")) {
        return line.substring(idx + 1).trim();
      }
    }
  }
  return "";
}

/**
 * Compact horizontal suggestion rows — small thumbnail + title + movie.
 * Random selection runs only on the client to avoid hydration mismatch.
 */
export default function RandomSongSuggestions({
  songs,
  count = 4,
}: RandomSongSuggestionsProps) {
  const [picks, setPicks] = useState<Song[] | null>(null);

  const shuffle = useCallback(() => {
    if (songs.length === 0) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    setPicks(shuffled.slice(0, Math.min(count, shuffled.length)));
  }, [songs, count]);

  useEffect(() => {
    shuffle();
  }, [shuffle]);

  if (songs.length === 0) return null;

  return (
    <section className="mt-10 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Music2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Try Another Song
          </h2>
        </div>
        <button
          onClick={shuffle}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                     bg-[var(--bg-secondary)] text-[var(--text-muted)]
                     hover:bg-[var(--accent-primary)] hover:text-white
                     transition-colors duration-200"
          title="Show different suggestions"
        >
          <Shuffle className="w-3 h-3" />
          Shuffle
        </button>
      </div>

      {/* Compact list */}
      <div className="flex flex-col gap-2.5">
        {picks === null
          ? Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className="h-[72px] rounded-xl bg-[var(--bg-secondary)] animate-pulse"
              />
            ))
          : picks.map((song) => {
              const movie = getMovie(song.info);
              return (
                <Link
                  key={song.id}
                  href={`/songs/${song.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                             bg-[var(--bg-card)] border border-[var(--border-light)]
                             hover:border-[var(--accent-primary)] hover:shadow-md
                             transition-all duration-200 group"
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-[var(--bg-secondary)]">
                    {song.thumbnail ? (

                      <Image
                        src={withBasePath(`/song-images/${song.thumbnail.replace("images/", "")}`)}
                        alt={song.title}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]">
                        <Music2 className="w-5 h-5 text-white/70" />
                      </div>
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold text-[var(--text-primary)] truncate leading-snug"
                      style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                    >
                      {song.title}
                    </p>
                    {movie && (
                      <p className="flex items-center gap-1 text-xs text-[var(--text-muted)] mt-1 truncate">
                        <Film className="w-3 h-3 flex-shrink-0" />
                        {movie}
                      </p>
                    )}
                  </div>

                  {/* Arrow hint */}
                  <span className="text-[var(--text-muted)] text-base opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                  </span>
                </Link>
              );
            })}
      </div>
    </section>
  );
}
