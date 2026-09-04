import { useState } from "react";
import { Pressable, StyleSheet, Switch, TextInput, View } from "react-native";
import { ContactPicker } from "@/components/ContactPicker";
import { AppText, Button } from "@/components/ui";
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
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function initialDraft(item?: RelationshipRow): RelationshipDraft {
  return {
    personName: item?.person_name ?? "",
    relationType: item?.relation_type ?? null,
    linkedContactId: item?.linked_contact_id ?? null,
    note: item?.note ?? null,
    pinned: item?.pinned === 1,
    hidden: item?.hidden === 1 ? 1 : item?.hidden === 0 ? 0 : null,
  };
}

/** Parent-owned relationship editor; callbacks provide the only persistence seam. */
export function RelationshipEditor({
  contactId,
  items,
  onAdd,
  onEdit,
  onDelete,
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
  ) => setDraft((current) => (current ? { ...current, [key]: value } : current));
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
        <View key={item.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, opacity: item.hidden === 1 ? 0.68 : 1 }]}>
          <AppText role="body" style={item.hidden === 1 ? { color: colors.textSecondary } : undefined}>{item.person_name}</AppText>
          {item.relation_type ? <AppText role="caption" style={{ color: colors.textSecondary }}>{item.relation_type}</AppText> : null}
          {item.linked_contact_name ? <AppText role="caption" style={{ color: colors.textSecondary }}>Linked to {item.linked_contact_name}</AppText> : null}
          {item.note ? <AppText role="caption" style={{ color: colors.textSecondary }}>{item.note}</AppText> : null}
          <View style={styles.actions}>
            <Button role="secondary" label="Edit" onPress={() => openEdit(item)} />
            <Button role="tertiary" label="Delete" onPress={() => onDelete(item.id)} />
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
        <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText role="heading">{editing ? "Edit key person" : "Add key person"}</AppText>
          <TextInput accessibilityLabel="Person name" value={draft.personName} onChangeText={(value) => update("personName", value)} placeholder="Person name" placeholderTextColor={colors.textSecondary} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]} />
          <TextInput accessibilityLabel="Relationship type optional" value={draft.relationType ?? ""} onChangeText={(value) => update("relationType", value)} placeholder="Relationship type (optional)" placeholderTextColor={colors.textSecondary} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]} />
          <Button role="secondary" label={draft.linkedContactId === null ? "Link Orbit contact (optional)" : "Change linked Orbit contact"} onPress={() => setPickerOpen(true)} />
          {draft.linkedContactId !== null ? <Button role="tertiary" label="Clear linked contact" onPress={() => update("linkedContactId", null)} /> : null}
          <TextInput accessibilityLabel="Relationship note optional" value={draft.note ?? ""} onChangeText={(value) => update("note", value)} placeholder="Note (optional)" placeholderTextColor={colors.textSecondary} multiline style={[styles.input, styles.multiline, { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]} />
          <View style={styles.switchRow}>
            <AppText role="body">Pin</AppText>
            <Switch value={draft.pinned} onValueChange={(value) => update("pinned", value)} accessibilityLabel="Pin relationship" />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.visibilityCopy}>
              <AppText role="body">{draft.hidden === 1 ? "Show on Profile" : "Hide from Profile"}</AppText>
              <AppText role="caption" style={{ color: colors.textSecondary }}>Presentation only — this doesn't hide it from search or AH.</AppText>
            </View>
            <Switch value={draft.hidden === 1} onValueChange={(value) => update("hidden", value ? 1 : 0)} accessibilityLabel="Hide from Profile" />
          </View>
          <Button role="tertiary" label="Use default visibility" onPress={() => update("hidden", null)} />
          <View style={styles.actions}>
            <Button role="secondary" label="Cancel" onPress={close} />
            <Button role="primary" label="Save" disabled={!blankToNull(draft.personName)} onPress={() => void commit()} />
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
  form: { borderRadius: SPACING.md, borderWidth: StyleSheet.hairlineWidth, gap: SPACING.sm, padding: SPACING.base },
  input: { borderRadius: SPACING.sm, borderWidth: StyleSheet.hairlineWidth, minHeight: 44, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm },
  multiline: { minHeight: 88, textAlignVertical: "top" },
  row: { borderRadius: SPACING.sm, borderWidth: StyleSheet.hairlineWidth, gap: SPACING.xs, padding: SPACING.sm },
  switchRow: { alignItems: "center", flexDirection: "row", gap: SPACING.md, justifyContent: "space-between", minHeight: 44 },
  visibilityCopy: { flex: 1, gap: SPACING.xs },
});
