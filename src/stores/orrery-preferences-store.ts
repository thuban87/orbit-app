import { create } from "zustand";
import {
  getAppSettings,
  type OrreryDensity,
  type OrrerySystemId,
  updateAppSettings,
} from "@/db/app-settings-dao";
import { localDateTime } from "@/db/database";
import type { SqlExecutor } from "@/db/types";

export interface OrreryPreferences {
  density: OrreryDensity;
  satellitesEnabled: 0 | 1;
  lastSystem: OrrerySystemId;
}
export const DEFAULT_ORRERY_PREFERENCES: OrreryPreferences = {
  density: "balanced",
  satellitesEnabled: 0,
  lastSystem: "builtin:all-contacts",
};
type Intent = Partial<OrreryPreferences>;
interface PreferencesAdapters {
  read: (exec: SqlExecutor) => Promise<Partial<OrreryPreferences>>;
  write: (exec: SqlExecutor, intent: Intent) => Promise<void>;
}
export interface OrreryPreferencesState {
  committed: OrreryPreferences;
  hydrated: boolean;
  hydration: "idle" | "loading" | "ready" | "error";
  saving: boolean;
  saveError: boolean;
  pendingIntent: Intent | null;
  hydrate: (exec: SqlExecutor) => Promise<void>;
  save: (exec: SqlExecutor, intent: Intent) => Promise<void>;
  retry: (exec: SqlExecutor) => Promise<void>;
}
const KEYS = ["density", "satellitesEnabled", "lastSystem"] as const;
const adapters: PreferencesAdapters = {
  async read(exec) {
    const settings = await getAppSettings(exec);
    return {
      density: settings.orreryDensity,
      satellitesEnabled: settings.orrerySatellitesEnabled,
      lastSystem: settings.orreryLastSystem,
    };
  },
  write: (exec, intent) =>
    updateAppSettings(
      exec,
      {
        orreryDensity: intent.density,
        orrerySatellitesEnabled: intent.satellitesEnabled,
        orreryLastSystem: intent.lastSystem,
      },
      localDateTime(),
    ),
};

/** One serialized writer; only completed SQLite commits publish a selection.
 * Pending intent is ephemeral and survives failure for retry. No camera state.
 */
export function createOrreryPreferencesStore(
  io: PreferencesAdapters = adapters,
) {
  let generation = 0;
  let reading: Promise<void> | null = null;
  let draining: Promise<void> | null = null;
  let inFlight: Intent | null = null;
  return create<OrreryPreferencesState>()((set, get) => {
    const drain = (exec: SqlExecutor): Promise<void> => {
      if (draining) return draining;
      set({ saving: true, saveError: false });
      const work = async () => {
        while (get().pendingIntent) {
          const intent = { ...get().pendingIntent };
          inFlight = intent;
          ++generation;
          try {
            await io.write(exec, intent);
          } catch {
            set({ saving: false, saveError: true });
            return;
          }
          ++generation;
          const remaining = { ...get().pendingIntent };
          for (const key of KEYS)
            if (remaining[key] === intent[key]) delete remaining[key];
          set({
            committed: { ...get().committed, ...intent },
            pendingIntent: Object.keys(remaining).length ? remaining : null,
          });
        }
        set({ saving: false });
      };
      draining = work().finally(() => {
        draining = null;
        inFlight = null;
      });
      return draining;
    };
    return {
      committed: { ...DEFAULT_ORRERY_PREFERENCES },
      hydrated: false,
      hydration: "idle",
      saving: false,
      saveError: false,
      pendingIntent: null,
      hydrate: (exec) => {
        if (reading) return reading;
        const request = ++generation;
        set({ hydration: "loading" });
        reading = (async () => {
          try {
            const stored = await io.read(exec);
            if (request === generation) {
              const committed = { ...get().committed };
              for (const key of KEYS) {
                Object.assign(committed, {
                  [key]: stored[key] ?? DEFAULT_ORRERY_PREFERENCES[key],
                });
              }
              set({ committed, hydrated: true, hydration: "ready" });
            } else set({ hydration: get().hydrated ? "ready" : "idle" });
          } catch {
            if (request === generation) set({ hydration: "error" });
            else set({ hydration: get().hydrated ? "ready" : "idle" });
          }
        })().finally(() => {
          reading = null;
        });
        return reading;
      },
      save: (exec, intent) => {
        // Never infer durable defaults after an unread/failed initial load.
        if (!get().hydrated) return Promise.resolve();
        const desired = {
          ...get().committed,
          ...inFlight,
          ...get().pendingIntent,
        };
        const changed: Intent = {};
        for (const key of KEYS)
          if (intent[key] !== undefined && intent[key] !== desired[key])
            Object.assign(changed, { [key]: intent[key] });
        if (Object.keys(changed).length === 0)
          return draining ?? Promise.resolve();
        set({ pendingIntent: { ...get().pendingIntent, ...changed } });
        return drain(exec);
      },
      retry: async (exec) => {
        if (get().hydration === "error" || !get().hydrated)
          await get().hydrate(exec);
        if (get().hydrated && get().pendingIntent) await drain(exec);
      },
    };
  });
}
export const useOrreryPreferencesStore = createOrreryPreferencesStore();
