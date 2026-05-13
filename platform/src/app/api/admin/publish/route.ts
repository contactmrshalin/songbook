import { commitFiles, getFileContent, uploadImage } from "@/lib/github";
import { downloadImage } from "@/lib/scraper";
import type { Song } from "@/types/song";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/publish
 * Body: { song: Song, password: string, imageUrl?: string }
 *
 * Publishes a song to the GitHub repo:
 *  1. Saves data/songs/<id>.json
 *  2. Updates data/book.json song_order
 *  3. Optionally downloads & uploads a thumbnail image
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

    // Prepare files to commit
    const filesToCommit: { path: string; content: string }[] = [];

    // 1. Song JSON
    const songJson = JSON.stringify(song, null, 2) + "\n";
    filesToCommit.push({
      path: `data/songs/${song.id}.json`,
      content: songJson,
    });

    // 2. Update book.json — add song to song_order if not already there
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

    // 3. Commit song files
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

    // 4. Optionally upload image (separate commit since it's binary)
    let imagePath: string | undefined;
    if (imageUrl) {
      try {
        const imgBuffer = await downloadImage(imageUrl);
        const ext = getImageExtension(imageUrl);
        const filename = `${song.id}${ext}`;
        const imgResult = await uploadImage(imgBuffer, filename);
        if (imgResult.success) {
          imagePath = imgResult.path;
        }
      } catch {
        // Image upload is optional — don't fail the whole publish
      }
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

function getImageExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    for (const ext of [".png", ".jpg", ".jpeg", ".webp", ".gif"]) {
      if (pathname.endsWith(ext)) return ext;
    }
  } catch {
    // ignore
  }
  return ".png";
}
