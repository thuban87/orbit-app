/**
 * RolodexBrowser (HIST-08/09/18) — the three synchronized Month / Day / Year
 * wheels with Day as the primary axis, pre-selection markers, and a summary
 * drawer. Reached from the Contact Profile History section.
 *
 * OWNS THE PAUSE-ON-BLUR LIFECYCLE (review Plan-06 MEDIUM): this component — NOT
 * the wheels — consumes `useIsFocused()` + an `AppState` active/background
 * subscription and measures its own width, then conditionally MOUNTS the animated
 * wheel subtree only when measured AND focused AND foregrounded (the Orrery
 * pattern). A wheel is never left mounted on blur keeping a live render loop; the
 * wheels never infer focus themselves.
 *
 * DATE MATH IS DELEGATED to the node-tested `rolodex-logic` (rollDate/clampDate/
 * markerFor/formatDrawerSummary) — Day rolls Month/Year at boundaries, invalid
 * dates clamp conventionally (leap-aware), and today is the max. The committed
 * selection is React state updated ONLY on a wheel settle or a stepper press
 * (never per frame). Selecting/scrolling NEVER auto-opens the detail sheet — only
 * the drawer's explicit `See details` / `Log interaction` callbacks do (HIST-09).
 *
 * COUNTS: the drawer summary is lifecycle-inclusive ("{n interactions · m
 * events}"), distinct from the interaction-only heatmap card (D-10). Every colour
 * resolves through theme tokens; there is no Skia and no colour literal.
 */
import { useEffect, useMemo, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";
import type { HistoryDateMarker } from "@/db/history-read";
import {
  daysInMonth,
  formatDrawerSummary,
  formatWheelDate,
  markerFor,
  parseWheelDate,
  rollDate,
  type WheelDate,
} from "@/components/history/rolodex-logic";
import { RolodexWheel, type WheelItem } from "@/components/history/RolodexWheel";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { SPACING } from "@/theme/tokens/spacing";
import { useTheme } from "@/theme";

/** How many years back the Year wheel browses. Today's year is the max. */
const BROWSE_YEARS_BACK = 30;

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

/** "Sep 11, 2026" from a WheelDate — local parts only (never UTC slicing). */
function formatHumanDate(wd: WheelDate): string {
  return `${MONTHS[wd.month - 1]} ${wd.day}, ${wd.year}`;
}

export interface RolodexBrowserProps {
  /** Plan 03's per-date markers for this contact (date -> marker). */
  markers: ReadonlyMap<string, HistoryDateMarker>;
  /** Today as a local `YYYY-MM-DD` (caller passes `formatLocalDate(new Date())`). */
  today: string;
  /** Initial selected date (local `YYYY-MM-DD`); defaults to today. */
  initialDate?: string;
  /** Open the shared Detail Sheet for a populated date (explicit action only). */
  onSeeDetails: (date: string) => void;
  /** Open the Log Interaction flow for a date (explicit action only). */
  onLogInteraction: (date: string) => void;
  testID?: string;
}

export function RolodexBrowser({
  markers,
  today,
  initialDate,
  onSeeDetails,
  onLogInteraction,
  testID = "rolodex-browser",
}: RolodexBrowserProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotionShared();

  const todayWd = useMemo(() => parseWheelDate(today), [today]);
  const [selected, setSelected] = useState<WheelDate>(() =>
    parseWheelDate(initialDate ?? today),
  );

  // --- Pause-on-blur lifecycle (this component owns it) ----------------------
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [measured, setMeasured] = useState(false);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setAppActive(state === "active");
    });
    return () => subscription.remove();
  }, []);
  const mounted = measured && isFocused && appActive;

  const minYear = todayWd.year - BROWSE_YEARS_BACK;

  const monthItems: WheelItem[] = useMemo(
    () => MONTHS.map((label, i) => ({ key: `m${i}`, label })),
    [],
  );

  const dayItems: WheelItem[] = useMemo(() => {
    const count = daysInMonth(selected.year, selected.month);
    const items: WheelItem[] = [];
    for (let d = 1; d <= count; d++) {
      const date = formatWheelDate({ year: selected.year, month: selected.month, day: d });
      items.push({ key: `d${d}`, label: String(d), marker: markerFor(date, markers) });
    }
    return items;
  }, [selected.year, selected.month, markers]);

  const yearItems: WheelItem[] = useMemo(() => {
    const items: WheelItem[] = [];
    for (let y = minYear; y <= todayWd.year; y++) {
      items.push({ key: `y${y}`, label: String(y) });
    }
    return items;
  }, [minYear, todayWd.year]);

  const stepMonth = (delta: number) =>
    setSelected((prev) => rollDate(prev, "month", delta, todayWd));
  const stepDay = (delta: number) =>
    setSelected((prev) => rollDate(prev, "day", delta, todayWd));
  const stepYear = (delta: number) =>
    setSelected((prev) => rollDate(prev, "year", delta, todayWd));

  const selectedStr = formatWheelDate(selected);
  const marker = markerFor(selectedStr, markers);
  const summary = formatDrawerSummary(marker);

  return (
    <View
      testID={testID}
      style={styles.container}
      onLayout={(e) => {
        if (e.nativeEvent.layout.width > 0) setMeasured(true);
      }}
    >
      {mounted ? (
        <View style={styles.wheels} testID={`${testID}-wheels`}>
          <RolodexWheel
            testID={`${testID}-month`}
            label="Month"
            items={monthItems}
            selectedIndex={selected.month - 1}
            onStep={stepMonth}
            reduced={reduced}
            colors={colors}
          />
          <RolodexWheel
            testID={`${testID}-day`}
            label="Day"
            items={dayItems}
            selectedIndex={selected.day - 1}
            onStep={stepDay}
            reduced={reduced}
            colors={colors}
          />
          <RolodexWheel
            testID={`${testID}-year`}
            label="Year"
            items={yearItems}
            selectedIndex={selected.year - minYear}
            onStep={stepYear}
            reduced={reduced}
            colors={colors}
          />
        </View>
      ) : (
        // Static placeholder while blurred/backgrounded/unmeasured — keeps layout
        // stable and holds NO render loop.
        <View style={styles.wheelsPlaceholder} testID={`${testID}-placeholder`}>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            {formatHumanDate(selected)}
          </AppText>
        </View>
      )}

      {/* Drawer — summarizes the selected date; explicit actions only. */}
      <View
        style={[styles.drawer, { backgroundColor: colors.surface, borderColor: colors.border }]}
        testID={`${testID}-drawer`}
      >
        <AppText role="heading" style={{ color: colors.textPrimary }}>
          {formatHumanDate(selected)}
        </AppText>
        <AppText
          role="caption"
          style={{ color: colors.textSecondary }}
          testID={`${testID}-drawer-summary`}
        >
          {summary.text}
        </AppText>
        {summary.hasRecords ? (
          <Button
            testID={`${testID}-see-details`}
            role="tertiary"
            label="See details"
            onPress={() => onSeeDetails(selectedStr)}
          />
        ) : (
          <Button
            testID={`${testID}-log-interaction`}
            role="primary"
            label="Log interaction"
            onPress={() => onLogInteraction(selectedStr)}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.lg,
  },
  wheels: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  wheelsPlaceholder: {
    minHeight: 44 * 5,
    alignItems: "center",
    justifyContent: "center",
  },
  drawer: {
    gap: SPACING.sm,
    padding: SPACING.base,
    borderWidth: 1,
    borderRadius: SPACING.md,
    alignItems: "flex-start",
  },
});
