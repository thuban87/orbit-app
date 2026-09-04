import { StyleSheet, View } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText } from "@/components/ui";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

function KnowledgePlaceholder({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ShellAppBar variant="child" title={title} />
      <View style={styles.content}>
        <AppText accessibilityRole="header" role="heading">
          Coming soon
        </AppText>
        <AppText role="body" style={{ color: colors.textSecondary }}>
          {message}
        </AppText>
      </View>
    </View>
  );
}

/** The real Recently Deleted flow replaces this shell in Plan 07. */
export function RecentlyDeletedPlaceholderScreen() {
  return (
    <KnowledgePlaceholder
      title="Recently Deleted"
      message="Restoring and permanently deleting Memories arrives next."
    />
  );
}

/** The real current-state backlist replaces this shell in Plan 07. */
export function MemoryHistoryPlaceholderScreen() {
  return (
    <KnowledgePlaceholder
      title="History"
      message="Earlier entries arrive next."
    />
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: "center",
    flex: 1,
    gap: SPACING.sm,
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
  },
  root: { flex: 1 },
});
