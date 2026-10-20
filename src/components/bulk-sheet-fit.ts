/**
 * Sized openings for the Contacts selection's More… sheet and the bulk Snooze
 * sheet (38.13 D-87, amending D-71). PURE — no react-native import,
 * node-testable.
 *
 * Each sheet opens at the smallest size whose height holds its rows at the
 * current window size and text scale, through the same rule as the bulk Set
 * Category sheet (`sizedSheetVariantFor`, D-85): compact when everything fits,
 * taller when not. The rendering components lay their rows out from the
 * geometry constants below, so a prediction cannot drift from the render.
 */
import {
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
import { ICON_SIZE } from "@/theme/tokens/icon-size";
import { SPACING } from "@/theme/tokens/spacing";
import { TYPOGRAPHY } from "@/theme/tokens/typography";

/** Window and inset facts every sized-sheet prediction reads (dp). */
export interface SheetFitEnvironment {
  windowHeight: number;
  windowWidth: number;
  /** The OS text scale (`useWindowDimensions().fontScale`). */
  fontScale: number;
  /** Bottom safe-area inset; the Sheet pads its bottom edge by it. */
  bottomInset: number;
}

/**
 * Room a hairline border may take (dp). `StyleSheet.hairlineWidth` is under
 * 1 dp on these phones; counting a full dp errs toward a taller sheet.
 */
const HAIRLINE_ESTIMATE = 1;

/** The Sheet's own chrome around a sized body (dp). */
function sheetChrome(env: SheetFitEnvironment): number {
  return (
    SHEET_HANDLE_BLOCK_HEIGHT +
    SHEET_BODY_PADDING_BOTTOM +
    Math.max(0, env.bottomInset) +
    OPTION_SHEET_FIT_SLACK
  );
}

/** Width of the sheet body's text column (dp). */
function bodyWidth(env: SheetFitEnvironment): number {
  return env.windowWidth - 2 * SHEET_BODY_PADDING_HORIZONTAL;
}

/*
 * More… sheet geometry (tunables). `BulkActionSurface` styles its sheet from
 * these values.
 */
/** A More… row's touch-target floor (dp). */
export const BULK_MORE_ROW_MIN_HEIGHT = 52;
/** Gap between a More… row's icon and its label (dp). */
export const BULK_MORE_ROW_ICON_GAP = SPACING.base;
/** Space below the More… title (dp). */
export const BULK_MORE_TITLE_GAP = SPACING.sm;
/** Space above the "Careful actions" heading (dp). */
export const BULK_MORE_SECTION_GAP = SPACING.base;
/** The "Careful actions" heading's letter spacing (dp, unscaled). */
export const BULK_MORE_SECTION_LETTER_SPACING = 1;

export interface BulkMoreSheetFitInput extends SheetFitEnvironment {
  /** e.g. "3 selected". */
  title: string;
  /** Every row label, both groups, in order. */
  rowLabels: readonly string[];
  /** The careful-group heading as drawn (upper-cased). */
  sectionLabel: string;
}

/** The full height the More… sheet needs to show every row (dp). */
export function bulkMoreSheetContentHeight(
  input: BulkMoreSheetFitInput,
): number {
  const width = bodyWidth(input);
  const title =
    predictedTextLines(
      input.title,
      width,
      TYPOGRAPHY.heading.size,
      input.fontScale,
    ) *
      scaledLineHeight(TYPOGRAPHY.heading.lineHeight, input.fontScale) +
    BULK_MORE_TITLE_GAP;
  const labelWidth = width - ICON_SIZE.md - BULK_MORE_ROW_ICON_GAP;
  const rows = input.rowLabels.reduce(
    (sum, label) =>
      sum +
      Math.max(
        BULK_MORE_ROW_MIN_HEIGHT,
        predictedTextLines(
          label,
          labelWidth,
          TYPOGRAPHY.body.size,
          input.fontScale,
        ) * scaledLineHeight(TYPOGRAPHY.body.lineHeight, input.fontScale),
      ) +
      HAIRLINE_ESTIMATE,
    0,
  );
  const section =
    BULK_MORE_SECTION_GAP +
    predictedTextLines(
      input.sectionLabel,
      width,
      TYPOGRAPHY.caption.size,
      input.fontScale,
      BULK_MORE_SECTION_LETTER_SPACING,
    ) *
      scaledLineHeight(TYPOGRAPHY.caption.lineHeight, input.fontScale);
  return sheetChrome(input) + title + rows + section;
}

/** The size the More… sheet opens at (38.13 D-87). */
export function bulkMoreSheetVariantFor(
  input: BulkMoreSheetFitInput,
): SizedSheetVariant {
  return sizedSheetVariantFor(
    bulkMoreSheetContentHeight(input),
    input.windowHeight,
  );
}

/*
 * Snooze sheet geometry (tunables). `SnoozeSheet` styles itself from these
 * values.
 */
/** Gap between the snooze sheet's children (dp). */
export const SNOOZE_SHEET_GAP = SPACING.sm;
/** Space below the snooze sheet's last child (dp). */
export const SNOOZE_SHEET_PADDING_BOTTOM = SPACING.base;
/** A snooze choice's touch-target floor (dp). */
export const SNOOZE_CHOICE_MIN_HEIGHT = 44;
/** A snooze choice's border, each side (dp). */
export const SNOOZE_CHOICE_BORDER_WIDTH = 1;
/** A snooze choice's horizontal padding, each side (dp). */
export const SNOOZE_CHOICE_PADDING_HORIZONTAL = SPACING.base;
/** Space above the Close button (dp). */
export const SNOOZE_CLOSE_MARGIN_TOP = SPACING.sm;

/**
 * A design-system `Button`'s height (dp): its 44 dp floor, or one label line
 * plus its vertical padding (`Button.tsx`: `SPACING.md` each side), plus room
 * for a 1 dp border. Labels here are short, so one line is assumed.
 */
function buttonHeight(fontScale: number): number {
  return (
    Math.max(
      44,
      scaledLineHeight(TYPOGRAPHY.label.lineHeight, fontScale) + 2 * SPACING.md,
    ) +
    2 * HAIRLINE_ESTIMATE
  );
}

export interface SnoozeSheetFitInput extends SheetFitEnvironment {
  /** e.g. "Snooze 3 contacts". */
  title: string;
  /** The "Snoozed until …" line shows. */
  showCurrent: boolean;
  /** The choice labels, in order (`SNOOZE_CHOICES`). */
  choiceLabels: readonly string[];
  /** The Unsnooze button shows. */
  showUnsnooze: boolean;
}

/**
 * The full height the snooze sheet needs when it opens (dp): heading, the
 * optional current line, every choice, Unsnooze when shown, and Close. Choose
 * date's expanded rows are not counted: the sheet is sized when it opens
 * (D-78's reading of "sized"), and its body scrolls if the date rows outgrow
 * it.
 */
export function snoozeSheetContentHeight(input: SnoozeSheetFitInput): number {
  const width = bodyWidth(input);
  const heading =
    predictedTextLines(
      input.title,
      width,
      TYPOGRAPHY.heading.size,
      input.fontScale,
    ) * scaledLineHeight(TYPOGRAPHY.heading.lineHeight, input.fontScale);
  const current = input.showCurrent
    ? scaledLineHeight(TYPOGRAPHY.body.lineHeight, input.fontScale)
    : 0;
  const choiceWidth =
    width -
    2 * SNOOZE_CHOICE_PADDING_HORIZONTAL -
    2 * SNOOZE_CHOICE_BORDER_WIDTH;
  const choices = input.choiceLabels.reduce(
    (sum, label) =>
      sum +
      Math.max(
        SNOOZE_CHOICE_MIN_HEIGHT,
        predictedTextLines(
          label,
          choiceWidth,
          TYPOGRAPHY.body.size,
          input.fontScale,
        ) * scaledLineHeight(TYPOGRAPHY.body.lineHeight, input.fontScale),
      ) +
      2 * SNOOZE_CHOICE_BORDER_WIDTH,
    0,
  );
  const unsnooze = input.showUnsnooze ? buttonHeight(input.fontScale) : 0;
  const close = SNOOZE_CLOSE_MARGIN_TOP + buttonHeight(input.fontScale);
  const children =
    1 +
    (input.showCurrent ? 1 : 0) +
    input.choiceLabels.length +
    (input.showUnsnooze ? 1 : 0) +
    1;
  return (
    sheetChrome(input) +
    heading +
    current +
    choices +
    unsnooze +
    close +
    (children - 1) * SNOOZE_SHEET_GAP +
    SNOOZE_SHEET_PADDING_BOTTOM
  );
}

/** The size the snooze sheet opens at when it is sized (38.13 D-87). */
export function snoozeSheetVariantFor(
  input: SnoozeSheetFitInput,
): SizedSheetVariant {
  return sizedSheetVariantFor(
    snoozeSheetContentHeight(input),
    input.windowHeight,
  );
}
