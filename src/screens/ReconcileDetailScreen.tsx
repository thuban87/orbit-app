import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Alert, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FieldChoiceGroup, type FieldChoiceOption } from "@/components/FieldChoiceGroup";
import { KEEP_ORBIT_PHOTO, PhotoChoice } from "@/components/PhotoChoice";
import { applyReconcileSelections, type ReconcileSelection } from "@/db/reconcile-apply";
import { relinkExternalSource, unlinkExternalSource } from "@/db/reconcile-relink-dao";
import { listContactMethods } from "@/db/contact-methods-dao";
import { setContactPhoto } from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { getReviewedSnapshots, upsertReviewedSnapshotCore } from "@/db/reconcile-snapshot-dao";
import { finalizeSessionIfTerminal, markCardStatusCore } from "@/db/reconcile-session-dao";
import { inWriteTransaction } from "@/db/transaction";
import { classifyReconciliation, type ReconcileDiffResult, type ReconcileFieldDiff, type ReconcileSource } from "@/logic/reconcile-diff";
import type { RootStackScreenProps } from "@/navigation/types";
import { deleteReconcileStaging, resolveReconcileStagingUri } from "@/services/photos/photo-storage";
import { promoteReconcilePhoto, reconcilePhotoFs, stageReconcileSourcePhoto } from "@/services/photos/reconcile-photo";
import { useTheme } from "@/theme";
import { ensureReadContactsPermission, openContactsSettings } from "@/services/contacts/use-read-contacts-permission";
import { pickContacts, readAllContacts, type PickedContact } from "../../modules/orbit-contact-picker";

type Choice = "orbit" | "source";
type ActiveLink = { id: number; external_contact_id: string; provider: string };
interface ScanState { diff: ReconcileDiffResult; sourcePhotoUri: string | null; links: ActiveLink[]; }

/** Per-contact reconciliation detail with a non-destructive missing-source branch. */
export function ReconcileDetailScreen({ navigation, route }: RootStackScreenProps<"ReconcileDetail">) {
  const { colors } = useTheme();
  const { contactId, sessionId, cardId } = route.params;
  const [scan, setScan] = useState<ScanState | null>(null);
  const [choices, setChoices] = useState<Partial<Record<string, Choice>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [needsContactsAccess, setNeedsContactsAccess] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setScan(null); setMessage(null); setNeedsContactsAccess(false);
    const exec = getExecutor();
    const [contact, links, methods] = await Promise.all([
      exec.getFirstAsync<{ name: string; birthday: string | null; photo: string | null; modified_at: string }>("SELECT name, birthday, photo, modified_at FROM contacts WHERE id = ?", [contactId]),
      exec.getAllAsync<ActiveLink>("SELECT id, external_contact_id, provider FROM external_contact_links WHERE contact_id = ? AND is_active = 1 ORDER BY id ASC", [contactId]),
      listContactMethods(exec, contactId),
    ]);
    if (!contact || links.length === 0) { setMessage("No linked Contacts source is available."); return; }
    // ADR-003: reconcile reads ContactsContract directly; ensure READ_CONTACTS first (in-context of this tap).
    const access = await ensureReadContactsPermission();
    if (!access.granted) {
      setNeedsContactsAccess(true);
      setMessage(access.verdict === "permanent"
        ? "Orbit needs Contacts access to check for changes. Enable it in Settings."
        : "Orbit needs Contacts access to check for changes.");
      return;
    }
    const read = await readAllContacts(links.map((link) => link.external_contact_id));
    const pickedByKey = new Map(read.contacts.map((picked) => [picked.lookupKey, picked]));
    const firstPhoto = links.map((link) => ({ link, picked: pickedByKey.get(link.external_contact_id) })).find((item): item is { link: ActiveLink; picked: PickedContact } => item.picked?.photoTempUri != null);
    let stagedRelative: string | null = null;
    let photoHash: string | null = null;
    if (firstPhoto?.picked.photoTempUri) {
      const staged = await stageReconcileSourcePhoto(firstPhoto.picked.photoTempUri, `contact-${contactId}-link-${firstPhoto.link.id}`);
      stagedRelative = staged.stagedRelative; photoHash = staged.contentHash;
    }
    const sources: ReconcileSource[] = links.flatMap((link) => {
      const picked = pickedByKey.get(link.external_contact_id);
      return picked ? [{ externalContactLinkId: link.id, displayName: picked.displayName, methods: picked.methods, birthday: picked.birthday, provenanceLabel: `Contacts (${link.provider})`, ...(link.id === firstPhoto?.link.id ? { stagedPhotoRelative: stagedRelative, photoContentHash: photoHash } : {}) }] : [];
    });
    const snapshots = await Promise.all(links.map((link) => getReviewedSnapshots(exec, link.id)));
    const diff = classifyReconciliation({
      orbit: { name: contact.name, birthday: contact.birthday, photo: contact.photo, methods: methods.map((method) => ({ type: method.method_type, value: method.raw_value, label: method.label })), modifiedAt: contact.modified_at },
      sources, lastReviewed: snapshots[0] ?? {}, omittedCount: read.omittedCount,
    });
    setChoices(Object.fromEntries(diff.fields.filter((field) => field.outcome !== "conflict").map((field) => [field.fieldFamily, field.outcome === "additive" ? "source" : "orbit"])));
    if (diff.fields.length === 0) setMessage("No changes from Contacts.");
    setScan({ diff, sourcePhotoUri: stagedRelative ? resolveReconcileStagingUri(stagedRelative) : null, links });
  }, [contactId]);
  useFocusEffect(useCallback(() => { void load().catch(() => setMessage("Could not read Contacts right now.")); }, [load]));

  const completeMissingSource = useCallback(async () => {
    if (cardId != null && sessionId != null) {
      const exec = getExecutor(); const now = localDateTime();
      await inWriteTransaction(exec, () => markCardStatusCore(exec, cardId, "missing_source", 0, now));
      await finalizeSessionIfTerminal(exec, sessionId, now);
    }
  }, [cardId, sessionId]);
  const keepMissingSource = useCallback(async () => {
    setApplying(true);
    try { await completeMissingSource(); navigation.goBack(); }
    catch { setMessage("Could not keep this source state. Your Orbit contact was kept safe."); }
    finally { setApplying(false); }
  }, [completeMissingSource, navigation]);
  const unlinkMissingSource = useCallback(async () => {
    const staleLink = scan?.links[0]; if (!staleLink) return;
    setApplying(true);
    try { await unlinkExternalSource(getExecutor(), { staleLinkId: staleLink.id, now: localDateTime() }); await completeMissingSource(); navigation.goBack(); }
    catch { setMessage("Could not unlink this source. Your Orbit contact was kept safe."); }
    finally { setApplying(false); }
  }, [completeMissingSource, navigation, scan?.links]);
  const relinkMissingSource = useCallback(async () => {
    const staleLink = scan?.links[0]; if (!staleLink) return;
    try {
      const [selected] = await pickContacts({ multiple: false }); if (!selected) return;
      const result = await relinkExternalSource(getExecutor(), { contactId, staleLinkId: staleLink.id, newProvider: "android", newExternalContactId: selected.lookupKey, now: localDateTime() });
      if (result.kind === "duplicate-active-link") {
        Alert.alert("Source already linked", "That phone contact is already linked to another Orbit contact. Review a merge or explicitly unlink it there first.", [{ text: "Cancel", style: "cancel" }, { text: "Review merge", onPress: () => navigation.navigate("SurvivorSelect", { firstContactId: contactId, secondContactId: result.otherContactId }) }]);
        return;
      }
      await load();
      setMessage(result.kind === "already-active-link" ? "That source is already linked here. Review the current check." : "Source linked. Review the new contact.");
    } catch { setMessage("Could not relink this source. Your Orbit contact was kept safe."); }
  }, [contactId, load, navigation, scan?.links]);

  const apply = useCallback(async () => {
    if (!scan) return;
    setApplying(true);
    const exec = getExecutor(); const now = localDateTime();
    try {
      const selections: ReconcileSelection[] = scan.diff.fields.map((field) => ({
        fieldFamily: field.fieldFamily, baseline: field.orbitBaseline, useSource: choices[field.fieldFamily] === "source", sourceValue: field.sourceValue,
        sourceMethods: field.fieldFamily === "phones" || field.fieldFamily === "emails" ? field.sourceOptions.map((option) => ({ type: field.fieldFamily === "phones" ? "phone" as const : "email" as const, value: option.value ?? "" })) : undefined,
        sourceLinkIds: field.sourceOptions.flatMap((option) => option.sourceLinkIds), reviewedValue: field.sourceValue, stagedPhotoRelative: field.sourceOptions[0]?.stagedPhotoRelative ?? null, photoContentHash: field.sourceValue,
      }));
      const result = await inWriteTransaction(exec, () => applyReconcileSelections(exec, { contactId, now, selections }));
      if (result.pendingPhoto?.stagedPhotoRelative) {
        try {
          const relative = await promoteReconcilePhoto(reconcilePhotoFs, { contactId, stagedRelative: result.pendingPhoto.stagedPhotoRelative });
          await setContactPhoto(exec, contactId, relative, now);
          await inWriteTransaction(exec, async () => { for (const externalContactLinkId of result.pendingPhoto!.sourceLinkIds) await upsertReviewedSnapshotCore(exec, { externalContactLinkId, fieldFamily: "photo", reviewedValue: result.pendingPhoto!.photoContentHash ?? null, reviewedAt: now }); });
        } finally { deleteReconcileStaging(result.pendingPhoto.stagedPhotoRelative); }
      }
      if (cardId != null && sessionId != null) {
        const remaining = result.staleFields.length;
        await inWriteTransaction(exec, () => markCardStatusCore(exec, cardId, remaining === 0 ? (scan.diff.missingSource ? "missing_source" : "resolved") : "partial", remaining, now));
        await finalizeSessionIfTerminal(exec, sessionId, now);
      }
      if (result.staleFields.length) { setMessage("Orbit changed while this was open. Review the highlighted fields again."); await load(); }
      else setMessage("Changes applied.");
    } catch { setMessage("Could not apply those changes. Your Orbit contact was kept safe."); }
    finally { setApplying(false); }
  }, [choices, contactId, load, scan, cardId, sessionId]);

  const unresolved = scan?.diff.fields.some((field) => field.outcome === "conflict" && !choices[field.fieldFamily]);
  if (!scan) return <View style={styles.root}><Text style={[styles.title, { color: colors.textPrimary }]}>Update from Contacts</Text>{message ? <Text style={{ color: colors.textSecondary }}>{message}</Text> : <ActivityIndicator color={colors.accent} />}{needsContactsAccess ? <Pressable onPress={() => { void openContactsSettings(); }} style={[styles.action, { borderColor: colors.border }]}><Text style={{ color: colors.textPrimary }}>Open Settings</Text></Pressable> : null}</View>;
  if (scan.diff.missingSource) return <View style={styles.root}><View style={styles.header}><Pressable onPress={() => navigation.goBack()}><Text style={{ color: colors.textSecondary }}>Back</Text></Pressable><Text style={[styles.title, { color: colors.textPrimary }]}>Update from Contacts</Text></View><View style={styles.missingSource}><View style={[styles.chip, { backgroundColor: colors.surfaceElevated }]}><Text style={[styles.chipLabel, { color: colors.textSecondary }]}>Source missing</Text></View><Text style={[styles.missingBody, { color: colors.textSecondary }]}>This linked phone contact is no longer available. Your Orbit contact and relationship history stay unchanged.</Text><Pressable disabled={applying} onPress={() => void keepMissingSource()} style={[styles.action, { borderColor: colors.border }]}><Text style={{ color: colors.textPrimary }}>Keep as is</Text></Pressable><Pressable disabled={applying} onPress={() => void relinkMissingSource()} style={[styles.action, { borderColor: colors.border }]}><Text style={{ color: colors.textPrimary }}>Relink to another contact</Text></Pressable><Pressable disabled={applying} onPress={() => void unlinkMissingSource()} style={[styles.action, { borderColor: colors.danger }]}><Text style={{ color: colors.danger }}>Unlink source</Text></Pressable>{message ? <Text style={{ color: colors.textSecondary }}>{message}</Text> : null}</View></View>;
  return <View style={styles.root}><View style={styles.header}><Pressable onPress={() => navigation.goBack()}><Text style={{ color: colors.textSecondary }}>Back</Text></Pressable><Text style={[styles.title, { color: colors.textPrimary }]}>Update from Contacts</Text><Pressable onPress={() => navigation.navigate("SurvivorSelect", { firstContactId: contactId })}><Text style={{ color: colors.textSecondary }}>Merge with another contact</Text></Pressable></View><ScrollView contentContainerStyle={styles.content}>{scan.diff.fields.map((field) => field.fieldFamily === "photo" ? <PhotoChoice key="photo" options={[{ id: "source", uri: scan.sourcePhotoUri, name: "Contacts photo", provenance: "Contacts" }]} mode={field.outcome === "conflict" ? "conflict" : "additive"} selectedId={choices.photo === "source" ? "source" : KEEP_ORBIT_PHOTO} onChange={(value) => setChoices((current) => ({ ...current, photo: value === "source" ? "source" : "orbit" }))} /> : <ChoiceRow key={field.fieldFamily} field={field} choice={choices[field.fieldFamily]} onChoice={(choice) => setChoices((current) => ({ ...current, [field.fieldFamily]: choice }))} />)}{message ? <Text style={{ color: colors.textSecondary }}>{message}</Text> : null}<Pressable disabled={unresolved || applying} onPress={() => void apply()} style={[styles.apply, { backgroundColor: colors.accent, opacity: unresolved || applying ? 0.5 : 1 }]}><Text style={{ color: colors.background }}>{applying ? "Applying…" : "Apply"}</Text></Pressable></ScrollView></View>;
}

function ChoiceRow({ field, choice, onChoice }: { field: ReconcileFieldDiff; choice?: Choice; onChoice: (choice: Choice) => void }) {
  const options: FieldChoiceOption<Choice>[] = [{ id: "orbit", value: field.orbitBaseline ?? "Keep Orbit value", provenance: "Orbit", recommended: field.outcome === "removed-from-source" }, ...field.sourceOptions.map((option) => ({ id: "source" as const, value: option.value ?? "Use Contacts value", provenance: option.provenanceLabels.join(", ") || "Contacts", recommended: field.outcome === "additive" }))];
  return <FieldChoiceGroup label={field.fieldFamily === "phones" ? "Phone numbers" : field.fieldFamily === "emails" ? "Email addresses" : field.fieldFamily[0].toUpperCase() + field.fieldFamily.slice(1)} options={options} mode={field.outcome === "removed-from-source" ? "removed" : field.outcome === "conflict" ? "conflict" : "additive"} selectedId={choice ?? null} onChange={(option) => onChoice(option.id)} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 16 }, header: { gap: 10 }, title: { fontSize: 24, fontWeight: "600" }, content: { gap: 16, paddingBottom: 24 },
  apply: { minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", padding: 12 }, missingSource: { gap: 16 },
  chip: { alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }, chipLabel: { fontSize: 13, fontWeight: "600" },
  missingBody: { fontSize: 15, lineHeight: 22 }, action: { minHeight: 44, borderWidth: 1, borderRadius: 10, justifyContent: "center", paddingHorizontal: 16 },
});
