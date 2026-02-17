
# 🎵 Songbook Pipeline (PDF • EPUB • MusicXML)

This project lets you maintain **one master song database** and generate:

- 📱 Mobile-friendly PDF
- 📖 EPUB (reflowable, phone-friendly)
- 🎼 MuseScore-compatible MusicXML (one file per song)

All formats are generated from **songs.json**.

---

## 🌐 Website (GitHub Pages)

This repo can also generate a **static website** with **one page per song** (lyrics + Indian notation, and Western when present).

### Build locally

```bash
python build_website.py
```

Preview it:

```bash
python -m http.server -d dist 8000
```

Then open `http://localhost:8000`.

### Deploy (gh-pages branch)

A GitHub Actions workflow at `.github/workflows/deploy-gh-pages.yml` builds the site and publishes `dist/` to the `gh-pages` branch on every push to `main`.

---

## 📂 Folder Structure

```
songbook_pipeline_project/
├── build_songbook.py        # Main pipeline (PDF / EPUB / MusicXML)
├── gui_songbook.py          # Drag & drop GUI
├── convert_docx_to_json.py  # DOCX → JSON auto-extractor (auto-detect ornaments)
├── songs.json               # Master song database
├── images/                  # Thumbnails, posters, cover
│   └── README.txt
├── output/                  # Generated files
└── README.md                # This file
```

---

## 🧰 Setup (One Time)

### 1️⃣ Create virtual environment
```bash
python -m venv .venv
source .venv/bin/activate   # macOS/Linux
.venv\Scripts\activate    # Windows
```

### 2️⃣ Install dependencies
```bash
pip install reportlab pillow python-docx tkinterdnd2
```

---

## 🚀 How to Use (Recommended)

### Launch GUI
```bash
python gui_songbook.py
```

### GUI Features
- Drag & drop DOCX files
- Auto-convert to `songs.json`
- Build PDF / EPUB / MusicXML
- No terminal knowledge required

---

## 🛠 CLI Usage (Advanced)

### Build everything
```bash
python build_songbook.py --format all
```

### Only PDF
```bash
python build_songbook.py --format pdf
```

### PDF variants (combined / Indian-only / Western-only)
Generate all 3 PDFs:

```bash
python build_songbook.py --format pdf --pdf-variants all
```

Only Indian notation (lyrics + Indian):

```bash
python build_songbook.py --format pdf --pdf-variants indian
```

Only Western notation (lyrics + Western):

```bash
python build_songbook.py --format pdf --pdf-variants western
```

### PDF background behavior (fill vs repeat)
- **Fill the page (recommended)**:

```bash
python build_songbook.py --format pdf --pdf-bg-mode cover
```

- **Repeat/tile the background**:

```bash
python build_songbook.py --format pdf --pdf-bg-mode tile
```

- **Fit inside (old behavior)**:

```bash
python build_songbook.py --format pdf --pdf-bg-mode contain
```

You can also override per song in `songs.json` by adding:

```json
{
  "background": "images/some_bg.png",
  "background_mode": "cover"
}
```

### Emoji icons in PDF (🎤 ✍️ 🎼)
Most PDFs generated via ReportLab **cannot render macOS Apple Color Emoji**, so emoji may show up as missing boxes unless you embed an emoji-capable **`.ttf`**.

- **Recommended**: put an emoji-capable `.ttf` into `fonts/` (for example: `fonts/Symbola.ttf` or `fonts/NotoSansSymbols2-Regular.ttf`). The builder will try to auto-detect it.
- **Or** pass it explicitly:

```bash
python build_songbook.py --format pdf --pdf-emoji-font fonts/Symbola.ttf
```

### Only EPUB
```bash
python build_songbook.py --format epub
```

### Only MusicXML
```bash
python build_songbook.py --format musicxml
```

---

## 🎼 Indian Notation Rules (Auto-detected)

- **Komal**: r g d n  or  D(k)
- **Tivra**: M
- **Meend**: G~R
- **Kan**: (R)G
- **Hold**: G…  or  G:

These are automatically converted into MuseScore slurs, grace notes, and durations.

---

## 🎶 MuseScore Workflow

1. Generate MusicXML
2. Open in MuseScore
3. Save as .mscz
4. Upload to musescore.org

---

## ❤️ Philosophy

> Write once → publish everywhere

Your songs remain future-proof and editable forever.

Happy composing 🎼
