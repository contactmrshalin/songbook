"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Mic, Timer, Radio } from "lucide-react";
import { Suspense } from "react";

const TABS = [
  { href: "/tools/tuner", label: "Tuner", icon: Mic },
  { href: "/tools/metronome", label: "Metronome", icon: Timer },
  { href: "/tools/tanpura", label: "Tanpura", icon: Radio },
];

/** Separated so it can be wrapped in Suspense — required by Next.js 14 for useSearchParams() */
function ToolsNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = searchParams.get("mobile") === "true";

  if (isMobile) return null;

  return (
    <nav className="sticky top-0 z-40 glass border-b border-[var(--border-light)]">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center h-14 gap-1">
          <Link
            href="/"
            className="mr-4 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            &larr; Songs
          </Link>
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--accent-primary)] text-white shadow-md"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function ToolsMain({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const isMobile = searchParams.get("mobile") === "true";

  return (
    <main className={`flex-1 w-full max-w-4xl mx-auto px-4 ${isMobile ? "py-0" : "py-8"}`}>
      {children}
    </main>
  );
}

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Suspense fallback={null}>
        <ToolsNav />
      </Suspense>
      <Suspense fallback={<main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8">{children}</main>}>
        <ToolsMain>{children}</ToolsMain>
      </Suspense>
    </div>
  );
}
