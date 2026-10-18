/**
 * Check linked contacts photo staging names and the detail screen's cleanup
 * (folded into 38.12-19 from 38.12-10's deferred item 1; this plan only).
 *
 * - The grid and the detail stage under different names, so the detail never
 *   deletes (or overwrites) a file a grid card points at.
 * - The detail tracks what it staged and deletes every copy it did not promote
 *   when it closes (Apply, Back, or a re-read). While tracked, a copy is held
 *   against the orphan sweep, which runs on every foreground, not only at
 *   launch (38.12 review B-WR-02); the sweep stays the backstop for a crash.
 *
 * Pure apart from the injected delete, so it is node-testable.
 */

/** The grid's staging token for one link's phone photo. */
export function gridStagingToken(contactId: number, linkId: number): string {
  return `contact-${contactId}-link-${linkId}`;
}

/** The detail screen's own staging token for one link's phone photo. */
export function detailStagingToken(contactId: number, linkId: number): string {
  return `detail-contact-${contactId}-link-${linkId}`;
}

export interface DetailStagingTracker {
  /** Remember a copy the detail staged. */
  track(relative: string): void;
  /** A copy that was promoted (and deleted by the promote path) is forgotten. */
  release(relative: string): void;
  /** Delete every copy still tracked; called when the detail closes or re-reads. */
  clear(): void;
}

export function createDetailStagingTracker(
  deleteStaged: (relative: string) => void,
  /** Hold a copy against the orphan sweep; returns its release (B-WR-02). */
  hold: (relative: string) => () => void = () => () => undefined,
): DetailStagingTracker {
  const staged = new Map<string, () => void>();
  const forget = (relative: string) => {
    staged.get(relative)?.();
    staged.delete(relative);
  };
  return {
    track: (relative) => {
      if (!staged.has(relative)) staged.set(relative, hold(relative));
    },
    release: (relative) => {
      forget(relative);
    },
    clear: () => {
      const pending = [...staged.keys()];
      for (const relative of pending) {
        forget(relative);
        try {
          deleteStaged(relative);
        } catch {
          // Best effort: the launch sweep removes anything left behind.
        }
      }
    },
  };
}
