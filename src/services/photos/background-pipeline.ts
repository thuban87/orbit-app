import {
  type BackgroundCropRect,
  type BackgroundCropTransform,
  computeBackgroundCrop,
} from "./background-crop-geometry";

/** The screen-class derivative dimensions, derived from the actual Profile host. */
export interface BackgroundDerivativeSize {
  width: number;
  height: number;
}

export interface PreparedBackgroundResource {
  uri: string;
  /** Releases a decoded/native intermediate when the adapter allocated one. */
  release?: () => void;
}

export interface PrepareProfileBackgroundArgs {
  rawUri: string;
  transform: BackgroundCropTransform;
  output: BackgroundDerivativeSize;
  /** Native adapter: source-pixel crop, resize, and one JPEG encode. */
  cropAndResize: (input: {
    rawUri: string;
    crop: BackgroundCropRect;
    output: BackgroundDerivativeSize;
  }) => Promise<PreparedBackgroundResource>;
  /** Durable app-owned write; caller supplies the UID-derived storage target. */
  persist: (preparedUri: string) => Promise<string>;
}

export class BackgroundPipelineError extends Error {
  constructor(options?: { cause?: unknown }) {
    super("Could not prepare profile background", options);
    this.name = "BackgroundPipelineError";
  }
}

/**
 * Runs exactly one crop/resize/encode pass from the original source pixels and
 * transfers the result to durable storage. No database write is permitted here:
 * callers commit the returned relative path only after all bytes are safe.
 */
export async function prepareProfileBackground({
  rawUri,
  transform,
  output,
  cropAndResize,
  persist,
}: PrepareProfileBackgroundArgs): Promise<{
  relativePath: string;
  crop: BackgroundCropRect;
}> {
  const crop = computeBackgroundCrop(transform);
  let resource: PreparedBackgroundResource | undefined;
  try {
    resource = await cropAndResize({ rawUri, crop, output });
    const relativePath = await persist(resource.uri);
    return { relativePath, crop };
  } catch (cause) {
    throw new BackgroundPipelineError({ cause });
  } finally {
    resource?.release?.();
  }
}
