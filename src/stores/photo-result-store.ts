/**
 * Transient crop-result + staged-file ledger store (PHOTO-01 custom-field reuse).
 *
 * Two jobs, both in-memory and both keyed on the derivable `cv-` relPath:
 *
 *  1. CROP-SUCCESS CHANNEL. Navigation params must be SERIALIZABLE (native-stack
 *     + deep-link safety), so a callback can't ride back from `CropPhotoScreen`.
 *     Instead the customField crop branch `publishCropResult(requestId, true)`
 *     where `requestId` IS `customFieldPhotoRelPath(contactId, colName)`, and the
 *     initiating widget re-derives the SAME key on focus and `consumeCropResult`s
 *     it exactly ONCE — so it sets its field value once and only when the crop
 *     that returned actually matches this field.
 *
 *  2. STAGED-FILE LEDGER (review cycle-2 MED custom-field orphan). A customField
 *     crop persists the ~40 KB `cv-` master to disk BEFORE the edit form's Save
 *     commits the value. A Cancel / failed Save would leak that file. The widget
 *     `markPhotoStaged(relPath)` on consume; `EditContactScreen` drains the set
 *     with `takeStagedPhotos()` on teardown and deletes only the staged files no
 *     COMMITTED value references (never a saved photo). In-memory only: a process
 *     kill loses the set, but the leak is self-healing (a re-crop overwrites the
 *     stable path) and purge-cleaned by Plan 07.
 */
import { create } from "zustand";

interface PhotoResultStore {
  /** The single most-recent crop-success signal, or null once consumed. */
  lastCropResult: { requestId: string; success: boolean } | null;
  /** cv- relPaths persisted-but-not-yet-committed — the orphan-cleanup ledger. */
  stagedPhotos: Set<string>;
  /** Publish a crop-success for `requestId` (the derivable cv- relPath). */
  publish: (requestId: string, success: boolean) => void;
  /** Return + clear the result ONLY when its requestId matches; else leave it. */
  consume: (requestId: string) => { requestId: string; success: boolean } | null;
  /** Record a cv- relPath staged to disk before the form Save committed it. */
  markStaged: (relPath: string) => void;
  /** Return the staged set and clear it (drain-once). */
  takeStaged: () => string[];
}

const usePhotoResultStore = create<PhotoResultStore>((set, get) => ({
  lastCropResult: null,
  stagedPhotos: new Set<string>(),
  publish: (requestId, success) =>
    set({ lastCropResult: { requestId, success } }),
  consume: (requestId) => {
    const current = get().lastCropResult;
    if (current && current.requestId === requestId) {
      set({ lastCropResult: null });
      return current;
    }
    return null;
  },
  markStaged: (relPath) =>
    set((state) => {
      const next = new Set(state.stagedPhotos);
      next.add(relPath);
      return { stagedPhotos: next };
    }),
  takeStaged: () => {
    const staged = Array.from(get().stagedPhotos);
    set({ stagedPhotos: new Set<string>() });
    return staged;
  },
}));

/**
 * Publish a crop-success for `requestId` — call from `CropPhotoScreen`'s
 * customField branch after the master is persisted. Non-hook: usable outside
 * React. `requestId` is the derivable `cv-` relPath by convention.
 */
export function publishCropResult(requestId: string, success: boolean): void {
  usePhotoResultStore.getState().publish(requestId, success);
}

/**
 * Read + consume (once) the crop-success for `requestId` — call from the widget
 * on focus with `customFieldPhotoRelPath(contactId, colName)`. Returns the result
 * and clears it ONLY on a requestId match; a non-matching result is left intact
 * for its own widget. Non-hook.
 */
export function consumeCropResult(
  requestId: string,
): { requestId: string; success: boolean } | null {
  return usePhotoResultStore.getState().consume(requestId);
}

/**
 * Record a cv- relPath persisted to disk before the form Save committed its value
 * — the orphan-cleanup ledger. Non-hook.
 */
export function markPhotoStaged(relPath: string): void {
  usePhotoResultStore.getState().markStaged(relPath);
}

/**
 * Return the staged cv- relPaths and clear the ledger (drain-once) — call from
 * `EditContactScreen` on teardown to reconcile orphans. Non-hook.
 */
export function takeStagedPhotos(): string[] {
  return usePhotoResultStore.getState().takeStaged();
}
