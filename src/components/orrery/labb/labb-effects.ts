/**
 * ORRERY LAB B — SkSL sources and the lazy runtime-effect loader.
 *
 * Rules (research 03 §0.2 / §2.5, AGENT-RULES):
 * - NO `Skia.RuntimeEffect.Make` at import time. `orrery-scene.test.ts` mocks
 *   Skia as `{}` and imports this module through `OrreryWorld`; every compile
 *   happens lazily inside `getLabEffect`, wrapped in `try`, memoised in a
 *   module-level Map after the first attempt (success OR null).
 * - `Make` returns null on an SkSL/driver failure: every consumer renders its
 *   plain fallback when `getLabEffect` returns null.
 * - SkSL contains NO colour constants and no `#define`: colours arrive only as
 *   uniforms fed from theme tokens (`labb-uniforms.ts`). Time is wrapped
 *   (`% 1000 s`) by the caller; coordinates/hashes stay `float`.
 * - `forceFallback` (panel toggle) makes every getter return null so the
 *   fallback path can be compared on device.
 *
 * Adding an effect (WP-1.1+): add its source to `LAB_EFFECT_SOURCES`; if it is
 * transition-only, also list it in `WARMUP_EFFECTS` so `LabCanvas` compiles it
 * at Orrery entry instead of at the first System switch.
 */
import { Skia, type SkRuntimeEffect } from "@shopify/react-native-skia";

export const LAB_EFFECT_SOURCES = {
  /**
   * Pipeline probe: a flat uniform colour. Proves the compile / uniform /
   * warm-up path on device before real effects land (WP-1.1+).
   */
  probe: `
uniform half4 uColor;
half4 main(float2 xy) {
  return uColor;
}
`,
} as const;

export type LabEffectName = keyof typeof LAB_EFFECT_SOURCES;

/** Effects drawn invisibly at mount so the GL program compile happens early. */
export const WARMUP_EFFECTS: readonly LabEffectName[] = ["probe"];

export type LabEffectStatus = "ok" | "null" | "error" | "pending";

const cache = new Map<LabEffectName, SkRuntimeEffect | null>();
const status = new Map<LabEffectName, LabEffectStatus>();
let forceFallback = false;
const warned = new Set<LabEffectName>();

/** Panel toggle: when true every getter returns null (fallback A/B). */
export function setLabEffectForceFallback(value: boolean): void {
  forceFallback = value;
}

/**
 * Lazily compile (once) and return the effect, or null on failure / forced
 * fallback. Never throws. Safe to call during React render (JS thread).
 */
export function getLabEffect(name: LabEffectName): SkRuntimeEffect | null {
  if (forceFallback) return null;
  if (cache.has(name)) return cache.get(name) ?? null;
  let effect: SkRuntimeEffect | null = null;
  try {
    effect = Skia?.RuntimeEffect?.Make?.(LAB_EFFECT_SOURCES[name]) ?? null;
    status.set(name, effect ? "ok" : "null");
  } catch {
    effect = null;
    status.set(name, "error");
  }
  cache.set(name, effect);
  if (
    !effect &&
    !warned.has(name) &&
    typeof __DEV__ !== "undefined" &&
    __DEV__
  ) {
    warned.add(name);
    console.warn(
      `[lab-b] runtime effect "${name}" unavailable; using fallback`,
    );
  }
  return effect;
}

/** Per-effect compile status for the debug panel ("pending" = never asked). */
export function labEffectStatuses(): Record<LabEffectName, LabEffectStatus> {
  return Object.fromEntries(
    (Object.keys(LAB_EFFECT_SOURCES) as LabEffectName[]).map((name) => [
      name,
      status.get(name) ?? "pending",
    ]),
  ) as Record<LabEffectName, LabEffectStatus>;
}

/** Test hook: forget every cached compile. */
export function resetLabEffectsForTest(): void {
  cache.clear();
  status.clear();
  warned.clear();
  forceFallback = false;
}
