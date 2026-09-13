/**
 * UpdateContactScreen — the compact Update Contact chooser and its focused
 * editors (CAPT-12/13/14, dossier §Y/§Z/§AA/§AB/§AC/§AE). After the contact is
 * known, Update Contact opens a registry-driven action surface rather than the
 * full Edit Contact form. Selecting a row opens a focused editor; a successful
 * inner save persists INDEPENDENTLY and returns to the chooser with the SAME
 * contact targeted (subtle recent-success cue). The user exits only via Done.
 * Category is never a row — it stays in Edit Contact (dossier §X/§Y).
 *
 * Row assembly, applicability filtering, and the repeated-update session model
 * live in the node-tested pure `update-contact-chooser-logic.ts`; this file is
 * the RN shell + navigation, device-UAT at the phase gate.
 *
 * CURRENT-STATE ROWS (Review cycle-3 MEDIUM 34-07): Last Talked About and
 * Current Location are `current_state` fields persisted via `setCurrentStateValue`
 * keyed by `last_talked_about` / `current_location`. They record NO interaction
 * and never touch `last_contact` — they are NOT routed through `TriStateLastSpoke`
 * (the first-interaction control that writes `last_contact`).
 *
 * FAILURE-SAFETY (CAPT-14): a failed inner save preserves that editor's state,
 * shows the locked failure copy, and never returns to the chooser (no completion).
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import { useFocusEffect } from "@react-navigation/native";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { ContactMethodsEditor } from "@/components/ContactMethodsEditor";
import {
  addMethodDraft,
  type MethodGroups,
  removeMethodDraft,
  resolveEffectivePhoneRegion,
  seedMethodGroups,
  toMethodDrafts,
  updateMethodDraft,
  choosePrimary,
} from "@/components/contact-methods-editor-model";
import { ContactPicker } from "@/components/ContactPicker";
import { FieldValueInput } from "@/components/FieldValueInput";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import {
  RelationshipEditor,
  type RelationshipDraft,
} from "@/components/RelationshipEditor";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText } from "@/components/ui";
import { getAppSettings } from "@/db/app-settings-dao";
import { getContactHeader } from "@/db/contact-read";
import {
  applyContactMethodDiff,
  listContactMethods,
} from "@/db/contact-methods-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { setCurrentStateValue } from "@/db/current-state-history-dao";
import { getCurrentStateValue } from "@/db/current-state-history-read";
import { defsForEditForm, getValuesForContact, upsertValue } from "@/db/field-values-dao";
import { listDefs } from "@/db/field-defs-dao";
import type { CustomFieldDef } from "@/db/field-types";
import { addFuel, deleteFuel, editFuel } from "@/db/fuel-dao";
import { type FuelItem, listFuelForEditor } from "@/db/fuel-read";
import type { CurrentStateFieldKey } from "@/db/memory-registry";
import { setProfileContactFrequency } from "@/db/profile-relationship-actions";
import {
  addRelationship,
  deleteRelationship,
  editRelationship,
  restoreRelationship,
} from "@/db/relationships-dao";
import {
  listRelationshipsForContact,
  type RelationshipRow,
} from "@/db/relationships-read";
import { newUid } from "@/db/uid";
import { getDeviceRegion } from "@/services/device-region";
import type { DashboardScreenProps } from "@/navigation/types";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import {
  buildChooserRows,
  type ChooserRow,
  finishSession,
  cancelRow,
  completeSave,
  openRow,
  selectApplicableDefs,
  startSession,
  targetContact,
} from "./update-contact-chooser-logic";

const LOG_SCOPE = "update-contact-screen";
const FAILURE_COPY = "Couldn't save. Please try again.";
const DEFAULT_INTERVAL_DAYS = 30;

/** Shared focused-editor frame: locked failure copy + Cancel affordance. */
function EditorFrame({
  title,
  error,
  onCancel,
  children,
}: {
  title: string;
  error: boolean;
  onCancel: () => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.editor}>
      <AppText accessibilityRole="header" role="heading">
        {title}
      </AppText>
      {children}
      {error ? (
        <AppText role="caption" style={{ color: colors.danger }}>
          {FAILURE_COPY}
        </AppText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        onPress={onCancel}
        style={[styles.secondary, { borderColor: colors.border }]}
      >
        <AppText role="body" style={{ color: colors.textSecondary }}>
          Cancel
        </AppText>
      </Pressable>
    </View>
  );
}

function PrimaryButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.primary,
        {
          backgroundColor: disabled ? colors.surface : colors.accent,
          borderColor: disabled ? colors.border : colors.accent,
        },
      ]}
    >
      <AppText
        role="body"
        style={{ color: disabled ? colors.textSecondary : colors.onAccent }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

/** Last Talked About / Current Location — a current-state text value (D-10). */
function CurrentStateFocusedEditor({
  contactId,
  fieldKey,
  title,
  onSaved,
  onCancel,
}: {
  contactId: number;
  fieldKey: CurrentStateFieldKey;
  title: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const [value, setValue] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getCurrentStateValue(getExecutor(), contactId, fieldKey)
      .then((row) => {
        if (!cancelled) setCurrent(row?.value ?? null);
      })
      .catch((cause) =>
        Logger.error(LOG_SCOPE, "failed to seed current-state value", cause),
      );
    return () => {
      cancelled = true;
    };
  }, [contactId, fieldKey]);

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(false);
    try {
      await setCurrentStateValue(getExecutor(), {
        contactId,
        fieldKey,
        value: trimmed,
        now: localDateTime(),
      });
      onSaved();
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to save current-state value", cause);
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <EditorFrame title={title} error={error} onCancel={onCancel}>
      <AppText role="caption" style={{ color: colors.textSecondary }}>
        {current ? `Most recent: ${current}` : "Not set"}
      </AppText>
      <TextInput
        accessibilityLabel={`New ${title} value`}
        value={value}
        onChangeText={setValue}
        placeholder="Set a new value"
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
      <PrimaryButton label="Save" disabled={!value.trim() || saving} onPress={() => void save()} />
    </EditorFrame>
  );
}

/** Key People / Relationships — the canonical RelationshipEditor. */
function KeyPeopleFocusedEditor({
  contactId,
  onSaved,
  onCancel,
}: {
  contactId: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [items, setItems] = useState<RelationshipRow[]>([]);
  const [savedTick, setSavedTick] = useState(0);

  const load = useCallback(async () => {
    const rows = await listRelationshipsForContact(getExecutor(), contactId);
    setItems(rows);
  }, [contactId]);

  useEffect(() => {
    void load().catch((cause) =>
      Logger.error(LOG_SCOPE, "failed to load relationships", cause),
    );
  }, [load]);

  // Defer return-to-chooser so RelationshipEditor finishes its own close().
  useEffect(() => {
    if (savedTick > 0) onSaved();
  }, [savedTick, onSaved]);

  const add = async (draft: RelationshipDraft): Promise<boolean> => {
    try {
      const now = localDateTime();
      await addRelationship(getExecutor(), { contactId, ...draft, createdAt: now, now });
      setSavedTick((tick) => tick + 1);
      return true;
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to add relationship", cause);
      return false;
    }
  };
  const edit = async (id: number, draft: RelationshipDraft): Promise<boolean> => {
    try {
      await editRelationship(getExecutor(), { id, contactId, ...draft, now: localDateTime() });
      setSavedTick((tick) => tick + 1);
      return true;
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to edit relationship", cause);
      return false;
    }
  };
  const restore = (id: number) =>
    void restoreRelationship(getExecutor(), { id, contactId, now: localDateTime() })
      .then(load)
      .catch((cause) => Logger.error(LOG_SCOPE, "failed to restore relationship", cause));
  const remove = (id: number) =>
    void deleteRelationship(getExecutor(), { id, contactId, now: localDateTime() })
      .then(() => {
        void load();
        showSnackbar({
          kind: "success",
          label: "Relationship removed",
          action: {
            label: "Undo",
            accessibilityLabel: "Undo removing relationship",
            onPress: () => restore(id),
          },
        });
      })
      .catch((cause) => Logger.error(LOG_SCOPE, "failed to delete relationship", cause));

  return (
    <EditorFrame title="Key people" error={false} onCancel={onCancel}>
      <RelationshipEditor
        contactId={contactId}
        items={items}
        onAdd={add}
        onEdit={edit}
        onDelete={remove}
        onRestore={restore}
      />
    </EditorFrame>
  );
}

/** Off Limits — a focused editor over the contact's off_limits fuel rows. */
function OffLimitsFocusedEditor({
  contactId,
  onSaved,
  onCancel,
}: {
  contactId: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const [items, setItems] = useState<FuelItem[]>([]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const rows = await listFuelForEditor(getExecutor(), contactId);
    setItems(rows.filter((row) => row.kind === "off_limits"));
  }, [contactId]);

  useEffect(() => {
    void load().catch((cause) =>
      Logger.error(LOG_SCOPE, "failed to load off-limits", cause),
    );
  }, [load]);

  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(false);
    try {
      const now = localDateTime();
      if (editingId === null) {
        await addFuel(getExecutor(), {
          uid: newUid(),
          contactId,
          kind: "off_limits",
          text: trimmed,
          createdAt: now,
          source: "manual",
          now,
        });
      } else {
        await editFuel(getExecutor(), {
          id: editingId,
          contactId,
          kind: "off_limits",
          text: trimmed,
          now,
        });
      }
      onSaved();
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to save off-limits", cause);
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const remove = (id: number) =>
    void deleteFuel(getExecutor(), { id, contactId, now: localDateTime() })
      .then(load)
      .catch((cause) => Logger.error(LOG_SCOPE, "failed to delete off-limits", cause));

  return (
    <EditorFrame title="Off Limits" error={error} onCancel={onCancel}>
      {items.map((item) => (
        <View
          key={item.id}
          style={[styles.listRow, { borderColor: colors.border }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.text ?? "off-limits topic"}`}
            onPress={() => {
              setEditingId(item.id);
              setDraft(item.text ?? "");
            }}
            style={styles.listRowMain}
          >
            <AppText role="body">{item.text ?? item.label ?? ""}</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.text ?? "off-limits topic"}`}
            onPress={() => remove(item.id)}
            style={[styles.smallAction, { borderColor: colors.border }]}
          >
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              Remove
            </AppText>
          </Pressable>
        </View>
      ))}
      <TextInput
        accessibilityLabel="Off-limits topic"
        value={draft}
        onChangeText={setDraft}
        placeholder="What should you avoid?"
        placeholderTextColor={colors.textSecondary}
        multiline
        style={[
          styles.input,
          styles.multiline,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      />
      <PrimaryButton
        label={editingId === null ? "Add" : "Save"}
        disabled={!draft.trim() || saving}
        onPress={() => void save()}
      />
    </EditorFrame>
  );
}

/** Contact Method — the canonical ContactMethodsEditor + diff writer. */
function ContactMethodFocusedEditor({
  contactId,
  onSaved,
  onCancel,
}: {
  contactId: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [groups, setGroups] = useState<MethodGroups>({ phone: [], email: [] });
  const [seeded, setSeeded] = useState<Awaited<ReturnType<typeof listContactMethods>>>([]);
  const [region, setRegion] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const exec = getExecutor();
      const [rows, settings] = await Promise.all([
        listContactMethods(exec, contactId),
        getAppSettings(exec),
      ]);
      if (cancelled) return;
      setSeeded(rows);
      setGroups(
        seedMethodGroups({
          phone: rows.filter((row) => row.method_type === "phone"),
          email: rows.filter((row) => row.method_type === "email"),
        }),
      );
      setRegion(
        resolveEffectivePhoneRegion(settings.phoneRegionOverride, getDeviceRegion()),
      );
    })().catch((cause) =>
      Logger.error(LOG_SCOPE, "failed to seed contact methods", cause),
    );
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(false);
    try {
      await applyContactMethodDiff(getExecutor(), {
        contactId,
        seeded,
        current: toMethodDrafts(groups),
        now: localDateTime(),
        effectivePhoneRegion: region,
      });
      onSaved();
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to save contact methods", cause);
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <EditorFrame title="Contact Method" error={error} onCancel={onCancel}>
      <ContactMethodsEditor
        methods={groups}
        onAdd={(type) => setGroups((g) => addMethodDraft(g, type, newUid()))}
        onUpdate={(uid, patch) => setGroups((g) => updateMethodDraft(g, uid, patch))}
        onRemove={(uid) => setGroups((g) => removeMethodDraft(g, uid))}
        onChoosePrimary={(uid) => setGroups((g) => choosePrimary(g, uid))}
      />
      <PrimaryButton label="Save" disabled={saving} onPress={() => void save()} />
    </EditorFrame>
  );
}

/** Contact Frequency — the canonical FrequencyPicker (cadence-only, §AB). */
function ContactFrequencyFocusedEditor({
  contactId,
  onSaved,
  onCancel,
}: {
  contactId: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [intervalDays, setIntervalDays] = useState(DEFAULT_INTERVAL_DAYS);
  const [valid, setValid] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getContactHeader(getExecutor(), contactId)
      .then((header) => {
        if (!cancelled && header?.intervalDays != null)
          setIntervalDays(header.intervalDays);
      })
      .catch((cause) =>
        Logger.error(LOG_SCOPE, "failed to seed contact frequency", cause),
      );
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const save = async () => {
    if (saving || !valid) return;
    setSaving(true);
    setError(false);
    try {
      await setProfileContactFrequency(getExecutor(), {
        contactId,
        intervalDays,
        now: localDateTime(),
      });
      onSaved();
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to save contact frequency", cause);
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <EditorFrame title="Contact Frequency" error={error} onCancel={onCancel}>
      <FrequencyPicker
        value={intervalDays}
        onChange={setIntervalDays}
        onValidityChange={setValid}
      />
      <PrimaryButton label="Save" disabled={saving || !valid} onPress={() => void save()} />
    </EditorFrame>
  );
}

/** A single custom field — the canonical FieldValueInput + normalized writer. */
function CustomFieldFocusedEditor({
  contactId,
  def,
  onSaved,
  onCancel,
}: {
  contactId: number;
  def: CustomFieldDef;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getValuesForContact(getExecutor(), contactId, [def])
      .then((values) => {
        if (!cancelled) setValue(values[def.col_name] ?? null);
      })
      .catch((cause) =>
        Logger.error(LOG_SCOPE, "failed to seed custom field value", cause),
      );
    return () => {
      cancelled = true;
    };
  }, [contactId, def]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(false);
    try {
      await upsertValue(
        getExecutor(),
        contactId,
        def.id,
        newUid(),
        value,
        localDateTime(),
      );
      onSaved();
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to save custom field value", cause);
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <EditorFrame title={def.label} error={error} onCancel={onCancel}>
      <FieldValueInput
        field={{ type: def.type, label: def.label, options: def.options, col_name: def.col_name }}
        value={value}
        onChange={setValue}
        contactId={contactId}
      />
      <PrimaryButton label="Save" disabled={saving} onPress={() => void save()} />
    </EditorFrame>
  );
}

/** Generic Custom Fields — pick a less-prominent existing field, then edit it. */
function GenericCustomFieldsFocusedEditor({
  contactId,
  defs,
  onSaved,
  onCancel,
}: {
  contactId: number;
  defs: CustomFieldDef[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<CustomFieldDef | null>(null);

  if (selected) {
    return (
      <CustomFieldFocusedEditor
        contactId={contactId}
        def={selected}
        onSaved={onSaved}
        onCancel={() => setSelected(null)}
      />
    );
  }

  return (
    <EditorFrame title="Custom Fields" error={false} onCancel={onCancel}>
      {defs.length === 0 ? (
        <AppText role="body" style={{ color: colors.textSecondary }}>
          No custom fields yet.
        </AppText>
      ) : (
        defs.map((def) => (
          <Pressable
            key={def.id}
            accessibilityRole="button"
            accessibilityLabel={def.label}
            onPress={() => setSelected(def)}
            style={[styles.listRow, { borderColor: colors.border }]}
          >
            <AppText role="body">{def.label}</AppText>
          </Pressable>
        ))
      )}
    </EditorFrame>
  );
}

export function UpdateContactScreen({
  navigation,
  route,
}: DashboardScreenProps<"UpdateContact">) {
  const { colors } = useTheme();
  const [session, setSession] = useState(() =>
    startSession(route.params?.contactId ?? null),
  );
  const [rows, setRows] = useState<ChooserRow[]>([]);
  const [liveDefs, setLiveDefs] = useState<CustomFieldDef[]>([]);

  const contactId = session.contactId;

  const load = useCallback(
    async (id: number, cancelled: () => boolean = () => false) => {
      const exec = getExecutor();
      const defs = await listDefs(exec, { includeQuarantined: false });
      const values = await getValuesForContact(exec, id, defs);
      if (cancelled()) return;
      setLiveDefs(defsForEditForm(defs));
      setRows(buildChooserRows({ id }, selectApplicableDefs(defs, values)));
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      if (contactId === null) return;
      let cancelled = false;
      void load(contactId, () => cancelled).catch((error) => {
        Logger.error(LOG_SCOPE, "failed to build chooser rows", error);
        if (!cancelled) setRows(buildChooserRows({ id: contactId }, []));
      });
      return () => {
        cancelled = true;
      };
    }, [contactId, load]),
  );

  const onPickContact = (id: number) => setSession((s) => targetContact(s, id));
  const onDone = () => {
    setSession((s) => finishSession(s));
    navigation.goBack();
  };
  const onSaved = () => setSession((s) => completeSave(s));
  const onCancel = () => setSession((s) => cancelRow(s));

  const onSelectRow = (row: ChooserRow) => {
    if (contactId === null) return;
    if (row.kind === "memory") {
      navigation.navigate("Memory", { contactId });
      return;
    }
    setSession((s) => openRow(s, row.key));
  };

  if (contactId === null) {
    return (
      <View style={styles.root}>
        <ShellAppBar variant="child" title="Update Contact" />
        <ContactPicker
          visible
          mode="single"
          onSelect={onPickContact}
          onDismiss={() => navigation.goBack()}
        />
      </View>
    );
  }

  const activeRow = rows.find((row) => row.key === session.activeRowKey) ?? null;

  const renderActiveEditor = () => {
    if (!activeRow) return null;
    switch (activeRow.kind) {
      case "last_talked_about":
      case "current_location":
        return (
          <CurrentStateFocusedEditor
            contactId={contactId}
            fieldKey={activeRow.kind}
            title={activeRow.label}
            onSaved={onSaved}
            onCancel={onCancel}
          />
        );
      case "key_people":
        return (
          <KeyPeopleFocusedEditor contactId={contactId} onSaved={onSaved} onCancel={onCancel} />
        );
      case "off_limits":
        return (
          <OffLimitsFocusedEditor contactId={contactId} onSaved={onSaved} onCancel={onCancel} />
        );
      case "contact_method":
        return (
          <ContactMethodFocusedEditor contactId={contactId} onSaved={onSaved} onCancel={onCancel} />
        );
      case "contact_frequency":
        return (
          <ContactFrequencyFocusedEditor contactId={contactId} onSaved={onSaved} onCancel={onCancel} />
        );
      case "custom_field": {
        const def = liveDefs.find((d) => d.id === activeRow.fieldDefId);
        if (!def) return null;
        return (
          <CustomFieldFocusedEditor
            contactId={contactId}
            def={def}
            onSaved={onSaved}
            onCancel={onCancel}
          />
        );
      }
      case "custom_fields":
        return (
          <GenericCustomFieldsFocusedEditor
            contactId={contactId}
            defs={liveDefs}
            onSaved={onSaved}
            onCancel={onCancel}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Update Contact" />
      <ScrollView contentContainerStyle={styles.content}>
        {session.activeRowKey !== null ? (
          renderActiveEditor()
        ) : (
          <>
            {rows.map((row) => {
              const recent = session.lastSavedRowKey === row.key;
              return (
                <Pressable
                  key={row.key}
                  accessibilityRole="button"
                  accessibilityLabel={row.label}
                  onPress={() => onSelectRow(row)}
                  style={[
                    styles.row,
                    {
                      backgroundColor: colors.surface,
                      borderColor: recent ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <AppText role="body">{row.label}</AppText>
                  {recent ? (
                    <AppText role="caption" style={{ color: colors.accent }}>
                      Updated
                    </AppText>
                  ) : null}
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={onDone}
              style={[styles.done, { borderColor: colors.accent }]}
            >
              <AppText role="body" style={{ color: colors.accentText }}>
                Done
              </AppText>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: SPACING.sm, padding: SPACING.base },
  row: {
    alignItems: "center",
    borderRadius: RADII.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: SPACING.base,
  },
  done: {
    alignItems: "center",
    borderRadius: RADII.md,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: SPACING.md,
    minHeight: 48,
  },
  editor: {
    borderRadius: RADII.md,
    gap: SPACING.md,
  },
  input: {
    borderRadius: RADII.sm,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  multiline: { minHeight: 84, textAlignVertical: "top" },
  primary: {
    alignItems: "center",
    borderRadius: RADII.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  secondary: {
    alignItems: "center",
    borderRadius: RADII.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  listRow: {
    alignItems: "center",
    borderRadius: RADII.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
  },
  listRowMain: { flex: 1, justifyContent: "center", minHeight: 44 },
  smallAction: {
    alignItems: "center",
    borderRadius: RADII.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: SPACING.sm,
  },
});
