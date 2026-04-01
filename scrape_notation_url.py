#!/usr/bin/env python3
"""
Scrape song notations from web pages and generate songs/<id>.json files.

Supported sites:
  - notationsworld.com (primary)
  - Generic pages with alternating lyrics / sargam-notation lines

Usage:
    python scrape_notation_url.py <URL>
    python scrape_notation_url.py <URL> --id my-song-id --title "My Song Title"
    python scrape_notation_url.py <URL> --dry-run        # preview without saving

Multiple URLs:
    python scrape_notation_url.py <URL1> <URL2> <URL3>

The script will:
  1. Fetch the HTML page
  2. Extract the song title, metadata, and notation lines
  3. Pair lyrics with Indian sargam notation
  4. Save as songs/<id>.json in the project's standard format
  5. Update book.json song_order
"""

from __future__ import annotations

import argparse
import html as html_mod
import json
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent


# ---------------------------------------------------------------------------
# HTML fetching & cleaning
# ---------------------------------------------------------------------------

def fetch_html(url: str, *, timeout: int = 30) -> str:
    """Download a URL and return the HTML as a string."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,*/*",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        return resp.read().decode(charset, errors="replace")


def html_to_lines(raw_html: str) -> List[str]:
    """
    Strip HTML to plain text lines.
    Preserves line breaks from <br>, </p>, </div>, </h*> etc.
    """
    body = raw_html

    # Try to narrow down to the article/content area
    for pattern in [
        r"<article[^>]*>(.*?)</article>",
        r'<div class="entry-content"[^>]*>(.*?)</div>\s*(?:</div>|<footer)',
        r'<div class="post-content"[^>]*>(.*?)</div>',
    ]:
        m = re.search(pattern, body, re.DOTALL)
        if m:
            body = m.group(1)
            break

    # Remove scripts, styles, nav
    body = re.sub(r"<script[^>]*>.*?</script>", "", body, flags=re.DOTALL)
    body = re.sub(r"<style[^>]*>.*?</style>", "", body, flags=re.DOTALL)
    body = re.sub(r"<nav[^>]*>.*?</nav>", "", body, flags=re.DOTALL)

    # Convert block elements to newlines
    body = re.sub(r"<br\s*/?>", "\n", body)
    body = re.sub(r"</p>", "\n", body)
    body = re.sub(r"</div>", "\n", body)
    body = re.sub(r"</h[1-6]>", "\n", body)
    body = re.sub(r"<h[1-6][^>]*>", "\n", body)
    body = re.sub(r"</li>", "\n", body)

    # Remove all remaining tags
    body = re.sub(r"<[^>]+>", "", body)
    body = html_mod.unescape(body)

    lines = [l.strip() for l in body.split("\n")]
    return [l for l in lines if l]


def extract_title_from_html(raw_html: str) -> str:
    """Extract page <title> from HTML."""
    m = re.search(r"<title[^>]*>(.*?)</title>", raw_html, re.DOTALL)
    if m:
        t = html_mod.unescape(m.group(1).strip())
        # Clean common suffixes
        for sep in [" - Sargam", " – Sargam", " | "]:
            if sep in t:
                t = t.split(sep)[0].strip()
        return t
    return "Untitled"


# ---------------------------------------------------------------------------
# Notation detection
# ---------------------------------------------------------------------------

# Common sargam tokens in letter notation
_SARGAM_LETTERS = set("SRGmMPDNrgdn")

# Regex for detecting sargam/notation lines (letter-style)
_SARGAM_LINE_RE = re.compile(
    r"(?:^|[\s|.…~()])([SRGmMPDNrgdn])(?:[.''\(\)kKtT~:|]|$)"
)

# Regex for word-style sargam (Sa, Re, Ga...)
_SARGAM_WORD_RE = re.compile(
    r"\b(Sa|Re|Ga|Ma|Pa|Dha|Ni)\b", re.IGNORECASE
)

# Lines that are clearly metadata/boilerplate to skip
_SKIP_PATTERNS = [
    re.compile(r"^\s*(Also Read|You May Also Like|Categories|Tags)\b", re.IGNORECASE),
    re.compile(r"^\s*(DO\s*–|RE\s*–|MI\s*–|FA\s*–|SO\s*–|LA\s*–|TI\s*–)", re.IGNORECASE),
    re.compile(r"^\s*(LOW OCTAVE|HIGH OCTAVE|KOMAL SWAR|SHUDH MA|TIWAR MA)", re.IGNORECASE),
    re.compile(r"^\s*(PA\s*–\s*p|DHA\s*–\s*d|NI\s*–\s*n|SA\s*–\s*S)", re.IGNORECASE),
    re.compile(r"^\s*🎵|^\s*🎹|^\s*🎯|^\s*🔄|^\s*📩|^\s*👋", re.IGNORECASE),
    re.compile(r"^\s*Convert\s+(to|S,\s*R)", re.IGNORECASE),
    re.compile(r"^\s*(Undo Changes|Remove Numbers)", re.IGNORECASE),
    re.compile(r"^\s*सा\s*[-–]", re.IGNORECASE),
    re.compile(r"^\d{4}$"),  # standalone year
    re.compile(r"by\s+notationsworld", re.IGNORECASE),
    re.compile(r"^\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d", re.IGNORECASE),
    # Site UI / interactive element text
    re.compile(r"C\s+D\s+E\s+Piano\s+Notes", re.IGNORECASE),
    re.compile(r"Remove\s+Numbers\s+From\s+Piano", re.IGNORECASE),
    re.compile(r"Sargam\s+Notes\s*🎶", re.IGNORECASE),
    # Page heading that repeats the title with "Sargam, Harmonium..."
    re.compile(r"Sargam,?\s*Harmonium", re.IGNORECASE),
    re.compile(r"Sargam\s+(And|&)\s+Flute", re.IGNORECASE),
    re.compile(r"Sargam\s+Notes\b", re.IGNORECASE),
    # Scale info line (we extract this separately in metadata)
    re.compile(r"^\s*SCALE\s+(OF\s+)?(THE\s+)?(FLUTE|SONG)\s+IS", re.IGNORECASE),
]


def _is_skip_line(line: str) -> bool:
    """Return True if this line is boilerplate / reference / not song content."""
    for pat in _SKIP_PATTERNS:
        if pat.search(line):
            return True
    return False


def _is_sargam_line(line: str) -> bool:
    """
    Heuristic: is this line primarily sargam notation?

    notationsworld.com uses letter-style notation with dots as separators:
      S'..N..N..D..D…N..S'…
      G'..G'..R'..S'..R'..G'..   (high-octave notes)
    """
    t = line.strip()
    if not t:
        return False

    # First check: skip if this is boilerplate text
    if _is_skip_line(t):
        return False

    # Remove dots, pipes, spaces, tildes, parens, octave marks, colons, hyphens
    # Also remove unicode right-quote and curly apostrophes used as octave markers
    cleaned = re.sub(r"[.\s|…~():'\'\u2019\u2018,kKtT\-]+", "", t)
    if not cleaned:
        return False

    # Count how many characters are sargam note letters
    sargam_count = sum(1 for c in cleaned if c in _SARGAM_LETTERS)

    # If most characters are sargam letters, it's a notation line
    # Also require at least 2 note tokens to avoid matching single chars in lyrics
    ratio = sargam_count / len(cleaned) if cleaned else 0

    if ratio >= 0.7 and sargam_count >= 2:
        return True

    # Check for the distinctive dot-separated pattern: S..R..G..
    # Also handle high-octave: S'..R'..G'..
    if re.search(r"[SRGmMPDNrgdn]['\'\u2019]?\s*\.{2,}\s*[SRGmMPDNrgdn]", t):
        return True

    return False


def _is_lyrics_line(line: str) -> bool:
    """Heuristic: is this a lyrics line (not notation, not boilerplate)?"""
    t = line.strip()
    if not t or _is_skip_line(t) or _is_sargam_line(t):
        return False

    # Check for reasonable amount of alphabetic content
    alpha = len(re.findall(r"[A-Za-zА-яа-я\u0900-\u097F]", t))
    return alpha >= 2


def _is_section_header(line: str) -> bool:
    """Detect section markers like INTRO, MUKHDA, ANTARA, INTERLUDE, REPEAT, etc."""
    t = line.strip().upper()
    section_words = {
        "INTRO", "INTRODUCTION", "MUKHDA", "MUKHRA", "STHAYI",
        "ANTARA", "ANTARAA", "INTERLUDE", "OUTRO", "CHORUS",
        "REPEAT", "HUMMING", "PRELUDE", "SARGAM",
    }
    # Check if the line IS a section header (possibly with punctuation)
    cleaned = re.sub(r"[:\-–—\s]+$", "", t).strip()
    if cleaned in section_words:
        return True
    # Also match patterns like "ANTARA 1", "CHORUS 2"
    m = re.match(r"^(\w+)\s*\d*$", cleaned)
    if m and m.group(1) in section_words:
        return True
    return False


# ---------------------------------------------------------------------------
# Notation normalization
# ---------------------------------------------------------------------------

def _normalize_notation(raw: str) -> str:
    """
    Convert notationsworld-style notation to our project's Indian display format.

    Input:  S'..N..N..D..D…N..S'…
    Output: Sa' Ni Ni Dha Dha… Ni Sa'…

    Or in a simpler pass, just clean up the separators into spaces
    and let the project's normalize_indian_notation.py handle the rest.
    """
    s = raw.strip()
    if not s:
        return s

    # Normalize curly quotes
    s = s.replace("\u2019", "'").replace("\u2018", "'")

    # FIRST: expand single-dot-separated note sequences like d.n.p.d.n
    # Iterate because each pass handles alternating matches (d.n.p → d n.p → d n p)
    _sd = re.compile(r"([SRGmMPDNrgdn]'?)\.([SRGmMPDNrgdn])")
    for _ in range(5):
        new_s = _sd.sub(r"\1 \2", s)
        if new_s == s:
            break
        s = new_s

    # Replace double-dot separators with spaces
    # Common patterns: S..R, S…R, S....R
    s = re.sub(r"\.{2,}", " ", s)
    s = s.replace("…", "... ")

    # Normalize hold patterns: "..." at end of note -> ":"
    # e.g. "R..." -> "R:"
    s = re.sub(r"\s*\.{3,}\s*", ": ", s)

    # Clean up multiple spaces
    s = re.sub(r"\s+", " ", s).strip()

    # Handle tivra Ma: M(T) or just uppercase M without octave
    s = re.sub(r"\bM\(T\)", "Ma(T)", s, flags=re.IGNORECASE)

    # Process token by token
    parts = s.split()
    result = []
    for p in parts:
        result.append(_convert_token_to_display(p))

    return " ".join(result)


def _convert_token_to_display(token: str) -> str:
    """Convert token to user's preferred literal short-form notation (S R G m M P D N)."""
    t = token.strip()
    if not t:
        return t

    # Handle hold suffix
    hold = ""
    if t.endswith(":"):
        hold = ":"
        t = t[:-1]

    # Handle octave markers
    octave = ""
    if t.endswith("'"):
        octave = "'"
        t = t[:-1]
    elif t.endswith(".") and len(t) > 1:
        octave = "."
        t = t[:-1]

    # Remove any arbitrary commas that we might have previously added
    if t.startswith(","):
        t = t[1:]

    # Already full word? Keep as-is just in case, or map it back
    if re.search(r"\b(Sa|Re|Ga|Ma|Pa|Dha|Ni)\b", t):
        return f"{t}{octave}{hold}"

    # Komal markers
    m = re.match(r"^([rgdnRGDN])\(([kK])\)$", t)
    if m:
        letter = m.group(1)
        return f"{letter}(k){octave}{hold}"

    # Tivra Ma (represented as M in user table)
    m = re.match(r"^M\(([tT])\)$", t)
    if m:
        return f"M{octave}{hold}"

    # Simple letter -> short representation mapping
    letter_to_short = {
        "S": "S", "R": "R", "G": "G",
        "m": "m", "M": "M",
        "P": "P", "D": "D", "N": "N",
        # Lowercase represents low octave, natively matched to p, d, n
        "p": "p", "d": "d", "n": "n",
        "r": "r", "g": "g",
    }

    # Handle compound tokens like "N.D.P"
    if "." in t and len(t) > 2:
        sub_tokens = [st for st in t.split(".") if st]
        def _sub_convert(st: str) -> Optional[str]:
            oct = ""
            s2 = st
            if s2.endswith("'"):
                oct = "'"
                s2 = s2[:-1]
            w = letter_to_short.get(s2)
            return f"{w}{oct}" if w else None
        converted_parts = [_sub_convert(st) for st in sub_tokens]
        if all(c is not None for c in converted_parts):
            return " ".join(converted_parts)  # type: ignore

    word = letter_to_short.get(t)
    if word:
        return f"{word}{octave}{hold}"

    # Unknown — return as-is
    return f"{t}{octave}{hold}"


# ---------------------------------------------------------------------------
# Metadata extraction
# ---------------------------------------------------------------------------

def _extract_metadata(title: str, lines: List[str]) -> Tuple[str, List[str]]:
    """
    Extract song title and info lines (movie, singer, scale, etc.)
    from the page title and early content lines.

    Returns (clean_title, info_list).
    """
    # Clean up the title
    clean_title = title.strip()
    # Remove common suffixes
    for suffix in [
        " – Sargam, Harmonium And Flute Notes",
        " - Sargam, Harmonium And Flute Notes",
        " – Sargam And Flute Notes",
        " - Sargam And Flute Notes",
        " – Sargam Notes",
        " - Sargam Notes",
        " Sargam Notes",
    ]:
        if clean_title.lower().endswith(suffix.lower()):
            clean_title = clean_title[: -len(suffix)].strip()
            break

    info: List[str] = []

    # Look for metadata in early lines.
    # IMPORTANT: Check for metadata patterns BEFORE the generic skip filter,
    # because lines like "Song (Artist) – Sargam, Harmonium..." and
    # "SCALE OF THE FLUTE IS C" match skip patterns but contain metadata.
    for line in lines[:20]:
        l = line.strip()

        # Extract "SCALE OF THE FLUTE/SONG IS ..."
        m = re.search(r"SCALE\s+(?:OF\s+)?(?:THE\s+)?(?:FLUTE|SONG)\s+IS\s+(.+)", l, re.IGNORECASE)
        if m:
            scale_val = m.group(1).strip()
            # Remove trailing "– Sargam..." if present
            scale_val = re.sub(r"\s*[–-]\s*Sargam.*$", "", scale_val, flags=re.IGNORECASE).strip()
            info.append(f"Scale: {scale_val}")
            continue

        # Extract artist from heading pattern "Song Name (Artist) – Sargam, Harmonium..."
        m = re.match(r"^(.+?)\s*\(([^)]+)\)\s*(?:–|-)\s*Sargam", l, re.IGNORECASE)
        if m:
            clean_title = m.group(1).strip()
            artist = m.group(2).strip()
            if not any("Film/Artist" in i for i in info):
                info.append(f"Film/Artist: {artist}")
            continue

        # Skip other boilerplate
        if _is_skip_line(l):
            continue

    # If title has (Artist) pattern, extract it
    m = re.match(r"^(.+?)\s*\(([^)]+)\)\s*$", clean_title)
    if m:
        clean_title = m.group(1).strip()
        artist = m.group(2).strip()
        if not any("Film/Artist" in i for i in info):
            info.insert(0, f"Film/Artist: {artist}")

    return clean_title, info


# ---------------------------------------------------------------------------
# Main extraction pipeline
# ---------------------------------------------------------------------------

def extract_song_from_url(
    url: str,
    *,
    song_id: Optional[str] = None,
    song_title: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Fetch a URL and extract song data into the project's JSON format.

    Returns a song dict ready to be saved via save_song().
    """
    print(f"Fetching: {url}")
    raw_html = fetch_html(url)

    page_title = extract_title_from_html(raw_html)
    lines = html_to_lines(raw_html)

    # Extract metadata
    title, info = _extract_metadata(page_title, lines)

    # Override with explicit args if provided
    if song_title:
        title = song_title

    if not song_id:
        song_id = _slugify(title)

    info.append(f"Source: {url}")

    # Filter out boilerplate lines
    content_lines = []
    in_content = False
    for line in lines:
        if _is_skip_line(line):
            # If we've already started collecting content, check if we've
            # hit the "Also Read" / reference section at the bottom
            if in_content and re.search(r"Also Read|You May Also Like", line, re.IGNORECASE):
                break
            continue
        # Skip the page heading / date / author lines at the top
        if not in_content:
            if _is_sargam_line(line) or _is_lyrics_line(line) or _is_section_header(line):
                in_content = True
            else:
                continue
        if in_content:
            content_lines.append(line)

    # Pair lyrics and notation lines
    sections = _pair_lyrics_and_notation(content_lines)

    song = {
        "id": song_id,
        "title": title,
        "export": True,
        "info": info,
        "thumbnail": "",
        "background": "",
        "sections": sections,
    }

    return song


def _pair_lyrics_and_notation(lines: List[str]) -> List[Dict[str, Any]]:
    """
    Walk through content lines and pair lyrics with their notation lines.

    The typical pattern on notationsworld.com is:
      Lyrics line 1
      S..R..G..M..P..   (notation for lyrics line 1)
      Lyrics line 2
      D..P..M..R..      (notation for lyrics line 2)

    Section headers (INTRO, ANTARA, etc.) start new sections.
    """
    sections: List[Dict[str, Any]] = []
    current_section: Dict[str, Any] = {"name": "STHAYI", "lines": []}
    sections.append(current_section)

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Section header?
        if _is_section_header(line):
            # Start a new section
            current_section = {"name": line.strip().upper(), "lines": []}
            sections.append(current_section)
            i += 1
            continue

        # Check if this is a lyrics line followed by a notation line
        if _is_lyrics_line(line):
            lyrics = line
            indian = ""

            # Look ahead for notation
            if i + 1 < len(lines) and _is_sargam_line(lines[i + 1]):
                indian = _normalize_notation(lines[i + 1])
                i += 2
            else:
                i += 1

            current_section["lines"].append({
                "lyrics": lyrics,
                "indian": indian,
            })
            continue

        # Standalone notation line (no lyrics before it)
        if _is_sargam_line(line):
            indian = _normalize_notation(line)
            current_section["lines"].append({
                "lyrics": "",
                "indian": indian,
            })
            i += 1
            continue

        # Unknown line — skip
        i += 1

    # Remove empty sections
    sections = [s for s in sections if s.get("lines")]

    # If we have only one section, name it STHAYI
    if len(sections) == 1 and not sections[0].get("name"):
        sections[0]["name"] = "STHAYI"

    return sections


def _slugify(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return s or "song"


# ---------------------------------------------------------------------------
# Save helpers
# ---------------------------------------------------------------------------

def save_song_to_project(root: Path, song: Dict[str, Any]) -> Path:
    """Save the song JSON and update book.json."""
    try:
        from load_songs import save_song, load_song_order, save_book_meta, load_book_meta

        path = save_song(root, song)
        order = load_song_order(root)
        song_id = str(song["id"])
        if song_id not in order:
            order.append(song_id)
            title, meta = load_book_meta(root)
            save_book_meta(root, title, meta, order)
        return path
    except ImportError:
        pass

    # Inline fallback
    songs_dir = root / "songs"
    songs_dir.mkdir(exist_ok=True)
    song_id = str(song["id"])
    song_path = songs_dir / f"{song_id}.json"
    song_path.write_text(
        json.dumps(song, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    book_path = root / "book.json"
    if book_path.exists():
        book = json.loads(book_path.read_text(encoding="utf-8"))
    else:
        book = {"book_title": "My Songbook", "book_meta": {}, "song_order": []}
    order = book.get("song_order", [])
    if song_id not in order:
        order.append(song_id)
        book["song_order"] = order
        book_path.write_text(
            json.dumps(book, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

    return song_path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(
        description="Scrape song notations from a web page and generate songs/<id>.json",
        epilog=(
            "Examples:\n"
            "  python scrape_notation_url.py https://www.notationsworld.com/bheegi-bheegi-raaton-mein-sargam-harmonium-and-flute-notes.html\n"
            "  python scrape_notation_url.py URL --id my-song --title 'My Song'\n"
            "  python scrape_notation_url.py URL --dry-run\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("urls", nargs="+", help="URL(s) to scrape")
    ap.add_argument("--id", default="", help="Override song ID (only for single URL)")
    ap.add_argument("--title", default="", help="Override song title (only for single URL)")
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the extracted JSON without saving to disk.",
    )
    ap.add_argument(
        "--raw",
        action="store_true",
        help="Keep notation in letter form (S R G) instead of converting to word form (Sa Re Ga).",
    )
    args = ap.parse_args()

    if args.id and len(args.urls) > 1:
        print("Warning: --id is ignored when processing multiple URLs.", file=sys.stderr)

    for url in args.urls:
        try:
            song = extract_song_from_url(
                url,
                song_id=args.id if len(args.urls) == 1 else None,
                song_title=args.title if len(args.urls) == 1 else None,
            )

            if args.raw:
                # Don't convert to word form — but we already did in _normalize_notation.
                # For --raw, we'd re-extract without word conversion.
                # For now, this flag is a future enhancement.
                pass

            if args.dry_run:
                print(json.dumps(song, indent=2, ensure_ascii=False))
                print()
            else:
                path = save_song_to_project(ROOT, song)
                print(f"✅ Saved: {path}")
                print(f"   Song: {song['title']} (id: {song['id']})")
                lines_count = sum(
                    len(sec.get("lines", []))
                    for sec in song.get("sections", [])
                )
                print(f"   Sections: {len(song['sections'])}, Lines: {lines_count}")
                print()

        except urllib.error.HTTPError as e:
            print(f"❌ HTTP Error {e.code}: {url}", file=sys.stderr)
        except urllib.error.URLError as e:
            print(f"❌ Network Error: {e.reason} — {url}", file=sys.stderr)
        except Exception as e:
            print(f"❌ Error processing {url}: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    main()
