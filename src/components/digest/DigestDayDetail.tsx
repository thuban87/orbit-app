import { StyleSheet, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/icons/Icon";
import { AppText } from "@/components/ui/AppText";
import type { YourWeekDayRow } from "@/db/your-week-read";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

const AVATAR_SIZE = 36;

export interface DigestDayDetailProps {
  date: string;
  rows: readonly YourWeekDayRow[];
  testID?: string;
}

function timeOf(occurredAt: string): string {
  return occurredAt.slice(11, 16);
}

export function DigestDayDetail({
  date,
  rows,
  testID = "digest-day-detail",
}: DigestDayDetailProps) {
  const { colors } = useTheme();

  return (
    <View
      testID={testID}
      accessibilityLabel={`Activity for ${date}`}
      style={[styles.container, { backgroundColor: colors.surfaceElevated }]}
    >
      {/* biome-ignore lint/a11y/useValidAriaRole: AppText role is a typography role. */}
      <AppText role="label">{date}</AppText>
      {rows.length === 0 ? (
        <AppText role="caption" style={{ color: colors.textSecondary }}>
          No activity on this date.
        </AppText>
      ) : (
        <View style={styles.list}>
          {rows.map((row) =>
            row.kind === "group_event" ? (
              <View
                key={`group-event-${row.id}`}
                testID={`${testID}-group-event-${row.id}`}
                accessibilityLabel={`Event, ${row.title ?? "Group Event"}, ${timeOf(row.occurredAt)}`}
                style={[styles.row, { borderColor: colors.border }]}
              >
                <Icon name="group-events" tone="textPrimary" size="sm" />
                <View style={styles.body}>
                  {/* biome-ignore lint/a11y/useValidAriaRole: AppText role is a typography role. */}
                  <AppText role="body" numberOfLines={1}>
                    {row.title ?? "Group Event"}
                  </AppText>
                  <AppText
                    role="caption"
                    style={{ color: colors.textSecondary }}
                  >
                    {timeOf(row.occurredAt)}
                  </AppText>
                </View>
              </View>
            ) : (
              <View
                key={`interaction-${row.id}`}
                testID={`${testID}-interaction-${row.id}`}
                accessibilityLabel={`Interaction with ${row.contactName ?? "Unknown contact"}, ${timeOf(row.occurredAt)}`}
                style={[styles.row, { borderColor: colors.border }]}
              >
                <Avatar
                  photo={null}
                  name={row.contactName ?? ""}
                  contactId={row.contactId ?? undefined}
                  size={AVATAR_SIZE}
                />
                <View style={styles.body}>
                  {/* biome-ignore lint/a11y/useValidAriaRole: AppText role is a typography role. */}
                  <AppText role="body" numberOfLines={1}>
                    {row.contactName ?? "Unknown contact"}
                  </AppText>
                  <AppText
                    role="caption"
                    style={{ color: colors.textSecondary }}
                  >
                    {timeOf(row.occurredAt)}
                  </AppText>
                </View>
              </View>
            ),
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.sm, padding: SPACING.md, borderRadius: SPACING.sm },
  list: { gap: SPACING.sm },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderBottomWidth: 1,
    paddingVertical: SPACING.sm,
  },
  body: { flex: 1, gap: SPACING.xs },
});
