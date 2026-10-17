import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MatchChoiceSheet } from "@/components/MatchChoiceSheet";
import {
  type BulkAction,
  type CandidateChoice,
  type CandidateItem,
  ReviewMatchesList,
} from "@/components/ReviewMatchesList";
import { ShellAppBar } from "@/components/ShellAppBar";
import { getContactHeader } from "@/db/contact-read";
import { getExecutor, localDateTime } from "@/db/database";
import {
  finalizeSessionIfTerminal,
  markRowStatus,
} from "@/db/import-session-dao";
import {
  getSessionById,
  type ImportSession,
  type ImportSessionRow,
  listSessionRows,
  sessionBatchLifecycle,
  sessionRowCounts,
} from "@/db/import-session-read";
import { linkExistingContactToRow } from "@/db/imported-contact-dao";
import type { RootStackScreenProps } from "@/navigation/types";
import { importRowAsNew } from "@/services/import/import-driver";
import { applyBoundImportEffects } from "@/services/import/import-lifecycle-effects";
import { resolveImportStagingUri } from "@/services/photos/photo-storage";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import { runSingleFlight } from "@/utils/single-flight";
import {
  bulkResolveFailureLabel,
  duplicateReviewView,
  runBulkResolveThenRecover,
  runResolveThenRecover,
} from "./duplicate-review-logic";
import { resolveExistingContactChoices } from "./existing-contact-choices";
import { useOpenImportSession } from "./use-open-import-session";

const LOG_SCOPE = "duplicate-review";

type DurableCandidate = { contactId: number; signals?: string[] };
type ReviewItem = { row: ImportSessionRow; item: CandidateItem };

function incomingName(row: ImportSessionRow): string {
  try {
    const parsed = JSON.parse(row.sourcePayload) as {
      displayName?: string | null;
    };
    return parsed.displayName?.trim() || "Unnamed contact";
  } catch {
    return "Unnamed contact";
  }
}

function evidenceHint(candidate: DurableCandidate | undefined): string {
  const signals = candidate?.signals ?? [];
  if (signals.includes("phoneMatch")) return "Matching phone number";
  if (signals.includes("emailMatch")) return "Matching email address";
  if (signals.includes("nameOverlap")) return "Similar name";
  return "Needs a closer look";
}

async function choicesForRow(
  row: ImportSessionRow,
): Promise<CandidateChoice[]> {
  const candidates = row.candidates.filter(
    (candidate): candidate is DurableCandidate =>
      typeof candidate === "object" &&
      candidate !== null &&
      typeof (candidate as DurableCandidate).contactId === "number",
  );
  const exec = getExecutor();
  const resolved = await resolveExistingContactChoices(candidates, (id) =>
    getContactHeader(exec, id),
  );
  return resolved.map((candidate) => ({
    contactId: candidate.contactId,
    name: candidate.name,
    photo: candidate.photo,
    evidenceHint: evidenceHint(candidate),
  }));
}

export function DuplicateReviewScreen({
  navigation,
  route,
}: RootStackScreenProps<"DuplicateReview">) {
  useOpenImportSession(route.params.sessionId);
  const { colors } = useTheme();
  const [session, setSession] = useState<ImportSession | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [linkQueue, setLinkQueue] = useState<ReviewItem[]>([]);
  const [currentLink, setCurrentLink] = useState<ReviewItem | null>(null);
  // 38.3 review B-WR-02 (D-04): one synchronous latch over every resolve write.
  // A same-tick double tap on a link choice otherwise ran the link twice: the
  // second hit the external-link UNIQUE index and showed "Couldn't link" over
  // the NEXT row for a link that committed, or advanced the queue twice.
  const writeInFlight = useRef(false);
  const [writing, setWriting] = useState(false);
  const runLatchedWrite = useCallback(
    (work: () => Promise<unknown>) =>
      runSingleFlight(writeInFlight, async () => {
        setWriting(true);
        try {
          await work();
        } finally {
          setWriting(false);
        }
      }),
    [],
  );

  const refresh = useCallback(async () => {
    const exec = getExecutor();
    const [nextSession, rows] = await Promise.all([
      getSessionById(exec, route.params.sessionId),
      listSessionRows(exec, route.params.sessionId),
    ]);
    if (!nextSession) throw new Error("import session is unavailable");
    const needsReview = rows.filter((row) => row.rowStatus === "needs_review");
    const nextItems = await Promise.all(
      needsReview.map(async (row) => {
        const candidates = await choicesForRow(row);
        const firstCandidate = row.candidates.find(
          (candidate): candidate is DurableCandidate =>
            typeof candidate === "object" &&
            candidate !== null &&
            typeof (candidate as DurableCandidate).contactId === "number",
        );
        return {
          row,
          item: {
            id: row.id,
            name: incomingName(row),
            outcome: row.matchOutcome ?? "needs_review",
            evidenceHint: evidenceHint(firstCandidate),
            photoUri: row.photoRelPath
              ? resolveImportStagingUri(row.photoRelPath)
              : null,
            candidates,
          },
        } satisfies ReviewItem;
      }),
    );
    setSession(nextSession);
    setReviewItems(nextItems);
    const counts = await sessionRowCounts(exec, route.params.sessionId);
    if (counts.needs_review === 0 && counts.pending === 0) {
      navigation.replace("ImportComplete", {
        sessionId: route.params.sessionId,
      });
    }
  }, [navigation, route.params.sessionId]);

  // Read-only: a successful read clears the error; a failed one never falls
  // through to "Nothing to review" (RG-035, D-24).
  const reread = useCallback(async () => {
    await refresh();
    setLoadError(false);
  }, [refresh]);

  const onReadError = useCallback((error: unknown) => {
    Logger.error(LOG_SCOPE, "failed to load duplicate review", error);
    setLoadError(true);
  }, []);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    try {
      await reread();
    } catch (error) {
      onReadError(error);
    } finally {
      setLoading(false);
    }
  }, [onReadError, reread]);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  async function finalizeSession() {
    await finalizeSessionIfTerminal(
      getExecutor(),
      route.params.sessionId,
      localDateTime(),
    );
  }

  /**
   * Resolves the given rows. "link" only opens MatchChoiceSheet over them
   * (the latched link write is `chooseLink`, A-2); "import-new" and "skip"
   * run one latched write over every row (ADR-168). Resolves true when the
   * write ran and no row failed, so the sheet can confirm one person.
   */
  async function resolveAction(
    action: BulkAction,
    items: CandidateItem[],
  ): Promise<boolean> {
    const selected = reviewItems.filter((entry) =>
      items.some((item) => item.id === entry.item.id),
    );
    if (action === "link") {
      setCurrentLink(selected[0] ?? null);
      setLinkQueue(selected.slice(1));
      return true;
    }
    if (!session) return false;
    let importedAny = false;
    // Per-row failures are collected and shown as ONE snackbar after the
    // loop (38.9 D-27), never one dialog per failing row.
    const failures: string[] = [];
    // Only a row's own write can fail its resolve; the trailing finalize and
    // re-read go to the read error + read-only Retry (D-04).
    const ran = await runLatchedWrite(() =>
      runBulkResolveThenRecover({
        entries: selected,
        writeOne: async (entry) => {
          const now = localDateTime();
          if (action === "import-new") {
            const result = await importRowAsNew(getExecutor(), {
              row: entry.row,
              batchCategoryId: session.batchCategoryId,
              lifecycle: sessionBatchLifecycle(session),
              phoneRegion: session.phoneRegion,
              now,
            });
            if (result.contactId !== null) importedAny = true;
            if (result.skipped === "name-required") {
              failures.push(
                "Couldn't import — no name. Add a name before importing.",
              );
            }
          } else if (action === "skip") {
            await markRowStatus(
              getExecutor(),
              entry.row.id,
              "skipped",
              null,
              now,
            );
          }
        },
        onRowError: (entry, error) => {
          Logger.error(
            LOG_SCOPE,
            `could not resolve row ${entry.row.id}`,
            error,
          );
          failures.push(
            "Couldn't resolve this contact. The other selected contacts are still available.",
          );
        },
        finalize: finalizeSession,
        reread,
        onRecoveryError: onReadError,
      }),
    );
    const failureLabel = bulkResolveFailureLabel(failures);
    if (failureLabel) showSnackbar({ kind: "error", label: failureLabel });
    // D-57: a Bound batch's Import as new refreshes reminders and the widget
    // once, post-commit and best-effort (the helper never rejects).
    if (
      action === "import-new" &&
      importedAny &&
      sessionBatchLifecycle(session).trackingEnabled
    ) {
      void applyBoundImportEffects(getExecutor());
    }
    return ran && failures.length === 0;
  }

  async function chooseLink(choice: CandidateChoice) {
    if (!currentLink) return;
    const linking = currentLink;
    const next = linkQueue[0] ?? null;
    // "Please choose again" only when the link write itself rejected. Once it
    // commits the queue advances; finalize/re-read failures become the read
    // error with a read-only Retry, never a prompt to redo the link (D-04).
    await runLatchedWrite(() =>
      runResolveThenRecover({
        write: () =>
          linkExistingContactToRow(getExecutor(), {
            rowId: linking.row.id,
            contactId: choice.contactId,
            provider: "android",
            externalContactId: linking.row.externalContactId,
            matchOutcome: linking.row.matchOutcome,
            now: localDateTime(),
          }),
        onWriteError: (error) => {
          Logger.error(LOG_SCOPE, "could not link candidate", error);
          showSnackbar({
            kind: "error",
            label: "Couldn't link this contact. Please choose again.",
          });
        },
        onWritten: () => {
          // D-107 / D-04: confirmed only once the link has committed.
          showSnackbar({
            kind: "success",
            label: `Linked ${linking.item.name} to ${choice.name}`,
          });
          setCurrentLink(next);
          setLinkQueue((queue) => queue.slice(1));
        },
        finalize: finalizeSession,
        reread: next ? async () => undefined : reread,
        onRecoveryError: onReadError,
      }),
    );
  }

  /**
   * MatchChoiceSheet's Import as new / Skip settle the shown person through
   * the same latched `resolveAction` (D-51), confirm with a snackbar only
   * when that row's write did not fail, then advance to the next queued
   * person or close.
   */
  async function settleCurrent(action: "import-new" | "skip") {
    if (!currentLink) return;
    const settling = currentLink;
    const ok = await resolveAction(action, [settling.item]);
    if (!ok) return;
    showSnackbar({
      kind: "success",
      label:
        action === "import-new"
          ? `Imported ${settling.item.name}`
          : `Skipped ${settling.item.name}`,
    });
    setCurrentLink(linkQueue[0] ?? null);
    setLinkQueue((queue) => queue.slice(1));
  }

  /**
   * Cancel, scrim and Back (D-52): close the sheet AND drop any pending
   * queue, so a later tap never resumes a stale bulk link. Held while a write
   * is in flight; that write's own advance would otherwise reopen the sheet
   * after the close (T-38.12-19).
   */
  function closeSheet() {
    if (writeInFlight.current) return;
    setCurrentLink(null);
    setLinkQueue([]);
  }

  const view = duplicateReviewView({
    loading,
    loadError,
    itemCount: reviewItems.length,
  });

  const currentChoices = currentLink?.item.candidates ?? [];
  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Review matches" />
      {view === "loading" ? (
        <ReviewMatchesList
          items={[]}
          bulkActions={[]}
          onInspect={() => {}}
          onBulkAction={() => {}}
          loading
        />
      ) : view === "error" ? (
        <View testID="duplicate-review-error" style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            Couldn't load matches
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            Contacts you already resolved are saved.
          </Text>
          <Pressable
            testID="duplicate-review-retry"
            accessibilityRole="button"
            accessibilityLabel="Retry loading matches"
            onPress={() => void loadMatches()}
            style={[styles.retry, { borderColor: colors.accent }]}
          >
            <Text style={{ color: colors.accentText }}>Retry</Text>
          </Pressable>
        </View>
      ) : view === "empty" ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            Nothing to review
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            All picked contacts were imported.
          </Text>
        </View>
      ) : (
        <ReviewMatchesList
          items={reviewItems.map((entry) => entry.item)}
          bulkActions={["link", "import-new", "skip"]}
          onInspect={(item) => {
            // D-51: a single tap settles that one person, with no queue.
            const entry = reviewItems.find(
              (candidate) => candidate.item.id === item.id,
            );
            if (!entry) return;
            setCurrentLink(entry);
            setLinkQueue([]);
          }}
          onBulkAction={async (action, items) => {
            await resolveAction(action, items);
          }}
        />
      )}
      <MatchChoiceSheet
        visible={currentLink !== null}
        entryKey={currentLink?.item.id ?? null}
        personName={currentLink?.item.name ?? ""}
        choices={currentChoices}
        writing={writing}
        onLink={(choice) => void chooseLink(choice)}
        onImportNew={() => void settleCurrent("import-new")}
        onSkip={() => void settleCurrent("skip")}
        onClose={closeSheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: { alignItems: "center", gap: 8, marginTop: 24, padding: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  retry: {
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 16,
  },
});
