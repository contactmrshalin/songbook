import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const SONGS_URL =
  "https://raw.githubusercontent.com/contactmrshalin/songbook/refs/heads/main/data/songs.json";

interface SongLine {
  lyrics: string;
  indian?: string;
  western?: string;
}

interface SongSection {
  name: string;
  lines: SongLine[];
}

interface Song {
  id: string;
  title: string;
  export?: boolean;
  info: string[];
  thumbnail?: string;
  background?: string;
  sections: SongSection[];
}

interface SongsData {
  songs: Song[];
}

let cachedSongs: Song[] | null = null;

export default function SongbookScreen() {
  const router = useRouter();
  const [songs, setSongs] = useState<Song[]>(cachedSongs || []);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(!cachedSongs);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSongs = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else if (!cachedSongs) setLoading(true);
      setError(null);

      const res = await fetch(SONGS_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SongsData = await res.json();
      const exportable = data.songs.filter((s) => s.export !== false);
      cachedSongs = exportable;
      setSongs(exportable);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load songs";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!cachedSongs) {
      fetchSongs();
    }
  }, [fetchSongs]);

  const filteredSongs = useMemo(() => {
    if (!search.trim()) return songs;
    const q = search.toLowerCase();
    return songs.filter((song) => {
      const searchable = [
        song.title,
        ...song.info,
        ...song.sections.flatMap((s) => s.lines.map((l) => l.lyrics)),
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(q);
    });
  }, [songs, search]);

  const getSubtitle = (song: Song): string => {
    const film = song.info.find(
      (i) => i.startsWith("Film") || i.startsWith("Artist")
    );
    return film || "";
  };

  const getSectionCount = (song: Song): number => song.sections.length;

  const navigateToSong = (song: Song) => {
    router.push({
      pathname: "/song/[id]",
      params: { id: song.id, songData: JSON.stringify(song) },
    });
  };

  const renderSongItem = ({ item }: { item: Song }) => (
    <TouchableOpacity
      style={styles.songCard}
      onPress={() => navigateToSong(item)}
      activeOpacity={0.7}
    >
      <View style={styles.songIcon}>
        <Ionicons name="musical-note" size={20} color="#6c63ff" />
      </View>
      <View style={styles.songInfo}>
        <Text style={styles.songTitle} numberOfLines={1}>
          {item.title}
        </Text>
        {getSubtitle(item) ? (
          <Text style={styles.songSubtitle} numberOfLines={1}>
            {getSubtitle(item)}
          </Text>
        ) : null}
      </View>
      <View style={styles.songMeta}>
        <Text style={styles.sectionBadge}>
          {getSectionCount(item)} {getSectionCount(item) === 1 ? "section" : "sections"}
        </Text>
        <Ionicons name="chevron-forward" size={18} color="#555" />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6c63ff" />
        <Text style={styles.loadingText}>Loading songs...</Text>
      </View>
    );
  }

  if (error && songs.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="cloud-offline-outline" size={48} color="#6c63ff" />
        <Text style={styles.errorText}>Could not load songs</Text>
        <Text style={styles.errorSubtext}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchSongs()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Songbook</Text>
        <Text style={styles.headerCount}>{songs.length} songs</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={18}
          color="#888"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search songs, lyrics, artist..."
          placeholderTextColor="#666"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      {/* Song List */}
      <FlatList
        data={filteredSongs}
        keyExtractor={(item) => item.id}
        renderItem={renderSongItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchSongs(true)}
            tintColor="#6c63ff"
            colors={["#6c63ff"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={40} color="#555" />
            <Text style={styles.emptyText}>No songs found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 50,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
  },
  headerCount: {
    color: "#888",
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2a4e",
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  songCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#242444",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  songIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(108,99,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  songSubtitle: {
    color: "#888",
    fontSize: 12,
    marginTop: 3,
  },
  songMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionBadge: {
    color: "#6c63ff",
    fontSize: 11,
    fontWeight: "500",
  },
  loadingText: {
    color: "#888",
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorSubtext: {
    color: "#888",
    fontSize: 13,
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
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyText: {
    color: "#666",
    fontSize: 15,
  },
});
