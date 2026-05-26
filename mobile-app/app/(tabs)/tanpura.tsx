import { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Animated,
  Platform,
} from "react-native";
import Slider from "@react-native-community/slider";
import { WebView } from "react-native-webview";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Tanpura tuning presets based on common raag practice
const TUNINGS = [
  { label: "Sa Pa Sa Sa", notes: "Pa Sa Sa Sa", key: "pa", intervals: [7, 0, 0, -12] },
  { label: "Sa Ma Sa Sa", notes: "Ma Sa Sa Sa", key: "ma", intervals: [5, 0, 0, -12] },
  { label: "Ni Sa Sa Sa", notes: "Ni Sa Sa Sa", key: "ni", intervals: [-1, 0, 0, -12] },
  { label: "Sa Ma Sa Sa", notes: "Sa Ma Sa Sa", key: "malkauns", intervals: [0, 5, 0, -12] },
  { label: "Ni Sa Sa Sa (Yaman)", notes: "Ni Sa Sa Sa", key: "yaman", intervals: [11, 0, 0, -12] },
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

// Web Audio synthesis HTML — rich tanpura drone with harmonics and javari buzz
const TANPURA_HTML = `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:transparent;">
<script>
let ctx=null,playing=false,timer=null,currentString=0;
let config={baseHz:220,intervals:[7,0,0,-12],volume:0.7,tempo:60};

function createTanpuraString(freq,time,vol){
  if(!ctx)return;
  const dur=4.0;
  const master=ctx.createGain();
  master.gain.setValueAtTime(vol*0.6,time);
  master.gain.exponentialRampToValueAtTime(vol*0.3,time+0.8);
  master.gain.exponentialRampToValueAtTime(0.001,time+dur);
  master.connect(ctx.destination);

  // Fundamental + harmonics (tanpura has rich overtone series)
  const harmonics=[1,2,3,4,5,6,7,8];
  const amplitudes=[1.0,0.7,0.45,0.35,0.25,0.18,0.12,0.08];

  for(let i=0;i<harmonics.length;i++){
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    const hFreq=freq*harmonics[i];
    if(hFreq>4000)continue;

    osc.type='sine';
    osc.frequency.setValueAtTime(hFreq,time);

    // Javari effect: slight frequency wobble on upper harmonics
    if(i>1){
      const lfo=ctx.createOscillator();
      const lfoGain=ctx.createGain();
      lfo.type='sine';
      lfo.frequency.setValueAtTime(0.5+i*0.3,time);
      lfoGain.gain.setValueAtTime(hFreq*0.002,time);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(time);
      lfo.stop(time+dur+0.1);
    }

    // Harmonics swell in and out (javari shimmer)
    const amp=amplitudes[i];
    if(i>2){
      gain.gain.setValueAtTime(amp*0.3,time);
      gain.gain.linearRampToValueAtTime(amp,time+0.3+i*0.1);
      gain.gain.linearRampToValueAtTime(amp*0.5,time+1.5);
      gain.gain.linearRampToValueAtTime(amp*0.8,time+2.5);
      gain.gain.exponentialRampToValueAtTime(0.001,time+dur);
    }else{
      gain.gain.setValueAtTime(amp,time);
      gain.gain.exponentialRampToValueAtTime(0.001,time+dur);
    }

    osc.connect(gain);
    gain.connect(master);
    osc.start(time);
    osc.stop(time+dur+0.1);
  }

  // Add a subtle noise burst at attack (pluck character)
  const bufSize=ctx.sampleRate*0.02;
  const noiseBuf=ctx.createBuffer(1,bufSize,ctx.sampleRate);
  const data=noiseBuf.getChannelData(0);
  for(let i=0;i<bufSize;i++)data[i]=(Math.random()*2-1)*0.3;
  const noise=ctx.createBufferSource();
  noise.buffer=noiseBuf;
  const noiseGain=ctx.createGain();
  noiseGain.gain.setValueAtTime(vol*0.15,time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001,time+0.05);
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(time);
  noise.stop(time+0.06);
}

function getStringFreq(stringIdx){
  const semitones=config.intervals[stringIdx];
  return config.baseHz*Math.pow(2,semitones/12);
}

function playNextString(){
  if(!playing||!ctx)return;
  const freq=getStringFreq(currentString);
  createTanpuraString(freq,ctx.currentTime,config.volume);
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'string',index:currentString}));
  currentString=(currentString+1)%4;
}

function start(){
  if(playing)return;
  ctx=new(window.AudioContext||window.webkitAudioContext)();
  playing=true;
  currentString=0;
  playNextString();
  const intervalMs=(60/config.tempo)*1000;
  timer=setInterval(playNextString,intervalMs);
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'started'}));
}

function stop(){
  playing=false;
  if(timer){clearInterval(timer);timer=null;}
  if(ctx){ctx.close();ctx=null;}
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'stopped'}));
}

function updateConfig(newConfig){
  Object.assign(config,newConfig);
  if(playing&&timer){
    clearInterval(timer);
    const intervalMs=(60/config.tempo)*1000;
    timer=setInterval(playNextString,intervalMs);
  }
}

document.addEventListener('message',function(e){
  try{
    var d=JSON.parse(e.data);
    if(d.command==='start')start();
    else if(d.command==='stop')stop();
    else if(d.command==='config')updateConfig(d.config);
  }catch(x){}
});
window.addEventListener('message',function(e){
  try{
    var d=JSON.parse(e.data);
    if(d.command==='start')start();
    else if(d.command==='stop')stop();
    else if(d.command==='config')updateConfig(d.config);
  }catch(x){}
});
</script></body></html>`;

export default function TanpuraScreen() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTuning, setSelectedTuning] = useState(0);
  const [selectedPitch, setSelectedPitch] = useState(9); // A3 = 220Hz default
  const [volume, setVolume] = useState(0.7);
  const [tempo, setTempo] = useState(60);
  const [activeString, setActiveString] = useState(-1);
  const webViewRef = useRef<WebView>(null);

  // Animated pulse values for each string
  const stringAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const sendConfig = () => {
    const cfg = {
      baseHz: PITCH_OPTIONS[selectedPitch].hz,
      intervals: TUNINGS[selectedTuning].intervals,
      volume,
      tempo,
    };
    webViewRef.current?.injectJavaScript(
      `document.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({command:'config',config:${JSON.stringify(cfg)}})}));true;`
    );
  };

  useEffect(() => {
    if (isPlaying) {
      sendConfig();
    }
  }, [selectedTuning, selectedPitch, volume, tempo]);

  useEffect(() => {
    if (activeString >= 0 && isPlaying) {
      // Animate the plucked string
      Animated.sequence([
        Animated.timing(stringAnims[activeString], {
          toValue: 1,
          duration: 100,
          useNativeDriver: false,
        }),
        Animated.timing(stringAnims[activeString], {
          toValue: 0,
          duration: 600,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [activeString]);

  const onMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "started") setIsPlaying(true);
      else if (data.type === "stopped") { setIsPlaying(false); setActiveString(-1); }
      else if (data.type === "string") setActiveString(data.index);
    } catch {}
  };

  const togglePlayback = () => {
    if (isPlaying) {
      webViewRef.current?.injectJavaScript(
        `document.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({command:'stop'})}));true;`
      );
    } else {
      sendConfig();
      setTimeout(() => {
        webViewRef.current?.injectJavaScript(
          `document.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({command:'start'})}));true;`
        );
      }, 100);
    }
  };

  const getStringLabel = (idx: number): string => {
    const tuning = TUNINGS[selectedTuning];
    const semitones = tuning.intervals[idx];
    if (semitones === -12 || semitones === -24) return "Sa\u2193";
    if (semitones === 0) return "Sa";
    if (semitones === 7) return "Pa";
    if (semitones === 5) return "Ma";
    if (semitones === 11 || semitones === -1) return "Ni";
    return "Sa";
  };

  const STRING_COLORS = ["#D4A574", "#E8C99A", "#E8C99A", "#C49A6C"];

  return (
    <SafeAreaView style={styles.outerContainer}>
      {/* Hidden WebView for audio synthesis */}
      <WebView
        ref={webViewRef}
        source={{ html: TANPURA_HTML, baseUrl: "https://localhost" }}
        onMessage={onMessage}
        style={styles.hiddenWebView}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        originWhitelist={["*"]}
      />

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.title}>🎵 Tanpura</Text>
        <Text style={styles.subtitle}>Continuous drone for riyaaz practice</Text>

        {/* Tanpura Instrument Graphic */}
        <View style={styles.instrumentContainer}>
          <LinearGradient
            colors={["#1a0f05", "#2d1a0a", "#1a0f05"]}
            style={styles.instrumentBg}
          >
            {/* Neck */}
            <View style={styles.neckContainer}>
              <LinearGradient
                colors={["#8B5E3C", "#6B3A1F", "#4A2510", "#6B3A1F", "#8B5E3C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.neck}
              >
                {/* Tuning pegs */}
                <View style={styles.pegsRow}>
                  {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={styles.peg} />
                  ))}
                </View>
              </LinearGradient>
            </View>

            {/* Strings over body */}
            <View style={styles.stringsArea}>
              {[0, 1, 2, 3].map((i) => {
                const animatedWidth = stringAnims[i].interpolate({
                  inputRange: [0, 1],
                  outputRange: [2, 5],
                });
                const animatedOpacity = stringAnims[i].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 1],
                });
                const animatedShadow = stringAnims[i].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 12],
                });
                return (
                  <View key={i} style={styles.stringWrapper}>
                    <Animated.View
                      style={[
                        styles.instrumentString,
                        {
                          backgroundColor: STRING_COLORS[i],
                          width: animatedWidth,
                          opacity: animatedOpacity,
                          shadowRadius: animatedShadow,
                          shadowColor: "#FFD700",
                          shadowOpacity: isPlaying && activeString === i ? 0.8 : 0,
                        },
                      ]}
                    />
                    <View style={styles.stringLabelBadge}>
                      <Text style={styles.stringLabelText}>{getStringLabel(i)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Bridge */}
            <LinearGradient
              colors={["#5C3D1E", "#8B5E3C", "#5C3D1E"]}
              style={styles.bridge}
            >
              <View style={styles.bridgeInner} />
            </LinearGradient>

            {/* Gourd (resonator) */}
            <View style={styles.gourdContainer}>
              <LinearGradient
                colors={["#8B5E3C", "#A0522D", "#D2691E", "#A0522D", "#6B3A1F"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gourd}
              >
                {/* Decorative rings on gourd */}
                <View style={styles.gourdRing} />
                <View style={[styles.gourdRing, { width: "70%", height: "70%" }]} />
              </LinearGradient>
            </View>

            {/* Playing indicator */}
            {isPlaying && (
              <View style={styles.nowPlayingBadge}>
                <Text style={styles.nowPlayingText}>
                  ♪ {TUNINGS[selectedTuning].notes}
                </Text>
              </View>
            )}
          </LinearGradient>
        </View>

        {/* Play/Stop Button */}
        <TouchableOpacity
          style={[styles.playButton, isPlaying && styles.playButtonActive]}
          onPress={togglePlayback}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={isPlaying ? ["#E74C3C", "#C0392B"] : ["#27AE60", "#1E8449"]}
            style={styles.playButtonGradient}
          >
            <Text style={styles.playButtonIcon}>{isPlaying ? "⏹" : "▶"}</Text>
            <Text style={styles.playButtonText}>
              {isPlaying ? "Stop" : "Play Tanpura"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Controls Card */}
        <View style={styles.controlsCard}>
          {/* Pattern Selection */}
          <Text style={styles.sectionLabel}>PATTERN</Text>
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
            BASE PITCH — Sa = {PITCH_OPTIONS[selectedPitch].label} ({PITCH_OPTIONS[selectedPitch].hz} Hz)
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
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>🔊 Volume</Text>
            <Text style={styles.sliderValue}>{Math.round(volume * 100)}%</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            value={volume}
            onValueChange={setVolume}
            minimumTrackTintColor="#D4A574"
            maximumTrackTintColor="#3d2b1a"
            thumbTintColor="#E8C99A"
          />

          {/* Tempo */}
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>⏱ Cycle Speed</Text>
            <Text style={styles.sliderValue}>{tempo} BPM</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={30}
            maximumValue={120}
            value={tempo}
            onValueChange={(val) => setTempo(Math.round(val))}
            minimumTrackTintColor="#D4A574"
            maximumTrackTintColor="#3d2b1a"
            thumbTintColor="#E8C99A"
            step={1}
          />
        </View>

        {/* Info Footer */}
        <View style={styles.infoFooter}>
          <Text style={styles.infoText}>
            Tanpura provides the essential Sa (tonic) drone for vocal and instrumental practice.
            Match your pitch with the tanpura to stay in tune.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "#0d0705",
  },
  hiddenWebView: {
    width: 0,
    height: 0,
    opacity: 0,
    position: "absolute",
  },
  scrollContainer: {
    flex: 1,
  },
  container: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  title: {
    color: "#E8C99A",
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 2,
    letterSpacing: 1,
  },
  subtitle: {
    color: "#8B7355",
    fontSize: 14,
    marginBottom: 20,
    fontStyle: "italic",
  },
  // Instrument graphic
  instrumentContainer: {
    width: SCREEN_WIDTH - 80,
    maxWidth: 280,
    alignItems: "center",
    marginBottom: 20,
  },
  instrumentBg: {
    width: "100%",
    borderRadius: 20,
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: "#3d2b1a",
  },
  neckContainer: {
    width: 60,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  neck: {
    width: 50,
    height: 36,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  pegsRow: {
    flexDirection: "row",
    gap: 8,
  },
  peg: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#C49A6C",
    borderWidth: 1,
    borderColor: "#8B5E3C",
  },
  stringsArea: {
    flexDirection: "row",
    gap: 18,
    height: 160,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingVertical: 10,
  },
  stringWrapper: {
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  instrumentString: {
    height: "85%",
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
  },
  stringLabelBadge: {
    marginTop: 6,
    backgroundColor: "rgba(232,201,154,0.15)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  stringLabelText: {
    color: "#E8C99A",
    fontSize: 11,
    fontWeight: "600",
  },
  bridge: {
    width: 100,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  bridgeInner: {
    width: 80,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4A2510",
  },
  gourdContainer: {
    marginTop: 10,
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  gourd: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#4A2510",
  },
  gourdRing: {
    width: "85%",
    height: "85%",
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.15)",
    position: "absolute",
  },
  nowPlayingBadge: {
    position: "absolute",
    bottom: 70,
    backgroundColor: "rgba(39,174,96,0.2)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(39,174,96,0.4)",
  },
  nowPlayingText: {
    color: "#27AE60",
    fontSize: 13,
    fontWeight: "600",
  },
  // Play button
  playButton: {
    borderRadius: 30,
    overflow: "hidden",
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#27AE60",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  playButtonActive: {
    ...Platform.select({
      ios: { shadowColor: "#E74C3C" },
    }),
  },
  playButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 36,
    paddingVertical: 16,
    gap: 10,
  },
  playButtonIcon: {
    fontSize: 20,
    color: "#fff",
  },
  playButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  // Controls card
  controlsCard: {
    width: "100%",
    backgroundColor: "#1a0f05",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#3d2b1a",
  },
  sectionLabel: {
    color: "#8B7355",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 16,
  },
  tuningRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  tuningButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#2d1a0a",
    borderWidth: 1,
    borderColor: "#3d2b1a",
  },
  tuningButtonActive: {
    backgroundColor: "#5C3D1E",
    borderColor: "#D4A574",
  },
  tuningButtonText: {
    color: "#8B7355",
    fontSize: 12,
    fontWeight: "500",
  },
  tuningButtonTextActive: {
    color: "#E8C99A",
    fontWeight: "700",
  },
  pitchScroll: {
    width: "100%",
    marginBottom: 8,
  },
  pitchRow: {
    flexDirection: "row",
    gap: 6,
  },
  pitchButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "#2d1a0a",
    borderWidth: 1,
    borderColor: "#3d2b1a",
  },
  pitchButtonActive: {
    backgroundColor: "#5C3D1E",
    borderColor: "#D4A574",
  },
  pitchButtonText: {
    color: "#8B7355",
    fontSize: 12,
  },
  pitchButtonTextActive: {
    color: "#E8C99A",
    fontWeight: "700",
  },
  sliderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 4,
  },
  sliderLabel: {
    color: "#C49A6C",
    fontSize: 14,
    fontWeight: "500",
  },
  sliderValue: {
    color: "#E8C99A",
    fontSize: 14,
    fontWeight: "600",
  },
  slider: {
    width: "100%",
    height: 36,
  },
  // Info footer
  infoFooter: {
    marginTop: 20,
    paddingHorizontal: 10,
  },
  infoText: {
    color: "#5C4A32",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
