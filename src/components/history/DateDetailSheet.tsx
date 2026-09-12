/**
 * DateDetailSheet (HIST-10, D-10, D-12) — the ONE shared period/date Detail Sheet
 * (`Sheet` variant `detail`) reused by the Heatmap context card and the Rolodex
 * Browser drawer.
 *
 * It interleaves THREE record families CHRONOLOGICALLY (newest first) by SEMANTIC
 * ICON — not separate sections:
 *   • Interactions — editable/deletable; channel/type icon, time, direction/Tone/
 *     duration where present, a one-line note preview. Tap → InteractionDetail
 *     (via `onOpenInteraction`).
 *   • System lifecycle events — read-only (Archive/Restore/Snooze/Unsnooze +
 *     Bind/Unbind). Their labels come from the SHARED `EVENT_LABELS` map exported
 *     by TimelineRow (extended with bind→'Bound', unbind→'Unbound'). This sheet —
 *     NOT the currently-unmounted TimelineRow component — is the live consumer of
 *     that map, so the bind/unbind label edit is exercised here, not dead code.
 *   • History-aware knowledge changes — sourced from Plan 03's knowledge-change
 *     family (keyed by `fieldKey`). Tap emits `onOpenKnowledgeChange(fieldKey)`, a
 *     callback the parent wires to the contact's EXISTING knowledge navigation —
 *     the sheet hardcodes no nav target.
 *
 * Rows come from history-read's `interactions`-only records, so a group-linked
 * child (once Phase 33 exists) is naturally ONE ordinary interaction row and the
 * parent is never an `interactions` row (no double-count — D-10/D-12). No
 * multi-select / batch edit (Phase 32 boundary). All colours via theme tokens;
 * families read by icon + label, never colour alone. No group-event column.
 */
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icon-registry";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { EVENT_LABELS } from "@/components/TimelineRow";
import type {
  HistoryInteractionRecord,
  HistoryKnowledgeRecord,
  HistoryLifecycleRecord,
} from "@/db/history-read";
import {
  CURRENT_STATE_FIELD_REGISTRY,
  type CurrentStateFieldKey,
} from "@/db/memory-registry";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

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

/** The stored local wall-clock string's `HH:MM` (never routed through UTC ISO). */
function timeOf(stored: string): string {
  return stored.slice(11, 16);
}

interface InteractionItem {
  readonly kind: "interaction";
  readonly at: string;
  readonly record: HistoryInteractionRecord;
}
interface LifecycleItem {
  readonly kind: "lifecycle";
  readonly at: string;
  readonly record: HistoryLifecycleRecord;
}
interface KnowledgeItem {
  readonly kind: "knowledge";
  readonly at: string;
  readonly record: HistoryKnowledgeRecord;
}
type SheetItem = InteractionItem | LifecycleItem | KnowledgeItem;

export interface DateDetailSheetProps {
  visible: boolean;
  onRequestClose: () => void;
  /** Date / range label, already formatted locally by the parent. */
  title: string;
  interactions: readonly HistoryInteractionRecord[];
  lifecycleEvents: readonly HistoryLifecycleRecord[];
  knowledgeChanges: readonly HistoryKnowledgeRecord[];
  /** Open the Interaction Detail for a tapped interaction row. */
  onOpenInteraction: (interactionId: number) => void;
  /** Route a knowledge-change row to its owning model's edit flow. */
  onOpenKnowledgeChange: (fieldKey: CurrentStateFieldKey) => void;
  /** Optional backfill affordance. */
  onLogInteraction?: () => void;
}

/** Merge the three families into one newest-first chronological list. */
function interleave(
  interactions: readonly HistoryInteractionRecord[],
  lifecycleEvents: readonly HistoryLifecycleRecord[],
  knowledgeChanges: readonly HistoryKnowledgeRecord[],
): SheetItem[] {
  const items: SheetItem[] = [
    ...interactions.map(
      (record): InteractionItem => ({
        kind: "interaction",
        at: record.occurredAt,
        record,
      }),
    ),
    ...lifecycleEvents.map(
      (record): LifecycleItem => ({
        kind: "lifecycle",
        at: record.occurredAt,
        record,
      }),
    ),
    ...knowledgeChanges.map(
      (record): KnowledgeItem => ({
        kind: "knowledge",
        at: record.createdAt,
        record,
      }),
    ),
  ];
  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return items;
}

export function DateDetailSheet({
  visible,
  onRequestClose,
  title,
  interactions,
  lifecycleEvents,
  knowledgeChanges,
  onOpenInteraction,
  onOpenKnowledgeChange,
  onLogInteraction,
}: DateDetailSheetProps) {
  const { colors } = useTheme();
  const items = interleave(interactions, lifecycleEvents, knowledgeChanges);

  return (
    <Sheet visible={visible} onRequestClose={onRequestClose} variant="detail">
      <AppText role="heading">{title}</AppText>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {items.length === 0 ? (
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            No activity on this date.
          </AppText>
        ) : (
          items.map((item) => (
            <SheetRow
              key={`${item.kind}-${item.record.id}`}
              item={item}
              borderColor={colors.border}
              onOpenInteraction={onOpenInteraction}
              onOpenKnowledgeChange={onOpenKnowledgeChange}
            />
          ))
        )}
      </ScrollView>

      {onLogInteraction ? (
        <View style={styles.footer}>
          <Button
            role="tertiary"
            label="Log interaction"
            onPress={onLogInteraction}
          />
        </View>
      ) : null}
    </Sheet>
  );
}

interface SheetRowProps {
  item: SheetItem;
  borderColor: string;
  onOpenInteraction: (interactionId: number) => void;
  onOpenKnowledgeChange: (fieldKey: CurrentStateFieldKey) => void;
}

function SheetRow({
  item,
  borderColor,
  onOpenInteraction,
  onOpenKnowledgeChange,
}: SheetRowProps) {
  const { colors } = useTheme();

  if (item.kind === "interaction") {
    const r = item.record;
    const icon = CHANNEL_ICON[r.channel] ?? "message";
    const meta = [
      r.direction,
      r.connected === 0 ? "No reply" : null,
      r.quality,
    ]
      .filter((part): part is string => !!part)
      .join(" · ");
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Interaction, ${r.channel}, ${timeOf(r.occurredAt)}`}
        style={[styles.row, { borderColor }]}
        onPress={() => onOpenInteraction(r.id)}
      >
        <Icon name={icon} tone="textPrimary" size="sm" />
        <View style={styles.rowBody}>
          <View style={styles.rowHead}>
            <AppText role="label">{r.channel}</AppText>
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              {timeOf(r.occurredAt)}
            </AppText>
          </View>
          {meta ? (
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              {meta}
            </AppText>
          ) : null}
          {r.note ? (
            <AppText role="body" numberOfLines={1}>
              {r.note}
            </AppText>
          ) : null}
        </View>
      </Pressable>
    );
  }

  if (item.kind === "lifecycle") {
    const r = item.record;
    const label = EVENT_LABELS[r.type] ?? r.type;
    const icon = EVENT_ICON[r.type] ?? "list";
    return (
      <View
        accessibilityLabel={`${label}, ${timeOf(r.occurredAt)}`}
        style={[styles.row, { borderColor }]}
      >
        <Icon name={icon} tone="textSecondary" size="sm" />
        <View style={styles.rowBody}>
          <View style={styles.rowHead}>
            <AppText role="label" style={{ color: colors.textSecondary }}>
              {label}
            </AppText>
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              {timeOf(r.occurredAt)}
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

  // knowledge change — editable per its owning model via the routing callback.
  const r = item.record;
  const fieldLabel = CURRENT_STATE_FIELD_REGISTRY[r.fieldKey].displayName;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Knowledge change, ${fieldLabel}, ${timeOf(r.createdAt)}`}
      style={[styles.row, { borderColor }]}
      onPress={() => onOpenKnowledgeChange(r.fieldKey)}
    >
      <Icon name="edit" tone="textPrimary" size="sm" />
      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <AppText role="label">{fieldLabel}</AppText>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            {timeOf(r.createdAt)}
          </AppText>
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
  list: {
    marginTop: SPACING.base,
  },
  listContent: {
    gap: SPACING.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  rowBody: {
    flex: 1,
    gap: SPACING.xs,
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  footer: {
    marginTop: SPACING.base,
    alignItems: "flex-start",
  },
});
