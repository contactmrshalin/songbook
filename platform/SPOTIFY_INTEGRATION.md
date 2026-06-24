# Spotify Integration for Song Thumbnails

## Overview

The Songbook app can now fetch album art from Spotify during song enrichment with AI. Images are linked directly from Spotify (never downloaded), ensuring full GDPR/copyright compliance.

## Setup

### 1. Create a Spotify Developer App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Sign in or create a Spotify account
3. Click "Create an App"
4. Accept terms and create the app
5. Copy **Client ID** and **Client Secret**

### 2. Add Credentials to Environment

Add to `platform/.env.local`:

```env
# Spotify Web API — for fetching album art during enrichment
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
```

### 3. Deploy to Vercel (Production)

1. Go to [Vercel Project Settings](https://vercel.com/contactmrshalin-9567s-projects/songbook/settings/environment-variables)
2. Add environment variables:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`

## How It Works

### Architecture

1. **Admin Enrichment** → Calls `/api/songs/{id}/spotify-image`
2. **API fetches** → Searches Spotify Web API for track
3. **Returns URL** → Spotify-hosted image URL + attribution data
4. **Stores in JSON** → `spotifyImageUrl` and `spotifyAttribution` fields
5. **Display** → `<SpotifyImage>` component shows image with Spotify branding

### API Endpoint

```
POST /api/songs/{id}/spotify-image

Body:
{
  "songTitle": "Chura Liya Hai Tumne Jo Dil Ko",
  "movieName": "Yaadon Ki Baraat",      // optional
  "artistName": "Asha Parekh"           // optional
}

Response:
{
  "imageUrl": "https://i.scdn.co/...",
  "spotifyUrl": "https://open.spotify.com/track/...",
  "attribution": {
    "trackUrl": "https://open.spotify.com/track/...",
    "albumUrl": "https://open.spotify.com/album/...",
    "artists": ["Artist 1", "Artist 2"],
    "album": "Album Name",
    "releaseDate": "1976-01-01"
  }
}
```

## Compliance & Policy

### What We Do ✅

- **Link to Spotify content** — Images hosted on Spotify, never downloaded
- **Display attribution** — Show artist names, album, release date
- **Link to source** — "View on Spotify" link for each image
- **Spotify branding** — Display Spotify logo and link
- **Original form** — Images not modified or cropped

### What We Don't Do ❌

- **Download images** — Never cache or store locally
- **Remove attribution** — Always credit artists/album
- **Modify images** — Keep in original form
- **Sell/redistribute** — Only for user consumption

### Spotify Policy Compliance

From [Spotify Policy](https://developer.spotify.com/policy/#ii-respect-content-and-creators:~:text=If%20you%20display%20any%20Spotify%20Content):

> "If you display Spotify Content, you must accompany it with a link back to the applicable artist, album, track, or playlist on the Spotify Service. You must also attribute content from Spotify with the logo."

**Our implementation:**

✅ Link to track/album on Spotify (via `trackUrl`, `albumUrl`)  
✅ Spotify logo displayed in `<SpotifyImage>` component  
✅ Attribution details (artists, album, release date)  
✅ Images never cached or downloaded  

## Usage in Admin UI

In the admin enrichment form:

```jsx
import { searchSpotifyTrack } from "@/lib/spotify";

// When "Fetch from Spotify" button clicked:
const result = await searchSpotifyTrack(
  songTitle,
  movieName,
  artistName
);

// Save to song JSON:
song.spotifyImageUrl = result.imageUrl;
song.spotifyAttribution = result.attribution;
```

## Display in Song Page

```jsx
import SpotifyImage from "@/components/SpotifyImage";

{song.spotifyImageUrl && song.spotifyAttribution && (
  <SpotifyImage
    imageUrl={song.spotifyImageUrl}
    attribution={song.spotifyAttribution}
    alt={song.title}
    width={300}
    height={300}
  />
)}
```

## Fallback & Error Handling

If Spotify fetch fails:
- Use existing `thumbnail` or `background` field
- Log warning but don't break enrichment
- User can manually add image later

## Testing Locally

```bash
# Set credentials in .env.local
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...

# Test API:
curl -X POST http://localhost:3000/api/songs/test-id/spotify-image \
  -H "Content-Type: application/json" \
  -d '{"songTitle": "Bolo Na Halke Halke"}'
```

## Troubleshooting

### "Invalid credentials"
- Check `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in `.env.local`
- Verify app exists in [Spotify Dashboard](https://developer.spotify.com/dashboard)

### "Track not found"
- Song may not be on Spotify
- Try adding `movieName` or `artistName` for better search
- Manual thumbnail upload as fallback

### Images not loading
- Verify `spotifyImageUrl` is valid (starts with `https://i.scdn.co/`)
- Check browser console for CORS issues
- Spotify images should load from anywhere

## Future Enhancements

- [ ] Auto-enrich on song creation
- [ ] Bulk import from Spotify playlists
- [ ] Cache thumbnail URLs in database (not images)
- [ ] Add "powered by Spotify" footer badge
- [ ] Support Spotify URI links in notation editor
