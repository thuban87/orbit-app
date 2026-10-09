// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button/AppText `role` is a domain prop, not ARIA.
/**
 * HistoryTargetNote (38.8 D-21, D-28, D-55; D-17, D-64, D-65) — the small note
 * for a truly empty target (no interaction, lifecycle or knowledge record).
 *   • Under the heatmap it replaces the old count card: "Nothing logged on Tue
 *     Oct 5" or "Nothing logged Sep 1 – Sep 7".
 *   • Under the Jump to date button it is the empty-month state: "No activity
 *     in October 2025." followed by "Nearest:" and each nearest record date
 *     (after first, then before) as a link-style jump (D-65).
 * Both carry an honest Log interaction offer (the parent routes it dated for a
 * day, undated for a span or month) and a close control.
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

/** One nearest-date jump in the empty-month state (D-65). */
export interface HistoryTargetNoteNearest {
  /** Local `YYYY-MM-DD`. */
  readonly date: string;
  /** "Nov 3, 2025". */
  readonly label: string;
  /** "Jump to <full date with year>". */
  readonly accessibilityLabel: string;
}

export interface HistoryTargetNoteProps {
  /**
   * "Nothing logged on Tue Oct 5" / "Nothing logged Sep 1 – Sep 7" /
   * "No activity in October 2025.".
   */
  text: string;
  /** The empty-month state's nearest record dates, in display order (D-17). */
  nearest?: readonly HistoryTargetNoteNearest[];
  /** A nearest date was tapped: jump to it as a heatmap day tap does (D-65). */
  onNearest?: (date: string) => void;
  /** Log interaction for this target (the parent builds the route). */
  onLog: () => void;
  /** The close control. */
  onClose: () => void;
  testID?: string;
}

export function HistoryTargetNote({
  text,
  nearest,
  onNearest,
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
      <View style={styles.body}>
        <AppText role="body" testID={`${testID}-text`}>
          {text}
        </AppText>
        {nearest && nearest.length > 0 && onNearest ? (
          <View style={styles.nearest}>
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              Nearest:
            </AppText>
            {nearest.map((item) => (
              <Button
                key={item.date}
                role="tertiary"
                label={item.label}
                accessibilityLabel={item.accessibilityLabel}
                onPress={() => onNearest(item.date)}
                testID={`${testID}-nearest-${item.date}`}
              />
            ))}
          </View>
        ) : null}
      </View>
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
  body: { flexShrink: 1, gap: SPACING.xs },
  nearest: {
    alignItems: "center",
    columnGap: SPACING.sm,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  actions: { alignItems: "center", flexDirection: "row", gap: SPACING.xs },
});
