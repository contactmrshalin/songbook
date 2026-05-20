"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Music2,
  Film,
  Mic2,
  Guitar,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import NotationLine from "./NotationLine";
import NotationToggle from "./NotationToggle";
import AudioPlayer from "./AudioPlayer";
import AdBanner from "./AdBanner";
import RandomSongSuggestions from "./RandomSongSuggestions";
import NotationGuideModal from "./NotationGuideModal";
import { AD_SLOTS, ADS_CONFIG } from "@/lib/ads.config";
import type { Song } from "@/types/song";

interface SongViewerProps {
  song: Song;
  otherSongs?: Song[];
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
      else if (key.includes("raag") || key.includes("raga")) meta.raag = val;
      else if (key.includes("thaat")) meta.thaat = val;
      else if (key.includes("music") || key.includes("composer")) meta.music = val;
      else if (key.includes("lyric")) meta.lyrics = val;
      else if (key.includes("year")) meta.year = val;
      else if (key.includes("source")) meta.source = val;
    }
  }
  return meta;
}

export default function SongViewer({ song, otherSongs = [] }: SongViewerProps) {
  const { currentNoteIndex } = useAppStore();
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    () => new Set(song.sections.map((_, i) => i))
  );
  const [showNotationGuide, setShowNotationGuide] = useState(false);
  const [showAbout, setShowAbout] = useState(true);
  const lineRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const meta = extractMeta(song.info);

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
              onClick={() => setShowNotationGuide(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                         bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--accent-primary)] hover:text-white"
              title="How to read notes"
            >
              <BookOpen className="w-3.5 h-3.5" />
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

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-10">
          <div className="flex items-start gap-4 sm:gap-5">
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
                className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                {song.title}
              </h1>

              {/* Primary meta row — movie, singer, composer */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
                {meta.movie && (
                  <span className="flex items-center gap-1.5 text-sm text-white/75">
                    <Film className="w-3.5 h-3.5 flex-shrink-0" />
                    {meta.movie}
                  </span>
                )}
                {meta.singer && (
                  <span className="flex items-center gap-1.5 text-sm text-white/75">
                    <Mic2 className="w-3.5 h-3.5 flex-shrink-0" />
                    {meta.singer}
                  </span>
                )}
                {meta.music && (
                  <span className="flex items-center gap-1.5 text-sm text-white/75">
                    <Guitar className="w-3.5 h-3.5 flex-shrink-0" />
                    {meta.music}
                  </span>
                )}
                {meta.lyrics && (
                  <span className="flex items-center gap-1.5 text-sm text-white/75">
                    <Music2 className="w-3.5 h-3.5 flex-shrink-0" />
                    {meta.lyrics}
                  </span>
                )}
              </div>

              {/* Badges — scale, raag, year */}
              <div className="flex flex-wrap gap-2">
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
                {meta.thaat && (
                  <span className="badge bg-white/20 text-white backdrop-blur-sm text-xs">
                    Thaat: {meta.thaat}
                  </span>
                )}
                {meta.year && (
                  <span className="badge bg-white/20 text-white backdrop-blur-sm text-xs">
                    {meta.year}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ad: Below hero */}
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 mt-4 relative z-[1]">
        <AdBanner
          slot={AD_SLOTS.SONG_TOP}
          format="horizontal"
          className="ad-song-top"
        />
      </div>

      {/* Notation content — 3-col on xl+: [spacer] [notation] [sidebar] */}
      <main className="flex-1 w-full px-4 sm:px-6 py-6 pb-32 relative z-[1]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col xl:flex-row xl:items-start xl:gap-10">

          {/* Left column: About this song on xl+ (empty spacer when no enriched data) */}
          <div className="hidden xl:block xl:w-56 xl:flex-shrink-0 sticky top-20 self-start">
            {(song.description || (song.trivia && song.trivia.length > 0)) && (
              <div className="rounded-2xl border border-[var(--border-light)] overflow-hidden shadow-sm">
                {/* Header */}
                <div
                  className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-light)]"
                  style={{ background: "linear-gradient(135deg, rgba(108,99,255,0.07) 0%, rgba(255,101,132,0.04) 100%)" }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    About
                  </span>
                </div>
                {/* Content */}
                <div className="bg-[var(--bg-card)] px-4 py-4 space-y-3">
                  {song.description && (
                    <div className="relative pl-3">
                      <div
                        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full"
                        style={{ background: "linear-gradient(to bottom, var(--accent-primary), var(--accent-secondary))" }}
                      />
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {song.description}
                      </p>
                    </div>
                  )}
                  {song.trivia && song.trivia.length > 0 && (
                    <ul className="space-y-2">
                      {song.trivia.map((fact, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 rounded-xl px-2.5 py-2 text-xs"
                          style={{ background: "rgba(108,99,255,0.05)" }}
                        >
                          <span
                            className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[0.6rem] font-bold text-white mt-0.5"
                            style={{ background: "var(--accent-primary)" }}
                          >
                            {i + 1}
                          </span>
                          <span className="text-[var(--text-muted)] leading-relaxed">{fact}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notation column */}
          <div className="flex-1 min-w-0 max-w-4xl mx-auto xl:mx-0 xl:max-w-none">

            {/* About this song — mobile/tablet only (shown above notation on small screens) */}
            {(song.description || (song.trivia && song.trivia.length > 0)) && (
              <div className="xl:hidden mb-6 rounded-2xl border border-[var(--border-light)] overflow-hidden shadow-sm">
                {/* Card header — click to collapse/expand */}
                <button
                  onClick={() => setShowAbout((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 px-5 py-3 border-b border-[var(--border-light)] transition-colors hover:brightness-95"
                  style={{
                    background: "linear-gradient(135deg, rgba(108,99,255,0.07) 0%, rgba(255,101,132,0.04) 100%)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      About this song
                    </span>
                  </div>
                  {showAbout ? (
                    <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                  )}
                </button>

                {showAbout && <div className="bg-[var(--bg-card)] px-5 py-4 space-y-4">
                  {song.description && (
                    <div className="relative pl-4">
                      <div
                        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full"
                        style={{
                          background: "linear-gradient(to bottom, var(--accent-primary), var(--accent-secondary))",
                        }}
                      />
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                        {song.description}
                      </p>
                    </div>
                  )}
                  {song.trivia && song.trivia.length > 0 && (
                    <ul className="space-y-2">
                      {song.trivia.map((fact, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm"
                          style={{ background: "rgba(108,99,255,0.05)" }}
                        >
                          <span
                            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[0.65rem] font-bold text-white mt-0.5"
                            style={{ background: "var(--accent-primary)" }}
                          >
                            {i + 1}
                          </span>
                          <span className="text-[var(--text-muted)] leading-relaxed">{fact}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>}
              </div>
            )}

            {song.sections.map((section, si) => (
              <div key={si}>
                <div className="mb-6">
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
                    <div className="mt-2 space-y-1">
                      {section.lines.map((line, li) => {
                        const globalIdx = song.sections
                          .slice(0, si)
                          .reduce((sum, s) => sum + s.lines.length, 0) + li;
                        const key = `${si}-${li}`;

                        return (
                          <div key={key} ref={setLineRef(key)} className="break-inside-avoid">
                            <NotationLine
                              line={line}
                              lineIndex={globalIdx}
                              isActive={currentNoteIndex === globalIdx}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Ad: Mid-content — show after every N sections */}
                {si > 0 &&
                  si < song.sections.length - 1 &&
                  (si + 1) % ADS_CONFIG.midContentInterval === 0 && (
                    <div className="my-6">
                      <AdBanner
                        slot={AD_SLOTS.SONG_MID}
                        layout="in-article"
                        format="auto"
                        className="ad-song-mid"
                      />
                    </div>
                  )}
              </div>
            ))}

            {/* Ad: Bottom of notation */}
            <div className="mt-8 mb-4">
              <AdBanner
                slot={AD_SLOTS.SONG_BOTTOM}
                format="rectangle"
                className="ad-song-bottom"
              />
            </div>

            {/* Suggestions below notation on mobile / tablet (< xl) */}
            {otherSongs.length > 0 && (
              <div className="xl:hidden">
                <RandomSongSuggestions songs={otherSongs} count={5} />
              </div>
            )}
          </div>

          {/* Right: sticky sidebar on xl+ */}
          {otherSongs.length > 0 && (
            <aside className="hidden xl:block xl:w-56 xl:flex-shrink-0 sticky top-20 self-start">
              <RandomSongSuggestions songs={otherSongs} count={5} />
              <div className="mt-4">
                <AdBanner
                  slot={AD_SLOTS.SONG_BOTTOM}
                  format="rectangle"
                  className="ad-song-bottom"
                />
              </div>
            </aside>
          )}

          </div>{/* end 3-col flex */}
        </div>
      </main>

      {/* Audio player floating bar */}
      <AudioPlayer song={song} />

      {/* Notation guide modal */}
      <NotationGuideModal
        isOpen={showNotationGuide}
        onClose={() => setShowNotationGuide(false)}
      />
    </div>
  );
}
