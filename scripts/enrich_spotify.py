#!/usr/bin/env python3
"""

Enrich songs with Spotify metadata (album art, artist info, etc).

Usage:
  python3 scripts/enrich_spotify.py [options]

Options:
  --song <id|title>  Enrich a single song by ID (filename) or title.
  --all              Enrich all songs (default).
  --dry-run          Show what would be enriched; don't save files.

Environment:
  SPOTIFY_CLIENT_ID      Required. Spotify Developer app client ID.
  SPOTIFY_CLIENT_SECRET  Required. Spotify Developer app client secret.

Examples:
  SPOTIFY_CLIENT_ID=abc... SPOTIFY_CLIENT_SECRET=xyz... \\
    python3 scripts/enrich_spotify.py --song "Bol Na Halke Halke"
  
  SPOTIFY_CLIENT_ID=abc... SPOTIFY_CLIENT_SECRET=xyz... \\
    python3 scripts/enrich_spotify.py --song bol-na-halke-halke
  
  SPOTIFY_CLIENT_ID=abc... SPOTIFY_CLIENT_SECRET=xyz... \\
    python3 scripts/enrich_spotify.py --all --dry-run

Output:
  Song JSON updated with:
    - spotifyImageUrl: URL to album art
    - spotifyAttribution: metadata (artist, album, track link, release date)
"""

import argparse
import json
import sys
import urllib.request
import urllib.parse
import ssl
import base64
import certifi
from pathlib import Path
from typing import Optional, Dict, Any

_ROOT = Path(__file__).resolve().parents[1]
_DATA = _ROOT / "data"
_SONGS_DIR = _DATA / "songs"
_BOOK_JSON = _DATA / "book.json"

def load_book_json() -> Dict[str, Any]:
    """Load book.json to get song order."""
    if not _BOOK_JSON.exists():
        print(f"❌ {_BOOK_JSON} not found")
        sys.exit(1)
    return json.loads(_BOOK_JSON.read_text(encoding="utf-8"))

def load_song(song_id: str) -> Optional[Dict[str, Any]]:
    """Load a song JSON by ID."""
    song_path = _SONGS_DIR / f"{song_id}.json"
    if not song_path.exists():
        return None
    try:
        return json.loads(song_path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"❌ Failed to load {song_id}: {e}")
        return None


def find_song_id_by_title(title: str) -> Optional[str]:
    """Find song ID by title. Returns ID if found, None otherwise."""
    # Try exact ID match first
    if load_song(title) is not None:
        return title
    
    # Search by title in all songs
    book = load_book_json()
    song_ids = book.get("song_order", [])
    
    title_lower = title.lower().strip()
    for song_id in song_ids:
        song = load_song(song_id)
        if song and song.get("title", "").lower().strip() == title_lower:
            return song_id
    
    return None

def save_song(song_id: str, song: Dict[str, Any]) -> bool:
    """Save song JSON."""
    song_path = _SONGS_DIR / f"{song_id}.json"
    try:
        song_path.write_text(json.dumps(song, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return True
    except Exception as e:
        print(f"❌ Failed to save {song_id}: {e}")
        return False

def get_spotify_access_token(client_id: str, client_secret: str) -> Optional[str]:
    """Get Spotify OAuth2 access token."""
    try:
        auth_str = f"{client_id}:{client_secret}"
        auth_bytes = auth_str.encode("utf-8")
        auth_b64 = base64.b64encode(auth_bytes).decode("utf-8")
        
        req = urllib.request.Request(
            "https://accounts.spotify.com/api/token",
            data=b"grant_type=client_credentials",
            headers={
                "Authorization": f"Basic {auth_b64}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        
        # Use certifi for proper SSL certificate verification on macOS
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        with urllib.request.urlopen(req, context=ssl_context) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("access_token")
    except Exception as e:
        print(f"❌ Failed to get Spotify token: {e}")
        return None

def search_spotify_track(
    token: str,
    song_title: str,
    movie_name: Optional[str] = None,
    artist_name: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Search Spotify for a track and return image + metadata."""
    try:
        # Build search query
        query = song_title
        if movie_name:
            query += f" {movie_name}"
        if artist_name:
            query += f" {artist_name}"
        
        # URL encode and search
        search_url = f"https://api.spotify.com/v1/search?q={urllib.parse.quote(query)}&type=track&limit=1"
        req = urllib.request.Request(
            search_url,
            headers={"Authorization": f"Bearer {token}"},
        )
        
        # Use certifi for proper SSL certificate verification on macOS
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        with urllib.request.urlopen(req, context=ssl_context) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            tracks = data.get("tracks", {}).get("items", [])
            
            if not tracks:
                return None
            
            track = tracks[0]
            album = track.get("album", {})
            images = album.get("images", [])
            artists = track.get("artists", [])
            
            if not images:
                return None
            
            # Get largest image
            image_url = images[0].get("url") if images else None
            
            return {
                "imageUrl": image_url,
                "spotifyUrl": track.get("external_urls", {}).get("spotify"),
                "attribution": {
                    "trackUrl": track.get("external_urls", {}).get("spotify"),
                    "albumUrl": album.get("external_urls", {}).get("spotify"),
                    "artists": [a.get("name") for a in artists],
                    "album": album.get("name"),
                    "releaseDate": album.get("release_date", "").split("-")[0],  # Year only
                },
            }
    except Exception as e:
        print(f"⚠ Spotify search failed for '{song_title}': {e}")
        return None

def enrich_song(
    song_id: str,
    token: str,
    *,
    dry_run: bool = False,
) -> bool:
    """Enrich a single song with Spotify metadata. Returns True if updated."""
    song = load_song(song_id)
    if not song:
        return False
    
    # Skip if already has Spotify metadata
    if song.get("spotifyImageUrl"):
        return False
    
    title = song.get("title", "")
    # Extract movie/film from info
    movie = None
    artist = None
    for info_line in song.get("info", []):
        if "film" in info_line.lower() or "movie" in info_line.lower():
            movie = info_line.split(":", 1)[1].strip() if ":" in info_line else None
        if "singer" in info_line.lower() or "artist" in info_line.lower():
            artist = info_line.split(":", 1)[1].strip() if ":" in info_line else None
    
    # Search Spotify
    result = search_spotify_track(token, title, movie_name=movie, artist_name=artist)
    if not result:
        print(f"⚠ No Spotify match for {song_id}")
        return False
    
    if dry_run:
        print(f"[DRY-RUN] Would enrich {song_id}:")
        print(f"  Image: {result['imageUrl']}")
        print(f"  Track: {result['spotifyUrl']}")
        print(f"  Artists: {', '.join(result['attribution']['artists'])}")
        return True
    
    # Update song
    song["spotifyImageUrl"] = result["imageUrl"]
    song["spotifyAttribution"] = result["attribution"]
    
    if save_song(song_id, song):
        print(f"✓ Enriched {song_id}")
        return True
    
    return False

def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--song", type=str, help="Enrich single song by ID or title")
    parser.add_argument("--all", action="store_true", help="Enrich all songs (default)")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without saving")
    
    args = parser.parse_args()
    
    # Get Spotify credentials
    client_id = os.environ.get("SPOTIFY_CLIENT_ID")
    client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        print("❌ Missing Spotify credentials")
        print("   Export before running:")
        print("     export SPOTIFY_CLIENT_ID=your_id")
        print("     export SPOTIFY_CLIENT_SECRET=your_secret")
        sys.exit(1)
    
    # Get token
    print("🔐 Authenticating with Spotify...", end=" ", flush=True)
    token = get_spotify_access_token(client_id, client_secret)
    if not token:
        sys.exit(1)
    print("✓")
    
    book = load_book_json()
    song_ids = book.get("song_order", [])
    
    if not song_ids:
        print("❌ No songs in book.json")
        sys.exit(1)
    
    if args.song:
        # Single song - resolve by ID or title
        song_id = find_song_id_by_title(args.song)
        if not song_id:
            print(f"❌ Song not found: {args.song}")
            print("   Try using the song ID (filename) or exact title")
            sys.exit(1)
        
        if enrich_song(song_id, token, dry_run=args.dry_run):
            print(f"\n✓ Enriched {song_id} with Spotify metadata")
        else:
            print(f"\nℹ No Spotify match for {song_id}")
    else:
        # All songs
        print(f"\nProcessing {len(song_ids)} songs...\n")
        count = 0
        for song_id in song_ids:
            if enrich_song(song_id, token, dry_run=args.dry_run):
                count += 1
        print(f"\n✓ Enriched {count} songs")

if __name__ == "__main__":
    import os
    import urllib.parse
    main()
