import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import { getExecutor, localDateTime } from "@/db/database";
import { finalizeSessionIfTerminal } from "@/db/import-session-dao";
import {
  getSessionById,
  listSessionRows,
  type SessionSummaryCounts,
  type SummaryBucketKey,
  sessionRowCounts,
  sessionSummaryCounts,
} from "@/db/import-session-read";
import {
  loadedData,
  type ReadPhase,
  readLoading,
  runGatedRead,
} from "@/logic/read-phase";
import { useBackActsAsDone } from "@/navigation/back-acts-as-done";
import {
  DEFAULT_FLOW_HOST,
  finishFlow,
  openContactFromFlow,
} from "@/navigation/flow-host";
import type { RootStackScreenProps } from "@/navigation/types";
import { runImportBatch } from "@/services/import/import-driver";
import {
  retryImportedPhoto,
  retryPhotoFs,
  skipRemainingPhotos,
} from "@/services/import/import-photo-retry";
import { useTheme } from "@/theme";
import { createLatestRequestAuthority } from "@/utils/latest-request";
import { Logger } from "@/utils/logger";
import { plural } from "@/utils/plural";
import {
  importCompleteRetryState,
  runImportCompleteAction,
} from "./import-complete-logic";
import { useOpenImportSession } from "./use-open-import-session";

// --- Tunable constants (top-of-file per project convention) ------------------

/**
 * How many names an outcome lists before "Show all" (38.12 D-109: "collapsed
 * after about five"; the exact number is 38.12 Plan 23's choice).
 */
export const IMPORT_COMPLETE_NAME_PREVIEW = 5;

const LOG_SCOPE = "import-complete";

/**
 * The person outcomes, in display order (38.12 D-55, D-109). Each renders only
 * when non-zero. `opens`: a listed name opens that person (imported and linked
 * only, D-109).
 */
const OUTCOME_BUCKETS: ReadonlyArray<{
  key: SummaryBucketKey;
  title: string;
  opens: boolean;
}> = [
  { key: "imported", title: "Imported", opens: true },
  { key: "linked", title: "Linked", opens: true },
  { key: "alreadyInOrbit", title: "Already in Orbit", opens: false },
  { key: "skippedByUser", title: "Skipped by you", opens: false },
  // B-3 (convergence c2): name-required skips keep their own outcome.
  { key: "skippedNoName", title: "Skipped — no name", opens: false },
  { key: "failed", title: "Couldn't import", opens: false },
  { key: "needsReview", title: "Needs review", opens: false },
];

interface ImportCompleteSummary {
  counts: SessionSummaryCounts;
  unfinished: { failed: number; pending: number };
  photoRows: number[];
  alreadyLinkedContactId: number | null;
}

async function readImportCompleteSummary(
  sessionId: number,
): Promise<ImportCompleteSummary> {
  const exec = getExecutor();
  await finalizeSessionIfTerminal(exec, sessionId, localDateTime());
  const [counts, rawCounts, session, rows] = await Promise.all([
    sessionSummaryCounts(exec, sessionId),
    sessionRowCounts(exec, sessionId),
    getSessionById(exec, sessionId),
    listSessionRows(exec, sessionId),
  ]);
  const alreadyLinkedRows = rows.filter(
    (row) => row.matchOutcome === "already_linked",
  );
  return {
    counts,
    unfinished: { failed: rawCounts.failed, pending: rawCounts.pending },
    photoRows: rows
      .filter(
        (row) =>
          row.rowStatus === "imported" &&
          row.contactId !== null &&
          row.photoRelPath !== null,
      )
      .map((row) => row.id),
    alreadyLinkedContactId:
      session?.mode === "single" &&
      alreadyLinkedRows.length === 1 &&
      alreadyLinkedRows[0].matchedContactId !== null
        ? alreadyLinkedRows[0].matchedContactId
        : null,
  };
}

const RETRY_FAILED_NOTICE =
  "Retry didn't finish. Contacts already imported are saved.";
const SKIP_PHOTOS_FAILED_NOTICE =
  "Couldn't skip the remaining photos. Please try again.";

/** Durable completion report for a finished or stopped import. */
export function ImportCompleteScreen({
  navigation,
  route,
}: RootStackScreenProps<"ImportComplete">) {
  useOpenImportSession(route.params.sessionId);
  const { colors } = useTheme();
  // 38.3 review B-WR-04 (D-04, RG-035): the summary read is a ReadPhase gated
  // by one latest-request authority, like ReconcileComplete. A read failure
  // renders a read-error state with a read-only Retry; a failed Retry/Skip
  // WRITE is an inline notice above the still-loaded summary, never "Couldn't
  // load the import summary".
  const [phase, setPhase] =
    useState<ReadPhase<ImportCompleteSummary>>(readLoading);
  const authority = useMemo(() => createLatestRequestAuthority(), []);
  const [retrying, setRetrying] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  // 38.3 review B-WR-03: `disabled={retrying}` is async React state, so two
  // same-tick taps started two runImportBatch runs over one pending snapshot;
  // the loser hit the external-link UNIQUE index and the driver re-marked the
  // winner's imported row "failed". One synchronous slot covers Retry and
  // Skip remaining photos.
  const actionInFlight = useRef(false);
  // D-109: outcomes the user expanded past the name preview with "Show all".
  const [expanded, setExpanded] = useState<ReadonlySet<SummaryBucketKey>>(
    () => new Set(),
  );

  const load = useCallback(async (): Promise<void> => {
    await runGatedRead({
      gate: authority,
      read: () => readImportCompleteSummary(route.params.sessionId),
      publish: setPhase,
      onError: (err) =>
        Logger.error(LOG_SCOPE, "failed to load import summary", err),
    });
  }, [authority, route.params.sessionId]);

  // 38.3 UAT O-3 (D-10): re-read on EVERY focus, not mount only, so returning
  // from Duplicate Review after a link shows the current Need-review count.
  // The focus path runs only `load` — the gated summary read plus the
  // pre-existing idempotent terminal finalizer — never an import, retry, skip
  // or row mutation. Blur retires any in-flight read.
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => authority.invalidate();
    }, [authority, load]),
  );

  const photoRows = loadedData(phase)?.photoRows ?? [];

  const runAction = useCallback(
    async (write: () => Promise<unknown>, failureNotice: string) => {
      setRetrying(true);
      try {
        await runImportCompleteAction(actionInFlight, {
          write: async () => {
            setActionNotice(null);
            await write();
          },
          refresh: load,
          onWriteFailed: (err) => {
            Logger.error(LOG_SCOPE, "import complete action failed", err);
            setActionNotice(failureNotice);
          },
        });
      } finally {
        if (!actionInFlight.current) setRetrying(false);
      }
    },
    [load],
  );

  const retry = useCallback(
    () =>
      runAction(async () => {
        const exec = getExecutor();
        await runImportBatch(exec, {
          sessionId: route.params.sessionId,
          now: localDateTime(),
          eligibleStatuses: ["pending", "failed"],
        });
        for (const rowId of photoRows) {
          await retryImportedPhoto(exec, retryPhotoFs, rowId, localDateTime());
        }
        await finalizeSessionIfTerminal(
          exec,
          route.params.sessionId,
          localDateTime(),
        );
      }, RETRY_FAILED_NOTICE),
    [photoRows, route.params.sessionId, runAction],
  );

  const skipPhotos = useCallback(
    () =>
      runAction(
        () =>
          skipRemainingPhotos(
            getExecutor(),
            retryPhotoFs,
            route.params.sessionId,
            localDateTime(),
          ),
        SKIP_PHOTOS_FAILED_NOTICE,
      ),
    [route.params.sessionId, runAction],
  );

  // Done finishes the flow where it was started: Settings → Contacts &
  // Relationships by default (38.12 D-110), never a root reset that wipes the
  // other tabs. Header Back and system Back act like Done (owner ruling 38.9
  // D-73; review WR-07), never returning to the flow's setup screen. Every
  // state carries the shared header (D-16).
  const host = route.params.host ?? DEFAULT_FLOW_HOST;
  const done = useCallback(
    () => finishFlow(navigation, host),
    [navigation, host],
  );
  useBackActsAsDone(done);
  const header = (
    <ShellAppBar variant="child" title="Import complete" onBack={done} />
  );

  if (phase.phase === "loading") {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.frame}>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Loading import summary…
          </Text>
        </View>
      </View>
    );
  }

  if (phase.phase === "error") {
    return (
      <View testID="import-complete-read-error" style={styles.root}>
        {header}
        <View style={styles.frame}>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Couldn&apos;t load the import summary. Contacts already imported are
            saved.
          </Text>
          <Pressable
            testID="import-complete-read-retry"
            accessibilityRole="button"
            accessibilityLabel="Retry loading the import summary"
            onPress={() => void load()}
            style={[
              styles.secondaryButton,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Text style={{ color: colors.textPrimary }}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const { counts, alreadyLinkedContactId } = phase.data;
  const retryState = importCompleteRetryState({
    failed: phase.data.unfinished.failed,
    pending: phase.data.unfinished.pending,
    photoRows: photoRows.length,
  });

  // D-67 (owner): at large text the summary outgrows the screen, so the
  // content scrolls and the actions sit after the scroll region, always
  // reachable (the D-49 resume-prompt shape).
  return (
    <View testID="import-complete-screen" style={styles.root}>
      {header}
      <View style={styles.frame}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.counts}>
            {OUTCOME_BUCKETS.map(({ key, title, opens }) => {
              const bucket = counts[key];
              // D-55: an outcome with nobody in it is not shown.
              if (bucket.count === 0) return null;
              const showAll =
                expanded.has(key) ||
                bucket.people.length <= IMPORT_COMPLETE_NAME_PREVIEW;
              const shown = showAll
                ? bucket.people
                : bucket.people.slice(0, IMPORT_COMPLETE_NAME_PREVIEW);
              return (
                <View
                  key={key}
                  testID={`import-complete-outcome-${key}`}
                  style={[
                    styles.footerEntry,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    accessibilityRole="header"
                    style={[styles.footerText, { color: colors.textPrimary }]}
                  >
                    {`${title} (${bucket.count})`}
                  </Text>
                  {shown.map((person) => {
                    const contactId = person.contactId;
                    if (opens && contactId !== null) {
                      return (
                        <Pressable
                          key={person.rowId}
                          testID={`import-complete-person-${person.rowId}`}
                          accessibilityRole="button"
                          accessibilityLabel={`Open ${person.name}`}
                          onPress={() =>
                            openContactFromFlow(navigation, host, contactId)
                          }
                          style={styles.personButton}
                        >
                          <Text
                            style={[
                              styles.personName,
                              { color: colors.accentText },
                            ]}
                          >
                            {person.name}
                          </Text>
                        </Pressable>
                      );
                    }
                    return (
                      <Text
                        key={person.rowId}
                        testID={`import-complete-person-${person.rowId}`}
                        style={[
                          styles.personName,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {person.name}
                      </Text>
                    );
                  })}
                  {showAll ? null : (
                    <Pressable
                      testID={`import-complete-show-all-${key}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Show all ${bucket.count}: ${title}`}
                      onPress={() =>
                        setExpanded((current) => new Set(current).add(key))
                      }
                      style={styles.personButton}
                    >
                      <Text
                        style={[
                          styles.personName,
                          { color: colors.accentText },
                        ]}
                      >
                        Show all
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
            {counts.birthdayUnreadable > 0 ? (
              <View
                testID="import-complete-birthday-unreadable"
                style={[
                  styles.footerEntry,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.footerText, { color: colors.textPrimary }]}
                >
                  {`${plural(counts.birthdayUnreadable, "birthday")} couldn't be read`}
                </Text>
              </View>
            ) : null}
          </View>

          {actionNotice ? (
            <Text
              testID="import-complete-action-notice"
              accessibilityLiveRegion="polite"
              style={[styles.body, { color: colors.danger }]}
            >
              {actionNotice}
            </Text>
          ) : null}

          {retryState.visible ? (
            <View style={styles.retryBlock}>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                {retryState.message}
              </Text>
              <Pressable
                testID="import-complete-retry"
                accessibilityRole="button"
                accessibilityLabel="Retry unfinished imports"
                disabled={retrying}
                onPress={() => void retry()}
                style={[styles.secondaryButton, { borderColor: colors.accent }]}
              >
                <Text style={{ color: colors.accentText }}>
                  {retrying ? "Retrying…" : "Retry"}
                </Text>
              </Pressable>
              {photoRows.length > 0 ? (
                <Pressable
                  testID="import-complete-skip-photos"
                  accessibilityRole="button"
                  accessibilityLabel="Skip remaining photos"
                  disabled={retrying}
                  onPress={() => void skipPhotos()}
                  style={[
                    styles.secondaryButton,
                    { borderColor: colors.border },
                  ]}
                >
                  <Text style={{ color: colors.textPrimary }}>
                    Skip remaining photos
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.actions}>
          {counts.needsReview.count > 0 ? (
            <Pressable
              testID="import-complete-review"
              accessibilityRole="button"
              accessibilityLabel="Review possible matches"
              onPress={() =>
                // D-110 (convergence c1 A-1): the flow host travels on.
                navigation.navigate("DuplicateReview", {
                  sessionId: route.params.sessionId,
                  host: route.params.host,
                })
              }
              style={[
                styles.secondaryButton,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <Text style={{ color: colors.textPrimary }}>
                Review possible matches
              </Text>
            </Pressable>
          ) : null}
          {alreadyLinkedContactId !== null ? (
            <Pressable
              testID="import-complete-view-contact"
              accessibilityRole="button"
              accessibilityLabel="View contact"
              onPress={() =>
                openContactFromFlow(navigation, host, alreadyLinkedContactId)
              }
              style={[
                styles.secondaryButton,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <Text style={{ color: colors.textPrimary }}>View contact</Text>
            </Pressable>
          ) : null}
          <Pressable
            testID="import-complete-done"
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={done}
            style={[styles.doneButton, { backgroundColor: colors.accent }]}
          >
            <Text style={{ color: colors.onAccent }}>Done</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  frame: { flex: 1, padding: 16, gap: 16 },
  body: { fontSize: 15, lineHeight: 21 },
  counts: { gap: 10 },
  footerEntry: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 2,
  },
  footerText: { fontSize: 16, fontWeight: "600" },
  personButton: { minHeight: 44, justifyContent: "center" },
  personName: { fontSize: 15, lineHeight: 21 },
  scroll: { flexGrow: 1, flexShrink: 1 },
  scrollContent: { gap: 16 },
  retryBlock: { gap: 8 },
  actions: { gap: 10 },
  secondaryButton: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  doneButton: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
