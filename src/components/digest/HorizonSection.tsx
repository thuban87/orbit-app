// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { ringVisual } from "@/components/ContactCard";
import {
  DigestListGroup,
  DigestListItem,
} from "@/components/digest/DigestListTransition";
import { AppText } from "@/components/ui/AppText";
import { NEVER_CONTACTED } from "@/constants/glossary";
import type { DashboardRow } from "@/db/dashboard-read";
import type { UpNextCandidateRow } from "@/db/up-next-read";
import type { UpcomingBirthday } from "@/logic/digest-composition";
import {
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
  /**
   * Everyone needing attention after Up Next's three, already deduplicated by
   * DigestScreen (38.13 D-61; one dedupe only, RESEARCH Pitfall 10).
   */
  overlooked: readonly UpNextCandidateRow[];
  /** Full `listDashboardPopulation` result for the `not-contacted` population. */
  neverContactedRows: readonly DashboardRow[];
  neverContactedCount: number;
  onOpenProfile: (contactId: number) => void;
  onDrillThrough: (target: HorizonDrillTarget) => void;
}

export function HorizonSection({
  birthdays,
  overlooked,
  neverContactedRows,
  neverContactedCount,
  onOpenProfile,
  onDrillThrough,
}: HorizonSectionProps) {
  const { colors } = useTheme();
  const overlookedPreview = previewWithOverflow(overlooked, PREVIEW_CAP);
  const never = neverContactedConditional(neverContactedCount);
  const neverPreview = previewWithOverflow(neverContactedRows, PREVIEW_CAP);
  const empty =
    birthdays.length === 0 && overlooked.length === 0 && !never.present;

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
          <DigestListGroup>
            {birthdays.map((birthday) => (
              <DigestListItem key={birthday.id}>
                <Pressable
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
                  <AppText
                    role="caption"
                    style={{ color: colors.textSecondary }}
                  >
                    {birthday.tag}
                  </AppText>
                </Pressable>
              </DigestListItem>
            ))}
          </DigestListGroup>
        </View>
      ) : null}

      {overlooked.length > 0 ? (
        <View testID="digest-horizon-overlooked" style={styles.group}>
          <AppText role="label">Overlooked</AppText>
          <DigestListGroup>
            {overlookedPreview.shown.map((row) => (
              <DigestListItem key={row.id}>
                <CompactContactRow
                  id={row.id}
                  name={row.name}
                  photo={row.photo}
                  status={row.status}
                  onPress={onOpenProfile}
                />
              </DigestListItem>
            ))}
            {overlookedPreview.overflow > 0 ? (
              <DigestListItem key="overlooked-more">
                <DrillRow
                  testID="digest-overlooked-more"
                  label="See everyone needing attention →"
                  onPress={() => onDrillThrough("overlooked")}
                />
              </DigestListItem>
            ) : null}
          </DigestListGroup>
        </View>
      ) : null}

      {never.present ? (
        <View testID="digest-horizon-never-contacted" style={styles.group}>
          <AppText role="label">{NEVER_CONTACTED}</AppText>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            {never.count === 1
              ? "1 person has never been contacted"
              : `${never.count} people have never been contacted`}
          </AppText>
          <DigestListGroup>
            {neverPreview.shown.map((row) => (
              <DigestListItem key={row.id}>
                <CompactContactRow
                  id={row.id}
                  name={row.name}
                  photo={row.photo}
                  status={null}
                  onPress={onOpenProfile}
                />
              </DigestListItem>
            ))}
            {neverPreview.overflow > 0 ? (
              <DigestListItem key="never-contacted-more">
                <DrillRow
                  testID="digest-never-contacted-more"
                  label={`+${neverPreview.overflow} more →`}
                  onPress={() => onDrillThrough("never-contacted")}
                />
              </DigestListItem>
            ) : null}
          </DigestListGroup>
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
  status: UpNextCandidateRow["status"] | null;
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
        accessibilityLabel={status ? `${status} status` : NEVER_CONTACTED}
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
      <AppText role="label" style={{ color: colors.accentText }}>
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
