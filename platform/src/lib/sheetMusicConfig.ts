/**
 * sheetMusicConfig.ts
 * ───────────────────
 * Renderer type definitions and runtime/build-time config for the sheet music
 * viewer.
 *
 * Renderer selection order (first match wins):
 *   1. URL query param  ?renderer=<type>   — runtime, for testing without rebuild
 *   2. NEXT_PUBLIC_SHEET_MUSIC_RENDERER    — build-time env var (baked into bundle)
 *   3. Default: "abc"                      — abcjs, works for all 167 songs with
 *                                            zero pre-generation needed
 *
 * ⚠ NEXT_PUBLIC_* env vars are baked into the JS bundle at `next build`.
 *   Changing the env var requires a rebuild to take effect in production.
 *   The ?renderer= URL param is the recommended way to switch renderers at
 *   runtime (e.g. in staging / dev) without a rebuild.
 *
 * Renderer capabilities:
 *   abc     — Converts sargam → ABC notation on-the-fly via toAbc.ts.
 *             Works for every song immediately. No pre-generated files needed.
 *             Rendered by abcjs (already in package.json).
 *
 *   osmd    — Renders MusicXML natively via OpenSheetMusicDisplay.
 *             Requires a pre-generated .musicxml file fetched from
 *             GET /api/musicxml/[id].
 *             Shows a user-friendly "run the scraper" message on 404.
 *
 *   verovio — Renders MusicXML via Verovio WASM (~5 MB download).
 *             Same /api/musicxml/[id] requirement as osmd.
 *             Higher fidelity output but larger bundle.
 */

export type RendererType = "abc" | "osmd" | "verovio";

const VALID_RENDERERS = new Set<string>(["abc", "osmd", "verovio"]);

function parseRenderer(raw: string | null | undefined): RendererType | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  return VALID_RENDERERS.has(lower) ? (lower as RendererType) : null;
}

/**
 * Returns the active renderer type.
 *
 * Call this only in the browser — it reads `window.location.search` for the
 * URL-param override.  In SSR contexts abcjs is always used (the SheetMusicViewer
 * starts collapsed so the renderer is never invoked server-side).
 */
export function getRenderer(): RendererType {
  // 1. URL param (runtime override — works without rebuild)
  if (typeof window !== "undefined") {
    const param = new URLSearchParams(window.location.search).get("renderer");
    const fromUrl = parseRenderer(param);
    if (fromUrl) return fromUrl;
  }

  // 2. Build-time env var
  const fromEnv = parseRenderer(process.env.NEXT_PUBLIC_SHEET_MUSIC_RENDERER);
  if (fromEnv) return fromEnv;

  // 3. Default
  return "abc";
}

/**
 * Props passed to every renderer component.
 *
 * The renderer MUST:
 *   - Render `null` (no JSX output of its own)
 *   - Write its SVG/canvas/div content into `containerRef.current`
 *   - Call `onReady()` once rendering is complete
 *   - Call `onError(message)` on failure
 *   - Clean up (clear the container, destroy instances) on unmount via useEffect
 */
export interface RendererProps {
  /** The song to render */
  song: import("@/types/song").Song;
  /** The div element to render into */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Called when rendering succeeds */
  onReady: () => void;
  /** Called with a human-readable error string on failure */
  onError: (msg: string) => void;
}
