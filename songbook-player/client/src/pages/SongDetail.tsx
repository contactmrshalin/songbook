import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchSong, fetchNotationMapping, fetchArrangements, createArrangement, updateArrangement, fetchArrangement, getImageUrl } from '../api';
import { songToNoteList } from '../lib/indianToNotes';
import { SheetMusicSection } from '../components/SheetMusicSection';
import { NotationPanel } from '../components/NotationPanel';
import { WesternNotationPanel } from '../components/WesternNotationPanel';
import type { Song, Section, ParsedNote, NotationMapping, Arrangement } from '../types';

type DetailTab = 'indian' | 'sheet' | 'western';

export function SongDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [song, setSong] = useState<Song | null>(null);
  const [mapping, setMapping] = useState<NotationMapping | null>(null);
  const [tab, setTab] = useState<DetailTab>('indian');
  const [arrangements, setArrangements] = useState<Arrangement[]>([]);
  const [currentArrId, setCurrentArrId] = useState<number | null>(null);
  const [tempoBpm, setTempoBpm] = useState(90);
  const [divisions] = useState(4);
  const [notes, setNotes] = useState<ParsedNote[]>([]);
  const [saveName, setSaveName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchSong(id) as Promise<Song>,
      fetchNotationMapping() as Promise<NotationMapping>,
    ])
      .then(([s, m]) => {
        setSong(s);
        setMapping(m);
        const list = songToNoteList(s.sections || [], 4, m, 4);
        setNotes(list);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchArrangements(id)
      .then((list) => setArrangements(list as Arrangement[]))
      .catch(() => {});
  }, [id]);

  const loadArrangement = useCallback(
    (arrId: number) => {
      if (!id) return;
      fetchArrangement(id, arrId).then((arr: unknown) => {
        const a = arr as Arrangement;
        setTempoBpm(a.tempo_bpm);
        setCurrentArrId(a.id);
        if (a.note_data?.noteList && Array.isArray(a.note_data.noteList)) {
          setNotes(a.note_data.noteList);
        }
      });
    },
    [id]
  );

  const handleSave = useCallback(async () => {
    if (!id) return;
    const name = saveName.trim() || 'Default';
    const noteData = { noteList: notes };
    try {
      if (currentArrId) {
        await updateArrangement(id, currentArrId, {
          name,
          tempo_bpm: tempoBpm,
          divisions,
          note_data: noteData,
        });
      } else {
        const { id: newId } = await createArrangement(id, {
          name,
          tempo_bpm: tempoBpm,
          divisions,
          note_data: noteData,
        });
        setCurrentArrId(newId);
        setArrangements((prev) => [
          ...prev,
          {
            id: newId,
            song_id: id,
            name,
            tempo_bpm: tempoBpm,
            divisions,
            beats: 4,
            beat_type: 4,
            note_data: noteData,
            created_at: '',
            updated_at: '',
          } as Arrangement,
        ]);
      }
    } catch (e) {
      setError(String(e));
    }
  }, [id, currentArrId, saveName, notes, tempoBpm, divisions]);

  if (loading) return <div className="page-loading">Loading…</div>;
  if (error || !song) return <div className="page-error">{error || 'Song not found'}</div>;

  const sections = (song.sections || []) as Section[];
  const headerBg = getImageUrl(song.background);

  return (
    <div
      className={`song-detail ${headerBg ? 'song-detail--has-bg' : ''}`}
      style={headerBg ? { '--songbook-bg': `url('${headerBg}')` } as React.CSSProperties : undefined}
    >
      <nav>
        <button type="button" onClick={() => navigate('/')}>
          ← Back to list
        </button>
      </nav>

      <header className="song-detail__header">
        {getImageUrl(song.thumbnail) && (
          <img
            className="song-detail__cover"
            src={getImageUrl(song.thumbnail)}
            alt=""
            width={120}
            height={120}
            onError={(e) => e.currentTarget.style.display = 'none'}
          />
        )}
        <div className="song-detail__header-meta">
          <h1>{song.title}</h1>
          {song.info?.length > 0 && (
            <ul className="song-info">
              {song.info.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      </header>

      <div className="song-detail__tabs" role="tablist" aria-label="Notation type">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'indian'}
          className={tab === 'indian' ? 'active' : ''}
          onClick={() => setTab('indian')}
        >
          Indian notation
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sheet'}
          className={tab === 'sheet' ? 'active' : ''}
          onClick={() => setTab('sheet')}
        >
          Sheet music
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'western'}
          className={tab === 'western' ? 'active' : ''}
          onClick={() => setTab('western')}
        >
          Western notes
        </button>
      </div>

      {tab === 'indian' && (
        <section className="notation-section">
          <NotationPanel sections={sections} />
        </section>
      )}

      {tab === 'sheet' && (
        <>
          <SheetMusicSection
            notes={notes}
            tempoBpm={tempoBpm}
            onTempoChange={setTempoBpm}
            onNotesChange={setNotes}
            divisions={divisions}
          />
          <section className="save-section">
            <h2>Save arrangement</h2>
            <div className="save-row">
              <input
                type="text"
                placeholder="Arrangement name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
              />
              <button type="button" className="btn btn-primary" onClick={handleSave}>
                {currentArrId ? 'Update' : 'Save'}
              </button>
            </div>
            {arrangements.length > 0 && (
              <div className="arrangement-list">
                <p>Saved arrangements:</p>
                <ul>
                  {arrangements.map((a) => (
                    <li key={a.id}>
                      <button type="button" onClick={() => loadArrangement(a.id)}>
                        {a.name} (BPM {a.tempo_bpm})
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}

      {tab === 'western' && (
        <section className="notation-section">
          <WesternNotationPanel sections={sections} mapping={mapping} />
        </section>
      )}
    </div>
  );
}
