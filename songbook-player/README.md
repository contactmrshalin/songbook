# Songbook Player

Sheet music viewer, Indian/Western notation browser, playback, and arrangement editor.

## Quick start (local dev)

```bash
# First time — install all dependencies
npm run start:install

# After that
npm start
```

Opens:
- **App** → http://localhost:5173
- **API** → http://localhost:3001/api/songs

---

## Docker — production (single container, port 3001)

```bash
# Build and start (from this directory)
docker compose up --build

# Or use the npm shortcut
npm run docker:up:build
```

The container serves both the API and the built React app at **http://localhost:3001**.

### What's mounted

| Host path (relative to repo root) | Container path | Mode |
|---|---|---|
| `songs/` | `/data/songs` | read-only |
| `images/` | `/data/images` | read-only |
| `book.json` | `/data/book.json` | read-only |
| `notation_mapping.json` | `/data/notation_mapping.json` | read-only |
| Docker volume `songbook-db` | `/data/db/songbook.db` | read-write |

### Stop / remove

```bash
docker compose down          # keep DB volume
docker compose down -v       # also remove DB volume
```

---

## Docker — development (hot reload, two containers)

```bash
docker compose -f docker-compose.dev.yml up --build
# or
npm run docker:dev:build
```

- API with `--watch` → http://localhost:3001
- Vite dev server → http://localhost:5173

Changes to `server/` and `client/src/` are picked up automatically.

---

## Environment variables (server)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP port |
| `NODE_ENV` | `development` | Set to `production` to serve React app |
| `SONGBOOK_SONGS_DIR` | `../../songs` | Path to song JSON files |
| `SONGBOOK_IMAGES_DIR` | `../../images` | Path to image assets |
| `SONGBOOK_BOOK_JSON` | `../../book.json` | Song order |
| `SONGBOOK_NOTATION` | `../../notation_mapping.json` | Indian→Western mapping |
| `SONGBOOK_DB` | `./songbook.db` | SQLite database path |
| `SONGBOOK_CLIENT_DIST` | `../client/dist` | Built React app (production only) |
