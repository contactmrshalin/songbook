import type { Section, Line } from '../types';

interface NotationPanelProps {
  sections: Section[];
  title?: string;
}

export function NotationPanel({ sections, title }: NotationPanelProps) {
  return (
    <div className="notation-panel">
      {title && <h3>{title}</h3>}
      {sections.map((sec, i) => (
        <section key={i} className="notation-section">
          <h4>{sec.name}</h4>
          {sec.lines?.map((line: Line, j: number) => (
            <div key={j} className="notation-line">
              {line.lyrics && <span className="lyrics">{line.lyrics}</span>}
              <span className="indian">{line.indian}</span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
