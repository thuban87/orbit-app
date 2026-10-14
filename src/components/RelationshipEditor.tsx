import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { ContactPicker } from "@/components/ContactPicker";
import { AppText, Button, EntryTextField, OrbitSwitch } from "@/components/ui";
import { getExecutor } from "@/db/database";
import { listPickerContacts } from "@/db/picker-read";
import type { RelationshipRow } from "@/db/relationships-read";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import { type CardEditSlot, cardEditSlots } from "./card-edit-slots";

const LOG_SCOPE = "relationship-editor";

export interface RelationshipDraft {
  personName: string;
  relationType: string | null;
  linkedContactId: number | null;
  note: string | null;
  pinned: boolean;
  hidden: 0 | 1 | null;
}

export interface RelationshipEditorProps {
  contactId: number;
  items: RelationshipRow[];
  onAdd: (draft: RelationshipDraft) => Promise<boolean>;
  onEdit: (id: number, draft: RelationshipDraft) => Promise<boolean>;
  /**
   * Delete sits in the open edit form, not on the row card (38.9 D-30 via
   * 38.10 D-19; 38.10-18, as MemoryEditor and OffLimitsForm do). The form
   * closes after the call unless the host returns `false` synchronously
   * (it dropped the delete), the MemoryEditor contract. Deletes are
   * immediate with the host's Undo (D-69).
   */
  onDelete: (id: number) => unknown;
  /**
   * Reports whether the add/edit form is open and holds typed changes (38.9
   * D-14), on every change and `{ open: false, dirty: false }` on unmount.
   * Optional: hosts that do not guard the draft omit it.
   */
  onDraftStateChange?: (state: RelationshipDraftState) => void;
  /**
   * When given, the form's Cancel calls this with the editor's own close so
   * the host can route it through the dirty-aware `requestClose` (D-61).
   * Absent → Cancel closes at once.
   */
  onCancelRequest?: (close: () => void) => void;
  /**
   * The host's save is in flight (38.9 WR-02 follow-up; D-13, D-14): the
   * form's Cancel, Save and Delete are held and drawn disabled (D-26) until
   * it settles. So are the list's Edit, Show on Profile and Add key person
   * (third fix pass WR-02): Edit and Add would swap the draft being saved (a
   * failed save would then lose the typed edit), and Show on Profile and
   * Delete would race it (the host's slot drops Show on Profile silently).
   * Absent → false.
   */
  busy?: boolean;
  /**
   * Opens that row's edit form at mount when it is in `items`; otherwise the
   * editor opens on its rows (D-107; convergence c6, the MemoryEditor
   * contract). Read at mount only.
   */
  initiallyEditingId?: number;
  /**
   * Card edit mode (D-130; the Key People editor only): each row is
   * pressable with a pencil at its top right and no Edit button; an edit
   * form opens in place of its row with a red Delete at its top and no
   * bottom Delete; while a form is open the other rows and the Add are held.
   * Absent → the editor renders exactly as before (Add/Edit Contact, Update
   * Contact).
   */
  cardEditMode?: boolean;
  /** Attached to the open form's outer View, so a host can scroll it into view. */
  formRef?: Ref<View>;
  /** Exposes `closeDraft()` so the host's Back can close the open form (D-14). */
  ref?: Ref<RelationshipEditorHandle>;
}

export interface RelationshipDraftState {
  open: boolean;
  dirty: boolean;
}

export interface RelationshipEditorHandle {
  /** Closes the open add/edit form without saving (no prompt). */
  closeDraft: () => void;
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function initialDraft(item?: RelationshipRow): RelationshipDraft {
  return {
    personName: item?.person_name ?? "",
    relationType: item?.relation_type ?? null,
    linkedContactId: item?.linked_contact_id ?? null,
    note: item?.note ?? null,
    pinned: item?.pinned === 1,
    hidden: item?.hidden === 1 ? 1 : item?.hidden === 0 ? 0 : null,
  };
}

/**
 * The editor's state at mount: the row `initiallyEditingId` names, with its
 * draft, when it is in `items`; otherwise no open form. PURE.
 */
export function initialEditorState(
  items: readonly RelationshipRow[],
  initiallyEditingId: number | undefined,
): { editing: RelationshipRow | null; draft: RelationshipDraft | null } {
  const item =
    initiallyEditingId === undefined
      ? undefined
      : items.find((candidate) => candidate.id === initiallyEditingId);
  return item
    ? { editing: item, draft: initialDraft(item) }
    : { editing: null, draft: null };
}

/**
 * The editor's render order (D-130 card edit mode; see `cardEditSlots`): with
 * `cardEditMode` an open edit takes its row's index; otherwise every row,
 * then the form or the Add. PURE.
 */
export function relationshipEditorSlots(input: {
  items: readonly RelationshipRow[];
  editingId: number | null;
  adding: boolean;
  cardEditMode: boolean;
}): CardEditSlot<RelationshipRow>[] {
  return cardEditSlots({ ...input, addOnly: false, showAdd: true });
}

/** Live contact names by id, from the picker read. PURE. */
export function liveNameMap(
  rows: readonly { id: number; name: string }[],
): ReadonlyMap<number, string> {
  return new Map(rows.map((row) => [row.id, row.name]));
}

/**
 * The name to show for a linked contact (G-16, E-14): the live name when the
 * linked id is in the live list, else the stored name. A linked id the live
 * list lacks (deleted meanwhile, or the read has not finished) keeps the
 * stored name and is never blanked (convergence c11, Claude C-12). PURE.
 */
export function displayLinkedName(
  row: {
    linked_contact_id: number | null;
    linked_contact_name: string | null;
  },
  liveNames: ReadonlyMap<number, string>,
): string | null {
  if (row.linked_contact_id === null) return row.linked_contact_name;
  return liveNames.get(row.linked_contact_id) ?? row.linked_contact_name;
}

/** Optional text compares blank-equivalent: typed-then-erased is untouched. */
function sameText(a: string | null, b: string | null): boolean {
  return (a ?? "") === (b ?? "");
}

/**
 * Whether an open form differs from what it opened with (38.9 D-14, D-61):
 * `seed` is `initialDraft(editing ?? undefined)`. PURE.
 */
export function isRelationshipDraftDirty(
  seed: RelationshipDraft,
  draft: RelationshipDraft,
): boolean {
  return !(
    seed.personName === draft.personName &&
    sameText(seed.relationType, draft.relationType) &&
    seed.linkedContactId === draft.linkedContactId &&
    sameText(seed.note, draft.note) &&
    seed.pinned === draft.pinned &&
    seed.hidden === draft.hidden
  );
}

/** The draft state a host's guard reads (D-14). PURE. */
export function relationshipDraftState(
  editing: RelationshipRow | null,
  draft: RelationshipDraft | null,
): RelationshipDraftState {
  if (draft === null) return { open: false, dirty: false };
  return {
    open: true,
    dirty: isRelationshipDraftDirty(initialDraft(editing ?? undefined), draft),
  };
}

/** Parent-owned relationship editor; callbacks provide the only persistence seam. */
export function RelationshipEditor({
  contactId,
  items,
  onAdd,
  onEdit,
  onDelete,
  onDraftStateChange,
  onCancelRequest,
  busy = false,
  initiallyEditingId,
  cardEditMode = false,
  formRef,
  ref,
}: RelationshipEditorProps) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState<RelationshipRow | null>(
    () => initialEditorState(items, initiallyEditingId).editing,
  );
  const [draft, setDraft] = useState<RelationshipDraft | null>(
    () => initialEditorState(items, initiallyEditingId).draft,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  // G-16: live contact names for linked rows and the open form. The read
  // includes archived contacts, so an archived link still shows its current
  // name (convergence c11, Claude C-12).
  const [liveNames, setLiveNames] = useState<ReadonlyMap<number, string>>(
    () => new Map(),
  );
  // The linked ids in the rows, as a stable string: hosts rebuild `items`
  // every render (Add / Edit Contact), so the array itself cannot key a read.
  const linkedKey = items.map((item) => item.linked_contact_id ?? 0).join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `linkedKey` is a re-read trigger (the rows' links changed), not a value the read uses.
  useEffect(() => {
    // Read at mount, again after the picker closes (a contact may have been
    // picked or made) and when the rows' links change. Saved rows' stored
    // names already come from a live join at the host's read.
    if (pickerOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listPickerContacts(getExecutor(), {
          includeArchived: true,
        });
        if (!cancelled) setLiveNames(liveNameMap(rows));
      } catch (error) {
        // Stored names stay on screen; nothing is blanked.
        Logger.error(LOG_SCOPE, "failed to read live contact names", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickerOpen, linkedKey]);

  const close = () => {
    setEditing(null);
    setDraft(null);
    setPickerOpen(false);
  };

  // Draft state for the host's guard (D-14); the callback is read through a
  // ref so a fresh closure each render never re-fires the report.
  const { open: draftOpen, dirty: draftDirty } = relationshipDraftState(
    editing,
    draft,
  );
  const onDraftStateChangeRef = useRef(onDraftStateChange);
  onDraftStateChangeRef.current = onDraftStateChange;
  useEffect(() => {
    onDraftStateChangeRef.current?.({ open: draftOpen, dirty: draftDirty });
  }, [draftOpen, draftDirty]);
  useEffect(
    () => () => onDraftStateChangeRef.current?.({ open: false, dirty: false }),
    [],
  );
  useImperativeHandle(ref, () => ({ closeDraft: close }));
  const openNew = () => {
    if (busy) return; // held while the host saves (WR-02)
    setEditing(null);
    setDraft(initialDraft());
  };
  const openEdit = (item: RelationshipRow) => {
    if (busy) return; // held while the host saves (WR-02)
    setEditing(item);
    setDraft(initialDraft(item));
  };
  const update = <K extends keyof RelationshipDraft>(
    key: K,
    value: RelationshipDraft[K],
  ) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  const commit = async () => {
    if (busy || !draft || !blankToNull(draft.personName)) return;
    const normalized: RelationshipDraft = {
      ...draft,
      personName: draft.personName.trim(),
      relationType: blankToNull(draft.relationType ?? ""),
      note: blankToNull(draft.note ?? ""),
    };
    const saved = editing
      ? await onEdit(editing.id, normalized)
      : await onAdd(normalized);
    if (saved) close();
  };

  // The open form's linked name: the stored name only while the draft still
  // links the row's own contact (G-16).
  const draftLinkedName =
    draft === null
      ? null
      : displayLinkedName(
          {
            linked_contact_id: draft.linkedContactId,
            linked_contact_name:
              editing !== null &&
              editing.linked_contact_id === draft.linkedContactId
                ? editing.linked_contact_name
                : null,
          },
          liveNames,
        );

  // D-130 (this plan only: the Off Limits editor's `controlsHeld` rule): in
  // card edit mode an open form holds every other row and the Add, so a tap
  // never replaces a typed draft silently.
  const rowsHeld = busy || (cardEditMode && draft !== null);
  const addHeld = busy || draft !== null;

  // The row's details, shared by both row looks.
  const rowDetails = (item: RelationshipRow) => (
    <>
      {item.relation_type ? (
        <AppText role="caption" style={{ color: colors.textSecondary }}>
          {item.relation_type}
        </AppText>
      ) : null}
      {displayLinkedName(item, liveNames) ? (
        <AppText role="caption" style={{ color: colors.textSecondary }}>
          Linked to {displayLinkedName(item, liveNames)}
        </AppText>
      ) : null}
      {item.note ? (
        <AppText role="caption" style={{ color: colors.textSecondary }}>
          {item.note}
        </AppText>
      ) : null}
    </>
  );
  const showOnProfileButton = (item: RelationshipRow) => (
    <Button
      role="tertiary"
      label="Show on Profile"
      disabled={rowsHeld}
      onPress={() => {
        if (rowsHeld) return;
        void onEdit(item.id, { ...initialDraft(item), hidden: 0 });
      }}
    />
  );
  const rowStyle = (item: RelationshipRow) => [
    styles.row,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      opacity: item.hidden === 1 ? 0.68 : 1,
    },
  ];
  const nameStyle = (item: RelationshipRow) =>
    item.hidden === 1 ? { color: colors.textSecondary } : undefined;

  const renderRow = (item: RelationshipRow) =>
    cardEditMode ? (
      // D-130: the row opens its form in place; the pencil at its top right.
      // Proposed label (this plan only; plan-19 wording re-check).
      <Pressable
        key={item.id}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${item.person_name}`}
        accessibilityState={{ disabled: rowsHeld }}
        disabled={rowsHeld}
        onPress={() => openEdit(item)}
        style={rowStyle(item)}
      >
        <View style={styles.rowHeader}>
          <AppText role="body" style={[styles.rowName, nameStyle(item)]}>
            {item.person_name}
          </AppText>
          <Button
            role="iconOnly"
            icon="edit"
            accessibilityLabel={`Edit ${item.person_name}`}
            disabled={rowsHeld}
            onPress={() => openEdit(item)}
          />
        </View>
        {rowDetails(item)}
        {item.hidden === 1 ? (
          <View style={styles.actions}>{showOnProfileButton(item)}</View>
        ) : null}
      </Pressable>
    ) : (
      <View key={item.id} style={rowStyle(item)}>
        <AppText role="body" style={nameStyle(item)}>
          {item.person_name}
        </AppText>
        {rowDetails(item)}
        <View style={styles.actions}>
          {/* Held while the host saves (third fix pass WR-02, D-26). */}
          <Button
            role="secondary"
            label="Edit"
            disabled={busy}
            onPress={() => openEdit(item)}
          />
          {item.hidden === 1 ? showOnProfileButton(item) : null}
        </View>
      </View>
    );

  const renderAdd = () => (
    <Button
      key="relationship-editor-add"
      role="primary"
      label="Add key person"
      disabled={addHeld}
      onPress={openNew}
    />
  );

  // The one form markup, rendered in place of its row (card edit mode) or
  // after the list (every other host).
  const renderForm = () => {
    if (draft === null) return null;
    return (
      <View
        key="relationship-editor-form"
        ref={formRef}
        style={[
          styles.form,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {cardEditMode && editing ? (
          // D-130: the red Delete only in edit mode, at the top right of
          // the open card. Key People has no Move (not a D-84 section).
          <View style={styles.formHeader}>
            <AppText role="heading" style={styles.formHeading}>
              Edit key person
            </AppText>
            {/* D-69: Delete is immediate; the host deletes and owns Undo. */}
            <Button
              role="destructive"
              label="Delete"
              disabled={busy}
              onPress={() => {
                if (busy) return; // held while the host saves (WR-02)
                if (onDelete(editing.id) === false) return;
                close();
              }}
            />
          </View>
        ) : (
          <AppText role="heading">
            {editing ? "Edit key person" : "Add key person"}
          </AppText>
        )}
        <TextInput
          accessibilityLabel="Person name"
          value={draft.personName}
          onChangeText={(value) => update("personName", value)}
          placeholder="Person name"
          placeholderTextColor={colors.textPlaceholder}
          style={[
            styles.input,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
        />
        <TextInput
          accessibilityLabel="Relationship type optional"
          value={draft.relationType ?? ""}
          onChangeText={(value) => update("relationType", value)}
          placeholder="Relationship type (optional)"
          placeholderTextColor={colors.textPlaceholder}
          style={[
            styles.input,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
        />
        <Button
          role="secondary"
          label={
            draft.linkedContactId === null
              ? "Link Orbit contact (optional)"
              : "Change linked Orbit contact"
          }
          onPress={() => setPickerOpen(true)}
        />
        {draftLinkedName ? (
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            Linked to {draftLinkedName}
          </AppText>
        ) : null}
        {draft.linkedContactId !== null ? (
          <Button
            role="tertiary"
            label="Clear linked contact"
            onPress={() => update("linkedContactId", null)}
          />
        ) : null}
        {/* D-66 / D-114: wraps, Enter saves, pasted line breaks become
              spaces; centres only under a host KeyboardCenteringProvider. */}
        <EntryTextField
          accessibilityLabel="Relationship note optional"
          value={draft.note ?? ""}
          onChangeText={(value) => update("note", value)}
          onSubmit={() => void commit()}
          placeholder="Note (optional)"
          editable={!busy}
        />
        <View style={styles.switchRow}>
          <AppText role="body">Pin</AppText>
          <OrbitSwitch
            value={draft.pinned}
            onValueChange={(value) => update("pinned", value)}
            accessibilityLabel="Pin relationship"
          />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.visibilityCopy}>
            <AppText role="body">Hide from Profile</AppText>
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              Presentation only — this doesn't hide it from search or AH.
            </AppText>
          </View>
          <OrbitSwitch
            value={draft.hidden === 1}
            onValueChange={(value) => update("hidden", value ? 1 : 0)}
            accessibilityLabel="Hide from Profile"
          />
        </View>
        <Button
          role="tertiary"
          label="Use default visibility"
          onPress={() => update("hidden", null)}
        />
        <View style={styles.actions}>
          <Button
            role="secondary"
            label="Cancel"
            disabled={busy}
            onPress={() => (onCancelRequest ? onCancelRequest(close) : close())}
          />
          <Button
            role="primary"
            label="Save"
            disabled={!blankToNull(draft.personName) || busy}
            onPress={() => void commit()}
          />
        </View>
        {editing && !cardEditMode ? (
          // D-69: Delete is immediate; the host deletes and owns Undo. In
          // the form, so deleting the row also closes its form (38.10-18).
          <Button
            role="tertiary"
            label="Delete"
            disabled={busy}
            onPress={() => {
              if (busy) return; // held while the host saves (WR-02)
              if (onDelete(editing.id) === false) return;
              close();
            }}
          />
        ) : null}
      </View>
    );
  };

  const slots = relationshipEditorSlots({
    items,
    editingId: editing?.id ?? null,
    adding: draft !== null && editing === null,
    cardEditMode,
  });

  return (
    <View style={styles.container}>
      {slots.map((slot) =>
        slot.kind === "card"
          ? renderRow(slot.item)
          : slot.kind === "form"
            ? renderForm()
            : renderAdd(),
      )}
      <ContactPicker
        visible={pickerOpen}
        onDismiss={() => setPickerOpen(false)}
        onSelect={(linkedContactId) => {
          update("linkedContactId", linkedContactId);
          setPickerOpen(false);
        }}
        excludeContactId={contactId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  container: { gap: SPACING.md },
  form: {
    borderRadius: SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
    padding: SPACING.base,
  },
  formHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "space-between",
  },
  formHeading: { flexShrink: 1, paddingTop: SPACING.sm },
  input: {
    borderRadius: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  row: {
    borderRadius: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACING.xs,
    padding: SPACING.sm,
  },
  rowHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "space-between",
  },
  rowName: { flex: 1 },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
    minHeight: 44,
  },
  visibilityCopy: { flex: 1, gap: SPACING.xs },
});
