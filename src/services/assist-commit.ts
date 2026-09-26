/**
 * Shared Interaction Assist confirmation contract (38.3 RG-023).
 *
 * Findings closed: `architecture/AUD-ARCH-006` (Compose omitted the queue and
 * widget publication), `react-native/AUD-RN-007` (banner/sheet omitted the
 * shell tick) and `react-native/AUD-RN-013` (rejections dropped, no latch;
 * reopened and folded in by owner ruling D-08).
 *
 * Every assist entry — AssistBanner, PendingConfirmationsSheet and Compose's
 * "Yes, log interaction" — runs its write through `runAssistAction` and, only
 * after the write commits, publishes through ONE publisher (D-21):
 *
 *   - `publishAssistCommit`   widget notify + shell tick + assist-queue refresh
 *   - `publishAssistDismissal` assist-queue refresh only (no interaction row)
 *
 * Publication never rejects (D-04): a committed write is never presented as
 * failed or offered for replay because a later read or signal failed; each
 * publication step is isolated and its failure is logged content-free.
 *
 * A write failure is surfaced through `onError(kind)`. The ADR-071 future-date
 * (clock-rollback) guard is recognised by its typed `FutureOccurredAtError` and
 * gets its own copy. The assist stays pending on any failure because the DAO
 * guard fires before the transaction opens, or the transaction rolls back —
 * there is nothing to undo here. The guard, the handoff-time `occurred_at` and
 * the in-transaction pending recheck are untouched (ADR-071).
 *
 * Node-testable by construction: no react-native, widget or store import —
 * callers inject the real side effects (the `quick-log-command.ts` pattern).
 */
import type { AssistLogOutcome } from "@/db/interaction-assist-dao";
import { FutureOccurredAtError } from "@/db/log-guards";
import {
  beginInFlight,
  endInFlight,
  type InFlightRef,
} from "@/utils/single-flight";

export type AssistFailureKind = "future-date" | "generic";

export interface AssistFailureCopy {
  title: string;
  body: string;
}

/** Content-free Alert copy (no names, notes or ids). Wording per D-24. */
export const ASSIST_FAILURE_COPY: {
  log: Record<AssistFailureKind, AssistFailureCopy>;
  dismiss: { generic: AssistFailureCopy };
  closed: AssistFailureCopy;
} = {
  log: {
    "future-date": {
      title: "Check your device clock",
      body: "Your phone's time is earlier than when this reach-out started, so it can't be logged yet. It's still pending.",
    },
    generic: {
      title: "Couldn't log that yet",
      body: "It's still pending — try again.",
    },
  },
  dismiss: {
    generic: {
      title: "Couldn't dismiss that yet",
      body: "It's still pending — try again.",
    },
  },
  // 38.3 review B-WR-05: the assist was dismissed or expired before this
  // confirm, so no interaction row was written.
  closed: {
    title: "Already closed",
    body: "This reach-out was already closed, so nothing was logged.",
  },
};

/** Map a write rejection to the copy family the UI should show. */
export function classifyAssistFailure(error: unknown): AssistFailureKind {
  return error instanceof FutureOccurredAtError ? "future-date" : "generic";
}

export interface PublishAssistCommitDeps {
  /** Fire-and-forget widget push (`notifyWidgetDataChanged`). */
  notifyWidget(): void;
  /** Shell refresh tick (`bumpShellRefresh`) — a synchronous store update. */
  bumpShell(): void;
  /** Assist-queue re-read (`useAssistBanner.getState().refresh`). */
  refreshQueue(): Promise<void>;
  /** Content-free logging of an isolated publication failure. */
  logFailure(message: string, error: unknown): void;
}

/**
 * Publish a committed assist confirmation to every consumer. Each step runs in
 * its own try/catch so one failure never suppresses the others. NEVER rejects.
 */
export async function publishAssistCommit(
  deps: PublishAssistCommitDeps,
): Promise<void> {
  try {
    deps.notifyWidget();
  } catch (error) {
    deps.logFailure("assist widget notify failed", error);
  }
  try {
    deps.bumpShell();
  } catch (error) {
    deps.logFailure("assist shell refresh failed", error);
  }
  try {
    await deps.refreshQueue();
  } catch (error) {
    deps.logFailure("assist queue refresh failed", error);
  }
}

/**
 * Publish a committed dismissal. A dismissal records no interaction, so only
 * the queue changes. NEVER rejects.
 */
export async function publishAssistDismissal(
  deps: Pick<PublishAssistCommitDeps, "refreshQueue" | "logFailure">,
): Promise<void> {
  try {
    await deps.refreshQueue();
  } catch (error) {
    deps.logFailure("assist queue refresh failed", error);
  }
}

export interface RunAssistActionInput {
  /** Per-surface (or per-assist) synchronous latch against double taps. */
  latch: InFlightRef;
  /**
   * The DAO write (`markAssistLogged` / `markAssistDismissed`). A log write
   * resolves its `AssistLogOutcome`; `"closed"` means nothing was written.
   */
  write(): Promise<AssistLogOutcome | unknown>;
  /** Post-commit publication; contractually never rejects. */
  publish(): Promise<void>;
  /**
   * Surface a WRITE failure to the user (and log it content-free). Never called
   * after a commit. `error` is the raw rejection, for logging only.
   */
  onError(kind: AssistFailureKind, error: unknown): void;
  /** Optional: log a publish that broke its never-reject contract. */
  logFailure?(message: string, error: unknown): void;
  /**
   * Tell the user a confirm was a no-op because the assist was already closed
   * (dismissed / expired / failed / gone). Never called for a real commit.
   */
  onClosed?(): void;
  /** Queue-only refresh after a `"closed"` no-op; never rejects. */
  publishClosed?(): Promise<void>;
}

export type AssistActionResult = "done" | "failed" | "busy" | "closed";

/**
 * Run one assist write under a synchronous in-flight latch, then publish.
 * Returns "busy" (no write) when the latch is held, "failed" after reporting a
 * write rejection, "closed" when the write resolved as a no-op because the
 * assist was no longer pending (38.3 review B-WR-05: never presented as logged,
 * and the commit publisher is not run), and "done" once the write committed —
 * regardless of how the publication went (D-04). The latch is released in
 * `finally` on every path.
 */
export async function runAssistAction(
  input: RunAssistActionInput,
): Promise<AssistActionResult> {
  if (!beginInFlight(input.latch)) return "busy";
  try {
    let outcome: unknown;
    try {
      outcome = await input.write();
    } catch (error) {
      input.onError(classifyAssistFailure(error), error);
      return "failed";
    }
    if (outcome === "closed") {
      try {
        input.onClosed?.();
      } catch (error) {
        input.logFailure?.("assist closed notice failed", error);
      }
      try {
        await input.publishClosed?.();
      } catch (error) {
        input.logFailure?.("assist queue refresh failed", error);
      }
      return "closed";
    }
    try {
      await input.publish();
    } catch (error) {
      // Defense in depth: the publishers never reject, but a committed write
      // must never be reported as failed even if a caller's publish does.
      input.logFailure?.("assist publication failed", error);
    }
    return "done";
  } finally {
    endInFlight(input.latch);
  }
}
