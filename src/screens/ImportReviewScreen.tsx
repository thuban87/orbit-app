import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import { BirthdayField } from "@/components/BirthdayField";
import {
  type BirthdayFieldState,
  birthdayFieldStateFromStored,
  birthdayStorage,
  EMPTY_BIRTHDAY_FIELD_STATE,
} from "@/components/birthday-field-logic";
import { ContactMethodsEditor } from "@/components/ContactMethodsEditor";
import { CategoryChoiceSheet } from "@/components/category/CategoryChoiceSheet";
import {
  addMethodDraft,
  choosePrimary,
  importedMethodDraft,
  type MethodGroups,
  removeMethodDraft,
  resolveEffectivePhoneRegion,
  toMethodDrafts,
  updateMethodDraft,
} from "@/components/contact-methods-editor-model";
import { LinkExistingChoiceButton } from "@/components/ExistingContactChoice";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import { ShellAppBar } from "@/components/ShellAppBar";
import { OptionSelectRow } from "@/components/ui";
import { RegisteredModal } from "@/components/ui/RegisteredModal";
import { getAppSettings } from "@/db/app-settings-dao";
import { getContactHeader, listCategories } from "@/db/contact-read";
import { getExecutor, localDateTime } from "@/db/database";
import {
  finalizeSessionIfTerminal,
  markRowStatus,
  resolveAlreadyLinked,
} from "@/db/import-session-dao";
import { getSessionById, listSessionRows } from "@/db/import-session-read";
import { linkExistingContactToRow } from "@/db/imported-contact-dao";
import { newUid } from "@/db/uid";
import { useCategoryCatalogRefresh } from "@/hooks/use-category-catalog-refresh";
import { resolveCategorySelection } from "@/logic/category-logic";
import {
  isBirthdayUnreadable,
  mapPickedContact,
} from "@/logic/picked-contact-map";
import { useBackActsAsDone } from "@/navigation/back-acts-as-done";
import {
  DEFAULT_FLOW_HOST,
  finishFlow,
  openBinFromFlow,
  openContactFromFlow,
} from "@/navigation/flow-host";
import type { RootStackScreenProps } from "@/navigation/types";
import { getDeviceRegion } from "@/services/device-region";
import {
  type DuplicateEvidenceCandidate,
  type DuplicateOutcome,
  scoreImportCandidate,
} from "@/services/import/duplicate-evidence";
import { commitSingleImport } from "@/services/import/import-acquire";
import { resolveImportStagingUri } from "@/services/photos/photo-storage";
import { notice } from "@/stores/confirm-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { FREQUENCY_DAYS } from "@/types";
import { Logger } from "@/utils/logger";
import { boundFrequencyBlocksImport } from "./bulk-import-setup-logic";
import { resolveExistingContactChoices } from "./existing-contact-choices";
import {
  type AlreadyLinkedReview,
  ImportReviewAlreadyLinked,
  resolveAlreadyLinkedReview,
} from "./ImportReviewAlreadyLinked";
import { useImportLeaveGuard } from "./use-import-leave-guard";
import { useOpenImportSession } from "./use-open-import-session";

const LOG_SCOPE = "import-review";

type Snapshot = {
  displayName: string | null;
  /** The bridge's raw TYPE code and custom label ride along (D-102, D-161). */
  methods: Array<{
    type: "phone" | "email";
    value: string;
    typeCode?: number | null;
    customLabel?: string | null;
  }>;
  birthday: string | null;
};

type DuplicateChoice = DuplicateEvidenceCandidate & {
  name: string;
  /** The existing contact's stored RELATIVE photo path (38.6 D-25 F-1). */
  photo: string | null;
};

function parseSnapshot(value: string): Snapshot | null {
  try {
    const parsed = JSON.parse(value) as Snapshot;
    return Array.isArray(parsed.methods) ? parsed : null;
  } catch {
    return null;
  }
}

export function ImportReviewScreen({
  navigation,
  route,
}: RootStackScreenProps<"ImportReview">) {
  useOpenImportSession(route.params.sessionId);
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowId, setRowId] = useState<number | null>(null);
  const [externalContactId, setExternalContactId] = useState<string | null>(
    null,
  );
  const [name, setName] = useState("");
  // D-54: the shared Birthday control (Edit Contact's), seeded from the
  // phone's birthday; storage is `birthdayStorage` (MM-DD / YYYY-MM-DD).
  const [birthday, setBirthday] = useState<BirthdayFieldState>(
    EMPTY_BIRTHDAY_FIELD_STATE,
  );
  // The phone's birthday when it could not be read, so the review says so
  // instead of silently dropping it (the control cannot show it).
  const [unreadableBirthday, setUnreadableBirthday] = useState<string | null>(
    null,
  );
  const [photoRelPath, setPhotoRelPath] = useState<string | null>(null);
  const [categories, setCategories] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [intervalDays, setIntervalDays] = useState<number | null>(null);
  // 38.4 review CR-01: the picker never emits an invalid custom entry, so
  // Import is blocked while Bound and the frequency is invalid.
  const [intervalValid, setIntervalValid] = useState(true);
  const [phoneRegion, setPhoneRegion] = useState<string | null>(null);
  // D-54: method warnings use the effective region — the saved override, else
  // the device's (the Settings rule, SettingsContactsScreen).
  const [warningRegion, setWarningRegion] = useState<string | null>(null);
  const [methods, setMethods] = useState<MethodGroups>({
    phone: [],
    email: [],
  });
  const [edited, setEdited] = useState(false);
  const [duplicateChoices, setDuplicateChoices] = useState<DuplicateChoice[]>(
    [],
  );
  const [duplicateOutcome, setDuplicateOutcome] = useState<Exclude<
    DuplicateOutcome,
    "already_linked"
  > | null>(null);
  // 38.12 D-53: an already-linked pick, decided and resolved at load.
  const [alreadyLinked, setAlreadyLinked] =
    useState<AlreadyLinkedReview | null>(null);

  // 38.12 D-110: a single import or link finishes where the import was
  // started (Settings → Contacts & Relationships by default), with a View
  // action that opens the person's Contacts-tab Profile (D-04 copy).
  const host = route.params.host ?? DEFAULT_FLOW_HOST;
  const finishWithView = (
    label: string,
    contactId: number,
    personName: string,
  ) => {
    finishFlow(navigation, host);
    showSnackbar({
      kind: "success",
      label,
      action: {
        label: "View",
        accessibilityLabel: `View ${personName}`,
        onPress: () => openContactFromFlow(navigation, host, contactId),
      },
    });
  };

  const markImportComplete = useImportLeaveGuard(
    navigation,
    route.params.sessionId,
    edited,
  );

  const commitCategories = useCallback(
    (current: Array<{ id: number; name: string }>) => {
      setCategories(current);
      setCategoryId((selected) => resolveCategorySelection(current, selected));
    },
    [],
  );
  const requestInitialCategories = useCategoryCatalogRefresh(commitCategories);

  const load = useCallback(async () => {
    try {
      const exec = getExecutor();
      const [rows, settings, session] = await Promise.all([
        listSessionRows(exec, route.params.sessionId),
        getAppSettings(exec),
        getSessionById(exec, route.params.sessionId),
      ]);
      if (!session) throw new Error("import session is unavailable");
      const row = rows.find((candidate) => candidate.contactId === null);
      if (!row) {
        // Neutral info, then leave (38.9 D-27; success kind = neutral).
        showSnackbar({
          kind: "success",
          label: "Import unavailable. This contact has already been handled.",
        });
        navigation.goBack();
        return;
      }
      // D-53: an already-linked pick shows "Already in Orbit as <name>" with
      // Open (ImportReviewAlreadyLinked), never an editable form. The row is
      // resolved and the session finalized here, so no paused import is left.
      const linked = await resolveAlreadyLinkedReview(exec, {
        sessionId: route.params.sessionId,
        rowId: row.id,
        externalContactId: row.externalContactId,
        now: localDateTime(),
      });
      if (linked) {
        markImportComplete();
        setAlreadyLinked(linked);
        return;
      }
      const snapshot = parseSnapshot(row.sourcePayload);
      if (!snapshot) throw new Error("invalid import snapshot");
      const effectiveRegion = resolveEffectivePhoneRegion(
        settings.phoneRegionOverride,
        getDeviceRegion(),
      );
      const mapped = mapPickedContact(
        {
          lookupKey: row.externalContactId,
          displayName: snapshot.displayName,
          methods: snapshot.methods,
          birthday: snapshot.birthday,
          photoTempUri: null,
        },
        {
          categoryId: null,
          effectivePhoneRegion: effectiveRegion,
        },
      );
      setRowId(row.id);
      setExternalContactId(row.externalContactId);
      setName(mapped.input.name);
      setBirthday(birthdayFieldStateFromStored(mapped.birthday));
      setUnreadableBirthday(
        isBirthdayUnreadable(snapshot.birthday)
          ? (snapshot.birthday?.trim() ?? null)
          : null,
      );
      setWarningRegion(effectiveRegion);
      setPhotoRelPath(row.photoRelPath);
      setPhoneRegion(session.phoneRegion);
      const methodDrafts = mapped.input.methodDrafts ?? [];
      // D-161: each value keeps the phone's own label (the mapper's, as in
      // Check linked contacts); a value the phone gave no type stays
      // unlabelled, never a forced "Main".
      setMethods({
        phone: methodDrafts
          .filter((method) => method.type === "phone")
          .map((method) => importedMethodDraft(method)),
        email: methodDrafts
          .filter((method) => method.type === "email")
          .map((method) => importedMethodDraft(method)),
      });
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to load import review", error);
      void notice({
        title: "Couldn't load this import",
        message: "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [navigation, route.params.sessionId, markImportComplete]);

  useEffect(() => {
    void load();
    void requestInitialCategories();
  }, [load, requestInitialCategories]);

  const storedBirthday = birthdayStorage(birthday);
  const canImport =
    !loading &&
    !saving &&
    rowId !== null &&
    externalContactId !== null &&
    name.trim().length > 0 &&
    !boundFrequencyBlocksImport(trackingEnabled, intervalValid);
  const previewUri = useMemo(
    () => (photoRelPath ? resolveImportStagingUri(photoRelPath) : null),
    [photoRelPath],
  );

  function makeImportInput(now: string, currentCategoryId: number | null) {
    return {
      uid: newUid(),
      name: name.trim(),
      intervalDays: trackingEnabled
        ? (intervalDays ?? FREQUENCY_DAYS.Monthly)
        : null,
      trackingEnabled,
      now,
      categoryId: currentCategoryId,
      methodDrafts: toMethodDrafts(methods),
      methodNormalization: { effectivePhoneRegion: phoneRegion },
    };
  }

  async function importAsNew() {
    if (rowId === null || externalContactId === null) return;
    const exec = getExecutor();
    const currentCategories = await listCategories(exec);
    const currentCategoryId = resolveCategorySelection(
      currentCategories,
      categoryId,
    );
    setCategories(currentCategories);
    if (currentCategoryId !== categoryId) setCategoryId(currentCategoryId);
    const now = localDateTime();
    const input = makeImportInput(now, currentCategoryId);
    const contactId = await commitSingleImport(exec, {
      sessionId: route.params.sessionId,
      rowId,
      input,
      externalLinks: [{ provider: "android", externalContactId }],
      birthday: storedBirthday,
      now,
    });
    setDuplicateOutcome(null);
    markImportComplete();
    finishWithView(`Imported ${input.name}`, contactId, input.name);
  }

  async function onImport() {
    if (!canImport || rowId === null || externalContactId === null) return;
    setSaving(true);
    try {
      const exec = getExecutor();
      const result = await scoreImportCandidate(exec, {
        externalContactId,
        methodDrafts: toMethodDrafts(methods),
        name: name.trim(),
        birthday: storedBirthday,
        effectivePhoneRegion: phoneRegion,
      });
      const now = localDateTime();
      if (result.outcome === "already_linked") {
        await resolveAlreadyLinked(
          exec,
          rowId,
          result.deterministicContactId,
          now,
          result.inBin,
        );
        await finalizeSessionIfTerminal(exec, route.params.sessionId, now);
        markImportComplete();
        navigation.replace("ImportComplete", {
          sessionId: route.params.sessionId,
          // D-110 (convergence c2 B-1): the flow host travels to ImportComplete.
          host: route.params.host,
        });
        return;
      }
      if (result.outcome === "new" || result.candidates.length === 0) {
        await importAsNew();
        return;
      }
      setDuplicateChoices(
        await resolveExistingContactChoices(result.candidates, (id) =>
          getContactHeader(exec, id),
        ),
      );
      setDuplicateOutcome(result.outcome);
    } catch (error) {
      // Only creation failures reach here (D-58, convergence c1 C-6): once the
      // contact is created, commitSingleImport absorbs a finalize failure,
      // still runs the lifecycle effects and returns the id, so a created
      // contact always takes the success ending above.
      Logger.error(LOG_SCOPE, "failed to commit import", error);
      showSnackbar({
        kind: "error",
        label: "Couldn't import contact. Please check the name and try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function linkToExisting(choice: DuplicateChoice) {
    if (rowId === null || externalContactId === null || !duplicateOutcome)
      return;
    setSaving(true);
    try {
      const now = localDateTime();
      await linkExistingContactToRow(getExecutor(), {
        rowId,
        contactId: choice.contactId,
        provider: "android",
        externalContactId,
        matchOutcome: duplicateOutcome,
        now,
      });
      await finalizeSessionIfTerminal(
        getExecutor(),
        route.params.sessionId,
        now,
      );
      setDuplicateOutcome(null);
      markImportComplete();
      const phoneName = name.trim();
      finishWithView(
        phoneName === ""
          ? `Linked to ${choice.name}`
          : `Linked ${phoneName} to ${choice.name}`,
        choice.contactId,
        choice.name,
      );
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to link duplicate", error);
      showSnackbar({
        kind: "error",
        label: "Couldn't link contact. Please choose again.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function skipDuplicate() {
    if (rowId === null) return;
    setSaving(true);
    try {
      const now = localDateTime();
      await markRowStatus(getExecutor(), rowId, "skipped", null, now);
      await finalizeSessionIfTerminal(
        getExecutor(),
        route.params.sessionId,
        now,
      );
      setDuplicateOutcome(null);
      markImportComplete();
      navigation.replace("ImportComplete", {
        sessionId: route.params.sessionId,
        // D-110 (convergence c2 B-1): the flow host travels to ImportComplete.
        host: route.params.host,
      });
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to skip duplicate", error);
      showSnackbar({
        kind: "error",
        label: "Couldn't skip contact. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onImportAsNewFromInterrupt() {
    setSaving(true);
    try {
      await importAsNew();
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to import duplicate as new", error);
      showSnackbar({
        kind: "error",
        label: "Couldn't import contact. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  // D-53: Done, header Back and system Back finish the flow where it started.
  const finishAlreadyLinked = useCallback(
    () => finishFlow(navigation, host),
    [navigation, host],
  );
  useBackActsAsDone(finishAlreadyLinked, alreadyLinked !== null);
  if (alreadyLinked) {
    return (
      <ImportReviewAlreadyLinked
        name={alreadyLinked.name}
        inBin={alreadyLinked.inBin}
        onOpen={() =>
          openContactFromFlow(navigation, host, alreadyLinked.contactId)
        }
        // D-155 (ADR-018): no Restore outside the Bin list; this opens it,
        // with the binned Profile banner's pattern adapted to the flow host.
        onOpenBin={() => openBinFromFlow(navigation, host)}
        onDone={finishAlreadyLinked}
      />
    );
  }

  // The shared header's Back calls goBack(), which the import leave guard
  // intercepts (beforeRemove) exactly as before (38.9 D-16).
  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Review import" />
      <ScrollView contentContainerStyle={styles.content}>
        {previewUri ? (
          <Image
            source={{ uri: previewUri }}
            contentFit="cover"
            style={styles.photo}
            onError={() => setPhotoRelPath(null)}
          />
        ) : (
          <Avatar photo={null} name={name} size={96} />
        )}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Name
          </Text>
          <TextInput
            value={name}
            onChangeText={(value) => {
              setEdited(true);
              setName(value);
            }}
            placeholder="Their name"
            placeholderTextColor={colors.textPlaceholder}
            style={[
              styles.input,
              {
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          />
        </View>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Orbit participation
          </Text>
          {/* 38.4 review Lane C WR-03: D-57 made this choice decide reminders,
            so TalkBack hears it as a radio group with the selected option, as
            on bulk setup (Plan 21). */}
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Orbit participation"
            style={styles.lifecycle}
          >
            {([true, false] as const).map((enabled) => {
              const selected = trackingEnabled === enabled;
              const label = enabled ? "Bound" : "Unbound";
              return (
                <Pressable
                  key={String(enabled)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  accessibilityLabel={label}
                  onPress={() => {
                    setEdited(true);
                    setTrackingEnabled(enabled);
                    // Unbound hides the picker; its last validity no longer applies.
                    if (!enabled) setIntervalValid(true);
                  }}
                  style={[
                    styles.choice,
                    {
                      backgroundColor: selected
                        ? colors.accent
                        : colors.surface,
                      borderColor: selected ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selected ? colors.onAccent : colors.textPrimary,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Category
          </Text>
          <OptionSelectRow
            label="Category"
            currentLabel={
              categories.find((row) => row.id === categoryId)?.name ??
              "Uncategorized"
            }
            onPress={() => setCategorySheetOpen(true)}
          />
          <CategoryChoiceSheet
            visible={categorySheetOpen}
            categories={categories}
            selectedId={categoryId}
            onSelect={(value) => {
              setEdited(true);
              setCategoryId(value);
            }}
            onRequestClose={() => setCategorySheetOpen(false)}
          />
        </View>
        {trackingEnabled ? (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Frequency
            </Text>
            <FrequencyPicker
              value={intervalDays ?? FREQUENCY_DAYS.Monthly}
              onChange={(value) => {
                setEdited(true);
                setIntervalDays(value);
              }}
              onValidityChange={setIntervalValid}
            />
          </View>
        ) : null}
        <View style={styles.field}>
          <ContactMethodsEditor
            methods={methods}
            onAdd={(type) => {
              setEdited(true);
              setMethods((current) => addMethodDraft(current, type, newUid()));
            }}
            onUpdate={(uid, patch) => {
              setEdited(true);
              // D-54: the warning follows the typing, against the effective
              // region (as on Edit Contact).
              setMethods((current) =>
                updateMethodDraft(current, uid, patch, warningRegion),
              );
            }}
            onRemove={(uid) => {
              setEdited(true);
              setMethods((current) => removeMethodDraft(current, uid));
            }}
            onChoosePrimary={(uid) => {
              setEdited(true);
              setMethods((current) => choosePrimary(current, uid));
            }}
          />
        </View>
        {/* D-54: Edit Contact's Birthday control, never a free text field.
          Storage stays MM-DD when the year is unknown, YYYY-MM-DD when known. */}
        <View style={styles.field}>
          <BirthdayField
            testID="import-review-birthday"
            value={birthday}
            onChange={(next) => {
              setEdited(true);
              setBirthday(next);
              setUnreadableBirthday(null);
            }}
          />
          {unreadableBirthday !== null && birthday.input === null ? (
            <Text
              testID="import-review-birthday-unreadable"
              style={[styles.birthdayHint, { color: colors.textSecondary }]}
            >
              {`The phone's birthday (${unreadableBirthday}) couldn't be read. Set it here if you know it.`}
            </Text>
          ) : null}
        </View>
        <Pressable
          testID="import-review-import"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canImport }}
          disabled={!canImport}
          onPress={() => void onImport()}
          style={[
            styles.import,
            {
              backgroundColor: canImport ? colors.accent : colors.surface,
              borderColor: canImport ? colors.accent : colors.border,
            },
          ]}
        >
          <Text
            style={{
              color: canImport ? colors.onAccent : colors.textSecondary,
              fontWeight: "600",
            }}
          >
            Import
          </Text>
        </Pressable>
        <RegisteredModal
          visible={duplicateOutcome !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setDuplicateOutcome(null)}
        >
          <View style={styles.modalRoot}>
            <View
              style={[
                styles.duplicateSheet,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[styles.duplicateTitle, { color: colors.textPrimary }]}
              >
                We found someone who might already be in Orbit.
              </Text>
              {duplicateChoices.map((choice) => (
                <LinkExistingChoiceButton
                  key={choice.contactId}
                  choice={choice}
                  single={duplicateChoices.length === 1}
                  disabled={saving}
                  onPress={() => void linkToExisting(choice)}
                />
              ))}
              <Pressable
                disabled={saving}
                onPress={() => void onImportAsNewFromInterrupt()}
                style={[
                  styles.duplicateChoice,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <Text style={{ color: colors.textPrimary }}>Import as New</Text>
              </Pressable>
              {duplicateChoices.length > 1 ? (
                <Pressable
                  disabled={saving}
                  onPress={() => void skipDuplicate()}
                  style={[
                    styles.duplicateChoice,
                    { borderColor: colors.border },
                  ]}
                >
                  <Text style={{ color: colors.textSecondary }}>Skip</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </RegisteredModal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 16 },
  photo: { width: 96, height: 96, borderRadius: 48 },
  field: { gap: 8 },
  birthdayHint: { fontSize: 13 },
  label: { fontSize: 13, fontWeight: "600" },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  lifecycle: { flexDirection: "row", gap: 8 },
  choice: {
    minHeight: 44,
    minWidth: 96,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
  },
  import: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
  },
  modalRoot: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  duplicateSheet: { borderRadius: 12, borderWidth: 1, gap: 8, padding: 16 },
  duplicateTitle: { fontSize: 18, fontWeight: "700" },
  duplicateChoice: {
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    justifyContent: "center",
    minHeight: 44,
    padding: 12,
  },
});
