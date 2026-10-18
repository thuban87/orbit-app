/**
 * Check linked contacts photo staging names and the detail screen's cleanup
 * (folded into 38.12-19 from 38.12-10's deferred item 1; this plan only).
 *
 * - The grid and the detail stage under different names, so the detail never
 *   deletes (or overwrites) a file a grid card points at.
 * - The detail tracks what it staged and deletes every copy it did not promote
 *   when it closes (Apply, Back, or a re-read). The launch sweep stays the
 *   backstop for a crash.
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
): DetailStagingTracker {
  const staged = new Set<string>();
  return {
    track: (relative) => {
      staged.add(relative);
    },
    release: (relative) => {
      staged.delete(relative);
    },
    clear: () => {
      const pending = [...staged];
      staged.clear();
      for (const relative of pending) {
        try {
          deleteStaged(relative);
        } catch {
          // Best effort: the launch sweep removes anything left behind.
        }
      }
    },
  };
}
