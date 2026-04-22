import json
import re
from pathlib import Path

# Regex to match word-form Indian sargam tokens.
# Longer words first (Dha before D, etc.) to avoid partial matches.
# Captures: (1) note word, (2) optional accidental (k)/(T), (3) optional octave '/.
_NOTE_RE = re.compile(
    r"(Dha|dha|Ni|ni|Sa|Re|Ga|Ma|ma|Pa|pa)"
    r"(\((?:k|T)\))?"
    r"(['\.])?",
)

def _load_mapping(root):
    mapping_path = root / "notation_mapping.json"
    with open(mapping_path, "r", encoding="utf-8") as f:
        return json.load(f)

def _build_flat_lookup(mapping):
    """Build a flat note-word -> western-display lookup from notation_mapping.json."""
    w2w = mapping.get("word_to_western_display", {})
    flat = {}
    for cat in ("shuddh", "low_octave", "komal", "tivra"):
        flat.update(w2w.get(cat, {}))
    return flat

def indian_to_western(indian_text, flat):
    """Convert Indian word-form notation to Western display notation.

    Conventions:
      - Middle octave: uppercase  (Sa -> C, Re -> D, ...)
      - Low octave:    lowercase  (ni -> b, dha -> a, pa -> g)
      - High octave:   uppercase + apostrophe (Sa' -> C', Re' -> D')
    """

    def _repl(m):
        note = m.group(1)
        accidental = m.group(2) or ""
        octave = m.group(3) or ""

        key = note + accidental
        western = flat.get(key)
        if western is None:
            western = flat.get(note)
        if western is None:
            return m.group(0)

        if octave == "'":
            western = western + "'"
        elif octave == ".":
            western = western.lower()

        return western

    return _NOTE_RE.sub(_repl, indian_text)

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
    mapping = _load_mapping(root)
    flat = _build_flat_lookup(mapping)

    songs_dir = root / "songs"
    count = 0
    for p in sorted(songs_dir.glob("*.json")):
        if process_file(p, flat):
            count += 1
    print(f"Updated {count} files with western notes.")

if __name__ == "__main__":
    main()
