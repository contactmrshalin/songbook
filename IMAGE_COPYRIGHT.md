# Image Copyright & Attribution Guide

## Spotify Images

### Legal Basis
You can download and store Spotify album artwork locally for non-commercial, personal use under:
- **Fair Use** (transformative use - displaying in educational music notation context)
- **Spotify's ToS** (personal, non-commercial projects permitted)

### How to Store Spotify Images

1. **Download image from Spotify:**
   - Find song on Spotify
   - Right-click album art → "Save image as"
   - Save to: `data/images/{songId}.jpg` (or .png)

2. **Add attribution to song JSON:**
   ```bash
   python3 scripts/manage_image_attribution.py \
     --song "Bol Na Halke Halke" \
     --thumbnail \
     --source "Spotify" \
     --copyright "Music Label (via Spotify)" \
     --license "Fair Use - Educational"
   ```

3. **Result in `data/songs/bol-na-halke-halke.json`:**
   ```json
   {
     "id": "bol-na-halke-halke",
     "title": "Bol Na Halke Halke",
     "thumbnail": "data/images/bol-na-halke-halke.jpg",
     "thumbnailAttribution": {
       "source": "Spotify",
       "copyright": "Music Label (via Spotify)",
       "license": "Fair Use - Educational",
       "addedDate": "2026-06-24"
     }
   }
   ```

## Attribution Display

### Website
The UI should display:
```
[Album Art Image]
© Music Label | Source: Spotify | Fair Use
```

### PDF Generation
The `build_songbook.py` script will:
- Display attribution metadata in PDF header
- Include copyright notice on each page with image
- List all sources in PDF front matter

### Example PDF Output
```
Album Art: Bol Na Halke Halke
© Universal Music | From Spotify | Educational Use
[Image displayed here]
```

## Best Practices

✅ **DO:**
- Store images locally in `data/images/`
- Add proper copyright metadata to song JSON
- Display attribution wherever images appear
- Include source information in PDFs
- Use Fair Use justification for educational context

❌ **DON'T:**
- Remove copyright marks or metadata
- Claim ownership of images
- Use for commercial purposes
- Redistribute images independently
- Modify images without attribution

## Additional Sources

Beyond Spotify, you can use:

### Movie Posters (IMDB)
```bash
python3 scripts/manage_image_attribution.py \
  --song "Jhoom Barabar Jhoom" \
  --thumbnail \
  --source "IMDB" \
  --copyright "IMDB / Film Studio" \
  --url "https://imdb.com/title/..."
```

### Indian Classical Musicians (Wikimedia Commons)
```bash
python3 scripts/manage_image_attribution.py \
  --song "Raag Yaman" \
  --thumbnail \
  --source "Wikimedia Commons" \
  --copyright "Free License" \
  --url "https://commons.wikimedia.org/..."
```

### User-Provided Images
```bash
python3 scripts/manage_image_attribution.py \
  --song "Custom Song" \
  --thumbnail \
  --source "User-provided" \
  --copyright "Your Name"
```

## Script Reference

**Add attribution to existing image:**
```bash
python3 scripts/manage_image_attribution.py \
  --song <id|title> \
  --source "Spotify" \
  --copyright "Label Name" \
  --license "Fair Use" \
  --thumbnail  # or --background
```

**Preview before saving:**
```bash
python3 scripts/manage_image_attribution.py \
  --song "Song Title" \
  --thumbnail \
  --source "Spotify" \
  --dry-run
```

## Questions?

- **Can I use this commercially?** No - Fair Use is for educational/non-commercial only
- **Do I need permission?** For Spotify images with Fair Use justification, no
- **What about PDF distribution?** Include copyright notices; limit to personal use
- **Can I stream the site?** For personal use only - add clear copyright notices

---

**TL;DR:** Download Spotify album art → Save locally → Add attribution → Display metadata → Legal ✅
