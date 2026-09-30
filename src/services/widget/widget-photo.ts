/**
 * widget-photo — the base64 tile-thumbnail encoder (WDG-01), one of this phase's
 * two node-testable correctness cores. It turns a contact's photo master (512
 * JPEG or up to 1024 WebP, D-12) into a small `data:image/jpeg;base64,…` URI the headless RemoteViews render
 * feeds to `ImageWidget`.
 *
 * WHY base64, not file://: RemoteViews CANNOT read a `file://` source, and a
 * network fetch on the widget read path would violate local-first (RESEARCH
 * Anti-Patterns / Security Domain). The widget read path is base64-only — this
 * encoder never emits a `file://` or `http(s)` source.
 *
 * IT REUSES, NEVER RE-INVENTS: the SDK-52+ chainable `ImageManipulator` API
 * `photo-pipeline.ts` already established (manipulate → resize → renderAsync →
 * saveAsync), and `resolvePhotoUri` (photo-storage.ts) for the master `file://`.
 *
 * NO NEW PERSISTENT STATE (WDG-01): the base64 is produced INLINE and returned —
 * no `persistMaster`, no thumbnail file, no DB write. NO network on any path.
 *
 * FAILURE IS NON-FATAL BY DESIGN: the render calls this ONCE PER TILE, so a throw
 * here would reject the whole grid render and blank every tile. Instead, both a
 * decode/manipulate failure (corrupt or evicted master) AND a resolved-but-empty
 * base64 payload collapse to `null` (Logger-logged) — the render treats `null`
 * exactly like the no-photo case and shows the initials swatch for that ONE tile
 * (addresses Codex/Claude M2 + codex/Claude MED). Note this DEPARTS from
 * `photo-pipeline.ts`, which rethrows a typed `PhotoPipelineError`: that pipeline
 * runs per user action, this runs per tile in a batch render.
 */
import {
  ImageManipulator,
  type ImageRef,
  type ImageResult,
  SaveFormat,
} from "expo-image-manipulator";
import { isStoredPhotoPath } from "@/db/photo-relative-path";
import { discardDerivative } from "@/services/photos/derivative-cache";
import { resolvePhotoUri } from "@/services/photos/photo-storage";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "widget-photo";

/**
 * The tile-thumbnail edge length, in px. Device-spike-tunable (12-08): kept small
 * so a whole favourites grid of base64 thumbs stays under the RemoteViews
 * per-widget bitmap-memory ceiling (RESEARCH Pitfall 2 / A3). Single-number edit.
 */
const THUMB_PX = 88;

/** JPEG quality for the tile thumbnail (~a few tens of KB base64 at THUMB_PX). */
const THUMB_Q = 0.6;

/**
 * Encode a contact's photo master (512 JPEG or up to 1024 WebP, D-12; identified
 * by its stored RELATIVE path)
 * into a `data:image/jpeg;base64,…` URI for the headless widget render.
 *
 * Returns `null` — the initials-fallback signal — in every non-emitting case:
 *   - a null/empty `relativePath` (the contact has no photo), or one that is not
 *     a stored photo path (38.6 D-34);
 *   - the manipulator throws (a corrupt or evicted master) — Logger-logged, NOT
 *     rethrown, so one bad photo downgrades that tile rather than blanking the
 *     whole grid;
 *   - `saveAsync` resolves but `result.base64` is undefined/empty (the field is
 *     typed optional EVEN when `base64:true` is requested —
 *     ImageManipulator.types.d.ts:19,24) — Logger-logged; NEVER interpolated into
 *     a "data:image/jpeg;base64,undefined" URI.
 */
export async function encodeWidgetThumb(
  relativePath: string | null,
  discard: (uri: string) => boolean = discardDerivative,
): Promise<string | null> {
  // 38.6 D-34: a value that is not a stored photo path is never resolved (and
  // never logged — it can be user text); the tile shows its initials.
  if (!isStoredPhotoPath(relativePath)) return null;

  try {
    // file:// of the master (512 JPEG or up to 1024 WebP, D-12).
    const fileUri = resolvePhotoUri(relativePath);
    // WR-02: the context is released too — on Android its finished task still
    // holds the thumbnail Bitmap after the ImageRef is released (D-11).
    const context = ImageManipulator.manipulate(fileUri);
    let rendered: ImageRef | null = null;
    let out: ImageResult;
    try {
      rendered = await context
        .resize({ width: THUMB_PX, height: THUMB_PX })
        .renderAsync();
      out = await rendered.saveAsync({
        format: SaveFormat.JPEG,
        compress: THUMB_Q,
        base64: true,
      });
    } finally {
      // Release the native bitmap and its context exactly once each, on
      // success and on a render/save throw.
      try {
        rendered?.release();
      } catch {
        Logger.warn(LOG_SCOPE, "thumbnail bitmap release failed");
      }
      try {
        context.release();
      } catch {
        Logger.warn(LOG_SCOPE, "thumbnail context release failed");
      }
    }

    try {
      // Native saveAsync writes a cache file even with base64:true.
      if (typeof out.base64 === "string" && out.base64.length > 0) {
        return `data:image/jpeg;base64,${out.base64}`;
      }
      Logger.warn(
        LOG_SCOPE,
        "saveAsync resolved without a base64 payload; falling back to initials",
      );
      return null;
    } finally {
      try {
        discard(out.uri);
      } catch {
        Logger.warn(LOG_SCOPE, "thumbnail cache cleanup failed");
      }
    }
  } catch (error) {
    // A corrupt/evicted master makes the manipulator throw. Swallow to null (the
    // no-photo signal) rather than rethrowing — a per-tile throw would reject the
    // whole grid render (M2).
    Logger.error(
      LOG_SCOPE,
      `thumbnail encode failed for ${relativePath}; falling back to initials`,
      error,
    );
    return null;
  }
}

/** A widget tile's photo identity, as `encodeTileThumbs` needs it. */
export interface ThumbTile {
  id: number | string;
  relativePhoto: string | null;
}

/**
 * Encode every tile's thumbnail ONE AT A TIME (D-11): each encode decodes a full
 * master (up to 1024² now), so a sequential loop caps the transient full-size
 * decode peak at one master instead of one per tile. Per-tile fault isolation is
 * kept: a throwing encode degrades THAT tile to its initials swatch (M2).
 */
export async function encodeTileThumbs<T extends ThumbTile>(
  tiles: readonly T[],
  encode: (relativePath: string | null) => Promise<string | null> = (path) =>
    encodeWidgetThumb(path),
): Promise<Array<{ tile: T; thumb: string | null }>> {
  const rendered: Array<{ tile: T; thumb: string | null }> = [];
  for (const tile of tiles) {
    let thumb: string | null = null;
    try {
      thumb = await encode(tile.relativePhoto);
    } catch (error) {
      Logger.error(
        LOG_SCOPE,
        `tile ${tile.id} thumb encode threw; falling back to initials`,
        error,
      );
      thumb = null;
    }
    rendered.push({ tile, thumb });
  }
  return rendered;
}
