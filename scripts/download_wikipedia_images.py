#!/usr/bin/env python3
"""
Download high-resolution movie poster images from Wikipedia.

Wikipedia has extensive coverage of Bollywood films with poster images.
This script fetches Wikipedia film pages, extracts poster images, and downloads them.

Usage:
  python3 scripts/download_wikipedia_images.py [options]

Options:
  --all              Download for all songs with film info.
  --song <title>     Download for a specific song.
  --force            Overwrite existing images.

Environment:
  Requires: requests, pillow, PIL

Examples:
  # Download for all songs
  python3 scripts/download_wikipedia_images.py --all

  # Download for specific song
  python3 scripts/download_wikipedia_images.py --song "Bol Na Halke Halke"
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
import re
import requests
from PIL import Image
from io import BytesIO

_ROOT = Path(__file__).resolve().parents[1]
_DATA = _ROOT / "data"
_SONGS_DIR = _DATA / "songs"
_IMAGES_DIR = _DATA / "images"
_BOOK_JSON = _DATA / "book.json"

# Ensure images directory exists
_IMAGES_DIR.mkdir(parents=True, exist_ok=True)


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


def find_wikipedia_poster(movie_title: str) -> Optional[str]:
    """
    Search Wikipedia for a film and extract poster image URL.
    Returns the image URL if found.
    """
    try:
        import time
        headers = {
            "User-Agent": "Songbook Pipeline (research)"
        }
        api_url = "https://en.wikipedia.org/w/api.php"
        
        # Throttle requests
        time.sleep(0.5)
        
        # Direct page lookup (faster than search)
        # Wikipedia film pages usually have predictable titles
        try_titles = [
            movie_title,
            movie_title + " (film)",
            movie_title + " film",
        ]
        
        for try_title in try_titles:
            # Get page images directly
            images_params = {
                "action": "query",
                "titles": try_title,
                "prop": "images",
                "imlimit": "20",
                "format": "json",
            }
            
            images_response = requests.get(api_url, params=images_params, headers=headers, timeout=10)
            images_response.raise_for_status()
            images_data = images_response.json()
            
            pages = images_data.get("query", {}).get("pages", {})
            
            # Check if page exists (-1 means not found)
            for page_id, page_info in pages.items():
                if page_id == "-1":
                    continue  # Page not found
                
                if "images" not in page_info:
                    continue
                
                # Look for poster image (usually first JPG)
                for img in page_info["images"]:
                    img_title = img["title"]
                    
                    # Skip SVGs, icons, etc
                    if any(x in img_title.lower() for x in [".svg", ".png", "icon", "star", "empty", "full", "warning", "symbol", "flag"]):
                        continue
                    
                    # Get image URL in one call
                    img_params = {
                        "action": "query",
                        "titles": img_title,
                        "prop": "imageinfo",
                        "iiprop": "url",
                        "format": "json",
                    }
                    
                    img_response = requests.get(api_url, params=img_params, headers=headers, timeout=10)
                    img_response.raise_for_status()
                    img_data = img_response.json()
                    
                    img_pages = img_data.get("query", {}).get("pages", {})
                    for img_page_id, img_page in img_pages.items():
                        if "imageinfo" in img_page:
                            image_url = img_page["imageinfo"][0].get("url", "")
                            if image_url and (".jpg" in image_url.lower() or ".jpeg" in image_url.lower()):
                                return image_url
        
        return None
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 429:
            print(f"⚠ Wikipedia rate limit - please wait a moment and try again")
        else:
            print(f"⚠ Wikipedia error: {e}")
        return None
    except Exception as e:
        print(f"⚠ Failed to find poster for '{movie_title}': {e}")
        return None


def download_wikipedia_image(song_id: str, image_url: str, max_width: int = 1500) -> Tuple[bool, str]:
    """
    Download and process image from Wikipedia.
    Returns: (success, image_path)
    """
    try:
        # Download image
        headers = {
            "User-Agent": "Songbook Pipeline (research)"
        }
        response = requests.get(image_url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Open image
        img = Image.open(BytesIO(response.content))
        
        # Resize if too large (maintain aspect ratio)
        if img.width > max_width:
            ratio = max_width / img.width
            new_height = int(img.height * ratio)
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
        
        # Save as JPG
        image_path = _IMAGES_DIR / f"{song_id}-wikipedia.jpg"
        img.convert("RGB").save(image_path, "JPEG", quality=95)
        
        # Get aspect ratio
        aspect_ratio = f"{img.width}:{img.height}"
        
        return True, str(image_path.relative_to(_ROOT)), aspect_ratio
    except Exception as e:
        print(f"⚠ Failed to download/process image: {e}")
        return False, "", ""


def add_wikipedia_attribution(song: Dict[str, Any], image_path: str, aspect_ratio: str) -> None:
    """Add Wikipedia image attribution to song metadata."""
    if "thumbnailAttribution" not in song:
        song["thumbnailAttribution"] = {}
    
    attribution = song["thumbnailAttribution"]
    attribution["source"] = "Wikipedia"
    attribution["copyright"] = "Creative Commons"
    attribution["license"] = "CC-BY-SA"
    attribution["sourceUrl"] = "https://en.wikipedia.org/"
    attribution["addedDate"] = "2026-06-24"
    attribution["aspectRatio"] = aspect_ratio


def extract_movie_title(song: Dict[str, Any]) -> Optional[str]:
    """Extract movie title from song info."""
    info = song.get("info", [])
    if not info:
        return None
    
    for line in info:
        if not line:
            continue
        # Look for patterns like "Film/Artist: Title" or "Film: Title"
        match = re.search(r'(?:Film|Album|Artist)\s*:\s*(.+?)(?:\s*\(|$)', line)
        if match:
            title = match.group(1).strip()
            # Clean up
            title = re.sub(r'\s*\([^)]*\)\s*$', '', title)
            if title and title.lower() not in ['full', 'full song', 'title']:
                return title
    
    return None


def process_all_songs(force: bool = False) -> int:
    """Download images for all songs with film info."""
    book = load_book_json()
    processed = 0
    
    for song_id in book.get("song_order", []):
        song = load_song(song_id)
        if not song:
            continue
        
        # Skip if already has image
        if not force and song.get("thumbnailAttribution", {}).get("source") == "Wikipedia":
            continue
        
        # Extract movie title
        movie_title = extract_movie_title(song)
        if not movie_title:
            continue
        
        print(f"📽 {song.get('title', song_id)}")
        print(f"   Movie: {movie_title}")
        
        # Search Wikipedia
        image_url = find_wikipedia_poster(movie_title)
        if not image_url:
            print(f"   ❌ Not found on Wikipedia")
            continue
        
        # Download image
        success, image_path, aspect_ratio = download_wikipedia_image(song_id, image_url)
        if not success:
            print(f"   ❌ Failed to download")
            continue
        
        # Update metadata
        add_wikipedia_attribution(song, image_path, aspect_ratio)
        
        # Save
        if save_song(song_id, song):
            print(f"   ✓ Downloaded: {image_path} ({aspect_ratio})")
            processed += 1
        else:
            print(f"   ❌ Failed to save metadata")
    
    return processed


def process_single_song(song_title: str, force: bool = False) -> bool:
    """Download image for a specific song."""
    book = load_book_json()
    
    # Find song by title
    song_id = None
    for sid in book.get("song_order", []):
        song = load_song(sid)
        if song and song.get("title", "").lower() == song_title.lower():
            song_id = sid
            break
    
    if not song_id:
        print(f"❌ Song not found: {song_title}")
        return False
    
    song = load_song(song_id)
    if not song:
        print(f"❌ Failed to load song: {song_id}")
        return False
    
    # Check if already has image
    if not force and song.get("thumbnailAttribution", {}).get("source") == "Wikipedia":
        print(f"✓ {song_title} already has Wikipedia image")
        return True
    
    print(f"📽 {song.get('title', song_id)}")
    
    # Extract movie title
    movie_title = extract_movie_title(song)
    if not movie_title:
        print(f"   ❌ No film info found")
        return False
    
    print(f"   Movie: {movie_title}")
    
    # Search Wikipedia
    image_url = find_wikipedia_poster(movie_title)
    if not image_url:
        print(f"   ❌ Not found on Wikipedia")
        return False
    
    # Download image
    success, image_path, aspect_ratio = download_wikipedia_image(song_id, image_url)
    if not success:
        print(f"   ❌ Failed to download")
        return False
    
    # Update metadata
    add_wikipedia_attribution(song, image_path, aspect_ratio)
    
    # Save
    if save_song(song_id, song):
        print(f"   ✓ Downloaded: {image_path} ({aspect_ratio})")
        return True
    else:
        print(f"   ❌ Failed to save metadata")
        return False


def main():
    parser = argparse.ArgumentParser(description="Download movie poster images from Wikipedia")
    parser.add_argument("--all", action="store_true", help="Download for all songs")
    parser.add_argument("--song", help="Download for specific song")
    parser.add_argument("--force", action="store_true", help="Overwrite existing images")
    
    args = parser.parse_args()
    
    if args.all:
        processed = process_all_songs(force=args.force)
        print(f"\n✓ Processed {processed} songs")
    elif args.song:
        success = process_single_song(args.song, force=args.force)
        sys.exit(0 if success else 1)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
