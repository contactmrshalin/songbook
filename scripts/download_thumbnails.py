#!/usr/bin/env python3
"""

Download and cache Spotify album art as thumbnails for songs.

Usage:
  python3 scripts/download_thumbnails.py [options]

Options:
  --song <id>        Download thumbnail for a single song by ID.
  --all              Download for all songs with spotifyImageUrl (default: all).
  --dry-run          Show what would be downloaded; don't save files.
  --force            Re-download even if thumbnail already exists locally.

Environment:
  SPOTIFY_CLIENT_ID      Required for Spotify API.
  SPOTIFY_CLIENT_SECRET  Required for Spotify API.

Examples:
  python3 scripts/download_thumbnails.py --all
  python3 scripts/download_thumbnails.py --song bol-na-halke-halke
  python3 scripts/download_thumbnails.py --all --dry-run

Output:
  Thumbnails saved to: data/images/{songId}-spotify.jpg
  Song JSON updated with: "thumbnail": "data/images/{songId}-spotify.jpg"
"""

import argparse
import json
import sys
import urllib.request
from pathlib import Path
from typing import Optional, Dict, Any

_ROOT = Path(__file__).resolve().parents[1]
_DATA = _ROOT / "data"
_SONGS_DIR = _DATA / "songs"
_IMAGES_DIR = _DATA / "images"
_BOOK_JSON = _DATA / "book.json"

def load_book_json() -> Dict[str, Any]:
    """Load book.json to get song order and metadata."""
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

def save_song(song_id: str, song: Dict[str, Any]) -> bool:
    """Save song JSON."""
    song_path = _SONGS_DIR / f"{song_id}.json"
    try:
        song_path.write_text(json.dumps(song, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return True
    except Exception as e:
        print(f"❌ Failed to save {song_id}: {e}")
        return False

def download_image(url: str, output_path: Path) -> bool:
    """Download image from URL to file."""
    try:
        urllib.request.urlretrieve(url, str(output_path))
        return True
    except Exception as e:
        print(f"❌ Failed to download {url}: {e}")
        return False

def process_song(
    song_id: str,
    *,
    dry_run: bool = False,
    force: bool = False,
) -> bool:
    """
    Process a single song.
    Returns True if thumbnail was downloaded/updated.
    """
    song = load_song(song_id)
    if not song:
        return False

    spotify_url = song.get("spotifyImageUrl")
    if not spotify_url:
        return False  # No Spotify image, skip

    # Local thumbnail path
    thumb_filename = f"{song_id}-spotify.jpg"
    thumb_path = _IMAGES_DIR / thumb_filename
    thumb_rel = f"data/images/{thumb_filename}"

    # Check if already exists
    if thumb_path.exists() and not force:
        # Just ensure song.json points to it
        if song.get("thumbnail") != thumb_rel:
            if not dry_run:
                song["thumbnail"] = thumb_rel
                save_song(song_id, song)
                print(f"✓ Updated {song_id}: {thumb_rel} (already cached)")
            else:
                print(f"[DRY-RUN] Would update {song_id}: {thumb_rel}")
        return False

    # Download
    if dry_run:
        print(f"[DRY-RUN] Would download: {spotify_url} → {thumb_rel}")
        return True

    print(f"Downloading {song_id}...", end=" ", flush=True)
    if download_image(spotify_url, thumb_path):
        song["thumbnail"] = thumb_rel
        if save_song(song_id, song):
            print(f"✓ {thumb_rel}")
            return True
        else:
            print(f"❌ (failed to save JSON)")
            return False
    else:
        print(f"❌ (download failed)")
        return False

def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--song", type=str, help="Download for single song by ID")
    parser.add_argument("--all", action="store_true", help="Download for all songs (default)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be downloaded")
    parser.add_argument("--force", action="store_true", help="Re-download existing thumbnails")

    args = parser.parse_args()

    _IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    book = load_book_json()
    song_ids = book.get("song_order", [])

    if not song_ids:
        print("❌ No songs found in book.json")
        sys.exit(1)

    if args.song:
        # Single song
        if process_song(args.song, dry_run=args.dry_run, force=args.force):
            print(f"\n✓ Downloaded thumbnail for {args.song}")
        else:
            print(f"\nℹ No Spotify image for {args.song} (skipped or already cached)")
    else:
        # All songs
        print(f"Processing {len(song_ids)} songs...\n")
        count = 0
        for song_id in song_ids:
            if process_song(song_id, dry_run=args.dry_run, force=args.force):
                count += 1
        print(f"\n✓ Downloaded {count} new thumbnails")

if __name__ == "__main__":
    main()
