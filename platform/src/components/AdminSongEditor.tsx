"use client";

import { useState } from "react";
import Link from "next/link";

import { getGitHubRepoConfig } from "@/lib/github-config";
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
  Search,
  List,
  X,
  Sparkles,
  Pencil,
  RefreshCw,
} from "lucide-react";
import type { Song, SongSection, SongLine } from "@/types/song";
import { transposeNotation } from "@/lib/transpose";

interface Props {
  password: string;
}

type Tab = "scrape" | "manage";
type Step = "scrape" | "edit" | "published";

interface SongListItem {
  id: string;
  title: string;
  sections: number;
  lines: number;
  inOrder: boolean;
  enriched: boolean;
}

const { repoUrl } = getGitHubRepoConfig();

export default function AdminSongEditor({ password }: Props) {
  // Tab + step management
  const [tab, setTab] = useState<Tab>("scrape");
  const [step, setStep] = useState<Step>("scrape");

  // Manage songs state
  const [songList, setSongList] = useState<SongListItem[]>([]);
  const [songListLoading, setSongListLoading] = useState(false);
  const [songListError, setSongListError] = useState("");
  const [songSearch, setSongSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteResult, setDeleteResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

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

  // Enrich state
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Edit source — tracks whether the current song came from scraping or the manage list
  const [editSource, setEditSource] = useState<"scrape" | "manage">("scrape");

  // Per-song loading indicators in the manage tab
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [loadingEnrichId, setLoadingEnrichId] = useState<string | null>(null);

  // Re-scrape state
  const [rescrapeId, setRescrapeId] = useState<string | null>(null);
  const [rescrapeUrl, setRescrapeUrl] = useState("");
  const [rescraping, setRescraping] = useState(false);
  const [rescrapeError, setRescrapeError] = useState("");

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

  // Transpose all sargam lines in a section by ±1 semitone
  const transposeSection = (sIdx: number, semitones: number) => {
    if (!song) return;
    const newSections = song.sections.map((section, i) => {
      if (i !== sIdx) return section;
      return {
        ...section,
        lines: section.lines.map((line) => ({
          ...line,
          indian: transposeNotation(line.indian, semitones),
        })),
      };
    });
    setSong({ ...song, sections: newSections });
  };

  // -----------------------------------------------------------------------
  // Enrich with AI
  // -----------------------------------------------------------------------
  const handleEnrich = async () => {
    if (!song) return;
    setEnriching(true);
    setEnrichResult(null);

    try {
      const res = await fetch("/api/admin/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setEnrichResult({ success: false, message: data.error || "Enrichment failed" });
        return;
      }

      const newFields: string[] = data.newFields ?? [];
      const description: string | null = data.description ?? null;
      const trivia: string[] | null = data.trivia ?? null;
      const meaning: { coreTheme: string; lyricSymbolism: string } | null = data.meaning ?? null;

      const added: string[] = [];
      if (newFields.length > 0) added.push(...newFields.map((f: string) => f.split(":")[0]));
      if (description) added.push("Description");
      if (trivia?.length) added.push("Trivia");
      if (meaning) added.push("Behind the Beats");

      if (added.length === 0) {
        setEnrichResult({ success: true, message: "All fields already present — nothing to add." });
        return;
      }

      // Merge all enriched data into song
      setSong((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          info: [...(prev.info ?? []), ...newFields],
          ...(description ? { description } : {}),
          ...(trivia?.length ? { trivia } : {}),
          ...(meaning ? { meaning } : {}),
        };
      });
      setEnrichResult({
        success: true,
        message: `Added: ${added.join(", ")}`,
      });
    } catch (err) {
      setEnrichResult({
        success: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setEnriching(false);
    }
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

      if (editSource === "manage") {
        // Return directly to manage tab with a success banner — no separate "published" page
        const updatedTitle = song!.title;
        setSong(null);
        setStep("scrape");
        setEditSource("scrape");
        setPublishResult(null);
        setEnrichResult(null);
        setExpandedSections(new Set());
        setTab("manage");
        setDeleteResult({ success: true, message: `✓ "${updatedTitle}" updated on GitHub successfully!` });
        loadSongList(); // Refresh the list so counts / metadata reflect changes
      } else {
        setPublishResult({
          success: true,
          message: data.message,
          commitSha: data.commitSha,
        });
        setStep("published");
      }
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
  // Manage songs — load list
  // -----------------------------------------------------------------------
  const loadSongList = async () => {
    setSongListLoading(true);
    setSongListError("");
    setDeleteResult(null);

    try {
      const res = await fetch("/api/admin/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setSongListError(data.error || "Failed to load songs");
        return;
      }

      setSongList(data.songs);
    } catch (err) {
      setSongListError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSongListLoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // Manage songs — delete
  // -----------------------------------------------------------------------
  const handleDelete = async (songId: string) => {
    setDeletingId(songId);
    setDeleteResult(null);

    try {
      const res = await fetch("/api/admin/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, password, deleteImage: true }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setDeleteResult({
          success: false,
          message: data.error || "Delete failed",
        });
        return;
      }

      setDeleteResult({ success: true, message: data.message });
      // Remove from local list
      setSongList((prev) => prev.filter((s) => s.id !== songId));
      setDeleteConfirmId(null);
    } catch (err) {
      setDeleteResult({
        success: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredSongs = songList.filter((s) => {
    if (!songSearch.trim()) return true;
    const q = songSearch.toLowerCase();
    return (
      s.id.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)
    );
  });

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
    setEnrichResult(null);
    setExpandedSections(new Set());
    setEditSource("scrape");
  };

  // -----------------------------------------------------------------------
  // Load an existing song from GitHub for editing (optionally with AI enrich)
  // -----------------------------------------------------------------------
  const handleLoadSong = async (songId: string, autoEnrich: boolean) => {
    const setLoading = autoEnrich ? setLoadingEnrichId : setLoadingEditId;
    setLoading(songId);
    setSongListError("");
    setDeleteResult(null);

    try {
      // Fetch the live JSON from GitHub via the extended songs endpoint
      const res = await fetch("/api/admin/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, songId }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setSongListError(data.error || "Failed to load song from GitHub");
        return;
      }

      let loadedSong: Song = data.song;
      let initialEnrichResult: { success: boolean; message: string } | null = null;

      // Optionally enrich inline before opening the editor
      if (autoEnrich) {
        const enrichRes = await fetch("/api/admin/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ song: loadedSong, password }),
        });
        const enrichData = await enrichRes.json();

        if (enrichRes.ok && enrichData.success) {
          const newFields: string[] = enrichData.newFields ?? [];
          const description: string | null = enrichData.description ?? null;
          const trivia: string[] | null = enrichData.trivia ?? null;
          const meaning: { coreTheme: string; lyricSymbolism: string } | null = enrichData.meaning ?? null;
          const added: string[] = [];
          if (newFields.length) added.push(...newFields.map((f: string) => f.split(":")[0]));
          if (description) added.push("Description");
          if (trivia?.length) added.push("Trivia");
          if (meaning) added.push("Behind the Beats");

          if (added.length > 0) {
            loadedSong = {
              ...loadedSong,
              info: [...loadedSong.info, ...newFields],
              ...(description ? { description } : {}),
              ...(trivia?.length ? { trivia } : {}),
              ...(meaning ? { meaning } : {}),
            };
            initialEnrichResult = {
              success: true,
              message: `AI added: ${added.join(", ")} — review below then publish`,
            };
          } else {
            initialEnrichResult = {
              success: true,
              message: "All fields already present — nothing to add.",
            };
          }
        } else {
          initialEnrichResult = {
            success: false,
            message: enrichData.error || "Enrichment failed",
          };
        }
      }

      // Open in editor
      setSong(loadedSong);
      setExpandedSections(new Set((loadedSong.sections ?? []).map((_, i) => i)));
      setImageUrl("");
      setPublishResult(null);
      setEnrichResult(initialEnrichResult);
      setEditSource("manage");
      setTab("scrape");
      setStep("edit");
    } catch (err) {
      setSongListError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(null);
    }
  };

  // -----------------------------------------------------------------------
  // Re-scrape — update notations from a new URL source, keeping enriched data
  // -----------------------------------------------------------------------
  const handleRescrape = async (songId: string) => {
    if (!rescrapeUrl.trim()) return;
    setRescraping(true);
    setRescrapeError("");

    try {
      // 1. Fetch existing song from GitHub
      const songRes = await fetch("/api/admin/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, songId }),
      });
      const songData = await songRes.json();

      if (!songRes.ok || !songData.success) {
        setRescrapeError(songData.error || "Failed to load existing song");
        return;
      }

      // 2. Re-scrape from new URL
      const scrapeRes = await fetch("/api/admin/rescrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: rescrapeUrl.trim(),
          songId,
          password,
        }),
      });
      const scrapeData = await scrapeRes.json();

      if (!scrapeRes.ok || !scrapeData.success) {
        setRescrapeError(scrapeData.error || "Re-scrape failed");
        return;
      }

      // 3. Merge: replace only sections, keep everything else intact
      const existingSong: Song = songData.song;
      const mergedSong: Song = {
        ...existingSong,
        sections: scrapeData.sections,
      };

      // 4. Open in editor so admin can review before publishing
      setSong(mergedSong);
      setExpandedSections(new Set(mergedSong.sections.map((_: SongSection, i: number) => i)));
      setImageUrl("");
      setPublishResult(null);
      setEnrichResult({
        success: true,
        message: `Notations re-scraped (${scrapeData.sectionCount} sections, ${scrapeData.lineCount} lines) — thumbnail, description & trivia preserved. Review and publish.`,
      });
      setEditSource("manage");
      setTab("scrape");
      setStep("edit");

      // Reset re-scrape dialog state
      setRescrapeId(null);
      setRescrapeUrl("");
    } catch (err) {
      setRescrapeError(err instanceof Error ? err.message : "Network error");
    } finally {
      setRescraping(false);
    }
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
                  Scrape, Publish &amp; Manage
                </p>
              </div>
            </Link>

            {/* Tab switcher + Step indicator */}
            <div className="flex items-center gap-3 text-sm">
              {/* Tab buttons */}
              <div className="flex items-center bg-[var(--bg-secondary)] rounded-xl p-1 border border-[var(--border-light)]">
                <button
                  onClick={() => { setTab("scrape"); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    tab === "scrape"
                      ? "bg-[var(--accent-primary)] text-white"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  Scrape
                </button>
                <button
                  onClick={() => { setTab("manage"); if (songList.length === 0) loadSongList(); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    tab === "manage"
                      ? "bg-[var(--accent-primary)] text-white"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  Manage
                </button>
              </div>

              {/* Step indicator — only show on scrape tab */}
              {tab === "scrape" && (
                <div className="hidden sm:flex items-center gap-2">
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
              )}

              {tab === "manage" && songList.length > 0 && (
                <span className="text-xs text-[var(--text-muted)]">
                  {songList.length} songs
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ============== MANAGE SONGS TAB ============== */}
        {tab === "manage" && (
          <div className="space-y-4">
            {/* Search bar */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={songSearch}
                  onChange={(e) => setSongSearch(e.target.value)}
                  placeholder="Search songs by title or ID..."
                  className="admin-input pl-10"
                  autoFocus
                />
                {songSearch && (
                  <button
                    onClick={() => setSongSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={loadSongList}
                disabled={songListLoading}
                className="px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-light)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--border-light)] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {songListLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <List className="w-4 h-4" />
                )}
                Refresh
              </button>
            </div>

            {/* Delete result banner */}
            {deleteResult && (
              <div
                className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
                  deleteResult.success
                    ? "bg-green-500/10 border border-green-500/20 text-green-500"
                    : "bg-red-500/10 border border-red-500/20 text-red-400"
                }`}
              >
                {deleteResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                {deleteResult.message}
              </div>
            )}

            {/* Error */}
            {songListError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {songListError}
              </div>
            )}

            {/* Loading */}
            {songListLoading && songList.length === 0 && (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
                Loading songs from GitHub...
              </div>
            )}

            {/* Song list */}
            {!songListLoading && songList.length === 0 && !songListError && (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <List className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No songs loaded yet.</p>
                <button
                  onClick={loadSongList}
                  className="mt-3 text-sm text-[var(--accent-primary)] hover:underline"
                >
                  Load song list from GitHub
                </button>
              </div>
            )}

            {filteredSongs.length > 0 && (
              <div className="space-y-2">
                {songSearch && (
                  <p className="text-xs text-[var(--text-muted)]">
                    Showing {filteredSongs.length} of {songList.length} songs
                  </p>
                )}

                {filteredSongs.map((s) => (
                  <div
                    key={s.id}
                    className="glass rounded-xl border border-[var(--border-light)] px-4 py-3 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[var(--text-primary)] truncate">
                        {s.title}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        <span className="font-mono">{s.id}</span>
                        <span className="mx-1.5">·</span>
                        {s.sections} sections · {s.lines} lines
                      </div>
                    </div>

                    {deleteConfirmId === s.id ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-red-400 font-medium">
                          Delete?
                        </span>
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={deletingId === s.id}
                          className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {deletingId === s.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-3 py-1.5 rounded-lg border border-[var(--border-light)] text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Edit button */}
                        <button
                          onClick={() => handleLoadSong(s.id, false)}
                          disabled={
                            loadingEditId === s.id ||
                            loadingEnrichId === s.id ||
                            !!deletingId
                          }
                          title={`Edit ${s.title}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-light)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {loadingEditId === s.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Pencil className="w-3.5 h-3.5" />
                          )}
                          <span className="hidden sm:inline">
                            {loadingEditId === s.id ? "Loading…" : "Edit"}
                          </span>
                        </button>

                        {/* Enrich / Re-enrich with AI button */}
                        {s.enriched ? (
                          /* Already enriched — subdued "Re-enrich" to avoid accidental API spend */
                          <button
                            onClick={() => handleLoadSong(s.id, true)}
                            disabled={
                              loadingEditId === s.id ||
                              loadingEnrichId === s.id ||
                              !!deletingId
                            }
                            title={`Re-enrich ${s.title} with AI (already has description/trivia)`}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] border border-[var(--border-light)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {loadingEnrichId === s.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                            <span className="hidden sm:inline">
                              {loadingEnrichId === s.id ? "Enriching…" : "Re-enrich"}
                            </span>
                          </button>
                        ) : (
                          /* Not yet enriched — prominent "Enrich" button */
                          <button
                            onClick={() => handleLoadSong(s.id, true)}
                            disabled={
                              loadingEditId === s.id ||
                              loadingEnrichId === s.id ||
                              !!deletingId
                            }
                            title={`Enrich ${s.title} with AI`}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {loadingEnrichId === s.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline">
                              {loadingEnrichId === s.id ? "Enriching…" : "Enrich"}
                            </span>
                          </button>
                        )}

                        {/* Re-scrape button */}
                        <button
                          onClick={() => {
                            setRescrapeId(s.id);
                            setRescrapeUrl("");
                            setRescrapeError("");
                          }}
                          disabled={
                            loadingEditId === s.id ||
                            loadingEnrichId === s.id ||
                            !!deletingId
                          }
                          title={`Re-scrape notations for ${s.title} from a new source`}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-orange-400 hover:bg-orange-500/10 border border-orange-400/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Re-scrape</span>
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => {
                            setDeleteConfirmId(s.id);
                            setDeleteResult(null);
                          }}
                          disabled={loadingEditId === s.id || loadingEnrichId === s.id}
                          className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={`Delete ${s.title}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Re-scrape inline panel */}
                  {rescrapeId === s.id && (
                    <div className="glass rounded-xl border border-orange-400/20 px-4 py-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-orange-400" />
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          Re-scrape notations for &quot;{s.title}&quot;
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">
                        Enter a new source URL. Only notations will be updated — thumbnail, description, trivia and other metadata will be preserved.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="url"
                          value={rescrapeUrl}
                          onChange={(e) => setRescrapeUrl(e.target.value)}
                          placeholder="https://www.notationsworld.com/..."
                          className="admin-input flex-1 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && rescrapeUrl.trim()) {
                              handleRescrape(s.id);
                            }
                          }}
                        />
                        <button
                          onClick={() => handleRescrape(s.id)}
                          disabled={!rescrapeUrl.trim() || rescraping}
                          className="px-3 py-2 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {rescraping ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          {rescraping ? "Scraping…" : "Re-scrape"}
                        </button>
                        <button
                          onClick={() => {
                            setRescrapeId(null);
                            setRescrapeUrl("");
                            setRescrapeError("");
                          }}
                          className="px-3 py-2 rounded-lg border border-[var(--border-light)] text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                      {rescrapeError && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {rescrapeError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                ))}
              </div>
            )}

            {songList.length > 0 && filteredSongs.length === 0 && songSearch && (
              <div className="text-center py-8 text-[var(--text-muted)]">
                <Search className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  No songs match &quot;{songSearch}&quot;
                </p>
              </div>
            )}
          </div>
        )}

        {/* ============== STEP 1: SCRAPE ============== */}
        {tab === "scrape" && step === "scrape" && (
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
        {tab === "scrape" && step === "edit" && song && (
          <div className="space-y-6">
            {/* Back + summary bar */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  if (editSource === "manage") {
                    // Return to manage tab without saving
                    setSong(null);
                    setStep("scrape");
                    setEditSource("scrape");
                    setEnrichResult(null);
                    setPublishResult(null);
                    setExpandedSections(new Set());
                    setTab("manage");
                  } else {
                    setStep("scrape");
                  }
                }}
                className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {editSource === "manage" ? "Back to manage" : "Back to scrape"}
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
                  <label className="admin-label">
                    Song ID
                    {editSource === "manage" && (
                      <span className="ml-1.5 text-[var(--text-muted)] font-normal text-[0.7rem]">
                        (read-only)
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={song.id}
                    onChange={(e) =>
                      editSource !== "manage" && updateSongField("id", e.target.value)
                    }
                    readOnly={editSource === "manage"}
                    className={`admin-input ${
                      editSource === "manage"
                        ? "opacity-60 cursor-not-allowed select-all"
                        : ""
                    }`}
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleEnrich}
                      disabled={enriching}
                      title="Auto-fill missing metadata using AI (requires ANTHROPIC_API_KEY)"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                                 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]
                                 hover:bg-[var(--accent-primary)]/20 disabled:opacity-50
                                 disabled:cursor-not-allowed transition-colors border border-[var(--accent-primary)]/20"
                    >
                      {enriching ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      {enriching ? "Enriching…" : "Enrich with AI"}
                    </button>
                    <button
                      onClick={addInfo}
                      className="text-xs text-[var(--accent-primary)] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                </div>

                {/* Enrich result banner */}
                {enrichResult && (
                  <div
                    className={`flex items-start gap-2 p-2.5 rounded-xl mb-2 text-xs ${
                      enrichResult.success
                        ? "bg-green-500/10 border border-green-500/20 text-green-600"
                        : "bg-red-500/10 border border-red-500/20 text-red-400"
                    }`}
                  >
                    {enrichResult.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    )}
                    <span>{enrichResult.message}</span>
                    {enrichResult.success && (
                      <span className="ml-1 text-[var(--text-muted)]">— review &amp; edit before publishing</span>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  {(song.info ?? []).map((line, idx) => (
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

              {/* Description */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="admin-label mb-0">Description (optional)</label>
                  {song.description && (
                    <button
                      onClick={() => setSong({ ...song, description: undefined })}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  value={song.description ?? ""}
                  onChange={(e) =>
                    setSong({ ...song, description: e.target.value || undefined })
                  }
                  placeholder="A short engaging description of the song shown to users…"
                  rows={3}
                  className="admin-input resize-none text-sm"
                />
              </div>

              {/* Trivia */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="admin-label mb-0">Trivia / Interesting Facts</label>
                  <button
                    onClick={() =>
                      setSong({ ...song, trivia: [...(song.trivia ?? []), ""] })
                    }
                    className="text-xs text-[var(--accent-primary)] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add fact
                  </button>
                </div>
                <div className="space-y-2">
                  {(song.trivia ?? []).map((fact, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={fact}
                        onChange={(e) => {
                          const next = [...(song.trivia ?? [])];
                          next[idx] = e.target.value;
                          setSong({ ...song, trivia: next });
                        }}
                        className="admin-input flex-1 text-sm"
                        placeholder="Interesting fact…"
                      />
                      <button
                        onClick={() => {
                          const next = (song.trivia ?? []).filter((_, i) => i !== idx);
                          setSong({ ...song, trivia: next.length ? next : undefined });
                        }}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Behind the Beats - Meaning */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="admin-label mb-0">Behind the Beats</label>
                  {song.meaning && (
                    <button
                      onClick={() => setSong({ ...song, meaning: undefined })}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <label className="text-xs text-[var(--text-muted)] mb-0.5 block">Core Theme & Meaning</label>
                <textarea
                  value={typeof song.meaning === "string" ? song.meaning : (song.meaning?.coreTheme ?? "")}
                  onChange={(e) => {
                    const cur = typeof song.meaning === "object" && song.meaning ? song.meaning : { coreTheme: "", lyricSymbolism: "" };
                    const val = e.target.value;
                    setSong({ ...song, meaning: val || cur.lyricSymbolism ? { ...cur, coreTheme: val } : undefined });
                  }}
                  placeholder="Central theme, emotional arc, why this song was written, backstory or inspiration…"
                  rows={3}
                  className="admin-input resize-none text-sm"
                />
                <label className="text-xs text-[var(--text-muted)] mt-2 mb-0.5 block">Lyric Symbolism</label>
                <textarea
                  value={typeof song.meaning === "object" && song.meaning ? (song.meaning.lyricSymbolism ?? "") : ""}
                  onChange={(e) => {
                    const cur = typeof song.meaning === "object" && song.meaning ? song.meaning : { coreTheme: typeof song.meaning === "string" ? song.meaning : "", lyricSymbolism: "" };
                    const val = e.target.value;
                    setSong({ ...song, meaning: val || cur.coreTheme ? { ...cur, lyricSymbolism: val } : undefined });
                  }}
                  placeholder="Key metaphors, poetic devices, cultural references, slang, and their decoded meanings…"
                  rows={3}
                  className="admin-input resize-none text-sm"
                />
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

              {(song.sections ?? []).map((section, sIdx) => (
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

                    {/* Right side: transpose controls + delete */}
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {/* Transpose buttons */}
                      <span className="text-[10px] text-[var(--text-muted)] mr-1 hidden sm:inline">
                        Transpose:
                      </span>
                      <button
                        onClick={() => transposeSection(sIdx, -1)}
                        title="Shift all notes down 1 semitone"
                        className="px-2 py-1 rounded text-xs font-mono font-medium text-[var(--text-secondary)]
                                   hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)]
                                   border border-[var(--border-light)] transition-colors"
                      >
                        −1
                      </button>
                      <button
                        onClick={() => transposeSection(sIdx, 1)}
                        title="Shift all notes up 1 semitone"
                        className="px-2 py-1 rounded text-xs font-mono font-medium text-[var(--text-secondary)]
                                   hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)]
                                   border border-[var(--border-light)] transition-colors"
                      >
                        +1
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => removeSection(sIdx)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors ml-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
                      {editSource === "manage" ? "Updating…" : "Publishing…"}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {editSource === "manage" ? "Update on GitHub" : "Publish to GitHub"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============== STEP 3: PUBLISHED ============== */}
        {tab === "scrape" && step === "published" && publishResult?.success && (
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

                href={`${repoUrl}/commit/${publishResult.commitSha}`}
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
