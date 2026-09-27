import { useMemo, useState } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { fitHeatmapCell } from "@/components/heatmap-fit";
import { classifyHeatmapCell } from "@/components/history/heatmap-cell";
import type { HistoryWindow, WindowCell } from "@/services/history/window";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
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

function fitWeekCell(availableWidth: number): number | null {
  return fitHeatmapCell({
    availableWidth,
    columns: COLUMNS,
    gap: GAP,
    maxCell: MAX_CELL,
  });
}

function dateLabel(date: string): string {
  const [year, month, day] = date.split("-");
  return `${month}/${day}/${year}`;
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

  // Full-width wrapper measures the available width; the grid inside is sized
  // from it and centered (D-13), so there is no empty right side and no
  // horizontal scroll.
  return (
    <View testID={testID} style={styles.wrapper} onLayout={onLayout}>
      {cellEdge === null ? null : (
        <View testID={`${testID}-grid`} style={styles.grid}>
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
});
