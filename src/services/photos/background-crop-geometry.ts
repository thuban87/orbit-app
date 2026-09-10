/**
 * Pure source-pixel geometry for the Profile background crop workflow. The UI
 * renders this selection at a contained display scale, while persistence sends
 * this exact clamped rectangle to the image manipulator.
 */

export interface BackgroundCropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface BackgroundCropSource {
  width: number;
  height: number;
}

export interface BackgroundCropPoint {
  x: number;
  y: number;
}

const MIN_SELECTION_EDGE = 1;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

function safeSource(source: BackgroundCropSource): BackgroundCropSource {
  return {
    width: Math.max(MIN_SELECTION_EDGE, source.width),
    height: Math.max(MIN_SELECTION_EDGE, source.height),
  };
}

function safeAspect(aspect: number): number {
  return Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
}

function largestContainedSize(
  source: BackgroundCropSource,
  aspect: number,
): { width: number; height: number } {
  const normalizedSource = safeSource(source);
  const normalizedAspect = safeAspect(aspect);
  const widthFromHeight = normalizedSource.height * normalizedAspect;
  if (widthFromHeight <= normalizedSource.width) {
    return { width: widthFromHeight, height: normalizedSource.height };
  }
  return {
    width: normalizedSource.width,
    height: normalizedSource.width / normalizedAspect,
  };
}

/** Creates the largest Profile-aspect crop rectangle that fits in the source. */
export function createInitialBackgroundCropSelection(
  source: BackgroundCropSource,
  aspect: number,
): BackgroundCropRect {
  const normalizedSource = safeSource(source);
  const size = largestContainedSize(normalizedSource, aspect);
  return {
    originX: (normalizedSource.width - size.width) / 2,
    originY: (normalizedSource.height - size.height) / 2,
    ...size,
  };
}

/**
 * Normalizes a source rectangle to the requested aspect and clamps it wholly
 * inside the decoded source. The selection never gains pixels beyond source.
 */
export function clampBackgroundCropSelection(
  selection: BackgroundCropRect,
  source: BackgroundCropSource,
  aspect: number,
): BackgroundCropRect {
  const normalizedSource = safeSource(source);
  const normalizedAspect = safeAspect(aspect);
  const maximum = largestContainedSize(normalizedSource, normalizedAspect);
  const proposedWidth = Number.isFinite(selection.width)
    ? Math.max(MIN_SELECTION_EDGE, selection.width)
    : maximum.width;
  const width = Math.min(maximum.width, proposedWidth);
  const height = width / normalizedAspect;
  const originX = clamp(
    Number.isFinite(selection.originX) ? selection.originX : 0,
    0,
    normalizedSource.width - width,
  );
  const originY = clamp(
    Number.isFinite(selection.originY) ? selection.originY : 0,
    0,
    normalizedSource.height - height,
  );
  return { originX, originY, width, height };
}

/** Moves a selection in source pixels without changing its dimensions. */
export function translateBackgroundCropSelection(
  selection: BackgroundCropRect,
  source: BackgroundCropSource,
  deltaX: number,
  deltaY: number,
): BackgroundCropRect {
  const aspect = selection.width / selection.height;
  return clampBackgroundCropSelection(
    {
      ...selection,
      originX: selection.originX + (Number.isFinite(deltaX) ? deltaX : 0),
      originY: selection.originY + (Number.isFinite(deltaY) ? deltaY : 0),
    },
    source,
    aspect,
  );
}

/**
 * Resizes around a focal source point. A scale above one zooms in (shrinks the
 * selected source rectangle); below one zooms out, constrained to source bounds.
 */
export function pinchResizeBackgroundCropSelection(
  selection: BackgroundCropRect,
  source: BackgroundCropSource,
  aspect: number,
  focal: BackgroundCropPoint,
  pinchScale: number,
): BackgroundCropRect {
  const normalized = clampBackgroundCropSelection(selection, source, aspect);
  const scale = Number.isFinite(pinchScale) && pinchScale > 0 ? pinchScale : 1;
  const width = normalized.width / scale;
  const height = width / safeAspect(aspect);
  const focalX = Number.isFinite(focal.x) ? focal.x : normalized.originX + normalized.width / 2;
  const focalY = Number.isFinite(focal.y) ? focal.y : normalized.originY + normalized.height / 2;
  const xRatio = (focalX - normalized.originX) / normalized.width;
  const yRatio = (focalY - normalized.originY) / normalized.height;
  return clampBackgroundCropSelection(
    {
      originX: focalX - width * xRatio,
      originY: focalY - height * yRatio,
      width,
      height,
    },
    source,
    aspect,
  );
}

/** Formats the selection as a short non-gesture status announcement. */
export function describeBackgroundCropSelection(
  selection: BackgroundCropRect,
  source: BackgroundCropSource,
): string {
  const normalizedSource = safeSource(source);
  const percent = Math.round((selection.width / normalizedSource.width) * 100);
  const horizontal =
    selection.originX <= 0
      ? "left"
      : selection.originX + selection.width >= normalizedSource.width
        ? "right"
        : "center";
  const vertical =
    selection.originY <= 0
      ? "top"
      : selection.originY + selection.height >= normalizedSource.height
        ? "bottom"
        : "center";
  return `Crop uses ${percent}% of the image, aligned ${vertical} ${horizontal}.`;
}
