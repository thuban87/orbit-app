/**
 * The Last Talked About / Current Location history page's pure rules (Phase
 * 38.10 D-41, D-45, D-47, D-48, D-51, D-52, D-53, D-69, D-84, D-101, D-107;
 * 38.9 D-39/D-46 via D-19).
 *
 * - Rows arrive in the one SQL order (`currentStateOrderSql`, D-45, D-51):
 *   the first is Most Recent and the rest are Previous. Both groups carry
 *   the same row model and the same row actions; Most Recent is a full row,
 *   not a header (convergence c10, Claude C-05).
 * - A row shows the date it is about, date only (D-41, D-48), through the
 *   shared display formatter; never its capture date and time.
 * - A linked row's date follows its interaction (D-41), and its tap opens
 *   the interaction (D-107).
 * - The date picker is capped at today (D-101).
 * - Move is offered only from Last Talked About: Current Location is not a
 *   D-84 section (convergence c1 F-U12).
 *
 * The + → Memory add form's rules live here too (D-63, D-64; G-11):
 * the success label and whether the flow returns to that same Profile.
 *
 * Every snackbar string here is a proposal (this plan only) for the plan-19
 * wording review, except "Memory saved for <name>" (D-64, owner-decided). React-native-free and DAO-free at runtime (type-only DAO
 * imports), so it is unit-tested in the node env.
 */
import type { CurrentStateEntryRow } from "@/db/current-state-history-read";
import {
  type CurrentStateFieldKey,
  MEMORY_TYPE_REGISTRY,
  type MemoryTypeKey,
} from "@/db/memory-registry";
import { PROFILE_MODULE_REGISTRY } from "@/profile/module-registry";
import { formatDisplayDateOrFallback, formatLocalDate } from "@/utils/dates";
import { deletedSnackbar, restoredSnackbar } from "./section-editor-logic";

/** The group headings, as the Profile section shows them (D-45). */
export const HISTORY_MOST_RECENT = "Most Recent";
export const HISTORY_PREVIOUS = "Previous";

/** The page title, from the registry the Profile sections read (D-89). */
export function historyTitle(fieldKey: CurrentStateFieldKey): string {
  switch (fieldKey) {
    case "last_talked_about":
      return PROFILE_MODULE_REGISTRY["last-talked-about"].label;
    case "current_location":
      return PROFILE_MODULE_REGISTRY["current-location"].label;
  }
}

/**
 * The page's Add wording (D-131): today's "Add <title>", shown by the top Add
 * bar and the section FAB's label and screen-reader name alike.
 */
export function historyAddLabel(fieldKey: CurrentStateFieldKey): string {
  return `Add ${historyTitle(fieldKey)}`;
}

/** The page's `sectionFabIcon` key (D-131: chat / map pin). */
export function historyFabSection(
  fieldKey: CurrentStateFieldKey,
): "last_talked_about" | "current_location" {
  switch (fieldKey) {
    case "last_talked_about":
      return "last_talked_about";
    case "current_location":
      return "current_location";
  }
}

/** What a tap on a row does (D-107): a linked row opens its interaction. */
export type HistoryRowPressAction = "openLinked" | "edit";

export function rowPressAction(
  row: Pick<CurrentStateEntryRow, "interaction_id">,
): HistoryRowPressAction {
  return row.interaction_id !== null ? "openLinked" : "edit";
}

/** A linked entry's date follows its interaction (D-41). */
export function canEditDate(
  row: Pick<CurrentStateEntryRow, "interaction_id">,
): boolean {
  return row.interaction_id === null;
}

/**
 * Only Last Talked About is a D-84 move section; the move DAO refuses any
 * other current-state source, so the page never offers it (F-U12).
 */
export function canMoveFrom(fieldKey: CurrentStateFieldKey): boolean {
  return fieldKey === "last_talked_about";
}

/**
 * The date shown for a row (D-41, D-48; convergence c6, Cursor CU-04): the
 * date the entry is about, else its creation date. Date only.
 */
export function historyRowDate(
  row: {
    entry_date: string | null;
    created_at: string;
  },
  now?: Date,
): string {
  return formatDisplayDateOrFallback(
    row.entry_date ?? row.created_at,
    "Unknown date",
    now === undefined ? {} : { now },
  );
}

/** The latest date the two pickers allow: today, local (D-101). */
export function maxPickableDate(now: Date = new Date()): string {
  return formatLocalDate(now);
}

/** A stored `YYYY-MM-DD` that is not after today (D-101). */
export function isPickableEntryDate(
  date: string,
  now: Date = new Date(),
): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= maxPickableDate(now);
}

/** One row on the page: the same shape for Most Recent and Previous. */
export interface HistoryRowModel {
  row: CurrentStateEntryRow;
  dateLabel: string;
  pressAction: HistoryRowPressAction;
  canEditDate: boolean;
  canMove: boolean;
}

export interface HistoryGroups {
  mostRecent: HistoryRowModel | null;
  previous: HistoryRowModel[];
  /**
   * Every entry on the page, Most Recent included: the rows an `editId`
   * resolves against (D-107; convergence c10, Claude C-05).
   */
  rows: CurrentStateEntryRow[];
}

/** One row's model: the same for Most Recent, Previous and an orphaned form. */
export function historyRowModel(
  row: CurrentStateEntryRow,
  fieldKey: CurrentStateFieldKey,
  now?: Date,
): HistoryRowModel {
  return {
    row,
    dateLabel: historyRowDate(row, now),
    pressAction: rowPressAction(row),
    canEditDate: canEditDate(row),
    canMove: canMoveFrom(fieldKey),
  };
}

/**
 * The open edit form's row when a reload no longer lists it (38.10 review
 * WR-01): deleted or moved from another screen, a restore, or a merge. The
 * page then renders that form after the list, so a typed draft never
 * disappears and Back/Cancel still close a form the user can see (the Off
 * Limits editor and `cardEditSlots` do the same). Null while nothing is being
 * edited, before the first load, or while the row is still listed (its form
 * renders in its place, D-130).
 */
export function orphanedEditRow<T extends { id: number }>(
  editing: T | null,
  rows: readonly T[] | null,
): T | null {
  if (editing === null || rows === null) return null;
  return rows.some((row) => row.id === editing.id) ? null : editing;
}

/**
 * Split rows already in the SQL order (D-45, D-51) into Most Recent and
 * Previous. The order is never re-derived here, so it lives in one place.
 */
export function groupHistoryRows(
  rows: readonly CurrentStateEntryRow[],
  fieldKey: CurrentStateFieldKey,
  now?: Date,
): HistoryGroups {
  const model = (row: CurrentStateEntryRow): HistoryRowModel =>
    historyRowModel(row, fieldKey, now);
  const [first, ...rest] = rows;
  return {
    mostRecent: first === undefined ? null : model(first),
    previous: rest.map(model),
    rows: [...rows],
  };
}

/** Delete snackbar, verb first, naming the person (38.9 D-39/D-46; F-U8). */
export function historyDeletedSnackbar(
  title: string,
  name: string | null,
): string {
  return deletedSnackbar(title, name);
}

/** The confirming snackbar after a delete's Undo (F-U8). */
export function historyRestoredSnackbar(
  title: string,
  name: string | null,
): string {
  return restoredSnackbar(title, name);
}

/** " for Ann", or "" while the person line has not loaded. */
function forName(name: string | null): string {
  return name === null || name.trim() === "" ? "" : ` for ${name}`;
}

/**
 * The + → Memory success label (D-64, G-11; convergence c2 G-U6). With no
 * type (+ → Memory) or the general type it is exactly "Memory saved for
 * <name>" (D-64, owner-decided). A Profile section's Add passes its type, and
 * the label names that section from the registry (D-89): "Saved to Gift Ideas
 * for <name>" (proposal, this plan only, for the plan-19 wording review).
 */
export function memorySavedLabel(
  type: MemoryTypeKey | undefined,
  name: string | null,
): string {
  if (type === "gift_idea" || type === "thought_of_them") {
    return `Saved to ${MEMORY_TYPE_REGISTRY[type].displayName}${forName(name)}`;
  }
  return `Memory saved${forName(name)}`;
}

/** The slice of a stack's navigation state `returnsToSameProfile` reads. */
export interface StackRouteLike {
  name: string;
  params?: object;
}

/**
 * Whether going back from the add form lands on this contact's Profile
 * (convergence c1 F-U11, Claude C-15): the route directly below the focused
 * one is `Profile` with the same `contactId`. Then the success snackbar drops
 * its "Open Profile" action, since the user is already there.
 */
export function returnsToSameProfile(
  routes: readonly StackRouteLike[],
  index: number,
  contactId: number,
): boolean {
  const below = index >= 1 ? routes[index - 1] : undefined;
  if (below === undefined || below.name !== "Profile") return false;
  const params = below.params as { contactId?: unknown } | undefined;
  return params?.contactId === contactId;
}
