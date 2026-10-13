// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button/AppText `role` is a domain prop, not ARIA.
/**
 * HistoryRecordRow (38.8 D-16, D-22, D-40..D-46) — one record row in the
 * Profile History stream, relocated from the row presentation of the History
 * date-detail sheet (retired in 38.8 D-19/D-22).
 *
 * Three record families (D-08, ADR-122), told apart by semantic icon + label,
 * never colour alone (D-07):
 *   • Interaction — channel icon and label, the local minute time, the
 *     direction / No reply / quality meta and up to two lines of note (D-41).
 *     A group-linked child (Phase 33, ADR-124/127; the read joins the Group
 *     Event title) also shows a restrained group-event label (D-16). The whole
 *     row, label included, is ONE press target opening this person's canonical
 *     InteractionDetail (D-42). No long-press, no AI sparkle, no duration
 *     (D-44..D-46). A note also saved to a section shows once, here, with a
 *     tag per section (38.10 D-37); the tags are plain text inside the row and
 *     their names join the row's spoken label.
 *   • Lifecycle event — muted and read-only (D-40): a grey icon, the shared
 *     `EVENT_LABELS` label, the minute time and the detail line when present.
 *   • Knowledge change — pencil icon, field name, minute time and a one-line
 *     value; a tap opens that field's MemoryHistory through the Profile's
 *     existing knowledge navigation (D-43).
 *
 * Each row's accessibility label carries what the row shows — the interaction
 * meta, group label and whole note, the lifecycle detail, the knowledge value —
 * so a screen reader hears the record, not just its family and time (review
 * WR-01).
 *
 * Row times (visible caption AND accessibility label) render through the shared
 * minute-precision `formatTimeMinuteOrFallback` (12-hour AM/PM, no seconds,
 * neutral fallback) — never a slice of the stored string (ADR-152; covered by
 * `timestamp-consumer-contract.test.ts`). Each row calls `useTheme()` itself so
 * reads resolve inside the Profile section's glass scope.
 */
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icon-registry";
import { AppText } from "@/components/ui/AppText";
import {
  CURRENT_STATE_FIELD_REGISTRY,
  type CurrentStateFieldKey,
} from "@/db/memory-registry";
import { alsoSaveToLabel } from "@/logic/also-save-to-logic";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { formatTimeMinuteOrFallback } from "@/utils/dates";
import { EVENT_LABELS, type StreamRecord } from "./history-stream-logic";

/** Channel/type → semantic icon (families read by silhouette, never colour). */
const CHANNEL_ICON: Record<string, IconName> = {
  Message: "message",
  Call: "call",
  "In Person": "group-events",
};

/** Lifecycle event type → semantic icon. Distinct silhouette from interactions. */
const EVENT_ICON: Record<string, IconName> = {
  archive: "archive",
  restore: "archive",
  snooze: "snooze",
  unsnooze: "snooze",
  bind: "group-events",
  unbind: "group-events",
};

/**
 * Display-only title case for the stored direction value ("Outbound · Great",
 * per the accepted mockup). The stored value is untouched; an unknown stored
 * value falls back to itself.
 */
const DIRECTION_LABEL: Record<string, string> = {
  outbound: "Outbound",
  inbound: "Inbound",
  mutual: "Mutual",
};

export interface HistoryRecordRowProps {
  item: StreamRecord;
  /**
   * Open the canonical InteractionDetail for this interaction. `date` is the
   * row's local day, which the section keeps as its place (38.8 D-31).
   */
  onOpenInteraction: (interactionId: number, date: string) => void;
  /** Open this knowledge field's history (MemoryHistory), with the row's day. */
  onOpenKnowledgeChange: (fieldKey: CurrentStateFieldKey, date: string) => void;
}

export function HistoryRecordRow({
  item,
  onOpenInteraction,
  onOpenKnowledgeChange,
}: HistoryRecordRowProps) {
  const { colors } = useTheme();

  if (item.family === "interaction") {
    const r = item.record;
    const icon = CHANNEL_ICON[r.channel] ?? "message";
    const direction = r.direction
      ? (DIRECTION_LABEL[r.direction] ?? r.direction)
      : null;
    const metaParts = [
      direction,
      r.connected === 0 ? "No reply" : null,
      r.quality,
    ].filter((part): part is string => !!part);
    const meta = metaParts.join(" · ");
    const groupTitle = r.groupLinked && r.groupTitle ? r.groupTitle : null;
    // The spoken label carries what the row shows (review WR-01): the meta,
    // the group label and the whole note (the visible note is cut at two lines).
    const metaSuffix = metaParts.length > 0 ? `, ${metaParts.join(", ")}` : "";
    const groupSuffix = groupTitle ? `, event ${groupTitle}` : "";
    const noteSuffix = r.note ? `. ${r.note}` : "";
    // 38.10 D-37: the section names join the row's label; the tags themselves
    // are not separately accessible (checker cycle 5 W-6).
    // A participant's own note and a Group Note copy can share a section;
    // each section is named once.
    const linkedLabels = [
      ...new Set(r.linkedSections.map((s) => alsoSaveToLabel(s.section))),
    ];
    const linkedSuffix =
      linkedLabels.length > 0
        ? `, also saved to ${linkedLabels.join(", ")}`
        : "";
    return (
      <Pressable
        testID={`history-row-${item.key}`}
        accessibilityRole="button"
        accessibilityLabel={`Interaction, ${r.channel}, ${formatTimeMinuteOrFallback(r.occurredAt)}${metaSuffix}${groupSuffix}${linkedSuffix}${noteSuffix}`}
        style={styles.row}
        onPress={() => onOpenInteraction(r.id, item.date)}
      >
        <Icon name={icon} tone="textPrimary" size="sm" />
        <View style={styles.rowBody}>
          <View style={styles.rowHead}>
            <AppText role="label">{r.channel}</AppText>
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              {formatTimeMinuteOrFallback(r.occurredAt)}
            </AppText>
            {groupTitle ? (
              <View
                testID={`history-row-${item.key}-group`}
                style={[styles.groupLabel, { borderColor: colors.border }]}
              >
                <AppText
                  role="caption"
                  numberOfLines={1}
                  style={{ color: colors.textSecondary }}
                >
                  {groupTitle}
                </AppText>
              </View>
            ) : null}
            {linkedLabels.map((label) => (
              <View
                key={label}
                testID={`history-row-${item.key}-linked`}
                accessible={false}
                style={[styles.groupLabel, { borderColor: colors.border }]}
              >
                <AppText
                  role="caption"
                  numberOfLines={1}
                  style={{ color: colors.textSecondary }}
                >
                  {label}
                </AppText>
              </View>
            ))}
          </View>
          {meta ? (
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              {meta}
            </AppText>
          ) : null}
          {r.note ? (
            <AppText role="body" numberOfLines={2}>
              {r.note}
            </AppText>
          ) : null}
        </View>
      </Pressable>
    );
  }

  if (item.family === "lifecycle") {
    const r = item.record;
    const label = EVENT_LABELS[r.type] ?? r.type;
    const icon = EVENT_ICON[r.type] ?? "list";
    const detailSuffix = r.detail ? `, ${r.detail}` : "";
    return (
      <View
        testID={`history-row-${item.key}`}
        accessibilityLabel={`${label}, ${formatTimeMinuteOrFallback(r.occurredAt)}${detailSuffix}`}
        style={styles.row}
      >
        <Icon name={icon} tone="textSecondary" size="sm" />
        <View style={styles.rowBody}>
          <View style={styles.rowHead}>
            <AppText role="label" style={{ color: colors.textSecondary }}>
              {label}
            </AppText>
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              {formatTimeMinuteOrFallback(r.occurredAt)}
            </AppText>
          </View>
          {r.detail ? (
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              {r.detail}
            </AppText>
          ) : null}
        </View>
      </View>
    );
  }

  // Knowledge change — opens the field's history through the parent's
  // existing knowledge navigation.
  const r = item.record;
  const fieldLabel = CURRENT_STATE_FIELD_REGISTRY[r.fieldKey].displayName;
  const valueSuffix = r.value ? `. ${r.value}` : "";
  return (
    <Pressable
      testID={`history-row-${item.key}`}
      accessibilityRole="button"
      accessibilityLabel={`Knowledge change, ${[fieldLabel, r.timeAt === null ? null : formatTimeMinuteOrFallback(r.timeAt)].filter(Boolean).join(", ")}${valueSuffix}`}
      style={styles.row}
      onPress={() => onOpenKnowledgeChange(r.fieldKey, item.date)}
    >
      <Icon name="edit" tone="textPrimary" size="sm" />
      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <AppText role="label">{fieldLabel}</AppText>
          {r.timeAt === null ? null : (
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              {formatTimeMinuteOrFallback(r.timeAt)}
            </AppText>
          )}
        </View>
        {r.value ? (
          <AppText role="body" numberOfLines={1}>
            {r.value}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Indented under the day label; no per-row border (D-38).
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    paddingLeft: SPACING.md,
    paddingVertical: SPACING.xs,
    minHeight: 44,
  },
  rowBody: {
    flex: 1,
    gap: SPACING.xs,
  },
  rowHead: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: SPACING.sm,
    rowGap: SPACING.xs,
  },
  groupLabel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.sm,
    paddingHorizontal: SPACING.xs,
    maxWidth: "100%",
  },
});
