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
 *
 * 38.7-08 spike seams (never in a normal release bundle):
 * - DEBUG: `src/__dev__/orrery-host-override.ts`, flipped from the dev menu,
 *   reached only through `__DEV__ ? require(…) : null` (release guard test).
 * - RELEASE spike build (D-59): `spike-host-selector.ts`, compiled in only
 *   when the bundle is built with the spike flag below set to 1 (Expo inlines
 *   the variable; Metro folds the branch away otherwise). It selects variants
 *   from a spike deep link (see that module).
 * The host is read once per canvas mount, so a changed selection applies
 * when the Orrery canvas remounts (leave and re-enter the tab).
 */
import { PixelRatio, Platform } from "react-native";

export type OrreryRenderPlatform = "android" | "ios" | "web" | "other";

export interface OrreryRenderHost {
  platform: OrreryRenderPlatform;
  /** `<Canvas opaque>`: a SurfaceView on Android (Pitfalls 5, 12); no-op elsewhere. */
  opaqueCanvas: boolean;
  /** How the quantised ambient tick is driven (ambient-clock.ts, D-49). */
  ambientDriver: "frame-clock" | "interval";
  /** How the still base is baked (base-bake.ts, D-49); "none" draws it live. */
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

/** The host values a spike or dev override may change. */
export type OrreryHostOverride = Partial<
  Pick<
    OrreryRenderHost,
    | "opaqueCanvas"
    | "ambientDriver"
    | "bakePath"
    | "ringMethod"
    | "ringFieldMinRings"
  >
>;

/** Hybrid threshold placeholder until Plan 08 measures it. */
const DEFAULT_RING_FIELD_MIN_RINGS = 400;

interface DevHostOverrideModule {
  orreryHostOverride(): OrreryHostOverride;
}
interface SpikeHostSelectorModule {
  ensureOrrerySpikeListening(): void;
  orrerySpikeOverride(): OrreryHostOverride;
  reportOrrerySpikeHost(host: OrreryRenderHost, source: string): void;
}

// DEBUG only: Metro folds this to null in a release bundle.
const devHostOverride: DevHostOverrideModule | null =
  typeof __DEV__ !== "undefined" && __DEV__
    ? require("@/__dev__/orrery-host-override")
    : null;

// D-59 release spike only: Expo inlines the variable at bundle time, so a
// normal build folds this to null and carries none of the selector.
const spikeSelector: SpikeHostSelectorModule | null =
  process.env.EXPO_PUBLIC_ORRERY_SPIKE === "1"
    ? require("./spike-host-selector")
    : null;
spikeSelector?.ensureOrrerySpikeListening();

function deviceRatio(): number {
  const ratio = PixelRatio?.get?.();
  return typeof ratio === "number" && Number.isFinite(ratio) && ratio >= 1
    ? ratio
    : 1;
}

function platformOf(os: string | undefined): OrreryRenderPlatform {
  return os === "android" || os === "ios" || os === "web" ? os : "other";
}

/** The code defaults for `platform`, before any spike or dev override. */
export function defaultOrreryRenderHost(
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

/** `host` with only the known override keys applied (later wins). */
export function applyOrreryHostOverride(
  host: OrreryRenderHost,
  override: OrreryHostOverride | null | undefined,
): OrreryRenderHost {
  if (!override) return host;
  const next = { ...host };
  if (override.opaqueCanvas !== undefined)
    next.opaqueCanvas = override.opaqueCanvas;
  if (override.ambientDriver !== undefined)
    next.ambientDriver = override.ambientDriver;
  if (override.bakePath !== undefined) next.bakePath = override.bakePath;
  if (override.ringMethod !== undefined) next.ringMethod = override.ringMethod;
  if (override.ringFieldMinRings !== undefined)
    next.ringFieldMinRings = override.ringFieldMinRings;
  return next;
}

/** One log-friendly line for the measurement tools: `opaque=on,driver=…`. */
export function describeOrreryHost(
  host: Pick<
    OrreryRenderHost,
    | "opaqueCanvas"
    | "ambientDriver"
    | "bakePath"
    | "ringMethod"
    | "ringFieldMinRings"
  >,
): string {
  return [
    `opaque=${host.opaqueCanvas ? "on" : "off"}`,
    `driver=${host.ambientDriver}`,
    `bake=${host.bakePath === "gpu-offscreen" ? "on" : host.bakePath === "none" ? "off" : host.bakePath}`,
    `ring=${host.ringMethod}`,
    `minRings=${host.ringFieldMinRings}`,
  ].join(",");
}

/**
 * The render host for `platform` (defaults to the running platform): the
 * code defaults, then (DEBUG) the dev-menu override, then (spike build only)
 * the URL-selected variant. Called once per canvas mount.
 */
export function resolveOrreryRenderHost(
  platform: string | undefined = Platform?.OS,
): OrreryRenderHost {
  let host = defaultOrreryRenderHost(platform);
  if (devHostOverride)
    host = applyOrreryHostOverride(host, devHostOverride.orreryHostOverride());
  if (spikeSelector) {
    host = applyOrreryHostOverride(host, spikeSelector.orrerySpikeOverride());
    spikeSelector.reportOrrerySpikeHost(host, "mount");
  }
  return host;
}
