"use client";

import { useState } from "react";
import { Lock, Music } from "lucide-react";
import Link from "next/link";
import AdminSongEditor from "@/components/AdminSongEditor";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Please enter the admin password");
      return;
    }
    // We don't validate here — the API routes check the password.
    // We just store it for subsequent API calls.
    setAuthenticated(true);
    setError("");
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen paper-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary)] flex items-center justify-center shadow-lg">
                <Music className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <h1
                  className="text-xl font-bold text-[var(--text-primary)]"
                  style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                >
                  Songbook Admin
                </h1>
                <p className="text-[0.65rem] text-[var(--text-muted)] tracking-wider uppercase">
                  Scrape &amp; Publish
                </p>
              </div>
            </Link>
          </div>

          <form
            onSubmit={handleLogin}
            className="glass rounded-2xl p-6 border border-[var(--border-light)] shadow-xl"
          >
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-[var(--text-muted)]" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Admin Access
              </h2>
            </div>

            <div className="mb-4">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-light)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm mb-3">{error}</p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[var(--accent-primary)] text-white font-medium hover:opacity-90 transition-opacity"
            >
              Enter Admin Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <AdminSongEditor password={password} />;
}
