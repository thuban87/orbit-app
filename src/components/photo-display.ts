/**
 * Canonical-photo display source for expo-image (38.6 D-01/D-19/D-21).
 *
 * Every contact/profile photo lives at a fixed identity-derived path
 * (`avatars/contact-<id>.jpg`), so a replace overwrites the SAME file. On
 * Android expo-image turns a `file://` source into a raw Glide model and never
 * reads `cacheKey`, so a replaced photo kept its old decode. Filenames stay
 * identity-derived (D-21); only the display source changes:
 *
 *   - `revision-query`: the in-process display revision rides in the URI as
 *     `?v=<revision>` (a new Glide model per write), with an in-memory-only
 *     cache so a restart cannot resurrect an older decode.
 *   - `no-cache`: the plain URI, caching off entirely, and a `cacheKey` bump so
 *     expo-image's source equality still forces a reload. The engineering
 *     fallback (no rename); it costs late image pop-in on the Grid, which is
 *     reported to the owner if it is ever selected.
 *
 * The revision comes from `photo-cache-bust-store`, bumped by the ownership
 * layer's `notifyPhotoBytesChanged`. It is display-only — never the
 * authorization `canonicalGeneration`.
 */
import { useMemo } from "react";
import {
  resolvePhotoDisplayUri,
  resolvePhotoUri,
} from "@/services/photos/photo-storage";
import {
  getPhotoCacheBust,
  usePhotoCacheBust,
} from "@/stores/photo-cache-bust-store";

export type PhotoDisplayStrategy = "revision-query" | "no-cache";

/**
 * The display strategy in force. Chosen by the 38.6-01 device spike
 * (`38.6-SPIKE.md`); `no-cache` is the engineering fallback (D-19/D-21 allow it:
 * no rename). If the spike selects `no-cache`, the Grid late-pop-in it causes is
 * reported to the owner.
 */
export const PHOTO_DISPLAY_STRATEGY: PhotoDisplayStrategy = "revision-query";

export interface PhotoDisplay {
  source: { uri: string; cacheKey?: string };
  cachePolicy: "memory" | "none";
  revision: number;
}

export interface PhotoDisplayResolvers {
  display(relative: string, revision: number | undefined): string;
  plain(relative: string): string;
}

/** Pure: the expo-image source/cache policy for one canonical photo. */
export function photoDisplayFor(
  relative: string,
  revision: number | undefined,
  strategy: PhotoDisplayStrategy,
  resolvers: PhotoDisplayResolvers,
): PhotoDisplay {
  if (strategy === "no-cache") {
    return {
      source: {
        uri: resolvers.plain(relative),
        cacheKey: `${relative}#${revision ?? 0}`,
      },
      cachePolicy: "none",
      revision: revision ?? 0,
    };
  }
  return {
    source: { uri: resolvers.display(relative, revision) },
    cachePolicy: "memory",
    revision: revision ?? 0,
  };
}

const RUNTIME_RESOLVERS: PhotoDisplayResolvers = {
  display: resolvePhotoDisplayUri,
  plain: resolvePhotoUri,
};

/** Reactive display source for a canonical photo path (null when photo-less). */
export function usePhotoDisplay(relative: string | null): PhotoDisplay | null {
  const revision = usePhotoCacheBust(relative);
  return useMemo(
    () =>
      relative
        ? photoDisplayFor(
            relative,
            revision,
            PHOTO_DISPLAY_STRATEGY,
            RUNTIME_RESOLVERS,
          )
        : null,
    [relative, revision],
  );
}

/** Non-hook read of the current display source (null when photo-less). */
export function getPhotoDisplay(relative: string | null): PhotoDisplay | null {
  if (!relative) return null;
  return photoDisplayFor(
    relative,
    getPhotoCacheBust(relative),
    PHOTO_DISPLAY_STRATEGY,
    RUNTIME_RESOLVERS,
  );
}
