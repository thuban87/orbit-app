/**
 * InteractionDetail (HIST-11, D-04, D-12) — the canonical single-interaction
 * inspection surface, shown in a `Sheet` (`detail` height).
 *
 * Complete, blank-field-free inspection: it renders ONLY the present fields
 * (channel / when / direction / connected / Tone / duration / note) via the pure
 * `interaction-detail-logic` projection — an absent field produces no row. The
 * long note reflows (never truncated). A restrained Allow-AI `sparkle`
 * (`accentText`, `icon-size sm`) appears ONLY when `allow_ai === 1`; nothing is
 * rendered when OFF (D-04). Edit and Delete are exposed; the delete confirmation
 * + recency-spine wiring lands in Plan-07 Task 3.
 *
 * A dormant group-context block (badge / group title / distinct group note /
 * participant note / View Group Event) is gated on the group-context shaper,
 * which is null for every Phase-32 interaction (no group-event id — D-12), so the
 * block never renders this phase. It references no group-event column.
 *
 * All colours resolve through theme tokens (check:colors); record families and
 * the sparkle read by icon + label, never colour alone.
 */
import { StyleSheet, View } from "react-native";
import { Icon } from "@/components/icons/Icon";
import {
  buildDetailRows,
  buildGroupContext,
  showSparkle,
} from "@/components/history/interaction-detail-logic";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { HistoryInteractionRecord } from "@/db/history-read";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

export interface InteractionDetailProps {
  visible: boolean;
  onRequestClose: () => void;
  interaction: HistoryInteractionRecord;
  /** Open the canonical Edit Interaction route for this interaction. */
  onEdit: () => void;
  /** Begin the hard-delete flow for this interaction (confirm wired in Task 3). */
  onDelete: () => void;
}

export function InteractionDetail({
  visible,
  onRequestClose,
  interaction,
  onEdit,
  onDelete,
}: InteractionDetailProps) {
  const { colors } = useTheme();
  const rows = buildDetailRows(interaction);
  // Dormant seam (D-12): null for every Phase-32 record (no group-event id).
  const group = buildGroupContext(interaction);

  return (
    <Sheet visible={visible} onRequestClose={onRequestClose} variant="detail">
      <View style={styles.header}>
        <AppText role="heading">Interaction</AppText>
        {showSparkle(interaction) ? (
          <View accessibilityLabel="Shared with AI" accessible>
            <Icon name="sparkle" tone="accentText" size="sm" />
          </View>
        ) : null}
      </View>

      <View style={styles.rows}>
        {rows.map((row) => (
          <View key={row.key} style={styles.row}>
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              {row.label}
            </AppText>
            <AppText role="body">{row.value}</AppText>
          </View>
        ))}
      </View>

      {group ? (
        <View
          style={[styles.groupCard, { borderColor: colors.border }]}
          accessibilityLabel={`${group.badge}: ${group.groupTitle}`}
        >
          <View style={styles.groupBadge}>
            <Icon name="group-events" tone="textSecondary" size="sm" />
            <AppText role="label" style={{ color: colors.textSecondary }}>
              {group.badge}
            </AppText>
          </View>
          <AppText role="label">{group.groupTitle}</AppText>
          {group.groupNote ? (
            <View style={styles.row}>
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                Group note
              </AppText>
              <AppText role="body">{group.groupNote}</AppText>
            </View>
          ) : null}
          {group.participantNote ? (
            <View style={styles.row}>
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                Your note
              </AppText>
              <AppText role="body">{group.participantNote}</AppText>
            </View>
          ) : null}
          <Button role="tertiary" label="View Group Event" onPress={onEdit} />
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button role="secondary" label="Edit" onPress={onEdit} />
        <Button role="destructive" label="Delete" onPress={onDelete} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginBottom: SPACING.base,
  },
  rows: {
    gap: SPACING.md,
  },
  row: {
    gap: SPACING.xs,
  },
  groupCard: {
    marginTop: SPACING.base,
    padding: SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: SPACING.sm,
    gap: SPACING.sm,
  },
  groupBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
});
