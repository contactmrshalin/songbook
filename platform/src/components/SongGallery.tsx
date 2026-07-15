"use client";

import { useState, useMemo, useDeferredValue } from "react";
import { Search, Music2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import SongCard from "./SongCard";
import AdBanner from "./AdBanner";
import { AD_SLOTS, ADS_CONFIG } from "@/lib/ads.config";
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
      else if (key === "raag") meta.raag = val;
      else if (key === "thaat") meta.thaat = val;
    }
  }
  return meta;
}

/** Normalise a raag/thaat label — strip parenthetical suffixes like "(light)" */
function normaliseLabel(raw: string): string {
  return raw.replace(/\s*\(.*?\)/g, "").trim();
}

export default function SongGallery({ songs }: SongGalleryProps) {
  const { searchQuery, setSearchQuery } = useAppStore();

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [filterType, setFilterType] = useState<"raag" | "thaat">("raag");

  // Precompute searchable text once per songs update for fast filtering.

  const searchIndex = useMemo(
    () =>
      songs.map((song) => ({
        song,
        searchableText: [
          song.title,
          ...song.info,
          ...song.sections.flatMap((s) => s.lines.map((l) => l.lyrics)),
        ]
          .join(" ")
          .toLowerCase(),
      })),
    [songs]
  );

  // Extract unique raags and thaats for filter chips
  const { raags, thaats } = useMemo(() => {
    const raagSet = new Set<string>();
    const thaatSet = new Set<string>();
    for (const song of songs) {
      const meta = extractMeta(song.info);
      if (meta.raag) raagSet.add(normaliseLabel(meta.raag));
      if (meta.thaat) thaatSet.add(normaliseLabel(meta.thaat));
    }
    return {
      raags: Array.from(raagSet).sort(),
      thaats: Array.from(thaatSet).sort(),
    };
  }, [songs]);

  const activeOptions = filterType === "raag" ? raags : thaats;
  const hasFilters = raags.length > 0 || thaats.length > 0;

  // Filter songs by search query and active filter
  const filteredSongs = useMemo(() => {
    let result = songs;

    // Text search
    if (deferredSearchQuery.trim()) {

      const q = deferredSearchQuery.toLowerCase();
      result = searchIndex
        .filter((entry) => entry.searchableText.includes(q))
        .map((entry) => entry.song);
    }

    // Raag / Thaat filter
    if (activeFilter !== "all") {
      result = result.filter((song) => {
        const meta = extractMeta(song.info);
        const value = filterType === "raag" ? meta.raag : meta.thaat;
        return value ? normaliseLabel(value) === activeFilter : false;
      });
    }

    return result;
  }, [songs, searchIndex, deferredSearchQuery, activeFilter, filterType]);

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
      {hasFilters && (
        <div className="mb-6 space-y-3">
          {/* Raag / Thaat toggle pill */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[var(--text-muted)]">Filter by:</span>
            <div className="toggle-pill">
              <button
                className={filterType === "raag" ? "active" : ""}
                onClick={() => { setFilterType("raag"); setActiveFilter("all"); }}
              >
                Raag
              </button>
              <button
                className={filterType === "thaat" ? "active" : ""}
                onClick={() => { setFilterType("thaat"); setActiveFilter("all"); }}
              >
                Thaat
              </button>
            </div>
          </div>

          {/* Chips row */}
          <div className="flex flex-wrap gap-2">
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
            {activeOptions.map((option) => (
              <button
                key={option}
                className={`badge cursor-pointer transition-colors ${
                  activeFilter === option
                    ? "bg-[var(--accent-primary)] text-white"
                    : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
                onClick={() => setActiveFilter(option)}
              >
                {option}
              </button>
            ))}
            {activeOptions.length === 0 && (
              <span className="text-xs text-[var(--text-muted)] italic py-1">
                No {filterType} data yet — enrich songs to populate filters
              </span>
            )}
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--text-muted)]">
          {filteredSongs.length} song{filteredSongs.length !== 1 ? "s" : ""}
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      </div>

      {/* Song grid with in-feed ads */}
      {filteredSongs.length > 0 ? (
        <div className="space-y-4">
          {(() => {
            const chunks: Song[][] = [];
            const interval = ADS_CONFIG.homeFeedInterval;
            for (let i = 0; i < filteredSongs.length; i += interval) {
              chunks.push(filteredSongs.slice(i, i + interval));
            }
            return chunks.map((chunk, chunkIdx) => (
              <div key={chunkIdx}>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {chunk.map((song) => (
                    <SongCard key={song.id} song={song} />
                  ))}
                </div>

                {/* In-feed ad between chunks (not after the last one) */}
                {chunkIdx < chunks.length - 1 && chunkIdx < ADS_CONFIG.maxHomeFeedAds && (
                  <div className="my-4">
                    <AdBanner
                      slot={AD_SLOTS.HOME_FEED}
                      format="horizontal"
                      className="ad-home-feed"
                    />
                  </div>
                )}
              </div>
            ));
          })()}
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
