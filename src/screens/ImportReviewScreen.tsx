import { Picker } from "@react-native-picker/picker";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import { ContactMethodsEditor } from "@/components/ContactMethodsEditor";
import {
  addMethodDraft,
  choosePrimary,
  type MethodGroups,
  removeMethodDraft,
  toMethodDrafts,
  updateMethodDraft,
} from "@/components/contact-methods-editor-model";
import { FrequencyPicker } from "@/components/FrequencyPicker";
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
import { normalizeEditedBirthday } from "@/logic/birthday-logic";
import { mapPickedContact } from "@/logic/picked-contact-map";
import type { RootStackScreenProps } from "@/navigation/types";
import { getDeviceRegion } from "@/services/device-region";
import {
  type DuplicateEvidenceCandidate,
  type DuplicateOutcome,
  scoreImportCandidate,
} from "@/services/import/duplicate-evidence";
import { commitSingleImport } from "@/services/import/import-acquire";
import { resolveImportStagingUri } from "@/services/photos/photo-storage";
import { useTheme } from "@/theme";
import { FREQUENCY_DAYS } from "@/types";
import { Logger } from "@/utils/logger";
import { useImportLeaveGuard } from "./use-import-leave-guard";

const LOG_SCOPE = "import-review";

type Snapshot = {
  displayName: string | null;
  methods: Array<{ type: "phone" | "email"; value: string }>;
  birthday: string | null;
};

type DuplicateChoice = DuplicateEvidenceCandidate & { name: string };

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
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowId, setRowId] = useState<number | null>(null);
  const [externalContactId, setExternalContactId] = useState<string | null>(
    null,
  );
  const [name, setName] = useState("");
  const [birthdayInput, setBirthdayInput] = useState("");
  const [photoRelPath, setPhotoRelPath] = useState<string | null>(null);
  const [categories, setCategories] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [intervalDays, setIntervalDays] = useState<number | null>(null);
  const [phoneRegion, setPhoneRegion] = useState<string | null>(null);
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

  useImportLeaveGuard(navigation, route.params.sessionId, edited);

  const load = useCallback(async () => {
    try {
      const exec = getExecutor();
      const [rows, settings, session, nextCategories] = await Promise.all([
        listSessionRows(exec, route.params.sessionId),
        getAppSettings(exec),
        getSessionById(exec, route.params.sessionId),
        listCategories(exec),
      ]);
      if (!session) throw new Error("import session is unavailable");
      const row = rows.find((candidate) => candidate.contactId === null);
      if (!row) {
        Alert.alert(
          "Import unavailable",
          "This contact has already been handled.",
        );
        navigation.goBack();
        return;
      }
      const snapshot = parseSnapshot(row.sourcePayload);
      if (!snapshot) throw new Error("invalid import snapshot");
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
          effectivePhoneRegion:
            settings.phoneRegionOverride ?? getDeviceRegion(),
        },
      );
      setRowId(row.id);
      setExternalContactId(row.externalContactId);
      setName(mapped.input.name);
      setBirthdayInput(mapped.birthday ?? snapshot.birthday ?? "");
      setPhotoRelPath(row.photoRelPath);
      setPhoneRegion(session.phoneRegion);
      const methodDrafts = mapped.input.methodDrafts ?? [];
      setMethods({
        phone: methodDrafts
          .filter((method) => method.type === "phone")
          .map((method) => ({ ...method, extension: "", label: "Main" })),
        email: methodDrafts
          .filter((method) => method.type === "email")
          .map((method) => ({ ...method, extension: "", label: "Main" })),
      });
      setCategories(nextCategories);
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to load import review", error);
      Alert.alert("Couldn't load this import", "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [navigation, route.params.sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const normalizedBirthday = useMemo(
    () => normalizeEditedBirthday(birthdayInput),
    [birthdayInput],
  );
  const birthdayInvalid =
    birthdayInput.trim().length > 0 && !normalizedBirthday.valid;
  const canImport =
    !loading &&
    !saving &&
    rowId !== null &&
    externalContactId !== null &&
    name.trim().length > 0 &&
    !birthdayInvalid;
  const previewUri = useMemo(
    () => (photoRelPath ? resolveImportStagingUri(photoRelPath) : null),
    [photoRelPath],
  );

  function makeImportInput(now: string) {
    return {
      uid: newUid(),
      name: name.trim(),
      intervalDays: trackingEnabled
        ? (intervalDays ?? FREQUENCY_DAYS.Monthly)
        : null,
      trackingEnabled,
      now,
      categoryId,
      methodDrafts: toMethodDrafts(methods),
      methodNormalization: { effectivePhoneRegion: phoneRegion },
    };
  }

  async function importAsNew() {
    if (rowId === null || externalContactId === null) return;
    const now = localDateTime();
    const contactId = await commitSingleImport(getExecutor(), {
      sessionId: route.params.sessionId,
      rowId,
      input: makeImportInput(now),
      externalLinks: [{ provider: "android", externalContactId }],
      birthday: normalizedBirthday.stored,
      now,
    });
    setDuplicateOutcome(null);
    navigation.replace("Profile", { contactId });
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
        birthday: normalizedBirthday.stored,
        effectivePhoneRegion: phoneRegion,
      });
      const now = localDateTime();
      if (result.outcome === "already_linked") {
        await resolveAlreadyLinked(
          exec,
          rowId,
          result.deterministicContactId,
          now,
        );
        await finalizeSessionIfTerminal(exec, route.params.sessionId, now);
        Alert.alert("Already in Orbit", "This contact is already linked.", [
          {
            text: "View contact",
            onPress: () =>
              navigation.replace("Profile", {
                contactId: result.deterministicContactId,
              }),
          },
        ]);
        return;
      }
      if (result.outcome === "new" || result.candidates.length === 0) {
        await importAsNew();
        return;
      }
      const choices = await Promise.all(
        result.candidates.map(async (candidate) => {
          const contact = await getContactHeader(exec, candidate.contactId);
          return contact ? { ...candidate, name: contact.name } : null;
        }),
      );
      setDuplicateChoices(
        choices.filter((choice): choice is DuplicateChoice => choice !== null),
      );
      setDuplicateOutcome(result.outcome);
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to commit import", error);
      Alert.alert(
        "Couldn't import contact",
        "Please check the name and try again.",
      );
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
      navigation.replace("Profile", { contactId: choice.contactId });
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to link duplicate", error);
      Alert.alert("Couldn't link contact", "Please choose again.");
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
      navigation.replace("ImportComplete", {
        sessionId: route.params.sessionId,
      });
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to skip duplicate", error);
      Alert.alert("Couldn't skip contact", "Please try again.");
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
      Alert.alert("Couldn't import contact", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.back, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          Review import
        </Text>
      </View>
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
          placeholderTextColor={colors.textSecondary}
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
        <View style={styles.lifecycle}>
          {([true, false] as const).map((enabled) => (
            <Pressable
              key={String(enabled)}
              onPress={() => {
                setEdited(true);
                setTrackingEnabled(enabled);
              }}
              style={[
                styles.choice,
                {
                  backgroundColor:
                    trackingEnabled === enabled
                      ? colors.accent
                      : colors.surface,
                  borderColor:
                    trackingEnabled === enabled ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color:
                    trackingEnabled === enabled
                      ? colors.background
                      : colors.textPrimary,
                }}
              >
                {enabled ? "Bound" : "Unbound"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Category
        </Text>
        <View
          style={[
            styles.picker,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Picker
            selectedValue={categoryId ?? -1}
            onValueChange={(value) => {
              setEdited(true);
              setCategoryId(value === -1 ? null : Number(value));
            }}
            dropdownIconColor={colors.textSecondary}
            style={{ color: colors.textPrimary }}
          >
            <Picker.Item label="No category" value={-1} />
            {categories.map((category) => (
              <Picker.Item
                key={category.id}
                label={category.name}
                value={category.id}
              />
            ))}
          </Picker>
        </View>
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
            setMethods((current) => updateMethodDraft(current, uid, patch));
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
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Birthday
        </Text>
        <TextInput
          value={birthdayInput}
          onChangeText={(value) => {
            setEdited(true);
            setBirthdayInput(value);
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              backgroundColor: colors.surface,
              borderColor: birthdayInvalid
                ? colors.borderStrong
                : colors.border,
            },
          ]}
        />
        {birthdayInvalid ? (
          <Text style={[styles.birthdayError, { color: colors.accent }]}>
            Enter a real date (YYYY-MM-DD or MM-DD).
          </Text>
        ) : null}
      </View>
      <Pressable
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
            color: canImport ? colors.background : colors.textSecondary,
            fontWeight: "600",
          }}
        >
          Import
        </Text>
      </Pressable>
      <Modal
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
              <Pressable
                key={choice.contactId}
                disabled={saving}
                onPress={() => void linkToExisting(choice)}
                style={[
                  styles.duplicateChoice,
                  {
                    backgroundColor:
                      duplicateChoices.length === 1
                        ? colors.accent
                        : colors.surface,
                    borderColor:
                      duplicateChoices.length === 1
                        ? colors.accent
                        : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color:
                      duplicateChoices.length === 1
                        ? colors.background
                        : colors.textPrimary,
                  }}
                >
                  {duplicateChoices.length === 1
                    ? "Link to Existing"
                    : "Choose this one"}
                </Text>
                <Text
                  style={{
                    color:
                      duplicateChoices.length === 1
                        ? colors.background
                        : colors.textSecondary,
                  }}
                >
                  {choice.name}
                </Text>
              </Pressable>
            ))}
            <Pressable
              disabled={saving}
              onPress={() => void onImportAsNewFromInterrupt()}
              style={[
                styles.duplicateChoice,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <Text style={{ color: colors.textPrimary }}>Import as New</Text>
            </Pressable>
            {duplicateChoices.length > 1 ? (
              <Pressable
                disabled={saving}
                onPress={() => void skipDuplicate()}
                style={[styles.duplicateChoice, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textSecondary }}>Skip</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  title: { fontSize: 22, fontWeight: "700" },
  photo: { width: 96, height: 96, borderRadius: 48 },
  field: { gap: 8 },
  birthdayError: { fontSize: 13, fontWeight: "600" },
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
  picker: { borderWidth: 1, borderRadius: 10, overflow: "hidden" },
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
