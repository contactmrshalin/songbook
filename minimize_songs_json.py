#!/usr/bin/env python3
"""
Minimize songs.json by removing derived notation fields.

This project can derive Western display and MusicXML tokens from the Indian line in code,
so we keep songs.json as the single source of truth:
  - keep: lyrics, indian (+ song metadata)
  - remove: western, tokens

Default behavior:
  - reads:  songs.json
  - writes: songs.clean.json
  - does NOT modify the input file unless you set --in-place
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict


def minimize_song(song: Dict[str, Any]) -> int:
    """Remove derived fields from a single song dict. Returns count of removed keys."""
    removed = 0
    for section in (song.get("sections") or []):
        if not isinstance(section, dict):
            continue
        for line in (section.get("lines") or []):
            if not isinstance(line, dict):
                continue
            if "western" in line:
                line.pop("western", None)
                removed += 1
            if "tokens" in line:
                line.pop("tokens", None)
                removed += 1
    return removed


def minimize(data: Dict[str, Any]) -> int:
    """Remove derived fields from a legacy songs.json structure (with top-level 'songs' list)."""
    removed = 0
    songs = data.get("songs", [])
    if not isinstance(songs, list):
        return 0

    for song in songs:
        if not isinstance(song, dict):
            continue
        removed += minimize_song(song)
    return removed


def main() -> None:
    ap = argparse.ArgumentParser(description="Remove derived fields (western/tokens) from songs.json")
    ap.add_argument("--in", dest="inp", default="songs.json", help="Input JSON (default: songs.json)")
    ap.add_argument("--out", dest="out", default="songs.clean.json", help="Output JSON (default: songs.clean.json)")
    ap.add_argument(
        "--in-place",
        action="store_true",
        help="Overwrite the input file (still writes a .bak once if missing).",
    )
    ap.add_argument("--songs-dir", default="", help="Process individual song files in this directory")
    args = ap.parse_args()

    inp = Path(args.inp).resolve()

    # Check for per-song layout
    songs_dir = Path(args.songs_dir) if args.songs_dir else inp.parent / "songs"
    if songs_dir.is_dir() and any(songs_dir.glob("*.json")):
        total = 0
        for sf in sorted(songs_dir.glob("*.json")):
            data = json.loads(sf.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                continue
            removed = minimize_song(data)
            if removed:
                sf.write_text(
                    json.dumps(data, indent=2, ensure_ascii=False) + "\n",
                    encoding="utf-8",
                )
                total += removed
        print(f"Minimized songs/ directory (removed {total} derived keys)")
        return

    # Legacy fallback: read/write songs.json
    if not inp.exists():
        raise SystemExit(f"Missing input: {inp}")

    data: Dict[str, Any] = json.loads(inp.read_text(encoding="utf-8"))
    removed = minimize(data)

    if args.in_place:
        bak = inp.with_suffix(inp.suffix + ".bak")
        if not bak.exists():
            bak.write_text(inp.read_text(encoding="utf-8"), encoding="utf-8")
        outp = inp
    else:
        outp = Path(args.out).resolve()

    outp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {outp.name} (removed {removed} keys: western/tokens)")


if __name__ == "__main__":
    main()

