import type { RelationshipSheetAction } from "./relationship-sheet-model";

/** The two write-backed selectors in the Profile relationship sheets. */
export type RelationshipSelector = "frequency" | "snooze";

/** Each selector's draft value type (interval days; snooze-until date). */
export interface RelationshipSelectorValues {
  frequency: number | null;
  snooze: string | null;
}

export interface RelationshipSheetRunnerDeps {
  /** Apply one reducer action to exactly one selector's state. */
  dispatch<O extends RelationshipSelector>(
    owner: O,
    action: RelationshipSheetAction<RelationshipSelectorValues[O]>,
  ): void;
  /** The selector's CURRENT pending flag (read synchronously, not a stale render). */
  isPending(owner: RelationshipSelector): boolean;
  /** Close the sheet after a successful write. */
  onClose(): void;
}

export interface RelationshipSheetRunner {
  submit<O extends RelationshipSelector>(
    owner: O,
    value: RelationshipSelectorValues[O],
    operation: () => Promise<void>,
  ): Promise<void>;
  /** Re-run the last submitted operation for its owner only. */
  retry(): Promise<void>;
  canRetry(): boolean;
  /** Drop the retry target (the sheet was dismissed). */
  clear(): void;
}

/**
 * 38.3 RG-025 (architecture/AUD-ARCH-009, D-24). Owner-scoped settlement for
 * the Contact Frequency and Snooze selectors. A submit records its owner and
 * operation as the retry target; submit and Retry both settle through ONE
 * `settle` path (start → await → success + close, or failure), so a Retry only
 * ever touches the selector that failed and always ends `pending`. A submit or
 * Retry for a selector that is already pending is ignored (double-submit
 * protection); values are never deduped, so a repeated Snooze is a real event.
 */
export function createRelationshipSheetRunner(
  deps: RelationshipSheetRunnerDeps,
): RelationshipSheetRunner {
  let target: {
    owner: RelationshipSelector;
    operation: () => Promise<void>;
  } | null = null;

  const settle = async (
    owner: RelationshipSelector,
    operation: () => Promise<void>,
    start: () => void,
  ) => {
    start();
    try {
      await operation();
    } catch {
      deps.dispatch(owner, { type: "failure" });
      return;
    }
    deps.dispatch(owner, { type: "success" });
    if (target?.operation === operation) target = null;
    deps.onClose();
  };

  return {
    async submit(owner, value, operation) {
      if (deps.isPending(owner)) return;
      target = { owner, operation };
      await settle(owner, operation, () =>
        deps.dispatch(owner, { type: "submit", value }),
      );
    },
    async retry() {
      const current = target;
      if (current === null || deps.isPending(current.owner)) return;
      await settle(current.owner, current.operation, () =>
        deps.dispatch(current.owner, { type: "retry" }),
      );
    },
    canRetry: () => target !== null,
    clear() {
      target = null;
    },
  };
}
