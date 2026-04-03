import { useEffect, useRef, useCallback } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

interface SheetViewerProps {
  musicXml: string | null;
  className?: string;
}

export function SheetViewer({ musicXml, className = '' }: SheetViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);

  const render = useCallback(() => {
    if (!containerRef.current || !musicXml) return;
    if (!osmdRef.current) {
      osmdRef.current = new OpenSheetMusicDisplay(containerRef.current, {
        autoResize: true,
        backend: 'svg',
      });
    }
    osmdRef.current
      .load(musicXml)
      .then(() => osmdRef.current?.render())
      .catch((err) => console.error('OSMD load/render error', err));
  }, [musicXml]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => {
    return () => {
      osmdRef.current = null;
    };
  }, []);

  if (!musicXml) {
    return (
      <div className={`sheet-viewer empty ${className}`}>
        <p>No sheet music (generate from notation above).</p>
      </div>
    );
  }

  return <div ref={containerRef} className={`sheet-viewer ${className}`} />;
}
