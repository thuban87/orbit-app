import { create } from "zustand";
import {
  activateAiConnection,
  getActiveConnectionLane,
} from "@/db/ai-connections-dao";
import { getAppSettings, updateAppSettings } from "@/db/app-settings-dao";
import { localDateTime } from "@/db/database";
import type { SqlExecutor } from "@/db/types";
import type { AiCloudProviderId } from "@/services/ai-types";

interface AiConfigStore {
  aiEnabled: boolean;
  activeConnection: AiCloudProviderId | null;
  hydrated: boolean;
  hydrate: (exec: SqlExecutor) => Promise<void>;
  setAiEnabled: (exec: SqlExecutor, enabled: boolean) => Promise<void>;
  setActiveConnection: (
    exec: SqlExecutor,
    lane: AiCloudProviderId,
  ) => Promise<void>;
}

/** Durable AI configuration state. Credentials never enter this store. */
export const useAiConfigStore = create<AiConfigStore>()((set, get) => ({
  aiEnabled: false,
  activeConnection: null,
  hydrated: false,
  hydrate: async (exec) => {
    const [settings, activeConnection] = await Promise.all([
      getAppSettings(exec),
      getActiveConnectionLane(exec),
    ]);
    set({
      aiEnabled: settings.aiEnabled === 1,
      activeConnection,
      hydrated: true,
    });
  },
  setAiEnabled: async (exec, enabled) => {
    if (enabled === get().aiEnabled) return;
    await updateAppSettings(
      exec,
      { aiEnabled: enabled ? 1 : 0 },
      localDateTime(),
    );
    set({ aiEnabled: enabled });
  },
  setActiveConnection: async (exec, lane) => {
    if (lane === get().activeConnection) return;
    await activateAiConnection(exec, lane, localDateTime());
    set({ activeConnection: lane });
  },
}));
