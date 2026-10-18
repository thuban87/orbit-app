import type {
  OpenRouterCatalog,
  OpenRouterModel,
} from "@/ai/openrouter-catalog";
import { NOT_SET } from "@/constants/glossary";
import type { ResolvedAiConnection } from "@/db/ai-connections-dao";
import type { AppSettingsPatch } from "@/db/app-settings-dao";
import type { SqlExecutor } from "@/db/types";
import {
  type AiAvailability,
  computeAiAvailability,
  isSelectedConnectionModelAvailable,
} from "@/logic/ai-availability";
import type { AiCloudProviderId, AiProviderId } from "@/services/ai-types";
import { AI_LANE_NAMES } from "./ai-connection-logic";

/**
 * The AI hub's rows. "Style and Context" is one row opening the
 * personalization page at the top — no section target (38.12 D-126, owner
 * Q-27; amends phase-16 §AD's six-row list).
 */
export type AiHubSection =
  | { readonly label: "Connection"; readonly route: "AIConnection" }
  | { readonly label: "Model"; readonly route: "AIModelPicker" }
  | {
      readonly label: "Style and Context";
      readonly route: "AIPersonalization";
    }
  | {
      readonly label: "AI Data Permissions";
      readonly route: "AIPermissions";
    }
  | {
      readonly label: "Preview What Orbit Sends";
      readonly route: "AIPreview";
    };

const AI_HUB_SECTIONS: ReadonlyArray<AiHubSection> = Object.freeze([
  { label: "Connection", route: "AIConnection" },
  { label: "Model", route: "AIModelPicker" },
  { label: "Style and Context", route: "AIPersonalization" },
  { label: "AI Data Permissions", route: "AIPermissions" },
  { label: "Preview What Orbit Sends", route: "AIPreview" },
]);

export interface AiHubState {
  readonly status: AiAvailability;
  readonly showSimplified: boolean;
  readonly escapeHatch: boolean;
  readonly sections: ReadonlyArray<AiHubSection>;
}

/** Master-off wins over every configuration signal and is never misconfiguration. */
export function deriveAiHubState(
  aiEnabled: boolean,
  availability: AiAvailability,
): AiHubState {
  if (!aiEnabled) {
    return {
      status: "off",
      showSimplified: true,
      escapeHatch: true,
      sections: [],
    };
  }

  return {
    status: availability === "off" ? "needs-attention" : availability,
    showSimplified: false,
    escapeHatch: false,
    sections: AI_HUB_SECTIONS,
  };
}

/** The master control is deliberately incapable of mutating saved AI config. */
export function buildAiEnabledPatch(enabled: boolean): AppSettingsPatch {
  return { aiEnabled: enabled ? 1 : 0 };
}

/** Build the hub's readiness from the same complete snapshot Compose uses. */
export function computeAiHubAvailability(input: {
  readonly aiEnabled: boolean;
  readonly activeConnection: ResolvedAiConnection | null;
  readonly hasCredential: boolean;
  readonly openRouterModels: readonly OpenRouterModel[];
}): AiAvailability {
  return computeAiAvailability({
    aiEnabled: input.aiEnabled,
    activeConnection: input.activeConnection?.lane ?? null,
    hasCredential: input.hasCredential,
    selectedModel: input.activeConnection?.model ?? "",
    modelAvailable: isSelectedConnectionModelAvailable(
      input.activeConnection,
      input.openRouterModels,
    ),
  });
}

/**
 * Injectable collaborators for {@link loadAiHubAvailability}. The screen binds
 * these to the real DAO/store/SecureStore/catalog readers; a test injects mocks
 * so the PRODUCER of availability is provable without a real AI provider network
 * call. `loadCachedOpenRouterCatalog` is a storage-bound thunk (the screen owns
 * the on-disk cache-file storage) — this module stays free of expo-file-system.
 */
export interface AiHubAvailabilityDeps {
  readonly hydrateAiConfig: (exec: SqlExecutor) => Promise<void>;
  readonly getAiConfig: () => { readonly aiEnabled: boolean };
  readonly resolveActiveAiConnection: (
    exec: SqlExecutor,
  ) => Promise<ResolvedAiConnection | null>;
  readonly readCredentialPresence: (
    provider: AiProviderId,
    getKey: (p: AiCloudProviderId) => Promise<string | null>,
  ) => Promise<boolean>;
  readonly loadCachedOpenRouterCatalog: () => Promise<OpenRouterCatalog | null>;
  readonly getKey: (
    provider: AiCloudProviderId,
    customEndpoint?: string,
  ) => Promise<string | null>;
}

/**
 * What the hub loaded on its last focus (38.12 D-85): the readiness, the active
 * connection and the selected model's display name. Never a key.
 */
export interface AiHubSnapshot {
  readonly availability: AiAvailability;
  readonly connection: ResolvedAiConnection | null;
  /** The catalog name for an OpenRouter model, else the saved id; null if none. */
  readonly modelName: string | null;
}

/**
 * The selected model's display name: OpenRouter's catalog name when the cached
 * catalog knows the id, otherwise the saved id (direct and Custom ids have no
 * separate name). `null` when no model is selected.
 */
export function hubModelName(
  connection: ResolvedAiConnection | null,
  openRouterModels: readonly OpenRouterModel[],
): string | null {
  if (!connection) return null;
  return laneModelName(connection.lane, connection.model, openRouterModels);
}

/**
 * A lane's model display name (38.12 D-85; DEF-03 for the AI Connection
 * card): OpenRouter's catalog name when the cached catalog knows the id, else
 * the saved id. `null` when no model is saved.
 */
export function laneModelName(
  lane: string,
  modelId: string | null | undefined,
  openRouterModels: readonly OpenRouterModel[],
): string | null {
  const id = modelId?.trim() ?? "";
  if (id === "") return null;
  if (lane === "openrouter") {
    const name =
      openRouterModels.find((model) => model.id === id)?.name.trim() ?? "";
    if (name !== "") return name;
  }
  return id;
}

/**
 * PRODUCES the AI hub snapshot that {@link deriveAiHubState} and
 * {@link aiHubRowDisplay} consume, porting the monolith's fresh-on-focus
 * `reloadAiAvailability` pipeline: hydrate config → resolve the active
 * connection → read credential presence → load the cached OpenRouter catalog
 * ONLY when the active lane is `openrouter` → compute.
 *
 * This is READ-PATH hydration of already-stored config: the catalog step reads
 * the local on-disk cache (via the injected thunk), never a real AI provider
 * network call (local-first; no new egress; `AiService.ts` untouched). The row
 * values reuse what this pipeline already read — no new read path (D-85). A
 * failing collaborator REJECTS so the caller can surface its focus-load error
 * path.
 */
export async function loadAiHubSnapshot(
  exec: SqlExecutor,
  deps: AiHubAvailabilityDeps,
): Promise<AiHubSnapshot> {
  await deps.hydrateAiConfig(exec);
  const config = deps.getAiConfig();
  const connection = await deps.resolveActiveAiConnection(exec);
  const hasCredential = await deps.readCredentialPresence(
    connection?.lane ?? "none",
    (lane) =>
      deps.getKey(
        lane,
        lane === "custom" ? connection?.customEndpoint : undefined,
      ),
  );
  const catalog =
    connection?.lane === "openrouter"
      ? await deps.loadCachedOpenRouterCatalog()
      : null;
  const openRouterModels = catalog?.models ?? [];
  return {
    availability: computeAiHubAvailability({
      aiEnabled: config.aiEnabled,
      activeConnection: connection,
      hasCredential,
      openRouterModels,
    }),
    connection,
    modelName: hubModelName(connection, openRouterModels),
  };
}

/** Readiness as the Connection row's subtitle (D-85). */
export const AI_HUB_READY = "Ready";
export const AI_HUB_NEEDS_ATTENTION = "Needs attention";

export interface AiHubRowDisplay {
  /** Right-aligned current value, or null for none. */
  readonly value: string | null;
  /** Secondary line under the title, or null for none. */
  readonly subtitle: string | null;
}

/**
 * A hub row's current value (38.12 D-85). Connection reads "<provider> ·
 * <model name>" with the readiness under it; Model reads the model name; the
 * other rows carry none. Before the first load (`snapshot` null) no value is
 * shown, so nothing flashes "Not set".
 */
export function aiHubRowDisplay(
  section: AiHubSection,
  snapshot: AiHubSnapshot | null,
): AiHubRowDisplay {
  const none = { value: null, subtitle: null };
  if (snapshot === null) return none;
  switch (section.route) {
    case "AIConnection": {
      const { connection, modelName } = snapshot;
      const provider = connection ? AI_LANE_NAMES[connection.lane] : null;
      return {
        value:
          provider === null
            ? NOT_SET
            : modelName === null
              ? provider
              : `${provider} · ${modelName}`,
        subtitle:
          snapshot.availability === "ready"
            ? AI_HUB_READY
            : AI_HUB_NEEDS_ATTENTION,
      };
    }
    case "AIModelPicker":
      return { value: snapshot.modelName ?? NOT_SET, subtitle: null };
    default:
      return none;
  }
}
