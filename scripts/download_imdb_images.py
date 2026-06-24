#!/usr/bin/env python3
"""

Download high-resolution movie poster images from IMDB and store locally.

IMDB movies typically have aspect ratios around 27:40 (portrait posters).
Images are downloaded at highest available resolution (usually 1500+ width).

Usage:
  python3 scripts/download_imdb_images.py [options]

Options:
  --song <id|title>     Download IMDB image for a song (must have imdbId in metadata).
  --imdb-id <id>        IMDB ID to download (e.g., "tt0433383" for Jhoom Barabar Jhoom).
  --all                 Download images for all songs with imdbId set.
  --quality <size>      Image size: "small" (500px), "medium" (1000px), "large" (1500px+).
                        Default: "large" for maximum resolution.
  --dry-run             Show what would be downloaded.
  --force               Re-download even if image already exists locally.

Environment:
  Requires requests library: pip install requests

Examples:
  # Download IMDB poster for Jhoom Barabar Jhoom
  python3 scripts/download_imdb_images.py \\
    --song "Jhoom Barabar Jhoom" \\
    --quality large

  # Download for a specific IMDB ID
  python3 scripts/download_imdb_images.py \\
    --imdb-id tt0433383 \\
    --song "Jhoom Barabar Jhoom"

  # Download all
  python3 scripts/download_imdb_images.py --all

  # Preview downloads
  python3 scripts/download_imdb_images.py --all --dry-run

Output:
  Images saved to data/images/{songId}-imdb.jpg (high-resolution)
  Song JSON updated with IMDB attribution metadata.

Notes:
  - IMDB images are portrait posters (~27:40 aspect ratio, not square)
  - Websites must handle variable aspect ratios with CSS
  - Images cached locally at highest resolution
  - Attribution required: "© IMDB" + film title link
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
from urllib.parse import urljoin

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
_IMAGES_DIR = _DATA / "images"

# IMDB endpoints
IMDB_API_URL = "https://www.imdb.com/title/{imdb_id}/"
IMDB_IMAGE_SEARCH_URL = "https://www.imdb.com/title/{imdb_id}/mediaindex/"

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

def get_imdb_poster_url(imdb_id: str) -> Optional[str]:
    """
    Extract poster image URL from IMDB.
    Returns the highest resolution image URL available.
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        
        # Try direct API endpoint first
        api_url = f"https://imdb.com/title/{imdb_id}/"
        response = requests.get(api_url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Extract image URL from page HTML - try multiple patterns
        patterns = [
            r'"posterUrl":"([^"]+)"',  # JSON data
            r'<meta property="og:image"[^>]*content="([^"]+)"',  # Open graph
            r'src="([^"]*imdb_pro[^"]*\.jpg)',  # Poster img
            r'<img[^>]*class="[^"]*ipc-image[^"]*"[^>]*src="([^"]+)"[^>]*alt="Poster"',  # IPC image
        ]
        
        for pattern in patterns:
            match = re.search(pattern, response.text)
            if match:
                img_url = match.group(1)
                # Decode HTML entities
                img_url = img_url.replace("\\", "").replace('","', ',')
                
                # If it's a relative URL or needs resolution upgrade
                if img_url and ('jpg' in img_url or 'jpeg' in img_url):
                    # Try to upgrade resolution
                    img_url = re.sub(r'@.*\.jpg', '@._V1_UX1500_.jpg', img_url)
                    return img_url
        
        return None
    except Exception as e:
        print(f"⚠ Failed to fetch IMDB poster for {imdb_id}: {e}")
        return None

def download_imdb_image(
    song_id: str,
    imdb_id: str,
    quality: str = "large",
    force: bool = False,
    dry_run: bool = False,
) -> bool:
    """Download and cache IMDB poster image."""
    
    _IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    
    # Determine output path
    output_path = _IMAGES_DIR / f"{song_id}-imdb.jpg"
    
    if output_path.exists() and not force:
        print(f"✓ Image already cached: {output_path.name}")
        return True
    
    # Get poster URL
    poster_url = get_imdb_poster_url(imdb_id)
    if not poster_url:
        print(f"❌ Could not find IMDB poster for {imdb_id}")
        return False
    
    if dry_run:
        print(f"[DRY-RUN] Would download to {output_path.name}")
        print(f"          From: {poster_url}")
        return True
    
    # Download image
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
        response = requests.get(poster_url, headers=headers, timeout=15)
        response.raise_for_status()
        
        output_path.write_bytes(response.content)
        
        # Get file size
        size_kb = output_path.stat().st_size / 1024
        print(f"✓ Downloaded: {output_path.name} ({size_kb:.0f} KB)")
        
        return True
    except Exception as e:
        print(f"❌ Failed to download from {poster_url}: {e}")
        return False

def add_imdb_attribution(song_id: str, imdb_id: str) -> bool:
    """Add IMDB attribution metadata to song."""
    song = load_song(song_id)
    if not song:
        print(f"❌ Song not found: {song_id}")
        return False
    
    # Get movie title from IMDB
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
        response = requests.get(f"https://imdb.com/title/{imdb_id}/", headers=headers, timeout=10)
        match = re.search(r'<meta property="og:title"[^>]*content="([^"]+)"', response.text)
        movie_title = match.group(1) if match else "IMDB Movie"
    except:
        movie_title = "IMDB Movie"
    
    # Add attribution
    song["thumbnailAttribution"] = {
        "source": "IMDB",
        "copyright": f"© {movie_title}",
        "license": "Fair Use - Educational",
        "sourceUrl": f"https://imdb.com/title/{imdb_id}/",
        "addedDate": datetime.now().strftime("%Y-%m-%d"),
        "aspectRatio": "27:40",  # Typical IMDB poster aspect ratio
    }
    
    if save_song(song_id, song):
        print(f"✓ Added IMDB attribution to {song_id}")
        return True
    
    return False

def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--song", type=str, help="Song ID or title")
    parser.add_argument("--imdb-id", type=str, help="IMDB ID (e.g., tt0433383)")
    parser.add_argument("--all", action="store_true", help="Download for all songs with imdbId")
    parser.add_argument("--quality", choices=["small", "medium", "large"], default="large")
    parser.add_argument("--dry-run", action="store_true", help="Preview without downloading")
    parser.add_argument("--force", action="store_true", help="Re-download existing images")
    
    args = parser.parse_args()
    
    # Validate args
    if args.all:
        # Download for all songs with imdbId in metadata
        book = load_book_json()
        song_ids = book.get("song_order", [])
        
        success_count = 0
        for song_id in song_ids:
            song = load_song(song_id)
            if not song:
                continue
            
            # Check if song has IMDB metadata
            imdb_id = song.get("imdbId") or song.get("imdb_id")
            if not imdb_id:
                continue
            
            print(f"\n📽 {song.get('title', song_id)}:")
            
            if download_imdb_image(song_id, imdb_id, quality=args.quality, force=args.force, dry_run=args.dry_run):
                if not args.dry_run:
                    add_imdb_attribution(song_id, imdb_id)
                    # Update song to use IMDB image
                    song["thumbnail"] = f"images/{song_id}-imdb.jpg"
                    save_song(song_id, song)
                success_count += 1
        
        print(f"\n✓ Processed {success_count} songs")
    
    elif args.song and args.imdb_id:
        song_id = find_song_id_by_title(args.song)
        if not song_id:
            print(f"❌ Song not found: {args.song}")
            sys.exit(1)
        
        print(f"📽 {args.song}:")
        
        if download_imdb_image(song_id, args.imdb_id, quality=args.quality, force=args.force, dry_run=args.dry_run):
            if not args.dry_run:
                add_imdb_attribution(song_id, args.imdb_id)
                # Update song to use IMDB image
                song = load_song(song_id)
                song["thumbnail"] = f"images/{song_id}-imdb.jpg"
                save_song(song_id, song)
                print(f"✓ Updated {song_id} with IMDB image")
        else:
            sys.exit(1)
    
    else:
        print("❌ Specify --song + --imdb-id, or --all")
        sys.exit(1)

if __name__ == "__main__":
    main()
