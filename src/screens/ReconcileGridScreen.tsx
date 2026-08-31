import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CandidateCardGrid, type CandidateItem } from "@/components/CandidateCardGrid";
import { applyReconcileSelections, type ReconcileSelection } from "@/db/reconcile-apply";
import { listContactMethods } from "@/db/contact-methods-dao";
import { getAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import {
  createReconcileSessionCore,
  finalizeSessionIfTerminal,
  insertReconcileCardCore,
  markCardStatusCore,
} from "@/db/reconcile-session-dao";
import {
  getReconcileSessionById,
  listReconcileSessionCards,
  type ReconcileSessionCard,
} from "@/db/reconcile-session-read";
import { getReviewedSnapshots } from "@/db/reconcile-snapshot-dao";
import { inWriteTransaction } from "@/db/transaction";
import { newUid } from "@/db/uid";
import { isAdditiveOnlySelection } from "@/logic/reconcile-bulk-eligibility";
import {
  classifyReconciliation,
  type ReconcileDiffResult,
  type ReconcileFieldDiff,
  type ReconcileSource,
} from "@/logic/reconcile-diff";
import type { RootStackScreenProps } from "@/navigation/types";
import { deleteReconcileStaging } from "@/services/photos/photo-storage";
import { stageReconcileSourcePhoto } from "@/services/photos/reconcile-photo";
import { useTheme } from "@/theme";
import { readAllContacts, type PickedContact } from "../../modules/orbit-contact-picker";

type StoredDiff = ReconcileDiffResult & {
  completionDisposition?: "updated" | "kept-orbit" | null;
};
type GridCard = { card: ReconcileSessionCard; diff: StoredDiff };
type LinkedContact = { id: number; name: string; birthday: string | null; photo: string | null; modified_at: string };
type Link = { id: number; contact_id: number; external_contact_id: string; provider: string };

function parseDiff(value: string): StoredDiff | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || !("fields" in parsed)) return null;
    return parsed as StoredDiff;
  } catch {
    return null;
  }
}

function chipLabel(diff: ReconcileDiffResult): string {
  if (diff.missingSource) return "Source missing";
  if (diff.fields.every((field) => field.outcome === "additive" && field.fieldFamily !== "photo")) return "Add";
  if (diff.fields.every((field) => field.outcome === "removed-from-source")) return "Keep Orbit";
  return "Manual review";
}

function sourceMethods(field: ReconcileFieldDiff) {
  if (field.fieldFamily !== "phones" && field.fieldFamily !== "emails") return undefined;
  return field.sourceOptions.map((option) => ({
    type: field.fieldFamily === "phones" ? ("phone" as const) : ("email" as const),
    value: option.value ?? "",
  }));
}

function selectionsFor(
  action: "apply-recommendation" | "keep-orbit" | "use-contact-values",
  diff: ReconcileDiffResult,
): ReconcileSelection[] {
  return diff.fields
    .filter((field) => {
      if (action === "keep-orbit") return true;
      // Source photo is never bulk-selected. It stays in the card for the
      // explicit PhotoChoice in ReconcileDetailScreen.
      return field.outcome === "additive" && field.fieldFamily !== "photo";
    })
    .map((field) => ({
      fieldFamily: field.fieldFamily,
      baseline: field.orbitBaseline,
      useSource: action !== "keep-orbit",
      sourceValue: field.sourceValue,
      sourceMethods: sourceMethods(field),
      sourceLinkIds: field.sourceOptions.flatMap((option) => option.sourceLinkIds),
      reviewedValue: field.sourceValue,
      stagedPhotoRelative: field.sourceOptions[0]?.stagedPhotoRelative ?? null,
      photoContentHash: field.sourceValue,
    }));
}

function remainingAfter(
  action: "apply-recommendation" | "keep-orbit" | "use-contact-values",
  diff: ReconcileDiffResult,
  staleFields: readonly string[],
): number {
  if (action === "keep-orbit") return staleFields.length;
  return diff.fields.filter(
    (field) =>
      field.fieldFamily === "photo" ||
      field.outcome !== "additive" ||
      staleFields.includes(field.fieldFamily),
  ).length;
}

/** Reused CandidateCardGrid workspace for one durable bulk reconciliation check. */
export function ReconcileGridScreen({ navigation, route }: RootStackScreenProps<"ReconcileGrid">) {
  const { colors } = useTheme();
  const [sessionId, setSessionId] = useState<number | null>(route.params?.sessionId ?? null);
  const [cards, setCards] = useState<GridCard[]>([]);
  const [scoring, setScoring] = useState(route.params?.sessionId == null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshCards = useCallback(async (id: number) => {
    const rows = await listReconcileSessionCards(getExecutor(), id);
    const next = rows.flatMap((card) => {
      const diff = parseDiff(card.diffJson);
      return diff && (card.cardStatus === "unresolved" || card.cardStatus === "partial")
        ? [{ card, diff }]
        : [];
    });
    setCards(next);
    const session = await getReconcileSessionById(getExecutor(), id);
    if (session?.status === "complete" && next.length === 0) {
      navigation.replace("ReconcileComplete", { sessionId: id });
    }
  }, [navigation]);

  const scan = useCallback(async () => {
    const exec = getExecutor();
    setScoring(true); setMessage(null);
    const contacts = await exec.getAllAsync<LinkedContact>(
      `SELECT c.id, c.name, c.birthday, c.photo, c.modified_at
       FROM contacts c
       WHERE c.archived_at IS NULL
         AND EXISTS (SELECT 1 FROM external_contact_links l WHERE l.contact_id = c.id AND l.is_active = 1)
       ORDER BY c.id`,
    );
    const links = await exec.getAllAsync<Link>(
      `SELECT id, contact_id, external_contact_id, provider
       FROM external_contact_links WHERE is_active = 1 ORDER BY contact_id, id`,
    );
    const sourceRead = await readAllContacts(links.map((link) => link.external_contact_id));
    const pickedByKey = new Map(sourceRead.contacts.map((picked) => [picked.lookupKey, picked]));
    const linksByContact = new Map<number, Link[]>();
    for (const link of links) linksByContact.set(link.contact_id, [...(linksByContact.get(link.contact_id) ?? []), link]);
    const settings = await getAppSettings(exec);
    const stagedForCleanup: string[] = [];
    const built: Array<{ contactId: number; diff: StoredDiff; stagedPhotoRelPath: string | null }> = [];
    try {
      for (const contact of contacts) {
        const contactLinks = linksByContact.get(contact.id) ?? [];
        const methods = await listContactMethods(exec, contact.id);
        const pickedLinks = contactLinks.map((link) => ({ link, picked: pickedByKey.get(link.external_contact_id) }));
        const firstPhoto = pickedLinks.find((item): item is { link: Link; picked: PickedContact } => item.picked?.photoTempUri != null);
        let stagedPhotoRelPath: string | null = null;
        let photoContentHash: string | null = null;
        if (firstPhoto?.picked.photoTempUri) {
          // The picker cache URI is consumed only at this durable staging boundary.
          const staged = await stageReconcileSourcePhoto(firstPhoto.picked.photoTempUri, `contact-${contact.id}-link-${firstPhoto.link.id}`);
          stagedPhotoRelPath = staged.stagedRelative;
          photoContentHash = staged.contentHash;
          stagedForCleanup.push(stagedPhotoRelPath);
        }
        const sources: ReconcileSource[] = pickedLinks.flatMap(({ link, picked }) => picked ? [{
          externalContactLinkId: link.id,
          displayName: picked.displayName,
          methods: picked.methods,
          birthday: picked.birthday,
          provenanceLabel: `Contacts (${link.provider})`,
          ...(link.id === firstPhoto?.link.id ? { stagedPhotoRelative: stagedPhotoRelPath, photoContentHash } : {}),
        }] : []);
        const snapshots = await Promise.all(contactLinks.map((link) => getReviewedSnapshots(exec, link.id)));
        const lastReviewed = Object.assign({}, ...snapshots);
        const diff = classifyReconciliation({
          orbit: { name: contact.name, birthday: contact.birthday, photo: contact.photo, methods: methods.map((method) => ({ type: method.method_type, value: method.raw_value, label: method.label })), modifiedAt: contact.modified_at },
          sources,
          lastReviewed,
          omittedCount: pickedLinks.some((item) => !item.picked) ? 1 : 0,
          effectivePhoneRegion: settings.phoneRegionOverride,
        });
        if (diff.fields.length === 0) {
          if (stagedPhotoRelPath) deleteReconcileStaging(stagedPhotoRelPath);
          continue;
        }
        built.push({ contactId: contact.id, diff: { ...diff, completionDisposition: null }, stagedPhotoRelPath });
      }
      const now = localDateTime();
      const id = await inWriteTransaction(exec, async () => {
        const nextSessionId = await createReconcileSessionCore(exec, { uid: newUid(), totalChecked: contacts.length, now });
        for (const entry of built) {
          await insertReconcileCardCore(exec, {
            uid: newUid(), sessionId: nextSessionId, contactId: entry.contactId,
            // Missing sources stay visible for an explicit Keep Orbit/relink
            // decision; `missing_source` is the terminal state after review.
            cardStatus: "unresolved",
            diffJson: JSON.stringify(entry.diff),
            unresolvedCount: entry.diff.missingSource ? 0 : entry.diff.fields.length,
            stagedPhotoRelPath: entry.stagedPhotoRelPath,
            now,
          });
        }
        return nextSessionId;
      });
      await finalizeSessionIfTerminal(exec, id, now);
      setSessionId(id);
      await refreshCards(id);
    } catch (error) {
      for (const relative of stagedForCleanup) deleteReconcileStaging(relative);
      throw error;
    } finally { setScoring(false); }
  }, [refreshCards]);

  useEffect(() => {
    void (route.params?.sessionId != null ? refreshCards(route.params.sessionId) : scan()).catch(() => {
      setMessage("Could not check linked contacts right now."); setScoring(false);
    });
  }, [refreshCards, route.params?.sessionId, scan]);

  useFocusEffect(useCallback(() => {
    if (sessionId !== null) void refreshCards(sessionId).catch(() => setMessage("Could not refresh this check."));
  }, [refreshCards, sessionId]));

  const itemById = useMemo(() => new Map(cards.map((entry) => [entry.card.id, entry])), [cards]);
  const items: CandidateItem[] = cards.map(({ card, diff }) => ({
    id: card.id,
    name: `Contact ${card.contactId}`,
    outcome: "needs_review",
    chipLabel: chipLabel(diff),
    evidenceHint: `${card.unresolvedCount} difference${card.unresolvedCount === 1 ? "" : "s"} left`,
    photoUri: null,
  }));

  const onBulkAction = useCallback(async (action: "apply-recommendation" | "keep-orbit" | "use-contact-values", targets: CandidateItem[]) => {
    const exec = getExecutor(); const now = localDateTime(); const failures: number[] = [];
    for (const target of targets) {
      const entry = itemById.get(Number(target.id)); if (!entry) continue;
      try {
        let removeStaged: string | null = null;
        await inWriteTransaction(exec, async () => {
          const result = await applyReconcileSelections(exec, { contactId: entry.card.contactId, now, selections: selectionsFor(action, entry.diff) });
          const remaining = remainingAfter(action, entry.diff, result.staleFields);
          const status = remaining === 0
            ? (entry.diff.missingSource ? "missing_source" : "resolved")
            : "partial";
          await markCardStatusCore(exec, entry.card.id, status, remaining, now);
          const disposition = action === "keep-orbit" ? "kept-orbit" : "updated";
          await exec.runAsync(
            `UPDATE reconciliation_session_cards
             SET diff_json = json_set(diff_json, '$.completionDisposition', ?),
                 staged_photo_rel_path = CASE WHEN ? = 'resolved' THEN NULL ELSE staged_photo_rel_path END,
                 modified_at = ? WHERE id = ?`,
            [disposition, status, now, entry.card.id],
          );
          if (status === "resolved") removeStaged = entry.card.stagedPhotoRelPath;
        });
        if (removeStaged) deleteReconcileStaging(removeStaged);
      } catch { failures.push(entry.card.id); }
    }
    if (sessionId !== null) {
      await finalizeSessionIfTerminal(exec, sessionId, now);
      await refreshCards(sessionId);
    }
    setMessage(failures.length ? `${failures.length} card${failures.length === 1 ? "" : "s"} could not be applied. Try again.` : null);
  }, [itemById, refreshCards, sessionId]);

  return <View style={[styles.root, { backgroundColor: colors.background }]}>
    <Text style={[styles.title, { color: colors.textPrimary }]}>Check linked contacts</Text>
    {message ? <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text> : null}
    <CandidateCardGrid
      items={items}
      bulkActions={["apply-recommendation", "keep-orbit", "use-contact-values"]}
      recommendationExcludes="needs_review"
      scoring={scoring}
      scoringLabel="Checking linked contacts…"
      isActionEligible={(action, selected) => action !== "use-contact-values" || isAdditiveOnlySelection(selected.flatMap((item) => { const entry = itemById.get(Number(item.id)); return entry ? [entry.diff] : []; }))}
      onInspect={(item) => { const entry = itemById.get(Number(item.id)); if (entry && sessionId !== null) navigation.navigate("ReconcileDetail", { contactId: entry.card.contactId, sessionId, cardId: entry.card.id }); }}
      onBulkAction={(action, selected) => onBulkAction(action as "apply-recommendation" | "keep-orbit" | "use-contact-values", selected)}
    />
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, title: { fontSize: 24, fontWeight: "700", paddingHorizontal: 16, paddingTop: 16 }, message: { fontSize: 14, paddingHorizontal: 16, paddingTop: 8 } });
