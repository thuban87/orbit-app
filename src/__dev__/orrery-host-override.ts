/**
 * 38.7-08 (D-44/D-49 spike, DEBUG only): a mutable render-host override the
 * dev menu flips ("Orrery spike: …" items in uat-probes.ts) so the DEBUG
 * screening pass can compare the opaque canvas, the ambient drivers and the
 * base bake without a rebuild. Read by `resolveOrreryRenderHost()` only
 * through `__DEV__ ? require(…) : null`, so it never reaches a release bundle
 * (src/theme/dev-override-release-guard.test.ts). The host is read once per
 * canvas mount: leave and re-enter the Orrery tab after a flip.
 *
 * DEBUG numbers are screening only (D-59); decisions use the release spike.
 */
import type { OrreryHostOverride } from "@/components/orrery/v2/render-host";

let override: OrreryHostOverride = {};

/** The current dev override (a copy). */
export function orreryHostOverride(): OrreryHostOverride {
  return { ...override };
}

/** Merges `patch` into the dev override (undefined keys are cleared). */
export function setOrreryHostOverride(patch: OrreryHostOverride): void {
  const next: OrreryHostOverride = { ...override, ...patch };
  for (const key of Object.keys(next) as (keyof OrreryHostOverride)[])
    if (next[key] === undefined) delete next[key];
  override = next;
}

/** Clears every dev override (back to the code defaults). */
export function clearOrreryHostOverride(): void {
  override = {};
}
