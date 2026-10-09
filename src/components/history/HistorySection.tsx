// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button/AppText `role` is a domain prop, not ARIA.
/**
 * HistorySection (Plan 08, HIST-01/HIST-06/HIST-15/HIST-18; 38.8) — the
 * assembled Profile History section, mounted by
 * `ProfileModuleHost.renderHistory()` in place of the old vertical-timeline stub.
 *
 * From the top (38.8 D-10), over ONE shared analysis window (ADR-120):
 *   • ActivityHeatmap (count-only, lens-switchable, ADR-119) — the overview —
 *     with the empty-target note directly under it when one is showing;
 *   • IntensityChart (window-scoped, neutral) — the overview;
 *   • 'Jump to date' — the stream header's only control (D-29, D-32): a year
 *     stepper + month grid sheet (JumpToDateSheet, D-48..D-52). A month with
 *     records scrolls the Profile to its header (no highlight); an empty month
 *     shows an explicit state right under the button with tappable nearest
 *     dates and an undated Log (D-17, D-28, D-64, D-65);
 *   • HistoryStream — the contact's actual records, newest first, grouped
 *     year → month → day, with the current year open, older years collapsed
 *     and Show older chunks (38.8 D-14/D-15/D-34..D-39). Records are visible the
 *     moment History opens, with no date pick and no new screen (D-11);
 *   • InteractionDetail (Edit / hard-delete, ADR-122).
 *
 * It owns the lens/window/cycle-preset state (persisted globally in
 * `app_settings` via the DAO) and the stream's transient view state (fresh on
 * each mount, kept across revision re-reads, never persisted — 38.8 D-18/D-62).
 * After an edit, redate or delete started from a row, the re-read keeps the
 * user's place: the Profile keeps its scroll offset, and a one-shot anchor
 * scrolls once to the record's new day or the nearest remaining day only when
 * its day moved or vanished (D-31).
 * It reads the canonical history on mount and on every parent Profile revision
 * (38.3 RG-024, ADR-165 — the Profile snapshot load is the single invalidation
 * owner; Profile focus always produces a revision), and wires the cross-surface
 * behaviors:
 *   - a heatmap day or cycle with records of ANY family jumps: the stream
 *     opens and grows to render the target, the Profile scrolls to it (the
 *     newest record of a span) and its days are highlighted for about five
 *     seconds, announced once to screen readers (38.8 D-19/D-20/D-23/D-53/D-54).
 *     The stream is never filtered and the heatmap window never moves (D-56).
 *   - a truly empty day or span shows a dismissible note under the heatmap
 *     ("Nothing logged on Tue Oct 5"); it clears on close, another heatmap tap,
 *     a lens or preset change and paging, and the stream does not move (D-55).
 *     Its "Log interaction" navigates the TYPED LogContact route: dated for an
 *     empty day, undated for an empty span so the form starts at now
 *     (D-21/D-28), NEVER a quick-log payload (HIST-15).
 *   - a tapped stream interaction opens InteractionDetail; a knowledge-change
 *     row reuses the profile's EXISTING knowledge nav to its MemoryHistory
 *     (decision-preserving, no new cross-stack target); lifecycle rows are
 *     read-only.
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
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GroupTitlePromptSheet } from "@/components/group/GroupTitlePromptSheet";
import { ActivityHeatmap } from "@/components/history/ActivityHeatmap";
import {
  HIGHLIGHT_CLEAR_SLACK_MS,
  HIGHLIGHT_FADE_MS,
} from "@/components/history/HistoryHighlight";
import {
  HistoryStream,
  type HistoryStreamHighlight,
} from "@/components/history/HistoryStream";
import { HistoryTargetNote } from "@/components/history/HistoryTargetNote";
import {
  advanceHistoryDay,
  buildLogRoute,
  countByCycle,
  cyclesNextRef,
  cyclesPrevRef,
  type HistoryReadState,
  historyDayAfterCyclesNext,
  historyDayAfterLensChange,
  historyDayAfterNext,
  historyDayAfterPrev,
  historyReadStateOnFail,
  historyReadStateOnPublish,
  historyReadStateOnStart,
  initialHistoryDayState,
  initialHistoryReadState,
  initialPersistedPref,
  isEmptyHistory,
  type PersistedPref,
  pagedCycles,
  persistedPrefOnRead,
  persistedPrefOnUserChange,
  persistedPrefOnWriteFailed,
  resolveActiveWindow,
} from "@/components/history/history-section-logic";
import {
  buildStreamModel,
  dayAccessibilityLabel,
  dayNodeKey,
  emptyDayNoteText,
  emptyMonthNoteText,
  emptySpanNoteText,
  type HeatmapTarget,
  type HistoryNote,
  type HistoryNoteEvent,
  historyNoteOn,
  historyScrollMode,
  initialStreamState,
  isCurrentScroll,
  monthAnnouncement,
  monthNodeKey,
  nearestDateLabel,
  nearestRemainingDay,
  type PendingHistoryScroll,
  type PendingScrollEvent,
  pendingScrollOn,
  pickerInitialMonth,
  pickerViewportTop,
  recordDay,
  resolveHeatmapTarget,
  resolveMonthJump,
  revealAnnouncement,
  streamStateOnExpandYear,
  streamStateOnReveal,
  streamStateOnShowOlder,
} from "@/components/history/history-stream-logic";
import { IntensityChart } from "@/components/history/IntensityChart";
import { InteractionDetail } from "@/components/history/InteractionDetail";
import { JumpToDateSheet } from "@/components/history/JumpToDateSheet";
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
import { PROFILE_APP_BAR } from "@/screens/contact-profile-logic";
import { buckets } from "@/services/history/buckets";
import {
  type IntensityWindowResult,
  intensityWindow,
} from "@/services/history/intensity-window";
import {
  type HistoryWindow,
  nextWindow,
  prevWindow,
} from "@/services/history/window";
import { useShellTopOffset } from "@/stores/shell-offset-store";
import { SPACING } from "@/theme/tokens/spacing";
import { formatLocalDate } from "@/utils/dates";
import { createLatestRequestAuthority } from "@/utils/latest-request";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "history-section";

/**
 * A heatmap jump whose target measure failed gets ONE retry: on the target's
 * next layout or after this many ms, whichever comes first (38.8 C2-02).
 */
const HISTORY_SCROLL_RETRY_MS = 300;

/**
 * Jump to date waits at most this long for the stream's month headers to
 * report their window position before opening on the current month instead
 * (38.8 D-50; the picker never waits on a header that does not report).
 */
const PICKER_MEASURE_TIMEOUT_MS = 150;

/**
 * A minimal window spanning [start, end] for the cycles lens's Intensity, which
 * has no date grid of its own. `intensityWindow` reads only `start`/`end` (and
 * the contact's interactions), so the `lens`/`cells` here are inert labels.
 */
function spanWindow(start: string, end: string): HistoryWindow {
  return { lens: "7days", ref: end, start, end, cells: [] };
}

export interface HistorySectionProps {
  contactId: number;
  /**
   * The parent Profile's snapshot publication revision (38.3 RG-024). History
   * re-reads whenever it changes (and on mount), so History and the Profile
   * metrics always refresh from the same trigger.
   */
  revision: number;
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
  /**
   * Scroll the Profile to a rendered stream node (38.8 D-19/D-20). The host
   * measures `target` against the History anchor and scrolls only while the
   * request's own `isCurrent()` holds; `onResult` reports a measure success or
   * failure (never called for a stale request).
   */
  onRequestHistoryScroll?: (
    target: View,
    isCurrent: () => boolean,
    onResult: (ok: boolean) => void,
  ) => void;
  testID?: string;
}

export function HistorySection({
  contactId,
  revision,
  intervalDays,
  trackingEnabled,
  impactInputs,
  onOpenKnowledgeChange,
  onRequestHistoryScroll,
  testID = "history-section",
}: HistorySectionProps) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // D-12: `today` + the window reference + the explicit following-today flag,
  // re-evaluated with formatLocalDate() on mount and every parent revision.
  const [day, setDay] = useState(() =>
    initialHistoryDayState(formatLocalDate(new Date())),
  );
  const { today, refDate } = day;

  // 38.3 review A-WR-08: the persisted lens/preset are adopted from reads only
  // while no local choice is outstanding, so a revision re-read that started
  // before the settings write committed can never revert the user's choice.
  // Each pref is mirrored in a ref so handlers read the committed value.
  const [lensPref, setLensPref] = useState<PersistedPref<HistoryLens>>(() =>
    initialPersistedPref<HistoryLens>("cycles"),
  );
  const lensPrefRef = useRef(lensPref);
  const commitLensPref = useCallback((next: PersistedPref<HistoryLens>) => {
    lensPrefRef.current = next;
    setLensPref(next);
  }, []);
  const [cyclePref, setCyclePref] = useState<PersistedPref<HistoryCycleCount>>(
    () => initialPersistedPref<HistoryCycleCount>(10),
  );
  const cyclePrefRef = useRef(cyclePref);
  const commitCyclePref = useCallback(
    (next: PersistedPref<HistoryCycleCount>) => {
      cyclePrefRef.current = next;
      setCyclePref(next);
    },
    [],
  );
  const lens = lensPref.value;
  const cycleCount = cyclePref.value;
  const [readState, setReadState] = useState<HistoryReadState<ContactHistory>>(
    initialHistoryReadState,
  );
  const history = readState.phase === "loaded" ? readState.data : null;

  // The empty-target note under the heatmap (38.8 D-21/D-55), changed only
  // through the pure `historyNoteOn` reducer.
  const [note, setNote] = useState<HistoryNote>(null);
  const dispatchNote = useCallback(
    (event: HistoryNoteEvent) => setNote((n) => historyNoteOn(n, event)),
    [],
  );
  const [detailId, setDetailId] = useState<number | null>(null);
  // The Jump to date picker (38.8 D-17, D-48): open state and the month it
  // opens on. Per-mount view state, never persisted (D-18, D-62).
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpInitialMonth, setJumpInitialMonth] = useState(() =>
    formatLocalDate(new Date()).slice(0, 7),
  );
  // The empty-month state under the Jump to date button (D-17, D-64): the
  // month and its nearest record days. Per-mount view state (D-62).
  const [monthNote, setMonthNote] = useState<{
    monthKey: string;
    before: string | null;
    after: string | null;
  } | null>(null);
  // The Profile app bar's bottom edge in window coordinates: the stream's
  // visible top for the picker's opening month (D-50, C3-02).
  const insets = useSafeAreaInsets();
  const shellTopOffset = useShellTopOffset();
  const appBarBottom = pickerViewportTop({
    insetTop: insets.top,
    shellTopOffset,
    appBarHeight: PROFILE_APP_BAR.height,
  });
  const [converting, setConverting] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);

  // --- Heatmap jump: the one pending scroll (38.8 D-19/D-20, C2-01..C2-03) ---
  // Changed only through `pendingScrollOn`, via `commitPending`, which writes
  // the ref synchronously before setting state: on the new architecture
  // `measureLayout` calls back synchronously, so the host's `isCurrent()` can
  // run inside this section's own layout effect, before any effect-mirrored
  // ref would have updated (C3-06). Never mirrored in an effect.
  const [pending, setPending] = useState<PendingHistoryScroll>(null);
  const pendingRef = useRef<PendingHistoryScroll>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearRetry = useCallback(() => {
    if (retryTimer.current !== null) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, []);
  const commitPending = useCallback(
    (event: PendingScrollEvent) => {
      const previous = pendingRef.current;
      pendingRef.current = pendingScrollOn(previous, event);
      // A replaced or cleared request drops its retry.
      if (pendingRef.current?.gen !== previous?.gen) clearRetry();
      setPending(pendingRef.current);
    },
    [clearRetry],
  );
  // On unmount nothing from this mount is current any more: a late measure
  // callback neither scrolls nor reports, and the retry never fires.
  useEffect(
    () => () => commitPending({ type: "stream-action" }),
    [commitPending],
  );

  // One latest-request authority for this section's reads: an older read never
  // publishes over a newer one, and nothing publishes after unmount.
  const [authority] = useState(createLatestRequestAuthority);
  useEffect(() => () => authority.invalidate(), [authority]);

  const load = useCallback(async () => {
    const token = authority.begin();
    setReadState(historyReadStateOnStart);
    try {
      const exec = getExecutor();
      const [settings, next] = await Promise.all([
        getAppSettings(exec),
        readContactHistory(exec, contactId),
      ]);
      if (!authority.isCurrent(token)) return;
      commitLensPref(
        persistedPrefOnRead(lensPrefRef.current, settings.historyLens),
      );
      commitCyclePref(
        persistedPrefOnRead(cyclePrefRef.current, settings.historyCycleCount),
      );
      setReadState((current) => historyReadStateOnPublish(current, next));
    } catch {
      if (!authority.isCurrent(token)) return;
      // Content-free: no contact data in the log line.
      Logger.error(LOG_SCOPE, "failed to read contact history");
      setReadState(historyReadStateOnFail);
    }
  }, [authority, commitCyclePref, commitLensPref, contactId]);

  // Revision-driven read (38.3 RG-024): runs on mount (which also covers
  // expand-after-collapse) and on every parent Profile publication. There is
  // no independent focus read — the parent's focus load produces the revision.
  // The same moment re-evaluates "today" (D-12): a following view advances to
  // the new day, a picked past window stays put. No timer (D-22).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `revision` is the re-read trigger.
  useEffect(() => {
    setDay((current) =>
      advanceHistoryDay(current, formatLocalDate(new Date())),
    );
    void load();
  }, [load, revision]);

  // --- Persisted lens / preset (global app_settings, never per-contact) ------
  // A failed write logs content-free and reverts explicitly (never silently via
  // a later re-read), unless a newer choice has superseded it.
  const onLensChange = useCallback(
    (next: HistoryLens) => {
      const previous = lensPrefRef.current.value;
      const changed = persistedPrefOnUserChange(lensPrefRef.current, next);
      commitLensPref(changed);
      commitPending({ type: "stream-action" });
      dispatchNote({ type: "lens-change" });
      setDay(historyDayAfterLensChange);
      updateAppSettings(
        getExecutor(),
        { historyLens: next },
        localDateTime(),
      ).catch(() => {
        Logger.error(LOG_SCOPE, "failed to persist history lens");
        commitLensPref(
          persistedPrefOnWriteFailed(
            lensPrefRef.current,
            changed.userGen,
            previous,
          ),
        );
      });
    },
    [commitLensPref, commitPending, dispatchNote],
  );
  const onPresetChange = useCallback(
    (next: HistoryCycleCount) => {
      const previous = cyclePrefRef.current.value;
      const changed = persistedPrefOnUserChange(cyclePrefRef.current, next);
      commitCyclePref(changed);
      commitPending({ type: "stream-action" });
      dispatchNote({ type: "preset-change" });
      updateAppSettings(
        getExecutor(),
        { historyCycleCount: next },
        localDateTime(),
      ).catch(() => {
        Logger.error(LOG_SCOPE, "failed to persist history cycle preset");
        commitCyclePref(
          persistedPrefOnWriteFailed(
            cyclePrefRef.current,
            changed.userGen,
            previous,
          ),
        );
      });
    },
    [commitCyclePref, commitPending, dispatchNote],
  );

  // --- The one shared window everything reads --------------------------------
  const interactions = useMemo(() => history?.interactions ?? [], [history]);
  const window = resolveActiveWindow(lens, refDate, today);
  const counts = useMemo(
    () => (window ? buckets(window, interactions) : new Map<string, number>()),
    [window, interactions],
  );
  // The displayed Cycles page (38.8 D-25/D-26): the current-cadence series
  // ending at the paged reference date; a day lens reads the current page.
  const cyclesRef = lens === "cycles" ? refDate : today;
  const cyclesResult = useMemo(
    () =>
      pagedCycles({
        intervalDays,
        trackingEnabled,
        count: cycleCount,
        today,
        refDate: cyclesRef,
      }),
    [intervalDays, trackingEnabled, cycleCount, today, cyclesRef],
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

  // Paging (D-25): a day lens steps one window; Cycles steps one whole
  // displayed page (the preset count), and next stops at the page ending
  // today. Every branch is a stream action and clears the note (D-55, C3-05).
  const onPrev = useCallback(() => {
    commitPending({ type: "stream-action" });
    dispatchNote({ type: "page" });
    if (lens === "cycles") {
      if (cyclesResult.available) {
        setDay(historyDayAfterPrev(day, cyclesPrevRef(cyclesResult.blocks)));
      }
      return;
    }
    if (window) setDay(historyDayAfterPrev(day, prevWindow(window, today).ref));
  }, [commitPending, dispatchNote, cyclesResult, day, lens, window, today]);
  const onNext = useCallback(() => {
    commitPending({ type: "stream-action" });
    dispatchNote({ type: "page" });
    if (lens === "cycles") {
      if (cyclesResult.available && intervalDays !== null) {
        setDay(
          historyDayAfterCyclesNext(
            day,
            cyclesNextRef({
              refDate: day.refDate,
              intervalDays,
              count: cycleCount,
              today,
            }),
          ),
        );
      }
      return;
    }
    if (window) {
      setDay(
        historyDayAfterNext(day, window.lens, nextWindow(window, today).ref),
      );
    }
  }, [
    commitPending,
    dispatchNote,
    cycleCount,
    cyclesResult,
    day,
    intervalDays,
    lens,
    window,
    today,
  ]);
  const canGoNext =
    lens === "cycles"
      ? cyclesResult.available && refDate < today
      : window
        ? window.end < today
        : false;

  // --- Cross-surface routing helpers -----------------------------------------
  // A dated Log prefills that day; an undated one starts at now (D-21/D-28).
  const log = useCallback(
    (date?: string) => {
      const route = buildLogRoute(contactId, date);
      navigation.navigate(route.screen, route.params);
    },
    [contactId, navigation],
  );

  const detailInteraction = interactions.find((i) => i.id === detailId) ?? null;

  // --- The stream (38.8 D-10/D-14/D-15/D-62) ---------------------------------
  // The model is derived from the loaded history and today; the view state
  // (open years, Show older chunks) is created fresh on each mount and is NOT
  // reset by Profile-revision re-reads while mounted (D-31). Never persisted
  // (D-18). Both hooks sit above the early returns below (hook order).
  const streamModel = useMemo(
    () => (history ? buildStreamModel(history, today) : null),
    [history, today],
  );
  const [streamState, setStreamState] = useState(initialStreamState);

  // --- Heatmap → stream jump (38.8 D-19/D-20; RESEARCH Pattern 3 Timing) -----
  // Rendered day groups register here (a null node unregisters). A jump to a
  // target that is already rendered scrolls from the layout effect below once
  // the reveal commits (the reveal only grows content below it); a target not
  // yet rendered scrolls from its own first layout. Each request carries this
  // mount's own generation, so a fresh mount (History collapse/reopen, a
  // contact change) never inherits staleness. None of this writes `day` — the
  // heatmap/Intensity window — (D-56).
  const nodeRegistry = useRef(new Map<string, View>());
  const registerNode = useCallback((key: string, node: View | null) => {
    if (node) nodeRegistry.current.set(key, node);
    else nodeRegistry.current.delete(key);
  }, []);
  const genRef = useRef(0);
  // The last issued attempt (`gen:attempt`), so one attempt is issued once.
  const issuedRef = useRef<string | null>(null);
  const issueScroll = useCallback(
    function issue(request: NonNullable<PendingHistoryScroll>) {
      const attempt = `${request.gen}:${request.retried ? 1 : 0}`;
      if (issuedRef.current === attempt) return;
      issuedRef.current = attempt;
      clearRetry();
      const { gen } = request;
      const onResult = (ok: boolean) => {
        commitPending({ type: "result", gen, ok });
        const next = pendingRef.current;
        // The first failure arms the single retry: the target's next layout
        // (`onNodeLayout`) or this timer, whichever comes first. One plain
        // timeout, not an animation or per-frame state timer.
        if (!ok && next?.gen === gen && next.retried) {
          clearRetry();
          retryTimer.current = setTimeout(() => {
            retryTimer.current = null;
            const current = pendingRef.current;
            if (current?.gen === gen && current.retried) issue(current);
          }, HISTORY_SCROLL_RETRY_MS);
        }
      };
      const node = nodeRegistry.current.get(request.key);
      if (!node || !onRequestHistoryScroll) {
        onResult(false);
        return;
      }
      onRequestHistoryScroll(
        node,
        () => isCurrentScroll(pendingRef.current, gen),
        onResult,
      );
    },
    [clearRetry, commitPending, onRequestHistoryScroll],
  );
  // `immediate`: the target was already rendered, so scroll right after the
  // reveal commits. A retried request is never re-issued from here.
  useLayoutEffect(() => {
    if (
      pending !== null &&
      pending === pendingRef.current &&
      pending.mode === "immediate" &&
      !pending.retried
    ) {
      issueScroll(pending);
    }
  }, [pending, issueScroll]);
  // `await-layout`: the target has just laid out (the Profile content now
  // includes it). Also the first chance for a retry after a failed measure.
  const onNodeLayout = useCallback(
    (key: string) => {
      const current = pendingRef.current;
      if (!current || current.key !== key) return;
      if (current.mode === "await-layout" || current.retried) {
        issueScroll(current);
      }
    },
    [issueScroll],
  );
  // The jump highlight (D-53/D-54): set once per jump, keyed by its generation,
  // and cleared once after the fade by one timeout per generation, so a later
  // revision re-read never replays it. The fade itself is a Reanimated shared
  // value inside HistoryHighlight.
  const [highlight, setHighlight] = useState<HistoryStreamHighlight | null>(
    null,
  );
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (highlightTimer.current !== null) clearTimeout(highlightTimer.current);
    },
    [],
  );
  const showHighlight = useCallback((days: readonly string[], gen: number) => {
    setHighlight({ days: new Set(days), gen });
    if (highlightTimer.current !== null) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => {
      highlightTimer.current = null;
      setHighlight((current) => (current?.gen === gen ? null : current));
    }, HIGHLIGHT_FADE_MS + HIGHLIGHT_CLEAR_SLACK_MS);
  }, []);
  // Every heatmap tap resolves against the all-family day index (D-21): a
  // populated target jumps, an empty one shows the note and leaves the stream
  // alone. Any tap clears the previous note (and the empty-month state, C4-03)
  // and replaces any pending jump. A nearest-date jump from the empty-month
  // state runs this same handler (D-65).
  const onCellPress = useCallback(
    (target: HeatmapTarget) => {
      setMonthNote(null);
      if (streamModel) {
        const resolution = resolveHeatmapTarget(streamModel, target);
        dispatchNote({ type: "heatmap", resolution });
        if (resolution.kind === "reveal") {
          const key = dayNodeKey(resolution.scrollDay);
          // Read before the reveal update: not yet rendered = await its layout.
          const mode = historyScrollMode(nodeRegistry.current, key);
          genRef.current += 1;
          const gen = genRef.current;
          setStreamState((s) =>
            streamStateOnReveal(s, streamModel, resolution.days),
          );
          commitPending(
            onRequestHistoryScroll
              ? { type: "request", key, gen, mode }
              : { type: "stream-action" },
          );
          showHighlight(resolution.highlightDays, gen);
          // Once per jump; no live region on the rows, so focus stays put (D-23).
          AccessibilityInfo.announceForAccessibility(
            revealAnnouncement(resolution, today),
          );
          return;
        }
      }
      commitPending({ type: "stream-action" });
    },
    [
      commitPending,
      dispatchNote,
      onRequestHistoryScroll,
      showHighlight,
      streamModel,
      today,
    ],
  );
  const closeNote = useCallback(() => {
    commitPending({ type: "stream-action" });
    dispatchNote({ type: "close" });
  }, [commitPending, dispatchNote]);

  // --- Jump to date (38.8 D-17, D-48..D-52) ----------------------------------
  // Opening the picker is a stream action: it drops any pending jump scroll and
  // its retry (C2-03). It opens on the month in view (D-50, Pattern 5): each
  // rendered month header is measured in window coordinates, and the picker
  // opens once every header has reported, or on the current month after
  // PICKER_MEASURE_TIMEOUT_MS. Under D-32's non-sticky button this is the
  // current month in practice (D-68, accepted).
  const measureToken = useRef(0);
  const measureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      measureToken.current += 1;
      if (measureTimer.current !== null) clearTimeout(measureTimer.current);
    },
    [],
  );
  const openJump = useCallback(() => {
    commitPending({ type: "stream-action" });
    const currentMonth = today.slice(0, 7);
    measureToken.current += 1;
    const token = measureToken.current;
    if (measureTimer.current !== null) clearTimeout(measureTimer.current);
    measureTimer.current = null;
    const open = (monthKey: string) => {
      if (measureToken.current !== token) return;
      measureToken.current += 1;
      if (measureTimer.current !== null) clearTimeout(measureTimer.current);
      measureTimer.current = null;
      setJumpInitialMonth(monthKey);
      setJumpOpen(true);
    };
    const headers = [...nodeRegistry.current.entries()].filter(
      ([key, node]) =>
        key.startsWith("month:") && typeof node.measureInWindow === "function",
    );
    if (headers.length === 0) {
      open(currentMonth);
      return;
    }
    const entries: { monthKey: string; windowY: number }[] = [];
    let reported = 0;
    measureTimer.current = setTimeout(() => {
      measureTimer.current = null;
      open(currentMonth);
    }, PICKER_MEASURE_TIMEOUT_MS);
    for (const [key, node] of headers) {
      node.measureInWindow((_x, y) => {
        if (measureToken.current !== token) return;
        // A header that reports no position is skipped.
        if (Number.isFinite(y)) {
          entries.push({ monthKey: key.slice("month:".length), windowY: y });
        }
        reported += 1;
        if (reported === headers.length) {
          open(pickerInitialMonth(entries, appBarBottom, currentMonth));
        }
      });
    }
  }, [appBarBottom, commitPending, today]);
  // A month with records opens and grows the stream until its header renders,
  // then scrolls the Profile to that header — no highlight (D-17). A month
  // with no record issues no scroll and shows the empty-month state under the
  // Jump to date button (D-64). Choosing a month replaces any earlier state.
  const onSelectMonth = useCallback(
    (monthKey: string) => {
      setJumpOpen(false);
      setMonthNote(null);
      if (!streamModel) return;
      const jump = resolveMonthJump(streamModel, monthKey);
      if (jump.kind !== "reveal-month") {
        commitPending({ type: "stream-action" });
        setMonthNote({
          monthKey: jump.monthKey,
          before: jump.before,
          after: jump.after,
        });
        return;
      }
      const key = monthNodeKey(monthKey);
      // Read before the reveal update: not yet rendered = await its layout.
      const mode = historyScrollMode(nodeRegistry.current, key);
      genRef.current += 1;
      const gen = genRef.current;
      setStreamState((s) => streamStateOnReveal(s, streamModel, jump.days));
      commitPending(
        onRequestHistoryScroll
          ? { type: "request", key, gen, mode }
          : { type: "stream-action" },
      );
      AccessibilityInfo.announceForAccessibility(monthAnnouncement(monthKey));
    },
    [commitPending, onRequestHistoryScroll, streamModel],
  );
  const closeMonthNote = useCallback(() => {
    commitPending({ type: "stream-action" });
    setMonthNote(null);
  }, [commitPending]);
  // A nearest date jumps and highlights exactly as a heatmap day tap does
  // (D-65); that handler also clears the empty-month state.
  const onNearest = useCallback(
    (date: string) => onCellPress({ kind: "date", date }),
    [onCellPress],
  );

  // --- Keeping the user's place (38.8 D-31, RESEARCH Pattern 7) ---------------
  // The Profile ScrollView keeps its numeric offset across the revision
  // re-read (the stream never swaps to a loading state over loaded rows), so
  // an ordinary refresh leaves the user where they were. On top of that, a
  // one-shot anchor is set ONLY when a row opens InteractionDetail or
  // MemoryHistory (never by a jump) and consumed by the first newly published
  // history read after it — a new `history` object, so a today-only model
  // rebuild across midnight does not use it up (C2-06):
  //   • the opened record moved to a newer day (content inserted above it):
  //     scroll once to its new day;
  //   • else the anchored day is gone (a delete or a redate emptied it): scroll
  //     once to the nearest remaining day;
  //   • otherwise nothing. No highlight, no announcement, never persisted
  //     (D-62). A failed delete keeps its row and InteractionDetail's own
  //     retry; nothing is removed optimistically.
  const anchorRef = useRef<{ day: string; recordKey: string | null } | null>(
    null,
  );
  const lastHistoryRef = useRef<ContactHistory | null>(null);
  const onOpenInteraction = useCallback((id: number, date: string) => {
    anchorRef.current = { day: date, recordKey: `interaction-${id}` };
    setDetailId(id);
  }, []);
  // A knowledge row anchors its day only (MemoryHistory edits a field, not
  // this record).
  const onOpenKnowledgeRow = useCallback(
    (fieldKey: CurrentStateFieldKey, date: string) => {
      anchorRef.current = { day: date, recordKey: null };
      onOpenKnowledgeChange(fieldKey);
    },
    [onOpenKnowledgeChange],
  );
  useEffect(() => {
    if (history === lastHistoryRef.current) return;
    lastHistoryRef.current = history;
    const anchor = anchorRef.current;
    if (!history || !anchor || !streamModel) return;
    anchorRef.current = null;
    const moved =
      anchor.recordKey === null
        ? null
        : recordDay(streamModel, anchor.recordKey);
    let target: string | null = null;
    if (moved !== null && moved > anchor.day) target = moved;
    else if (!streamModel.dayIndex.has(anchor.day)) {
      target = nearestRemainingDay(streamModel, anchor.day);
    }
    if (target === null) return;
    const day = target;
    const key = dayNodeKey(day);
    // Read before the reveal update: not yet rendered = await its layout.
    const mode = historyScrollMode(nodeRegistry.current, key);
    genRef.current += 1;
    const gen = genRef.current;
    setStreamState((s) => streamStateOnReveal(s, streamModel, [day]));
    commitPending(
      onRequestHistoryScroll
        ? { type: "request", key, gen, mode }
        : { type: "stream-action" },
    );
  }, [commitPending, history, onRequestHistoryScroll, streamModel]);

  if (readState.phase === "error") {
    return (
      <View testID={`${testID}-error`} style={styles.empty}>
        <AppText role="caption">Couldn't load history</AppText>
        <Button
          role="tertiary"
          label="Retry"
          accessibilityLabel="Retry loading history"
          onPress={() => void load()}
        />
      </View>
    );
  }

  if (!history) {
    return (
      <View testID={`${testID}-loading`} style={styles.stack}>
        <AppText role="caption">Loading history…</AppText>
      </View>
    );
  }

  const refreshNotice =
    readState.phase === "loaded" && readState.refreshError ? (
      <View testID={`${testID}-refresh-error`} style={styles.notice}>
        <AppText role="caption">Couldn't refresh history</AppText>
        <Button
          role="tertiary"
          label="Retry"
          accessibilityLabel="Retry refreshing history"
          onPress={() => void load()}
        />
      </View>
    ) : null;

  if (isEmptyHistory(history)) {
    return (
      <View testID={`${testID}-empty`} style={styles.empty}>
        {refreshNotice}
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
      {refreshNotice}
      <ActivityHeatmap
        lens={lens}
        cycleCount={cycleCount}
        window={window}
        counts={counts}
        cycles={cyclesResult}
        cycleCounts={cycleCounts}
        onLensChange={onLensChange}
        onPresetChange={onPresetChange}
        onCellPress={onCellPress}
        onPrev={onPrev}
        onNext={onNext}
        canGoNext={canGoNext}
      />
      {note ? (
        <HistoryTargetNote
          text={
            note.kind === "empty-day"
              ? emptyDayNoteText(note.date)
              : emptySpanNoteText(note.start, note.end)
          }
          // Dated for an empty day; an empty span carries no date (D-28). The
          // note closes as Log opens, so it never survives the new record.
          onLog={() => {
            closeNote();
            if (note.kind === "empty-day") log(note.date);
            else log();
          }}
          onClose={closeNote}
        />
      ) : null}
      <IntensityChart intensity={intensity} />
      {streamModel ? (
        // The stream header's only control (D-29, D-32, D-51): directly above
        // the first record, below Intensity; nothing is sticky.
        <View style={styles.jumpRow}>
          <Button
            role="secondary"
            label="Jump to date"
            testID="history-jump"
            onPress={openJump}
          />
        </View>
      ) : null}
      {monthNote ? (
        // The empty-month state: directly under Jump to date, above the stream,
        // never in the heatmap note slot (D-64). Nearest dates: after first.
        <HistoryTargetNote
          testID="history-month-note"
          text={emptyMonthNoteText(monthNote.monthKey)}
          nearest={[monthNote.after, monthNote.before]
            .filter((date): date is string => date !== null)
            .map((date) => ({
              date,
              label: nearestDateLabel(date),
              accessibilityLabel: `Jump to ${dayAccessibilityLabel(date, today)}`,
            }))}
          onNearest={onNearest}
          // Undated (D-28): the Log form starts at now. The state closes as
          // Log opens, so it never survives the new record.
          onLog={() => {
            closeMonthNote();
            const route = buildLogRoute(contactId);
            navigation.navigate(route.screen, route.params);
          }}
          onClose={closeMonthNote}
        />
      ) : null}
      {streamModel ? (
        <HistoryStream
          model={streamModel}
          state={streamState}
          onExpandYear={(year) => {
            commitPending({ type: "stream-action" });
            setStreamState((s) => streamStateOnExpandYear(s, year));
          }}
          onShowOlder={(year) => {
            commitPending({ type: "stream-action" });
            setStreamState((s) => streamStateOnShowOlder(s, streamModel, year));
          }}
          onOpenInteraction={onOpenInteraction}
          onOpenKnowledgeChange={onOpenKnowledgeRow}
          registerNode={registerNode}
          onNodeLayout={onNodeLayout}
          highlight={highlight}
        />
      ) : null}
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
          // Close only: InteractionDetail publishes the shell tick, which
          // reloads the Profile snapshot, whose revision re-reads History — one
          // trigger for every projection (architecture/AUD-ARCH-004).
          onDeleted={() => setDetailId(null)}
        />
      ) : null}
      {streamModel ? (
        <JumpToDateSheet
          visible={jumpOpen}
          onRequestClose={() => setJumpOpen(false)}
          model={streamModel}
          initialMonthKey={jumpInitialMonth}
          onSelectMonth={onSelectMonth}
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
  jumpRow: { alignItems: "flex-end" },
  notice: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
});
