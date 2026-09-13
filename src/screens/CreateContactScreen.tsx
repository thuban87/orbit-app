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
import { ContactMethodsEditor } from "@/components/ContactMethodsEditor";
import {
  addMethodDraft,
  choosePrimary,
  emptyMethodDraft,
  type MethodGroups,
  removeMethodDraft,
  resolveEffectivePhoneRegion,
  updateMethodDraft,
} from "@/components/contact-methods-editor-model";
import { FieldValueInput } from "@/components/FieldValueInput";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import {
  FuelEditor,
  type FuelDraft,
  type FuelEditPatch,
} from "@/components/FuelEditor";
import {
  MemoryEditor,
  type MemoryDraft,
  type MemoryEditPatch,
} from "@/components/MemoryEditor";
import {
  RelationshipEditor,
  type RelationshipDraft,
} from "@/components/RelationshipEditor";
import { TriStateLastSpoke } from "@/components/TriStateLastSpoke";
import { AccordionSection, AppText, Button } from "@/components/ui";
import type { FuelItem } from "@/db/fuel-read";
import type { MemoryRow } from "@/db/memories-read";
import type { RelationshipRow } from "@/db/relationships-read";
import type { LastSpokeValue } from "@/components/tri-state-last-spoke-logic";
import { getAppSettings } from "@/db/app-settings-dao";
import { isDuplicateName, listCategories } from "@/db/contact-read";
import { createContactFull } from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { listDefs } from "@/db/field-defs-dao";
import type { CustomFieldDef } from "@/db/field-types";
import { defsForCreateForm } from "@/db/field-values-dao";
import { newUid } from "@/db/uid";
import type { ContactMethodType } from "@/logic/contact-method-normalization";
import type { RootStackScreenProps } from "@/navigation/types";
import { getDeviceRegion } from "@/services/device-region";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import {
  buildCreateInput,
  coordinateBoundToggle,
  coordinateCadenceSelection,
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

// -- Draft → display-row adapters ---------------------------------------------
// The Show-More sections reuse the profile enrichment editors (same vocabulary as
// Edit Contact), but on the CREATE path there is no contact row yet: drafts are
// collected in local state and persisted ATOMICALLY by `createContactFull` on
// Save. These adapters render collected drafts as the editors' committed-row
// shape with synthetic ids (the array index) so add/edit/remove work pre-create.
const DRAFT_TS = "";

function memoryDraftToRow(draft: MemoryDraft, index: number): MemoryRow {
  return {
    id: index,
    uid: "",
    contact_id: 0,
    type: draft.type,
    custom_label: draft.customLabel,
    value: draft.value,
    note: draft.note,
    url: draft.url,
    meaningful_date: draft.meaningfulDate,
    pinned: draft.pinned ? 1 : 0,
    outdated: draft.outdated ? 1 : 0,
    hidden: draft.hidden === null ? null : draft.hidden ? 1 : 0,
    provenance: "user",
    created_at: DRAFT_TS,
    modified_at: DRAFT_TS,
    deleted_at: null,
    allow_ai: 0,
  };
}

function relationshipDraftToRow(
  draft: RelationshipDraft,
  index: number,
): RelationshipRow {
  return {
    id: index,
    uid: "",
    contact_id: 0,
    person_name: draft.personName,
    relation_type: draft.relationType,
    linked_contact_id: draft.linkedContactId,
    linked_contact_name: null,
    note: draft.note,
    pinned: draft.pinned ? 1 : 0,
    hidden: draft.hidden,
    created_at: DRAFT_TS,
    modified_at: DRAFT_TS,
    deleted_at: null,
  };
}

function fuelDraftToItem(
  draft: FuelDraft,
  index: number,
  now: string,
): FuelItem {
  return {
    id: index,
    contact_id: 0,
    kind: draft.kind,
    label: draft.label,
    text: draft.text,
    // A real stamp so the editor's age line reads "today" for a fresh draft
    // (a blank created_at would parse to NaN in formatFuelAge).
    created_at: now,
    url: draft.url,
    source: "user",
  };
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
  // A contact created without touching cadence is Unbound (trackingEnabled=false)
  // with no cadence (intervalDays=null) — NOT the prior Monthly + Bound default
  // (CAPT-03, dossier §F). Unbound never gates Save on cadence, so intervalValid
  // starts true. Binding turns the gate on via coordinateBoundToggle.
  const [intervalDays, setIntervalDays] = useState<number | null>(null);
  const [intervalValid, setIntervalValid] = useState(true);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [lastSpoke, setLastSpoke] = useState<LastSpokeValue>({ kind: "today" });
  const [methods, setMethods] = useState<MethodGroups>(() => ({
    phone: [emptyMethodDraft("phone", newUid())],
    email: [],
  }));
  const [effectivePhoneRegion, setEffectivePhoneRegion] = useState<
    string | null
  >(getDeviceRegion());
  // Custom-block value map, keyed by col_name.
  const [values, setValues] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  // CONTROLLED accordion disclosure. Identity opens by default (the fewest-taps
  // create path); the parent owns which sections are open so a blocked Save can
  // reveal the erroring section (CAPT-14, Task 4). Advanced enrichment lives
  // behind Show More (Task 3).
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    identity: true,
    relationship: false,
    methods: false,
    lastTalked: false,
    keyPeople: false,
    currentLocation: false,
    memories: false,
    custom: false,
    offLimits: false,
  });
  const setSectionExpanded = useCallback((sectionId: string, next: boolean) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: next }));
  }, []);

  // Show-More advanced enrichment (CAPT-01). All optional; each draft flows into
  // the single atomic create transaction via buildCreateInput — no rendered
  // control fails to persist (Review HIGH #4).
  const [showMore, setShowMore] = useState(false);
  const [memoryDrafts, setMemoryDrafts] = useState<MemoryDraft[]>([]);
  const [relationshipDrafts, setRelationshipDrafts] = useState<
    RelationshipDraft[]
  >([]);
  const [lastTalkedAbout, setLastTalkedAbout] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
  const [fuelDrafts, setFuelDrafts] = useState<FuelDraft[]>([]);

  const load = useCallback(async () => {
    try {
      const exec = getExecutor();
      const [cats, defs, settings] = await Promise.all([
        listCategories(exec),
        listDefs(exec, { includeQuarantined: false }),
        getAppSettings(exec),
      ]);
      setCategories(cats);
      setCreateDefs(defsForCreateForm(defs));
      setEffectivePhoneRegion(
        resolveEffectivePhoneRegion(
          settings.phoneRegionOverride,
          getDeviceRegion(),
        ),
      );
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
      trackingEnabled,
      lastSpoke,
      methods,
      values,
      memories: memoryDrafts,
      relationships: relationshipDrafts,
      lastTalkedAbout,
      currentLocation,
      offLimits: fuelDrafts,
    }),
    [
      name,
      categoryId,
      intervalDays,
      intervalValid,
      trackingEnabled,
      lastSpoke,
      methods,
      values,
      memoryDrafts,
      relationshipDrafts,
      lastTalkedAbout,
      currentLocation,
      fuelDrafts,
    ],
  );

  const savable = canSave(formState) && !saving;
  // A single per-render local stamp so fuel drafts show a stable "today" age.
  const draftNow = localDateTime();

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
        interactionUid: newUid(),
        createDefs,
        effectivePhoneRegion,
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
          <AppText role="label" style={{ color: colors.textSecondary }}>
            Back
          </AppText>
        </Pressable>
        <AppText role="display" accessibilityRole="header">
          New contact
        </AppText>
      </View>

      {/* -- Identity section (Name + Category) — open by default (CAPT-01). -- */}
      <AccordionSection
        sectionId="identity"
        title="Identity"
        expanded={expandedSections.identity}
        onExpandedChange={(next) => setSectionExpanded("identity", next)}
      >
        <View style={styles.field}>
          <AppText role="label" style={{ color: colors.textSecondary }}>
            Name
          </AppText>
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
          <AppText role="label" style={{ color: colors.textSecondary }}>
            Category
          </AppText>
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
      </AccordionSection>

      {/* -- Relationship Basics: last-spoke + cadence/Bound coordination. -- */}
      <AccordionSection
        sectionId="relationship"
        title="Relationship Basics"
        expanded={expandedSections.relationship}
        onExpandedChange={(next) => setSectionExpanded("relationship", next)}
      >
        <View style={styles.field}>
          <AppText role="label" style={{ color: colors.textSecondary }}>
            Last spoke
          </AppText>
          <TriStateLastSpoke
            testID="create-contact-last-spoke"
            value={lastSpoke}
            onChange={setLastSpoke}
          />
        </View>

        <View style={styles.field}>
          <AppText role="label" style={{ color: colors.textSecondary }}>
            Orbit participation
          </AppText>
          <View style={styles.lifecycleChoices}>
            {([true, false] as const).map((enabled) => {
              const selected = trackingEnabled === enabled;
              const label = enabled ? "Bound" : "Unbound";
              return (
                <Pressable
                  key={label}
                  testID={`create-contact-${label.toLowerCase()}`}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    // Coordinate cadence + Bound as one unit (CAPT-03): binding
                    // with no cadence gates Save until a valid interval is picked;
                    // unbinding retains any interval as dormant.
                    const next = coordinateBoundToggle(
                      { intervalDays },
                      enabled,
                    );
                    setTrackingEnabled(next.trackingEnabled);
                    setIntervalDays(next.intervalDays);
                    setIntervalValid(next.intervalValid);
                  }}
                  style={[
                    styles.lifecycleChoice,
                    {
                      borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: selected
                        ? colors.accent
                        : colors.surface,
                    },
                  ]}
                >
                  <AppText
                    role="label"
                    style={{
                      color: selected ? colors.onAccent : colors.textPrimary,
                    }}
                  >
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            {trackingEnabled
              ? "Bound contacts appear in your active orbit and receive cadence reminders."
              : "Unbound contacts keep their details and history without active cadence reminders."}
          </AppText>
        </View>

        {trackingEnabled ? (
          <View style={styles.field}>
            <AppText role="label" style={{ color: colors.textSecondary }}>
              Frequency
            </AppText>
            <FrequencyPicker
              testID="create-contact-frequency"
              value={intervalDays ?? 0}
              onChange={(v) => {
                // Selecting a cadence turns Bound on (CAPT-03).
                const next = coordinateCadenceSelection(v);
                setTrackingEnabled(next.trackingEnabled);
                setIntervalDays(next.intervalDays);
              }}
              onValidityChange={setIntervalValid}
            />
          </View>
        ) : null}
      </AccordionSection>

      {/* -- Contact Methods section. -- */}
      <AccordionSection
        sectionId="methods"
        title="Contact Methods"
        expanded={expandedSections.methods}
        onExpandedChange={(next) => setSectionExpanded("methods", next)}
      >
        <ContactMethodsEditor
          testID="create-contact-methods"
          methods={methods}
          onAdd={(type: ContactMethodType) =>
            setMethods((current) => addMethodDraft(current, type, newUid()))
          }
          onUpdate={(uid, patch) =>
            setMethods((current) => updateMethodDraft(current, uid, patch))
          }
          onRemove={(uid) =>
            setMethods((current) => removeMethodDraft(current, uid))
          }
          onChoosePrimary={(uid) =>
            setMethods((current) => choosePrimary(current, uid))
          }
        />
      </AccordionSection>

      {/* -- Show More: reveals the advanced enrichment sections (dossier §D). -- */}
      {showMore ? (
        <>
          <AccordionSection
            sectionId="lastTalked"
            title="Last Talked About"
            expanded={expandedSections.lastTalked}
            onExpandedChange={(next) => setSectionExpanded("lastTalked", next)}
          >
            <TextInput
              testID="create-contact-last-talked"
              accessibilityLabel="Last talked about"
              value={lastTalkedAbout}
              onChangeText={setLastTalkedAbout}
              placeholder="What did you last talk about?"
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
          </AccordionSection>

          <AccordionSection
            sectionId="keyPeople"
            title="Key People"
            expanded={expandedSections.keyPeople}
            onExpandedChange={(next) => setSectionExpanded("keyPeople", next)}
          >
            <RelationshipEditor
              contactId={0}
              items={relationshipDrafts.map(relationshipDraftToRow)}
              onAdd={async (draft: RelationshipDraft) => {
                setRelationshipDrafts((prev) => [...prev, draft]);
                return true;
              }}
              onEdit={async (id: number, draft: RelationshipDraft) => {
                setRelationshipDrafts((prev) =>
                  prev.map((d, i) => (i === id ? draft : d)),
                );
                return true;
              }}
              onDelete={(id: number) =>
                setRelationshipDrafts((prev) =>
                  prev.filter((_, i) => i !== id),
                )
              }
              onRestore={() => {}}
            />
          </AccordionSection>

          <AccordionSection
            sectionId="currentLocation"
            title="Current Location"
            expanded={expandedSections.currentLocation}
            onExpandedChange={(next) =>
              setSectionExpanded("currentLocation", next)
            }
          >
            <TextInput
              testID="create-contact-current-location"
              accessibilityLabel="Current location"
              value={currentLocation}
              onChangeText={setCurrentLocation}
              placeholder="Where are they now?"
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
          </AccordionSection>

          <AccordionSection
            sectionId="memories"
            title="Memories"
            expanded={expandedSections.memories}
            onExpandedChange={(next) => setSectionExpanded("memories", next)}
          >
            <MemoryEditor
              testID="create-contact-memories"
              items={memoryDrafts.map(memoryDraftToRow)}
              globalAiEnabled={false}
              onAdd={async (draft: MemoryDraft) => {
                setMemoryDrafts((prev) => [...prev, draft]);
                return true;
              }}
              onEdit={async (id: number, patch: MemoryEditPatch) => {
                setMemoryDrafts((prev) =>
                  prev.map((d, i) => (i === id ? patch : d)),
                );
                return true;
              }}
              onDelete={(id: number) =>
                setMemoryDrafts((prev) => prev.filter((_, i) => i !== id))
              }
              onRestore={() => {}}
              onSetAllowAi={() => {}}
            />
          </AccordionSection>

          {createDefs.length > 0 ? (
            <AccordionSection
              sectionId="custom"
              title="Custom Fields"
              expanded={expandedSections.custom}
              onExpandedChange={(next) => setSectionExpanded("custom", next)}
            >
              <View testID="create-contact-custom-block" style={styles.customBlock}>
                {createDefs.map((def) => (
                  <View key={def.id} style={styles.field}>
                    <AppText role="label" style={{ color: colors.textSecondary }}>
                      {def.label}
                    </AppText>
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
            </AccordionSection>
          ) : null}

          <AccordionSection
            sectionId="offLimits"
            title="Off Limits"
            expanded={expandedSections.offLimits}
            onExpandedChange={(next) => setSectionExpanded("offLimits", next)}
          >
            <FuelEditor
              testID="create-contact-off-limits"
              items={fuelDrafts.map((d, i) =>
                fuelDraftToItem(d, i, draftNow),
              )}
              now={draftNow}
              onAdd={async (draft: FuelDraft) => {
                setFuelDrafts((prev) => [...prev, draft]);
                return true;
              }}
              onEdit={(id: number, patch: FuelEditPatch) =>
                setFuelDrafts((prev) =>
                  prev.map((d, i) => (i === id ? { ...d, ...patch } : d)),
                )
              }
              onDelete={(id: number) =>
                setFuelDrafts((prev) => prev.filter((_, i) => i !== id))
              }
              onConfirm={() => {}}
            />
          </AccordionSection>
        </>
      ) : (
        <Button
          testID="create-contact-show-more"
          role="tertiary"
          label="Show More"
          onPress={() => setShowMore(true)}
        />
      )}

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
  helper: { fontSize: 13, lineHeight: 18 },
  lifecycleChoices: { flexDirection: "row", gap: 8 },
  lifecycleChoice: {
    minHeight: 44,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
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
