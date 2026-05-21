"use client";

/**
 * OsmdRenderer
 * ────────────
 * Renders MusicXML using OpenSheetMusicDisplay (OSMD).
 *
 * Fetches the song's MusicXML from GET /api/musicxml/[id].
 * If the file has not been pre-generated, shows a friendly message explaining
 * how to generate it via scrape_musicxml.py.
 *
 * OSMD renders into a parent-supplied `containerRef` div.
 */

import { useEffect } from "react";
import type { RendererProps } from "@/lib/sheetMusicConfig";

// Error shown when MusicXML hasn't been generated yet
const NOT_FOUND_HTML = (songId: string) => `
  <div style="padding:16px 20px;font-family:system-ui,sans-serif;color:#92400e;
       background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px;line-height:1.6">
    <strong>MusicXML not yet generated for this song.</strong><br/>
    To render with OSMD, generate the file first:<br/>
    <code style="display:inline-block;margin-top:6px;padding:4px 8px;background:#fef3c7;
          border-radius:4px;font-size:12px">
      python scripts/scrape_musicxml.py --generate --id ${songId}
    </code><br/>
    <span style="margin-top:6px;display:inline-block;color:#78350f;font-size:11px">
      Or run <code>--generate-all</code> to generate for every song at once.
    </span>
  </div>
`;

export default function OsmdRenderer({ song, containerRef, onReady, onError }: RendererProps) {
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let osmdInstance: any = null;

    (async () => {
      try {
        // 1. Fetch MusicXML from the API route
        const res = await fetch(`/api/musicxml/${song.id}`);

        if (cancelled) return;

        if (res.status === 404) {
          if (containerRef.current) {
            containerRef.current.innerHTML = NOT_FOUND_HTML(song.id);
          }
          onReady(); // "ready" in the sense that we've handled the state
          return;
        }

        if (!res.ok) {
          throw new Error(`Failed to load MusicXML: HTTP ${res.status}`);
        }

        const xmlString = await res.text();
        if (cancelled) return;

        // 2. Lazy-load OSMD (browser only, ~400 KB)
        const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");
        if (cancelled || !containerRef.current) return;

        // 3. Instantiate and render
        osmdInstance = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          backend: "svg",
          drawTitle: true,
          drawComposer: false,
          drawCredits: false,
          drawLyrics: true,
          drawMetronomeMarks: false,
          followCursor: false,
        });

        await osmdInstance.load(xmlString);
        if (cancelled) return;

        osmdInstance.render();
        if (!cancelled) onReady();
      } catch (err) {
        if (!cancelled) {
          console.error("[OsmdRenderer] render error:", err);
          onError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        osmdInstance?.clear();
      } catch {
        // ignore cleanup errors
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, containerRef, onReady, onError]);

  return null;
}
