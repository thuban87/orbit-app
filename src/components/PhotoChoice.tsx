import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import type { FieldChoiceMode } from "@/components/FieldChoiceGroup";
import { useTheme } from "@/theme";

export interface PhotoChoiceOption<T extends string = string> {
  id: T;
  /**
   * The existing Orbit contact's stored RELATIVE photo path, rendered through
   * Avatar so it follows the display revision (38.6 D-01/D-14). Takes
   * precedence over `uri`.
   */
  photo?: string | null;
  /**
   * Already-resolved local staging file URI (e.g. the reconcile source preview).
   * A raw/staged relative path is never accepted — use `photo` for canonical ones.
   */
  uri: string | null;
  name: string;
  provenance: string;
}

export const KEEP_ORBIT_PHOTO = "keep-orbit" as const;

/** The keep option's copy (shared by the full-width row and the photo card). */
const KEEP_ORBIT_PHOTO_TEXT = "No meaningful change — keep Orbit photo";

/**
 * The contact's current Orbit photo for the keep option (38.6 D-25 F-3): the
 * stored RELATIVE path, rendered through Avatar (display revision, D-01).
 */
export interface KeepOrbitPhoto {
  photo: string | null;
  name: string;
  contactId?: number | string;
}

interface PhotoChoiceProps<T extends string> {
  label?: string;
  options: readonly PhotoChoiceOption<T>[];
  mode: FieldChoiceMode;
  selectedId?: T | typeof KEEP_ORBIT_PHOTO | null;
  onChange: (selection: T | typeof KEEP_ORBIT_PHOTO) => void;
  /**
   * When set, the keep option is a photo card beside the option cards showing
   * the contact's Orbit photo (Update from Contacts). When absent it stays the
   * full-width row below them (Merge conflicts).
   */
  keepPhoto?: KeepOrbitPhoto;
}

/** A photo-specialized, write-free sibling of FieldChoiceGroup. */
export function PhotoChoice<T extends string>({
  label = "Photo",
  options,
  mode,
  selectedId,
  onChange,
  keepPhoto,
}: PhotoChoiceProps<T>) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<T | typeof KEEP_ORBIT_PHOTO | null>(
    () => (mode === "conflict" ? null : (options[0]?.id ?? null)),
  );
  const [errors, setErrors] = useState<Set<T>>(new Set());
  const activeId = selectedId === undefined ? selected : selectedId;

  // Built once so the keep option has a single ✓ block, rendered as a card in
  // the ScrollView (with `keepPhoto`) or as the full-width row below it.
  const keepOption = (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: activeId === KEEP_ORBIT_PHOTO }}
      {...(keepPhoto
        ? { accessibilityLabel: `${label}: ${KEEP_ORBIT_PHOTO_TEXT}` }
        : {})}
      onPress={() => {
        if (selectedId === undefined) setSelected(KEEP_ORBIT_PHOTO);
        onChange(KEEP_ORBIT_PHOTO);
      }}
      style={[
        keepPhoto ? styles.option : styles.keep,
        {
          backgroundColor: colors.surface,
          borderColor:
            activeId === KEEP_ORBIT_PHOTO ? colors.borderStrong : colors.border,
        },
      ]}
    >
      {keepPhoto ? (
        <Avatar
          photo={keepPhoto.photo}
          name={keepPhoto.name}
          contactId={keepPhoto.contactId}
          size={96}
        />
      ) : null}
      <Text
        {...(keepPhoto ? { numberOfLines: 3 } : {})}
        style={{ color: colors.textPrimary }}
      >
        {KEEP_ORBIT_PHOTO_TEXT}
      </Text>
      {activeId === KEEP_ORBIT_PHOTO ? (
        <Text
          accessibilityLabel="Selected"
          style={[styles.check, { color: colors.accentText }]}
        >
          ✓
        </Text>
      ) : null}
    </Pressable>
  );

  return (
    <View accessibilityLabel={`${label} choice`} style={styles.group}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <ScrollView
        horizontal
        contentContainerStyle={styles.options}
        showsHorizontalScrollIndicator={false}
      >
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
              style={[
                styles.option,
                {
                  backgroundColor: colors.surface,
                  borderColor: isSelected ? colors.borderStrong : colors.border,
                },
              ]}
            >
              {option.photo ? (
                <Avatar photo={option.photo} name={option.name} size={96} />
              ) : showPhoto ? (
                // The reconcile staging path is reused across scans, so a cached
                // decode could be stale: never serve this preview from the cache.
                <Image
                  source={{ uri: option.uri! }}
                  contentFit="cover"
                  cachePolicy="none"
                  style={styles.image}
                  onError={() =>
                    setErrors((current) => new Set([...current, option.id]))
                  }
                />
              ) : (
                <Avatar photo={null} name={option.name} size={96} />
              )}
              <Text
                numberOfLines={2}
                style={[styles.provenance, { color: colors.textSecondary }]}
              >
                {option.provenance}
              </Text>
              {isSelected ? (
                <Text
                  accessibilityLabel="Selected"
                  style={[styles.check, { color: colors.accentText }]}
                >
                  ✓
                </Text>
              ) : null}
            </Pressable>
          );
        })}
        {keepPhoto ? keepOption : null}
      </ScrollView>
      {keepPhoto ? null : keepOption}
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
  keep: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  check: { fontSize: 20, fontWeight: "700" },
});
