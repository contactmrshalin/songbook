import { useState, useRef, useEffect } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from "react-native";
import Slider from "@react-native-community/slider";
import { Audio } from "expo-av";

// Tanpura tuning presets based on common raag practice
const TUNINGS = [
  { label: "Standard (Pa)", notes: "Pa Sa Sa Sa", key: "pa" },
  { label: "Standard (Ma)", notes: "Ma Sa Sa Sa", key: "ma" },
  { label: "Bhairavi", notes: "Ni Sa Sa Sa", key: "ni" },
  { label: "Malkauns", notes: "Sa Ma Sa Sa", key: "malkauns" },
  { label: "Yaman", notes: "Ni Sa Sa Sa", key: "yaman" },
];

const PITCH_OPTIONS = [
  { label: "C (Low)", value: "C3", hz: 130.81 },
  { label: "C#", value: "C#3", hz: 138.59 },
  { label: "D", value: "D3", hz: 146.83 },
  { label: "D#", value: "D#3", hz: 155.56 },
  { label: "E", value: "E3", hz: 164.81 },
  { label: "F", value: "F3", hz: 174.61 },
  { label: "F#", value: "F#3", hz: 185.0 },
  { label: "G", value: "G3", hz: 196.0 },
  { label: "G#", value: "G#3", hz: 207.65 },
  { label: "A", value: "A3", hz: 220.0 },
  { label: "A#", value: "A#3", hz: 233.08 },
  { label: "B", value: "B3", hz: 246.94 },
  { label: "C (Mid)", value: "C4", hz: 261.63 },
];

export default function TanpuraScreen() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTuning, setSelectedTuning] = useState(0);
  const [selectedPitch, setSelectedPitch] = useState(9); // A3 = 220Hz default
  const [volume, setVolume] = useState(0.7);
  const [tempo, setTempo] = useState(60); // Cycle speed in BPM
  const soundRefs = useRef<Audio.Sound[]>([]);
  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentStringRef = useRef(0);

  useEffect(() => {
    loadSounds();
    return () => {
      stopTanpura();
      unloadSounds();
    };
  }, []);

  const loadSounds = async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });

    // Load tanpura string samples
    const soundFiles = [
      require("../../assets/sounds/tanpura-sa.mp3"),
      require("../../assets/sounds/tanpura-pa.mp3"),
      require("../../assets/sounds/tanpura-low-sa.mp3"),
      require("../../assets/sounds/tanpura-ma.mp3"),
    ];

    const sounds: Audio.Sound[] = [];
    for (const file of soundFiles) {
      try {
        const { sound } = await Audio.Sound.createAsync(file, {
          shouldPlay: false,
          volume: volume,
          isLooping: false,
        });
        sounds.push(sound);
      } catch {
        // Sound file may not exist yet - create placeholder
        const { sound } = await Audio.Sound.createAsync(
          require("../../assets/sounds/tanpura-sa.mp3"),
          { shouldPlay: false, volume: volume, isLooping: false }
        );
        sounds.push(sound);
      }
    }
    soundRefs.current = sounds;
  };

  const unloadSounds = async () => {
    for (const sound of soundRefs.current) {
      try {
        await sound.unloadAsync();
      } catch {
        // Already unloaded
      }
    }
    soundRefs.current = [];
  };

  const playString = async (stringIndex: number) => {
    const sound = soundRefs.current[stringIndex % soundRefs.current.length];
    if (sound) {
      try {
        await sound.setVolumeAsync(volume);
        await sound.setPositionAsync(0);
        await sound.playAsync();
      } catch {
        // Playback error
      }
    }
  };

  const startTanpura = () => {
    const intervalMs = (60 / tempo) * 1000;
    currentStringRef.current = 0;

    playString(0);

    playbackIntervalRef.current = setInterval(() => {
      currentStringRef.current =
        (currentStringRef.current + 1) % 4;
      playString(currentStringRef.current);
    }, intervalMs);

    setIsPlaying(true);
  };

  const stopTanpura = () => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    setIsPlaying(false);
  };

  const togglePlayback = () => {
    if (isPlaying) {
      stopTanpura();
    } else {
      startTanpura();
    }
  };

  // Update volume on all sounds
  useEffect(() => {
    soundRefs.current.forEach(async (sound) => {
      try {
        await sound.setVolumeAsync(volume);
      } catch {}
    });
  }, [volume]);

  // Restart if tempo changes while playing
  useEffect(() => {
    if (isPlaying) {
      stopTanpura();
      startTanpura();
    }
  }, [tempo]);

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.container}
    >
      <Text style={styles.title}>Tanpura</Text>
      <Text style={styles.subtitle}>
        Continuous drone for riyaaz practice
      </Text>

      {/* Visualization */}
      <View style={styles.tanpuraVisual}>
        <View style={styles.stringsContainer}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.string,
                isPlaying &&
                  currentStringRef.current === i &&
                  styles.stringActive,
              ]}
            >
              <View
                style={[
                  styles.stringLine,
                  isPlaying &&
                    currentStringRef.current === i &&
                    styles.stringLineActive,
                ]}
              />
              <Text style={styles.stringLabel}>
                {i === 0
                  ? "Pa/Ma"
                  : i === 1
                  ? "Sa"
                  : i === 2
                  ? "Sa"
                  : "Sa↓"}
              </Text>
            </View>
          ))}
        </View>
        {isPlaying && (
          <Text style={styles.playingLabel}>
            ♪ {TUNINGS[selectedTuning].notes}
          </Text>
        )}
      </View>

      {/* Tuning Selection */}
      <Text style={styles.sectionLabel}>Tuning</Text>
      <View style={styles.tuningRow}>
        {TUNINGS.map((tuning, idx) => (
          <TouchableOpacity
            key={tuning.key}
            style={[
              styles.tuningButton,
              idx === selectedTuning && styles.tuningButtonActive,
            ]}
            onPress={() => setSelectedTuning(idx)}
          >
            <Text
              style={[
                styles.tuningButtonText,
                idx === selectedTuning && styles.tuningButtonTextActive,
              ]}
            >
              {tuning.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pitch (Sa) Selection */}
      <Text style={styles.sectionLabel}>
        Base Pitch (Sa = {PITCH_OPTIONS[selectedPitch].label})
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pitchScroll}
      >
        <View style={styles.pitchRow}>
          {PITCH_OPTIONS.map((pitch, idx) => (
            <TouchableOpacity
              key={pitch.value}
              style={[
                styles.pitchButton,
                idx === selectedPitch && styles.pitchButtonActive,
              ]}
              onPress={() => setSelectedPitch(idx)}
            >
              <Text
                style={[
                  styles.pitchButtonText,
                  idx === selectedPitch && styles.pitchButtonTextActive,
                ]}
              >
                {pitch.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Volume */}
      <Text style={styles.sectionLabel}>
        Volume: {Math.round(volume * 100)}%
      </Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={1}
        value={volume}
        onValueChange={setVolume}
        minimumTrackTintColor="#6c63ff"
        maximumTrackTintColor="#444"
        thumbTintColor="#6c63ff"
      />

      {/* Tempo */}
      <Text style={styles.sectionLabel}>
        Cycle Speed: {tempo} BPM
      </Text>
      <Slider
        style={styles.slider}
        minimumValue={30}
        maximumValue={120}
        value={tempo}
        onValueChange={(val) => setTempo(Math.round(val))}
        minimumTrackTintColor="#6c63ff"
        maximumTrackTintColor="#444"
        thumbTintColor="#6c63ff"
        step={1}
      />

      {/* Play/Stop Button */}
      <TouchableOpacity
        style={[styles.playButton, isPlaying && styles.playButtonActive]}
        onPress={togglePlayback}
      >
        <Text style={styles.playButtonText}>
          {isPlaying ? "⏹  Stop Tanpura" : "▶  Play Tanpura"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  container: {
    alignItems: "center",
    padding: 20,
    paddingBottom: 40,
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
    marginBottom: 24,
  },
  tanpuraVisual: {
    width: "100%",
    backgroundColor: "#2a2a4e",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
  },
  stringsContainer: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 16,
  },
  string: {
    alignItems: "center",
    gap: 8,
  },
  stringActive: {
    transform: [{ scale: 1.1 }],
  },
  stringLine: {
    width: 3,
    height: 80,
    backgroundColor: "#555",
    borderRadius: 2,
  },
  stringLineActive: {
    backgroundColor: "#6c63ff",
    width: 4,
    shadowColor: "#6c63ff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  stringLabel: {
    color: "#aaa",
    fontSize: 12,
  },
  playingLabel: {
    color: "#6c63ff",
    fontSize: 16,
    fontWeight: "600",
  },
  sectionLabel: {
    color: "#ccc",
    fontSize: 14,
    alignSelf: "flex-start",
    marginBottom: 8,
    marginTop: 8,
  },
  tuningRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
    width: "100%",
  },
  tuningButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#2a2a4e",
  },
  tuningButtonActive: {
    backgroundColor: "#6c63ff",
  },
  tuningButtonText: {
    color: "#aaa",
    fontSize: 13,
  },
  tuningButtonTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  pitchScroll: {
    width: "100%",
    marginBottom: 16,
  },
  pitchRow: {
    flexDirection: "row",
    gap: 8,
  },
  pitchButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#2a2a4e",
  },
  pitchButtonActive: {
    backgroundColor: "#6c63ff",
  },
  pitchButtonText: {
    color: "#aaa",
    fontSize: 13,
  },
  pitchButtonTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  slider: {
    width: "100%",
    height: 40,
    marginBottom: 12,
  },
  playButton: {
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 30,
    backgroundColor: "#6c63ff",
    marginTop: 16,
  },
  playButtonActive: {
    backgroundColor: "#ff6b6b",
  },
  playButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
