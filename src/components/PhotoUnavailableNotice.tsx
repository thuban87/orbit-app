// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
/**
 * "Photo unavailable" (38.6 D-23, code review WR-01). A photo whose stored
 * reference names a missing or undecodable file KEEPS that reference (it is
 * never cleared by an automatic path); the Profile hero and the photo editor
 * say so with this notice instead of silently showing initials. The same
 * notice covers a photo-field value that is not a stored photo path (D-34:
 * text kept after a Text→Photo type change; it stays in the data). Smaller photos
 * (List, Grid, pickers, Orrery, widget) keep plain initials (owner, M3a).
 *
 * The look reuses the existing warning pattern (AINeedsAttention: warning icon
 * in the danger tone beside text): no new colour, badge or photo overlay.
 * Content-free: the copy never names the contact or the file.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Icon } from "@/components/icons/Icon";
import { AppText } from "@/components/ui/AppText";
import { PHOTO_UNAVAILABLE_LABEL } from "@/constants/photo-copy";
import { SPACING } from "@/theme/tokens/spacing";

export { PHOTO_UNAVAILABLE_LABEL };

/**
 * Load-failure state for a photo preview, fed by `Avatar.onLoadErrorChange`.
 * A thin `useState` wrapper so render tests can drive the failure by mocking
 * this module.
 */
export function usePhotoLoadFailure() {
  const [failed, setFailed] = useState(false);
  return [failed, setFailed] as const;
}

export function PhotoUnavailableNotice({
  testID = "photo-unavailable",
}: {
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={PHOTO_UNAVAILABLE_LABEL}
      style={styles.row}
    >
      <Icon name="warning" tone="danger" size="sm" />
      <AppText role="caption">{PHOTO_UNAVAILABLE_LABEL}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
});
