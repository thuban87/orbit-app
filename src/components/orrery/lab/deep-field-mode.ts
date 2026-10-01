/**
 * ORRERY LAB A — EXPERIMENT ONLY. Runtime A/B switch between the Lab A
 * deep-field renderer and the legacy flat renderer, so ONE build (incl. a
 * release build) can measure both. In-memory only (resets to
 * `DEEP_FIELD_ENABLED` on app start); never persisted, never shipped.
 * Toggled from the "Lab A renderer (experiment)" row in View options.
 */
import { useEffect, useState } from "react";
import { create } from "zustand";
import { DEEP_FIELD_ENABLED } from "./deep-field-config";

interface DeepFieldModeState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const useDeepFieldModeStore = create<DeepFieldModeState>((set) => ({
  enabled: DEEP_FIELD_ENABLED,
  setEnabled: (enabled) => set({ enabled }),
}));

/**
 * Whether the Lab A deep-field renderer is currently active. Reads the store
 * snapshot and re-renders on change through plain useState/useEffect (the
 * render tests stub React hooks, so the zustand selector hook is avoided here).
 */
export function useDeepFieldEnabled(): boolean {
  const [, rerender] = useState(() => 0);
  useEffect(
    () => useDeepFieldModeStore.subscribe(() => rerender((count) => count + 1)),
    [],
  );
  return useDeepFieldModeStore.getState().enabled;
}
