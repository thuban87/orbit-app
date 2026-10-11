import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { ContactPicker } from "@/components/ContactPicker";
import { AppText, Button, OrbitSwitch } from "@/components/ui";
import type { RelationshipRow } from "@/db/relationships-read";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

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
  onDelete: (id: number) => void;
  onRestore: (id: number) => void;
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
  ref,
}: RelationshipEditorProps) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState<RelationshipRow | null>(null);
  const [draft, setDraft] = useState<RelationshipDraft | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

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
    setEditing(null);
    setDraft(initialDraft());
  };
  const openEdit = (item: RelationshipRow) => {
    setEditing(item);
    setDraft(initialDraft(item));
  };
  const update = <K extends keyof RelationshipDraft>(
    key: K,
    value: RelationshipDraft[K],
  ) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  const commit = async () => {
    if (!draft || !blankToNull(draft.personName)) return;
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

  return (
    <View style={styles.container}>
      {items.map((item) => (
        <View
          key={item.id}
          style={[
            styles.row,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: item.hidden === 1 ? 0.68 : 1,
            },
          ]}
        >
          <AppText
            role="body"
            style={
              item.hidden === 1 ? { color: colors.textSecondary } : undefined
            }
          >
            {item.person_name}
          </AppText>
          {item.relation_type ? (
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              {item.relation_type}
            </AppText>
          ) : null}
          {item.linked_contact_name ? (
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              Linked to {item.linked_contact_name}
            </AppText>
          ) : null}
          {item.note ? (
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              {item.note}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <Button
              role="secondary"
              label="Edit"
              onPress={() => openEdit(item)}
            />
            <Button
              role="tertiary"
              label="Delete"
              onPress={() => onDelete(item.id)}
            />
            {item.hidden === 1 ? (
              <Button
                role="tertiary"
                label="Show on Profile"
                onPress={() =>
                  void onEdit(item.id, { ...initialDraft(item), hidden: 0 })
                }
              />
            ) : null}
          </View>
        </View>
      ))}
      {!draft ? (
        <Button role="primary" label="Add key person" onPress={openNew} />
      ) : (
        <View
          style={[
            styles.form,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <AppText role="heading">
            {editing ? "Edit key person" : "Add key person"}
          </AppText>
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
          {draft.linkedContactId !== null ? (
            <Button
              role="tertiary"
              label="Clear linked contact"
              onPress={() => update("linkedContactId", null)}
            />
          ) : null}
          <TextInput
            accessibilityLabel="Relationship note optional"
            value={draft.note ?? ""}
            onChangeText={(value) => update("note", value)}
            placeholder="Note (optional)"
            placeholderTextColor={colors.textPlaceholder}
            multiline
            style={[
              styles.input,
              styles.multiline,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
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
              onPress={() =>
                onCancelRequest ? onCancelRequest(close) : close()
              }
            />
            <Button
              role="primary"
              label="Save"
              disabled={!blankToNull(draft.personName)}
              onPress={() => void commit()}
            />
          </View>
        </View>
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
  input: {
    borderRadius: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  multiline: { minHeight: 88, textAlignVertical: "top" },
  row: {
    borderRadius: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACING.xs,
    padding: SPACING.sm,
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
    minHeight: 44,
  },
  visibilityCopy: { flex: 1, gap: SPACING.xs },
});
