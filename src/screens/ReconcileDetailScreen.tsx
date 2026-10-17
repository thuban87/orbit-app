import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  FieldChoiceGroup,
  type FieldChoiceOption,
} from "@/components/FieldChoiceGroup";
import { KEEP_ORBIT_PHOTO, PhotoChoice } from "@/components/PhotoChoice";
import { ShellAppBar } from "@/components/ShellAppBar";
import { getAppSettings } from "@/db/app-settings-dao";
import { setContactPhoto } from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { applyReconcileSelections } from "@/db/reconcile-apply";
import {
  classifyLinkedContact,
  getReconcileContact,
  type LinkedScanLink,
  loadReviewMemory,
  type StagedSourcePhoto,
} from "@/db/reconcile-memory-read";
import {
  relinkExternalSource,
  unlinkExternalSource,
} from "@/db/reconcile-relink-dao";
import {
  finalizeSessionIfTerminal,
  markCardStatusCore,
  setCardCompletionDispositionCore,
} from "@/db/reconcile-session-dao";
import {
  MISSING_SOURCE_KEPT,
  recordReviewedPhoto,
  upsertReviewedSnapshotCore,
} from "@/db/reconcile-snapshot-dao";
import { inWriteTransaction } from "@/db/transaction";
import {
  actionableReconcileFields,
  type ReconcileDiffResult,
  type ReconcileFieldDiff,
} from "@/logic/reconcile-diff";
import {
  buildReconcileSelections,
  type ReconcileChoice,
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
import {
  deleteReconcileStaging,
  resolveReconcileStagingUri,
} from "@/services/photos/photo-storage";
import {
  promoteReconcilePhoto,
  reconcilePhotoFs,
  stageReconcileSourcePhoto,
} from "@/services/photos/reconcile-photo";
import { confirm } from "@/stores/confirm-store";
import { useTheme } from "@/theme";
import { persistentDangerScrim } from "@/theme/danger-scrim";
import { formatStoredBirthdayForDisplay } from "@/utils/dates";
import {
  type PickedContact,
  pickContacts,
  readAllContacts,
} from "../../modules/orbit-contact-picker";

type Choice = ReconcileChoice;
interface ScanState {
  /** The Orbit contact under review — the screen must name the real person. */
  contactName: string;
  /**
   * The contact's current stored RELATIVE photo path, shown on the keep-Orbit
   * photo card beside the phone photo (38.6 D-25 F-3).
   */
  orbitPhoto: string | null;
  diff: ReconcileDiffResult;
  links: LinkedScanLink[];
  /** Active links the provider read did not return (missing source). */
  missingLinkIds: number[];
  /** The region the scan classified with; Apply uses the same one (D-45). */
  effectivePhoneRegion: string | null;
}

/** Per-contact reconciliation detail with a non-destructive missing-source branch. */
export function ReconcileDetailScreen({
  navigation,
  route,
}: RootStackScreenProps<"ReconcileDetail">) {
  const theme = useTheme();
  const { colors } = theme;
  const { contactId, sessionId, cardId } = route.params;
  useEffect(
    () => (sessionId == null ? undefined : markReconcileSessionOpen(sessionId)),
    [sessionId],
  );
  const [scan, setScan] = useState<ScanState | null>(null);
  const [choices, setChoices] = useState<Partial<Record<string, Choice>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [needsContactsAccess, setNeedsContactsAccess] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = useCallback(
    () =>
      withReconcileFlowActive(async () => {
        setScan(null);
        setMessage(null);
        setNeedsContactsAccess(false);
        const exec = getExecutor();
        const { contact, links } = await getReconcileContact(exec, contactId);
        if (!contact || links.length === 0) {
          setMessage("No linked Contacts source is available.");
          return;
        }
        // ADR-003: reconcile reads ContactsContract directly; ensure READ_CONTACTS first (in-context of this tap).
        const access = await ensureReadContactsPermission();
        if (!access.granted) {
          setNeedsContactsAccess(true);
          setMessage(
            access.verdict === "permanent"
              ? "Orbit needs Contacts access to check for changes. Enable it in Settings."
              : "Orbit needs Contacts access to check for changes.",
          );
          return;
        }
        const read = await readAllContacts(
          links.map((link) => link.external_contact_id),
        );
        const pickedByKey = new Map(
          read.contacts.map((picked) => [picked.lookupKey, picked]),
        );
        // Every linked source with a photo gets its own staged copy, so each
        // photo option previews and promotes its own photo (convergence c4 E-4).
        const stagedPhotos = new Map<number, StagedSourcePhoto>();
        try {
          for (const link of links) {
            const photoTempUri = pickedByKey.get(
              link.external_contact_id,
            )?.photoTempUri;
            if (!photoTempUri) continue;
            stagedPhotos.set(
              link.id,
              await stageReconcileSourcePhoto(
                photoTempUri,
                `contact-${contactId}-link-${link.id}`,
              ),
            );
          }
        } finally {
          for (const picked of read.contacts) {
            if (picked.photoTempUri) discardDerivative(picked.photoTempUri);
            if (picked.thumbnailTempUri)
              discardDerivative(picked.thumbnailTempUri);
          }
        }
        // The same memory read as the grid: every active link merged, region
        // override ?? device (D-45).
        const settings = await getAppSettings(exec);
        const memory = await loadReviewMemory(exec, contactId, {
          phoneRegionOverride: settings.phoneRegionOverride,
          deviceRegion: getDeviceRegion(),
        });
        const classified = await classifyLinkedContact(exec, {
          contact,
          links,
          pickedByKey,
          stagedPhotos,
          memory,
        });
        // Reviewed, unchanged fields are never shown (D-45).
        const diff: ReconcileDiffResult = {
          ...classified,
          fields: actionableReconcileFields(classified),
        };
        setChoices(
          Object.fromEntries(
            diff.fields
              .filter((field) => field.outcome !== "conflict")
              .map((field) => [
                field.fieldFamily,
                field.outcome === "additive" && field.sourceOptions[0]
                  ? `source:${field.sourceOptions[0].optionId}`
                  : "orbit",
              ]),
          ),
        );
        if (diff.fields.length === 0) setMessage("No changes from Contacts.");
        setScan({
          contactName: contact.name,
          orbitPhoto: contact.photo,
          diff,
          links,
          missingLinkIds: links
            .filter((link) => !pickedByKey.has(link.external_contact_id))
            .map((link) => link.id),
          effectivePhoneRegion: memory.effectivePhoneRegion,
        });
      }),
    [contactId],
  );
  useFocusEffect(
    useCallback(() => {
      void load().catch(() => setMessage("Could not read Contacts right now."));
    }, [load]),
  );

  const completeMissingSource = useCallback(
    async (rememberKept: boolean) => {
      const exec = getExecutor();
      const now = localDateTime();
      const keptLinkIds = rememberKept ? (scan?.missingLinkIds ?? []) : [];
      const hasCard = cardId != null && sessionId != null;
      if (keptLinkIds.length === 0 && !hasCard) return;
      // Keep as is is remembered ('source' memory, D-45) in the same write
      // transaction as the card's terminal status; the next check does not ask
      // again until the source reads and then disappears again.
      await inWriteTransaction(exec, async () => {
        for (const externalContactLinkId of keptLinkIds)
          await upsertReviewedSnapshotCore(exec, {
            externalContactLinkId,
            fieldFamily: "source",
            reviewedValue: MISSING_SOURCE_KEPT,
            reviewedAt: now,
          });
        if (hasCard)
          await markCardStatusCore(exec, cardId, "missing_source", 0, now);
      });
      if (hasCard) await finalizeSessionIfTerminal(exec, sessionId, now);
    },
    [cardId, sessionId, scan?.missingLinkIds],
  );
  const keepMissingSource = useCallback(async () => {
    setApplying(true);
    try {
      await completeMissingSource(true);
      navigation.goBack();
    } catch {
      setMessage(
        "Could not keep this source state. Your Orbit contact was kept safe.",
      );
    } finally {
      setApplying(false);
    }
  }, [completeMissingSource, navigation]);
  const unlinkMissingSource = useCallback(async () => {
    const staleLink = scan?.links[0];
    if (!staleLink) return;
    setApplying(true);
    try {
      await unlinkExternalSource(getExecutor(), {
        staleLinkId: staleLink.id,
        now: localDateTime(),
      });
      await completeMissingSource(false);
      navigation.goBack();
    } catch {
      setMessage(
        "Could not unlink this source. Your Orbit contact was kept safe.",
      );
    } finally {
      setApplying(false);
    }
  }, [completeMissingSource, navigation, scan?.links]);
  const relinkMissingSource = useCallback(async () => {
    const staleLink = scan?.links[0];
    if (!staleLink) return;
    let selected: PickedContact | undefined;
    try {
      [selected] = await pickContacts({ multiple: false });
      if (!selected) return;
      const result = await relinkExternalSource(getExecutor(), {
        contactId,
        staleLinkId: staleLink.id,
        newProvider: "android",
        newExternalContactId: selected.lookupKey,
        now: localDateTime(),
      });
      if (result.kind === "duplicate-active-link") {
        // Themed, dismissable (38.9 D-27): Cancel and Back both do nothing.
        // Not awaited, so the picked photo is still discarded right away.
        void confirm({
          title: "Source already linked",
          message:
            "That phone contact is already linked to another Orbit contact. Review a merge or explicitly unlink it there first.",
          confirmLabel: "Review merge",
          dismissable: true,
        }).then((review) => {
          if (!review) return;
          navigation.navigate("SurvivorSelect", {
            firstContactId: contactId,
            secondContactId: result.otherContactId,
          });
        });
        return;
      }
      await load();
      setMessage(
        result.kind === "already-active-link"
          ? "That source is already linked here. Review the current check."
          : "Source linked. Review the new contact.",
      );
    } catch {
      setMessage(
        "Could not relink this source. Your Orbit contact was kept safe.",
      );
    } finally {
      if (selected?.photoTempUri) discardDerivative(selected.photoTempUri);
    }
  }, [contactId, load, navigation, scan?.links]);

  const apply = useCallback(async () => {
    if (!scan) return;
    setApplying(true);
    const exec = getExecutor();
    const now = localDateTime();
    try {
      const selections = buildReconcileSelections(scan.diff, choices);
      const result = await inWriteTransaction(exec, () =>
        applyReconcileSelections(exec, {
          contactId,
          now,
          selections,
          effectivePhoneRegion: scan.effectivePhoneRegion,
        }),
      );
      const pendingPhoto = result.pendingPhoto;
      if (pendingPhoto?.stagedPhotoRelative) {
        try {
          const relative = await promoteReconcilePhoto(reconcilePhotoFs, {
            contactId,
            stagedRelative: pendingPhoto.stagedPhotoRelative,
          });
          await setContactPhoto(exec, contactId, relative, now);
          // Remember the reviewed comparable (every phone photo joined), not
          // the chosen photo's hash, so a two-photo source is not re-asked
          // (convergence c4 E-4).
          await recordReviewedPhoto(exec, {
            externalContactLinkIds: pendingPhoto.sourceLinkIds,
            reviewedValue: pendingPhoto.reviewedValue,
            reviewedAt: now,
          });
        } finally {
          deleteReconcileStaging(pendingPhoto.stagedPhotoRelative);
        }
      }
      if (cardId != null && sessionId != null) {
        const remaining = result.staleFields.length;
        await inWriteTransaction(exec, async () => {
          await markCardStatusCore(
            exec,
            cardId,
            remaining === 0
              ? scan.diff.missingSource
                ? "missing_source"
                : "resolved"
              : "partial",
            remaining,
            now,
          );
          // A finished card records how it was completed so Check complete
          // counts it; a partial card does not (D-45).
          if (remaining === 0)
            await setCardCompletionDispositionCore(exec, {
              cardId,
              disposition: selections.some((selection) => selection.useSource)
                ? "updated"
                : "kept-orbit",
              now,
            });
        });
        await finalizeSessionIfTerminal(exec, sessionId, now);
      }
      if (result.staleFields.length) {
        setMessage(
          "Orbit changed while this was open. Review the highlighted fields again.",
        );
        await load();
      } else setMessage("Changes applied.");
    } catch {
      setMessage(
        "Could not apply those changes. Your Orbit contact was kept safe.",
      );
    } finally {
      setApplying(false);
    }
  }, [choices, contactId, load, scan, cardId, sessionId]);

  const unresolved = scan?.diff.fields.some(
    (field) => field.outcome === "conflict" && !choices[field.fieldFamily],
  );
  // Every branch (loading / permission, missing source, main) carries the
  // shared header and its one Back (38.9 D-16, D-07).
  if (!scan)
    return (
      <View style={styles.root}>
        <ShellAppBar variant="child" title="Update from Contacts" />
        <View style={styles.body}>
          {message ? (
            <Text style={{ color: colors.textSecondary }}>{message}</Text>
          ) : (
            <ActivityIndicator color={colors.accentText} />
          )}
          {needsContactsAccess ? (
            <Pressable
              onPress={() => {
                void openContactsSettings();
              }}
              style={[styles.action, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.textPrimary }}>Open Settings</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  if (scan.diff.missingSource)
    return (
      <View style={styles.root}>
        <ShellAppBar variant="child" title="Update from Contacts" />
        <View style={styles.body}>
          <Text style={[styles.subject, { color: colors.textSecondary }]}>
            {scan.contactName}
          </Text>
          <View style={styles.missingSource}>
            <View
              style={[styles.chip, { backgroundColor: colors.surfaceElevated }]}
            >
              <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>
                Source missing
              </Text>
            </View>
            <Text style={[styles.missingBody, { color: colors.textSecondary }]}>
              This linked phone contact is no longer available. Your Orbit
              contact and relationship history stay unchanged.
            </Text>
            <Pressable
              disabled={applying}
              onPress={() => void keepMissingSource()}
              style={[styles.action, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.textPrimary }}>Keep as is</Text>
            </Pressable>
            <Pressable
              disabled={applying}
              onPress={() => void relinkMissingSource()}
              style={[styles.action, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.textPrimary }}>
                Relink to another contact
              </Text>
            </Pressable>
            <Pressable
              disabled={applying}
              onPress={() => void unlinkMissingSource()}
              style={[
                styles.action,
                { borderColor: colors.danger },
                persistentDangerScrim(theme),
              ]}
            >
              <Text style={{ color: colors.danger }}>Unlink source</Text>
            </Pressable>
            {message ? (
              <Text style={{ color: colors.textSecondary }}>{message}</Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Update from Contacts" />
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={[styles.subject, { color: colors.textSecondary }]}>
            {scan.contactName}
          </Text>
          <Pressable
            onPress={() =>
              navigation.navigate("SurvivorSelect", {
                firstContactId: contactId,
              })
            }
          >
            <Text style={{ color: colors.textSecondary }}>
              Merge with another contact
            </Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {scan.diff.fields.map((field) =>
            field.fieldFamily === "photo" ? (
              <PhotoChoice
                key="photo"
                // One option per phone photo, each with its own staged copy
                // (convergence c4 E-4).
                options={field.sourceOptions.map((option) => ({
                  id: `source:${option.optionId}` as const,
                  uri: option.stagedPhotoRelative
                    ? resolveReconcileStagingUri(option.stagedPhotoRelative)
                    : null,
                  name: "Contacts photo",
                  // Name the linked phone contact the photo came from (RG-031).
                  provenance:
                    option.provenanceLabels.join(", ") || "Phone contact",
                }))}
                mode={field.outcome === "conflict" ? "conflict" : "additive"}
                keepPhoto={{
                  photo: scan.orbitPhoto,
                  name: scan.contactName,
                  contactId,
                }}
                selectedId={
                  choices.photo?.startsWith("source:")
                    ? (choices.photo as `source:${string}`)
                    : KEEP_ORBIT_PHOTO
                }
                onChange={(value) =>
                  setChoices((current) => ({
                    ...current,
                    photo: value === KEEP_ORBIT_PHOTO ? "orbit" : value,
                  }))
                }
              />
            ) : (
              <ChoiceRow
                key={field.fieldFamily}
                field={field}
                choice={choices[field.fieldFamily]}
                onChoice={(choice) =>
                  setChoices((current) => ({
                    ...current,
                    [field.fieldFamily]: choice,
                  }))
                }
              />
            ),
          )}
          {message ? (
            <Text style={{ color: colors.textSecondary }}>{message}</Text>
          ) : null}
          <Pressable
            disabled={unresolved || applying}
            onPress={() => void apply()}
            style={[
              styles.apply,
              {
                backgroundColor: colors.accent,
                opacity: unresolved || applying ? 0.5 : 1,
              },
            ]}
          >
            <Text style={{ color: colors.onAccent }}>
              {applying ? "Applying…" : "Apply"}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

function ChoiceRow({
  field,
  choice,
  onChoice,
}: {
  field: ReconcileFieldDiff;
  choice?: Choice;
  onChoice: (choice: Choice) => void;
}) {
  // Render only (38.9 D-70, D-23; review C7-L2): birthday values show their
  // display form; the diff, every option id and `onChoice(option.id)` stay raw.
  // A phone shape the strict gate rejects ("--06-02") stays raw.
  const shown = (value: string): string =>
    field.fieldFamily === "birthday"
      ? formatStoredBirthdayForDisplay(value)
      : value;
  const options: FieldChoiceOption<Choice>[] = [
    {
      id: "orbit",
      value:
        field.orbitBaseline != null
          ? shown(field.orbitBaseline)
          : "Keep Orbit value",
      provenance: "Orbit",
      recommended: field.outcome === "removed-from-source",
    },
    ...field.sourceOptions.map((option) => ({
      id: `source:${option.optionId}` as const,
      value: option.value != null ? shown(option.value) : "Use Contacts value",
      provenance: option.provenanceLabels.join(", ") || "Contacts",
      recommended: field.outcome === "additive",
    })),
  ];
  return (
    <FieldChoiceGroup
      label={
        field.fieldFamily === "phones"
          ? "Phone numbers"
          : field.fieldFamily === "emails"
            ? "Email addresses"
            : field.fieldFamily[0].toUpperCase() + field.fieldFamily.slice(1)
      }
      options={options}
      mode={
        field.outcome === "removed-from-source"
          ? "removed"
          : field.outcome === "conflict"
            ? "conflict"
            : "additive"
      }
      selectedId={choice ?? null}
      onChange={(option) => onChoice(option.id)}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, padding: 16, gap: 16 },
  header: { gap: 10 },
  subject: { fontSize: 18 },
  content: { gap: 16, paddingBottom: 24 },
  apply: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  missingSource: { gap: 16 },
  chip: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipLabel: { fontSize: 13, fontWeight: "600" },
  missingBody: { fontSize: 15, lineHeight: 22 },
  action: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
});
