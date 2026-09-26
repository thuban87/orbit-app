/**
 * Debug-only UAT fault registry (38.3; RG-023 / RG-026 device expectations).
 *
 * Lets a dev-menu probe (`src/__dev__/uat-probes.ts`) arm a ONE-SHOT delayed or
 * rejected read at a named production call site, so Plan 16 can prove on the
 * Pixel that a stale/failed read never publishes over a newer one. Mirrors the
 * inert-in-release precedent `__armUatSweepFault` in `launch-sweep.ts`:
 * `armUatFault` does nothing unless `__DEV__ === true`, so a release build can
 * never arm a fault and `applyUatFault` always resolves immediately there.
 *
 * This module injects nothing on its own — later plans add the call sites
 * (Plan 05: assist queue refresh; Plan 15: Digest day read). The delay is a
 * bounded one-shot wait inside a dev-armed read, not a freshness timer (D-22).
 */
export const UAT_FAULT_NAMES = [
  "digest-day-read",
  "assist-queue-refresh",
] as const;

export type UatFaultName = (typeof UAT_FAULT_NAMES)[number];

export type UatFault = { mode: "reject" } | { mode: "delay"; ms: number };

const armed = new Map<UatFaultName, UatFault>();

function isDevBuild(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__ === true;
}

/** Debug builds only: arm a one-shot fault for the next `applyUatFault(name)`. */
export function armUatFault(name: UatFaultName, fault: UatFault): void {
  if (!isDevBuild()) return;
  armed.set(name, fault);
}

/**
 * Apply (and consume) the armed fault for `name`: `delay` waits then disarms,
 * `reject` disarms then throws. Unarmed — or any non-dev build — resolves
 * immediately.
 */
export async function applyUatFault(name: UatFaultName): Promise<void> {
  if (!isDevBuild()) return;
  const fault = armed.get(name);
  if (!fault) return;
  armed.delete(name);
  if (fault.mode === "reject") throw new Error("uat injected fault");
  const { ms } = fault;
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Test-only: disarm everything. */
export function __resetUatFaultsForTest(): void {
  armed.clear();
}
