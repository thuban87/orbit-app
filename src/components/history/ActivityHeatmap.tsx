/**
 * ActivityHeatmap (HIST-02/03/04/05) — the static, COUNT-ONLY interaction
 * heatmap for the Contact Profile History section.
 *
 * STATIC BY DESIGN (dossier §D, RESEARCH A5): plain RN `View`/`Pressable` cells
 * coloured from the theme `heatmapScale` ramp. It uses NO GPU-canvas draw layer,
 * NO render loop, NO animation, NO per-frame setState — this deliberately
 * sidesteps the worklet-forward-ref hazard the orrery has, and a count heatmap
 * has nothing to animate. Every colour resolves through `useTheme().colors.*`
 * (CLAUDE.md / check:colors) — no hex/named literal anywhere, including in styles.
 *
 * PURELY PRESENTATIONAL, PARENT-OWNED STATE (mirrors IntensityLine /
 * SegmentedControl): it imports NO DAO and opens NO sheet. The parent (Plan 08)
 * owns the lens/preset persistence (through app-settings-dao) and the context
 * card / sheet; this component only renders the supplied window + counts and
 * emits `onLensChange` / `onPresetChange` / `onCellPress` / `onPrev` / `onNext`.
 *
 * COUNT-ONLY (D-10): saturation is driven solely by the per-date/per-cycle
 * interaction COUNTS the parent supplies from Plan 03's count-only bucketing;
 * lifecycle records never reach this component. The current in-progress cycle is
 * distinguished STRUCTURALLY — a `borderStrong` outline + a "Current cycle"
 * accessibility label — NEVER a second hue (dossier §G).
 *
 * ACCESSIBILITY (HIST-18): every real cell exposes "{date/range}, {n}
 * interactions" so the grid is fully usable without colour. Dense Year/large-
 * preset cells render visually below the 44px floor (an accepted departure,
 * dossier §AC / Phase 40) but stay a11y-labelled and carry a touch `hitSlop`.
 * That slop grows toward 44dp but never past the midpoint of the gap to the
 * adjacent cell (`cellHitSlop`, owner default D-42 B), so tap zones never
 * overlap a neighbour.
 */
import { useMemo, useState } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import {
  type CellInsets,
  cellHitSlop,
  fitHeatmapCell,
} from "@/components/heatmap-fit";
import {
  classifyCycleBlock,
  classifyHeatmapCell,
} from "@/components/history/heatmap-cell";
import { Icon } from "@/components/icons/Icon";
import { SegmentedControl } from "@/components/SegmentedControl";
import { AppText } from "@/components/ui/AppText";
import type { HistoryCycleCount, HistoryLens } from "@/db/app-settings-dao";
import { HISTORY_CYCLE_COUNTS } from "@/db/app-settings-dao";
import type { CycleBlock, CyclesResult } from "@/services/history/cycles";
import type { HistoryWindow, WindowCell } from "@/services/history/window";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

// --- Tunable geometry (top-of-file single-edit, CLAUDE.md) -------------------
// The Year dense grid is deliberately small (a11y-compensated), with two whole
// weeks per row so it stays compact without horizontal scrolling — an accepted
// limitation left fixed by RG-033.
const HEATMAP_GEOMETRY = {
  yearCellEdge: 13,
  radius: 6,
  columns: 7,
} as const;

// Per-lens cell caps (RG-033 ui-accessibility/AUD-UIA-010, D-13). The day
// (7 Days / Month) and Cycles lenses size their cells from the measured width
// via `fitHeatmapCell` — never wider than these caps, and shrinking below them
// whenever the width demands it so every day/cycle stays visible.
const DAY_MAX_CELL = 38;
const CYCLE_MAX_CELL = 52;
/** The Cycles grid is always 5 columns wide — presets are 5/10/15/20. */
const CYCLE_COLUMNS = 5;
const CELL_GAP = SPACING.xs;
/** Vertical gap between day-lens rows (their `marginBottom`). */
const DAY_ROW_GAP = SPACING.xs;
/** Year grid gaps: between days of a week, between the two weeks of a row, between rows. */
const YEAR_DAY_GAP = SPACING.xs;
const YEAR_WEEK_GAP = SPACING.sm;
const YEAR_ROW_GAP = SPACING.xs;

// Tap-zone gaps per lens (D-42 B). `cellHitSlop` caps each side at half of
// these, so no two cells' zones overlap. Outer sides use the grid's own gap.
const DAY_CELL_GAPS: CellInsets = {
  left: CELL_GAP,
  right: CELL_GAP,
  top: DAY_ROW_GAP,
  bottom: DAY_ROW_GAP,
};
const CYCLE_CELL_GAPS: CellInsets = {
  left: CELL_GAP,
  right: CELL_GAP,
  top: CELL_GAP,
  bottom: CELL_GAP,
};

/** Year cell gaps: the week-boundary sides face the wider week gap. */
function yearCellGaps(
  day: number,
  daysInWeek: number,
  weekIndex: number,
  weeksInRow: number,
): CellInsets {
  const hasNextWeek = weekIndex < weeksInRow - 1;
  return {
    left: day === 0 && weekIndex > 0 ? YEAR_WEEK_GAP : YEAR_DAY_GAP,
    right: day === daysInWeek - 1 && hasNextWeek ? YEAR_WEEK_GAP : YEAR_DAY_GAP,
    top: YEAR_ROW_GAP,
    bottom: YEAR_ROW_GAP,
  };
}

/** Width of a row of `columns` cells of `edge` with CELL_GAP gaps. */
function rowWidth(edge: number, columns: number): number {
  return columns * edge + (columns - 1) * CELL_GAP;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** "Mar 4" from a local `YYYY-MM-DD` — local parts only (never UTC ISO slicing). */
function formatMonthDay(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

/** The lens segments in shipped order — Cycles is the default lens. */
const LENS_OPTIONS: { label: string; value: HistoryLens }[] = [
  { label: "Cycles", value: "cycles" },
  { label: "7 Days", value: "7days" },
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
];

const PRESET_OPTIONS: { label: string; value: `${HistoryCycleCount}` }[] =
  HISTORY_CYCLE_COUNTS.map((n) => ({
    label: String(n),
    value: String(n) as `${HistoryCycleCount}`,
  }));

/** What the parent needs to open the anchored context card for a tapped cell. */
export type HeatmapCellTarget =
  | { kind: "date"; date: string; count: number }
  | {
      kind: "cycle";
      index: number;
      start: string;
      end: string;
      count: number;
      isCurrent: boolean;
    };

export interface ActivityHeatmapProps {
  /** Active lens (parent owns + persists it). */
  lens: HistoryLens;
  /** Active Cycles-lens count preset (parent owns + persists it). */
  cycleCount: HistoryCycleCount;
  /** Day-lens generated window (7days/month/year); null when lens is 'cycles'. */
  window: HistoryWindow | null;
  /** Per-date interaction counts for the day-lens window (date -> count). */
  counts: ReadonlyMap<string, number>;
  /** Cycles-lens blocks, or the tagged no-cadence fallback (Cycles unavailable). */
  cycles: CyclesResult;
  /** Count per cycle block, index-aligned to `cycles.blocks` (cycles lens). */
  cycleCounts: readonly number[];
  onLensChange: (lens: HistoryLens) => void;
  onPresetChange: (count: HistoryCycleCount) => void;
  onCellPress: (target: HeatmapCellTarget) => void;
  onPrev: () => void;
  onNext: () => void;
  /** Whether next-window navigation is allowed (future is blocked when false). */
  canGoNext: boolean;
  testID?: string;
}

/** Split a flat cell array into whole-week chunks of 7 (row-major). */
function chunkWeeks<T>(cells: readonly T[]): T[][] {
  const weeks: T[][] = [];
  for (let i = 0; i < cells.length; i += HEATMAP_GEOMETRY.columns) {
    weeks.push(cells.slice(i, i + HEATMAP_GEOMETRY.columns));
  }
  return weeks;
}

/** Pair adjacent complete weeks so Year uses 26 compact rows. */
function pairWeeks<T>(weeks: readonly T[][]): T[][][] {
  const pairs: T[][][] = [];
  for (let i = 0; i < weeks.length; i += 2) {
    pairs.push(weeks.slice(i, i + 2));
  }
  return pairs;
}

/** The header window title per lens ("Mar 4 – Mar 10" / "March 2026" / "2026"). */
function windowTitle(lens: HistoryLens, window: HistoryWindow | null): string {
  if (lens === "cycles") return "Cycles";
  if (!window) return "";
  if (lens === "7days") {
    return `${formatMonthDay(window.start)} – ${formatMonthDay(window.end)}`;
  }
  const [y, m] = window.start.split("-");
  if (lens === "month") return `${MONTHS[Number(m) - 1]} ${y}`;
  return y;
}

export function ActivityHeatmap({
  lens,
  cycleCount,
  window,
  counts,
  cycles,
  cycleCounts,
  onLensChange,
  onPresetChange,
  onCellPress,
  onPrev,
  onNext,
  canGoNext,
  testID = "activity-heatmap",
}: ActivityHeatmapProps) {
  const { colors } = useTheme();
  // Measured available width (layout measurement, not animation); 0 until the
  // first layout pass, so the day/cycle grids render nothing until measured.
  const [availableWidth, setAvailableWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) =>
    setAvailableWidth(event.nativeEvent.layout.width);
  const dayCellEdge = fitHeatmapCell({
    availableWidth,
    columns: HEATMAP_GEOMETRY.columns,
    gap: CELL_GAP,
    maxCell: DAY_MAX_CELL,
  });
  const cycleCellEdge = fitHeatmapCell({
    availableWidth,
    columns: CYCLE_COLUMNS,
    gap: CELL_GAP,
    maxCell: CYCLE_MAX_CELL,
  });

  const dayWeeks = useMemo(
    () => (window ? chunkWeeks(window.cells) : []),
    [window],
  );
  const yearWeekPairs = useMemo(() => pairWeeks(dayWeeks), [dayWeeks]);

  const cellStyle = (edge: number): ViewStyle => ({
    width: edge,
    height: edge,
    borderRadius: HEATMAP_GEOMETRY.radius,
  });

  const scaleColor = (level: number): string =>
    colors.heatmapScale[Math.min(level, colors.heatmapScale.length - 1)];

  /** Render one day-lens cell (real date, structural blank, or blocked future). */
  const renderDayCell = (
    cell: WindowCell,
    key: string,
    edge: number,
    gaps: CellInsets,
  ) => {
    // Structural placeholder OR a blocked future date: a non-interactive blank
    // (heatmapCellEmpty) that must read distinctly from a real zero-count day.
    if (cell.isPlaceholder || cell.date === null || cell.isFuture) {
      return (
        <View
          key={key}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            cellStyle(edge),
            { backgroundColor: colors.heatmapCellEmpty },
          ]}
        />
      );
    }
    const date = cell.date;
    const count = counts.get(date) ?? 0;
    const fill = classifyHeatmapCell(cell, count, lens);
    const bg =
      fill.kind === "blank" ? colors.heatmapCellEmpty : scaleColor(fill.level);
    const slop = cellHitSlop({ edge, gaps });
    return (
      <Pressable
        key={key}
        testID={`${testID}-cell-${date}`}
        accessibilityRole="button"
        accessibilityLabel={`${formatMonthDay(date)}, ${count} interactions`}
        hitSlop={slop}
        onPress={() => onCellPress({ kind: "date", date, count })}
        style={[
          cellStyle(edge),
          { backgroundColor: bg, borderWidth: 1, borderColor: colors.border },
        ]}
      />
    );
  };

  /** Render one Cycles-lens block cell with structural current-cycle marking. */
  const renderCycleCell = (block: CycleBlock, count: number, edge: number) => {
    const fill = classifyCycleBlock(count);
    const rangeLabel = `${formatMonthDay(block.start)} – ${formatMonthDay(block.end)}`;
    const currentSuffix = block.isCurrent ? ", Current cycle" : "";
    return (
      <Pressable
        key={block.index}
        testID={`${testID}-cycle-${block.index}`}
        accessibilityRole="button"
        accessibilityLabel={`${rangeLabel}, ${count} interactions${currentSuffix}`}
        hitSlop={cellHitSlop({ edge, gaps: CYCLE_CELL_GAPS })}
        onPress={() =>
          onCellPress({
            kind: "cycle",
            index: block.index,
            start: block.start,
            end: block.end,
            count,
            isCurrent: block.isCurrent,
          })
        }
        style={[
          cellStyle(edge),
          { backgroundColor: scaleColor(fill.level) },
          // Current cycle: STRUCTURAL emphasis only — a borderStrong outline, never
          // a second hue (dossier §G). Non-current blocks keep the hairline border.
          block.isCurrent
            ? { borderWidth: 2, borderColor: colors.borderStrong }
            : { borderWidth: 1, borderColor: colors.border },
        ]}
      />
    );
  };

  return (
    <View testID={testID} style={styles.container} onLayout={onLayout}>
      {/* Lens switch — Cycles default. */}
      <SegmentedControl
        testID={`${testID}-lens`}
        options={LENS_OPTIONS}
        value={lens}
        onChange={onLensChange}
      />

      {/* Cycles-only preset selector (5/10/15/20). */}
      {lens === "cycles" ? (
        <SegmentedControl
          testID={`${testID}-preset`}
          options={PRESET_OPTIONS}
          value={String(cycleCount) as `${HistoryCycleCount}`}
          onChange={(v) => onPresetChange(Number(v) as HistoryCycleCount)}
        />
      ) : null}

      {/* Window navigation — prev/next; next is blocked at today. Cycles are
          always anchored at now, so navigation is day-lens only. */}
      {lens !== "cycles" ? (
        <View style={styles.navRow}>
          <Pressable
            testID={`${testID}-prev`}
            accessibilityRole="button"
            accessibilityLabel="Previous period"
            hitSlop={8}
            onPress={onPrev}
            style={styles.navButton}
          >
            <Icon name="back" tone="textSecondary" size="md" />
          </Pressable>
          <AppText role="label" style={{ color: colors.textPrimary }}>
            {windowTitle(lens, window)}
          </AppText>
          <Pressable
            testID={`${testID}-next`}
            accessibilityRole="button"
            accessibilityLabel="Next period"
            accessibilityState={{ disabled: !canGoNext }}
            disabled={!canGoNext}
            hitSlop={8}
            onPress={onNext}
            style={styles.navButton}
          >
            <Icon
              name="forward"
              tone={canGoNext ? "textSecondary" : "border"}
              size="md"
            />
          </Pressable>
        </View>
      ) : null}

      {/* Grid. */}
      {lens === "cycles" ? (
        cycles.available ? (
          cycleCellEdge === null ? null : (
            // Exactly five cells + four gaps wide, centered (D-13).
            <View
              testID={`${testID}-cycles-grid`}
              style={[
                styles.cycleGrid,
                { width: rowWidth(cycleCellEdge, CYCLE_COLUMNS) },
              ]}
            >
              {cycles.blocks.map((block) =>
                renderCycleCell(
                  block,
                  cycleCounts[block.index] ?? 0,
                  cycleCellEdge,
                ),
              )}
            </View>
          )
        ) : (
          <AppText
            testID={`${testID}-cycles-unavailable`}
            role="caption"
            style={{ color: colors.textSecondary }}
          >
            Cycles need a set frequency for this contact.
          </AppText>
        )
      ) : lens === "year" ? (
        // Year: two adjacent whole weeks per row (14 cells) keeps the vertical
        // mobile view compact while preserving weekday alignment and no x-scroll.
        <View testID={`${testID}-year-grid`}>
          {yearWeekPairs.map((weeks, row) => (
            <View
              key={`row-${weeks[0]?.find((c) => c.date)?.date ?? row}`}
              testID={`${testID}-year-row-${row}`}
              style={styles.yearRow}
            >
              {weeks.map((week, weekIndex) => (
                <View
                  key={`week-${week.find((c) => c.date)?.date ?? weekIndex}`}
                  testID={`${testID}-year-week-${row}-${weekIndex}`}
                  style={styles.yearWeek}
                >
                  {week.map((cell, day) =>
                    renderDayCell(
                      cell,
                      `y-${row}-${weekIndex}-${cell.date ?? `p${day}`}`,
                      HEATMAP_GEOMETRY.yearCellEdge,
                      yearCellGaps(day, week.length, weekIndex, weeks.length),
                    ),
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : dayCellEdge === null ? null : (
        // 7 Days / Month: weeks as ROWS (traditional weekday-aligned grid),
        // sized from the measured width and centered (D-13).
        <View testID={`${testID}-day-grid`} style={styles.dayGrid}>
          {dayWeeks.map((week, w) => (
            <View
              key={`row-${week.find((c) => c.date)?.date ?? w}`}
              style={styles.dayRow}
            >
              {week.map((cell, d) =>
                renderDayCell(
                  cell,
                  `d-${w}-${cell.date ?? `p${d}`}`,
                  dayCellEdge,
                  DAY_CELL_GAPS,
                ),
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dayGrid: { alignSelf: "center" },
  dayRow: {
    flexDirection: "row",
    gap: CELL_GAP,
    marginBottom: DAY_ROW_GAP,
  },
  yearRow: {
    flexDirection: "row",
    gap: YEAR_WEEK_GAP,
    marginBottom: YEAR_ROW_GAP,
  },
  yearWeek: { flexDirection: "row", gap: YEAR_DAY_GAP },
  cycleGrid: {
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CELL_GAP,
  },
});
