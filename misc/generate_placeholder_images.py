#!/usr/bin/env python3
"""
Generate placeholder PNG thumbnails/backgrounds for songs.

Why placeholders?
- Streaming-service album art is typically copyrighted, so we avoid auto-downloading it.
- Placeholders ensure Hugo cards + PDF backgrounds still render cleanly.

This script generates one image per song: images/<song-id>.png
and is intended to be used with song JSON files that set:
  "thumbnail": "images/<song-id>.png"
  "background": "images/<song-id>.png"
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
SONGS_DIR = REPO_ROOT / "songs"
IMAGES_DIR = REPO_ROOT / "images"


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _color_from_id(song_id: str) -> tuple[int, int, int]:
    h = hashlib.sha256(song_id.encode("utf-8")).digest()
    # Keep it in a pleasant mid-range.
    r = 64 + (h[0] % 128)
    g = 64 + (h[1] % 128)
    b = 64 + (h[2] % 128)
    return r, g, b


def _initials(title: str) -> str:
    parts = [p for p in title.replace("–", " ").replace("-", " ").split() if p]
    return ("".join(p[0] for p in parts[:2]).upper()) or "?"


def _write_minimal_png(path: Path, rgb: tuple[int, int, int]) -> None:
    """Write a valid 1×1 RGB PNG without external deps."""
    import struct
    import zlib

    sig = b"\x89PNG\r\n\x1a\n"

    def _chunk(ctype: bytes, data: bytes) -> bytes:
        c = ctype + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)  # 1x1, 8-bit RGB
    raw = bytes([0, rgb[0], rgb[1], rgb[2]])  # filter + pixel
    idat = zlib.compress(raw)
    path.write_bytes(sig + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", idat) + _chunk(b"IEND", b""))


def _render_image(path: Path, *, title: str, song_id: str, size: int = 800) -> None:
    """
    Prefer Pillow for a nice placeholder (solid color + initials).
    Fallback to a minimal 1x1 PNG if Pillow isn't available.
    """
    rgb = _color_from_id(song_id)

    try:
        from PIL import Image, ImageDraw, ImageFont  # type: ignore

        img = Image.new("RGB", (size, size), color=rgb)
        draw = ImageDraw.Draw(img)

        text = _initials(title)
        font_size = int(size * 0.32)

        # Try a system font, then bundled fonts/, then default.
        font = None
        for candidate in (
            "DejaVuSans-Bold.ttf",
            str(REPO_ROOT / "fonts" / "DejaVuSans-Bold.ttf"),
            str(REPO_ROOT / "fonts" / "DejaVuSans.ttf"),
        ):
            try:
                font = ImageFont.truetype(candidate, font_size)
                break
            except Exception:
                continue

        if font is None:
            font = ImageFont.load_default()

        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text(((size - tw) / 2, (size - th) / 2 - bbox[1]), text, fill="white", font=font)

        img.save(path)
        return
    except Exception:
        _write_minimal_png(path, rgb)


def _iter_song_files() -> list[Path]:
    if not SONGS_DIR.is_dir():
        return []
    return sorted(SONGS_DIR.glob("*.json"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="Overwrite existing images")
    ap.add_argument("--size", type=int, default=800, help="Square image size in pixels (default: 800)")
    ap.add_argument("--ids", nargs="*", default=[], help="Optional subset of song IDs to generate")
    args = ap.parse_args()

    IMAGES_DIR.mkdir(exist_ok=True)

    ids_filter = set(str(x) for x in (args.ids or []))
    song_files = _iter_song_files()
    if not song_files:
        print(f"No songs found under {SONGS_DIR}", file=sys.stderr)
        return 2

    wrote = 0
    skipped = 0
    for sf in song_files:
        data = _read_json(sf)
        if not isinstance(data, dict):
            continue
        song_id = str(data.get("id") or sf.stem)
        if ids_filter and song_id not in ids_filter:
            continue

        title = str(data.get("title") or song_id)
        out = IMAGES_DIR / f"{song_id}.png"
        if out.exists() and not args.force:
            skipped += 1
            continue

        _render_image(out, title=title, song_id=song_id, size=int(args.size))
        wrote += 1

    print(f"Generated {wrote} image(s). Skipped {skipped}. Output dir: {IMAGES_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

