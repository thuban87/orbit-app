import type { DashboardRow } from "@/db/dashboard-read";

export type FavouriteMutationOutcome = "success" | "failure";
export type FavouriteMutationResolution = "applied" | "stale";

type Listener = () => void;

/**
 * Per-contact optimistic membership overlays. The snapshot is immutable by
 * replacement, making this controller suitable for useSyncExternalStore.
 */
export interface FavouriteOptimisticStore {
  begin(contactId: number, desiredMembership: boolean): number;
  overlayFor(contactId: number): boolean | undefined;
  committedMembershipFor(contactId: number): boolean | undefined;
  effectiveMembershipFor(contactId: number, fallback: boolean): boolean;
  resolve(
    contactId: number,
    generation: number,
    outcome: FavouriteMutationOutcome,
    committedMembership?: boolean,
  ): FavouriteMutationResolution;
  subscribe(listener: Listener): () => void;
  getSnapshot(): ReadonlyMap<number, boolean>;
}

export function createFavouriteOptimisticStore(): FavouriteOptimisticStore {
  const generations = new Map<number, number>();
  const overlay = new Map<number, boolean>();
  const committedMembership = new Map<number, boolean>();
  const listeners = new Set<Listener>();
  let snapshot: ReadonlyMap<number, boolean> = new Map();

  const publish = () => {
    snapshot = new Map(overlay);
    for (const listener of listeners) listener();
  };

  return {
    begin(contactId, desiredMembership) {
      const generation = (generations.get(contactId) ?? 0) + 1;
      generations.set(contactId, generation);
      overlay.set(contactId, desiredMembership);
      publish();
      return generation;
    },
    overlayFor(contactId) {
      return overlay.get(contactId);
    },
    committedMembershipFor(contactId) {
      return committedMembership.get(contactId);
    },
    effectiveMembershipFor(contactId, fallback) {
      return (
        overlay.get(contactId) ?? committedMembership.get(contactId) ?? fallback
      );
    },
    resolve(contactId, generation, outcome, membership) {
      if (outcome === "success" && membership !== undefined) {
        committedMembership.set(contactId, membership);
      }
      if (generations.get(contactId) !== generation) return "stale";
      overlay.delete(contactId);
      publish();
      return "applied";
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
  };
}

/**
 * Apply a persisted binary membership to a dashboard base row after every
 * successful optimistic write. Rank is intentionally membership-only.
 */
export function applyCommittedMembership(
  rows: readonly DashboardRow[],
  contactId: number,
  isFavourite: boolean,
): DashboardRow[] {
  return rows.map((row) =>
    row.id === contactId
      ? { ...row, favourite_rank: isFavourite ? 0 : null }
      : row,
  );
}
