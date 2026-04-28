"use client";

import Link from "next/link";
import { Music, Edit3, BookOpen, Search } from "lucide-react";
import { useAppStore } from "@/lib/store";

export default function Header() {
  const { searchQuery, setSearchQuery } = useAppStore();

  return (
    <header className="sticky top-0 z-40 glass border-b border-[var(--border-light)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <Music className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1
                className="text-lg font-bold text-[var(--text-primary)]"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                Songbook
              </h1>
              <p className="text-[0.65rem] text-[var(--text-muted)] -mt-0.5 tracking-wider uppercase">
                Musical Notations
              </p>
            </div>
          </Link>

          {/* Search */}
          <div className="hidden md:block flex-1 max-w-md mx-8">
            <div className="search-bar">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search songs, movies, singers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Browse</span>
            </Link>
            <Link
              href="/editor"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              <span className="hidden sm:inline">Editor</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
