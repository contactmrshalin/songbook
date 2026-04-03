import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchSongs, getImageUrl } from '../api';
import type { SongSummary } from '../types';

export function SongList() {
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSongs()
      .then(setSongs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">Loading songs…</div>;
  if (error) return <div className="page-error">Error: {error}. Is the API server running on port 3001?</div>;

  return (
    <div className="song-list">
      <h1>Songbook Player</h1>
      <p className="subtitle">Sheet music (MusicXML), Indian & Western notation, playback, and editable arrangements.</p>
      <section className="song-list__grid" aria-label="Songs">
        {songs.map((s) => (
          <Link
            key={s.id}
            className="card songbook-card"
            to={`/song/${s.id}`}
            title={s.title}
          >
            <figure className="songbook-card__figure">
              {getImageUrl(s.thumbnail) ? (
                <img
                  src={getImageUrl(s.thumbnail)}
                  alt=""
                  width={220}
                  height={220}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const pl = e.currentTarget.nextElementSibling as HTMLElement;
                    if (pl?.classList.contains('songbook-card__placeholder')) pl.style.display = 'block';
                  }}
                />
              ) : null}
              <div className="songbook-card__placeholder" aria-hidden style={{ display: getImageUrl(s.thumbnail) ? 'none' : 'block' }} />
            </figure>
            <div className="songbook-card__body">
              <h2 className="songbook-card__title">{s.title}</h2>
              {s.info?.[0] && (
                <p className="songbook-card__subtitle">{s.info[0]}</p>
              )}
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
