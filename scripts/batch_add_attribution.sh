#!/bin/bash
# Batch add image attribution to songs that have local images

set -e

cd "$(dirname "$0")/.."
data_dir="data/songs"
images_dir="data/images"

count=0

# Find all images and add attribution
for img in "$images_dir"/*.jpg "$images_dir"/*.jpeg; do
    [ -e "$img" ] || continue
    
    # Extract song ID from filename
    basename=$(basename "$img")
    song_id=$(echo "$basename" | sed 's/-wikipedia.jpg\|-imdb.jpg\|-spotify.jpg\|-.*\.jpg/.json/')
    song_file="$data_dir/${song_id%.jpg}.json"
    
    if [ -f "$song_file" ]; then
        echo "Processing $basename..."
        
        # Extract source from filename
        if [[ "$basename" == *"-wikipedia"* ]]; then
            source="Wikipedia"
            license="CC-BY-SA"
        elif [[ "$basename" == *"-imdb"* ]]; then
            source="IMDB"
            license="Fair Use"
        elif [[ "$basename" == *"-spotify"* ]]; then
            source="Spotify"
            license="Fair Use"
        else
            source="Unknown"
            license="Unknown"
        fi
        
        echo "  Source: $source"
        
        # Add attribution using Python
        python3 - "$song_file" "$source" "$license" << 'PYTHON'
import json
import sys
from datetime import date

song_file = sys.argv[1]
source = sys.argv[2]
license_type = sys.argv[3]

with open(song_file) as f:
    song = json.load(f)

if "thumbnailAttribution" not in song:
    song["thumbnailAttribution"] = {}

song["thumbnailAttribution"]["source"] = source
song["thumbnailAttribution"]["license"] = license_type
song["thumbnailAttribution"]["addedDate"] = str(date.today())

with open(song_file, 'w') as f:
    json.dump(song, f, ensure_ascii=False, indent=2)
    f.write('\n')

print(f"  ✓ Added {source} attribution")
PYTHON
        
        count=$((count + 1))
    fi
done

echo "✓ Updated $count songs"
