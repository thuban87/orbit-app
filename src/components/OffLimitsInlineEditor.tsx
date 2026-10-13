// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's AppText `role` is a typography role, not ARIA.
/**
 * OffLimitsInlineEditor — the inline Off Limits section on Add Contact and
 * Edit Contact (38.10 plan 14; D-05, D-08, D-65, D-67, D-87, D-104).
 *
 * It replaces the retired fuel editor host on both forms (D-08). Every row is
 * Off Limits; there is no kind control (D-11, NEW-1). The parent owns the
 * draft list: Add, Save and Delete only change the form's draft, and the
 * form's own Save writes them (D-104 held deletes; Cancel / Discard brings a
 * deleted row back).
 *
 * - Each row shows its text, label and any stored link, with Edit and Delete,
 *   the same row shape as Key People.
 * - Add and Edit open one form: the text is the shared D-66 field (wraps,
 *   Enter saves, a visible Save button stays; it centres through the host's
 *   KeyboardCenteringProvider), plus an optional label. A stored link is kept
 *   as it is.
 * - The section ends with a solid "Add Off Limits Item" (D-67, D-87).
 * - The open form reports `{ open, dirty }` for the host's Back guard and
 *   section fold (38.9 D-13, D-14, D-68), and Cancel follows the Back rule
 *   through `onCancelRequest` (D-61).
 *
 * The form rules are pure and node-tested in `create-contact-logic.ts`.
 * Colours via theme tokens only (CLAUDE.md).
 */
import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { StyleSheet, TextInput, View } from "react-native";
import {
  canSaveOffLimitsForm,
  type DraftState,
  isOffLimitsFormDirty,
  normalizeOffLimitsForm,
  type OffLimitsFormDraft,
  offLimitsFormDraft,
} from "@/screens/create-contact-logic";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { AppText, Button, EntryTextField } from "./ui";

/** One Off Limits draft row as the section shows it. */
export interface OffLimitsInlineItem {
  id: number;
  text: string | null;
  label: string | null;
  url: string | null;
}

/** The trimmed fields a Save hands the host (blank → null). */
export interface OffLimitsInlineFields {
  text: string | null;
  label: string | null;
}

export interface OffLimitsInlineEditorHandle {
  /** Closes the open form without saving (no prompt). */
  closeDraft: () => void;
}

export interface OffLimitsInlineEditorProps {
  items: OffLimitsInlineItem[];
  /** The solid Add button's label (glossary `ADD_OFF_LIMITS_ITEM`). */
  addLabel: string;
  onAdd: (fields: OffLimitsInlineFields) => void;
  onEdit: (id: number, fields: OffLimitsInlineFields) => void;
  /** Held until the form's Save (D-104). */
  onDelete: (id: number) => void;
  /** Reports the open form's state, and closed on unmount (38.9 D-14). */
  onDraftStateChange?: (state: DraftState) => void;
  /** Cancel routes through the host's dirty-aware close (D-61). */
  onCancelRequest?: (close: () => void) => void;
  /** The form's save is in flight: every control is held (D-26). */
  busy?: boolean;
  ref?: Ref<OffLimitsInlineEditorHandle>;
  testID?: string;
}

export function OffLimitsInlineEditor({
  items,
  addLabel,
  onAdd,
  onEdit,
  onDelete,
  onDraftStateChange,
  onCancelRequest,
  busy = false,
  ref,
  testID,
}: OffLimitsInlineEditorProps) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState<OffLimitsInlineItem | null>(null);
  const [draft, setDraft] = useState<OffLimitsFormDraft | null>(null);
  const [baseline, setBaseline] = useState<OffLimitsFormDraft | null>(null);

  const close = () => {
    setEditing(null);
    setDraft(null);
    setBaseline(null);
  };
  useImperativeHandle(ref, () => ({ closeDraft: close }));

  // Draft state for the host's guard, read through a ref so a fresh closure
  // each render never re-fires the report.
  const open = draft !== null;
  const dirty =
    draft !== null &&
    isOffLimitsFormDirty(baseline ?? offLimitsFormDraft(), draft);
  const onDraftStateChangeRef = useRef(onDraftStateChange);
  onDraftStateChangeRef.current = onDraftStateChange;
  useEffect(() => {
    onDraftStateChangeRef.current?.({ open, dirty });
  }, [open, dirty]);
  useEffect(
    () => () => onDraftStateChangeRef.current?.({ open: false, dirty: false }),
    [],
  );

  const openForm = (item: OffLimitsInlineItem | null) => {
    if (busy) return;
    const opened = offLimitsFormDraft(item ?? undefined);
    setEditing(item);
    setDraft(opened);
    setBaseline(opened);
  };

  const savable =
    draft !== null && canSaveOffLimitsForm(draft, editing?.url ?? null);

  const commit = () => {
    if (draft === null || busy || !savable) return;
    const fields = normalizeOffLimitsForm(draft);
    if (editing) onEdit(editing.id, fields);
    else onAdd(fields);
    close();
  };

  return (
    <View testID={testID} style={styles.container}>
      {items.map((item) => (
        <View
          key={item.id}
          testID={testID ? `${testID}-row-${item.id}` : undefined}
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {item.text ? <AppText role="body">{item.text}</AppText> : null}
          {item.label ? (
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              {item.label}
            </AppText>
          ) : null}
          {item.url ? (
            <AppText
              role="caption"
              numberOfLines={1}
              style={{ color: colors.textSecondary }}
            >
              {item.url}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <Button
              role="secondary"
              label="Edit"
              disabled={busy || draft !== null}
              onPress={() => openForm(item)}
            />
            <Button
              role="tertiary"
              label="Delete"
              disabled={busy || editing?.id === item.id}
              onPress={() => {
                if (busy) return;
                onDelete(item.id);
              }}
            />
          </View>
        </View>
      ))}
      {draft === null ? (
        <Button
          testID={testID ? `${testID}-add` : undefined}
          role="primary"
          label={addLabel}
          disabled={busy}
          onPress={() => openForm(null)}
        />
      ) : (
        <View
          style={[
            styles.form,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <EntryTextField
            testID={testID ? `${testID}-text` : undefined}
            accessibilityLabel="Off Limits item"
            value={draft.text}
            onChangeText={(text) =>
              setDraft((prev) => (prev ? { ...prev, text } : prev))
            }
            onSubmit={commit}
            returnKeyType="done"
            placeholder="A topic to avoid bringing up"
            editable={!busy}
          />
          <TextInput
            testID={testID ? `${testID}-label` : undefined}
            accessibilityLabel="Label (optional)"
            value={draft.label}
            onChangeText={(label) =>
              setDraft((prev) => (prev ? { ...prev, label } : prev))
            }
            placeholder="Label (optional)"
            placeholderTextColor={colors.textPlaceholder}
            editable={!busy}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
          <View style={styles.actions}>
            <Button
              role="secondary"
              label="Cancel"
              disabled={busy}
              onPress={() =>
                onCancelRequest ? onCancelRequest(close) : close()
              }
            />
            <Button
              testID={testID ? `${testID}-save` : undefined}
              role="primary"
              label="Save"
              disabled={!savable || busy}
              onPress={commit}
            />
          </View>
        </View>
      )}
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
  row: {
    borderRadius: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACING.xs,
    padding: SPACING.sm,
  },
});
