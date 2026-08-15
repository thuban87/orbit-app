/**
 * CreateContactScreen (CRUD-01 / CRUD-02) — the lean create form. Fixed block
 * (Name → Category → Frequency → Last-spoke → Phone) FIRST, the `show_on_new`
 * custom block AFTER it, never interleaved (06-crud Cluster A). Save assembles a
 * single `createContactFull` call (one transaction), warns on a duplicate live
 * name, and `navigation.replace`s to the new contact's Profile so Back does not
 * return to the form.
 *
 * The screen builds NO SQL and re-implements NO widget: the custom block maps
 * `defsForCreateForm` through `FieldValueInput` verbatim, and every value crosses
 * into the DAO as a bound param (T-04-02). All input-shaping correctness lives in
 * the node-tested `create-contact-logic.ts` (canSave gate, buildCreateInput) —
 * this file is the RN shell + navigation, device-UAT at the phase gate.
 *
 * CRUD-01 fix: the typed Phone is carried into the create input (previously
 * collected but dropped). Frequency defaults to Monthly (30) so a name-only save
 * succeeds — the DAO hard-rejects a non-positive interval, and an invalid custom
 * entry blocks Save before it can reach the DAO.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import { Picker } from "@react-native-picker/picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { FieldValueInput } from "@/components/FieldValueInput";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import { TriStateLastSpoke } from "@/components/TriStateLastSpoke";
import type { LastSpokeValue } from "@/components/tri-state-last-spoke-logic";
import { isDuplicateName, listCategories } from "@/db/contact-read";
import { createContactFull } from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { listDefs } from "@/db/field-defs-dao";
import type { CustomFieldDef } from "@/db/field-types";
import { defsForCreateForm } from "@/db/field-values-dao";
import { newUid } from "@/db/uid";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { FREQUENCY_DAYS } from "@/types";
import { Logger } from "@/utils/logger";
import {
  buildCreateInput,
  type CreateFormState,
  canSave,
} from "./create-contact-logic";

const LOG_SCOPE = "create-contact";

/** Promise wrapper over Alert so the duplicate-name warning reads as ONE gate. */
function confirmDuplicate(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Duplicate name",
      `You already have a ${name} — save anyway?`,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Save anyway", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function CreateContactScreen({
  navigation,
}: RootStackScreenProps<"Create">) {
  const { colors } = useTheme();

  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [createDefs, setCreateDefs] = useState<CustomFieldDef[]>([]);

  // Fixed-block state.
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [intervalDays, setIntervalDays] = useState(FREQUENCY_DAYS.Monthly);
  const [intervalValid, setIntervalValid] = useState(true);
  const [lastSpoke, setLastSpoke] = useState<LastSpokeValue>({ kind: "today" });
  const [phone, setPhone] = useState("");
  // Custom-block value map, keyed by col_name.
  const [values, setValues] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const exec = getExecutor();
      const [cats, defs] = await Promise.all([
        listCategories(exec),
        listDefs(exec, { includeQuarantined: false }),
      ]);
      setCategories(cats);
      setCreateDefs(defsForCreateForm(defs));
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load create-form data", err);
      Alert.alert("Couldn't load the form", "Please reopen this screen.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const formState: CreateFormState = useMemo(
    () => ({
      name,
      categoryId,
      intervalDays,
      intervalValid,
      lastSpoke,
      phone,
      values,
    }),
    [name, categoryId, intervalDays, intervalValid, lastSpoke, phone, values],
  );

  const savable = canSave(formState) && !saving;

  async function handleSave() {
    if (!canSave(formState) || saving) {
      return;
    }
    const trimmed = name.trim();
    setSaving(true);
    try {
      const exec = getExecutor();
      // Duplicate-name warning fires on save (non-blocking, "save anyway").
      if (await isDuplicateName(exec, trimmed)) {
        if (!(await confirmDuplicate(trimmed))) {
          return; // Cancel — nothing is written.
        }
      }
      const input = buildCreateInput(formState, {
        now: localDateTime(),
        contactUid: newUid(),
        rowUid: newUid(),
        interactionUid: newUid(),
        createColNames: createDefs.map((d) => d.col_name),
      });
      const { contactId } = await createContactFull(exec, input);
      navigation.replace("Profile", { contactId });
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to save contact", err);
      Alert.alert("Couldn't save contact. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      testID="create-contact-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          testID="create-contact-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          New contact
        </Text>
      </View>

      {/* -- Fixed block: Name → Category → Frequency → Last-spoke → Phone -- */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Name
        </Text>
        <TextInput
          testID="create-contact-name"
          accessibilityLabel="Name"
          value={name}
          onChangeText={setName}
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
          Category
        </Text>
        <View
          style={[
            styles.pickerShell,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Picker
            testID="create-contact-category"
            accessibilityLabel="Category"
            selectedValue={categoryId ?? -1}
            onValueChange={(v) => setCategoryId(v === -1 ? null : Number(v))}
            dropdownIconColor={colors.textSecondary}
            style={{ color: colors.textPrimary }}
          >
            <Picker.Item label="No category" value={-1} />
            {categories.map((c) => (
              <Picker.Item key={c.id} label={c.name} value={c.id} />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Frequency
        </Text>
        <FrequencyPicker
          testID="create-contact-frequency"
          value={intervalDays}
          onChange={setIntervalDays}
          onValidityChange={setIntervalValid}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Last spoke
        </Text>
        <TriStateLastSpoke
          testID="create-contact-last-spoke"
          value={lastSpoke}
          onChange={setLastSpoke}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Phone
        </Text>
        <TextInput
          testID="create-contact-phone"
          accessibilityLabel="Phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="Phone number"
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

      {/* -- Custom block: show_on_new fields, AFTER the fixed block -- */}
      {createDefs.length > 0 ? (
        <View testID="create-contact-custom-block" style={styles.customBlock}>
          {createDefs.map((def) => (
            <View key={def.id} style={styles.field}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {def.label}
              </Text>
              <FieldValueInput
                testID={`create-contact-custom-${def.col_name}`}
                field={def}
                value={values[def.col_name] ?? null}
                onChange={(v) =>
                  setValues((prev) => ({ ...prev, [def.col_name]: v }))
                }
              />
            </View>
          ))}
        </View>
      ) : null}

      <Pressable
        testID="create-contact-save"
        accessibilityRole="button"
        accessibilityLabel="Save contact"
        accessibilityState={{ disabled: !savable }}
        disabled={!savable}
        onPress={() => void handleSave()}
        style={[
          styles.saveBtn,
          {
            backgroundColor: savable ? colors.accent : colors.surface,
            borderColor: savable ? colors.accent : colors.border,
          },
        ]}
      >
        <Text
          style={{
            color: savable ? colors.background : colors.textSecondary,
            fontWeight: "600",
          }}
        >
          Save contact
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  pickerShell: {
    borderWidth: 1,
    borderRadius: 8,
  },
  customBlock: {
    gap: 16,
  },
  saveBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
});
