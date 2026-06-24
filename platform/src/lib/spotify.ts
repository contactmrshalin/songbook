/**
 * Spotify Web API Integration
 * Fetches track metadata, album art, and artist info from Spotify.
 * 
 * POLICY COMPLIANCE:
 * - Store URLs to Spotify-hosted images, never download/cache
 * - Display Spotify logo with attribution
 * - Include link back to track/album on Spotify
 * - Images displayed in original form
 */

interface SpotifyAccessToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

interface SpotifyArtist {
  id: string;
  name: string;
  uri: string;
  external_urls: {
    spotify: string;
  };
}

interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  release_date: string;
  uri: string;
  external_urls: {
    spotify: string;
  };
  artists: SpotifyArtist[];
}

interface SpotifyTrack {
  id: string;
  name: string;
  popularity: number;
  album: SpotifyAlbum;
  artists: SpotifyArtist[];
  duration_ms: number;
  uri: string;
  external_urls: {
    spotify: string;
  };
}

interface SpotifySearchResult {
  track: SpotifyTrack | null;
  album: SpotifyAlbum | null;
  imageUrl: string | null;
  spotifyUrl: string | null;
  attribution: SpotifyAttribution | null;
}

export interface SpotifyAttribution {
  /** Direct link to track on Spotify */
  trackUrl: string;
  /** Direct link to album on Spotify */
  albumUrl: string;
  /** Artist name(s) */
  artists: string[];
  /** Album name */
  album: string;
  /** Release date */
  releaseDate: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get Spotify API access token using Client Credentials flow.
 * Caches token to avoid repeated auth calls.
 */
async function getSpotifyAccessToken(): Promise<string> {
  // Check cache
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Spotify credentials: SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET"
    );
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Spotify auth failed: ${res.status}`);
  }

  const data: SpotifyAccessToken = await res.json();

  // Cache token, refresh 1 minute before expiry
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}

/**
 * Search for a track on Spotify by song title and artists.
 * Returns track metadata including album art URL.
 *
 * @param songTitle - Song title (e.g., "Chura Liya Hai Tumne Jo Dil Ko")
 * @param movieName - Optional: movie/album name for better search
 * @param artistName - Optional: artist name
 * @returns SpotifySearchResult with image URL and attribution
 */
export async function searchSpotifyTrack(
  songTitle: string,
  movieName?: string,
  artistName?: string
): Promise<SpotifySearchResult> {
  try {
    const token = await getSpotifyAccessToken();

    // Build search query
    let query = `track:"${songTitle}"`;
    if (movieName) query += ` album:"${movieName}"`;
    if (artistName) query += ` artist:"${artistName}"`;

    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Spotify search failed: ${res.status}`);
    }

    const data = await res.json();
    const tracks: SpotifyTrack[] = data.tracks?.items || [];

    if (tracks.length === 0) {
      return {
        track: null,
        album: null,
        imageUrl: null,
        spotifyUrl: null,
        attribution: null,
      };
    }

    const track = tracks[0];
    const album = track.album;

    // Get largest album art (first is usually largest)
    const largestImage = album.images[0];

    return {
      track,
      album,
      imageUrl: largestImage?.url || null,
      spotifyUrl: track.external_urls.spotify,
      attribution: {
        trackUrl: track.external_urls.spotify,
        albumUrl: album.external_urls.spotify,
        artists: track.artists.map((a) => a.name),
        album: album.name,
        releaseDate: album.release_date,
      },
    };
  } catch (err) {
    console.error("Spotify search error:", err);
    return {
      track: null,
      album: null,
      imageUrl: null,
      spotifyUrl: null,
      attribution: null,
    };
  }
}

/**
 * Get album art URL from a Spotify album by ID.
 * Used when you already have the album ID.
 */
export async function getSpotifyAlbumArt(
  albumId: string
): Promise<string | null> {
  try {
    const token = await getSpotifyAccessToken();

    const res = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;

    const album: SpotifyAlbum = await res.json();
    return album.images[0]?.url || null;
  } catch (err) {
    console.error("Spotify album art error:", err);
    return null;
  }
}
