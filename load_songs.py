#!/usr/bin/env python3
"""
Shared song-loading utilities for the Songbook Pipeline.

Supports two layouts:
  1. Per-song files  (preferred): book.json + songs/<id>.json
  2. Legacy monolith (fallback):  songs.json

All scripts import from here so the file-layout logic lives in one place.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _boolish(v: Any, *, default: bool = True) -> bool:
    """
    Convert a loose JSON value into a bool.
    Accepts bool/int/str like: true/false, 1/0, "yes"/"no".
    """
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    if isinstance(v, str):
        s = v.strip().lower()
        if s in ("true", "t", "1", "yes", "y", "on"):
            return True
        if s in ("false", "f", "0", "no", "n", "off"):
            return False
    return default


def _write_json(path: Path, data: Any) -> None:
    """Write *data* as pretty-printed JSON (indent=2, ensure_ascii=False)."""
    path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _read_json(path: Path) -> Any:
    """Read and parse a JSON file."""
    return json.loads(path.read_text(encoding="utf-8"))


def _uses_per_song_layout(root: Path) -> bool:
    """
    Return True when the project uses the per-song file layout.

    Detection: the ``songs/`` directory exists **and** contains at least
    one ``.json`` file.
    """
    songs_dir = root / "songs"
    if not songs_dir.is_dir():
        return False
    return any(songs_dir.glob("*.json"))


def _load_legacy(root: Path) -> Dict[str, Any]:
    """Load the monolithic ``songs.json`` and return its top-level dict."""
    return _read_json(root / "songs.json")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_book_meta(root: Path) -> Tuple[str, Dict[str, Any]]:
    """
    Return ``(book_title, book_meta)`` from ``book.json``.

    Falls back to reading the legacy ``songs.json`` if the per-song layout
    is not detected.
    """
    if _uses_per_song_layout(root):
        book = _read_json(root / "book.json")
        return book.get("book_title", "My Songbook"), book.get("book_meta", {}) or {}

    data = _load_legacy(root)
    return data.get("book_title", "My Songbook"), data.get("book_meta", {}) or {}


def load_song_order(root: Path) -> List[str]:
    """
    Return the ordered list of song IDs from ``book.json["song_order"]``.

    Falls back to extracting IDs from ``songs.json["songs"]``.
    """
    if _uses_per_song_layout(root):
        book = _read_json(root / "book.json")
        return list(book.get("song_order", []))

    data = _load_legacy(root)
    songs = data.get("songs", [])
    if not isinstance(songs, list):
        return []
    return [str(s.get("id", "")) for s in songs if isinstance(s, dict)]


def load_song(root: Path, song_id: str) -> Dict[str, Any]:
    """
    Load a single song by *song_id*.

    Prefers ``songs/<song_id>.json``; falls back to scanning ``songs.json``.

    Raises ``FileNotFoundError`` if the song cannot be found in either layout.
    """
    per_song_path = root / "songs" / f"{song_id}.json"
    if per_song_path.is_file():
        return _read_json(per_song_path)

    # Fallback: search inside songs.json
    legacy_path = root / "songs.json"
    if legacy_path.is_file():
        data = _read_json(legacy_path)
        for s in data.get("songs", []):
            if isinstance(s, dict) and str(s.get("id", "")) == song_id:
                return s

    raise FileNotFoundError(f"Song not found: {song_id}")


def load_all_songs(root: Path) -> List[Dict[str, Any]]:
    """
    Load every song in order.

    Uses ``song_order`` from ``book.json`` to determine order.  Any song
    files found in ``songs/`` that are *not* listed in ``song_order`` are
    appended at the end in alphabetical order by filename.

    Falls back to the legacy ``songs.json`` list when the per-song layout
    is not detected.
    """
    if not _uses_per_song_layout(root):
        data = _load_legacy(root)
        songs = data.get("songs", [])
        if not isinstance(songs, list):
            return []
        return songs

    order = load_song_order(root)

    songs_dir = root / "songs"
    all_files = {p.stem: p for p in sorted(songs_dir.glob("*.json"))}

    ordered: List[Dict[str, Any]] = []
    seen: set[str] = set()

    # Songs in the declared order first.
    for sid in order:
        if sid in seen:
            continue
        seen.add(sid)
        path = songs_dir / f"{sid}.json"
        if path.is_file():
            ordered.append(_read_json(path))

    # Append any extra songs not in the order list (alphabetically).
    for stem in sorted(all_files):
        if stem not in seen:
            ordered.append(_read_json(all_files[stem]))

    return ordered


def load_songbook(root: Path) -> Tuple[str, Dict[str, Any], List[Dict[str, Any]]]:
    """
    Main entry point.  Returns ``(book_title, book_meta, songs_list)``.

    This is a drop-in replacement for the old ``load_songbook()`` in
    ``build_songbook.py``.  Songs with ``export`` set to a falsy value are
    filtered out (default is ``True``).
    """
    book_title, book_meta = load_book_meta(root)
    songs = load_all_songs(root)

    for s in songs:
        if not isinstance(s, dict):
            continue
        s.setdefault("export", True)
        s["export"] = _boolish(s.get("export", True), default=True)
        s.setdefault("info", [])
        s.setdefault("sections", [])
        s.setdefault("thumbnail", "")
        s.setdefault("background", "")
        s.setdefault("background_mode", "")

    songs_export = [s for s in songs if isinstance(s, dict) and _boolish(s.get("export", True), default=True)]
    return book_title, book_meta, songs_export


# ---------------------------------------------------------------------------
# Save helpers
# ---------------------------------------------------------------------------

def save_song(root: Path, song: Dict[str, Any]) -> Path:
    """
    Save a single song to ``songs/<id>.json``.  Returns the written path.

    Creates the ``songs/`` directory if it does not exist.
    """
    songs_dir = root / "songs"
    songs_dir.mkdir(exist_ok=True)

    song_id = str(song["id"])
    path = songs_dir / f"{song_id}.json"
    _write_json(path, song)
    return path


def save_book_meta(
    root: Path,
    book_title: str,
    book_meta: Dict[str, Any],
    song_order: List[str],
) -> Path:
    """
    Save ``book.json``.  Returns the written path.
    """
    book = {
        "book_title": book_title,
        "book_meta": book_meta,
        "song_order": song_order,
    }
    path = root / "book.json"
    _write_json(path, book)
    return path


def iter_song_files(root: Path) -> List[Path]:
    """
    Return all ``songs/*.json`` file paths, sorted alphabetically.
    """
    songs_dir = root / "songs"
    if not songs_dir.is_dir():
        return []
    return sorted(songs_dir.glob("*.json"))
