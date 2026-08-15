/**
 * Per-write photo cache-bust token store (PHOTO-04, review cycle-2 [MED]).
 *
 * expo-image caches a DECODE keyed by the image URI. Every photo master has a
 * STABLE `contactId`-derivable `file://` path (`avatars/contact-<id>.jpg`), so a
 * REPLACE writes new bytes to the SAME URI — `cachePolicy="memory-disk"` would
 * then serve the stale prior decode. The obvious discriminator, the contact's
 * `modified_at`, is only SECOND-resolution (`database.ts` `localDateTime` →
 * `YYYY-MM-DD HH:MM:SS`): two replaces within one wall-clock second reuse the
 * same path AND the same `modified_at` → the same cache key → a stale image.
 *
 * This store closes that sub-second hole with a MONOTONIC per-write counter keyed
 * by the photo relPath. Every photo WRITE site (05-05 / 05-08) calls
 * `bumpPhotoCacheBust(relPath)` right after a set/clear; `Avatar` folds the
 * current revision into its `cacheKey`/`recyclingKey`, so even a same-second
 * replace produces a strictly-new key and a fresh decode.
 *
 * The counter (not `Date.now()`, which can collide at sub-ms) guarantees a
 * strictly-increasing value per key. The store is IN-MEMORY: after a restart a
 * key has no revision, so `Avatar` falls back to `photo#modified_at` — itself a
 * key never previously cached in the fresh process, forcing a clean disk read of
 * the current bytes. Correctness therefore holds across restart too.
 */
import { create } from "zustand";

interface PhotoCacheBustStore {
  /** Monotonic per-write revision counter, keyed by photo relative path. */
  revisions: Record<string, number>;
  /** Increment the revision for `relPath` (a photo write just landed). */
  bump: (relPath: string) => void;
}

const usePhotoCacheBustStore = create<PhotoCacheBustStore>((set) => ({
  revisions: {},
  bump: (relPath) =>
    set((state) => ({
      revisions: {
        ...state.revisions,
        [relPath]: (state.revisions[relPath] ?? 0) + 1,
      },
    })),
}));

/**
 * Bump the cache-bust revision for a photo relPath — call from every photo WRITE
 * site (set/replace/clear) immediately after the DAO write. Non-hook: usable
 * outside React (services/pipeline).
 */
export function bumpPhotoCacheBust(relPath: string): void {
  usePhotoCacheBustStore.getState().bump(relPath);
}

/**
 * Non-hook read of the current revision for a relPath (or `undefined` if never
 * bumped). Null/empty relPath yields `undefined` — a photo-less avatar has no
 * token to fold.
 */
export function getPhotoCacheBust(relPath: string | null): number | undefined {
  if (!relPath) {
    return undefined;
  }
  return usePhotoCacheBustStore.getState().revisions[relPath];
}

/**
 * Reactive subscription to a relPath's revision — the `Avatar` binding. Selecting
 * the single key keeps the render tied to just this photo's writes. A null/empty
 * relPath (photo-less) selects `undefined`.
 */
export function usePhotoCacheBust(relPath: string | null): number | undefined {
  return usePhotoCacheBustStore((state) =>
    relPath ? state.revisions[relPath] : undefined,
  );
}
