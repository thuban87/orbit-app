/**
 * The overlay variant of the unsaved-work guard (38.9 D-13, D-14; J-07) for
 * the pending-confirmations sheet.
 *
 * The sheet keeps the set of queued assist uids whose confirmation note holds
 * typed text. Membership follows the real queue (review M6): an item leaves the
 * set only when its note is cleared or the item leaves the queue (confirmed,
 * dismissed, expired or removed elsewhere), never because a confirm or dismiss
 * handler returned. Handlers always resolve, and a failed write keeps the item
 * and its typed note in the queue, so it must stay dirty.
 */
import type { SheetFitEnvironment } from "@/components/bulk-sheet-fit";
import { MIN_TOUCH_TARGET } from "@/components/ui/button-roles";
import {
  OPTION_LABEL_CHAR_WIDTH_RATIO,
  OPTION_SHEET_FIT_SLACK,
  predictedTextLines,
  type SizedSheetVariant,
  scaledLineHeight,
  sizedSheetVariantFor,
} from "@/components/ui/option-sheet-logic";
import {
  SHEET_BODY_PADDING_BOTTOM,
  SHEET_BODY_PADDING_HORIZONTAL,
  SHEET_HANDLE_BLOCK_HEIGHT,
} from "@/components/ui/sheet-contract";
import { SPACING } from "@/theme/tokens/spacing";
import { TYPOGRAPHY } from "@/theme/tokens/typography";

/** Adds (`dirty`) or removes `uid`; returns the same set when nothing changes. */
export function markNoteDirty(
  dirtyUids: ReadonlySet<string>,
  uid: string,
  dirty: boolean,
): ReadonlySet<string> {
  if (dirtyUids.has(uid) === dirty) return dirtyUids;
  const next = new Set(dirtyUids);
  if (dirty) next.add(uid);
  else next.delete(uid);
  return next;
}

/** Keeps only uids still in the queue; returns the same set when none left. */
export function pruneDirtyNotes(
  dirtyUids: ReadonlySet<string>,
  queueUids: readonly string[],
): ReadonlySet<string> {
  const queued = new Set(queueUids);
  let removed = false;
  for (const uid of dirtyUids) {
    if (!queued.has(uid)) {
      removed = true;
      break;
    }
  }
  if (!removed) return dirtyUids;
  return new Set([...dirtyUids].filter((uid) => queued.has(uid)));
}

/** True when closing the sheet would lose a typed note (pass the pruned set). */
export function shouldPromptOnSheetClose(
  dirtyUids: ReadonlySet<string>,
): boolean {
  return dirtyUids.size > 0;
}

/*
 * Sized opening for the pending list (38.14 D-74; ADR-255 sized-sheet rule,
 * sizing is Claude's Discretion per CONTEXT). The sheet opens at the smallest
 * of compact / detail that holds every queued row at the current window and
 * text scale, else expanded; the list scrolls inside in every size. The
 * component lays its rows out from the geometry constants below, and the
 * estimate errs toward a taller sheet.
 */

/** Gap between the sheet's title, list and Close row (dp). */
export const PENDING_SHEET_GAP = SPACING.md;
/** Gap between queued rows (dp). */
export const PENDING_ROW_GAP = SPACING.md;
/** Space inside one row: between question, answers and note toggle (dp). */
export const PENDING_ROW_INNER_GAP = SPACING.sm;
/** Space under each row above its hairline (dp). */
export const PENDING_ROW_PADDING_BOTTOM = SPACING.md;
/** Row avatar diameter (dp), as `SPACING["2xl"] - SPACING.sm` in the row. */
export const PENDING_AVATAR_SIZE = SPACING["2xl"] - SPACING.sm;

/** One queued row's visible text and answer labels. */
export interface PendingSheetRowFit {
  question: string;
  destination: string;
  /** The answer labels in order (e.g. "Don't log", "No answer", "Yes"). */
  answers: readonly string[];
}

export interface PendingSheetFitInput extends SheetFitEnvironment {
  title: string;
  rows: readonly PendingSheetRowFit[];
}

/** A labelled Button's predicted height: its text line plus padding (dp). */
function buttonHeight(fontScale: number): number {
  return Math.max(
    MIN_TOUCH_TARGET,
    scaledLineHeight(TYPOGRAPHY.body.lineHeight, fontScale) + 2 * SPACING.md,
  );
}

/** Whether a row's answers are predicted to stack (ConfirmActions, D-80). */
function answersStack(
  answers: readonly string[],
  width: number,
  fontScale: number,
): boolean {
  const natural = answers.reduce(
    (sum, label) =>
      sum +
      label.length *
        TYPOGRAPHY.body.size *
        OPTION_LABEL_CHAR_WIDTH_RATIO *
        Math.max(1, fontScale) +
      2 * SPACING.lg,
    0,
  );
  return natural + (answers.length - 1) * SPACING.sm > width;
}

/** The full height the pending list needs to show every row (dp). */
export function pendingSheetContentHeight(input: PendingSheetFitInput): number {
  const width = input.windowWidth - 2 * SHEET_BODY_PADDING_HORIZONTAL;
  const scale = input.fontScale;
  const title =
    predictedTextLines(input.title, width, TYPOGRAPHY.heading.size, scale) *
    scaledLineHeight(TYPOGRAPHY.heading.lineHeight, scale);
  const button = buttonHeight(scale);
  const rows =
    input.rows.length === 0
      ? scaledLineHeight(TYPOGRAPHY.body.lineHeight, scale) * 2 + 2 * SPACING.md
      : input.rows.reduce((sum, row) => {
          const question = Math.max(
            PENDING_AVATAR_SIZE,
            scaledLineHeight(TYPOGRAPHY.body.lineHeight, scale) +
              scaledLineHeight(TYPOGRAPHY.label.lineHeight, scale),
          );
          const answers = answersStack(row.answers, width, scale)
            ? row.answers.length * button +
              (row.answers.length - 1) * SPACING.sm
            : button;
          return (
            sum +
            question +
            answers +
            MIN_TOUCH_TARGET +
            2 * PENDING_ROW_INNER_GAP +
            PENDING_ROW_PADDING_BOTTOM +
            1
          );
        }, 0) +
        (input.rows.length - 1) * PENDING_ROW_GAP;
  const chrome =
    SHEET_HANDLE_BLOCK_HEIGHT +
    SHEET_BODY_PADDING_BOTTOM +
    Math.max(0, input.bottomInset) +
    OPTION_SHEET_FIT_SLACK;
  return title + rows + button + 2 * PENDING_SHEET_GAP + chrome;
}

/** The size the pending list opens at (ADR-255 `sizedSheetVariantFor`). */
export function pendingSheetVariantFor(
  input: PendingSheetFitInput,
): SizedSheetVariant {
  return sizedSheetVariantFor(
    pendingSheetContentHeight(input),
    input.windowHeight,
  );
}
