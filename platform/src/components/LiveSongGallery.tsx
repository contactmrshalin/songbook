"use client";

import { useMemo } from "react";
import { useLiveSongs } from "@/hooks/useLiveSongs";
import SongGallery from "./SongGallery";
import type { Song } from "@/types/song";

interface LiveSongGalleryProps {
  /** Fallback songs from server-side bundle (used initially) */
  fallbackSongs: Song[];
}

/**
 * Wrapper around SongGallery that fetches live songs from GitHub.
 * - On initial render: shows bundled songs (fast, no loading state)
 * - On client mount: fetches from GitHub and updates UI
 * - If fetch fails: keeps showing bundled songs
 *
 * This way new songs appear immediately without redeployment,
 * while keeping fast initial page loads.
 */
export default function LiveSongGallery({
  fallbackSongs,
}: LiveSongGalleryProps) {
  const { songs: liveSongs, loading, error } = useLiveSongs();

  // Use live songs if available, otherwise fall back to bundle
  const songs = useMemo(
    () => liveSongs || fallbackSongs,
    [liveSongs, fallbackSongs]
  );

  return (
    <>
      {error && !liveSongs && (
        <div className="mb-4 p-3 rounded bg-yellow-50 border border-yellow-200 text-sm text-yellow-700">
          ⚠️ Could not load live song list. Showing cached data.
        </div>
      )}
      <SongGallery songs={songs} />
    </>
  );
}
