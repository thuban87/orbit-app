import {
  type ValidateEndpointResult,
  validateCustomEndpoint,
} from "@/ai/custom-endpoint";
import type { AiConnection } from "@/db/ai-connections-dao";
import {
  type AiAvailabilityInput,
  computeAiAvailability,
  readCredentialPresence,
} from "@/logic/ai-availability";
import type { AiCloudProviderId } from "@/services/ai-types";

/** The user-facing name of each AI connection lane. */
export const AI_LANE_NAMES: Readonly<Record<AiCloudProviderId, string>> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
  custom: "Custom Endpoint",
};

export interface ConnectionSwitchState {
  readonly activeLane: AiCloudProviderId | null;
  readonly pendingLane: AiCloudProviderId | null;
  readonly rememberedModels: Readonly<
    Partial<Record<AiCloudProviderId, string>>
  >;
}

export function beginConnectionSetup(
  state: ConnectionSwitchState,
  lane: AiCloudProviderId,
): ConnectionSwitchState {
  return { ...state, pendingLane: lane };
}

export function finishConnectionSetup(
  state: ConnectionSwitchState,
  lane: AiCloudProviderId,
  succeeded: boolean,
  rememberedModel: string,
): ConnectionSwitchState {
  if (!succeeded || state.pendingLane !== lane) {
    return { ...state, pendingLane: null };
  }
  return {
    activeLane: lane,
    pendingLane: null,
    rememberedModels: {
      ...state.rememberedModels,
      [lane]: rememberedModel,
    },
  };
}

export interface ConnectionCardInput {
  readonly lane: AiCloudProviderId;
  readonly activeLane: AiCloudProviderId | null;
  readonly rememberedModel: string | null | undefined;
  /**
   * Whether the lane's credential is present on this device — PRESENCE only,
   * read locally through `readCredentialPresence` (38.12 D-84). The secret
   * never reaches this module.
   */
  readonly hasCredential: boolean;
}

/**
 * What a lane card shows (38.12 D-84, K-36).
 *
 *   connected  the active lane with a usable credential: the header reads
 *              "Connected", "Change model" is the primary action and
 *              Disconnect / Remove key is demoted to a plain control.
 *   connect    every other lane: the existing Connect / Save key primary.
 *
 * A Custom endpoint's credential is optional (it may be unauthenticated), so
 * an active Custom lane counts as connected without one — the same rule
 * `computeAiAvailability` applies. No provider call decides this.
 */
export type ConnectionCardStatus = "connected" | "connect";

export interface ConnectionCardState {
  readonly active: boolean;
  readonly saved: boolean;
  readonly status: ConnectionCardStatus;
  readonly primaryAction: "change-model" | "connect";
  readonly rememberedModel: string;
}

export function connectionCardState({
  lane,
  activeLane,
  rememberedModel,
  hasCredential,
}: ConnectionCardInput): ConnectionCardState {
  const configured = (rememberedModel ?? "").trim() !== "";
  const active = lane === activeLane;
  const connected = active && (hasCredential || lane === "custom");
  return {
    active,
    saved: configured && !active,
    status: connected ? "connected" : "connect",
    primaryAction: connected ? "change-model" : "connect",
    rememberedModel: rememberedModel ?? "",
  };
}

/**
 * Credential PRESENCE for every saved lane (38.12 D-84), read locally through
 * `readCredentialPresence`: only a boolean per lane comes back, the key value
 * is never returned or kept. A Custom credential is bound to its endpoint, so
 * its read passes the saved endpoint. No network call.
 */
export async function readLaneCredentialPresence(
  connections: readonly Pick<AiConnection, "lane" | "customEndpoint">[],
  getKey: (
    provider: AiCloudProviderId,
    customEndpoint?: string,
  ) => Promise<string | null>,
): Promise<Partial<Record<AiCloudProviderId, boolean>>> {
  const entries = await Promise.all(
    connections.map(
      async (connection) =>
        [
          connection.lane,
          await readCredentialPresence(connection.lane, (lane) =>
            getKey(
              lane,
              lane === "custom" ? connection.customEndpoint : undefined,
            ),
          ),
        ] as const,
    ),
  );
  return Object.fromEntries(entries);
}

interface KeyWriter {
  setKey(
    provider: AiCloudProviderId,
    key: string,
    customEndpoint?: string,
  ): Promise<void>;
}

export type DirectCredentialLane = Exclude<
  AiCloudProviderId,
  "custom" | "openrouter"
>;

export type CredentialDraft = {
  readonly lane: DirectCredentialLane;
  readonly value: string;
} | null;

export function editDraft(
  lane: DirectCredentialLane,
  value: string,
): CredentialDraft {
  return { lane, value };
}

/** Switching cards discards the unsaved direct-provider secret. */
export function switchLane(_lane: AiCloudProviderId): CredentialDraft {
  return null;
}

export function submitDraft(
  draft: CredentialDraft,
  lane: DirectCredentialLane,
): string | null {
  return draft?.lane === lane ? draft.value : null;
}

interface KeyDeleter {
  deleteKey(provider: AiCloudProviderId): Promise<void>;
}

export async function saveDirectCredential(
  keyStore: KeyWriter,
  lane: DirectCredentialLane,
  rawKey: string,
): Promise<void> {
  const key = rawKey.trim();
  if (key === "") throw new Error("Enter an API key.");
  await keyStore.setKey(lane, key);
}

export function removeLaneCredential(
  keyStore: KeyDeleter,
  lane: AiCloudProviderId,
): Promise<void> {
  return keyStore.deleteKey(lane);
}

export interface CustomConnectionInput {
  readonly endpoint: string;
  readonly previousEndpoint: string;
  readonly credential: string;
  readonly model: string;
}

export interface CustomConnectionDeps extends KeyWriter {
  readRawCustomItem(): Promise<string | null>;
  restoreRawCustomItem(raw: string | null): Promise<void>;
  persistConnection(input: { endpoint: string; model: string }): Promise<void>;
}

export class CustomCredentialCompensationError extends Error {
  constructor() {
    super(
      "Credential recovery failed. Remove the Custom Endpoint credential before trying again.",
    );
    this.name = "CustomCredentialCompensationError";
  }
}

export type SaveCustomConnectionResult =
  | { readonly ok: true }
  | Extract<ValidateEndpointResult, { ok: false }>;

/** Validate the egress target before either SecureStore or SQLite is touched. */
export async function saveCustomConnection(
  deps: CustomConnectionDeps,
  input: CustomConnectionInput,
): Promise<SaveCustomConnectionResult> {
  const validation = validateCustomEndpoint(input.endpoint);
  if (!validation.ok) return validation;
  if (validation.url === "") {
    return { ok: false, reason: "Enter an OpenAI-compatible HTTPS endpoint." };
  }
  const model = input.model.trim();
  if (model === "") return { ok: false, reason: "Enter a model id." };
  const credential = input.credential.trim();
  if (credential === "") {
    await deps.persistConnection({ endpoint: validation.url, model });
    return { ok: true };
  }

  const previousRawItem = await deps.readRawCustomItem();
  await deps.setKey("custom", credential, validation.url);
  try {
    await deps.persistConnection({ endpoint: validation.url, model });
  } catch (persistError) {
    try {
      await deps.restoreRawCustomItem(previousRawItem);
    } catch {
      throw new CustomCredentialCompensationError();
    }
    throw persistError;
  }
  return { ok: true };
}

export type AiRepairAction =
  | "reconnect"
  | "replace-key"
  | "choose-model"
  | "change-connection";

export interface AiRepair {
  readonly action: AiRepairAction;
  readonly label: string;
  readonly message: string;
}

export type ObservedConnectionIssue = "expired" | "invalid-key" | null;

/** Pure cause-to-repair mapping. It reports a repair and never mutates selection. */
export function repairForAvailability(
  input: AiAvailabilityInput,
  observedIssue: ObservedConnectionIssue,
): AiRepair | null {
  if (computeAiAvailability(input) !== "needs-attention") return null;
  if (observedIssue === "expired") {
    return {
      action: "reconnect",
      label: "Reconnect",
      message: "Your OpenRouter connection has expired.",
    };
  }
  if (observedIssue === "invalid-key") {
    return {
      action: "replace-key",
      label: "Replace key",
      message: "The saved API key is no longer accepted.",
    };
  }
  if (input.selectedModel.trim() === "" || !input.modelAvailable) {
    return {
      action: "choose-model",
      label: "Choose another model",
      message:
        "This model is no longer available. Please choose another model.",
    };
  }
  return {
    action: "change-connection",
    label: "Change AI connection",
    message: "AI connection needs attention.",
  };
}
