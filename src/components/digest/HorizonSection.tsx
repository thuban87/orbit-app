// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { ringVisual } from "@/components/ContactCard";
import { AppText } from "@/components/ui/AppText";
import type { DashboardRow } from "@/db/dashboard-read";
import type { OverlookedRow } from "@/db/digest-read";
import type { UpcomingBirthday } from "@/logic/digest-composition";
import {
  dedupOverlooked,
  neverContactedConditional,
  previewWithOverflow,
} from "@/logic/digest-composition";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

const PREVIEW_CAP = 3;

export type HorizonDrillTarget = "overlooked" | "never-contacted";

export interface HorizonSectionProps {
  birthdays: readonly UpcomingBirthday<{
    id: number;
    name: string;
    birthday: string | null;
  }>[];
  overlooked: readonly OverlookedRow[];
  /** Full `listDashboardPopulation` result for the `not-contacted` population. */
  neverContactedRows: readonly DashboardRow[];
  neverContactedCount: number;
  upNextIds: readonly number[];
  onOpenProfile: (contactId: number) => void;
  onDrillThrough: (target: HorizonDrillTarget) => void;
}

export function HorizonSection({
  birthdays,
  overlooked,
  neverContactedRows,
  neverContactedCount,
  upNextIds,
  onOpenProfile,
  onDrillThrough,
}: HorizonSectionProps) {
  const { colors } = useTheme();
  const remainingOverlooked = dedupOverlooked(overlooked, upNextIds);
  const overlookedPreview = previewWithOverflow(
    remainingOverlooked,
    PREVIEW_CAP,
  );
  const never = neverContactedConditional(neverContactedCount);
  const neverPreview = previewWithOverflow(neverContactedRows, PREVIEW_CAP);
  const empty =
    birthdays.length === 0 &&
    remainingOverlooked.length === 0 &&
    !never.present;

  return (
    <View testID="digest-horizon" style={styles.section}>
      <AppText accessibilityRole="header" role="heading">
        Horizon
      </AppText>
      {empty ? (
        <View style={styles.empty}>
          <AppText role="label">Nothing on the horizon</AppText>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            No birthdays or overlooked people to flag right now.
          </AppText>
        </View>
      ) : null}

      {birthdays.length > 0 ? (
        <View testID="digest-horizon-birthdays" style={styles.group}>
          <AppText role="label">Birthdays</AppText>
          {birthdays.map((birthday) => (
            <Pressable
              key={birthday.id}
              testID={`digest-birthday-row-${birthday.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${birthday.name}, ${birthday.tag}`}
              onPress={() => onOpenProfile(birthday.id)}
              style={styles.row}
            >
              <AppText
                numberOfLines={1}
                ellipsizeMode="tail"
                role="body"
                style={styles.name}
              >
                {birthday.name}
              </AppText>
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                {birthday.tag}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      {remainingOverlooked.length > 0 ? (
        <View testID="digest-horizon-overlooked" style={styles.group}>
          <AppText role="label">Overlooked</AppText>
          {overlookedPreview.shown.map((row) => (
            <CompactContactRow
              key={row.id}
              id={row.id}
              name={row.name}
              photo={row.photo}
              status={row.status}
              onPress={onOpenProfile}
            />
          ))}
          {overlookedPreview.overflow > 0 ? (
            <DrillRow
              testID="digest-overlooked-more"
              label="See everyone needing attention →"
              onPress={() => onDrillThrough("overlooked")}
            />
          ) : null}
        </View>
      ) : null}

      {never.present ? (
        <View testID="digest-horizon-never-contacted" style={styles.group}>
          <AppText role="label">Never Contacted</AppText>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            {never.count === 1
              ? "1 person has never been contacted"
              : `${never.count} people have never been contacted`}
          </AppText>
          {neverPreview.shown.map((row) => (
            <CompactContactRow
              key={row.id}
              id={row.id}
              name={row.name}
              photo={row.photo}
              status={null}
              onPress={onOpenProfile}
            />
          ))}
          {neverPreview.overflow > 0 ? (
            <DrillRow
              testID="digest-never-contacted-more"
              label={`+${neverPreview.overflow} more →`}
              onPress={() => onDrillThrough("never-contacted")}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function CompactContactRow({
  id,
  name,
  photo,
  status,
  onPress,
}: {
  id: number;
  name: string;
  photo: string | null;
  status: OverlookedRow["status"] | null;
  onPress: (contactId: number) => void;
}) {
  const { colors } = useTheme();
  const ring = ringVisual(
    status === "stable" ||
      status === "wobble" ||
      status === "decay" ||
      status === "rogue"
      ? status
      : null,
    colors,
  );
  return (
    <Pressable
      testID={`digest-horizon-contact-${id}`}
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={() => onPress(id)}
      style={styles.row}
    >
      <View
        accessibilityLabel={status ? `${status} status` : "Not yet contacted"}
        style={[
          styles.avatarRing,
          {
            borderColor: ring.color,
            borderWidth: ring.width,
            opacity: ring.opacity,
          },
        ]}
      >
        <Avatar photo={photo} name={name} contactId={id} size={40} />
      </View>
      <AppText
        numberOfLines={1}
        ellipsizeMode="tail"
        role="body"
        style={styles.name}
      >
        {name}
      </AppText>
    </Pressable>
  );
}

function DrillRow({
  testID,
  label,
  onPress,
}: {
  testID: string;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.drill}
    >
      <AppText role="label" style={{ color: colors.accent }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.md },
  group: { gap: SPACING.sm },
  empty: { gap: SPACING.xs },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  name: { flex: 1 },
  avatarRing: { borderRadius: 24, padding: SPACING.xs },
  drill: { minHeight: 44, justifyContent: "center" },
});
