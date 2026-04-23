"""
Preview western notation conversion (read-only).

Western notation is NO LONGER stored in song JSON files.  It is generated
on-the-fly at build time (PDF / EPUB / Hugo site) using notation_mapping.json.

This script is kept as a read-only preview / debug helper:
    python scripts/add_western.py              # show conversion for all songs
    python scripts/add_western.py <song-id>    # show conversion for one song

To strip any leftover western fields from song files, run:
    python scripts/strip_western.py
"""

import json
import sys
from pathlib import Path

from songbook.mapping import load_mapping, build_flat_lookup, indian_to_western

def preview_file(file_path, flat):
    """Print the Indian -> Western conversion for every line in a song."""
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    title = data.get("title", file_path.stem)
    lines_shown = 0
    for sec in data.get("sections", []):
        for line in sec.get("lines", []):
            indian = line.get("indian", "")
            if indian:
                western = indian_to_western(indian, flat)
                if lines_shown == 0:
                    print(f"\n--- {title} ---")
                print(f"  {indian}")
                print(f"  -> {western}")
                lines_shown += 1
    return lines_shown > 0

def main():
    root = Path(__file__).resolve().parents[1]
    mapping = load_mapping(root)
    flat = build_flat_lookup(mapping)

    songs_dir = root / "songs"

    # Optional filter by song id
    filter_id = sys.argv[1] if len(sys.argv) > 1 else None

    count = 0
    for p in sorted(songs_dir.glob("*.json")):
        if filter_id and p.stem != filter_id:
            continue
        if preview_file(p, flat):
            count += 1

    print(f"\nPreviewed {count} song(s).  (Western is generated at build time, not stored.)")

if __name__ == "__main__":
    main()
