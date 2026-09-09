// biome-ignore-all lint/a11y/useValidAriaRole: AppText uses semantic typography roles.
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { ProfileStatus } from "@/db/contact-status-read";
import { getExecutor, localDateTime } from "@/db/database";
import {
  readProfileCollapseOverride,
  setProfileCollapseOverride,
} from "@/db/profile-presentation-dao";
import { commitProfileOverviewToggle } from "@/screens/contact-profile-logic";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";

const STATUS_LABEL: Record<ProfileStatus, string> = {
  stable: "Stable",
  wobble: "Wobbly",
  decay: "Decaying",
  rogue: "Rogue",
};

export function ProfileOverviewTracer({
  contactId,
  status,
  expanded,
  onExpandedChange,
}: {
  contactId: number;
  status: ProfileStatus | null;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const { colors } = useTheme();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const toggle = useCallback(async () => {
    if (pending) return;
    setPending(true);
    setFailed(false);
    const exec = getExecutor();
    const result = await commitProfileOverviewToggle({
      currentExpanded: expanded,
      write: (next) =>
        setProfileCollapseOverride(exec, {
          contactId,
          moduleId: "relationship-overview",
          expanded: next,
          now: localDateTime(),
        }),
      read: () => readProfileCollapseOverride(exec, contactId),
      publish: onExpandedChange,
    });
    setPending(false);
    setFailed(!result.ok);
  }, [contactId, expanded, onExpandedChange, pending]);

  return (
    <GlassSurface style={styles.surface}>
      <Pressable
        testID="profile-overview-toggle"
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? "Collapse" : "Expand"} Relationship Overview`}
        accessibilityState={{ expanded, disabled: pending }}
        disabled={pending}
        onPress={() => void toggle()}
        style={styles.header}
      >
        <AppText role="heading" accessibilityRole="header">
          Relationship Overview
        </AppText>
        <AppText role="label">
          {pending ? "Saving…" : expanded ? "−" : "+"}
        </AppText>
      </Pressable>

      {expanded ? (
        <View
          testID="profile-overview-status"
          style={[styles.tile, { borderColor: colors.border }]}
        >
          <AppText role="caption">Status</AppText>
          <AppText role="body">
            {status ? STATUS_LABEL[status] : "Not tracked"}
          </AppText>
        </View>
      ) : null}

      {failed ? (
        <Pressable
          testID="profile-overview-retry"
          accessibilityRole="button"
          accessibilityLabel="Retry saving Relationship Overview"
          onPress={() => void toggle()}
          style={styles.retry}
        >
          <AppText role="caption">Couldn’t save. Retry</AppText>
        </Pressable>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  surface: { marginBottom: SPACING.base },
  header: {
    minHeight: 44,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tile: {
    borderTopWidth: 1,
    marginHorizontal: SPACING.base,
    paddingVertical: SPACING.base,
    gap: SPACING.xs,
  },
  retry: {
    minHeight: 44,
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    justifyContent: "center",
    borderRadius: RADII.md,
  },
});
