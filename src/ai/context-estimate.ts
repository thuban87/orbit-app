/** Node-pure prompt size, selected-model capacity, and input-cost estimate. */
import {
  estimateOpenRouterInputCost,
  type OpenRouterModel,
} from "@/ai/openrouter-catalog";
import type { TruncationNotice } from "@/ai/prompt-types";
import type { AiCloudProviderId } from "@/services/ai-types";

export const COST_ESTIMATE_UNAVAILABLE =
  "Cost estimate unavailable for this connection.";

export interface PromptContextEstimateInput {
  readonly prompt: string;
  readonly connection: AiCloudProviderId;
  readonly model: string;
  /** Selected direct/custom model's known real context window. */
  readonly contextWindowTokens?: number | null;
  /** Selected OpenRouter catalog row (cached or freshly resolved). */
  readonly openRouterModel?: OpenRouterModel | null;
}

export interface PromptContextEstimate {
  /** The original prompt is returned unchanged: this utility never truncates. */
  readonly prompt: string;
  readonly estimatedInputTokens: number;
  readonly contextWindowTokens: number | null;
  readonly remainingTokens: number | null;
  readonly overflow: boolean;
  readonly overflowNotice: TruncationNotice | null;
  readonly estimatedInputCostUsd: number | null;
  readonly costMessage: string | null;
}

/** Local, sanitized signal that a known model capacity forbids provider egress. */
export class PromptContextOverflowError extends Error {
  readonly code = "context_too_large";
  readonly notice: TruncationNotice;

  constructor(notice: TruncationNotice) {
    super("context_too_large");
    this.name = "PromptContextOverflowError";
    this.notice = notice;
  }
}

/** A deterministic local approximation: four Unicode code points per token. */
export function estimateInputTokens(prompt: string): number {
  return prompt.length === 0 ? 0 : Math.ceil(Array.from(prompt).length / 4);
}

function validWindow(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
}

export function estimatePromptContext(
  input: PromptContextEstimateInput,
): PromptContextEstimate {
  const estimatedInputTokens = estimateInputTokens(input.prompt);
  let contextWindowTokens: number | null;
  let estimatedInputCostUsd: number | null = null;
  let costMessage: string | null = COST_ESTIMATE_UNAVAILABLE;

  switch (input.connection) {
    case "openrouter":
      contextWindowTokens = validWindow(input.openRouterModel?.contextLength);
      estimatedInputCostUsd = input.openRouterModel
        ? estimateOpenRouterInputCost(
            input.openRouterModel,
            estimatedInputTokens,
          )
        : null;
      costMessage = null;
      break;
    case "openai":
    case "anthropic":
    case "google":
    case "custom":
      contextWindowTokens = validWindow(input.contextWindowTokens);
      break;
    default: {
      const exhaustive: never = input.connection;
      throw new Error(`Unknown AI connection ${String(exhaustive)}`);
    }
  }

  const overflow =
    contextWindowTokens !== null && estimatedInputTokens > contextWindowTokens;
  const overflowNotice: TruncationNotice | null = overflow
    ? {
        category: "context",
        detail: `This request is larger than ${input.model}'s context window. Reduce or turn off some context, change personalization, or choose a larger-context model.`,
      }
    : null;

  return Object.freeze({
    prompt: input.prompt,
    estimatedInputTokens,
    contextWindowTokens,
    remainingTokens:
      contextWindowTokens === null
        ? null
        : contextWindowTokens - estimatedInputTokens,
    overflow,
    overflowNotice: overflowNotice ? Object.freeze(overflowNotice) : null,
    estimatedInputCostUsd,
    costMessage,
  });
}

/** Return the estimate or throw before egress when known capacity is exceeded. */
export function assertPromptFitsContext(
  input: PromptContextEstimateInput,
): PromptContextEstimate {
  const estimate = estimatePromptContext(input);
  if (estimate.overflow && estimate.overflowNotice) {
    throw new PromptContextOverflowError(estimate.overflowNotice);
  }
  return estimate;
}
