/**
 * HomeScreen — the dashboard CORE (DASH-01/03/04/05/07). This IS the app's home
 * surface: the Phase 25 query-state population (`listDashboardPopulation`, or
 * `listDashboardSearch` when a term is present) rendered as ListRows or a CardGrid,
 * the contact-count header, the Population/Filters/Sort control row, the Row 3
 * collapsible session-backed search + List/Card toggle, a reliable freshness
 * path, and cause-aware empty/error states.
 *
 * FRESHNESS (DASH-07 / threat T-08-18): the list re-queries on `useFocusEffect`,
 * on an `AppState`→"active" listener, and via pull-to-refresh. It deliberately
 * does NOT subscribe to the connection-scoped SQLite change notification — that
 * mechanism is bound to this screen's own DB connection and is structurally blind
 * to the headless widget / notification "mark contacted" writes that happen on a
 * different connection, so it would silently miss cross-context updates. Focus +
 * foreground + pull is the only path that reflects those writes.
 *
 * READS (threat T-08-16/17): every read is async on-device SQLite (the D-12
 * `listDashboardPopulation` / `listDashboardSearch` read + the counts via
 * `getExecutor()`) guarded by a `cancelled` flag so a stale
 * async result can never clobber a newer one; no network sits on the read path,
 * and the DAO already scopes off_limits / unconfirmed-ai / archived rows in-query
 * (this screen performs no `.filter()` on private data).
 *
 * The empty-state decision is delegated to the pure, node-tested
 * `selectDashboardEmptyState` (08-07 Task 1) — no inline count arithmetic here
 * (review HIGH-2): first-run fires ONLY when all four populations are empty, so a
 * never-contacted-only or snoozed-only user gets the hidden-population pointer,
 * never "Add your first contact".
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AccessibilityInfo,
  Alert,
  AppState,
  BackHandler,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { useShallow } from "zustand/react/shallow";
import { BulkActionSurface } from "@/components/BulkActionSurface";
import { CardContextMenu } from "@/components/CardContextMenu";
import { CardGrid } from "@/components/CardGrid";
import { ListRow, type ListRowProps } from "@/components/ListRow";
import {
  PostLogNoteEditor,
  type PostLogNoteTarget,
} from "@/components/PostLogNoteEditor";
import { POPULATION_LABELS } from "@/components/control-surface/control-labels";
import { DashboardControlRow } from "@/components/control-surface/DashboardControlRow";
import { DashboardOverlayHost } from "@/components/control-surface/DashboardOverlayHost";
import { Icon } from "@/components/icons/Icon";
import { ICON_REGISTRY, type IconName } from "@/components/icons/icon-registry";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ShellAppBar } from "@/components/ShellAppBar";
import { ChromeScrim } from "@/components/ui/ChromeScrim";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Sheet } from "@/components/ui/Sheet";
import {
  bulkAddFavourites,
  bulkArchive,
  bulkQuickLog,
  bulkRemoveFavourites,
  bulkSetCategory,
  bulkSetFrequency,
  bulkSnooze,
  bulkUnsnooze,
  undoBulkQuickLog,
} from "@/db/bulk-actions-dao";
import { listCategories } from "@/db/contact-read";
import {
  countAllContacts,
  countArchived,
  countBirthdayPopulation,
  countFavourites,
  countLiveContacts,
  countNeverContacted,
  countSnoozed,
  type DashboardRow,
  listDashboardPopulation,
  listDashboardSearch,
} from "@/db/dashboard-read";
import { composeDashboardSearch } from "@/db/dashboard-search-read";
import { getAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { readLine3Candidates } from "@/db/dashboard-knowledge-read";
import { clearFavouriteRank, setFavouriteRank } from "@/db/favourites-dao";
import { deleteTouchpoint, recordTouchpoint } from "@/db/recency-dao";
import { clearSnooze, snoozeContact, type SnoozePreset } from "@/db/snooze-dao";
import { newUid } from "@/db/uid";
import { countUnbound } from "@/db/unbound-read";
import {
  type DashboardPopulationCounts,
  selectDashboardEmptyState,
} from "@/logic/dashboard-empty-logic";
import type { DashboardViewMode } from "@/logic/dashboard-query-logic";
import {
  createBulkActionGate,
  getCurrentSelectionIds,
  type BulkActionClaim,
} from "@/logic/dashboard-bulk-action-session";
import {
  applyCommittedMembership,
  createFavouriteOptimisticStore,
} from "@/logic/favourite-optimistic";
import { selectLine3 } from "@/logic/list-row-selection";
import { selectCardLine3 } from "@/logic/card-line3-selection";
import type { DashboardSearchResult } from "@/logic/dashboard-search-match";
import type { DashboardScreenProps } from "@/navigation/types";
import { navigationRef } from "@/navigation/linking";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { buildDashboardOverflowActions } from "@/screens/dashboard-overflow-actions";
import { useDashboardQueryStore } from "@/stores/dashboard-query-store";
import { useDashboardSelectionStore } from "@/stores/dashboard-selection-store";
import { useDashboardSessionStore } from "@/stores/dashboard-session-store";
import { bumpShellRefresh, useShellRefresh } from "@/stores/shell-refresh-store";
import { showSnackbar, snackbarStore } from "@/stores/snackbar-store";
import { runQuickLog } from "@/services/quick-log-command";
import { reconcileSchedule } from "@/services/notifications/notification-schedule";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { createQuickLogUndoController } from "@/components/universal-fab-logic";
import { useTheme } from "@/theme";
import { EASING, MOTION } from "@/theme/tokens/motion";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { TYPOGRAPHY } from "@/theme/tokens/typography";
import { useReducedMotion } from "@/theme/use-reduced-motion";
import { Logger } from "@/utils/logger";
import { isSnoozed, parseLocalMs } from "@/utils/dates";

/** The debounce interval (ms) that collapses a keystroke burst to one read. */
const SEARCH_DEBOUNCE_MS = 220;
/** Small selections remain instantly reversible; larger batches ask first. */
const BULK_QUICK_LOG_CONFIRM_THRESHOLD = 5;
const dismissSnackbar = () => snackbarStore.getState().dismiss();

/** The two view-toggle segments — List then Card, each with its semantic icon. */
const VIEW_TOGGLE_OPTIONS: {
  label: string;
  value: DashboardViewMode;
  icon: "list" | "grid";
}[] = [
  { label: "List view", value: "list", icon: "list" },
  { label: "Card view", value: "card", icon: "grid" },
];

const LOG_SCOPE = "dashboard-home";
const SWIPE_ACTION_WIDTH = 96;
const CARD_SNOOZE_PRESETS: { preset: SnoozePreset; label: string }[] = [
  { preset: "3d", label: "3 days" },
  { preset: "1w", label: "1 week" },
  { preset: "1m", label: "1 month" },
];

type DashboardContactActionTarget = "LogContact" | "Edit";
type BulkConfirmAction = { claim: BulkActionClaim } & (
  | { kind: "quick-log"; ids: number[] }
  | { kind: "archive"; ids: number[] }
  | { kind: "frequency"; ids: number[]; intervalDays: number }
);

/** Dashboard detail routes must dispatch through the root tab navigator. */
function navigateDashboardContactAction(
  contactId: number,
  target: DashboardContactActionTarget,
): void {
  navigationRef.current?.navigate("DashboardTab", {
    screen: target,
    params: { contactId },
  } as never);
}

function SwipeActionSurface({
  label,
  icon,
  side,
}: {
  label: string;
  icon: "message" | "edit";
  side: "left" | "right";
}) {
  const { colors } = useTheme();
  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={[
        styles.swipeAction,
        side === "left" ? styles.swipeActionLeft : styles.swipeActionRight,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
      ]}
    >
      <Icon name={icon} size="md" tone="textSecondary" />
      <Text style={[styles.swipeActionLabel, { color: colors.textPrimary }]}>
        {label}
      </Text>
    </View>
  );
}

/** Initial-only row geometry placeholder; query changes retain current content. */
function ListLoadingSkeleton() {
  const { colors } = useTheme();
  return (
    <View testID="dashboard-list-loading" style={styles.skeletonList}>
      {[0, 1, 2, 3].map((index) => (
        <View
          key={index}
          style={[
            styles.skeletonRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View
            style={[styles.skeletonAvatar, { backgroundColor: colors.surfaceElevated }]}
          />
          <View style={styles.skeletonTextBlock}>
            <View style={[styles.skeletonName, { backgroundColor: colors.surfaceElevated }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.surfaceElevated }]} />
            <View style={[styles.skeletonLineShort, { backgroundColor: colors.surfaceElevated }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function SwipeableListRow({
  onLogInteraction,
  onEditContact,
  openRowRef,
  ...rowProps
}: Omit<ListRowProps, "onLogInteraction" | "onEditContact"> & {
  onLogInteraction: (contactId: number) => Promise<void>;
  onEditContact: (contactId: number) => void;
  openRowRef: { current: SwipeableMethods | null };
}) {
  const swipeableRef = useRef<SwipeableMethods | null>(null);
  const isThisRowOpen = () => openRowRef.current === swipeableRef.current;

  const onWillOpen = useCallback(() => {
    const previousRow = openRowRef.current;
    if (previousRow && previousRow !== swipeableRef.current) {
      previousRow.close();
    }
    openRowRef.current = swipeableRef.current;
  }, [openRowRef]);

  const onClose = useCallback(() => {
    if (isThisRowOpen()) openRowRef.current = null;
  }, [openRowRef]);

  const onPress = useCallback(() => {
    if (isThisRowOpen()) {
      swipeableRef.current?.close();
      openRowRef.current = null;
      return;
    }
    rowProps.onPress();
  }, [openRowRef, rowProps]);

  const onSwipeableOpen = useCallback(
    (direction: "left" | "right") => {
      if (direction === "right") {
        void onLogInteraction(rowProps.contactId);
        return;
      }
      onEditContact(rowProps.contactId);
    },
    [onEditContact, onLogInteraction, rowProps.contactId],
  );

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={1.8}
      leftThreshold={SWIPE_ACTION_WIDTH / 2}
      rightThreshold={SWIPE_ACTION_WIDTH / 2}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => (
        <SwipeActionSurface label="Log" icon="message" side="left" />
      )}
      renderRightActions={() => (
        <SwipeActionSurface label="Edit" icon="edit" side="right" />
      )}
      onSwipeableWillOpen={onWillOpen}
      onSwipeableOpen={onSwipeableOpen}
      onSwipeableClose={onClose}
    >
      <ListRow
        {...rowProps}
        onPress={onPress}
        onLogInteraction={() => {
          void onLogInteraction(rowProps.contactId);
        }}
        onEditContact={() => onEditContact(rowProps.contactId)}
      />
    </ReanimatedSwipeable>
  );
}

interface ListRowLine3 {
  text: string;
  iconName?: IconName;
}

function isIconName(value: string): value is IconName {
  return value in ICON_REGISTRY;
}

/** The four population counts feeding the header + the empty-state gate. */
interface PopulationCounts {
  live: number;
  neverContacted: number;
  snoozed: number;
  archived: number;
  unbound: number;
}

const ZERO_COUNTS: PopulationCounts = {
  live: 0,
  neverContacted: 0,
  snoozed: 0,
  archived: 0,
  unbound: 0,
};

/**
 * The COMPLETE 5-key population-count record feeding the empty-state gate (each
 * key from a cheap dedicated count, never an extra full population scan). A
 * partial literal would fail the exact `Record<DashboardPopulation, number>`
 * typecheck AND mis-resolve a favourites-empty state as filter-empty.
 */
const ZERO_POPULATION_COUNTS: DashboardPopulationCounts = {
  "all-contacts": 0,
  favourites: 0,
  birthdays: 0,
  "not-contacted": 0,
  snoozed: 0,
};

export function HomeScreen({ navigation }: DashboardScreenProps<"Home">) {
  const { colors } = useTheme();
  // useShallow is required: this selector returns a fresh object, and Zustand v5
  // compares snapshots with Object.is — without a shallow comparator the new
  // reference every render drives an infinite useSyncExternalStore update loop
  // ("Maximum update depth exceeded"). It also keeps `query` referentially stable
  // for the effect below (`[query, debouncedSearchText]`) so reads don't re-fire.
  const query = useDashboardQueryStore(
    useShallow((state) => ({
      viewMode: state.viewMode,
      populations: state.populations,
      filters: state.filters,
      sort: state.sort,
    })),
  );
  const hydrate = useDashboardQueryStore((state) => state.hydrate);
  const selectionMode = useDashboardSelectionStore((state) => state.mode);
  const selectedIds = useDashboardSelectionStore((state) => state.selectedIds);
  const frozenUniverse = useDashboardSelectionStore(
    (state) => state.frozenUniverse,
  );
  const toggleSelection = useDashboardSelectionStore((state) => state.toggle);
  const selectAll = useDashboardSelectionStore((state) => state.selectAll);
  const exitSelection = useDashboardSelectionStore((state) => state.exitSelection);
  const removeFromUniverse = useDashboardSelectionStore(
    (state) => state.removeFromUniverse,
  );
  const bottomClearance = useBottomClearance();

  const resetDashboard = useCallback(async () => {
    try {
      await useDashboardQueryStore.getState().resetDashboardView(getExecutor());
      useDashboardSessionStore.getState().clearSession();
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to reset dashboard view", error);
      showSnackbar({
        kind: "error",
        label: "Couldn't reset dashboard",
        action: {
          label: "Retry",
          accessibilityLabel: "Retry resetting the dashboard view",
          onPress: () => {
            void resetDashboard();
          },
        },
      });
    }
  }, []);

  // OverflowAction is synchronous; this wrapper contains the awaited reset and
  // its failure path so a rejected persistence write cannot become unhandled.
  const onReset = useCallback(() => {
    void resetDashboard();
  }, [resetDashboard]);
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [line3ByContactId, setLine3ByContactId] = useState<
    ReadonlyMap<number, ListRowLine3>
  >(() => new Map());
  const [searchResultsByContactId, setSearchResultsByContactId] = useState<
    ReadonlyMap<number, DashboardSearchResult | null>
  >(() => new Map());
  const [favouriteStore] = useState(createFavouriteOptimisticStore);
  const favouriteOverlay = useSyncExternalStore(
    favouriteStore.subscribe,
    favouriteStore.getSnapshot,
  );
  const [listNow, setListNow] = useState(() => localDateTime());
  const [counts, setCounts] = useState<PopulationCounts>(ZERO_COUNTS);
  const [populationCounts, setPopulationCounts] =
    useState<DashboardPopulationCounts>(ZERO_POPULATION_COUNTS);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const frozenIds = useMemo(
    () => new Set(frozenUniverse),
    [frozenUniverse],
  );
  const cardRows = selectionMode
    ? rows.filter((row) => frozenIds.has(row.id))
    : rows;
  const selectionCount = selectedIds.size;
  const [bulkActionPending, setBulkActionPending] = useState(false);
  const bulkActionGateRef = useRef<ReturnType<typeof createBulkActionGate> | null>(
    null,
  );
  if (!bulkActionGateRef.current) {
    bulkActionGateRef.current = createBulkActionGate(setBulkActionPending);
  }
  // Holds a claim while it is awaiting a dialog or picker choice. Once a
  // choice consumes it, the writer owns that claim until its settled path.
  const bulkActionInputClaimRef = useRef<BulkActionClaim | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<BulkConfirmAction | null>(null);
  const [snoozePicker, setSnoozePicker] = useState<{
    claim: BulkActionClaim;
    ids: number[];
  } | null>(null);
  const [categoryPicker, setCategoryPicker] = useState<{
    claim: BulkActionClaim;
    sessionId: number;
    categories: { id: number; name: string }[];
  } | null>(null);
  const [frequencyPicker, setFrequencyPicker] = useState<{
    claim: BulkActionClaim;
    ids: number[];
  } | null>(null);
  const [frequencyDraft, setFrequencyDraft] = useState("");

  useEffect(() => {
    if (!selectionMode) return;
    const label = `${selectionCount} selected`;
    AccessibilityInfo.announceForAccessibility(label);
  }, [selectionCount, selectionMode]);
  const [resultGeneration, setResultGeneration] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [contextMenuContactId, setContextMenuContactId] = useState<number | null>(
    null,
  );
  const openRowRef = useRef<SwipeableMethods | null>(null);
  const [postLogTarget, setPostLogTarget] = useState<PostLogNoteTarget | null>(
    null,
  );
  const quickLogPending = useRef(false);
  const quickLogUndoController = useRef(
    createQuickLogUndoController(({ contactId, interactionId }) =>
      deleteTouchpoint(getExecutor(), {
        contactId,
        interactionId,
        now: localDateTime(),
      }),
    ),
  );

  const logQuickly = useCallback((contactId: number) => {
    runQuickLog(
      {
        pendingRef: quickLogPending,
        undoController: quickLogUndoController.current,
        recordTouchpoint: (input) => recordTouchpoint(getExecutor(), input),
        readChannelPreference: async () => {
          // The same app-settings read the detailed Log Interaction screen uses;
          // a read failure falls back to Message so the immediate write is never
          // blocked (local-first, no network on this read path).
          try {
            const s = await getAppSettings(getExecutor());
            return {
              pref: s.defaultInteractionChannel,
              remembered: s.rememberedInteractionChannel,
            };
          } catch (error) {
            Logger.error(LOG_SCOPE, "failed to read channel preference", error);
            return { pref: "Message", remembered: null };
          }
        },
        localDateTime,
        newUid,
        showSnackbar,
        notifySuccessHaptic: () =>
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        notifyWidgetDataChanged,
        bumpShellRefresh,
        openPostLogEditor: setPostLogTarget,
      },
      contactId,
    );
  }, []);

  const onLogInteraction = useCallback(
    async (contactId: number) => {
      try {
        const { dashboardRightSwipeAction } = await getAppSettings(getExecutor());
        if (dashboardRightSwipeAction === "log-contact") {
          navigateDashboardContactAction(contactId, "LogContact");
          return;
        }
        logQuickly(contactId);
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to read dashboard swipe action", error);
        // The durable schema default is Quick Log. A read failure must still
        // execute it and leave the user an explicit retry path for the setting.
        logQuickly(contactId);
        showSnackbar({
          kind: "error",
          label: "Couldn't read swipe action",
          action: {
            label: "Retry",
            accessibilityLabel: "Retry reading swipe action",
            onPress: () => {
              void onLogInteraction(contactId);
            },
          },
        });
      }
    },
    [logQuickly],
  );

  const onEditContact = useCallback((contactId: number) => {
    navigateDashboardContactAction(contactId, "Edit");
  }, []);

  useEffect(() => {
    void hydrate(getExecutor());
  }, [hydrate]);

  // Row 3 search — EPHEMERAL session state (dossier §K): the term lives in the
  // session store so Dashboard→Profile→Back restores it while a fresh launch
  // starts empty. The input value stays immediately responsive; a debounced
  // twin (below) is what drives the read so a keystroke burst fires ONE query.
  const searchText = useDashboardSessionStore((state) => state.searchText);
  const setSearchText = useDashboardSessionStore(
    (state) => state.setSearchText,
  );
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [debouncedSearchText, setDebouncedSearchText] = useState(searchText);

  useEffect(() => {
    const handle = setTimeout(
      () => setDebouncedSearchText(searchText),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(handle);
  }, [searchText]);

  // Search collapse/expand animation gating (CLAUDE.md non-negotiable, mirrors
  // AnchoredPanel / OrreryScreen): the Reanimated timing runs only when focused,
  // foregrounded, and reduced-motion is off; otherwise it settles INSTANTLY to
  // its final value so a backgrounded screen never leaves a half-run animation.
  const reducedMotion = useReducedMotion();
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active",
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      setAppActive(state === "active");
    });
    return () => sub.remove();
  }, []);

  const searchProgress = useSharedValue(searchExpanded ? 1 : 0);
  useEffect(() => {
    const canAnimate = isFocused && appActive && !reducedMotion;
    const target = searchExpanded ? 1 : 0;
    searchProgress.value = canAnimate
      ? withTiming(target, {
          duration: MOTION.base,
          easing: Easing.out(Easing.ease),
        })
      : target;
  }, [appActive, isFocused, reducedMotion, searchExpanded, searchProgress]);

  const searchInputStyle = useAnimatedStyle(() => ({
    opacity: searchProgress.value,
    transform: [{ translateY: (1 - searchProgress.value) * SPACING.sm }],
  }));
  const resultProgress = useSharedValue(1);
  useEffect(() => {
    if (resultGeneration === 0) return;
    const canAnimate = isFocused && appActive && !reducedMotion;
    resultProgress.value = canAnimate
      ? withTiming(1, {
          duration: MOTION.fast,
          easing:
            EASING.decelerate === "out"
              ? Easing.out(Easing.ease)
              : Easing.inOut(Easing.ease),
        })
      : 1;
  }, [appActive, isFocused, reducedMotion, resultGeneration, resultProgress]);
  const resultTransitionStyle = useAnimatedStyle(() => ({
    opacity: resultProgress.value,
    transform: [{ translateY: (1 - resultProgress.value) * SPACING.xs }],
  }));

  const onToggleSearch = useCallback(() => {
    setSearchExpanded((expanded) => {
      // Collapsing drops the active query so the list returns to the full
      // population — a collapsed search must never leave the list silently
      // filtered with no visible input or indicator (WR-02).
      if (expanded) setSearchText("");
      return !expanded;
    });
  }, [setSearchText]);

  const onClearSearch = useCallback(() => {
    setSearchText("");
  }, [setSearchText]);

  // View-toggle idempotency (cross-AI review CYCLE-4 #3): short-circuit when the
  // tapped segment is already active BEFORE calling setViewMode, so re-selecting
  // the current view neither persists nor reloads. The store setter is ALSO
  // hardened to no-op on an unchanged value (belt-and-braces).
  const onChangeView = useCallback((mode: DashboardViewMode) => {
    if (mode === useDashboardQueryStore.getState().viewMode) return;
    void useDashboardQueryStore.getState().setViewMode(getExecutor(), mode);
  }, []);

  /**
   * The single load: the D-12 read (`listDashboardSearch` when a term is present,
   * else `listDashboardPopulation`) + the header counts + the COMPLETE 5-key
   * populationCounts, guarded by a `cancelled` flag it returns as its canceller.
   * The DEBOUNCE (not this flag) collapses a keystroke burst to ONE read — the
   * cancelled flag only drops a stale async result so a newer query is never
   * clobbered. ONE `now` is captured per reload and threaded to every
   * birthday-resolving read/count (the list read AND countBirthdayPopulation) so
   * the birthday list and its empty-state count can't disagree across local
   * midnight (D-12; cross-AI review CYCLE-3).
   */
  const reload = useCallback(() => {
    let cancelled = false;
    const now = localDateTime();
    const term = debouncedSearchText.trim();
    const isSearch = term !== "";
    (async () => {
      try {
        const exec = getExecutor();
        const [
          searchRead,
          live,
          neverContacted,
          snoozed,
          archived,
          unbound,
          birthdays,
          favourites,
          allContacts,
        ] = await Promise.all([
          isSearch
            ? composeDashboardSearch(exec, query, term, now).then(
                (searchRows) => ({
                  rows: searchRows.map((searchRow) => searchRow.row),
                  resultsByContactId: new Map(
                    searchRows.map((searchRow) => [
                      searchRow.row.id,
                      searchRow.match,
                    ]),
                  ),
                }),
              )
            : (term !== ""
                ? listDashboardSearch(exec, query, term, now)
                : listDashboardPopulation(exec, query, now)
              ).then((rows) => ({
                rows,
                resultsByContactId: new Map<number, DashboardSearchResult | null>(),
              })),
          countLiveContacts(exec),
          countNeverContacted(exec),
          countSnoozed(exec),
          countArchived(exec),
          countUnbound(exec),
          countBirthdayPopulation(exec, now),
          countFavourites(exec),
          countAllContacts(exec),
        ]);
        const list = searchRead.rows;
        const nextLine3ByContactId = new Map<number, ListRowLine3>();
        if (
          (query.viewMode === "list" || query.viewMode === "card") &&
          !isSearch
        ) {
          const candidates = await readLine3Candidates(
            exec,
            list.map((row) => row.id),
          );
          const candidatesByContactId = new Map<number, typeof candidates>();
          for (const candidate of candidates) {
            const forContact = candidatesByContactId.get(candidate.contactId) ?? [];
            forContact.push(candidate);
            candidatesByContactId.set(candidate.contactId, forContact);
          }
          const selectionNow = new Date(parseLocalMs(now));
          for (const row of list) {
            const selection = (
              query.viewMode === "card" ? selectCardLine3 : selectLine3
            )(
              candidatesByContactId.get(row.id) ?? [],
              row.id,
              row.name,
              selectionNow,
            );
            nextLine3ByContactId.set(row.id, {
              text: selection.text,
              ...(selection.kind === "candidate" && isIconName(selection.type)
                ? { iconName: selection.type }
                : {}),
            });
          }
        }
        if (cancelled) return;
        setRows(list);
        setLine3ByContactId(nextLine3ByContactId);
        setSearchResultsByContactId(searchRead.resultsByContactId);
        setListNow(now);
        setCounts({ live, neverContacted, snoozed, archived, unbound });
        setPopulationCounts({
          "all-contacts": allContacts,
          favourites,
          birthdays,
          "not-contacted": neverContacted,
          snoozed,
        });
        setError(false);
        resultProgress.value =
          isFocused && appActive && !reducedMotion ? 0 : 1;
        setResultGeneration((generation) => generation + 1);
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to load dashboard", err);
        if (!cancelled) {
          setRows([]);
          setLine3ByContactId(new Map());
          setSearchResultsByContactId(new Map());
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setRefreshing(false);
          setInitialLoad(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    appActive,
    debouncedSearchText,
    isFocused,
    query,
    reducedMotion,
    resultProgress,
  ]);

  // Shell Quick Log/Undo originates outside this screen's focus lifecycle. This
  // in-process tick is intentionally distinct from the connection-scoped SQLite
  // subscription that this dashboard deliberately does not use (DASH-07).
  useShellRefresh(reload);

  // Freshness path 1 — re-query every time the dashboard regains focus.
  useFocusEffect(
    useCallback(() => {
      const cancel = reload();
      return cancel;
    }, [reload]),
  );

  // Freshness path 2 — re-query when the app returns to the foreground, so a
  // headless "mark contacted" write made while backgrounded is reflected. The
  // subscription (and any in-flight guard) is torn down on unmount.
  useEffect(() => {
    let cancelCurrent: (() => void) | undefined;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        cancelCurrent?.();
        cancelCurrent = reload();
      }
    });
    return () => {
      cancelCurrent?.();
      sub.remove();
    };
  }, [reload]);

  // Freshness path 3 — pull-to-refresh. Capture the returned canceller (like the
  // focus + AppState paths) and hold it in a ref so an in-flight pull-refresh
  // read is cancelled if a newer pull starts or the screen unmounts mid-read.
  const pullCancelRef = useRef<(() => void) | undefined>(undefined);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    pullCancelRef.current?.();
    pullCancelRef.current = reload();
  }, [reload]);

  // Tear down any in-flight pull-refresh read on unmount.
  useEffect(() => {
    return () => {
      pullCancelRef.current?.();
    };
  }, []);

  const reportBulkFailure = useCallback(
    (operation: string, writeError: unknown, retry?: () => void) => {
      Logger.error(LOG_SCOPE, `failed to ${operation}`, writeError);
      AccessibilityInfo.announceForAccessibility(`Couldn't ${operation}`);
      showSnackbar({
        kind: "error",
        label: `Couldn't ${operation}. Try again.`,
        action: retry
          ? {
              label: "Retry",
              accessibilityLabel: `Retry ${operation}`,
              onPress: retry,
            }
          : {
              label: "Dismiss",
              accessibilityLabel: "Dismiss notification",
              onPress: dismissSnackbar,
            },
      });
    },
    [],
  );

  const tryAcquireBulkAction = useCallback(() => {
    const claim = bulkActionGateRef.current?.tryAcquire() ?? null;
    if (claim) bulkActionInputClaimRef.current = claim;
    return claim;
  }, []);
  const consumeBulkAction = useCallback((claim: BulkActionClaim) => {
    const consumed = bulkActionGateRef.current?.consume(claim) === true;
    if (consumed && bulkActionInputClaimRef.current === claim) {
      bulkActionInputClaimRef.current = null;
    }
    return consumed;
  }, []);
  const releaseBulkAction = useCallback((claim: BulkActionClaim) => {
    if (bulkActionInputClaimRef.current === claim) {
      bulkActionInputClaimRef.current = null;
    }
    bulkActionGateRef.current?.release(claim);
  }, []);
  const releaseBulkInputClaim = useCallback(() => {
    const claim = bulkActionInputClaimRef.current;
    if (claim) releaseBulkAction(claim);
  }, [releaseBulkAction]);

  const commitBulkOutcome = useCallback(
    (label: string) => {
      // A bulk transaction is one durable commit: refresh shell consumers once,
      // then re-read the fenced Dashboard model. Do not reseed frozenUniverse.
      notifyWidgetDataChanged();
      bumpShellRefresh();
      AccessibilityInfo.announceForAccessibility(label);
      showSnackbar({
        kind: "success",
        label,
        action: {
          label: "Dismiss",
          accessibilityLabel: "Dismiss notification",
          onPress: dismissSnackbar,
        },
      });
      reload();
    },
    [reload],
  );

  const performBulkQuickLog = useCallback(
    (ids: number[], claimed?: BulkActionClaim) => {
      const claim = claimed ?? tryAcquireBulkAction();
      if (!claim || (!claimed && !consumeBulkAction(claim))) return;
      void bulkQuickLog(getExecutor(), ids, localDateTime())
        .then((receipt) => {
          const label = `Logged ${ids.length} interactions`;
          notifyWidgetDataChanged();
          bumpShellRefresh();
          AccessibilityInfo.announceForAccessibility(label);
          showSnackbar({
            kind: "success",
            label,
            action: {
              label: "Undo",
              accessibilityLabel: `Undo logging ${ids.length} interactions`,
              onPress: () => {
                void undoBulkQuickLog(getExecutor(), receipt, localDateTime())
                  .then(() => {
                    commitBulkOutcome(`Undid ${ids.length} logged interactions`);
                  })
                  .catch((undoError: unknown) =>
                    reportBulkFailure("undo bulk quick log", undoError),
                  );
              },
            },
          });
          reload();
        })
        .catch((writeError: unknown) => {
          releaseBulkAction(claim);
          reportBulkFailure("log interactions", writeError, () => {
            performBulkQuickLog(ids);
          });
        })
        .finally(() => releaseBulkAction(claim));
    },
    [
      commitBulkOutcome,
      consumeBulkAction,
      reload,
      releaseBulkAction,
      reportBulkFailure,
      tryAcquireBulkAction,
    ],
  );

  const performBulkArchive = useCallback(
    (ids: number[], claimed?: BulkActionClaim) => {
      const claim = claimed ?? tryAcquireBulkAction();
      if (!claim || (!claimed && !consumeBulkAction(claim))) return;
      void bulkArchive(getExecutor(), ids, localDateTime())
        .then(() => {
          // Archive is reversible, but it must disappear from this frozen universe.
          removeFromUniverse(ids);
          commitBulkOutcome(`Archived ${ids.length} contacts`);
        })
        .catch((writeError: unknown) => {
          releaseBulkAction(claim);
          reportBulkFailure("archive contacts", writeError, () => {
            performBulkArchive(ids);
          });
        })
        .finally(() => releaseBulkAction(claim));
    },
    [
      commitBulkOutcome,
      consumeBulkAction,
      releaseBulkAction,
      removeFromUniverse,
      reportBulkFailure,
      tryAcquireBulkAction,
    ],
  );

  const performBulkFrequency = useCallback(
    (ids: number[], intervalDays: number, claimed?: BulkActionClaim) => {
      const claim = claimed ?? tryAcquireBulkAction();
      if (!claim || (!claimed && !consumeBulkAction(claim))) return;
      void bulkSetFrequency(getExecutor(), ids, intervalDays, localDateTime())
        .then(() => {
          commitBulkOutcome(
            `Changed contact frequency to every ${intervalDays} days for ${ids.length} contacts`,
          );
        })
        .catch((writeError: unknown) => {
          releaseBulkAction(claim);
          reportBulkFailure("change contact frequency", writeError, () => {
            performBulkFrequency(ids, intervalDays);
          });
        })
        .finally(() => releaseBulkAction(claim));
    },
    [
      commitBulkOutcome,
      consumeBulkAction,
      releaseBulkAction,
      reportBulkFailure,
      tryAcquireBulkAction,
    ],
  );

  const onBulkQuickLog = useCallback(() => {
    const claim = tryAcquireBulkAction();
    if (!claim) return;
    const ids = [...selectedIds];
    if (ids.length === 0) {
      releaseBulkAction(claim);
      return;
    }
    if (ids.length > BULK_QUICK_LOG_CONFIRM_THRESHOLD) {
      setBulkConfirm({ kind: "quick-log", ids, claim });
      return;
    }
    if (!consumeBulkAction(claim)) return;
    performBulkQuickLog(ids, claim);
  }, [
    consumeBulkAction,
    performBulkQuickLog,
    releaseBulkAction,
    selectedIds,
    tryAcquireBulkAction,
  ]);

  const onBulkLogInteraction = useCallback(() => {
    const claim = tryAcquireBulkAction();
    if (!claim) return;
    const ids = [...selectedIds];
    if (ids.length === 1) {
      navigateDashboardContactAction(ids[0], "LogContact");
    } else if (ids.length >= 2) {
      navigation.navigate("GroupLog", { participantIds: ids });
    }
    releaseBulkAction(claim);
  }, [navigation, releaseBulkAction, selectedIds, tryAcquireBulkAction]);

  const onBulkAddFavourites = useCallback(() => {
    const claim = tryAcquireBulkAction();
    if (!claim) return;
    const ids = [...selectedIds];
    if (ids.length === 0) {
      releaseBulkAction(claim);
      return;
    }
    if (!consumeBulkAction(claim)) return;
    void bulkAddFavourites(getExecutor(), ids, localDateTime())
      .then(() => commitBulkOutcome(`Added ${ids.length} contacts to Favorites`))
      .catch((writeError: unknown) => {
        releaseBulkAction(claim);
        reportBulkFailure("add contacts to Favorites", writeError, onBulkAddFavourites);
      })
      .finally(() => releaseBulkAction(claim));
  }, [
    commitBulkOutcome,
    consumeBulkAction,
    releaseBulkAction,
    reportBulkFailure,
    selectedIds,
    tryAcquireBulkAction,
  ]);

  const onBulkRemoveFavourites = useCallback(() => {
    const claim = tryAcquireBulkAction();
    if (!claim) return;
    const ids = [...selectedIds];
    if (ids.length === 0) {
      releaseBulkAction(claim);
      return;
    }
    if (!consumeBulkAction(claim)) return;
    void bulkRemoveFavourites(getExecutor(), ids, localDateTime())
      .then(() =>
        commitBulkOutcome(`Removed ${ids.length} contacts from Favorites`),
      )
      .catch((writeError: unknown) => {
        releaseBulkAction(claim);
        reportBulkFailure(
          "remove contacts from Favorites",
          writeError,
          onBulkRemoveFavourites,
        );
      })
      .finally(() => releaseBulkAction(claim));
  }, [
    commitBulkOutcome,
    consumeBulkAction,
    releaseBulkAction,
    reportBulkFailure,
    selectedIds,
    tryAcquireBulkAction,
  ]);

  const onBulkOpenSnoozePicker = useCallback(() => {
    const claim = tryAcquireBulkAction();
    if (!claim) return;
    const ids = [...selectedIds];
    if (ids.length === 0) {
      releaseBulkAction(claim);
      return;
    }
    setSnoozePicker({ claim, ids });
  }, [releaseBulkAction, selectedIds, tryAcquireBulkAction]);

  const onBulkUnsnooze = useCallback(() => {
    const claim = tryAcquireBulkAction();
    if (!claim) return;
    const ids = [...selectedIds];
    if (ids.length === 0) {
      releaseBulkAction(claim);
      return;
    }
    if (!consumeBulkAction(claim)) return;
    void bulkUnsnooze(getExecutor(), ids, localDateTime())
      .then(async () => {
        commitBulkOutcome(`Unsnoozed ${ids.length} contacts`);
        await reconcileSchedule(getExecutor()).catch((scheduleError) =>
          Logger.error(LOG_SCOPE, "failed to reconcile after bulk unsnooze", scheduleError),
        );
      })
      .catch((writeError: unknown) => {
        releaseBulkAction(claim);
        reportBulkFailure("unsnooze contacts", writeError, onBulkUnsnooze);
      })
      .finally(() => releaseBulkAction(claim));
  }, [
    commitBulkOutcome,
    consumeBulkAction,
    releaseBulkAction,
    reportBulkFailure,
    selectedIds,
    tryAcquireBulkAction,
  ]);

  const onBulkOpenCategoryPicker = useCallback(() => {
    const claim = tryAcquireBulkAction();
    if (!claim) return;
    const selection = useDashboardSelectionStore.getState();
    const sessionId = selection.sessionId;
    if (!getCurrentSelectionIds(selection, sessionId)?.length) {
      releaseBulkAction(claim);
      return;
    }
    void listCategories(getExecutor())
      .then((categories) => {
        const currentIds = getCurrentSelectionIds(
          useDashboardSelectionStore.getState(),
          sessionId,
        );
        if (!currentIds?.length) {
          releaseBulkAction(claim);
          return;
        }
        setCategoryPicker({ claim, sessionId, categories });
      })
      .catch((readError: unknown) => {
        releaseBulkAction(claim);
        reportBulkFailure("load categories", readError, onBulkOpenCategoryPicker);
      });
  }, [releaseBulkAction, reportBulkFailure, tryAcquireBulkAction]);

  const onBulkArchive = useCallback(() => {
    const claim = tryAcquireBulkAction();
    if (!claim) return;
    const ids = [...selectedIds];
    if (ids.length === 0) {
      releaseBulkAction(claim);
      return;
    }
    setBulkConfirm({ kind: "archive", ids, claim });
  }, [releaseBulkAction, selectedIds, tryAcquireBulkAction]);

  const onBulkOpenFrequencyPicker = useCallback(() => {
    const claim = tryAcquireBulkAction();
    if (!claim) return;
    const ids = [...selectedIds];
    if (ids.length === 0) {
      releaseBulkAction(claim);
      return;
    }
    setFrequencyDraft("");
    setFrequencyPicker({ claim, ids });
  }, [releaseBulkAction, selectedIds, tryAcquireBulkAction]);

  const onBulkConfirm = useCallback(() => {
    const confirm = bulkConfirm;
    if (!confirm || !consumeBulkAction(confirm.claim)) return;
    setBulkConfirm(null);
    if (confirm.kind === "quick-log") {
      performBulkQuickLog(confirm.ids, confirm.claim);
    } else if (confirm.kind === "archive") {
      performBulkArchive(confirm.ids, confirm.claim);
    } else {
      performBulkFrequency(confirm.ids, confirm.intervalDays, confirm.claim);
    }
  }, [
    bulkConfirm,
    consumeBulkAction,
    performBulkArchive,
    performBulkFrequency,
    performBulkQuickLog,
  ]);

  const dismissBulkConfirm = useCallback(() => {
    setBulkConfirm(null);
    releaseBulkInputClaim();
  }, [releaseBulkInputClaim]);

  const exitBulkSelection = useCallback(() => {
    setBulkConfirm(null);
    setSnoozePicker(null);
    setCategoryPicker(null);
    setFrequencyPicker(null);
    // Done must not release a writer that has already consumed its claim.
    releaseBulkInputClaim();
    exitSelection();
  }, [exitSelection, releaseBulkInputClaim]);

  const goToProfile = useCallback(
    (contactId: number) => navigation.navigate("Profile", { contactId }),
    [navigation],
  );

  const toggleFavourite = useCallback(
    (contactId: number, nextMembership: boolean) => {
      const generation = favouriteStore.begin(contactId, nextMembership);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const write = nextMembership ? setFavouriteRank : clearFavouriteRank;

      void write(getExecutor(), contactId, localDateTime())
        .then(() => {
          // Every completed SQLite write is a durable base-state update, even
          // while a newer per-contact overlay remains visible. If that newer
          // choice later fails, its overlay drops to reveal this committed row.
          favouriteStore.resolve(
            contactId,
            generation,
            "success",
            nextMembership,
          );
          setRows((previousRows) =>
            applyCommittedMembership(previousRows, contactId, nextMembership),
          );
        })
        .catch((writeError: unknown) => {
          Logger.error(LOG_SCOPE, "failed to update favourite", writeError);
          if (
            favouriteStore.resolve(contactId, generation, "failure") === "applied"
          ) {
            showSnackbar({
              kind: "error",
              label: "Couldn't update favourite. Try again.",
              action: {
                label: "Retry",
                accessibilityLabel: "Retry updating favourite",
                onPress: () => toggleFavourite(contactId, nextMembership),
              },
            });
          }
        });
    },
    [favouriteStore],
  );

  const openCardContextMenu = useCallback((contactId: number) => {
    setContextMenuContactId(contactId);
  }, []);

  const logCardInteraction = useCallback((contactId: number) => {
    navigateDashboardContactAction(contactId, "LogContact");
  }, []);

  const messageContact = useCallback(
    (contactId: number) => navigation.navigate("Compose", { contactId }),
    [navigation],
  );

  const refreshAfterSnooze = useCallback(() => {
    reload();
  }, [reload]);

  const snoozeContactWithPreset = useCallback(
    async (contactId: number, preset: SnoozePreset) => {
      try {
        await snoozeContact(getExecutor(), {
          contactId,
          uid: newUid(),
          preset,
          now: localDateTime(),
        });
        refreshAfterSnooze();
        void reconcileSchedule(getExecutor()).catch((scheduleError) =>
          Logger.error(
            LOG_SCOPE,
            "failed to reconcile after card snooze",
            scheduleError,
          ),
        );
      } catch (snoozeError) {
        Logger.error(LOG_SCOPE, "failed to snooze card contact", snoozeError);
        showSnackbar({
          kind: "error",
          label: "Couldn't snooze contact. Try again.",
          action: {
            label: "Retry",
            accessibilityLabel: "Retry snoozing contact",
            onPress: () => {
              void snoozeContactWithPreset(contactId, preset);
            },
          },
        });
      }
    },
    [refreshAfterSnooze],
  );

  const toggleCardSnooze = useCallback(
    (contactId: number, currentlySnoozed: boolean) => {
      if (currentlySnoozed) {
        void clearSnooze(getExecutor(), {
          contactId,
          uid: newUid(),
          now: localDateTime(),
        })
          .then(() => {
            refreshAfterSnooze();
            return reconcileSchedule(getExecutor()).catch((scheduleError) =>
              Logger.error(
                LOG_SCOPE,
                "failed to reconcile after card unsnooze",
                scheduleError,
              ),
            );
          })
          .catch((snoozeError: unknown) => {
            Logger.error(LOG_SCOPE, "failed to unsnooze card contact", snoozeError);
            showSnackbar({
              kind: "error",
              label: "Couldn't unsnooze contact. Try again.",
              action: {
                label: "Retry",
                accessibilityLabel: "Retry unsnoozing contact",
                onPress: () => toggleCardSnooze(contactId, true),
              },
            });
          });
        return;
      }

      Alert.alert(
        "Snooze contact",
        "Choose how long to pause reminders.",
        [
          ...CARD_SNOOZE_PRESETS.map(({ label, preset }) => ({
            text: label,
            onPress: () => {
              void snoozeContactWithPreset(contactId, preset);
            },
          })),
          { text: "Cancel", style: "cancel" as const },
        ],
      );
    },
    [snoozeContactWithPreset, refreshAfterSnooze],
  );

  const enterCardSelection = useCallback(
    (contactId: number) => {
      useDashboardSelectionStore
        .getState()
        .enterSelection(rows.map((row) => row.id), contactId);
    },
    [rows],
  );

  const onSelectContacts = useCallback(async () => {
    const currentEligibleIds = rows.map((row) => row.id);
    const { viewMode, setViewMode } = useDashboardQueryStore.getState();

    try {
      if (viewMode !== "card") {
        await setViewMode(getExecutor(), "card");
      }
      useDashboardSelectionStore
        .getState()
        .enterSelection(currentEligibleIds);
    } catch (selectContactsError) {
      Logger.error(
        LOG_SCOPE,
        "failed to switch to card view before selection",
        selectContactsError,
      );
      showSnackbar({
        kind: "error",
        label: "Couldn't start selecting contacts. Try again.",
        action: {
          label: "Retry",
          accessibilityLabel: "Retry selecting contacts",
          onPress: () => {
            void onSelectContacts();
          },
        },
      });
    }
  }, [rows]);

  const overflowActions = buildDashboardOverflowActions({
    navigation,
    onReset,
    onSelectContacts: () => {
      void onSelectContacts();
    },
  });

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (!selectionMode) return false;
          exitBulkSelection();
          return true;
        },
      );
      return () => subscription.remove();
    }, [exitBulkSelection, selectionMode]),
  );

  // The cause-aware empty state — delegated to the pure gate (no inline count
  // arithmetic; HIGH-2). The live `activeFilter` (chip) + `hasTerm` (search box)
  // are threaded in: the gate's precedence resolves a zero-result search →
  // 'search-empty' BEFORE any filter/population branch, so a no-match search over
  // a non-empty population (or with a filter also active) never shows the
  // hidden-population or filter copy (MEDIUM-4).
  const term = debouncedSearchText.trim();
  const isSearchMode = term !== "";
  const contextMenuContact =
    contextMenuContactId === null
      ? null
      : (rows.find((row) => row.id === contextMenuContactId) ?? null);
  const contextMenuIsFavourite =
    contextMenuContact !== null &&
    (favouriteOverlay.get(contextMenuContact.id) ??
      (contextMenuContact.favourite_rank !== null));
  const contextMenuIsSnoozed =
    contextMenuContact !== null &&
    isSnoozed(contextMenuContact.snooze_until, listNow);
  const emptyState = selectDashboardEmptyState({
    live: counts.live,
    neverContacted: counts.neverContacted,
    snoozed: counts.snoozed,
    archived: counts.archived,
    unbound: counts.unbound,
    rowCount: rows.length,
    activeFilter: "all",
    activeFilters: query.filters,
    activePopulations: query.populations,
    populationCounts,
    hasTerm: term !== "",
  });
  const showInitialSkeleton = initialLoad && !error;

  const listHeader = (
    <View style={styles.header}>
      {!error && counts.live > 0 ? (
        <ChromeScrim style={styles.countScrim} radius={RADII.sm}>
          <Text
            testID="dashboard-header-count"
            style={[styles.countHeader, { color: colors.textSecondary }]}
          >
            {`${counts.live} contact${counts.live === 1 ? "" : "s"}`}
          </Text>
        </ChromeScrim>
      ) : null}
    </View>
  );

  const listEmptyContent = error ? (
    <View testID="dashboard-error-state" style={styles.emptyState}>
      <Text style={[styles.emptyHeading, { color: colors.textPrimary }]}>
        Couldn't load your contacts
      </Text>
      <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
        Pull down to try again.
      </Text>
    </View>
  ) : emptyState === "search-empty" ? (
    <View testID="dashboard-empty-search" style={styles.emptyState}>
      <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
        {`No matches for "${term}"`}
      </Text>
    </View>
  ) : emptyState === "birthdays-empty" ? (
    <View testID="dashboard-empty-birthdays" style={styles.emptyState}>
      <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
        {`Nothing in ${POPULATION_LABELS.birthdays}.`}
      </Text>
    </View>
  ) : emptyState === "not-contacted-empty" ? (
    <View testID="dashboard-empty-not-contacted" style={styles.emptyState}>
      <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
        {`Nothing in ${POPULATION_LABELS["not-contacted"]}.`}
      </Text>
    </View>
  ) : emptyState === "snoozed-empty" ? (
    <View testID="dashboard-empty-snoozed" style={styles.emptyState}>
      <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
        {`Nothing in ${POPULATION_LABELS.snoozed}.`}
      </Text>
    </View>
  ) : emptyState === "firstrun" ? (
    <View style={styles.emptyState}>
      <Pressable
        testID="dashboard-empty-firstrun"
        accessibilityRole="button"
        accessibilityLabel="Add your first contact"
        onPress={() => navigation.navigate("Create")}
        style={[
          styles.primaryCta,
          { backgroundColor: colors.accent, borderColor: colors.accent },
        ]}
      >
        <Text style={[styles.primaryCtaText, { color: colors.background }]}>
          Add your first contact
        </Text>
      </Pressable>
    </View>
  ) : emptyState === "hidden" ? (
    <View testID="dashboard-empty-hidden" style={styles.emptyState}>
      <Text style={[styles.emptyHeading, { color: colors.textPrimary }]}>
        Everyone's tucked away
      </Text>
      {counts.neverContacted > 0 ? (
        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
          {`${counts.neverContacted} not yet contacted →`}
        </Text>
      ) : null}
      {counts.snoozed > 0 ? (
        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
          {`${counts.snoozed} snoozed`}
        </Text>
      ) : null}
      {counts.archived > 0 ? (
        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
          {`${counts.archived} archived`}
        </Text>
      ) : null}
    </View>
  ) : emptyState === "filter-empty" ? (
    <View testID="dashboard-empty-filter" style={styles.emptyState}>
      {query.populations.includes("favourites") &&
      populationCounts.favourites === 0 ? (
        // Only the genuine "no favourites exist" case gets the onboarding copy.
        // A favourites-population list zeroed by an active filter still HAS
        // favourites, so it falls through to the neutral filtered-empty copy (WR-03).
        <>
          <Text style={[styles.emptyHeading, { color: colors.textPrimary }]}>
            No favourites yet
          </Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            Tap the star on a contact's profile to add them here.
          </Text>
        </>
      ) : (
        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
          Nothing here right now.
        </Text>
      )}
    </View>
  ) : null;

  // Chrome scrim (31.1-05): empty-state copy sits on the bare background, so back
  // it locally to stay AA over the lightened veil. Cards already back their own.
  const listEmpty = listEmptyContent ? (
    <ChromeScrim style={styles.emptyPanel} radius={RADII.md}>
      {listEmptyContent}
    </ChromeScrim>
  ) : null;

  return (
    <View
      testID="dashboard-root"
      style={styles.root}
    >
      <View
        accessible={!panelOpen}
        importantForAccessibility={panelOpen ? "no-hide-descendants" : "auto"}
        pointerEvents={panelOpen ? "none" : "auto"}
      >
        <ShellAppBar
          variant="root"
          title="Orbit"
          overflow={overflowActions}
          trailingLabelProbe={["Your Week", "Group Events"]}
          trailing={({ compact }) => (
            <View style={styles.headerDestinations}>
              <Pressable
                testID="dashboard-your-week-entry"
                accessibilityRole="button"
                accessibilityLabel="Your Week"
                hitSlop={4}
                onPress={() => navigation.navigate("Digest")}
                style={styles.headerDestination}
              >
                {({ pressed }) => (
                  <>
                    <Icon
                      name="your-week"
                      size="md"
                      tone={pressed ? "accent" : "textSecondary"}
                    />
                    {!compact ? (
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.headerDestinationLabel,
                          {
                            color: pressed
                              ? colors.accent
                              : colors.textSecondary,
                          },
                        ]}
                      >
                        Your Week
                      </Text>
                    ) : null}
                  </>
                )}
              </Pressable>
              <Pressable
                testID="dashboard-group-events-entry"
                accessibilityRole="button"
                accessibilityLabel="Group Events"
                hitSlop={4}
                onPress={() => navigation.navigate("GroupEvents")}
                style={styles.headerDestination}
              >
                {({ pressed }) => (
                  <>
                    <Icon
                      name="group-events"
                      size="md"
                      tone={pressed ? "accent" : "textSecondary"}
                    />
                    {!compact ? (
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.headerDestinationLabel,
                          {
                            color: pressed
                              ? colors.accent
                              : colors.textSecondary,
                          },
                        ]}
                      >
                        Group Events
                      </Text>
                    ) : null}
                  </>
                )}
              </Pressable>
            </View>
          )}
        />
      </View>
      {selectionMode ? (
        <View
          testID="dashboard-selection-controls"
          accessibilityLabel={`${selectionCount} selected`}
          style={[
            styles.selectionControls,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.selectionCount, { color: colors.textPrimary }]}
          >
            {selectionCount} selected
          </Text>
          <View style={styles.selectionActions}>
            <Pressable
              testID="dashboard-selection-select-all"
              accessibilityRole="button"
              accessibilityLabel="Select All"
              onPress={selectAll}
              style={styles.selectionAction}
            >
              <Icon name="select-all" size="sm" tone="textPrimary" />
              <Text
                style={[
                  styles.selectionActionLabel,
                  { color: colors.textPrimary },
                ]}
              >
                Select All
              </Text>
            </Pressable>
          </View>
          <BulkActionSurface
            selectedCount={selectionCount}
            pending={bulkActionPending}
            onQuickLog={onBulkQuickLog}
            onLogInteraction={onBulkLogInteraction}
            onAddFavourites={onBulkAddFavourites}
            onRemoveFavourites={onBulkRemoveFavourites}
            onSnooze={onBulkOpenSnoozePicker}
            onUnsnooze={onBulkUnsnooze}
            onSetCategory={onBulkOpenCategoryPicker}
            onArchive={onBulkArchive}
            onChangeFrequency={onBulkOpenFrequencyPicker}
            onExit={exitBulkSelection}
          />
        </View>
      ) : (
        <DashboardControlRow onPanelOpenChange={setPanelOpen} />
      )}
      <View
        accessible={!panelOpen}
        importantForAccessibility={panelOpen ? "no-hide-descendants" : "auto"}
        pointerEvents={panelOpen ? "none" : "auto"}
        style={styles.listRegion}
      >
        {!selectionMode ? (
          <View testID="dashboard-search-row" style={styles.searchRow}>
          <Pressable
            testID="dashboard-search-toggle"
            accessibilityRole="button"
            accessibilityLabel={searchExpanded ? "Close search" : "Search"}
            accessibilityState={{ expanded: searchExpanded }}
            onPress={onToggleSearch}
            hitSlop={8}
            style={styles.searchToggle}
          >
            <Icon
              name="search"
              state={searchExpanded ? "active" : "default"}
              size="md"
              tone="textSecondary"
            />
          </Pressable>
          {searchExpanded ? (
            <Animated.View style={[styles.searchInputWrap, searchInputStyle]}>
              <TextInput
                testID="dashboard-search-input"
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search people and notes"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.searchInput,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}
              />
              {searchText !== "" ? (
                <Pressable
                  testID="dashboard-search-clear"
                  accessibilityRole="button"
                  accessibilityLabel="Clear"
                  onPress={onClearSearch}
                  style={[styles.searchClear, { borderColor: colors.border }]}
                >
                  <Text
                    style={[
                      styles.searchClearText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Clear
                  </Text>
                </Pressable>
              ) : null}
            </Animated.View>
          ) : (
            <View style={styles.searchSpacer} />
          )}
          <View style={styles.viewToggleWrap}>
            <SegmentedControl<DashboardViewMode>
              testID="dashboard-view-toggle"
              options={VIEW_TOGGLE_OPTIONS}
              value={query.viewMode}
              onChange={onChangeView}
            />
          </View>
          </View>
        ) : null}
        <View style={styles.listRegion}>
          {query.viewMode === "list" ? (
            <Animated.View style={[styles.listRegion, resultTransitionStyle]}>
              <FlatList
              data={error || showInitialSkeleton ? [] : rows}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <SwipeableListRow
                  contactId={item.id}
                  name={item.name}
                  photo={item.photo}
                  modifiedAt={item.modified_at}
                  categoryLabel={item.categoryLabel}
                  lastContact={item.last_contact}
                  snoozeUntil={item.snooze_until}
                  status={item.status}
                  now={listNow}
                  onPress={() => goToProfile(item.id)}
                  isFavourite={
                    favouriteOverlay.get(item.id) ?? (item.favourite_rank !== null)
                  }
                  onToggleFavourite={() => {
                    const renderedMembership =
                      favouriteOverlay.get(item.id) ??
                      (item.favourite_rank !== null);
                    toggleFavourite(item.id, !renderedMembership);
                  }}
                  line3={line3ByContactId.get(item.id) ?? null}
                  searchResult={
                    isSearchMode
                      ? (searchResultsByContactId.get(item.id) ?? null)
                      : undefined
                  }
                  searchSnippet={isSearchMode ? item.snippet : null}
                  onLogInteraction={onLogInteraction}
                  onEditContact={onEditContact}
                  openRowRef={openRowRef}
                />
              )}
              ListHeaderComponent={listHeader}
              ListEmptyComponent={showInitialSkeleton ? <ListLoadingSkeleton /> : listEmpty}
              contentContainerStyle={[
                styles.content,
                { paddingBottom: bottomClearance },
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.accent}
                  colors={[colors.accent]}
                />
              }
              />
            </Animated.View>
          ) : (
            <Animated.View
              testID="dashboard-card-results"
              style={[styles.listRegion, resultTransitionStyle]}
            >
              <CardGrid
              rows={cardRows}
              now={listNow}
              onPressContact={goToProfile}
              onLongPressContact={openCardContextMenu}
              onViewProfile={goToProfile}
              onQuickLog={logQuickly}
              onLogInteraction={logCardInteraction}
              onMessage={messageContact}
              onEditContact={onEditContact}
              onSelect={enterCardSelection}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelection}
              favouriteOverlay={favouriteOverlay}
              onToggleFavourite={toggleFavourite}
              line3ByContactId={line3ByContactId}
              searchResultsByContactId={searchResultsByContactId}
              isSearchMode={isSearchMode}
              error={error}
              showInitialSkeleton={showInitialSkeleton}
              loadingSkeleton={<ListLoadingSkeleton />}
              listHeader={listHeader}
              listEmpty={listEmpty}
              refreshing={refreshing}
              onRefresh={onRefresh}
              bottomClearance={bottomClearance}
              />
            </Animated.View>
          )}
        </View>
      </View>
      <DashboardOverlayHost />
      <CardContextMenu
        visible={contextMenuContact !== null}
        contactId={contextMenuContact?.id ?? null}
        name={contextMenuContact?.name ?? ""}
        isFavourite={contextMenuIsFavourite}
        isSnoozed={contextMenuIsSnoozed}
        onViewProfile={() => {
          if (contextMenuContact) goToProfile(contextMenuContact.id);
        }}
        onQuickLog={() => {
          if (contextMenuContact) logQuickly(contextMenuContact.id);
        }}
        onLogInteraction={() => {
          if (contextMenuContact) logCardInteraction(contextMenuContact.id);
        }}
        onMessage={() => {
          if (contextMenuContact) messageContact(contextMenuContact.id);
        }}
        onEditContact={() => {
          if (contextMenuContact) onEditContact(contextMenuContact.id);
        }}
        onToggleFavourite={() => {
          if (contextMenuContact) {
            toggleFavourite(contextMenuContact.id, !contextMenuIsFavourite);
          }
        }}
        onToggleSnooze={() => {
          if (contextMenuContact) {
            toggleCardSnooze(contextMenuContact.id, contextMenuIsSnoozed);
          }
        }}
        onSelect={() => {
          if (contextMenuContact) enterCardSelection(contextMenuContact.id);
        }}
        onRequestClose={() => setContextMenuContactId(null)}
      />
      <Sheet
        visible={snoozePicker !== null}
        onRequestClose={() => {
          setSnoozePicker(null);
          releaseBulkInputClaim();
        }}
        variant="compact"
      >
        <Text style={[styles.bulkPickerTitle, { color: colors.textSecondary }]}>
          Snooze contacts
        </Text>
        {CARD_SNOOZE_PRESETS.map(({ preset, label }) => (
          <Pressable
            key={preset}
            testID={`bulk-snooze-preset-${preset}`}
            accessibilityRole="button"
            accessibilityLabel={`Snooze ${snoozePicker?.ids.length ?? 0} contacts for ${label}`}
            onPress={() => {
              const picker = snoozePicker;
              if (!picker || !consumeBulkAction(picker.claim)) return;
              const ids = picker.ids;
              setSnoozePicker(null);
              void bulkSnooze(getExecutor(), ids, preset, localDateTime())
                .then(async () => {
                  commitBulkOutcome(`Snoozed ${ids.length} contacts`);
                  await reconcileSchedule(getExecutor()).catch((scheduleError) =>
                    Logger.error(
                      LOG_SCOPE,
                      "failed to reconcile after bulk snooze",
                      scheduleError,
                    ),
                  );
                })
                .catch((writeError: unknown) => {
                  releaseBulkAction(picker.claim);
                  reportBulkFailure("snooze contacts", writeError, onBulkOpenSnoozePicker);
                })
                .finally(() => releaseBulkAction(picker.claim));
            }}
            style={[styles.bulkPickerRow, { borderColor: colors.border }]}
          >
            <Icon name="snooze" size="md" tone="textPrimary" />
            <Text style={[styles.bulkPickerLabel, { color: colors.textPrimary }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </Sheet>
      <Sheet
        visible={categoryPicker !== null}
        onRequestClose={() => {
          setCategoryPicker(null);
          releaseBulkInputClaim();
        }}
        variant="detail"
      >
        <Text style={[styles.bulkPickerTitle, { color: colors.textSecondary }]}>
          Set category
        </Text>
        {categoryPicker?.categories.map((category) => (
          <Pressable
            key={category.id}
            testID={`bulk-category-${category.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Set category to ${category.name} for ${selectionCount} contacts`}
            onPress={() => {
              const picker = categoryPicker;
              if (!picker || !consumeBulkAction(picker.claim)) return;
              setCategoryPicker(null);
              const ids = getCurrentSelectionIds(
                useDashboardSelectionStore.getState(),
                picker.sessionId,
              );
              if (!ids?.length) {
                releaseBulkAction(picker.claim);
                return;
              }
              void bulkSetCategory(
                getExecutor(),
                ids,
                category.id,
                localDateTime(),
              )
                .then(() =>
                  commitBulkOutcome(
                    `Set category to ${category.name} for ${ids.length} contacts`,
                  ),
                )
                .catch((writeError: unknown) => {
                  releaseBulkAction(picker.claim);
                  reportBulkFailure(
                    "set contact category",
                    writeError,
                    onBulkOpenCategoryPicker,
                  );
                })
                .finally(() => releaseBulkAction(picker.claim));
            }}
            style={[styles.bulkPickerRow, { borderColor: colors.border }]}
          >
            <Icon name="category" size="md" tone="textPrimary" />
            <Text style={[styles.bulkPickerLabel, { color: colors.textPrimary }]}>
              {category.name}
            </Text>
          </Pressable>
        ))}
      </Sheet>
      <Sheet
        visible={frequencyPicker !== null}
        onRequestClose={() => {
          setFrequencyPicker(null);
          releaseBulkInputClaim();
        }}
        variant="compact"
      >
        <Text style={[styles.bulkPickerTitle, { color: colors.textSecondary }]}>
          Change Contact Frequency
        </Text>
        <TextInput
          testID="bulk-frequency-input"
          accessibilityLabel="Frequency in days"
          keyboardType="number-pad"
          value={frequencyDraft}
          onChangeText={setFrequencyDraft}
          placeholder="Days"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.bulkFrequencyInput,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
        />
        <Pressable
          testID="bulk-frequency-continue"
          accessibilityRole="button"
          accessibilityLabel="Confirm frequency"
          onPress={() => {
            const intervalDays = Number(frequencyDraft);
            const picker = frequencyPicker;
            if (!picker || !Number.isInteger(intervalDays) || intervalDays <= 0) {
              AccessibilityInfo.announceForAccessibility(
                "Frequency must be a positive whole number",
              );
              showSnackbar({
                kind: "error",
                label: "Frequency must be a positive whole number.",
                action: {
                  label: "Dismiss",
                  accessibilityLabel: "Dismiss notification",
                  onPress: dismissSnackbar,
                },
              });
              return;
            }
            setFrequencyPicker(null);
            setBulkConfirm({
              kind: "frequency",
              ids: picker.ids,
              intervalDays,
              claim: picker.claim,
            });
          }}
          style={[
            styles.bulkFrequencyContinue,
            { backgroundColor: colors.accent, borderColor: colors.accent },
          ]}
        >
          <Text style={[styles.bulkPickerLabel, { color: colors.background }]}>
            Continue
          </Text>
        </Pressable>
      </Sheet>
      <ConfirmDialog
        visible={bulkConfirm !== null}
        onRequestClose={dismissBulkConfirm}
        title={
          bulkConfirm?.kind === "quick-log"
            ? `Log ${bulkConfirm.ids.length} interactions?`
            : bulkConfirm?.kind === "archive"
              ? `Archive ${bulkConfirm.ids.length} contacts?`
              : "Change Contact Frequency?"
        }
        message={
          bulkConfirm?.kind === "archive"
            ? "Archived contacts leave the Dashboard. You can restore them from Archived Contacts."
            : bulkConfirm?.kind === "frequency"
              ? `Set all ${bulkConfirm.ids.length} contacts to every ${bulkConfirm.intervalDays} days?`
              : undefined
        }
        confirmLabel={
          bulkConfirm?.kind === "archive"
            ? "Archive"
            : bulkConfirm?.kind === "frequency"
              ? "Change frequency"
              : "Log interactions"
        }
        destructive={false}
        onConfirm={onBulkConfirm}
        onCancel={dismissBulkConfirm}
      />
      <PostLogNoteEditor
        target={postLogTarget}
        onClose={() => setPostLogTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  listRegion: {
    flex: 1,
  },
  headerDestinations: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerDestination: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  headerDestinationLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  content: {
    padding: 16,
    gap: 10,
  },
  header: {
    gap: 10,
    marginBottom: 4,
  },
  countScrim: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  countHeader: {
    fontSize: 13,
    fontWeight: "600",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchToggle: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchSpacer: {
    flex: 1,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchClear: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  searchClearText: {
    fontSize: 14,
    fontWeight: "600",
  },
  viewToggleWrap: {
    width: 96,
  },
  selectionControls: {
    borderBottomWidth: 1,
    gap: SPACING.sm,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
  },
  selectionCount: {
    fontFamily: TYPOGRAPHY.body.family,
    fontSize: TYPOGRAPHY.body.size,
    fontWeight: TYPOGRAPHY.body.weight,
    lineHeight: TYPOGRAPHY.body.lineHeight,
  },
  selectionActions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  selectionAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.xs,
    minHeight: SPACING["2xl"],
    paddingHorizontal: SPACING.sm,
  },
  selectionActionLabel: {
    fontFamily: TYPOGRAPHY.label.family,
    fontSize: TYPOGRAPHY.label.size,
    fontWeight: TYPOGRAPHY.label.weight,
    lineHeight: TYPOGRAPHY.label.lineHeight,
  },
  bulkPickerTitle: {
    fontFamily: TYPOGRAPHY.label.family,
    fontSize: TYPOGRAPHY.label.size,
    marginBottom: SPACING.sm,
  },
  bulkPickerRow: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: SPACING.md,
    minHeight: 44,
  },
  bulkPickerLabel: {
    fontFamily: TYPOGRAPHY.label.family,
    fontSize: TYPOGRAPHY.label.size,
  },
  bulkFrequencyInput: {
    borderRadius: RADII.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
  },
  bulkFrequencyContinue: {
    alignItems: "center",
    borderRadius: RADII.md,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 44,
    marginTop: SPACING.sm,
  },
  sortControl: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sortOption: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  manageEntry: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 4,
  },
  manageText: {
    fontSize: 15,
    fontWeight: "700",
  },
  emptyState: {
    gap: 8,
    alignItems: "flex-start",
  },
  emptyPanel: {
    marginTop: 24,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    overflow: "hidden",
  },
  emptyHeading: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 21,
  },
  primaryCta: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryCtaText: {
    fontSize: 16,
    fontWeight: "600",
  },
  swipeAction: {
    width: SWIPE_ACTION_WIDTH,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  swipeActionLeft: {
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  swipeActionRight: {
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  swipeActionLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  skeletonList: {
    gap: SPACING.md,
  },
  skeletonRow: {
    alignItems: "center",
    borderRadius: RADII.lg,
    borderWidth: SPACING.xs / 2,
    flexDirection: "row",
    gap: SPACING.md,
    minHeight: SPACING["2xl"] + SPACING.lg,
    padding: SPACING.md,
  },
  skeletonAvatar: {
    borderRadius: SPACING["2xl"],
    height: SPACING["2xl"],
    width: SPACING["2xl"],
  },
  skeletonTextBlock: {
    flex: 1,
    gap: SPACING.xs,
  },
  skeletonName: {
    borderRadius: SPACING.xs,
    height: SPACING.md,
    width: "52%",
  },
  skeletonLine: {
    borderRadius: SPACING.xs,
    height: SPACING.sm,
    width: "68%",
  },
  skeletonLineShort: {
    borderRadius: SPACING.xs,
    height: SPACING.sm,
    width: "38%",
  },
});
