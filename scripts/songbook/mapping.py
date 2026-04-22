"""
Shared notation-mapping utilities.

Single source of truth for:
  - Loading notation_mapping.json
  - Building the flat Indian→Western lookup table
  - Converting Indian word-form sargam to Western display notation

Used by: add_western.py, scrape_notation_url.py, site/scripts/generate_content.py
"""

import json
import re
from pathlib import Path

# Regex to match word-form Indian sargam tokens.
# Longer words first (Dha before D, etc.) to avoid partial matches.
# Captures: (1) note word, (2) optional accidental (k)/(T), (3) optional octave '/.
NOTE_RE = re.compile(
    r"(Dha|dha|Ni|ni|Sa|Re|Ga|Ma|ma|Pa|pa)"
    r"(\((?:k|T)\))?"
    r"(['\.])?",
)

def load_mapping(root):
    """Load notation_mapping.json from the project root."""
    mapping_path = root / "notation_mapping.json"
    with open(mapping_path, "r", encoding="utf-8") as f:
        return json.load(f)

def build_flat_lookup(mapping):
    """Build a flat note-word -> western-display lookup from the mapping dict."""
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
      - Komal:         flat       (Re(k) -> Db, Ni(k) -> Bb)
      - Tivra:         sharp      (Ma(T) -> F#)
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

    return NOTE_RE.sub(_repl, indian_text)
