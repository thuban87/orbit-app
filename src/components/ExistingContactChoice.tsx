/**
 * The import duplicate choice (38.6 D-25 F-1). Import review asks the user to
 * pick which existing Orbit contact an incoming person matches; each choice
 * shows that contact's photo (or initials) beside its name, because a face
 * tells two "Sam"s apart faster than a name.
 *
 *   - `LinkExistingChoiceButton`: one of Import review's "We found someone who
 *     might already be in Orbit." choices.
 *
 * Duplicate review's former centred "Choose an existing contact" modal is
 * replaced by `MatchChoiceSheet` (38.12 D-107).
 *
 * Photos are the stored RELATIVE path rendered through `Avatar`, so a changed
 * photo refreshes here too (display revision, D-01). All colours resolve
 * through `useTheme()`.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

/** Choice avatar diameter (40); matches `PENDING_AVATAR_SIZE` in the Pending confirmations sheet. */
export const EXISTING_CONTACT_AVATAR_SIZE = SPACING["2xl"] - SPACING.sm;

/**
 * One of Import review's "might already be in Orbit" choices. A single match
 * is the accent-filled "Link to Existing"; with several, each is a
 * surface-filled "Choose this one".
 */
export function LinkExistingChoiceButton({
  choice,
  single,
  disabled,
  onPress,
}: {
  choice: { contactId: number; name: string; photo: string | null };
  single: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const primary = single ? "Link to Existing" : "Choose this one";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${primary}, ${choice.name}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.linkChoice,
        {
          backgroundColor: single ? colors.accent : colors.surface,
          borderColor: single ? colors.accent : colors.border,
        },
      ]}
    >
      <Avatar
        photo={choice.photo}
        name={choice.name}
        contactId={choice.contactId}
        size={EXISTING_CONTACT_AVATAR_SIZE}
      />
      <View style={styles.choiceText}>
        <Text
          style={{
            color: single ? colors.onAccent : colors.textPrimary,
          }}
        >
          {primary}
        </Text>
        <Text
          style={{
            color: single ? colors.onAccent : colors.textSecondary,
          }}
        >
          {choice.name}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Import review's `duplicateChoice` box, as a row (the Import as New / Skip
  // buttons keep the screen's own copy).
  linkChoice: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.md,
    minHeight: 44,
    padding: 12,
  },
  choiceText: { flex: 1, gap: 4 },
});
