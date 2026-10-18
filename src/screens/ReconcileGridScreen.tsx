import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  CandidateCardGrid,
  type CandidateItem,
} from "@/components/CandidateCardGrid";
import { ShellAppBar } from "@/components/ShellAppBar";
import { getAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { applyReconcileSelections } from "@/db/reconcile-apply";
import {
  effectivePhoneRegionFor,
  listLinkedContactsForScan,
  type ReconcileCardDiff,
  type StagedSourcePhoto,
  scanLinkedContacts,
} from "@/db/reconcile-memory-read";
import {
  createReconcileSessionCore,
  finalizeSessionIfTerminal,
  insertReconcileCardCore,
  markCardStatusCore,
  setCardCompletionDispositionCore,
} from "@/db/reconcile-session-dao";
import {
  getReconcileSessionById,
  listReconcileCardIdentities,
  listReconcileSessionCards,
  type ReconcileCardIdentity,
  type ReconcileSessionCard,
} from "@/db/reconcile-session-read";
import { rememberMissingSourceKeptCore } from "@/db/reconcile-snapshot-dao";
import { inWriteTransaction } from "@/db/transaction";
import { newUid } from "@/db/uid";
import { isAdditiveOnlySelection } from "@/logic/reconcile-bulk-eligibility";
import {
  actionableReconcileFields,
  type ReconcileDiffResult,
} from "@/logic/reconcile-diff";
import {
  buildReconcileSelections,
  remainingReconcileFields,
} from "@/logic/reconcile-selection";
import type { RootStackScreenProps } from "@/navigation/types";
import {
  ensureReadContactsPermission,
  openContactsSettings,
} from "@/services/contacts/use-read-contacts-permission";
import { getDeviceRegion } from "@/services/device-region";
import {
  markReconcileSessionOpen,
  withReconcileFlowActive,
} from "@/services/import/reconcile-flow-guard";
import { discardDerivative } from "@/services/photos/derivative-cache";
import { deleteReconcileStaging } from "@/services/photos/photo-storage";
import { gridStagingToken } from "@/services/photos/reconcile-detail-staging";
import { stageReconcileSourcePhoto } from "@/services/photos/reconcile-photo";
import { useTheme } from "@/theme";
import { readAllContacts } from "../../modules/orbit-contact-picker";

type StoredDiff = ReconcileCardDiff & {
  completionDisposition?: "updated" | "kept-orbit" | null;
};
type GridCard = { card: ReconcileSessionCard; diff: StoredDiff };

function parseDiff(value: string): StoredDiff | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || !("fields" in parsed))
      return null;
    return parsed as StoredDiff;
  } catch {
    return null;
  }
}

function chipLabel(diff: ReconcileDiffResult): string {
  if (diff.missingSource) return "Source missing";
  // Reviewed, unchanged fields never shape the chip (D-45).
  const fields = actionableReconcileFields(diff);
  if (
    fields.every(
      (field) => field.outcome === "additive" && field.fieldFamily !== "photo",
    )
  )
    return "Add";
  if (fields.every((field) => field.outcome === "removed-from-source"))
    return "Keep Orbit";
  return "Manual review";
}

/** Reused CandidateCardGrid workspace for one durable bulk reconciliation check. */
export function ReconcileGridScreen({
  navigation,
  route,
}: RootStackScreenProps<"ReconcileGrid">) {
  const { colors } = useTheme();
  const [sessionId, setSessionId] = useState<number | null>(
    route.params?.sessionId ?? null,
  );
  const [cards, setCards] = useState<GridCard[]>([]);
  useEffect(
    () =>
      sessionId === null ? undefined : markReconcileSessionOpen(sessionId),
    [sessionId],
  );
  const [identities, setIdentities] = useState<
    Map<number, ReconcileCardIdentity>
  >(new Map());
  const [scoring, setScoring] = useState(route.params?.sessionId == null);
  const [message, setMessage] = useState<string | null>(null);
  const [needsContactsAccess, setNeedsContactsAccess] = useState(false);

  const refreshCards = useCallback(
    async (id: number) => {
      const rows = await listReconcileSessionCards(getExecutor(), id);
      const next = rows.flatMap((card) => {
        const diff = parseDiff(card.diffJson);
        return diff &&
          (card.cardStatus === "unresolved" || card.cardStatus === "partial")
          ? [{ card, diff }]
          : [];
      });
      setIdentities(
        await listReconcileCardIdentities(
          getExecutor(),
          next.map(({ card }) => card.contactId),
        ),
      );
      setCards(next);
      const session = await getReconcileSessionById(getExecutor(), id);
      if (session?.status === "complete" && next.length === 0) {
        navigation.replace("ReconcileComplete", { sessionId: id });
      }
    },
    [navigation],
  );

  const scan = useCallback(
    () =>
      withReconcileFlowActive(async () => {
        const exec = getExecutor();
        setScoring(true);
        setMessage(null);
        setNeedsContactsAccess(false);
        const linked = await listLinkedContactsForScan(exec);
        const { links } = linked;
        // ADR-003: reconcile reads ContactsContract directly — ensure READ_CONTACTS first.
        if (links.length > 0) {
          const access = await ensureReadContactsPermission();
          if (!access.granted) {
            setNeedsContactsAccess(true);
            setMessage(
              access.verdict === "permanent"
                ? "Orbit needs Contacts access to check linked contacts. Enable it in Settings."
                : "Orbit needs Contacts access to check linked contacts.",
            );
            setScoring(false);
            return;
          }
        }
        const sourceRead = await readAllContacts(
          links.map((link) => link.external_contact_id),
        );
        const pickedByKey = new Map(
          sourceRead.contacts.map((picked) => [picked.lookupKey, picked]),
        );
        const stagedForCleanup: string[] = [];
        try {
          const settings = await getAppSettings(exec);
          // Every linked source with a photo gets its own staged copy and hash
          // (convergence c4 E-4); scanLinkedContacts compares by the picked
          // contact's photoFingerprint when present, else this hash (D-132).
          const stagedPhotos = new Map<number, StagedSourcePhoto>();
          for (const link of links) {
            const photoTempUri = pickedByKey.get(
              link.external_contact_id,
            )?.photoTempUri;
            if (!photoTempUri) continue;
            // The picker cache URI is consumed only at this durable staging boundary.
            const staged = await stageReconcileSourcePhoto(
              photoTempUri,
              gridStagingToken(link.contact_id, link.id),
            );
            stagedForCleanup.push(staged.stagedRelative);
            stagedPhotos.set(link.id, staged);
          }
          const scanned = await scanLinkedContacts(exec, {
            linked,
            picked: sourceRead.contacts,
            stagedPhotos,
            settings: {
              phoneRegionOverride: settings.phoneRegionOverride,
              deviceRegion: getDeviceRegion(),
            },
          });
          const built = scanned.cards.map((card) => ({
            ...card,
            diff: { ...card.diff, completionDisposition: null } as StoredDiff,
          }));
          const now = localDateTime();
          const id = await inWriteTransaction(exec, async () => {
            const nextSessionId = await createReconcileSessionCore(exec, {
              uid: newUid(),
              totalChecked: linked.contacts.length,
              now,
            });
            for (const entry of built) {
              await insertReconcileCardCore(exec, {
                uid: newUid(),
                sessionId: nextSessionId,
                contactId: entry.contactId,
                // Missing sources stay visible for an explicit Keep Orbit/relink
                // decision; `missing_source` is the terminal state after review.
                cardStatus: "unresolved",
                diffJson: JSON.stringify(entry.diff),
                unresolvedCount: entry.unresolvedCount,
                stagedPhotoRelPath: entry.stagedPhotoRelPath,
                now,
              });
            }
            return nextSessionId;
          });
          for (const relative of scanned.discardStaged)
            deleteReconcileStaging(relative);
          await finalizeSessionIfTerminal(exec, id, now);
          setSessionId(id);
          await refreshCards(id);
        } catch (error) {
          for (const relative of stagedForCleanup)
            deleteReconcileStaging(relative);
          throw error;
        } finally {
          for (const picked of sourceRead.contacts) {
            if (picked.photoTempUri) discardDerivative(picked.photoTempUri);
            if (picked.thumbnailTempUri)
              discardDerivative(picked.thumbnailTempUri);
          }
          setScoring(false);
        }
      }),
    [refreshCards],
  );

  useEffect(() => {
    void (
      route.params?.sessionId != null
        ? refreshCards(route.params.sessionId)
        : scan()
    ).catch(() => {
      setMessage("Could not check linked contacts right now.");
      setScoring(false);
    });
  }, [refreshCards, route.params?.sessionId, scan]);

  useFocusEffect(
    useCallback(() => {
      if (sessionId !== null)
        void refreshCards(sessionId).catch(() =>
          setMessage("Could not refresh this check."),
        );
    }, [refreshCards, sessionId]),
  );

  const itemById = useMemo(
    () => new Map(cards.map((entry) => [entry.card.id, entry])),
    [cards],
  );
  const items: CandidateItem[] = cards.map(({ card, diff }) => {
    const identity = identities.get(card.contactId);
    return {
      id: card.id,
      name: identity?.name ?? "Contact no longer in Orbit",
      outcome: "needs_review",
      chipLabel: chipLabel(diff),
      evidenceHint: `${card.unresolvedCount} difference${card.unresolvedCount === 1 ? "" : "s"} left`,
      // Canonical Orbit photo through Avatar (follows the display revision, 38.6 D-01).
      photo: identity?.photo ?? null,
      photoUri: null,
    };
  });

  const onBulkAction = useCallback(
    async (
      action: "apply-recommendation" | "keep-orbit" | "use-contact-values",
      targets: CandidateItem[],
    ) => {
      const exec = getExecutor();
      const now = localDateTime();
      const failures: number[] = [];
      const settings = await getAppSettings(exec);
      // Same region rule as the scan and the detail screen (D-45).
      const effectivePhoneRegion = effectivePhoneRegionFor({
        phoneRegionOverride: settings.phoneRegionOverride,
        deviceRegion: getDeviceRegion(),
      });
      for (const target of targets) {
        const entry = itemById.get(Number(target.id));
        if (!entry) continue;
        // A card stored before D-45 may still carry reviewed, unchanged fields.
        const diff = {
          ...entry.diff,
          fields: actionableReconcileFields(entry.diff),
        };
        try {
          let removeStaged: string | null = null;
          await inWriteTransaction(exec, async () => {
            const result = await applyReconcileSelections(exec, {
              contactId: entry.card.contactId,
              now,
              selections: buildReconcileSelections(diff, action),
              effectivePhoneRegion,
            });
            const remaining = remainingReconcileFields(
              action,
              diff,
              result.staleFields,
            );
            const status =
              remaining === 0
                ? diff.missingSource
                  ? "missing_source"
                  : "resolved"
                : "partial";
            await markCardStatusCore(
              exec,
              entry.card.id,
              status,
              remaining,
              now,
            );
            // Bulk Keep Orbit on a missing-source card keeps it as is: remember
            // that like the detail's Keep as is (D-45).
            if (status === "missing_source" && action === "keep-orbit")
              await rememberMissingSourceKeptCore(exec, {
                externalContactLinkIds: diff.missingLinkIds ?? [],
                now,
              });
            // A partial card is not finished, so it records no disposition (D-45).
            if (status !== "partial")
              await setCardCompletionDispositionCore(exec, {
                cardId: entry.card.id,
                disposition: action === "keep-orbit" ? "kept-orbit" : "updated",
                now,
              });
            if (status === "resolved")
              removeStaged = entry.card.stagedPhotoRelPath;
          });
          if (removeStaged) deleteReconcileStaging(removeStaged);
        } catch {
          failures.push(entry.card.id);
        }
      }
      if (sessionId !== null) {
        await finalizeSessionIfTerminal(exec, sessionId, now);
        await refreshCards(sessionId);
      }
      setMessage(
        failures.length
          ? `${failures.length} card${failures.length === 1 ? "" : "s"} could not be applied. Try again.`
          : null,
      );
    },
    [itemById, refreshCards, sessionId],
  );

  return (
    <View style={styles.root}>
      {/* The shared header and its Back (38.9 D-16). */}
      <ShellAppBar variant="child" title="Check linked contacts" />
      {message ? (
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {message}
        </Text>
      ) : null}
      {needsContactsAccess ? (
        <Pressable
          onPress={() => {
            void openContactsSettings();
          }}
          style={[styles.settingsButton, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textPrimary }}>Open Settings</Text>
        </Pressable>
      ) : null}
      <CandidateCardGrid
        items={items}
        bulkActions={[
          "apply-recommendation",
          "keep-orbit",
          "use-contact-values",
        ]}
        recommendationExcludes="needs_review"
        scoring={scoring}
        scoringLabel="Checking linked contacts…"
        isActionEligible={(action, selected) =>
          action !== "use-contact-values" ||
          isAdditiveOnlySelection(
            selected.flatMap((item) => {
              const entry = itemById.get(Number(item.id));
              return entry
                ? [
                    {
                      ...entry.diff,
                      fields: actionableReconcileFields(entry.diff),
                    },
                  ]
                : [];
            }),
          )
        }
        onInspect={(item) => {
          const entry = itemById.get(Number(item.id));
          if (entry && sessionId !== null)
            navigation.navigate("ReconcileDetail", {
              contactId: entry.card.contactId,
              sessionId,
              cardId: entry.card.id,
            });
        }}
        onBulkAction={(action, selected) =>
          onBulkAction(
            action as
              | "apply-recommendation"
              | "keep-orbit"
              | "use-contact-values",
            selected,
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  message: { fontSize: 14, paddingHorizontal: 16, paddingTop: 8 },
  settingsButton: {
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
});
