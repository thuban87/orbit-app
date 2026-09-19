import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { DigestDayDetail } from "@/components/digest/DigestDayDetail";
import { YourWeekHeatmap } from "@/components/digest/YourWeekHeatmap";
import {
  directDateCounts,
  initialYourWeekState,
  persistYourWeekPeriodAccepted,
  persistYourWeekPeriodRejected,
  reconcileYourWeekRead,
  selectYourWeekDay,
  selectYourWeekPeriod,
  type YourWeekControllerState,
} from "@/components/digest/your-week-section-logic";
import { SegmentedControl } from "@/components/SegmentedControl";
import { AppText } from "@/components/ui/AppText";
import {
  getAppSettings,
  updateAppSettings,
  type YourWeekPeriod,
} from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import {
  readYourWeekDateCounts,
  readYourWeekDay,
  readYourWeekMetrics,
  type YourWeekDayRow,
  type YourWeekMetrics,
} from "@/db/your-week-read";
import {
  buildYourWeekWindow,
  resolveFirstWeekday,
} from "@/services/history/week-window";
import type { HistoryWindow } from "@/services/history/window";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { formatLocalDate } from "@/utils/dates";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "your-week-section";
const PERIOD_OPTIONS: { label: string; value: YourWeekPeriod }[] = [
  { label: "Rolling 7 Days", value: "rolling7" },
  { label: "Calendar Week", value: "calendar_week" },
];
const EMPTY_METRICS: YourWeekMetrics = {
  peopleReached: 0,
  interactions: 0,
  events: 0,
};

interface LoadedWeek {
  window: HistoryWindow;
  metrics: YourWeekMetrics;
  counts: Map<string, number>;
}

export function YourWeekSection() {
  const { colors } = useTheme();
  const [controller, setController] = useState<YourWeekControllerState>(() =>
    initialYourWeekState(),
  );
  const controllerRef = useRef(controller);
  const [loaded, setLoaded] = useState<LoadedWeek | null>(null);
  const [dayRows, setDayRows] = useState<readonly YourWeekDayRow[]>([]);
  const [error, setError] = useState(false);

  const commitController = useCallback((next: YourWeekControllerState) => {
    controllerRef.current = next;
    setController(next);
    return next;
  }, []);

  const loadPeriod = useCallback(
    async (
      period: YourWeekPeriod,
      generation: number,
      cancelled?: () => boolean,
    ) => {
      const today = formatLocalDate(new Date());
      const window = buildYourWeekWindow(period, today, resolveFirstWeekday());
      const exec = getExecutor();
      try {
        const [metrics, rows] = await Promise.all([
          readYourWeekMetrics(exec, window.start, window.end),
          readYourWeekDateCounts(exec, window.start, window.end),
        ]);
        if (cancelled?.()) return;
        const reconciled = reconcileYourWeekRead(
          controllerRef.current,
          generation,
        );
        if (!reconciled.accepted) return;
        commitController(reconciled.state);
        setLoaded({ window, metrics, counts: directDateCounts(window, rows) });
        setError(false);
      } catch (cause) {
        if (cancelled?.() || generation !== controllerRef.current.generation)
          return;
        Logger.error(LOG_SCOPE, "failed to load Your Week", cause);
        setError(true);
      }
    },
    [commitController],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const settings = await getAppSettings(getExecutor());
          if (cancelled) return;
          const base = {
            ...controllerRef.current,
            persistedPeriod: settings.yourWeekPeriod,
          };
          const next = selectYourWeekPeriod(base, settings.yourWeekPeriod);
          commitController(next);
          setDayRows([]);
          await loadPeriod(next.period, next.generation, () => cancelled);
        } catch (cause) {
          if (!cancelled) {
            Logger.error(
              LOG_SCOPE,
              "failed to load Your Week preference",
              cause,
            );
            setError(true);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [commitController, loadPeriod]),
  );

  const onPeriodChange = useCallback(
    async (period: YourWeekPeriod) => {
      if (period === controllerRef.current.period) return;
      const next = selectYourWeekPeriod(controllerRef.current, period);
      commitController(next);
      setDayRows([]);
      setLoaded(null);
      void loadPeriod(period, next.generation);
      try {
        await updateAppSettings(
          getExecutor(),
          { yourWeekPeriod: period },
          localDateTime(),
        );
        commitController(
          persistYourWeekPeriodAccepted(controllerRef.current, next.generation),
        );
      } catch (cause) {
        Logger.error(LOG_SCOPE, "failed to persist Your Week period", cause);
        const rolledBack = persistYourWeekPeriodRejected(
          controllerRef.current,
          next.generation,
        );
        commitController(rolledBack);
        setLoaded(null);
        setDayRows([]);
        void loadPeriod(rolledBack.period, rolledBack.generation);
      }
    },
    [commitController, loadPeriod],
  );

  const onSelectDay = useCallback(
    async (date: string) => {
      commitController(selectYourWeekDay(controllerRef.current, date));
      setDayRows([]);
      try {
        const rows = await readYourWeekDay(getExecutor(), date);
        if (controllerRef.current.selectedDay === date) setDayRows(rows);
      } catch (cause) {
        Logger.error(LOG_SCOPE, "failed to load Your Week day", cause);
      }
    },
    [commitController],
  );

  const metrics = loaded?.metrics ?? EMPTY_METRICS;
  const empty =
    loaded !== null && metrics.interactions === 0 && metrics.events === 0;

  return (
    <View testID="your-week-section" style={styles.container}>
      <AppText accessibilityRole="header" role="heading">
        Your Week
      </AppText>
      <SegmentedControl
        testID="your-week-period"
        options={PERIOD_OPTIONS}
        value={controller.period}
        onChange={(value) => void onPeriodChange(value)}
      />
      <View style={styles.metrics}>
        <Metric label="People reached" value={metrics.peopleReached} />
        <Metric label="Interactions" value={metrics.interactions} />
        <Metric label="Events" value={metrics.events} />
      </View>
      {error ? (
        <View style={styles.message}>
          {/* biome-ignore lint/a11y/useValidAriaRole: AppText role is a typography role. */}
          <AppText role="label">Couldn't load your Digest</AppText>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            Try opening it again in a moment.
          </AppText>
        </View>
      ) : empty ? (
        <View style={styles.message}>
          {/* biome-ignore lint/a11y/useValidAriaRole: AppText role is a typography role. */}
          <AppText role="label">A quiet week</AppText>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            No logged activity in this period yet.
          </AppText>
        </View>
      ) : loaded ? (
        <>
          <YourWeekHeatmap
            window={loaded.window}
            counts={loaded.counts}
            selectedDate={controller.selectedDay}
            onSelectDay={onSelectDay}
          />
          {controller.selectedDay ? (
            <DigestDayDetail date={controller.selectedDay} rows={dayRows} />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel={`${label}, ${value}`}
      style={[styles.metric, { backgroundColor: colors.surface }]}
    >
      {/* biome-ignore lint/a11y/useValidAriaRole: AppText role is a typography role. */}
      <AppText role="body">{value}</AppText>
      {/* biome-ignore lint/a11y/useValidAriaRole: AppText role is a typography role. */}
      <AppText role="label" style={{ color: colors.textSecondary }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.md },
  metrics: { flexDirection: "row", gap: SPACING.sm },
  metric: {
    flex: 1,
    gap: SPACING.xs,
    padding: SPACING.md,
    borderRadius: SPACING.sm,
  },
  message: { gap: SPACING.xs },
});
