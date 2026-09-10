/**
 * The background host fills the current Profile window. Crop previews and
 * durable derivatives share that measured aspect, while the output long edge
 * stays bounded for local storage.
 */
const MAX_PREVIEW_WIDTH = 360;
const OUTPUT_DENSITY = 3;
export const MAX_PROFILE_BACKGROUND_OUTPUT_LONG_EDGE = 2048;

export interface ProfileBackgroundTarget {
  preview: { width: number; height: number };
  output: { width: number; height: number };
}

/**
 * Fits the Profile-shaped crop canvas inside the space left after the crop
 * controls have laid out. The display size may be smaller than the durable
 * output, but both retain the exact same aspect ratio.
 */
export function fitProfileBackgroundPreview(
  viewport: { width: number; height: number },
  available: { width: number; height: number },
): { width: number; height: number } {
  const viewportWidth = Math.max(1, viewport.width);
  const viewportHeight = Math.max(1, viewport.height);
  const availableWidth = Math.max(1, available.width);
  const availableHeight = Math.max(1, available.height);
  const scale = Math.min(
    availableWidth / viewportWidth,
    availableHeight / viewportHeight,
  );

  return {
    width: viewportWidth * scale,
    height: viewportHeight * scale,
  };
}

export function profileBackgroundTarget(viewport: {
  width: number;
  height: number;
}): ProfileBackgroundTarget {
  const viewportWidth = Math.max(1, viewport.width);
  const viewportHeight = Math.max(1, viewport.height);
  const previewScale = Math.min(1, MAX_PREVIEW_WIDTH / viewportWidth);
  const previewWidth = viewportWidth * previewScale;
  const previewHeight = viewportHeight * previewScale;
  const desiredLongEdge =
    Math.max(viewportWidth, viewportHeight) * OUTPUT_DENSITY;
  const outputLongEdge = Math.min(
    MAX_PROFILE_BACKGROUND_OUTPUT_LONG_EDGE,
    Math.round(desiredLongEdge),
  );
  const outputScale = outputLongEdge / Math.max(viewportWidth, viewportHeight);

  return {
    preview: { width: previewWidth, height: previewHeight },
    output: {
      width: Math.max(1, Math.round(viewportWidth * outputScale)),
      height: Math.max(1, Math.round(viewportHeight * outputScale)),
    },
  };
}
