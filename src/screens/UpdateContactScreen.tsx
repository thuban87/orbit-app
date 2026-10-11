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
import {
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { ContactMethodsEditor } from "@/components/ContactMethodsEditor";
import { ContactPicker } from "@/components/ContactPicker";
import {
  addMethodDraft,
  choosePrimary,
  type MethodGroups,
  removeMethodDraft,
  resolveEffectivePhoneRegion,
  seedMethodGroups,
  toMethodDrafts,
  updateMethodDraft,
} from "@/components/contact-methods-editor-model";
import { FieldValueInput } from "@/components/FieldValueInput";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import {
  type RelationshipDraft,
  type RelationshipDraftState,
  RelationshipEditor,
  type RelationshipEditorHandle,
} from "@/components/RelationshipEditor";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText } from "@/components/ui";
import { getAppSettings } from "@/db/app-settings-dao";
import {
  applyContactMethodDiff,
  listContactMethods,
} from "@/db/contact-methods-dao";
import { getContactHeader } from "@/db/contact-read";
import { setCurrentStateValue } from "@/db/current-state-history-dao";
import { getCurrentStateValue } from "@/db/current-state-history-read";
import { saveUserCustomValueEdit } from "@/db/custom-value-edit-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { listDefs } from "@/db/field-defs-dao";
import type { CustomFieldDef } from "@/db/field-types";
import { defsForEditForm, getValuesForContact } from "@/db/field-values-dao";
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
import { useContactHeader } from "@/hooks/use-contact-header";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { getDeviceRegion } from "@/services/device-region";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import {
  beginInFlight,
  endInFlight,
  type InFlightRef,
} from "@/utils/single-flight";
import {
  buildChooserRows,
  type ChooserRow,
  cancelRow,
  completeSave,
  type FrequencyDraft,
  finishSession,
  isRowDraftDirty,
  openRow,
  resolveUpdateEditorClose,
  selectApplicableDefs,
  startSession,
  targetContact,
} from "./update-contact-chooser-logic";

const LOG_SCOPE = "update-contact-screen";
const FAILURE_COPY = "Couldn't save. Please try again.";
const DEFAULT_INTERVAL_DAYS = 30;

/**
 * Reports an editor's typed-changes state to the screen's guard (38.9 D-14,
 * D-61): on every change, and `false` on unmount so a closed editor never
 * holds Back. The callback is read through a ref so a fresh closure each
 * render never re-fires the report.
 */
function useReportDirty(
  dirty: boolean,
  onDirtyChange: ((dirty: boolean) => void) | undefined,
): void {
  const callbackRef = useRef(onDirtyChange);
  callbackRef.current = onDirtyChange;
  useEffect(() => {
    callbackRef.current?.(dirty);
  }, [dirty]);
  useEffect(() => () => callbackRef.current?.(false), []);
}

/**
 * The open row editor's save slot, owned by the screen (fix-pass WR-02). The
 * screen's guard reads `ref` at removal time to hold Back while a row save
 * runs; `onSavingChange` draws the header Back disabled (D-26). One row editor
 * is open at a time, so one slot serves them all.
 */
type RowSave = {
  ref: InFlightRef;
  onSavingChange: (saving: boolean) => void;
  /**
   * The guard's `settleHold` (third fix pass WR-01): called in each row
   * save's `finally` after the slot is released, so a widget or notification
   * RESET held during the save is dispatched again, not lost.
   */
  settleHold: () => void;
};

/** A row editor's `saving` state, mirrored to the screen's `RowSave`. */
function useRowSave(rowSave: RowSave) {
  const [saving, setSavingState] = useState(false);
  const setSaving = (next: boolean) => {
    setSavingState(next);
    rowSave.onSavingChange(next);
  };
  return { saving, setSaving, savingRef: rowSave.ref };
}

/** The Button.tsx disabled look (D-26 "dimmed") for this file's Pressables. */
const DISABLED_OPACITY = 0.5;

/** Shared focused-editor frame: locked failure copy + Cancel affordance. */
function EditorFrame({
  title,
  error,
  onCancel,
  cancelDisabled = false,
  children,
}: {
  title: string;
  error: boolean;
  onCancel: () => void;
  /**
   * The row's save is in flight (WR-02 follow-up; D-13, D-14): Cancel is held
   * and drawn disabled (D-26) so it cannot close the row while the save
   * commits. Absent → false.
   */
  cancelDisabled?: boolean;
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
        accessibilityState={{ disabled: cancelDisabled }}
        disabled={cancelDisabled}
        onPress={onCancel}
        style={[
          styles.secondary,
          { borderColor: colors.border },
          cancelDisabled ? styles.disabled : null,
        ]}
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
  onDirtyChange,
  rowSave,
}: {
  contactId: number;
  fieldKey: CurrentStateFieldKey;
  title: string;
  onSaved: () => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  rowSave: RowSave;
}) {
  const { colors } = useTheme();
  const [value, setValue] = useState("");
  useReportDirty(
    isRowDraftDirty({ kind: "text", seed: "", current: value }),
    onDirtyChange,
  );
  const [current, setCurrent] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const { saving, setSaving, savingRef } = useRowSave(rowSave);

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
    if (!trimmed) return;
    // Synchronous single-flight guard — a double-tap must not write twice (WR-03).
    if (!beginInFlight(savingRef)) return;
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
      endInFlight(savingRef);
      rowSave.settleHold();
    }
  };

  return (
    <EditorFrame
      title={title}
      error={error}
      onCancel={onCancel}
      cancelDisabled={saving}
    >
      <AppText role="caption" style={{ color: colors.textSecondary }}>
        {current ? `Most recent: ${current}` : "Not set"}
      </AppText>
      <TextInput
        accessibilityLabel={`New ${title} value`}
        value={value}
        onChangeText={setValue}
        placeholder="Set a new value"
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
      <PrimaryButton
        label="Save"
        disabled={!value.trim() || saving}
        onPress={() => void save()}
      />
    </EditorFrame>
  );
}

/** Key People / Relationships — the canonical RelationshipEditor. */
function KeyPeopleFocusedEditor({
  contactId,
  onSaved,
  onCancel,
  relationshipRef,
  onDraftStateChange,
  onCancelRequest,
  rowSave,
}: {
  contactId: number;
  onSaved: () => void;
  onCancel: () => void;
  /** The open key-person form is the inner level (D-14). */
  relationshipRef: Ref<RelationshipEditorHandle>;
  onDraftStateChange: (state: RelationshipDraftState) => void;
  onCancelRequest: (close: () => void) => void;
  rowSave: RowSave;
}) {
  const [items, setItems] = useState<RelationshipRow[]>([]);
  const [savedTick, setSavedTick] = useState(0);
  // Synchronous single-flight guard so a double-tap cannot INSERT a duplicate
  // relationship (WR-03); shared with edit for consistency. The screen's slot,
  // so its guard holds Back while a save runs (fix-pass WR-02).
  const { saving, setSaving, savingRef } = useRowSave(rowSave);

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
    if (!beginInFlight(savingRef)) return false;
    setSaving(true);
    try {
      const now = localDateTime();
      await addRelationship(getExecutor(), {
        contactId,
        ...draft,
        createdAt: now,
        now,
      });
      setSavedTick((tick) => tick + 1);
      return true;
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to add relationship", cause);
      return false;
    } finally {
      setSaving(false);
      endInFlight(savingRef);
      rowSave.settleHold();
    }
  };
  const edit = async (
    id: number,
    draft: RelationshipDraft,
  ): Promise<boolean> => {
    if (!beginInFlight(savingRef)) return false;
    setSaving(true);
    try {
      await editRelationship(getExecutor(), {
        id,
        contactId,
        ...draft,
        now: localDateTime(),
      });
      setSavedTick((tick) => tick + 1);
      return true;
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to edit relationship", cause);
      return false;
    } finally {
      setSaving(false);
      endInFlight(savingRef);
      rowSave.settleHold();
    }
  };
  const restore = (id: number) =>
    void restoreRelationship(getExecutor(), {
      id,
      contactId,
      now: localDateTime(),
    })
      .then(load)
      .catch((cause) =>
        Logger.error(LOG_SCOPE, "failed to restore relationship", cause),
      );
  const remove = (id: number) =>
    void deleteRelationship(getExecutor(), {
      id,
      contactId,
      now: localDateTime(),
    })
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
      .catch((cause) =>
        Logger.error(LOG_SCOPE, "failed to delete relationship", cause),
      );

  return (
    <EditorFrame
      title="Key people"
      error={false}
      onCancel={onCancel}
      cancelDisabled={saving}
    >
      <RelationshipEditor
        contactId={contactId}
        items={items}
        onAdd={add}
        onEdit={edit}
        onDelete={remove}
        onRestore={restore}
        ref={relationshipRef}
        onDraftStateChange={onDraftStateChange}
        onCancelRequest={onCancelRequest}
        busy={saving}
      />
    </EditorFrame>
  );
}

/** Off Limits — a focused editor over the contact's off_limits fuel rows. */
function OffLimitsFocusedEditor({
  contactId,
  onSaved,
  onCancel,
  onDirtyChange,
  rowSave,
}: {
  contactId: number;
  onSaved: () => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  rowSave: RowSave;
}) {
  const { colors } = useTheme();
  const [items, setItems] = useState<FuelItem[]>([]);
  const [draft, setDraft] = useState("");
  // Per-edit seed (review C4-M3): "" for a new item, the item's text once an
  // existing item is selected, re-seeded whenever the selection changes.
  const [draftSeed, setDraftSeed] = useState("");
  useReportDirty(
    isRowDraftDirty({ kind: "text", seed: draftSeed, current: draft }),
    onDirtyChange,
  );
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const { saving, setSaving, savingRef } = useRowSave(rowSave);

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
    if (!trimmed) return;
    // The add branch mints a fresh newUid() per call, so UNIQUE cannot catch a
    // double-tap duplicate — the synchronous ref guard is what prevents it (WR-03).
    if (!beginInFlight(savingRef)) return;
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
      endInFlight(savingRef);
      rowSave.settleHold();
    }
  };

  const remove = (id: number) =>
    void deleteFuel(getExecutor(), { id, contactId, now: localDateTime() })
      .then(load)
      .catch((cause) =>
        Logger.error(LOG_SCOPE, "failed to delete off-limits", cause),
      );

  return (
    <EditorFrame
      title="Off Limits"
      error={error}
      onCancel={onCancel}
      cancelDisabled={saving}
    >
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
              setDraftSeed(item.text ?? "");
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
        placeholderTextColor={colors.textPlaceholder}
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
  onDirtyChange,
  rowSave,
}: {
  contactId: number;
  onSaved: () => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  rowSave: RowSave;
}) {
  const [groups, setGroups] = useState<MethodGroups>({ phone: [], email: [] });
  const [seeded, setSeeded] = useState<
    Awaited<ReturnType<typeof listContactMethods>>
  >([]);
  const seedGroups = useMemo(
    () =>
      seedMethodGroups({
        phone: seeded.filter((row) => row.method_type === "phone"),
        email: seeded.filter((row) => row.method_type === "email"),
      }),
    [seeded],
  );
  useReportDirty(
    isRowDraftDirty({ kind: "methods", seed: seedGroups, current: groups }),
    onDirtyChange,
  );
  const [region, setRegion] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const { saving, setSaving, savingRef } = useRowSave(rowSave);

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
        resolveEffectivePhoneRegion(
          settings.phoneRegionOverride,
          getDeviceRegion(),
        ),
      );
    })().catch((cause) =>
      Logger.error(LOG_SCOPE, "failed to seed contact methods", cause),
    );
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const save = async () => {
    if (!beginInFlight(savingRef)) return;
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
      endInFlight(savingRef);
      rowSave.settleHold();
    }
  };

  return (
    <EditorFrame
      title="Contact Method"
      error={error}
      onCancel={onCancel}
      cancelDisabled={saving}
    >
      <ContactMethodsEditor
        methods={groups}
        onAdd={(type) => setGroups((g) => addMethodDraft(g, type, newUid()))}
        onUpdate={(uid, patch) =>
          setGroups((g) => updateMethodDraft(g, uid, patch))
        }
        onRemove={(uid) => setGroups((g) => removeMethodDraft(g, uid))}
        onChoosePrimary={(uid) => setGroups((g) => choosePrimary(g, uid))}
      />
      <PrimaryButton
        label="Save"
        disabled={saving}
        onPress={() => void save()}
      />
    </EditorFrame>
  );
}

/** Contact Frequency — the canonical FrequencyPicker (cadence-only, §AB). */
function ContactFrequencyFocusedEditor({
  contactId,
  onSaved,
  onCancel,
  onDirtyChange,
  rowSave,
}: {
  contactId: number;
  onSaved: () => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  rowSave: RowSave;
}) {
  const [intervalDays, setIntervalDays] = useState(DEFAULT_INTERVAL_DAYS);
  const [valid, setValid] = useState(true);
  const [error, setError] = useState(false);
  const { saving, setSaving, savingRef } = useRowSave(rowSave);
  // Dirty seed (C5-L6): the interval once the header read settles
  // (DEFAULT_INTERVAL_DAYS when the stored interval is null or the read
  // fails) and the picker's custom-entry draft at that point. Until the read
  // settles the editor reports clean.
  const [headerSeed, setHeaderSeed] = useState<number | null>(null);
  const [draft, setDraft] = useState<FrequencyDraft | null>(null);
  const [seedDraft, setSeedDraft] = useState<FrequencyDraft | null>(null);
  const latestDraftRef = useRef<FrequencyDraft | null>(null);
  const seedDraftTakenRef = useRef(false);
  const settledRef = useRef(false);

  const onDraftChange = useCallback((next: FrequencyDraft) => {
    latestDraftRef.current = next;
    setDraft(next);
    if (settledRef.current && !seedDraftTakenRef.current) {
      seedDraftTakenRef.current = true;
      setSeedDraft(next);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const settle = (seed: number) => {
      settledRef.current = true;
      setHeaderSeed(seed);
      if (latestDraftRef.current !== null) {
        seedDraftTakenRef.current = true;
        setSeedDraft(latestDraftRef.current);
      }
    };
    void getContactHeader(getExecutor(), contactId)
      .then((header) => {
        if (cancelled) return;
        if (header?.intervalDays != null) {
          setIntervalDays(header.intervalDays);
          settle(header.intervalDays);
        } else {
          settle(DEFAULT_INTERVAL_DAYS);
        }
      })
      .catch((cause) => {
        Logger.error(LOG_SCOPE, "failed to seed contact frequency", cause);
        if (!cancelled) settle(DEFAULT_INTERVAL_DAYS);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  useReportDirty(
    isRowDraftDirty({
      kind: "frequency",
      seed:
        headerSeed === null
          ? null
          : { intervalDays: headerSeed, draft: seedDraft },
      current: { intervalDays, draft },
    }),
    onDirtyChange,
  );

  const save = async () => {
    if (!valid) return;
    if (!beginInFlight(savingRef)) return;
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
      endInFlight(savingRef);
      rowSave.settleHold();
    }
  };

  return (
    <EditorFrame
      title="Contact Frequency"
      error={error}
      onCancel={onCancel}
      cancelDisabled={saving}
    >
      <FrequencyPicker
        value={intervalDays}
        onChange={setIntervalDays}
        onValidityChange={setValid}
        onDraftChange={onDraftChange}
      />
      <PrimaryButton
        label="Save"
        disabled={saving || !valid}
        onPress={() => void save()}
      />
    </EditorFrame>
  );
}

/** A single custom field — the canonical FieldValueInput + normalized writer. */
function CustomFieldFocusedEditor({
  contactId,
  def,
  onSaved,
  onCancel,
  onDirtyChange,
  rowSave,
}: {
  contactId: number;
  def: CustomFieldDef;
  onSaved: () => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  rowSave: RowSave;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [seedValue, setSeedValue] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const { saving, setSaving, savingRef } = useRowSave(rowSave);
  const [seedReady, setSeedReady] = useState(false);
  useReportDirty(
    isRowDraftDirty({
      kind: "custom_field",
      ready: seedReady,
      seed: seedValue,
      current: value,
    }),
    onDirtyChange,
  );

  useEffect(() => {
    let cancelled = false;
    setSeedReady(false);
    void getValuesForContact(getExecutor(), contactId, [def])
      .then((values) => {
        if (!cancelled) {
          setValue(values[def.col_name] ?? null);
          setSeedValue(values[def.col_name] ?? null);
          setSeedReady(true);
        }
      })
      .catch((cause) => {
        Logger.error(LOG_SCOPE, "failed to seed custom field value", cause);
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId, def]);

  const save = async () => {
    if (!seedReady || !beginInFlight(savingRef)) return;
    setSaving(true);
    setError(false);
    try {
      await saveUserCustomValueEdit(getExecutor(), {
        contactId,
        fieldDefId: def.id,
        value,
        now: localDateTime(),
      });
      onSaved();
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to save custom field value", cause);
      setError(true);
    } finally {
      setSaving(false);
      endInFlight(savingRef);
      rowSave.settleHold();
    }
  };

  return (
    <EditorFrame
      title={def.label}
      error={error}
      onCancel={onCancel}
      cancelDisabled={saving}
    >
      <FieldValueInput
        field={{
          type: def.type,
          label: def.label,
          options: def.options,
          col_name: def.col_name,
        }}
        value={value}
        onChange={setValue}
        contactId={contactId}
      />
      <PrimaryButton
        label="Save"
        disabled={saving || !seedReady}
        onPress={() => void save()}
      />
    </EditorFrame>
  );
}

/** Generic Custom Fields — pick a less-prominent existing field, then edit it. */
function GenericCustomFieldsFocusedEditor({
  contactId,
  defs,
  selectedDefId,
  onSelect,
  onSaved,
  onCancel,
  onInnerCancel,
  onDirtyChange,
  rowSave,
}: {
  contactId: number;
  defs: CustomFieldDef[];
  /** The field opened from this chooser: the inner level (D-14; review H1). */
  selectedDefId: number | null;
  onSelect: (defId: number) => void;
  onSaved: () => void;
  /** The chooser's own Cancel (closes the row). */
  onCancel: () => void;
  /** The opened field's Cancel (closes back to this chooser). */
  onInnerCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  rowSave: RowSave;
}) {
  const { colors } = useTheme();
  const selected = defs.find((def) => def.id === selectedDefId) ?? null;

  if (selected) {
    return (
      <CustomFieldFocusedEditor
        contactId={contactId}
        def={selected}
        onSaved={onSaved}
        onCancel={onInnerCancel}
        onDirtyChange={onDirtyChange}
        rowSave={rowSave}
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
            onPress={() => onSelect(def.id)}
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
}: RootStackScreenProps<"UpdateContact">) {
  const { colors } = useTheme();
  const [session, setSession] = useState(() =>
    startSession(route.params?.contactId ?? null),
  );
  const [rows, setRows] = useState<ChooserRow[]>([]);
  const [liveDefs, setLiveDefs] = useState<CustomFieldDef[]>([]);

  const contactId = session.contactId;
  // D-45: the person line under the fixed title (none until a contact is chosen).
  const person = useContactHeader(contactId);

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
  // In-screen sub-editor guard (E-09; D-14, D-61). `activeRowDirty` always
  // describes the innermost open level (the Custom Fields chooser and the Key
  // people list hold no typed text of their own); each editor reports it and
  // reports false when it unmounts.
  const [activeRowDirty, setActiveRowDirty] = useState(false);
  const [genericSelectedDefId, setGenericSelectedDefId] = useState<
    number | null
  >(null);
  const [relationshipDraftOpen, setRelationshipDraftOpen] = useState(false);
  const relationshipRef = useRef<RelationshipEditorHandle>(null);
  const bypassRef = useRef(false);
  // The open row editor's save slot (fix-pass WR-02): the guard reads the ref,
  // the state draws the header Back disabled (D-26).
  const rowSavingRef = useRef(false);
  const [rowSaving, setRowSaving] = useState(false);
  const rowOpen = session.activeRowKey != null;
  const innerOpen = genericSelectedDefId !== null || relationshipDraftOpen;

  /** Closes one level: the inner editor, or the whole row. */
  function closeLevel(level: "inner" | "row" | null) {
    if (level === null) return;
    if (level === "inner") {
      if (genericSelectedDefId !== null) setGenericSelectedDefId(null);
      else relationshipRef.current?.closeDraft();
    } else {
      setSession((s) => cancelRow(s));
      setGenericSelectedDefId(null);
      setRelationshipDraftOpen(false);
    }
    setActiveRowDirty(false);
  }

  // Back (header, system key, system gesture) closes the innermost open level
  // and keeps the route, prompting only when it holds typed text.
  const { requestClose, settleHold } = useDiscardKeepGuard({
    hasUnsavedChanges: false,
    bypassRef,
    // A row save in flight holds every exit, with no prompt and no row close
    // (fix-pass WR-02).
    busyRef: rowSavingRef,
    subEditor: {
      open: session.activeRowKey != null,
      dirty: activeRowDirty,
      close: () =>
        closeLevel(
          resolveUpdateEditorClose({ rowOpen, innerOpen, target: "innermost" }),
        ),
    },
  });
  const rowSave: RowSave = {
    ref: rowSavingRef,
    onSavingChange: setRowSaving,
    settleHold,
  };

  /** A row editor's own Cancel (EditorFrame): closes the row (D-61). */
  function requestRowCancel() {
    requestClose(
      () =>
        closeLevel(
          resolveUpdateEditorClose({ rowOpen, innerOpen, target: "row" }),
        ),
      activeRowDirty,
    );
  }

  /** An inner editor's own Cancel: closes back to its row (D-61). */
  function requestInnerCancel() {
    requestClose(
      () =>
        closeLevel(
          resolveUpdateEditorClose({ rowOpen, innerOpen, target: "innermost" }),
        ),
      activeRowDirty,
    );
  }

  const onRelationshipDraftState = (state: RelationshipDraftState) => {
    setRelationshipDraftOpen(state.open);
    setActiveRowDirty(state.dirty);
  };

  // A successful inner save closes directly, with no prompt.
  const onSaved = () => {
    setSession((s) => completeSave(s));
    setGenericSelectedDefId(null);
    setRelationshipDraftOpen(false);
    setActiveRowDirty(false);
  };

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
        <ShellAppBar variant="child" title="Update Contact" person={person} />
        <ContactPicker
          visible
          mode="single"
          onSelect={onPickContact}
          onDismiss={() => navigation.goBack()}
        />
      </View>
    );
  }

  const activeRow =
    rows.find((row) => row.key === session.activeRowKey) ?? null;

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
            onCancel={requestRowCancel}
            rowSave={rowSave}
            onDirtyChange={setActiveRowDirty}
          />
        );
      case "key_people":
        return (
          <KeyPeopleFocusedEditor
            contactId={contactId}
            onSaved={onSaved}
            onCancel={requestRowCancel}
            rowSave={rowSave}
            relationshipRef={relationshipRef}
            onDraftStateChange={onRelationshipDraftState}
            onCancelRequest={() => requestInnerCancel()}
          />
        );
      case "off_limits":
        return (
          <OffLimitsFocusedEditor
            contactId={contactId}
            onSaved={onSaved}
            onCancel={requestRowCancel}
            rowSave={rowSave}
            onDirtyChange={setActiveRowDirty}
          />
        );
      case "contact_method":
        return (
          <ContactMethodFocusedEditor
            contactId={contactId}
            onSaved={onSaved}
            onCancel={requestRowCancel}
            rowSave={rowSave}
            onDirtyChange={setActiveRowDirty}
          />
        );
      case "contact_frequency":
        return (
          <ContactFrequencyFocusedEditor
            contactId={contactId}
            onSaved={onSaved}
            onCancel={requestRowCancel}
            rowSave={rowSave}
            onDirtyChange={setActiveRowDirty}
          />
        );
      case "custom_field": {
        const def = liveDefs.find((d) => d.id === activeRow.fieldDefId);
        if (!def) return null;
        return (
          <CustomFieldFocusedEditor
            contactId={contactId}
            def={def}
            onSaved={onSaved}
            onCancel={requestRowCancel}
            rowSave={rowSave}
            onDirtyChange={setActiveRowDirty}
          />
        );
      }
      case "custom_fields":
        return (
          <GenericCustomFieldsFocusedEditor
            contactId={contactId}
            defs={liveDefs}
            selectedDefId={genericSelectedDefId}
            onSelect={setGenericSelectedDefId}
            onSaved={onSaved}
            onCancel={requestRowCancel}
            rowSave={rowSave}
            onInnerCancel={requestInnerCancel}
            onDirtyChange={setActiveRowDirty}
          />
        );
      default:
        return null;
    }
  };

  // While a row save runs the guard holds Back, so it draws disabled (D-26;
  // WR-02).
  return (
    <View style={styles.root}>
      <ShellAppBar
        variant="child"
        title="Update Contact"
        person={person}
        backDisabled={rowSaving}
      />
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
                    <AppText
                      role="caption"
                      style={{ color: colors.accentText }}
                    >
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
  disabled: { opacity: DISABLED_OPACITY },
  smallAction: {
    alignItems: "center",
    borderRadius: RADII.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: SPACING.sm,
  },
});
