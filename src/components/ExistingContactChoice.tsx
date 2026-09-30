/**
 * The import duplicate choices (38.6 D-25 F-1). Both import flows ask the user
 * to pick which existing Orbit contact an incoming person matches; each choice
 * now shows that contact's photo (or initials) beside its name, because a face
 * tells two "Sam"s apart faster than a name.
 *
 *   - `ExistingContactChoiceSheet`: Duplicate review's "Choose an existing
 *     contact" sheet.
 *   - `LinkExistingChoiceButton`: one of Import review's "We found someone who
 *     might already be in Orbit." choices.
 *
 * Photos are the stored RELATIVE path rendered through `Avatar`, so a changed
 * photo refreshes here too (display revision, D-01). All colours resolve
 * through `useTheme()`.
 */
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import type { CandidateChoice } from "@/components/CandidateCardGrid";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

/** Choice avatar diameter (40); matches `PENDING_AVATAR_SIZE` in the Pending confirmations sheet. */
export const EXISTING_CONTACT_AVATAR_SIZE = SPACING["2xl"] - SPACING.sm;

/** Duplicate review's "Choose an existing contact" sheet. */
export function ExistingContactChoiceSheet({
  visible,
  choices,
  writing,
  onChoose,
  onClose,
}: {
  visible: boolean;
  choices: readonly CandidateChoice[];
  writing: boolean;
  onChoose: (choice: CandidateChoice) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
            Choose an existing contact
          </Text>
          {choices.map((choice) => (
            <Pressable
              key={choice.contactId}
              accessibilityRole="button"
              accessibilityLabel={[choice.name, choice.evidenceHint]
                .filter(Boolean)
                .join(", ")}
              accessibilityState={{ disabled: writing }}
              disabled={writing}
              onPress={() => onChoose(choice)}
              style={[styles.choice, { borderColor: colors.border }]}
            >
              <Avatar
                photo={choice.photo ?? null}
                name={choice.name}
                contactId={choice.contactId}
                size={EXISTING_CONTACT_AVATAR_SIZE}
              />
              <View style={styles.choiceText}>
                <Text style={{ color: colors.textPrimary }}>{choice.name}</Text>
                <Text style={{ color: colors.textSecondary }}>
                  {choice.evidenceHint}
                </Text>
              </View>
            </Pressable>
          ))}
          {choices.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>
              This matching contact is no longer available.
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

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
  modalRoot: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  sheet: { borderRadius: 12, borderWidth: 1, gap: 8, padding: 16 },
  sheetTitle: { fontSize: 18, fontWeight: "700" },
  choice: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    gap: SPACING.md,
    minHeight: 44,
    padding: 12,
  },
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
