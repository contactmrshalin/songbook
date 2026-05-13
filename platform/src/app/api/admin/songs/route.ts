import { getFileContent } from "@/lib/github";
import { getAllSongs } from "@/lib/songs";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/songs
 * Body: { password: string }
 *
 * Returns the song list. Uses the pre-built bundle for fast response
 * (title, id, section/line counts) and checks book.json from GitHub
 * for the authoritative song_order.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body as { password?: string };

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || password !== adminPassword) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

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
