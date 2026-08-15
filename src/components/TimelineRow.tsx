/**
 * TimelineRow (LOG-02, read half) — one profile-timeline row: an editable
 * touchpoint or a read-only lifecycle event, visually distinct.
 *
 * PURELY PRESENTATIONAL: takes a `TimelineItem` and renders it. NO data loading,
 * NO DAO import — so Plan 03 can hang edit/delete affordances off the touchpoint
 * branch without touching the read layer. Every colour resolves through
 * `useTheme().colors.*` (CLAUDE.md / check:colors) — no hardcoded literal.
 *
 * Touchpoints render in `textPrimary` with their present metadata; events render
 * muted (`textSecondary`) with a leading state label ('Archived' / 'Restored' /
 * 'Snoozed' / 'Unsnoozed') so they never look editable. "Didn't connect" uses
 * non-judgemental copy ("No reply", not "failed" — dossier deferred note).
 *
 * IDENTITY: the row testID root is `timeline-row-${kind}-${id}`, NEVER the bare
 * id — interactions.id and events.id are independent sequences and a touchpoint
 * and an event can share a numeric id, which would collide on both React key and
 * testID (timeline-read.ts cross-table note).
 */
import { StyleSheet, Text, View } from "react-native";
import type { TimelineItem } from "@/db/timeline-read";
import { useTheme } from "@/theme";

/** Human-readable label for each event type. */
const EVENT_LABELS: Record<string, string> = {
  archive: "Archived",
  restore: "Restored",
  snooze: "Snoozed",
  unsnooze: "Unsnoozed",
};

interface TimelineRowProps {
  item: TimelineItem;
}

export function TimelineRow({ item }: TimelineRowProps) {
  const { colors } = useTheme();
  const testID = `timeline-row-${item.kind}-${item.id}`;

  if (item.kind === "event") {
    const label = EVENT_LABELS[item.type] ?? item.type;
    return (
      <View
        testID={testID}
        style={[styles.row, { borderColor: colors.border }]}
      >
        <Text style={[styles.eventLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {item.occurred_at}
          {item.detail ? ` · ${item.detail}` : ""}
        </Text>
      </View>
    );
  }

  // Touchpoint — editable row (affordances land in Plan 03).
  const parts: string[] = [];
  if (item.channel && item.channel !== "unspecified") {
    parts.push(item.channel);
  }
  if (item.direction) {
    parts.push(item.direction);
  }
  if (item.connected === 0) {
    // Non-judgemental "didn't connect" copy — never "failed" (dossier).
    parts.push("no reply");
  }
  if (item.quality) {
    parts.push(item.quality);
  }
  const metaLine = parts.join(" · ");

  return (
    <View testID={testID} style={[styles.row, { borderColor: colors.border }]}>
      <Text style={[styles.occurred, { color: colors.textPrimary }]}>
        {item.occurred_at}
      </Text>
      {metaLine ? (
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {metaLine}
        </Text>
      ) : null}
      {item.note ? (
        <Text style={[styles.note, { color: colors.textPrimary }]}>
          {item.note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    gap: 4,
  },
  occurred: {
    fontSize: 15,
    fontWeight: "600",
  },
  eventLabel: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  meta: {
    fontSize: 13,
  },
  note: {
    fontSize: 15,
  },
});
