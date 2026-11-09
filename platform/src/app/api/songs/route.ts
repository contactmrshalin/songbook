import { getAllSongs, getSongById } from "@/lib/songs";

/**
 * GET /api/songs
 * Serves the deployment's bundled song data without making per-song GitHub
 * requests from the Worker.
 */
export async function GET(request: Request) {
  const songId = new URL(request.url).searchParams.get("id");

  if (songId) {
    const song = getSongById(songId);
    if (!song) {
      return Response.json(
        { error: `Song not found: ${songId}.json` },
        { status: 404 }
      );
    }
    return Response.json({ success: true, song });
  }

  const songs = getAllSongs();
  return Response.json(
    {
      success: true,
      songs,
      total: songs.length,
      source: "bundle",
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
