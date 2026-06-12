import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

const SONGBOOK_BASE_URL = "https://songnotations.vercel.app";

export default function SongDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const songUrl = `${SONGBOOK_BASE_URL}/songs/${id}`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Song
        </Text>
      </View>

      {/* Loading overlay */}
      {loading && !hasError && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6c63ff" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      {/* Error state */}
      {hasError && (
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color="#6c63ff" />
          <Text style={styles.errorText}>Could not load song</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setHasError(false); setLoading(true); }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* WebView showing the song page */}
      {!hasError && (
        <WebView
          source={{ uri: songUrl }}
          style={styles.webview}
          onLoadStart={() => { setLoading(true); setHasError(false); }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setHasError(true); }}
          onHttpError={(e) => {
            if (e.nativeEvent.statusCode >= 500) {
              setLoading(false);
              setHasError(true);
            }
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          cacheEnabled={true}
          mixedContentMode="compatibility"
          allowsInlineMediaPlayback={true}
          setSupportMultipleWindows={false}
          originWhitelist={["https://*", "http://*"]}
          overScrollMode="never"
          textZoom={100}
          androidLayerType="hardware"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 50,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a4e",
  },
  backBtn: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  errorText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  retryBtn: {
    backgroundColor: "#6c63ff",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
