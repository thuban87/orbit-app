import type {
  OpenRouterCatalog,
  OpenRouterModel,
} from "@/ai/openrouter-catalog";
import type { ResolvedAiConnection } from "@/db/ai-connections-dao";
import type { AppSettingsPatch } from "@/db/app-settings-dao";
import type { SqlExecutor } from "@/db/types";
import {
  type AiAvailability,
  computeAiAvailability,
  isSelectedConnectionModelAvailable,
} from "@/logic/ai-availability";
import type { AiCloudProviderId, AiProviderId } from "@/services/ai-types";

export type AiHubSection =
  | { readonly label: "Connection"; readonly route: "AIConnection" }
  | { readonly label: "Model"; readonly route: "AIModelPicker" }
  | {
      readonly label: "Writing Style" | "Personalization Context";
      readonly route: "AIPersonalization";
      readonly params: {
        readonly focus: "writing-style" | "personalization";
      };
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
  {
    label: "Writing Style",
    route: "AIPersonalization",
    params: { focus: "writing-style" },
  },
  {
    label: "Personalization Context",
    route: "AIPersonalization",
    params: { focus: "personalization" },
  },
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
 * PRODUCES the AI hub availability that {@link deriveAiHubState} consumes,
 * porting the monolith's fresh-on-focus `reloadAiAvailability` pipeline: hydrate
 * config → resolve the active connection → read credential presence → load the
 * cached OpenRouter catalog ONLY when the active lane is `openrouter` → compute.
 *
 * This is READ-PATH hydration of already-stored config: the catalog step reads
 * the local on-disk cache (via the injected thunk), never a real AI provider
 * network call (local-first; no new egress; `AiService.ts` untouched). A failing
 * collaborator REJECTS so the caller can surface its focus-load error path.
 */
export async function loadAiHubAvailability(
  exec: SqlExecutor,
  deps: AiHubAvailabilityDeps,
): Promise<AiAvailability> {
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
  return computeAiHubAvailability({
    aiEnabled: config.aiEnabled,
    activeConnection: connection,
    hasCredential,
    openRouterModels: catalog?.models ?? [],
  });
}
