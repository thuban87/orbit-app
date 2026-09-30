/**
 * Photo pipeline orchestration (PHOTO-01 + PHOTO-03) — the single engine every
 * capture path (library pick, pasted-URL download) reuses to turn a raw source
 * image + a source-pixel crop rect into the ONE master: one square WebP master
 * up to 1024 px (D-10), stored under the identity-derived `.jpg` name (D-21).
 * Encoding lives in `master-encode.ts` (`encodeMaster`), shared with import,
 * import retry and reconcile.
 *
 * The pixel crop runs through `expo-image-manipulator` on the ORIGINAL `rawUri`
 * at full fidelity — NEVER a Skia `makeImageSnapshot()` (that rasterizes at lossy
 * screen resolution; 05-RESEARCH Anti-Patterns). The manipulator writes to
 * EVICTABLE cache, so its output is immediately copied out into the persistent
 * document dir via `persistOwnedMaster` (T-05-05: cache eviction would
 * otherwise silently lose avatars), and only the RELATIVE path it returns is
 * handed back — never the cache/absolute URI (05-RESEARCH Pitfalls 1 & 3).
 *
 * `persistMaster` is Plan 02's crash-safe copy-to-`.tmp` → move-prior-to-`.bak` →
 * move-`.tmp`-into-place swap; it NEVER pre-deletes the destination, so neither a
 * failed copy nor a crash can destroy the prior master. The owner settles older
 * journal work before calling that swap; the pipeline adds NO destination pre-delete
 * of its own (addresses review [codex/HIGH→MED 05-04 replacement order + cycle-2
 * HIGH atomicity]).
 *
 * The pipeline takes the caller's executor for ownership settlement but does
 * not publish a photo reference. Contact/profile publication remains at the
 * call site; custom-field values still wait for the form Save.
 */
import type { SqlExecutor } from "@/db/types";
import { Logger } from "@/utils/logger";
import type { CropRect } from "./crop-geometry";
import { discardDerivative } from "./derivative-cache";
import { encodeMaster } from "./master-encode";
import {
  type CanonicalLockToken,
  type OwnedWriteOptions,
  persistOwnedMaster,
  persistOwnedMasterLocked,
} from "./owned-master";
import { type PhotoTargetDescriptor, relPathForTarget } from "./photo-storage";

const LOG_SCOPE = "photo-pipeline";

/**
 * Thrown when the source image cannot be decoded/cropped/encoded. The caller
 * maps this to the 05-UI-SPEC copy ("That image couldn't be used."). The
 * original failure is attached as `cause` for logging/debugging.
 */
export class PhotoPipelineError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PhotoPipelineError";
  }
}

/** Inputs to the crop→master→persist pipeline. */
export interface PersistCroppedMasterArgs {
  exec: SqlExecutor;
  authorize?: OwnedWriteOptions["authorize"];
  lockToken?: CanonicalLockToken;
  /** The ORIGINAL source URI (library-cache or downloaded-cache) to crop. */
  rawUri: string;
  /** The source-pixel crop rectangle from `crop-geometry.cropRectFromTransform`. */
  cropRect: CropRect;
  /** Which record this master belongs to (drives the derivable relative path). */
  target: PhotoTargetDescriptor;
}

/**
 * Crop the ORIGINAL `rawUri` to `cropRect` and encode one square WebP master up
 * to 1024 px (D-10, `encodeMaster`), copy the (evictable-cache) result out into
 * the document dir under the identity-derived `.jpg` name (D-21) via the
 * crash-safe `persistMaster`, and return the RELATIVE path the DB stores.
 *
 * Throws {@link PhotoPipelineError} on a decode/manipulate/encode failure (caller
 * surfaces the SPEC copy). Storage failures from `persistMaster` propagate as-is;
 * the prior master remains intact/recoverable because `persistMaster` never
 * pre-deletes it.
 */
export async function persistCroppedMaster({
  exec,
  authorize,
  lockToken,
  rawUri,
  cropRect,
  target,
}: PersistCroppedMasterArgs): Promise<string> {
  let out: { uri: string };
  try {
    out = { uri: await encodeMaster(rawUri, cropRect) };
  } catch (error) {
    Logger.error(LOG_SCOPE, `manipulate/encode failed for ${rawUri}`, error);
    throw new PhotoPipelineError("That image couldn't be used.", {
      cause: error,
    });
  }

  // Copy out of evictable cache into the document dir (crash-safe .bak swap) and
  // return ONLY the relative path — never the manipulator's cache/absolute URI.
  const relative = relPathForTarget(target);
  try {
    if (lockToken)
      await persistOwnedMasterLocked(exec, lockToken, out.uri, relative, {
        authorize,
      });
    else await persistOwnedMaster(exec, out.uri, relative, { authorize });
  } finally {
    try {
      discardDerivative(out.uri);
    } catch {
      Logger.warn(LOG_SCOPE, "crop derivative cleanup failed");
    }
  }
  return relative;
}
