#!/usr/bin/env python3
"""
scrape_musicxml.py
==================
Download MusicXML files and attach them to songs, OR auto-generate MusicXML
from existing sargam notation using the build pipeline.

───────────────────────────────────────────────────────────────────────────────
USAGE
───────────────────────────────────────────────────────────────────────────────

1. Download from a direct URL and attach to an existing song:

   python scrape_musicxml.py --url https://example.com/song.mxl --id pal-pal-dil-ke-paas

   Auto-detect song ID from the URL filename when --id is omitted:

   python scrape_musicxml.py --url https://example.com/pal-pal-dil-ke-paas.mxl

2. Auto-generate MusicXML from sargam for ALL songs (uses build_songbook.py):

   python scrape_musicxml.py --generate-all

3. Auto-generate for a single song by ID:

   python scrape_musicxml.py --generate --id pal-pal-dil-ke-paas

4. Dry run (preview / validate only, no files written):

   python scrape_musicxml.py --url URL --id ID --dry-run
   python scrape_musicxml.py --generate-all --dry-run

───────────────────────────────────────────────────────────────────────────────
OUTPUT
───────────────────────────────────────────────────────────────────────────────

Downloaded/generated files are saved to:
  <repo-root>/data/musicxml/<song-id>.musicxml

The song's JSON at data/songs/<song-id>.json is updated with:
  "musicxml": "musicxml/<song-id>.musicxml"

This field is read by the Next.js frontend to show a "Download MusicXML"
button on the song page (GET /api/musicxml/[id]).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import subprocess
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional
from xml.etree import ElementTree as ET

# ── Repository layout ──────────────────────────────────────────────────────
ROOT       = Path(__file__).resolve().parents[1]
DATA_DIR   = ROOT / "data"
SONGS_DIR  = DATA_DIR / "songs"
MXML_DIR   = DATA_DIR / "musicxml"

# ── Helpers ────────────────────────────────────────────────────────────────

def _slug(name: str) -> str:
    """Convert a display name to a filesystem-safe slug."""
    slug = name.lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug).strip("-")
    return slug


def _song_path(song_id: str) -> Optional[Path]:
    candidate = SONGS_DIR / f"{song_id}.json"
    return candidate if candidate.exists() else None


def _load_song(song_id: str) -> Optional[dict]:
    p = _song_path(song_id)
    if not p:
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def _save_song(song_id: str, data: dict) -> None:
    p = SONGS_DIR / f"{song_id}.json"
    p.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"  ✔ Updated song JSON: {p.relative_to(ROOT)}")


def _list_all_song_ids() -> list[str]:
    return [p.stem for p in sorted(SONGS_DIR.glob("*.json"))]


# ── MusicXML validation ────────────────────────────────────────────────────

def _validate_musicxml(content: bytes | str) -> tuple[bool, str]:
    """
    Check that the content looks like a valid MusicXML document.
    Returns (is_valid, message).
    """
    try:
        if isinstance(content, bytes):
            text = content.decode("utf-8", errors="replace")
        else:
            text = content

        root = ET.fromstring(text)

        # Accept both Partwise and Timewise MusicXML
        tag = root.tag
        # Strip namespace if present: {http://…}score-partwise → score-partwise
        if "}" in tag:
            tag = tag.split("}", 1)[1]

        valid_roots = {"score-partwise", "score-timewise"}
        if tag in valid_roots:
            return True, f"Valid MusicXML ({tag})"

        return False, f"Unexpected root element: <{tag}> (expected score-partwise or score-timewise)"

    except ET.ParseError as exc:
        return False, f"XML parse error: {exc}"
    except Exception as exc:  # noqa: BLE001
        return False, f"Validation error: {exc}"


# ── Downloader ─────────────────────────────────────────────────────────────

def download_musicxml(
    url: str,
    song_id: str,
    *,
    dry_run: bool = False,
) -> bool:
    """
    Download a .mxl or .musicxml file from `url`, validate it, and save it to
    data/musicxml/<song_id>.musicxml.  Returns True on success.
    """
    print(f"\n→ Downloading MusicXML from: {url}")
    print(f"  Song ID : {song_id}")

    # ── Fetch ──────────────────────────────────────────────────────────────
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "application/xml,text/xml,*/*;q=0.8",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw_bytes = resp.read()
    except urllib.error.HTTPError as exc:
        print(f"  ✖ HTTP {exc.code}: {exc.reason}")
        return False
    except urllib.error.URLError as exc:
        print(f"  ✖ Network error: {exc.reason}")
        return False

    print(f"  Downloaded {len(raw_bytes):,} bytes")

    # ── Decompress .mxl (ZIP containing rootfile.xml) ─────────────────────
    content_bytes = raw_bytes
    if url.lower().endswith(".mxl") or raw_bytes[:2] == b"PK":
        print("  Detected compressed .mxl — extracting XML…")
        try:
            import zipfile
            import io
            with zipfile.ZipFile(io.BytesIO(raw_bytes)) as zf:
                # The rootfile is usually named after the song or is the first .xml
                xml_names = [n for n in zf.namelist() if n.lower().endswith(".xml")
                             and not n.startswith("__MACOSX")]
                if not xml_names:
                    print("  ✖ No .xml file found inside .mxl archive")
                    return False
                # Prefer the entry that contains 'score' in the name, else first
                target = next(
                    (n for n in xml_names if "score" in n.lower()), xml_names[0]
                )
                content_bytes = zf.read(target)
                print(f"  Extracted: {target} ({len(content_bytes):,} bytes)")
        except Exception as exc:  # noqa: BLE001
            print(f"  ✖ Failed to decompress .mxl: {exc}")
            return False

    # ── Validate ───────────────────────────────────────────────────────────
    is_valid, msg = _validate_musicxml(content_bytes)
    if not is_valid:
        print(f"  ✖ Validation failed: {msg}")
        return False
    print(f"  ✔ {msg}")

    if dry_run:
        print("  [dry-run] Would save to data/musicxml/{}.musicxml".format(song_id))
        print("  [dry-run] Would set song.musicxml = 'musicxml/{}.musicxml'".format(song_id))
        return True

    # ── Save file ──────────────────────────────────────────────────────────
    MXML_DIR.mkdir(parents=True, exist_ok=True)
    out_path = MXML_DIR / f"{song_id}.musicxml"
    out_path.write_bytes(content_bytes)
    print(f"  ✔ Saved: {out_path.relative_to(ROOT)}")

    # ── Update song JSON ───────────────────────────────────────────────────
    song_data = _load_song(song_id)
    if song_data is None:
        print(f"  ⚠  No song JSON found at data/songs/{song_id}.json — skipping JSON update.")
        print(f"     (The MusicXML file was still saved and will be served by /api/musicxml/{song_id})")
    else:
        song_data["musicxml"] = f"musicxml/{song_id}.musicxml"
        _save_song(song_id, song_data)

    return True


# ── Generator (uses build_songbook.py) ────────────────────────────────────

def _generate_via_pipeline(
    song_ids: list[str],
    *,
    dry_run: bool = False,
) -> None:
    """
    Call build_songbook.py --format musicxml to generate MusicXML for the
    specified song IDs (or all songs if song_ids is empty).
    Moves the output files into data/musicxml/ and updates each song JSON.
    """
    import tempfile
    import shutil

    build_script = ROOT / "scripts" / "build_songbook.py"
    if not build_script.exists():
        print(f"✖ build_songbook.py not found at {build_script}")
        sys.exit(1)

    songs_input = DATA_DIR / "songs.json"
    if not songs_input.exists():
        # Build a temporary songs.json from the individual song files
        all_songs = []
        for sid in (song_ids or _list_all_song_ids()):
            d = _load_song(sid)
            if d:
                all_songs.append(d)
        if not all_songs:
            print("✖ No songs found to process.")
            return
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8"
        ) as tmp:
            json.dump(all_songs, tmp, ensure_ascii=False)
            tmp_path = Path(tmp.name)
        songs_input = tmp_path
    else:
        tmp_path = None

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        cmd = [
            sys.executable,
            str(build_script),
            "--input", str(songs_input),
            "--outdir", str(tmpdir_path),
            "--format", "musicxml",
        ]

        print(f"\n→ Running build pipeline for {len(song_ids) or 'all'} song(s)…")
        if dry_run:
            print(f"  [dry-run] Would run: {' '.join(cmd)}")
            if tmp_path:
                tmp_path.unlink(missing_ok=True)
            return

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print("✖ build_songbook.py failed:")
            print(result.stderr)
            if tmp_path:
                tmp_path.unlink(missing_ok=True)
            sys.exit(1)

        # ── Move generated files to data/musicxml/ ────────────────────────
        MXML_DIR.mkdir(parents=True, exist_ok=True)
        generated = list(tmpdir_path.glob("*.musicxml"))

        # Filter to requested song IDs if provided
        if song_ids:
            wanted = set(song_ids)
            generated = [f for f in generated if f.stem in wanted]

        if not generated:
            print("  ⚠  No .musicxml files were generated.")
            if tmp_path:
                tmp_path.unlink(missing_ok=True)
            return

        for src in generated:
            dest = MXML_DIR / src.name
            shutil.copy2(src, dest)
            print(f"  ✔ {src.name} → {dest.relative_to(ROOT)}")

            # Update song JSON
            song_id = src.stem
            song_data = _load_song(song_id)
            if song_data is not None:
                song_data["musicxml"] = f"musicxml/{song_id}.musicxml"
                _save_song(song_id, song_data)

        print(f"\n✔ Generated {len(generated)} MusicXML file(s) in data/musicxml/")

    if tmp_path:
        tmp_path.unlink(missing_ok=True)


# ── CLI ────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(
        description="Download or generate MusicXML files and attach them to songs.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--url",
        metavar="URL",
        help="Direct URL to a .mxl or .musicxml file to download.",
    )
    mode.add_argument(
        "--generate",
        action="store_true",
        help="Generate MusicXML from sargam via the build pipeline (requires --id).",
    )
    mode.add_argument(
        "--generate-all",
        action="store_true",
        help="Generate MusicXML from sargam for ALL songs via the build pipeline.",
    )

    ap.add_argument(
        "--id",
        metavar="SONG_ID",
        help="Song ID (e.g. pal-pal-dil-ke-paas). Auto-detected from URL filename if omitted.",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview actions without writing any files.",
    )

    args = ap.parse_args()

    # ── Mode: download from URL ────────────────────────────────────────────
    if args.url:
        url: str = args.url.strip()

        # Derive song ID from URL filename when not provided
        song_id = args.id
        if not song_id:
            from urllib.parse import urlparse
            filename = Path(urlparse(url).path).stem
            song_id = _slug(filename)
            if not song_id:
                print("✖ Could not derive a song ID from the URL. Use --id to specify one.")
                sys.exit(1)
            print(f"  Auto-detected song ID: {song_id}")

        ok = download_musicxml(url, song_id, dry_run=args.dry_run)
        sys.exit(0 if ok else 1)

    # ── Mode: generate single song ─────────────────────────────────────────
    if args.generate:
        if not args.id:
            ap.error("--generate requires --id <song-id>")
        _generate_via_pipeline([args.id], dry_run=args.dry_run)

    # ── Mode: generate all songs ───────────────────────────────────────────
    if args.generate_all:
        _generate_via_pipeline([], dry_run=args.dry_run)


if __name__ == "__main__":
    main()
