/**
 * In-process photo DISPLAY revision store (PHOTO-04; rewritten 38.6 D-19).
 *
 * The single display revision per canonical photo path. Filenames are
 * identity-derived and never change (D-21), so a replace overwrites the SAME
 * `file://` path; on Android expo-image ignores `cacheKey` for `file://`, so the
 * revision reaches the image loader through the display URI (`?v=<revision>`,
 * see `components/photo-display.ts`).
 *
 * The revision is bumped by the ownership layer's `notifyPhotoBytesChanged`
 * (`services/photos/owned-master.ts`) wherever canonical bytes change. The crop
 * screen's own call-site bumps are redundant and retire in 38.6-03. It is
 * display-only and never the authorization `canonicalGeneration`.
 *
 * The counter (not `Date.now()`, which can collide at sub-ms) is strictly
 * increasing per path. The store is IN-MEMORY: in a fresh process a path has no
 * revision, so the display URI is the bare path — and with the in-memory-only
 * image cache that is a fresh decode of the current bytes.
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
