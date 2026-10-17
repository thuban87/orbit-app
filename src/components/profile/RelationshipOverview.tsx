// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import {
  OVERVIEW_GAP,
  overviewColumnWidth,
  overviewTileWidth,
} from "@/components/profile/overview-geometry";
import { AppText } from "@/components/ui/AppText";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { ProfileSnapshot } from "@/db/profile-read";
import { isIndefiniteSnooze } from "@/db/snooze-dao";
import { packOverviewModules } from "@/profile/pack-overview";
import type { ProfileOverviewModuleId } from "@/profile/persisted-contract";
import { snoozeUntilLabel } from "@/profile/relationship-sheet-model";
import type { ProfileLayoutDocument } from "@/profile/types";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import {
  formatLocalDate,
  formatStoredBirthdayForDisplay,
  isSnoozed,
} from "@/utils/dates";

export type RelationshipSheetId =
  | "status"
  | "gravity"
  | "intensity"
  | "frequency"
  | "birthday"
  | "snooze";

/**
 * The Snooze tile's value (38.12 D-37, D-96): the EFFECTIVE snooze, like the
 * ⋯ menu and the sheet (`ProfileModuleHost` passes `isSnoozed(raw, today)`),
 * so an expired `snooze_until` reads "Not snoozed"; an indefinite snooze reads
 * "Snoozed · until you turn it off". Display only (38.9 D-48): the stored
 * YYYY-MM-DD stays raw.
 */
function snoozeTileValue(snoozeUntil: string | null, todayLocal: string) {
  if (snoozeUntil === null || !isSnoozed(snoozeUntil, todayLocal)) {
    return "Not snoozed";
  }
  return isIndefiniteSnooze(snoozeUntil)
    ? `Snoozed · ${snoozeUntilLabel(snoozeUntil)}`
    : `Snoozed ${snoozeUntilLabel(snoozeUntil)}`;
}

function frequencyLabel(days: number | null): string {
  return days === null
    ? "Not set"
    : `Every ${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * The Snooze tile shows only for a live Bound person (38.12 D-94): while
 * Unbound or in the Bin there is no Snooze on the Profile; the tile returns on
 * Bind and a stored snooze is left as data.
 */
export function overviewShowsSnooze(identity: {
  trackingEnabled: number;
  archivedAt?: string | null;
}): boolean {
  return identity.trackingEnabled === 1 && identity.archivedAt == null;
}

export function RelationshipOverview({
  snapshot,
  modules,
  onOpenSheet,
  onOpenHistory,
  todayLocal = formatLocalDate(new Date()),
}: {
  snapshot: ProfileSnapshot;
  modules: ProfileLayoutDocument["overview"];
  onOpenSheet: (sheet: RelationshipSheetId) => void;
  /**
   * Reveals the in-Profile History section (38.3 RG-021, D-10). Absent when the
   * layout hides History: the Last Interaction tile is then information only,
   * with no tap action and no button semantics (D-11).
   */
  onOpenHistory?: () => void;
  /** Today as a local `YYYY-MM-DD`, for the effective snooze (D-37). */
  todayLocal?: string;
}) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const birthday = snapshot.identity.birthday;
  // D-55: the Birthday tile shows only when a birthday is set; dropping it
  // before the packer repacks the grid with no gap.
  const showSnooze = overviewShowsSnooze(snapshot.identity);
  const visible = modules.filter(
    (module) =>
      module.visible &&
      (module.id !== "birthday" || Boolean(birthday)) &&
      (module.id !== "snooze" || showSnooze),
  );
  const packed = useMemo(
    () => packOverviewModules(visible, { width, fontScale }),
    [fontScale, visible, width],
  );
  // Shared with the layout editor's preview (RG-033 AUD-UIA-021).
  const columnWidth = overviewColumnWidth(width, packed.columns);

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
    birthday: {
      label: "Birthday",
      // 38.9 date standard (D-53): the year shows when it is known.
      value: birthday ? formatStoredBirthdayForDisplay(birthday) : "",
    },
    snooze: {
      label: "Snooze",
      value: snoozeTileValue(snapshot.identity.snoozeUntil ?? null, todayLocal),
    },
  };
  const action: Record<ProfileOverviewModuleId, (() => void) | undefined> = {
    "orbit-status": () => onOpenSheet("status"),
    gravity: () => onOpenSheet("gravity"),
    intensity: () => onOpenSheet("intensity"),
    "last-interaction": onOpenHistory,
    "contact-frequency": () => onOpenSheet("frequency"),
    birthday: () => onOpenSheet("birthday"),
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
        const tileWidth = overviewTileWidth(placement.columnSpan, columnWidth);
        const accessibilityLabel = `${item.label}. ${item.value}${item.detail ? `. ${item.detail}` : ""}`;
        const onPress = action[placement.id];
        const tile = (
          <GlassSurface
            key={placement.id}
            density="presentation"
            style={styles.tile}
          >
            <View style={styles.tileContent}>
              <AppText role="caption" style={styles.centeredText}>
                {item.label}
              </AppText>
              <AppText role="heading" style={styles.centeredText}>
                {item.value}
              </AppText>
              {item.detail ? (
                <AppText role="caption" style={styles.centeredText}>
                  {item.detail}
                </AppText>
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
            </View>
          </GlassSurface>
        );
        return onPress ? (
          <Pressable
            key={placement.id}
            testID={`profile-overview-${placement.id}`}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            onPress={onPress}
            style={{ width: tileWidth }}
          >
            {tile}
          </Pressable>
        ) : (
          <View
            key={placement.id}
            testID={`profile-overview-${placement.id}`}
            accessible
            accessibilityLabel={accessibilityLabel}
            style={{ width: tileWidth }}
          >
            {tile}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: OVERVIEW_GAP },
  tile: { minHeight: 112, padding: SPACING.base },
  tileContent: { alignItems: "center" },
  centeredText: { textAlign: "center" },
  gravity: { borderRadius: RADII.full, marginTop: SPACING.sm },
  histogram: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACING.xs,
  },
  bar: { width: SPACING.sm, borderRadius: RADII.pill },
});
