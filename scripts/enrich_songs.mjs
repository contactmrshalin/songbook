#!/usr/bin/env node
/**
 * Batch AI metadata enrichment for all song JSONs using Google Gemini.
 *
 * Usage:
 *   node scripts/enrich_songs.mjs [options]
 *
 * Options:
 *   --dry-run          Print what would change; do NOT write files.
 *   --limit N          Process at most N songs (default: all).
 *   --song <id>        Enrich a single song by its ID (filename without .json).
 *   --delay-ms N       Milliseconds between API calls to avoid rate limits (default: 800).
 *   --skip-trivia      Only fill metadata fields; skip description + trivia generation.
 *
 * Environment:
 *   GOOGLE_AI_API_KEY  Required. Set in .env.local or export before running.
 *
 * Examples:
 *   GOOGLE_AI_API_KEY=AIza... node scripts/enrich_songs.mjs --dry-run --limit 3
 *   GOOGLE_AI_API_KEY=AIza... node scripts/enrich_songs.mjs --song kabhi-alvida-naa-kehna
 *   GOOGLE_AI_API_KEY=AIza... node scripts/enrich_songs.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SONGS_DIR = path.resolve(__dirname, "../data/songs");

// ─── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SKIP_TRIVIA = args.includes("--skip-trivia");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const songIdx = args.indexOf("--song");
const SINGLE_SONG = songIdx >= 0 ? args[songIdx + 1] : null;
const delayIdx = args.indexOf("--delay-ms");
// Free tier limit: 15 RPM = 1 req per 4s. Default 4500ms gives a comfortable margin.
const DELAY_MS = delayIdx >= 0 ? parseInt(args[delayIdx + 1], 10) : 4500;

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

// ─── API key ──────────────────────────────────────────────────────────────
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
if (!GOOGLE_AI_API_KEY) {
  console.error(
    "\n❌  GOOGLE_AI_API_KEY is not set.\n" +
    "    Export it before running:\n" +
    "      export GOOGLE_AI_API_KEY=AIza...\n" +
    "    Or prefix the command:\n" +
    "      GOOGLE_AI_API_KEY=AIza... node scripts/enrich_songs.mjs\n"
  );
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractMeta(info) {
  const meta = {};
  for (const line of info) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.substring(0, idx).trim().toLowerCase();
      const val = line.substring(idx + 1).trim();
      if (key.includes("movie") || key.includes("film")) meta.movie = val;
      else if (key.includes("singer") || key.includes("artist")) meta.singer = val;
      else if (key.includes("scale")) meta.scale = val;
      else if (key.includes("raag") || key.includes("raga")) meta.raag = val;
      else if (key.includes("thaat")) meta.thaat = val;
      else if (key.includes("music") || key.includes("composer")) meta.music = val;
      else if (key.includes("lyric")) meta.lyrics = val;
      else if (key.includes("year")) meta.year = val;
    }
  }
  return meta;
}

const SYSTEM_PROMPT = `You are an expert musicologist and writer specialising in Indian film music (Bollywood) and Indian classical music.

Your job is to provide accurate metadata and engaging content about songs. Follow these rules strictly:
- Return ONLY a valid JSON object — no prose, no markdown, no code fences.
- For factual metadata (movie, singer, etc.): if you are not highly confident, return null. Do NOT guess.
- For raag/thaat: only fill if the song has a clear classical or semi-classical raga basis. Pure western-influenced pop songs should get null.
- movie: include release year in parentheses e.g. "Dil Chahta Hai (2001)"
- singer: comma-separated if multiple artists
- music: music director(s), comma-separated
- lyrics: lyricist(s), comma-separated
- description: 2–3 engaging sentences about the song's significance, mood, and musical style. Make it interesting for a learner.
- trivia: array of 3–4 genuinely interesting facts. Can include: historical context, recording stories, musical techniques, awards, cultural impact, connection to classical music.`;

/** Fetch with exponential back-off on 429 / 503 quota errors */
async function fetchWithRetry(url, init, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    const isQuota = res.status === 429 || res.status === 503;
    if (isQuota && attempt < maxRetries) {
      const waitMs = 5000 * Math.pow(3, attempt - 1); // 5s, 15s, 45s
      process.stdout.write(`\n       ⏳ quota hit, retrying in ${waitMs / 1000}s… `);
      await sleep(waitMs);
      continue;
    }
    return res; // let caller handle the error status
  }
}

async function enrichSong(title, info, missingMeta, needsDescription, needsTrivia) {
  const needed = [
    ...missingMeta,
    ...(needsDescription ? ["description"] : []),
    ...(needsTrivia ? ["trivia (array of strings)"] : []),
  ];

  const prompt = [
    `Song title: "${title}"`,
    "Already known:",
    ...(info.length > 0 ? info.map((l) => `  ${l}`) : ["  (none)"]),
    "",
    `Please provide: ${needed.join(", ")}`,
    "",
    `Return a JSON object with keys: ${[...missingMeta, ...(needsDescription ? ["description"] : []), ...(needsTrivia ? ["trivia"] : [])].join(", ")}`,
    "For any metadata key you are unsure about, set it to null.",
  ].join("\n");

  const res = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-goog-api-key": GOOGLE_AI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    const quota = res.status === 429 || res.status === 503;
    throw new Error(
      `Gemini ${res.status}: ${body.slice(0, 200)}${quota ? " — quota exceeded, try again later or upgrade plan" : ""}`
    );
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  let parsed = {};
  try {
    const cleaned = rawText.replace(/```(?:json)?/gi, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Bad JSON from Gemini: ${rawText.slice(0, 200)}`);
  }

  const labelMap = { movie: "Film", singer: "Singer", music: "Music", lyrics: "Lyrics", raag: "Raag", thaat: "Thaat", year: "Year" };
  const newFields = [];
  for (const key of missingMeta) {
    const value = parsed[key];
    if (!value || typeof value !== "string" || !value.trim()) continue;
    if (key === "year" && (parsed.movie ?? "").includes(value)) continue;
    newFields.push(`${labelMap[key] ?? key}: ${value.trim()} (AI)`);
  }

  const description =
    needsDescription && typeof parsed.description === "string" && parsed.description.trim()
      ? parsed.description.trim()
      : null;

  const trivia =
    needsTrivia && Array.isArray(parsed.trivia)
      ? parsed.trivia
          .filter((f) => typeof f === "string" && f.trim())
          .map((f) => f.trim())
          .slice(0, 4)
      : null;

  return { newFields, description, trivia };
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🎵  Songbook AI Enrichment (Gemini)`);
  console.log(`   Model:      ${GEMINI_MODEL}`);
  console.log(`   Mode:       ${DRY_RUN ? "DRY RUN (no files written)" : "LIVE (files will be updated)"}`);
  console.log(`   Trivia:     ${SKIP_TRIVIA ? "skipped" : "enabled"}`);
  if (SINGLE_SONG) console.log(`   Target:     ${SINGLE_SONG}.json`);
  else console.log(`   Limit:      ${LIMIT === Infinity ? "all songs" : LIMIT}`);
  console.log(`   Delay:      ${DELAY_MS}ms between API calls\n`);

  let files = fs.readdirSync(SONGS_DIR).filter((f) => f.endsWith(".json"));
  if (SINGLE_SONG) {
    const target = `${SINGLE_SONG}.json`;
    if (!files.includes(target)) { console.error(`❌  Not found: ${target}`); process.exit(1); }
    files = [target];
  } else {
    files = files.slice(0, LIMIT === Infinity ? files.length : LIMIT);
  }

  let processed = 0, enriched = 0, skipped = 0, errors = 0;

  for (const file of files) {
    const filePath = path.join(SONGS_DIR, file);
    const song = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const existing = extractMeta(song.info);

    const missingMeta = ["movie", "singer", "music", "lyrics", "raag", "thaat", "year"].filter((k) => !existing[k]);
    const needsDescription = !song.description && !SKIP_TRIVIA;
    const needsTrivia = (!song.trivia || song.trivia.length === 0) && !SKIP_TRIVIA;

    if (missingMeta.length === 0 && !needsDescription && !needsTrivia) {
      console.log(`  ✅  ${song.title} — complete, skipping`);
      skipped++;
      processed++;
      continue;
    }

    const needed = [...missingMeta, ...(needsDescription ? ["desc"] : []), ...(needsTrivia ? ["trivia"] : [])];
    process.stdout.write(`  🔍  ${song.title} (need: ${needed.join(", ")}) … `);

    try {
      const { newFields, description, trivia } = await enrichSong(
        song.title, song.info, missingMeta, needsDescription, needsTrivia
      );

      const changed = newFields.length + (description ? 1 : 0) + (trivia?.length ? 1 : 0);
      if (changed === 0) {
        console.log("Gemini returned no new data");
        skipped++;
      } else {
        console.log(`+${changed} item(s)`);
        newFields.forEach((f) => console.log(`       • ${f}`));
        if (description) console.log(`       • Description (${description.length} chars)`);
        if (trivia?.length) console.log(`       • ${trivia.length} trivia facts`);

        if (!DRY_RUN) {
          song.info = [...song.info, ...newFields];
          if (description) song.description = description;
          if (trivia?.length) song.trivia = trivia;
          fs.writeFileSync(filePath, JSON.stringify(song, null, 2) + "\n", "utf8");
        }
        enriched++;
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      errors++;
    }

    processed++;
    if (processed < files.length) await sleep(DELAY_MS);
  }

  console.log(`\n────────────────────────────────`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Enriched:  ${enriched}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Errors:    ${errors}`);
  if (DRY_RUN) {
    console.log(`\n  ℹ️  Dry run — no files were modified.`);
    console.log(`     Re-run without --dry-run to apply changes.`);
  } else if (enriched > 0) {
    console.log(`\n  ✅  Done! Run 'bun run prebuild' in platform/ to rebuild song-bundle.json`);
  }
  console.log();
}

main().catch((err) => { console.error("\n❌  Fatal:", err.message); process.exit(1); });
