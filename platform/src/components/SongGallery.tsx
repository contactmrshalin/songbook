"use client";

import { useState, useMemo } from "react";
import { Search, Filter, Music2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import SongCard from "./SongCard";
import type { Song } from "@/types/song";

interface SongGalleryProps {
  songs: Song[];
}

function extractMeta(info: string[]): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const line of info) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.substring(0, idx).trim().toLowerCase();
      const val = line.substring(idx + 1).trim();
      if (key.includes("movie") || key.includes("film")) meta.movie = val;
      else if (key.includes("singer") || key.includes("artist")) meta.singer = val;
      else if (key.includes("scale")) meta.scale = val;
      else if (key.includes("raag")) meta.raag = val;
    }
  }
  return meta;
}

export default function SongGallery({ songs }: SongGalleryProps) {
  const { searchQuery, setSearchQuery } = useAppStore();
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // Extract unique raags for filter chips
  const raags = useMemo(() => {
    const raagSet = new Set<string>();
    for (const song of songs) {
      const meta = extractMeta(song.info);
      if (meta.raag) raagSet.add(meta.raag);
    }
    return Array.from(raagSet).sort();
  }, [songs]);

  // Filter songs by search query and active filter
  const filteredSongs = useMemo(() => {
    let result = songs;

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((song) => {
        const searchable = [
          song.title,
          ...song.info,
          ...song.sections.flatMap((s) => s.lines.map((l) => l.lyrics)),
        ]
          .join(" ")
          .toLowerCase();
        return searchable.includes(q);
      });
    }

    // Raag filter
    if (activeFilter !== "all") {
      result = result.filter((song) => {
        const meta = extractMeta(song.info);
        return meta.raag === activeFilter;
      });
    }

    return result;
  }, [songs, searchQuery, activeFilter]);

  return (
    <div>
      {/* Mobile search (visible below md) */}
      <div className="md:hidden mb-6">
        <div className="search-bar">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search songs, movies, singers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Filter chips */}
      {raags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            className={`badge cursor-pointer transition-colors ${
              activeFilter === "all"
                ? "bg-[var(--accent-primary)] text-white"
                : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
            onClick={() => setActiveFilter("all")}
          >
            All Songs
          </button>
          {raags.map((raag) => (
            <button
              key={raag}
              className={`badge cursor-pointer transition-colors ${
                activeFilter === raag
                  ? "bg-[var(--accent-primary)] text-white"
                  : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
              onClick={() => setActiveFilter(raag)}
            >
              {raag}
            </button>
          ))}
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--text-muted)]">
          {filteredSongs.length} song{filteredSongs.length !== 1 ? "s" : ""}
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      </div>

      {/* Song grid */}
      {filteredSongs.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredSongs.map((song) => (
            <SongCard key={song.id} song={song} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Music2 className="w-16 h-16 text-[var(--text-muted)] mb-4 opacity-40" />
          <h3 className="text-lg font-semibold text-[var(--text-secondary)] mb-2">
            No songs found
          </h3>
          <p className="text-sm text-[var(--text-muted)] max-w-md">
            Try adjusting your search or filter to find what you&apos;re looking for.
          </p>
        </div>
      )}
    </div>
  );
}
