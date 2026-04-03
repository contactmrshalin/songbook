import { indianToWestern } from '../lib/indianToNotes';
import type { Section, Line, NotationMapping } from '../types';

interface WesternNotationPanelProps {
  sections: Section[];
  mapping: NotationMapping | null;
}

export function WesternNotationPanel({ sections, mapping }: WesternNotationPanelProps) {
  return (
    <div className="notation-panel notation-panel--western">
      {sections.map((sec, i) => (
        <section key={i} className="notation-section">
          <h4>{sec.name}</h4>
          {(sec.lines || []).map((line: Line, j: number) => (
            <div key={j} className="notation-line">
              {line.lyrics && <span className="lyrics">{line.lyrics}</span>}
              <span className="western">
                {indianToWestern(line.indian || '', 4, mapping)}
              </span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
