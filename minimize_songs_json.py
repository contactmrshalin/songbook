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


def minimize(data: Dict[str, Any]) -> int:
    removed = 0
    songs = data.get("songs", [])
    if not isinstance(songs, list):
        return 0

    for song in songs:
        if not isinstance(song, dict):
            continue
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


def main() -> None:
    ap = argparse.ArgumentParser(description="Remove derived fields (western/tokens) from songs.json")
    ap.add_argument("--in", dest="inp", default="songs.json", help="Input JSON (default: songs.json)")
    ap.add_argument("--out", dest="out", default="songs.clean.json", help="Output JSON (default: songs.clean.json)")
    ap.add_argument(
        "--in-place",
        action="store_true",
        help="Overwrite the input file (still writes a .bak once if missing).",
    )
    args = ap.parse_args()

    inp = Path(args.inp).resolve()
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

