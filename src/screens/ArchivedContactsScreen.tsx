// biome-ignore-all lint/a11y/useValidAriaRole: Button role is a visual hierarchy variant.
/**
 * ArchivedContactsScreen (CRUD-05) — the Bin list (user-facing "Bin" since
 * 38.11 D-69; the route id `Archived` and the `archived_at` names stay), the
 * reversible half of the two-stage lifecycle. Lists archived contacts (via
 * `listArchived`, the sole `archived_at IS NOT NULL` inverse read) and STATES
 * its count when opened (no badge lives on the Settings row — CONTEXT Area 1).
 * It is mounted in both the Contacts and Settings stacks (ADR-080), so it
 * reads on every focus (38.12 D-31): a person binned or restored elsewhere is
 * current when the list shows again. Until the first read resolves it shows a
 * loading line, never "The Bin is empty".
 *
 * Each row (38.12 D-40) shows the Avatar, the name and the day the person was
 * moved to the Bin; "Restore" is a visible button and "Delete permanently"
 * sits behind the row's ⋯ (38.9 D-30 via 38.12 D-02: destructive actions on
 * list cards live behind ⋯).
 *
 * Restore (`restoreContact`, 38.12 D-32, D-03) acts at once: the widget and
 * the reminder schedule follow it, then "Restored <name>" shows with Undo.
 * Undo moves the person back to the Bin through the same archive writer as
 * Move to Bin, with Move to Bin's after-effects (widget refresh + schedule
 * reconcile; ContactProfileScreen `moveToBin`), and confirms itself (D-04).
 * Retention is INDEFINITE (38.11 D-70: the Bin never empties itself; the
 * empty-state copy says so): there is NO auto-purge sweep. The irreversible
 * purge keeps its impact-summary destructive confirm (D-02, D-10).
 *
 * A failed Restore or Delete re-reads the list, so a stale row (already
 * restored or deleted elsewhere) disappears (D-31). Every colour resolves
 * through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useRef, useState } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/icons/Icon";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  AnchoredMenu,
  type AnchoredMenuItem,
} from "@/components/ui/AnchoredMenu";
import { Button } from "@/components/ui/Button";
import { ChromeScrim } from "@/components/ui/ChromeScrim";
import { ScopedPalette } from "@/components/ui/ScopedPalette";
import {
  type ArchivedContactRow,
  archiveContact,
  listArchived,
  restoreContact,
} from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import {
  computeImpact,
  impactSummaryLines,
  purgeContact,
} from "@/db/purge-dao";
import type { RootStackParamList } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { reconcileSchedule } from "@/services/notifications/notification-schedule";
import { buildNotificationPurgeCleanup } from "@/services/notifications/purge-notification-cleanup";
import { deleteImportStaging } from "@/services/photos/photo-storage";
import { buildPhotoPurgeCleanup } from "@/services/photos/purge-photo-cleanup";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { confirm, notice } from "@/stores/confirm-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { formatDisplayDateOrFallback } from "@/utils/dates";
import { Logger } from "@/utils/logger";
import { plural } from "@/utils/plural";

const LOG_SCOPE = "archived-contacts";

/** "1 contact in the Bin" / "N contacts in the Bin" (the shared helper, D-21; 38.11 D-69). */
function countLabel(n: number): string {
  return `${plural(n, "contact")} in the Bin`;
}

/**
 * The impact-summary purge gate as ONE themed destructive confirm (mirrors
 * CustomFieldsScreen.confirmSummary; 38.9 D-27, D-09). Destructive, so Back and
 * the scrim cannot dismiss it (D-06, ADR-086): only Cancel or "Delete
 * permanently" resolve it. The confirm button reads the theme's destructive
 * token through ConfirmDialog's Button role "destructive".
 */
function confirmPurge(message: string): Promise<boolean> {
  return confirm({
    title: "Delete permanently",
    message,
    confirmLabel: "Delete permanently",
    destructive: true,
  });
}

/**
 * The locked impact-summary body (UI-SPEC "Destructive confirmation — purge"):
 * "Permanently delete {name} and {parts}? This cannot be undone." The parts are
 * the genuine multi-row children only (interactions, events, links, memories,
 * relationships; `impactSummaryLines`), each omitted when its count is 0 —
 * never a custom-values count. When a
 * contact owns no such children, the "and {parts}" clause is dropped so the copy
 * stays grammatical.
 */
function purgeBody(name: string, parts: string[]): string {
  const blast = parts.length > 0 ? ` and ${parts.join(", ")}` : "";
  return `Permanently delete ${name}${blast}? This cannot be undone.`;
}

/**
 * The row's second line (38.12 D-40): "Moved to the Bin Oct 13" through the
 * one date-only display formatter (38.9 D-23, D-48). An unreadable stored
 * value drops the date rather than showing raw storage text.
 */
export function movedToBinLabel(archivedAt: string, now?: Date): string {
  const date = formatDisplayDateOrFallback(archivedAt, "", { now });
  return date === "" ? "Moved to the Bin" : `Moved to the Bin ${date}`;
}

/** The Restore snackbar (38.12 D-32, D-03; verb first, naming the person). */
export function restoredSnackbar(name: string): string {
  return `Restored ${name}`;
}

/**
 * The Undo-of-Restore confirmation (38.9 D-39: Undo confirms itself). Copy is
 * this plan's; the owner sees it at the 38.12 device check.
 */
export function restoreUndoneSnackbar(name: string): string {
  return `Moved ${name} back to the Bin`;
}

/**
 * One Bin row (38.12 D-40): Avatar, name and the day moved to the Bin open the
 * Profile; "Restore" is a visible button; "Delete permanently" is the only
 * item behind the row's ⋯ (D-02). The name wraps, never truncates (38.11-14
 * D7).
 */
export function BinRow({
  contact,
  onOpen,
  onRestore,
  onDelete,
}: {
  contact: ArchivedContactRow;
  onOpen: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const anchorRef = useRef<View>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    requestAnimationFrame(() => {
      const node = findNodeHandle(anchorRef.current);
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
    });
  }, []);
  const items: AnchoredMenuItem[] = [
    {
      id: "delete",
      label: "Delete permanently",
      icon: "warning",
      danger: true,
      onPress: onDelete,
    },
  ];
  const moved = movedToBinLabel(contact.archived_at);
  return (
    <View
      testID={`archived-row-${contact.id}`}
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Pressable
        testID={`archived-open-${contact.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Open ${contact.name}, ${moved}`}
        onPress={onOpen}
        style={styles.rowOpen}
      >
        <Avatar
          photo={contact.photo}
          name={contact.name}
          contactId={contact.id}
          size={40}
        />
        <View style={styles.rowText}>
          <Text style={[styles.rowName, { color: colors.textPrimary }]}>
            {contact.name}
          </Text>
          <Text
            testID={`archived-moved-${contact.id}`}
            style={[styles.rowMoved, { color: colors.textSecondary }]}
          >
            {moved}
          </Text>
        </View>
      </Pressable>
      <Button
        testID={`archived-restore-${contact.id}`}
        role="secondary"
        label="Restore"
        accessibilityLabel={`Restore ${contact.name}`}
        onPress={onRestore}
      />
      <Pressable
        ref={anchorRef}
        testID={`archived-more-${contact.id}`}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`More actions for ${contact.name}`}
        accessibilityState={{ expanded: menuOpen }}
        onPress={() => setMenuOpen(true)}
        style={styles.iconTarget}
      >
        <Icon name="overflow" size="md" tone="textSecondary" />
      </Pressable>
      <AnchoredMenu
        anchorRef={anchorRef}
        visible={menuOpen}
        accessibilityLabel={`More actions for ${contact.name}`}
        items={items}
        onRequestClose={closeMenu}
      />
    </View>
  );
}

export function ArchivedContactsScreen() {
  const { colors } = useTheme();
  // The last item scrolls fully above the shell FAB (38.4 D-52, OA-E3).
  const bottomClearance = useBottomClearance();
  // Archived is hosted in both DashboardStack and SettingsStack; both register
  // "Profile", so tapping a row opens the contact and Back returns here — the
  // locked origin-aware return (Dashboard → Archived → Profile → Back → Archived,
  // UI-SPEC §Origin-aware return / D-05).
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // null until the first read resolves: the loading line, never the empty
  // state (38.12 D-31).
  const [rows, setRows] = useState<ArchivedContactRow[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // Ids with a Restore in flight, so a double tap cannot fire a second write.
  const restoring = useRef(new Set<number>());

  const load = useCallback(async () => {
    try {
      setRows(await listArchived(getExecutor()));
      setLoadFailed(false);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load archived contacts", err);
      setLoadFailed(true);
      void notice({
        title: "Couldn't load the Bin",
        message: "Please go back and retry.",
      });
    }
  }, []);

  // 38.12 D-31: read on every focus (both stacks host this screen, ADR-080).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /**
   * Move to Bin's after-effects (ContactProfileScreen `moveToBin`
   * afterArchive, 38.11 review WR-01): the widget drops the person and the
   * schedule reconciles, so their reminders stop (convergence c1 L-2).
   */
  const afterBinWrite = useCallback((what: string) => {
    notifyWidgetDataChanged();
    void reconcileSchedule(getExecutor()).catch((cause) =>
      Logger.error(LOG_SCOPE, `failed to reconcile after ${what}`, cause),
    );
  }, []);

  const undoRestore = useCallback(
    async (id: number, name: string) => {
      try {
        await archiveContact(getExecutor(), id, localDateTime());
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to undo restore", err);
        showSnackbar({ kind: "error", label: "Couldn't undo the restore." });
        await load();
        return;
      }
      afterBinWrite("undoing a restore");
      await load();
      showSnackbar({ kind: "success", label: restoreUndoneSnackbar(name) });
    },
    [afterBinWrite, load],
  );

  const doRestore = useCallback(
    async (id: number, name: string) => {
      if (restoring.current.has(id)) return;
      restoring.current.add(id);
      try {
        try {
          await restoreContact(getExecutor(), id, localDateTime());
        } catch (err) {
          Logger.error(LOG_SCOPE, "failed to restore contact", err);
          showSnackbar({
            kind: "error",
            label: "Couldn't restore. Please try again.",
          });
          // D-31: a row restored or deleted elsewhere disappears.
          await load();
          return;
        }
        // A restored favourite re-enters the widget projection (archived_at
        // IS NULL again) and a Bound person's reminders re-arm (D-32).
        afterBinWrite("restore");
        await load();
        showSnackbar({
          kind: "success",
          label: restoredSnackbar(name),
          action: {
            label: "Undo",
            accessibilityLabel: `Undo restoring ${name}`,
            onPress: () => void undoRestore(id, name),
          },
        });
      } finally {
        restoring.current.delete(id);
      }
    },
    [afterBinWrite, load, undoRestore],
  );

  const doPurge = useCallback(
    async (id: number, name: string) => {
      try {
        const exec = getExecutor();
        const impact = await computeImpact(exec, id);
        const confirmed = await confirmPurge(
          purgeBody(name, impactSummaryLines(name, impact)),
        );
        if (!confirmed) {
          return;
        }
        // POST-COMMIT best-effort fan-out — the purge has already committed by
        // the time this runs (purge-dao module header). Compose the photo-file
        // cleanup with the notification cancel, each awaited in its own
        // try/catch so one failing cannot skip the other. Neither can undo the
        // committed deletes; a failure is logged, never fatal.
        const photoCleanup = buildPhotoPurgeCleanup(exec);
        const notifCleanup = buildNotificationPurgeCleanup();
        await purgeContact(exec, id, {
          now: localDateTime(),
          onPurgeExtensions: async (purgedId, { importStagingPaths }) => {
            try {
              for (const path of importStagingPaths) deleteImportStaging(path);
            } catch (err) {
              Logger.error(
                LOG_SCOPE,
                "post-commit import staging cleanup failed",
                err,
              );
            }
            try {
              await photoCleanup(purgedId);
            } catch (err) {
              Logger.error(LOG_SCOPE, "post-commit photo cleanup failed", err);
            }
            try {
              await notifCleanup(purgedId);
            } catch (err) {
              Logger.error(
                LOG_SCOPE,
                "post-commit notification cleanup failed",
                err,
              );
            }
          },
        });
        await load();
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to delete contact permanently", err);
        showSnackbar({
          kind: "error",
          label: "Couldn't delete. Please try again.",
        });
        // D-31: a row restored or deleted elsewhere disappears.
        await load();
      }
    },
    [load],
  );

  return (
    <View testID="archived-contacts-screen" style={{ flex: 1 }}>
      <ShellAppBar variant="child" title="Bin" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
      >
        {rows === null ? (
          <ChromeScrim style={styles.emptyScrim} radius={RADII.md}>
            <ScopedPalette>
              {(scoped) => (
                <Text
                  testID={
                    loadFailed ? "archived-load-failed" : "archived-loading"
                  }
                  style={[styles.emptyBody, { color: scoped.textSecondary }]}
                >
                  {loadFailed
                    ? "Couldn't load the Bin. Please go back and retry."
                    : "Loading the Bin…"}
                </Text>
              )}
            </ScopedPalette>
          </ChromeScrim>
        ) : rows.length === 0 ? (
          <ChromeScrim style={styles.emptyScrim} radius={RADII.md}>
            <View testID="archived-empty" style={styles.emptyState}>
              <Text
                style={[styles.emptyHeading, { color: colors.textPrimary }]}
              >
                The Bin is empty
              </Text>
              <ScopedPalette>
                {(scoped) => (
                  <Text
                    style={[styles.emptyBody, { color: scoped.textSecondary }]}
                  >
                    People you move to the Bin stay here until you restore them
                    or delete them permanently.
                  </Text>
                )}
              </ScopedPalette>
            </View>
          </ChromeScrim>
        ) : (
          <>
            <ChromeScrim style={styles.countScrim} radius={RADII.sm}>
              <ScopedPalette>
                {(scoped) => (
                  <Text
                    testID="archived-count"
                    style={[styles.count, { color: scoped.textSecondary }]}
                  >
                    {countLabel(rows.length)}
                  </Text>
                )}
              </ScopedPalette>
            </ChromeScrim>

            {rows.map((contact) => (
              <BinRow
                key={contact.id}
                contact={contact}
                onOpen={() =>
                  navigation.navigate("Profile", { contactId: contact.id })
                }
                onRestore={() => void doRestore(contact.id, contact.name)}
                onDelete={() => void doPurge(contact.id, contact.name)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
  },
  count: {
    fontSize: 13,
    fontWeight: "600",
  },
  countScrim: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  emptyScrim: {
    padding: 16,
    overflow: "hidden",
  },
  emptyState: {
    gap: 8,
    marginTop: 8,
  },
  emptyHeading: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 21,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  rowOpen: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 16,
    fontWeight: "600",
  },
  rowMoved: {
    fontSize: 13,
  },
  iconTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
