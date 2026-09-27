import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getExecutor, localDateTime } from "@/db/database";
import { finalizeSessionIfTerminal } from "@/db/import-session-dao";
import {
  getSessionById,
  listSessionRows,
  type SessionSummaryCounts,
  sessionRowCounts,
  sessionSummaryCounts,
} from "@/db/import-session-read";
import {
  loadedData,
  type ReadPhase,
  readLoading,
  runGatedRead,
} from "@/logic/read-phase";
import { navigationRef } from "@/navigation/linking";
import { resetToDashboardRoot } from "@/navigation/reset-intents";
import { navigateIntoTab } from "@/navigation/tab-entry";
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
import {
  importCompleteRetryState,
  runImportCompleteAction,
} from "./import-complete-logic";
import { useOpenImportSession } from "./use-open-import-session";

const LOG_SCOPE = "import-complete";

function contactLabel(count: number): string {
  return `${count} contact${count === 1 ? "" : "s"}`;
}

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

  if (phase.phase === "loading") {
    return (
      <View style={styles.root}>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Loading import summary…
        </Text>
      </View>
    );
  }

  if (phase.phase === "error") {
    return (
      <View testID="import-complete-read-error" style={styles.root}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Import complete
        </Text>
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          Import complete
        </Text>

        <View style={styles.counts}>
          <View
            style={[
              styles.footerEntry,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.footerText, { color: colors.textPrimary }]}>
              {`Imported (${counts.imported})`}
            </Text>
            <Text style={[styles.countDetail, { color: colors.textSecondary }]}>
              {contactLabel(counts.imported)}
            </Text>
          </View>
          <View
            style={[
              styles.footerEntry,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.footerText, { color: colors.textPrimary }]}>
              {`Already in Orbit (${counts.alreadyInOrbit})`}
            </Text>
            <Text style={[styles.countDetail, { color: colors.textSecondary }]}>
              {contactLabel(counts.alreadyInOrbit)}
            </Text>
          </View>
          <View
            style={[
              styles.footerEntry,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.footerText, { color: colors.textPrimary }]}>
              {`Need review (${counts.needReview})`}
            </Text>
            <Text style={[styles.countDetail, { color: colors.textSecondary }]}>
              {contactLabel(counts.needReview)}
            </Text>
          </View>
          <View
            style={[
              styles.footerEntry,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.footerText, { color: colors.textPrimary }]}>
              {`Failed / skipped (${counts.failedOrSkipped})`}
            </Text>
            <Text style={[styles.countDetail, { color: colors.textSecondary }]}>
              {contactLabel(counts.failedOrSkipped)}
            </Text>
          </View>
          <View
            style={[
              styles.footerEntry,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.footerText, { color: colors.textPrimary }]}>
              {`${counts.nameRequiredSkipped} skipped — no name`}
            </Text>
            <Text style={[styles.countDetail, { color: colors.textSecondary }]}>
              {contactLabel(counts.nameRequiredSkipped)}
            </Text>
          </View>
          <View
            style={[
              styles.footerEntry,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.footerText, { color: colors.textPrimary }]}>
              {`${counts.birthdayUnreadable} birthdays couldn't be read`}
            </Text>
            <Text style={[styles.countDetail, { color: colors.textSecondary }]}>
              {contactLabel(counts.birthdayUnreadable)}
            </Text>
          </View>
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
                style={[styles.secondaryButton, { borderColor: colors.border }]}
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
        {counts.needReview > 0 ? (
          <Pressable
            testID="import-complete-review"
            accessibilityRole="button"
            accessibilityLabel="Review possible matches"
            onPress={() =>
              navigation.navigate("DuplicateReview", {
                sessionId: route.params.sessionId,
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
              navigateIntoTab(
                navigationRef.current,
                "DashboardTab",
                "Profile",
                {
                  contactId: alreadyLinkedContactId,
                },
              )
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
          onPress={() => navigationRef.current?.reset(resetToDashboardRoot())}
          style={[styles.doneButton, { backgroundColor: colors.accent }]}
        >
          <Text style={{ color: colors.background }}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: "700" },
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
  countDetail: { fontSize: 13 },
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
