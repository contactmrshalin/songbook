import { useState, useRef, useEffect } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Platform } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

// Base scale options for Indian flutes (Sa = the given note)
const BASE_SCALES = [
  { label: "C", freq: 261.63 },
  { label: "C#", freq: 277.18 },
  { label: "D", freq: 293.66 },
  { label: "D#", freq: 311.13 },
  { label: "E", freq: 329.63 },
  { label: "F", freq: 349.23 },
  { label: "F#", freq: 369.99 },
  { label: "G", freq: 392.0 },
  { label: "G#", freq: 415.3 },
  { label: "A", freq: 440.0 },
  { label: "A#", freq: 466.16 },
  { label: "B", freq: 493.88 },
];

// Sargam note names with semitone offsets from Sa
const SARGAM_NOTES = [
  { sargam: "Sa", semitones: 0 },
  { sargam: "Re♭", semitones: 1 },
  { sargam: "Re", semitones: 2 },
  { sargam: "Ga♭", semitones: 3 },
  { sargam: "Ga", semitones: 4 },
  { sargam: "Ma", semitones: 5 },
  { sargam: "Ma#", semitones: 6 },
  { sargam: "Pa", semitones: 7 },
  { sargam: "Dha♭", semitones: 8 },
  { sargam: "Dha", semitones: 9 },
  { sargam: "Ni♭", semitones: 10 },
  { sargam: "Ni", semitones: 11 },
];

// Build frequency table based on selected base scale
function buildNoteFrequencies(baseFreq: number, baseLabel: string) {
  const notes: { note: string; sargam: string; freq: number }[] = [];
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const baseNoteIndex = noteNames.indexOf(baseLabel);

  // Generate 3 octaves centered around the base
  for (let octaveOffset = -1; octaveOffset <= 1; octaveOffset++) {
    for (let i = 0; i < 12; i++) {
      const semitones = octaveOffset * 12 + i;
      const freq = baseFreq * Math.pow(2, semitones / 12);
      const noteIndex = (baseNoteIndex + i) % 12;
      const octave = 4 + octaveOffset + Math.floor((baseNoteIndex + i) / 12);
      const westernNote = `${noteNames[noteIndex]}${octave}`;
      const sargam = SARGAM_NOTES[i].sargam;
      const suffix = octaveOffset === -1 ? " (Low)" : octaveOffset === 1 ? " (High)" : "";
      notes.push({ note: westernNote, sargam: sargam + suffix, freq });
    }
  }
  return notes;
}

function findClosestNote(freq: number, noteFrequencies: { note: string; sargam: string; freq: number }[]) {
  let minDiff = Infinity;
  let closest = noteFrequencies[12]; // Default Sa (middle octave)
  for (const n of noteFrequencies) {
    const diff = Math.abs(freq - n.freq);
    if (diff < minDiff) {
      minDiff = diff;
      closest = n;
    }
  }
  const cents = 1200 * Math.log2(freq / closest.freq);
  return { ...closest, cents: Math.round(cents), detectedFreq: freq };
}

// Autocorrelation pitch detection
function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  const SIZE = buffer.length;

  // Check if there's enough signal
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return null; // Too quiet

  // Autocorrelation
  const correlations = new Float32Array(SIZE);
  for (let lag = 0; lag < SIZE; lag++) {
    let sum = 0;
    for (let i = 0; i < SIZE - lag; i++) {
      sum += buffer[i] * buffer[i + lag];
    }
    correlations[lag] = sum;
  }

  // Find first dip then first peak after it
  let d = 0;
  while (d < SIZE / 2 && correlations[d] > correlations[d + 1]) d++;

  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < SIZE / 2; i++) {
    if (correlations[i] > maxVal) {
      maxVal = correlations[i];
      maxPos = i;
    }
  }

  if (maxPos === -1) return null;

  // Parabolic interpolation
  const y1 = correlations[maxPos - 1] || 0;
  const y2 = correlations[maxPos];
  const y3 = correlations[maxPos + 1] || 0;
  const shift = (y3 - y1) / (2 * (2 * y2 - y1 - y3));
  const refinedPos = maxPos + (isFinite(shift) ? shift : 0);

  return sampleRate / refinedPos;
}

// Parse WAV file and extract PCM samples as Float32Array
function decodeBase64(base64: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  // Remove padding and whitespace
  const cleaned = base64.replace(/[\s=]/g, "");
  const len = cleaned.length;
  const byteLen = Math.floor((len * 3) / 4);
  const bytes = new Uint8Array(byteLen);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = chars.indexOf(cleaned[i]);
    const b = chars.indexOf(cleaned[i + 1]);
    const c = i + 2 < len ? chars.indexOf(cleaned[i + 2]) : 0;
    const d = i + 3 < len ? chars.indexOf(cleaned[i + 3]) : 0;

    bytes[p++] = (a << 2) | (b >> 4);
    if (i + 2 < len) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < len) bytes[p++] = ((c & 3) << 6) | d;
  }

  return bytes.slice(0, p);
}

function parseWav(base64: string): { samples: Float32Array; sampleRate: number } | null {
  try {
    const bytes = decodeBase64(base64);
    if (bytes.length < 44) return null;
    const dataView = new DataView(bytes.buffer);

    // Verify RIFF header
    const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (riff !== "RIFF") return null;

    const sampleRate = dataView.getUint32(24, true);
    const bitsPerSample = dataView.getUint16(34, true);
    const numChannels = dataView.getUint16(22, true);

    // Find data chunk
    let offset = 12;
    while (offset < bytes.length - 8) {
      const chunkId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
      const chunkSize = dataView.getUint32(offset + 4, true);
      if (chunkId === "data") {
        offset += 8;
        break;
      }
      offset += 8 + chunkSize;
    }

    if (offset >= bytes.length) return null;

    const bytesPerSample = bitsPerSample / 8;
    const numSamples = Math.floor((bytes.length - offset) / (bytesPerSample * numChannels));
    const samples = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const sampleOffset = offset + i * bytesPerSample * numChannels;
      if (sampleOffset + bytesPerSample > bytes.length) break;

      if (bitsPerSample === 16) {
        const val = dataView.getInt16(sampleOffset, true);
        samples[i] = val / 32768;
      } else if (bitsPerSample === 32) {
        const val = dataView.getFloat32(sampleOffset, true);
        samples[i] = val;
      } else if (bitsPerSample === 8) {
        samples[i] = (bytes[sampleOffset] - 128) / 128;
      }
    }

    return { samples, sampleRate };
  } catch {
    return null;
  }
}

export default function TunerScreen() {
  const [isListening, setIsListening] = useState(false);
  const [baseScaleIndex, setBaseScaleIndex] = useState(0); // Default C (natural)
  const [detectedNote, setDetectedNote] = useState<{
    note: string;
    sargam: string;
    freq: number;
    cents: number;
    detectedFreq: number;
  } | null>(null);
  const isListeningRef = useRef(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const baseScaleRef = useRef(0);

  const baseScale = BASE_SCALES[baseScaleIndex];
  const noteFrequencies = buildNoteFrequencies(baseScale.freq, baseScale.label);

  useEffect(() => {
    baseScaleRef.current = baseScaleIndex;
  }, [baseScaleIndex]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  const analyzeRecording = async (recording: Audio.Recording) => {
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) return;

      const fileContent = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const wavData = parseWav(fileContent);
      if (wavData && wavData.samples.length > 0) {
        const frequency = detectPitch(wavData.samples, wavData.sampleRate);
        if (frequency && frequency > 60 && frequency < 1500) {
          const currentScale = BASE_SCALES[baseScaleRef.current];
          const currentNotes = buildNoteFrequencies(currentScale.freq, currentScale.label);
          const note = findClosestNote(frequency, currentNotes);
          setDetectedNote(note);
        } else {
          setDetectedNote(null);
        }
      }

      // Clean up the temp file
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch {}
    } catch {
      // Recording may have been interrupted
    }
  };

  const recordAndAnalyze = async () => {
    if (!isListeningRef.current) return;

    try {
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: ".wav",
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: ".wav",
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.MAX,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: "audio/wav",
          bitsPerSecond: 128000,
        },
      });

      recordingRef.current = recording;
      await recording.startAsync();

      // Record for 200ms then analyze
      setTimeout(async () => {
        if (!isListeningRef.current) return;
        await analyzeRecording(recording);
        recordingRef.current = null;
        // Start next cycle
        if (isListeningRef.current) {
          recordAndAnalyze();
        }
      }, 200);
    } catch (err) {
      console.error("Recording error:", err);
      // Retry after a short delay
      if (isListeningRef.current) {
        setTimeout(() => recordAndAnalyze(), 300);
      }
    }
  };

  const startListening = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      isListeningRef.current = true;
      setIsListening(true);
      recordAndAnalyze();
    } catch (err) {
      console.error("Failed to start tuner:", err);
    }
  };

  const stopListening = async () => {
    isListeningRef.current = false;
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }
    setIsListening(false);
    setDetectedNote(null);
  };

  const getCentsColor = (cents: number) => {
    const absCents = Math.abs(cents);
    if (absCents <= 5) return "#4caf50"; // In tune
    if (absCents <= 15) return "#ffeb3b"; // Close
    return "#ff5722"; // Off
  };

  const getCentsIndicator = (cents: number) => {
    if (Math.abs(cents) <= 5) return "✓ In Tune";
    if (cents < 0) return `♭ ${Math.abs(cents)}¢ flat`;
    return `♯ ${cents}¢ sharp`;
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Flute Tuner</Text>
      <Text style={styles.subtitle}>
        Play a note on your flute to detect pitch
      </Text>

      {/* Base Scale Selector */}
      <View style={styles.scaleSection}>
        <Text style={styles.scaleLabel}>Base Scale (Sa = )</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scaleScroll}>
          <View style={styles.scaleRow}>
            {BASE_SCALES.map((scale, idx) => (
              <TouchableOpacity
                key={scale.label}
                style={[
                  styles.scaleButton,
                  idx === baseScaleIndex && styles.scaleButtonActive,
                ]}
                onPress={() => setBaseScaleIndex(idx)}
              >
                <Text
                  style={[
                    styles.scaleButtonText,
                    idx === baseScaleIndex && styles.scaleButtonTextActive,
                  ]}
                >
                  {scale.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <Text style={styles.scaleInfo}>
          Sa = {baseScale.label} ({baseScale.freq.toFixed(1)} Hz)
        </Text>
      </View>

      {/* Tuner Display */}
      <View style={styles.tunerDisplay}>
        {detectedNote ? (
          <>
            <Text style={styles.sargamNote}>{detectedNote.sargam}</Text>
            <Text style={styles.westernNote}>{detectedNote.note}</Text>
            <Text style={styles.frequency}>
              {detectedNote.detectedFreq.toFixed(1)} Hz
            </Text>

            {/* Cents meter */}
            <View style={styles.centsContainer}>
              <View style={styles.centsBar}>
                <View
                  style={[
                    styles.centsIndicator,
                    {
                      left: `${50 + detectedNote.cents}%`,
                      backgroundColor: getCentsColor(detectedNote.cents),
                    },
                  ]}
                />
                <View style={styles.centsCenterLine} />
              </View>
              <Text
                style={[
                  styles.centsText,
                  { color: getCentsColor(detectedNote.cents) },
                ]}
              >
                {getCentsIndicator(detectedNote.cents)}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingText}>
              {isListening ? "Listening..." : "Tap to start"}
            </Text>
            {isListening && <View style={styles.listeningDot} />}
          </View>
        )}
      </View>

      {/* Note reference grid */}
      <View style={styles.noteGrid}>
        {["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni"].map((note) => (
          <View
            key={note}
            style={[
              styles.noteCell,
              detectedNote?.sargam.startsWith(note) && styles.noteCellActive,
            ]}
          >
            <Text
              style={[
                styles.noteCellText,
                detectedNote?.sargam.startsWith(note) &&
                  styles.noteCellTextActive,
              ]}
            >
              {note}
            </Text>
          </View>
        ))}
      </View>

      {/* Start/Stop Button */}
      <TouchableOpacity
        style={[styles.button, isListening && styles.buttonActive]}
        onPress={isListening ? stopListening : startListening}
      >
        <Text style={styles.buttonText}>
          {isListening ? "Stop Tuner" : "Start Tuner"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    paddingTop: 60,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    color: "#888",
    fontSize: 14,
    marginBottom: 20,
  },
  scaleSection: {
    width: "100%",
    marginBottom: 20,
    alignItems: "center",
  },
  scaleLabel: {
    color: "#aaa",
    fontSize: 14,
    marginBottom: 8,
  },
  scaleScroll: {
    maxHeight: 44,
  },
  scaleRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 4,
  },
  scaleButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#2a2a4e",
  },
  scaleButtonActive: {
    backgroundColor: "#6c63ff",
  },
  scaleButtonText: {
    color: "#aaa",
    fontSize: 14,
    fontWeight: "600",
  },
  scaleButtonTextActive: {
    color: "#fff",
  },
  scaleInfo: {
    color: "#666",
    fontSize: 12,
    marginTop: 8,
  },
  tunerDisplay: {
    width: "100%",
    alignItems: "center",
    backgroundColor: "#2a2a4e",
    borderRadius: 16,
    padding: 30,
    marginBottom: 30,
    minHeight: 200,
    justifyContent: "center",
  },
  sargamNote: {
    color: "#6c63ff",
    fontSize: 48,
    fontWeight: "bold",
  },
  westernNote: {
    color: "#aaa",
    fontSize: 20,
    marginTop: 4,
  },
  frequency: {
    color: "#666",
    fontSize: 14,
    marginTop: 8,
  },
  centsContainer: {
    width: "100%",
    alignItems: "center",
    marginTop: 20,
  },
  centsBar: {
    width: "80%",
    height: 8,
    backgroundColor: "#333",
    borderRadius: 4,
    position: "relative",
    overflow: "visible",
  },
  centsIndicator: {
    position: "absolute",
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
  },
  centsCenterLine: {
    position: "absolute",
    left: "50%",
    top: -2,
    width: 2,
    height: 12,
    backgroundColor: "#666",
    marginLeft: -1,
  },
  centsText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
  },
  waitingContainer: {
    alignItems: "center",
  },
  waitingText: {
    color: "#888",
    fontSize: 20,
  },
  listeningDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ff6b6b",
    marginTop: 12,
  },
  noteGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 30,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  noteCell: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#2a2a4e",
  },
  noteCellActive: {
    backgroundColor: "#6c63ff",
  },
  noteCellText: {
    color: "#aaa",
    fontSize: 16,
    fontWeight: "600",
  },
  noteCellTextActive: {
    color: "#fff",
  },
  button: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    backgroundColor: "#6c63ff",
  },
  buttonActive: {
    backgroundColor: "#ff6b6b",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
