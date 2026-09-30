/**
 * The ONE photo master encoder (D-10, D-13, D-21).
 *
 * Every new master write — crop/picker, URL download, custom photo field and
 * self photo (via `persistCroppedMaster`), device import and consolidation
 * (`importedPhotoFs.resizeToMaster`), import retry (inherits it) and reconcile
 * promote — encodes through `encodeMaster`: one square lossy WebP whose edge is
 * min(source square side, `MASTER_MAX_EDGE`), never upscaled.
 *
 * This module never names files. Callers persist the returned manipulator cache
 * URI under the unchanged identity-derived `.jpg` names (D-21); existing 512 JPEG
 * masters are never re-encoded or swept (D-12).
 *
 * `expo-image-manipulator` is imported lazily so the pure helpers
 * (`masterEdge`, `centerSquare`) stay node-testable without native modules.
 */
import type * as ExpoImageManipulator from "expo-image-manipulator";
import type { CropRect } from "./crop-geometry";

/** D-10: the master's maximum edge, in px. Never upscaled past the source. */
export const MASTER_MAX_EDGE = 1024;

/**
 * D-10: WebP quality for the master. MUST stay below 1 — `compress` 1.0 makes
 * Android write LOSSLESS WebP (expo-image-manipulator
 * `ImageManipulatorArguments.kt:48`), which bloats storage and backups.
 * Device-tuned for visual parity with the old q0.75 JPEG master.
 */
export const MASTER_QUALITY = 0.8;

/**
 * The master edge for a source square of `width`×`height`: the shorter side,
 * capped at `MASTER_MAX_EDGE`, floored to whole pixels (never upscaled).
 */
export function masterEdge(width: number, height: number): number {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("invalid master source size");
  }
  return Math.max(1, Math.floor(Math.min(width, height, MASTER_MAX_EDGE)));
}

/** The centred square crop of a `width`×`height` image (D-13: no distortion). */
export function centerSquare(width: number, height: number): CropRect {
  const side = Math.floor(Math.min(width, height));
  return {
    originX: Math.floor((width - side) / 2),
    originY: Math.floor((height - side) / 2),
    width: side,
    height: side,
  };
}

type Manipulator = typeof ExpoImageManipulator;
type RenderedRef = Awaited<
  ReturnType<
    ReturnType<Manipulator["ImageManipulator"]["manipulate"]>["renderAsync"]
  >
>;

type ManipulatorContext = ReturnType<
  Manipulator["ImageManipulator"]["manipulate"]
>;

/**
 * Release a native `SharedObject` — a rendered `ImageRef` or the
 * `ImageManipulatorContext` that produced it. BOTH must be released: on Android
 * the context's finished task still holds the final `Bitmap` after the
 * `ImageRef` is released, so releasing only the ref leaves the bitmap reachable
 * until an unrelated JS GC collects the context wrapper (D-11). The chainable
 * `crop`/`resize` calls return the SAME native context, so releasing the one
 * `manipulate()` returned covers the whole chain.
 */
function releaseQuietly(ref: RenderedRef | ManipulatorContext | null): void {
  if (!ref) return;
  try {
    ref.release();
  } catch {
    // A release failure must never mask the encode result or its error.
  }
}

async function saveMaster(
  mod: Manipulator,
  rendered: RenderedRef,
): Promise<string> {
  const saved = await rendered.saveAsync({
    format: mod.SaveFormat.WEBP,
    compress: MASTER_QUALITY,
  });
  return saved.uri;
}

/**
 * Encode `sourceUri` into one square WebP master (D-10) and return the
 * manipulator's (evictable) cache URI; the caller persists and discards it.
 *
 * - With `crop` (the crop screen's square source rect): crop, then downscale to
 *   `masterEdge` only when the crop is larger — never upscale.
 * - Without `crop` (import, import retry, reconcile): centre-square the source
 *   and keep its own size up to `MASTER_MAX_EDGE` (D-13/D-22: an imported
 *   thumbnail is neither upscaled nor distorted).
 *
 * Every `ImageRef` rendered here, and every manipulator context that rendered
 * one, is released exactly once in a `finally`.
 */
export async function encodeMaster(
  sourceUri: string,
  crop?: CropRect,
): Promise<string> {
  const mod = (await import("expo-image-manipulator")) as Manipulator;
  const { ImageManipulator } = mod;

  if (crop) {
    const edge = masterEdge(crop.width, crop.height);
    const context = ImageManipulator.manipulate(sourceUri);
    let rendered: RenderedRef | null = null;
    try {
      let chain = context.crop(crop);
      if (edge < Math.floor(Math.min(crop.width, crop.height))) {
        chain = chain.resize({ width: edge, height: edge });
      }
      rendered = await chain.renderAsync();
      return await saveMaster(mod, rendered);
    } finally {
      releaseQuietly(rendered);
      releaseQuietly(context);
    }
  }

  let baseContext: ManipulatorContext | null = null;
  let base: RenderedRef | null = null;
  let context: ManipulatorContext | null = null;
  let rendered: RenderedRef | null = null;
  try {
    baseContext = ImageManipulator.manipulate(sourceUri);
    base = await baseContext.renderAsync();
    const square = centerSquare(base.width, base.height);
    const edge = masterEdge(square.width, square.height);
    context = ImageManipulator.manipulate(base);
    let chain = context;
    if (base.width !== base.height) chain = chain.crop(square);
    if (edge < square.width) {
      chain = chain.resize({ width: edge, height: edge });
    }
    rendered = await chain.renderAsync();
    return await saveMaster(mod, rendered);
  } finally {
    releaseQuietly(rendered);
    releaseQuietly(context);
    releaseQuietly(base);
    releaseQuietly(baseContext);
  }
}
