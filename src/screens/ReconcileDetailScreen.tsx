import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FieldChoiceGroup, type FieldChoiceOption } from "@/components/FieldChoiceGroup";
import { KEEP_ORBIT_PHOTO, PhotoChoice } from "@/components/PhotoChoice";
import { applyReconcileSelections, type ReconcileSelection } from "@/db/reconcile-apply";
import { listContactMethods } from "@/db/contact-methods-dao";
import { setContactPhoto } from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { getReviewedSnapshots, upsertReviewedSnapshotCore } from "@/db/reconcile-snapshot-dao";
import { inWriteTransaction } from "@/db/transaction";
import { classifyReconciliation, type ReconcileDiffResult, type ReconcileFieldDiff, type ReconcileSource } from "@/logic/reconcile-diff";
import type { RootStackScreenProps } from "@/navigation/types";
import { deleteReconcileStaging, resolveReconcileStagingUri } from "@/services/photos/photo-storage";
import { promoteReconcilePhoto, reconcilePhotoFs, stageReconcileSourcePhoto } from "@/services/photos/reconcile-photo";
import { readAllContacts, type PickedContact } from "../../modules/orbit-contact-picker";
import { useTheme } from "@/theme";

type Choice = "orbit" | "source";
interface ScanState { diff: ReconcileDiffResult; sourcePhotoUri: string | null; }

/** Per-contact thin reconciliation flow. Durable card-status wiring arrives with the grid. */
export function ReconcileDetailScreen({ navigation, route }: RootStackScreenProps<"ReconcileDetail">) {
  const { colors } = useTheme();
  const { contactId } = route.params;
  const [scan, setScan] = useState<ScanState | null>(null);
  const [choices, setChoices] = useState<Partial<Record<string, Choice>>>( {} );
  const [message, setMessage] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setScan(null); setMessage(null);
    const exec = getExecutor();
    const [contact, links, methods] = await Promise.all([
      exec.getFirstAsync<{ name: string; birthday: string | null; photo: string | null; modified_at: string }>("SELECT name, birthday, photo, modified_at FROM contacts WHERE id = ?", [contactId]),
      exec.getAllAsync<{ id: number; external_contact_id: string; provider: string }>("SELECT id, external_contact_id, provider FROM external_contact_links WHERE contact_id = ? AND is_active = 1 ORDER BY id ASC", [contactId]),
      listContactMethods(exec, contactId),
    ]);
    if (!contact || links.length === 0) { setMessage("No linked Contacts source is available."); return; }
    const read = await readAllContacts(links.map((link) => link.external_contact_id));
    const pickedByKey = new Map(read.contacts.map((picked) => [picked.lookupKey, picked]));
    const firstPhoto = links.map((link) => ({ link, picked: pickedByKey.get(link.external_contact_id) })).find((item): item is { link: typeof links[number]; picked: PickedContact } => item.picked?.photoTempUri != null);
    let stagedRelative: string | null = null;
    let photoHash: string | null = null;
    if (firstPhoto?.picked.photoTempUri) {
      // The only picker cache URI hand-off: stage exactly the highest-priority source photo.
      const staged = await stageReconcileSourcePhoto(firstPhoto.picked.photoTempUri, `contact-${contactId}-link-${firstPhoto.link.id}`);
      stagedRelative = staged.stagedRelative;
      photoHash = staged.contentHash;
    }
    const sources: ReconcileSource[] = links.flatMap((link) => {
      const picked = pickedByKey.get(link.external_contact_id);
      if (!picked) return [];
      return [{ externalContactLinkId: link.id, displayName: picked.displayName, methods: picked.methods, birthday: picked.birthday, provenanceLabel: `Contacts (${link.provider})`, ...(link.id === firstPhoto?.link.id ? { stagedPhotoRelative: stagedRelative, photoContentHash: photoHash } : {}) }];
    });
    const snapshots = await Promise.all(links.map((link) => getReviewedSnapshots(exec, link.id)));
    const diff = classifyReconciliation({
      orbit: { name: contact.name, birthday: contact.birthday, photo: contact.photo, methods: methods.map((method) => ({ type: method.method_type, value: method.raw_value, label: method.label })), modifiedAt: contact.modified_at },
      sources,
      lastReviewed: snapshots[0] ?? {},
      omittedCount: read.omittedCount,
    });
    setChoices(Object.fromEntries(diff.fields.filter((field) => field.outcome !== "conflict").map((field) => [field.fieldFamily, field.outcome === "additive" ? "source" : "orbit"])));
    if (diff.fields.length === 0) setMessage("No changes from Contacts.");
    setScan({ diff, sourcePhotoUri: stagedRelative ? resolveReconcileStagingUri(stagedRelative) : null });
  }, [contactId]);
  useFocusEffect(useCallback(() => { void load().catch(() => setMessage("Could not read Contacts right now.")); }, [load]));

  const apply = useCallback(async () => {
    if (!scan) return;
    setApplying(true);
    const exec = getExecutor(); const now = localDateTime();
    try {
      const selections: ReconcileSelection[] = scan.diff.fields.map((field) => ({
        fieldFamily: field.fieldFamily,
        baseline: field.orbitBaseline,
        useSource: choices[field.fieldFamily] === "source",
        sourceValue: field.sourceValue,
        sourceMethods: field.fieldFamily === "phones" || field.fieldFamily === "emails" ? field.sourceOptions.map((option) => ({ type: field.fieldFamily === "phones" ? "phone" as const : "email" as const, value: option.value ?? "" })) : undefined,
        sourceLinkIds: field.sourceOptions.flatMap((option) => option.sourceLinkIds),
        reviewedValue: field.sourceValue,
        stagedPhotoRelative: field.sourceOptions[0]?.stagedPhotoRelative ?? null,
        photoContentHash: field.sourceValue,
      }));
      const result = await inWriteTransaction(exec, () => applyReconcileSelections(exec, { contactId, now, selections }));
      if (result.pendingPhoto?.stagedPhotoRelative) {
        try {
          const relative = await promoteReconcilePhoto(reconcilePhotoFs, { contactId, stagedRelative: result.pendingPhoto.stagedPhotoRelative });
          await setContactPhoto(exec, contactId, relative, now);
          await inWriteTransaction(exec, async () => {
            for (const externalContactLinkId of result.pendingPhoto!.sourceLinkIds) await upsertReviewedSnapshotCore(exec, { externalContactLinkId, fieldFamily: "photo", reviewedValue: result.pendingPhoto!.photoContentHash ?? null, reviewedAt: now });
          });
        } finally { deleteReconcileStaging(result.pendingPhoto.stagedPhotoRelative); }
      }
      if (result.staleFields.length) { setMessage("Orbit changed while this was open. Review the highlighted fields again."); await load(); }
      else { setMessage("Changes applied."); }
    } catch { setMessage("Could not apply those changes. Your Orbit contact was kept safe."); }
    finally { setApplying(false); }
  }, [choices, contactId, load, scan]);

  const unresolved = scan?.diff.fields.some((field) => field.outcome === "conflict" && !choices[field.fieldFamily]);
  if (!scan) return <View style={[styles.root, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.textPrimary }]}>Update from Contacts</Text>{message ? <Text style={{ color: colors.textSecondary }}>{message}</Text> : <ActivityIndicator color={colors.accent} />}</View>;
  return <View style={[styles.root, { backgroundColor: colors.background }]}><View style={styles.header}><Pressable onPress={() => navigation.goBack()}><Text style={{ color: colors.textSecondary }}>Back</Text></Pressable><Text style={[styles.title, { color: colors.textPrimary }]}>Update from Contacts</Text><Pressable onPress={() => navigation.navigate("SurvivorSelect", { firstContactId: contactId })}><Text style={{ color: colors.textSecondary }}>Merge with another contact</Text></Pressable></View><ScrollView contentContainerStyle={styles.content}>{scan.diff.fields.map((field) => field.fieldFamily === "photo" ? <PhotoChoice key="photo" options={[{ id: "source", uri: scan.sourcePhotoUri, name: "Contacts photo", provenance: "Contacts" }]} mode={field.outcome === "conflict" ? "conflict" : "additive"} selectedId={choices.photo === "source" ? "source" : KEEP_ORBIT_PHOTO} onChange={(value) => setChoices((current) => ({ ...current, photo: value === "source" ? "source" : "orbit" }))} /> : <ChoiceRow key={field.fieldFamily} field={field} choice={choices[field.fieldFamily]} onChoice={(choice) => setChoices((current) => ({ ...current, [field.fieldFamily]: choice }))} />)}{message ? <Text style={{ color: colors.textSecondary }}>{message}</Text> : null}<Pressable disabled={unresolved || applying} onPress={() => void apply()} style={[styles.apply, { backgroundColor: colors.accent, opacity: unresolved || applying ? 0.5 : 1 }]}><Text style={{ color: colors.background }}>{applying ? "Applying…" : "Apply"}</Text></Pressable></ScrollView></View>;
}

function ChoiceRow({ field, choice, onChoice }: { field: ReconcileFieldDiff; choice?: Choice; onChoice: (choice: Choice) => void }) {
  const options: FieldChoiceOption<Choice>[] = [{ id: "orbit", value: field.orbitBaseline ?? "Keep Orbit value", provenance: "Orbit", recommended: field.outcome === "removed-from-source" }, ...field.sourceOptions.map((option) => ({ id: "source" as const, value: option.value ?? "Use Contacts value", provenance: option.provenanceLabels.join(", ") || "Contacts", recommended: field.outcome === "additive" }))];
  return <FieldChoiceGroup label={field.fieldFamily === "phones" ? "Phone numbers" : field.fieldFamily === "emails" ? "Email addresses" : field.fieldFamily[0].toUpperCase() + field.fieldFamily.slice(1)} options={options} mode={field.outcome === "removed-from-source" ? "removed" : field.outcome === "conflict" ? "conflict" : "additive"} selectedId={choice ?? null} onChange={(option) => onChoice(option.id)} />;
}

const styles = StyleSheet.create({ root: { flex: 1, padding: 16, gap: 16 }, header: { gap: 10 }, title: { fontSize: 24, fontWeight: "600" }, content: { gap: 16, paddingBottom: 24 }, apply: { minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", padding: 12 } });
