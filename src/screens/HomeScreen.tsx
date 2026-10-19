/**
 * HomeScreen — the dashboard CORE (DASH-01/03/04/05/07). This IS the app's home
 * surface: the Phase 25 query-state population (`listDashboardPopulation`, or
 * `composeDashboardSearch` when a term is present) rendered as ListRows or a CardGrid,
 * the contact-count header, the Population/Filters/Sort control row, the Row 3
 * collapsible session-backed search + List/Card toggle, a reliable freshness
 * path, and cause-aware empty/error states.
 *
 * FRESHNESS (DASH-07 / threat T-08-18; RG-022, D-14, D-23): one scheduler
 * (`createDashboardRefreshScheduler`) issues every read — on `useFocusEffect`
 * (also re-issued by a query/search change), the shell tick, the post-sweep
 * foreground tick, pull-to-refresh and card snooze. Shell/foreground requests
 * while Home is hidden are deferred to the next focus read. It deliberately
 * does NOT subscribe to the connection-scoped SQLite change notification — that
 * mechanism is bound to this screen's own DB connection and is structurally blind
 * to the headless widget / notification "mark contacted" writes that happen on a
 * different connection, so it would silently miss cross-context updates. Focus +
 * foreground tick + pull is the only path that reflects those writes.
 *
 * READS (threat T-08-16/17): every read is async on-device SQLite (the D-12
 * `listDashboardPopulation` / `composeDashboardSearch` read + the counts via
 * `getExecutor()`) issued by the one `createDashboardRefreshScheduler` and
 * published only through `publishDashboardRead`, whose latest-request token
 * means a stale async result can never clobber a newer one (RG-022, D-23); no
 * network sits on the read path, and the DAO already scopes off_limits /
 * unconfirmed-ai / archived rows in-query (this screen performs no `.filter()`
 * on private data).
 *
 * The empty-state decision is delegated to the pure, node-tested
 * `selectDashboardEmptyState` (08-07 Task 1) — no inline count arithmetic here
 * (review HIGH-2): first-run fires ONLY when all four populations are empty, so a
 * never-contacted-only or snoozed-only user gets the hidden-population pointer,
 * never "Add your first contact".
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AccessibilityInfo,
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
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useShallow } from "zustand/react/shallow";
import { BulkActionSurface } from "@/components/BulkActionSurface";
import { BulkFrequencySheet } from "@/components/BulkFrequencySheet";
import { CardContextMenu } from "@/components/CardContextMenu";
import { CardGrid } from "@/components/CardGrid";
import { CategoryChoiceSheet } from "@/components/category/CategoryChoiceSheet";
import { AXIS_DEFAULT_LABELS } from "@/components/control-surface/control-labels";
import { DashboardControlRow } from "@/components/control-surface/DashboardControlRow";
import { DashboardOverlayHost } from "@/components/control-surface/DashboardOverlayHost";
import {
  dashboardPanelFocusEffect,
  dashboardPanelStore,
  selectPanelOpen,
} from "@/components/control-surface/dashboard-panel-store";
import { Icon } from "@/components/icons/Icon";
import { ICON_REGISTRY, type IconName } from "@/components/icons/icon-registry";
import { ListRow, type ListRowProps } from "@/components/ListRow";
import {
  PostLogNoteEditor,
  type PostLogNoteTarget,
} from "@/components/PostLogNoteEditor";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ShellAppBar } from "@/components/ShellAppBar";
import { SnoozeSheet } from "@/components/SnoozeSheet";
import { Button } from "@/components/ui/Button";
import { ChromeScrim } from "@/components/ui/ChromeScrim";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScopedPalette } from "@/components/ui/ScopedPalette";
import { createQuickLogUndoController } from "@/components/universal-fab-logic";
import { NEVER_CONTACTED } from "@/constants/glossary";
import { getAppSettings } from "@/db/app-settings-dao";
import {
  bulkAddFavourites,
  bulkArchive,
  bulkQuickLog,
  bulkRemoveFavourites,
  bulkSetCategory,
  bulkSetFrequency,
  bulkSnooze,
  bulkSnoozeUntil,
  bulkUnsnooze,
  undoBulkQuickLog,
} from "@/db/bulk-actions-dao";
import { listCategories } from "@/db/contact-read";
import { readLine3Candidates } from "@/db/dashboard-knowledge-read";
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
  readCurrentlySnoozedIds,
  readSelectionLifecycle,
} from "@/db/dashboard-read";
import { composeDashboardSearch } from "@/db/dashboard-search-read";
import { getExecutor, localDateTime } from "@/db/database";
import { clearFavouriteRank, setFavouriteRank } from "@/db/favourites-dao";
import {
  snoozeProfileContact,
  unsnoozeProfileContact,
} from "@/db/profile-relationship-actions";
import { deleteTouchpoint, recordTouchpoint } from "@/db/recency-dao";
import { newUid } from "@/db/uid";
import { countUnbound } from "@/db/unbound-read";
import { useRetainedWhileClosing } from "@/hooks/use-retained-while-closing";
import {
  type BulkActionClaim,
  createBulkActionGate,
  getCurrentSelectionIds,
  runClaimedBulkWrite,
} from "@/logic/dashboard-bulk-action-session";
import {
  filterEmptyCopy,
  populationEmptyCopy,
  SHOW_ACTIVE_CONTACTS_LABEL,
  tuckedAwayLines,
} from "@/logic/dashboard-empty-copy";
import {
  type DashboardPopulationCounts,
  selectDashboardEmptyState,
} from "@/logic/dashboard-empty-logic";
import {
  dashboardHeaderCount,
  dashboardHeaderCountLabel,
} from "@/logic/dashboard-header-count";
import type { DashboardViewMode } from "@/logic/dashboard-query-logic";
import type { DashboardSearchResult } from "@/logic/dashboard-search-match";
import {
  bulkWriteIds,
  lifecycleFromRows,
  lifecycleMapFrom,
  SELECTION_INCLUDES_UNBOUND,
  type SelectionLifecycleMap,
  selectAllLabelFor,
  selectionApplicability,
  selectionUniverseIds,
  shouldApplyLifecycleRefresh,
  withFavouriteOverlay,
} from "@/logic/dashboard-selection-applicability";
import {
  favouriteTapOutcome,
  isUnboundRow,
} from "@/logic/dashboard-unbound-row";
import {
  applyCommittedMembership,
  createFavouriteOptimisticStore,
} from "@/logic/favourite-optimistic";
import { resolveHomeBack } from "@/logic/home-session-logic";
import { selectLine3 } from "@/logic/list-row-selection";
import { navigationRef } from "@/navigation/linking";
import { navigateIntoTab } from "@/navigation/tab-entry";
import type { DashboardScreenProps, TabParamList } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import {
  bulkBinConfirmation,
  unboundStarExplanation,
} from "@/screens/contact-profile-logic";
import { buildDashboardOverflowActions } from "@/screens/dashboard-overflow-actions";
import {
  createDashboardRefreshScheduler,
  type DashboardReadOutcome,
  type DashboardReadSinks,
  type DashboardRefreshScheduler,
  type DashboardRefreshSource,
  dashboardFadeStart,
  isDashboardVisible,
  publishDashboardRead,
} from "@/screens/dashboard-refresh-scheduler";
import { reconcileSchedule } from "@/services/notifications/notification-schedule";
import { runQuickLog } from "@/services/quick-log-command";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { useDashboardQueryStore } from "@/stores/dashboard-query-store";
import { useDashboardSelectionStore } from "@/stores/dashboard-selection-store";
import { useDashboardSessionStore } from "@/stores/dashboard-session-store";
import {
  bumpShellRefresh,
  useForegroundRefresh,
  useShellRefresh,
} from "@/stores/shell-refresh-store";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { showSnackbar, snackbarStore } from "@/stores/snackbar-store";
import { type ThemePalette, useTheme } from "@/theme";
import { EASING, MOTION } from "@/theme/tokens/motion";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { useReducedMotion } from "@/theme/use-reduced-motion";
import { formatLocalDate, isSnoozed, parseLocalMs } from "@/utils/dates";
import { Logger } from "@/utils/logger";
import { plural, pluralWord } from "@/utils/plural";

/** The list header while a newer search term is being read (38.13 D-44). */
const SEARCHING_LABEL = "Searching…";
/** The debounce interval (ms) that collapses a keystroke burst to one read. */
const SEARCH_DEBOUNCE_MS = 220;
/**
 * List view windowing (38.13 D-55 / D-81 F2): how many rows the List FlatList
 * keeps mounted. The values are the 38.13-01 B5 bisect's (16 rows mounted,
 * List memory ~300 MB on the ~1,000-contact set, from 1,749 MB). They are set
 * explicitly because the defaults mounted every row and why was not isolated.
 * Row heights are never declared up front: they grow with large text (Phase 40).
 */
const LIST_WINDOW_SIZE = 5;
const LIST_INITIAL_NUM_TO_RENDER = 8;
const LIST_MAX_TO_RENDER_PER_BATCH = 5;
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

/** 38.13 D-30: what each empty population says (fixed copy). */
const birthdaysEmptyCopy = populationEmptyCopy("birthdays");
const notContactedEmptyCopy = populationEmptyCopy("not-contacted");
const snoozedEmptyCopy = populationEmptyCopy("snoozed");

const LOG_SCOPE = "dashboard-home";
const SWIPE_ACTION_WIDTH = 96;

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
  navigateIntoTab(navigationRef.current, "DashboardTab", target, {
    contactId,
  });
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
            style={[
              styles.skeletonAvatar,
              { backgroundColor: colors.surfaceElevated },
            ]}
          />
          <View style={styles.skeletonTextBlock}>
            <View
              style={[
                styles.skeletonName,
                { backgroundColor: colors.surfaceElevated },
              ]}
            />
            <View
              style={[
                styles.skeletonLine,
                { backgroundColor: colors.surfaceElevated },
              ]}
            />
            <View
              style={[
                styles.skeletonLineShort,
                { backgroundColor: colors.surfaceElevated },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Mirrors `ReanimatedSwipeable`'s applied translation into the row's own shared
 * value, on the UI thread (review WR-01, D-48). The swipeable hands that value
 * only to its action renderers; the row's see-through tint reads the mirror and
 * rises to `SWIPE_ROW_BACKING_OPACITY` while it is non-zero. Rendered in the
 * left actions layer, an earlier sibling of the row, so this reaction's mapper
 * registers before the row tint's style mapper and both run in the same frame.
 */
function SwipeTranslationMirror({
  translation,
  mirror,
}: {
  translation: SharedValue<number>;
  mirror: SharedValue<number>;
}) {
  useAnimatedReaction(
    () => translation.value,
    (value) => {
      mirror.value = value;
    },
  );
  return null;
}

/**
 * The memoised List row host's props (38.13 D-55 / D-81 F1). Scalars only, plus
 * callbacks that take a contact id and keep one identity for the screen's life,
 * so an unchanged contact gets identical props across publishes and a
 * Population, Filters, Sort or search change re-renders only the rows whose own
 * props changed. Line 3 travels as its two strings and time as the read's local
 * day, never as a per-read object or a seconds timestamp (review R1-01).
 */
type SwipeableListRowProps = Pick<
  ListRowProps,
  | "contactId"
  | "name"
  | "photo"
  | "categoryLabel"
  | "lastContact"
  | "snoozeUntil"
  | "status"
  | "searchResult"
> & {
  /**
   * The read's local day (`YYYY-MM-DD`). ListRow's only uses of `now` are
   * calendar-day granular (`isSnoozed`, `formatListRecency`), so the day key
   * renders exactly what the full timestamp did.
   */
  listDay: string;
  isFavourite: boolean;
  line3Text: string | undefined;
  line3IconName: IconName | undefined;
  unbound: boolean;
  onOpenProfile: (contactId: number) => void;
  onFavouriteTap: (contactId: number, nextMembership: boolean) => void;
  /** The right swipe: follows the swipe preference (one function, 39 D-53). */
  onSwipeRightAction: (contactId: number) => Promise<void>;
  /** The left swipe and the Edit Contact accessibility action. */
  onEditContact: (contactId: number) => void;
  /** The Quick Log accessibility action (D-26). */
  onQuickLog: (contactId: number) => void;
  /** The Log Interaction accessibility action: opens Log Interaction (D-26). */
  onLogInteraction: (contactId: number) => void;
  openRowRef: { current: SwipeableMethods | null };
};

const SwipeableListRow = memo(function SwipeableListRow({
  contactId,
  listDay,
  isFavourite,
  line3Text,
  line3IconName,
  onOpenProfile,
  onFavouriteTap,
  onSwipeRightAction,
  onEditContact,
  onQuickLog,
  onLogInteraction,
  openRowRef,
  ...rowProps
}: SwipeableListRowProps) {
  const swipeableRef = useRef<SwipeableMethods | null>(null);
  const swipeTranslation = useSharedValue(0);
  // ListRow's line-3 object, rebuilt only when its two strings change.
  const line3 = useMemo(
    () =>
      line3Text === undefined
        ? null
        : line3IconName === undefined
          ? { text: line3Text }
          : { text: line3Text, iconName: line3IconName },
    [line3IconName, line3Text],
  );
  const isThisRowOpen = useCallback(
    () => openRowRef.current === swipeableRef.current,
    [openRowRef],
  );

  const onWillOpen = useCallback(() => {
    const previousRow = openRowRef.current;
    if (previousRow && previousRow !== swipeableRef.current) {
      previousRow.close();
    }
    openRowRef.current = swipeableRef.current;
  }, [openRowRef]);

  const onClose = useCallback(() => {
    if (isThisRowOpen()) openRowRef.current = null;
  }, [isThisRowOpen, openRowRef]);

  const onPress = useCallback(() => {
    if (isThisRowOpen()) {
      swipeableRef.current?.close();
      openRowRef.current = null;
      return;
    }
    onOpenProfile(contactId);
  }, [contactId, isThisRowOpen, onOpenProfile, openRowRef]);

  // The star flips what this row renders; the host's gate decides the rest.
  const onToggleFavourite = useCallback(() => {
    onFavouriteTap(contactId, !isFavourite);
  }, [contactId, isFavourite, onFavouriteTap]);

  const onRowQuickLog = useCallback(() => {
    onQuickLog(contactId);
  }, [contactId, onQuickLog]);

  const onRowLogInteraction = useCallback(() => {
    onLogInteraction(contactId);
  }, [contactId, onLogInteraction]);

  const onRowEditContact = useCallback(() => {
    onEditContact(contactId);
  }, [contactId, onEditContact]);

  // D-25: the row closes once its action fires, in either direction. The
  // close animates back and `onClose` clears `openRowRef`; no React state.
  const onSwipeableOpen = useCallback(
    (direction: "left" | "right") => {
      if (direction === "right") {
        void onSwipeRightAction(contactId);
      } else {
        onEditContact(contactId);
      }
      swipeableRef.current?.close();
    },
    [contactId, onEditContact, onSwipeRightAction],
  );

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={1.8}
      leftThreshold={SWIPE_ACTION_WIDTH / 2}
      rightThreshold={SWIPE_ACTION_WIDTH / 2}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={(_progress, translation) => (
        <>
          <SwipeTranslationMirror
            translation={translation}
            mirror={swipeTranslation}
          />
          <SwipeActionSurface label="Log" icon="message" side="left" />
        </>
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
        contactId={contactId}
        now={listDay}
        isFavourite={isFavourite}
        line3={line3}
        swipeTranslation={swipeTranslation}
        onPress={onPress}
        onToggleFavourite={onToggleFavourite}
        onQuickLog={onRowQuickLog}
        onLogInteraction={onRowLogInteraction}
        onEditContact={onRowEditContact}
      />
    </ReanimatedSwipeable>
  );
});

interface ListRowLine3 {
  text: string;
  iconName?: IconName;
}

function isIconName(value: string): value is IconName {
  return value in ICON_REGISTRY;
}

/** The population counts feeding the cause-aware empty-state gate (the header counts displayed rows, D-55). */
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

/** The lifecycle map outside selection (one identity, so React bails out). */
const EMPTY_SELECTION_LIFECYCLE: SelectionLifecycleMap = new Map();

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
  const exitSelection = useDashboardSelectionStore(
    (state) => state.exitSelection,
  );
  const removeFromUniverse = useDashboardSelectionStore(
    (state) => state.removeFromUniverse,
  );
  const bottomClearance = useBottomClearance();
  // The List FlatList and the Card grid's FlatList; whichever is mounted is
  // scrolled to the top by Reset Dashboard View (38.13 D-31).
  const listRef = useRef<FlatList<DashboardRow> | null>(null);
  const cardGridRef = useRef<FlatList<DashboardRow> | null>(null);

  const resetDashboard = useCallback(async () => {
    try {
      await useDashboardQueryStore.getState().resetDashboardView(getExecutor());
      useDashboardSessionStore.getState().clearSession();
      // D-31: Reset returns the list to the top. The view mode is untouched
      // (D-04); scroll position is memory-only and nothing else stores it.
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      cardGridRef.current?.scrollToOffset({ offset: 0, animated: false });
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to reset dashboard view", error);
      showSnackbar({
        kind: "error",
        label: "Couldn't reset Contacts",
        action: {
          label: "Retry",
          accessibilityLabel: "Retry resetting the Contacts view",
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
  // 38.13 D-44: the trimmed search term the published rows belong to, set by
  // the read publication beside the rows (and by a failed read too, review
  // R1-15). Search mode and the search empty state follow THIS term, never the
  // live input, so the list never shows a count that belongs to no search.
  const [publishedSearchTerm, setPublishedSearchTerm] = useState("");
  // Review R2-04: every Contacts star tap looks its row up here by id, so a
  // tap callback never names `rows` in its deps (38.13-08 keeps those
  // callbacks stable). Rebuilt from the published rows each time they change.
  const rowsByIdRef = useRef(new Map<number, DashboardRow>());
  rowsByIdRef.current = useMemo(
    () => new Map(rows.map((row) => [row.id, row])),
    [rows],
  );
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

  const frozenIds = useMemo(() => new Set(frozenUniverse), [frozenUniverse]);
  const cardRows = selectionMode
    ? rows.filter((row) => frozenIds.has(row.id))
    : rows;
  const selectionCount = selectedIds.size;
  // 38.13 D-77 (review R1-03, R3-01, R4-01, R5-02): Bound/favourite for the
  // frozen universe, captured from the entry rows and then refreshed from the
  // database, never from the current rows (a filter, search or Set Category
  // can drop a selected person from them). React state, so every replacement
  // re-renders the bar. An id absent from it is unknown, never Bound.
  const [selectionLifecycle, setSelectionLifecycle] =
    useState<SelectionLifecycleMap>(EMPTY_SELECTION_LIFECYCLE);
  // The latest lifecycle request; bumped on every request, on entry and on
  // exit, so a stale read never applies (R5-02).
  const lifecycleRequestTokenRef = useRef(0);
  const refreshSelectionLifecycle = useCallback(() => {
    const { mode, sessionId, frozenUniverse } =
      useDashboardSelectionStore.getState();
    if (!mode) return;
    lifecycleRequestTokenRef.current += 1;
    const requestToken = lifecycleRequestTokenRef.current;
    void readSelectionLifecycle(getExecutor(), frozenUniverse)
      .then((entries) => {
        const current = useDashboardSelectionStore.getState();
        if (
          shouldApplyLifecycleRefresh({
            requestToken,
            currentToken: lifecycleRequestTokenRef.current,
            requestSessionId: sessionId,
            currentSessionId: current.sessionId,
            selectionMode: current.mode,
          })
        ) {
          setSelectionLifecycle(lifecycleMapFrom(entries));
        }
      })
      .catch((readError: unknown) => {
        // A failed refresh keeps the previous map.
        Logger.error(
          LOG_SCOPE,
          "failed to refresh the selection lifecycle",
          readError,
        );
      });
  }, []);
  // Selection ended: drop the map and retire any read still in flight.
  useEffect(() => {
    if (selectionMode) return;
    lifecycleRequestTokenRef.current += 1;
    setSelectionLifecycle(EMPTY_SELECTION_LIFECYCLE);
  }, [selectionMode]);
  // Every Home publish while selecting re-reads the map (R3-01).
  useEffect(() => {
    void rows;
    if (selectionMode) refreshSelectionLifecycle();
  }, [refreshSelectionLifecycle, rows, selectionMode]);
  // What the bar may do now (D-40, D-74, D-75, D-77). The individual star's
  // optimistic overlay still overrides `favourite` for the ids it covers.
  const effectiveSelectionLifecycle = useMemo(
    () => withFavouriteOverlay(selectionLifecycle, favouriteOverlay),
    [favouriteOverlay, selectionLifecycle],
  );
  const applicability = selectionApplicability(
    selectedIds,
    frozenUniverse.length,
    effectiveSelectionLifecycle,
  );
  // D-40: Select All, or Deselect all once the whole universe is selected.
  const onToggleSelectAll = useCallback(() => {
    const selection = useDashboardSelectionStore.getState();
    if (
      selectAllLabelFor(
        selection.selectedIds.size,
        selection.frozenUniverse.length,
      ) === "Deselect all"
    ) {
      selection.deselectAll();
    } else {
      selection.selectAll();
    }
  }, []);
  const [bulkActionPending, setBulkActionPending] = useState(false);
  const bulkActionGateRef = useRef<ReturnType<
    typeof createBulkActionGate
  > | null>(null);
  if (!bulkActionGateRef.current) {
    bulkActionGateRef.current = createBulkActionGate(setBulkActionPending);
  }
  // Holds a claim while it is awaiting a dialog or picker choice. Once a
  // choice consumes it, the writer owns that claim until its settled path.
  const bulkActionInputClaimRef = useRef<BulkActionClaim | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<BulkConfirmAction | null>(
    null,
  );
  // 38.11 D-45/D-82: the bulk snooze sheet's ids (the selection) and the
  // currently snoozed subset, both captured when it opens. The bulk claim is
  // never stored here: it lives in `bulkActionInputClaimRef` and every write
  // reads it at call time (review V-02).
  const [snoozePicker, setSnoozePicker] = useState<{
    ids: number[];
    snoozedIds: number[];
  } | null>(null);
  // 38.11 D-45/D-81 (review V-07): the card snooze sheet's target, captured
  // when the card menu entry is tapped (the menu then closes itself and nulls
  // its own contact).
  const [cardSnooze, setCardSnooze] = useState<{
    contactId: number;
    name: string;
    snoozeUntil: string | null;
  } | null>(null);
  // Review IN-06: both snooze sheets render their title and Unsnooze row from
  // the last target while they animate closed (onClose nulls the live state
  // first). `visible` and every write still read the live state.
  const cardSnoozeShown = useRetainedWhileClosing(cardSnooze);
  const snoozePickerShown = useRetainedWhileClosing(snoozePicker);
  const [categoryPicker, setCategoryPicker] = useState<{
    claim: BulkActionClaim;
    sessionId: number;
    categories: { id: number; name: string }[];
  } | null>(null);
  // 38.13 review B-WR-04: the sized Set Category sheet (D-85) keeps the
  // categories it opened with while it fades out, so it does not collapse to
  // a one-row compact sheet mid-close. `visible` and every write still read
  // the live state.
  const categoryPickerShown = useRetainedWhileClosing(categoryPicker);
  const [frequencyPicker, setFrequencyPicker] = useState<{
    claim: BulkActionClaim;
    ids: number[];
  } | null>(null);

  useEffect(() => {
    if (!selectionMode) return;
    const label = `${selectionCount} selected`;
    AccessibilityInfo.announceForAccessibility(label);
  }, [selectionCount, selectionMode]);
  const [resultGeneration, setResultGeneration] = useState(0);
  // 38.13 D-44: the result-fade start published with the rows (same batch as
  // the generation bump). The fade effect applies it after the rows commit.
  const [publishedFadeStart, setPublishedFadeStart] = useState(1);
  // Derived from the single panel-store owner (RG-020): never mirror it in
  // local state, or a missed close leaves both wrappers inert.
  const panelOpen = dashboardPanelStore(selectPanelOpen);
  // D-62: an open Population / Filter / Sort panel closes when Contacts loses
  // focus (tab switch, pushed screen), so it never sits hidden and eats the
  // first Back or tab re-tap elsewhere. Query state is untouched (ADR-092).
  useFocusEffect(dashboardPanelFocusEffect);
  const [contextMenuContactId, setContextMenuContactId] = useState<
    number | null
  >(null);
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

  // The one right-swipe function (38.13 D-26; 39 D-53 hooks here later): it
  // follows the swipe preference. TalkBack's Quick Log and Log Interaction
  // run their own handlers, never this one.
  const onSwipeRightAction = useCallback(
    async (contactId: number) => {
      try {
        const { dashboardRightSwipeAction } = await getAppSettings(
          getExecutor(),
        );
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
              void onSwipeRightAction(contactId);
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
  // 38.13 D-24: the debounced twin starts empty, never from the store, so the
  // first read can never use a term left over from an earlier mount.
  const [debouncedSearchText, setDebouncedSearchText] = useState("");

  // 38.13 D-24 (phase-04 dossier :237): the session store outlives this screen
  // (Activity recreation keeps the JS process), so a term left there would
  // silently filter the list on the next mount with the search row closed.
  // Clear it once on mount. Profile → Back keeps the search because Home stays
  // mounted under a pushed Profile (D-21). This is a mount effect declared
  // before the debounce effect and the focus read, never a useState
  // initialiser or a state updater (both run during render).
  useEffect(() => {
    useDashboardSessionStore.getState().setSearchText("");
  }, []);

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
  // 38.13 D-44: the last result generation whose published fade start was
  // applied. Only a newer generation re-applies a start; a focus, app-state or
  // reduced-motion re-run never re-fades the list from 0 (D-55; review R1-02).
  const lastAppliedGenerationRef = useRef(0);
  // A layout effect (38.13 review A-WR-01): it runs after the new rows commit
  // but before they paint, so they never show at full opacity before the fade
  // starts. The fade itself (start, duration, easing, gating) is unchanged.
  useLayoutEffect(() => {
    if (resultGeneration === 0) return;
    const canAnimate = isFocused && appActive && !reducedMotion;
    const toFullOpacity = withTiming(1, {
      duration: MOTION.fast,
      easing:
        EASING.decelerate === "out"
          ? Easing.out(Easing.ease)
          : Easing.inOut(Easing.ease),
    });
    if (resultGeneration > lastAppliedGenerationRef.current) {
      lastAppliedGenerationRef.current = resultGeneration;
      // The new rows have committed: start them from the published value and
      // fade them in. Until now the old rows and the count stayed at full
      // opacity (D-44, D-02; ADR-100).
      resultProgress.value = canAnimate
        ? withSequence(
            withTiming(publishedFadeStart, { duration: 0 }),
            toFullOpacity,
          )
        : 1;
      return;
    }
    // No new results: as before, animate or settle toward 1 only.
    resultProgress.value = canAnimate ? toFullOpacity : 1;
  }, [
    appActive,
    isFocused,
    publishedFadeStart,
    reducedMotion,
    resultGeneration,
    resultProgress,
  ]);
  const resultTransitionStyle = useAnimatedStyle(() => ({
    opacity: resultProgress.value,
    transform: [{ translateY: (1 - resultProgress.value) * SPACING.xs }],
  }));

  // The toggle reads and flips a ref, so two taps before a re-render still
  // alternate, and the session-store write stays in this handler. It must
  // never move into a `setSearchExpanded` updater: React runs updaters while
  // rendering HomeScreen, and writing the store HomeScreen subscribes to from
  // there is a state update during render.
  const searchExpandedRef = useRef(searchExpanded);
  const onToggleSearch = useCallback(() => {
    const expanded = searchExpandedRef.current;
    searchExpandedRef.current = !expanded;
    // Collapsing drops the active query so the list returns to the full
    // population — a collapsed search must never leave the list silently
    // filtered with no visible input or indicator (WR-02).
    if (expanded) setSearchText("");
    setSearchExpanded(!expanded);
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

  // Animation/lifecycle state is read through refs at publication time and is
  // NEVER a reload dependency (performance/AUD-PERF-002, D-23): toggling reduced
  // motion or crossing a background/foreground edge must schedule zero reads.
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;
  const appActiveRef = useRef(appActive);
  appActiveRef.current = appActive;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  /**
   * The single read body: the D-12 read (`composeDashboardSearch` when a term is
   * present, else `listDashboardPopulation`) + the header counts + the COMPLETE
   * 5-key populationCounts. The DEBOUNCE collapses a keystroke burst to ONE
   * read; the scheduler token (not a per-source `cancelled` closure) decides
   * whether this read may publish, across every source. ONE `now` is captured
   * per read and threaded to every birthday-resolving read/count (the list read
   * AND countBirthdayPopulation) so the birthday list and its empty-state count
   * can't disagree across local midnight (D-12; cross-AI review CYCLE-3).
   *
   * Assigned every render so the once-created scheduler always reads the
   * CURRENT query/search (the `use-category-catalog-refresh` ref idiom).
   */
  const schedulerRef = useRef<DashboardRefreshScheduler | null>(null);
  const readRef = useRef<
    (token: number, source: DashboardRefreshSource) => Promise<void>
  >(async () => {});
  readRef.current = async (token, source) => {
    const now = localDateTime();
    const term = debouncedSearchText.trim();
    const isSearch = term !== "";
    const sinks: DashboardReadSinks<
      DashboardRow,
      ListRowLine3,
      DashboardSearchResult,
      PopulationCounts,
      DashboardPopulationCounts
    > = {
      setRows,
      setSearchTerm: setPublishedSearchTerm,
      setLine3: setLine3ByContactId,
      setSearchMatches: setSearchResultsByContactId,
      setListNow,
      setCounts,
      setPopulationCounts,
      setError,
      // D-44: recorded with the rows and applied after they commit (the
      // fade effect), never written to resultProgress here.
      setFadeStart: (value) => setPublishedFadeStart(value),
      bumpResultGeneration: () =>
        setResultGeneration((generation) => generation + 1),
      setRefreshing,
      setInitialLoad,
    };
    const isCurrent = (candidate: number) =>
      schedulerRef.current?.isCurrent(candidate) === true;
    let outcome: DashboardReadOutcome<
      DashboardRow,
      ListRowLine3,
      DashboardSearchResult,
      PopulationCounts,
      DashboardPopulationCounts
    >;
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
          : listDashboardPopulation(exec, query, now).then((rows) => ({
              rows,
              resultsByContactId: new Map<
                number,
                DashboardSearchResult | null
              >(),
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
      // A superseded read skips the line-3 enrichment read entirely.
      if (!isCurrent(token)) return;
      const list = searchRead.rows;
      const nextLine3ByContactId = new Map<number, ListRowLine3>();
      if (query.viewMode === "list" && !isSearch) {
        const candidates = await readLine3Candidates(
          exec,
          list.map((row) => row.id),
        );
        const candidatesByContactId = new Map<number, typeof candidates>();
        for (const candidate of candidates) {
          const forContact =
            candidatesByContactId.get(candidate.contactId) ?? [];
          forContact.push(candidate);
          candidatesByContactId.set(candidate.contactId, forContact);
        }
        const selectionNow = new Date(parseLocalMs(now));
        for (const row of list) {
          const selection = selectLine3(
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
      outcome = {
        kind: "ok",
        rows: list,
        line3: nextLine3ByContactId,
        searchMatches: searchRead.resultsByContactId,
        listNow: now,
        counts: { live, neverContacted, snoozed, archived, unbound },
        populationCounts: {
          "all-contacts": allContacts,
          favourites,
          birthdays,
          "not-contacted": neverContacted,
          snoozed,
        },
        // A favourite read settles at 1 so a star tap never re-fades the list
        // (38.3 A-WR-05, D-10); every other source keeps the focused rule.
        fadeStart: dashboardFadeStart(
          source,
          isFocusedRef.current &&
            appActiveRef.current &&
            !reducedMotionRef.current,
        ),
        // D-44: the term these rows belong to, published with them.
        searchTerm: term,
      };
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load dashboard", err);
      // A failed read publishes its term too, so "Searching…" settles.
      outcome = { kind: "error", searchTerm: term };
    }
    publishDashboardRead({ token, outcome, isCurrent, sinks });
  };

  // ONE scheduler + publication authority for every Home read (RG-022, D-23).
  // Created once; `isVisible` defers shell/foreground reads while Home is hidden
  // or the app is backgrounded (the next focus / foreground read covers them). The debug marker names only the trigger.
  if (schedulerRef.current === null) {
    schedulerRef.current = createDashboardRefreshScheduler({
      read: (token, source) => {
        void readRef.current(token, source);
      },
      // Focus AND not backgrounded (review A-WR-01): a warm notification
      // action's shell tick must not read while the app is in the background;
      // the post-sweep foreground tick reads on resume.
      isVisible: () =>
        isDashboardVisible(isFocusedRef.current, AppState.currentState),
      log: (source) => Logger.debug(LOG_SCOPE, "dashboard read bundle", source),
    });
  }
  const scheduler = schedulerRef.current;

  // `reload(source)` only requests a read; the read body above is the single
  // owner of what is read and published.
  // biome-ignore lint/correctness/useExhaustiveDependencies: query/search changes intentionally re-issue the focus read
  const reload = useCallback(
    (source: DashboardRefreshSource) => scheduler.request(source),
    [debouncedSearchText, query, scheduler],
  );

  // Shell tick: committed in-process writes (Quick Log/Undo, bulk commits and
  // bulk Undo, assist, …) — one read each. This in-process tick is intentionally
  // distinct from the connection-scoped SQLite subscription that this dashboard
  // deliberately does not use (DASH-07). Deferred while Home is hidden (D-23).
  const onShellRefresh = useCallback(() => {
    reload("shell");
  }, [reload]);
  useShellRefresh(onShellRefresh);

  // Resume freshness (D-14): the post-sweep foreground tick, published after the
  // launch/foreground sweep's purge/expiry writes settle, so the read sees them
  // and reflects headless widget/notification writes made while backgrounded.
  // Deferred while Home is hidden; the next focus read covers it (D-23).
  const onForegroundRefresh = useCallback(() => {
    reload("foreground");
  }, [reload]);
  useForegroundRefresh(onForegroundRefresh);

  // Freshness path 1 — re-query every time the dashboard regains focus, and
  // whenever the query/search changes while focused (`reload` identity).
  useFocusEffect(
    useCallback(() => {
      reload("focus");
    }, [reload]),
  );

  // Freshness path 2 — pull-to-refresh. Supersession is the scheduler's job:
  // a newer read from any source retires this one, and its settle still lands.
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reload("pull");
  }, [reload]);

  // Unmount: nothing outstanding may publish into a dead screen.
  useEffect(() => () => scheduler.invalidate(), [scheduler]);

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

  // 38.13 review A-IN-01: the claim an action holds while it reads what it
  // applies to (before any write). The bar shows busy and disabled meanwhile,
  // so a second tap is visibly unavailable rather than silently dropped;
  // "Working…" still waits for a write (D-41).
  const [bulkReadingClaim, setBulkReadingClaim] =
    useState<BulkActionClaim | null>(null);
  const readForBulkAction = useCallback(
    <T,>(claim: BulkActionClaim, read: Promise<T>): Promise<T> => {
      setBulkReadingClaim(claim);
      return read.finally(() =>
        setBulkReadingClaim((current) => (current === claim ? null : current)),
      );
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

  // `kind` "warning" marks a removal (38.10 D-132); every other bulk result
  // is a notice.
  const commitBulkOutcome = useCallback(
    (label: string, kind: "success" | "warning" = "success") => {
      // A bulk transaction is one durable commit: the single shell bump reaches
      // Home's own subscriber (one fenced re-read) and every other shell
      // consumer exactly once (D-23). Do not reseed frozenUniverse.
      notifyWidgetDataChanged();
      bumpShellRefresh();
      // D-77 (review R3-01): the bar's Bound/favourite flags follow the write.
      refreshSelectionLifecycle();
      AccessibilityInfo.announceForAccessibility(label);
      showSnackbar({
        kind,
        label,
        action: {
          label: "Dismiss",
          accessibilityLabel: "Dismiss notification",
          onPress: dismissSnackbar,
        },
      });
    },
    [refreshSelectionLifecycle],
  );

  const performBulkQuickLog = useCallback(
    (ids: number[], claimed?: BulkActionClaim) => {
      const claim = claimed ?? tryAcquireBulkAction();
      if (!claim || (!claimed && !consumeBulkAction(claim))) return;
      void bulkQuickLog(getExecutor(), ids, localDateTime())
        .then((receipt) => {
          const label = `Logged ${plural(ids.length, "interaction")}`;
          notifyWidgetDataChanged();
          bumpShellRefresh();
          AccessibilityInfo.announceForAccessibility(label);
          showSnackbar({
            kind: "success",
            label,
            action: {
              label: "Undo",
              accessibilityLabel: `Undo logging ${plural(ids.length, "interaction")}`,
              onPress: () => {
                void undoBulkQuickLog(getExecutor(), receipt, localDateTime())
                  .then(() => {
                    // The Undo hard-deletes the logged interactions: a removal.
                    commitBulkOutcome(
                      `Undid ${ids.length} logged ${pluralWord(ids.length, "interaction")}`,
                      "warning",
                    );
                  })
                  .catch((undoError: unknown) =>
                    reportBulkFailure("undo bulk quick log", undoError),
                  );
              },
            },
          });
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
          commitBulkOutcome(
            `Moved ${plural(ids.length, "contact")} to the Bin`,
          );
          // Review WR-01: the schedule's population is live contacts only, so
          // binned people's scheduled reminders must be cancelled now.
          void reconcileSchedule(getExecutor()).catch((scheduleError) =>
            Logger.error(
              LOG_SCOPE,
              "failed to reconcile after bulk Move to Bin",
              scheduleError,
            ),
          );
        })
        .catch((writeError: unknown) => {
          releaseBulkAction(claim);
          reportBulkFailure("move contacts to the Bin", writeError, () => {
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
            `Changed contact frequency to every ${plural(intervalDays, "day")} for ${plural(ids.length, "contact")}`,
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

  // 38.13 D-74, D-77 (ADR-233; review R1-03, R1-04): Favorite always adds,
  // and only Bound people who are not yet favourites are written, classified
  // from the database at action time. The copy counts only them.
  const onBulkAddFavourites = useCallback(() => {
    const claim = tryAcquireBulkAction();
    if (!claim) return;
    const ids = [...selectedIds];
    if (ids.length === 0) {
      releaseBulkAction(claim);
      return;
    }
    void readForBulkAction(claim, readSelectionLifecycle(getExecutor(), ids))
      .then((entries) => {
        // The selection ended (or the claim was released) during the read.
        if (bulkActionInputClaimRef.current !== claim) return;
        const writeIds = bulkWriteIds(
          "add-favorites",
          ids,
          lifecycleMapFrom(entries),
        );
        if (writeIds.length === 0) {
          releaseBulkAction(claim);
          return;
        }
        if (!consumeBulkAction(claim)) return;
        return bulkAddFavourites(getExecutor(), writeIds, localDateTime()).then(
          () =>
            commitBulkOutcome(
              `Added ${plural(writeIds.length, "contact")} to Favorites`,
            ),
        );
      })
      .catch((writeError: unknown) => {
        releaseBulkAction(claim);
        reportBulkFailure(
          "add contacts to Favorites",
          writeError,
          onBulkAddFavourites,
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
    readForBulkAction,
  ]);

  // 38.13 D-75, D-77: removes every selected Bound favourite (read from the
  // database at action time); the copy counts only them.
  const onBulkRemoveFavourites = useCallback(() => {
    const claim = tryAcquireBulkAction();
    if (!claim) return;
    const ids = [...selectedIds];
    if (ids.length === 0) {
      releaseBulkAction(claim);
      return;
    }
    void readForBulkAction(claim, readSelectionLifecycle(getExecutor(), ids))
      .then((entries) => {
        if (bulkActionInputClaimRef.current !== claim) return;
        const writeIds = bulkWriteIds(
          "remove-favorites",
          ids,
          lifecycleMapFrom(entries),
        );
        if (writeIds.length === 0) {
          releaseBulkAction(claim);
          return;
        }
        if (!consumeBulkAction(claim)) return;
        return bulkRemoveFavourites(
          getExecutor(),
          writeIds,
          localDateTime(),
        ).then(() =>
          commitBulkOutcome(
            `Removed ${plural(writeIds.length, "contact")} from Favorites`,
            "warning",
          ),
        );
      })
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
    readForBulkAction,
  ]);

  // 38.11 D-82 (review V-01): the bulk bar's Snooze always opens the shared
  // sheet. Which selected people are snoozed is read from the database for
  // the ids captured now, never from on-screen rows (a filter or search can
  // drop them while the selection keeps their ids).
  const onBulkOpenSnoozePicker = useCallback(() => {
    const claim = tryAcquireBulkAction();
    if (!claim) return;
    const ids = [...selectedIds];
    if (ids.length === 0) {
      releaseBulkAction(claim);
      return;
    }
    // 38.13 D-77 (ADR-233: no Snooze for Unbound people): only the selected
    // people the database classifies as Bound reach the sheet, its write and
    // its count (review R1-04).
    void readForBulkAction(
      claim,
      Promise.all([
        readSelectionLifecycle(getExecutor(), ids),
        readCurrentlySnoozedIds(getExecutor(), ids),
      ]),
    )
      .then(([entries, snoozedIds]) => {
        // The selection ended during the read: nothing opens.
        if (bulkActionInputClaimRef.current !== claim) return;
        const writeIds = bulkWriteIds("snooze", ids, lifecycleMapFrom(entries));
        if (writeIds.length === 0) {
          releaseBulkAction(claim);
          return;
        }
        const writeSet = new Set(writeIds);
        setSnoozePicker({
          ids: writeIds,
          snoozedIds: snoozedIds.filter((id) => writeSet.has(id)),
        });
      })
      .catch((readError: unknown) => {
        releaseBulkAction(claim);
        reportBulkFailure("open snooze", readError);
      });
  }, [
    releaseBulkAction,
    reportBulkFailure,
    selectedIds,
    tryAcquireBulkAction,
    readForBulkAction,
  ]);

  // 38.11 D-45 (review U-01, V-02): one bulk snooze/unsnooze write under the
  // shared sheet's settlement. The sheet stays open while it runs; success
  // reports the count and the sheet closes itself; a failure is logged and
  // rethrown so the sheet shows its error and Retry (no failure snackbar).
  // The claim is read at call time, so a Retry takes a fresh one.
  const runBulkSnoozeWrite = useCallback(
    (
      operation: "snooze" | "unsnooze",
      label: string,
      write: () => Promise<void>,
    ) =>
      runClaimedBulkWrite({
        takeHeldClaim: () => bulkActionInputClaimRef.current,
        acquire: tryAcquireBulkAction,
        consume: consumeBulkAction,
        release: releaseBulkAction,
        write,
      }).then(
        () => {
          commitBulkOutcome(label);
          void reconcileSchedule(getExecutor()).catch((scheduleError) =>
            Logger.error(
              LOG_SCOPE,
              `failed to reconcile after bulk ${operation}`,
              scheduleError,
            ),
          );
        },
        (writeError: unknown) => {
          Logger.error(LOG_SCOPE, `failed to bulk ${operation}`, writeError);
          throw writeError;
        },
      ),
    [
      commitBulkOutcome,
      consumeBulkAction,
      releaseBulkAction,
      tryAcquireBulkAction,
    ],
  );

  const closeBulkSnoozePicker = useCallback(() => {
    setSnoozePicker(null);
    releaseBulkInputClaim();
  }, [releaseBulkInputClaim]);

  const onBulkOpenCategoryPicker = useCallback(() => {
    const claim = tryAcquireBulkAction();
    if (!claim) return;
    const selection = useDashboardSelectionStore.getState();
    const sessionId = selection.sessionId;
    if (!getCurrentSelectionIds(selection, sessionId)?.length) {
      releaseBulkAction(claim);
      return;
    }
    void readForBulkAction(claim, listCategories(getExecutor()))
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
        reportBulkFailure(
          "load categories",
          readError,
          onBulkOpenCategoryPicker,
        );
      });
  }, [
    releaseBulkAction,
    reportBulkFailure,
    tryAcquireBulkAction,
    readForBulkAction,
  ]);

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

  // 38.13 D-28: the filter-empty state's one action clears every filter. A
  // rejected write is reported with the error snackbar and a Retry.
  const onClearFilters = useCallback(async () => {
    try {
      await useDashboardQueryStore.getState().setFilters(getExecutor(), {});
    } catch (clearError) {
      Logger.error(LOG_SCOPE, "failed to clear filters", clearError);
      showSnackbar({
        kind: "error",
        label: "Couldn't clear filters",
        action: {
          label: "Retry",
          accessibilityLabel: "Retry clearing filters",
          onPress: () => {
            void onClearFilters();
          },
        },
      });
    }
  }, []);

  // 38.13 D-82: an empty Birthdays / Never Contacted / Snoozed population's
  // one action switches the Population back to Active Contacts: the same
  // store write the Population panel's Active row makes ([]), filters kept.
  // A rejected write is reported with the error snackbar and a Retry.
  const onShowActiveContacts = useCallback(async () => {
    try {
      await useDashboardQueryStore.getState().setPopulations(getExecutor(), []);
    } catch (populationError) {
      Logger.error(
        LOG_SCOPE,
        "failed to show the Active Contacts population",
        populationError,
      );
      showSnackbar({
        kind: "error",
        label: `Couldn't show ${AXIS_DEFAULT_LABELS.population}`,
        action: {
          label: "Retry",
          accessibilityLabel: `Retry showing ${AXIS_DEFAULT_LABELS.population}`,
          onPress: () => {
            void onShowActiveContacts();
          },
        },
      });
    }
  }, []);

  // 38.13 D-65 (39 D-98): "N Never Contacted →" saves the Never Contacted
  // population with filters cleared, the same save the Digest "+N more" drill
  // makes (runDigestDrillThrough), so the list shows the people it counted.
  const onShowNeverContacted = useCallback(async () => {
    try {
      await useDashboardQueryStore
        .getState()
        .setPopulationsAndFilters(getExecutor(), ["not-contacted"], {});
    } catch (populationError) {
      Logger.error(
        LOG_SCOPE,
        "failed to show the Never Contacted population",
        populationError,
      );
      showSnackbar({
        kind: "error",
        label: `Couldn't show ${NEVER_CONTACTED}`,
        action: {
          label: "Retry",
          accessibilityLabel: `Retry showing ${NEVER_CONTACTED}`,
          onPress: () => {
            void onShowNeverContacted();
          },
        },
      });
    }
  }, []);

  // 38.13 D-65: "N Unbound →" opens Unbound Contacts.
  const onOpenUnbound = useCallback(
    () => navigation.navigate("UnboundContacts"),
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
          // Optimistic bridge until the favourite read below lands.
          setRows((previousRows) =>
            applyCommittedMembership(previousRows, contactId, nextMembership),
          );
          // 38.3 REVIEW A-WR-05 / VERIFICATION W4 (D-10): request the read
          // directly from the once-created scheduler (what `reload` does), so
          // this callback never depends on the query (review R5-01). The
          // committed write is visible to this newer read, whose token retires
          // any in-flight stale read (which could otherwise revert the star)
          // and re-reads the population counts. Deferred to the next focus
          // read while Home is hidden or backgrounded (38.13 D-52); published
          // with fade start 1 (no list re-fade). The Profile star (38.12) is a
          // second toggle that does not use this scheduler.
          scheduler.request("favourite");
        })
        .catch((writeError: unknown) => {
          Logger.error(LOG_SCOPE, "failed to update favourite", writeError);
          if (
            favouriteStore.resolve(contactId, generation, "failure") ===
            "applied"
          ) {
            showSnackbar({
              kind: "error",
              label: "Couldn't update favorite. Try again.",
              action: {
                label: "Retry",
                accessibilityLabel: "Retry updating favorite",
                onPress: () => toggleFavourite(contactId, nextMembership),
              },
            });
          }
        });
    },
    [favouriteStore, scheduler],
  );

  // The one gate for every Contacts star tap: the List star, the Card star and
  // the card menu (ADR-233; review R2-04). A Bound row toggles; an Unbound row
  // explains in a notice and writes nothing (the dormant rank is kept, 38.12
  // D-21); an id with no published row does nothing (unknown never toggles).
  const onFavouriteTap = useCallback(
    (contactId: number, nextMembership: boolean) => {
      const row = rowsByIdRef.current.get(contactId);
      switch (favouriteTapOutcome(row)) {
        case "explain":
          if (row) {
            showSnackbar({
              kind: "success",
              label: unboundStarExplanation(row.name),
            });
          }
          return;
        case "toggle":
          toggleFavourite(contactId, nextMembership);
          return;
        case "ignore":
          return;
      }
    },
    [toggleFavourite],
  );

  const openCardContextMenu = useCallback((contactId: number) => {
    setContextMenuContactId(contactId);
  }, []);

  // Log Interaction for a card, the card menu and the List row's TalkBack
  // action (D-26): always the detailed Log Interaction screen.
  const openLogInteraction = useCallback((contactId: number) => {
    navigateDashboardContactAction(contactId, "LogContact");
  }, []);

  const messageContact = useCallback(
    (contactId: number) => navigation.navigate("Compose", { contactId }),
    [navigation],
  );

  const refreshAfterSnooze = useCallback(() => {
    reload("snooze");
  }, [reload]);

  // 38.11 D-45/D-81: the card's snooze goes through the shared sheet in both
  // states, writing through the Profile's snooze actions. A rejection reaches
  // the sheet (error + Retry); the list refreshes and reminders reconcile
  // after a committed write.
  const afterCardSnoozeWrite = useCallback(
    (operation: "snooze" | "unsnooze") => {
      refreshAfterSnooze();
      void reconcileSchedule(getExecutor()).catch((scheduleError) =>
        Logger.error(
          LOG_SCOPE,
          `failed to reconcile after card ${operation}`,
          scheduleError,
        ),
      );
    },
    [refreshAfterSnooze],
  );
  const snoozeCardContact = useCallback(
    async (
      contactId: number,
      request: { preset: "3d" | "1w" | "1m" } | { until: string },
    ) => {
      try {
        await snoozeProfileContact(getExecutor(), {
          contactId,
          now: localDateTime(),
          ...request,
        });
      } catch (snoozeError) {
        Logger.error(LOG_SCOPE, "failed to snooze card contact", snoozeError);
        throw snoozeError;
      }
      afterCardSnoozeWrite("snooze");
    },
    [afterCardSnoozeWrite],
  );
  const unsnoozeCardContact = useCallback(
    async (contactId: number) => {
      try {
        await unsnoozeProfileContact(getExecutor(), {
          contactId,
          now: localDateTime(),
        });
      } catch (snoozeError) {
        Logger.error(LOG_SCOPE, "failed to unsnooze card contact", snoozeError);
        throw snoozeError;
      }
      afterCardSnoozeWrite("unsnooze");
    },
    [afterCardSnoozeWrite],
  );
  // Undo for the card's confirmation (review X-01): bound to the contact id
  // it was built with, never re-reading `cardSnooze`, which onClose has
  // nulled by then. The expiry re-check lives in the sheet (Y-01).
  const restoreCardSnooze = useCallback(
    (contactId: number) => (previousUntil: string | null) =>
      previousUntil === null
        ? unsnoozeCardContact(contactId)
        : snoozeCardContact(contactId, { until: previousUntil }),
    [snoozeCardContact, unsnoozeCardContact],
  );

  // 38.13 D-77 / ADR-102: the universe is frozen at entry from the rows on
  // screen (Unbound people included by the one constant), and the bar's
  // lifecycle map is captured from the same rows at the same moment.
  const enterCardSelection = useCallback(
    (contactId: number) => {
      const universe = selectionUniverseIds(rows, SELECTION_INCLUDES_UNBOUND);
      if (useDashboardSelectionStore.getState().mode) return;
      lifecycleRequestTokenRef.current += 1;
      setSelectionLifecycle(lifecycleFromRows(rows, universe));
      useDashboardSelectionStore.getState().enterSelection(universe, contactId);
    },
    [rows],
  );

  const onSelectContacts = useCallback(async () => {
    // Captured before the view switch: the rows on screen when Select was
    // chosen are the frozen universe (ADR-102; D-77).
    const entryRows = rows;
    const universe = selectionUniverseIds(rows, SELECTION_INCLUDES_UNBOUND);
    const { viewMode, setViewMode } = useDashboardQueryStore.getState();

    try {
      if (viewMode !== "card") {
        await setViewMode(getExecutor(), "card");
      }
      if (!useDashboardSelectionStore.getState().mode) {
        lifecycleRequestTokenRef.current += 1;
        setSelectionLifecycle(lifecycleFromRows(entryRows, universe));
      }
      useDashboardSelectionStore.getState().enterSelection(universe);
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
    navigation: {
      navigate: (route) => navigation.navigate(route),
      openEvents: () => {
        const parent =
          navigation.getParent<BottomTabNavigationProp<TabParamList>>();
        if (!parent) {
          if (__DEV__) {
            Logger.warn(LOG_SCOPE, "Events tab navigator is not mounted");
          }
          return;
        }
        navigateIntoTab(parent, "EventsTab", "GroupEvents");
      },
    },
    onReset,
    onSelectContacts: () => {
      void onSelectContacts();
    },
    // D-76 / ADR-102: no query change while selecting (review A-WR-02).
    selectionMode,
  });

  // Android Back (38.13 D-29; ADR-095 :18 transient-first; ADR-102). This
  // listener runs before the root navigator's (BackHandler calls the newest
  // first), so an open shell transient is left to the root listener; then
  // selection exits; then an open search closes and clears through the same
  // path as the search toggle.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          const action = resolveHomeBack({
            anyTransientOpen: shellTransientStore.getState().isAnyOpen(),
            selectionMode,
            searchExpanded,
          });
          if (action === "exit-selection") {
            exitBulkSelection();
            return true;
          }
          if (action === "close-search") {
            onToggleSearch();
            return true;
          }
          return false;
        },
      );
      return () => subscription.remove();
    }, [exitBulkSelection, onToggleSearch, searchExpanded, selectionMode]),
  );

  // The cause-aware empty state — delegated to the pure gate (no inline count
  // arithmetic; HIGH-2). The live `activeFilter` (chip) + `hasTerm` (search box)
  // are threaded in: the gate's precedence resolves a zero-result search →
  // 'search-empty' BEFORE any filter/population branch, so a no-match search over
  // a non-empty population (or with a filter also active) never shows the
  // hidden-population or filter copy (MEDIUM-4).
  // 38.13 D-44: rows render in search mode only for the term their results
  // belong to (the published term). While the live input differs, a newer
  // search is pending: the header reads "Searching…" and the current rows stay
  // visible (D-02, ADR-100; no skeleton per update).
  const term = publishedSearchTerm;
  const isSearchMode = term !== "";
  const searching = searchText.trim() !== publishedSearchTerm;
  const contextMenuContact =
    contextMenuContactId === null
      ? null
      : (rows.find((row) => row.id === contextMenuContactId) ?? null);
  const contextMenuIsFavourite =
    contextMenuContact !== null &&
    (favouriteOverlay.get(contextMenuContact.id) ??
      contextMenuContact.favourite_rank !== null);
  // The card sheet's EFFECTIVE snooze end (review W-01): an expired
  // `snooze_until` reads as not snoozed.
  const cardSnoozeUntil =
    cardSnoozeShown !== null && isSnoozed(cardSnoozeShown.snoozeUntil, listNow)
      ? cardSnoozeShown.snoozeUntil
      : null;
  // 38.13 D-55 F1 (review R1-01): the List rows get the read's local day, so
  // a same-day publish hands every unchanged row identical props. Card view
  // and the card snooze sheet keep the full `listNow`.
  const listDay = listNow.slice(0, 10);
  // The List renderItem builds no per-row closures: every callback it passes
  // is stable for the screen's life (review R5-01), so a memoised row
  // re-renders only when its own scalars change.
  const renderListRow = useCallback(
    ({ item }: { item: DashboardRow }) => {
      const line3Entry = line3ByContactId.get(item.id);
      return (
        <SwipeableListRow
          contactId={item.id}
          name={item.name}
          photo={item.photo}
          categoryLabel={item.categoryLabel}
          lastContact={item.last_contact}
          snoozeUntil={item.snooze_until}
          status={item.status}
          listDay={listDay}
          isFavourite={
            favouriteOverlay.get(item.id) ?? item.favourite_rank !== null
          }
          line3Text={line3Entry?.text}
          line3IconName={line3Entry?.iconName}
          searchResult={
            isSearchMode
              ? (searchResultsByContactId.get(item.id) ?? null)
              : undefined
          }
          unbound={isUnboundRow(item)}
          onOpenProfile={goToProfile}
          onFavouriteTap={onFavouriteTap}
          onSwipeRightAction={onSwipeRightAction}
          onEditContact={onEditContact}
          onQuickLog={logQuickly}
          onLogInteraction={openLogInteraction}
          openRowRef={openRowRef}
        />
      );
    },
    [
      favouriteOverlay,
      goToProfile,
      isSearchMode,
      line3ByContactId,
      listDay,
      logQuickly,
      onEditContact,
      onFavouriteTap,
      onSwipeRightAction,
      openLogInteraction,
      searchResultsByContactId,
    ],
  );
  // Everything renderListRow reads beyond `rows`, so the FlatList re-renders
  // its cells when the favourite overlay, line 3, search matches or day change.
  const listExtraData = useMemo(
    () => ({
      favouriteOverlay,
      line3ByContactId,
      searchResultsByContactId,
      isSearchMode,
      listDay,
    }),
    [
      favouriteOverlay,
      isSearchMode,
      line3ByContactId,
      listDay,
      searchResultsByContactId,
    ],
  );
  const todayLocal = formatLocalDate(new Date());
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
  // D-55 (OA-E1): the header counts the contacts the active view displays, so
  // List and Card agree; the live count feeds only the empty state above.
  const headerCount = dashboardHeaderCount({
    error,
    initialLoading: showInitialSkeleton,
    viewMode: query.viewMode,
    listRowCount: rows.length,
    cardRowCount: cardRows.length,
  });

  const listHeader = (
    <View style={styles.header}>
      {headerCount !== null ? (
        <ChromeScrim
          style={styles.countScrim}
          radius={RADII.sm}
          artComponent="contactsCountLabel"
        >
          <ScopedPalette>
            {(scoped) => (
              <Text
                testID="dashboard-header-count"
                style={[styles.countHeader, { color: scoped.textSecondary }]}
              >
                {searching
                  ? SEARCHING_LABEL
                  : dashboardHeaderCountLabel(headerCount)}
              </Text>
            )}
          </ScopedPalette>
        </ChromeScrim>
      ) : null}
    </View>
  );

  // 38.13 D-28: the filter-empty copy; Clear filters shows only while a
  // filter is active.
  const filterEmpty = filterEmptyCopy({
    filtersActive: Object.values(query.filters).some(
      (values) => (values?.length ?? 0) > 0,
    ),
    favouritesOnlyAndNone:
      query.populations.includes("favourites") &&
      populationCounts.favourites === 0,
  });

  // Built from the palette ScopedPalette resolves INSIDE the ChromeScrim below
  // (D-34), so the empty-state captions render the glass variant.
  const renderListEmptyContent = (palette: ThemePalette) =>
    error ? (
      <View testID="dashboard-error-state" style={styles.emptyState}>
        <Text style={[styles.emptyHeading, { color: palette.textPrimary }]}>
          Couldn't load your contacts
        </Text>
        <Text style={[styles.emptyBody, { color: palette.textSecondary }]}>
          Pull down to try again.
        </Text>
      </View>
    ) : emptyState === "search-empty" ? (
      // The one empty-state component (38.9 D-20), with its one action:
      // "Clear search" (D-71). EmptyState reads the scoped palette itself.
      <EmptyState
        testID="dashboard-empty-search"
        icon="search"
        heading="No matches for"
        term={term}
        body="Try a different name or word."
        action={{ label: "Clear search", onPress: onClearSearch }}
      />
    ) : emptyState === "birthdays-empty" ? (
      // 38.13 D-30: each empty population says what that population is.
      <EmptyState
        testID="dashboard-empty-birthdays"
        icon={birthdaysEmptyCopy.icon}
        heading={birthdaysEmptyCopy.heading}
        body={birthdaysEmptyCopy.body}
        action={{
          label: birthdaysEmptyCopy.actionLabel ?? SHOW_ACTIVE_CONTACTS_LABEL,
          onPress: onShowActiveContacts,
        }}
      />
    ) : emptyState === "not-contacted-empty" ? (
      <EmptyState
        testID="dashboard-empty-not-contacted"
        icon={notContactedEmptyCopy.icon}
        heading={notContactedEmptyCopy.heading}
        body={notContactedEmptyCopy.body}
        action={{
          label:
            notContactedEmptyCopy.actionLabel ?? SHOW_ACTIVE_CONTACTS_LABEL,
          onPress: onShowActiveContacts,
        }}
      />
    ) : emptyState === "snoozed-empty" ? (
      <EmptyState
        testID="dashboard-empty-snoozed"
        icon={snoozedEmptyCopy.icon}
        heading={snoozedEmptyCopy.heading}
        body={snoozedEmptyCopy.body}
        action={{
          label: snoozedEmptyCopy.actionLabel ?? SHOW_ACTIVE_CONTACTS_LABEL,
          onPress: onShowActiveContacts,
        }}
      />
    ) : emptyState === "firstrun" ? (
      <View style={styles.emptyState}>
        <Pressable
          testID="dashboard-empty-firstrun"
          accessibilityRole="button"
          accessibilityLabel="Add your first contact"
          onPress={() => navigation.navigate("Create")}
          style={[
            styles.primaryCta,
            { backgroundColor: palette.accent, borderColor: palette.accent },
          ]}
        >
          <Text style={[styles.primaryCtaText, { color: palette.onAccent }]}>
            Add your first contact
          </Text>
        </Pressable>
      </View>
    ) : emptyState === "hidden" ? (
      <View testID="dashboard-empty-hidden" style={styles.emptyState}>
        <Text style={[styles.emptyHeading, { color: palette.textPrimary }]}>
          Everyone's tucked away
        </Text>
        {/* 38.13 D-65 (39 D-98): Never Contacted and Unbound lead somewhere;
            snoozed and the Bin stay text. */}
        {tuckedAwayLines(counts).map((line) =>
          line.kind === "button" ? (
            // biome-ignore lint/a11y/useValidAriaRole: Button role is the design-system hierarchy role.
            <Button
              key={line.target}
              role="tertiary"
              label={line.label}
              accessibilityLabel={line.accessibilityLabel}
              testID={
                line.target === "never-contacted"
                  ? "dashboard-empty-hidden-never-contacted"
                  : "dashboard-empty-hidden-unbound"
              }
              onPress={
                line.target === "never-contacted"
                  ? () => {
                      void onShowNeverContacted();
                    }
                  : onOpenUnbound
              }
            />
          ) : (
            <Text
              key={line.target}
              accessibilityLabel={line.accessibilityLabel}
              style={[styles.emptyBody, { color: palette.textSecondary }]}
            >
              {line.label}
            </Text>
          ),
        )}
      </View>
    ) : emptyState === "filter-empty" ? (
      // 38.13 D-28: a list filtered to nothing. Only the genuine "no favourites
      // exist" case keeps the onboarding copy; a favourites-population list
      // zeroed by an active filter still HAS favourites, so it gets the
      // filtered-empty copy and its Clear filters action (WR-03).
      <EmptyState
        testID="dashboard-empty-filter"
        icon={filterEmpty.icon}
        heading={filterEmpty.heading}
        body={filterEmpty.body}
        action={
          filterEmpty.actionLabel
            ? {
                label: filterEmpty.actionLabel,
                onPress: onClearFilters,
              }
            : undefined
        }
      />
    ) : null;

  // Chrome scrim (31.1-05): empty-state copy sits on the bare background, so back
  // it locally to stay AA over the lightened veil. Cards already back their own.
  // Every empty state except "none" (and the load error) renders content.
  const listEmpty =
    error || emptyState !== "none" ? (
      <ChromeScrim style={styles.emptyPanel} radius={RADII.md}>
        <ScopedPalette>{renderListEmptyContent}</ScopedPalette>
      </ChromeScrim>
    ) : null;

  return (
    <View testID="dashboard-root" style={styles.root}>
      <View
        accessible={!panelOpen}
        importantForAccessibility={panelOpen ? "no-hide-descendants" : "auto"}
        pointerEvents={panelOpen ? "none" : "auto"}
      >
        <ShellAppBar
          variant="root"
          title="Orbit"
          overflow={overflowActions}
          artComponent="contactsHeader"
        />
      </View>
      {/* 38.13 D-76: the Population/Filters/Sort row (and the search row
          below) are hidden while selecting; they return when selection
          ends. The selection bar renders at the bottom instead (D-72). */}
      {selectionMode ? null : <DashboardControlRow />}
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
                  placeholderTextColor={colors.textPlaceholder}
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
                ref={listRef}
                data={error || showInitialSkeleton ? [] : rows}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderListRow}
                extraData={listExtraData}
                windowSize={LIST_WINDOW_SIZE}
                initialNumToRender={LIST_INITIAL_NUM_TO_RENDER}
                maxToRenderPerBatch={LIST_MAX_TO_RENDER_PER_BATCH}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={
                  showInitialSkeleton ? <ListLoadingSkeleton /> : listEmpty
                }
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
                onLogInteraction={openLogInteraction}
                onMessage={messageContact}
                onEditContact={onEditContact}
                onSelect={enterCardSelection}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelection}
                favouriteOverlay={favouriteOverlay}
                onToggleFavourite={onFavouriteTap}
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
                listRef={cardGridRef}
              />
            </Animated.View>
          )}
        </View>
      </View>
      {/* 38.13 D-69, D-72: the M3b selection bar is the root view's last
          in-flow child, so it sits directly above the tab bar (RESEARCH
          Pattern 11; no measurement needed for placement). */}
      {selectionMode ? (
        <BulkActionSurface
          selectedCount={selectionCount}
          pending={bulkActionPending}
          reading={bulkReadingClaim !== null}
          selectAllLabel={applicability.selectAllLabel}
          availability={applicability}
          onExit={exitBulkSelection}
          onToggleSelectAll={onToggleSelectAll}
          onQuickLog={onBulkQuickLog}
          onSnooze={onBulkOpenSnoozePicker}
          onAddFavourites={onBulkAddFavourites}
          onLogInteraction={onBulkLogInteraction}
          onRemoveFavourites={onBulkRemoveFavourites}
          onSetCategory={onBulkOpenCategoryPicker}
          onChangeFrequency={onBulkOpenFrequencyPicker}
          onArchive={onBulkArchive}
        />
      ) : null}
      <DashboardOverlayHost />
      <CardContextMenu
        visible={contextMenuContact !== null}
        contactId={contextMenuContact?.id ?? null}
        name={contextMenuContact?.name ?? ""}
        isFavourite={contextMenuIsFavourite}
        unbound={
          contextMenuContact !== null && isUnboundRow(contextMenuContact)
        }
        onViewProfile={() => {
          if (contextMenuContact) goToProfile(contextMenuContact.id);
        }}
        onQuickLog={() => {
          if (contextMenuContact) logQuickly(contextMenuContact.id);
        }}
        onLogInteraction={() => {
          if (contextMenuContact) openLogInteraction(contextMenuContact.id);
        }}
        onMessage={() => {
          if (contextMenuContact) messageContact(contextMenuContact.id);
        }}
        onEditContact={() => {
          if (contextMenuContact) onEditContact(contextMenuContact.id);
        }}
        onToggleFavourite={() => {
          if (contextMenuContact) {
            onFavouriteTap(contextMenuContact.id, !contextMenuIsFavourite);
          }
        }}
        onOpenSnooze={() => {
          if (contextMenuContact) {
            setCardSnooze({
              contactId: contextMenuContact.id,
              name: contextMenuContact.name,
              snoozeUntil: contextMenuContact.snooze_until,
            });
          }
        }}
        onSelect={() => {
          if (contextMenuContact) enterCardSelection(contextMenuContact.id);
        }}
        onRequestClose={() => setContextMenuContactId(null)}
      />
      <SnoozeSheet
        // 38.11 D-45/D-81 (review V-07, W-01, X-01): the card's sheet renders
        // from the captured `cardSnooze` only (its last value while closing,
        // review IN-06); the effective end treats an expired snooze as not
        // snoozed.
        visible={cardSnooze !== null}
        title={`Snooze ${cardSnoozeShown?.name ?? ""}`}
        snoozedUntil={cardSnoozeUntil}
        showUnsnooze={cardSnoozeUntil !== null}
        todayLocal={todayLocal}
        onPreset={(preset) =>
          cardSnooze
            ? snoozeCardContact(cardSnooze.contactId, { preset })
            : Promise.reject(new Error("no card snooze target"))
        }
        onUntil={(until) =>
          cardSnooze
            ? snoozeCardContact(cardSnooze.contactId, { until })
            : Promise.reject(new Error("no card snooze target"))
        }
        onUnsnooze={() =>
          cardSnooze
            ? unsnoozeCardContact(cardSnooze.contactId)
            : Promise.reject(new Error("no card snooze target"))
        }
        confirmName={cardSnooze?.name}
        onRestore={
          cardSnooze ? restoreCardSnooze(cardSnooze.contactId) : undefined
        }
        onClose={() => setCardSnooze(null)}
      />
      <SnoozeSheet
        // 38.11 D-45/D-82 (review U-01, V-08): the bulk bar's Snooze; it
        // shows Unsnooze when the database said a selected person is snoozed,
        // and unsnoozes exactly those people. Bulk keeps its count snackbar,
        // so no confirmName.
        visible={snoozePicker !== null}
        title={`Snooze ${plural(snoozePickerShown?.ids.length ?? 0, "contact")}`}
        snoozedUntil={null}
        showUnsnooze={(snoozePickerShown?.snoozedIds.length ?? 0) > 0}
        todayLocal={todayLocal}
        onPreset={(preset) => {
          const picker = snoozePicker;
          if (!picker) return Promise.reject(new Error("no bulk selection"));
          return runBulkSnoozeWrite(
            "snooze",
            `Snoozed ${plural(picker.ids.length, "contact")}`,
            () =>
              bulkSnooze(getExecutor(), picker.ids, preset, localDateTime()),
          );
        }}
        onUntil={(until) => {
          const picker = snoozePicker;
          if (!picker) return Promise.reject(new Error("no bulk selection"));
          return runBulkSnoozeWrite(
            "snooze",
            `Snoozed ${plural(picker.ids.length, "contact")}`,
            () =>
              bulkSnoozeUntil(
                getExecutor(),
                picker.ids,
                until,
                localDateTime(),
              ),
          );
        }}
        onUnsnooze={() => {
          const picker = snoozePicker;
          if (!picker) return Promise.reject(new Error("no bulk selection"));
          // Only the currently snoozed people (D-82; review W-03), which also
          // keeps clearSnoozeCore from recording false unsnooze events.
          const snoozedIds = picker.snoozedIds;
          return runBulkSnoozeWrite(
            "unsnooze",
            `Unsnoozed ${plural(snoozedIds.length, "contact")}`,
            () => bulkUnsnooze(getExecutor(), snoozedIds, localDateTime()),
          );
        }}
        onClose={closeBulkSnoozePicker}
      />
      <CategoryChoiceSheet
        visible={categoryPicker !== null}
        categories={categoryPickerShown?.categories ?? []}
        selectedId={null}
        allowUncategorized
        title="Set category"
        // 38.13 D-71 / D-78 / D-85: opens at the smallest sheet size that
        // shows every row (computed from row height), else expanded.
        sizeToContent
        onRequestClose={() => {
          setCategoryPicker(null);
          releaseBulkInputClaim();
        }}
        onSelect={(categoryId) => {
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
          void listCategories(getExecutor())
            .then((currentCategories) => {
              const target =
                categoryId === null
                  ? null
                  : currentCategories.find(
                      (category) => category.id === categoryId,
                    );
              if (categoryId !== null && !target)
                throw new Error("Category no longer exists");
              return bulkSetCategory(
                getExecutor(),
                ids,
                categoryId,
                localDateTime(),
              );
            })
            .then(() =>
              commitBulkOutcome(
                `Set category to ${categoryId === null ? "Uncategorized" : (picker.categories.find((category) => category.id === categoryId)?.name ?? "category")} for ${plural(ids.length, "contact")}`,
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
      />
      {/* 38.13 D-39: the Profile's FrequencyPicker in a compact sheet.
          Continue still goes through the frequency confirm (D-18). */}
      <BulkFrequencySheet
        visible={frequencyPicker !== null}
        onCancel={() => {
          setFrequencyPicker(null);
          releaseBulkInputClaim();
        }}
        onContinue={(intervalDays) => {
          const picker = frequencyPicker;
          if (!picker) return;
          setFrequencyPicker(null);
          setBulkConfirm({
            kind: "frequency",
            ids: picker.ids,
            intervalDays,
            claim: picker.claim,
          });
        }}
      />
      {/* 38.11 D-93 / 38.9 D-30: the bulk Move to Bin confirm shares the
          Profile's body and its destructive (red) confirm. */}
      <ConfirmDialog
        visible={bulkConfirm !== null}
        onRequestClose={dismissBulkConfirm}
        title={
          bulkConfirm?.kind === "quick-log"
            ? `Log ${plural(bulkConfirm.ids.length, "interaction")}?`
            : bulkConfirm?.kind === "archive"
              ? bulkBinConfirmation(bulkConfirm.ids.length).title
              : "Change Contact Frequency?"
        }
        message={
          bulkConfirm?.kind === "archive"
            ? bulkBinConfirmation(bulkConfirm.ids.length).message
            : bulkConfirm?.kind === "frequency"
              ? `Set ${bulkConfirm.ids.length === 1 ? "" : "all "}${plural(bulkConfirm.ids.length, "contact")} to every ${plural(bulkConfirm.intervalDays, "day")}?`
              : undefined
        }
        confirmLabel={
          bulkConfirm?.kind === "archive"
            ? bulkBinConfirmation(bulkConfirm.ids.length).confirmLabel
            : bulkConfirm?.kind === "frequency"
              ? "Change frequency"
              : "Log interactions"
        }
        destructive={bulkConfirm?.kind === "archive"}
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
