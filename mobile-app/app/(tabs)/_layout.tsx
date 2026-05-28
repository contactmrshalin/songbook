import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#6c63ff",
        tabBarInactiveTintColor: "#888",
        tabBarStyle: {
          backgroundColor: "#1a1a2e",
          borderTopColor: "#2a2a4e",
          height: 60,
          paddingBottom: 8,
        },
        headerStyle: {
          backgroundColor: "#1a1a2e",
        },
        headerTintColor: "#fff",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Songbook",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="musical-notes" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="metronome"
        options={{
          title: "Metronome",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="timer-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tuner"
        options={{
          title: "Tuner",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="mic-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tanpura"
        options={{
          title: "Tanpura",
          headerStyle: {
            backgroundColor: "#0d0705",
          },
          headerTintColor: "#E8C99A",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="radio-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
