"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Music,
  Globe,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  Send,
  ArrowLeft,
  Image as ImageIcon,
  FileJson,
  ExternalLink,
} from "lucide-react";
import type { Song, SongSection, SongLine } from "@/types/song";

interface Props {
  password: string;
}

type Step = "scrape" | "edit" | "published";

export default function AdminSongEditor({ password }: Props) {
  // Step management
  const [step, setStep] = useState<Step>("scrape");

  // Scrape state
  const [url, setUrl] = useState("");
  const [songIdOverride, setSongIdOverride] = useState("");
  const [songTitleOverride, setSongTitleOverride] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState("");

  // Song data (editable)
  const [song, setSong] = useState<Song | null>(null);
  const [imageUrl, setImageUrl] = useState("");

  // Publish state
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    success: boolean;
    message: string;
    commitSha?: string;
  } | null>(null);

  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set()
  );

  // -----------------------------------------------------------------------
  // Scrape
  // -----------------------------------------------------------------------
  const handleScrape = async () => {
    if (!url.trim()) return;
    setScraping(true);
    setScrapeError("");

    try {
      const res = await fetch("/api/admin/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          songId: songIdOverride.trim() || undefined,
          songTitle: songTitleOverride.trim() || undefined,
          password,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setScrapeError(data.error || "Scraping failed");
        return;
      }

      setSong(data.song);
      // Expand all sections initially
      setExpandedSections(
        new Set(data.song.sections.map((_: SongSection, i: number) => i))
      );
      setStep("edit");
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "Network error");
    } finally {
      setScraping(false);
    }
  };

  // -----------------------------------------------------------------------
  // Edit helpers
  // -----------------------------------------------------------------------
  const updateSongField = (field: keyof Song, value: string | boolean) => {
    if (!song) return;
    setSong({ ...song, [field]: value });
  };

  const updateInfo = (index: number, value: string) => {
    if (!song) return;
    const newInfo = [...song.info];
    newInfo[index] = value;
    setSong({ ...song, info: newInfo });
  };

  const removeInfo = (index: number) => {
    if (!song) return;
    setSong({ ...song, info: song.info.filter((_, i) => i !== index) });
  };

  const addInfo = () => {
    if (!song) return;
    setSong({ ...song, info: [...song.info, ""] });
  };

  const updateSectionName = (sIdx: number, name: string) => {
    if (!song) return;
    const newSections = [...song.sections];
    newSections[sIdx] = { ...newSections[sIdx], name };
    setSong({ ...song, sections: newSections });
  };

  const updateLine = (
    sIdx: number,
    lIdx: number,
    field: keyof SongLine,
    value: string
  ) => {
    if (!song) return;
    const newSections = [...song.sections];
    const newLines = [...newSections[sIdx].lines];
    newLines[lIdx] = { ...newLines[lIdx], [field]: value };
    newSections[sIdx] = { ...newSections[sIdx], lines: newLines };
    setSong({ ...song, sections: newSections });
  };

  const removeLine = (sIdx: number, lIdx: number) => {
    if (!song) return;
    const newSections = [...song.sections];
    newSections[sIdx] = {
      ...newSections[sIdx],
      lines: newSections[sIdx].lines.filter((_, i) => i !== lIdx),
    };
    setSong({ ...song, sections: newSections });
  };

  const addLine = (sIdx: number) => {
    if (!song) return;
    const newSections = [...song.sections];
    newSections[sIdx] = {
      ...newSections[sIdx],
      lines: [...newSections[sIdx].lines, { lyrics: "", indian: "" }],
    };
    setSong({ ...song, sections: newSections });
  };

  const removeSection = (sIdx: number) => {
    if (!song) return;
    const newSections = song.sections.filter((_, i) => i !== sIdx);
    setSong({ ...song, sections: newSections });
    const newExpanded = new Set<number>();
    expandedSections.forEach((i) => {
      if (i < sIdx) newExpanded.add(i);
      else if (i > sIdx) newExpanded.add(i - 1);
    });
    setExpandedSections(newExpanded);
  };

  const addSection = () => {
    if (!song) return;
    const newIdx = song.sections.length;
    setSong({
      ...song,
      sections: [...song.sections, { name: "NEW SECTION", lines: [] }],
    });
    setExpandedSections(new Set([...expandedSections, newIdx]));
  };

  const toggleSection = (idx: number) => {
    const next = new Set(expandedSections);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setExpandedSections(next);
  };

  // -----------------------------------------------------------------------
  // Publish
  // -----------------------------------------------------------------------
  const handlePublish = async () => {
    if (!song) return;
    setPublishing(true);
    setPublishResult(null);

    try {
      const res = await fetch("/api/admin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          song,
          password,
          imageUrl: imageUrl.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setPublishResult({
          success: false,
          message: data.error || "Publish failed",
        });
        return;
      }

      setPublishResult({
        success: true,
        message: data.message,
        commitSha: data.commitSha,
      });
      setStep("published");
    } catch (err) {
      setPublishResult({
        success: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setPublishing(false);
    }
  };

  // -----------------------------------------------------------------------
  // Reset for new song
  // -----------------------------------------------------------------------
  const handleReset = () => {
    setStep("scrape");
    setUrl("");
    setSongIdOverride("");
    setSongTitleOverride("");
    setSong(null);
    setImageUrl("");
    setScrapeError("");
    setPublishResult(null);
    setExpandedSections(new Set());
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const totalLines = song
    ? song.sections.reduce((acc, s) => acc + s.lines.length, 0)
    : 0;

  return (
    <div className="min-h-screen paper-bg">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-[var(--border-light)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <Music className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1
                  className="text-lg font-bold text-[var(--text-primary)]"
                  style={{
                    fontFamily: "'Libre Baskerville', Georgia, serif",
                  }}
                >
                  Admin Panel
                </h1>
                <p className="text-[0.65rem] text-[var(--text-muted)] -mt-0.5 tracking-wider uppercase">
                  Scrape &amp; Publish Songs
                </p>
              </div>
            </Link>

            {/* Step indicator */}
            <div className="flex items-center gap-2 text-sm">
              <StepBadge
                label="1. Scrape"
                active={step === "scrape"}
                done={step === "edit" || step === "published"}
              />
              <span className="text-[var(--text-muted)]">→</span>
              <StepBadge
                label="2. Edit"
                active={step === "edit"}
                done={step === "published"}
              />
              <span className="text-[var(--text-muted)]">→</span>
              <StepBadge
                label="3. Publish"
                active={step === "published"}
                done={false}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ============== STEP 1: SCRAPE ============== */}
        {step === "scrape" && (
          <div className="max-w-2xl mx-auto">
            <div className="glass rounded-2xl p-6 border border-[var(--border-light)] shadow-xl">
              <div className="flex items-center gap-2 mb-6">
                <Globe className="w-5 h-5 text-[var(--accent-primary)]" />
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                  Scrape Song Notations
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    URL <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.notationsworld.com/song-name..."
                    className="admin-input"
                    autoFocus
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Supported: notationsworld.com, notesandsargam.com, or any
                    page with alternating lyrics/sargam lines
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                      Song ID (optional)
                    </label>
                    <input
                      type="text"
                      value={songIdOverride}
                      onChange={(e) => setSongIdOverride(e.target.value)}
                      placeholder="my-song-name"
                      className="admin-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                      Title (optional)
                    </label>
                    <input
                      type="text"
                      value={songTitleOverride}
                      onChange={(e) => setSongTitleOverride(e.target.value)}
                      placeholder="Override auto-detected title"
                      className="admin-input"
                    />
                  </div>
                </div>

                {scrapeError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {scrapeError}
                  </div>
                )}

                <button
                  onClick={handleScrape}
                  disabled={!url.trim() || scraping}
                  className="w-full py-3 rounded-xl bg-[var(--accent-primary)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {scraping ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Scraping...
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4" />
                      Scrape Notations
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============== STEP 2: EDIT ============== */}
        {step === "edit" && song && (
          <div className="space-y-6">
            {/* Back + summary bar */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep("scrape")}
                className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to scrape
              </button>
              <div className="text-sm text-[var(--text-muted)]">
                {song.sections.length} sections · {totalLines} lines
              </div>
            </div>

            {/* Song metadata */}
            <div className="glass rounded-2xl p-6 border border-[var(--border-light)]">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                Song Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="admin-label">Song ID</label>
                  <input
                    type="text"
                    value={song.id}
                    onChange={(e) => updateSongField("id", e.target.value)}
                    className="admin-input"
                  />
                </div>
                <div>
                  <label className="admin-label">Title</label>
                  <input
                    type="text"
                    value={song.title}
                    onChange={(e) => updateSongField("title", e.target.value)}
                    className="admin-input"
                  />
                </div>
              </div>

              {/* Info lines */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="admin-label mb-0">Info / Metadata</label>
                  <button
                    onClick={addInfo}
                    className="text-xs text-[var(--accent-primary)] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {song.info.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={line}
                        onChange={(e) => updateInfo(idx, e.target.value)}
                        className="admin-input flex-1"
                        placeholder="Key: Value"
                      />
                      <button
                        onClick={() => removeInfo(idx)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Image URL */}
              <div className="mt-4">
                <label className="admin-label">
                  <ImageIcon className="w-3.5 h-3.5 inline mr-1" />
                  Thumbnail Image URL (optional)
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/song-image.jpg"
                  className="admin-input"
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  If provided, the image will be downloaded and committed to the
                  repo
                </p>
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  Sections &amp; Notation
                </h3>
                <button
                  onClick={addSection}
                  className="text-sm text-[var(--accent-primary)] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Section
                </button>
              </div>

              {song.sections.map((section, sIdx) => (
                <div
                  key={sIdx}
                  className="glass rounded-2xl border border-[var(--border-light)] overflow-hidden"
                >
                  {/* Section header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
                    onClick={() => toggleSection(sIdx)}
                  >
                    <div className="flex items-center gap-2">
                      {expandedSections.has(sIdx) ? (
                        <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                      )}
                      <input
                        type="text"
                        value={section.name}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateSectionName(sIdx, e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-transparent font-semibold text-[var(--text-primary)] border-none outline-none focus:ring-1 focus:ring-[var(--accent-primary)] rounded px-1"
                      />
                      <span className="text-xs text-[var(--text-muted)]">
                        ({section.lines.length} lines)
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSection(sIdx);
                      }}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Section lines */}
                  {expandedSections.has(sIdx) && (
                    <div className="px-4 pb-4 space-y-3">
                      {section.lines.map((line, lIdx) => (
                        <div
                          key={lIdx}
                          className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-light)]"
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-[var(--text-muted)] mt-2 w-6 text-right shrink-0">
                              {lIdx + 1}
                            </span>
                            <div className="flex-1 space-y-2">
                              <input
                                type="text"
                                value={line.lyrics}
                                onChange={(e) =>
                                  updateLine(
                                    sIdx,
                                    lIdx,
                                    "lyrics",
                                    e.target.value
                                  )
                                }
                                placeholder="Lyrics"
                                className="admin-input text-sm"
                              />
                              <input
                                type="text"
                                value={line.indian}
                                onChange={(e) =>
                                  updateLine(
                                    sIdx,
                                    lIdx,
                                    "indian",
                                    e.target.value
                                  )
                                }
                                placeholder="Indian sargam notation"
                                className="admin-input text-sm font-mono"
                              />
                            </div>
                            <button
                              onClick={() => removeLine(sIdx, lIdx)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors mt-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={() => addLine(sIdx)}
                        className="w-full py-2 rounded-xl border border-dashed border-[var(--border-light)] text-sm text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Line
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* JSON Preview */}
            <details className="glass rounded-2xl border border-[var(--border-light)]">
              <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-2">
                <FileJson className="w-4 h-4" />
                Preview JSON
              </summary>
              <div className="px-4 pb-4">
                <pre className="text-xs bg-[var(--bg-secondary)] rounded-xl p-4 overflow-x-auto max-h-96 text-[var(--text-secondary)]">
                  {JSON.stringify(song, null, 2)}
                </pre>
              </div>
            </details>

            {/* Publish bar */}
            <div className="sticky bottom-0 glass border-t border-[var(--border-light)] -mx-4 px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              <div className="max-w-5xl mx-auto flex items-center justify-between">
                <div className="text-sm text-[var(--text-muted)]">
                  <strong className="text-[var(--text-primary)]">
                    {song.title}
                  </strong>{" "}
                  · {song.sections.length} sections · {totalLines} lines
                </div>

                {publishResult && !publishResult.success && (
                  <div className="flex items-center gap-2 text-sm text-red-400 mr-4">
                    <AlertCircle className="w-4 h-4" />
                    {publishResult.message}
                  </div>
                )}

                <button
                  onClick={handlePublish}
                  disabled={publishing || !song.id || !song.title}
                  className="px-6 py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Publish to GitHub
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============== STEP 3: PUBLISHED ============== */}
        {step === "published" && publishResult?.success && (
          <div className="max-w-lg mx-auto text-center py-12">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Song Published!
            </h2>
            <p className="text-[var(--text-muted)] mb-6">
              {publishResult.message}
            </p>

            {publishResult.commitSha && (
              <a
                href={`https://github.com/contactmrshalin/songbook/commit/${publishResult.commitSha}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[var(--accent-primary)] hover:underline mb-8"
              >
                <ExternalLink className="w-4 h-4" />
                View commit {publishResult.commitSha.slice(0, 7)}
              </a>
            )}

            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={handleReset}
                className="px-6 py-2.5 rounded-xl bg-[var(--accent-primary)] text-white font-medium hover:opacity-90 transition-opacity"
              >
                Scrape Another Song
              </button>
              <Link
                href="/"
                className="px-6 py-2.5 rounded-xl border border-[var(--border-light)] text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-secondary)] transition-colors"
              >
                Back to Songbook
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// -----------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------

function StepBadge({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <span
      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
        active
          ? "bg-[var(--accent-primary)] text-white"
          : done
            ? "bg-green-500/20 text-green-500"
            : "bg-[var(--bg-secondary)] text-[var(--text-muted)]"
      }`}
    >
      {done && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
      {label}
    </span>
  );
}
