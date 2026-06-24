#!/usr/bin/env python3
"""

Extract movie titles from song metadata and add IMDB IDs.

This script parses the "info" field in song JSON files to extract movie/film titles,
then looks them up on IMDB to add imdbId fields for later image download.

Usage:
  python3 scripts/add_imdb_ids.py [options]

Options:
  --all              Add IMDB IDs for all songs (interactive).
  --song <id|title>  Add IMDB ID for a specific song.
  --imdb-id <id>    Manually specify IMDB ID (use with --song).
  --dry-run          Show what would be added.
  --force            Overwrite existing imdbId values.

Environment:
  Requires requests library: pip install requests

Examples:
  # Interactively add IMDB IDs for all songs
  python3 scripts/add_imdb_ids.py --all

  # Add IMDB ID for specific song
  python3 scripts/add_imdb_ids.py --song "Bol Na Halke Halke" --imdb-id tt0433383

  # Preview changes
  python3 scripts/add_imdb_ids.py --all --dry-run
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Optional, Dict, Any, List

try:
    import requests
except ImportError:
    print("❌ Missing dependency: requests")
    print("Install with: pip install requests")
    sys.exit(1)

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

def save_song(song_id: str, song: Dict[str, Any]) -> bool:
    """Save song JSON."""
    song_path = _SONGS_DIR / f"{song_id}.json"
    try:
        song_path.write_text(json.dumps(song, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return True
    except Exception as e:
        print(f"❌ Failed to save {song_id}: {e}")
        return False

def extract_movie_title(info_lines: List[str]) -> Optional[str]:
    """Extract movie title from info lines."""
    for line in info_lines:
        # Match patterns like:
        # "Film/Artist: Jhoom Barabar Jhoom"
        # "Movie: Golmaal (1979)"
        # "Singer: Artist Name, Movie: Title"
        match = re.search(r'(?:Film|Movie|Title)(?:\s*/\s*Artist)?:\s*([^,;]+)', line, re.IGNORECASE)
        if match:
            title = match.group(1).strip()
            # Remove year in parentheses for cleaner lookup
            title = re.sub(r'\s*\(\d{4}\)\s*$', '', title)
            return title
    return None

def search_imdb(movie_title: str) -> Optional[str]:
    """Search IMDB for a movie and return its ID."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        
        # Use IMDB API v3 alternative search
        search_url = "https://www.imdb.com/find"
        params = {"q": movie_title, "s": "tt"}
        
        response = requests.get(search_url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Try multiple patterns to find title link
        patterns = [
            r'<a href="/title/(tt\d+)/[^"]*"[^>]*>',  # Standard link
            r'href="/title/(tt\d+)/"',  # Direct title link
            r'data-tconst="(tt\d+)"',  # Data attribute
        ]
        
        for pattern in patterns:
            match = re.search(pattern, response.text)
            if match:
                return match.group(1)
        
        return None
    except Exception as e:
        print(f"⚠ Search failed for '{movie_title}': {e}")
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

def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--all", action="store_true", help="Add IMDB IDs for all songs")
    parser.add_argument("--song", type=str, help="Song ID or title")
    parser.add_argument("--imdb-id", type=str, help="IMDB ID (e.g., tt0433383)")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes")
    parser.add_argument("--force", action="store_true", help="Overwrite existing imdbId")
    
    args = parser.parse_args()
    
    if args.all:
        # Process all songs
        book = load_book_json()
        song_ids = book.get("song_order", [])
        
        count = 0
        for song_id in song_ids:
            song = load_song(song_id)
            if not song:
                continue
            
            # Skip if already has imdbId (unless --force)
            if song.get("imdbId") and not args.force:
                continue
            
            # Extract movie title
            info = song.get("info", []) or []
            movie_title = extract_movie_title(info)
            
            if not movie_title:
                continue
            
            print(f"🎬 {song.get('title', song_id)}")
            print(f"   Movie: {movie_title}")
            
            # Search IMDB
            imdb_id = search_imdb(movie_title)
            if imdb_id:
                print(f"   Found: {imdb_id}")
                
                if not args.dry_run:
                    song["imdbId"] = imdb_id
                    save_song(song_id, song)
                    print(f"   ✓ Added")
                else:
                    print(f"   [DRY-RUN] Would add {imdb_id}")
                
                count += 1
            else:
                print(f"   ❌ Not found on IMDB")
        
        print(f"\n✓ Processed {count} songs")
    
    elif args.song and args.imdb_id:
        song_id = find_song_id_by_title(args.song)
        if not song_id:
            print(f"❌ Song not found: {args.song}")
            sys.exit(1)
        
        song = load_song(song_id)
        if not song:
            print(f"❌ Failed to load song: {song_id}")
            sys.exit(1)
        
        if args.dry_run:
            print(f"[DRY-RUN] Would add imdbId: {args.imdb_id} to {song_id}")
        else:
            song["imdbId"] = args.imdb_id
            save_song(song_id, song)
            print(f"✓ Added imdbId {args.imdb_id} to {song_id}")
    
    else:
        print("❌ Specify --all, or --song + --imdb-id")
        sys.exit(1)

if __name__ == "__main__":
    main()
