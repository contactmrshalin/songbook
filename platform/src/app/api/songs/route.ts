import { getFileContent } from "@/lib/github";
import type { Song, BookMeta } from "@/types/song";

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
    // Get book.json from GitHub for the live song order
    const bookRaw = await getFileContent("data/book.json");
    const book: BookMeta = bookRaw ? JSON.parse(bookRaw) : { song_order: [] };
    const songOrder: string[] = book.song_order || [];

    // Fetch all song files from GitHub
    const songs: Song[] = [];

    for (const songId of songOrder) {
      try {
        const content = await getFileContent(`data/songs/${songId}.json`);
        if (content) {
          const song: Song = JSON.parse(content);
          if (song.export !== false) {
            songs.push(song);
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch song ${songId}:`, err);
        // Continue with next song
      }
    }

    return Response.json({
      success: true,
      songs,
      total: songs.length,
      source: "github",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("API error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
