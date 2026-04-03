
# Songbook Pipeline

**Write once, publish everywhere** — maintain your songs in simple JSON files
and generate PDF, EPUB, MusicXML, and a GitHub Pages website from a single
source of truth.

| Output | Description |
|--------|-------------|
| **PDF** | Mobile-friendly A5/Letter with thumbnails, backgrounds, and Indian + Western notation |
| **EPUB** | Reflowable e-book for phones and e-readers |
| **MusicXML** | One file per song — open in MuseScore, Finale, or Sibelius |
| **Website** | Hugo static site deployed to GitHub Pages with search and notation toggle |

---

## Folder Structure

```
songbook_pipeline_project/
├── book.json                    # Book title, metadata, song ordering
├── notation_mapping.json        # Indian ↔ Western note mappings (single source of truth)
├── songs/                       # One JSON file per song
│   ├── lag-ja-gale.json
│   ├── pehla_nasha.json
│   └── ...
├── images/                      # Thumbnails, backgrounds, cover art
├── fonts/                       # Embedded fonts (DejaVu, Symbola, Noto)
├── scripts/                     # All pipeline & utility scripts
│   ├── build_songbook.py        #   Main pipeline: PDF / EPUB / MusicXML
│   ├── load_songs.py            #   Shared song-loader used by all scripts
│   ├── convert_docx_to_json.py  #   DOCX → JSON auto-extractor
│   ├── scrape_notation_url.py   #   Web scraper for notation sites
│   ├── normalize_indian_notation.py  # Standardise sargam display strings
│   ├── convert_notation.py      #   Letter→word notation converter
│   ├── add_western.py           #   Indian→Western note converter
│   ├── minimize_songs_json.py   #   Strip derived fields (western/tokens)
│   └── gui_songbook.py          #   Drag-and-drop GUI
├── tests/                       # Test scripts
│   └── test_add_western.py
├── docs/                        # Reference documentation
│   ├── prompt                   #   AI prompt template for notation conversion
│   └── octave_notes             #   Octave reference chart
├── misc/                        # Helper / one-off scripts
│   └── generate_placeholder_images.py
├── site/                        # Hugo website source
│   ├── hugo.toml
│   ├── layouts/
│   ├── assets/
│   ├── content/notation-guide/  #   How-to-read-notation page
│   └── scripts/generate_content.py
├── songbook-player/             # Node.js player app (Docker)
├── output/                      # Generated files land here
├── setup.sh                     # One-time environment setup
└── .github/workflows/
    └── deploy-gh-pages.yml      # CI/CD: auto-deploy on push to main
```

---

## Setup (One Time)

### 1. Create a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate      # macOS / Linux
# .venv\Scripts\activate       # Windows
```

### 2. Install Python dependencies

```bash
pip install reportlab pillow python-docx tkinterdnd2
```

### 3. Install Hugo (for website)

```bash
# macOS
brew install hugo

# or download from https://gohugo.io/installation/
```

---

## Song Data Format

Each song lives in its own file under `songs/`.

### `songs/<song-id>.json`

```json
{
  "id": "lag-ja-gale",
  "title": "Lag Ja Gale",
  "export": true,
  "info": [
    "Movie: Woh Kaun Thi (1964)",
    "Singer: Lata Mangeshkar",
    "Music: Madan Mohan",
    "Based on Raag: Pahadi"
  ],
  "thumbnail": "images/lag_ja_gale_thumb1.png",
  "background": "images/lag_ja_gale_bg.jpeg",
  "background_mode": "cover",
  "sections": [
    {
      "name": "STHAYI",
      "lines": [
        {
          "lyrics": "Lag ja gale",
          "indian": "Pa.Pa. | Ga | Re Ga… | Ga~Re"
        }
      ]
    }
  ]
}
```

**Key rules:**

- Only `lyrics` and `indian` are stored — `western` and `tokens` are derived
  at build time.
- `export: false` hides a song from all outputs (default is `true`).
- `thumbnail` / `background` paths are relative to the project root.
- `background_mode` can be `"cover"` (fill/crop), `"tile"` (repeat), or
  `"contain"` (fit inside). Leave empty to use the global default.

### `book.json`

Controls book-level metadata and song ordering.

```json
{
  "book_title": "Famous Bollywood Songs",
  "book_meta": {
    "creator": "Shalin Shah",
    "publisher": "Self-published",
    "language": "en",
    "cover_image": "images/cover.png",
    "ornaments": "~ meend, ^ kan, : hold, ' higher octave"
  },
  "song_order": [
    "lag-ja-gale",
    "pehla_nasha",
    "chura-liya-hai-tumne-jo-dil-ko"
  ]
}
```

Songs appear in outputs in `song_order` sequence. Any song files in `songs/`
that are **not** listed in `song_order` are appended at the end alphabetically.

---

## How To…

### Add a new song manually

1. Create `songs/my-new-song.json` with the structure above.
2. Add `"my-new-song"` to the `song_order` array in `book.json` at the
   position you want.
3. Drop a thumbnail image into `images/` and set the `thumbnail` path.
4. Build or serve to see the result.

### Add a song from a Word file

```bash
python scripts/convert_docx_to_json.py my_song.docx
```

This auto-extracts lyrics + Indian notation, creates
`songs/<song-id>.json`, and appends the ID to `book.json`.

### Add a song from a web page

```bash
python scripts/scrape_notation_url.py https://www.notationsworld.com/some-song.html
python scripts/scrape_notation_url.py URL --dry-run   # preview without saving
```

### Remove a song

Delete `songs/<song-id>.json` and remove the ID from `song_order` in
`book.json`.

### Reorder songs

Edit the `song_order` array in `book.json`. Move IDs up or down to change
the sequence in PDFs, EPUBs, and the website.

### Change book metadata

Edit `book.json` directly — change `book_title`, `creator`, `cover_image`,
etc.

### Disable a song from exports

Set `"export": false` in the song's JSON file. It will remain in `songs/` but
will not appear in PDF, EPUB, MusicXML, or the website.

---

## Generate Outputs (CLI)

### Build everything

```bash
python scripts/build_songbook.py --format all
```

### PDF only

```bash
python scripts/build_songbook.py --format pdf
```

### PDF variants (Indian / Western / Both)

```bash
python scripts/build_songbook.py --format pdf --pdf-variants all
python scripts/build_songbook.py --format pdf --pdf-variants indian
python scripts/build_songbook.py --format pdf --pdf-variants western
```

### PDF options

```bash
# Page size (default A5)
python scripts/build_songbook.py --format pdf --page A5
python scripts/build_songbook.py --format pdf --page LETTER

# Background mode
python scripts/build_songbook.py --format pdf --pdf-bg-mode cover   # fill & crop
python scripts/build_songbook.py --format pdf --pdf-bg-mode tile    # repeat
python scripts/build_songbook.py --format pdf --pdf-bg-mode contain # fit inside

# Background opacity (0.0 – 1.0, default 0.08)
python scripts/build_songbook.py --format pdf --bg-opacity 0.08

# Emoji font for icons in PDF header
python scripts/build_songbook.py --format pdf --pdf-emoji-font fonts/Symbola.ttf
```

### EPUB only

```bash
python scripts/build_songbook.py --format epub
python scripts/build_songbook.py --format epub --epub-bg-opacity 0.10
```

### MusicXML only

```bash
python scripts/build_songbook.py --format musicxml
```

One `.musicxml` file is written per song into `output/`.

---

## Drag-and-Drop GUI

```bash
python scripts/gui_songbook.py
```

- Drag Word files onto the window (or click **Add Files…**).
- Click **Convert DOCX → songs/** to extract songs.
- Pick format + options, then click **Build Outputs**.
- Click **Open Output Folder** to view results.

> **Note:** Drag-and-drop requires `tkinterdnd2`. If unavailable the GUI falls
> back to the file-picker dialog.

---

## Website (Hugo / GitHub Pages)

### Preview locally

```bash
# 1. Generate Hugo content from song files
python site/scripts/generate_content.py

# 2. Start the Hugo dev server
hugo server --source site --disableFastRender
```

Open **http://localhost:1313** — this mirrors what GitHub Pages will look like.

### Deploy automatically

Push to `main`. The GitHub Actions workflow
(`.github/workflows/deploy-gh-pages.yml`) will:

1. Generate Hugo content from `songs/` (or `songs.json` as fallback).
2. Build the Hugo site with `--minify`.
3. Deploy to the `gh-pages` branch.

Your site will be live at
`https://<username>.github.io/<repo-name>/`.

### Website features

- **Search** — filter songs by title, movie, or singer.
- **Notation toggle** — switch between Indian, Western, or Both (saved in
  localStorage).
- **Song cards** — gallery grid with thumbnails.
- **Song pages** — PDF-like layout with frosted-glass styling and optional
  background images.

---

## Indian Notation Conventions

This project uses **word-based notation** for Indian sargam:

| Notation | Meaning | Example |
|----------|---------|---------|
| Sa Re Ga ma Pa Dha Ni | Shuddh swaras | `Sa Re Ga` |
| ma (lowercase) | Shuddh Ma (F natural) | `ma` |
| Ma (uppercase) | Tivra Ma (F#) | `Ma` |
| Re(k) Ga(k) Dha(k) Ni(k) | Komal (flat) | `Ga(k)` |
| pa dha ni (lowercase words) | Low octave | `pa dha ni` |
| Sa' Re' Ga' | High octave | `Sa'` |
| `Ga~Re` | Meend (glide) | Rendered as slur in MusicXML |
| `(Re)Ga` | Kan (grace note) | Rendered as grace note |
| `Ga:` or `Sa—` | Hold (sustain) | Double duration in MusicXML |

### Notation mapping

`notation_mapping.json` defines the Indian → Western note mapping
(Sa=C, Re=D, etc.) and is used by all scripts. Edit it to change the
base key or add custom mappings.

---

## Utility Scripts

### Normalize Indian notation

Standardises display strings (e.g. `SA` → `Sa`, `R(k)` → `Re(k)`,
`M#` → `Ma(T)`). Processes individual song files automatically.

```bash
python scripts/normalize_indian_notation.py
```

### Convert letter notation to word notation

Converts single-letter notation (`S R G m M P D N`) to word notation
(`Sa Re Ga ma Ma Pa Dha Ni`) across all song files.

```bash
python scripts/convert_notation.py
```

### Minimize song files

Removes derived fields (`western`, `tokens`) to keep JSON files lean.

```bash
python scripts/minimize_songs_json.py
python scripts/minimize_songs_json.py --songs-dir songs/
```

---

## MuseScore Workflow

1. Generate MusicXML: `python scripts/build_songbook.py --format musicxml`
2. Open the `.musicxml` file in **MuseScore**.
3. Indian sargam appears as lyrics layer 1; Western as lyrics layer 2.
4. Ornaments (meend → slur, kan → grace note, hold → longer duration) are
   rendered automatically.
5. Save as `.mscz` and upload to **musescore.com** if desired.

---

## Architecture Notes

- **`scripts/load_songs.py`** is the shared loader module. All scripts import
  from here so file-layout detection (per-song vs. legacy) lives in one place.
- **`notation_mapping.json`** is the single source of truth for all notation
  mappings (Indian ↔ token ↔ Western). Edit it to change note conversions.
- **Western notation is never stored** — it is derived at build time from the
  `indian` field using `notation_mapping.json`.
- **Fonts** (`fonts/`) are embedded in the PDF to ensure consistent rendering
  across platforms (DejaVu for Unicode text, Symbola/Noto for emoji).
- **Hugo theme**: `hugo-theme-gallery` (Git submodule in `site/themes/gallery/`).

---

## Quick Reference

| Task | Command |
|------|---------|
| Build everything | `python scripts/build_songbook.py --format all` |
| Build PDF only | `python scripts/build_songbook.py --format pdf` |
| Build EPUB only | `python scripts/build_songbook.py --format epub` |
| Build MusicXML only | `python scripts/build_songbook.py --format musicxml` |
| Preview website | `python site/scripts/generate_content.py && hugo server --source site` |
| Add song from DOCX | `python scripts/convert_docx_to_json.py song.docx` |
| Scrape song from URL | `python scripts/scrape_notation_url.py URL` |
| Normalize notation | `python scripts/normalize_indian_notation.py` |
| Convert letter→word | `python scripts/convert_notation.py` |
| Strip derived fields | `python scripts/minimize_songs_json.py` |
| Launch GUI | `python scripts/gui_songbook.py` |
