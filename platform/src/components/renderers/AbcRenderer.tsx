"use client";

/**
 * AbcRenderer
 * ───────────
 * Converts the song's sargam notation to ABC notation on-the-fly via toAbc.ts,
 * then renders it as SVG into `containerRef` using abcjs.
 *
 * This renderer works for ALL songs immediately — no pre-generated files needed.
 */

import { useEffect } from "react";
import type { RendererProps } from "@/lib/sheetMusicConfig";
import { songToAbc } from "@/lib/toAbc";

export default function AbcRenderer({ song, containerRef, onReady, onError }: RendererProps) {
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        // abcjs is browser-only; lazy import avoids SSR issues.
        // Handle both ESM (named export on namespace) and CJS (on .default).
        const abcModule = await import("abcjs");
        if (cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod = abcModule as any;
        const renderAbc: typeof import("abcjs").renderAbc =
          typeof mod.renderAbc === "function"
            ? mod.renderAbc
            : mod.default?.renderAbc;

        if (typeof renderAbc !== "function") {
          throw new Error(
            "abcjs.renderAbc is not available — check the abcjs package version."
          );
        }

        if (!containerRef.current || cancelled) return;

        const abcString = songToAbc(song);

        renderAbc(containerRef.current, abcString, {
          responsive: "resize",
          add_classes: true,
          staffwidth: 680,
          scale: 1.1,
          paddingright: 16,
          paddingleft: 0,
          paddingbottom: 20,
          oneSvgPerLine: false,
          format: {
            titlefont: '"Georgia" 14',
            subtitlefont: '"Georgia" 11',
            gchordfont: '"Verdana" 10',
            annotationfont: '"Verdana" 10',
            wordsfont: '"Verdana" 9',
            composerfont: '"Verdana" 10',
          },
        });

        if (!cancelled) onReady();
      } catch (err) {
        if (!cancelled) {
          console.error("[AbcRenderer] render error:", err);
          onError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
      // Clear the container so a fresh render can happen next time
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
    // Re-render whenever the song changes (song.id as stable key is handled by
    // SheetMusicViewer resetting the component via `key` prop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, containerRef, onReady, onError]);

  // Renders nothing — all output goes into containerRef
  return null;
}
