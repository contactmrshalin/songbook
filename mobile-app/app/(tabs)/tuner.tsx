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

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE_SCALES = [
  { label: "C",  freq: 261.63 },
  { label: "C#", freq: 277.18 },
  { label: "D",  freq: 293.66 },
  { label: "D#", freq: 311.13 },
  { label: "E",  freq: 329.63 },
  { label: "F",  freq: 349.23 },
  { label: "F#", freq: 369.99 },
  { label: "G",  freq: 392.0  },
  { label: "G#", freq: 415.3  },
  { label: "A",  freq: 440.0  },
  { label: "A#", freq: 466.16 },
  { label: "B",  freq: 493.88 },
];

const SARGAM_NOTES = [
  { sargam: "Sa",   semitones: 0  },
  { sargam: "Re\u266D",  semitones: 1  },
  { sargam: "Re",   semitones: 2  },
  { sargam: "Ga\u266D",  semitones: 3  },
  { sargam: "Ga",   semitones: 4  },
  { sargam: "Ma",   semitones: 5  },
  { sargam: "Ma#",  semitones: 6  },
  { sargam: "Pa",   semitones: 7  },
  { sargam: "Dha\u266D", semitones: 8  },
  { sargam: "Dha",  semitones: 9  },
  { sargam: "Ni\u266D",  semitones: 10 },
  { sargam: "Ni",   semitones: 11 },
];

const CIRCLE_NOTES = ["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni"];

/**
 * Bansuri range across three octaves.
 * semitone = distance in semitones from Madhya Sa.
 *   Mandra Saptak  : Pa → Ni        (semitones -5 to -1,  5 notes)
 *   Madhya Saptak  : Sa → Ni        (semitones  0 to 11, 12 notes)
 *   Taar Saptak    : Sa˙ → Pa˙      (semitones 12 to 19,  8 notes)
 * Total: 25 notes.
 */
const BANSURI_OCTAVES = [
  {
    id: "mandra",
    name: "Mandra Saptak",
    subtitle: "Lower Octave",
    notes: [
      { display: "Pa",   semitone: -5, komal: false },
      { display: "Dha\u266D", semitone: -4, komal: true  },
      { display: "Dha",  semitone: -3, komal: false },
      { display: "Ni\u266D",  semitone: -2, komal: true  },
      { display: "Ni",   semitone: -1, komal: false },
    ],
  },
  {
    id: "madhya",
    name: "Madhya Saptak",
    subtitle: "Middle Octave",
    notes: [
      { display: "Sa",   semitone: 0,  komal: false },
      { display: "Re\u266D",  semitone: 1,  komal: true  },
      { display: "Re",   semitone: 2,  komal: false },
      { display: "Ga\u266D",  semitone: 3,  komal: true  },
      { display: "Ga",   semitone: 4,  komal: false },
      { display: "Ma",   semitone: 5,  komal: false },
      { display: "Ma#",  semitone: 6,  komal: true  },
      { display: "Pa",   semitone: 7,  komal: false },
      { display: "Dha\u266D", semitone: 8,  komal: true  },
      { display: "Dha",  semitone: 9,  komal: false },
      { display: "Ni\u266D",  semitone: 10, komal: true  },
      { display: "Ni",   semitone: 11, komal: false },
    ],
  },
  {
    id: "taar",
    name: "Taar Saptak",
    subtitle: "Higher Octave",
    notes: [
      { display: "Sa\u02D9",  semitone: 12, komal: false },
      { display: "Re\u266D\u02D9", semitone: 13, komal: true  },
      { display: "Re\u02D9",  semitone: 14, komal: false },
      { display: "Ga\u266D\u02D9", semitone: 15, komal: true  },
      { display: "Ga\u02D9",  semitone: 16, komal: false },
      { display: "Ma\u02D9",  semitone: 17, komal: false },
      { display: "Ma#\u02D9", semitone: 18, komal: true  },
      { display: "Pa\u02D9",  semitone: 19, komal: false },
    ],
  },
] as const;

const TOTAL_NOTES = BANSURI_OCTAVES.reduce((s, o) => s + o.notes.length, 0); // 25

/**
 * Consecutive message-ticks at the same semitone within ±15¢
 * before marking it as "played".  WebView fires every ~50ms,
 * so 5 ticks ≈ 250 ms.
 */
const HIT_TICKS = 5;

// ── Pitch helpers ─────────────────────────────────────────────────────────────

function findClosestNote(freq: number, baseFreq: number) {
  const absoluteSemitones = 12 * Math.log2(freq / baseFreq);
  const rounded = Math.round(absoluteSemitones);
  const noteIndex = ((rounded % 12) + 12) % 12;
  const cents = Math.round((absoluteSemitones - rounded) * 100);
  const exactFreq = baseFreq * Math.pow(2, rounded / 12);
  return {
    ...SARGAM_NOTES[noteIndex],
    cents,
    detectedFreq: freq,
    expectedFreq: exactFreq,
    absoluteSemitone: rounded,
  };
}

// ── WebView HTML — runs in an invisible web context for Web Audio API access ──

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

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveView = "tuner" | "range";

type DetectedNote = {
  sargam: string;
  semitones: number;
  cents: number;
  detectedFreq: number;
  expectedFreq: number;
  absoluteSemitone: number;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function TunerScreen() {
  const [view, setView]                   = useState<ActiveView>("tuner");
  const [isListening, setIsListening]     = useState(false);
  const [baseScaleIndex, setBaseScaleIndex] = useState(0);
  const [detectedNote, setDetectedNote]   = useState<DetectedNote | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [masteredNotes, setMasteredNotes] = useState<Set<number>>(new Set());

  const webViewRef        = useRef<WebView>(null);
  const silenceCountRef   = useRef(0);
  const baseScaleIndexRef = useRef(baseScaleIndex);
  baseScaleIndexRef.current = baseScaleIndex;

  // Range trainer sustain tracking
  const sustainRef  = useRef<{ semitone: number; count: number } | null>(null);
  const masteredRef = useRef<Set<number>>(new Set());

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

          // Range trainer: mark note played after HIT_TICKS consecutive ticks within ±15¢
          if (Math.abs(note.cents) <= 15) {
            if (sustainRef.current?.semitone === note.absoluteSemitone) {
              sustainRef.current.count++;
              if (
                sustainRef.current.count >= HIT_TICKS &&
                !masteredRef.current.has(note.absoluteSemitone)
              ) {
                const next = new Set(masteredRef.current);
                next.add(note.absoluteSemitone);
                masteredRef.current = next;
                setMasteredNotes(next);
              }
            } else {
              sustainRef.current = { semitone: note.absoluteSemitone, count: 1 };
            }
          } else {
            sustainRef.current = null;
          }
        } else if (data.type === "silence") {
          silenceCountRef.current++;
          if (silenceCountRef.current > 20) {
            setDetectedNote(null);
            sustainRef.current = null;
          }
        } else if (data.type === "error") {
          setError(data.message);
        } else if (data.type === "started") {
          setIsListening(true);
          setError(null);
        } else if (data.type === "stopped") {
          setIsListening(false);
          setDetectedNote(null);
          sustainRef.current = null;
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

  const resetMastery = () => {
    masteredRef.current = new Set();
    setMasteredNotes(new Set());
    sustainRef.current = null;
  };

  const getCentsColor = (cents: number) => {
    const abs = Math.abs(cents);
    if (abs <= 5)  return "#4caf50";
    if (abs <= 15) return "#ffc107";
    return "#ff5722";
  };

  const activeCircleIdx = detectedNote
    ? CIRCLE_NOTES.findIndex((n) => detectedNote.sargam.startsWith(n))
    : -1;

  // For range view
  const activeSemitone =
    detectedNote && Math.abs(detectedNote.cents) <= 30
      ? detectedNote.absoluteSemitone
      : null;
  const hitCandidateSemitone =
    detectedNote && Math.abs(detectedNote.cents) <= 15
      ? detectedNote.absoluteSemitone
      : null;
  const masteredCount = masteredNotes.size;

  return (
    <View style={styles.container}>
      {/* Hidden WebView for audio processing */}
      <WebView
        ref={webViewRef}
        source={{ html: TUNER_HTML, baseUrl: "https://localhost" }}
        onMessage={onMessage}
        style={styles.hiddenWebView}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        javaScriptEnabled={true}
        mediaCapturePermissionGrantType="grant"
        allowFileAccess={true}
        androidLayerType="hardware"
        originWhitelist={["*"]}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Flute Tuner</Text>

        {/* View toggle */}
        <View style={styles.viewToggle}>
          {(["tuner", "range"] as ActiveView[]).map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.toggleBtn, view === v && styles.toggleBtnActive]}
              onPress={() => setView(v)}
            >
              <Text style={[styles.toggleBtnText, view === v && styles.toggleBtnTextActive]}>
                {v === "tuner" ? "Tuner" : "Range Trainer"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Base Scale Selector — shared */}
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
                  style={[styles.scaleButton, idx === baseScaleIndex && styles.scaleButtonActive]}
                  onPress={() => setBaseScaleIndex(idx)}
                >
                  <Text style={[styles.scaleButtonText, idx === baseScaleIndex && styles.scaleButtonTextActive]}>
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

        {/* ══════════════════════════════════════
            TUNER VIEW — circular note display
            ══════════════════════════════════════ */}
        {view === "tuner" && (
          <>
            {/* Circular Note Indicator */}
            <View style={styles.circleContainer}>
              <View style={styles.circle}>
                {CIRCLE_NOTES.map((note, idx) => {
                  const angle = (idx / CIRCLE_NOTES.length) * 2 * Math.PI - Math.PI / 2;
                  const radius = CIRCLE_SIZE / 2 - 30;
                  const x = Math.cos(angle) * radius;
                  const y = Math.sin(angle) * radius;
                  const isActive = idx === activeCircleIdx;
                  return (
                    <View
                      key={note}
                      style={[
                        styles.circleNote,
                        { transform: [{ translateX: x }, { translateY: y }] },
                        isActive && styles.circleNoteActive,
                      ]}
                    >
                      <Text style={[styles.circleNoteText, isActive && styles.circleNoteTextActive]}>
                        {note}
                      </Text>
                    </View>
                  );
                })}
                <View style={styles.centerDisplay}>
                  {detectedNote ? (
                    <>
                      <Text style={styles.centerSargam}>{detectedNote.sargam}</Text>
                      <Text style={styles.centerFreq}>{detectedNote.detectedFreq.toFixed(1)} Hz</Text>
                      <Text style={[styles.centerCents, { color: getCentsColor(detectedNote.cents) }]}>
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

            {/* Cents bar */}
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
          </>
        )}

        {/* ══════════════════════════════════════
            RANGE TRAINER VIEW — 3-octave grid
            ══════════════════════════════════════ */}
        {view === "range" && (
          <View style={styles.rangeContainer}>

            {/* Progress header */}
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.progressText}>
                  {masteredCount} / {TOTAL_NOTES} notes played
                </Text>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${(masteredCount / TOTAL_NOTES) * 100}%`,
                        backgroundColor: masteredCount === TOTAL_NOTES ? "#4caf50" : "#6c63ff",
                      },
                    ]}
                  />
                </View>
              </View>
              <TouchableOpacity style={styles.resetBtn} onPress={resetMastery}>
                <Text style={styles.resetBtnText}>Reset</Text>
              </TouchableOpacity>
            </View>

            {/* Full range celebration */}
            {masteredCount === TOTAL_NOTES && (
              <View style={styles.celebrationBox}>
                <Text style={styles.celebrationText}>
                  🎉 Full range! All {TOTAL_NOTES} notes played across 3 octaves.
                </Text>
              </View>
            )}

            {/* Octave rows */}
            {BANSURI_OCTAVES.map((octave) => {
              const octaveMastered = octave.notes.filter((n) => masteredNotes.has(n.semitone)).length;
              return (
                <View key={octave.id} style={styles.octaveSection}>
                  {/* Octave label */}
                  <View style={styles.octaveHeader}>
                    <View>
                      <Text style={styles.octaveName}>{octave.name}</Text>
                      <Text style={styles.octaveSubtitle}>{octave.subtitle}</Text>
                    </View>
                    <Text style={styles.octaveCount}>
                      {octaveMastered}/{octave.notes.length}
                    </Text>
                  </View>

                  {/* Note cells */}
                  <View style={styles.noteRow}>
                    {octave.notes.map((note) => {
                      const isHit       = masteredNotes.has(note.semitone);
                      const isCandidate = hitCandidateSemitone === note.semitone;
                      const isDetecting = !isCandidate && activeSemitone === note.semitone;
                      const sustainCount =
                        isCandidate && sustainRef.current?.semitone === note.semitone
                          ? Math.min(HIT_TICKS, sustainRef.current.count)
                          : 0;
                      const sustainPct = sustainCount / HIT_TICKS;

                      const cellSize = note.komal ? 40 : 48;

                      return (
                        <View
                          key={note.semitone}
                          style={[
                            styles.noteCell,
                            { width: cellSize, height: cellSize, borderRadius: cellSize / 4 },
                            isHit
                              ? styles.noteCellHit
                              : isCandidate
                              ? styles.noteCellCandidate
                              : isDetecting
                              ? styles.noteCellDetecting
                              : note.komal
                              ? styles.noteCellKomal
                              : styles.noteCellDefault,
                          ]}
                        >
                          {/* Sustain fill */}
                          {isCandidate && !isHit && (
                            <View
                              style={[
                                styles.sustainFill,
                                { height: `${sustainPct * 100}%`, borderRadius: cellSize / 4 },
                              ]}
                            />
                          )}
                          <Text
                            style={[
                              styles.noteCellText,
                              note.komal && styles.noteCellTextSmall,
                              isHit && styles.noteCellTextHit,
                              isCandidate && styles.noteCellTextHit,
                              isDetecting && styles.noteCellTextDetecting,
                            ]}
                          >
                            {note.display}
                          </Text>
                          {isHit && <Text style={styles.hitCheck}>✓</Text>}
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* Legend */}
            <View style={styles.legend}>
              {[
                { color: "#2a2a4e", label: "Not played" },
                { color: "#ffc107", label: "Hold ~250ms to mark" },
                { color: "#4caf50", label: "Played ✓" },
              ].map(({ color, label }) => (
                <View key={label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: color }]} />
                  <Text style={styles.legendText}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Instruction */}
            {!isListening && (
              <Text style={styles.instruction}>
                Start the tuner and play each note across all three octaves.{"\n"}
                Hold each note steadily for ~250 ms within ±15¢ to mark it.
              </Text>
            )}

            {/* Mini-tuner bar while listening */}
            {isListening && (
              <View style={styles.miniTuner}>
                <Text style={styles.miniTunerNote}>
                  {detectedNote ? detectedNote.sargam : "–"}
                </Text>
                <View style={styles.miniTunerRight}>
                  <View style={styles.miniCentsBar}>
                    <View style={styles.miniCenterLine} />
                    {detectedNote && (
                      <View
                        style={[
                          styles.miniCentsIndicator,
                          {
                            left: `${Math.max(0, Math.min(100, 50 + detectedNote.cents))}%`,
                            backgroundColor: getCentsColor(detectedNote.cents),
                          },
                        ]}
                      />
                    )}
                  </View>
                  <Text style={styles.miniTunerInfo}>
                    {detectedNote
                      ? `${detectedNote.detectedFreq.toFixed(1)} Hz · ${
                          Math.abs(detectedNote.cents) <= 5
                            ? "\u2713 In Tune"
                            : detectedNote.cents < 0
                            ? `\u266D ${Math.abs(detectedNote.cents)}\u00A2 flat`
                            : `\u266F ${detectedNote.cents}\u00A2 sharp`
                        }`
                      : "Listening\u2026"}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Start/Stop — shared */}
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

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#1a1a2e" },
  hiddenWebView:  { width: 0, height: 0, opacity: 0, position: "absolute" },
  scrollContent:  { flexGrow: 1, alignItems: "center", padding: 20, paddingTop: 60 },

  title: { color: "#fff", fontSize: 28, fontWeight: "bold", marginBottom: 16 },

  // View toggle
  viewToggle:         { flexDirection: "row", borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: "#3a3a5e", marginBottom: 16 },
  toggleBtn:          { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#2a2a4e" },
  toggleBtnActive:    { backgroundColor: "#6c63ff" },
  toggleBtnText:      { color: "#aaa", fontSize: 14, fontWeight: "600" },
  toggleBtnTextActive:{ color: "#fff" },

  // Scale selector
  scaleSection:         { width: "100%", alignItems: "center", marginBottom: 16 },
  scaleLabel:           { color: "#aaa", fontSize: 14, marginBottom: 8 },
  scaleScroll:          { maxHeight: 44 },
  scaleRow:             { flexDirection: "row", gap: 6, paddingHorizontal: 4 },
  scaleButton:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: "#2a2a4e" },
  scaleButtonActive:    { backgroundColor: "#6c63ff" },
  scaleButtonText:      { color: "#aaa", fontSize: 14, fontWeight: "600" },
  scaleButtonTextActive:{ color: "#fff" },
  scaleInfo:            { color: "#666", fontSize: 12, marginTop: 8 },

  // Circular tuner
  circleContainer: { alignItems: "center", justifyContent: "center", marginVertical: 16 },
  circle: {
    width: CIRCLE_SIZE, height: CIRCLE_SIZE, borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2, borderColor: "#2a2a4e", alignItems: "center", justifyContent: "center",
  },
  circleNote:         { position: "absolute", width: 44, height: 44, borderRadius: 22, backgroundColor: "#2a2a4e", alignItems: "center", justifyContent: "center" },
  circleNoteActive:   { backgroundColor: "#6c63ff", shadowColor: "#6c63ff", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 12, elevation: 8 },
  circleNoteText:     { color: "#aaa", fontSize: 13, fontWeight: "700" },
  circleNoteTextActive:{ color: "#fff", fontSize: 14 },
  centerDisplay:      { alignItems: "center", justifyContent: "center" },
  centerSargam:       { color: "#6c63ff", fontSize: 36, fontWeight: "bold" },
  centerFreq:         { color: "#fff", fontSize: 22, fontWeight: "600", marginTop: 4 },
  centerCents:        { fontSize: 16, fontWeight: "600", marginTop: 4 },
  centerWaiting:      { color: "#888", fontSize: 18 },

  // Cents bar
  centsBarContainer:  { flexDirection: "row", alignItems: "center", width: "90%", marginBottom: 20 },
  centsLabel:         { color: "#666", fontSize: 11, width: 30, textAlign: "center" },
  centsBar:           { flex: 1, height: 8, backgroundColor: "#2a2a4e", borderRadius: 4, marginHorizontal: 8, position: "relative", overflow: "visible" },
  centsCenterLine:    { position: "absolute", left: "50%", top: -4, width: 2, height: 16, backgroundColor: "#4caf50", marginLeft: -1 },
  centsIndicator:     { position: "absolute", top: -6, width: 20, height: 20, borderRadius: 10, marginLeft: -10 },

  // Range trainer
  rangeContainer: { width: "100%", gap: 16 },

  progressHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressText:     { color: "#fff", fontSize: 14, fontWeight: "600", marginBottom: 6 },
  progressBarBg:    { width: 180, height: 6, backgroundColor: "#2a2a4e", borderRadius: 3, overflow: "hidden" },
  progressBarFill:  { height: "100%", borderRadius: 3 },
  resetBtn:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: "#3a3a5e" },
  resetBtnText:     { color: "#888", fontSize: 12 },

  celebrationBox:   { backgroundColor: "#1a3a1a", borderWidth: 1, borderColor: "#4caf50", borderRadius: 10, padding: 12 },
  celebrationText:  { color: "#4caf50", fontSize: 13, fontWeight: "600", textAlign: "center" },

  octaveSection:  { gap: 8 },
  octaveHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  octaveName:     { color: "#fff", fontSize: 14, fontWeight: "600" },
  octaveSubtitle: { color: "#666", fontSize: 11, marginTop: 1 },
  octaveCount:    { color: "#666", fontSize: 12 },

  noteRow:  { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  noteCell: {
    alignItems: "center", justifyContent: "center",
    overflow: "hidden", position: "relative",
  },
  noteCellDefault:   { backgroundColor: "#2a2a4e" },
  noteCellKomal:     { backgroundColor: "#222240", opacity: 0.85 },
  noteCellDetecting: { backgroundColor: "#1a1a2e", borderWidth: 2, borderColor: "#6c63ff" },
  noteCellCandidate: { backgroundColor: "#ffc107" },
  noteCellHit:       { backgroundColor: "#4caf50" },

  sustainFill: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  noteCellText:      { color: "#aaa", fontSize: 11, fontWeight: "600", textAlign: "center", zIndex: 1 },
  noteCellTextSmall: { fontSize: 9 },
  noteCellTextHit:   { color: "#fff" },
  noteCellTextDetecting: { color: "#6c63ff" },
  hitCheck:          { color: "#fff", fontSize: 8, marginTop: 1, zIndex: 1 },

  legend:      { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#2a2a4e" },
  legendItem:  { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:   { width: 10, height: 10, borderRadius: 3 },
  legendText:  { color: "#666", fontSize: 11 },

  instruction: { color: "#666", fontSize: 12, textAlign: "center", lineHeight: 18 },

  // Mini-tuner bar (range view, while listening)
  miniTuner:          { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#252545", borderRadius: 12, padding: 12 },
  miniTunerNote:      { color: "#fff", fontSize: 18, fontWeight: "bold", width: 44 },
  miniTunerRight:     { flex: 1 },
  miniCentsBar:       { height: 6, backgroundColor: "#1a1a2e", borderRadius: 3, marginBottom: 6, position: "relative", overflow: "visible" },
  miniCenterLine:     { position: "absolute", left: "50%", top: -4, width: 1, height: 14, backgroundColor: "#4caf50", marginLeft: -1 },
  miniCentsIndicator: { position: "absolute", top: -5, width: 16, height: 16, borderRadius: 8, marginLeft: -8 },
  miniTunerInfo:      { color: "#888", fontSize: 11 },

  // Error + button
  errorText: { color: "#ff5722", fontSize: 13, marginBottom: 12, textAlign: "center" },
  button:        { paddingHorizontal: 40, paddingVertical: 16, borderRadius: 30, backgroundColor: "#6c63ff", marginTop: 10 },
  buttonActive:  { backgroundColor: "#ff6b6b" },
  buttonText:    { color: "#fff", fontSize: 18, fontWeight: "bold" },
});
