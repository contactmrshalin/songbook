import { useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { WebView } from "react-native-webview";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CIRCLE_SIZE = Math.min(SCREEN_WIDTH - 60, 300);

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

// Sargam notes (12 semitones)
const SARGAM_NOTES = [
  { sargam: "Sa", semitones: 0 },
  { sargam: "Re\u266D", semitones: 1 },
  { sargam: "Re", semitones: 2 },
  { sargam: "Ga\u266D", semitones: 3 },
  { sargam: "Ga", semitones: 4 },
  { sargam: "Ma", semitones: 5 },
  { sargam: "Ma#", semitones: 6 },
  { sargam: "Pa", semitones: 7 },
  { sargam: "Dha\u266D", semitones: 8 },
  { sargam: "Dha", semitones: 9 },
  { sargam: "Ni\u266D", semitones: 10 },
  { sargam: "Ni", semitones: 11 },
];

// Primary sargam notes for circular display
const CIRCLE_NOTES = ["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni"];

function findClosestNote(freq: number, baseFreq: number) {
  const semitones = 12 * Math.log2(freq / baseFreq);
  let noteIndex = Math.round(semitones) % 12;
  if (noteIndex < 0) noteIndex += 12;
  const cents = Math.round((semitones - Math.round(semitones)) * 100);
  const noteInfo = SARGAM_NOTES[noteIndex];
  const exactFreq = baseFreq * Math.pow(2, Math.round(semitones) / 12);
  return { ...noteInfo, cents, detectedFreq: freq, expectedFreq: exactFreq };
}

// HTML for WebView: real-time pitch detection via Web Audio API
const TUNER_HTML = `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:transparent;">
<script>
let audioContext=null,analyser=null,source=null,stream=null,running=false;
function autoCorrelate(buf,sampleRate){
  const SIZE=buf.length;
  let rms=0;
  for(let i=0;i<SIZE;i++)rms+=buf[i]*buf[i];
  rms=Math.sqrt(rms/SIZE);
  if(rms<0.008)return -1;
  let r1=0,r2=SIZE-1;
  const thr=0.15;
  for(let i=0;i<SIZE/2;i++){if(Math.abs(buf[i])>=thr){r1=i;break;}}
  for(let i=1;i<SIZE/2;i++){if(Math.abs(buf[SIZE-i])>=thr){r2=SIZE-i;break;}}
  const tb=buf.slice(r1,r2);
  const ts=tb.length;
  if(ts<64)return -1;
  const c=new Float32Array(ts);
  for(let i=0;i<ts;i++){let s=0;for(let j=0;j<ts-i;j++)s+=tb[j]*tb[j+i];c[i]=s;}
  let d=0;
  while(c[d]>c[d+1]&&d<ts/2)d++;
  let mv=-1,mp=-1;
  for(let i=d;i<ts/2;i++){if(c[i]>mv){mv=c[i];mp=i;}}
  if(mp===-1||mv<0.01*c[0])return -1;
  const y1=c[mp-1]||0,y2=c[mp],y3=c[mp+1]||0;
  const sh=(y3-y1)/(2*(2*y2-y1-y3));
  return sampleRate/(mp+(isFinite(sh)?sh:0));
}
async function start(){
  if(running)return;
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    audioContext=new(window.AudioContext||window.webkitAudioContext)({sampleRate:44100});
    analyser=audioContext.createAnalyser();
    analyser.fftSize=4096;
    source=audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    running=true;
    detect();
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'started'}));
  }catch(e){
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:e.message||'Microphone access denied'}));
  }
}
function detect(){
  if(!running)return;
  const buf=new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  const freq=autoCorrelate(buf,audioContext.sampleRate);
  if(freq>50&&freq<2000){
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'pitch',frequency:Math.round(freq*10)/10}));
  }else{
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'silence'}));
  }
  setTimeout(function(){requestAnimationFrame(detect);},50);
}
function stop(){
  running=false;
  if(source){source.disconnect();source=null;}
  if(stream){stream.getTracks().forEach(function(t){t.stop();});stream=null;}
  if(audioContext){audioContext.close();audioContext=null;}
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'stopped'}));
}
document.addEventListener('message',function(e){try{var d=JSON.parse(e.data);if(d.command==='start')start();if(d.command==='stop')stop();}catch(x){}});
window.addEventListener('message',function(e){try{var d=JSON.parse(e.data);if(d.command==='start')start();if(d.command==='stop')stop();}catch(x){}});
</script></body></html>`;

export default function TunerScreen() {
  const [isListening, setIsListening] = useState(false);
  const [baseScaleIndex, setBaseScaleIndex] = useState(0);
  const [detectedNote, setDetectedNote] = useState<{
    sargam: string;
    semitones: number;
    cents: number;
    detectedFreq: number;
    expectedFreq: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  const silenceCountRef = useRef(0);
  const baseScaleIndexRef = useRef(baseScaleIndex);
  baseScaleIndexRef.current = baseScaleIndex;

  const baseScale = BASE_SCALES[baseScaleIndex];

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "pitch") {
          silenceCountRef.current = 0;
          const note = findClosestNote(
            data.frequency,
            BASE_SCALES[baseScaleIndexRef.current].freq
          );
          setDetectedNote(note);
        } else if (data.type === "silence") {
          silenceCountRef.current++;
          if (silenceCountRef.current > 20) {
            setDetectedNote(null);
          }
        } else if (data.type === "error") {
          setError(data.message);
        } else if (data.type === "started") {
          setIsListening(true);
          setError(null);
        } else if (data.type === "stopped") {
          setIsListening(false);
          setDetectedNote(null);
        }
      } catch {}
    },
    []
  );

  const startListening = () => {
    webViewRef.current?.injectJavaScript(
      `document.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({command:'start'})}));true;`
    );
  };

  const stopListening = () => {
    webViewRef.current?.injectJavaScript(
      `document.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({command:'stop'})}));true;`
    );
  };

  const getCentsColor = (cents: number) => {
    const absCents = Math.abs(cents);
    if (absCents <= 5) return "#4caf50";
    if (absCents <= 15) return "#ffc107";
    return "#ff5722";
  };

  const getActiveCircleIndex = (): number => {
    if (!detectedNote) return -1;
    const { sargam } = detectedNote;
    return CIRCLE_NOTES.findIndex((n) => sargam.startsWith(n));
  };

  const activeCircleIdx = getActiveCircleIndex();

  return (
    <View style={styles.container}>
      {/* Hidden WebView for audio processing */}
      <WebView
        ref={webViewRef}
        source={{ html: TUNER_HTML }}
        onMessage={onMessage}
        style={styles.hiddenWebView}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        javaScriptEnabled={true}
        mediaCapturePermissionGrantType="grant"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Flute Tuner</Text>

        {/* Base Scale Selector */}
        <View style={styles.scaleSection}>
          <Text style={styles.scaleLabel}>Sa =</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scaleScroll}
          >
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
            {baseScale.label} = {baseScale.freq.toFixed(1)} Hz
          </Text>
        </View>

        {/* Circular Note Indicator */}
        <View style={styles.circleContainer}>
          <View style={styles.circle}>
            {CIRCLE_NOTES.map((note, idx) => {
              const angle =
                (idx / CIRCLE_NOTES.length) * 2 * Math.PI - Math.PI / 2;
              const radius = CIRCLE_SIZE / 2 - 30;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              const isActive = idx === activeCircleIdx;

              return (
                <View
                  key={note}
                  style={[
                    styles.circleNote,
                    {
                      transform: [{ translateX: x }, { translateY: y }],
                    },
                    isActive && styles.circleNoteActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.circleNoteText,
                      isActive && styles.circleNoteTextActive,
                    ]}
                  >
                    {note}
                  </Text>
                </View>
              );
            })}

            {/* Center: frequency + note name */}
            <View style={styles.centerDisplay}>
              {detectedNote ? (
                <>
                  <Text style={styles.centerSargam}>
                    {detectedNote.sargam}
                  </Text>
                  <Text style={styles.centerFreq}>
                    {detectedNote.detectedFreq.toFixed(1)} Hz
                  </Text>
                  <Text
                    style={[
                      styles.centerCents,
                      { color: getCentsColor(detectedNote.cents) },
                    ]}
                  >
                    {Math.abs(detectedNote.cents) <= 5
                      ? "\u2713 In Tune"
                      : detectedNote.cents < 0
                      ? `\u266D ${Math.abs(detectedNote.cents)}\u00A2`
                      : `\u266F ${detectedNote.cents}\u00A2`}
                  </Text>
                </>
              ) : (
                <Text style={styles.centerWaiting}>
                  {isListening ? "Listening..." : "Tap Start"}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Cents deviation bar */}
        {detectedNote && (
          <View style={styles.centsBarContainer}>
            <Text style={styles.centsLabel}>-50</Text>
            <View style={styles.centsBar}>
              <View style={styles.centsCenterLine} />
              <View
                style={[
                  styles.centsIndicator,
                  {
                    left: `${Math.max(0, Math.min(100, 50 + detectedNote.cents))}%`,
                    backgroundColor: getCentsColor(detectedNote.cents),
                  },
                ]}
              />
            </View>
            <Text style={styles.centsLabel}>+50</Text>
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  hiddenWebView: {
    width: 0,
    height: 0,
    opacity: 0,
    position: "absolute",
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 16,
  },
  scaleSection: {
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
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
  circleContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    borderColor: "#2a2a4e",
    alignItems: "center",
    justifyContent: "center",
  },
  circleNote: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2a2a4e",
    alignItems: "center",
    justifyContent: "center",
  },
  circleNoteActive: {
    backgroundColor: "#6c63ff",
    shadowColor: "#6c63ff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 8,
  },
  circleNoteText: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "700",
  },
  circleNoteTextActive: {
    color: "#fff",
    fontSize: 14,
  },
  centerDisplay: {
    alignItems: "center",
    justifyContent: "center",
  },
  centerSargam: {
    color: "#6c63ff",
    fontSize: 36,
    fontWeight: "bold",
  },
  centerFreq: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
    marginTop: 4,
  },
  centerCents: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 4,
  },
  centerWaiting: {
    color: "#888",
    fontSize: 18,
  },
  centsBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "90%",
    marginBottom: 20,
  },
  centsLabel: {
    color: "#666",
    fontSize: 11,
    width: 30,
    textAlign: "center",
  },
  centsBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#2a2a4e",
    borderRadius: 4,
    marginHorizontal: 8,
    position: "relative",
    overflow: "visible",
  },
  centsCenterLine: {
    position: "absolute",
    left: "50%",
    top: -4,
    width: 2,
    height: 16,
    backgroundColor: "#4caf50",
    marginLeft: -1,
  },
  centsIndicator: {
    position: "absolute",
    top: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
  },
  errorText: {
    color: "#ff5722",
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
  },
  button: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    backgroundColor: "#6c63ff",
    marginTop: 10,
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
