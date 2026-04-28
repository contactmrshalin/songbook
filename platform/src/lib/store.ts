import { create } from "zustand";
import type { NotationMode } from "@/types/song";

interface AppState {
  // Notation display
  notationMode: NotationMode;
  setNotationMode: (mode: NotationMode) => void;

  // Audio playback
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  tempo: number;
  setTempo: (tempo: number) => void;
  currentNoteIndex: number;
  setCurrentNoteIndex: (index: number) => void;
  currentTokenIndex: number;
  setCurrentTokenIndex: (index: number) => void;
  loopStart: number | null;
  loopEnd: number | null;
  setLoop: (start: number | null, end: number | null) => void;
  metronomeEnabled: boolean;
  setMetronomeEnabled: (enabled: boolean) => void;
  instrument: string;
  setInstrument: (instrument: string) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Editor
  isEditorOpen: boolean;
  setIsEditorOpen: (open: boolean) => void;

  // Fingering diagrams
  showFingerings: boolean;
  setShowFingerings: (show: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Notation
  notationMode: "indian",
  setNotationMode: (mode) => set({ notationMode: mode }),

  // Audio
  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  tempo: 100,
  setTempo: (tempo) => set({ tempo }),
  currentNoteIndex: -1,
  setCurrentNoteIndex: (index) => set({ currentNoteIndex: index }),
  currentTokenIndex: -1,
  setCurrentTokenIndex: (index) => set({ currentTokenIndex: index }),
  loopStart: null,
  loopEnd: null,
  setLoop: (start, end) => set({ loopStart: start, loopEnd: end }),
  metronomeEnabled: false,
  setMetronomeEnabled: (enabled) => set({ metronomeEnabled: enabled }),
  instrument: "flute",
  setInstrument: (instrument) => set({ instrument }),

  // Search
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Editor
  isEditorOpen: false,
  setIsEditorOpen: (open) => set({ isEditorOpen: open }),

  // Fingerings
  showFingerings: false,
  setShowFingerings: (show) => set({ showFingerings: show }),
}));
