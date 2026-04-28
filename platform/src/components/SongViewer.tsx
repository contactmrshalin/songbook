"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Music2,
  Film,
  Mic2,
  ChevronDown,
  ChevronUp,
  Eye,
  Info,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import NotationLine from "./NotationLine";
import NotationToggle from "./NotationToggle";
import AudioPlayer from "./AudioPlayer";
import FingeringDiagram from "./FingeringDiagram";
import type { Song } from "@/types/song";

interface SongViewerProps {
  song: Song;
}

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
      else if (key.includes("raag")) meta.raag = val;
      else if (key.includes("music") || key.includes("composer")) meta.music = val;
      else if (key.includes("source")) meta.source = val;
    }
  }
  return meta;
}

export default function SongViewer({ song }: SongViewerProps) {
  const { currentNoteIndex, showFingerings, setShowFingerings } = useAppStore();
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    () => new Set(song.sections.map((_, i) => i))
  );
  const [showInfo, setShowInfo] = useState(false);
  const lineRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const meta = extractMeta(song.info);

  // Flatten lines to calculate global line index for active highlighting
  const allLines = song.sections.flatMap((section, si) =>
    section.lines.map((line, li) => ({
      line,
      sectionIndex: si,
      lineIndex: li,
      globalIndex: song.sections
        .slice(0, si)
        .reduce((sum, s) => sum + s.lines.length, 0) + li,
    }))
  );

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const setLineRef = useCallback(
    (key: string) => (el: HTMLDivElement | null) => {
      if (el) {
        lineRefs.current.set(key, el);
      } else {
        lineRefs.current.delete(key);
      }
    },
    []
  );

  // Auto-scroll to the active line during playback
  useEffect(() => {
    if (currentNoteIndex < 0) return;

    // Find which section and line index this global index maps to
    let remaining = currentNoteIndex;
    for (let si = 0; si < song.sections.length; si++) {
      const section = song.sections[si];
      if (remaining < section.lines.length) {
        const key = `${si}-${remaining}`;
        const el = lineRefs.current.get(key);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        break;
      }
      remaining -= section.lines.length;
    }
  }, [currentNoteIndex, song.sections]);

  const bgImageUrl = song.background
    ? `/song-images/${song.background.replace("images/", "")}`
    : null;

  return (
    <div className="min-h-screen flex flex-col relative isolate">
      {/* Full-page fixed background image (gh-pages style) */}
      {bgImageUrl && (
        <>
          <div
            className="fixed inset-0 z-0 pointer-events-none"
            style={{
              backgroundImage: `url('${bgImageUrl}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              opacity: 0.12,
              filter: "saturate(1.05) contrast(1.05)",
            }}
          />
          {/* Light veil for readability */}
          <div
            className="fixed inset-0 z-0 pointer-events-none"
            style={{
              background: "linear-gradient(to bottom, rgba(255,255,255,0.14), rgba(255,255,255,0.55))",
            }}
          />
        </>
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-40 glass border-b border-[var(--border-light)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Songs</span>
          </Link>

          <div className="flex items-center gap-3">
            <NotationToggle />
            <button
              onClick={() => setShowFingerings(!showFingerings)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                showFingerings
                  ? "bg-[var(--accent-primary)] text-white"
                  : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
              title="Toggle fingering diagrams"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Fingerings</span>
            </button>
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                showInfo
                  ? "bg-[var(--accent-warm)] text-white"
                  : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
              title="Song info"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Song header with background */}
      <div className="relative overflow-hidden z-[1]">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          {song.background ? (
            <Image
              src={`/song-images/${song.background.replace("images/", "")}`}
              alt=""
              fill
              className="object-cover blur-sm"
              sizes="100vw"
              unoptimized
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-[var(--bg-primary)]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-12">
          <div className="flex items-start gap-4">
            {/* Thumbnail */}
            <div className="flex-shrink-0 w-20 h-20 sm:w-28 sm:h-28 rounded-xl overflow-hidden shadow-lg">
              {song.thumbnail ? (
                <Image
                  src={`/song-images/${song.thumbnail.replace("images/", "")}`}
                  alt={song.title}
                  width={112}
                  height={112}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[var(--accent-primary)]">
                  <Music2 className="w-10 h-10 text-white/70" />
                </div>
              )}
            </div>

            {/* Title & meta */}
            <div className="flex-1 min-w-0">
              <h1
                className="text-xl sm:text-2xl font-bold text-white mb-2 leading-tight"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                {song.title}
              </h1>
              <div className="flex flex-wrap gap-3">
                {meta.movie && (
                  <span className="flex items-center gap-1.5 text-sm text-white/70">
                    <Film className="w-3.5 h-3.5" />
                    {meta.movie}
                  </span>
                )}
                {meta.singer && (
                  <span className="flex items-center gap-1.5 text-sm text-white/70">
                    <Mic2 className="w-3.5 h-3.5" />
                    {meta.singer}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {meta.scale && (
                  <span className="badge bg-white/20 text-white backdrop-blur-sm text-xs">
                    Scale: {meta.scale}
                  </span>
                )}
                {meta.raag && (
                  <span className="badge bg-white/20 text-white backdrop-blur-sm text-xs">
                    Raag: {meta.raag}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Song info panel (collapsible) */}
      {showInfo && (
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 -mt-4 mb-4 relative z-[2]">
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">
              Song Information
            </h3>
            <div className="space-y-1">
              {song.info.map((line, i) => (
                <p key={i} className="text-sm text-[var(--text-muted)]">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Notation content */}
      <main className="flex-1 max-w-4xl lg:max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 pb-32 relative z-[1]">
        {song.sections.map((section, si) => (
          <div key={si} className="mb-6">
            {/* Section header */}
            <button
              className="section-header w-full text-left flex items-center justify-between group"
              onClick={() => toggleSection(si)}
            >
              <span>{section.name}</span>
              {expandedSections.has(si) ? (
                <ChevronUp className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>

            {/* Lines */}
            {expandedSections.has(si) && (
              <div className="mt-2 space-y-1 lg:columns-2 lg:gap-x-10">
                {section.lines.map((line, li) => {
                  const globalIdx = song.sections
                    .slice(0, si)
                    .reduce((sum, s) => sum + s.lines.length, 0) + li;
                  const key = `${si}-${li}`;

                  return (
                    <div key={key} ref={setLineRef(key)} className="flex items-start gap-2 break-inside-avoid">
                      <div className="flex-1">
                        <NotationLine
                          line={line}
                          lineIndex={globalIdx}
                          isActive={currentNoteIndex === globalIdx}
                        />
                      </div>
                      {showFingerings && line.indian && (
                        <div className="flex-shrink-0 pt-1">
                          <FingeringDiagram notation={line.indian} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </main>

      {/* Audio player floating bar */}
      <AudioPlayer song={song} />
    </div>
  );
}
