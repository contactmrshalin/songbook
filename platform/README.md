# Songbook Platform (Next.js)

This directory contains the main Songbook web app.

Primary production host:

- `https://songnotations.vercel.app`

GitHub Pages mirror:

- `https://contactmrshalin.github.io/songbook/`

## Local development

Run from repository root:

```bash
npm install --legacy-peer-deps
npm run prebuild --workspace=platform
npm run dev --workspace=platform
```

Open `http://localhost:3000`.

## Local static export test (GitHub Pages mode)

Run from repository root:

```bash
NEXT_PUBLIC_BASE_PATH=/songbook NEXT_BUILD_STANDALONE=true npm run build --workspace=platform
```

Exported files are generated in `platform/out`.

## Deployment

- Vercel deploys from the same source as this app.
- GitHub Pages deploy is handled by:
  - `.github/workflows/deploy-nextjs-gh-pages.yml`

That workflow builds static export artifacts and publishes them to `gh-pages`.

## Song data mode

- Default behavior is bundled songs from `src/generated/song-bundle.json`.
- New/updated songs appear after each push-triggered deploy (recommended for speed/stability).
- Optional live mode can be enabled by setting `NEXT_PUBLIC_ENABLE_LIVE_SONGS=true`.
  In live mode, the client will refresh songs from GitHub/API after first render.

## Notes

- Ads are disabled by default. To enable later, set `NEXT_PUBLIC_ENABLE_ADS=true` in your environment before starting/building the app.
- Optional Propeller global tag remains separately controlled by `NEXT_PUBLIC_ENABLE_PROPELLER_GLOBAL_TAG=true` and only applies when ads are globally enabled.
- Keep image and internal links base-path aware for GitHub Pages.
- SEO/site URL constants are centralized in `src/lib/site.config.ts`.
