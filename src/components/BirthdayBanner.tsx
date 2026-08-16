/**
 * BirthdayBanner (DASH-05) — the compact top-of-dashboard strip listing every
 * contact whose birthday falls within the next 7 days, soonest first, each row
 * tapping through to that contact's Profile.
 *
 * SCOPED-EXCEPTION PREDICATE (dossier Cluster E / 08-RESEARCH § Pattern 3):
 * the banner reads `listBirthdayCandidates`, which excludes ARCHIVED contacts
 * ONLY. This deliberately OVERRIDES the dashboard's snooze + never-contacted
 * suppression — a snoozed or never-contacted person's imminent birthday still
 * shows here. That is a DECIDED scoped exception, NOT a reversal of the
 * suppression rules the dashboard population enforces: a birthday is a
 * time-boxed, date-driven prompt the user must not miss, so it is intentionally
 * exempt. Do NOT re-filter these candidates down to the dashboard population.
 *
 * The 7-day window + soonest-first ordering are computed in JS off the SINGLE
 * `daysUntilBirthday` parser (birthday-logic.ts — both legacy bugs fixed, so the
 * day-of `0` case is reachable and renders "today"). This component never
 * re-implements the parser or the predicate.
 *
 * Read path: an async, cancelled-flag-guarded `listBirthdayCandidates` read
 * (the FuelSearch idiom) — async only, renders offline, no network. Renders
 * NOTHING (null) when no candidate falls in the window. Presentational-friendly:
 * the caller (the dashboard, Plan 07) supplies `onPressContact(contactId)` to
 * wire navigation, so this component owns no navigation itself.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getExecutor } from "@/db/database";
import { type BirthdayCandidate, listBirthdayCandidates } from "@/db/dashboard-read";
import { daysUntilBirthday } from "@/logic/birthday-logic";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "birthday-banner";

/** The inclusive upper bound of the banner window, in whole days from today. */
const WINDOW_DAYS = 7;

interface BirthdayBannerProps {
  /** Caller wires navigation to the contact's Profile — the banner stays presentational. */
  onPressContact: (contactId: number) => void;
}

/** One in-window banner entry: the candidate plus its computed days-until. */
interface BirthdayEntry {
  id: number;
  name: string;
  daysUntil: number;
}

/** Banner row copy: "today" on the day-of (daysUntil === 0), else "in N days". */
function birthdayCopy(name: string, daysUntil: number): string {
  return daysUntil === 0
    ? `${name}'s birthday today`
    : `${name}'s birthday in ${daysUntil} days`;
}

export function BirthdayBanner({ onPressContact }: BirthdayBannerProps) {
  const { colors } = useTheme();
  const [entries, setEntries] = useState<BirthdayEntry[]>([]);

  // Async cancelled-flag load (the FuelSearch idiom), driven by `useFocusEffect`
  // (mirrors NeverContactedScreen) so the banner RE-QUERIES every time the
  // dashboard regains focus — a same-session birthday add and a midnight `today`
  // rollover are both reflected without a cold restart (DASH-07 freshness). Each
  // run recomputes `today = new Date()` inside the effect. A cancelled flag drops
  // a stale async result.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const candidates = await listBirthdayCandidates(getExecutor());
          if (cancelled) return;
          const today = new Date();
          const inWindow: BirthdayEntry[] = [];
          for (const c of candidates as BirthdayCandidate[]) {
            const daysUntil = daysUntilBirthday(c.birthday, today);
            if (daysUntil !== null && daysUntil <= WINDOW_DAYS) {
              inWindow.push({ id: c.id, name: c.name, daysUntil });
            }
          }
          // Soonest first; a stable name/id tiebreak keeps same-day rows ordered.
          inWindow.sort(
            (a, b) =>
              a.daysUntil - b.daysUntil ||
              a.name.localeCompare(b.name) ||
              a.id - b.id,
          );
          setEntries(inWindow);
        } catch (err) {
          Logger.error(LOG_SCOPE, "failed to load birthdays", err);
          if (!cancelled) setEntries([]);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Renders nothing when no contact has a birthday in the window.
  if (entries.length === 0) {
    return null;
  }

  return (
    <View
      testID="dashboard-birthday-banner"
      style={[
        styles.banner,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {entries.map((entry) => (
        <Pressable
          key={entry.id}
          testID={`dashboard-birthday-item-${entry.id}`}
          accessibilityRole="button"
          accessibilityLabel={birthdayCopy(entry.name, entry.daysUntil)}
          onPress={() => onPressContact(entry.id)}
          style={styles.row}
        >
          <Text
            numberOfLines={1}
            style={[styles.rowText, { color: colors.textPrimary }]}
          >
            {birthdayCopy(entry.name, entry.daysUntil)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 2,
  },
  row: {
    minHeight: 44,
    justifyContent: "center",
  },
  rowText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
