/**
 * Card-view selection: what the bar may do for the current selection (38.13
 * D-40, D-74, D-75, D-77; ADR-102, ADR-233).
 *
 * - The selection universe is frozen at entry (ADR-102) and built by
 *   `selectionUniverseIds`. Whether Unbound people found by an All Contacts
 *   search may join it is ONE constant, `SELECTION_INCLUDES_UNBOUND` (D-77,
 *   owner 2026-10-19: "Include them").
 * - Favorite, Remove from Favorites and Snooze apply only to Bound people
 *   (ADR-233: no Favorite and no Snooze for Unbound people). Every other bulk
 *   action applies to anyone selected (D-77).
 * - Bound/favourite flags come from a lifecycle map. An id absent from the map
 *   is unknown and never counts as Bound (review R1-04): there is no "missing
 *   from rows = Bound" default.
 * - "Select All" reads "Deselect all" only when at least one person is
 *   selected and the whole frozen universe is (D-40; review R5-03).
 *
 * Pure: no React, no react-native, no database.
 */
import type { DashboardRow, SelectionLifecycleRow } from "@/db/dashboard-read";

/** D-77 (owner, 2026-10-19): Unbound people on screen can be selected. */
export const SELECTION_INCLUDES_UNBOUND = true;

/** One selected person's lifecycle facts, as the restricted actions need them. */
export interface SelectionLifecycle {
  bound: boolean;
  favourite: boolean;
}

export type SelectionLifecycleMap = ReadonlyMap<number, SelectionLifecycle>;

export type SelectAllLabel = "Select All" | "Deselect all";

/** Which bar buttons and More… rows are enabled (or shown) right now. */
export interface BulkActionAvailability {
  canQuickLog: boolean;
  canSnooze: boolean;
  /** D-74: Favorite always adds; enabled when someone Bound is not yet one. */
  canAddFavorites: boolean;
  canOpenMore: boolean;
  canLogInteraction: boolean;
  /** D-75: the More… row shows only when a selected Bound person is one. */
  showRemoveFavorites: boolean;
  canSetCategory: boolean;
  canChangeFrequency: boolean;
  canMoveToBin: boolean;
  /** Select All / Deselect all has something to act on. */
  canToggleSelectAll: boolean;
}

export interface SelectionApplicability extends BulkActionAvailability {
  selectAllLabel: SelectAllLabel;
}

/** The one Select All / Deselect all rule (D-40; review R5-03). */
export function selectAllLabelFor(
  selectedCount: number,
  universeLength: number,
): SelectAllLabel {
  return selectedCount > 0 && selectedCount === universeLength
    ? "Deselect all"
    : "Select All";
}

/** The frozen universe's ids from the rows on screen at entry (D-77; ADR-102). */
export function selectionUniverseIds(
  rows: readonly Pick<DashboardRow, "id" | "trackingEnabled">[],
  includeUnbound: boolean,
): number[] {
  return rows
    .filter((row) => includeUnbound || row.trackingEnabled === 1)
    .map((row) => row.id);
}

export function selectionApplicability(
  selectedIds: Iterable<number>,
  universeLength: number,
  lifecycleById: SelectionLifecycleMap,
): SelectionApplicability {
  const selected = [...new Set(selectedIds)];
  const any = selected.length > 0;
  let someBound = false;
  let someBoundNonFavourite = false;
  let someBoundFavourite = false;
  for (const id of selected) {
    const entry = lifecycleById.get(id);
    if (!entry?.bound) continue;
    someBound = true;
    if (entry.favourite) someBoundFavourite = true;
    else someBoundNonFavourite = true;
  }
  return {
    canQuickLog: any,
    canSnooze: someBound,
    canAddFavorites: someBoundNonFavourite,
    canOpenMore: any,
    canLogInteraction: any,
    showRemoveFavorites: someBoundFavourite,
    canSetCategory: any,
    canChangeFrequency: any,
    canMoveToBin: any,
    canToggleSelectAll: universeLength > 0,
    selectAllLabel: selectAllLabelFor(selected.length, universeLength),
  };
}

export type BulkWriteAction =
  | "add-favorites"
  | "remove-favorites"
  | "snooze"
  | "quick-log"
  | "log-interaction"
  | "set-category"
  | "frequency"
  | "archive";

/**
 * The ids a bulk write may touch, from the action-time lifecycle read (D-77;
 * ADR-233; review R1-04). The restricted actions write only ids present in
 * the map and Bound:
 * - add-favorites: Bound people not yet favourites (adding an existing
 *   favourite would re-rank it to the end, and the outcome would overcount);
 * - remove-favorites: Bound favourites ("removes every selected favourite",
 *   D-75);
 * - snooze: Bound people.
 * Every other action returns `ids` unchanged.
 */
export function bulkWriteIds(
  action: BulkWriteAction,
  ids: readonly number[],
  lifecycleById: SelectionLifecycleMap,
): number[] {
  const keep = (test: (entry: SelectionLifecycle) => boolean) =>
    ids.filter((id) => {
      const entry = lifecycleById.get(id);
      return entry?.bound === true && test(entry);
    });
  switch (action) {
    case "add-favorites":
      return keep((entry) => !entry.favourite);
    case "remove-favorites":
      return keep((entry) => entry.favourite);
    case "snooze":
      return keep(() => true);
    default:
      return [...ids];
  }
}

/** A lifecycle map from the database read (`readSelectionLifecycle`). */
export function lifecycleMapFrom(
  rows: readonly SelectionLifecycleRow[],
): SelectionLifecycleMap {
  return new Map(
    rows.map((row) => [row.id, { bound: row.bound, favourite: row.favourite }]),
  );
}

/**
 * The entry-time lifecycle map for the frozen universe, from the rows on
 * screen when selection starts (`favourite_rank` is NULL for Unbound people
 * in the card projection).
 */
export function lifecycleFromRows(
  rows: readonly Pick<
    DashboardRow,
    "id" | "trackingEnabled" | "favourite_rank"
  >[],
  universe: readonly number[],
): SelectionLifecycleMap {
  const inUniverse = new Set(universe);
  const map = new Map<number, SelectionLifecycle>();
  for (const row of rows) {
    if (!inUniverse.has(row.id)) continue;
    map.set(row.id, {
      bound: row.trackingEnabled === 1,
      favourite: row.favourite_rank !== null,
    });
  }
  return map;
}

/**
 * The individual star's optimistic overlay overrides `favourite` for ids the
 * map knows. It never adds an unknown id (unknown stays never-Bound).
 */
export function withFavouriteOverlay(
  lifecycleById: SelectionLifecycleMap,
  overlay: ReadonlyMap<number, boolean>,
): SelectionLifecycleMap {
  let next: Map<number, SelectionLifecycle> | null = null;
  for (const [id, favourite] of overlay) {
    const entry = lifecycleById.get(id);
    if (!entry || entry.favourite === favourite) continue;
    next ??= new Map(lifecycleById);
    next.set(id, { ...entry, favourite });
  }
  return next ?? lifecycleById;
}

/**
 * Whether a lifecycle refresh may replace the map (review R5-02): only while
 * selecting, only the latest request, and only for the selection session it
 * was started in.
 */
export function shouldApplyLifecycleRefresh(input: {
  requestToken: number;
  currentToken: number;
  requestSessionId: number;
  currentSessionId: number;
  selectionMode: boolean;
}): boolean {
  return (
    input.selectionMode &&
    input.requestToken === input.currentToken &&
    input.requestSessionId === input.currentSessionId
  );
}
