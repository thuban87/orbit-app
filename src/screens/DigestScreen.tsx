/**
 * DigestScreen (DGST-01/02/03) — the live "your week" retrospective surface: who
 * the user reached in the trailing window, who is quietly slipping (the overlooked
 * groups), the gentle "effortful" aside, and the calm unified empty state. Reached
 * from the dashboard's discreet "Your week" entry (Plan 15-04) and, later, the
 * Sunday notification tap (Plan 15-05).
 *
 * PURE READ SURFACE (dossier 14 Cluster A/B): the focus-effect runs only the three
 * read-only DAOs (`readRetrospective` / `readOverlooked` / `readGentleLine`) plus
 * `countNeverContacted` — no writer, no transaction, no network, async reads only
 * (NEVER a `...Sync`). It RE-USES, never re-derives: rows come from 15-01's reads,
 * the Drifting / Gone-quiet split + caps + the "skews hard" gate + the all-quiet
 * predicate all come from `digest-logic`, and the rogue status colour reaches the
 * screen only through the shared `ContactCard` status ring — the digest adds no
 * status colour of its own.
 *
 * Load discipline mirrors the dashboard's focus-effect reads: a `cancelled`-flag guard drops a
 * stale async result if focus moved on, and a null-vs-loaded SENTINEL (`phase`)
 * keeps the "all quiet this week" state from flashing before the reads resolve —
 * the header renders instantly, the section bodies stay blank until "loaded".
 * A throwing read lands on the calm error sentinel and re-runs on next focus.
 *
 * Static content — no Skia loop, no per-frame state; the app's animation / focus-
 * pause rules do not apply here. Every colour resolves through `useTheme().colors.*`
 * — no hex/named literal (CLAUDE.md / check:colors). Section order, copy, tokens and
 * testIDs are LOCKED in 15-UI-SPEC.
 */
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { ContactCard } from "@/components/ContactCard";
import type { ProfileStatus } from "@/db/contact-status-read";
import { countNeverContacted } from "@/db/dashboard-read";
import { getExecutor } from "@/db/database";
import type {
  GentleLine,
  OverlookedRow,
  RetrospectiveRow,
} from "@/db/digest-read";
import {
  readGentleLine,
  readOverlooked,
  readRetrospective,
} from "@/db/digest-read";
import {
  capGroup,
  dayTag,
  isAllQuiet,
  shouldShowEffortful,
  splitOverlooked,
} from "@/logic/digest-logic";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "digest";

/** The four reads the screen composes into its sections. */
interface DigestData {
  retrospective: RetrospectiveRow[];
  overlooked: OverlookedRow[];
  gentle: GentleLine;
  backlog: number;
}

/**
 * The null-vs-loaded sentinel: `loading` is the pre-resolution state (blank
 * bodies, NOT the empty state), `loaded` carries the reads, `error` is the calm
 * failure. Starting at `loading` is what stops "all quiet" flashing before data.
 */
type LoadState =
  | { phase: "loading" }
  | { phase: "loaded"; data: DigestData }
  | { phase: "error" };

export function DigestScreen({ navigation }: RootStackScreenProps<"Digest">) {
  const { colors } = useTheme();
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  // In-place expand toggles for the "+N more →" affordance (RESEARCH Open Q3 —
  // no new route; a local cap flip keeps the phase minimal).
  const [expandDrifting, setExpandDrifting] = useState(false);
  const [expandGoneQuiet, setExpandGoneQuiet] = useState(false);

  // Re-query on focus. A cancelled flag drops a stale async result if focus is
  // lost before the reads resolve (the shipped focus-effect pattern). The four
  // reads run in parallel; a throw lands on the error sentinel. Prior loaded data
  // is retained across a re-focus so nothing flashes while the next read runs.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const exec = getExecutor();
          const [retrospective, overlooked, gentle, backlog] =
            await Promise.all([
              readRetrospective(exec),
              readOverlooked(exec),
              readGentleLine(exec),
              countNeverContacted(exec),
            ]);
          if (!cancelled) {
            setState({
              phase: "loaded",
              data: { retrospective, overlooked, gentle, backlog },
            });
          }
        } catch (err) {
          Logger.error(LOG_SCOPE, "failed to load weekly digest", err);
          if (!cancelled) setState({ phase: "error" });
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const goToProfile = (contactId: number) =>
    navigation.navigate("Profile", { contactId });

  return (
    <View
      testID="digest-root"
      style={styles.root}
    >
      <View style={styles.header}>
        <Pressable
          testID="digest-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          Your week
        </Text>
      </View>

      {state.phase === "error" ? (
        <View testID="digest-error" style={styles.emptyState}>
          <Text style={[styles.emptyHeading, { color: colors.textPrimary }]}>
            Couldn't load your week
          </Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            Try opening it again in a moment.
          </Text>
        </View>
      ) : state.phase === "loaded" ? (
        <DigestBody
          data={state.data}
          colors={colors}
          expandDrifting={expandDrifting}
          expandGoneQuiet={expandGoneQuiet}
          onExpandDrifting={() => setExpandDrifting(true)}
          onExpandGoneQuiet={() => setExpandGoneQuiet(true)}
          onPressName={goToProfile}
          // Never Contacted screen retired (DASHQ-03 / D-14); the Not-Contacted
          // population chip lands in Phase 26. Re-pointed to the live Dashboard
          // so the backlog tap never targets a deleted route. countNeverContacted
          // (the badge number) is unaffected.
          onPressBacklog={() => navigation.navigate("Home")}
        />
      ) : null}
    </View>
  );
}

interface DigestBodyProps {
  data: DigestData;
  colors: ReturnType<typeof useTheme>["colors"];
  expandDrifting: boolean;
  expandGoneQuiet: boolean;
  onExpandDrifting: () => void;
  onExpandGoneQuiet: () => void;
  onPressName: (contactId: number) => void;
  onPressBacklog: () => void;
}

/**
 * The loaded body — sections in the LOCKED fixed order (15-UI-SPEC Screen
 * Anatomy): Retrospective → gentle line → Overlooked (Drifting, Gone quiet,
 * backlog nudge), OR the unified "all quiet" state when every section is empty.
 */
function DigestBody({
  data,
  colors,
  expandDrifting,
  expandGoneQuiet,
  onExpandDrifting,
  onExpandGoneQuiet,
  onPressName,
  onPressBacklog,
}: DigestBodyProps) {
  const { retrospective, overlooked, gentle, backlog } = data;
  const { drifting, goneQuiet } = splitOverlooked(overlooked);
  const driftingCap = capGroup(drifting);
  const goneQuietCap = capGroup(goneQuiet);
  const effortfulShown = shouldShowEffortful(gentle.hard, gentle.total);

  const allQuiet = isAllQuiet({
    reachedCount: retrospective.length,
    driftingCount: drifting.length,
    goneQuietCount: goneQuiet.length,
    backlogCount: backlog,
    effortfulShown,
  });

  if (allQuiet) {
    return (
      <View testID="digest-empty-all-quiet" style={styles.emptyState}>
        <Text style={[styles.emptyHeading, { color: colors.textPrimary }]}>
          All quiet this week
        </Text>
        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
          No catch-ups to look back on, and no one's slipping. Enjoy the calm.
        </Text>
      </View>
    );
  }

  const backlogLabel =
    backlog === 1
      ? "1 person you added but never reached"
      : `${backlog} people you added but never reached`;

  const driftingRows = expandDrifting ? drifting : driftingCap.shown;
  const goneQuietRows = expandGoneQuiet ? goneQuiet : goneQuietCap.shown;

  return (
    <ScrollView contentContainerStyle={styles.body}>
      {/* 1. Retrospective — "Reached this week" (no scoreboard count). */}
      <View testID="digest-retrospective" style={styles.section}>
        {retrospective.length > 0 ? (
          <>
            <Text style={[styles.lead, { color: colors.textSecondary }]}>
              You caught up with these people this week
            </Text>
            {retrospective.map((row) => (
              <Pressable
                key={row.id}
                testID={`digest-reached-row-${row.id}`}
                accessibilityRole="button"
                accessibilityLabel={row.name}
                onPress={() => onPressName(row.id)}
                style={styles.reachedRow}
              >
                <Avatar
                  photo={row.photo}
                  name={row.name}
                  contactId={row.id}
                  size={44}
                />
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[styles.reachedName, { color: colors.textPrimary }]}
                >
                  {row.name}
                </Text>
                <Text style={[styles.dayTag, { color: colors.textSecondary }]}>
                  {dayTag(row.last_reached)}
                </Text>
              </Pressable>
            ))}
          </>
        ) : (
          <Text style={[styles.lead, { color: colors.textSecondary }]}>
            No catch-ups logged this week
          </Text>
        )}
      </View>

      {/* 2. Gentle effortful line — quiet aside, only when clearly real. */}
      {effortfulShown ? (
        <View testID="digest-gentle-line" style={styles.section}>
          <Text style={[styles.gentleText, { color: colors.textSecondary }]}>
            A few recent conversations have felt effortful.
          </Text>
          <View style={styles.gentleNames}>
            {gentle.people.map((person) => (
              <Pressable
                key={person.id}
                testID={`digest-gentle-name-${person.id}`}
                accessibilityRole="button"
                accessibilityLabel={person.name}
                onPress={() => onPressName(person.id)}
              >
                <Text style={[styles.gentleName, { color: colors.accent }]}>
                  {person.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* 3. The overlooked — Drifting, Gone quiet, then the backlog nudge. */}
      {drifting.length > 0 ? (
        <View style={styles.section}>
          <Text
            testID="digest-overlooked-drifting"
            style={[styles.groupLabel, { color: colors.textSecondary }]}
          >
            Drifting
          </Text>
          {driftingRows.map((row) => (
            <ContactCard
              key={row.id}
              contactId={row.id}
              name={row.name}
              photo={row.photo}
              modifiedAt={undefined}
              status={row.status as ProfileStatus}
              categoryLabel={null}
              isFavourite={false}
              fuelText={null}
              snippet={null}
              onPress={() => onPressName(row.id)}
            />
          ))}
          {driftingCap.overflow > 0 && !expandDrifting ? (
            <Pressable
              testID="digest-overlooked-more-drifting"
              accessibilityRole="button"
              accessibilityLabel={`${driftingCap.overflow} more drifting`}
              onPress={onExpandDrifting}
              style={styles.moreRow}
            >
              <Text style={[styles.moreText, { color: colors.accent }]}>
                {`+${driftingCap.overflow} more →`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {goneQuiet.length > 0 ? (
        <View style={styles.section}>
          <Text
            testID="digest-overlooked-gonequiet"
            style={[styles.groupLabel, { color: colors.textSecondary }]}
          >
            Gone quiet
          </Text>
          {goneQuietRows.map((row) => (
            <ContactCard
              key={row.id}
              contactId={row.id}
              name={row.name}
              photo={row.photo}
              modifiedAt={undefined}
              status={row.status as ProfileStatus}
              categoryLabel={null}
              isFavourite={false}
              fuelText={null}
              snippet={null}
              onPress={() => onPressName(row.id)}
            />
          ))}
          {goneQuietCap.overflow > 0 && !expandGoneQuiet ? (
            <Pressable
              testID="digest-overlooked-more-gonequiet"
              accessibilityRole="button"
              accessibilityLabel={`${goneQuietCap.overflow} more gone quiet`}
              onPress={onExpandGoneQuiet}
              style={styles.moreRow}
            >
              <Text style={[styles.moreText, { color: colors.accent }]}>
                {`+${goneQuietCap.overflow} more →`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {backlog > 0 ? (
        <Pressable
          testID="digest-backlog-nudge"
          accessibilityRole="button"
          accessibilityLabel={backlogLabel}
          onPress={onPressBacklog}
          style={[
            styles.backlogEntry,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.backlogText, { color: colors.textPrimary }]}>
            {backlogLabel}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  body: {
    gap: 24,
    paddingBottom: 16,
  },
  section: {
    gap: 8,
  },
  lead: {
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 21,
  },
  reachedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
  },
  reachedName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "400",
  },
  dayTag: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  gentleText: {
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 21,
  },
  gentleNames: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  gentleName: {
    fontSize: 15,
    fontWeight: "600",
    minHeight: 44,
    lineHeight: 44,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  moreRow: {
    minHeight: 44,
    justifyContent: "center",
  },
  moreText: {
    fontSize: 14,
    fontWeight: "600",
  },
  backlogEntry: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backlogText: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptyState: {
    gap: 8,
    marginTop: 8,
  },
  emptyHeading: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyBody: {
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 21,
  },
});
