// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/icons/Icon";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import type { ProfileIdentity } from "@/db/profile-read";
import { profileHeroActionState } from "@/profile/relationship-sheet-model";
import { SPACING } from "@/theme/tokens/spacing";

export function ProfileHero({
  identity,
  actionableMethods,
  onToggleFavourite,
  onMessage,
  onCall,
  onOpenOverflow,
  pendingFavourite = false,
}: {
  identity: ProfileIdentity;
  actionableMethods: Parameters<typeof profileHeroActionState>[0];
  onToggleFavourite: () => void;
  onMessage: () => void;
  onCall: () => void;
  onOpenOverflow: () => void;
  pendingFavourite?: boolean;
}) {
  const actions = profileHeroActionState(actionableMethods);
  return (
    <View testID="profile-hero" style={styles.root}>
      <View style={styles.utilityRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            identity.favouriteRank === null
              ? `Add ${identity.name} to Favorites`
              : `Remove ${identity.name} from Favorites`
          }
          disabled={pendingFavourite}
          onPress={onToggleFavourite}
          style={styles.iconAction}
        >
          <Icon
            name="favorite"
            state={identity.favouriteRank === null ? "default" : "active"}
          />
        </Pressable>
        <Button
          role="iconOnly"
          icon="overflow"
          accessibilityLabel={`More actions for ${identity.name}`}
          onPress={onOpenOverflow}
        />
      </View>
      <Avatar
        photo={identity.photo}
        name={identity.name}
        contactId={identity.id}
        cacheBust={identity.photoCacheBust}
        size={112}
      />
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
  root: { alignItems: "center", gap: SPACING.base },
  utilityRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconAction: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
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
