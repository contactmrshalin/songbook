import type { Song } from "@/types/song";

export const dynamic = "force-dynamic";
// Extend Vercel function timeout to 60 s (Pro plan) so retries have room to breathe.
// On Hobby (10 s cap) the function may still time out during heavy Gemini demand —
// the user will just see "Try again" which is the right behaviour.
export const maxDuration = 60;

// Mirror of extractMeta in SongViewer — determines which fields are already present
function extractMeta(info: string[]): Record<string, string> {
  const meta: Record<string, string> = {};
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

/**
 * POST /api/admin/enrich
 * Body: { song: Song, password: string }
 *
 * Uses Google Gemini to:
 *   1. Fill in any missing song metadata (movie, singer, music director, etc.)
 *   2. Generate an engaging description of the song
 *   3. Generate 3–4 interesting trivia facts
 *
 * Returns:
 *   { success: true, newFields: string[], description: string, trivia: string[] }
 *
 * Requires env var: GOOGLE_AI_API_KEY
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { song, password } = body as { song?: Song; password?: string };

    // Auth
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || password !== adminPassword) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!song?.title) {
      return Response.json({ error: "song.title is required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return Response.json(
        {
          error:
            "GOOGLE_AI_API_KEY is not configured. Add it to your Vercel / .env.local environment variables.",
        },
        { status: 503 }
      );
    }

    // Determine which metadata fields are missing
    const existing = extractMeta(song.info);
    const missingMeta: string[] = [];
    if (!existing.movie) missingMeta.push("movie");
    if (!existing.singer) missingMeta.push("singer");
    if (!existing.music) missingMeta.push("music");
    if (!existing.lyrics) missingMeta.push("lyrics");
    if (!existing.raag) missingMeta.push("raag");
    if (!existing.thaat) missingMeta.push("thaat");
    if (!existing.year) missingMeta.push("year");

    const needsDescription = !song.description;
    const needsTrivia = !song.trivia || song.trivia.length === 0;

    if (missingMeta.length === 0 && !needsDescription && !needsTrivia) {
      return Response.json({
        success: true,
        newFields: [],
        description: null,
        trivia: null,
        message: "All fields already present — nothing to enrich.",
      });
    }

    const prompt = buildPrompt(song.title, song.info, missingMeta, needsDescription, needsTrivia);

    // gemini-2.5-flash: current-gen model available to all accounts on v1beta.
    // gemini-2.0-flash-lite is retired for new accounts; gemini-flash-latest may still work for older ones.
    // Override via GEMINI_MODEL env var in Vercel / local .env.local if needed.
    const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    const geminiData = await callGeminiWithRetry(apiKey, GEMINI_MODEL, prompt);
    if ("error" in geminiData) {
      return Response.json(geminiData, { status: 502 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawText: string = (geminiData as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Parse JSON response
    let parsed: Record<string, unknown> = {};
    try {
      const cleaned = rawText.replace(/```(?:json)?/gi, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return Response.json(
        { error: `Could not parse Gemini response as JSON: ${rawText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    // Build new info lines from non-null metadata fields
    const labelMap: Record<string, string> = {
      movie: "Film",
      singer: "Singer",
      music: "Music",
      lyrics: "Lyrics",
      raag: "Raag",
      thaat: "Thaat",
      year: "Year",
    };

    const newFields: string[] = [];
    for (const key of missingMeta) {
      const value = parsed[key];
      if (!value || typeof value !== "string" || !value.trim()) continue;
      // Skip year if it's already embedded in the movie line (avoid duplication)
      if (key === "year" && typeof parsed.movie === "string" && parsed.movie.includes(value)) continue;
      const label = labelMap[key] ?? key;
      newFields.push(`${label}: ${value.trim()}`);
    }

    const description =
      needsDescription && typeof parsed.description === "string" && parsed.description.trim()
        ? parsed.description.trim()
        : null;

    const trivia =
      needsTrivia && Array.isArray(parsed.trivia)
        ? (parsed.trivia as unknown[])
            .filter((f): f is string => typeof f === "string" && f.trim().length > 0)
            .map((f) => f.trim())
            .slice(0, 4)
        : null;

    return Response.json({ success: true, newFields, description, trivia });
  } catch (err) {
    console.error("[enrich]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Call Gemini with up to 3 retries on quota/rate-limit errors (429 / 503).
 * Always uses v1beta — systemInstruction and responseMimeType are v1beta-only features.
 * Returns the parsed JSON response body, or an { error } object on failure.
 */
async function callGeminiWithRetry(
  apiKey: string,
  model: string,
  prompt: string,
  maxRetries = 3
): Promise<Record<string, unknown>> {
  // Always v1beta: systemInstruction + responseMimeType are only supported there.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) return await res.json();

    const isQuota = res.status === 429 || res.status === 503;
    const errText = await res.text();

    if (isQuota && attempt < maxRetries) {
      // Short back-off (1 s, 3 s) — keeps total wait well under Vercel's 60 s limit.
      // The local batch script uses its own longer delays; this route prioritises
      // staying alive within the serverless timeout.
      const waitMs = 1000 * Math.pow(3, attempt - 1); // 1 s, 3 s
      console.warn(`[enrich] Quota/overload (${res.status}), waiting ${waitMs / 1000}s before retry ${attempt}/${maxRetries}`);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    // Extract Google's own reason string from the error body for better diagnostics
    let googleReason = "";
    try {
      const errJson = JSON.parse(errText);
      googleReason = errJson?.error?.message ?? errJson?.error?.status ?? "";
    } catch {
      googleReason = errText.slice(0, 120);
    }

    let friendlyMsg: string;
    if (res.status === 429) {
      // Google distinguishes RATE_LIMIT_EXCEEDED (per-minute) vs RESOURCE_EXHAUSTED (daily)
      const isPerMinute = googleReason.toLowerCase().includes("rate") ||
        googleReason.toLowerCase().includes("per minute");
      friendlyMsg = isPerMinute
        ? `Gemini rate limit hit (too many requests per minute) — wait 60 s then try again. [${googleReason}]`
        : `Gemini daily quota exceeded — wait until midnight Pacific time or add a paid billing account. [${googleReason}]`;
    } else if (res.status === 503) {
      friendlyMsg = `Gemini is overloaded right now — please try again in a few seconds. [${googleReason}]`;
    } else {
      friendlyMsg = `Gemini API error ${res.status}: ${googleReason}`;
    }

    return { error: friendlyMsg };
  }

  return { error: "Gemini API: max retries exceeded" };
}

const SYSTEM_PROMPT = `You are an expert musicologist and writer specialising in Indian film music (Bollywood) and Indian classical music.

Your job is to provide accurate metadata and engaging content about songs. Follow these rules strictly:
- Return ONLY a valid JSON object — no prose, no markdown, no code fences.
- For factual metadata (movie, singer, etc.): if you are not highly confident, return null. Do NOT guess.
- For raag/thaat: only fill if the song has a clear classical or semi-classical raga basis. Western-influenced pop songs should get null.
- movie: include release year in parentheses e.g. "Dil Chahta Hai (2001)"
- singer: comma-separated if multiple artists
- music: music director(s), comma-separated
- lyrics: lyricist(s), comma-separated
- description: 2–3 engaging sentences about the song's significance, mood, and musical style. Make it interesting for a learner.
- trivia: array of 3–4 genuinely interesting facts. Can include: historical context, recording stories, musical techniques, awards, cultural impact, connection to classical music.`;

function buildPrompt(
  title: string,
  info: string[],
  missingMeta: string[],
  needsDescription: boolean,
  needsTrivia: boolean
): string {
  const lines: string[] = [];
  lines.push(`Song title: "${title}"`);

  if (info.length > 0) {
    lines.push("Already known:");
    info.forEach((l) => lines.push(`  ${l}`));
  } else {
    lines.push("Already known: (none)");
  }

  lines.push("");

  const needed: string[] = [...missingMeta];
  if (needsDescription) needed.push("description");
  if (needsTrivia) needed.push("trivia (array of strings)");

  lines.push(`Please provide: ${needed.join(", ")}`);
  lines.push("");
  lines.push(
    `Return a JSON object with keys: ${[...missingMeta, ...(needsDescription ? ["description"] : []), ...(needsTrivia ? ["trivia"] : [])].join(", ")}`
  );
  lines.push(`For any metadata key you are unsure about, set it to null.`);

  return lines.join("\n");
}
