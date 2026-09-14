import {
  type ValidateEndpointResult,
  validateCustomEndpoint,
} from "@/ai/custom-endpoint";
import {
  type AiAvailabilityInput,
  computeAiAvailability,
} from "@/logic/ai-availability";
import type { AiCloudProviderId } from "@/services/ai-types";

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

export function connectionCardState(
  lane: AiCloudProviderId,
  activeLane: AiCloudProviderId | null,
  rememberedModel: string | null | undefined,
) {
  const configured = (rememberedModel ?? "").trim() !== "";
  return {
    active: lane === activeLane,
    saved: configured && lane !== activeLane,
    rememberedModel: rememberedModel ?? "",
  } as const;
}

interface KeyWriter {
  setKey(provider: AiCloudProviderId, key: string): Promise<void>;
}

interface KeyDeleter {
  deleteKey(provider: AiCloudProviderId): Promise<void>;
}

export async function saveDirectCredential(
  keyStore: KeyWriter,
  lane: Exclude<AiCloudProviderId, "custom" | "openrouter">,
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
  readonly credential: string;
  readonly model: string;
}

export interface CustomConnectionDeps extends KeyWriter {
  persistConnection(input: { endpoint: string; model: string }): Promise<void>;
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
  if (credential !== "") await deps.setKey("custom", credential);
  await deps.persistConnection({ endpoint: validation.url, model });
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
