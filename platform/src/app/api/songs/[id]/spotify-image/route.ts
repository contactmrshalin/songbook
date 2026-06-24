import { searchSpotifyTrack } from "@/lib/spotify";
import type { SpotifyAttribution } from "@/types/song";

/**
 * POST /api/songs/{id}/spotify-image
 * 
 * Fetch album art from Spotify for a song during enrichment.
 * Stores URL to Spotify image (never downloads/caches image locally).
 * 
 * Body:
 * {
 *   songTitle: string,
 *   movieName?: string,
 *   artistName?: string
 * }
 * 
 * Returns:
 * {
 *   imageUrl: string | null,
 *   attribution: SpotifyAttribution | null
 * }
 * 
 * COMPLIANCE NOTES:
 * - Image URL links directly to Spotify-hosted content
 * - Attribution includes Spotify logo link and track URL
 * - Images not downloaded or cached locally
 * - User must display attribution when showing image
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { songTitle, movieName, artistName } = body as {
      songTitle: string;
      movieName?: string;
      artistName?: string;
    };

    if (!songTitle) {
      return Response.json(
        { error: "songTitle is required" },
        { status: 400 }
      );
    }

    // Fetch from Spotify
    const result = await searchSpotifyTrack(songTitle, movieName, artistName);

    return Response.json({
      imageUrl: result.imageUrl,
      spotifyUrl: result.spotifyUrl,
      attribution: result.attribution,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Spotify enrichment error:", message);
    return Response.json(
      { error: message },
      { status: 500 }
    );
  }
}
