// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { ProfileSnapshot } from "@/db/profile-read";
import { packOverviewModules } from "@/profile/pack-overview";
import type { ProfileOverviewModuleId } from "@/profile/persisted-contract";
import type { ProfileLayoutDocument } from "@/profile/types";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";

export type RelationshipSheetId =
  | "status"
  | "gravity"
  | "intensity"
  | "frequency"
  | "snooze";

function frequencyLabel(days: number | null): string {
  return days === null
    ? "Not set"
    : `Every ${days} ${days === 1 ? "day" : "days"}`;
}

export function RelationshipOverview({
  snapshot,
  modules,
  onOpenSheet,
  onOpenHistory,
}: {
  snapshot: ProfileSnapshot;
  modules: ProfileLayoutDocument["overview"];
  onOpenSheet: (sheet: RelationshipSheetId) => void;
  onOpenHistory: () => void;
}) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const visible = modules.filter((module) => module.visible);
  const packed = useMemo(
    () => packOverviewModules(visible, { width, fontScale }),
    [fontScale, visible, width],
  );
  const columnWidth =
    packed.columns > 0
      ? Math.max(
          0,
          (width - SPACING.sm * (packed.columns - 1)) / packed.columns,
        )
      : width;

  const content: Record<
    ProfileOverviewModuleId,
    { label: string; value: string; detail?: string }
  > = {
    "orbit-status": {
      label: "Orbit Status",
      value: snapshot.metrics.status.label,
      detail: snapshot.metrics.status.context,
    },
    gravity: {
      label: "Gravity",
      value: snapshot.metrics.gravity.label,
      detail: snapshot.metrics.gravity.context,
    },
    intensity: {
      label: "Intensity",
      value: snapshot.metrics.intensity.label,
      detail: snapshot.metrics.intensity.window.label,
    },
    "last-interaction": {
      label: "Last Interaction",
      value:
        snapshot.history.status === "ready"
          ? snapshot.history.data.summary.text
          : "Not available yet",
    },
    "contact-frequency": {
      label: "Contact Frequency",
      value: frequencyLabel(snapshot.identity.intervalDays),
      detail:
        snapshot.identity.trackingEnabled === 1 ||
        snapshot.identity.intervalDays === null
          ? undefined
          : "Inactive while Unbound",
    },
    snooze: {
      label: "Snooze",
      value: snapshot.identity.snoozeUntil
        ? `Snoozed until ${snapshot.identity.snoozeUntil}`
        : "Not snoozed",
    },
  };
  const action: Record<ProfileOverviewModuleId, () => void> = {
    "orbit-status": () => onOpenSheet("status"),
    gravity: () => onOpenSheet("gravity"),
    intensity: () => onOpenSheet("intensity"),
    "last-interaction": onOpenHistory,
    "contact-frequency": () => onOpenSheet("frequency"),
    snooze: () => onOpenSheet("snooze"),
  };

  return (
    <View
      testID="relationship-overview-grid"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.grid, { minHeight: width === 0 ? 1 : undefined }]}
    >
      {packed.placements.map((placement) => {
        const item = content[placement.id];
        const tileWidth =
          columnWidth * placement.columnSpan +
          SPACING.sm * (placement.columnSpan - 1);
        return (
          <Pressable
            key={placement.id}
            testID={`profile-overview-${placement.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}. ${item.value}${item.detail ? `. ${item.detail}` : ""}`}
            onPress={action[placement.id]}
            style={{ width: tileWidth }}
          >
            <GlassSurface density="presentation" style={styles.tile}>
              <AppText role="caption">{item.label}</AppText>
              <AppText role="heading">{item.value}</AppText>
              {item.detail ? (
                <AppText role="caption">{item.detail}</AppText>
              ) : null}
              {placement.id === "gravity" &&
              snapshot.metrics.gravity.available ? (
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    styles.gravity,
                    {
                      width:
                        16 + snapshot.metrics.gravity.factors.tierIndex * 12,
                      height:
                        16 + snapshot.metrics.gravity.factors.tierIndex * 12,
                      backgroundColor:
                        colors.gravityTiers[
                          snapshot.metrics.gravity.factors.tierIndex
                        ] ?? colors.borderStrong,
                    },
                  ]}
                />
              ) : null}
              {placement.id === "intensity" ? (
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={styles.histogram}
                >
                  {[8, 16, 12, 24].map((height) => (
                    <View
                      key={height}
                      style={[
                        styles.bar,
                        { height, backgroundColor: colors.borderStrong },
                      ]}
                    />
                  ))}
                </View>
              ) : null}
            </GlassSurface>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  tile: { minHeight: 112, padding: SPACING.base },
  gravity: { borderRadius: RADII.full, marginTop: SPACING.sm },
  histogram: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACING.xs,
  },
  bar: { width: SPACING.sm, borderRadius: RADII.pill },
});
