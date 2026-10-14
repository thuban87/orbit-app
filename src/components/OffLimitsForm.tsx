// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's AppText / Button `role` is a typography / hierarchy role, not ARIA.
/**
 * OffLimitsForm — the one Off Limits add / edit form (Phase 38.10 D-08, D-66,
 * D-89 G-13 / G-15). Used by the Off Limits editor screen (plan 15), the
 * inline Off Limits section on Add / Edit Contact (plan 14's
 * `OffLimitsInlineEditor`, so the two forms cannot drift) and Update Contact
 * (plan 17).
 *
 * - The text is the shared D-66 entry field: it wraps, Enter saves, pasted
 *   line breaks become spaces. It centres above the keyboard through the
 *   host's `KeyboardCenteringProvider` when there is one; this form takes no
 *   keyboard prop (convergence c1 F-U1).
 * - An optional label, and (when `showLink`) an optional link that must be a
 *   web address, with a `FieldError` (G-13). Without `showLink` a stored link
 *   is kept as it is and still counts as content.
 * - Save is disabled while the entry has no content (text, label or link; the
 *   DAO's rule) or the link is invalid, and is single-flight: a second tap
 *   while an async save runs is dropped (G-15). Text is trimmed with
 *   `normalizeEntryText` only at Save (plan 09; convergence c1 F-U2).
 * - No AI control of any kind (D-09, D-10).
 *
 * - Card edit mode (`cardEditMode`, the Off Limits editor only; D-130): the
 *   form opens in place of its row, with the stored link's Open link, Move
 *   (when `onMove` is set) and a red Delete in a row at its top; the bottom
 *   Delete is not rendered. Other hosts render exactly as before.
 *
 * The form owns its draft; the host decides when it is open (mount it with a
 * `key` per entry) and unmounts it after a successful save. A failed save
 * leaves it mounted, so the draft is kept. `onDirtyChange` reports whether the draft
 * differs from what it opened with (38.9 D-14 Back guard).
 *
 * Colours via theme tokens only (CLAUDE.md).
 */
import { type Ref, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { isValidLinkInput, LINK_FIELD_ERROR } from "@/logic/url-validation";
import {
  canSaveOffLimitsForm,
  isOffLimitsFormDirty,
  normalizeOffLimitsForm,
  offLimitsFormDraft,
} from "@/screens/create-contact-logic";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { normaliseLinkUrl } from "./LinksEditor";
import { openMemoryLink } from "./MemoryCard";
import { AppText, Button, EntryTextField, FieldError } from "./ui";

/** What the form opens with: a stored row, or null for a new item. */
export interface OffLimitsFormInitial {
  text: string | null;
  label: string | null;
  url: string | null;
}

/** What a Save hands the host: trimmed, blank → null. */
export interface OffLimitsFormFields {
  text: string | null;
  label: string | null;
  /** The trimmed link, or the stored one unchanged when `showLink` is off. */
  url: string | null;
}

export interface OffLimitsFormProps {
  initial: OffLimitsFormInitial | null;
  /** Show the Link field. Absent → true. */
  showLink?: boolean;
  /**
   * The host writes, then unmounts the form on success; a failed save leaves
   * it mounted, which keeps the draft. Awaited for the single-flight hold.
   */
  onSave: (fields: OffLimitsFormFields) => Promise<void>;
  onCancel: () => void;
  /** When given, the form shows Delete (destructive actions stay off list cards, 38.9 D-30). */
  onDelete?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** The host's save is in flight: every control is held (D-26). */
  busy?: boolean;
  /**
   * Card edit mode (D-130; the Off Limits editor only): Open link, Move and a
   * red Delete at the top of the form, no bottom Delete. Absent → unchanged.
   */
  cardEditMode?: boolean;
  /** Card edit mode: Move, which the host routes through its dirty-aware close. */
  onMove?: () => void;
  /** Attached to the form's outer View, so a host can scroll it into view. */
  formRef?: Ref<View>;
  testID?: string;
}

function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** The Link field's error: null when blank or a web address (G-13). */
export function offLimitsLinkError(url: string): string | null {
  return isValidLinkInput(url, normaliseLinkUrl) ? null : LINK_FIELD_ERROR;
}

export function OffLimitsForm({
  initial,
  showLink = true,
  onSave,
  onCancel,
  onDelete,
  onDirtyChange,
  busy = false,
  cardEditMode = false,
  onMove,
  formRef,
  testID,
}: OffLimitsFormProps) {
  const { colors } = useTheme();
  const [baseline] = useState(() => offLimitsFormDraft(initial ?? undefined));
  const [draft, setDraft] = useState(baseline);
  const storedUrl = initial?.url ?? null;
  const [url, setUrl] = useState(storedUrl ?? "");
  // Single-flight Save (G-15): the ref drops a second tap in the same frame;
  // the state holds the controls while an async save runs.
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const held = busy || saving;

  const linkError = showLink ? offLimitsLinkError(url) : null;
  const effectiveUrl = showLink ? trimmedOrNull(url) : storedUrl;
  const savable =
    canSaveOffLimitsForm(draft, effectiveUrl) && linkError === null;
  const dirty =
    isOffLimitsFormDirty(baseline, draft) ||
    (showLink && trimmedOrNull(url) !== trimmedOrNull(storedUrl ?? ""));

  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  useEffect(() => {
    onDirtyChangeRef.current?.(dirty);
  }, [dirty]);

  const commit = async () => {
    if (held || !savable || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave({ ...normalizeOffLimitsForm(draft), url: effectiveUrl });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.background,
      borderColor: colors.border,
      color: colors.textPrimary,
    },
  ];

  return (
    <View
      testID={testID}
      ref={formRef}
      style={[
        styles.form,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {cardEditMode ? (
        // D-130: the Open link stays visible (D-24); Move and the red Delete
        // only in edit mode, at the top right of the open card.
        <View style={styles.cardActions}>
          {storedUrl ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Open Off Limits link"
              hitSlop={8}
              onPress={() => openMemoryLink(storedUrl)}
              style={styles.link}
            >
              <AppText role="caption" style={{ color: colors.accentText }}>
                Open link
              </AppText>
            </Pressable>
          ) : null}
          <View style={styles.cardButtons}>
            {onMove ? (
              <Button
                role="secondary"
                label="Move"
                accessibilityLabel="Move Off Limits item"
                disabled={held}
                onPress={() => {
                  if (held) return;
                  onMove();
                }}
              />
            ) : null}
            {onDelete ? (
              <Button
                testID={testID ? `${testID}-delete` : undefined}
                role="destructive"
                label="Delete"
                accessibilityLabel="Delete Off Limits item"
                disabled={held}
                onPress={() => {
                  if (held) return;
                  onDelete();
                }}
              />
            ) : null}
          </View>
        </View>
      ) : null}
      <EntryTextField
        testID={testID ? `${testID}-text` : undefined}
        accessibilityLabel="Off Limits item"
        value={draft.text}
        onChangeText={(text) => setDraft((prev) => ({ ...prev, text }))}
        onSubmit={() => void commit()}
        returnKeyType="done"
        placeholder="A topic to avoid bringing up"
        editable={!held}
      />
      <TextInput
        testID={testID ? `${testID}-label` : undefined}
        accessibilityLabel="Label (optional)"
        value={draft.label}
        onChangeText={(label) => setDraft((prev) => ({ ...prev, label }))}
        placeholder="Label (optional)"
        placeholderTextColor={colors.textPlaceholder}
        editable={!held}
        style={inputStyle}
      />
      {showLink ? (
        <>
          <TextInput
            testID={testID ? `${testID}-link` : undefined}
            accessibilityLabel="Off Limits link optional"
            value={url}
            onChangeText={setUrl}
            placeholder="Link (optional)"
            placeholderTextColor={colors.textPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!held}
            style={inputStyle}
          />
          <FieldError
            message={linkError}
            testID={testID ? `${testID}-link-error` : undefined}
          />
        </>
      ) : null}
      <View style={styles.actions}>
        <Button
          role="secondary"
          label="Cancel"
          disabled={held}
          onPress={onCancel}
        />
        <Button
          testID={testID ? `${testID}-save` : undefined}
          role="primary"
          label="Save"
          disabled={!savable || held}
          onPress={() => void commit()}
        />
      </View>
      {onDelete && !cardEditMode ? (
        <Button
          testID={testID ? `${testID}-delete` : undefined}
          role="tertiary"
          label="Delete"
          disabled={held}
          onPress={() => {
            if (held) return;
            onDelete();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  cardActions: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "space-between",
  },
  cardButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "flex-end",
    marginLeft: "auto",
  },
  form: {
    borderRadius: SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
    padding: SPACING.base,
  },
  link: { alignSelf: "flex-start" },
  input: {
    borderRadius: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
});
