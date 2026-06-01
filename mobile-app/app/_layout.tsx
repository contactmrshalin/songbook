import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ThemeProvider,
  DefaultTheme,
} from "@react-navigation/native";

const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#ffffff",
    card: "#ffffff",
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={LightTheme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="song/[id]"
          options={{ animation: "slide_from_right" }}
        />
      </Stack>
    </ThemeProvider>
  );
}
