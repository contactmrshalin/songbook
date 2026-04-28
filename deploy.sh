#!/bin/bash
# deploy.sh — Bundle data + images from data/ into platform/ and deploy to Vercel
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLATFORM_DIR="$SCRIPT_DIR/platform"
DATA_SRC="$SCRIPT_DIR/data"
SONGDATA_DIR="$PLATFORM_DIR/.songdata"
IMAGES_DIR="$PLATFORM_DIR/public/song-images"

echo "📦 Bundling song data into platform/.songdata/ ..."
rm -rf "$SONGDATA_DIR"
mkdir -p "$SONGDATA_DIR/songs"

cp "$DATA_SRC"/songs/*.json "$SONGDATA_DIR/songs/"
cp "$DATA_SRC/book.json" "$SONGDATA_DIR/"
cp "$DATA_SRC/notation_mapping.json" "$SONGDATA_DIR/"

SONG_COUNT=$(ls "$SONGDATA_DIR/songs/"*.json 2>/dev/null | wc -l | tr -d ' ')
echo "✅ Copied $SONG_COUNT songs + book.json + notation_mapping.json"

echo "🖼️  Copying images into platform/public/song-images/ ..."
rm -rf "$IMAGES_DIR"
mkdir -p "$IMAGES_DIR"
cp -r "$DATA_SRC/images/"* "$IMAGES_DIR/" 2>/dev/null || true
IMG_COUNT=$(find "$IMAGES_DIR" -type f | wc -l | tr -d ' ')
echo "✅ Copied $IMG_COUNT image files"

echo "🚀 Deploying to Vercel ..."
cd "$PLATFORM_DIR"
vercel "$@"

echo "🧹 Cleaning up temporary files ..."
rm -rf "$SONGDATA_DIR"
rm -rf "$IMAGES_DIR"
echo "✅ Done!"
