#!/usr/bin/env python3
"""
Build a static website (GitHub Pages) from songs.json.

Output:
  dist/
    index.html
    songs/<song_id>/index.html
    assets/style.css
    assets/app.js
    images/...
    .nojekyll
"""

from __future__ import annotations

import datetime as _dt
import html
import json
import os
import shutil
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parent
SONGS_JSON = ROOT / "songs.json"
IMAGES_DIR = ROOT / "images"
DIST_DIR = ROOT / "dist"


def _read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _safe_rel_asset_path(p: str | None) -> str | None:
    """Return a normalized, safe relative path (no leading slash)."""
    if not p:
        return None
    p = p.replace("\\", "/").lstrip("/")
    # Disallow parent traversal in generated HTML paths.
    if ".." in Path(p).parts:
        return None
    return p


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _copytree_if_exists(src: Path, dst: Path) -> None:
    if not src.exists():
        return
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def _build_style_css() -> str:
    return """\
:root{
  --bg: #0b1220;
  --card: rgba(255,255,255,0.06);
  --card2: rgba(255,255,255,0.08);
  --text: rgba(255,255,255,0.92);
  --muted: rgba(255,255,255,0.70);
  --muted2: rgba(255,255,255,0.55);
  --accent: #7dd3fc;
  --accent2: #a78bfa;
  --border: rgba(255,255,255,0.12);
  --shadow: 0 12px 40px rgba(0,0,0,0.35);
  --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
}

*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  font-family: var(--sans);
  color: var(--text);
  background:
    radial-gradient(1200px 600px at 10% 10%, rgba(167,139,250,0.20), transparent 60%),
    radial-gradient(1200px 600px at 90% 20%, rgba(125,211,252,0.18), transparent 55%),
    radial-gradient(1000px 700px at 60% 90%, rgba(34,197,94,0.10), transparent 55%),
    var(--bg);
}

a{color:inherit; text-decoration:none}
a:hover{color:var(--accent)}

.container{max-width:1100px; margin:0 auto; padding:24px}
.header{
  display:flex; gap:16px; align-items:center; justify-content:space-between;
  padding:22px 20px; border:1px solid var(--border); background:var(--card); border-radius:18px;
  box-shadow: var(--shadow);
}
.brand{display:flex; gap:14px; align-items:center}
.brand img{width:56px; height:56px; border-radius:12px; object-fit:cover; border:1px solid var(--border)}
.brand h1{margin:0; font-size:20px; letter-spacing:0.2px}
.brand p{margin:4px 0 0 0; color:var(--muted); font-size:13px}

.actions{display:flex; gap:12px; align-items:center; flex-wrap:wrap; justify-content:flex-end}
.input{
  width:min(520px, 72vw);
  padding:12px 14px;
  border-radius:12px;
  border:1px solid var(--border);
  background: rgba(0,0,0,0.22);
  color:var(--text);
  outline:none;
}
.input::placeholder{color:var(--muted2)}
.pill{
  display:inline-flex; align-items:center; gap:8px;
  padding:10px 12px; border:1px solid var(--border);
  border-radius:999px; background: rgba(255,255,255,0.06);
  color:var(--muted);
  font-size:13px;
}

.grid{
  margin-top:18px;
  display:grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap:14px;
}
.card{
  border:1px solid var(--border);
  background: var(--card);
  border-radius:16px;
  overflow:hidden;
  box-shadow: 0 6px 20px rgba(0,0,0,0.25);
  transition: transform 120ms ease, border-color 120ms ease;
}
.card:hover{transform: translateY(-2px); border-color: rgba(125,211,252,0.40)}
.thumb{
  height:140px;
  background: rgba(0,0,0,0.18);
  display:flex; align-items:center; justify-content:center;
}
.thumb img{width:100%; height:100%; object-fit:cover}
.card .body{padding:14px 14px 16px 14px}
.title{margin:0; font-size:16px; letter-spacing:0.15px}
.meta{margin:8px 0 0 0; color:var(--muted); font-size:12.5px; line-height:1.35}

.song-hero{
  border:1px solid var(--border);
  border-radius:18px;
  overflow:hidden;
  box-shadow: var(--shadow);
  background: linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.40));
}
.song-hero .hero-inner{
  padding:22px 20px;
  backdrop-filter: blur(6px);
}
.song-hero h1{margin:0; font-size:26px}
.song-hero .sub{margin:10px 0 0 0; color:var(--muted); font-size:13.5px; line-height:1.45}
.navrow{display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-top:14px}
.btn{
  display:inline-flex; align-items:center; justify-content:center;
  padding:10px 12px;
  border-radius:12px;
  border:1px solid var(--border);
  background: rgba(255,255,255,0.06);
  color: var(--text);
  font-size:13px;
}
.btn:hover{border-color: rgba(125,211,252,0.40); color:var(--accent)}

.section{
  margin-top:16px;
  border:1px solid var(--border);
  border-radius:16px;
  background: var(--card);
  overflow:hidden;
}
.section h2{
  margin:0;
  padding:12px 14px;
  font-size:14px;
  letter-spacing:0.8px;
  text-transform:uppercase;
  color:rgba(255,255,255,0.88);
  background: rgba(255,255,255,0.05);
  border-bottom:1px solid var(--border);
}
.lines{padding:10px 12px 14px 12px; display:flex; flex-direction:column; gap:10px}
.line{
  border:1px solid rgba(255,255,255,0.10);
  border-radius:14px;
  background: rgba(0,0,0,0.18);
  padding:10px 10px 12px 10px;
}
.row{display:grid; grid-template-columns: 1fr; gap:8px}
@media (min-width: 860px){
  .row.two{grid-template-columns: 1fr 1fr}
}
.label{font-size:11px; letter-spacing:0.6px; text-transform:uppercase; color:var(--muted2); margin-bottom:6px}
pre{
  margin:0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--mono);
  font-size: 13.5px;
  line-height: 1.38;
}
.lyrics pre{font-family: var(--sans); font-size:14px}
.foot{
  margin-top:18px;
  color:var(--muted2);
  font-size:12px;
  text-align:center;
}
"""


def _build_app_js() -> str:
    return """\
(() => {
  const input = document.querySelector('[data-song-search]');
  const cards = Array.from(document.querySelectorAll('[data-song-card]'));
  const countEl = document.querySelector('[data-song-count]');

  function norm(s){ return (s || '').toLowerCase().trim(); }

  function applyFilter(){
    const q = norm(input && input.value);
    let visible = 0;
    for (const el of cards){
      const hay = norm(el.getAttribute('data-song-hay'));
      const show = !q || hay.includes(q);
      el.style.display = show ? '' : 'none';
      if (show) visible++;
    }
    if (countEl) countEl.textContent = String(visible);
  }

  if (input){
    input.addEventListener('input', applyFilter);
    applyFilter();
  }
})();
"""


def _page_shell(title: str, body: str, *, base_href: str = "./") -> str:
    # base_href helps relative links work for project pages.
    return f"""\
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base href="{html.escape(base_href, quote=True)}" />
    <title>{html.escape(title)}</title>
    <link rel="stylesheet" href="assets/style.css" />
    <meta name="color-scheme" content="dark" />
  </head>
  <body>
    {body}
  </body>
</html>
"""


def _render_index(data: dict[str, Any]) -> str:
    book_title = str(data.get("book_title") or "Songbook")
    meta = data.get("book_meta") or {}
    creator = str(meta.get("creator") or "")
    cover = _safe_rel_asset_path(meta.get("cover_image"))
    songs = list(data.get("songs") or [])
    songs_sorted = sorted(songs, key=lambda s: str(s.get("title") or s.get("id") or ""))

    cover_img = f'<img src="{html.escape(cover)}" alt="Cover" />' if cover else ""
    subtitle_parts = [p for p in [creator] if p]
    subtitle = " • ".join(subtitle_parts) if subtitle_parts else "Static song notation viewer"

    cards_html: list[str] = []
    for s in songs_sorted:
        sid = str(s.get("id") or "").strip()
        title = str(s.get("title") or sid).strip()
        if not sid:
            continue
        thumb = _safe_rel_asset_path(s.get("thumbnail"))
        thumb_html = (
            f'<img src="{html.escape(thumb)}" alt="{html.escape(title)} thumbnail" loading="lazy" />'
            if thumb
            else '<div class="pill">No thumbnail</div>'
        )
        info = s.get("info") or []
        info_text = " • ".join([str(x) for x in info[:3] if x]) if isinstance(info, list) else ""
        hay = " ".join([sid, title, info_text]).strip()

        cards_html.append(
            f"""
            <a class="card" data-song-card data-song-hay="{html.escape(hay, quote=True)}" href="songs/{html.escape(sid)}/">
              <div class="thumb">{thumb_html}</div>
              <div class="body">
                <h3 class="title">{html.escape(title)}</h3>
                <p class="meta">{html.escape(info_text) if info_text else " "}</p>
              </div>
            </a>
            """.strip()
        )

    body = f"""\
<div class="container">
  <div class="header">
    <div class="brand">
      {cover_img}
      <div>
        <h1>{html.escape(book_title)}</h1>
        <p>{html.escape(subtitle)}</p>
      </div>
    </div>
    <div class="actions">
      <input class="input" data-song-search placeholder="Search songs (title / id / info)..." />
      <span class="pill"><span data-song-count>{len(cards_html)}</span> songs</span>
    </div>
  </div>

  <div class="grid">
    {"".join(cards_html)}
  </div>

  <div class="foot">
    Built from <code>songs.json</code> • {html.escape(_dt.datetime.now().strftime("%Y-%m-%d"))}
  </div>
</div>
<script src="assets/app.js" defer></script>
"""
    return _page_shell(book_title, body, base_href="./")


def _render_song_page(data: dict[str, Any], song: dict[str, Any]) -> str:
    book_title = str(data.get("book_title") or "Songbook")
    sid = str(song.get("id") or "").strip()
    title = str(song.get("title") or sid).strip()
    if not sid:
        raise ValueError("Song missing id")

    info = song.get("info") or []
    info_lines: list[str] = []
    if isinstance(info, list):
        info_lines = [str(x) for x in info if x]

    bg = _safe_rel_asset_path(song.get("background"))
    hero_style = ""
    if bg:
        # Page is at songs/<id>/ so images are ../../images/...
        hero_style = f' style="background-image:url(../../{html.escape(bg, quote=True)}); background-size:cover; background-position:center; background-repeat:no-repeat;"'

    sections = song.get("sections") or []
    section_blocks: list[str] = []
    if isinstance(sections, list):
        for sec in sections:
            name = str((sec or {}).get("name") or "").strip() or "SECTION"
            lines = (sec or {}).get("lines") or []
            line_blocks: list[str] = []
            if isinstance(lines, list):
                for ln in lines:
                    lyrics = str((ln or {}).get("lyrics") or "")
                    indian = str((ln or {}).get("indian") or "")
                    western = (ln or {}).get("western")
                    western = str(western) if western is not None else ""

                    cols: list[str] = []
                    cols.append(
                        f"""
                        <div class="lyrics">
                          <div class="label">Lyrics</div>
                          <pre>{html.escape(lyrics)}</pre>
                        </div>
                        """.strip()
                    )
                    cols.append(
                        f"""
                        <div>
                          <div class="label">Indian (Sargam)</div>
                          <pre>{html.escape(indian)}</pre>
                        </div>
                        """.strip()
                    )
                    if western.strip():
                        cols.append(
                            f"""
                            <div>
                              <div class="label">Western</div>
                              <pre>{html.escape(western)}</pre>
                            </div>
                            """.strip()
                        )

                    row_class = "row two" if len(cols) == 2 else "row"
                    line_blocks.append(
                        f"""
                        <div class="line">
                          <div class="{row_class}">
                            {''.join(cols)}
                          </div>
                        </div>
                        """.strip()
                    )

            section_blocks.append(
                f"""
                <div class="section">
                  <h2>{html.escape(name)}</h2>
                  <div class="lines">
                    {''.join(line_blocks) if line_blocks else '<div class="pill">No lines</div>'}
                  </div>
                </div>
                """.strip()
            )

    info_html = "<br/>".join(html.escape(x) for x in info_lines) if info_lines else html.escape(book_title)

    body = f"""\
<div class="container">
  <div class="song-hero"{hero_style}>
    <div class="hero-inner">
      <h1>{html.escape(title)}</h1>
      <div class="sub">{info_html}</div>
      <div class="navrow">
        <a class="btn" href="../../">← All songs</a>
        <span class="pill">ID: <code>{html.escape(sid)}</code></span>
      </div>
    </div>
  </div>

  {''.join(section_blocks)}

  <div class="foot">
    {html.escape(book_title)} • Generated page
  </div>
</div>
"""
    # base_href from songs/<id>/index.html back to repo root:
    return _page_shell(f"{title} — {book_title}", body, base_href="../../")


def build() -> None:
    if not SONGS_JSON.exists():
        raise SystemExit(f"Missing {SONGS_JSON}")

    data = _read_json(SONGS_JSON)

    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    (DIST_DIR / "assets").mkdir(parents=True, exist_ok=True)

    _write_text(DIST_DIR / ".nojekyll", "")
    _write_text(DIST_DIR / "assets" / "style.css", _build_style_css())
    _write_text(DIST_DIR / "assets" / "app.js", _build_app_js())

    # Copy images (used by cover/thumb/background).
    _copytree_if_exists(IMAGES_DIR, DIST_DIR / "images")

    _write_text(DIST_DIR / "index.html", _render_index(data))

    songs = data.get("songs") or []
    if not isinstance(songs, list):
        raise SystemExit("songs.json: 'songs' must be a list")

    for s in songs:
        if not isinstance(s, dict):
            continue
        sid = str(s.get("id") or "").strip()
        if not sid:
            continue
        out = DIST_DIR / "songs" / sid / "index.html"
        _write_text(out, _render_song_page(data, s))


if __name__ == "__main__":
    # Ensure stable behavior in CI even if cwd differs.
    os.chdir(ROOT)
    build()
