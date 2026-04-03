import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  loadSongList,
  loadSong,
  loadNotationMapping,
  getArrangements,
  getArrangement,
  createArrangement,
  updateArrangement,
  deleteArrangement,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.resolve(process.env.SONGBOOK_IMAGES_DIR ?? path.join(__dirname, '..', '..', 'images'));
const CLIENT_DIST = process.env.SONGBOOK_CLIENT_DIST ?? path.join(__dirname, '..', 'client', 'dist');

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

// In production serve the built React app
if (IS_PROD && fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  console.log(`Serving client from ${CLIENT_DIST}`);
}

console.log(`Images directory: ${IMAGES_DIR} (exists: ${fs.existsSync(IMAGES_DIR)})`);

// Serve images: GET /images/foo.jpeg -> IMAGES_DIR/foo.jpeg (explicit route so path is always resolved correctly)
app.get(/^\/images\/(.*)$/, (req, res) => {
  const segment = (req.params[0] ?? req.path.replace(/^\/images\/?/, '')).trim();
  const decoded = decodeURIComponent(segment);
  if (!decoded || decoded.includes('..') || path.isAbsolute(decoded)) {
    return res.status(400).send('Invalid path');
  }
  const filePath = path.join(IMAGES_DIR, path.normalize(decoded));
  const resolved = path.resolve(filePath);
  const imagesDirResolved = path.resolve(IMAGES_DIR);
  if (!resolved.startsWith(imagesDirResolved)) {
    return res.status(400).send('Invalid path');
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return res.status(404).send('Not found');
  }
  res.sendFile(resolved);
});

app.get('/api/songs', (req, res) => {
  try {
    const { songs, order } = loadSongList();
    const ordered = order.length
      ? order.map(id => songs.find(s => s.id === id)).filter(Boolean)
      : songs;
    res.json(ordered);
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.get('/api/songs/:id', (req, res) => {
  try {
    const song = loadSong(req.params.id);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    res.json(song);
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.get('/api/notation-mapping', (req, res) => {
  try {
    const mapping = loadNotationMapping();
    res.json(mapping);
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.get('/api/songs/:id/arrangements', (req, res) => {
  try {
    const list = getArrangements(req.params.id);
    res.json(list.map(row => ({
      ...row,
      note_data: row.note_data ? JSON.parse(row.note_data) : null,
    })));
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.get('/api/songs/:id/arrangements/:arrId', (req, res) => {
  try {
    const row = getArrangement(req.params.id, Number(req.params.arrId));
    if (!row) return res.status(404).json({ error: 'Arrangement not found' });
    res.json({
      ...row,
      note_data: row.note_data ? JSON.parse(row.note_data) : null,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.post('/api/songs/:id/arrangements', (req, res) => {
  try {
    const id = createArrangement(req.params.id, req.body);
    res.status(201).json({ id });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.put('/api/songs/:id/arrangements/:arrId', (req, res) => {
  try {
    updateArrangement(req.params.id, Number(req.params.arrId), req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.delete('/api/songs/:id/arrangements/:arrId', (req, res) => {
  try {
    deleteArrangement(req.params.id, Number(req.params.arrId));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

// SPA fallback: serve index.html for any non-API, non-image route in production
if (IS_PROD && fs.existsSync(CLIENT_DIST)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Songbook Player API at http://localhost:${PORT}`);
  if (IS_PROD) console.log(`React app served at http://localhost:${PORT}`);
});
