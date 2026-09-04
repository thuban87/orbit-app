import { Linking, Pressable, StyleSheet, View } from "react-native";
import {
  MEMORY_TYPE_REGISTRY,
  PROVISIONAL_MEMORY_LABEL,
} from "@/db/memory-registry";
import type { MemoryRow } from "@/db/memories-read";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { normaliseLinkUrl } from "./LinksEditor";
import { AppText } from "./ui";

function memoryTypeLabel(memory: MemoryRow): string {
  if (memory.type === "custom") {
    return memory.custom_label ?? PROVISIONAL_MEMORY_LABEL;
  }
  return (
    MEMORY_TYPE_REGISTRY[memory.type as keyof typeof MEMORY_TYPE_REGISTRY]
      ?.displayName ?? PROVISIONAL_MEMORY_LABEL
  );
}

export function openMemoryLink(url: string): void {
  void Linking.openURL(normaliseLinkUrl(url)).catch(() => {});
}

export interface MemoryCardProps {
  memory: MemoryRow;
  onPress?: () => void;
  subdued?: boolean;
  testID?: string;
}

/** Compact, presentational Memory summary; detailed metadata belongs in MemoryEditor. */
export function MemoryCard({
  memory,
  onPress,
  subdued = false,
  testID,
}: MemoryCardProps) {
  const { colors } = useTheme();
  const content = (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: subdued || memory.outdated === 1 ? 0.68 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <AppText role="label" style={{ color: colors.textSecondary }}>
          {memoryTypeLabel(memory)}
        </AppText>
        <View style={styles.markers}>
          {memory.pinned === 1 ? (
            <View
              accessibilityLabel="Pinned memory"
              accessible
              style={styles.marker}
            >
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                Pinned
              </AppText>
            </View>
          ) : null}
          {memory.outdated === 1 ? (
            <View
              accessibilityLabel="Marked outdated"
              accessible
              style={styles.marker}
            >
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                Outdated
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
      {memory.value ? (
        <AppText numberOfLines={2} role="body">
          {memory.value}
        </AppText>
      ) : null}
      {memory.note ? (
        <AppText
          numberOfLines={2}
          role="caption"
          style={{ color: colors.textSecondary }}
        >
          {memory.note}
        </AppText>
      ) : null}
      {memory.meaningful_date ? (
        <AppText role="caption" style={{ color: colors.textSecondary }}>
          {memory.meaningful_date}
        </AppText>
      ) : null}
      {memory.url ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open memory link"
          hitSlop={8}
          onPress={(event) => {
            event.stopPropagation();
            openMemoryLink(memory.url ?? "");
          }}
          style={styles.link}
        >
          <AppText
            numberOfLines={1}
            role="caption"
            style={{ color: colors.accent }}
          >
            Open link
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${memoryTypeLabel(memory)} memory`}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: SPACING.md,
    borderWidth: 1,
    gap: SPACING.xs,
    padding: SPACING.base,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "space-between",
  },
  link: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  marker: { justifyContent: "center", minHeight: 44, minWidth: 44 },
  markers: {
    flexDirection: "row",
    flexShrink: 1,
    flexWrap: "wrap",
    gap: SPACING.xs,
    justifyContent: "flex-end",
  },
});
