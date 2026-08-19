/**
 * HomeScreen — the dashboard CORE (DASH-01/03/04/05/07). This IS the app's home
 * surface: a flat, status-sorted `listDashboard` population rendered as
 * `ContactCard`s, with the birthday banner, the contact-count header, the
 * hidden-population footer entries, a reliable freshness path, and cause-aware
 * empty/error states. The interactive controls (filter chips, sort control,
 * search box) land in Plan 09; this ships the default persisted sort/filter.
 *
 * FRESHNESS (DASH-07 / threat T-08-18): the list re-queries on `useFocusEffect`,
 * on an `AppState`→"active" listener, and via pull-to-refresh. It deliberately
 * does NOT subscribe to the connection-scoped SQLite change notification — that
 * mechanism is bound to this screen's own DB connection and is structurally blind
 * to the headless widget / notification "mark contacted" writes that happen on a
 * different connection, so it would silently miss cross-context updates. Focus +
 * foreground + pull is the only path that reflects those writes.
 *
 * READS (threat T-08-16/17): every read is async on-device SQLite (`listDashboard`
 * + the four counts via `getExecutor()`) guarded by a `cancelled` flag so a stale
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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BirthdayBanner } from "@/components/BirthdayBanner";
import { ContactCard } from "@/components/ContactCard";
import { type FilterChip, FilterChipRow } from "@/components/FilterChipRow";
import { listCategories } from "@/db/contact-read";
import { getExecutor } from "@/db/database";
import {
  countArchived,
  countLiveContacts,
  countNeverContacted,
  countSnoozed,
  type DashboardFilter,
  type DashboardRow,
  type DashboardSort,
  listDashboard,
} from "@/db/dashboard-read";
import { selectDashboardEmptyState } from "@/logic/dashboard-empty-logic";
import type { RootStackParamList } from "@/navigation/types";
import { useDashboardPrefs } from "@/stores/dashboard-prefs-store";
import { useTheme } from "@/theme";
import type { SocialBattery } from "@/types";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "dashboard-home";

/** The dashboard sort control's four options, in display order (08-UI-SPEC). */
const SORT_OPTIONS: { key: DashboardSort; label: string }[] = [
  { key: "status", label: "Status" },
  { key: "name", label: "Name (A–Z)" },
  { key: "least-recent", label: "Least recent" },
  { key: "most-recent", label: "Most recent" },
];

/** The social-battery chip values (src/types.ts SocialBattery), in fixed order. */
const BATTERY_VALUES: SocialBattery[] = ["Charger", "Neutral", "Drain"];

/** The four population counts feeding the header + the empty-state gate. */
interface PopulationCounts {
  live: number;
  neverContacted: number;
  snoozed: number;
  archived: number;
}

const ZERO_COUNTS: PopulationCounts = {
  live: 0,
  neverContacted: 0,
  snoozed: 0,
  archived: 0,
};

export function HomeScreen() {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const sort = useDashboardPrefs((s) => s.sort);
  const filter = useDashboardPrefs((s) => s.filter);
  const setSort = useDashboardPrefs((s) => s.setSort);
  const setFilter = useDashboardPrefs((s) => s.setFilter);

  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [counts, setCounts] = useState<PopulationCounts>(ZERO_COUNTS);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    [],
  );
  // The live search term — LOCAL state (not persisted, unlike sort/filter): a
  // present term switches the list to the search result set via the DAO. `term`
  // is the immediate controlled-input value; `debouncedTerm` lags it and is what
  // the read + the empty-state gate key on, so a burst of keystrokes fires ONE
  // read after the burst settles rather than a full reload (list + counts +
  // categories) per keystroke (LOW-4).
  const [term, setTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Debounce the term: settle ~220ms after the last keystroke. The empty-state
  // gate reads `debouncedTerm` (via `hasTerm` below) so it stays consistent with
  // the rows the read actually produced; the clear button uses the immediate
  // `term` so it appears/hides without lag.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedTerm(term), 220);
    return () => clearTimeout(id);
  }, [term]);

  const hasTerm = debouncedTerm.trim() !== "";
  const showClear = term.trim() !== "";

  /**
   * The single load: `listDashboard` + the four counts, guarded by a `cancelled`
   * flag it returns as its canceller. Every caller (focus, foreground, pull)
   * runs this same function; the guard drops a stale async result if a newer
   * query started before this one resolved.
   */
  const reload = useCallback(() => {
    let cancelled = false;
    (async () => {
      try {
        const exec = getExecutor();
        const [list, live, neverContacted, snoozed, archived, cats] =
          await Promise.all([
            listDashboard(exec, { filter, sort, term: debouncedTerm }),
            countLiveContacts(exec),
            countNeverContacted(exec),
            countSnoozed(exec),
            countArchived(exec),
            listCategories(exec),
          ]);
        if (cancelled) return;
        setRows(list);
        setCounts({ live, neverContacted, snoozed, archived });
        setCategories(cats);
        setError(false);
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to load dashboard", err);
        if (!cancelled) {
          setRows([]);
          setError(true);
        }
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, sort, debouncedTerm]);

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

  const goToProfile = useCallback(
    (contactId: number) => navigation.navigate("Profile", { contactId }),
    [navigation],
  );

  // The single-active chip list: all · needs-attention · one per category ·
  // one per social-battery value · favourites · snoozed (with its live count).
  // Selecting a chip persists it via `setFilter`; the store change re-runs
  // `reload` through the focus effect (Plan 07's persisted-default mechanism).
  const chips: FilterChip[] = useMemo(
    () => [
      { key: "all", label: "All" },
      { key: "needs-attention", label: "Needs attention" },
      ...categories.map(
        (c): FilterChip => ({
          key: `category-${c.id}` as DashboardFilter,
          label: c.name,
        }),
      ),
      ...BATTERY_VALUES.map(
        (v): FilterChip => ({
          key: `battery-${v}` as DashboardFilter,
          label: v,
        }),
      ),
      { key: "favourites", label: "Favourites" },
      { key: "snoozed", label: "Snoozed", count: counts.snoozed },
    ],
    [categories, counts.snoozed],
  );

  // The cause-aware empty state — delegated to the pure gate (no inline count
  // arithmetic; HIGH-2). The live `activeFilter` (chip) + `hasTerm` (search box)
  // are threaded in: the gate's precedence resolves a zero-result search →
  // 'search-empty' BEFORE any filter/population branch, so a no-match search over
  // a non-empty population (or with a filter also active) never shows the
  // hidden-population or filter copy (MEDIUM-4).
  const emptyState = selectDashboardEmptyState({
    live: counts.live,
    neverContacted: counts.neverContacted,
    snoozed: counts.snoozed,
    archived: counts.archived,
    rowCount: rows.length,
    activeFilter: filter,
    hasTerm,
  });

  const listHeader = (
    <View style={styles.header}>
      <BirthdayBanner onPressContact={goToProfile} />
      {!error && counts.live > 0 ? (
        <Text
          testID="dashboard-header-count"
          style={[styles.countHeader, { color: colors.textSecondary }]}
        >
          {`${counts.live} contact${counts.live === 1 ? "" : "s"}`}
        </Text>
      ) : null}
      <View style={styles.searchRow}>
        <TextInput
          testID="dashboard-search-input"
          value={term}
          onChangeText={setTerm}
          placeholder="Search people and notes"
          placeholderTextColor={colors.textSecondary}
          autoCorrect={false}
          autoCapitalize="none"
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
        />
        {showClear ? (
          <Pressable
            testID="dashboard-search-clear"
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setTerm("")}
            style={[styles.searchClear, { borderColor: colors.border }]}
          >
            <Text style={[styles.searchClearText, { color: colors.textSecondary }]}>
              Clear
            </Text>
          </Pressable>
        ) : null}
      </View>
      <FilterChipRow chips={chips} active={filter} onSelect={setFilter} />
      {filter === "favourites" ? (
        <Pressable
          testID="dashboard-favourites-manage"
          accessibilityRole="button"
          accessibilityLabel="Manage favourites"
          onPress={() => navigation.navigate("ManageFavourites")}
          style={styles.manageEntry}
        >
          <Text style={[styles.manageText, { color: colors.accent }]}>
            Manage
          </Text>
        </Pressable>
      ) : null}
      <View
        testID="dashboard-sort-control"
        accessibilityRole="tablist"
        style={styles.sortControl}
      >
        {SORT_OPTIONS.map((option) => {
          const isActive = option.key === sort;
          return (
            <Pressable
              key={option.key}
              testID={`dashboard-sort-option-${option.key}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Sort by ${option.label}`}
              onPress={() => setSort(option.key)}
              style={[
                styles.sortOption,
                isActive
                  ? {
                      backgroundColor: colors.accent,
                      borderColor: colors.borderStrong,
                    }
                  : {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.sortLabel,
                  {
                    color: isActive ? colors.background : colors.textSecondary,
                  },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const listFooter = error ? null : (
    <View style={styles.footer}>
      <Pressable
        testID="dashboard-not-yet-contacted-entry"
        accessibilityRole="button"
        accessibilityLabel={`Not yet contacted (${counts.neverContacted})`}
        onPress={() => navigation.navigate("NeverContacted")}
        style={[
          styles.footerEntry,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.footerText, { color: colors.textPrimary }]}>
          {`Not yet contacted (${counts.neverContacted})`}
        </Text>
      </Pressable>
      <Pressable
        testID="dashboard-archived-entry"
        accessibilityRole="button"
        accessibilityLabel="Archived"
        onPress={() => navigation.navigate("Archived")}
        style={[
          styles.footerEntry,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.footerText, { color: colors.textPrimary }]}>
          Archived
        </Text>
      </Pressable>
    </View>
  );

  const listEmpty = error ? (
    <View testID="dashboard-error-state" style={styles.emptyState}>
      <Text style={[styles.emptyHeading, { color: colors.textPrimary }]}>
        Couldn't load your contacts
      </Text>
      <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
        Pull down to try again.
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
  ) : emptyState === "search-empty" ? (
    // A search that matched nothing. The gate resolves 'search-empty' BEFORE any
    // filter/population branch (MEDIUM-4), so this shows even when a filter is
    // also active — never the hidden-population or filter copy.
    <View testID="dashboard-search-empty" style={styles.emptyState}>
      <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
        {`No matches for "${debouncedTerm.trim()}"`}
      </Text>
    </View>
  ) : emptyState === "filter-empty" ? (
    // A non-'all' filter that yields nothing — the gate resolved 'filter-empty'
    // (MEDIUM-4: this fires BEFORE the hidden-population branch, so a zero-result
    // filter over a non-empty population never shows the hidden copy). The
    // favourites filter gets its own pointer-to-the-star copy; every other
    // filter (category / battery / needs-attention / snoozed) gets a calm generic.
    <View testID="dashboard-empty-filter" style={styles.emptyState}>
      {filter === "favourites" ? (
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

  return (
    <View
      testID="dashboard-root"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      {/* Owner-approved addition (beyond the plan text): a Settings entry — the
          08-07 dashboard rewrite dropped the placeholder's Settings row, leaving
          the (existing) Settings route UI-unreachable. A minimal top-right gear
          restores reach; exact styling is the owner's later design pass. */}
      <View style={styles.topBar}>
        <Pressable
          testID="dashboard-orbit-entry"
          accessibilityRole="button"
          accessibilityLabel="Orbit view"
          onPress={() => navigation.navigate("Orrery")}
          style={styles.settingsEntry}
        >
          {({ pressed }) => (
            <Text
              style={[
                styles.settingsGlyph,
                { color: pressed ? colors.accent : colors.textSecondary },
              ]}
            >
              ◎
            </Text>
          )}
        </Pressable>
        <Pressable
          testID="dashboard-settings-entry"
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => navigation.navigate("Settings")}
          style={styles.settingsEntry}
        >
          <Text style={[styles.settingsGlyph, { color: colors.textSecondary }]}>
            ⚙
          </Text>
        </Pressable>
      </View>
      <FlatList
        data={error ? [] : rows}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ContactCard
            contactId={item.id}
            name={item.name}
            photo={item.photo}
            modifiedAt={item.modified_at}
            status={item.status}
            categoryLabel={item.categoryLabel}
            isFavourite={item.favourite_rank !== null}
            fuelText={item.fuelText}
            snippet={item.snippet}
            onPress={() => goToProfile(item.id)}
          />
        )}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      />
      <Pressable
        testID="dashboard-create-fab"
        accessibilityRole="button"
        accessibilityLabel="Add contact"
        onPress={() => navigation.navigate("Create")}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.fabGlyph, { color: colors.background }]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  fabGlyph: {
    fontSize: 32,
    lineHeight: 34,
    fontWeight: "600",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  settingsEntry: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsGlyph: {
    fontSize: 22,
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
  countHeader: {
    fontSize: 13,
    fontWeight: "600",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  footer: {
    gap: 10,
    marginTop: 12,
  },
  footerEntry: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  footerText: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptyState: {
    gap: 8,
    marginTop: 24,
    alignItems: "flex-start",
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
});
