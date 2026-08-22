/**
 * Settings AI section — pure, node-tested helpers (C2-M4). The `.tsx` owns the
 * layout, focus-reload, and persistence side effects; every correctness- or
 * privacy-relevant decision lives here as a pure function (the repo `*-logic.ts`
 * convention), off-device where Vitest can prove it.
 *
 * PRIVACY CONTRACTS THIS MODULE ENFORCES:
 *   - `buildAiSettingsPatch` returns ONLY the non-secret provider config. It has
 *     no key parameter path that reaches the returned patch — a key entered in
 *     the form goes EXCLUSIVELY to `ai-key-store` (SecureStore), never into
 *     `app_settings` or any serialized value (T-14-12).
 *   - `validateEndpointForSave` gates a Custom endpoint through the SAME shared
 *     URL-literal validator the DAO uses, BEFORE persistence, so an invalid or
 *     private-address endpoint is refused up front (H2 / C4-H1).
 *   - The inspector/acknowledgement builders ACCEPT a `ResolvedPrompt` and return
 *     view-state referencing the SAME immutable strings — they NEVER call a
 *     resolver or rebuild a prompt. The exact-prompt first-send gate + its
 *     `app_settings` ack write belong to Compose (Plan 05), NOT Settings (H5).
 *
 * This module deliberately does NOT import the prompt resolver from the ai layer:
 * Settings must not construct an alternate prompt — a grep-enforced boundary. The
 * only prompt symbol it touches is the ResolvedPrompt TYPE it accepts.
 */
import {
  type ValidateEndpointResult,
  validateCustomEndpoint,
} from "@/ai/custom-endpoint";
import { filterToFrontier, type ModelScope } from "@/ai/model-registry";
import type { ResolvedPrompt, TruncationNotice } from "@/ai/prompt-types";
import type { AppSettingsPatch } from "@/db/app-settings-dao";
import type { ModelDiscovery } from "@/services/AiService";
import type { AiProviderId } from "@/services/ai-types";

/** Human-facing provider names (view-state only; ids stay the stored source). */
const PROVIDER_NAMES: Record<AiProviderId, string> = {
  none: "None",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
  custom: "Custom endpoint",
};

/**
 * The Custom-provider retention caveat. Orbit cannot see or control what a
 * user-configured Custom endpoint does with the data it receives, so the ack must
 * say so plainly (T-14-13). The built-in cloud providers have their own published
 * policies; only Custom carries this "we don't control it" disclosure.
 */
export const CUSTOM_RETENTION_CAVEAT =
  "This is an endpoint you configured. Orbit can't control how it handles, " +
  "stores, or retains the data you send — that's between you and its operator.";

/**
 * The editable AI form fields. `apiKey` is entered here but is DELIBERATELY not a
 * field this module ever writes to settings — it exists only to make the
 * no-leak contract explicit and testable; the screen routes it to `ai-key-store`.
 */
export interface AiSettingsForm {
  provider: AiProviderId;
  model: string;
  customModel: string;
  customEndpoint: string;
  promptTemplate: string;
  /** Never persisted to app_settings — SecureStore-only (T-14-12). */
  apiKey?: string;
}

/**
 * Build the NON-SECRET settings patch from the form. It maps exactly the
 * export-safe provider config and NOTHING else: there is no code path here that
 * copies `apiKey` (or any credential) into the returned `AppSettingsPatch`, so a
 * key can never reach `app_settings` or a serialized settings value.
 */
export function buildAiSettingsPatch(form: AiSettingsForm): AppSettingsPatch {
  return {
    aiProvider: form.provider,
    aiModel: form.model,
    aiCustomModel: form.customModel,
    aiCustomEndpoint: form.customEndpoint,
    aiPromptTemplate: form.promptTemplate,
  };
}

/**
 * Validate a Custom endpoint BEFORE persistence, reusing the single shared
 * URL-literal validator (H2 — no duplicate). An empty string is the accepted
 * "unconfigured" state (C3-M5). The screen calls this before `updateAppSettings`
 * so an invalid endpoint surfaces inline rather than as a thrown DAO error.
 */
export function validateEndpointForSave(raw: string): ValidateEndpointResult {
  return validateCustomEndpoint(raw);
}

/** The model-field view-state: a discovered list, or free-text (manual). */
export type ModelFieldState =
  | { readonly kind: "list"; readonly models: readonly string[] }
  | { readonly kind: "manual" };

/** De-duplicate case-insensitively, preserving first-seen order/casing. */
function dedupePreserveOrder(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const key = id.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(id);
    }
  }
  return out;
}

/**
 * Orchestrate a provider `listModels` discovery attempt into a model-field
 * view-state. Discovery is advisory and NEVER blocks manual entry (C4-M1): an
 * empty list, a `manual` result, OR any thrown error all fall back to free-text.
 * The caller supplies the active provider id, the picker `scope`, and the
 * discovery closure (a provider adapter's `listModels`) so this stays pure/I/O-free.
 *
 * The raw discovered catalog is filtered by the active scope (14-10): in
 * `frontier` scope only frontier-family ids survive (`filterToFrontier`); in `all`
 * scope the full discovered list is kept (de-duplicated, order preserved). If
 * nothing survives the field degrades to `{kind:'manual'}` exactly like an
 * empty/unavailable discovery — free-text stays the escape hatch.
 */
export async function discoverModelsForField(
  provider: AiProviderId,
  scope: ModelScope,
  listModels: () => Promise<ModelDiscovery>,
): Promise<ModelFieldState> {
  try {
    const discovery = await listModels();
    if (discovery.kind === "list") {
      const models =
        scope === "frontier"
          ? filterToFrontier(provider, discovery.models)
          : dedupePreserveOrder(discovery.models);
      if (models.length > 0) {
        return { kind: "list", models };
      }
    }
    return { kind: "manual" };
  } catch {
    // Discovery is best-effort; any failure degrades to free-text, never an error.
    return { kind: "manual" };
  }
}

/**
 * The pre-send inspector view-state. It references the SAME immutable strings the
 * resolver produced — the exact bytes that will be transmitted (T-14-10). It does
 * NOT rebuild anything; Compose passes it a real contact-specific ResolvedPrompt.
 */
export interface InspectorViewState {
  /** The SAME string instance as `resolved.inspectorDisplay` — never rebuilt. */
  readonly display: string;
  /** The SAME truncation notices the resolver disclosed (no omitted content). */
  readonly truncations: ReadonlyArray<TruncationNotice>;
}

/** Build inspector view-state from an already-resolved prompt (accepts, never resolves). */
export function buildInspectorViewState(
  resolved: ResolvedPrompt,
): InspectorViewState {
  return {
    display: resolved.inspectorDisplay,
    truncations: resolved.truncations,
  };
}

/**
 * Per-provider acknowledgement view-state. It surfaces the EXACT prompt (same
 * string instance) plus the provider's display name and, for Custom only, the
 * retention caveat. It performs NO ack write and NO gate decision — that is
 * Compose's job with the real ResolvedPrompt (H5). Settings only prepares the copy.
 */
export interface ProviderAckViewState {
  readonly provider: AiProviderId;
  readonly providerName: string;
  /** The SAME string instance as `resolved.prompt` — never a rebuilt prompt. */
  readonly prompt: string;
  readonly isCustom: boolean;
  /** Non-null only for the Custom provider (Orbit-doesn't-control disclosure). */
  readonly retentionCaveat: string | null;
}

/** Build per-provider ack view-state from an already-resolved prompt. */
export function buildProviderAckViewState(
  provider: AiProviderId,
  resolved: ResolvedPrompt,
): ProviderAckViewState {
  const isCustom = provider === "custom";
  return {
    provider,
    providerName: PROVIDER_NAMES[provider],
    prompt: resolved.prompt,
    isCustom,
    retentionCaveat: isCustom ? CUSTOM_RETENTION_CAVEAT : null,
  };
}

/** The provider display name for a given id (view-state helper). */
export function providerDisplayName(provider: AiProviderId): string {
  return PROVIDER_NAMES[provider];
}
