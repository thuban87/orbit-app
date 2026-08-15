/**
 * Launch-time photo-write reconciliation sweep (PHOTO-03/05 — the interrupted-
 * replace recovery wiring) — the Phase-2 launch-sweep registry's photo consumer.
 *
 * SQLite has no scheduler and nothing watches a timestamp (CLAUDE.md §14), so the
 * orphaned `*.tmp`/`*.bak` sidecars an interrupted `persistMaster` can leave
 * behind are reconciled by the EXISTING launch sweep, NOT a background timer.
 * `registerPhotoReconcileSweep` mirrors `registerFieldSweep`: it pushes ONE
 * idempotent hook onto the Phase-2 `registerSweepHook` registry that calls
 * `reconcilePhotoWrites` (which deletes stale `.tmp`, deletes a completed-swap
 * `.bak`, and restores an interrupted-swap `.bak` whose canonical dest is
 * missing). Unlike `field-sweep` it needs no executor — the reconciliation is
 * FS-only — so it takes no args, and a second pass is safe (it finds no orphans).
 *
 * NEGATIVE rules inherited from the registry: importing this module runs nothing
 * (no module-scope side effect), and registration must happen from the
 * `ready`-gated App effect, never at module top-level (P5 — a headless tap must
 * never reach the sweep).
 */
import { reconcilePhotoWrites } from "@/services/photos/photo-storage";
import { registerSweepHook } from "@/services/launch-sweep";
import { Logger } from "@/utils/logger";

/**
 * Register the launch-time photo-write reconciliation on the Phase-2 registry.
 * Pushes ONE idempotent, Logger-scoped hook; safe to run twice.
 */
export function registerPhotoReconcileSweep(): void {
  registerSweepHook(async () => {
    try {
      await reconcilePhotoWrites();
    } catch (error) {
      Logger.error(
        "photo-reconcile-sweep",
        "photo-write reconciliation failed (best-effort)",
        error,
      );
    }
  });
}
