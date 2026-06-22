import React, { useState, useRef } from "react";
import { StyleSheet, View, ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SITE_CONFIG } from "../../platform/src/lib/site.config";

const SONGBOOK_URL = SITE_CONFIG.url;

const INJECTED_JS = `
  (function() {
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, shrink-to-fit=no';

    var style = document.createElement('style');
    style.textContent = [
      'html, body { max-width: 100vw !important; overflow-x: hidden !important; }',
      '*, *::before, *::after { box-sizing: border-box !important; }',
      'img, video, iframe, table, pre { max-width: 100% !important; height: auto !important; }',
      '.notation-line, .notation-text, .lyrics-text { word-break: break-word !important; overflow-wrap: break-word !important; }',
      '.notation-text { flex-wrap: wrap !important; }',
      'pre, code { white-space: pre-wrap !important; word-break: break-all !important; }',
    ].join(' ');
    document.head.appendChild(style);
  })();
  true;
`;

export default function SongbookScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    webViewRef.current?.reload();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to Connect</Text>
          <Text style={styles.errorMessage}>
            Could not reach the songbook server. Please check your internet connection and try again.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: SONGBOOK_URL }}
          style={styles.webview}
          onLoadEnd={() => setLoading(false)}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            setLoading(false);
            setError(nativeEvent.description || "Connection failed");
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            if (nativeEvent.statusCode >= 500) {
              setError(`Server error (${nativeEvent.statusCode})`);
            }
          }}
          injectedJavaScript={INJECTED_JS}
          scalesPageToFit={true}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          allowsBackForwardNavigationGestures
          overScrollMode="never"
        />
      )}
      {loading && !error && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6c63ff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  errorMessage: {
    fontSize: 16,
    textAlign: "center",
    color: "#666",
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#6c63ff",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
