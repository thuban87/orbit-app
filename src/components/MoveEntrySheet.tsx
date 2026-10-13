/**
 * MoveEntrySheet — move one Things to Remember entry to another section
 * (Phase 38.10 D-84, D-85, D-118). Shared by the section editors (plan 13),
 * the Off Limits editor (plan 15) and the history page (plan 17).
 *
 * - Lists the other D-84 sections as plain rows (a compact sheet; no scroll
 *   container of its own, sheet-consumers-contract).
 * - On a pick it asks `fieldsDroppedByMove(entry, target, today)` (plan 03;
 *   `today` from `formatLocalDate`, CLAUDE.md). When fields would be dropped
 *   it first shows a themed confirm listing them, with Cancel and Move
 *   (D-85; the 38.9 destructive rule). Nothing is lost silently.
 * - It then calls `moveKnowledgeEntry`. Success shows "Moved to <section> for
 *   <name>" with an Undo that calls `undoKnowledgeMove` with the move's own
 *   undo value, which puts the entry back with the fields it had and keeps a
 *   move into Off Limits AI-off (D-118). Undo is never a second move back
 *   (that would mint a new uid and lose the dropped fields). After Undo a
 *   confirming snackbar names what was undone and the person; a failed Undo
 *   says so.
 * - `onMoved` / `onMoveUndone` let the host re-read its list.
 *
 * Props (plans 15 and 17 read them here): `entryRef` is the entry's table,
 * id and contact; `row` is its full source row (the fields
 * `fieldsDroppedByMove` reads); `section` is where it is now.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md).
 */
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, Sheet } from "@/components/ui";
import { getExecutor, localDateTime } from "@/db/database";
import {
  fieldsDroppedByMove,
  type KnowledgeEntryRef,
  type KnowledgeMoveEntry,
  type KnowledgeMoveUndo,
  type KnowledgeSection,
  moveKnowledgeEntry,
  undoKnowledgeMove,
} from "@/db/knowledge-move-dao";
import {
  dropConfirmText,
  movedSnackbar,
  moveSectionLabel,
  moveTargetsFor,
  moveUndoneSnackbar,
} from "@/logic/move-entry-logic";
import { confirm } from "@/stores/confirm-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { formatLocalDate } from "@/utils/dates";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "move-entry-sheet";

export interface MoveEntrySheetProps {
  entryRef: KnowledgeEntryRef;
  /** The full source row (`fieldsDroppedByMove` reads its fields). */
  row: KnowledgeMoveEntry["row"];
  /** The section the entry is in now. */
  section: KnowledgeSection;
  /** The person, for the snackbars; null while the header has not loaded. */
  contactName: string | null;
  onMoved?: (ref: KnowledgeEntryRef) => void;
  onMoveUndone?: () => void;
  onClose: () => void;
}

/** The DAO's tagged entry for a ref's table and its row. */
function moveEntryOf(
  table: KnowledgeEntryRef["table"],
  row: KnowledgeMoveEntry["row"],
): KnowledgeMoveEntry {
  // The host passes the row of `entryRef.table`; the pairing is its contract.
  return { table, row } as KnowledgeMoveEntry;
}

function errorNotice(label: string): void {
  showSnackbar({
    kind: "error",
    label,
    action: {
      label: "Dismiss",
      accessibilityLabel: "Dismiss error",
      onPress: () => {},
    },
  });
}

/**
 * Undo one move (D-118). Lives outside the component: the snackbar outlives
 * the sheet.
 */
function undoMove(input: {
  undo: KnowledgeMoveUndo;
  section: KnowledgeSection;
  contactName: string | null;
  onMoveUndone?: () => void;
}): void {
  void (async () => {
    try {
      await undoKnowledgeMove(getExecutor(), input.undo, localDateTime());
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to undo a move", error);
      errorNotice("Couldn't undo the move.");
      return;
    }
    input.onMoveUndone?.();
    showSnackbar({
      kind: "success",
      label: moveUndoneSnackbar(input.section, input.contactName),
    });
  })();
}

export function MoveEntrySheet({
  entryRef,
  row,
  section,
  contactName,
  onMoved,
  onMoveUndone,
  onClose,
}: MoveEntrySheetProps) {
  const { colors } = useTheme();
  // Single-flight: a second pick while one runs is ignored.
  const movingRef = useRef(false);
  const [moving, setMoving] = useState(false);

  const pick = async (target: KnowledgeSection) => {
    if (movingRef.current) return;
    movingRef.current = true;
    setMoving(true);
    try {
      const today = formatLocalDate(new Date());
      const dropped = fieldsDroppedByMove(
        moveEntryOf(entryRef.table, row),
        target,
        today,
      );
      const message = dropConfirmText(dropped, target);
      if (message !== null) {
        const confirmed = await confirm({
          title: `Move to ${moveSectionLabel(target)}?`,
          message,
          confirmLabel: "Move",
          cancelLabel: "Cancel",
          destructive: true,
        });
        if (!confirmed) return;
      }
      let result: Awaited<ReturnType<typeof moveKnowledgeEntry>>;
      try {
        result = await moveKnowledgeEntry(getExecutor(), {
          ref: entryRef,
          target,
          now: localDateTime(),
        });
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to move an entry", error);
        errorNotice("Couldn't move. Please try again.");
        return;
      }
      onClose();
      onMoved?.(result.ref);
      showSnackbar({
        kind: "success",
        label: movedSnackbar(target, contactName),
        action: {
          label: "Undo",
          accessibilityLabel: `Undo moving to ${moveSectionLabel(target)}`,
          onPress: () =>
            undoMove({
              undo: result.undo,
              section,
              contactName,
              onMoveUndone,
            }),
        },
      });
    } finally {
      movingRef.current = false;
      setMoving(false);
    }
  };

  return (
    <Sheet visible variant="compact" onRequestClose={onClose}>
      <View style={styles.body}>
        <AppText role="heading">Move to</AppText>
        {moveTargetsFor(section).map((target) => (
          <Pressable
            key={target}
            accessibilityRole="button"
            accessibilityLabel={`Move to ${moveSectionLabel(target)}`}
            accessibilityState={{ disabled: moving }}
            disabled={moving}
            onPress={() => void pick(target)}
            style={[
              styles.row,
              { borderColor: colors.border },
              moving ? styles.held : null,
            ]}
          >
            {/* biome-ignore lint/a11y/useValidAriaRole: AppText role is a typography role. */}
            <AppText role="body" style={{ color: colors.textPrimary }}>
              {moveSectionLabel(target)}
            </AppText>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACING.xs, padding: SPACING.base },
  held: { opacity: 0.5 },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
  },
});
