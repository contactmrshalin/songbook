#!/usr/bin/env python3
"""
One-time migration script: split monolithic songs.json into per-song files.

Creates:
  book.json              -- book_title, book_meta, song_order[]
  songs/<song_id>.json   -- one file per song object

Usage:
  python split_songs_json.py                  # reads ./songs.json
  python split_songs_json.py path/to/songs.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def split(json_path: Path) -> None:
    root = json_path.parent

    data = json.loads(json_path.read_text(encoding="utf-8"))

    book_title: str = data.get("book_title", "My Songbook")
    book_meta: dict = data.get("book_meta", {}) or {}
    songs: list = data.get("songs", [])

    if not isinstance(songs, list):
        raise ValueError("songs.json: 'songs' must be a list")

    # -- Create songs/ directory ------------------------------------------
    songs_dir = root / "songs"
    songs_dir.mkdir(exist_ok=True)

    # -- Write individual song files --------------------------------------
    song_order: list[str] = []
    for song in songs:
        song_id = song.get("id")
        if song_id is None:
            raise ValueError(f"Song missing 'id': {song.get('title', '<unknown>')}")
        song_id = str(song_id)
        song_order.append(song_id)

        song_path = songs_dir / f"{song_id}.json"
        song_path.write_text(
            json.dumps(song, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"  wrote {song_path.relative_to(root)}")

    # -- Write book.json --------------------------------------------------
    book = {
        "book_title": book_title,
        "book_meta": book_meta,
        "song_order": song_order,
    }
    book_path = root / "book.json"
    book_path.write_text(
        json.dumps(book, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"  wrote {book_path.relative_to(root)}")

    print(f"\nDone. {len(song_order)} song(s) extracted into {songs_dir.relative_to(root)}/")


def main() -> None:
    if len(sys.argv) > 1:
        json_path = Path(sys.argv[1]).resolve()
    else:
        json_path = Path(__file__).resolve().parent / "songs.json"

    if not json_path.exists():
        print(f"Error: {json_path} not found", file=sys.stderr)
        sys.exit(1)

    print(f"Splitting {json_path} ...")
    split(json_path)


if __name__ == "__main__":
    main()
