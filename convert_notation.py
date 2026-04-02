"""
Convert all song notation from single-letter system to word-based system.

Old system:  S  R  G  m(shuddh) M(tivra) P  D  N   | low: p d n | high: S' R' etc | komal: D(k) etc
New system:  Sa Re Ga ma(shuddh) Ma(tivra) Pa Dha Ni | low: pa dha ni | high: Sa' Re' etc | komal: Dha(k) etc
"""

import json
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Regex helpers
# ---------------------------------------------------------------------------

# For extracting ordered note tokens from Indian notation
# Match word-form first (longer), then single-letter form
INDIAN_TOKEN_RE = re.compile(
    r"(Dha|dha|Ni|ni|Sa|Re|Ga|Ma|ma|Pa|pa)"   # word-form notes
    r"("
    r"  '   |"  # high octave marker
    r"  \.  "   # low octave marker (used in some songs)
    r")?"
    r"(\(k\)|\(T\))?"  # komal/tivra marker
    r"|"
    r"([SRGMPDNsrgmpdn])"  # single-letter notes
    r"("
    r"  '   |"
    r"  \.  "
    r")?"
    r"(\(k\)|\(T\))?",
    re.VERBOSE
)

# For extracting western note tokens
WESTERN_TOKEN_RE = re.compile(
    r"([A-G][#b]?)"
    r"(['\.])?",
)

def extract_indian_notes(text):
    """Extract ordered list of indian note tokens from a notation string."""
    notes = []
    for m in INDIAN_TOKEN_RE.finditer(text):
        if m.group(1):  # word form
            notes.append(m.group(0))
        elif m.group(4):  # single letter form
            notes.append(m.group(0))
    return notes

def extract_western_notes(text):
    """Extract ordered list of western note tokens from a notation string."""
    notes = []
    for m in WESTERN_TOKEN_RE.finditer(text):
        notes.append(m.group(0))
    return notes

# ---------------------------------------------------------------------------
# Single-letter to word conversion (for single-letter notation songs)
# ---------------------------------------------------------------------------

def convert_single_letter_notation(text):
    """
    Convert single-letter Indian notation to word notation.
    S -> Sa, R -> Re, G -> Ga, m -> ma, M -> Ma, P -> Pa, D -> Dha, N -> Ni
    Low octave: p -> pa, d -> dha, n -> ni
    High octave: S' -> Sa', R' -> Re', etc.
    Komal: D(k) -> Dha(k), N(k) -> Ni(k), R(k) -> Re(k), G(k) -> Ga(k)
    """

    # Use a single-pass regex to match note tokens and replace them
    # Pattern matches a single-letter note with optional suffix
    # Negative lookbehind/lookahead ensure we don't match inside words

    def replace_note(match):
        letter = match.group(1)
        suffix = match.group(2) or ""

        upper_map = {
            "S": "Sa", "R": "Re", "G": "Ga", "M": "Ma",
            "P": "Pa", "D": "Dha", "N": "Ni"
        }
        lower_map = {
            "m": "ma", "p": "pa", "d": "dha", "n": "ni"
        }

        if letter in upper_map:
            return upper_map[letter] + suffix
        elif letter in lower_map:
            return lower_map[letter] + suffix
        return match.group(0)

    # Match single letter note not preceded/followed by a letter
    # Optional suffix: ' (high octave), (k) (komal), (T) (tivra)
    pattern = re.compile(
        r"(?<![a-zA-Z])"
        r"([SRGMmPDNpdn])"
        r"(\(k\)|\(T\)|')?"
        r"(?![a-zA-Z])"
    )

    return pattern.sub(replace_note, text)

# ---------------------------------------------------------------------------
# Ma/ma fix for word-notation songs
# ---------------------------------------------------------------------------

def fix_ma_in_word_notation(indian_text, western_text):
    """
    In word-notation songs, the old system used 'Ma' for both shuddh and tivra Ma.
    New system: ma = shuddh (F natural), Ma = tivra (F#).

    Cross-reference with western notation to determine which is which.
    """
    if "Ma" not in indian_text:
        return indian_text

    # If no western text, default: Ma -> ma (shuddh was the default mapping)
    if not western_text:
        return indian_text.replace("Ma", "ma")

    # Check if line has any F# in western
    has_f_sharp = "F#" in western_text

    # If no F# at all, all Ma are shuddh -> ma
    if not has_f_sharp:
        return indian_text.replace("Ma", "ma")

    # Check if line has natural F as well
    has_f_natural = bool(re.search(r"(?<![#])F(?![#])", western_text))

    # If only F# (no natural F), all Ma stay as Ma (tivra)
    if not has_f_natural:
        return indian_text  # All Ma are tivra, keep as-is

    # Mixed case: both F and F# present - need positional alignment
    indian_notes = extract_indian_notes(indian_text)
    western_notes = extract_western_notes(western_text)

    # Build a set of positions where Ma should stay as Ma (tivra)
    tivra_positions = set()
    ma_count = 0
    wi = 0
    for i, note in enumerate(indian_notes):
        base = note.rstrip("'").rstrip(".").replace("(k)", "").replace("(T)", "")
        if base == "Ma":
            # Find corresponding western note
            if wi < len(western_notes):
                w_note = western_notes[wi]
                if "F#" in w_note:
                    tivra_positions.add(ma_count)
            ma_count += 1
        wi += 1

    # Now replace Ma instances positionally
    result = indian_text
    ma_idx = 0

    def replace_ma_positional(m):
        nonlocal ma_idx
        current = ma_idx
        ma_idx += 1
        if current in tivra_positions:
            return "Ma"  # tivra, keep uppercase
        else:
            return "ma"  # shuddh, lowercase

    # Replace each 'Ma' (word-boundary aware) positionally
    result = re.sub(r"(?<![a-zA-Z])Ma(?![a-zA-Z])", replace_ma_positional, result)
    return result

# ---------------------------------------------------------------------------
# Detection helpers
# ---------------------------------------------------------------------------

def is_single_letter_notation(indian_text):
    """Check if a text uses single-letter notation (has standalone S, R, G, P, D, N etc.)."""
    # Matches standalone uppercase note letter not part of a word notation
    single_letter_re = re.compile(r"(?<![a-zA-Z])[SRGMPDN](?![a-zA-Z])")
    return bool(single_letter_re.search(indian_text))

def has_word_notation(indian_text):
    """Check if text already uses word notation."""
    word_re = re.compile(r"(?<![a-zA-Z])(Sa|Re|Ga|Ma|ma|Pa|Dha|Ni|pa|dha|ni)(?![a-zA-Z])")
    return bool(word_re.search(indian_text))

# ---------------------------------------------------------------------------
# Process a single song dict
# ---------------------------------------------------------------------------

def process_song(song_data):
    """Convert notation in a song dict. Modifies in place and returns change count."""
    changes = 0
    for section in song_data.get("sections", []):
        for line in section.get("lines", []):
            indian = line.get("indian", "")
            western = line.get("western", "")
            if not indian:
                continue

            original = indian

            if is_single_letter_notation(indian):
                # Convert single-letter notation to word notation
                indian = convert_single_letter_notation(indian)
            elif has_word_notation(indian) and "Ma" in indian:
                # Fix Ma/ma distinction in already word-notation songs
                indian = fix_ma_in_word_notation(indian, western)

            if indian != original:
                line["indian"] = indian
                changes += 1

    return changes

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    root = Path(__file__).resolve().parent
    songs_dir = root / "songs"

    total_files = 0
    total_changes = 0
    changed_files = []

    # Process individual song files
    if songs_dir.is_dir():
        for song_file in sorted(songs_dir.glob("*.json")):
            data = json.loads(song_file.read_text(encoding="utf-8"))
            changes = process_song(data)
            if changes > 0:
                song_file.write_text(
                    json.dumps(data, indent=2, ensure_ascii=False) + "\n",
                    encoding="utf-8"
                )
                changed_files.append(song_file.name)
                total_changes += changes
            total_files += 1

    # Process legacy songs.json
    songs_json = root / "songs.json"
    if songs_json.is_file():
        data = json.loads(songs_json.read_text(encoding="utf-8"))
        songs_list = data.get("songs", [])
        legacy_changes = 0
        for song in songs_list:
            legacy_changes += process_song(song)
        if legacy_changes > 0:
            songs_json.write_text(
                json.dumps(data, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8"
            )
            total_changes += legacy_changes
            changed_files.append("songs.json")

    print(f"Processed {total_files} song files")
    print(f"Total lines changed: {total_changes}")
    print(f"Files modified: {len(changed_files)}")
    for f in changed_files:
        print(f"  {f}")

if __name__ == "__main__":
    main()
