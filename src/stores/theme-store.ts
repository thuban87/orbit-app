import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_PRESET_ID } from "@/theme/theme-presets";
import type { ThemeMode, ThemePresetId } from "@/theme/theme-types";

/**
 * Persisted theme-selection store (FND-05).
 *
 * Holds ONLY the user's selection (`mode` + `presetId`) — the resolved palette
 * is derived in `ThemeProvider`, never stored. Persisted to AsyncStorage; on
 * launch the selection rehydrates and drives the provider, restyling the app.
 * This is a live store wired into `ThemeProvider`, not dead scaffolding.
 *
 * Deliberately flat: the per-profile coupling and full-state `.subscribe`
 * listener of the analog store were dropped — Orbit has no such entity yet.
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
