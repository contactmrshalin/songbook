import type { Song, BookMeta } from "@/types/song";

import { getGitHubRepoConfig } from "@/lib/github-config";

const GITHUB_RAW_URL = getGitHubRepoConfig().rawBaseUrl;

/**
 * Fetch songs directly from GitHub raw content API.
 * Works on GitHub Pages static sites and anywhere with network access.
 */
export async function fetchSongsFromGitHub(): Promise<Song[]> {
  try {
    // Fetch book.json to get song order
    const bookRes = await fetch(`${GITHUB_RAW_URL}/data/book.json`, {
      cache: "no-store", // Don't cache - we want live data
    });
    if (!bookRes.ok) throw new Error("Failed to fetch book.json");

    const book: BookMeta = await bookRes.json();
    const songOrder: string[] = book.song_order || [];

    // Fetch all songs in order
    const songs: Song[] = [];

    for (const songId of songOrder) {
      try {
        const songRes = await fetch(
          `${GITHUB_RAW_URL}/data/songs/${songId}.json`,
          { cache: "no-store" }
        );

        if (!songRes.ok) {
          console.warn(`Failed to fetch song ${songId}: ${songRes.status}`);
          continue;
        }

        const song: Song = await songRes.json();

        // Only include exported songs
        if (song.export !== false) {
          songs.push(song);
        }
      } catch (err) {
        console.warn(`Error fetching song ${songId}:`, err);
      }
    }

    return songs;
  } catch (err) {
    console.error("Error fetching songs from GitHub:", err);
    throw err;
  }
}

/**
 * Fetch a single song from GitHub by ID.
 */
export async function fetchSongFromGitHub(songId: string): Promise<Song> {
  const res = await fetch(
    `${GITHUB_RAW_URL}/data/songs/${songId}.json`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch song ${songId}: ${res.status}`);
  }

  return res.json();
}
