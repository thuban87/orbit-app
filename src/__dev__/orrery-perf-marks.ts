/**
 * 38.7-15 (D-56 / D-76, DEBUG only): Orrery timing marks for the device pass.
 *
 * Two clocks:
 *   - "focus": a tab focus starts it (`beginFocus`); `mark(name)` logs
 *     `orrery-perf <name> <ms since focus>` — the tab-return decomposition
 *     (focus, hydrated, warm-pose, canvas-mount, first-recorded, reloaded,
 *     session-ready);
 *   - "switch": a System tap starts it (`beginSwitch`); `markSwitch(name)`
 *     logs `orrery-perf switch:<name> <ms since tap>` — where the switch wait
 *     goes (tap, lead-in, load-done, publish, settled).
 *
 * Lines go through `console.log`, so they land in `adb logcat -s ReactNativeJS`
 * or the Metro pane (check both, by delta). App code reaches this module only
 * through `__DEV__ ? require(…) : null` (src/theme/dev-override-release-guard
 * .test.ts), so it never reaches a release bundle. DEBUG numbers are context
 * only; Plan 16's release build measures.
 */

function now(): number {
  const perf = (globalThis as { performance?: { now?: () => number } })
    .performance;
  return typeof perf?.now === "function" ? perf.now() : Date.now();
}

let focusAt: number | null = null;
let switchAt: number | null = null;
const once = new Set<string>();

function log(line: string): void {
  console.log(line);
}

/** A tab focus: restarts the focus clock and logs `focus 0`. */
export function beginFocus(): void {
  focusAt = now();
  once.clear();
  log("orrery-perf focus 0");
}

/** `orrery-perf <name> <ms since focus>` (nothing before the first focus). */
export function mark(name: string): void {
  if (focusAt === null) return;
  log(`orrery-perf ${name} ${Math.round(now() - focusAt)}`);
}

/** Like `mark`, at most once per focus (e.g. the first recorded generation). */
export function markOnce(name: string): void {
  if (once.has(name)) return;
  once.add(name);
  mark(name);
}

/** A System tap: restarts the switch clock and logs `switch:tap 0`. */
export function beginSwitch(): void {
  switchAt = now();
  log("orrery-perf switch:tap 0");
}

/** `orrery-perf switch:<name> <ms since the tap>`. */
export function markSwitch(name: string): void {
  if (switchAt === null) return;
  log(`orrery-perf switch:${name} ${Math.round(now() - switchAt)}`);
}
