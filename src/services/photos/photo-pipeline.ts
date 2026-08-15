/**
 * Photo pipeline orchestration (PHOTO-01 + PHOTO-03) — the single engine every
 * capture path (library pick, pasted-URL download) reuses to turn a raw source
 * image + a source-pixel crop rect into the ONE 512×512 JPEG master.
 *
 * The pixel crop runs through `expo-image-manipulator` on the ORIGINAL `rawUri`
 * at full fidelity — NEVER a Skia `makeImageSnapshot()` (that rasterizes at lossy
 * screen resolution; 05-RESEARCH Anti-Patterns). The manipulator writes to
 * EVICTABLE cache, so its output is immediately copied out into the persistent
 * document dir via `photo-storage.persistMaster` (T-05-05: cache eviction would
 * otherwise silently lose avatars), and only the RELATIVE path it returns is
 * handed back — never the cache/absolute URI (05-RESEARCH Pitfalls 1 & 3).
 *
 * `persistMaster` is Plan 02's crash-safe copy-to-`.tmp` → move-prior-to-`.bak` →
 * move-`.tmp`-into-place swap; it NEVER pre-deletes the destination, so neither a
 * failed copy nor a crash can destroy the prior master. This pipeline calls it
 * UNCHANGED and inherits that safety — it must add NO destination delete/pre-delete
 * of its own (addresses review [codex/HIGH→MED 05-04 replacement order + cycle-2
 * HIGH atomicity]).
 *
 * DB-DECOUPLED BY DESIGN: this pipeline imports no DAO and performs no DB write.
 * It returns the relative path; the CALLER persists it per target kind (contact
 * and profile write immediately; a custom-field defers to the form save). That
 * keeps the DAO write — and thus the inline old-file delete on replace — at the
 * call site, out of this service.
 */
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Logger } from "@/utils/logger";
import type { CropRect } from "./crop-geometry";
import {
  type PhotoTargetDescriptor,
  persistMaster,
  relPathForTarget,
} from "./photo-storage";

const LOG_SCOPE = "photo-pipeline";

/** The one master's edge length, in px (05-RESEARCH: one 512×512 JPEG master). */
const MASTER_SIZE = 512;

/** JPEG quality for the master (~30-60 KB at 512px; 05-RESEARCH q≈0.75). */
const MASTER_COMPRESS = 0.75;

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
  /** The ORIGINAL source URI (library-cache or downloaded-cache) to crop. */
  rawUri: string;
  /** The source-pixel crop rectangle from `crop-geometry.cropRectFromTransform`. */
  cropRect: CropRect;
  /** Which record this master belongs to (drives the derivable relative path). */
  target: PhotoTargetDescriptor;
}

/**
 * Crop the ORIGINAL `rawUri` to `cropRect`, resize to 512×512, JPEG-encode at
 * ~0.75, copy the (evictable-cache) result out into the document dir via the
 * crash-safe `persistMaster`, and return the RELATIVE path the DB stores.
 *
 * Throws {@link PhotoPipelineError} on a decode/manipulate/encode failure (caller
 * surfaces the SPEC copy). Storage failures from `persistMaster` propagate as-is;
 * the prior master remains intact/recoverable because `persistMaster` never
 * pre-deletes it.
 */
export async function persistCroppedMaster({
  rawUri,
  cropRect,
  target,
}: PersistCroppedMasterArgs): Promise<string> {
  let out: { uri: string };
  try {
    // Chainable context API (SDK 52+): manipulate → crop → resize → renderAsync,
    // then saveAsync on the rendered ImageRef. NOT the deprecated manipulateAsync.
    const rendered = await ImageManipulator.manipulate(rawUri)
      .crop(cropRect)
      .resize({ width: MASTER_SIZE, height: MASTER_SIZE })
      .renderAsync();
    out = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: MASTER_COMPRESS,
    });
  } catch (error) {
    Logger.error(LOG_SCOPE, `manipulate/encode failed for ${rawUri}`, error);
    throw new PhotoPipelineError("That image couldn't be used.", {
      cause: error,
    });
  }

  // Copy out of evictable cache into the document dir (crash-safe .bak swap) and
  // return ONLY the relative path — never the manipulator's cache/absolute URI.
  const relative = relPathForTarget(target);
  await persistMaster(out.uri, relative);
  return relative;
}
