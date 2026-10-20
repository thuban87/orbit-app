// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button/AppText `role` is a domain prop, not ARIA.
/**
 * InteractionDetail (HIST-11, HIST-13, HIST-17, D-04, D-11, D-12) — the canonical
 * single-interaction inspection surface, shown in a `Sheet` (`detail` height).
 *
 * Complete, blank-field-free inspection: it renders ONLY the present fields
 * (channel / when / direction / connected / Tone / duration / note) via the pure
 * `interaction-detail-logic` projection — an absent field produces no row. The
 * long note reflows (never truncated). A restrained Allow-AI `sparkle`
 * (`accentText`, `icon-size sm`) appears ONLY when `allow_ai === 1`; nothing is
 * rendered when OFF (D-04).
 *
 * DELETE is a true HARD delete (D-11) — no trash/quarantine. It runs behind the
 * `ConfirmDialog` destructive variant (danger fill + `warning` glyph + `onDanger`,
 * no scrim-dismiss) whose body names the Status/Gravity/Intensity consequences,
 * and routes ONLY through `deleteTouchpoint` — the single recency writer that
 * tombstones in-txn and recomputes (never a bespoke DELETE). A FAILED delete
 * leaves the interaction and its derived metrics intact, re-enables the control,
 * and surfaces an inline error — there is NO optimistic vanish before commit.
 *
 * EDIT routing is gated on the group-link predicate (HIST-17): a standalone
 * interaction goes straight to the Edit Interaction route via `onEdit`; a
 * group-linked child first opens the explicit scope prompt.
 *
 * The group-context block (badge / group title / distinct Group Note /
 * participant note / View Group Event) is gated on the child context shaper.
 *
 * 38.14 (D-66, D-26, D-58): the header and rows scroll in their own ScrollView
 * (the Sheet's body scroll is opted out) above a pinned action block, so Edit
 * and Delete are always visible. "Make this an event" (ADR-206) is a visible
 * text button there; the single-item overflow menu is gone. The action row is
 * `ConfirmActions` measure-and-stack (D-11 / ADR-174) — never plain flexWrap.
 * A confirmed delete then shows an "Interaction deleted" snackbar (no Undo).
 *
 * All colours resolve through theme tokens (check:colors); record families and
 * the sparkle read by icon + label, never colour alone.
 */
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { GroupScopePrompt } from "@/components/history/GroupScopePrompt";
import {
  buildDetailRows,
  buildGroupContext,
  showSparkle,
} from "@/components/history/interaction-detail-logic";
import { Icon } from "@/components/icons/Icon";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { ConfirmActions, ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Sheet } from "@/components/ui/Sheet";
import { getExecutor, localDateTime } from "@/db/database";
import type { HistoryInteractionRecord } from "@/db/history-read";
import { deleteTouchpoint } from "@/db/recency-dao";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { bumpShellRefresh } from "@/stores/shell-refresh-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import {
  beginInFlight,
  endInFlight,
  type InFlightRef,
} from "@/utils/single-flight";

/** Destructive confirmation copy (UI-SPEC Copywriting Contract / dossier §X). */
const DELETE_TITLE = "Delete this interaction?";
const DELETE_BODY =
  "This can't be undone and may change this contact's Status, Gravity, and Intensity.";
const DELETE_CONFIRM = "Delete interaction";
/** Inline error when the hard delete fails — the interaction is preserved. */
const DELETE_FAILED_MESSAGE =
  "Couldn't delete this interaction. Please try again.";
/** Snackbar after a confirmed delete (38.14 D-58; no Undo). */
const DELETED_MESSAGE = "Interaction deleted";

export interface InteractionDetailProps {
  visible: boolean;
  onRequestClose: () => void;
  interaction: HistoryInteractionRecord;
  /** The owning contact — scopes the recency-spine delete. */
  contactId: number;
  /** Open the canonical Edit Interaction route (standalone path). */
  onEdit: () => void;
  onViewGroupEvent?: (groupEventId: number) => void;
  onEditGroupEvent?: (groupEventId: number) => void;
  onEditParticipant?: (
    groupEventId: number,
    interactionId: number,
    contactId: number,
  ) => void;
  onConvertToGroup?: () => void;
  /** Optional host-owned route to the interaction owner's Profile. */
  onViewProfile?: () => void;
  /**
   * Called after a confirmed successful delete, AFTER the widget notify and the
   * shell tick have been published (the parent closes; shell subscribers
   * refresh).
   */
  onDeleted: () => void;
}

export function InteractionDetail({
  visible,
  onRequestClose,
  interaction,
  contactId,
  onEdit,
  onViewGroupEvent,
  onEditGroupEvent,
  onEditParticipant,
  onConvertToGroup,
  onViewProfile,
  onDeleted,
}: InteractionDetailProps) {
  const { colors } = useTheme();
  const rows = buildDetailRows(interaction);
  const group = buildGroupContext(interaction);
  const groupEventId = interaction.groupEventId;

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [scopeVisible, setScopeVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Synchronous double-tap latch for the delete (review B-WR-06): `deleting`
  // lags a render, so two taps in one tick would both pass it.
  const deleteLatch = useRef<InFlightRef>({ current: false });
  const [error, setError] = useState<string | null>(null);

  // Standalone -> EditInteraction directly; group-linked -> explicit scope prompt.
  const onEditPress = () => {
    if (interaction.groupLinked) {
      setScopeVisible(true);
    } else {
      onEdit();
    }
  };

  const onConfirmDelete = async () => {
    if (!beginInFlight(deleteLatch.current)) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      // The single recency writer: tombstone in-txn + recompute (D-05/ADR-010).
      await deleteTouchpoint(getExecutor(), {
        contactId,
        interactionId: interaction.id,
        now: localDateTime(),
      });
      // Publish once to every consumer (widget + shell tick): the Profile
      // snapshot, its History revision, Home, Digest and Orrery all converge
      // (38.3 RG-024, architecture/AUD-ARCH-004).
      notifyWidgetDataChanged();
      bumpShellRefresh();
      setConfirmVisible(false);
      setDeleting(false);
      // 38.14 D-58: confirm the result. Warning is the destructive-result look
      // (38.10 D-132 / D-140, carried by D-14); there is no Undo (R4 rejected,
      // D-19 hard delete).
      showSnackbar({ kind: "warning", label: DELETED_MESSAGE });
      onDeleted();
    } catch {
      // No optimistic vanish: the interaction + its derived metrics are intact.
      // Re-enable the control and surface an inline error.
      setDeleting(false);
      setConfirmVisible(false);
      setError(DELETE_FAILED_MESSAGE);
    } finally {
      endInFlight(deleteLatch.current);
    }
  };

  return (
    <Sheet
      visible={visible}
      onRequestClose={onRequestClose}
      variant="detail"
      scrollBody={false}
    >
      {/* 38.14 D-66 / D-26: the header and rows scroll inside the sheet's cap
          while the action block below stays pinned and visible. */}
      <View style={styles.content}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
        >
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
                  <AppText
                    role="caption"
                    style={{ color: colors.textSecondary }}
                  >
                    Group Note
                  </AppText>
                  <AppText role="body">{group.groupNote}</AppText>
                </View>
              ) : null}
              {groupEventId != null && onViewGroupEvent ? (
                <Button
                  role="tertiary"
                  label="View Event"
                  onPress={() => onViewGroupEvent(groupEventId)}
                />
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {/* Pinned actions (D-66). "Make this an event" is a visible text
            button above the row (placement is Claude's Discretion); the
            single-item overflow is gone. Edit / Delete (and View profile)
            measure and stack via ConfirmActions (D-26, D-11, ADR-174), so
            Delete is never cut off. Delete still opens the destructive
            ConfirmDialog first (D-19). */}
        <View style={styles.actions}>
          {/* A failed delete's error sits with the actions, always visible. */}
          {error ? (
            <AppText role="caption" style={{ color: colors.danger }}>
              {error}
            </AppText>
          ) : null}
          {!interaction.groupLinked && onConvertToGroup ? (
            <View style={styles.convert}>
              <Button
                role="tertiary"
                label="Make this an event"
                onPress={onConvertToGroup}
              />
            </View>
          ) : null}
          <ConfirmActions
            cancelLabel="Edit"
            confirmLabel="Delete"
            destructive
            confirmDisabled={deleting}
            secondaryLabel={onViewProfile ? "View profile" : undefined}
            onSecondary={onViewProfile}
            onCancel={onEditPress}
            onConfirm={() => setConfirmVisible(true)}
          />
        </View>
      </View>

      <ConfirmDialog
        visible={confirmVisible}
        destructive
        title={DELETE_TITLE}
        message={DELETE_BODY}
        confirmLabel={DELETE_CONFIRM}
        confirmDisabled={deleting}
        onConfirm={onConfirmDelete}
        onRequestClose={() => setConfirmVisible(false)}
      />

      <GroupScopePrompt
        visible={scopeVisible}
        onRequestClose={() => setScopeVisible(false)}
        onEditIndividual={() => {
          setScopeVisible(false);
          if (interaction.groupEventId != null)
            onEditParticipant?.(
              interaction.groupEventId,
              interaction.id,
              contactId,
            );
        }}
        onEditGroup={() => {
          setScopeVisible(false);
          if (interaction.groupEventId != null)
            onEditGroupEvent?.(interaction.groupEventId);
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // Shrinks inside the detail sheet's cap so the pinned actions stay on
  // screen while the rows scroll (D-66, D-26).
  content: { flexShrink: 1, minHeight: 0 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { paddingBottom: SPACING.sm },
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
    marginTop: SPACING.base,
    gap: SPACING.sm,
  },
  convert: {
    alignSelf: "flex-start",
  },
});
