import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import type { FieldChoiceMode } from "@/components/FieldChoiceGroup";
import { useTheme } from "@/theme";

export interface PhotoChoiceOption<T extends string = string> {
  id: T;
  /** Already-resolved local file URI. A raw/staged relative path is never accepted. */
  uri: string | null;
  name: string;
  provenance: string;
}

export const KEEP_ORBIT_PHOTO = "keep-orbit" as const;

interface PhotoChoiceProps<T extends string> {
  label?: string;
  options: readonly PhotoChoiceOption<T>[];
  mode: FieldChoiceMode;
  selectedId?: T | typeof KEEP_ORBIT_PHOTO | null;
  onChange: (selection: T | typeof KEEP_ORBIT_PHOTO) => void;
}

/** A photo-specialized, write-free sibling of FieldChoiceGroup. */
export function PhotoChoice<T extends string>({
  label = "Photo",
  options,
  mode,
  selectedId,
  onChange,
}: PhotoChoiceProps<T>) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<T | typeof KEEP_ORBIT_PHOTO | null>(() =>
    mode === "conflict" ? null : options[0]?.id ?? null,
  );
  const [errors, setErrors] = useState<Set<T>>(new Set());
  const activeId = selectedId === undefined ? selected : selectedId;

  return (
    <View accessibilityLabel={`${label} choice`} style={styles.group}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <ScrollView horizontal contentContainerStyle={styles.options} showsHorizontalScrollIndicator={false}>
        {options.map((option) => {
          const isSelected = activeId === option.id;
          const showPhoto = option.uri != null && !errors.has(option.id);
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${label}: ${option.provenance}`}
              onPress={() => {
                if (selectedId === undefined) setSelected(option.id);
                onChange(option.id);
              }}
              style={[styles.option, { backgroundColor: colors.surface, borderColor: isSelected ? colors.borderStrong : colors.border }]}
            >
              {showPhoto ? (
                <Image source={{ uri: option.uri! }} contentFit="cover" style={styles.image} onError={() => setErrors((current) => new Set([...current, option.id]))} />
              ) : (
                <Avatar photo={null} name={option.name} size={96} />
              )}
              <Text numberOfLines={2} style={[styles.provenance, { color: colors.textSecondary }]}>{option.provenance}</Text>
              {isSelected ? <Text accessibilityLabel="Selected" style={[styles.check, { color: colors.accent }]}>✓</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: activeId === KEEP_ORBIT_PHOTO }}
        onPress={() => {
          if (selectedId === undefined) setSelected(KEEP_ORBIT_PHOTO);
          onChange(KEEP_ORBIT_PHOTO);
        }}
        style={[styles.keep, { backgroundColor: colors.surface, borderColor: activeId === KEEP_ORBIT_PHOTO ? colors.borderStrong : colors.border }]}
      >
        <Text style={{ color: colors.textPrimary }}>No meaningful change — keep Orbit photo</Text>
        {activeId === KEEP_ORBIT_PHOTO ? <Text accessibilityLabel="Selected" style={[styles.check, { color: colors.accent }]}>✓</Text> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { fontSize: 13, fontWeight: "600" },
  options: { gap: 10 },
  option: { width: 124, borderWidth: 1, borderRadius: 10, padding: 8, gap: 6 },
  image: { width: 96, height: 96, borderRadius: 48, alignSelf: "center" },
  provenance: { fontSize: 13, fontWeight: "400" },
  keep: { minHeight: 44, borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  check: { fontSize: 20, fontWeight: "700" },
});
