#!/usr/bin/env python3
"""
Normalize Indian sargam display strings in songs.json.

Goal (display-only):
- Use: Sa Re Ga Ma Pa Dha Ni
- Komal (flat): Re(k) Ga(k) Dha(k) Ni(k)
- Tivra (sharp): Ma(T)

Notes:
- This script updates ONLY the `line["indian"]` strings for display in PDF/EPUB.
- `tokens` are now derived at build time from the Indian line, so this script does not
  need to (and does not) touch any token data.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict


ROOT = Path(__file__).resolve().parent
SONGS_JSON = ROOT / "songs.json"
NOTATION_MAPPING_JSON = ROOT / "notation_mapping.json"


def _default_notation_mapping() -> Dict[str, Any]:
    return {
        "octave_markers": {"low": ".", "middle": "", "high": "'"},
        "accidental_markers": {"komal": "(k)", "tivra": "(T)"},
        "word_to_token": {"Sa": "S", "Re": "R", "Ga": "G", "Ma": "m", "Pa": "P", "Dha": "D", "Ni": "N"},
        "komal_word_to_token": {"Re": "r", "Ga": "g", "Dha": "d", "Ni": "n"},
        "tivra_word_to_token": {"Ma": "M"},
    }


def _load_notation_mapping() -> Dict[str, Any]:
    try:
        if NOTATION_MAPPING_JSON.exists():
            return json.loads(NOTATION_MAPPING_JSON.read_text(encoding="utf-8"))
    except Exception:
        pass
    return _default_notation_mapping()


_NOTATION = _load_notation_mapping()
_OCT_LOW = str((_NOTATION.get("octave_markers", {}) or {}).get("low", "."))
_OCT_HIGH = str((_NOTATION.get("octave_markers", {}) or {}).get("high", "'"))
_ACC_KOMAL = str((_NOTATION.get("accidental_markers", {}) or {}).get("komal", "(k)"))
_ACC_TIVRA = str((_NOTATION.get("accidental_markers", {}) or {}).get("tivra", "(T)"))

# Canonical word forms.
_WORD_CANON = {"SA": "Sa", "RE": "Re", "GA": "Ga", "MA": "Ma", "PA": "Pa", "DHA": "Dha", "NI": "Ni"}

# Letter → canonical word (for shuddh). Ma is special: m=Ma, M=Ma(T).
_LETTER_WORD = {"S": "Sa", "R": "Re", "G": "Ga", "P": "Pa", "D": "Dha", "N": "Ni", "m": "Ma"}

# Lowercase komal letters → canonical word + komal marker.
_KOMAL_LOWER = {"r": "Re", "g": "Ga", "d": "Dha", "n": "Ni"}


def _normalize_indian_text(s: str) -> str:
    if not s:
        return s

    out = s

    # Normalize curly apostrophe and other common variants.
    out = out.replace("’", "'")

    # Accept/normalize user ordering where octave marker appears before (k)/(T):
    #   Re.(k) -> Re(k).
    # Do this for both words and letters.
    out = re.sub(r"(?i)\b(Sa|Re|Ga|Ma|Pa|Dha|Ni)([.'])(\((?:k|K|t|T)\))", r"\1\3\2", out)
    out = re.sub(r"(?i)([SRGmMPDNrgdn])([.'])(\((?:k|K|t|T)\))", r"\1\3\2", out)

    # Normalize Ma sharp variants first.
    # - M# / MA# / Ma# / M(T) / MA(T) / Ma(T) => Ma(T)
    out = re.sub(r"\bMA\((?:T|t)\)\b", "Ma(T)", out)
    out = re.sub(r"\bM\((?:T|t)\)\b", "Ma(T)", out)
    out = re.sub(r"\bMA#", "Ma(T)", out)
    out = re.sub(r"\bMa#", "Ma(T)", out)
    out = re.sub(r"\bM#", "Ma(T)", out)

    # Normalize komal inline: R(k) G(k) D(k) N(k) and word forms Dha(k), etc.
    def repl_komal_inline(m: re.Match[str]) -> str:
        note = m.group(1).upper()
        return {
            "R": f"Re{_ACC_KOMAL}",
            "G": f"Ga{_ACC_KOMAL}",
            "D": f"Dha{_ACC_KOMAL}",
            "N": f"Ni{_ACC_KOMAL}",
        }[note]

    out = re.sub(r"\b([RGDN])\((?:k|K)\)\b", repl_komal_inline, out)
    out = re.sub(r"\bDha\((?:k|K)\)\b", f"Dha{_ACC_KOMAL}", out, flags=re.IGNORECASE)
    out = re.sub(r"\bNi\((?:k|K)\)\b", f"Ni{_ACC_KOMAL}", out, flags=re.IGNORECASE)
    out = re.sub(r"\bRe\((?:k|K)\)\b", f"Re{_ACC_KOMAL}", out, flags=re.IGNORECASE)
    out = re.sub(r"\bGa\((?:k|K)\)\b", f"Ga{_ACC_KOMAL}", out, flags=re.IGNORECASE)

    # Normalize full-word swaras (SA/RE/GA/...) when they appear as standalone words.
    # Keep punctuation around words intact.
    def repl_word(m: re.Match[str]) -> str:
        return _WORD_CANON[m.group(0).upper()]

    out = re.sub(r"\b(SA|RE|GA|MA|PA|DHA|NI)\b", repl_word, out, flags=re.IGNORECASE)

    # Replace lowercase komal shorthand: r g d n (optionally with octave marks like r' or n’).
    # Dataset used comma-prefix for low octave historically; we now canonicalize low octave as dot suffix.
    def repl_komal_lower(m: re.Match[str]) -> str:
        low = m.group("low") or ""
        note = m.group("note")
        octv = m.group("oct") or ""
        # Convert legacy comma-prefix low octave into dot suffix.
        if low:
            octv = _OCT_LOW
            low = ""
        base = _KOMAL_LOWER[note]
        return f"{base}{_ACC_KOMAL}{octv}"

    out = re.sub(
        # Avoid re-matching inside already-expanded words like "Re" / "Ga" / "Dha".
        r"(?P<low>,)?(?P<note>[rgdn])(?P<oct>[']{1,2}|\.)?(?![a-z])",
        repl_komal_lower,
        out,
    )

    # Replace single-letter sargam notes with names (preserve comma prefix and octave marks).
    # Avoid touching letters inside existing words like "Gum" (they won't match due to context).
    def repl_letter(m: re.Match[str]) -> str:
        low = m.group("low") or ""
        note = m.group("note")
        octv = m.group("oct") or ""
        # Legacy comma-prefix low octave -> dot suffix.
        if low:
            octv = _OCT_LOW
            low = ""
        # Tivra Ma token is "M" (or variants normalized earlier): emit Ma(T)
        if note == "M":
            return f"Ma{_ACC_TIVRA}{octv}"
        base = _LETTER_WORD.get(note)
        if not base:
            return m.group(0)
        return f"{base}{octv}"

    out = re.sub(
        # Critical: don't match the leading letters of already-expanded words like "Re", "Sa", "Dha".
        # This keeps us from producing artifacts like "Ree" / "Dhaha".
        r"(?P<low>,)?(?P<note>[SRGmMPDN])(?P<oct>[']{1,2}|\.)?(?![a-z])",
        repl_letter,
        out,
    )

    # Canonicalize any remaining legacy comma-prefix on word tokens: ,Sa ,Re(k) etc -> Sa. Re(k).
    def repl_word_low(m: re.Match[str]) -> str:
        w = m.group("w")
        acc = m.group("acc") or ""
        return f"{w}{acc}{_OCT_LOW}"

    out = re.sub(
        r",(?P<w>Sa|Re|Ga|Ma|Pa|Dha|Ni)(?P<acc>\((?:k|K|t|T)\))?",
        repl_word_low,
        out,
    )

    # Ensure accidental marker casing: (k) and (T)
    out = re.sub(r"\((?:k|K)\)", _ACC_KOMAL, out)
    out = re.sub(r"\((?:t|T)\)", _ACC_TIVRA, out)

    # Final canonical ordering: accidental before octave marker.
    out = re.sub(
        r"\b(Sa|Re|Ga|Ma|Pa|Dha|Ni)([.']+)(\((?:k|K|t|T)\))",
        r"\1\3\2",
        out,
        flags=re.IGNORECASE,
    )

    return out


def main() -> None:
    if not SONGS_JSON.exists():
        raise SystemExit(f"Missing: {SONGS_JSON}")

    data: Dict[str, Any] = json.loads(SONGS_JSON.read_text(encoding="utf-8"))
    songs = data.get("songs", [])
    if not isinstance(songs, list):
        raise SystemExit("songs.json: 'songs' must be a list")

    changed = 0
    for song in songs:
        if not isinstance(song, dict):
            continue
        for section in (song.get("sections") or []):
            if not isinstance(section, dict):
                continue
            for line in (section.get("lines") or []):
                if not isinstance(line, dict):
                    continue
                indian = line.get("indian")
                if not isinstance(indian, str):
                    continue
                new_indian = _normalize_indian_text(indian)
                if new_indian != indian:
                    line["indian"] = new_indian
                    changed += 1

    # Write backup + updated file
    backup = SONGS_JSON.with_suffix(".json.bak")
    if not backup.exists():
        backup.write_text(SONGS_JSON.read_text(encoding="utf-8"), encoding="utf-8")

    SONGS_JSON.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Updated {changed} indian lines in {SONGS_JSON.name}. Backup: {backup.name}")


if __name__ == "__main__":
    main()

