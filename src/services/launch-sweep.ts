/**
 * Launch sweep — the once-per-foreground-launch hook registry (DATA-06).
 *
 * A single entry point (`runLaunchSweep`) that runs a list of registered hooks
 * in order, exactly once per REAL foreground launch. Phase 2 ships the runner
 * and an EMPTY registry — later phases register their responsibilities on it:
 * quarantine expiry (§14), archived-purge, schedule reconcile, digest
 * re-register, and backup rotation. This phase runs no responsibilities.
 *
 * Two load-bearing rules are NEGATIVE and drive the whole design:
 *   1. Importing this module runs NOTHING — there is no module-scope side
 *      effect. A headless widget/notification tap loads the JS bundle (inside a
 *      ~30-second budget) but must never reach the sweep (Pitfall P5 / T-02-11).
 *   2. The sweep fires on cold-start and ONLY on a real `background → active`
 *      AppState transition — never on a raw `inactive → active` (a permission
 *      dialog or notification shade dismissing), and never on a background /
 *      inactive event.
 *
 * `AppState` is taken by DEPENDENCY INJECTION (`installSweepTrigger(appState)`)
 * so this module stays pure and node-testable and owns NO `react-native`
 * import — `App.tsx` owns the single react-native binding and passes `AppState`
 * in. Dormant this phase beyond the skeleton: the registry is empty, so a launch
 * runs no work yet; it must compile, typecheck, and pass its unit tests.
 */

/** A sweep responsibility: an idempotent async unit of launch-time work. */
export type SweepHook = () => Promise<void>;

/**
 * The minimal `AppState`-like surface `installSweepTrigger` depends on. Matches
 * react-native's `AppState.addEventListener("change", cb)` shape without
 * importing it, so the module is node-testable via a hand-rolled fake.
 */
export interface AppStateLike {
  addEventListener(
    type: "change",
    listener: (state: string) => void,
  ): { remove(): void };
}

// EMPTY in Phase 2 — later phases push their responsibilities here.
const hooks: SweepHook[] = [];

/** Register a hook to run on each real foreground launch (registration order). */
export function registerSweepHook(fn: SweepHook): void {
  hooks.push(fn);
}

// Module-level re-entrancy guard: keeps a single launch from double-running.
let running = false;

/**
 * Run every registered hook once, in registration order. Idempotent within a
 * launch: a re-entrant call while a run is in flight returns immediately rather
 * than double-running the hooks. The `running` flag is reset in `finally` so a
 * throwing hook never wedges the runner shut.
 */
export async function runLaunchSweep(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (const hook of hooks) {
      await hook();
    }
  } finally {
    running = false;
  }
}

/**
 * Install the foreground-launch trigger. Runs the sweep once immediately for the
 * cold-start foreground, then subscribes to AppState `change` and re-runs the
 * sweep ONLY on a real `background → active` transition — tracking the PREVIOUS
 * state (seeded to `"active"` since cold start just foregrounded). A raw
 * `inactive → active` (permission dialog / notification shade) does NOT re-fire.
 *
 * MUST be called from an effect AFTER migration resolves — never at module
 * top-level (P5). Returns the subscription remover for effect cleanup.
 */
export function installSweepTrigger(appState: AppStateLike): {
  remove(): void;
} {
  // Cold-start foreground launch.
  void runLaunchSweep();

  let previous = "active";
  return appState.addEventListener("change", (next) => {
    if (previous === "background" && next === "active") {
      void runLaunchSweep();
    }
    previous = next;
  });
}

/**
 * Test-only reset: clears the registry and the running guard so each test starts
 * isolated. Not part of the runtime surface.
 */
export function __resetSweepForTest(): void {
  hooks.length = 0;
  running = false;
}
