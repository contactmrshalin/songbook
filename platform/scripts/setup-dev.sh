#!/bin/bash
# setup-dev.sh — Set up local development environment for the React app.
# Run once after cloning, or whenever song data / images change.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLATFORM_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$(dirname "$PLATFORM_DIR")/data"

echo "🔧 Setting up local development..."

# Copy images for the Next.js dev server
IMAGES_DIR="$PLATFORM_DIR/public/song-images"
if [ -d "$DATA_DIR/images" ]; then
  rm -rf "$IMAGES_DIR"
  mkdir -p "$IMAGES_DIR"
  cp -r "$DATA_DIR/images/"* "$IMAGES_DIR/" 2>/dev/null || true
  IMG_COUNT=$(find "$IMAGES_DIR" -type f | wc -l | tr -d ' ')
  echo "✅ Copied $IMG_COUNT images to public/song-images/"
else
  echo "⚠️  No data/images/ directory found"
fi

# Generate song bundle
echo "📦 Generating song data bundle..."
cd "$PLATFORM_DIR"
node scripts/prebuild.mjs

echo ""
echo "✅ Ready! Run 'npm run dev' to start developing."
