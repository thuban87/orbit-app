/** The initial reachable Things-to-Remember projection (KNOW-01). */
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui";
import { getExecutor } from "@/db/database";
import {
  MEMORY_TYPE_REGISTRY,
  PROVISIONAL_MEMORY_LABEL,
} from "@/db/memory-registry";
import {
  listMemoriesForContact,
  type MemoryRow,
} from "@/db/memories-read";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "things-to-remember";

function typeLabel(memory: MemoryRow): string {
  if (memory.type === "custom") {
    return memory.custom_label ?? PROVISIONAL_MEMORY_LABEL;
  }
  return MEMORY_TYPE_REGISTRY[memory.type as keyof typeof MEMORY_TYPE_REGISTRY]
    ?.displayName ?? PROVISIONAL_MEMORY_LABEL;
}

export function ThingsToRememberScreen({
  navigation,
  route,
}: RootStackScreenProps<"ThingsToRemember">) {
  const { colors } = useTheme();
  const { contactId } = route.params;
  const [memories, setMemories] = useState<MemoryRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void listMemoriesForContact(getExecutor(), contactId)
        .then((rows) => {
          if (!cancelled) setMemories(rows);
        })
        .catch((error) => {
          Logger.error(LOG_SCOPE, "failed to load memories", error);
          if (!cancelled) setMemories([]);
        });
      return () => {
        cancelled = true;
      };
    }, [contactId]),
  );

  return (
    <ScrollView
      testID="things-to-remember-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.back, { borderColor: colors.border }]}
        >
          <AppText role="caption">Back</AppText>
        </Pressable>
        <AppText accessibilityRole="header" role="display">
          Things to Remember
        </AppText>
      </View>

      {memories.length === 0 ? (
        <View testID="things-to-remember-empty" style={styles.empty}>
          <AppText role="heading">Nothing to remember yet</AppText>
          <AppText role="body" style={{ color: colors.textSecondary }}>
            Add birthdays, gift ideas, key people, and anything worth bringing up
            next time.
          </AppText>
        </View>
      ) : (
        <View style={styles.group}>
          <AppText role="heading">{PROVISIONAL_MEMORY_LABEL}s</AppText>
          {memories.map((memory) => (
            <View
              key={memory.id}
              testID={`things-to-remember-memory-${memory.id}`}
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <AppText role="label">{typeLabel(memory)}</AppText>
              {memory.value ? <AppText role="body">{memory.value}</AppText> : null}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.base, gap: SPACING.lg },
  header: { gap: SPACING.base },
  back: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: SPACING.sm,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
  },
  empty: { gap: SPACING.sm, marginTop: SPACING.lg },
  group: { gap: SPACING.md },
  card: {
    borderWidth: 1,
    borderRadius: SPACING.md,
    gap: SPACING.xs,
    padding: SPACING.base,
  },
});
