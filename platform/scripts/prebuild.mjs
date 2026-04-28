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
