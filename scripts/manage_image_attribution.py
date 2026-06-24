#!/usr/bin/env python3
"""

Manage copyright and attribution metadata for song images.

When you download images from Spotify or other sources and add them to data/images/,
use this script to add proper copyright/attribution to the song JSON.

Usage:
  python3 scripts/manage_image_attribution.py [options]

Options:
  --song <id|title>     Add/update attribution for a song's images.
  --source <source>     Image source (e.g., "Spotify", "IMDB", "User-provided").
  --copyright <name>    Copyright holder (e.g., "Universal Music", "User").
  --license <type>      License (e.g., "Spotify API", "Fair Use", "CC-BY").
  --url <url>           Link to original source.
  --dry-run             Show changes without saving.
  --thumbnail           Add attribution for thumbnail image.
  --background          Add attribution for background image.

Environment:
  None required.

Examples:
  # Add Spotify attribution to bol-na-halke-halke thumbnail
  python3 scripts/manage_image_attribution.py \\
    --song "Bol Na Halke Halke" \\
    --thumbnail \\
    --source "Spotify" \\
    --copyright "Universal Music" \\
    --license "Spotify API"

  # Add IMDB attribution to background
  python3 scripts/manage_image_attribution.py \\
    --song jhoom-barabar-jhoom \\
    --background \\
    --source "IMDB" \\
    --copyright "IMDB" \\
    --url "https://imdb.com/..."

  # Preview changes
  python3 scripts/manage_image_attribution.py \\
    --song "Aadat" \\
    --thumbnail \\
    --source "Spotify" \\
    --dry-run

Output:
  Song JSON updated with attribution metadata.
"""

import argparse
import json
import sys
from datetime import datetime
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
    """Find song ID by title."""
    # Try exact ID match first
    if load_song(title) is not None:
        return title
    
    # Search by title
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

def add_attribution(
    song_id: str,
    image_type: str,  # "thumbnail" or "background"
    source: str,
    copyright_holder: Optional[str] = None,
    license_type: Optional[str] = None,
    source_url: Optional[str] = None,
    dry_run: bool = False,
) -> bool:
    """Add attribution metadata to song image."""
    song = load_song(song_id)
    if not song:
        print(f"❌ Song not found: {song_id}")
        return False
    
    # Check image exists
    image_path = song.get(image_type, "")
    if not image_path:
        print(f"⚠ No {image_type} image set for {song_id}")
        return False
    
    # Create attribution object
    attribution = {
        "source": source,
        "addedDate": datetime.now().strftime("%Y-%m-%d"),
    }
    
    if copyright_holder:
        attribution["copyright"] = copyright_holder
    if license_type:
        attribution["license"] = license_type
    if source_url:
        attribution["sourceUrl"] = source_url
    
    # Add to song
    attr_field = f"{image_type}Attribution"
    song[attr_field] = attribution
    
    if dry_run:
        print(f"[DRY-RUN] Would add to {song_id}:")
        print(f"  {attr_field}: {json.dumps(attribution, indent=2)}")
        return True
    
    if save_song(song_id, song):
        print(f"✓ Added {image_type} attribution to {song_id}")
        return True
    
    return False

def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--song", type=str, required=True, help="Song ID or title")
    parser.add_argument("--source", type=str, required=True, help="Image source (Spotify, IMDB, etc.)")
    parser.add_argument("--copyright", type=str, help="Copyright holder name")
    parser.add_argument("--license", type=str, help="License type")
    parser.add_argument("--url", type=str, help="Link to original source")
    parser.add_argument("--thumbnail", action="store_true", help="Add attribution for thumbnail")
    parser.add_argument("--background", action="store_true", help="Add attribution for background")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes")
    
    args = parser.parse_args()
    
    if not args.thumbnail and not args.background:
        print("❌ Specify --thumbnail and/or --background")
        sys.exit(1)
    
    # Resolve song
    song_id = find_song_id_by_title(args.song)
    if not song_id:
        print(f"❌ Song not found: {args.song}")
        sys.exit(1)
    
    success = True
    
    if args.thumbnail:
        if not add_attribution(
            song_id,
            "thumbnail",
            args.source,
            copyright_holder=args.copyright,
            license_type=args.license,
            source_url=args.url,
            dry_run=args.dry_run,
        ):
            success = False
    
    if args.background:
        if not add_attribution(
            song_id,
            "background",
            args.source,
            copyright_holder=args.copyright,
            license_type=args.license,
            source_url=args.url,
            dry_run=args.dry_run,
        ):
            success = False
    
    if success:
        print(f"\n✓ Attribution updated for {song_id}")
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
