/**
 * Dense, presentational dashboard List row. Reads and navigation remain owned
 * by HomeScreen; this component only renders the shared DashboardRow fields.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { StatusGlyph } from "@/components/icons/StatusGlyph";
import {
  ringVisual,
  type StatusDisplayState,
} from "@/components/contact-card-ring";
import type { ProfileStatus } from "@/db/contact-status-read";
import type { DashboardSearchResult } from "@/logic/dashboard-search-match";
import { useTheme } from "@/theme";
import { ICON_SIZE } from "@/theme/tokens/icon-size";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { TYPOGRAPHY } from "@/theme/tokens/typography";
import { isSnoozed } from "@/utils/dates";
import { formatLine2, formatListRecency } from "./list-row-content";

export interface ListRowProps {
  contactId: number;
  name: string;
  photo: string | null;
  modifiedAt: string;
  categoryLabel: string | null;
  lastContact: string | null;
  snoozeUntil: string | null;
  status: ProfileStatus | null;
  /** Captured once by HomeScreen for a deterministic render pass. */
  now: string;
  onPress: () => void;
  /** Reserved for the Plan 04 binary favourite control. */
  isFavourite?: boolean;
  onToggleFavourite?: () => void;
  /** Reserved for Plan 04's adaptive third content line. */
  line3?: { text: string; iconName?: string } | null;
  /** Reserved for Plan 06's search-specific row presentation. */
  searchResult?: DashboardSearchResult | null;
}

export function ListRow({
  contactId,
  name,
  photo,
  modifiedAt,
  categoryLabel,
  lastContact,
  snoozeUntil,
  status,
  now,
  onPress,
}: ListRowProps) {
  const { colors } = useTheme();
  const displayState: StatusDisplayState = isSnoozed(snoozeUntil, now)
    ? "snoozed"
    : status;
  // Snooze has a neutral border; all other states reuse their shared hue.
  const ring = ringVisual(
    displayState === "snoozed" ? null : displayState,
    colors,
  );
  const recency = formatListRecency(lastContact, now);

  return (
    <Pressable
      testID={`dashboard-list-row-${contactId}`}
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={onPress}
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: ring.color },
      ]}
    >
      <Avatar
        photo={photo}
        name={name}
        contactId={contactId}
        size={SPACING["2xl"]}
        cacheBust={modifiedAt}
      />
      <View style={styles.content}>
        <Text
          testID={`dashboard-list-row-name-${contactId}`}
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[styles.name, { color: colors.textPrimary }]}
        >
          {name}
        </Text>
        <Text
          testID={`dashboard-list-row-meta-${contactId}`}
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[styles.meta, { color: colors.textSecondary }]}
        >
          {formatLine2(recency, categoryLabel)}
        </Text>
        <View style={styles.reservedLine3} />
      </View>
      {displayState !== null ? (
        <View accessible={false} style={styles.statusGlyph}>
          <StatusGlyph state={displayState} size="md" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    borderRadius: RADII.lg,
    borderWidth: SPACING.xs / 2,
    flexDirection: "row",
    gap: SPACING.md,
    minHeight: SPACING["2xl"] + SPACING.lg,
    padding: SPACING.md,
  },
  content: {
    flex: 1,
    gap: SPACING.xs,
    minWidth: 0,
  },
  name: {
    fontFamily: TYPOGRAPHY.body.family,
    fontSize: TYPOGRAPHY.body.size,
    fontWeight: TYPOGRAPHY.body.weight,
    lineHeight: TYPOGRAPHY.body.lineHeight,
  },
  meta: {
    fontFamily: TYPOGRAPHY.caption.family,
    fontSize: TYPOGRAPHY.caption.size,
    fontWeight: TYPOGRAPHY.caption.weight,
    lineHeight: TYPOGRAPHY.caption.lineHeight,
  },
  reservedLine3: {
    height: TYPOGRAPHY.caption.lineHeight,
  },
  statusGlyph: {
    height: ICON_SIZE.md,
    width: ICON_SIZE.md,
  },
});
