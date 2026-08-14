import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_PRESET_ID } from "@/theme/theme-presets";
import type { ThemeMode, ThemePresetId } from "@/theme/theme-types";

/**
 * Persisted theme-selection store (FND-05).
 *
 * Holds ONLY the user's selection (`mode` + `presetId`) — the resolved palette
 * is derived in `ThemeProvider`, never stored. Persisted to AsyncStorage under
 * `orbit-theme`; on launch the selection rehydrates and drives the provider,
 * restyling the app. This is a live store wired into `ThemeProvider`, not dead
 * scaffolding.
 *
 * Flattened from quest-board's per-character store: Orbit has no characters this
 * phase, so the `character-store` coupling and its full-state `.subscribe`
 * listener are deliberately dropped.
 */
interface ThemeStore {
  mode: ThemeMode;
  presetId: ThemePresetId;
  setMode: (mode: ThemeMode) => void;
  setPreset: (presetId: ThemePresetId) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: "dark",
      presetId: DEFAULT_PRESET_ID,
      setMode: (mode) => set({ mode }),
      setPreset: (presetId) => set({ presetId }),
    }),
    {
      name: "orbit-theme",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Persist only the selection — nothing derived, nothing sensitive.
      partialize: (state) => ({
        mode: state.mode,
        presetId: state.presetId,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.warn("[theme] Rehydration error:", error);
        }
      },
    },
  ),
);
