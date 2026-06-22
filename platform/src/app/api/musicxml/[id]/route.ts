/**
 * GET /api/musicxml/[id]
 *
 * Serves MusicXML for a given song ID. Resolution order:
 *   1. Pre-generated file in public/musicxml/<id>.musicxml (if it exists)
 *   2. On-the-fly generation from the song's sargam notation data
 *
 * This means MusicXML files no longer need to be pre-generated or stored in
 * the repository — the notation is converted at request time from the song
 * bundle data.
 *
 * Usage (browser):
 *   fetch("/api/musicxml/pal-pal-dil-ke-paas")
 *   // → Content-Type: application/vnd.recordare.musicxml+xml
 *
 * Usage (download link):
 *   href="/api/musicxml/pal-pal-dil-ke-paas"
 *   download="pal-pal-dil-ke-paas.musicxml"
 */

import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { getSongById, getAllSongs } from "@/lib/songs";
import { songToMusicXml } from "@/lib/toMusicXml";

// For static export compatibility, allow this route to be prerendered
export const dynamic = "force-static";
export const revalidate = 3600; // 1 hour

// Generate static params for all songs so they can be prerendered during static export
export async function generateStaticParams() {
  const songs = getAllSongs();
  return songs.map((song) => ({
    id: song.id,
  }));
}

// Check for a pre-generated file (backward compat with existing static files)
function findMusicXml(safeId: string): string | null {
  const dir = path.join(process.cwd(), "public", "musicxml");
  const candidates = [
    path.join(dir, `${safeId}.musicxml`),
    path.join(dir, `${safeId}.mxl`),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  // Sanitise: allow only lowercase letters, digits, hyphens, underscores
  const safeId = id.replace(/[^a-z0-9_-]/gi, "");
  if (!safeId) {
    return NextResponse.json({ error: "Invalid song ID" }, { status: 400 });
  }

  // ── Strategy 1: Serve pre-generated file if available ───────────────────
  const filePath = findMusicXml(safeId);
  if (filePath) {
    try {
      const content = readFileSync(filePath, "utf-8");
      const isMxl = filePath.endsWith(".mxl");
      return new NextResponse(content, {
        status: 200,
        headers: {
          "Content-Type": isMxl
            ? "application/vnd.recordare.musicxml"
            : "application/vnd.recordare.musicxml+xml",
          "Content-Disposition": `attachment; filename="${safeId}.musicxml"`,
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (err) {
      console.error("[api/musicxml] read error:", err);
      // Fall through to on-the-fly generation
    }
  }

  // ── Strategy 2: Generate on-the-fly from song data ──────────────────────
  const song = getSongById(safeId);
  if (!song) {
    return NextResponse.json(
      { error: "Song not found", id: safeId },
      { status: 404 }
    );
  }

  try {
    const musicxml = songToMusicXml(song);
    return new NextResponse(musicxml, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.recordare.musicxml+xml",
        "Content-Disposition": `attachment; filename="${safeId}.musicxml"`,
        // Cache generated output for 1 hour
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (err) {
    console.error("[api/musicxml] generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate MusicXML" },
      { status: 500 }
    );
  }
}
