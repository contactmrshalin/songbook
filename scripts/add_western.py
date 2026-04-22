import json
from pathlib import Path

from songbook.mapping import load_mapping, build_flat_lookup, indian_to_western

def process_file(file_path, flat):
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    changed = False
    for sec in data.get("sections", []):
        for line in sec.get("lines", []):
            indian = line.get("indian", "")
            if indian:
                new_western = indian_to_western(indian, flat)
                if line.get("western") != new_western:
                    line["western"] = new_western
                    changed = True

    if changed:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    return changed

def main():
    root = Path(__file__).resolve().parents[1]
    mapping = load_mapping(root)
    flat = build_flat_lookup(mapping)

    songs_dir = root / "songs"
    count = 0
    for p in sorted(songs_dir.glob("*.json")):
        if process_file(p, flat):
            count += 1
    print(f"Updated {count} files with western notes.")

if __name__ == "__main__":
    main()
