/**
 * Release-safe expo-image-manipulator derivatives (38.6 D-11, review WR-02
 * fold-in). The crop screen's decode-fallback downscale and the Profile
 * background crop render a native image and save it to the manipulator cache.
 * Both the rendered `ImageRef` and the manipulator context that produced it are
 * released exactly once, in a `finally`, on success and on failure, so working
 * memory stays flat (the `master-encode.ts` pattern).
 *
 * `expo-image-manipulator` is imported lazily so this module stays node-testable.
 */
import type * as ExpoImageManipulator from "expo-image-manipulator";
import type { PrepareProfileBackgroundArgs } from "./background-pipeline";
import { discardDerivative } from "./derivative-cache";

/** JPEG quality of the crop screen's decode-fallback preview copy. */
export const PREVIEW_DOWNSCALE_QUALITY = 0.9;
/** JPEG quality of the Profile background derivative. */
export const BACKGROUND_DERIVATIVE_QUALITY = 0.82;

type Manipulator = typeof ExpoImageManipulator;
type ManipulatorContext = ReturnType<
  Manipulator["ImageManipulator"]["manipulate"]
>;
type RenderedRef = Awaited<ReturnType<ManipulatorContext["renderAsync"]>>;

/**
 * Release a native `SharedObject` (a rendered ref or its context). A release
 * failure never masks the result or the original error. The chainable
 * `crop`/`resize` calls return the same native context, so releasing the one
 * `manipulate()` returned covers the chain.
 */
function releaseQuietly(ref: RenderedRef | ManipulatorContext | null): void {
  if (!ref) return;
  try {
    ref.release();
  } catch {
    // Never mask the derivative result or its error.
  }
}

/**
 * Downscale `sourceUri` to `maxEdge` px wide and save a JPEG preview copy;
 * returns the manipulator cache URI (the caller discards it).
 */
export async function renderPreviewDownscale(
  sourceUri: string,
  maxEdge: number,
): Promise<string> {
  const mod = (await import("expo-image-manipulator")) as Manipulator;
  let context: ManipulatorContext | null = null;
  let rendered: RenderedRef | null = null;
  try {
    context = mod.ImageManipulator.manipulate(sourceUri);
    rendered = await context.resize({ width: maxEdge }).renderAsync();
    const saved = await rendered.saveAsync({
      format: mod.SaveFormat.JPEG,
      compress: PREVIEW_DOWNSCALE_QUALITY,
    });
    return saved.uri;
  } finally {
    releaseQuietly(rendered);
    releaseQuietly(context);
  }
}

/**
 * The Profile background adapter (`PrepareProfileBackgroundArgs.cropAndResize`):
 * crop, resize and one JPEG encode. The native image is freed as soon as the
 * file is saved; the returned `release()` only discards the cache file, which
 * `prepareProfileBackground` calls after persist.
 */
export const renderBackgroundDerivative: PrepareProfileBackgroundArgs["cropAndResize"] =
  async ({ rawUri, crop, output }) => {
    const mod = (await import("expo-image-manipulator")) as Manipulator;
    let context: ManipulatorContext | null = null;
    let rendered: RenderedRef | null = null;
    try {
      context = mod.ImageManipulator.manipulate(rawUri);
      rendered = await context.crop(crop).resize(output).renderAsync();
      const saved = await rendered.saveAsync({
        format: mod.SaveFormat.JPEG,
        compress: BACKGROUND_DERIVATIVE_QUALITY,
      });
      return {
        uri: saved.uri,
        release: () => {
          discardDerivative(saved.uri);
        },
      };
    } finally {
      releaseQuietly(rendered);
      releaseQuietly(context);
    }
  };
