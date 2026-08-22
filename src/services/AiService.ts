/**
 * AI Service — neutral, bounded, cancellable provider adapters (Phase 14, AI-01).
 *
 * Four BYO-key providers: OpenAI, Anthropic, Google (Gemini) on raw `fetch` to
 * their FIXED public hosts, and a user-controlled Custom HTTPS endpoint routed
 * through the Plan 07 native `secureCustomFetch` transport (see Task 2). Every
 * adapter implements the narrow {@link AiProvider} contract — `listModels()` for
 * advisory discovery and `generate(input)` for one unary draft.
 *
 * SECURITY / PRIVACY invariants baked into this module:
 *   - CALLER-OWNED CANCELLATION (H4): an adapter forwards `input.signal` to the
 *     transport and creates NO abort controller and NO timeout of its own. The
 *     20s timeout and the controller live in the Compose caller (Plan 05).
 *   - PER-CALL KEY ACCESSOR (C3-M2): `refreshProviders` injects a
 *     `() => Promise<string|null>` closure over `ai-key-store`; it NEVER reads or
 *     caches a key value. The accessor is invoked INSIDE `generate` /networked
 *     `listModels` immediately before the request. A key never comes from
 *     navigation params, SQLite, or the prompt builder.
 *   - PAYLOAD IDENTITY (C3-M1): the request body text is exactly
 *     `input.resolvedPrompt.payload` — the same immutable string the inspector
 *     showed the user. Adapters read ONLY `payload`, nothing else off the prompt.
 *   - SANITIZED ERRORS (T-14-05): every failure is an {@link AiError} whose
 *     message is exactly its stable `code`. No key, endpoint URL, query string,
 *     header, request body, or raw response text is ever surfaced or logged.
 *   - NO auto-retry after transport/timeout uncertainty (T-14-07), no streaming,
 *     no provider SDKs, no response-body diagnostics.
 *
 * Response JSON is `unknown` at the network boundary: each adapter validates its
 * expected text path and every draft passes the shared {@link parseSuggestionOutput}
 * ceiling before it can become a suggestion.
 */
import { validateCustomEndpoint } from "@/ai/custom-endpoint";
import type { ResolvedPrompt } from "@/ai/prompt-types";
import { SecureFetchError, secureCustomFetch } from "@/ai/secure-fetch";
import { aiKeyStore } from "./ai-key-store";
import type { AiCloudProviderId, AiSettings } from "./ai-types";

// ─── Neutral contract ───────────────────────────────────────────

/**
 * The neutral generation input. `resolvedPrompt` is the SAME immutable object
 * Compose built (C3-M1 — adapters read only `resolvedPrompt.payload`). `signal`
 * is the CALLER's AbortSignal (H4 — the adapter never replaces it).
 */
export interface GenerationInput {
  readonly resolvedPrompt: ResolvedPrompt;
  readonly model: string;
  readonly temperature: number;
  /**
   * OPTIONAL output-token ceiling (14-11 removed the artificial flat cap). When
   * `undefined`, the adapter OMITS its provider output field entirely, so the
   * provider / model default applies (Gemini then uses dynamic thinking). Only
   * Anthropic requires a value — its Messages API mandates `max_tokens` — so its
   * adapter falls back to a high constant if this is ever absent. Visible draft
   * length is bounded solely by the 1,200-code-point post-parse trim, never here.
   * The per-provider value is chosen by `resolveMaxOutputTokens` in
   * `@/ai/token-budget`.
   */
  readonly maxOutputTokens?: number;
  readonly signal: AbortSignal;
}

/**
 * Advisory model discovery. `list` carries fetched model ids; `manual` means
 * discovery is unavailable/inapplicable and the UI must keep free-text entry
 * (Custom is ALWAYS `manual` — C4-M1). Discovery NEVER throws.
 */
export type ModelDiscovery =
  | { readonly kind: "list"; readonly models: readonly string[] }
  | { readonly kind: "manual" };

/** A `() => Promise<string|null>` key closure over `ai-key-store` (C3-M2). */
export type KeyAccessor = () => Promise<string | null>;

/**
 * The minimal key-store surface `AiService` depends on — a structural subset of
 * `AiKeyStore` so a fake can be injected in tests without the native module.
 */
export interface AiKeyStoreLike {
  getKey(provider: AiCloudProviderId): Promise<string | null>;
  setKey(provider: AiCloudProviderId, key: string): Promise<void>;
  deleteKey(provider: AiCloudProviderId): Promise<void>;
}

/** The narrow adapter contract every provider implements. */
export interface AiProvider {
  readonly id: AiCloudProviderId;
  readonly name: string;
  /** Advisory discovery; returns `manual` on ANY failure (never throws). */
  listModels(signal?: AbortSignal): Promise<ModelDiscovery>;
  /** Produce one validated draft, or throw a sanitized {@link AiError}. */
  generate(input: GenerationInput): Promise<string>;
}

// ─── Sanitized error taxonomy ───────────────────────────────────

/** Stable, sanitized failure codes — safe to surface to the UI/logs. */
export type AiErrorCode =
  | "not_configured"
  | "invalid_endpoint"
  | "blocked"
  | "unauthorized"
  | "rate_limited"
  | "provider_error"
  | "invalid_response"
  | "network"
  | "timeout"
  | "cancelled"
  | "unsupported_platform";

/** A sanitized error — its `message` is EXACTLY the `code`, never raw detail. */
export class AiError extends Error {
  readonly code: AiErrorCode;
  constructor(code: AiErrorCode) {
    super(code);
    this.code = code;
    this.name = "AiError";
  }
}

// ─── Shared response validation ─────────────────────────────────

/** The shared post-parse draft ceiling: 1,200 CODE POINTS (not UTF-16 units). */
const MAX_DRAFT_CODE_POINTS = 1_200;

/**
 * Validate an `unknown` provider result into a trimmed, non-empty, bounded
 * draft. Rejects a non-string, an empty/whitespace-only draft, and any draft
 * over {@link MAX_DRAFT_CODE_POINTS} code points (measured via `Array.from`, so
 * astral characters count as one). Throws {@link AiError} `invalid_response`.
 */
export function parseSuggestionOutput(value: unknown): string {
  if (typeof value !== "string") throw new AiError("invalid_response");
  const draft = value.trim();
  if (draft.length === 0 || Array.from(draft).length > MAX_DRAFT_CODE_POINTS) {
    throw new AiError("invalid_response");
  }
  return draft;
}

// ─── Shared adapter helpers ─────────────────────────────────────

/** Map a resolved non-ok HTTP status to a sanitized code (no body read). */
function classifyHttpStatus(status: number): AiErrorCode {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "rate_limited";
  return "provider_error";
}

/** Map a `fetch` rejection to a sanitized code — abort wins, else network. */
function mapTransportError(err: unknown, signal: AbortSignal): AiError {
  if (signal.aborted) return new AiError("cancelled");
  if (
    err &&
    typeof err === "object" &&
    "name" in err &&
    (err as { name: unknown }).name === "AbortError"
  ) {
    return new AiError("cancelled");
  }
  return new AiError("network");
}

/**
 * Map a native {@link SecureFetchError} to the neutral adapter error union. A
 * redirect / private-resolution / host-mismatch is a blocked egress destination;
 * everything else falls to a generic sanitized code. The native error is already
 * sanitized (its message is its bare code), but we re-wrap so only the neutral
 * {@link AiErrorCode} union ever escapes the adapter.
 */
function mapSecureFetchError(err: unknown, signal: AbortSignal): AiError {
  if (signal.aborted) return new AiError("cancelled");
  if (err instanceof SecureFetchError) {
    switch (err.code) {
      case "invalid_endpoint":
        return new AiError("invalid_endpoint");
      case "unsupported_platform":
        return new AiError("unsupported_platform");
      case "private_address":
      case "redirect":
      case "host_mismatch":
        return new AiError("blocked");
      case "timeout":
        return new AiError("timeout");
      case "cancelled":
        return new AiError("cancelled");
      default:
        return new AiError("network");
    }
  }
  return new AiError("network");
}

/** Safely walk a path of string keys / numeric indices over `unknown` JSON. */
function walk(root: unknown, path: ReadonlyArray<string | number>): unknown {
  let cur = root;
  for (const step of path) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string | number, unknown>)[step];
  }
  return cur;
}

/** Parse a resolved response as JSON, mapping any failure to invalid_response. */
async function readJson(response: {
  json(): Promise<unknown>;
}): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new AiError("invalid_response");
  }
}

/** The extracted string ids from a list-of-`{id}` payload (`data[].id`). */
function extractIdList(data: unknown, key = "data"): string[] {
  const arr = walk(data, [key]);
  if (!Array.isArray(arr)) return [];
  const ids: string[] = [];
  for (const item of arr) {
    const id = walk(item, ["id"]);
    if (typeof id === "string" && id.length > 0) ids.push(id);
  }
  return ids;
}

// ─── OpenAI adapter ─────────────────────────────────────────────

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";

/** OpenAI — `Authorization: Bearer` header, chat-completions API. */
export class OpenAiProvider implements AiProvider {
  readonly id = "openai" as const;
  readonly name = "OpenAI";
  constructor(private readonly getKey: KeyAccessor) {}

  async listModels(signal?: AbortSignal): Promise<ModelDiscovery> {
    const key = await this.getKey();
    if (!key) return { kind: "manual" };
    try {
      const res = await fetch(OPENAI_MODELS_URL, {
        headers: { Authorization: `Bearer ${key}` },
        signal,
      });
      if (!res.ok) return { kind: "manual" };
      const models = extractIdList(await res.json());
      return models.length > 0 ? { kind: "list", models } : { kind: "manual" };
    } catch {
      return { kind: "manual" };
    }
  }

  async generate(input: GenerationInput): Promise<string> {
    if (input.signal.aborted) throw new AiError("cancelled");
    const key = await this.getKey();
    if (!key) throw new AiError("not_configured");

    // 14-11: OMIT `max_completion_tokens` when no cap is set → provider default.
    const body: Record<string, unknown> = {
      model: input.model,
      messages: [{ role: "user", content: input.resolvedPrompt.payload }],
      temperature: input.temperature,
    };
    if (typeof input.maxOutputTokens === "number") {
      body.max_completion_tokens = input.maxOutputTokens;
    }

    let response: Response;
    try {
      response = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: input.signal,
      });
    } catch (err) {
      throw mapTransportError(err, input.signal);
    }

    if (!response.ok) throw new AiError(classifyHttpStatus(response.status));
    const data = await readJson(response);
    return parseSuggestionOutput(
      walk(data, ["choices", 0, "message", "content"]),
    );
  }
}

// ─── Anthropic adapter ──────────────────────────────────────────

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODELS_URL = "https://api.anthropic.com/v1/models";
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_PAGE_LIMIT = 20;

/**
 * Anthropic's Messages API REQUIRES `max_tokens` — it cannot be omitted (verified
 * against the Anthropic docs 2026-08-22). `resolveMaxOutputTokens` always supplies
 * the selected model's own maximum for this provider; this constant is the belt-
 * and-braces fallback so the adapter never emits a request without `max_tokens`.
 */
const ANTHROPIC_REQUIRED_MAX_TOKENS = 8192;

/** Anthropic — `x-api-key` header, Messages API, paginated model list. */
export class AnthropicProvider implements AiProvider {
  readonly id = "anthropic" as const;
  readonly name = "Anthropic";
  constructor(private readonly getKey: KeyAccessor) {}

  async listModels(signal?: AbortSignal): Promise<ModelDiscovery> {
    const key = await this.getKey();
    if (!key) return { kind: "manual" };
    const headers = {
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
    };
    try {
      const ids: string[] = [];
      let afterId: string | undefined;
      for (let page = 0; page < ANTHROPIC_PAGE_LIMIT; page += 1) {
        const url = new URL(ANTHROPIC_MODELS_URL);
        url.searchParams.set("limit", "100");
        if (afterId) url.searchParams.set("after_id", afterId);
        const res = await fetch(url.toString(), { headers, signal });
        if (!res.ok) return { kind: "manual" };
        const data = await res.json();
        ids.push(...extractIdList(data));
        const hasMore = walk(data, ["has_more"]) === true;
        const lastId = walk(data, ["last_id"]);
        if (!hasMore || typeof lastId !== "string" || lastId.length === 0)
          break;
        afterId = lastId;
      }
      return ids.length > 0
        ? { kind: "list", models: ids }
        : { kind: "manual" };
    } catch {
      return { kind: "manual" };
    }
  }

  async generate(input: GenerationInput): Promise<string> {
    if (input.signal.aborted) throw new AiError("cancelled");
    const key = await this.getKey();
    if (!key) throw new AiError("not_configured");

    let response: Response;
    try {
      response = await fetch(ANTHROPIC_MESSAGES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: input.model,
          // REQUIRED by the API — never omitted. The model's own catalog maximum
          // (via `resolveMaxOutputTokens`); a high fallback only if ever absent.
          max_tokens: input.maxOutputTokens ?? ANTHROPIC_REQUIRED_MAX_TOKENS,
          temperature: input.temperature,
          messages: [{ role: "user", content: input.resolvedPrompt.payload }],
        }),
        signal: input.signal,
      });
    } catch (err) {
      throw mapTransportError(err, input.signal);
    }

    if (!response.ok) throw new AiError(classifyHttpStatus(response.status));
    const data = await readJson(response);
    return parseSuggestionOutput(walk(data, ["content", 0, "text"]));
  }
}

// ─── Google (Gemini) adapter ────────────────────────────────────

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Google Gemini — the API key rides in the URL QUERY (`?key=…`), so extra care
 * is taken that no failure path ever surfaces the URL/query/key (C2-M5): the
 * only thing thrown is an {@link AiError} whose message is its bare code.
 */
export class GoogleProvider implements AiProvider {
  readonly id = "google" as const;
  readonly name = "Google (Gemini)";
  constructor(private readonly getKey: KeyAccessor) {}

  async listModels(signal?: AbortSignal): Promise<ModelDiscovery> {
    const key = await this.getKey();
    if (!key) return { kind: "manual" };
    try {
      const res = await fetch(
        `${GEMINI_BASE}/models?key=${encodeURIComponent(key)}`,
        { signal },
      );
      if (!res.ok) return { kind: "manual" };
      const data = await res.json();
      const models = extractGeminiModels(data);
      return models.length > 0 ? { kind: "list", models } : { kind: "manual" };
    } catch {
      return { kind: "manual" };
    }
  }

  async generate(input: GenerationInput): Promise<string> {
    if (input.signal.aborted) throw new AiError("cancelled");
    const key = await this.getKey();
    if (!key) throw new AiError("not_configured");

    const url = `${GEMINI_BASE}/models/${encodeURIComponent(
      input.model,
    )}:generateContent?key=${encodeURIComponent(key)}`;

    // Gemini 2.5/3.x are THINKING models: an output cap is spent on reasoning
    // BEFORE any message, truncating the draft (14-06 UAT). 14-11 removes the cap
    // entirely — OMIT `maxOutputTokens` so the model default applies, and OMIT
    // `thinkingConfig` so the model uses DYNAMIC thinking (its default, verified
    // against ai.google.dev/gemini-api/docs/thinking on 2026-08-22). Include
    // `maxOutputTokens` only if a caller ever supplies one (Gemini normally does
    // not). Visible length stays bounded by the 1,200-code-point post-parse trim.
    const generationConfig: Record<string, unknown> = {
      temperature: input.temperature,
      candidateCount: 1,
    };
    if (typeof input.maxOutputTokens === "number") {
      generationConfig.maxOutputTokens = input.maxOutputTokens;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: input.resolvedPrompt.payload }] }],
          generationConfig,
        }),
        signal: input.signal,
      });
    } catch (err) {
      throw mapTransportError(err, input.signal);
    }

    if (!response.ok) throw new AiError(classifyHttpStatus(response.status));
    const data = await readJson(response);
    return parseSuggestionOutput(
      walk(data, ["candidates", 0, "content", "parts", 0, "text"]),
    );
  }
}

/** Extract generateContent-capable Gemini model ids (strip the `models/` prefix). */
function extractGeminiModels(data: unknown): string[] {
  const arr = walk(data, ["models"]);
  if (!Array.isArray(arr)) return [];
  const ids: string[] = [];
  for (const item of arr) {
    const name = walk(item, ["name"]);
    const methods = walk(item, ["supportedGenerationMethods"]);
    if (
      typeof name === "string" &&
      Array.isArray(methods) &&
      methods.includes("generateContent")
    ) {
      ids.push(
        name.startsWith("models/") ? name.slice("models/".length) : name,
      );
    }
  }
  return ids;
}

// ─── Custom endpoint adapter ────────────────────────────────────

/**
 * Custom — a user-controlled HTTPS endpoint (OpenAI-compatible response shape).
 *
 * This is the ONLY SSRF/rebinding/redirect surface, so `generate` refuses the
 * endpoint through the SAME `validateCustomEndpoint` module the settings DAO used
 * at save time (H2 — one shared validator, no duplicate) and then dials it ONLY
 * through the Plan 07 native `secureCustomFetch` transport (H3), NEVER raw
 * `fetch`. The native module owns DNS re-resolution rejection, redirect refusal,
 * and the proxy pin — a `fetch` `redirect: "error"` init is a silent no-op on
 * Android (M3), so this adapter does not rely on it. `listModels()` is
 * NON-networked: Custom is free-text only (C4-M1).
 */
export class CustomProvider implements AiProvider {
  readonly id = "custom" as const;
  readonly name = "Custom endpoint";
  constructor(
    private readonly endpoint: string,
    private readonly getKey: KeyAccessor,
  ) {}

  async listModels(): Promise<ModelDiscovery> {
    // Custom is free-text only — no endpoint request is ever made (C4-M1).
    return { kind: "manual" };
  }

  async generate(input: GenerationInput): Promise<string> {
    if (input.signal.aborted) throw new AiError("cancelled");

    // H2: reuse the save-time URL-literal validator before any transport call.
    const validation = validateCustomEndpoint(this.endpoint);
    if (!validation.ok || validation.url === "") {
      throw new AiError("invalid_endpoint");
    }

    const key = await this.getKey();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (key) headers.Authorization = `Bearer ${key}`;

    // 14-11: OMIT `max_tokens` when no cap is set. A user-controlled endpoint may
    // require one, so `resolveMaxOutputTokens` supplies a high, non-binding
    // default for Custom; if ever absent the field is simply omitted.
    const customBody: Record<string, unknown> = {
      model: input.model,
      messages: [{ role: "user", content: input.resolvedPrompt.payload }],
      temperature: input.temperature,
    };
    if (typeof input.maxOutputTokens === "number") {
      customBody.max_tokens = input.maxOutputTokens;
    }

    let result: { status: number; ok: boolean; bodyText: string };
    try {
      // H3: the native egress guard is the ONLY transport for Custom.
      result = await secureCustomFetch({
        url: validation.url,
        method: "POST",
        headers,
        body: JSON.stringify(customBody),
        signal: input.signal,
      });
    } catch (err) {
      throw mapSecureFetchError(err, input.signal);
    }

    if (!result.ok) throw new AiError(classifyHttpStatus(result.status));
    let data: unknown;
    try {
      data = JSON.parse(result.bodyText);
    } catch {
      throw new AiError("invalid_response");
    }
    return parseSuggestionOutput(
      walk(data, ["choices", 0, "message", "content"]),
    );
  }
}

// ─── AiService orchestrator ─────────────────────────────────────

/**
 * Builds and holds the four provider adapters. `refreshProviders` injects a
 * provider-scoped key ACCESSOR into each adapter (C3-M2) — it never reads or
 * retains a key value; the accessor is invoked inside `generate`/networked
 * `listModels` immediately before the request. The Compose caller owns the
 * request generation, abort controller, and 20s timeout (H4).
 */
export class AiService {
  private readonly providers = new Map<AiCloudProviderId, AiProvider>();

  constructor(private readonly keyStore: AiKeyStoreLike = aiKeyStore) {}

  refreshProviders(settings: AiSettings): void {
    this.providers.clear();
    this.providers.set(
      "openai",
      new OpenAiProvider(() => this.keyStore.getKey("openai")),
    );
    this.providers.set(
      "anthropic",
      new AnthropicProvider(() => this.keyStore.getKey("anthropic")),
    );
    this.providers.set(
      "google",
      new GoogleProvider(() => this.keyStore.getKey("google")),
    );
    this.providers.set(
      "custom",
      new CustomProvider(settings.aiCustomEndpoint, () =>
        this.keyStore.getKey("custom"),
      ),
    );
  }

  getProvider(id: AiCloudProviderId): AiProvider | undefined {
    return this.providers.get(id);
  }

  getActiveProvider(settings: AiSettings): AiProvider | null {
    if (settings.aiProvider === "none") return null;
    return this.providers.get(settings.aiProvider) ?? null;
  }
}
