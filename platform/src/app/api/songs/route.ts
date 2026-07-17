import { getFileContent, listRepoDir } from "@/lib/github";
import type { Song, BookMeta } from "@/types/song";

const SONGS_CACHE_TTL_MS = 60 * 1000;
const SONG_FETCH_CONCURRENCY = 20;

type SongsListResponse = {
  success: true;
  songs: Song[];
  total: number;
  source: "github";
};

let songsCache: { expiresAt: number; payload: SongsListResponse } | null = null;

/**
 * GET /api/songs
 * Fetches all songs directly from GitHub (live data source).
 * No query params → returns full list.
 * ?id=songId → returns specific song.
 * 
 * This endpoint reads live from GitHub so new songs appear without redeployment.
 */
export async function GET(request: Request) {

  try {
    const { searchParams } = new URL(request.url);
    const songId = searchParams.get("id");

    // ── Single-song fetch ──────────────────────────────────────────────────
    if (songId) {
      const content = await getFileContent(`data/songs/${songId}.json`);
      if (!content) {
        return Response.json(
          { error: `Song not found: ${songId}.json` },
          { status: 404 }
        );
      }
      const song: Song = JSON.parse(content);
      return Response.json({ success: true, song });
    }

    // ── All songs (list) ──────────────────────────────────────────────────

    if (songsCache && Date.now() < songsCache.expiresAt) {
      return Response.json(songsCache.payload, {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      });
    }

    // Get book.json from GitHub for preferred song order.
    const bookRaw = await getFileContent("data/book.json");
    const book: BookMeta = bookRaw ? JSON.parse(bookRaw) : { song_order: [] };
    const songOrder = Array.isArray(book.song_order) ? book.song_order : [];

    // Also include any song files present in data/songs that are not listed
    // in book.json, so newly published songs are still visible.
    const dirEntries = await listRepoDir("data/songs");
    const songIdsFromFiles = (dirEntries || [])
      .filter((entry) => entry.type === "file" && entry.name.endsWith(".json"))
      .map((entry) => entry.name.replace(/\.json$/i, ""));

    const seen = new Set<string>();
    const allSongIds = [...songOrder, ...songIdsFromFiles].filter((id) => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    // Fetch all song files from GitHub in bounded parallel chunks.
    const songs: Song[] = [];

    for (let i = 0; i < allSongIds.length; i += SONG_FETCH_CONCURRENCY) {
      const chunk = allSongIds.slice(i, i + SONG_FETCH_CONCURRENCY);
      const chunkSongs = await Promise.all(
        chunk.map(async (id) => {
          try {
            const content = await getFileContent(`data/songs/${id}.json`);
            if (!content) return null;

            const song: Song = JSON.parse(content);
            return song.export !== false ? song : null;
          } catch (err) {
            console.warn(`Failed to fetch song ${id}:`, err);
            return null;
          }
        })
      );

      songs.push(...chunkSongs.filter((song): song is Song => Boolean(song)));
    }

    const payload: SongsListResponse = {
      success: true,
      songs,
      total: songs.length,
      source: "github",
    };

    songsCache = {
      expiresAt: Date.now() + SONGS_CACHE_TTL_MS,
      payload,
    };

    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("API error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
