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
 */
import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import {
  classifyCycleBlock,
  classifyHeatmapCell,
} from "@/components/history/heatmap-cell";
import { AppText } from "@/components/ui/AppText";
import { Icon } from "@/components/icons/Icon";
import { SegmentedControl } from "@/components/SegmentedControl";
import type {
  HistoryCycleCount,
  HistoryLens,
} from "@/db/app-settings-dao";
import { HISTORY_CYCLE_COUNTS } from "@/db/app-settings-dao";
import type { CycleBlock, CyclesResult } from "@/services/history/cycles";
import type { HistoryWindow, WindowCell } from "@/services/history/window";
import { SPACING } from "@/theme/tokens/spacing";
import { useTheme } from "@/theme";

// --- Tunable geometry (top-of-file single-edit, CLAUDE.md) -------------------
// Cell edges per lens. Day/cycle cells clear a comfortable tap; the Year dense
// grid is deliberately small (a11y-compensated, Phase 40 owns final density).
const HEATMAP_GEOMETRY = {
  dayCellEdge: 38,
  yearCellEdge: 13,
  cycleCellEdge: 52,
  radius: 6,
  columns: 7,
} as const;

/** A 44px-floor touch target expressed as symmetric hitSlop around a small cell. */
function hitSlopFor(edge: number): number {
  return Math.max(0, Math.round((44 - edge) / 2));
}

/** Fixed width of the 5-column cycle grid (5 cells + 4 gaps) — presets are 5/10/15/20. */
const CYCLE_GRID_MAX_WIDTH =
  5 * HEATMAP_GEOMETRY.cycleCellEdge + 4 * SPACING.xs;

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

  const dayWeeks = useMemo(
    () => (window ? chunkWeeks(window.cells) : []),
    [window],
  );

  const cellStyle = (edge: number): ViewStyle => ({
    width: edge,
    height: edge,
    borderRadius: HEATMAP_GEOMETRY.radius,
  });

  const scaleColor = (level: number): string =>
    colors.heatmapScale[Math.min(level, colors.heatmapScale.length - 1)];

  /** Render one day-lens cell (real date, structural blank, or blocked future). */
  const renderDayCell = (cell: WindowCell, key: string, edge: number) => {
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
    const slop = hitSlopFor(edge);
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
  const renderCycleCell = (block: CycleBlock, count: number) => {
    const fill = classifyCycleBlock(count);
    const rangeLabel = `${formatMonthDay(block.start)} – ${formatMonthDay(block.end)}`;
    const currentSuffix = block.isCurrent ? ", Current cycle" : "";
    return (
      <Pressable
        key={block.index}
        testID={`${testID}-cycle-${block.index}`}
        accessibilityRole="button"
        accessibilityLabel={`${rangeLabel}, ${count} interactions${currentSuffix}`}
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
          cellStyle(HEATMAP_GEOMETRY.cycleCellEdge),
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
    <View testID={testID} style={styles.container}>
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
          <View
            testID={`${testID}-cycles-grid`}
            style={[styles.cycleGrid, { maxWidth: CYCLE_GRID_MAX_WIDTH }]}
          >
            {cycles.blocks.map((block) =>
              renderCycleCell(block, cycleCounts[block.index] ?? 0),
            )}
          </View>
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
        // Year: weeks as COLUMNS, weekdays as ROWS (GitHub-style dense grid).
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.yearColumns}>
            {dayWeeks.map((week, w) => (
              <View
                key={`col-${week.find((c) => c.date)?.date ?? w}`}
                style={styles.yearColumn}
              >
                {week.map((cell, d) =>
                  renderDayCell(
                    cell,
                    `y-${w}-${cell.date ?? `p${d}`}`,
                    HEATMAP_GEOMETRY.yearCellEdge,
                  ),
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        // 7 Days / Month: weeks as ROWS (traditional weekday-aligned grid).
        <View testID={`${testID}-day-grid`}>
          {dayWeeks.map((week, w) => (
            <View
              key={`row-${week.find((c) => c.date)?.date ?? w}`}
              style={styles.dayRow}
            >
              {week.map((cell, d) =>
                renderDayCell(
                  cell,
                  `d-${w}-${cell.date ?? `p${d}`}`,
                  HEATMAP_GEOMETRY.dayCellEdge,
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
  dayRow: {
    flexDirection: "row",
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  cycleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  yearColumns: {
    flexDirection: "row",
    gap: SPACING.xs,
  },
  yearColumn: {
    flexDirection: "column",
    gap: SPACING.xs,
  },
});
