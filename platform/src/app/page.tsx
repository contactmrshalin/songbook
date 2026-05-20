import { getAllSongs } from "@/lib/songs";
import Header from "@/components/Header";
import SongGallery from "@/components/SongGallery";
import AdBanner from "@/components/AdBanner";
import { AD_SLOTS } from "@/lib/ads.config";

export default function Home() {
  const songs = getAllSongs();

  return (
    <>
      <Header />
      <main className="flex-1 w-full">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, rgba(108,99,255,0.07) 0%, rgba(255,101,132,0.05) 60%, rgba(245,166,35,0.04) 100%)",
            borderBottom: "1px solid var(--border-light)",
          }}
        >
          {/* Decorative staff lines */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none overflow-hidden"
          >
            {[30, 42, 54, 66, 78].map((pct) => (
              <div
                key={pct}
                className="absolute left-0 right-0"
                style={{
                  top: `${pct}%`,
                  height: "1px",
                  background: "rgba(108,99,255,0.08)",
                }}
              />
            ))}
            {/* Treble-clef-ish floating notes */}
            <span
              className="absolute text-[7rem] leading-none select-none"
              style={{
                right: "6%",
                top: "50%",
                transform: "translateY(-50%)",
                color: "rgba(108,99,255,0.06)",
                fontFamily: "serif",
              }}
            >
              𝄞
            </span>
            <span
              className="absolute text-[4rem] leading-none select-none hidden sm:block"
              style={{
                right: "18%",
                bottom: "10%",
                color: "rgba(255,101,132,0.07)",
                fontFamily: "serif",
              }}
            >
              ♩
            </span>
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            {/* Sargam badge */}
            <div className="inline-flex items-center gap-2 mb-4">
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide"
                style={{
                  background: "rgba(108,99,255,0.1)",
                  color: "var(--accent-primary)",
                  border: "1px solid rgba(108,99,255,0.18)",
                }}
              >
                Sa Re Ga Ma Pa Dha Ni
              </span>
            </div>

            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4"
              style={{
                fontFamily: "'Libre Baskerville', Georgia, serif",
                color: "var(--text-primary)",
              }}
            >
              Learn Indian Classical
              <br />
              <span style={{ color: "var(--accent-primary)" }}>Sargam Notations</span>
            </h1>

            <p
              className="text-base sm:text-lg max-w-xl mb-8 leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              Play your favourite Bollywood melodies on flute, harmonium, or piano
              with accurate sargam notations — highlighted note by note as you listen.
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap gap-6">
              {[
                { value: `${songs.length}+`, label: "Songs" },
                { value: "3", label: "Notation modes" },
                { value: "Free", label: "Always" },
              ].map(({ value, label }) => (
                <div key={label} className="flex flex-col">
                  <span
                    className="text-2xl font-bold"
                    style={{ color: "var(--accent-primary)" }}
                  >
                    {value}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Song grid ────────────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          {/* Browse heading */}
          <div className="flex items-baseline justify-between mb-6">
            <h2
              className="text-xl font-semibold"
              style={{
                fontFamily: "'Libre Baskerville', Georgia, serif",
                color: "var(--text-primary)",
              }}
            >
              Browse Notations
            </h2>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              {songs.length} songs
            </span>
          </div>

          {/* Ad: Top of homepage */}
          <div className="mb-6">
            <AdBanner
              slot={AD_SLOTS.HOME_TOP}
              format="horizontal"
              className="ad-home-top"
            />
          </div>

          <SongGallery songs={songs} />
        </div>
      </main>
    </>
  );
}
