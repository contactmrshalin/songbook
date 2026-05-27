/**
 * CLI wrapper for the TypeScript scraper.
 *
 * Usage:
 *   npx tsx scripts/scrape.ts <URL> [--id song-id] [--title "Song Title"] [--dry-run]
 *
 * Examples:
 *   npx tsx scripts/scrape.ts https://notesandsargam.com/dil-ne-kaha-chupke-se/
 *   npx tsx scripts/scrape.ts https://notesandsargam.com/tu-hi-re/ --dry-run
 *   npx tsx scripts/scrape.ts https://notesandsargam.com/main-tenu-samjhawa-ki/ --id my-song --title "My Song"
 */

import { extractSongFromUrl } from "../src/lib/scraper";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: npx tsx scripts/scrape.ts <URL> [options]

Options:
  --id <id>        Override song ID
  --title <title>  Override song title
  --dry-run        Print JSON without saving
  --help           Show this help`);
    process.exit(0);
  }

  // Parse args
  const urls: string[] = [];
  let songId: string | undefined;
  let songTitle: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--id") {
      songId = args[++i];
    } else if (arg === "--title") {
      songTitle = args[++i];
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (!arg.startsWith("--")) {
      urls.push(arg);
    }
  }

  if (urls.length === 0) {
    console.error("Error: No URL provided");
    process.exit(1);
  }

  const dataDir = path.resolve(__dirname, "../../data");
  const songsDir = path.join(dataDir, "songs");
  const bookPath = path.join(dataDir, "book.json");

  for (const url of urls) {
    try {
      console.error(`Fetching: ${url}`);
      const { song, rawLineCount } = await extractSongFromUrl(url, {
        songId: urls.length === 1 ? songId : undefined,
        songTitle: urls.length === 1 ? songTitle : undefined,
      });

      if (dryRun) {
        console.log(JSON.stringify(song, null, 2));
        console.error(
          `\n✅ ${song.title} (id: ${song.id}) — ${song.sections.length} sections, ${song.sections.reduce((a, s) => a + s.lines.length, 0)} lines (from ${rawLineCount} raw lines)`
        );
      } else {
        // Save to data/songs/<id>.json
        if (!fs.existsSync(songsDir)) fs.mkdirSync(songsDir, { recursive: true });
        const songPath = path.join(songsDir, `${song.id}.json`);
        fs.writeFileSync(songPath, JSON.stringify(song, null, 2) + "\n", "utf-8");

        // Update book.json song_order
        if (fs.existsSync(bookPath)) {
          const book = JSON.parse(fs.readFileSync(bookPath, "utf-8"));
          const order: string[] = book.song_order || [];
          if (!order.includes(song.id)) {
            order.push(song.id);
            book.song_order = order;
            fs.writeFileSync(bookPath, JSON.stringify(book, null, 2) + "\n", "utf-8");
          }
        }

        console.log(`✅ Saved: ${songPath}`);
        console.log(
          `   Song: ${song.title} (id: ${song.id})`
        );
        console.log(
          `   Sections: ${song.sections.length}, Lines: ${song.sections.reduce((a, s) => a + s.lines.length, 0)}`
        );
      }
    } catch (err) {
      console.error(`❌ Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  }
}

main();
