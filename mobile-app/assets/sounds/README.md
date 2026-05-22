# Audio Assets

This folder contains the audio files needed by the app.

## Required Files

### Metronome
- `click.mp3` — Standard metronome click sound
- `accent.mp3` — Accented beat click (louder/higher pitch)

### Tanpura
- `tanpura-sa.mp3` — Tanpura Sa string drone sample (~3-5 seconds)
- `tanpura-pa.mp3` — Tanpura Pa string drone sample (~3-5 seconds)
- `tanpura-low-sa.mp3` — Tanpura low Sa (mandra) string sample (~3-5 seconds)
- `tanpura-ma.mp3` — Tanpura Ma string drone sample (~3-5 seconds)

## Generating Placeholder Sounds

Run the sound generator script:

```bash
cd mobile-app
node scripts/generate-sounds.js
```

This creates sine-wave based placeholder sounds. For production, replace with
high-quality recorded samples.

## Recommended Sources for Production Sounds

- Record your own tanpura samples
- Use royalty-free Indian classical instrument samples
- Generate with a synthesizer tuned to correct pitches
