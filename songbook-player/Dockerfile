# ── Stage 1: build the React client ────────────────────────────────────────
FROM node:20-alpine AS client-builder

WORKDIR /build/client
COPY client/package*.json ./
RUN npm ci

COPY client/ ./
# Build with production env (VITE_API_BASE='' so same-origin)
RUN npm run build


# ── Stage 2: production image ───────────────────────────────────────────────
FROM node:20-alpine AS production

# native addon (better-sqlite3) needs build tools at install time
RUN apk add --no-cache python3 make g++

WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ ./

# Pull in the built client
COPY --from=client-builder /build/client/dist /app/client/dist

# Data dirs — override with bind-mounts or named volumes
ENV SONGBOOK_SONGS_DIR=/data/songs \
    SONGBOOK_IMAGES_DIR=/data/images \
    SONGBOOK_NOTATION=/data/notation_mapping.json \
    SONGBOOK_DB=/data/db/songbook.db \
    SONGBOOK_CLIENT_DIST=/app/client/dist \
    NODE_ENV=production \
    PORT=3001

EXPOSE 3001

# Ensure DB directory exists at runtime
CMD ["sh", "-c", "mkdir -p /data/db && node index.js"]
