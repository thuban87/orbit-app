import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ModelScope } from "@/ai/model-registry";

/**
 * Persisted AI model-picker preference (14-10).
 *
 * Holds ONLY the "Frontier only / All models" scope — a device-local UI
 * preference, NOT contact data and NOT privacy/security state. It is therefore
 * AsyncStorage, not a SQLite row and not a migration (mirroring
 * `dashboard-prefs-store`: only an enum value persists, no contact content, no
 * network). Using the prefs store rather than an `app_settings` column also avoids
 * an IRREVERSIBLE schema migration for what is purely a display toggle.
 *
 * Default is `frontier` so the picker opens on the short current-gen set (the
 * pre-14-10 behaviour), and the exact ids always come from the LiteLLM catalog.
 * Copies the shipped `theme-store` / `dashboard-prefs` Zustand `persist` shape
 * verbatim (createJSONStorage(AsyncStorage) + version + partialize + warn-on-rehydrate).
 */
interface AiModelPrefsStore {
  modelScope: ModelScope;
  setModelScope: (scope: ModelScope) => void;
}

export const useAiModelPrefs = create<AiModelPrefsStore>()(
  persist(
    (set) => ({
      modelScope: "frontier",
      setModelScope: (modelScope) => set({ modelScope }),
    }),
    {
      name: "orbit-ai-model-prefs",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Persist only the last-used scope — nothing derived, nothing sensitive.
      partialize: (state) => ({ modelScope: state.modelScope }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.warn("[ai-model-prefs] Rehydration error:", error);
        }
      },
    },
  ),
);
