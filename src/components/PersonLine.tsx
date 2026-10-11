/**
 * PersonLine (38.9 D-45) — the "who is this form for" line: the person's avatar
 * and name. The shared header renders it under a person-scoped form's fixed
 * title (`ShellAppBar` `person`), and the Add Note sheet renders it under its
 * heading.
 *
 * Colours come from the component's own `useTheme()` (through `AppText` and
 * `Avatar`), so the line takes the glass foreground palette inside the
 * `GlassForegroundScope` that `ShellAppBar` opens over art, and the root
 * palette on an opaque surface such as a Sheet (CLAUDE.md: every colour through
 * theme tokens).
 *
 * The row is one accessibility element named by the person's name, so TalkBack
 * reads the name once rather than the avatar label and then the name.
 */
import { StyleSheet, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { AppText } from "@/components/ui/AppText";
import { SPACING } from "@/theme/tokens/spacing";

/** Avatar diameter on the person line (this plan only; tune here). */
export const PERSON_LINE_AVATAR_SIZE = 24;

export interface PersonLineProps {
  name: string;
  /** Stored RELATIVE photo path, or null for the initials avatar. */
  photo: string | null;
  contactId?: number;
}

export function PersonLine({ name, photo, contactId }: PersonLineProps) {
  return (
    <View
      accessible
      accessibilityLabel={name}
      testID="person-line"
      style={styles.row}
    >
      <Avatar
        photo={photo}
        name={name}
        contactId={contactId}
        size={PERSON_LINE_AVATAR_SIZE}
      />
      <AppText
        role="caption"
        numberOfLines={1}
        ellipsizeMode="tail"
        style={styles.name}
      >
        {name}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  name: { flexShrink: 1 },
});
