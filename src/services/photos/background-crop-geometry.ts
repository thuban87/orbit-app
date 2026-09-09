/**
 * Pure geometry for the Profile background crop workflow. Unlike identity-photo
 * cropping, the destination is the measured Profile aspect rather than a fixed
 * square. Gesture and named adjustment callers must both use these bounds.
 */

export interface BackgroundCropTransform {
  /** Measured Profile preview/output size in screen pixels. */
  destinationWidth: number;
  destinationHeight: number;
  /** Decoded source dimensions in source pixels. */
  srcWidth: number;
  srcHeight: number;
  /** Cover-scale multiplier: one is the minimum permitted scale. */
  scale: number;
  /** Centre-origin screen-pixel translations. */
  translateX: number;
  translateY: number;
}

export interface BackgroundCropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface BackgroundPanBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

function coverScale(input: BackgroundCropTransform): number {
  return Math.max(
    input.destinationWidth / input.srcWidth,
    input.destinationHeight / input.srcHeight,
  );
}

function effectiveScale(input: BackgroundCropTransform): number {
  return coverScale(input) * Math.max(1, input.scale);
}

/** Returns the only legal centre-origin pan range for a current crop scale. */
export function getBackgroundPanBounds(
  input: BackgroundCropTransform,
): BackgroundPanBounds {
  const scale = effectiveScale(input);
  const halfOverflowX = Math.max(
    0,
    (input.srcWidth * scale - input.destinationWidth) / 2,
  );
  const halfOverflowY = Math.max(
    0,
    (input.srcHeight * scale - input.destinationHeight) / 2,
  );
  return {
    minX: halfOverflowX === 0 ? 0 : -halfOverflowX,
    maxX: halfOverflowX,
    minY: halfOverflowY === 0 ? 0 : -halfOverflowY,
    maxY: halfOverflowY,
  };
}

/** Normalizes a gesture or named-control transform to the common legal bounds. */
export function clampBackgroundTransform(
  input: BackgroundCropTransform,
): BackgroundCropTransform {
  const scale = Math.max(1, input.scale);
  const bounds = getBackgroundPanBounds({ ...input, scale });
  return {
    ...input,
    scale,
    translateX: clamp(input.translateX, bounds.minX, bounds.maxX),
    translateY: clamp(input.translateY, bounds.minY, bounds.maxY),
  };
}

/**
 * Maps the currently clamped Profile preview transform to an in-bounds
 * source-pixel rectangle suitable for an image-manipulator crop operation.
 */
export function computeBackgroundCrop(
  input: BackgroundCropTransform,
): BackgroundCropRect {
  const normalized = clampBackgroundTransform(input);
  const scale = effectiveScale(normalized);
  const width = normalized.destinationWidth / scale;
  const height = normalized.destinationHeight / scale;
  const originX = clamp(
    (normalized.srcWidth - width) / 2 - normalized.translateX / scale,
    0,
    normalized.srcWidth - width,
  );
  const originY = clamp(
    (normalized.srcHeight - height) / 2 - normalized.translateY / scale,
    0,
    normalized.srcHeight - height,
  );
  return { originX, originY, width, height };
}
