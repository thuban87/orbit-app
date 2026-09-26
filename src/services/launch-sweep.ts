import { Logger } from "@/utils/logger";

/**
 * Per-hook time budget (38.3 review A-WR-02, owner ruling D-30). The sweep stops
 * WAITING on a hook after this long; it never cancels or re-runs the hook's
 * work. Sized for a normal automatic backup (full export, 600k-iteration PBKDF2
 * ~53 ms, encrypt, SAF write + verify), which finishes in seconds; a hook past
 * this budget is treated as hung. A late-finishing hook is harmless: its work
 * still lands, and it is never started again while that call is in flight.
 */
export const SWEEP_HOOK_TIMEOUT_MS = 60_000;

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
 * Recovery producers run before backup. A future hook that can create recovery
 * work after the restore-photo drain must register between that drain and backup,
 * and be added to backup's `requires` list.
 */
export const SWEEP_IDS = {
  backgroundReconcile: "background-reconcile",
  restorePhotoFinalize: "restore-photo-finalize",
  backup: "backup",
} as const;

export interface SweepHookOptions {
  id?: string;
  requires?: readonly string[];
}

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

interface RegisteredHook {
  fn: SweepHook;
  options: SweepHookOptions;
}

// EMPTY in Phase 2 — later phases push their responsibilities here.
const hooks: RegisteredHook[] = [];

// Hooks whose call is still unsettled — including one the sweep stopped waiting
// on at its budget (D-30). A later pass skips such a hook rather than starting
// its work a second time alongside the first call.
const inFlightHooks = new Set<RegisteredHook>();

type BoundedHookOutcome = "settled" | "failed" | "timed-out";

/**
 * Await one hook for at most {@link SWEEP_HOOK_TIMEOUT_MS} (D-30). A synchronous
 * throw or a rejection is "failed"; the budget elapsing first is "timed-out".
 * The hook's own promise is always observed, so a late rejection is logged and
 * never unhandled. The budget timer is a bounded watchdog cleared as soon as
 * either side wins — not a freshness timer (D-22).
 */
function runHookWithinBudget(
  entry: RegisteredHook,
  invoke: () => Promise<void>,
): Promise<BoundedHookOutcome> {
  let work: Promise<void>;
  try {
    work = Promise.resolve(invoke());
  } catch {
    return Promise.resolve("failed");
  }
  inFlightHooks.add(entry);
  let abandoned = false;
  const observed = work.then(
    (): BoundedHookOutcome => {
      inFlightHooks.delete(entry);
      return "settled";
    },
    (): BoundedHookOutcome => {
      inFlightHooks.delete(entry);
      if (abandoned) {
        Logger.error(
          "launch-sweep",
          `hook failed after its budget: ${entry.options.id ?? "anonymous"}`,
        );
      }
      return "failed";
    },
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<BoundedHookOutcome>((resolve) => {
    timer = setTimeout(() => {
      abandoned = true;
      resolve("timed-out");
    }, SWEEP_HOOK_TIMEOUT_MS);
  });
  return Promise.race([observed, budget]).then((outcome) => {
    if (timer !== undefined) clearTimeout(timer);
    return outcome;
  });
}

/** Register a hook to run on each real foreground launch (registration order). */
export function registerSweepHook(
  fn: SweepHook,
  options: SweepHookOptions = {},
): void {
  hooks.push({ fn, options });
}

// Debug-only UAT fault injection (38.2-16, RG-016). Inert unless a dev-menu
// probe arms it in a __DEV__ build; production passes never read these.
type UatSweepFault = { failFirstHook: boolean; slowPassMs: number };
const uatFault: UatSweepFault = { failFirstHook: false, slowPassMs: 0 };
let uatPassCount = 0;
function isDevBuild(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__ === true;
}

/** Debug builds only: arm a one-shot first-hook failure and/or a slow pass. */
export function __armUatSweepFault(fault: Partial<UatSweepFault>): void {
  if (!isDevBuild()) return;
  Object.assign(uatFault, fault);
}

// Post-sweep settled listeners (38.3 D-14). Fired ONLY by the owning run, once,
// after its do/while loop (including any coalesced follow-up pass) has settled —
// never by a re-entrant call that early-returns (Pitfall 2). App.tsx forwards
// this to the shell-refresh store's foreground tick; this module stays node-pure
// and imports no store or react-native binding (P5).
const settledListeners = new Set<() => void>();

/**
 * Subscribe to "an owning sweep run has fully settled". Called once per owning
 * `runLaunchSweep()` run (cold start or a real background→active return), after
 * every hook of that run and any coalesced follow-up pass. A throwing hook never
 * suppresses it; a throwing listener is isolated and never wedges the runner.
 * Returns the unsubscribe function.
 */
export function onSweepSettled(listener: () => void): () => void {
  settledListeners.add(listener);
  return () => {
    settledListeners.delete(listener);
  };
}

function publishSweepSettled(): void {
  // Snapshot so an unsubscribe during delivery cannot skip a sibling listener.
  for (const listener of [...settledListeners]) {
    try {
      listener();
    } catch {
      Logger.error("launch-sweep", "settled listener failed");
    }
  }
}

// Module-level re-entrancy guard: keeps a single launch from double-running.
let running = false;
// DEFER-ONE (WR-03): a real background→active launch that overlaps an in-flight
// sweep sets this flag; the in-flight run drains it with one more pass rather
// than DROPPING that launch's sweep. A burst of overlapping launches coalesces
// to a single extra pass (the flag is reset at the top of each pass), so no real
// launch is silently skipped, but the hooks never double-run for one launch.
let pendingRerun = false;

/**
 * Run every registered hook once, in registration order. Concurrency contract:
 *   - A re-entrant call while a run is IN FLIGHT does NOT double-run the hooks
 *     for the current launch — it instead requests exactly ONE follow-up pass
 *     (`pendingRerun`), so an overlapping real `background → active` launch is
 *     DEFERRED, not dropped (WR-03). Multiple overlapping calls coalesce into a
 *     single follow-up pass.
 *   - The follow-up pass runs after the current pass settles, guaranteeing the
 *     "runs once per real foreground launch" contract later phases' quarantine-
 *     expiry / archived-purge / schedule-reconcile hooks depend on.
 * Each hook is awaited for at most `SWEEP_HOOK_TIMEOUT_MS` (D-30), so a hook
 * whose promise never settles cannot hold `running` forever or starve the
 * foreground tick. The `running` flag is reset in `finally` so a throwing hook
 * never wedges the runner shut. After it is released, the owning run publishes `onSweepSettled`
 * exactly once (38.3 D-14); a re-entrant early return publishes nothing.
 */
export async function runLaunchSweep(): Promise<void> {
  if (running) {
    pendingRerun = true;
    return;
  }
  running = true;
  try {
    do {
      // Reset before the pass so any overlapping call DURING it is captured for
      // exactly one more pass (coalescing a burst into a single follow-up).
      pendingRerun = false;
      const unavailable = new Set<string>();
      const uatPass = isDevBuild() ? ++uatPassCount : 0;
      if (uatPass) console.log("uat-sweep pass start", uatPass);
      if (isDevBuild() && uatFault.slowPassMs > 0) {
        const ms = uatFault.slowPassMs;
        uatFault.slowPassMs = 0;
        await new Promise((resolve) => setTimeout(resolve, ms));
      }
      for (const [index, entry] of hooks.entries()) {
        const { fn, options } = entry;
        if (options.requires?.some((id) => unavailable.has(id))) {
          if (options.id) unavailable.add(options.id);
          Logger.warn(
            "launch-sweep",
            `hook skipped: ${options.id ?? "anonymous"}`,
          );
          continue;
        }
        if (inFlightHooks.has(entry)) {
          // Its earlier call outlived the budget and is still running (D-30):
          // never start that work twice. Unfinished work is unavailable to
          // dependents, exactly like a failure.
          if (options.id) unavailable.add(options.id);
          Logger.warn(
            "launch-sweep",
            `hook still running: ${options.id ?? "anonymous"}`,
          );
          continue;
        }
        const outcome = await runHookWithinBudget(entry, () => {
          if (index === 0 && isDevBuild() && uatFault.failFirstHook) {
            uatFault.failFirstHook = false;
            throw new Error("uat injected first-hook failure");
          }
          return fn();
        });
        if (outcome === "settled") continue;
        if (options.id) unavailable.add(options.id);
        if (outcome === "timed-out") {
          Logger.error(
            "launch-sweep",
            `hook exceeded its budget: ${options.id ?? "anonymous"}`,
          );
        } else {
          Logger.error(
            "launch-sweep",
            `hook failed: ${options.id ?? "anonymous"}`,
          );
        }
      }
      if (uatPass) console.log("uat-sweep pass end", uatPass);
    } while (pendingRerun);
  } finally {
    running = false;
    // Owner path only: the re-entrant branch above returned before `running`
    // was ours, so it never reaches here. Publish once per owning run.
    publishSweepSettled();
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
  void runLaunchSweep().catch(() => {
    Logger.error("launch-sweep", "cold-start trigger failed");
  });

  let previous = "active";
  return appState.addEventListener("change", (next) => {
    if (previous === "background" && next === "active") {
      void runLaunchSweep().catch(() => {
        Logger.error("launch-sweep", "foreground trigger failed");
      });
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
  inFlightHooks.clear();
  running = false;
  pendingRerun = false;
  settledListeners.clear();
}
