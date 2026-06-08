import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView, WebViewPermissionRequest } from "react-native-webview";

const TUNER_URL = "https://songnotations.vercel.app/tools/tuner";

/**
 * Injected before content loads to hide the web nav bar without a flash.
 * The layout.tsx sticky nav and its padding are removed so the tuner fills
 * the full WebView viewport.
 */
const HIDE_NAV_JS = `
(function () {
  var style = document.createElement('style');
  style.textContent = [
    'nav { display: none !important; }',
    'header { display: none !important; }',
    'main { padding-top: 0 !important; margin-top: 0 !important; }',
    'body > div > nav { display: none !important; }',
  ].join(' ');
  document.head.appendChild(style);
})();
true;
`;

export default function TunerScreen() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  function handleRetry() {
    setHasError(false);
    setLoading(true);
    webViewRef.current?.reload();
  }

  function handlePermissionRequest(event: { nativeEvent: WebViewPermissionRequest }) {
    event.nativeEvent.grant(event.nativeEvent.resources);
  }

  return (
    <View style={styles.container}>
      {/* Loading overlay */}
      {loading && !hasError && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.loadingTitle}>Bansuri Studio</Text>
          <Text style={styles.loadingSubtitle}>Loading tuner…</Text>
        </View>
      )}

      {/* Error state */}
      {hasError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>📡</Text>
          <Text style={styles.errorTitle}>Couldn't load tuner</Text>
          <Text style={styles.errorSub}>Check your internet connection and try again.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: TUNER_URL }}
          style={[styles.webView, loading && styles.hidden]}
          /* --- Loading / error callbacks --- */
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setHasError(true);
          }}
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode >= 500) {
              setLoading(false);
              setHasError(true);
            }
          }}
          /* --- Nav bar removal (before content so no flash) --- */
          injectedJavaScriptBeforeContentLoaded={HIDE_NAV_JS}
          /* --- Media / microphone --- */
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          // iOS: auto-grant mic access inside WKWebView
          mediaCapturePermissionGrantType="grant"
          // Android: grant mic permission when the WebView requests it
          onPermissionRequest={handlePermissionRequest}
          /* --- General WebView flags --- */
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={["*"]}
          // Identify as mobile browser so the site renders its responsive layout
          userAgent={
            Platform.OS === "ios"
              ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
              : "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0e17",
  },
  webView: {
    flex: 1,
  },
  hidden: {
    opacity: 0,
  },

  /* Loading overlay */
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0f0e17",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    zIndex: 10,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    marginTop: 8,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: "#9CA3AF",
  },

  /* Error state */
  errorContainer: {
    flex: 1,
    backgroundColor: "#0f0e17",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 8,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  errorSub: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 8,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "#6C63FF",
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
