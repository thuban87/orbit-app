/**
 * Photo value widget (FLD-04) — DEFERRED placeholder.
 *
 * The `photo` field type stays valid across the app, but its input is a minimal
 * DISABLED placeholder this phase: no URL input, no file access, no
 * `share_with_ai` toggle. The native picker lands with the Phase 5 photo
 * pipeline; the plugin's URL/wikilink/vault-adapter resolution (`resolvePhotoSrc`)
 * does NOT port (Obsidian-coupled). Colours via `useTheme().colors.*`.
 */
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme";
import type { FieldWidgetProps } from "./types";

export function PhotoFieldWidget({ label, testID }: FieldWidgetProps) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityLabel={label}
      style={[
        styles.placeholder,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        Photo picker arrives with the Phase 5 photo pipeline.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: "dashed",
    paddingHorizontal: 12,
    paddingVertical: 20,
    alignItems: "center",
  },
  text: {
    fontSize: 13,
    textAlign: "center",
  },
});
