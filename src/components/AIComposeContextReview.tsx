// biome-ignore-all lint/a11y/useValidAriaRole: `role` is Orbit's visual/typography domain prop.
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import type { PromptContext, ResolvedPrompt } from "@/ai/prompt-types";
import { AppText, Button, GlassSurface } from "@/components/ui";
import { buildContactPromptReview } from "@/screens/settings-ai-logic";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

export interface AIComposeContextReviewProps {
  visible: boolean;
  resolved: ResolvedPrompt;
  context: PromptContext;
  onDismiss: () => void;
}

/** Contact-only transparency for the exact prompt used by one generation. */
export function AIComposeContextReview({
  visible,
  resolved,
  context,
  onDismiss,
}: AIComposeContextReviewProps) {
  const { colors } = useTheme();
  const review = buildContactPromptReview(resolved, context);

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onDismiss}>
      <ScrollView
        testID="ai-compose-context-review"
        contentContainerStyle={[
          styles.content,
          { backgroundColor: colors.background },
        ]}
      >
        <AppText role="heading">What Orbit is sharing</AppText>
        <AppText testID="ai-compose-context-heading" role="body">
          {review.heading}
        </AppText>
        {review.emptyMessage ? (
          <AppText testID="ai-compose-context-empty" role="caption">
            {review.emptyMessage}
          </AppText>
        ) : null}
        <GlassSurface style={styles.prompt}>
          <AppText role="caption">{review.display}</AppText>
        </GlassSurface>
        <View style={styles.actions}>
          <Button
            testID="ai-compose-context-done"
            role="primary"
            label="Done"
            accessibilityLabel="Close AI context review"
            onPress={onDismiss}
          />
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  prompt: {
    padding: SPACING.md,
  },
  actions: {
    alignItems: "flex-start",
  },
});
