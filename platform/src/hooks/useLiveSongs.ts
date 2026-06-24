"use client";

import { useEffect, useState, useRef } from "react";
import { fetchSongsFromGitHub } from "@/lib/github-raw";
import type { Song } from "@/types/song";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let cachedSongs: Song[] | null = null;
let cacheTime = 0;

interface UseLiveSongsResult {
  songs: Song[] | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch songs live from GitHub.
 * - On Vercel/local: Uses /api/songs endpoint (server-side fetching)
 * - On GitHub Pages: Fetches directly from GitHub raw content API
 * Uses client-side caching to avoid repeated API calls.
 * Falls back to bundled songs if GitHub is unavailable.
 */
export function useLiveSongs(): UseLiveSongsResult {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const fetchSongs = async () => {
      try {
        // Check cache
        if (cachedSongs && Date.now() - cacheTime < CACHE_DURATION) {
          setSongs(cachedSongs);
          setLoading(false);
          return;
        }

        // Detect if running on GitHub Pages (BASE_PATH is /songbook)
        const isGitHubPages =
          typeof window !== "undefined" &&
          process.env.NEXT_PUBLIC_BASE_PATH === "/songbook";

        let fetchedSongs: Song[];

        if (isGitHubPages) {
          // GitHub Pages: fetch directly from GitHub raw content API
          fetchedSongs = await fetchSongsFromGitHub();
        } else {
          // Vercel/local: use /api/songs endpoint
          const res = await fetch("/api/songs");
          if (!res.ok) throw new Error(`API error: ${res.status}`);

          const data = await res.json();
          if (data.success && data.songs) {
            fetchedSongs = data.songs;
          } else {
            throw new Error(data.error || "Unknown error");
          }
        }

        cachedSongs = fetchedSongs;
        cacheTime = Date.now();
        setSongs(fetchedSongs);
        setError(null);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.warn("Failed to fetch live songs, falling back to bundle:", error);
        setError(error);
        // Don't set songs to null — let component use bundle as fallback
      } finally {
        setLoading(false);
      }
    };

    fetchSongs();
  }, []);

  return { songs, loading, error };
}
