import { getFileContent, listRepoDir } from "@/lib/github";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/songs
 * Body: { password: string }
 *
 * Returns the live list of songs from the GitHub repo (not the baked bundle).
 * Each entry includes id, title, and section/line counts.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body as { password?: string };

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || password !== adminPassword) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get book.json for the song order
    const bookRaw = await getFileContent("data/book.json");
    const songOrder: string[] = bookRaw
      ? JSON.parse(bookRaw).song_order || []
      : [];

    // List actual song files in data/songs/
    const songFiles = await listRepoDir("data/songs");
    const fileIds = new Set(
      (songFiles || [])
        .filter((f) => f.name.endsWith(".json"))
        .map((f) => f.name.replace(/\.json$/, ""))
    );

    // Build song list — fetch title from each song JSON
    const songs: {
      id: string;
      title: string;
      sections: number;
      lines: number;
      inOrder: boolean;
    }[] = [];

    for (const id of fileIds) {
      const content = await getFileContent(`data/songs/${id}.json`);
      if (content) {
        try {
          const data = JSON.parse(content);
          const sectionCount = (data.sections || []).length;
          const lineCount = (data.sections || []).reduce(
            (acc: number, s: { lines?: unknown[] }) =>
              acc + (s.lines || []).length,
            0
          );
          songs.push({
            id: data.id || id,
            title: data.title || id,
            sections: sectionCount,
            lines: lineCount,
            inOrder: songOrder.includes(id),
          });
        } catch {
          songs.push({
            id,
            title: id,
            sections: 0,
            lines: 0,
            inOrder: songOrder.includes(id),
          });
        }
      }
    }

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
