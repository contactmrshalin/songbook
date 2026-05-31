/**
 * Song notation scraper — TypeScript port of scripts/scrape_notation_url.py
 *
 * Scrapes song notations from web pages (notationsworld.com, notesandsargam.com,
 * sangeetbook.com, and generic pages with alternating lyrics / sargam lines).
 *
 * Runs server-side only (API routes).
 */

import type { Song, SongSection, SongLine } from "@/types/song";

// ---------------------------------------------------------------------------
// HTML fetching & cleaning
// ---------------------------------------------------------------------------

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Safari/537.36";

export async function fetchHtml(url: string): Promise<string> {
  // Use https module directly because Node.js undici fetch has a 10s connect
  // timeout that is too short for some sites (notesandsargam.com).
  const { default: https } = await import("https");
  const { default: http } = await import("http");

  return new Promise<string>((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "https:" ? https : http;

    const req = client.get(
      url,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: 30_000,
        family: 4, // Force IPv4 — avoids IPv6 connect timeouts
      },
      (res) => {
        // Follow redirects
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          fetchHtml(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const charset =
            res.headers["content-type"]?.match(/charset=([^\s;]+)/i)?.[1] ||
            "utf-8";
          resolve(Buffer.concat(chunks).toString(charset as BufferEncoding));
        });
        res.on("error", reject);
      }
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timeout fetching: ${url}`));
    });
    req.on("error", reject);
  });
}

export interface DownloadedImage {
  buffer: Buffer;
  contentType: string; // e.g. "image/jpeg"
  extension: string; // e.g. ".jpg"
}

export async function downloadImage(imageUrl: string): Promise<DownloadedImage> {
  const res = await fetch(imageUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "image/*,*/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching image: ${imageUrl}`);

  const contentType = res.headers.get("content-type") || "image/png";
  const arrayBuf = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);

  // Detect extension from content-type, then URL path, then fallback
  let extension = contentTypeToExt(contentType);
  if (!extension) {
    extension = extFromUrl(imageUrl);
  }
  if (!extension) {
    // Sniff magic bytes: JPEG starts with FF D8, PNG with 89 50 4E 47
    if (buffer[0] === 0xff && buffer[1] === 0xd8) extension = ".jpg";
    else if (buffer[0] === 0x89 && buffer[1] === 0x50) extension = ".png";
    else if (buffer[0] === 0x52 && buffer[1] === 0x49) extension = ".webp"; // RIFF
    else extension = ".jpg"; // safe default for photos
  }

  return { buffer, contentType, extension };
}

function contentTypeToExt(ct: string): string | null {
  const mime = ct.split(";")[0].trim().toLowerCase();
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };
  return map[mime] || null;
}

function extFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    for (const ext of [".png", ".jpg", ".jpeg", ".webp", ".gif"]) {
      if (pathname.endsWith(ext)) return ext === ".jpeg" ? ".jpg" : ext;
    }
  } catch { /* ignore */ }
  return null;
}

// ---------------------------------------------------------------------------
// HTML → plain-text lines
// ---------------------------------------------------------------------------

function htmlToLines(rawHtml: string): string[] {
  let body = rawHtml;

  // Narrow to article / content area
  const contentPatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div class="entry-content"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|<footer)/i,
    /<div class="post-content"[^>]*>([\s\S]*?)<\/div>/i,
  ];
  for (const pat of contentPatterns) {
    const m = body.match(pat);
    if (m) {
      body = m[1];
      break;
    }
  }

  // Remove scripts, styles, nav
  body = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  body = body.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  body = body.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");

  // Block elements → newlines
  body = body.replace(/<br\s*\/?>/gi, "\n");
  body = body.replace(/<\/p>/gi, "\n");
  body = body.replace(/<\/div>/gi, "\n");
  body = body.replace(/<\/h[1-6]>/gi, "\n");
  body = body.replace(/<h[1-6][^>]*>/gi, "\n");
  body = body.replace(/<\/li>/gi, "\n");

  // Strip remaining tags
  body = body.replace(/<[^>]+>/g, "");
  body = unescapeHtml(body);

  return body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function notesandsargamHtmlToLines(rawHtml: string): string[] {
  let body = rawHtml;

  // Anchor on the song-content intro paragraph (require <p> tag to avoid
  // matching meta description tags that contain similar text)
  const anchor = body.match(/<p>\s*Sargam\s+notations\s+for\s+(?:the\s+)?song\b/i);
  if (anchor && anchor.index !== undefined) {
    body = body.slice(anchor.index);
  }

  // Trim where English notation section usually ends
  const cutPatterns = [
    /Sargam\s+notes\s+in\s+Hindi/i,
    /How\s+to\s+read\s+SARGAM/i,
    /share\s+this\s+on/i,
    /Leave\s+a\s+Reply/i,
  ];
  for (const pat of cutPatterns) {
    const m = body.match(pat);
    if (m && m.index !== undefined) {
      body = body.slice(0, m.index);
      break;
    }
  }

  // Clean
  body = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  body = body.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  body = body.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");

  body = body.replace(/<br\s*\/?>/gi, "\n");
  body = body.replace(/<\/p>/gi, "\n");
  body = body.replace(/<\/li>/gi, "\n");
  body = body.replace(/<\/h[1-6]>/gi, "\n");
  body = body.replace(/<h[1-6][^>]*>/gi, "\n");
  body = body.replace(/<\/div>/gi, "\n");

  body = body.replace(/<[^>]+>/g, "");
  body = unescapeHtml(body);

  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "================");
}

function sangeetbookHtmlToLines(rawHtml: string): string[] {
  let body = rawHtml;

  // Find the "English Lyrics" section heading
  const anchorMatch = body.match(/<h3[^>]*>\s*English\s+Lyrics\s*[-–]?\s*<\/h3>/i);
  if (anchorMatch && anchorMatch.index !== undefined) {
    body = body.slice(anchorMatch.index + anchorMatch[0].length);
  } else {
    const fallback = body.match(/English\s+Lyrics\s*[-–]/i);
    if (fallback && fallback.index !== undefined) {
      body = body.slice(fallback.index + fallback[0].length);
    }
  }

  // Trim at common end markers
  const cutPatterns = [
    /Install\s+Free\s+Sangeet\s+Book\s+App/i,
    /REVIEW\s+OVERVIEW/i,
    /LEAVE\s+A\s+REPLY/i,
    /TAGS\s*</i,
    /class="td-post-sharing"/i,
    /<footer/i,
  ];
  for (const pat of cutPatterns) {
    const m = body.match(pat);
    if (m && m.index !== undefined) {
      body = body.slice(0, m.index);
      break;
    }
  }

  // Remove scripts, styles, nav
  body = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  body = body.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  body = body.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");

  // Block elements → newlines
  body = body.replace(/<br\s*\/?>/gi, "\n");
  body = body.replace(/<\/p>/gi, "\n");
  body = body.replace(/<\/li>/gi, "\n");
  body = body.replace(/<\/h[1-6]>/gi, "\n");
  body = body.replace(/<h[1-6][^>]*>/gi, "\n");
  body = body.replace(/<\/div>/gi, "\n");

  // Strip remaining tags
  body = body.replace(/<[^>]+>/g, "");
  body = unescapeHtml(body);

  return body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function extractTitleFromHtml(rawHtml: string): string {
  const m = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m) {
    let t = unescapeHtml(m[1].trim());
    for (const sep of [" - Sargam", " – Sargam", " | "]) {
      const idx = t.indexOf(sep);
      if (idx !== -1) {
        t = t.slice(0, idx).trim();
        break;
      }
    }
    return t;
  }
  return "Untitled";
}

// ---------------------------------------------------------------------------
// Notation detection
// ---------------------------------------------------------------------------

const SARGAM_LETTERS = new Set("SRGmMPDNrgdn".split(""));

// Hindi (Devanagari) sargam regex for sangeetbook.com
const HINDI_SARGAM_RE = /(?:सा|रे|ग|म|प|ध|नि|सां|रें|गं|मं|पं|धं|निं)/g;

const SKIP_PATTERNS: RegExp[] = [
  /^\s*(Also Read|You May Also Like|Categories|Tags)\b/i,
  /^\s*(DO\s*–|RE\s*–|MI\s*–|FA\s*–|SO\s*–|LA\s*–|TI\s*–)/i,
  /^\s*(LOW OCTAVE|HIGH OCTAVE|KOMAL SWAR|SHUDH MA|TIWAR MA)/i,
  /^\s*(PA\s*–\s*p|DHA\s*–\s*d|NI\s*–\s*n|SA\s*–\s*S)/i,
  /^\s*[🎵🎹🎯🔄📩👋]/,
  /^\s*Convert\s+(to|S,\s*R)/i,
  /^\s*(Undo Changes|Remove Numbers)/i,
  /^\s*सा\s*[-–]/i,
  /^\d{4}$/,
  /by\s+notationsworld/i,
  /^\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d/i,
  /C\s+D\s+E\s+Piano\s+Notes/i,
  /Remove\s+Numbers\s+From\s+Piano/i,
  /Sargam\s+Notes\s*🎶/i,
  /Sargam,?\s*Harmonium/i,
  /Sargam\s+(And|&)\s+Flute/i,
  /Sargam\s+Notes\b/i,
  /^\s*Reply\s*$/i,
  /^\s*Leave\s+a\s+Reply/i,
  /^\s*share\s+this\s+on/i,
  /^\s*How\s+to\s+read\s+SARGAM/i,
  /^\s*CAPITAL\s+LETTERS/i,
  /^\s*small\s+letters/i,
  /^\s*Post\s+Views\s*:/i,
  // Intro line on notesandsargam pages
  /^\s*Sargam\s+notations\s+for\s+(the\s+)?song\b/i,
  // Metadata lines (already extracted separately)
  /^\s*(Movie|Lyricist|Singers?|Music\s*Director|Music|Raag|Scale|Pitch|Flute\s+used\s+for\s+notations)\s*:/i,
  /^\s*Sargam\s+for\s+Song\s*:/i,
  /^\s*SCALE\s+(OF\s+)?(THE\s+)?(FLUTE|SONG)\s+IS/i,
  // sangeetbook.com boilerplate
  /^\s*Install\s+Free\s+Sangeet\s+Book\s+App/i,
  /^\s*How\s+to\s+Play\b.*\bon\s+Harmonium/i,
  /^\s*How\s+To\s+Read\s+Sargam\s+Notes/i,
  /^\s*Original\s+Scale/i,
  /^\s*Vikrit\s+swar/i,
  /^\s*Rhythm\s*[-–]/i,
  /^\s*Music\s+Details/i,
  /^\s*Video\s*[-–]?\s*$/i,
  /^\s*REVIEW\s+OVERVIEW/i,
  /^\s*OVERALL\s+SCORE/i,
  /^\s*SUMMARY\b/i,
  /उपर्युक्त\s+पंक्ति\s+के\s+समान/,
];

function isSkipLine(line: string): boolean {
  return SKIP_PATTERNS.some((pat) => pat.test(line));
}

function isProseParagraph(line: string): boolean {
  const t = line.trim();
  if (t.length > 150 && (t.match(/\. /g) || []).length >= 1) return true;
  if (t.length > 100 && (t.match(/\. /g) || []).length >= 2) return true;
  if (/^["\u201c].+?["\u201d]\s+(from|is|was|by)\b/.test(t) && t.length > 80)
    return true;
  return false;
}

function isSargamLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (isSkipLine(t)) return false;

  // Remove separators
  const cleaned = t.replace(/[.\s|…~(){}:'''\u2019\u2018,\-#^]+/g, "");
  if (!cleaned) return false;

  const sargamCount = [...cleaned].filter((c) => SARGAM_LETTERS.has(c)).length;
  const ratio = sargamCount / cleaned.length;

  if (ratio >= 0.7 && sargamCount >= 2) return true;

  // Dot-separated pattern: S..R..G..  or S'..R'..G'..
  if (/[SRGmMPDNrgdn]['''\u2019]?\s*\.{2,}\s*[SRGmMPDNrgdn]/.test(t))
    return true;

  // Pipe-separated (notesandsargam style)
  if (t.includes("|") && /[SRGmMPDNrgdn]/.test(t)) {
    const alphaChars = t.match(/[A-Za-z]/g) || [];
    if (alphaChars.length > 0) {
      const noteAlpha = alphaChars.filter((c) => SARGAM_LETTERS.has(c)).length;
      if (noteAlpha / alphaChars.length < 0.75) return false;
    }
    const tokens = t.match(
      /[.,]?[SRGmMPDNrgdn](?:[\'#^]|\([^)]*\)|\{[^}]*\})?/g
    );
    if (tokens && tokens.length >= 3) return true;
  }

  // sangeetbook.com Hindi (Devanagari) sargam notation:
  // e.g. "ग(k) रे / सा – सा / सा सा सा / सा रे / (सा).नि(k) – / रे – रे –"
  const hindiMatches = t.match(HINDI_SARGAM_RE) || [];
  if (hindiMatches.length >= 2) {
    const devanagariChars = t.match(/[\u0900-\u097F]/g) || [];
    if (devanagariChars.length > 0) {
      // "/" separators are a strong indicator of notation on sangeetbook
      if (t.includes("/") && hindiMatches.length >= 2) return true;
      // High ratio of sargam-related Devanagari
      const sargamCharCount = hindiMatches.reduce((a, m) => a + m.length, 0);
      if (sargamCharCount / devanagariChars.length >= 0.6 && hindiMatches.length >= 3)
        return true;
    }
  }

  return false;
}

function isLyricsLine(line: string): boolean {
  const t = line.trim();
  if (!t || isSkipLine(t) || isSargamLine(t)) return false;
  const alpha = (t.match(/[A-Za-zА-яа-я\u0900-\u097F]/g) || []).length;
  return alpha >= 2;
}

function isSectionHeader(line: string): boolean {
  const t = line.trim().toUpperCase();
  const SECTION_WORDS = new Set([
    "INTRO",
    "INTRODUCTION",
    "MUKHDA",
    "MUKHRA",
    "STHAYI",
    "STHAI",
    "ANTARA",
    "ANTARAA",
    "INTERLUDE",
    "OUTRO",
    "CHORUS",
    "REPEAT",
    "HUMMING",
    "PRELUDE",
    "SARGAM",
  ]);
  const cleaned = t.replace(/[:\-–—\s]+$/, "").trim();
  if (SECTION_WORDS.has(cleaned)) return true;
  const m = cleaned.match(/^(\w+)\s*[-–]?\s*\d*$/);
  if (m && SECTION_WORDS.has(m[1])) return true;
  // sangeetbook.com uses "Stanza – 1", "Stanza – 2" for antaras
  if (/^STANZA\s*[-–]?\s*\d*$/.test(cleaned)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Notation normalization
// ---------------------------------------------------------------------------

const LETTER_TO_WORD: Record<string, string> = {
  S: "Sa",
  R: "Re",
  G: "Ga",
  m: "ma",
  M: "Ma",
  P: "Pa",
  D: "Dha",
  N: "Ni",
  p: "pa",
  d: "dha",
  n: "ni",
  r: "Re",
  g: "Ga",
};

function convertTokenToDisplay(token: string): string {
  let t = token.trim();
  if (!t) return t;

  let hold = "";
  if (t.endsWith(":")) {
    hold = ":";
    t = t.slice(0, -1);
  }

  let octave = "";
  if (t.endsWith("'")) {
    octave = "'";
    t = t.slice(0, -1);
  } else if (t.endsWith(".") && t.length > 1) {
    octave = ".";
    t = t.slice(0, -1);
  }

  if (t.startsWith(",")) t = t.slice(1);

  // Already full word
  if (/\b(Sa|Re|Ga|ma|Ma|Pa|Dha|Ni|pa|dha|ni)\b/.test(t))
    return `${t}${octave}${hold}`;

  // Komal marker: r(k), g(k), d(k), n(k)
  const mk = t.match(/^([rgdnRGDN])\(([kK])\)$/);
  if (mk) {
    const komalMap: Record<string, string> = {
      R: "Re",
      G: "Ga",
      D: "Dha",
      N: "Ni",
    };
    const word = komalMap[mk[1].toUpperCase()] || mk[1];
    return `${word}(k)${octave}${hold}`;
  }

  // Tivra Ma
  const mt = t.match(/^M\(([tT])\)$/);
  if (mt) return `Ma(T)${octave}${hold}`;

  // Compound tokens like N.D.P
  if (t.includes(".") && t.length > 2) {
    const subTokens = t.split(".").filter(Boolean);
    const converted = subTokens.map((st) => {
      let oct = "";
      let s2 = st;
      if (s2.endsWith("'")) {
        oct = "'";
        s2 = s2.slice(0, -1);
      }
      const w = LETTER_TO_WORD[s2];
      return w ? `${w}${oct}` : null;
    });
    if (converted.every((c) => c !== null)) return converted.join(" ");
  }

  const word = LETTER_TO_WORD[t];
  if (word) return `${word}${octave}${hold}`;

  return `${t}${octave}${hold}`;
}

function normalizeNotation(raw: string): string {
  let s = raw.trim();
  if (!s) return s;

  // Normalize curly quotes
  s = s.replace(/\u2019/g, "'").replace(/\u2018/g, "'");

  // Expand single-dot-separated note sequences: d.n.p → d n p
  const sdRe = /([SRGmMPDNrgdn]'?)\.([SRGmMPDNrgdn])/;
  for (let i = 0; i < 5; i++) {
    const newS = s.replace(sdRe, "$1 $2");
    if (newS === s) break;
    s = newS;
  }

  // Double-dot separators → spaces
  s = s.replace(/\.{2,}/g, " ");
  s = s.replace(/…/g, "... ");

  // Hold patterns: "..." → ":"
  s = s.replace(/\s*\.{3,}\s*/g, ": ");

  // Clean spaces
  s = s.replace(/\s+/g, " ").trim();

  // Handle tivra Ma
  s = s.replace(/\bM\(T\)/gi, "Ma(T)");

  // Token-by-token conversion
  return s
    .split(" ")
    .map(convertTokenToDisplay)
    .join(" ");
}

function normalizeNotationSymbolic(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  s = unescapeHtml(s);
  s = s.replace(/\u2019/g, "'").replace(/\u2018/g, "'");
  s = s.replace(/…/g, "...");
  s = s.replace(/\s*\|\s*/g, " | ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------

function extractMetadata(
  title: string,
  lines: string[]
): { cleanTitle: string; info: string[] } {
  let cleanTitle = title.trim();

  // Remove common suffixes
  const suffixes = [
    " – Sargam, Harmonium And Flute Notes",
    " - Sargam, Harmonium And Flute Notes",
    " – Sargam And Flute Notes",
    " - Sargam And Flute Notes",
    " – Sargam Notes",
    " - Sargam Notes",
    " Sargam Notes",
  ];
  for (const suffix of suffixes) {
    if (cleanTitle.toLowerCase().endsWith(suffix.toLowerCase())) {
      cleanTitle = cleanTitle.slice(0, -suffix.length).trim();
      break;
    }
  }

  const info: string[] = [];

  for (const line of lines.slice(0, 20)) {
    const l = line.trim();

    // notesandsargam metadata: "Movie : Kabhi Kabhi (1976)"
    const metaMatch = l.match(
      /^(Movie|Lyricist|Singers?|Music\s*Director|Music|Raag|Scale|Pitch|Flute\s+used\s+for\s+notations)\s*:\s*(.+)$/i
    );
    if (metaMatch) {
      let k = metaMatch[1].trim();
      const v = metaMatch[2].trim();
      if (/flute used/i.test(k)) k = "Flute";
      if (/music director/i.test(k)) k = "Music Director";
      info.push(`${k}: ${v}`);
      continue;
    }

    // "SCALE OF THE FLUTE/SONG IS ..."
    const scaleMatch = l.match(
      /SCALE\s+(?:OF\s+)?(?:THE\s+)?(?:FLUTE|SONG)\s+IS\s+(.+)/i
    );
    if (scaleMatch) {
      let scaleVal = scaleMatch[1].trim();
      scaleVal = scaleVal.replace(/\s*[–-]\s*Sargam.*$/i, "").trim();
      info.push(`Scale: ${scaleVal}`);
      continue;
    }

    // "Song Name (Artist) – Sargam, Harmonium..."
    const artistMatch = l.match(
      /^(.+?)\s*\(([^)]+)\)\s*(?:–|-)\s*Sargam/i
    );
    if (artistMatch) {
      cleanTitle = artistMatch[1].trim();
      const artist = artistMatch[2].trim();
      if (!info.some((i) => i.includes("Film/Artist"))) {
        info.push(`Film/Artist: ${artist}`);
      }
      continue;
    }

    if (isSkipLine(l)) continue;
  }

  // Extract (Artist) from title
  const titleArtist = cleanTitle.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (titleArtist) {
    cleanTitle = titleArtist[1].trim();
    const artist = titleArtist[2].trim();
    if (!info.some((i) => i.includes("Film/Artist"))) {
      info.unshift(`Film/Artist: ${artist}`);
    }
  }

  return { cleanTitle, info };
}

function extractSangeetbookMetadata(
  rawHtml: string,
  pageTitle: string
): { cleanTitle: string; info: string[] } {
  const info: string[] = [];

  // Clean the title: remove "Sargam Notes In Hindi-..." suffix
  let cleanTitle = pageTitle.trim();
  const suffixPatterns = [
    /\s*[-–]\s*Sargam\s+Notes\s+In\s+Hindi.*$/i,
    /\s+Sargam\s+Notes\s+In\s+Hindi.*$/i,
    /\s+Sargam\s+Notes.*$/i,
  ];
  for (const pat of suffixPatterns) {
    const cleaned = cleanTitle.replace(pat, "").trim();
    if (cleaned !== cleanTitle) {
      cleanTitle = cleaned;
      break;
    }
  }

  // Strip HTML to plain text for metadata extraction
  let metaBody = rawHtml;
  const articleMatch =
    metaBody.match(/<div class="td-post-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div class="td-post-sharing|<footer)/i) ||
    metaBody.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) metaBody = articleMatch[1];

  const metaText = unescapeHtml(metaBody.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

  // Song name
  const songMatch = metaText.match(/Song\s*:\s*([^\n]+?)(?:\s{2,}|Singer|Music|Lyrics|Movie|$)/);
  if (songMatch) {
    const songName = songMatch[1].trim();
    if (songName && songName.length < 100) cleanTitle = songName;
  }

  // Singer
  const singerMatch = metaText.match(/Singer\s*[-–:]\s*([^\n]+?)(?:\s{2,}|Music|Lyrics|Movie|Release|$)/);
  if (singerMatch) {
    const singer = singerMatch[1].trim();
    if (singer && singer.length < 200) info.push(`Singer: ${singer}`);
  }

  // Music
  const musicMatch = metaText.match(/Music\s*[-–:]\s*([^\n]+?)(?:\s{2,}|Lyrics|Movie|Release|$)/);
  if (musicMatch) {
    const music = musicMatch[1].trim();
    if (music && music.length < 100) info.push(`Music: ${music}`);
  }

  // Lyrics
  const lyricsMatch = metaText.match(/Lyrics\s*[-–:]\s*([^\n]+?)(?:\s{2,}|Movie|Release|$)/);
  if (lyricsMatch) {
    const lyricist = lyricsMatch[1].trim();
    if (lyricist && lyricist.length < 100) info.push(`Lyricist: ${lyricist}`);
  }

  // Movie
  const movieMatch = metaText.match(/Movie\s*:\s*([^\n]+?)(?:\s{2,}|Release|Singer|Scale|$)/);
  if (movieMatch) {
    const movie = movieMatch[1].trim().replace(/\u00a0/g, " ").trim();
    if (movie && movie.length < 100) info.push(`Movie: ${movie}`);
  }

  // Original Scale
  const scaleMatch = metaText.match(/Original\s+Scale\s*[-–:]\s*(\w+)/);
  if (scaleMatch) {
    const scale = scaleMatch[1].trim();
    if (scale) info.push(`Scale: ${scale}`);
  }

  return { cleanTitle, info };
}

// ---------------------------------------------------------------------------
// Pair lyrics & notation
// ---------------------------------------------------------------------------

function pairLyricsAndNotation(
  lines: string[],
  keepSymbolic: boolean
): SongSection[] {
  const sections: SongSection[] = [];
  let currentSection: SongSection = { name: "STHAYI", lines: [] };
  sections.push(currentSection);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (isSectionHeader(line)) {
      currentSection = { name: line.trim().toUpperCase(), lines: [] };
      sections.push(currentSection);
      i++;
      continue;
    }

    if (isLyricsLine(line)) {
      const lyrics = line;
      let indian = "";

      if (i + 1 < lines.length && isSargamLine(lines[i + 1])) {
        indian = keepSymbolic
          ? normalizeNotationSymbolic(lines[i + 1])
          : normalizeNotation(lines[i + 1]);
        i += 2;
      } else {
        i++;
      }

      currentSection.lines.push({ lyrics, indian });
      continue;
    }

    if (isSargamLine(line)) {
      const indian = keepSymbolic
        ? normalizeNotationSymbolic(line)
        : normalizeNotation(line);
      currentSection.lines.push({ lyrics: "", indian });
      i++;
      continue;
    }

    // Unknown line — skip
    i++;
  }

  // Remove empty sections
  const filtered = sections.filter((s) => s.lines.length > 0);

  if (filtered.length === 1 && !filtered[0].name) {
    filtered[0].name = "STHAYI";
  }

  return filtered;
}

// ---------------------------------------------------------------------------
// Main extraction
// ---------------------------------------------------------------------------

export interface ScrapeResult {
  song: Song;
  rawLineCount: number;
}

export async function extractSongFromUrl(
  url: string,
  options?: { songId?: string; songTitle?: string }
): Promise<ScrapeResult> {
  const rawHtml = await fetchHtml(url);
  const host = new URL(url).hostname.toLowerCase();
  const isNotesAndSargam = host.includes("notesandsargam.com");
  const isSangeetbook = host.includes("sangeetbook.com");

  const pageTitle = extractTitleFromHtml(rawHtml);
  let lines: string[];
  if (isSangeetbook) {
    lines = sangeetbookHtmlToLines(rawHtml);
  } else if (isNotesAndSargam) {
    lines = notesandsargamHtmlToLines(rawHtml);
  } else {
    lines = htmlToLines(rawHtml);
  }

  let cleanTitle: string;
  let info: string[];
  if (isSangeetbook) {
    ({ cleanTitle, info } = extractSangeetbookMetadata(rawHtml, pageTitle));
  } else {
    ({ cleanTitle, info } = extractMetadata(pageTitle, lines));
  }

  const title = options?.songTitle || cleanTitle;
  const songId = options?.songId || slugify(title);

  info.push(`Source: ${url}`);

  // Filter content lines
  let contentLines: string[];

  if (isSangeetbook) {
    // sangeetbook.com English Lyrics section
    let startIdx: number | null = null;
    for (let idx = 0; idx < lines.length; idx++) {
      if (isSectionHeader(lines[idx])) {
        startIdx = idx;
        break;
      }
    }
    if (startIdx === null) {
      for (let idx = 0; idx < lines.length; idx++) {
        if (isSargamLine(lines[idx])) {
          startIdx =
            idx > 0 && isLyricsLine(lines[idx - 1]) ? idx - 1 : idx;
          break;
        }
      }
    }
    const scanLines = startIdx !== null ? lines.slice(startIdx) : lines;
    contentLines = scanLines.filter(
      (l) =>
        !isSkipLine(l) &&
        !isProseParagraph(l) &&
        !/\.\.\.\s*same\s+as\b/i.test(l) &&
        !/उपर्युक्त\s+पंक्ति\s+के\s+समान/.test(l)
    );
  } else if (isNotesAndSargam) {
    let startIdx: number | null = null;
    for (let idx = 0; idx < lines.length; idx++) {
      if (isSectionHeader(lines[idx])) {
        startIdx = idx;
        break;
      }
    }
    // If no section header found, start from first notation line
    if (startIdx === null) {
      for (let idx = 0; idx < lines.length; idx++) {
        if (isSargamLine(lines[idx])) {
          startIdx =
            idx > 0 && isLyricsLine(lines[idx - 1]) ? idx - 1 : idx;
          break;
        }
      }
    }
    const scanLines = startIdx !== null ? lines.slice(startIdx) : lines;
    contentLines = scanLines.filter(
      (l) => !isSkipLine(l) && !isProseParagraph(l)
    );
  } else {
    contentLines = [];
    let inContent = false;
    for (const line of lines) {
      if (isSkipLine(line)) {
        if (inContent && /Also Read|You May Also Like/i.test(line)) break;
        continue;
      }
      if (!inContent) {
        if (isSargamLine(line) || isLyricsLine(line) || isSectionHeader(line)) {
          inContent = true;
        } else {
          continue;
        }
      }
      if (inContent) contentLines.push(line);
    }
  }

  const sections = pairLyricsAndNotation(
    contentLines,
    isNotesAndSargam || isSangeetbook
  );

  const song: Song = {
    id: songId,
    title,
    export: true,
    info,
    thumbnail: `images/${songId}.png`,
    background: `images/${songId}.png`,
    sections,
  };

  return { song, rawLineCount: lines.length };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "song"
  );
}

function unescapeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&nbsp;/g, " ");
}
