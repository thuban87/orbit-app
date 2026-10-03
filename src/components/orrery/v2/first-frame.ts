/**
 * 38.7-09 (carried from 38.7-08, Pitfall 12): when has the opaque canvas's
 * native surface presented its first frame?
 *
 * The opaque canvas is an Android SurfaceView: until its surface exists and a
 * frame was drawn into it, the window shows solid black where the canvas is
 * (~0.5 s on a tab return, 38.7-SPIKE). React Native Skia exposes no "first
 * frame" event, but the native view's size stays 0 until the surface is
 * available, and Skia redraws the current picture as soon as it is. So: poll
 * `SkiaViewApi.size(nativeId)` on the JS thread (a short-lived timer, only
 * while the canvas has just mounted), then wait a couple of frames for the
 * present, then report. Bounded: it reports after COVER_MAX_MS whatever
 * happens, and immediately after COVER_FALLBACK_MS when the view API is
 * missing (tests, other runtimes).
 */

/** Poll period (ms) while waiting for the surface. */
export const COVER_POLL_MS = 16;
/** After the surface reports a size: frames to wait for the first present. */
export const COVER_SETTLE_MS = 50;
/** Never keep the cover longer than this (ms). */
export const COVER_MAX_MS = 2500;
/** Without a native view API: hide the cover after this (ms). */
export const COVER_FALLBACK_MS = 600;

type SizeOf = (nativeId: number) => { width: number; height: number } | null;

export interface FirstFrameDeps {
  /** The native view size (the Skia view API); null when unavailable. */
  size?: SizeOf | null;
  setTimeout?: (run: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
  now?: () => number;
}

function defaultSize(): SizeOf | null {
  const api = (
    globalThis as {
      SkiaViewApi?: {
        size?: (id: number) => { width: number; height: number };
      };
    }
  ).SkiaViewApi;
  if (!api || typeof api.size !== "function") return null;
  return (id) => {
    try {
      return api.size?.(id) ?? null;
    } catch {
      return null;
    }
  };
}

/**
 * Calls `onReady` once, after the canvas's native surface has a size and a
 * couple of frames passed (or at the bounds above). Returns a cancel.
 */
export function watchFirstSurfaceFrame(
  nativeId: () => number | null,
  onReady: () => void,
  deps: FirstFrameDeps = {},
): () => void {
  const size = deps.size === undefined ? defaultSize() : deps.size;
  const arm = deps.setTimeout ?? ((run, ms) => setTimeout(run, ms));
  const disarm =
    deps.clearTimeout ??
    ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const now = deps.now ?? (() => Date.now());
  const started = now();
  let timer: unknown = null;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    timer = null;
    onReady();
  };
  const poll = () => {
    timer = null;
    if (done) return;
    if (now() - started >= COVER_MAX_MS) return finish();
    const id = nativeId();
    const measured = id === null || !size ? null : size(id);
    if (measured && measured.width > 0 && measured.height > 0) {
      timer = arm(finish, COVER_SETTLE_MS);
      return;
    }
    timer = arm(poll, COVER_POLL_MS);
  };
  timer = size ? arm(poll, 0) : arm(finish, COVER_FALLBACK_MS);
  return () => {
    done = true;
    if (timer !== null) disarm(timer);
    timer = null;
  };
}
