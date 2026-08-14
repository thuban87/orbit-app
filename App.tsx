import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { HomeScreen } from "@/screens/HomeScreen";
import { ThemeProvider } from "@/theme";

/**
 * App entry: the thin shell. `ThemeProvider` reads the persisted `orbit-theme`
 * store internally (so a rehydrated selection restyles the tree); the home
 * shell body lives in `src/screens/HomeScreen.tsx`, not here. No expo-router —
 * a single shell this phase (SKELETON.md).
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="light" />
        <HomeScreen />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
