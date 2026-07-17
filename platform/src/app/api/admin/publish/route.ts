import { commitFiles, getFileContent, listRepoDir } from "@/lib/github";
import { downloadImage } from "@/lib/scraper";
import { songToMusicXml } from "@/lib/toMusicXml";
import type { Song } from "@/types/song";

// Not force-dynamic for static export compatibility

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
        const base64Content = img.buffer.toString("base64");

        // Commit to data/images/ (for Hugo / GitHub Pages site)
        filesToCommit.push({
          path: `data/images/${filename}`,
          content: base64Content,
          encoding: "base64",
        });

        // Also commit to platform/public/song-images/ (for Vercel / Next.js site)
        filesToCommit.push({
          path: `platform/public/song-images/${filename}`,
          content: base64Content,
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

    // 2. MusicXML — regenerate from current sargam notation on every publish
    try {
      const musicXmlContent = songToMusicXml(song);
      const musicXmlPath = `musicxml/${song.id}.musicxml`;

      // Commit to platform/public/musicxml/ so the Next.js API route can serve it
      filesToCommit.push({
        path: `platform/public/musicxml/${song.id}.musicxml`,
        content: musicXmlContent,
      });

      // Record the path in the song so the viewer knows where to fetch it
      song.musicxml = musicXmlPath;
    } catch (xmlErr) {
      // MusicXML generation failed — log but don't block the publish
      console.error("[publish] MusicXML generation failed:", xmlErr);
    }

    // 3. Song JSON (after musicxml field has been set)
    const songJson = JSON.stringify(song, null, 2) + "\n";
    filesToCommit.push({
      path: `data/songs/${song.id}.json`,
      content: songJson,
    });

    // 4. Upsert book.json — always ensure song is present in song_order
    const bookRaw = await getFileContent("data/book.json");
    let book: Record<string, unknown> = {};

    if (bookRaw) {
      try {
        book = JSON.parse(bookRaw);
      } catch {
        // Keep publishing resilient if book.json is temporarily malformed.
        book = {};
      }
    }

    const order = Array.isArray(book.song_order)
      ? (book.song_order as string[])
      : [];

    if (!order.includes(song.id)) {
      order.push(song.id);
    }

    book.song_order = order;

    filesToCommit.push({
      path: "data/book.json",
      content: JSON.stringify(book, null, 2) + "\n",
    });

    // 5. Refresh bundled songs JSON so production can stay fully static.
    const notationRaw = await getFileContent("data/notation_mapping.json");
    let notationMapping: Record<string, unknown> = {};
    if (notationRaw) {
      try {
        notationMapping = JSON.parse(notationRaw) as Record<string, unknown>;
      } catch {
        notationMapping = {};
      }
    }

    const songFiles = await listRepoDir("data/songs");
    const songIdsFromFiles = (songFiles || [])
      .filter((entry) => entry.type === "file" && entry.name.endsWith(".json"))
      .map((entry) => entry.name.replace(/\.json$/i, ""));

    const orderedIds = new Set<string>(order);
    const remainingIds = songIdsFromFiles
      .filter((id) => !orderedIds.has(id))
      .sort((a, b) => a.localeCompare(b));
    const allSongIds = [...order, ...remainingIds];

    const bundledSongs: Song[] = [];
    for (const id of allSongIds) {
      try {
        if (id === song.id) {
          if (song.export !== false) {
            bundledSongs.push(song);
          }
        } else {
          const content = await getFileContent(`data/songs/${id}.json`);
          if (!content) continue;
          const s = JSON.parse(content) as Song;
          if (s.export !== false) {
            bundledSongs.push(s);
          }
        }
      } catch {
        // Skip malformed files but keep publish flow resilient.
      }
    }

    const bundlePayload = {
      bookMeta: book,
      notationMapping,
      songs: bundledSongs,
    };

    filesToCommit.push({
      path: "platform/src/generated/song-bundle.json",
      content: JSON.stringify(bundlePayload),
    });

    // 6. Single atomic commit with everything
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
