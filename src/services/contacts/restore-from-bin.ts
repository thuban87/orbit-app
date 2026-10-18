/**
 * Restore a person from the Bin outside the Bin list (38.12 D-154: the import
 * review's "In the Bin: <name>" Restore), with the Bin list's own effects and
 * feedback (D-32, D-03): the widget and the reminder schedule follow the
 * restore, then "Restored <name>" shows with Undo; Undo moves the person back
 * to the Bin through the same archive writer, with their original Bin date
 * (A-WR-03) and the same effects, and
 * confirms itself ("Moved <name> back to the Bin", 38.9 D-39).
 *
 * The copy matches ArchivedContactsScreen's `restoredSnackbar` and
 * `restoreUndoneSnackbar`. The phone-contact link is never touched: a restore
 * only clears `archived_at`.
 *
 * Dependencies are injectable so the flow is node-testable.
 */
import { archiveContact, restoreContact } from "@/db/contacts-dao";
import { localDateTime } from "@/db/database";
import type { SqlExecutor } from "@/db/types";
import { reconcileSchedule } from "@/services/notifications/notification-schedule";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { type SnackbarMessage, showSnackbar } from "@/stores/snackbar-store";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "restore-from-bin";

export interface RestoreFromBinDeps {
  /** Resolves the `archived_at` it cleared (A-WR-03). */
  restoreContact: (
    exec: SqlExecutor,
    id: number,
    now: string,
  ) => Promise<string>;
  archiveContact: (
    exec: SqlExecutor,
    id: number,
    now: string,
    archivedAt?: string,
  ) => Promise<void>;
  reconcileSchedule: (exec: SqlExecutor) => Promise<void>;
  notifyWidgetDataChanged: () => void;
  showSnackbar: (input: SnackbarMessage) => void;
  now: () => string;
}

const defaultDeps: RestoreFromBinDeps = {
  restoreContact,
  archiveContact,
  reconcileSchedule,
  notifyWidgetDataChanged,
  showSnackbar,
  now: localDateTime,
};

function afterBinWrite(
  exec: SqlExecutor,
  deps: RestoreFromBinDeps,
  what: string,
): void {
  try {
    deps.notifyWidgetDataChanged();
  } catch (error) {
    Logger.error(LOG_SCOPE, `widget refresh failed after ${what}`, error);
  }
  void deps
    .reconcileSchedule(exec)
    .catch((error) =>
      Logger.error(LOG_SCOPE, `failed to reconcile after ${what}`, error),
    );
}

/**
 * Restore `contactId` and show "Restored <name>" with Undo. Resolves true when
 * the restore committed; a failure shows "Couldn't restore. Please try again."
 * and resolves false. `onUndone` runs after a committed Undo.
 */
export async function restoreFromBinWithUndo(
  exec: SqlExecutor,
  input: { contactId: number; name: string; onUndone?: () => void },
  deps: RestoreFromBinDeps = defaultDeps,
): Promise<boolean> {
  let archivedAt: string;
  try {
    archivedAt = await deps.restoreContact(exec, input.contactId, deps.now());
  } catch (error) {
    Logger.error(LOG_SCOPE, "failed to restore contact", error);
    deps.showSnackbar({
      kind: "error",
      label: "Couldn't restore. Please try again.",
    });
    return false;
  }
  afterBinWrite(exec, deps, "restore");
  deps.showSnackbar({
    kind: "success",
    label: `Restored ${input.name}`,
    action: {
      label: "Undo",
      accessibilityLabel: `Undo restoring ${input.name}`,
      onPress: () => {
        void (async () => {
          try {
            // A-WR-03: back to the Bin with the original Bin date.
            const now = deps.now();
            await deps.archiveContact(
              exec,
              input.contactId,
              now,
              archivedAt || now,
            );
          } catch (error) {
            Logger.error(LOG_SCOPE, "failed to undo restore", error);
            deps.showSnackbar({
              kind: "error",
              label: "Couldn't undo the restore.",
            });
            return;
          }
          afterBinWrite(exec, deps, "undoing a restore");
          deps.showSnackbar({
            kind: "success",
            label: `Moved ${input.name} back to the Bin`,
          });
          input.onUndone?.();
        })();
      },
    },
  });
  return true;
}
