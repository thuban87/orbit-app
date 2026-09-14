import type { PromptContextEstimate } from "@/ai/context-estimate";
import type {
  PersonalizationSection,
  WritingStyle,
} from "@/db/personalization-dao";

export const PERSONALIZATION_ESTIMATE_DEBOUNCE_MS = 350;

export interface EstimateScheduler {
  set(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clear(handle: ReturnType<typeof setTimeout>): void;
}

const defaultScheduler: EstimateScheduler = {
  set: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle),
};

/** Coalesce rapid local edits while leaving the last rendered estimate intact. */
export function createEstimateDebouncer(
  recompute: () => void,
  delayMs = PERSONALIZATION_ESTIMATE_DEBOUNCE_MS,
  scheduler: EstimateScheduler = defaultScheduler,
): { schedule(): void; cancel(): void } {
  let pending: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule() {
      if (pending !== null) scheduler.clear(pending);
      pending = scheduler.set(() => {
        pending = null;
        recompute();
      }, delayMs);
    },
    cancel() {
      if (pending !== null) scheduler.clear(pending);
      pending = null;
    },
  };
}

/** Text measured by the Personalization Context estimate (enabled rows only). */
export function personalizationEstimateSource(
  style: WritingStyle,
  sections: readonly PersonalizationSection[],
): string {
  return [
    style.freeform.trim(),
    ...sections
      .filter((section) => section.enabled)
      .sort(
        (a, b) => a.displayOrder - b.displayOrder || a.uid.localeCompare(b.uid),
      )
      .flatMap((section) => [section.title, section.body]),
  ]
    .filter((value) => value.trim() !== "")
    .join("\n");
}

export function moveSectionUid(
  orderedUids: readonly string[],
  uid: string,
  direction: "up" | "down",
): string[] {
  const current = orderedUids.indexOf(uid);
  if (current === -1) return [...orderedUids];
  const target = direction === "up" ? current - 1 : current + 1;
  if (target < 0 || target >= orderedUids.length) return [...orderedUids];
  const next = [...orderedUids];
  [next[current], next[target]] = [next[target], next[current]];
  return next;
}

export function formatEstimateCaption(
  estimate: PromptContextEstimate,
  model: string,
): { context: string; cost: string | null; overflow: string | null } {
  const context = `Estimated context · ~${estimate.estimatedInputTokens.toLocaleString()} tokens`;
  const cost =
    estimate.estimatedInputCostUsd === null
      ? estimate.costMessage
      : `~$${estimate.estimatedInputCostUsd.toFixed(4)} input cost with ${model}`;
  return {
    context,
    cost,
    overflow: estimate.overflowNotice?.detail ?? null,
  };
}
