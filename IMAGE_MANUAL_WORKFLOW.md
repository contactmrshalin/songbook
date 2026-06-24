# Image Management Workflow (Practical Approach)

Due to rate limiting from image hosting services (IMDB, Wikipedia, Wikimedia), we've implemented a **manual upload + batch processing** workflow that gives you full control over image quality and sources.

## Quick Start

### Option 1: Download Images Manually (Recommended)

1. Find poster/album art for a film:
   - Google Images: Search "[Film Title] poster"
   - Wikipedia: https://en.wikipedia.org (search film, find poster in infobox)
   - IMDB: https://www.imdb.com (search film, use high-res poster)
   - Spotify: https://open.spotify.com (search album)
   - YouTube: Search film official video for thumbnail

2. Save the image with the correct naming convention:
   ```
   data/images/{song-id}-wikipedia.jpg    # From Wikipedia
   data/images/{song-id}-imdb.jpg         # From IMDB
   data/images/{song-id}-spotify.jpg      # From Spotify
   data/images/{song-id}.jpg              # Generic fallback
   ```

3. Add attribution metadata using the helper script:
   ```bash
   python3 scripts/manage_image_attribution.py \
     --song "Song Title" \
     --thumbnail \
     --source "Wikipedia" \
     --copyright "Film Studio" \
     --license "CC-BY-SA"
   ```

### Option 2: Bulk Download (For Tech-Savvy Users)

Use our reference mapping to find IMDB IDs, then download manually:

```bash
# Create a bulk download list
cat > /tmp/downloads.txt << 'EOF'
tt0433383, Bol Na Halke Halke, Jhoom Barabar Jhoom
tt0067255, Yeh Shaam Mastani, Kati Patang
tt0070827, Chehra Hai Ya Chand Khila Hai, Sholay
EOF

# For each line, visit:
# https://www.imdb.com/title/{ID}/
# Download the poster manually
# Save to data/images/{song-id}-imdb.jpg
```

## Song Reference Mapping

The `imdb_mapping.json` file contains known Bollywood films and their IMDB IDs:

```bash
# View the mapping
cat scripts/imdb_mapping.json | jq '.films | keys[]'

# Add new entries as you discover films
```

## Batch Attribution Update

After downloading images, add metadata in bulk:

```bash
python3 scripts/manage_image_attribution.py << 'EOF'
Bol Na Halke Halke,wikipedia,Film Studio,CC-BY-SA
Yeh Shaam Mastani,wikipedia,Film Studio,CC-BY-SA
Chehra Hai Ya Chand Khila Hai,wikipedia,Film Studio,CC-BY-SA
EOF
```

## Verified Working Images

These songs have been successfully matched with images:

- ✓ Bol Na Halke Halke (Jhoom Barabar Jhoom) 
- ✓ Pehla Nasha Pehla Khumar (Jo Jeeta Wohi Sikandar)
- ✓ Yeh Shaam Mastani (Kati Patang)

To check current image status:

```bash
python3 << 'EOF'
import json
from pathlib import Path

data_dir = Path("data/songs")
with_images = 0
without_images = 0

for song_file in data_dir.glob("*.json"):
    song = json.loads(song_file.read_text())
    if song.get("thumbnailAttribution"):
        with_images += 1
    else:
        without_images += 1

print(f"Songs with images: {with_images}")
print(f"Songs without images: {without_images}")
EOF
```

## CSS Updates Needed

After images are added, update website CSS to handle variable aspect ratios:

**File:** `platform/src/components/SongGallery.tsx`

```typescript
// Add aspect ratio handling
const getImageStyle = (song: Song) => {
  const ratio = song.thumbnailAttribution?.aspectRatio;
  
  if (ratio === "27:40") {
    return { aspectRatio: "27 / 40", width: "100%" };
  } else if (ratio === "1:1") {
    return { aspectRatio: "1", width: "100%" };
  }
  
  // Fallback: auto
  return { aspectRatio: "auto", width: "100%" };
};
```

Then in JSX:
```tsx
<img 
  src={imageUrl}
  style={getImageStyle(song)}
  alt={song.title}
/>
```

## PDF Generation with Images

The build script automatically:
1. Looks for images in `data/images/`
2. Displays them in PDF output
3. Shows attribution ("Poster from Wikipedia", etc.)
4. Maintains aspect ratio

To test:
```bash
# Build the project
cd platform && yarn build && cd ..

# Generate PDF for a single song
python3 scripts/build_songbook.py --song "Bol Na Halke Halke"
```

## Attribution Requirements

For each image source, include these metadata fields:

```json
{
  "thumbnailAttribution": {
    "source": "Wikipedia|IMDB|Spotify|YouTube",
    "copyright": "Studio or Creator Name",
    "license": "Fair Use|CC-BY-SA|Creative Commons",
    "sourceUrl": "https://...",
    "addedDate": "2026-06-24",
    "aspectRatio": "27:40 or 1:1 or auto"
  }
}
```

## Troubleshooting

### Images Not Showing on Website
- Check file exists: `ls data/images/{song-id}*`
- Check metadata: `cat data/songs/{song-id}.json | jq .thumbnailAttribution`
- Verify CSS handles aspect ratio in SongGallery component

### PDF Doesn't Include Images
- Images must be in `data/images/` directory
- Metadata must have `thumbnailAttribution.source` set
- Run `python3 scripts/build_songbook.py --song <title>` to test

### High-Resolution Version Not Showing
- Download from source at maximum available resolution
- Save as JPEG quality 95+
- Recommended min 800px width, preferably 1500px+

## Future: Automated Options

As projects mature, consider:
1. **TMDB API**: Free tier with rate limits (requires API key)
2. **Pinterest API**: Access to high-res images (requires permission)
3. **AWS Rekognition**: Identify faces in images (paid service)
4. **Community Sourcing**: Allow users to submit images via PR

For now, manual + batch processing gives best reliability and UX.
