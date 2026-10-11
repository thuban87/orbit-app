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

// =============================================================================
// UNSAVED-WORK GUARD (38.9 D-13, D-34; reviews C4-M4, C5-L1, C5-L7, C6-L5).
// =============================================================================

/** Writing Style differs from its saved baseline (all four fields, exact). */
export function isWritingStyleDirty(
  saved: WritingStyle,
  current: WritingStyle,
): boolean {
  return (
    saved.tone !== current.tone ||
    saved.length !== current.length ||
    saved.directness !== current.directness ||
    saved.freeform !== current.freeform
  );
}

/**
 * Whether a `load()` may publish the Writing Style it read: only for a style
 * read whose token is still valid (taken after the last successful Save
 * completed, review C6-L5) and only while the shown style is clean against the
 * baseline, so a section action's refresh never replaces an edit (C4-M4).
 */
export function shouldReplaceStyleOnLoad({
  saved,
  current,
  readToken,
  invalidBefore,
}: {
  saved: WritingStyle;
  current: WritingStyle;
  readToken: number;
  invalidBefore: number;
}): boolean {
  return readToken > invalidBefore && !isWritingStyleDirty(saved, current);
}

/** The Writing Style shown, its saved baseline, and the read-token boundary. */
export interface StyleSyncState {
  saved: WritingStyle;
  current: WritingStyle;
  /** A valid load has set the baseline to the stored style (C5-L1). */
  loadedOnce: boolean;
  /** Style-read tokens at or below this were taken before the last Save. */
  invalidBefore: number;
}

export function initialStyleSync(initial: WritingStyle): StyleSyncState {
  return {
    saved: initial,
    current: initial,
    loadedOnce: false,
    invalidBefore: 0,
  };
}

/**
 * Applies a completed `load()`'s style read (token `readToken`). A stale token
 * changes nothing. The first valid load always sets the baseline to the stored
 * style, replacing the shown style only when it is untouched, so an edit made
 * before it (or after a failed first load) stays and is dirty (C5-L1). Later
 * valid loads replace a clean style and re-baseline to it; a dirty style and
 * its baseline are left alone (C4-M4).
 */
export function applyStyleLoad(
  state: StyleSyncState,
  loaded: WritingStyle,
  readToken: number,
): StyleSyncState {
  if (readToken <= state.invalidBefore) return state;
  const replace = shouldReplaceStyleOnLoad({
    saved: state.saved,
    current: state.current,
    readToken,
    invalidBefore: state.invalidBefore,
  });
  if (!state.loadedOnce) {
    return {
      ...state,
      loadedOnce: true,
      saved: loaded,
      current: replace ? loaded : state.current,
    };
  }
  return replace ? { ...state, saved: loaded, current: loaded } : state;
}

/**
 * A successful Save of `submitted` completed when the style-read sequence was
 * `completedAtSeq`: the baseline becomes exactly what was written (an edit
 * typed while it was pending stays dirty) and every earlier read is stale.
 */
export function applyStyleSave(
  state: StyleSyncState,
  submitted: WritingStyle,
  completedAtSeq: number,
): StyleSyncState {
  return { ...state, saved: submitted, invalidBefore: completedAtSeq };
}

/**
 * A personalization section draft holds typed work (C5-L7): the new-section
 * form is open with a non-blank title or body, or an inline section edit is
 * open and differs from its section. Text left behind after Cancel does not
 * count while no form is open.
 */
export function hasSectionDraftChanges({
  adding,
  draftTitle,
  draftBody,
  editingOpen,
  editDirty,
}: {
  adding: boolean;
  draftTitle: string;
  draftBody: string;
  editingOpen: boolean;
  editDirty: boolean;
}): boolean {
  if (adding && (draftTitle.trim() !== "" || draftBody.trim() !== "")) {
    return true;
  }
  return editingOpen && editDirty;
}
