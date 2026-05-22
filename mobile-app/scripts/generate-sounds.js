/**
 * Generate placeholder audio files for the app.
 * These are simple sine-wave tones encoded as WAV files.
 * Replace with real instrument samples for production.
 *
 * Usage: node scripts/generate-sounds.js
 */

const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 44100;
const SOUNDS_DIR = path.join(__dirname, "..", "assets", "sounds");

function generateSineWave(frequency, durationSec, volume = 0.5) {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const buffer = Buffer.alloc(numSamples * 2); // 16-bit mono

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    // Apply fade in/out envelope
    let envelope = 1.0;
    const fadeTime = 0.05;
    if (t < fadeTime) envelope = t / fadeTime;
    if (t > durationSec - fadeTime)
      envelope = (durationSec - t) / fadeTime;

    const sample = Math.sin(2 * Math.PI * frequency * t) * volume * envelope;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    buffer.writeInt16LE(intSample, i * 2);
  }

  return buffer;
}

function createWavFile(sampleData) {
  const dataSize = sampleData.length;
  const header = Buffer.alloc(44);

  // RIFF header
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);

  // fmt chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, sampleData]);
}

// Ensure output directory exists
fs.mkdirSync(SOUNDS_DIR, { recursive: true });

const sounds = [
  // Metronome sounds
  { name: "click.mp3", freq: 1000, duration: 0.05, volume: 0.8 },
  { name: "accent.mp3", freq: 1500, duration: 0.06, volume: 1.0 },
  // Tanpura sounds (using appropriate frequencies)
  { name: "tanpura-sa.mp3", freq: 261.63, duration: 4.0, volume: 0.6 },
  { name: "tanpura-pa.mp3", freq: 392.0, duration: 4.0, volume: 0.5 },
  { name: "tanpura-low-sa.mp3", freq: 130.81, duration: 4.0, volume: 0.6 },
  { name: "tanpura-ma.mp3", freq: 349.23, duration: 4.0, volume: 0.5 },
];

for (const sound of sounds) {
  const sineData = generateSineWave(sound.freq, sound.duration, sound.volume);
  const wavData = createWavFile(sineData);

  // Save as .wav regardless of name extension (expo-av handles both)
  const outputName = sound.name.replace(".mp3", ".wav");
  const outputPath = path.join(SOUNDS_DIR, outputName);
  fs.writeFileSync(outputPath, wavData);

  // Also save with .mp3 extension so require() works (it's still WAV internally)
  const mp3Path = path.join(SOUNDS_DIR, sound.name);
  fs.writeFileSync(mp3Path, wavData);

  console.log(`Generated: ${sound.name} (${sound.freq}Hz, ${sound.duration}s)`);
}

console.log("\nAll placeholder sounds generated in assets/sounds/");
console.log("Replace with real instrument samples for production quality.");
