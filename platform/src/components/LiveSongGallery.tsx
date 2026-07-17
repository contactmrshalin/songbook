"use client";

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

  // Bundled mode only: always render the statically generated song list.
  const songs = fallbackSongs;

  return (
    <SongGallery songs={songs} />
  );
}
