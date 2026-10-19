import { create } from "zustand";
import {
  type AppSettingsPatch,
  getAppSettings,
  updateAppSettings,
} from "@/db/app-settings-dao";
import { localDateTime } from "@/db/database";
import type { SqlExecutor } from "@/db/types";
import {
  canonicalizeDashboardFilters,
  type DashboardFilters,
  type DashboardPopulation,
  type DashboardQueryState,
  type DashboardSortMode,
  type DashboardViewMode,
  parseDashboardFilters,
  parseDashboardPopulations,
  resetDashboardView,
} from "@/logic/dashboard-query-logic";

/** The three query axes whose writes are optimistic and serialised (D-27). */
export type DashboardQueryAxis = "populations" | "filters" | "sort";
const QUERY_AXES: readonly DashboardQueryAxis[] = [
  "populations",
  "filters",
  "sort",
];
type DashboardQueryAxes = Pick<DashboardQueryState, DashboardQueryAxis>;
export type DashboardPendingAxes = Record<DashboardQueryAxis, number>;

interface DashboardQueryStore extends DashboardQueryState {
  /** Hydration is complete, including a deliberately discarded stale snapshot. */
  hydrated: boolean;
  hydrate: (exec: SqlExecutor) => Promise<void>;
  setViewMode: (
    exec: SqlExecutor,
    viewMode: DashboardViewMode,
  ) => Promise<void>;
  setPopulations: (
    exec: SqlExecutor,
    populations: DashboardPopulation[],
  ) => Promise<void>;
  setFilters: (exec: SqlExecutor, filters: DashboardFilters) => Promise<void>;
  setPopulationsAndFilters: (
    exec: SqlExecutor,
    populations: DashboardPopulation[],
    filters: DashboardFilters,
  ) => Promise<void>;
  setSort: (exec: SqlExecutor, sort: DashboardSortMode) => Promise<void>;
  resetDashboardView: (exec: SqlExecutor) => Promise<void>;
  /** Internal write/hydration ordering guard; not a presentation setting. */
  generation: number;
  /**
   * Per-axis last successfully persisted value (D-27). A failed write with no
   * newer write pending for that axis restores this, never an optimistic value
   * that may itself never have been saved (review R1-07). Seeded by hydrate.
   */
  committed: DashboardQueryAxes;
  /** Writes issued and not yet settled, per axis; drives the pending state. */
  pendingAxes: DashboardPendingAxes;
}

/*
 * Serial write chain (D-27; RESEARCH Pattern 6). Every query-axis write is
 * appended here so writes land in strict issue order; the store already shows
 * the new value (optimistic), so a tap is never dropped while a write runs.
 */
let writeChain: Promise<void> = Promise.resolve();
let writeSeq = 0;
/**
 * Every issued write not yet settled, by sequence number. A write that is
 * voided (below) skips its database write and settles quietly.
 */
interface QueuedWrite {
  axes: readonly DashboardQueryAxis[];
  next: Partial<DashboardQueryAxes>;
  voided: boolean;
}
const queuedWrites = new Map<number, QueuedWrite>();
/** Successful writes per axis; hydrate compares it to skip axes written since it began. */
const successfulWrites: Record<DashboardQueryAxis, number> = {
  populations: 0,
  filters: 0,
  sort: 0,
};

function adjustPending(
  pending: DashboardPendingAxes,
  axes: readonly DashboardQueryAxis[],
  delta: 1 | -1,
): DashboardPendingAxes {
  const next = { ...pending };
  for (const axis of axes) next[axis] = Math.max(0, next[axis] + delta);
  return next;
}

function parseStoredState(settings: {
  dashboardViewMode: DashboardViewMode;
  dashboardPopulations: string;
  dashboardFilters: string;
  dashboardSort: DashboardSortMode;
}): DashboardQueryState {
  let populations: DashboardPopulation[] = [];
  let filters: DashboardFilters = {};
  try {
    populations =
      parseDashboardPopulations(JSON.parse(settings.dashboardPopulations)) ??
      [];
    filters =
      parseDashboardFilters(JSON.parse(settings.dashboardFilters)) ?? {};
  } catch {
    console.warn(
      "Dashboard preferences were malformed; using empty query axes.",
    );
  }
  return {
    viewMode: settings.dashboardViewMode,
    populations,
    filters,
    sort: settings.dashboardSort,
  };
}

export const useDashboardQueryStore = create<DashboardQueryStore>()(
  (set, get) => {
    /**
     * Apply `next` at once, queue its write, and settle with that write. On
     * failure each written axis is restored, then the error is rethrown.
     *
     * Restore rule: an axis returns to the value of the newest still-queued,
     * non-voided write for it, else to its committed value (writes settle in
     * issue order, so `committed` is exact here). A single-axis write carries
     * a full value, so a newer write on that axis simply wins. A combined
     * write (the Digest / "N Never Contacted →" drill, Reset) chose its axes
     * together, so a newer queued write on any of them was made on top of a
     * pair that never got saved: it is voided (skips its write, settles
     * quietly) and every axis it touched is restored too, so the view never
     * shows "old population + new chip" (38.13 review A-IN-02).
     */
    const queueWrite = (
      exec: SqlExecutor,
      next: Partial<DashboardQueryAxes>,
      patch: AppSettingsPatch,
    ): Promise<void> => {
      const axes = QUERY_AXES.filter((axis) => next[axis] !== undefined);
      const seq = ++writeSeq;
      const entry: QueuedWrite = { axes, next, voided: false };
      queuedWrites.set(seq, entry);
      set((state) => ({
        ...next,
        generation: state.generation + 1,
        pendingAxes: adjustPending(state.pendingAxes, axes, 1),
      }));
      const write = writeChain.then(async () => {
        if (entry.voided) return false;
        await updateAppSettings(exec, patch, localDateTime());
        return true;
      });
      writeChain = write.then(
        () => undefined,
        () => undefined,
      );
      return write.then(
        (landed) => {
          queuedWrites.delete(seq);
          if (!landed) {
            // Voided by an earlier combined write's failure, which already
            // restored the view and reported the failure.
            set((state) => ({
              pendingAxes: adjustPending(state.pendingAxes, axes, -1),
            }));
            return;
          }
          for (const axis of axes) successfulWrites[axis] += 1;
          set((state) => ({
            committed: { ...state.committed, ...next },
            pendingAxes: adjustPending(state.pendingAxes, axes, -1),
          }));
        },
        (error: unknown) => {
          queuedWrites.delete(seq);
          const affected = new Set<DashboardQueryAxis>(axes);
          if (axes.length > 1) {
            const later = [...queuedWrites.entries()]
              .filter(([laterSeq, w]) => laterSeq > seq && !w.voided)
              .sort(([a], [b]) => a - b);
            for (const [, w] of later) {
              if (!w.axes.some((axis) => affected.has(axis))) continue;
              w.voided = true;
              for (const axis of w.axes) affected.add(axis);
            }
          }
          set((state) => {
            const restore: Partial<DashboardQueryAxes> = {};
            for (const axis of affected) {
              let value: unknown = state.committed[axis];
              for (const [, w] of [...queuedWrites.entries()].sort(
                ([a], [b]) => a - b,
              )) {
                if (!w.voided && w.next[axis] !== undefined) {
                  value = w.next[axis];
                }
              }
              if (value !== state[axis])
                Object.assign(restore, { [axis]: value });
            }
            const restored = Object.keys(restore).length > 0;
            return {
              ...restore,
              ...(restored ? { generation: state.generation + 1 } : {}),
              pendingAxes: adjustPending(state.pendingAxes, axes, -1),
            };
          });
          throw error;
        },
      );
    };

    return {
      viewMode: "list",
      populations: [],
      filters: {},
      sort: "default",
      hydrated: false,
      generation: 0,
      committed: { populations: [], filters: {}, sort: "default" },
      pendingAxes: { populations: 0, filters: 0, sort: 0 },
      hydrate: async (exec) => {
        const generation = get().generation;
        const writesAtStart = { ...successfulWrites };
        const stored = parseStoredState(await getAppSettings(exec));
        set((state) => {
          // Review R2-05: the snapshot is the committed value of every axis
          // with no successful write since this read began, even when the
          // generation guard drops the publish, so a failing first tap
          // restores a value that is really stored.
          const committed = { ...state.committed };
          const publish: Partial<DashboardQueryAxes> = {};
          for (const axis of QUERY_AXES) {
            if (successfulWrites[axis] !== writesAtStart[axis]) continue;
            Object.assign(committed, { [axis]: stored[axis] });
            // An axis with no write in flight and none landed since the read
            // began shows the stored value; a pending optimistic value wins.
            if (state.pendingAxes[axis] === 0)
              Object.assign(publish, { [axis]: stored[axis] });
          }
          return state.generation === generation
            ? {
                viewMode: stored.viewMode,
                ...publish,
                committed,
                hydrated: true,
              }
            : { ...publish, committed, hydrated: true };
        });
      },
      setViewMode: async (exec, viewMode) => {
        // Idempotency guard (cross-AI review CYCLE-4 #3): re-selecting the already
        // active view must not persist, set(), or bump the generation — so a no-op
        // toggle never thrashes SQLite or triggers a Dashboard reload.
        // Not a D-27 axis: it keeps its await-then-set shape (38.13-02).
        if (viewMode === get().viewMode) return;
        await updateAppSettings(
          exec,
          { dashboardViewMode: viewMode },
          localDateTime(),
        );
        set((state) => ({ viewMode, generation: state.generation + 1 }));
      },
      setPopulations: (exec, populations) =>
        queueWrite(
          exec,
          { populations },
          { dashboardPopulations: JSON.stringify(populations) },
        ),
      setFilters: (exec, filters) => {
        const canonical = canonicalizeDashboardFilters(filters);
        return queueWrite(
          exec,
          { filters: canonical },
          { dashboardFilters: JSON.stringify(canonical) },
        );
      },
      setPopulationsAndFilters: (exec, populations, filters) => {
        const canonical = canonicalizeDashboardFilters(filters);
        return queueWrite(
          exec,
          { populations, filters: canonical },
          {
            dashboardPopulations: JSON.stringify(populations),
            dashboardFilters: JSON.stringify(canonical),
          },
        );
      },
      setSort: (exec, sort) =>
        queueWrite(exec, { sort }, { dashboardSort: sort }),
      resetDashboardView: (exec) => {
        const next = resetDashboardView(get());
        return queueWrite(
          exec,
          {
            populations: next.populations,
            filters: next.filters,
            sort: next.sort,
          },
          {
            dashboardPopulations: JSON.stringify(next.populations),
            dashboardFilters: JSON.stringify(next.filters),
            dashboardSort: next.sort,
          },
        );
      },
    };
  },
);
