import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.SONGBOOK_DB || path.join(__dirname, 'songbook.db');

export const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS arrangements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Default',
    tempo_bpm INTEGER NOT NULL DEFAULT 90,
    divisions INTEGER NOT NULL DEFAULT 2,
    beats INTEGER NOT NULL DEFAULT 4,
    beat_type INTEGER NOT NULL DEFAULT 4,
    note_data TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(song_id, name)
  );
  CREATE INDEX IF NOT EXISTS idx_arrangements_song_id ON arrangements(song_id);
`);

export function getArrangements(songId) {
  const stmt = db.prepare('SELECT * FROM arrangements WHERE song_id = ? ORDER BY updated_at DESC');
  return stmt.all(songId);
}

export function getArrangement(songId, arrId) {
  const stmt = db.prepare('SELECT * FROM arrangements WHERE song_id = ? AND id = ?');
  return stmt.get(songId, arrId);
}

export function createArrangement(songId, data) {
  const stmt = db.prepare(`
    INSERT INTO arrangements (song_id, name, tempo_bpm, divisions, beats, beat_type, note_data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    songId,
    data.name || 'Default',
    data.tempo_bpm ?? 90,
    data.divisions ?? 2,
    data.beats ?? 4,
    data.beat_type ?? 4,
    data.note_data ? JSON.stringify(data.note_data) : null
  );
  return info.lastInsertRowid;
}

export function updateArrangement(songId, arrId, data) {
  const stmt = db.prepare(`
    UPDATE arrangements
    SET name = COALESCE(?, name),
        tempo_bpm = COALESCE(?, tempo_bpm),
        divisions = COALESCE(?, divisions),
        beats = COALESCE(?, beats),
        beat_type = COALESCE(?, beat_type),
        note_data = COALESCE(?, note_data),
        updated_at = datetime('now')
    WHERE song_id = ? AND id = ?
  `);
  const noteDataStr = data.note_data != null ? JSON.stringify(data.note_data) : undefined;
  stmt.run(
    data.name,
    data.tempo_bpm,
    data.divisions,
    data.beats,
    data.beat_type,
    noteDataStr,
    songId,
    arrId
  );
}

export function deleteArrangement(songId, arrId) {
  const stmt = db.prepare('DELETE FROM arrangements WHERE song_id = ? AND id = ?');
  return stmt.run(songId, arrId);
}

const SONGS_DIR = process.env.SONGBOOK_SONGS_DIR || path.resolve(__dirname, '..', '..', 'songs');
const BOOK_JSON = process.env.SONGBOOK_BOOK_JSON || path.resolve(__dirname, '..', '..', 'book.json');
const NOTATION_MAPPING = process.env.SONGBOOK_NOTATION || path.resolve(__dirname, '..', '..', 'notation_mapping.json');

export function loadSongList() {
  let order = [];
  if (fs.existsSync(BOOK_JSON)) {
    const book = JSON.parse(fs.readFileSync(BOOK_JSON, 'utf8'));
    order = book.song_order || [];
  }
  const songs = [];
  if (!fs.existsSync(SONGS_DIR)) return { songs, order };
  const files = fs.readdirSync(SONGS_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(SONGS_DIR, f), 'utf8'));
      if (data.export === false) continue;
      songs.push({
        id: data.id,
        title: data.title || data.id,
        info: data.info || [],
        thumbnail: data.thumbnail,
        background: data.background,
      });
    } catch (_) {}
  }
  return { songs, order };
}

export function loadSong(songId) {
  const p = path.join(SONGS_DIR, `${songId}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function loadNotationMapping() {
  if (!fs.existsSync(NOTATION_MAPPING)) return {};
  return JSON.parse(fs.readFileSync(NOTATION_MAPPING, 'utf8'));
}
