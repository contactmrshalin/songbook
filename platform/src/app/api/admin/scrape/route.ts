import { extractSongFromUrl } from "@/lib/scraper";

// Not force-dynamic for static export compatibility

/**
 * POST /api/admin/scrape
 * Body: { url: string, songId?: string, songTitle?: string, password: string }
 *
 * Scrapes a song-notation page and returns the extracted Song JSON.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, songId, songTitle, password } = body as {
      url?: string;
      songId?: string;
      songTitle?: string;
      password?: string;
    };

    // Auth check
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || password !== adminPassword) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!url || typeof url !== "string") {
      return Response.json(
        { error: "Missing required field: url" },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return Response.json({ error: "Invalid URL" }, { status: 400 });
    }

    const { song, rawLineCount } = await extractSongFromUrl(url, {
      songId: songId || undefined,
      songTitle: songTitle || undefined,
    });

    return Response.json({
      success: true,
      song,
      rawLineCount,
      sections: song.sections.length,
      lines: song.sections.reduce((acc, s) => acc + s.lines.length, 0),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
