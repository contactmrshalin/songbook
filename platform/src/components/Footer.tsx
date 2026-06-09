export default function Footer() {
  return (
    <footer className="border-t border-[var(--border-light)] py-6 text-center text-sm text-[var(--text-muted)]">
      <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-3">
        {/* Primary links row */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6">
          <span>© {new Date().getFullYear()} Songbook</span>
          <a
            href="/privacy"
            className="hover:text-[var(--accent-primary)] transition-colors underline"
          >
            Privacy Policy
          </a>
        </div>

        {/* Image / content disclaimer */}
        <p className="text-[0.72rem] text-[var(--text-muted)] max-w-2xl leading-relaxed opacity-80">
          Album artwork and images are the property of their respective copyright
          holders (record labels, artists, and studios) and are used solely for
          identification and educational purposes under fair use. Song notations
          on this site are independently transcribed for non-commercial, personal
          study. This site is not affiliated with Spotify, any music label, or
          streaming service.
        </p>
      </div>
    </footer>
  );
}
