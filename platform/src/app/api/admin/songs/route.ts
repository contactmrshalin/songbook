import { getFileContent } from "@/lib/github";
import { getAllSongs } from "@/lib/songs";
import type { Song } from "@/types/song";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/songs
 * Body: { password: string }
 *   → Returns the full song list (title, id, section/line counts).
 *
 * Body: { password: string, songId: string }
 *   → Returns the full Song JSON for the given ID fetched live from GitHub.
 *
 * Uses the pre-built bundle for list mode (fast, no per-song API calls).
 * Fetches directly from GitHub for single-song load so edits are always fresh.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password, songId } = body as { password?: string; songId?: string };

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || password !== adminPassword) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Single-song load ──────────────────────────────────────────────────
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

    // ── Song list (default) ───────────────────────────────────────────────
    // Get book.json from GitHub for the live song order
    const bookRaw = await getFileContent("data/book.json");
    const songOrder: string[] = bookRaw
      ? JSON.parse(bookRaw).song_order || []
      : [];

    // Use the pre-built bundle for song data (instant, no API calls per song)
    const bundleSongs = getAllSongs();

    const songs = bundleSongs.map((s) => ({
      id: s.id,
      title: s.title,
      sections: s.sections.length,
      lines: s.sections.reduce((acc, sec) => acc + sec.lines.length, 0),
      inOrder: songOrder.includes(s.id),
    }));

    // Sort: songs in book order first, then alphabetical by title
    songs.sort((a, b) => {
      const aIdx = songOrder.indexOf(a.id);
      const bIdx = songOrder.indexOf(b.id);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.title.localeCompare(b.title);
    });

    return Response.json({ success: true, songs, total: songs.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
