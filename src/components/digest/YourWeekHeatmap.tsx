import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { classifyHeatmapCell } from "@/components/history/heatmap-cell";
import type { HistoryWindow, WindowCell } from "@/services/history/window";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

const CELL_EDGE = 44;
const COLUMNS = 7;

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

  const renderCell = (cell: WindowCell, key: string) => {
    if (cell.isPlaceholder || cell.date === null || cell.isFuture) {
      return (
        <View
          key={key}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.cell, { backgroundColor: colors.heatmapCellEmpty }]}
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
          { backgroundColor },
          selected
            ? { borderWidth: 2, borderColor: colors.borderStrong }
            : { borderWidth: 1, borderColor: colors.border },
        ]}
      />
    );
  };

  return (
    <View testID={testID} style={styles.grid}>
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
  );
}

const styles = StyleSheet.create({
  grid: { gap: SPACING.xs },
  row: { flexDirection: "row", gap: SPACING.xs },
  cell: { width: CELL_EDGE, height: CELL_EDGE, borderRadius: SPACING.xs },
});
