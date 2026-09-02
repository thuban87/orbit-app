import { StyleSheet, Text, View } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import { useTheme } from "@/theme";

function FabActionPlaceholder({
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
        <Text
          accessibilityRole="header"
          style={[styles.heading, { color: colors.textPrimary }]}
        >
          Coming soon
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {message}
        </Text>
      </View>
    </View>
  );
}

export function LogContactPlaceholderScreen() {
  return (
    <FabActionPlaceholder
      message="Detailed logging arrives with Rapid Capture."
      title="Log Contact"
    />
  );
}

export function GroupLogPlaceholderScreen() {
  return (
    <FabActionPlaceholder
      message="Group logging arrives with Group Events."
      title="Group Log"
    />
  );
}

export function UpdateContactPlaceholderScreen() {
  return (
    <FabActionPlaceholder
      message="Update Contact arrives with Rapid Capture."
      title="Update Contact"
    />
  );
}

export function MemoryPlaceholderScreen() {
  return (
    <FabActionPlaceholder
      message="Memories arrive with Contact Knowledge."
      title="Memory"
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  heading: { fontSize: 22, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 22, textAlign: "center" },
});
