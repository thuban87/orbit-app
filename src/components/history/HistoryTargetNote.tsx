// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button/AppText `role` is a domain prop, not ARIA.
/**
 * HistoryTargetNote (38.8 D-21, D-28, D-55) — the small note under the heatmap
 * for a truly empty target (no interaction, lifecycle or knowledge record): it
 * replaces the old count card in that slot. "Nothing logged on Tue Oct 5" or
 * "Nothing logged Sep 1 – Sep 7", an honest Log interaction offer (the parent
 * routes it dated for a day, undated for a span) and a close control.
 *
 * Presentational: the parent owns when it shows and clears (another heatmap
 * tap, a lens or preset change, paging, or close) and where Log routes. It is
 * announced once when it appears (a polite live region on the note itself; the
 * stream rows carry none). Every colour is a theme token via `useTheme()`
 * inside the glass card (mockup `.note`: a bordered raised row).
 */
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";

export interface HistoryTargetNoteProps {
  /** "Nothing logged on Tue Oct 5" / "Nothing logged Sep 1 – Sep 7". */
  text: string;
  /** Log interaction for this target (the parent builds the route). */
  onLog: () => void;
  /** The close control. */
  onClose: () => void;
  testID?: string;
}

export function HistoryTargetNote({
  text,
  onLog,
  onClose,
  testID = "history-target-note",
}: HistoryTargetNoteProps) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={[
        styles.note,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
        },
      ]}
    >
      <AppText role="body" testID={`${testID}-text`} style={styles.text}>
        {text}
      </AppText>
      <View style={styles.actions}>
        <Button
          role="tertiary"
          label="Log interaction"
          onPress={onLog}
          testID={`${testID}-log`}
        />
        <Button
          role="iconOnly"
          icon="close"
          accessibilityLabel="Dismiss note"
          onPress={onClose}
          testID={`${testID}-close`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    alignItems: "center",
    borderRadius: RADII.md,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  text: { flexShrink: 1 },
  actions: { alignItems: "center", flexDirection: "row", gap: SPACING.xs },
});
