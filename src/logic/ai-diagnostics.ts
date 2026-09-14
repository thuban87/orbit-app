/**
 * Privacy-safe AI failure classification and diagnostics.
 *
 * This module is deliberately node-pure and exposes a closed input/output shape.
 * `buildAiDiagnostic` copies each allowlisted field explicitly: excess runtime
 * properties (including a prompt, response, credential, or contact data) are
 * discarded rather than spread into the event.
 */
import type { AiCloudProviderId } from "@/services/ai-types";

export type AiOperation = "Draft" | "Rewrite" | "Adjust";

export type AiFailureCategory =
  | "connection"
  | "model-unavailable"
  | "rate-limit"
  | "billing"
  | "context"
  | "provider-down"
  | "custom-endpoint"
  | "generic";

export type AiDiagnosticStatus =
  | number
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
  | "unsupported_platform"
  | "model_unavailable"
  | "billing"
  | "context_too_large"
  | "provider_unavailable"
  | "unknown";

export interface AiDiagnosticInput {
  readonly operation: AiOperation;
  readonly lane: AiCloudProviderId;
  readonly modelId: string;
  readonly status: AiDiagnosticStatus;
  readonly category: AiFailureCategory;
  readonly correlationId: string;
  readonly appBuildVersion: string;
  readonly osVersion: string;
  readonly approxTokenCount: number;
  readonly itemCount: number;
  readonly elapsedMs: number;
}

export interface AiDiagnosticEvent extends AiDiagnosticInput {}

export interface AiFailureClassification {
  readonly category: AiFailureCategory;
  readonly status: AiDiagnosticStatus;
}

const SAFE_STATUS_CODES = new Set<AiDiagnosticStatus>([
  "not_configured",
  "invalid_endpoint",
  "blocked",
  "unauthorized",
  "rate_limited",
  "provider_error",
  "invalid_response",
  "network",
  "timeout",
  "cancelled",
  "unsupported_platform",
  "model_unavailable",
  "billing",
  "context_too_large",
  "provider_unavailable",
]);

const MODEL_CODES = new Set([
  "model_not_found",
  "model_unavailable",
  "model_deprecated",
]);
const BILLING_CODES = new Set([
  "billing",
  "payment_required",
  "insufficient_credits",
  "quota_exceeded",
]);
const CONTEXT_CODES = new Set([
  "context_length_exceeded",
  "context_too_large",
  "request_too_large",
]);
const CONNECTION_CODES = new Set([
  "not_configured",
  "unauthorized",
  "network",
  "timeout",
  "blocked",
]);

function property(error: unknown, key: "code" | "status"): unknown {
  if (!error || typeof error !== "object" || !(key in error)) return undefined;
  return (error as Record<string, unknown>)[key];
}

function errorCode(error: unknown): string | null {
  const value = property(error, "code");
  return typeof value === "string" ? value.toLowerCase() : null;
}

function httpStatus(error: unknown): number | null {
  const value = property(error, "status");
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 100 &&
    value <= 599
    ? value
    : null;
}

function diagnosticStatus(
  code: string | null,
  status: number | null,
): AiDiagnosticStatus {
  if (status !== null) return status;
  if (code && SAFE_STATUS_CODES.has(code as AiDiagnosticStatus)) {
    return code as AiDiagnosticStatus;
  }
  if (code && MODEL_CODES.has(code)) return "model_unavailable";
  if (code && BILLING_CODES.has(code)) return "billing";
  if (code && CONTEXT_CODES.has(code)) return "context_too_large";
  return "unknown";
}

/** Classify using only a numeric HTTP status and a known code, never raw text. */
export function classifyAiFailure(
  error: unknown,
  lane: AiCloudProviderId,
): AiFailureClassification {
  const code = errorCode(error);
  const status = httpStatus(error);
  const safeStatus = diagnosticStatus(code, status);

  if (MODEL_CODES.has(code ?? "") || status === 404) {
    return { category: "model-unavailable", status: safeStatus };
  }
  if (code === "rate_limited" || status === 429) {
    return { category: "rate-limit", status: safeStatus };
  }
  if (BILLING_CODES.has(code ?? "") || status === 402) {
    return { category: "billing", status: safeStatus };
  }
  if (CONTEXT_CODES.has(code ?? "") || status === 413) {
    return { category: "context", status: safeStatus };
  }
  if (code === "provider_unavailable" || (status !== null && status >= 500)) {
    return { category: "provider-down", status: safeStatus };
  }
  if (
    lane === "custom" &&
    (code === "invalid_endpoint" ||
      code === "blocked" ||
      code === "unsupported_platform" ||
      code === "provider_error" ||
      code === "network" ||
      code === "timeout" ||
      (status !== null && status >= 400))
  ) {
    return { category: "custom-endpoint", status: safeStatus };
  }
  if (CONNECTION_CODES.has(code ?? "")) {
    return { category: "connection", status: safeStatus };
  }
  if (code === "provider_error") {
    return { category: "provider-down", status: safeStatus };
  }
  return { category: "generic", status: safeStatus };
}

/** Human-facing copy is stable and contains no provider-supplied text. */
export function failureMessage(category: AiFailureCategory): string {
  switch (category) {
    case "connection":
      return "AI connection needs attention.";
    case "model-unavailable":
      return "This model is no longer available. Please choose another model.";
    case "rate-limit":
      return "Rate limited — try again shortly.";
    case "billing":
      return "Insufficient credits or a billing issue with your provider.";
    case "context":
      return "Context too large for this model.";
    case "provider-down":
      return "The provider is temporarily unavailable.";
    case "custom-endpoint":
      return "Your custom endpoint returned an error.";
    case "generic":
      return "Couldn't generate a suggestion. Try again.";
  }
}

/** Explicit allowlist copy. Never replace this with `{ ...input }`. */
export function buildAiDiagnostic(input: AiDiagnosticInput): AiDiagnosticEvent {
  return Object.freeze({
    operation: input.operation,
    lane: input.lane,
    modelId: input.modelId,
    status: input.status,
    category: input.category,
    correlationId: input.correlationId,
    appBuildVersion: input.appBuildVersion,
    osVersion: input.osVersion,
    approxTokenCount: input.approxTokenCount,
    itemCount: input.itemCount,
    elapsedMs: input.elapsedMs,
  });
}

/**
 * A correlation id is an identifier, not a secret. Prefer randomUUID when the
 * runtime supplies it, but retain a Hermes-safe Math.random fallback.
 */
export function createAiCorrelationId(): string {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject && typeof cryptoObject.randomUUID === "function") {
    return cryptoObject.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
