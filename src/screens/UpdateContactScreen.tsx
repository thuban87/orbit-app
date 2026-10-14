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
 * Current Location are `current_state` fields; a new entry is added through
 * `addCurrentStateEntry` keyed by `last_talked_about` / `current_location`,
 * dated today by default and never later (38.10 D-41, D-101). They record NO
 * interaction and never touch `last_contact` — they are NOT routed through
 * `TriStateLastSpoke` (the first-interaction control that writes
 * `last_contact`).
 *
 * 38.10: the Memory row opens an in-place memory editor (D-115); Off Limits
 * uses the dedicated Off Limits form and DAO (D-08); Key People and memory
 * deletes are immediate with Undo (D-69). No keyboard centring here (D-114).
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
  ActivityIndicator,
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
  type MemoryAiDefaults,
  type MemoryDraft,
  type MemoryDraftState,
  MemoryEditor,
  type MemoryEditorHandle,
  type MemoryEditPatch,
} from "@/components/MemoryEditor";
import {
  OffLimitsForm,
  type OffLimitsFormFields,
} from "@/components/OffLimitsForm";
import {
  type RelationshipDraft,
  type RelationshipDraftState,
  RelationshipEditor,
  type RelationshipEditorHandle,
} from "@/components/RelationshipEditor";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText, Button, EntryDateField } from "@/components/ui";
import {
  getAiPermissionDefaults,
  memoryAiDefaultsMap,
} from "@/db/ai-permissions-dao";
import { getAppSettings } from "@/db/app-settings-dao";
import {
  applyContactMethodDiff,
  listContactMethods,
} from "@/db/contact-methods-dao";
import { getContactHeader } from "@/db/contact-read";
import { addCurrentStateEntry } from "@/db/current-state-history-dao";
import { getCurrentStateValue } from "@/db/current-state-history-read";
import { saveUserCustomValueEdit } from "@/db/custom-value-edit-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { listDefs } from "@/db/field-defs-dao";
import type { CustomFieldDef } from "@/db/field-types";
import { defsForEditForm, getValuesForContact } from "@/db/field-values-dao";
import { LinkedNoteBlankError } from "@/db/linked-entry-dao";
import {
  addMemory,
  deleteMemoryNow,
  editMemory,
  type MemorySnapshot,
  undoMemoryDelete,
} from "@/db/memories-dao";
import { listMemoriesForContact, type MemoryRow } from "@/db/memories-read";
import {
  type CurrentStateFieldKey,
  isMemoryTypeKey,
} from "@/db/memory-registry";
import {
  addOffLimits,
  deleteOffLimits,
  editOffLimits,
  type OffLimitsSnapshot,
  undoDeleteOffLimits,
} from "@/db/off-limits-dao";
import {
  listOffLimitsForContact,
  type OffLimitsRow,
} from "@/db/off-limits-read";
import { setProfileContactFrequency } from "@/db/profile-relationship-actions";
import {
  addRelationship,
  deleteRelationshipNow,
  editRelationship,
  type RelationshipSnapshot,
  undoRelationshipDelete,
} from "@/db/relationships-dao";
import {
  listRelationshipsForContact,
  type RelationshipRow,
} from "@/db/relationships-read";
import { newUid } from "@/db/uid";
import { useContactHeader } from "@/hooks/use-contact-header";
import { isAiMasterEnabled } from "@/logic/ai-enablement";
import { type ReadPhase, readLoading, runGatedRead } from "@/logic/read-phase";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { getDeviceRegion } from "@/services/device-region";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { createLatestRequestAuthority } from "@/utils/latest-request";
import { Logger } from "@/utils/logger";
import {
  beginInFlight,
  endInFlight,
  type InFlightRef,
} from "@/utils/single-flight";
import {
  HISTORY_MOST_RECENT,
  isPickableEntryDate,
  maxPickableDate,
} from "./memory-history-logic";
import {
  createOffLimitsEditorController,
  type OffLimitsEditorOp,
  offLimitsDeletedSnackbar,
  offLimitsRestoredSnackbar,
} from "./off-limits-editor-controller";
import {
  deletedSnackbar,
  LINKED_ENTRY_NEEDS_TEXT,
  restoredSnackbar,
  sectionEntryNoun,
  sectionTitle,
} from "./section-editor-logic";
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

/** " for Ann", or "" while the person line has not loaded. */
function forName(name: string | null): string {
  return name === null || name.trim() === "" ? "" : ` for ${name}`;
}

/** An error snackbar with a Dismiss action (38.9 D-39; as the editors use). */
function errorNotice(label: string): void {
  showSnackbar({
    kind: "error",
    label,
    action: {
      label: "Dismiss",
      accessibilityLabel: "Dismiss error",
      onPress: () => {},
    },
  });
}

/** The person's name for a snackbar fired after an await. */
function useNameRef(name: string | null) {
  const nameRef = useRef<string | null>(name);
  nameRef.current = name;
  return nameRef;
}

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

/**
 * Last Talked About / Current Location — adds one dated entry (D-10, D-41).
 * The date defaults to today and cannot pass it (D-101); a direct entry
 * stores a date only (D-48). Most Recent is the read's first row (D-45).
 */
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
  // D-41 / D-101: today by default, never later.
  const [seedDate] = useState(() => maxPickableDate());
  const [entryDate, setEntryDate] = useState(seedDate);
  useReportDirty(
    isRowDraftDirty({ kind: "text", seed: "", current: value }) ||
      entryDate !== seedDate,
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

  const dateValid = isPickableEntryDate(entryDate);
  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed || !dateValid) return;
    // Synchronous single-flight guard — a double-tap must not write twice (WR-03).
    if (!beginInFlight(savingRef)) return;
    setSaving(true);
    setError(false);
    try {
      await addCurrentStateEntry(getExecutor(), {
        contactId,
        fieldKey,
        value: trimmed,
        entryDate,
        entryTime: null,
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
        {current ? `${HISTORY_MOST_RECENT}: ${current}` : "Not set"}
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
      <EntryDateField
        accessibilityLabel={`${title} date`}
        value={entryDate}
        onChange={setEntryDate}
        // D-101: never past today.
        maxDate={new Date()}
      />
      <PrimaryButton
        label="Save"
        disabled={!value.trim() || !dateValid || saving}
        onPress={() => void save()}
      />
    </EditorFrame>
  );
}

/** Key People / Relationships — the canonical RelationshipEditor. */
function KeyPeopleFocusedEditor({
  contactId,
  personName,
  onSaved,
  onCancel,
  relationshipRef,
  onDraftStateChange,
  onCancelRequest,
  rowSave,
}: {
  contactId: number;
  /** For the snackbars (38.9 D-39/D-46); null while it loads. */
  personName: string | null;
  onSaved: () => void;
  onCancel: () => void;
  /** The open key-person form is the inner level (D-14). */
  relationshipRef: Ref<RelationshipEditorHandle>;
  onDraftStateChange: (state: RelationshipDraftState) => void;
  onCancelRequest: (close: () => void) => void;
  rowSave: RowSave;
}) {
  const [items, setItems] = useState<RelationshipRow[]>([]);
  const nameRef = useNameRef(personName);
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
  // The same wording as the Key People editor (plan 15; proposed for the
  // plan-19 review): verb first, naming the person (38.9 D-39/D-46).
  const undoDelete = (snapshot: RelationshipSnapshot) => {
    void (async () => {
      try {
        await undoRelationshipDelete(getExecutor(), snapshot, localDateTime());
      } catch (cause) {
        Logger.error(LOG_SCOPE, "failed to undo a key person delete", cause);
        errorNotice("Couldn't undo the delete.");
        return;
      }
      void load().catch((cause) =>
        Logger.error(LOG_SCOPE, "failed to reload relationships", cause),
      );
      showSnackbar({
        kind: "success",
        label: `Key person restored${forName(nameRef.current)}`,
      });
    })();
  };
  // D-69: the delete happens at once (a hard delete with a tombstone) and
  // Undo puts it back.
  // `false` tells the editor the delete was dropped, so its form stays open
  // (the MemoryEditor contract; 38.10-18 moved Delete into the form).
  const remove = (id: number): boolean => {
    if (savingRef.current) return false;
    void (async () => {
      let snapshot: RelationshipSnapshot;
      try {
        snapshot = await deleteRelationshipNow(getExecutor(), {
          id,
          contactId,
          now: localDateTime(),
        });
      } catch (cause) {
        Logger.error(LOG_SCOPE, "failed to delete relationship", cause);
        errorNotice("Couldn't delete. Please try again.");
        return;
      }
      void load().catch((cause) =>
        Logger.error(LOG_SCOPE, "failed to reload relationships", cause),
      );
      // D-132: a delete reports in the warning style.
      showSnackbar({
        kind: "warning",
        label: `Deleted key person${forName(nameRef.current)}`,
        action: {
          label: "Undo",
          accessibilityLabel: "Undo deleting the key person",
          onPress: () => undoDelete(snapshot),
        },
      });
    })();
    return true;
  };

  return (
    <EditorFrame
      title="Key People"
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
        ref={relationshipRef}
        onDraftStateChange={onDraftStateChange}
        onCancelRequest={onCancelRequest}
        busy={saving}
      />
    </EditorFrame>
  );
}

interface MemoryEditorData {
  rows: MemoryRow[];
  globalAiEnabled: boolean;
  aiDefaults: MemoryAiDefaults;
}

/**
 * Memory — an in-place memory editor (D-115, D-114; CAPT-12). It lists the
 * contact's memories and has the type picker (Memory, Gift Ideas, Thought of
 * Them; never Imported, D-35). Each save returns to the chooser; a delete
 * stays here, with Undo (D-69). The one exception to the shared per-section
 * editors (D-75, D-63): it never opens the section editor or the add form.
 * No keyboard centring here (D-114): its entry field wraps and saves on
 * Enter. A linked row keeps tap-to-edit (this plan only; D-107 names the
 * section editors).
 */
function MemoryFocusedEditor({
  contactId,
  title,
  personName,
  onSaved,
  onCancel,
  memoryRef,
  onDraftStateChange,
  onCancelRequest,
  rowSave,
}: {
  contactId: number;
  title: string;
  /** For the snackbars (38.9 D-39/D-46); null while it loads. */
  personName: string | null;
  onSaved: () => void;
  onCancel: () => void;
  /** The open memory form is the inner level (D-14). */
  memoryRef: Ref<MemoryEditorHandle>;
  onDraftStateChange: (state: MemoryDraftState) => void;
  onCancelRequest: (close: () => void) => void;
  rowSave: RowSave;
}) {
  const { colors } = useTheme();
  const nameRef = useNameRef(personName);
  const [phase, setPhase] = useState<ReadPhase<MemoryEditorData>>(readLoading);
  // Only the latest load may publish; unmount invalidates outstanding reads.
  const readAuthority = useMemo(() => createLatestRequestAuthority(), []);
  const [savedTick, setSavedTick] = useState(0);
  // The screen's slot, so its guard holds Back while a save runs (WR-02).
  const { saving, setSaving, savingRef } = useRowSave(rowSave);

  /** NEVER rejects: a failure lands in the error phase (ADR-168; RG-035). */
  const load = useCallback(async (): Promise<void> => {
    await runGatedRead({
      gate: readAuthority,
      read: async (): Promise<MemoryEditorData> => {
        const exec = getExecutor();
        const settings = await getAppSettings(exec);
        const defaults = await getAiPermissionDefaults(exec);
        const rows = await listMemoriesForContact(exec, contactId);
        return {
          rows,
          globalAiEnabled: isAiMasterEnabled(settings),
          aiDefaults: memoryAiDefaultsMap(defaults),
        };
      },
      publish: setPhase,
      onError: (cause) =>
        Logger.error(LOG_SCOPE, "failed to load memories", cause),
    });
  }, [contactId, readAuthority]);

  useEffect(() => {
    void load();
    return () => readAuthority.invalidate();
  }, [load, readAuthority]);

  // Defer return-to-chooser so MemoryEditor finishes its own close().
  useEffect(() => {
    if (savedTick > 0) onSaved();
  }, [savedTick, onSaved]);

  const saveFailed = (cause: unknown) =>
    errorNotice(
      cause instanceof LinkedNoteBlankError
        ? LINKED_ENTRY_NEEDS_TEXT
        : FAILURE_COPY,
    );

  const add = async (draft: MemoryDraft): Promise<boolean> => {
    if (!beginInFlight(savingRef)) return false;
    setSaving(true);
    try {
      const now = localDateTime();
      // The draft carries Allow AI, seeded per type (D-13, D-92).
      await addMemory(getExecutor(), {
        contactId,
        ...draft,
        createdAt: now,
        now,
      });
      setSavedTick((tick) => tick + 1);
      return true;
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to add memory", cause);
      saveFailed(cause);
      return false;
    } finally {
      setSaving(false);
      endInFlight(savingRef);
      rowSave.settleHold();
    }
  };
  // Text and a changed Allow AI save in one transaction through the
  // `editMemory` wrapper (D-27, D-49; it refuses a locked row).
  const edit = async (id: number, patch: MemoryEditPatch): Promise<boolean> => {
    if (!beginInFlight(savingRef)) return false;
    setSaving(true);
    try {
      await editMemory(getExecutor(), {
        id,
        contactId,
        ...patch,
        now: localDateTime(),
      });
      setSavedTick((tick) => tick + 1);
      return true;
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to edit memory", cause);
      saveFailed(cause);
      return false;
    } finally {
      setSaving(false);
      endInFlight(savingRef);
      rowSave.settleHold();
    }
  };

  const undoDelete = (snapshot: MemorySnapshot, section: string) => {
    void (async () => {
      try {
        await undoMemoryDelete(getExecutor(), snapshot, localDateTime());
      } catch (cause) {
        Logger.error(LOG_SCOPE, "failed to undo a memory delete", cause);
        errorNotice("Couldn't undo the delete.");
        return;
      }
      void load();
      showSnackbar({
        kind: "success",
        label: restoredSnackbar(section, nameRef.current),
      });
    })();
  };

  // D-69: the delete happens at once (a hard delete with a tombstone; a
  // linked entry's interaction and note stay, D-37) and Undo puts it back.
  // It stays in this editor.
  const remove = (id: number): boolean => {
    if (savingRef.current) return false;
    const rows = phase.phase === "loaded" ? phase.data.rows : [];
    const row = rows.find((candidate) => candidate.id === id);
    // The deleted row's own section name (D-89); an unknown type reads as
    // Memories.
    const section = sectionTitle(
      row !== undefined && isMemoryTypeKey(row.type) ? row.type : "general",
    );
    void (async () => {
      let snapshot: MemorySnapshot;
      try {
        snapshot = await deleteMemoryNow(getExecutor(), {
          id,
          contactId,
          now: localDateTime(),
        });
      } catch (cause) {
        Logger.error(LOG_SCOPE, "failed to delete memory", cause);
        errorNotice("Couldn't delete. Please try again.");
        return;
      }
      void load();
      // D-132: a delete reports in the warning style.
      showSnackbar({
        kind: "warning",
        label: deletedSnackbar(section, nameRef.current),
        action: {
          label: "Undo",
          accessibilityLabel: `Undo deleting the ${section} entry`,
          onPress: () => undoDelete(snapshot, section),
        },
      });
    })();
    return true;
  };

  return (
    <EditorFrame
      title={title}
      error={false}
      onCancel={onCancel}
      cancelDisabled={saving}
    >
      {phase.phase === "loading" ? (
        <View
          testID="update-memory-loading"
          accessibilityLabel={`Loading ${title}`}
          style={styles.readState}
        >
          <ActivityIndicator color={colors.accentText} />
        </View>
      ) : phase.phase === "error" ? (
        <View testID="update-memory-read-error" style={styles.readError}>
          <AppText role="body" style={{ color: colors.textPrimary }}>
            {`Couldn't load ${title}`}
          </AppText>
          <Button
            role="tertiary"
            label="Retry"
            accessibilityLabel={`Retry loading ${title}`}
            onPress={() => void load()}
          />
        </View>
      ) : (
        <MemoryEditor
          testID="update-memory-editor"
          // D-141: each entry is named by its own type (the form has a type
          // picker), "Add Gift Idea" / "Edit Thought of Them".
          entryNoun={sectionEntryNoun}
          items={phase.data.rows}
          onAdd={add}
          onEdit={edit}
          onDelete={remove}
          globalAiEnabled={phase.data.globalAiEnabled}
          aiDefaults={phase.data.aiDefaults}
          ref={memoryRef}
          onDraftStateChange={onDraftStateChange}
          onCancelRequest={onCancelRequest}
          busy={saving}
        />
      )}
    </EditorFrame>
  );
}

/**
 * Off Limits — the dedicated Off Limits form and DAO (D-08). Writes go
 * through the Off Limits editor's controller, which re-reads the contact's
 * rows before every edit and delete (D-11). Delete sits in the open form
 * (38.9 D-30) and happens at once with Undo (D-69). No AI control (D-09).
 */
function OffLimitsFocusedEditor({
  contactId,
  personName,
  onSaved,
  onCancel,
  onDirtyChange,
  rowSave,
}: {
  contactId: number;
  /** For the snackbars (38.9 D-39/D-46); null while it loads. */
  personName: string | null;
  onSaved: () => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  rowSave: RowSave;
}) {
  const { colors } = useTheme();
  const nameRef = useNameRef(personName);
  const [items, setItems] = useState<OffLimitsRow[]>([]);
  // The open form: a new item (the default), or one stored row.
  const [editing, setEditing] = useState<OffLimitsRow | null>(null);
  // Remounts the form for each open (it owns its draft).
  const [formKey, setFormKey] = useState(0);
  const [formDirty, setFormDirty] = useState(false);
  useReportDirty(formDirty, onDirtyChange);
  const [error, setError] = useState(false);
  const { saving, setSaving, savingRef } = useRowSave(rowSave);

  const loadRef = useRef<() => Promise<void>>(async () => {});
  const controller = useMemo(
    () =>
      createOffLimitsEditorController({
        contactId,
        dao: {
          list: (id) => listOffLimitsForContact(getExecutor(), id),
          add: (input) => addOffLimits(getExecutor(), input),
          edit: (input) => editOffLimits(getExecutor(), input),
          delete: (input) => deleteOffLimits(getExecutor(), input),
          undo: (snapshot, now) =>
            undoDeleteOffLimits(getExecutor(), snapshot, now),
        },
        now: localDateTime,
        newUid,
        onChanged: () => void loadRef.current(),
        onError: (cause, op: OffLimitsEditorOp) => {
          Logger.error(LOG_SCOPE, `failed to ${op} off-limits`, cause);
          if (op === "add" || op === "edit") setError(true);
          else if (op === "delete") {
            errorNotice("Couldn't delete. Please try again.");
          } else errorNotice("Couldn't undo the delete.");
        },
      }),
    [contactId],
  );

  const load = useCallback(async () => {
    try {
      setItems(await controller.list());
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to load off-limits", cause);
    }
  }, [controller]);
  loadRef.current = load;

  useEffect(() => {
    void load();
  }, [load]);

  const openForm = (row: OffLimitsRow | null) => {
    setFormKey((key) => key + 1);
    setFormDirty(false);
    setEditing(row);
  };

  const save = async (fields: OffLimitsFormFields) => {
    if (!beginInFlight(savingRef)) return;
    setSaving(true);
    setError(false);
    let ok = false;
    try {
      ok =
        editing === null
          ? await controller.onAdd(fields)
          : await controller.onEdit(editing.id, fields);
    } finally {
      setSaving(false);
      endInFlight(savingRef);
      rowSave.settleHold();
    }
    // A failed save keeps the form and its draft (CAPT-14).
    if (ok) onSaved();
  };

  const undoDelete = (snapshot: OffLimitsSnapshot) => {
    void (async () => {
      if (!(await controller.onUndo(snapshot))) return;
      showSnackbar({
        kind: "success",
        label: offLimitsRestoredSnackbar(nameRef.current),
      });
    })();
  };

  // D-69: replaces the old unconfirmed, unscoped delete (T-38.10-48).
  const remove = (row: OffLimitsRow) => {
    if (savingRef.current) return;
    openForm(null);
    void (async () => {
      const snapshot = await controller.onDelete(row.id);
      if (snapshot === null) return;
      // D-132: a delete reports in the warning style.
      showSnackbar({
        kind: "warning",
        label: offLimitsDeletedSnackbar(nameRef.current),
        action: {
          label: "Undo",
          accessibilityLabel: "Undo deleting the Off Limits item",
          onPress: () => undoDelete(snapshot),
        },
      });
    })();
  };

  return (
    <EditorFrame
      title="Off Limits"
      error={error}
      onCancel={onCancel}
      cancelDisabled={saving}
    >
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.text ?? item.label ?? "Off Limits item"}`}
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          onPress={() => openForm(item)}
          style={[
            styles.listRow,
            {
              borderColor:
                editing?.id === item.id ? colors.accent : colors.border,
            },
          ]}
        >
          <AppText role="body">{item.text ?? item.label ?? ""}</AppText>
        </Pressable>
      ))}
      <OffLimitsForm
        key={formKey}
        testID="update-off-limits-form"
        initial={editing}
        onSave={save}
        // The form's Cancel closes the row, as the frame's Cancel does, so
        // it follows the Back rule (D-61).
        onCancel={onCancel}
        onDelete={editing === null ? undefined : () => remove(editing)}
        onDirtyChange={setFormDirty}
        busy={saving}
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
  // The Memory row's open form is its inner level (D-115, D-14).
  const [memoryDraftOpen, setMemoryDraftOpen] = useState(false);
  const memoryRef = useRef<MemoryEditorHandle>(null);
  const bypassRef = useRef(false);
  // The open row editor's save slot (fix-pass WR-02): the guard reads the ref,
  // the state draws the header Back disabled (D-26).
  const rowSavingRef = useRef(false);
  const [rowSaving, setRowSaving] = useState(false);
  const rowOpen = session.activeRowKey != null;
  const innerOpen =
    genericSelectedDefId !== null || relationshipDraftOpen || memoryDraftOpen;

  /** Closes one level: the inner editor, or the whole row. */
  function closeLevel(level: "inner" | "row" | null) {
    if (level === null) return;
    if (level === "inner") {
      if (genericSelectedDefId !== null) setGenericSelectedDefId(null);
      else if (memoryDraftOpen) memoryRef.current?.closeDraft();
      else relationshipRef.current?.closeDraft();
    } else {
      setSession((s) => cancelRow(s));
      setGenericSelectedDefId(null);
      setRelationshipDraftOpen(false);
      setMemoryDraftOpen(false);
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

  const onMemoryDraftState = (state: MemoryDraftState) => {
    setMemoryDraftOpen(state.open);
    setActiveRowDirty(state.dirty);
  };

  // A successful inner save closes directly, with no prompt.
  const onSaved = () => {
    setSession((s) => completeSave(s));
    setGenericSelectedDefId(null);
    setRelationshipDraftOpen(false);
    setMemoryDraftOpen(false);
    setActiveRowDirty(false);
  };

  // Every row opens in place, Memory included (D-115).
  const onSelectRow = (row: ChooserRow) => {
    if (contactId === null) return;
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
            personName={person?.name ?? null}
            onSaved={onSaved}
            onCancel={requestRowCancel}
            rowSave={rowSave}
            relationshipRef={relationshipRef}
            onDraftStateChange={onRelationshipDraftState}
            onCancelRequest={() => requestInnerCancel()}
          />
        );
      case "memory":
        return (
          <MemoryFocusedEditor
            contactId={contactId}
            title={activeRow.label}
            personName={person?.name ?? null}
            onSaved={onSaved}
            onCancel={requestRowCancel}
            rowSave={rowSave}
            memoryRef={memoryRef}
            onDraftStateChange={onMemoryDraftState}
            onCancelRequest={() => requestInnerCancel()}
          />
        );
      case "off_limits":
        return (
          <OffLimitsFocusedEditor
            contactId={contactId}
            personName={person?.name ?? null}
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
  readState: { minHeight: 88, alignItems: "center", justifyContent: "center" },
  readError: { gap: SPACING.sm, alignItems: "flex-start" },
  disabled: { opacity: DISABLED_OPACITY },
});
