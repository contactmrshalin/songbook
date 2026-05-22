import { useState, useRef, useCallback, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Vibration,
  Switch,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Audio } from "expo-av";

const MIN_BPM = 30;
const MAX_BPM = 240;
const TIME_SIGNATURES = [
  { beats: 4, label: "4/4" },
  { beats: 3, label: "3/4" },
  { beats: 6, label: "6/8" },
  { beats: 7, label: "7/8" },
];

export default function MetronomeScreen() {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [timeSignatureIndex, setTimeSignatureIndex] = useState(0);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const vibrationRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const accentSoundRef = useRef<Audio.Sound | null>(null);
  const tapTimesRef = useRef<number[]>([]);

  const timeSignature = TIME_SIGNATURES[timeSignatureIndex];

  useEffect(() => {
    loadSounds();
    return () => {
      stopMetronome();
      soundRef.current?.unloadAsync();
      accentSoundRef.current?.unloadAsync();
    };
  }, []);

  const loadSounds = async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });

    const { sound: clickSound } = await Audio.Sound.createAsync(
      require("../../assets/sounds/click.mp3"),
      { shouldPlay: false }
    );
    soundRef.current = clickSound;

    const { sound: accentSound } = await Audio.Sound.createAsync(
      require("../../assets/sounds/accent.mp3"),
      { shouldPlay: false }
    );
    accentSoundRef.current = accentSound;
  };

  useEffect(() => {
    vibrationRef.current = vibrationEnabled;
  }, [vibrationEnabled]);

  const playClick = useCallback(
    async (beat: number) => {
      try {
        if (beat === 0 && accentSoundRef.current) {
          await accentSoundRef.current.setPositionAsync(0);
          await accentSoundRef.current.playAsync();
        } else if (soundRef.current) {
          await soundRef.current.setPositionAsync(0);
          await soundRef.current.playAsync();
        }
        if (vibrationRef.current) {
          Vibration.vibrate(beat === 0 ? 30 : 10);
        }
      } catch {
        // Sound playback error - continue
      }
    },
    []
  );

  const startMetronome = useCallback(() => {
    const intervalMs = (60 / bpm) * 1000;
    let beat = 0;

    setCurrentBeat(0);
    playClick(0);

    intervalRef.current = setInterval(() => {
      beat = (beat + 1) % timeSignature.beats;
      setCurrentBeat(beat);
      playClick(beat);
    }, intervalMs);

    setIsPlaying(true);
  }, [bpm, timeSignature.beats, playClick]);

  const stopMetronome = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
    setCurrentBeat(0);
  }, []);

  const togglePlayback = () => {
    if (isPlaying) {
      stopMetronome();
    } else {
      startMetronome();
    }
  };

  // Restart metronome when BPM changes during playback
  useEffect(() => {
    if (isPlaying) {
      stopMetronome();
      startMetronome();
    }
  }, [bpm, timeSignatureIndex]);

  const handleTapTempo = () => {
    const now = Date.now();
    const taps = tapTimesRef.current;

    // Keep only taps within last 3 seconds
    const recentTaps = taps.filter((t) => now - t < 3000);
    recentTaps.push(now);
    tapTimesRef.current = recentTaps;

    if (recentTaps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < recentTaps.length; i++) {
        intervals.push(recentTaps[i] - recentTaps[i - 1]);
      }
      const avgInterval =
        intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const tapBpm = Math.round(60000 / avgInterval);
      if (tapBpm >= MIN_BPM && tapBpm <= MAX_BPM) {
        setBpm(tapBpm);
      }
    }
  };

  const adjustBpm = (delta: number) => {
    setBpm((prev) => Math.max(MIN_BPM, Math.min(MAX_BPM, prev + delta)));
  };

  return (
    <View style={styles.container}>
      {/* BPM Display */}
      <View style={styles.bpmContainer}>
        <Text style={styles.bpmLabel}>BPM</Text>
        <Text style={styles.bpmValue}>{bpm}</Text>
      </View>

      {/* Beat Indicators */}
      <View style={styles.beatContainer}>
        {Array.from({ length: timeSignature.beats }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.beatDot,
              i === currentBeat && isPlaying && styles.beatDotActive,
              i === 0 && styles.beatDotAccent,
              i === 0 && i === currentBeat && isPlaying && styles.beatDotAccentActive,
            ]}
          />
        ))}
      </View>

      {/* Time Signature */}
      <View style={styles.timeSignatureRow}>
        {TIME_SIGNATURES.map((ts, idx) => (
          <TouchableOpacity
            key={ts.label}
            style={[
              styles.tsButton,
              idx === timeSignatureIndex && styles.tsButtonActive,
            ]}
            onPress={() => setTimeSignatureIndex(idx)}
          >
            <Text
              style={[
                styles.tsButtonText,
                idx === timeSignatureIndex && styles.tsButtonTextActive,
              ]}
            >
              {ts.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* BPM Slider */}
      <View style={styles.sliderContainer}>
        <TouchableOpacity style={styles.adjustButton} onPress={() => adjustBpm(-1)}>
          <Text style={styles.adjustButtonText}>−</Text>
        </TouchableOpacity>
        <Slider
          style={styles.slider}
          minimumValue={MIN_BPM}
          maximumValue={MAX_BPM}
          value={bpm}
          onValueChange={(val) => setBpm(Math.round(val))}
          minimumTrackTintColor="#6c63ff"
          maximumTrackTintColor="#444"
          thumbTintColor="#6c63ff"
          step={1}
        />
        <TouchableOpacity style={styles.adjustButton} onPress={() => adjustBpm(1)}>
          <Text style={styles.adjustButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity style={styles.tapButton} onPress={handleTapTempo}>
          <Text style={styles.tapButtonText}>TAP{"\n"}TEMPO</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.playButton, isPlaying && styles.playButtonActive]}
          onPress={togglePlayback}
        >
          <Text style={styles.playButtonText}>
            {isPlaying ? "⏹" : "▶"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Vibration Toggle */}
      <View style={styles.vibrationRow}>
        <Text style={styles.vibrationLabel}>Vibration</Text>
        <Switch
          value={vibrationEnabled}
          onValueChange={setVibrationEnabled}
          trackColor={{ false: "#333", true: "#6c63ff" }}
          thumbColor={vibrationEnabled ? "#fff" : "#888"}
        />
      </View>

      {/* Preset BPMs */}
      <View style={styles.presetRow}>
        {[60, 80, 100, 120, 140, 160].map((preset) => (
          <TouchableOpacity
            key={preset}
            style={[styles.presetButton, bpm === preset && styles.presetButtonActive]}
            onPress={() => setBpm(preset)}
          >
            <Text style={[styles.presetText, bpm === preset && styles.presetTextActive]}>
              {preset}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  bpmContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  bpmLabel: {
    color: "#888",
    fontSize: 16,
    letterSpacing: 2,
  },
  bpmValue: {
    color: "#fff",
    fontSize: 72,
    fontWeight: "bold",
  },
  beatContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 30,
  },
  beatDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#333",
    borderWidth: 2,
    borderColor: "#555",
  },
  beatDotActive: {
    backgroundColor: "#6c63ff",
    borderColor: "#6c63ff",
  },
  beatDotAccent: {
    borderColor: "#ff6b6b",
  },
  beatDotAccentActive: {
    backgroundColor: "#ff6b6b",
    borderColor: "#ff6b6b",
  },
  timeSignatureRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 30,
  },
  tsButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#2a2a4e",
  },
  tsButtonActive: {
    backgroundColor: "#6c63ff",
  },
  tsButtonText: {
    color: "#aaa",
    fontSize: 16,
    fontWeight: "600",
  },
  tsButtonTextActive: {
    color: "#fff",
  },
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 30,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  adjustButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2a2a4e",
    alignItems: "center",
    justifyContent: "center",
  },
  adjustButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  controlsRow: {
    flexDirection: "row",
    gap: 30,
    alignItems: "center",
    marginBottom: 30,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#6c63ff",
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonActive: {
    backgroundColor: "#ff6b6b",
  },
  playButtonText: {
    color: "#fff",
    fontSize: 32,
  },
  tapButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#2a2a4e",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#6c63ff",
  },
  tapButtonText: {
    color: "#6c63ff",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
  },
  vibrationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "60%",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  vibrationLabel: {
    color: "#aaa",
    fontSize: 16,
    fontWeight: "600",
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  presetButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#2a2a4e",
  },
  presetButtonActive: {
    backgroundColor: "#6c63ff",
  },
  presetText: {
    color: "#aaa",
    fontSize: 14,
  },
  presetTextActive: {
    color: "#fff",
  },
});
