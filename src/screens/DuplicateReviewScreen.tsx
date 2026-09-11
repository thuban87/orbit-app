import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
  type BulkAction,
  CandidateCardGrid,
  type CandidateChoice,
  type CandidateItem,
} from "@/components/CandidateCardGrid";
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
  sessionRowCounts,
} from "@/db/import-session-read";
import { linkExistingContactToRow } from "@/db/imported-contact-dao";
import type { RootStackScreenProps } from "@/navigation/types";
import { importRowAsNew } from "@/services/import/import-driver";
import { resolveImportStagingUri } from "@/services/photos/photo-storage";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

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
  const choices: Array<CandidateChoice | null> = await Promise.all(
    candidates.map(async (candidate) => {
      const contact = await getContactHeader(exec, candidate.contactId);
      if (!contact) return null;
      return {
        contactId: contact.id,
        name: contact.name,
        evidenceHint: evidenceHint(candidate),
      };
    }),
  );
  return choices.filter((choice): choice is CandidateChoice => choice !== null);
}

export function DuplicateReviewScreen({
  navigation,
  route,
}: RootStackScreenProps<"DuplicateReview">) {
  const { colors } = useTheme();
  const [session, setSession] = useState<ImportSession | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkQueue, setLinkQueue] = useState<ReviewItem[]>([]);
  const [currentLink, setCurrentLink] = useState<ReviewItem | null>(null);

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

  useEffect(() => {
    void refresh()
      .catch((error) => {
        Logger.error(LOG_SCOPE, "failed to load duplicate review", error);
        Alert.alert("Couldn't load matches", "Please try again.");
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  async function finalizeAndRefresh() {
    await finalizeSessionIfTerminal(
      getExecutor(),
      route.params.sessionId,
      localDateTime(),
    );
    await refresh();
  }

  async function resolveAction(action: BulkAction, items: CandidateItem[]) {
    const selected = reviewItems.filter((entry) =>
      items.some((item) => item.id === entry.item.id),
    );
    if (action === "link") {
      setCurrentLink(selected[0] ?? null);
      setLinkQueue(selected.slice(1));
      return;
    }
    if (!session) return;
    for (const entry of selected) {
      try {
        const now = localDateTime();
        if (action === "import-new") {
          const result = await importRowAsNew(getExecutor(), {
            row: entry.row,
            batchCategoryId: session.batchCategoryId,
            phoneRegion: session.phoneRegion,
            now,
          });
          if (result.skipped === "name-required") {
            Alert.alert("Couldn't import — no name", "Add a name before importing.");
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
      } catch (error) {
        Logger.error(LOG_SCOPE, `could not resolve row ${entry.row.id}`, error);
        Alert.alert(
          "Couldn't resolve this contact",
          "The other selected contacts are still available.",
        );
      }
    }
    await finalizeAndRefresh();
  }

  async function chooseLink(choice: CandidateChoice) {
    if (!currentLink) return;
    try {
      const now = localDateTime();
      await linkExistingContactToRow(getExecutor(), {
        rowId: currentLink.row.id,
        contactId: choice.contactId,
        provider: "android",
        externalContactId: currentLink.row.externalContactId,
        matchOutcome: currentLink.row.matchOutcome,
        now,
      });
      await finalizeSessionIfTerminal(
        getExecutor(),
        route.params.sessionId,
        now,
      );
    } catch (error) {
      Logger.error(LOG_SCOPE, "could not link candidate", error);
      Alert.alert("Couldn't link this contact", "Please choose again.");
      return;
    }
    const next = linkQueue[0] ?? null;
    setCurrentLink(next);
    setLinkQueue((queue) => queue.slice(1));
    if (!next) await refresh();
  }

  const currentChoices = currentLink?.item.candidates ?? [];
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.back, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Review matches
        </Text>
      </View>
      {loading ? (
        <CandidateCardGrid
          items={[]}
          bulkActions={[]}
          onInspect={() => undefined}
          onBulkAction={() => undefined}
          recommendationExcludes="needs_review"
          scoring
        />
      ) : reviewItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            Nothing to review
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            All picked contacts were imported.
          </Text>
        </View>
      ) : (
        <CandidateCardGrid
          items={reviewItems.map((entry) => entry.item)}
          bulkActions={["link", "import-new", "skip"]}
          onInspect={() => undefined}
          onBulkAction={resolveAction}
          recommendationExcludes="needs_review"
        />
      )}
      <Modal
        visible={currentLink !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCurrentLink(null)}
      >
        <View style={styles.modalRoot}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
              Choose an existing contact
            </Text>
            {currentChoices.map((choice) => (
              <Pressable
                key={choice.contactId}
                accessibilityRole="button"
                onPress={() => void chooseLink(choice)}
                style={[styles.choice, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textPrimary }}>{choice.name}</Text>
                <Text style={{ color: colors.textSecondary }}>
                  {choice.evidenceHint}
                </Text>
              </Pressable>
            ))}
            {currentChoices.length === 0 ? (
              <Text style={{ color: colors.textSecondary }}>
                This matching contact is no longer available.
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { alignItems: "center", flexDirection: "row", gap: 12, padding: 16 },
  back: {
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  title: { fontSize: 24, fontWeight: "600" },
  empty: { alignItems: "center", gap: 8, marginTop: 24, padding: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  modalRoot: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  sheet: { borderRadius: 12, borderWidth: 1, gap: 8, padding: 16 },
  sheetTitle: { fontSize: 18, fontWeight: "700" },
  choice: {
    borderWidth: 1,
    borderRadius: 10,
    gap: 4,
    minHeight: 44,
    justifyContent: "center",
    padding: 12,
  },
});
