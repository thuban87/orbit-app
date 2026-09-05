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
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ContactCard } from "@/components/ContactCard";
import { DashboardControlRow } from "@/components/control-surface/DashboardControlRow";
import { DashboardOverlayHost } from "@/components/control-surface/DashboardOverlayHost";
import type { OverflowAction } from "@/components/OverflowMenu";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  countArchived,
  countLiveContacts,
  countNeverContacted,
  countSnoozed,
  type DashboardRow,
  listDashboardPopulation,
} from "@/db/dashboard-read";
import { getExecutor, localDateTime } from "@/db/database";
import { countUnbound } from "@/db/unbound-read";
import { selectDashboardEmptyState } from "@/logic/dashboard-empty-logic";
import type { DashboardScreenProps } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { useDashboardQueryStore } from "@/stores/dashboard-query-store";
import { useShellRefresh } from "@/stores/shell-refresh-store";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "dashboard-home";

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

export function HomeScreen({ navigation }: DashboardScreenProps<"Home">) {
  const { colors } = useTheme();
  const query = useDashboardQueryStore((state) => ({
    viewMode: state.viewMode,
    populations: state.populations,
    filters: state.filters,
    sort: state.sort,
  }));
  const hydrate = useDashboardQueryStore((state) => state.hydrate);
  const bottomClearance = useBottomClearance();

  const overflowActions: OverflowAction[] = [
    {
      label: "Your week",
      onPress: () => navigation.navigate("Digest"),
      testID: "dashboard-your-week-entry",
    },
    {
      label: "Backup and Restore",
      onPress: () =>
        navigation.navigate({
          name: "BackupTab",
          params: { screen: "Backup" },
        }),
      testID: "dashboard-backup-entry",
    },
    {
      label: "Orrery",
      onPress: () =>
        navigation.navigate({
          name: "OrreryTab",
          params: { screen: "Orrery" },
        }),
      testID: "dashboard-orbit-entry",
    },
    {
      label: "Settings",
      onPress: () =>
        navigation.navigate({
          name: "SettingsTab",
          params: { screen: "Settings" },
        }),
      testID: "dashboard-settings-entry",
    },
    {
      label: "Group Events",
      onPress: () => navigation.navigate("GroupEvents"),
      testID: "dashboard-group-events-overflow-entry",
    },
    {
      label: "Archived Contacts",
      onPress: () => navigation.navigate("Archived"),
      testID: "dashboard-archived-overflow-entry",
    },
  ];

  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [counts, setCounts] = useState<PopulationCounts>(ZERO_COUNTS);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    void hydrate(getExecutor());
  }, [hydrate]);

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
        const [list, live, neverContacted, snoozed, archived, unbound] =
          await Promise.all([
            listDashboardPopulation(exec, query, localDateTime()),
            countLiveContacts(exec),
            countNeverContacted(exec),
            countSnoozed(exec),
            countArchived(exec),
            countUnbound(exec),
          ]);
        if (cancelled) return;
        setRows(list);
        setCounts({ live, neverContacted, snoozed, archived, unbound });
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
  }, [query]);

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

  const goToProfile = useCallback(
    (contactId: number) => navigation.navigate("Profile", { contactId }),
    [navigation],
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
    unbound: counts.unbound,
    rowCount: rows.length,
    activeFilter: "all",
    activeFilters: query.filters,
    activePopulations: query.populations,
    hasTerm: false,
  });

  const listHeader = (
    <View style={styles.header}>
      {!error && counts.live > 0 ? (
        <Text
          testID="dashboard-header-count"
          style={[styles.countHeader, { color: colors.textSecondary }]}
        >
          {`${counts.live} contact${counts.live === 1 ? "" : "s"}`}
        </Text>
      ) : null}
    </View>
  );

  const listFooter = error ? null : (
    <View style={styles.footer}>
      <Pressable
        testID="dashboard-not-yet-contacted-entry"
        accessibilityRole="button"
        accessibilityLabel={`Not yet contacted (${counts.neverContacted})`}
        // The standalone Never Contacted screen is retired (DASHQ-03 / dossier
        // E-02). Its replacement control — the Not-Contacted population chip —
        // lands in Phase 26; until then this re-points to the live Dashboard
        // (owner-accepted one-phase gap, D-14). Never a deleted route.
        onPress={() => navigation.navigate("Home")}
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
        testID="dashboard-unbound-contacts-entry"
        accessibilityRole="button"
        accessibilityLabel={`Unbound contacts (${counts.unbound})`}
        onPress={() => navigation.navigate("UnboundContacts")}
        style={[
          styles.footerEntry,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.footerText, { color: colors.textPrimary }]}>
          {`Unbound contacts (${counts.unbound})`}
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
  ) : emptyState === "filter-empty" ? (
    <View testID="dashboard-empty-filter" style={styles.emptyState}>
      {query.populations.includes("favourites") ? (
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
      <View
        accessible={!panelOpen}
        importantForAccessibility={panelOpen ? "no-hide-descendants" : "auto"}
        pointerEvents={panelOpen ? "none" : "auto"}
      >
        <ShellAppBar
          variant="root"
          title="Orbit"
          overflow={overflowActions}
          trailing={
            <Pressable
              testID="dashboard-group-events-entry"
              accessibilityRole="button"
              accessibilityLabel="Group Events"
              onPress={() => navigation.navigate("GroupEvents")}
              style={styles.groupEventsEntry}
            >
              {({ pressed }) => (
                <>
                  <Text style={[styles.groupEventsGlyph, { color: pressed ? colors.accent : colors.textSecondary }]}>◉</Text>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.groupEventsLabel, { color: pressed ? colors.accent : colors.textSecondary }]}>Group Events</Text>
                </>
              )}
            </Pressable>
          }
        />
      </View>
      <DashboardControlRow onPanelOpenChange={setPanelOpen} />
      <View
        accessible={!panelOpen}
        importantForAccessibility={panelOpen ? "no-hide-descendants" : "auto"}
        pointerEvents={panelOpen ? "none" : "auto"}
        style={styles.listRegion}
      >
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
          contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        />
      </View>
      <DashboardOverlayHost />
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
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  yourWeekEntry: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  yourWeekText: {
    fontSize: 15,
    fontWeight: "600",
  },
  settingsEntry: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  backupEntry: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  backupText: {
    fontSize: 14,
    fontWeight: "600",
  },
  settingsGlyph: {
    fontSize: 22,
    fontWeight: "600",
  },
  groupEventsEntry: {
    maxWidth: 132,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  groupEventsGlyph: {
    fontSize: 18,
    fontWeight: "600",
  },
  groupEventsLabel: {
    flexShrink: 1,
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
