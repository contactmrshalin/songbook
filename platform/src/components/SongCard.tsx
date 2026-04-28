"use client";

import Link from "next/link";
import Image from "next/image";
import { Music2, Film, Mic2 } from "lucide-react";
import type { Song } from "@/types/song";

interface SongCardProps {
  song: Song;
}

function extractMeta(info: string[]): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const line of info) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.substring(0, idx).trim().toLowerCase();
      const val = line.substring(idx + 1).trim();
      if (key.includes("movie") || key.includes("film")) meta.movie = val;
      else if (key.includes("singer") || key.includes("artist"))
        meta.singer = val;
      else if (key.includes("scale")) meta.scale = val;
      else if (key.includes("raag")) meta.raag = val;
    }
  }
  return meta;
}

export default function SongCard({ song }: SongCardProps) {
  const meta = extractMeta(song.info);
  const totalLines = song.sections.reduce(
    (sum, s) => sum + s.lines.length,
    0
  );

  return (
    <Link href={`/songs/${song.id}`} className="block">
      <div className="song-card group">
        {/* Thumbnail */}
        <div className="relative overflow-hidden bg-[var(--bg-secondary)]">
          <div className="song-card-thumb relative">
            {song.thumbnail ? (
              <Image
                src={`/song-images/${song.thumbnail.replace("images/", "")}`}
                alt={song.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]">
                <Music2 className="w-12 h-12 text-white/70" />
              </div>
            )}
          </div>
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Scale badge */}
          {meta.scale && (
            <span className="absolute top-2 right-2 badge bg-black/50 text-white text-[0.65rem] backdrop-blur-sm">
              {meta.scale}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-3.5">
          <h3
            className="font-semibold text-[var(--text-primary)] text-sm leading-tight line-clamp-2 mb-1.5"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            {song.title}
          </h3>

          <div className="space-y-1">
            {meta.movie && (
              <div className="flex items-center gap-1.5 text-[0.75rem] text-[var(--text-muted)]">
                <Film className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{meta.movie}</span>
              </div>
            )}
            {meta.singer && (
              <div className="flex items-center gap-1.5 text-[0.75rem] text-[var(--text-muted)]">
                <Mic2 className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{meta.singer}</span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--border-light)]">
            <span className="text-[0.7rem] text-[var(--text-muted)]">
              {song.sections.length} section
              {song.sections.length !== 1 ? "s" : ""}
            </span>
            <span className="text-[0.5rem] text-[var(--text-muted)]">
              &bull;
            </span>
            <span className="text-[0.7rem] text-[var(--text-muted)]">
              {totalLines} lines
            </span>
            {meta.raag && (
              <>
                <span className="text-[0.5rem] text-[var(--text-muted)]">
                  &bull;
                </span>
                <span className="text-[0.7rem] text-[var(--accent-primary)]">
                  {meta.raag}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
