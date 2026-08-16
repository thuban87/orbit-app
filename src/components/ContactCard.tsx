/**
 * ContactCard (DASH-03) — the ONE shared, purely PRESENTATIONAL card the
 * dashboard and the never-contacted screen both render per contact. It holds NO
 * DB read, NO `getExecutor`, NO `useNavigation` — the caller (Plan 05/07/09)
 * wires `onPress` and passes explicit props scoped by `dashboard-read` (08-01),
 * which already excludes `off_limits` / unconfirmed `source='ai'` / archived rows
 * in-query. The card performs no `.filter()` that could resurface private data
 * (threat T-08-10).
 *
 * LOCKED content contract (08-UI-SPEC § Card Content Contract): Avatar
 * (recyclingKey=contactId + cacheBust=modified_at — an anti-face-flash CORRECTNESS
 * requirement in the recycling FlatList, NOT an optimization), a status-ring
 * placeholder keyed to the band, the name (one line), the ranked fuel line OR a
 * fuel-match snippet, a category label (hidden when null), and a favourite marker.
 *
 * NOTHING LOG-DERIVED (04-log D/G): no recency string, no "N days ago", no channel
 * glyph, no gravity bar, no intensity, no quality — those are profile-only. The
 * card renders only profile-scoped props.
 *
 * FLAGGED owner decisions (owner's bucket — executor must NOT invent hexes or
 * binding taste; see 08-UI-SPEC § Owner Decisions Required):
 *   - OD-1 status-ring band tokens: `stable`/`wobble`/`decay` have NO colour token
 *     today (only `rogue` exists). This ships a TOKEN-CLEAN placeholder —
 *     shape/opacity over existing tokens (`rogue`/`textSecondary`/`border`) plus an
 *     `accessibilityLabel` naming the status so uiautomator UAT asserts it without
 *     colour inspection. The coloured-band variant is the owner's call.
 *   - OD-2 favourite marker: a provisional `accent` star (owner may swap in a
 *     dedicated favourite token / glyph).
 *   - OD-4 category chip: `surfaceElevated` + `textSecondary`, no per-category token.
 *
 * Arrangement here is a sensible starting point and explicitly owner-adjustable
 * (HANDOFF §12.4 / 08-UI-SPEC § Reference Layout) — the card LOCKS what it carries,
 * not the pixel layout.
 *
 * Every colour resolves through `useTheme().colors.*` — no hex/named literal
 * (CLAUDE.md / check:colors).
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { RankedFuelLine } from "@/components/RankedFuelLine";
import type { ProfileStatus } from "@/db/contact-status-read";
import { useTheme } from "@/theme";

export interface ContactCardProps {
  /** The contact's id — feeds the Avatar recyclingKey, the testIDs, and onPress. */
  contactId: number;
  /** Display name — the Body line + the Avatar initials/swatch source. */
  name: string;
  /** Stored RELATIVE photo path, or null for the themed initials fallback. */
  photo: string | null;
  /** The contact's `modified_at` — Avatar's cross-session cache-bust discriminator. */
  modifiedAt: string | undefined;
  /** Query-time status (null for a never-contacted contact — renders neutral). */
  status: ProfileStatus | null;
  /** Single-select category label, or null when the contact has no category. */
  categoryLabel: string | null;
  /** True when `favourite_rank IS NOT NULL`. */
  isFavourite: boolean;
  /** The top-ranked fuel line (already excluded/ranked by getRankedFuel). */
  fuelText: string | null;
  /** A fuel-match snippet when the list is filtered by a search term, else null. */
  snippet: string | null;
  /** Caller wires navigation — the card stays presentational. */
  onPress: () => void;
}

/**
 * A distinct, colour-free name per status so uiautomator UAT can assert the band
 * from the accessibilityLabel alone. A null status (never-contacted) reads a
 * neutral label — never "Stable" (mirrors the getContactStatus / dashboard-read
 * never-contacted guard).
 */
function statusLabel(status: ProfileStatus | null): string {
  switch (status) {
    case "stable":
      return "Stable";
    case "wobble":
      return "Wobbling";
    case "decay":
      return "Decaying";
    case "rogue":
      return "Rogue";
    default:
      return "Not yet contacted";
  }
}

export function ContactCard({
  contactId,
  name,
  photo,
  modifiedAt,
  status,
  categoryLabel,
  isFavourite,
  fuelText,
  snippet,
  onPress,
}: ContactCardProps) {
  const { colors } = useTheme();

  // OD-1 placeholder ring: rogue reads the one existing status token; the three
  // bands (and the neutral never-contacted state) differentiate ONLY by
  // shape/opacity over existing tokens. NO band hex is invented here — the
  // coloured-band variant is the owner's decision (check:colors bars a literal).
  const ringColor = status === "rogue" ? colors.rogue : colors.textSecondary;
  const ringOpacity =
    status === "rogue"
      ? 1
      : status === "decay"
        ? 0.9
        : status === "wobble"
          ? 0.6
          : status === "stable"
            ? 0.35
            : 0.2; // null / never-contacted → faint neutral

  return (
    <Pressable
      testID={`dashboard-card-${contactId}`}
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.avatarWrap}>
        <Avatar
          photo={photo}
          name={name}
          contactId={contactId}
          size={48}
          cacheBust={modifiedAt}
        />
        {/* OD-1 token-clean status ring (placeholder). */}
        <View
          testID={`dashboard-card-status-${contactId}`}
          accessibilityLabel={statusLabel(status)}
          style={[
            styles.statusRing,
            {
              borderColor: ringColor,
              opacity: ringOpacity,
              backgroundColor: colors.surface,
            },
          ]}
        />
      </View>

      <View style={styles.middle}>
        <Text
          testID={`dashboard-card-name-${contactId}`}
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[styles.name, { color: colors.textPrimary }]}
        >
          {name}
        </Text>

        {/* snippet present → show WHY it matched (fuel-match); else the ranked
            fuel line. The DAO (08-01) sets snippet non-null whenever the fuel text
            matches the term (incl. a name+fuel match, review MEDIUM-6), so the
            card's rule stays simply "snippet present → show snippet". */}
        {snippet !== null ? (
          <Text
            testID={`dashboard-card-fuel-${contactId}`}
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.snippet, { color: colors.textSecondary }]}
          >
            {snippet}
          </Text>
        ) : (
          <RankedFuelLine
            text={fuelText}
            testID={`dashboard-card-fuel-${contactId}`}
          />
        )}
      </View>

      <View style={styles.trailing}>
        {isFavourite ? (
          // OD-2 provisional accent star.
          <Text
            testID={`dashboard-card-favourite-${contactId}`}
            accessibilityLabel="Favourite"
            style={[styles.favourite, { color: colors.accent }]}
          >
            {"★"}
          </Text>
        ) : null}
        {categoryLabel !== null ? (
          // OD-4 token-clean category chip.
          <View
            testID={`dashboard-card-category-${contactId}`}
            style={[
              styles.categoryChip,
              { backgroundColor: colors.surfaceElevated },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.categoryText, { color: colors.textSecondary }]}
            >
              {categoryLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  avatarWrap: {
    position: "relative",
  },
  statusRing: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
  },
  middle: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: "400",
  },
  snippet: {
    fontSize: 13,
    fontWeight: "600",
  },
  trailing: {
    alignItems: "flex-end",
    gap: 4,
  },
  favourite: {
    fontSize: 15,
  },
  categoryChip: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: 120,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
