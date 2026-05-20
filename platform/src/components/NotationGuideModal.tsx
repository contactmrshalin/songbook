"use client";

import { useEffect, useCallback, type ReactNode } from "react";
import { X, BookOpen, Music2 } from "lucide-react";

interface NotationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHUDDH_NOTES = [
  { sargam: "Sa", western: "C", solfege: "Do", meaning: "Root / Tonic", color: "#6C63FF" },
  { sargam: "Re", western: "D", solfege: "Re", meaning: "Second", color: "#48B9C7" },
  { sargam: "Ga", western: "E", solfege: "Mi", meaning: "Third", color: "#4CAF82" },
  { sargam: "ma", western: "F", solfege: "Fa", meaning: "Fourth (shuddh)", color: "#F6A623" },
  { sargam: "Ma", western: "F#", solfege: "—", meaning: "Fourth (tivra / sharp)", color: "#E05C5C" },
  { sargam: "Pa", western: "G", solfege: "So", meaning: "Fifth", color: "#9B6FE4" },
  { sargam: "Dha", western: "A", solfege: "La", meaning: "Sixth", color: "#3D9BE9" },
  { sargam: "Ni", western: "B", solfege: "Ti", meaning: "Seventh", color: "#EC7857" },
];

const KOMAL_NOTES = [
  { sargam: "Re(k)", western: "D♭", plain: "Komal Re", hint: "flat 2nd" },
  { sargam: "Ga(k)", western: "E♭", plain: "Komal Ga", hint: "flat 3rd" },
  { sargam: "Dha(k)", western: "A♭", plain: "Komal Dha", hint: "flat 6th" },
  { sargam: "Ni(k)", western: "B♭", plain: "Komal Ni", hint: "flat 7th" },
];

const OCTAVE_ROWS = [
  {
    label: "Low Octave",
    desc: "Below middle — three notes only",
    examples: ["pa", "dha", "ni"],
    rule: "Lowercase whole word",
    western: ["G", "A", "B"],
    badge: "low",
  },
  {
    label: "Middle Octave",
    desc: "The default / standard register",
    examples: ["Sa", "Re", "Ga", "ma", "Pa", "Dha", "Ni"],
    rule: "Title-case (no suffix)",
    western: ["C", "D", "E", "F", "G", "A", "B"],
    badge: "mid",
  },
  {
    label: "High Octave",
    desc: "Above middle — add a prime mark",
    examples: ["Sa'", "Re'", "Ga'", "Pa'"],
    rule: "Append  '  after the note",
    western: ["C′", "D′", "E′", "G′"],
    badge: "high",
  },
];

const SYMBOLS = [
  { sym: "—", label: "Rest / silence", desc: "A dash or empty space between notes — a brief pause." },
  { sym: "|", label: "Bar line", desc: "Separates beats or measures within a phrase." },
  { sym: "(k)", label: "Komal (flat)", desc: "Written after a note name: Re(k) means flat Re (D♭)." },
  { sym: "(T)", label: "Tivra (sharp)", desc: "Written after Ma: Ma(T) is the same as Ma (F#)." },
  { sym: "~", label: "Meend / glide", desc: "Smooth glide between two adjacent notes, like a slide." },
  { sym: "'", label: "High octave", desc: "Appended to a note to raise it one octave: Sa' = high Sa." },
];

export default function NotationGuideModal({ isOpen, onClose }: NotationGuideModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Modal panel */}
      <div
        className="relative w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col
                   bg-[var(--bg-primary)] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-light)]"
          style={{ background: "linear-gradient(135deg, #6C63FF18, #48B9C718)" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] leading-tight">
                How to Read Sargam Notes
              </h2>
              <p className="text-xs text-[var(--text-muted)]">Indian sargam notation guide</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center
                       bg-[var(--bg-secondary)] text-[var(--text-muted)]
                       hover:bg-[var(--accent-primary)] hover:text-white transition-colors"
            aria-label="Close guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-7">

          {/* ── Section 1: The 7 Shuddh Swar ── */}
          <section>
            <SectionHeader icon="🎵" title="The 7 Shuddh Swar (Pure Notes)" />
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Indian music uses seven basic notes (swar), comparable to the Western scale in C major.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-light)]">
                    <Th>Sargam</Th>
                    <Th>Western</Th>
                    <Th>Solfège</Th>
                    <Th>Role</Th>
                  </tr>
                </thead>
                <tbody>
                  {SHUDDH_NOTES.map((n) => (
                    <tr
                      key={n.sargam}
                      className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                      <td className="py-2 px-2">
                        <span
                          className="inline-block font-bold text-white text-xs px-2 py-0.5 rounded-md"
                          style={{ background: n.color }}
                        >
                          {n.sargam}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-mono font-semibold text-[var(--text-primary)]">
                        {n.western}
                      </td>
                      <td className="py-2 px-2 text-[var(--text-muted)]">{n.solfege}</td>
                      <td className="py-2 px-2 text-[var(--text-muted)] text-xs">{n.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              💡 <strong>ma vs Ma</strong> — lowercase <em>ma</em> = shuddh (F), uppercase <em>Ma</em> = tivra/sharp (F#).
              These are two different notes, so pay attention to capitalisation!
            </p>
          </section>

          {/* ── Section 2: Octaves ── */}
          <section>
            <SectionHeader icon="🎼" title="Octave System" />
            <p className="text-xs text-[var(--text-muted)] mb-3">
              The same note can be played in three different registers (saptak). Casing and a prime mark
              show which octave to use.
            </p>
            <div className="space-y-2">
              {OCTAVE_ROWS.map((row) => (
                <div
                  key={row.label}
                  className="rounded-xl border border-[var(--border-light)] p-3
                             bg-[var(--bg-card)] flex flex-col sm:flex-row sm:items-center gap-2"
                >
                  <div className="sm:w-28 flex-shrink-0">
                    <OctaveBadge kind={row.badge as "low" | "mid" | "high"} label={row.label} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--text-muted)] mb-1">{row.desc}</p>
                    <div className="flex flex-wrap gap-1">
                      {row.examples.map((ex) => (
                        <span
                          key={ex}
                          className="inline-block font-mono text-xs font-semibold px-2 py-0.5
                                     rounded bg-[var(--bg-secondary)] text-[var(--accent-primary)]"
                        >
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] sm:text-right sm:w-40 flex-shrink-0">
                    {row.rule}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Section 3: Komal Notes ── */}
          <section>
            <SectionHeader icon="♭" title="Komal Swar (Flat Notes)" />
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Komal means "soft" or "flat" — the note is lowered by a semitone. Written with <code className="bg-[var(--bg-secondary)] px-1 rounded text-[var(--accent-primary)]">(k)</code> after the note name.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {KOMAL_NOTES.map((n) => (
                <div
                  key={n.sargam}
                  className="rounded-xl border border-[var(--border-light)] p-3 text-center
                             bg-[var(--bg-card)]"
                >
                  <div className="font-bold text-sm text-[var(--accent-primary)] mb-1">{n.sargam}</div>
                  <div className="font-mono text-lg font-bold text-[var(--text-primary)]">{n.western}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">{n.hint}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Section 4: Special Symbols ── */}
          <section>
            <SectionHeader icon="🔣" title="Special Symbols" />
            <div className="space-y-2">
              {SYMBOLS.map((s) => (
                <div
                  key={s.sym}
                  className="flex items-start gap-3 rounded-lg border border-[var(--border-light)]
                             bg-[var(--bg-card)] px-3 py-2"
                >
                  <span
                    className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--bg-secondary)]
                               flex items-center justify-center font-mono font-bold text-base
                               text-[var(--accent-primary)]"
                  >
                    {s.sym}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{s.label}</div>
                    <div className="text-xs text-[var(--text-muted)]">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Section 5: Quick Example ── */}
          <section>
            <SectionHeader icon="✏️" title="Quick Example" />
            <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] p-4">
              <p className="text-xs text-[var(--text-muted)] mb-3">
                Here's how a simple ascending scale looks in sargam notation:
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {["pa", "ni", "Sa", "Re", "Ga", "ma", "Pa", "Dha", "Ni", "Sa'"].map((note, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <span
                      className="font-mono font-bold text-sm px-2 py-1 rounded-lg
                                 bg-[var(--bg-secondary)] text-[var(--accent-primary)]"
                    >
                      {note}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {["G", "B", "C", "D", "E", "F", "G", "A", "B", "C′"][i]}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Notice: <strong>pa</strong> and <strong>ni</strong> are lowercase → low octave.{" "}
                <strong>Sa'</strong> has a prime → high octave. Everything else is middle octave.
              </p>
            </div>
          </section>

          {/* Footer */}
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] pb-1">
            <Music2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>
              All songs on this site use the <strong>word system</strong> (Sa Re Ga…), not the letter system
              (S R G…). Western notes assume <strong>key of C</strong>.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Small helpers ─────────────────────────────────────────── */

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-lg">{icon}</span>
      <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">
        {title}
      </h3>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="text-left py-2 px-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
      {children}
    </th>
  );
}

function OctaveBadge({ kind, label }: { kind: "low" | "mid" | "high"; label: string }) {
  const styles = {
    low: "bg-blue-100 text-blue-700",
    mid: "bg-green-100 text-green-700",
    high: "bg-purple-100 text-purple-700",
  };
  return (
    <span
      className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${styles[kind]}`}
    >
      {label}
    </span>
  );
}
