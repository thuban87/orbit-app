import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RegisteredModal } from "@/components/ui/RegisteredModal";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

/** One button on a resume prompt. */
export interface ResumePromptAction {
  /** Stable React key; also the button's visible label. */
  label: string;
  accessibilityLabel?: string;
  /** primary: accent fill · danger: danger outline · plain: no frame. */
  tone: "primary" | "danger" | "plain";
  onPress(): void;
}

export interface ResumePromptSheetProps {
  heading: string;
  body: string;
  actions: readonly ResumePromptAction[];
}

/**
 * The one layout both app-root resume prompts share (38.12 D-56): "Resume
 * your import?" and "Resume your check?" render the same structure and sizes,
 * so only their copy and actions differ.
 *
 * Large text (38.4 D-49): the heading and body scroll in a bounded ScrollView,
 * the card shrinks to the safe-area inset window, and the actions sit outside
 * the scroll so they are always reachable. The exit is explicit-action-only:
 * an Android back press must not silently abandon or dismiss paused work.
 */
export function ResumePromptSheet({
  heading,
  body,
  actions,
}: ResumePromptSheetProps) {
  const { colors } = useTheme();
  // D-49: inset by the safe area so the bounded card never meets the bars.
  const insets = useSafeAreaInsets();
  const frame = {
    primary: { backgroundColor: colors.accent },
    danger: { borderWidth: 1, borderColor: colors.danger },
    plain: {},
  } as const;
  // ADR-084: a label on an accent fill reads onAccent.
  const labelColor = {
    primary: colors.onAccent,
    danger: colors.danger,
    plain: colors.textPrimary,
  } as const;
  return (
    <RegisteredModal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => undefined}
    >
      <View
        style={[
          styles.modalRoot,
          {
            paddingTop: insets.top + SPACING.lg,
            paddingBottom: insets.bottom + SPACING.lg,
          },
        ]}
      >
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.scrim,
            { backgroundColor: colors.background },
          ]}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          {/* D-49: the heading and body give up height first and scroll at
              large text; the actions below stay outside, always reachable. */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
          >
            <Text style={[styles.heading, { color: colors.textPrimary }]}>
              {heading}
            </Text>
            <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
              {body}
            </Text>
          </ScrollView>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel ?? action.label}
              onPress={action.onPress}
              style={[styles.button, frame[action.tone]]}
            >
              <Text
                style={[styles.buttonLabel, { color: labelColor[action.tone] }]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </RegisteredModal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  scrim: { opacity: 0.85 },
  // flexShrink: the card never outgrows the (safe-area inset) window (D-49).
  sheet: {
    flexShrink: 1,
    gap: 14,
    padding: 20,
    borderWidth: 1,
    borderRadius: 12,
  },
  heading: { fontSize: 20, fontWeight: "700" },
  // Bounded scroll body: short copy keeps its height, tall copy scrolls (D-49).
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { gap: 14 },
  bodyText: { fontSize: 15, lineHeight: 22 },
  button: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  buttonLabel: { fontSize: 16, fontWeight: "700" },
});
