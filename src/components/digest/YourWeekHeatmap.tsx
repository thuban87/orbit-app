import { useMemo, useState } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { fitHeatmapCell } from "@/components/heatmap-fit";
import { classifyHeatmapCell } from "@/components/history/heatmap-cell";
import { AppText } from "@/components/ui/AppText";
import type { HistoryWindow, WindowCell } from "@/services/history/window";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import {
  formatDisplayDateOrFallback,
  parseLocalMs,
  WEEKDAY_SHORT,
} from "@/utils/dates";
import { Logger } from "@/utils/logger";

// ─── Tunables (RG-033 ui-accessibility/AUD-UIA-010, D-13) ─────────────────────
/**
 * Design floor for SUPPORTED widths (≥320dp): a 320dp window leaves 288dp after
 * Digest's content padding, which fits 37dp cells. Not a clamp — below it the
 * cells still shrink so every day stays visible (visibility wins, D-13).
 */
const MIN_CELL = 36;
/** Cap so cells do not balloon on wide screens. */
const MAX_CELL = 56;
const GAP = SPACING.xs;
const COLUMNS = 7;
/**
 * Height of the selected weekday label's underline bar (38.13-04 only; D-47
 * requires a non-colour cue, not this value).
 */
const LABEL_UNDERLINE = 2;
const LOG_SCOPE = "your-week-heatmap";

export interface YourWeekHeatmapProps {
  window: HistoryWindow;
  counts: ReadonlyMap<string, number>;
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
  testID?: string;
}

function weeks(cells: readonly WindowCell[]): WindowCell[][] {
  const result: WindowCell[][] = [];
  for (let index = 0; index < cells.length; index += COLUMNS) {
    result.push(cells.slice(index, index + COLUMNS));
  }
  return result;
}

/** A real calendar day (placeholders carry no weekday of their own). */
function realDate(cell: WindowCell | undefined): string | null {
  return cell && !cell.isPlaceholder && cell.date !== null ? cell.date : null;
}

/**
 * The weekday name over each of the 7 columns (38.13 D-47), from the shared
 * `WEEKDAY_SHORT` table (38.9 D-23: no private copy). A column takes the
 * weekday of its first real date; a column with only placeholders takes the
 * weekday implied by the nearest column that has one (columns are consecutive
 * days). All blank when the window has no real date. PURE.
 */
export function weekdayColumnLabels(
  rows: readonly (readonly WindowCell[])[],
): string[] {
  const columnDay: (number | null)[] = [];
  for (let column = 0; column < COLUMNS; column += 1) {
    let date: string | null = null;
    for (const row of rows) {
      date = realDate(row[column]);
      if (date !== null) break;
    }
    columnDay.push(
      date === null ? null : new Date(parseLocalMs(date)).getDay(),
    );
  }
  const anchor = columnDay.findIndex((day) => day !== null);
  if (anchor === -1) return columnDay.map(() => "");
  const anchorDay = columnDay[anchor] as number;
  return columnDay.map((day, column) => {
    const weekday =
      day ?? (((anchorDay + column - anchor) % COLUMNS) + COLUMNS) % COLUMNS;
    return WEEKDAY_SHORT[weekday];
  });
}

/** The column index of `date` among the real cells, or null. */
function selectedColumn(
  rows: readonly (readonly WindowCell[])[],
  date: string | null,
): number | null {
  if (date === null) return null;
  for (const row of rows) {
    const column = row.findIndex((cell) => realDate(cell) === date);
    if (column !== -1) return column;
  }
  return null;
}

function fitWeekCell(availableWidth: number): number | null {
  return fitHeatmapCell({
    availableWidth,
    columns: COLUMNS,
    gap: GAP,
    maxCell: MAX_CELL,
  });
}

/**
 * Accessibility text for a day cell: the shared weekday display form ("Tue,
 * Oct 13"; 38.9 D-23, D-48). Display only: the testID and `onSelectDay(date)`
 * keep the raw YYYY-MM-DD.
 */
function dateLabel(date: string): string {
  return formatDisplayDateOrFallback(date, date, { weekday: true });
}

export function YourWeekHeatmap({
  window,
  counts,
  selectedDate,
  onSelectDay,
  testID = "your-week-heatmap",
}: YourWeekHeatmapProps) {
  const { colors } = useTheme();
  const rows = useMemo(() => weeks(window.cells), [window.cells]);
  const labels = useMemo(() => weekdayColumnLabels(rows), [rows]);
  const activeColumn = selectedColumn(rows, selectedDate);
  // Measured available width (layout measurement, not animation). 0 until the
  // first layout pass: nothing renders until then, so the grid never jumps.
  const [availableWidth, setAvailableWidth] = useState(0);
  const cellEdge = fitWeekCell(availableWidth);

  const onLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    const fitted = fitWeekCell(width);
    if (fitted !== null && fitted < MIN_CELL) {
      Logger.debug(LOG_SCOPE, "narrow width: cells below the design floor");
    }
    setAvailableWidth(width);
  };
  const cellSize = { width: cellEdge ?? 0, height: cellEdge ?? 0 };

  const renderCell = (cell: WindowCell, key: string) => {
    if (cell.isPlaceholder || cell.date === null || cell.isFuture) {
      return (
        <View
          key={key}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.cell,
            cellSize,
            { backgroundColor: colors.heatmapCellEmpty },
          ]}
        />
      );
    }

    const date = cell.date;
    const count = counts.get(date) ?? 0;
    const fill = classifyHeatmapCell(cell, count, "7days");
    const backgroundColor =
      fill.kind === "blank"
        ? colors.heatmapCellEmpty
        : colors.heatmapScale[
            Math.min(fill.level, colors.heatmapScale.length - 1)
          ];
    const selected = selectedDate === date;

    return (
      <Pressable
        key={key}
        testID={`${testID}-cell-${date}`}
        accessibilityRole="button"
        accessibilityLabel={`${dateLabel(date)}, ${count} ${count === 1 ? "activity" : "activities"}`}
        accessibilityState={{ selected }}
        onPress={() => onSelectDay(date)}
        style={[
          styles.cell,
          cellSize,
          { backgroundColor },
          selected
            ? { borderWidth: 2, borderColor: colors.borderStrong }
            : { borderWidth: 1, borderColor: colors.border },
        ]}
      />
    );
  };

  // Weekday labels (38.13 D-47) sit in their own row at the fitted cell
  // width, so they never shrink or resize cells (ADR-174). The selected
  // day's column label is bold with an underline bar: a shape cue beside the
  // border, not colour alone. The bar's slot is always there, so selecting a
  // day never shifts the grid. Hidden from accessibility: each cell already
  // announces its weekday through `dateLabel`.
  const labelRow = (
    <View
      testID={`${testID}-labels`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.row}
    >
      {labels.map((label, column) => {
        const active = column === activeColumn;
        return (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: the 7 columns are fixed positions.
            key={column}
            testID={`${testID}-label-${column}`}
            style={[styles.label, { width: cellEdge ?? 0 }]}
          >
            {active ? (
              // biome-ignore lint/a11y/useValidAriaRole: AppText role is a typography role.
              <AppText role="label" numberOfLines={1}>
                {label}
              </AppText>
            ) : (
              <AppText
                role="caption"
                numberOfLines={1}
                style={{ color: colors.textSecondary }}
              >
                {label}
              </AppText>
            )}
            {active ? (
              <View
                testID={`${testID}-label-selected`}
                style={[
                  styles.underline,
                  { backgroundColor: colors.textPrimary },
                ]}
              />
            ) : (
              <View style={styles.underline} />
            )}
          </View>
        );
      })}
    </View>
  );

  // Full-width wrapper measures the available width; the grid inside is sized
  // from it and centered (D-13), so there is no empty right side and no
  // horizontal scroll.
  return (
    <View testID={testID} style={styles.wrapper} onLayout={onLayout}>
      {cellEdge === null ? null : (
        <View testID={`${testID}-grid`} style={styles.grid}>
          {labelRow}
          {rows.map((row, rowIndex) => (
            <View
              key={row.map((cell) => cell.date ?? "blank").join("|")}
              style={styles.row}
            >
              {row.map((cell, cellIndex) =>
                renderCell(cell, cell.date ?? `blank-${rowIndex}-${cellIndex}`),
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignSelf: "stretch" },
  grid: { gap: GAP, alignSelf: "center" },
  row: { flexDirection: "row", gap: GAP },
  cell: { borderRadius: SPACING.xs },
  label: { alignItems: "center", gap: SPACING.xs },
  underline: {
    width: "60%",
    height: LABEL_UNDERLINE,
    borderRadius: LABEL_UNDERLINE / 2,
  },
});
