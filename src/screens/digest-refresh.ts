/**
 * Digest refresh ownership (38.3 RG-026; react-native/AUD-RN-006,
 * reliability-testing/AUD-REL-013; owner rulings D-13, D-14).
 *
 * Digest is the single trigger owner for its reads:
 * - `focus` — every focus reads (always accepted);
 * - `shell` — the in-process shell tick (Quick Log/Undo, assist, warm
 *   notification actions) while Digest stays focused (D-13);
 * - `foreground` — the post-sweep foreground tick, published after the
 *   launch/foreground sweep settles, so a resume reads the sweep's purges and
 *   expiry (D-14).
 *
 * A `shell`/`foreground` request while Digest is hidden reads nothing; the next
 * focus read covers it (no background reads). One latest-request authority
 * gates every publication, so an older read resolving or failing after a newer
 * one publishes nothing.
 *
 * No persistent cache, snapshot or bus (D-03, ADR-147): Digest stays a derived
 * live read. Pure: no React, no react-native, no timers (D-22).
 */
import { createLatestRequestAuthority } from "@/utils/latest-request";

export type DigestRefreshSource = "focus" | "shell" | "foreground";

export interface DigestRefreshDeps<T> {
  /** The full Digest read bundle. */
  read(): Promise<T>;
  /** Publish a CURRENT successful read. */
  publish(data: T): void;
  /** Report a CURRENT failed read (stale failures never reach here). */
  fail(cause: unknown): void;
  /** Whether Digest is focused right now. */
  isVisible(): boolean;
  /** A request was accepted (a read is about to start). */
  onAccepted(): void;
}

export interface DigestRefreshController {
  request(source: DigestRefreshSource): Promise<void>;
  /** Retire every outstanding read (unmount). */
  invalidate(): void;
}

export function createDigestRefreshController<T>(
  deps: DigestRefreshDeps<T>,
): DigestRefreshController {
  const authority = createLatestRequestAuthority();
  return {
    async request(source) {
      if (source !== "focus" && !deps.isVisible()) return;
      const token = authority.begin();
      deps.onAccepted();
      let data: T;
      try {
        data = await deps.read();
      } catch (cause) {
        if (authority.isCurrent(token)) deps.fail(cause);
        return;
      }
      if (authority.isCurrent(token)) deps.publish(data);
    },
    invalidate: () => authority.invalidate(),
  };
}

/**
 * Digest's outer load state. `refreshError` marks a failed REFRESH over an
 * already-loaded body: the body (and Your Week's period/selected day) stays
 * mounted and a compact notice offers Retry.
 */
export type DigestRefreshLoadState<T> =
  | { phase: "loading" }
  | { phase: "loaded"; data: T; refreshError?: boolean }
  | { phase: "error" };

/** Nothing loaded yet → error; a loaded body is kept and flagged. */
export function digestLoadStateOnFail<T>(
  state: DigestRefreshLoadState<T>,
): DigestRefreshLoadState<T> {
  if (state.phase === "loaded") return { ...state, refreshError: true };
  return { phase: "error" };
}

/** A current successful read always lands as loaded with no refresh error. */
export function digestLoadStateOnPublish<T>(
  _state: DigestRefreshLoadState<T>,
  data: T,
): DigestRefreshLoadState<T> {
  return { phase: "loaded", data, refreshError: false };
}
