import { commitFiles, getFileContent } from "@/lib/github";
import { downloadImage } from "@/lib/scraper";
import type { Song } from "@/types/song";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/publish
 * Body: { song: Song, password: string, imageUrl?: string }
 *
 * Publishes a song to the GitHub repo in a SINGLE atomic commit:
 *  1. data/songs/<id>.json
 *  2. data/book.json (updated song_order)
 *  3. data/images/<id>.<ext> (if imageUrl provided)
 *
 * This triggers GitHub Pages rebuild + Vercel redeploy automatically.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { song, password, imageUrl } = body as {
      song?: Song;
      password?: string;
      imageUrl?: string;
    };

    // Auth check
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || password !== adminPassword) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!song || !song.id || !song.title || !song.sections) {
      return Response.json(
        { error: "Invalid song data — id, title, and sections are required" },
        { status: 400 }
      );
    }

    // Collect ALL files for a single atomic commit
    const filesToCommit: {
      path: string;
      content: string;
      encoding?: "utf-8" | "base64";
    }[] = [];

    // 1. Optionally download image FIRST (so we can update thumbnail/background paths)
    let imagePath: string | undefined;
    if (imageUrl?.trim()) {
      try {
        const img = await downloadImage(imageUrl.trim());
        const filename = `${song.id}${img.extension}`;
        filesToCommit.push({
          path: `data/images/${filename}`,
          content: img.buffer.toString("base64"),
          encoding: "base64",
        });
        imagePath = `images/${filename}`;
        // Update song thumbnail/background to match actual file
        song.thumbnail = imagePath;
        song.background = imagePath;
      } catch (imgErr) {
        // Image download failed — continue without it, but report the error
        console.error("Image download failed:", imgErr);
      }
    }

    // 2. Song JSON
    const songJson = JSON.stringify(song, null, 2) + "\n";
    filesToCommit.push({
      path: `data/songs/${song.id}.json`,
      content: songJson,
    });

    // 3. Update book.json — add song to song_order if not already there
    const bookRaw = await getFileContent("data/book.json");
    if (bookRaw) {
      const book = JSON.parse(bookRaw);
      const order: string[] = book.song_order || [];
      if (!order.includes(song.id)) {
        order.push(song.id);
        book.song_order = order;
      }
      filesToCommit.push({
        path: "data/book.json",
        content: JSON.stringify(book, null, 2) + "\n",
      });
    }

    // 4. Single atomic commit with everything
    const lineCount = song.sections.reduce(
      (acc, s) => acc + s.lines.length,
      0
    );
    const commitMessage = `add song: ${song.title} (${song.sections.length} sections, ${lineCount} lines)`;

    const result = await commitFiles(filesToCommit, commitMessage);

    if (!result.success) {
      return Response.json(
        { error: `GitHub commit failed: ${result.error}` },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      commitSha: result.commitSha,
      songId: song.id,
      imagePath,
      message: `Published "${song.title}" — deployments will trigger automatically.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
