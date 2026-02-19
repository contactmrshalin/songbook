#!/usr/bin/env python3
"""
Generate Hugo content bundles from song data.

Supports two layouts (via the shared ``load_songs`` module):
  1. Per-song files  (preferred): book.json + songs/<id>.json
  2. Legacy monolith (fallback):  songs.json

Creates:
  site/content/songs/<id>/index.md
  site/content/songs/<id>/<thumb> (copied)
  site/content/songs/<id>/<bg> (copied, optional)

This is designed for hugo-theme-gallery:
- Each song is a leaf bundle with at least one image resource (thumbnail) so it appears as a card.
- The thumbnail is marked as the bundle cover resource.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
SONGS_JSON = REPO_ROOT / "songs.json"
IMAGES_DIR = REPO_ROOT / "images"
NOTATION_MAPPING_JSON = REPO_ROOT / "notation_mapping.json"

SITE_DIR = REPO_ROOT / "site"
CONTENT_DIR = SITE_DIR / "content"
SONGS_SECTION_DIR = CONTENT_DIR / "songs"

_NOTE_RE = re.compile(r"(Sa|Re|Ga|Ma|Pa|Dha|Ni)(\((?:k|T)\))?([.']?)")


def _read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _clean_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def _safe_rel(p: str | None) -> str | None:
    if not p:
        return None
    p = p.replace("\\", "/").lstrip("/")
    if ".." in Path(p).parts:
        return None
    return p


def _copy_image(rel_path: str, dst_dir: Path) -> str:
    # rel_path is like "images/foo.png"
    rel_path = rel_path.replace("\\", "/")
    if not rel_path.startswith("images/"):
        raise ValueError(f"Expected images/... path, got {rel_path!r}")
    filename = Path(rel_path).name
    src = REPO_ROOT / rel_path
    if not src.exists():
        # fallback: try images dir by basename
        alt = IMAGES_DIR / filename
        if alt.exists():
            src = alt
        else:
            raise FileNotFoundError(f"Image not found: {src}")
    dst = dst_dir / filename
    shutil.copy2(src, dst)
    return filename


def _yaml_quote(s: str) -> str:
    # Double-quoted YAML string with basic escaping.
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n") + '"'


def _generate_placeholder(title: str, dst_dir: Path) -> str:
    """Create a minimal PNG placeholder so the gallery theme renders a card.

    The theme's opengraph partial calls ``$image.Filter`` which only works on
    raster images, so we must produce a real PNG (not SVG).
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        # Pillow unavailable — fall back to a tiny 1x1 grey PNG (still valid raster).
        import struct, zlib
        filename = "placeholder_cover.png"
        _write_minimal_png(dst_dir / filename)
        return filename

    filename = "placeholder_cover.png"
    w, h = 400, 400
    img = Image.new("RGB", (w, h), color=(107, 114, 128))  # grey-500
    draw = ImageDraw.Draw(img)
    initials = "".join(word[0] for word in title.split()[:2] if word).upper() or "?"
    # Try to use a large font; fall back to default.
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 120)
    except Exception:
        fonts_dir = REPO_ROOT / "fonts"
        dejavu = fonts_dir / "DejaVuSans-Bold.ttf"
        if dejavu.exists():
            font = ImageFont.truetype(str(dejavu), 120)
        else:
            font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), initials, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((w - tw) / 2, (h - th) / 2 - bbox[1]), initials, fill="white", font=font)
    img.save(dst_dir / filename)
    return filename


def _write_minimal_png(path: Path) -> None:
    """Write a valid 1×1 grey PNG without any imaging library."""
    import struct
    import zlib
    sig = b"\x89PNG\r\n\x1a\n"
    def _chunk(ctype: bytes, data: bytes) -> bytes:
        c = ctype + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)  # 1x1, 8-bit RGB
    raw = zlib.compress(b"\x00\x6b\x72\x80")  # filter-none + grey RGB pixel
    path.write_bytes(sig + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", raw) + _chunk(b"IEND", b""))


def _boolish(v: Any) -> bool:
    """Loose bool coercion matching load_songs._boolish."""
    if v is None:
        return True
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    if isinstance(v, str):
        return v.strip().lower() not in ("false", "f", "0", "no", "n", "off")
    return True


def _token_to_note_name(step: str, alter: int) -> str:
    if alter == 1:
        return f"{step}#"
    if alter == -1:
        return f"{step}b"
    return step


def _indian_to_western(indian: str, mapping: dict[str, Any]) -> str:
    """
    Best-effort conversion for display:
    - Sa/Re/Ga/Ma/Pa/Dha/Ni -> C/D/E/F/G/A/B (with flats/sharps for komal/tivra)
    - preserves separators/ornaments/braces
    - preserves octave markers '.' and "'" when written as suffixes
    """
    if not indian or not mapping:
        return ""

    word_to_token = mapping.get("word_to_token", {})
    komal_word_to_token = mapping.get("komal_word_to_token", {})
    tivra_word_to_token = mapping.get("tivra_word_to_token", {})
    token_to_western = mapping.get("token_to_western", {})

    def repl(m: re.Match[str]) -> str:
        word = m.group(1)
        acc = m.group(2) or ""
        octv = m.group(3) or ""

        if acc == "(k)":
            tok = komal_word_to_token.get(word) or word_to_token.get(word)
        elif acc == "(T)":
            tok = tivra_word_to_token.get(word) or word_to_token.get(word)
        else:
            tok = word_to_token.get(word)

        if not tok:
            return m.group(0)
        tw = token_to_western.get(tok)
        if not isinstance(tw, dict):
            return m.group(0)

        step = str(tw.get("step") or "")
        alter = int(tw.get("alter") or 0)
        if not step:
            return m.group(0)

        return _token_to_note_name(step, alter) + octv

    return _NOTE_RE.sub(repl, indian)


def build() -> None:
    # Try per-song layout via shared loader
    songs: list = []
    songs_dir = REPO_ROOT / "songs"
    if songs_dir.is_dir() and any(songs_dir.glob("*.json")):
        sys.path.insert(0, str(REPO_ROOT))
        try:
            from load_songs import load_all_songs
            songs = load_all_songs(REPO_ROOT)
        except ImportError:
            raise SystemExit("Per-song layout detected but load_songs.py not found in project root.")
    elif SONGS_JSON.exists():
        data = _read_json(SONGS_JSON)
        songs = data.get("songs") or []
    else:
        raise SystemExit(f"Missing song data: need either songs/ directory or {SONGS_JSON}")

    mapping = _read_json(NOTATION_MAPPING_JSON) if NOTATION_MAPPING_JSON.exists() else {}
    if not isinstance(songs, list):
        raise SystemExit("songs data must be a list")

    # Rebuild songs section from scratch (generated)
    _clean_dir(SONGS_SECTION_DIR)

    # Ensure section index exists (branch bundle) so the theme can list children if needed.
    (SONGS_SECTION_DIR / "_index.md").write_text(
        "---\n"
        'title: "Songs"\n'
        'description: "All songs"\n'
        "---\n",
        encoding="utf-8",
    )

    for s in songs:
        if not isinstance(s, dict):
            continue
        sid = str(s.get("id") or "").strip()
        if not sid:
            continue

        # Respect the export flag — skip songs explicitly excluded.
        if not _boolish(s.get("export", True)):
            continue

        title = str(s.get("title") or sid).strip()
        info = s.get("info") if isinstance(s.get("info"), list) else []
        info_lines = [str(x) for x in (info or []) if x]

        thumb_rel = _safe_rel(s.get("thumbnail"))
        bg_rel = _safe_rel(s.get("background"))

        bundle_dir = SONGS_SECTION_DIR / sid
        bundle_dir.mkdir(parents=True, exist_ok=True)

        cover_filename = None
        if thumb_rel:
            try:
                cover_filename = _copy_image(thumb_rel, bundle_dir)
            except Exception:
                cover_filename = None

        # Generate a placeholder SVG when no thumbnail is available.
        # The gallery theme requires an image to render a card on the home page.
        if not cover_filename:
            cover_filename = _generate_placeholder(title, bundle_dir)

        bg_filename = None
        if bg_rel:
            try:
                bg_filename = _copy_image(bg_rel, bundle_dir)
            except Exception:
                bg_filename = None

        # Build a compact JSON payload for rendering in custom layout.
        sections = s.get("sections") if isinstance(s.get("sections"), list) else []
        # Ensure each line has western notation for the website toggle.
        enriched_sections: list[dict[str, Any]] = []
        for sec in sections:
            if not isinstance(sec, dict):
                continue
            lines = sec.get("lines") if isinstance(sec.get("lines"), list) else []
            new_lines: list[dict[str, Any]] = []
            for ln in lines:
                if not isinstance(ln, dict):
                    continue
                indian = str(ln.get("indian") or "")
                western_val = ln.get("western")
                if (western_val is None or str(western_val).strip() == "") and indian and mapping:
                    western_val = _indian_to_western(indian, mapping)
                new_ln = dict(ln)
                if western_val and str(western_val).strip():
                    new_ln["western"] = str(western_val)
                new_lines.append(new_ln)
            new_sec = dict(sec)
            new_sec["lines"] = new_lines
            enriched_sections.append(new_sec)
        payload = {
            "id": sid,
            "title": title,
            "info": info_lines,
            "sections": enriched_sections,
            "background": bg_filename,
        }
        payload_json = json.dumps(payload, ensure_ascii=False)

        front_matter_lines: list[str] = []
        front_matter_lines.append("---")
        front_matter_lines.append(f"title: {_yaml_quote(title)}")
        front_matter_lines.append('type: "song"')
        if info_lines:
            # show first line as description
            front_matter_lines.append(f"description: {_yaml_quote(info_lines[0])}")

        # Mark cover image for theme card thumbnail (hugo-theme-gallery uses Resources cover param)
        if cover_filename:
            front_matter_lines.append("resources:")
            front_matter_lines.append(f"  - src: {_yaml_quote(cover_filename)}")
            front_matter_lines.append("    params:")
            front_matter_lines.append("      cover: true")

        # Store song data for custom layout (JSON string)
        front_matter_lines.append("params:")
        front_matter_lines.append("  songJson: |")
        front_matter_lines.append(f"    {payload_json}")
        front_matter_lines.append("---")

        content_md = "\n".join(front_matter_lines) + "\n\n"
        content_md += " "  # keep content minimal; layout will render from params.songJson

        (bundle_dir / "index.md").write_text(content_md, encoding="utf-8")


if __name__ == "__main__":
    os.chdir(REPO_ROOT)
    build()
