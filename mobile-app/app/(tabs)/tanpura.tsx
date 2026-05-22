import { useState, useRef, useEffect } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from "react-native";
import Slider from "@react-native-community/slider";
import { WebView } from "react-native-webview";

// Tanpura tuning presets based on common raag practice
const TUNINGS = [
  { label: "Standard (Pa)", notes: "Pa Sa Sa Sa", key: "pa", intervals: [7, 0, 0, -12] },
  { label: "Standard (Ma)", notes: "Ma Sa Sa Sa", key: "ma", intervals: [5, 0, 0, -12] },
  { label: "Bhairavi", notes: "Ni Sa Sa Sa", key: "ni", intervals: [-1, 0, 0, -12] },
  { label: "Malkauns", notes: "Sa Ma Sa Sa", key: "malkauns", intervals: [0, 5, 0, -12] },
  { label: "Yaman", notes: "Ni Sa Sa Sa", key: "yaman", intervals: [11, 0, 0, -12] },
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

  return (
    <View style={styles.outerContainer}>
      {/* Hidden WebView for audio synthesis */}
      <WebView
        ref={webViewRef}
        source={{ html: TANPURA_HTML, baseUrl: 'https://localhost' }}
        onMessage={onMessage}
        style={styles.hiddenWebView}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        originWhitelist={['*']}
      />

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
                  isPlaying && activeString === i && styles.stringActive,
                ]}
              >
                <View
                  style={[
                    styles.stringLine,
                    isPlaying && activeString === i && styles.stringLineActive,
                  ]}
                />
                <Text style={styles.stringLabel}>
                  {getStringLabel(i)}
                </Text>
              </View>
            ))}
          </View>
          {isPlaying && (
            <Text style={styles.playingLabel}>
              \u266A {TUNINGS[selectedTuning].notes}
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
          {isPlaying ? "\u23F9  Stop Tanpura" : "\u25B6  Play Tanpura"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  hiddenWebView: {
    width: 0,
    height: 0,
    opacity: 0,
    position: "absolute",
  },
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
