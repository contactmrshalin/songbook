import React, { useRef, useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  BackHandler,
  TouchableOpacity,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";

const SONGBOOK_URL = "https://songnotations.vercel.app/";

export default function SongbookScreen() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [key, setKey] = useState(0);

  // Handle Android back button for in-WebView navigation
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
        style={[styles.webview, hasError && styles.hiddenWebview]}
        onLoadStart={() => {
          setLoading(true);
          setHasError(false);
        }}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setHasError(true);
        }}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode >= 500) {
            setLoading(false);
            setHasError(true);
          }
        }}
        onContentProcessDidTerminate={() => {
          setKey((prev) => prev + 1);
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
        originWhitelist={["https://*", "http://*"]}
        overScrollMode="never"
        textZoom={100}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={false}
        androidLayerType="hardware"
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
  hiddenWebview: {
    flex: 0,
    height: 0,
    opacity: 0,
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
