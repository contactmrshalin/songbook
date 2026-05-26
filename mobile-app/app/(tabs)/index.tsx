import { useRef, useState } from "react";
import { StyleSheet, View, Text, ActivityIndicator, BackHandler, TouchableOpacity, Platform, Linking } from "react-native";
import { WebView } from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect } from "react";

const SONGBOOK_URL = "https://songnotations.vercel.app/";

export default function SongbookScreen() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [key, setKey] = useState(0);

  // Handle Android back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress
      );
      return () => subscription.remove();
    }, [canGoBack])
  );

  const handleRetry = () => {
    setHasError(false);
    setLoading(true);
    setKey((prev) => prev + 1);
  };

  // On web, render an iframe directly instead of react-native-webview
  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <iframe
          src={SONGBOOK_URL}
          style={{ flex: 1, width: "100%", height: "100%", border: "none" } as any}
          allow="autoplay"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && !hasError && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6c63ff" />
          <Text style={styles.loadingText}>Loading Songbook...</Text>
        </View>
      )}
      {hasError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Unable to load songbook</Text>
          <Text style={styles.errorSubtext}>Check your internet connection</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      <WebView
        key={key}
        ref={webViewRef}
        source={{ uri: SONGBOOK_URL }}
        style={[styles.webview, hasError && { display: "none" }]}
        onLoadStart={() => { setLoading(true); setHasError(false); }}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setLoading(false); setHasError(true); }}
        onHttpError={(syntheticEvent) => {
          const { statusCode } = syntheticEvent.nativeEvent;
          if (statusCode >= 500) {
            setLoading(false);
            setHasError(true);
          }
        }}
        onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        allowsBackForwardNavigationGestures={true}
        mediaPlaybackRequiresUserAction={false}
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback={true}
        setSupportMultipleWindows={false}
        originWhitelist={['https://*', 'http://*']}
        overScrollMode="never"
        textZoom={100}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={false}
        injectedJavaScript={`
          // Fix viewport for proper rendering
          var meta = document.querySelector('meta[name="viewport"]');
          if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1, maximum-scale=5';
            document.head.appendChild(meta);
          }
          // Suppress ad-related errors that may halt execution
          window.adsbygoogle = window.adsbygoogle || [];
          // WebView rendering fixes
          (function() {
            var style = document.createElement('style');
            style.textContent = [
              // Fixed backgrounds cause scroll issues in WebView
              '.fixed.inset-0.z-0 { position: absolute; }',
              // Ensure glass overlays have solid fallback for WebViews without backdrop-filter
              '.glass { background: rgba(249,247,241,0.97) !important; }',
              '.glass-dark { background: rgba(26,26,46,0.97) !important; }',
              // Ensure notation content is visible with correct colors
              '.notation-line { position: relative; z-index: 2; }',
              '.notation-text { color: #6C63FF; font-size: 15px; line-height: 1.6; }',
              '.lyrics-text { color: #1A1A2E; font-size: 16px; line-height: 1.5; }',
              // Song header glass fallback
              '.song-header-glass { background: linear-gradient(to bottom, rgba(40,40,70,0.85), rgba(26,26,46,0.95)) !important; }'
            ].join('\\n');
            document.head.appendChild(style);
          })();
          true;
        `}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    zIndex: 10,
  },
  loadingText: {
    color: "#888",
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    zIndex: 10,
  },
  errorText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  errorSubtext: {
    color: "#888",
    fontSize: 14,
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#6c63ff",
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
