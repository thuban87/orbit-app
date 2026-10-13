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
 * - Each row shows its text, label and any stored link, and an Edit action.
 *   Delete sits in the open edit form, as in the memory editor, so no
 *   destructive action sits on a list card (38.9 D-30).
 * - Add and Edit open the shared `OffLimitsForm` (plan 15), the same form as
 *   the Off Limits editor, so the two cannot drift: the text is the D-66
 *   field (wraps, Enter saves, a visible Save button stays; it centres
 *   through the host's KeyboardCenteringProvider), plus an optional label.
 *   Its Link field is off here, so a stored link is kept as it is.
 * - The section ends with a solid "Add Off Limits Item" (D-67, D-87).
 * - The open form reports `{ open, dirty }` for the host's Back guard and
 *   section fold (38.9 D-13, D-14, D-68), and Cancel follows the Back rule
 *   through `onCancelRequest` (D-61).
 *
 * The form rules are pure and node-tested in `create-contact-logic.ts`;
 * `OffLimitsForm` applies them.
 * Colours via theme tokens only (CLAUDE.md).
 */
import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import type { DraftState } from "@/screens/create-contact-logic";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { OffLimitsForm } from "./OffLimitsForm";
import { AppText, Button } from "./ui";

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

/** The open form: a new item (`null`) or the row being edited. */
type OpenForm = { item: OffLimitsInlineItem | null; key: number };

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
  const [form, setForm] = useState<OpenForm | null>(null);
  const [dirty, setDirty] = useState(false);
  // Remounts the shared form for each open (it owns its draft).
  const openCountRef = useRef(0);

  const close = () => {
    setForm(null);
    setDirty(false);
  };
  useImperativeHandle(ref, () => ({ closeDraft: close }));

  // Draft state for the host's guard, read through a ref so a fresh closure
  // each render never re-fires the report.
  const open = form !== null;
  const onDraftStateChangeRef = useRef(onDraftStateChange);
  onDraftStateChangeRef.current = onDraftStateChange;
  useEffect(() => {
    onDraftStateChangeRef.current?.({ open, dirty: open && dirty });
  }, [open, dirty]);
  useEffect(
    () => () => onDraftStateChangeRef.current?.({ open: false, dirty: false }),
    [],
  );

  const openForm = (item: OffLimitsInlineItem | null) => {
    if (busy) return;
    openCountRef.current += 1;
    setDirty(false);
    setForm({ item, key: openCountRef.current });
  };

  const editing = form?.item ?? null;

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
              disabled={busy || form !== null}
              onPress={() => openForm(item)}
            />
          </View>
        </View>
      ))}
      {form === null ? (
        <Button
          testID={testID ? `${testID}-add` : undefined}
          role="primary"
          label={addLabel}
          disabled={busy}
          onPress={() => openForm(null)}
        />
      ) : (
        // The shared Off Limits form (plan 15), without its Link field: a
        // stored link is kept as it is here.
        <OffLimitsForm
          key={form.key}
          testID={testID ? `${testID}-form` : undefined}
          initial={editing}
          showLink={false}
          busy={busy}
          onDirtyChange={setDirty}
          onSave={async ({ text, label }) => {
            if (busy) return;
            if (editing) onEdit(editing.id, { text, label });
            else onAdd({ text, label });
            close();
          }}
          onCancel={() => (onCancelRequest ? onCancelRequest(close) : close())}
          onDelete={
            editing
              ? // Held until the form's Save; Cancel or Discard brings it
                // back (D-104), so it needs no confirm.
                () => {
                  if (busy) return;
                  onDelete(editing.id);
                  close();
                }
              : undefined
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  container: { gap: SPACING.md },
  row: {
    borderRadius: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACING.xs,
    padding: SPACING.sm,
  },
});
