#!/usr/bin/env python3
"""
Generate Hugo content bundles from ../songs.json

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
import shutil
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
SONGS_JSON = REPO_ROOT / "songs.json"
IMAGES_DIR = REPO_ROOT / "images"

SITE_DIR = REPO_ROOT / "site"
CONTENT_DIR = SITE_DIR / "content"
SONGS_SECTION_DIR = CONTENT_DIR / "songs"


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


def _toml_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def build() -> None:
    if not SONGS_JSON.exists():
        raise SystemExit(f"Missing {SONGS_JSON}")

    data = _read_json(SONGS_JSON)
    songs = data.get("songs") or []
    if not isinstance(songs, list):
        raise SystemExit("songs.json: 'songs' must be a list")

    # Rebuild songs section from scratch (generated)
    _clean_dir(SONGS_SECTION_DIR)

    # Ensure section index exists (branch bundle) so the theme can list children if needed.
    (SONGS_SECTION_DIR / "_index.md").write_text(
        "---\n"
        'title = "Songs"\n'
        'description = "All songs"\n'
        "---\n",
        encoding="utf-8",
    )

    for s in songs:
        if not isinstance(s, dict):
            continue
        sid = str(s.get("id") or "").strip()
        if not sid:
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

        bg_filename = None
        if bg_rel:
            try:
                bg_filename = _copy_image(bg_rel, bundle_dir)
            except Exception:
                bg_filename = None

        # Build a compact JSON payload for rendering in custom layout.
        sections = s.get("sections") if isinstance(s.get("sections"), list) else []
        payload = {
            "id": sid,
            "title": title,
            "info": info_lines,
            "sections": sections,
            "background": bg_filename,
        }
        payload_json = json.dumps(payload, ensure_ascii=False)

        front_matter_lines: list[str] = []
        front_matter_lines.append("---")
        front_matter_lines.append(f'title = "{_toml_escape(title)}"')
        front_matter_lines.append('type = "song"')
        if info_lines:
            # show first line as description
            front_matter_lines.append(f'description = "{_toml_escape(info_lines[0])}"')

        # Mark cover image for theme card thumbnail
        if cover_filename:
            front_matter_lines.append("resources = [")
            front_matter_lines.append("  {")
            front_matter_lines.append(f'    src = "{_toml_escape(cover_filename)}",')
            front_matter_lines.append("    params = { cover = true }")
            front_matter_lines.append("  }")
            front_matter_lines.append("]")

        # Store song data for custom layout
        front_matter_lines.append("[params]")
        front_matter_lines.append(f'songJson = """{payload_json}"""')
        front_matter_lines.append("---")

        content_md = "\n".join(front_matter_lines) + "\n\n"
        content_md += " "  # keep content minimal; layout will render from params.songJson

        (bundle_dir / "index.md").write_text(content_md, encoding="utf-8")


if __name__ == "__main__":
    os.chdir(REPO_ROOT)
    build()
