import { extractSongFromUrl } from "@/lib/scraper";

// Not force-dynamic for static export compatibility

/**
 * POST /api/admin/rescrape
 * Body: { url: string, songId: string, password: string }
 *
 * Re-scrapes notation from a new URL source and merges it into an existing song,
 * preserving thumbnail, background, description, trivia, info, and other enriched fields.
 * Only the sections (notations) are replaced.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, songId, password } = body as {
      url?: string;
      songId?: string;
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

    if (!songId || typeof songId !== "string") {
      return Response.json(
        { error: "Missing required field: songId" },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return Response.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Scrape the new source — use existing songId so scraper doesn't override it
    const { song: scrapedSong, rawLineCount } = await extractSongFromUrl(url, {
      songId,
    });

    // Return only the new sections — the client will merge into the existing song
    return Response.json({
      success: true,
      sections: scrapedSong.sections,
      scrapedTitle: scrapedSong.title,
      rawLineCount,
      sectionCount: scrapedSong.sections.length,
      lineCount: scrapedSong.sections.reduce((acc, s) => acc + s.lines.length, 0),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
