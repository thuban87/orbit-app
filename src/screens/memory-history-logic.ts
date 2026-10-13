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
 * Every snackbar string here is a proposal (this plan only) for the plan-19
 * wording review. React-native-free and DAO-free at runtime (type-only DAO
 * imports), so it is unit-tested in the node env.
 */
import type { CurrentStateEntryRow } from "@/db/current-state-history-read";
import type { CurrentStateFieldKey } from "@/db/memory-registry";
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

/**
 * Split rows already in the SQL order (D-45, D-51) into Most Recent and
 * Previous. The order is never re-derived here, so it lives in one place.
 */
export function groupHistoryRows(
  rows: readonly CurrentStateEntryRow[],
  fieldKey: CurrentStateFieldKey,
  now?: Date,
): HistoryGroups {
  const model = (row: CurrentStateEntryRow): HistoryRowModel => ({
    row,
    dateLabel: historyRowDate(row, now),
    pressAction: rowPressAction(row),
    canEditDate: canEditDate(row),
    canMove: canMoveFrom(fieldKey),
  });
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
