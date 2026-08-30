import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getExecutor, localDateTime } from "@/db/database";
import { finalizeSessionIfTerminal } from "@/db/import-session-dao";
import {
  getSessionById,
  listSessionRows,
  type SessionSummaryCounts,
  sessionRowCounts,
  sessionSummaryCounts,
} from "@/db/import-session-read";
import type { RootStackScreenProps } from "@/navigation/types";
import { runImportBatch } from "@/services/import/import-driver";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "import-complete";

function contactLabel(count: number): string {
  return `${count} contact${count === 1 ? "" : "s"}`;
}

/** Durable completion report and the final bridge out of bulk import. */
export function ImportCompleteScreen({
  navigation,
  route,
}: RootStackScreenProps<"ImportComplete">) {
  const { colors } = useTheme();
  const [counts, setCounts] = useState<SessionSummaryCounts | null>(null);
  const [hasFailures, setHasFailures] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState(false);
  const [alreadyLinkedContactId, setAlreadyLinkedContactId] = useState<
    number | null
  >(null);

  const load = useCallback(async () => {
    const exec = getExecutor();
    await finalizeSessionIfTerminal(
      exec,
      route.params.sessionId,
      localDateTime(),
    );
    const [next, rawCounts, session, rows] = await Promise.all([
      sessionSummaryCounts(exec, route.params.sessionId),
      sessionRowCounts(exec, route.params.sessionId),
      getSessionById(exec, route.params.sessionId),
      listSessionRows(exec, route.params.sessionId),
    ]);
    const alreadyLinkedRows = rows.filter(
      (row) => row.matchOutcome === "already_linked",
    );
    setAlreadyLinkedContactId(
      session?.mode === "single" &&
        alreadyLinkedRows.length === 1 &&
        alreadyLinkedRows[0].matchedContactId !== null
        ? alreadyLinkedRows[0].matchedContactId
        : null,
    );
    setCounts(next);
    setHasFailures(rawCounts.failed > 0);
    setError(false);
  }, [route.params.sessionId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await load();
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to load import summary", err);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const retry = useCallback(async () => {
    setRetrying(true);
    try {
      const exec = getExecutor();
      await runImportBatch(exec, {
        sessionId: route.params.sessionId,
        now: localDateTime(),
        eligibleStatuses: ["pending", "failed"],
      });
      await finalizeSessionIfTerminal(
        exec,
        route.params.sessionId,
        localDateTime(),
      );
      await load();
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to retry import", err);
      setError(true);
    } finally {
      setRetrying(false);
    }
  }, [load, route.params.sessionId]);

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Loading import summary…
        </Text>
      </View>
    );
  }

  if (error || counts === null) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Import complete
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Couldn&apos;t load the import summary. Please go back and try again.
        </Text>
      </View>
    );
  }

  return (
    <View
      testID="import-complete-screen"
      style={[styles.root, { backgroundColor: colors.background }]}
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

      {hasFailures ? (
        <View style={styles.retryBlock}>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Some contacts couldn&apos;t be imported.
          </Text>
          <Pressable
            testID="import-complete-retry"
            accessibilityRole="button"
            accessibilityLabel="Retry failed imports"
            disabled={retrying}
            onPress={() => void retry()}
            style={[styles.secondaryButton, { borderColor: colors.accent }]}
          >
            <Text style={{ color: colors.accent }}>
              {retrying ? "Retrying…" : "Retry"}
            </Text>
          </Pressable>
        </View>
      ) : null}

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
        <Pressable
          testID="import-complete-unbound"
          accessibilityRole="button"
          accessibilityLabel="View Unbound contacts"
          onPress={() => navigation.navigate("UnboundContacts")}
          style={[
            styles.secondaryButton,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <Text style={{ color: colors.textPrimary }}>
            View Unbound contacts
          </Text>
        </Pressable>
        {alreadyLinkedContactId !== null ? (
          <Pressable
            testID="import-complete-view-contact"
            accessibilityRole="button"
            accessibilityLabel="View contact"
            onPress={() =>
              navigation.navigate("Profile", {
                contactId: alreadyLinkedContactId,
              })
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
          onPress={() =>
            navigation.reset({ index: 0, routes: [{ name: "Home" }] })
          }
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
  retryBlock: { gap: 8 },
  actions: { gap: 10, marginTop: "auto" },
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
