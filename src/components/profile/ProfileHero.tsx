// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import { PhotoUnavailableNotice } from "@/components/PhotoUnavailableNotice";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import type { ContactMethodGroups } from "@/db/contact-methods-read";
import type { ProfileIdentity } from "@/db/profile-read";
import {
  type ProfileHeroMessageContext,
  profileHeroActionState,
  savedMethodKinds,
} from "@/profile/relationship-sheet-model";
import {
  type HeroNameLayoutPart,
  PROFILE_HERO_AVATAR_SIZE,
  PROFILE_HERO_GAP,
} from "@/screens/contact-profile-logic";
import { SPACING } from "@/theme/tokens/spacing";

export function ProfileHero({
  identity,
  actionableMethods,
  methodGroups,
  messageContext,
  photoOpenable = true,
  onPhotoLoadErrorChange,
  onOpenPhoto,
  onEdit,
  onMessage,
  onCall,
  onNameLayout,
}: {
  identity: ProfileIdentity;
  actionableMethods: Parameters<typeof profileHeroActionState>[0];
  /**
   * Every saved method, actionable or not (`snapshot.methods`), so a disabled
   * Message/Call says "no number" or "a number that can't be used" truthfully
   * (38.11 D-27).
   */
  methodGroups: ContactMethodGroups;
  /**
   * Archive state and host for Message eligibility (D-09, D-25). A blocked
   * Message still renders — disabled, with its reason caption — never hidden.
   */
  messageContext: ProfileHeroMessageContext;
  /**
   * False while the photo fails to load (the Avatar shows initials): the photo
   * is then not a lightbox entry, so a tap never opens a blank lightbox
   * (38.6 review WR-06). Driven by `onPhotoLoadErrorChange`.
   */
  photoOpenable?: boolean;
  /** Forwarded to the hero Avatar's `onLoadErrorChange`. */
  onPhotoLoadErrorChange?: (errored: boolean) => void;
  /** Opens the photo lightbox (38.6 D-03/D-15); only reachable with a loadable photo. */
  onOpenPhoto: () => void;
  /** Opens Edit Contact (38.11 D-63: the Hero's full-width top action). */
  onEdit: () => void;
  /** Opens Compose (38.11 D-47 label; D-46 behaviour unchanged). */
  onMessage: () => void;
  onCall: () => void;
  /**
   * Reports the layouts that place the name (38.11 D-57): the Hero root,
   * the identity View and the name, each relative to its parent. The screen
   * sums them into scroll-content coordinates (`createHeroNameTracker`).
   */
  onNameLayout?: (part: HeroNameLayoutPart, y: number, height: number) => void;
}) {
  const report =
    (part: HeroNameLayoutPart) =>
    ({ nativeEvent }: LayoutChangeEvent) =>
      onNameLayout?.(part, nativeEvent.layout.y, nativeEvent.layout.height);
  const actions = profileHeroActionState(
    actionableMethods,
    messageContext,
    savedMethodKinds(methodGroups),
  );
  return (
    <View testID="profile-hero" style={styles.root} onLayout={report("hero")}>
      {identity.photo != null ? (
        // WR-06: the same wrapper whether or not the photo loads, so the Avatar
        // is never remounted (a remount would reset its load error and flip
        // back). Unloadable, it is inert and TalkBack reads the initials.
        <Pressable
          accessible={photoOpenable}
          // Unloadable: out of the accessibility tree, so TalkBack reads the
          // initials Avatar alone (no "View photo", no "disabled" wrapper).
          importantForAccessibility={photoOpenable ? "auto" : "no"}
          accessibilityRole={photoOpenable ? "button" : undefined}
          // An explicit "": an omitted label left the native view's old
          // "View photo" description in place on device.
          accessibilityLabel={
            photoOpenable ? `View photo of ${identity.name}` : ""
          }
          disabled={!photoOpenable}
          onPress={photoOpenable ? onOpenPhoto : undefined}
        >
          <Avatar
            photo={identity.photo}
            name={identity.name}
            contactId={identity.id}
            size={PROFILE_HERO_AVATAR_SIZE}
            onLoadErrorChange={onPhotoLoadErrorChange}
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
      <View style={styles.identity} onLayout={report("identity")}>
        <AppText
          role="display"
          accessibilityRole="header"
          style={styles.name}
          onLayout={report("name")}
        >
          {identity.name}
        </AppText>
        {identity.categoryName ? (
          <AppText role="label">{identity.categoryName}</AppText>
        ) : null}
        {/* D-23: a kept reference whose file will not load says so. Under the
            name, so the D-04 photo and name lines never move. */}
        {identity.photo != null && !photoOpenable ? (
          <PhotoUnavailableNotice />
        ) : null}
      </View>
      {/* 38.11 D-63: a full-width Edit Contact above the Compose Message and
          Call pair, about twice their width; D-47 renames Message. */}
      <View testID="profile-hero-actions" style={styles.actionBlock}>
        <Button
          role="secondary"
          label="Edit Contact"
          accessibilityLabel={`Edit ${identity.name}`}
          onPress={onEdit}
        />
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button
              role="primary"
              label="Compose Message"
              accessibilityLabel={
                actions.message.enabled
                  ? `Compose a message to ${identity.name}`
                  : `Compose Message unavailable. ${actions.message.reason}`
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
    </View>
  );
}

const styles = StyleSheet.create({
  // 38.6 D-04/D-17: the favourite star moved to the app bar, so the photo is
  // the hero's first child and grows upward (see profileContentTopPadding).
  root: { alignItems: "center", gap: PROFILE_HERO_GAP },
  identity: { alignItems: "center", gap: SPACING.xs },
  name: { textAlign: "center" },
  // The Edit button spans the block; the pair below keeps two columns and
  // wraps to one at large font sizes (ADR-109 stable geometry).
  actionBlock: { alignSelf: "stretch", gap: SPACING.sm },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  action: { flexGrow: 1, flexBasis: 144, gap: SPACING.xs },
});
