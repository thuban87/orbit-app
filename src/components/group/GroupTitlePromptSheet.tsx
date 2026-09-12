// biome-ignore-all lint/a11y/useValidAriaRole: Orbit Button/AppText `role` is a domain prop, not ARIA.
import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { AppText, Button, Sheet } from "@/components/ui";
import { useTheme } from "@/theme";
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
  const { colors } = useTheme();
  const [title, setTitle] = useState("");
  useEffect(() => {
    if (!visible) setTitle("");
  }, [visible]);
  const trimmed = title.trim();
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
          placeholder="Group event title"
          placeholderTextColor={colors.textSecondary}
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
        <View style={styles.actions}>
          <Button role="secondary" label="Cancel" onPress={onRequestClose} />
          <Button
            role="primary"
            label="Create group event"
            disabled={!trimmed}
            onPress={() => onConfirm(trimmed)}
          />
        </View>
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
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: SPACING.sm,
  },
});
