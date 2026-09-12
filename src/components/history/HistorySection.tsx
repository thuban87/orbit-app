// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button/AppText `role` is a domain prop, not ARIA.
/**
 * HistorySection (Plan 08, HIST-01/HIST-06/HIST-15/HIST-18) — the assembled
 * Profile History section, mounted by `ProfileModuleHost.renderHistory()` in
 * place of the old vertical-timeline stub.
 *
 * It composes the Plan 05/06/07 presentational children over ONE shared window:
 *   • ActivityHeatmap (count-only, lens-switchable) + its anchored context card
 *   • IntensityChart (window-scoped, neutral)
 *   • RolodexBrowser (three synchronized wheels + summary drawer)
 *   • the shared DateDetailSheet -> InteractionDetail (Edit / hard-delete)
 *
 * It owns the lens/window/cycle-preset state (persisted globally in
 * `app_settings` via the DAO), reads the canonical history once per focus, and
 * wires the cross-surface behaviors:
 *   - a heatmap cell opens the context card FIRST; only its explicit "See
 *     details" opens the shared Detail Sheet, and only "Log interaction" routes
 *     the typed LogContact contract (never auto-opening the sheet, HIST-09/07).
 *   - the browser drawer's "See details"/"Log interaction" do the same.
 *   - the Detail Sheet interleaves the three record families; a tapped
 *     interaction opens InteractionDetail; a knowledge-change row reuses the
 *     profile's EXISTING knowledge nav (decision-preserving, no new cross-stack
 *     target).
 *   - an empty date/cell "Log interaction" navigates the TYPED LogContact
 *     { contactId, prefillDate } route (contact preselected + date prefilled),
 *     NEVER a quick-log payload (HIST-15). Phase 34 fills the real form.
 *
 * The empty-section state ("No history yet") shows ONLY when the contact has none
 * of the three record families — no interactions AND no lifecycle records AND no
 * knowledge changes; a contact with only lifecycle records or only knowledge
 * changes shows the zero-count surfaces instead (Plan 03's `hasLifecycleRecords`
 * + `knowledgeChanges`, via the pure `isEmptyHistory`).
 *
 * DB-through-a-component (the established HomeScreen/InteractionDetail idiom):
 * reads go through the `history-read` DAO and `app-settings-dao`; there is no
 * inline SQL. Local-first: every read is a synchronous on-device SQLite query,
 * no network on the read path. Every colour resolves through theme tokens (the
 * children own their own colours; this shell adds none). Dates are local
 * `YYYY-MM-DD` via `formatLocalDate` — never UTC ISO slicing.
 */
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GroupTitlePromptSheet } from "@/components/group/GroupTitlePromptSheet";
import type { HeatmapCellTarget } from "@/components/history/ActivityHeatmap";
import { ActivityHeatmap } from "@/components/history/ActivityHeatmap";
import { DateDetailSheet } from "@/components/history/DateDetailSheet";
import { HeatmapContextCard } from "@/components/history/HeatmapContextCard";
import {
  buildLogRoute,
  countByCycle,
  isEmptyHistory,
  resolveActiveWindow,
} from "@/components/history/history-section-logic";
import { IntensityChart } from "@/components/history/IntensityChart";
import { InteractionDetail } from "@/components/history/InteractionDetail";
import { RolodexBrowser } from "@/components/history/RolodexBrowser";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import {
  getAppSettings,
  type HistoryCycleCount,
  type HistoryLens,
  updateAppSettings,
} from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { convertInteractionToGroupEvent } from "@/db/group-events-dao";
import { type ContactHistory, readContactHistory } from "@/db/history-read";
import type { ImpactInputs } from "@/db/impact-read";
import type { CurrentStateFieldKey } from "@/db/memory-registry";
import { newUid } from "@/db/uid";
import type { RootStackParamList } from "@/navigation/types";
import { buckets } from "@/services/history/buckets";
import { cycles } from "@/services/history/cycles";
import {
  type IntensityWindowResult,
  intensityWindow,
} from "@/services/history/intensity-window";
import {
  type HistoryWindow,
  nextWindow,
  prevWindow,
} from "@/services/history/window";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { formatLocalDate } from "@/utils/dates";

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

/** "Aug 4" from a local `YYYY-MM-DD` — local parts only (never UTC slicing). */
function humanDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/**
 * A minimal window spanning [start, end] for the cycles lens's Intensity, which
 * has no date grid of its own. `intensityWindow` reads only `start`/`end` (and
 * the contact's interactions), so the `lens`/`cells` here are inert labels.
 */
function spanWindow(start: string, end: string): HistoryWindow {
  return { lens: "7days", ref: end, start, end, cells: [] };
}

/** What the shared Detail Sheet is scoped to (single date -> start==end). */
interface SheetScope {
  readonly title: string;
  readonly start: string;
  readonly end: string;
}

export interface HistorySectionProps {
  contactId: number;
  /** Nullable cadence (null == Unbound / no cadence) — drives Cycles + Intensity. */
  intervalDays: number | null;
  /** 0/1 cadence tracking flag from the contact row. */
  trackingEnabled: number;
  /** The contact's impact inputs (window-scoped Intensity source). */
  impactInputs: ImpactInputs;
  /**
   * Reuse the profile's EXISTING knowledge navigation for a knowledge-change
   * row's edit (decision-preserving — no new cross-stack target introduced).
   */
  onOpenKnowledgeChange: (fieldKey: CurrentStateFieldKey) => void;
  testID?: string;
}

export function HistorySection({
  contactId,
  intervalDays,
  trackingEnabled,
  impactInputs,
  onOpenKnowledgeChange,
  testID = "history-section",
}: HistorySectionProps) {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const today = useMemo(() => formatLocalDate(new Date()), []);

  const [lens, setLens] = useState<HistoryLens>("cycles");
  const [cycleCount, setCycleCount] = useState<HistoryCycleCount>(10);
  const [refDate, setRefDate] = useState(today);
  const [history, setHistory] = useState<ContactHistory | null>(null);

  const [card, setCard] = useState<HeatmapCellTarget | null>(null);
  const [sheet, setSheet] = useState<SheetScope | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [converting, setConverting] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const exec = getExecutor();
    const [settings, next] = await Promise.all([
      getAppSettings(exec),
      readContactHistory(exec, contactId),
    ]);
    setLens(settings.historyLens);
    setCycleCount(settings.historyCycleCount);
    setHistory(next);
  }, [contactId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // --- Persisted lens / preset (global app_settings, never per-contact) ------
  const onLensChange = useCallback(
    (next: HistoryLens) => {
      setLens(next);
      setRefDate(today);
      void updateAppSettings(
        getExecutor(),
        { historyLens: next },
        localDateTime(),
      );
    },
    [today],
  );
  const onPresetChange = useCallback((next: HistoryCycleCount) => {
    setCycleCount(next);
    void updateAppSettings(
      getExecutor(),
      { historyCycleCount: next },
      localDateTime(),
    );
  }, []);

  // --- The one shared window everything reads --------------------------------
  const interactions = useMemo(() => history?.interactions ?? [], [history]);
  const window = resolveActiveWindow(lens, refDate, today);
  const counts = useMemo(
    () => (window ? buckets(window, interactions) : new Map<string, number>()),
    [window, interactions],
  );
  const cyclesResult = useMemo(
    () =>
      cycles({ intervalDays, trackingEnabled, count: cycleCount, now: today }),
    [intervalDays, trackingEnabled, cycleCount, today],
  );
  const cycleCounts = useMemo(
    () =>
      cyclesResult.available
        ? countByCycle(
            cyclesResult.blocks,
            interactions.map((i) => i.date),
          )
        : [],
    [cyclesResult, interactions],
  );
  const intensity: IntensityWindowResult = useMemo(() => {
    const source =
      lens === "cycles"
        ? cyclesResult.available
          ? spanWindow(
              cyclesResult.blocks[0].start,
              cyclesResult.blocks[cyclesResult.blocks.length - 1].end,
            )
          : null
        : window;
    return source
      ? intensityWindow(impactInputs, source)
      : { available: false };
  }, [lens, cyclesResult, window, impactInputs]);

  const onPrev = useCallback(() => {
    if (window) setRefDate(prevWindow(window, today).ref);
  }, [window, today]);
  const onNext = useCallback(() => {
    if (window) setRefDate(nextWindow(window, today).ref);
  }, [window, today]);
  const canGoNext = window ? window.end < today : false;

  // --- Cross-surface routing helpers -----------------------------------------
  const log = useCallback(
    (date: string) => {
      const route = buildLogRoute(contactId, date);
      navigation.navigate(route.screen, route.params);
    },
    [contactId, navigation],
  );
  const openSheetForDate = useCallback((date: string) => {
    setCard(null);
    setSheet({ title: humanDate(date), start: date, end: date });
  }, []);
  const openSheetForCard = useCallback(
    (target: HeatmapCellTarget) => {
      if (target.kind === "date") {
        openSheetForDate(target.date);
      } else {
        setCard(null);
        setSheet({
          title: `${humanDate(target.start)} – ${humanDate(target.end)}`,
          start: target.start,
          end: target.end,
        });
      }
    },
    [openSheetForDate],
  );

  const detailInteraction = interactions.find((i) => i.id === detailId) ?? null;

  // Records scoped to the open sheet (single date or cycle range, inclusive).
  const sheetRecords = useMemo(() => {
    if (!sheet || !history) {
      return { interactions: [], lifecycleEvents: [], knowledgeChanges: [] };
    }
    const inScope = (d: string) => d >= sheet.start && d <= sheet.end;
    return {
      interactions: history.interactions.filter((i) => inScope(i.date)),
      lifecycleEvents: history.lifecycleEvents.filter((e) => inScope(e.date)),
      knowledgeChanges: history.knowledgeChanges.filter((k) => inScope(k.date)),
    };
  }, [sheet, history]);

  if (!history) {
    return (
      <View testID={`${testID}-loading`} style={styles.stack}>
        <AppText role="caption">Loading history…</AppText>
      </View>
    );
  }

  if (isEmptyHistory(history)) {
    return (
      <View testID={`${testID}-empty`} style={styles.empty}>
        <AppText role="heading">No history yet</AppText>
        <AppText role="caption">
          Log an interaction to start seeing activity here.
        </AppText>
        <Button
          role="primary"
          label="Log interaction"
          onPress={() => log(today)}
        />
      </View>
    );
  }

  return (
    <View testID={testID} style={styles.stack}>
      <ActivityHeatmap
        lens={lens}
        cycleCount={cycleCount}
        window={window}
        counts={counts}
        cycles={cyclesResult}
        cycleCounts={cycleCounts}
        onLensChange={onLensChange}
        onPresetChange={onPresetChange}
        onCellPress={setCard}
        onPrev={onPrev}
        onNext={onNext}
        canGoNext={canGoNext}
      />
      {card ? (
        <HeatmapContextCard
          title={
            card.kind === "date"
              ? humanDate(card.date)
              : `${humanDate(card.start)} – ${humanDate(card.end)}`
          }
          count={card.count}
          onSeeDetails={() => openSheetForCard(card)}
          onLog={() => {
            log(card.kind === "date" ? card.date : card.end);
            setCard(null);
          }}
        />
      ) : null}
      <IntensityChart intensity={intensity} />
      <RolodexBrowser
        markers={history.markers}
        today={today}
        onSeeDetails={openSheetForDate}
        onLogInteraction={log}
      />
      <DateDetailSheet
        visible={sheet !== null}
        onRequestClose={() => setSheet(null)}
        title={sheet?.title ?? ""}
        interactions={sheetRecords.interactions}
        lifecycleEvents={sheetRecords.lifecycleEvents}
        knowledgeChanges={sheetRecords.knowledgeChanges}
        onOpenInteraction={(id) => setDetailId(id)}
        onOpenKnowledgeChange={(fieldKey) => {
          setSheet(null);
          onOpenKnowledgeChange(fieldKey);
        }}
        onLogInteraction={sheet ? () => log(sheet.end) : undefined}
      />
      {detailInteraction ? (
        <InteractionDetail
          visible
          onRequestClose={() => setDetailId(null)}
          interaction={detailInteraction}
          contactId={contactId}
          onEdit={() => {
            const interactionId = detailInteraction.id;
            setDetailId(null);
            navigation.navigate("EditInteraction", {
              contactId,
              interactionId,
            });
          }}
          onViewGroupEvent={(groupEventId) => {
            setDetailId(null);
            navigation.navigate("GroupEventDetail", { groupEventId });
          }}
          onEditGroupEvent={(groupEventId) => {
            setDetailId(null);
            navigation.navigate("EditGroupEvent", { groupEventId });
          }}
          onEditParticipant={(
            groupEventId,
            interactionId,
            participantContactId,
          ) => {
            setDetailId(null);
            navigation.navigate("EditParticipant", {
              groupEventId,
              interactionId,
              contactId: participantContactId,
            });
          }}
          onConvertToGroup={() => {
            setConversionError(null);
            setConverting(true);
          }}
          onDeleted={() => {
            setDetailId(null);
            void load();
          }}
        />
      ) : null}
      <GroupTitlePromptSheet
        visible={converting && detailInteraction !== null}
        onRequestClose={() => setConverting(false)}
        error={conversionError}
        onConfirm={(title) => {
          if (!detailInteraction) return;
          void convertInteractionToGroupEvent(getExecutor(), {
            interactionId: detailInteraction.id,
            contactId,
            title,
            uid: newUid(),
            now: localDateTime(),
          })
            .then(({ groupEventId }) => {
              setConverting(false);
              setDetailId(null);
              navigation.navigate("GroupEventDetail", { groupEventId });
            })
            .catch(() =>
              setConversionError(
                "Couldn't create this group event. Please try again.",
              ),
            );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.lg },
  empty: { gap: SPACING.sm },
});
