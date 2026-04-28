"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Save,
  Download,
  Eye,
  Code,
  Plus,
  Trash2,
  Copy,
  RotateCcw,
} from "lucide-react";
import NotationLine from "./NotationLine";
import NotationToggle from "./NotationToggle";
import type { Song, SongSection, SongLine } from "@/types/song";

// Default empty song template
function createEmptySong(): Song {
  return {
    id: "",
    title: "Untitled Song",
    export: true,
    info: ["Film/Artist: ", "Scale: C MIDDLE"],
    thumbnail: "",
    background: "",
    sections: [
      {
        name: "STHAYI",
        lines: [{ lyrics: "", indian: "" }],
      },
    ],
  };
}

// Parse text input into song lines
function parseTextToLines(text: string): SongLine[] {
  const rawLines = text.split("\n").filter((l) => l.trim());
  const lines: SongLine[] = [];

  for (let i = 0; i < rawLines.length; i += 2) {
    lines.push({
      lyrics: rawLines[i]?.trim() || "",
      indian: rawLines[i + 1]?.trim() || "",
    });
  }

  return lines.length > 0 ? lines : [{ lyrics: "", indian: "" }];
}

// Convert song lines to text format
function linesToText(lines: SongLine[]): string {
  return lines.map((l) => `${l.lyrics}\n${l.indian}`).join("\n");
}

// Keyboard shortcut note palette
const NOTE_PALETTE = [
  { label: "Sa", key: "1" },
  { label: "Re", key: "2" },
  { label: "Ga", key: "3" },
  { label: "ma", key: "4" },
  { label: "Pa", key: "5" },
  { label: "Dha", key: "6" },
  { label: "Ni", key: "7" },
  { label: "|", key: "|" },
  { label: "Re(k)", key: "" },
  { label: "Ga(k)", key: "" },
  { label: "Ma(T)", key: "" },
  { label: "Dha(k)", key: "" },
  { label: "Ni(k)", key: "" },
];

export default function NotationEditor() {
  const [song, setSong] = useState<Song>(createEmptySong);
  const [activeSection, setActiveSection] = useState(0);
  const [textInput, setTextInput] = useState(
    linesToText(createEmptySong().sections[0].lines)
  );
  const [viewMode, setViewMode] = useState<"split" | "text" | "preview">("split");
  const [history, setHistory] = useState<string[]>([]);

  const currentSection = song.sections[activeSection];

  // Parse text input into preview lines
  const previewLines = useMemo(() => parseTextToLines(textInput), [textInput]);

  // Save history snapshot
  const saveSnapshot = useCallback(() => {
    setHistory((prev) => [...prev.slice(-20), textInput]);
  }, [textInput]);

  // Undo
  const handleUndo = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setTextInput(prev);
    }
  };

  // Update song from text input
  const syncSongFromText = useCallback(() => {
    const lines = parseTextToLines(textInput);
    setSong((prev) => {
      const sections = [...prev.sections];
      sections[activeSection] = {
        ...sections[activeSection],
        lines,
      };
      return { ...prev, sections };
    });
  }, [textInput, activeSection]);

  // Insert a note at cursor position
  const insertNote = (note: string) => {
    saveSnapshot();
    setTextInput((prev) => prev + " " + note);
  };

  // Add new section
  const addSection = () => {
    const sectionNames = [
      "STHAYI",
      "ANTARA",
      "SANCHARI",
      "ABHOG",
      "BRIDGE",
      "CHORUS",
    ];
    const nextName =
      sectionNames[song.sections.length] || `Section ${song.sections.length + 1}`;

    setSong((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        { name: nextName, lines: [{ lyrics: "", indian: "" }] },
      ],
    }));
    setActiveSection(song.sections.length);
    setTextInput("");
  };

  // Remove current section
  const removeSection = () => {
    if (song.sections.length <= 1) return;
    setSong((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== activeSection),
    }));
    setActiveSection(Math.max(0, activeSection - 1));
  };

  // Switch section
  const switchSection = (index: number) => {
    syncSongFromText();
    setActiveSection(index);
    setTextInput(linesToText(song.sections[index].lines));
  };

  // Export as JSON
  const handleExport = () => {
    syncSongFromText();
    const blob = new Blob([JSON.stringify(song, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${song.id || "song"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy to clipboard
  const handleCopy = () => {
    syncSongFromText();
    navigator.clipboard.writeText(JSON.stringify(song, null, 2));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 p-4 border-b border-[var(--border-light)]">
        <div className="flex items-center gap-2">
          {/* Song title */}
          <input
            type="text"
            value={song.title}
            onChange={(e) =>
              setSong((prev) => ({ ...prev, title: e.target.value }))
            }
            className="text-lg font-semibold bg-transparent border-none outline-none text-[var(--text-primary)]"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            placeholder="Song Title"
          />
        </div>

        <div className="flex items-center gap-2">
          <NotationToggle />

          {/* View mode toggle */}
          <div className="toggle-pill ml-2">
            <button
              className={viewMode === "text" ? "active" : ""}
              onClick={() => setViewMode("text")}
              title="Text only"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
            <button
              className={viewMode === "split" ? "active" : ""}
              onClick={() => setViewMode("split")}
              title="Split view"
            >
              Split
            </button>
            <button
              className={viewMode === "preview" ? "active" : ""}
              onClick={() => setViewMode("preview")}
              title="Preview only"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleUndo}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] transition-colors"
            title="Undo"
            disabled={history.length === 0}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] transition-colors"
            title="Copy JSON"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-light)] overflow-x-auto">
        {song.sections.map((section, i) => (
          <button
            key={i}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeSection === i
                ? "bg-[var(--accent-primary)] text-white"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"
            }`}
            onClick={() => switchSection(i)}
          >
            {section.name}
          </button>
        ))}
        <button
          onClick={addSection}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] transition-colors"
          title="Add section"
        >
          <Plus className="w-4 h-4" />
        </button>
        {song.sections.length > 1 && (
          <button
            onClick={removeSection}
            className="p-1.5 rounded-lg text-[var(--accent-secondary)] hover:bg-red-50 transition-colors"
            title="Remove section"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Note palette */}
      <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-[var(--border-light)] bg-[var(--bg-secondary)]">
        {NOTE_PALETTE.map((note) => (
          <button
            key={note.label}
            onClick={() => insertNote(note.label)}
            className="px-2.5 py-1 rounded-md text-xs font-mono bg-[var(--bg-card)] border border-[var(--border-light)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white transition-colors"
            title={note.key ? `Shortcut: ${note.key}` : ""}
          >
            {note.label}
          </button>
        ))}
      </div>

      {/* Editor body */}
      <div
        className={`flex-1 overflow-hidden ${
          viewMode === "split"
            ? "editor-split"
            : "grid grid-cols-1"
        }`}
        style={{ padding: "16px" }}
      >
        {/* Text input */}
        {(viewMode === "text" || viewMode === "split") && (
          <div className="editor-input h-full">
            <textarea
              value={textInput}
              onChange={(e) => {
                saveSnapshot();
                setTextInput(e.target.value);
              }}
              onBlur={syncSongFromText}
              placeholder={`Enter lyrics and notation alternating on each line:\n\nAa chal ke tujhe\nSa Re Ga ma Pa\n\nEk aise gagan ke tale\npa Sa Re Ga ma Ga`}
              spellCheck={false}
            />
          </div>
        )}

        {/* Live preview */}
        {(viewMode === "preview" || viewMode === "split") && (
          <div className="editor-preview h-full">
            <h3 className="section-header mb-3">
              {currentSection?.name || "Preview"}
            </h3>
            <div className="space-y-1">
              {previewLines.map((line, i) => (
                <NotationLine
                  key={i}
                  line={line}
                  lineIndex={i}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Song metadata (bottom panel) */}
      <div className="border-t border-[var(--border-light)] px-4 py-3 bg-[var(--bg-secondary)]">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-[var(--text-muted)] block mb-1">
              Song ID
            </label>
            <input
              type="text"
              value={song.id}
              onChange={(e) =>
                setSong((prev) => ({
                  ...prev,
                  id: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-"),
                }))
              }
              className="w-full px-2 py-1 text-sm bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg outline-none"
              placeholder="song-id"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)] block mb-1">
              Film / Artist
            </label>
            <input
              type="text"
              value={song.info[0]?.replace("Film/Artist: ", "") || ""}
              onChange={(e) =>
                setSong((prev) => ({
                  ...prev,
                  info: [`Film/Artist: ${e.target.value}`, ...prev.info.slice(1)],
                }))
              }
              className="w-full px-2 py-1 text-sm bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg outline-none"
              placeholder="Artist name"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)] block mb-1">
              Scale
            </label>
            <input
              type="text"
              value={song.info[1]?.replace("Scale: ", "") || ""}
              onChange={(e) =>
                setSong((prev) => ({
                  ...prev,
                  info: [prev.info[0], `Scale: ${e.target.value}`, ...prev.info.slice(2)],
                }))
              }
              className="w-full px-2 py-1 text-sm bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg outline-none"
              placeholder="C MIDDLE"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)] block mb-1">
              Section Name
            </label>
            <input
              type="text"
              value={currentSection?.name || ""}
              onChange={(e) =>
                setSong((prev) => {
                  const sections = [...prev.sections];
                  sections[activeSection] = {
                    ...sections[activeSection],
                    name: e.target.value,
                  };
                  return { ...prev, sections };
                })
              }
              className="w-full px-2 py-1 text-sm bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg outline-none"
              placeholder="STHAYI"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
