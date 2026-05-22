/**
 * Generate placeholder app icons.
 * Replace these with actual designed icons before publishing.
 *
 * Usage: node scripts/generate-icons.js
 */

const fs = require("fs");
const path = require("path");

// Create a simple 1x1 pixel PNG (purple color #6c63ff) as placeholder
// Real icons should be 1024x1024
function createPlaceholderPng() {
  // Minimal valid PNG: 1x1 pixel, RGBA, purple
  const png = Buffer.from(
    "89504e47" + // PNG signature
      "0d0a1a0a" +
      "0000000d" + // IHDR chunk length
      "49484452" + // "IHDR"
      "00000001" + // width = 1
      "00000001" + // height = 1
      "08" + // bit depth = 8
      "06" + // color type = RGBA
      "000000" + // compression, filter, interlace
      "1f15c489" + // CRC
      "0000000d" + // IDAT chunk length
      "49444154" + // "IDAT"
      "78da6260" + // zlib header + data
      "6c63ffff" +
      "00000500" +
      "0100a961" +
      "a5" + // CRC
      "0000000049454e44ae426082", // IEND
    "hex"
  );
  return png;
}

const ASSETS_DIR = path.join(__dirname, "..", "assets");
fs.mkdirSync(ASSETS_DIR, { recursive: true });

// We'll create proper SVG-based placeholders as text files with instructions
const iconNote = `Replace this file with a 1024x1024 PNG app icon.
Suggested design: Musical note (♪) on a purple (#6c63ff) gradient background
with the text "SN" (Song Notations).`;

const splashNote = `Replace this file with a 1024x1024 PNG splash screen.
Suggested design: App name "Song Notations" centered on dark background (#1a1a2e)
with a subtle musical notation motif.`;

// Write minimal placeholder PNGs (these are valid but tiny)
const placeholderPng = createPlaceholderPng();
fs.writeFileSync(path.join(ASSETS_DIR, "icon.png"), placeholderPng);
fs.writeFileSync(path.join(ASSETS_DIR, "adaptive-icon.png"), placeholderPng);
fs.writeFileSync(path.join(ASSETS_DIR, "splash.png"), placeholderPng);

// Write instructions
fs.writeFileSync(path.join(ASSETS_DIR, "ICON_INSTRUCTIONS.md"), `# App Icons

${iconNote}

## Files needed:
- \`icon.png\` — 1024×1024, used for iOS and as fallback
- \`adaptive-icon.png\` — 1024×1024, Android adaptive icon foreground
- \`splash.png\` — 1284×2778 recommended, splash/loading screen

## Quick generation:
Use any image tool or Figma to create these. The adaptive icon should have
transparent padding around the foreground since Android crops it to various shapes.
`);

console.log("Generated placeholder icons in assets/");
console.log("Replace with real 1024x1024 PNG files before publishing.");
