// biome-ignore-all lint/a11y/useValidAriaRole: Orbit Button/AppText `role` is a domain prop, not ARIA.
import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { AppText, Sheet } from "@/components/ui";
import { ConfirmActions } from "@/components/ui/ConfirmDialog";
import { useUnscopedTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

interface GroupTitlePromptSheetProps {
  visible: boolean;
  onRequestClose: () => void;
  onConfirm: (title: string) => void;
  error?: string | null;
}

/** Android-safe local title entry for creating a parent around one interaction. */
export function GroupTitlePromptSheet({
  visible,
  onRequestClose,
  onConfirm,
  error = null,
}: GroupTitlePromptSheetProps) {
  // The sheet is an opaque surface, and this host reads above the overlay's
  // UnscopedTheme boundary: read the ROOT palette so the body text keeps the
  // secondary role and the error keeps the palette's danger red when opened
  // from a glass card (38.4 review Lane B2 WR-01; RG-029 / D-24).
  const { colors } = useUnscopedTheme();
  const [title, setTitle] = useState("");
  useEffect(() => {
    if (!visible) setTitle("");
  }, [visible]);
  const trimmed = title.trim();
  const confirm = () => {
    if (trimmed) onConfirm(trimmed);
  };
  return (
    <Sheet visible={visible} onRequestClose={onRequestClose} variant="compact">
      <View style={styles.content}>
        <AppText role="heading">Make this a group interaction</AppText>
        <AppText role="body" style={{ color: colors.textSecondary }}>
          Give this group event a title.
        </AppText>
        <TextInput
          accessibilityLabel="Group event title"
          autoFocus
          value={title}
          onChangeText={setTitle}
          // The keyboard's Done key creates the event (D-72): the actions can
          // sit below the fold of the lifted sheet while typing.
          returnKeyType="done"
          onSubmitEditing={confirm}
          placeholder="Group event title"
          placeholderTextColor={colors.textPlaceholder}
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
        />
        {error ? (
          <AppText role="caption" style={{ color: colors.danger }}>
            {error}
          </AppText>
        ) : null}
        {/* A row when both fit, stacked full-width at large text so Cancel is
            never pushed off the sheet (D-72; the ConfirmDialog treatment). */}
        <ConfirmActions
          cancelLabel="Cancel"
          confirmLabel="Create group event"
          destructive={false}
          confirmDisabled={!trimmed}
          onCancel={onRequestClose}
          onConfirm={confirm}
        />
      </View>
    </Sheet>
  );
}
const styles = StyleSheet.create({
  content: { gap: SPACING.md },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: SPACING.sm,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
  },
});
