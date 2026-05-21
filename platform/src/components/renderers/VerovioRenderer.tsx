"use client";

/**
 * VerovioRenderer
 * ───────────────
 * Renders MusicXML using Verovio via its pre-built UMD bundle.
 *
 * Why not a direct npm import?
 * ----------------------------
 * Verovio is an Emscripten-compiled WASM library. Its JS entry files contain
 * Node.js-specific code paths (`require("fs")`, `require("path")`,
 * `new URL("./", import.meta.url)`) that Turbopack and webpack try to resolve
 * at build time, even though they are never executed in the browser.
 *
 * Solution: the pre-built UMD bundle (`verovio-toolkit-wasm.js`) is copied to
 * `public/verovio/` by `scripts/prebuild.mjs` and served as a static asset.
 * We inject a `<script>` tag at runtime to load it, completely bypassing the
 * bundler.  The UMD wrapper sets `window.verovio = factory()`.
 *
 * Fetch the song's MusicXML from GET /api/musicxml/[id].
 * If not yet pre-generated, shows a friendly guidance message.
 *
 * Usage: enabled via ?renderer=verovio URL param or
 *        NEXT_PUBLIC_SHEET_MUSIC_RENDERER=verovio env var.
 */

import { useEffect } from "react";
import type { RendererProps } from "@/lib/sheetMusicConfig";

// ── Types for the Verovio global ─────────────────────────────────────────────
interface VerovioOptions {
  pageWidth?: number;
  pageHeight?: number;
  scale?: number;
  adjustPageHeight?: number | boolean;
  breaks?: "auto" | "encoded" | "line" | "smart" | "none";
  svgViewBox?: number | boolean;
  [key: string]: unknown;
}

interface VerovioToolkit {
  setOptions(options: VerovioOptions): void;
  loadData(data: string): boolean;
  getPageCount(): number;
  renderToSVG(page: number): string;
}

interface VerovioGlobal {
  module: {
    calledRun?: boolean;
    onRuntimeInitialized?: () => void;
  };
  toolkit: new () => VerovioToolkit;
}

declare global {
  interface Window {
    verovio?: VerovioGlobal;
  }
}

// ── Not-found message ─────────────────────────────────────────────────────────
const NOT_FOUND_HTML = (songId: string) => `
  <div style="padding:16px 20px;font-family:system-ui,sans-serif;color:#92400e;
       background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px;line-height:1.6">
    <strong>MusicXML not yet generated for this song.</strong><br/>
    To render with Verovio, generate the file first:<br/>
    <code style="display:inline-block;margin-top:6px;padding:4px 8px;background:#fef3c7;
          border-radius:4px;font-size:12px">
      python scripts/scrape_musicxml.py --generate --id ${songId}
    </code><br/>
    <span style="margin-top:6px;display:inline-block;color:#78350f;font-size:11px">
      Or run <code>--generate-all</code> to generate for every song at once.
    </span>
  </div>
`;

// ── Script loader (singleton) ─────────────────────────────────────────────────
let scriptLoadPromise: Promise<void> | null = null;

function loadVerovioScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    // Already loaded (e.g. hot-reload)
    if (window.verovio?.module) {
      resolve();
      return;
    }

    const existing = document.querySelector('script[src="/verovio/verovio-toolkit-wasm.js"]');
    if (existing) {
      // Script tag exists but may not have finished — wait for verovio global
      waitForVerovio(resolve, reject);
      return;
    }

    const script = document.createElement("script");
    script.src = "/verovio/verovio-toolkit-wasm.js";
    script.async = true;
    script.onload = () => waitForVerovio(resolve, reject);
    script.onerror = () => reject(new Error("Failed to load Verovio script from /verovio/verovio-toolkit-wasm.js"));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

function waitForVerovio(resolve: () => void, reject: (e: Error) => void, attempts = 0): void {
  const MAX_ATTEMPTS = 100; // 10 seconds max

  // Only resolve after WASM is fully initialized (calledRun = true).
  // Do NOT resolve on window.verovio.toolkit alone — the constructor is set
  // synchronously when the UMD script loads but before the WASM module has
  // finished initializing; calling new toolkit() too early will fail.
  if (window.verovio?.module?.calledRun) {
    resolve();
    return;
  }

  if (window.verovio?.module) {
    // Module object exists but WASM hasn't finished yet — hook the callback
    const m = window.verovio.module;
    const prev = m.onRuntimeInitialized;
    m.onRuntimeInitialized = function () {
      if (typeof prev === "function") prev();
      resolve();
    };
    return;
  }

  // Script not yet finished loading — poll
  if (attempts >= MAX_ATTEMPTS) {
    reject(new Error("Timed out waiting for Verovio WASM to initialize"));
    return;
  }
  setTimeout(() => waitForVerovio(resolve, reject, attempts + 1), 100);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function VerovioRenderer({ song, containerRef, onReady, onError }: RendererProps) {
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    let toolkit: VerovioToolkit | null = null;

    (async () => {
      try {
        // 1. Fetch MusicXML
        const res = await fetch(`/api/musicxml/${song.id}`);
        if (cancelled) return;

        if (res.status === 404) {
          if (containerRef.current) containerRef.current.innerHTML = NOT_FOUND_HTML(song.id);
          onReady();
          return;
        }
        if (!res.ok) throw new Error(`Failed to load MusicXML: HTTP ${res.status}`);

        const xmlString = await res.text();
        if (cancelled) return;

        // 2. Load Verovio UMD bundle from public/verovio/ via <script> tag
        await loadVerovioScript();
        if (cancelled || !window.verovio) return;

        // 3. Create toolkit instance
        toolkit = new window.verovio.toolkit();

        toolkit.setOptions({
          pageWidth: 1600,
          pageHeight: 2970,
          scale: 40,
          adjustPageHeight: 1,
          breaks: "auto",
          svgViewBox: 1,
        });

        // 4. Load MusicXML and render all pages
        toolkit.loadData(xmlString);
        const pageCount = toolkit.getPageCount();

        if (!containerRef.current || cancelled) return;

        containerRef.current.innerHTML = "";
        for (let page = 1; page <= pageCount; page++) {
          if (cancelled) return;
          const svgString = toolkit.renderToSVG(page);
          const wrapper = document.createElement("div");
          wrapper.style.maxWidth = "100%";
          wrapper.style.overflowX = "auto";
          wrapper.innerHTML = svgString;
          containerRef.current.appendChild(wrapper);
        }

        if (!cancelled) onReady();
      } catch (err) {
        if (!cancelled) {
          console.error("[VerovioRenderer] error:", err);
          onError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
      toolkit = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, containerRef, onReady, onError]);

  return null;
}
