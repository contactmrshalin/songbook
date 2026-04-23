"""
Strip stored western notation from song JSON files.

Western notation is now generated on-the-fly at build time (PDF, EPUB, Hugo
site) using notation_mapping.json. Storing it in the song files is no longer
necessary.

Usage:
    python scripts/strip_western.py          # strip from songs/*.json
    python scripts/strip_western.py --dry-run # preview without writing
"""

import argparse
import json
from pathlib import Path

def strip_file(file_path: Path, *, dry_run: bool = False) -> bool:
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    changed = False
    for sec in data.get("sections", []):
        for line in sec.get("lines", []):
            if "western" in line:
                del line["western"]
                changed = True

    if changed and not dry_run:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")

    return changed

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Remove stored western notation from song JSON files."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show which files would be modified without writing.",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    songs_dir = root / "songs"
    count = 0
    for p in sorted(songs_dir.glob("*.json")):
        if strip_file(p, dry_run=args.dry_run):
            action = "would strip" if args.dry_run else "stripped"
            print(f"  {action}: {p.name}")
            count += 1

    label = "would be updated" if args.dry_run else "updated"
    print(f"\n{count} file(s) {label}.")

if __name__ == "__main__":
    main()
