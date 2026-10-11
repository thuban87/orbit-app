// biome-ignore-all lint/a11y/useValidAriaRole: Orbit Button/AppText `role` is a domain prop, not ARIA.
import { useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { AppText, Sheet } from "@/components/ui";
import { ConfirmActions } from "@/components/ui/ConfirmDialog";
import { confirmDiscard } from "@/navigation/discard-keep-guard";
import { useUnscopedTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

interface GroupTitlePromptSheetProps {
  visible: boolean;
  onRequestClose: () => void;
  /**
   * Creates the event. Return the write's promise so the sheet can hold its
   * exits (and a second Create) until it settles (verification IN-01).
   */
  onConfirm: (title: string) => Promise<unknown> | undefined;
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
  // Set while the host's create is in flight (verification IN-01).
  const savingRef = useRef(false);
  useEffect(() => {
    if (!visible) setTitle("");
  }, [visible]);
  const trimmed = title.trim();
  const confirm = () => {
    if (!trimmed || savingRef.current) return;
    savingRef.current = true;
    const release = () => {
      savingRef.current = false;
    };
    let pending: Promise<unknown>;
    try {
      pending = Promise.resolve(onConfirm(trimmed));
    } catch (thrown) {
      release();
      throw thrown;
    }
    void pending.then(release, release);
  };
  // Back, the scrim and Cancel (D-14, D-61; review CR-02, verification
  // WR-01): a typed title asks "Discard changes?" first; an empty field
  // closes at once. confirmDiscard() is single-flight, so a second exit never
  // closes twice.
  const requestSheetClose = () => {
    // A create in flight owns the close (IN-01): success closes the sheet,
    // failure shows the error. A prompt now would outlive the sheet.
    if (savingRef.current) return;
    if (!trimmed) {
      onRequestClose();
      return;
    }
    void confirmDiscard().then((discard) => {
      if (discard) onRequestClose();
    });
  };
  return (
    <Sheet
      visible={visible}
      onRequestClose={requestSheetClose}
      variant="compact"
    >
      <View style={styles.content}>
        <AppText role="heading">Make this an event</AppText>
        <AppText role="body" style={{ color: colors.textSecondary }}>
          Give this event a title.
        </AppText>
        <TextInput
          accessibilityLabel="Event title"
          autoFocus
          value={title}
          onChangeText={setTitle}
          // The keyboard's Done key creates the event (D-72): the actions can
          // sit below the fold of the lifted sheet while typing.
          returnKeyType="done"
          onSubmitEditing={confirm}
          placeholder="Event title"
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
          confirmLabel="Create event"
          destructive={false}
          confirmDisabled={!trimmed}
          onCancel={requestSheetClose}
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
