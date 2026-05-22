#!/usr/bin/env node
/**
 * prebuild.mjs — Bundle all song data into a single JSON file
 * so the Next.js app has zero `fs` calls at build time.
 *
 * Looks for data in (order of priority):
 *   1. platform/.songdata/  (created by deploy.sh for Vercel CLI deploys)
 *   2. ../                  (local dev — songs/ and book.json in project root)
 */
import fs from "node:fs";
import path from "node:path";

const PLATFORM_DIR = path.resolve(import.meta.dirname, "..");
const OUTPUT = path.join(PLATFORM_DIR, "src", "generated", "song-bundle.json");

// Find the data root
function findDataRoot() {
  const candidates = [
    path.join(PLATFORM_DIR, ".songdata"),
    path.resolve(PLATFORM_DIR, "..", "data"),
    path.resolve(PLATFORM_DIR, ".."),
  ];

  for (const dir of candidates) {
    if (
      fs.existsSync(path.join(dir, "songs")) &&
      fs.existsSync(path.join(dir, "book.json"))
    ) {
      return dir;
    }
  }

  // If the bundle already exists (committed to Git), skip generation
  if (fs.existsSync(OUTPUT)) {
    console.log(
      `⏭️  Song data directory not found, but ${path.relative(PLATFORM_DIR, OUTPUT)} already exists — skipping generation.`
    );
    process.exit(0);
  }

  console.error("ERROR: Cannot find song data in any of:", candidates);
  process.exit(1);
}

const DATA_ROOT = findDataRoot();
console.log(`📦 Reading song data from: ${DATA_ROOT}`);

// Read book.json
const bookMeta = JSON.parse(
  fs.readFileSync(path.join(DATA_ROOT, "book.json"), "utf-8")
);

// Read notation_mapping.json (optional)
let notationMapping = {};
const mappingPath = path.join(DATA_ROOT, "notation_mapping.json");
if (fs.existsSync(mappingPath)) {
  notationMapping = JSON.parse(fs.readFileSync(mappingPath, "utf-8"));
}

// Read all song JSON files
const songsDir = path.join(DATA_ROOT, "songs");
const songFiles = fs.readdirSync(songsDir).filter((f) => f.endsWith(".json"));
const songsMap = new Map();

for (const file of songFiles) {
  const raw = fs.readFileSync(path.join(songsDir, file), "utf-8");
  const song = JSON.parse(raw);

  // Normalize
  if (!Array.isArray(song.info)) song.info = [];
  if (!Array.isArray(song.sections)) song.sections = [];
  for (const section of song.sections) {
    if (!section.name) section.name = "Untitled";
    if (!Array.isArray(section.lines)) section.lines = [];
  }

  // Only include exported songs
  if (song.export !== false) {
    songsMap.set(song.id, song);
  }
}

// Order according to book.json
const ordered = [];
for (const id of bookMeta.song_order || []) {
  const song = songsMap.get(id);
  if (song) {
    ordered.push(song);
    songsMap.delete(id);
  }
}
// Append remaining songs not in the order
for (const song of songsMap.values()) {
  ordered.push(song);
}

// Write bundle
const bundle = {
  bookMeta,
  notationMapping,
  songs: ordered,
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(bundle));

console.log(
  `✅ Bundled ${ordered.length} songs into src/generated/song-bundle.json (${(fs.statSync(OUTPUT).size / 1024).toFixed(0)}KB)`
);

// ── MusicXML generation ───────────────────────────────────────────────────
// MusicXML is now generated on-the-fly by /api/musicxml/[id] from the song's
// sargam notation data (via lib/toMusicXml.ts). No pre-generated files needed.
// If data/musicxml/ exists with manually curated files, they will still be
// served preferentially by the API route.

// ── Download Verovio UMD bundle into public/verovio/ ──────────────────────────
// Verovio is an Emscripten-compiled WASM library with Node.js-specific code
// paths that can't be processed by Turbopack/webpack for browser bundles.
// Instead we serve the pre-built UMD file as a static asset and load it at
// runtime via a <script> tag (VerovioRenderer.tsx), bypassing the bundler.
// Downloaded from CDN to avoid including the heavy npm package in the project.
const VEROVIO_CDN_URL = "https://www.verovio.org/javascript/develop/verovio-toolkit-wasm.js";
const verovioDestDir = path.join(PLATFORM_DIR, "public", "verovio");
const veroverDest = path.join(verovioDestDir, "verovio-toolkit-wasm.js");

if (!fs.existsSync(veroverDest)) {
  fs.mkdirSync(verovioDestDir, { recursive: true });
  console.log(`🎼 Downloading Verovio WASM bundle from CDN...`);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const resp = await fetch(VEROVIO_CDN_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(veroverDest, buf);
    console.log(`🎼 Verovio WASM bundle saved to public/verovio/ (${(buf.length / 1024 / 1024).toFixed(1)}MB)`);
  } catch (err) {
    console.warn(`⚠  Failed to download Verovio from CDN: ${err.message} — will load from CDN at runtime instead.`);
  }
} else {
  console.log(`🎼 Verovio bundle already present in public/verovio/`);
}
