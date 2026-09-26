import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { DigestDayDetail } from "@/components/digest/DigestDayDetail";
import { YourWeekHeatmap } from "@/components/digest/YourWeekHeatmap";
import {
  beginYourWeekPeriodWrite,
  clearDayDetail,
  createYourWeekPeriodReader,
  directDateCounts,
  failDayRead,
  initialYourWeekState,
  persistYourWeekPeriodAccepted,
  persistYourWeekPeriodRejected,
  resolveYourWeekRefreshPeriod,
  retainYourWeekDay,
  selectYourWeekDay,
  settleDayRead,
  startDayRead,
  type YourWeekControllerState,
  type YourWeekDayDetail,
  type YourWeekPeriodReader,
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
import { createLatestRequestAuthority } from "@/utils/latest-request";
import { Logger } from "@/utils/logger";
import { applyUatFault } from "@/utils/uat-faults";

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

/**
 * Your Week (Digest's third module). Digest is the single trigger owner
 * (38.3 RG-026): this section re-reads when Digest's `refreshSignal` changes —
 * once per accepted Digest focus / shell tick / post-sweep foreground tick —
 * and on mount. It has no focus effect of its own.
 */
export function YourWeekSection({ refreshSignal }: { refreshSignal: number }) {
  const { colors } = useTheme();
  const [controller, setController] = useState<YourWeekControllerState>(() =>
    initialYourWeekState(),
  );
  const controllerRef = useRef(controller);
  const [loaded, setLoaded] = useState<LoadedWeek | null>(null);
  const [dayDetail, setDayDetail] = useState<YourWeekDayDetail>(clearDayDetail);
  const dayDetailRef = useRef(dayDetail);
  const [error, setError] = useState(false);

  const commitController = useCallback((next: YourWeekControllerState) => {
    controllerRef.current = next;
    setController(next);
    return next;
  }, []);

  const commitDayDetail = useCallback((next: YourWeekDayDetail) => {
    dayDetailRef.current = next;
    setDayDetail(next);
  }, []);

  // ONE request authority for every period read (refresh signal, toggle,
  // rollback): the most recently begun read wins; the generation check inside
  // the reader keeps its period-intent role.
  const readerRef = useRef<YourWeekPeriodReader<LoadedWeek> | null>(null);
  if (readerRef.current === null) {
    readerRef.current = createYourWeekPeriodReader<LoadedWeek>({
      getState: () => controllerRef.current,
      accept: (state, week) => {
        commitController(state);
        setLoaded(week);
        setError(false);
      },
      fail: (cause) => {
        Logger.error(LOG_SCOPE, "failed to load Your Week", cause);
        setError(true);
      },
    });
  }
  const reader = readerRef.current;
  useEffect(() => () => reader.invalidate(), [reader]);

  const loadPeriod = useCallback(
    (period: YourWeekPeriod, generation: number, window?: HistoryWindow) => {
      const target =
        window ??
        buildYourWeekWindow(
          period,
          formatLocalDate(new Date()),
          resolveFirstWeekday(),
        );
      return reader.load(generation, async () => {
        const exec = getExecutor();
        const [metrics, rows] = await Promise.all([
          readYourWeekMetrics(exec, target.start, target.end),
          readYourWeekDateCounts(exec, target.start, target.end),
        ]);
        return {
          window: target,
          metrics,
          counts: directDateCounts(target, rows),
        };
      });
    },
    [reader],
  );

  // Day-detail reads (38.3 D-16, closes Phase 38 WR-01). A tap, Retry and a
  // refresh that retained the day ALL start a fresh request here, so the stale
  // guard is request-scoped: an older read for any date — including the same
  // date — can never publish rows or an error over a newer one. A pending or
  // failed read renders as loading/error, never as "No activity".
  const dayAuthorityRef = useRef<ReturnType<
    typeof createLatestRequestAuthority
  > | null>(null);
  if (dayAuthorityRef.current === null) {
    dayAuthorityRef.current = createLatestRequestAuthority();
  }
  const dayAuthority = dayAuthorityRef.current;
  useEffect(() => () => dayAuthority.invalidate(), [dayAuthority]);

  const loadDay = useCallback(
    async (date: string) => {
      const token = dayAuthority.begin();
      commitDayDetail(startDayRead(dayDetailRef.current, date, token));
      try {
        // Debug-only one-shot delay/reject for Plan 16's device rows; inert
        // (resolves immediately) outside __DEV__.
        await applyUatFault("digest-day-read");
        const rows = await readYourWeekDay(getExecutor(), date);
        if (!dayAuthority.isCurrent(token)) return;
        commitDayDetail(settleDayRead(dayDetailRef.current, token, rows));
      } catch (cause) {
        Logger.error(LOG_SCOPE, "failed to load Your Week day", cause);
        if (!dayAuthority.isCurrent(token)) return;
        commitDayDetail(failDayRead(dayDetailRef.current, token));
      }
    },
    [commitDayDetail, dayAuthority],
  );

  // Selection cleared (period change, rollback, day outside the new window):
  // retire any outstanding day read and return to idle.
  const clearDay = useCallback(() => {
    dayAuthority.invalidate();
    commitDayDetail(clearDayDetail());
  }, [commitDayDetail, dayAuthority]);

  // Digest-owned refresh (RG-026): on mount and on every `refreshSignal`
  // change. Keeps the chosen period and re-windows to today (D-15), adopting a
  // Settings-changed period only when no toggle is in flight (Pitfall 5). No
  // timer detects the new day — the signal does (D-22).
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshSignal is the Digest-owned trigger; each change re-runs this read.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const readGeneration = controllerRef.current.generation;
      let persistedFromDb: YourWeekPeriod;
      try {
        persistedFromDb = (await getAppSettings(getExecutor())).yourWeekPeriod;
      } catch (cause) {
        if (!cancelled) {
          Logger.error(LOG_SCOPE, "failed to load Your Week preference", cause);
          setError(true);
        }
        return;
      }
      if (cancelled) return;
      const resolved = resolveYourWeekRefreshPeriod(
        controllerRef.current,
        persistedFromDb,
        readGeneration,
      );
      const window = buildYourWeekWindow(
        resolved.state.period,
        formatLocalDate(new Date()),
        resolveFirstWeekday(),
      );
      const next = commitController(retainYourWeekDay(resolved.state, window));
      if (next.selectedDay === null) {
        clearDay();
      } else {
        void loadDay(next.selectedDay);
      }
      await loadPeriod(next.period, next.generation, window);
    })();
    return () => {
      cancelled = true;
    };
  }, [clearDay, commitController, loadDay, loadPeriod, refreshSignal]);

  const onPeriodChange = useCallback(
    async (period: YourWeekPeriod) => {
      if (period === controllerRef.current.period) return;
      const next = beginYourWeekPeriodWrite(controllerRef.current, period);
      commitController(next);
      clearDay();
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
        clearDay();
        void loadPeriod(rolledBack.period, rolledBack.generation);
      }
    },
    [clearDay, commitController, loadPeriod],
  );

  const onSelectDay = useCallback(
    async (date: string) => {
      commitController(selectYourWeekDay(controllerRef.current, date));
      await loadDay(date);
    },
    [commitController, loadDay],
  );

  // Retry re-reads the selected day with a NEW request (same date, new token).
  const onRetryDay = useCallback(() => {
    const date = controllerRef.current.selectedDay;
    if (date !== null) void loadDay(date);
  }, [loadDay]);

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
          {controller.selectedDay !== null && dayDetail.status !== "idle" ? (
            <DigestDayDetail
              date={dayDetail.date}
              state={dayDetail}
              onRetry={onRetryDay}
            />
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
