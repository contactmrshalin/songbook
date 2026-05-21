"use client";

/**
 * SheetMusicViewer
 * ─────────────────
 * Collapsible panel that renders a song's sheet music using one of three
 * pluggable renderers, selected via env var or URL param:
 *
 *   abc     (default) — abcjs, converts sargam on-the-fly, works immediately
 *   osmd              — OpenSheetMusicDisplay, requires MusicXML pre-generation
 *   verovio           — Verovio WASM, highest fidelity, requires MusicXML
 *
 * Renderer selection (first match wins):
 *   ?renderer=<type>                    URL param — runtime override
 *   NEXT_PUBLIC_SHEET_MUSIC_RENDERER    build-time env var
 *   default: "abc"
 *
 * Architecture:
 *   - This component owns the `containerRef` div that renderers write into.
 *   - Renderer components are loaded via React.lazy so only the active renderer
 *     is bundled/fetched — OSMD (~400 KB) and Verovio WASM (~5 MB) are NOT
 *     loaded unless explicitly selected.
 *   - Each renderer receives { song, containerRef, onReady, onError } and
 *     renders `null` (all output goes into containerRef via useEffect).
 *   - The renderer is remounted (via `key={song.id}`) when the song changes,
 *     triggering cleanup → fresh render automatically.
 */

import {
  lazy,
  Suspense,
  useCallback,
  useRef,
  useState,
  useEffect,
} from "react";
import {
  Music,
  ChevronDown,
  ChevronUp,
  Download,
  Printer,
  AlertCircle,
} from "lucide-react";
import type { Song } from "@/types/song";
import { getRenderer, type RendererType } from "@/lib/sheetMusicConfig";

// ── Lazy renderer imports ─────────────────────────────────────────────────────
// Only the selected renderer is ever loaded by the browser.
const LazyAbcRenderer = lazy(() => import("./renderers/AbcRenderer"));
const LazyOsmdRenderer = lazy(() => import("./renderers/OsmdRenderer"));
const LazyVerovioRenderer = lazy(() => import("./renderers/VerovioRenderer"));

function getRendererComponent(type: RendererType) {
  switch (type) {
    case "osmd":
      return LazyOsmdRenderer;
    case "verovio":
      return LazyVerovioRenderer;
    case "abc":
    default:
      return LazyAbcRenderer;
  }
}

// ── Renderer badge label ──────────────────────────────────────────────────────
const RENDERER_LABELS: Record<RendererType, string> = {
  abc: "abcjs",
  osmd: "OSMD",
  verovio: "Verovio",
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface SheetMusicViewerProps {
  song: Song;
  /** Start expanded (default: false — starts collapsed) */
  defaultOpen?: boolean;
  /**
   * Inline mode — skips the collapsible panel chrome and renders the sheet
   * music directly (used when "Sheet" is the active notation mode).
   * When true the component is always open and starts loading immediately.
   */
  alwaysOpen?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SheetMusicViewer({
  song,
  defaultOpen = false,
  alwaysOpen = false,
}: SheetMusicViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // In alwaysOpen mode we're always open; otherwise respect defaultOpen.
  const [isOpen, setIsOpen] = useState(alwaysOpen || defaultOpen);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    alwaysOpen ? "loading" : "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");

  // Read renderer type synchronously on client to avoid a flicker of the badge.
  // Guard with typeof window so SSR renders "abc" without crashing.
  const [rendererType] = useState<RendererType>(() => {
    if (typeof window === "undefined") return "abc";
    return getRenderer();
  });

  // Reset to loading state when the song changes while the panel is open
  // (the renderer remounts via key={song.id} which triggers cleanup + fresh render)
  useEffect(() => {
    if (isOpen) {
      setStatus("loading");
      setErrorMsg("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id]);

  // Stable callbacks passed to renderer components
  const handleReady = useCallback(() => setStatus("ready"), []);
  const handleError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setStatus("error");
  }, []);

  // ── Toggle ──────────────────────────────────────────────────────────────────
  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next && status === "idle") {
        setStatus("loading");
      }
      return next;
    });
  };

  // Transition from idle → loading when panel opens
  useEffect(() => {
    if (isOpen && status === "idle") {
      setStatus("loading");
    }
  }, [isOpen, status]);

  // ── Download MusicXML ───────────────────────────────────────────────────────
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement("a");
    link.href = `/api/musicxml/${song.id}`;
    link.download = `${song.id}.musicxml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Print ───────────────────────────────────────────────────────────────────
  const handlePrint = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>${song.title} – Sheet Music</title>
      <style>
        body { margin: 20px; font-family: Georgia, serif; }
        h1   { font-size: 18px; margin-bottom: 4px; }
        p    { font-size: 11px; color: #666; margin: 0 0 16px; }
        svg  { max-width: 100%; }
      </style></head>
      <body>
        <h1>${song.title}</h1>
        <p>Sheet music generated from sargam notation • Songbook Pipeline</p>
        ${containerRef.current.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // ── Active renderer component ───────────────────────────────────────────────
  const RendererComponent = getRendererComponent(rendererType);

  // ── Action buttons shared between header and inline toolbar ───────────────
  const actionButtons = (
    <>
      {/* Download MusicXML — visible when song has a pre-generated file */}
      {song.musicxml && (
        <span
          onClick={handleDownload}
          role="button"
          tabIndex={0}
          onKeyDown={(e) =>
            e.key === "Enter" && handleDownload(e as unknown as React.MouseEvent)
          }
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium
                     bg-[var(--bg-secondary)] text-[var(--text-secondary)]
                     hover:bg-[var(--accent-primary)] hover:text-white transition-colors cursor-pointer"
          title="Download MusicXML (opens in MuseScore / Finale / Sibelius)"
        >
          <Download className="w-3 h-3" />
          <span className="hidden sm:inline">.musicxml</span>
        </span>
      )}

      {/* Print — only available once rendered */}
      {status === "ready" && (
        <span
          onClick={handlePrint}
          role="button"
          tabIndex={0}
          onKeyDown={(e) =>
            e.key === "Enter" && handlePrint(e as unknown as React.MouseEvent)
          }
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium
                     bg-[var(--bg-secondary)] text-[var(--text-secondary)]
                     hover:bg-[var(--accent-primary)] hover:text-white transition-colors cursor-pointer"
          title="Print sheet music"
        >
          <Printer className="w-3 h-3" />
          <span className="hidden sm:inline">Print</span>
        </span>
      )}
    </>
  );

  // ── alwaysOpen / inline mode ────────────────────────────────────────────────
  if (alwaysOpen) {
    return (
      <div className="rounded-2xl border border-[var(--border-light)] overflow-hidden shadow-sm mb-6">
        {/* Slim toolbar — renderer badge + actions, no toggle */}
        <div
          className="flex items-center justify-between gap-2 px-5 py-2.5
                     border-b border-[var(--border-light)]"
          style={{
            background:
              "linear-gradient(135deg, rgba(108,99,255,0.07) 0%, rgba(255,101,132,0.04) 100%)",
          }}
        >
          <div className="flex items-center gap-2">
            <Music className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Sheet Music
            </span>
            <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded
                             bg-[var(--bg-secondary)] text-[var(--text-muted)] font-mono">
              {RENDERER_LABELS[rendererType]}
            </span>
          </div>
          <div className="flex items-center gap-2">{actionButtons}</div>
        </div>

        {/* Content */}
        <div className="bg-white overflow-x-auto">
          {status === "loading" && (
            <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
              <span
                className="animate-spin inline-block w-4 h-4 border-2 border-gray-300
                           border-t-[var(--accent-primary)] rounded-full"
              />
              Loading sheet music…
            </div>
          )}

          {status === "error" && (
            <div className="flex items-start gap-2 m-4 p-3 rounded-lg bg-red-50 text-red-600 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Could not render sheet music</p>
                {errorMsg && <p className="mt-0.5 text-red-500">{errorMsg}</p>}
              </div>
            </div>
          )}

          <div
            ref={containerRef}
            className="p-4 min-w-0 w-full"
            style={{ minHeight: status === "ready" ? undefined : "0px" }}
          />

          <Suspense fallback={null}>
            <RendererComponent
              key={song.id}
              song={song}
              containerRef={containerRef}
              onReady={handleReady}
              onError={handleError}
            />
          </Suspense>

          {status === "ready" && rendererType === "abc" && (
            <p className="px-4 pb-3 text-[10px] text-gray-400">
              Notes shown in C major (Sa = C). Scale transposition is decorative —
              actual key depends on the singer&apos;s pitch.
              {song.musicxml && (
                <>
                  {" "}
                  Download the{" "}
                  <button
                    onClick={handleDownload}
                    className="underline hover:text-gray-600 cursor-pointer"
                  >
                    .musicxml file
                  </button>{" "}
                  to open in MuseScore, Finale, or Sibelius.
                </>
              )}
            </p>
          )}

          {status === "ready" && rendererType !== "abc" && (
            <p className="px-4 pb-3 text-[10px] text-gray-400">
              Rendered from MusicXML via {RENDERER_LABELS[rendererType]}.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Collapsible panel mode (original) ──────────────────────────────────────
  return (
    <div className="rounded-2xl border border-[var(--border-light)] overflow-hidden shadow-sm mb-6">
      {/* ── Header / toggle button ──────────────────────────────────────── */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between gap-2 px-5 py-3
                   border-b border-[var(--border-light)] transition-colors hover:brightness-95"
        style={{
          background:
            "linear-gradient(135deg, rgba(108,99,255,0.07) 0%, rgba(255,101,132,0.04) 100%)",
        }}
        aria-expanded={isOpen}
        aria-controls="sheet-music-content"
      >
        {/* Left: title + renderer badge */}
        <div className="flex items-center gap-2">
          <Music className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Sheet Music
          </span>
          <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded
                           bg-[var(--bg-secondary)] text-[var(--text-muted)] font-mono">
            {RENDERER_LABELS[rendererType]}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] hidden md:inline">
            (auto-generated from sargam)
          </span>
        </div>

        {/* Right: action buttons + chevron */}
        <div className="flex items-center gap-2">
          {actionButtons}

          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          )}
        </div>
      </button>

      {/* ── Sheet music content ─────────────────────────────────────────── */}
      {isOpen && (
        <div id="sheet-music-content" className="bg-white overflow-x-auto">
          {/* Loading state */}
          {status === "loading" && (
            <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
              <span
                className="animate-spin inline-block w-4 h-4 border-2 border-gray-300
                           border-t-[var(--accent-primary)] rounded-full"
              />
              Loading sheet music…
            </div>
          )}

          {/* Error state */}
          {status === "error" && (
            <div className="flex items-start gap-2 m-4 p-3 rounded-lg bg-red-50 text-red-600 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Could not render sheet music</p>
                {errorMsg && <p className="mt-0.5 text-red-500">{errorMsg}</p>}
              </div>
            </div>
          )}

          {/* Renderer output container — always mounted so containerRef stays valid */}
          <div
            ref={containerRef}
            className="p-4 min-w-0 w-full"
            style={{ minHeight: status === "ready" ? undefined : "0px" }}
          />

          {/* Renderer component — remounted when song changes via key prop */}
          {status !== "idle" && (
            <Suspense fallback={null}>
              <RendererComponent
                key={song.id}
                song={song}
                containerRef={containerRef}
                onReady={handleReady}
                onError={handleError}
              />
            </Suspense>
          )}

          {/* Footer hint */}
          {status === "ready" && rendererType === "abc" && (
            <p className="px-4 pb-3 text-[10px] text-gray-400">
              Notes shown in C major (Sa = C). Scale transposition is decorative —
              actual key depends on the singer&apos;s pitch.
              {song.musicxml && (
                <>
                  {" "}
                  Download the{" "}
                  <button
                    onClick={handleDownload}
                    className="underline hover:text-gray-600 cursor-pointer"
                  >
                    .musicxml file
                  </button>{" "}
                  to open in MuseScore, Finale, or Sibelius.
                </>
              )}
            </p>
          )}

          {status === "ready" && rendererType !== "abc" && (
            <p className="px-4 pb-3 text-[10px] text-gray-400">
              Rendered from MusicXML via {RENDERER_LABELS[rendererType]}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
