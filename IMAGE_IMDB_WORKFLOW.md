# IMDB Image Integration Guide

## Overview
This guide covers adding IMDB movie posters to songs. IMDB posters are high-resolution (typically 1500x2250px), portrait aspect ratio (27:40), and provide professional album art for Bollywood films.

## Challenge: Web Scraping
Direct IMDB web scraping is blocked (returns HTTP 202 with empty content). Instead, we use a manual workflow with reference mapping.

## Workflow

### Step 1: Find IMDB ID
Search `scripts/imdb_mapping.json` for your film's IMDB ID. If not found, visit:
```
https://www.imdb.com/find?q=<movie_title>&s=tt
```

Example: "Jhoom Barabar Jhoom" → `tt0433383`

### Step 2: Add IMDB ID to Song
```bash
python3 scripts/add_imdb_ids.py --song "Song Title" --imdb-id tt0433383
```

Or add multiple in one go:
```bash
python3 scripts/add_imdb_ids.py --batch << 'EOF'
Bol Na Halke Halke,tt0433383
Iktara,tt0812949
Aashiqui 2 Title,tt2333814
EOF
```

### Step 3: Download IMDB Posters
```bash
# Download for all songs with IMDB IDs
python3 scripts/download_imdb_images.py --all

# Or for specific song
python3 scripts/download_imdb_images.py --song "Bol Na Halke Halke"
```

Images are saved to: `data/images/{songId}-imdb.jpg`

### Step 4: Website CSS Updates (TODO)
IMDB posters are portrait (27:40 aspect ratio) vs typical square (1:1). Website needs:
- Container adjustments in `SongGallery.tsx` or new `SongCard` component
- CSS grid or flexbox to handle variable aspect ratios
- Optional fade/zoom on portrait posters

Example:
```typescript
// In SongGallery or card component
const getImageAspectRatio = (song: Song) => {
  if (song.thumbnailAttribution?.aspectRatio === "27:40") {
    return "portrait"; // CSS class for 27:40
  }
  return "square"; // Default 1:1
};
```

### Step 5: Verify in PDF
```bash
cd platform && yarn build && cd ..
python3 scripts/build_songbook.py --song "Bol Na Halke Halke"
```

Check PDF output to verify IMDB poster displays with attribution.

## Reference: Known Bollywood Films

See `scripts/imdb_mapping.json` for a reference mapping. Add more as you discover them:

```json
{
  "Jhoom Barabar Jhoom": "tt0433383",
  "Iktara": "tt0812949",
  "Aashiqui 2": "tt2333814",
  ...
}
```

## Attribution
IMDB images are added with Fair Use attribution:
- source: "IMDB"
- license: "Fair Use"
- sourceUrl: "https://www.imdb.com/title/{imdb_id}/mediaindex/?ref_=tt_pv_mi_sm"

Displayed in PDFs as: "Poster from IMDB (Fair Use)"

## Troubleshooting

### Image Not Found After Adding ID
- Verify IMDB ID is correct by visiting `https://www.imdb.com/title/{id}/`
- Check that the film has a poster (not all IMDB entries do)
- Retry download: `python3 scripts/download_imdb_images.py --all --force`

### Image Aspect Ratio Issues
- Portrait posters (27:40) require CSS adjustments on website
- See Step 4 above for implementation guide

### Manual IMDB Search
If a film isn't in the mapping, find it manually:
1. Visit https://www.imdb.com/find?q={title}&s=tt
2. Find the correct entry (check release year)
3. Copy the ID from the URL: https://www.imdb.com/title/**tt0433383**/
4. Add with: `python3 scripts/add_imdb_ids.py --song "Title" --imdb-id tt0433383`

## Next Steps
1. Populate IMDB IDs for more songs using the mapping
2. Implement website CSS for portrait aspect ratios
3. Test end-to-end (website gallery + PDF generation)
4. Monitor IMDB poster quality and update attribution as needed
