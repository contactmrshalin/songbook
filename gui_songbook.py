#!/usr/bin/env python3
"""
Drag-and-drop GUI for the Songbook Pipeline.

Features:
- Drop DOCX files (or Add Files)
- Convert → songs.json (auto ornaments)
- Build PDF / EPUB / MusicXML
"""

from __future__ import annotations

import subprocess
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

# Drag & drop support (optional)
try:
    from tkinterdnd2 import DND_FILES, TkinterDnD
    DND_OK = True
except Exception:
    DND_OK = False

from convert_docx_to_json import extract_song_from_docx, merge_songs_into_json


APP_DIR = Path(".").resolve()
DEFAULT_SONGS_JSON = APP_DIR / "songs.json"
OUTPUT_DIR = APP_DIR / "output"


class App:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Songbook Builder (PDF / EPUB / MusicXML)")
        self.files: list[str] = []

        frm = ttk.Frame(root, padding=10)
        frm.pack(fill="both", expand=True)

        self.lbl = ttk.Label(frm, text="Drop DOCX files here (or use Add Files).")
        self.lbl.pack(anchor="w")

        self.listbox = tk.Listbox(frm, height=10)
        self.listbox.pack(fill="both", expand=True, pady=8)

        btnrow = ttk.Frame(frm)
        btnrow.pack(fill="x", pady=6)

        ttk.Button(btnrow, text="Add Files…", command=self.add_files).pack(side="left")
        ttk.Button(btnrow, text="Clear", command=self.clear).pack(side="left", padx=6)

        opt = ttk.Labelframe(frm, text="Build Options", padding=10)
        opt.pack(fill="x", pady=8)

        self.format_var = tk.StringVar(value="both")
        ttk.Label(opt, text="Output:").grid(row=0, column=0, sticky="w")
        ttk.Combobox(opt, textvariable=self.format_var, values=["pdf", "epub", "both", "musicxml", "all"], width=12)\
            .grid(row=0, column=1, sticky="w", padx=6)

        self.page_var = tk.StringVar(value="A5")
        ttk.Label(opt, text="PDF Page:").grid(row=0, column=2, sticky="w", padx=(16, 0))
        ttk.Combobox(opt, textvariable=self.page_var, values=["A5", "LETTER"], width=10)\
            .grid(row=0, column=3, sticky="w", padx=6)

        self.bg_opacity = tk.DoubleVar(value=0.08)
        ttk.Label(opt, text="PDF BG Opacity:").grid(row=1, column=0, sticky="w", pady=(6, 0))
        ttk.Entry(opt, textvariable=self.bg_opacity, width=8).grid(row=1, column=1, sticky="w", padx=6, pady=(6, 0))

        self.pdf_bg_mode = tk.StringVar(value="cover")
        ttk.Label(opt, text="PDF BG Mode:").grid(row=2, column=0, sticky="w", pady=(6, 0))
        ttk.Combobox(opt, textvariable=self.pdf_bg_mode, values=["cover", "tile", "contain"], width=12)\
            .grid(row=2, column=1, sticky="w", padx=6, pady=(6, 0))

        self.epub_bg_opacity = tk.DoubleVar(value=0.10)
        ttk.Label(opt, text="EPUB BG Opacity:").grid(row=1, column=2, sticky="w", padx=(16, 0), pady=(6, 0))
        ttk.Entry(opt, textvariable=self.epub_bg_opacity, width=8).grid(row=1, column=3, sticky="w", padx=6, pady=(6, 0))

        act = ttk.Frame(frm)
        act.pack(fill="x", pady=10)
        ttk.Button(act, text="Convert DOCX → songs.json", command=self.convert).pack(side="left")
        ttk.Button(act, text="Build Outputs", command=self.build).pack(side="left", padx=8)
        ttk.Button(act, text="Open Output Folder", command=self.open_output).pack(side="left", padx=8)

        # Drag/drop wiring
        if DND_OK and hasattr(self.listbox, "drop_target_register"):
            self.listbox.drop_target_register(DND_FILES)
            self.listbox.dnd_bind("<<Drop>>", self.on_drop)
            self.lbl.configure(text="Drop DOCX files here (drag & drop enabled).")
        else:
            self.lbl.configure(text="Drag & drop not available. Use Add Files… (pip install tkinterdnd2)")

    def on_drop(self, event):
        paths = self.root.tk.splitlist(event.data)
        for p in paths:
            self.add_path(p)

    def add_path(self, p: str):
        pth = Path(p)
        if pth.suffix.lower() == ".docx":
            s = str(pth)
            if s not in self.files:
                self.files.append(s)
                self.listbox.insert("end", s)
        else:
            messagebox.showwarning("Skipped", f"Not a DOCX: {pth.name}")

    def add_files(self):
        paths = filedialog.askopenfilenames(filetypes=[("Word files", "*.docx")])
        for p in paths:
            self.add_path(p)

    def clear(self):
        self.files = []
        self.listbox.delete(0, "end")

    def convert(self):
        if not self.files:
            messagebox.showinfo("No files", "Add at least one DOCX file first.")
            return

        songs = []
        for f in self.files:
            try:
                songs.append(extract_song_from_docx(Path(f)))
            except Exception as e:
                messagebox.showerror("Extract failed", f"{Path(f).name}\n\n{e}")
                return

        merge_songs_into_json(DEFAULT_SONGS_JSON, songs)
        messagebox.showinfo("Done", f"Added/updated {len(songs)} song(s) into:\n{DEFAULT_SONGS_JSON}")

    def build(self):
        script = APP_DIR / "build_songbook.py"
        if not script.exists():
            messagebox.showerror("Missing", "build_songbook.py not found in this folder.")
            return

        OUTPUT_DIR.mkdir(exist_ok=True)

        fmt = self.format_var.get()
        page = self.page_var.get()
        pdf_bg_mode = self.pdf_bg_mode.get()
        try:
            bg = float(self.bg_opacity.get())
            ebg = float(self.epub_bg_opacity.get())
        except Exception:
            messagebox.showerror("Invalid", "Opacity must be a number.")
            return

        cmd = [
            "python", str(script),
            "--input", str(DEFAULT_SONGS_JSON.name),
            "--outdir", str(OUTPUT_DIR.name),
            "--format", fmt,
            "--page", page,
            "--bg-opacity", str(bg),
            "--pdf-bg-mode", str(pdf_bg_mode),
            "--epub-bg-opacity", str(ebg),
        ]

        try:
            subprocess.check_call(cmd)
            messagebox.showinfo("Built", f"Build complete.\nSee: {OUTPUT_DIR}")
        except subprocess.CalledProcessError as e:
            messagebox.showerror("Build failed", str(e))

    def open_output(self):
        OUTPUT_DIR.mkdir(exist_ok=True)
        import os, sys
        if sys.platform.startswith("darwin"):
            os.system(f'open "{OUTPUT_DIR}"')
        elif sys.platform.startswith("win"):
            os.system(f'explorer "{OUTPUT_DIR}"')
        else:
            os.system(f'xdg-open "{OUTPUT_DIR}"')


def main():
    if DND_OK:
        root = TkinterDnD.Tk()  # type: ignore
    else:
        root = tk.Tk()
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
