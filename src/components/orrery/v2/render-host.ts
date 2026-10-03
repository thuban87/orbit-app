/**
 * 38.7-06 (D-46/D-42): the Orrery render host — the ONE place that owns the
 * Android-only and GPU-specific rendering choices. Everything platform- or
 * GPU-dependent is a capability VALUE read from here, never a structural fork
 * in the renderer: the opaque (SurfaceView) canvas, the ambient driver, the
 * offscreen-bake path, the tilted-ring method, the Mali workarounds and the
 * device-pixel-ratio source.
 *
 * Android is the only built target (D-34/D-42: iOS and web are out of scope),
 * but their values are defined so a later port is a value change, not a
 * rewrite: the opaque flag is a no-op there, and web bakes through a raster
 * path. Plan 08's spike decides the Android `opaqueCanvas`, `ambientDriver`,
 * `bakePath` and `ringMethod` defaults on release numbers (D-59).
 */
import { PixelRatio, Platform } from "react-native";

export type OrreryRenderPlatform = "android" | "ios" | "web" | "other";

export interface OrreryRenderHost {
  platform: OrreryRenderPlatform;
  /** `<Canvas opaque>`: a SurfaceView on Android (Pitfalls 5, 12); no-op elsewhere. */
  opaqueCanvas: boolean;
  /** How the ambient tick is driven (Plan 08 adds the interval driver). */
  ambientDriver: "frame-clock" | "interval";
  /** How the still base is baked (Plan 08); "none" draws it live. */
  bakePath: "gpu-offscreen" | "raster" | "none";
  /** D-44: the tilted-ring method (the spike may pick the fallback/hybrid). */
  ringMethod: "world-plane" | "ring-field" | "hybrid";
  /** Hybrid only: the ring count at and above which the ring field is used. */
  ringFieldMinRings: number;
  /**
   * Mali (DEAD-ENDS): strokes, dashes and ovals under a perspective matrix are
   * a GPU cliff, so they are never used; the nebula is baked on the CPU.
   */
  mali: { strokeUnderPerspective: false; cpuBakedNebula: true };
  /** Device pixels per dp (the AA feather is one device pixel). */
  devicePixelRatio(): number;
}

/** Hybrid threshold placeholder until Plan 08 measures it. */
const DEFAULT_RING_FIELD_MIN_RINGS = 400;

function deviceRatio(): number {
  const ratio = PixelRatio?.get?.();
  return typeof ratio === "number" && Number.isFinite(ratio) && ratio >= 1
    ? ratio
    : 1;
}

function platformOf(os: string | undefined): OrreryRenderPlatform {
  return os === "android" || os === "ios" || os === "web" ? os : "other";
}

/** The render host for `platform` (defaults to the running platform). */
export function resolveOrreryRenderHost(
  platform: string | undefined = Platform?.OS,
): OrreryRenderHost {
  const resolved = platformOf(platform);
  return {
    platform: resolved,
    // Today's TextureView on every platform; the spike decides Android.
    opaqueCanvas: false,
    ambientDriver: "frame-clock",
    bakePath: resolved === "web" ? "raster" : "none",
    ringMethod: "world-plane",
    ringFieldMinRings: DEFAULT_RING_FIELD_MIN_RINGS,
    mali: { strokeUnderPerspective: false, cpuBakedNebula: true },
    devicePixelRatio: deviceRatio,
  };
}
