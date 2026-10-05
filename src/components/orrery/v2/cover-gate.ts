/**
 * 38.7-15: when may the opaque canvas's first-frame cover lift?
 *
 * WHY: the cover (the theme's sky colour over the SurfaceView) used to lift
 * on proxy signals — the surface reported a size, the first-frame state
 * ended, two UI frames passed. None of them says the canvas is SHOWING its
 * content: the full scene's first frame can sit in the GPU for ~0.4 s
 * (DEBUG cold open: shader programs compiling on first use), and on a warm
 * return the scene's specs can arrive late (the JS thread busy with the
 * reload) — so the cover lifted onto a near-black canvas (cold open
 * ~0.42 s; All Contacts warm return ~1.8 s, 1 in 3).
 *
 * WHAT: the cover waits for a real signal. Once the canvas has RECORDED its
 * content (the first-frame state over, the body specs published), the
 * canvas arms the native "presented" probe with a fresh token (patched
 * Skia 2.6.2: the SurfaceView answers once that frame was drawn, its GPU
 * work finished and SurfaceFlinger COMPOSITED it on the display) and the
 * cover lifts on the answer carrying that token.
 *
 * 38.7-15 round 3 (cold open: "presented", then ~0.3 s of black on the
 * process's first surface): a copy of the newest queued buffer did not prove
 * the display showed it. The native probe now also requires a non-black
 * buffer and composite evidence — API 34+ SurfaceFlinger's trusted-
 * presentation callback on the SurfaceView's layer, API 29–33 the window's
 * next frame commit — answering "presented"; without that evidence within
 * its bound it answers "unlatched" (lifted at once, reason
 * "presented-unconfirmed", so the device logs tell them apart).
 * Bounded, so it can never stick:
 * COVER_PRESENT_TIMEOUT_MS after arming, and COVER_HARD_MAX_MS after the
 * canvas mounted, it lifts whatever happened (a binary without the patch,
 * a probe that could not tell, a scene whose specs never come).
 *
 * Pure (timers injected): node-testable; no Skia, no React.
 */

/**
 * After arming: lift without an answer (ms). Generous on purpose: a heavy
 * first content frame (shader compiles, photo texture uploads) can take
 * well over a second to present, and lifting early shows the canvas before
 * it; the native probe itself gives up after 4 s ("timeout").
 */
export const COVER_PRESENT_TIMEOUT_MS = 3000;
/** After the canvas mounted: always lift (ms). */
export const COVER_HARD_MAX_MS = 6000;

export type CoverLiftReason =
  | "presented"
  /** The content frame was drawn and copied; its composite was not confirmed. */
  | "presented-unconfirmed"
  | "probe-failed"
  | "present-timeout"
  | "cap";

export interface CoverGateDeps {
  /** Arms the native probe for `token` (the canvas ref's armPresentProbe). */
  arm: (token: number) => void;
  /** Lifts the cover (called at most once). */
  lift: (reason: CoverLiftReason) => void;
  /** A fresh token, unique across canvases. */
  nextToken: () => number;
  setTimeout?: (run: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
}

export interface CoverGate {
  /** The canvas recorded its content: arm the probe (once). */
  contentReady(): void;
  /** The native answer for `token` ("presented", or why it could not tell). */
  presented(token: number, outcome: string): void;
  /** The canvas unmounted: no timer runs and nothing lifts any more. */
  dispose(): void;
}

let lastToken = 0;
/** A token unique across canvases in this JS runtime (positive int32). */
export function nextPresentToken(): number {
  lastToken = lastToken >= 2_000_000_000 ? 1 : lastToken + 1;
  return lastToken;
}

/** Starts the gate at canvas mount (the hard cap runs from here). */
export function createCoverGate(deps: CoverGateDeps): CoverGate {
  const arm = deps.setTimeout ?? ((run, ms) => setTimeout(run, ms));
  const disarm =
    deps.clearTimeout ??
    ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let done = false;
  let token: number | null = null;
  let presentTimer: unknown = null;
  let capTimer: unknown = null;
  const clear = () => {
    if (presentTimer !== null) disarm(presentTimer);
    if (capTimer !== null) disarm(capTimer);
    presentTimer = null;
    capTimer = null;
  };
  const finish = (reason: CoverLiftReason) => {
    if (done) return;
    done = true;
    clear();
    deps.lift(reason);
  };
  capTimer = arm(() => {
    capTimer = null;
    finish("cap");
  }, COVER_HARD_MAX_MS);
  return {
    contentReady() {
      if (done || token !== null) return;
      token = deps.nextToken();
      presentTimer = arm(() => {
        presentTimer = null;
        finish("present-timeout");
      }, COVER_PRESENT_TIMEOUT_MS);
      deps.arm(token);
    },
    presented(answered, outcome) {
      if (done || token === null || answered !== token) return;
      finish(
        outcome === "presented"
          ? "presented"
          : outcome === "unlatched"
            ? "presented-unconfirmed"
            : "probe-failed",
      );
    },
    dispose() {
      done = true;
      clear();
    },
  };
}
