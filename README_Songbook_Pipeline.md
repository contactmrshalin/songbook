
# 🎵 Mobile Songbook Pipeline (PDF • EPUB • MusicXML)

This project lets you maintain **one master song database** and generate:

- ✅ Mobile‑friendly **PDF**
- ✅ Reflowable **EPUB**
- ✅ MuseScore‑compatible **MusicXML (per song)**

All outputs come from a **single JSON source of truth**.

---

## 1️⃣ What You Get

✔ Clickable song index  
✔ Song thumbnail + light poster background  
✔ Indian Sargam + Western notation together  
✔ Mobile‑optimized single‑column layout  
✔ MuseScore upload‑ready MusicXML  
✔ Extensible for ornaments (meend, kan, hold)

---

## 2️⃣ Folder Structure

```
my_songbook/
│
├── build_songbook.py        # Main pipeline
├── convert_docx_to_json.py  # Helper (DOCX → JSON)
├── gui_songbook.py          # Drag‑and‑drop GUI
├── songs.json               # Master data
├── images/
│   ├── song1_thumb.png
│   ├── song1_bg.jpg
│   └── ...
└── output/
```

---

## 3️⃣ Master File: songs.json

This is the **only file you edit long‑term**.

```json
{
  "book_title": "My Songbook",
  "songs": [
    {
      "id": "lag-ja-gale",
      "title": "Lag Ja Gale",
      "info": [
        "Movie: Woh Kaun Thi (1964)",
        "Singer: Lata Mangeshkar",
        "Music: Madan Mohan"
      ],
      "thumbnail": "images/lag_thumb.png",
      "background": "images/lag_bg.png",
      "sections": [
        {
          "name": "STHAYI",
          "lines": [
            {
              "lyrics": "Lag ja gale",
              "indian": "R  G  G  R  G",
              "western": "D  E  E  D  E",
              "tokens": ["R","G","G","R","G"]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 4️⃣ Supported Notation Conventions

### Indian
- **Komal:** r g d n (flat)
- **Tivra:** M (Ma♯)
- **High octave:** S'  R'
- **Low octave:** ,S or S.

### Western
- Auto‑mapped from SA=C
- Octaves preserved
- Accidentals applied correctly

---

## 5️⃣ Generate Outputs (CLI)

### Install dependencies
```bash
pip install reportlab pillow python-docx tkinterdnd2
```

### Generate everything
```bash
python build_songbook.py --format all
```

### Only PDF
```bash
python build_songbook.py --format pdf
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

## 6️⃣ Drag‑and‑Drop GUI (Optional but Recommended)

Run:
```bash
python gui_songbook.py
```

### GUI Features
✔ Drag DOCX / TXT / PDF  
✔ Auto‑convert to JSON  
✔ Select output formats  
✔ One‑click build  
✔ No terminal needed

### GUI Flow
```
Drop files → Review JSON → Click Generate
```

---

## 7️⃣ Convert Existing Word Files → JSON

Use:
```bash
python convert_docx_to_json.py my_old_song.docx
```

This extracts:
- Lyrics
- Indian notations
- Western notations (if present)

You then **clean once**, and never re‑edit again.

---

## 8️⃣ MuseScore Workflow

1. Run pipeline → `.musicxml` generated per song
2. Open in **MuseScore**
3. Save as `.mscz`
4. Upload to musescore.org

Indian sargam appears as **lyrics layer** under notes.

---

## 9️⃣ Best Practices

✔ Keep one song per JSON entry  
✔ Use tokens for clean MusicXML  
✔ Background opacity: 5–10%  
✔ PDF page size: **A5**  
✔ EPUB for reading, PDF for practice  

---

## 🔟 Roadmap (Optional Enhancements)

- 🎼 Variable note durations
- 🎶 Ornament rendering (meend curves)
- 🎤 Karaoke‑style lyrics
- 🌙 Dark‑mode EPUB
- 📱 Android/iOS app export

---

## ❤️ Philosophy

> **Write once. Publish everywhere.**

This pipeline ensures your music survives:
- format changes
- apps disappearing
- platform lock‑in

Your songs remain **future‑proof**.

---

Happy composing 🎶
