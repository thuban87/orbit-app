// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import type { ProfileIdentity } from "@/db/profile-read";
import {
  type ProfileHeroMessageContext,
  profileHeroActionState,
} from "@/profile/relationship-sheet-model";
import {
  PROFILE_HERO_AVATAR_SIZE,
  PROFILE_HERO_GAP,
} from "@/screens/contact-profile-logic";
import { SPACING } from "@/theme/tokens/spacing";

export function ProfileHero({
  identity,
  actionableMethods,
  messageContext,
  onOpenPhoto,
  onMessage,
  onCall,
}: {
  identity: ProfileIdentity;
  actionableMethods: Parameters<typeof profileHeroActionState>[0];
  /**
   * Archive state and host for Message eligibility (D-09, D-25). A blocked
   * Message still renders — disabled, with its reason caption — never hidden.
   */
  messageContext: ProfileHeroMessageContext;
  /** Opens the photo lightbox (38.6 D-03/D-15); only reachable with a photo. */
  onOpenPhoto: () => void;
  onMessage: () => void;
  onCall: () => void;
}) {
  const actions = profileHeroActionState(actionableMethods, messageContext);
  return (
    <View testID="profile-hero" style={styles.root}>
      {identity.photo != null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View photo of ${identity.name}`}
          onPress={onOpenPhoto}
        >
          <Avatar
            photo={identity.photo}
            name={identity.name}
            contactId={identity.id}
            size={PROFILE_HERO_AVATAR_SIZE}
          />
        </Pressable>
      ) : (
        // No photo: the initials avatar has no lightbox entry (38.6 D-15).
        <Avatar
          photo={identity.photo}
          name={identity.name}
          contactId={identity.id}
          size={PROFILE_HERO_AVATAR_SIZE}
        />
      )}
      <View style={styles.identity}>
        <AppText role="display" accessibilityRole="header" style={styles.name}>
          {identity.name}
        </AppText>
        {identity.categoryName ? (
          <AppText role="label">{identity.categoryName}</AppText>
        ) : null}
      </View>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            role="primary"
            label="Message"
            accessibilityLabel={
              actions.message.enabled
                ? `Message ${identity.name}`
                : `Message unavailable. ${actions.message.reason}`
            }
            disabled={!actions.message.enabled}
            onPress={onMessage}
          />
          {actions.message.reason ? (
            <AppText role="caption">{actions.message.reason}</AppText>
          ) : null}
        </View>
        <View style={styles.action}>
          <Button
            role="secondary"
            label="Call"
            accessibilityLabel={
              actions.call.enabled
                ? `Call ${identity.name}`
                : `Call unavailable. ${actions.call.reason}`
            }
            disabled={!actions.call.enabled}
            onPress={onCall}
          />
          {actions.call.reason ? (
            <AppText role="caption">{actions.call.reason}</AppText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 38.6 D-04/D-17: the favourite star moved to the app bar, so the photo is
  // the hero's first child and grows upward (see profileContentTopPadding).
  root: { alignItems: "center", gap: PROFILE_HERO_GAP },
  identity: { alignItems: "center", gap: SPACING.xs },
  name: { textAlign: "center" },
  actions: {
    alignSelf: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  action: { flexGrow: 1, flexBasis: 144, gap: SPACING.xs },
});
