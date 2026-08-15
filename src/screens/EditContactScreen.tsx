/**
 * EditContactScreen (CRUD-03) — the always-show edit form. Fixed block (Name →
 * Category → Frequency → [never-contacted only] Last-spoke → Phone → Email →
 * Birthday → Social battery → Rarely-responds / Turn-off-reminders toggles)
 * FIRST, the `defsForEditForm` custom block (EVERY non-quarantined field) AFTER
 * it, never interleaved (§14.7). Seeded by `getContactForEdit`, saved through
 * `updateContactFull` in ONE transaction, then returns to the Profile.
 *
 * LAST-SPOKE BOUNDARY (owner ruling 2026-08-14 / CONTEXT Area 3): the tri-state
 * last-spoke control renders IF AND ONLY IF the seeded `contact.last_contact IS
 * NULL` (`neverContacted`). Choosing Today/Pick date passes a `firstInteraction`
 * to `updateContactFull`, which writes the FIRST touch through the single-writer
 * recency path (source='manual', direction=null) — the screen NEVER writes
 * `last_contact` directly. A contact that ALREADY has `last_contact` set shows NO
 * last-spoke control here: correcting an existing recency timeline is Phase 6.
 *
 * The screen builds NO SQL and re-implements NO custom widget: the custom block
 * maps `defsForEditForm` through `FieldValueInput` verbatim, every value crosses
 * into the DAO as a bound param (T-04-02), and the input-shaping correctness lives
 * in the node-tested `edit-contact-logic.ts`. This file is the RN shell +
 * navigation, device-UAT at the phase gate.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { FieldValueInput } from "@/components/FieldValueInput";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import { type LinkDraft, LinksEditor } from "@/components/LinksEditor";
import { TriStateLastSpoke } from "@/components/TriStateLastSpoke";
import type { LastSpokeValue } from "@/components/tri-state-last-spoke-logic";
import {
  applyLinkDiff,
  type ContactLinkRow,
  type DraftLink,
} from "@/db/contact-links-dao";
import {
  getContactForEdit,
  isDuplicateName,
  listCategories,
} from "@/db/contact-read";
import { updateContactFull } from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { listDefs } from "@/db/field-defs-dao";
import type { CustomFieldDef } from "@/db/field-types";
import { defsForEditForm } from "@/db/field-values-dao";
import { newUid } from "@/db/uid";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { parseDate } from "@/types";
import { formatLocalDate } from "@/utils/dates";
import { Logger } from "@/utils/logger";
import {
  buildEditInput,
  canSave,
  type EditFormState,
  isNeverContacted,
  seedEditState,
} from "./edit-contact-logic";

const LOG_SCOPE = "edit-contact";

/** The social-battery options (native picker). "" = No selection → stored NULL. */
const SOCIAL_BATTERY_OPTIONS = ["Charger", "Neutral", "Drain"] as const;

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

/** Seed the editable links draft from the assembled (ordered) links. */
function toLinkDrafts(links: ContactLinkRow[]): LinkDraft[] {
  return links.map((l) => ({
    id: l.id,
    uid: l.uid,
    url: l.url,
    label: l.label,
  }));
}

/**
 * Shape the draft for `applyLinkDiff`: trim url/label, empty label → null, and
 * DROP blank-url rows (an added-then-untyped row, or a cleared existing link).
 * Dropping a cleared existing (id-bearing) row makes the diff DELETE it — the
 * intuitive "empty the URL to remove the link" behaviour.
 */
function buildLinksForDiff(draft: LinkDraft[]): DraftLink[] {
  return draft
    .map((l) => ({
      id: l.id,
      uid: l.uid,
      url: l.url.trim(),
      label: l.label && l.label.trim().length > 0 ? l.label.trim() : null,
    }))
    .filter((l) => l.url.length > 0);
}

export function EditContactScreen({
  navigation,
  route,
}: RootStackScreenProps<"Edit">) {
  const { colors } = useTheme();
  const { contactId } = route.params;

  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [editDefs, setEditDefs] = useState<CustomFieldDef[]>([]);
  const [form, setForm] = useState<EditFormState | null>(null);
  // Links: the seeded snapshot (the diff baseline) + the editable draft. Add/edit/
  // remove mutate ONLY the draft; nothing hits the DB until Save's applyLinkDiff.
  const [seededLinks, setSeededLinks] = useState<ContactLinkRow[]>([]);
  const [linksDraft, setLinksDraft] = useState<LinkDraft[]>([]);
  // Captured from the seed: a never-contacted contact (last_contact IS NULL) is
  // the ONLY case that shows the last-spoke control (owner ruling — see header).
  const [neverContacted, setNeverContacted] = useState(false);
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const exec = getExecutor();
      const defs = await listDefs(exec, { includeQuarantined: false });
      const [cats, result] = await Promise.all([
        listCategories(exec),
        getContactForEdit(exec, contactId, defs),
      ]);
      if (!result) {
        Alert.alert("Couldn't load this contact", "Please go back and retry.");
        return;
      }
      setCategories(cats);
      setEditDefs(defsForEditForm(defs));
      setNeverContacted(isNeverContacted(result));
      setForm(seedEditState(result));
      setSeededLinks(result.links);
      setLinksDraft(toLinkDrafts(result.links));
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load edit-form data", err);
      Alert.alert("Couldn't load the form", "Please reopen this screen.");
    }
  }, [contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Narrow, typed field setter so each control mutates one key immutably.
  const setField = useCallback(
    <K extends keyof EditFormState>(key: K, value: EditFormState[K]) => {
      setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    [],
  );

  // Links draft mutators — all local state; nothing persists until Save.
  const addLinkRow = useCallback(() => {
    setLinksDraft((prev) => [...prev, { uid: newUid(), url: "", label: null }]);
  }, []);
  const updateLinkRow = useCallback(
    (index: number, patch: Partial<Pick<LinkDraft, "url" | "label">>) => {
      setLinksDraft((prev) =>
        prev.map((l, i) => (i === index ? { ...l, ...patch } : l)),
      );
    },
    [],
  );
  const removeLinkRow = useCallback((index: number) => {
    setLinksDraft((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const savable = useMemo(
    () => form !== null && canSave(form) && !saving,
    [form, saving],
  );

  // Re-seed ONLY the metadata form from the just-committed row after a partial
  // save (links failed but metadata committed) — so the user never sees a stale
  // or rolled-back view. Deliberately leaves `linksDraft` INTACT for retry.
  async function reseedMetadataAfterPartialSave() {
    try {
      const exec = getExecutor();
      const defs = await listDefs(exec, { includeQuarantined: false });
      const result = await getContactForEdit(exec, contactId, defs);
      if (result) {
        setEditDefs(defsForEditForm(defs));
        setNeverContacted(isNeverContacted(result));
        setForm(seedEditState(result));
        // seededLinks is unchanged: applyLinkDiff rolled back, so the DB links
        // still equal the original baseline — keep it as the retry diff baseline.
      }
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to re-seed after partial save", err);
    }
  }

  async function handleSave() {
    if (!form || !canSave(form) || saving) {
      return;
    }
    const trimmed = form.name.trim();
    setSaving(true);
    try {
      const exec = getExecutor();
      // Duplicate-name warning fires on save (non-blocking), excluding self.
      if (await isDuplicateName(exec, trimmed, contactId)) {
        if (!(await confirmDuplicate(trimmed))) {
          return; // Cancel — nothing is written.
        }
      }
      const now = localDateTime();
      const input = buildEditInput(form, {
        now,
        contactId,
        rowUid: newUid(), // ALWAYS mint fresh — upsert's ON CONFLICT never rewrites uid.
        interactionUid: newUid(),
        editColNames: editDefs.map((d) => d.col_name),
        neverContacted,
      });

      // TWO-TRANSACTION BOUNDARY (by design): metadata (updateContactFull) and
      // links (applyLinkDiff) are SEPARATE transactions, so link writes never
      // bloat the metadata transaction. Metadata FIRST.
      try {
        await updateContactFull(exec, input);
      } catch (err) {
        // Metadata failed → NOTHING persisted. Generic save-failure copy.
        Logger.error(LOG_SCOPE, "failed to save contact metadata", err);
        Alert.alert("Couldn't save contact. Please try again.");
        return;
      }

      // Metadata (incl. the first interaction) is now COMMITTED and last_contact
      // is set. Clear the never-contacted first-interaction intent in LOCAL STATE
      // immediately, independent of the links diff or any reseed. This is the
      // load-bearing guard against re-emitting firstInteraction on a retry: if we
      // instead relied on the best-effort reseedMetadataAfterPartialSave() below
      // and that reseed itself threw, a retry would re-emit firstInteraction, the
      // DAO would reject the double-log, and the form would wedge until remount.
      if (neverContacted && input.firstInteraction) {
        setNeverContacted(false);
        setField("lastSpoke", { kind: "not-yet" });
      }

      // Metadata is COMMITTED. Now the links diff in its own transaction.
      try {
        await applyLinkDiff(exec, {
          contactId,
          seeded: seededLinks,
          current: buildLinksForDiff(linksDraft),
          now,
        });
      } catch (err) {
        // PARTIAL SAVE: the links diff rolled back atomically, but the contact
        // METADATA STAYS COMMITTED. Do NOT show the generic "Couldn't save
        // contact" copy (it would falsely imply nothing saved). Re-seed the
        // metadata from the committed row, KEEP linksDraft for retry, and STAY
        // on the form (no navigation).
        Logger.error(LOG_SCOPE, "links save failed (metadata committed)", err);
        await reseedMetadataAfterPartialSave();
        Alert.alert("Contact saved — some links couldn't be saved. Try again.");
        return;
      }

      navigation.navigate("Profile", { contactId });
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to save contact", err);
      Alert.alert("Couldn't save contact. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function onBirthdayChange(event: DateTimePickerEvent, date?: Date) {
    setShowBirthdayPicker(false);
    if (event.type !== "set" || !date) {
      return; // Android cancel/dismiss — keep the prior value.
    }
    setField("birthdayInput", formatLocalDate(date));
  }

  const inputStyle = [
    styles.input,
    {
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
  ];

  if (!form) {
    return (
      <View
        testID="edit-contact-loading"
        style={[styles.loading, { backgroundColor: colors.background }]}
      >
        <Text style={{ color: colors.textSecondary }}>Loading…</Text>
      </View>
    );
  }

  const birthdayLabel = form.birthdayInput
    ? form.birthdayYearUnknown
      ? form.birthdayInput.slice(5) // MM-DD (year hidden)
      : form.birthdayInput
    : "Set birthday";
  const birthdaySeed =
    (form.birthdayInput ? parseDate(form.birthdayInput) : null) ?? new Date();

  return (
    <ScrollView
      testID="edit-contact-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          testID="edit-contact-back"
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
          Edit contact
        </Text>
      </View>

      {/* -- Fixed block. Surfaces frequency + last-spoke + phone first (UI-SPEC
          "Name-only refine path"): the decay→SMS core loop drivers lead. -- */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Name
        </Text>
        <TextInput
          testID="edit-contact-name"
          accessibilityLabel="Name"
          value={form.name}
          onChangeText={(v) => setField("name", v)}
          placeholder="Their name"
          placeholderTextColor={colors.textSecondary}
          style={inputStyle}
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
            testID="edit-contact-category"
            accessibilityLabel="Category"
            selectedValue={form.categoryId ?? -1}
            onValueChange={(v) =>
              setField("categoryId", v === -1 ? null : Number(v))
            }
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
          testID="edit-contact-frequency"
          value={form.intervalDays}
          onChange={(v) => setField("intervalDays", v)}
          onValidityChange={(v) => setField("intervalValid", v)}
        />
      </View>

      {/* LAST-SPOKE (owner ruling / CONTEXT Area 3): rendered ONLY when the
          seeded contact is never-contacted (last_contact IS NULL). Its Today/Pick
          date choice routes a FIRST interaction through updateContactFull's
          single-writer path — never a direct last_contact write. A contact that
          already has last_contact set has NO control here; timeline correction is
          Phase 6. Default "Not yet" so an untouched save logs nothing. */}
      {neverContacted ? (
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Last spoke
          </Text>
          <TriStateLastSpoke
            testID="edit-contact-last-spoke"
            value={form.lastSpoke}
            onChange={(v: LastSpokeValue) => setField("lastSpoke", v)}
          />
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Phone
        </Text>
        <TextInput
          testID="edit-contact-phone"
          accessibilityLabel="Phone"
          value={form.phone}
          onChangeText={(v) => setField("phone", v)}
          keyboardType="phone-pad"
          placeholder="Phone number"
          placeholderTextColor={colors.textSecondary}
          style={inputStyle}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Email
        </Text>
        <TextInput
          testID="edit-contact-email"
          accessibilityLabel="Email"
          value={form.email}
          onChangeText={(v) => setField("email", v)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Email address"
          placeholderTextColor={colors.textSecondary}
          style={inputStyle}
        />
      </View>

      {/* Links (CRUD-04): grouped with the reach fields (phone/email/links per
          CONTEXT Area 2 / UI-SPEC), AFTER email and BEFORE the toggles. Edited as
          draft state; persisted once on Save via applyLinkDiff (all-or-nothing on
          cancel — back out without Save persists no link change). Phone/email stay
          their own dedicated inputs above, NEVER part of the links list. */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Links
        </Text>
        <LinksEditor
          testID="edit-contact-links"
          links={linksDraft}
          onAdd={addLinkRow}
          onUpdate={updateLinkRow}
          onRemove={removeLinkRow}
        />
      </View>

      {/* Birthday: native date picker + a "Year unknown" toggle (the native
          picker has no month/day-only mode, so year-optional is app logic —
          MM-DD when unknown, YYYY-MM-DD when known; Pitfall 7). */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Birthday
        </Text>
        <Pressable
          testID="edit-contact-birthday"
          accessibilityRole="button"
          accessibilityLabel="Birthday"
          onPress={() => setShowBirthdayPicker(true)}
          style={[
            styles.input,
            styles.birthdayTrigger,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={{
              color: form.birthdayInput
                ? colors.textPrimary
                : colors.textSecondary,
            }}
          >
            {birthdayLabel}
          </Text>
        </Pressable>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>
            Year unknown
          </Text>
          <Switch
            testID="edit-contact-birthday-year-unknown"
            accessibilityLabel="Year unknown"
            value={form.birthdayYearUnknown}
            onValueChange={(v) => setField("birthdayYearUnknown", v)}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.surfaceElevated}
          />
        </View>
        {showBirthdayPicker ? (
          <DateTimePicker
            testID="edit-contact-birthday-picker"
            value={birthdaySeed}
            mode="date"
            onChange={onBirthdayChange}
          />
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Social battery
        </Text>
        <View
          style={[
            styles.pickerShell,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Picker
            testID="edit-contact-social-battery"
            accessibilityLabel="Social battery"
            selectedValue={form.socialBattery ?? ""}
            onValueChange={(v) =>
              setField("socialBattery", v === "" ? null : String(v))
            }
            dropdownIconColor={colors.textSecondary}
            style={{ color: colors.textPrimary }}
          >
            <Picker.Item label="No selection" value="" />
            {SOCIAL_BATTERY_OPTIONS.map((o) => (
              <Picker.Item key={o} label={o} value={o} />
            ))}
          </Picker>
        </View>
      </View>

      {/* Behaviour toggles — the ToggleFieldWidget on/off "1"/"0" convention. */}
      <View style={styles.field}>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>
            Rarely responds
          </Text>
          <Switch
            testID="edit-contact-rarely-responds"
            accessibilityLabel="Rarely responds"
            value={form.rarelyResponds === 1}
            onValueChange={(v) => setField("rarelyResponds", v ? 1 : 0)}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.surfaceElevated}
          />
        </View>
        <Text style={[styles.helper, { color: colors.textSecondary }]}>
          Attempts to reach out won't reset their orbit
        </Text>
      </View>

      <View style={styles.field}>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>
            Turn off reminders
          </Text>
          <Switch
            testID="edit-contact-reminders-off"
            accessibilityLabel="Turn off reminders"
            value={form.remindersOff === 1}
            onValueChange={(v) => setField("remindersOff", v ? 1 : 0)}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.surfaceElevated}
          />
        </View>
      </View>

      {/* -- Custom block: EVERY non-quarantined field, AFTER the fixed block -- */}
      {editDefs.length > 0 ? (
        <View testID="edit-contact-custom-block" style={styles.customBlock}>
          {editDefs.map((def) => (
            <View key={def.id} style={styles.field}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {def.label}
              </Text>
              <FieldValueInput
                testID={`edit-contact-custom-${def.col_name}`}
                field={def}
                value={form.values[def.col_name] ?? null}
                onChange={(v) =>
                  setForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          values: { ...prev.values, [def.col_name]: v },
                        }
                      : prev,
                  )
                }
              />
            </View>
          ))}
        </View>
      ) : null}

      <Pressable
        testID="edit-contact-save"
        accessibilityRole="button"
        accessibilityLabel="Save changes"
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
          Save changes
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
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
  birthdayTrigger: {
    minHeight: 44,
    justifyContent: "center",
  },
  pickerShell: {
    borderWidth: 1,
    borderRadius: 8,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  helper: {
    fontSize: 13,
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
