/**
 * ArchivedContactsScreen (CRUD-05) — the Settings → Archived contacts home, the
 * reversible half of the two-stage lifecycle. Lists archived contacts (via
 * `listArchived`, the sole `archived_at IS NOT NULL` inverse read), STATES its
 * count when opened (no badge lives on the Settings row — CONTEXT Area 1), and
 * offers per-row Restore.
 *
 * Restore (`restoreContact`) nulls `archived_at` and reloads — the contact
 * returns to every live surface. Retention is INDEFINITE (UI-SPEC empty-state
 * copy "kept here until you delete them permanently"): there is NO auto-purge
 * sweep this phase. The irreversible purge — "Delete permanently" (danger) — is
 * added per row in Plan 09; its slot is marked below.
 *
 * Mirrors the CustomFieldsScreen chrome (ScrollView root `background`, header
 * with a `goBack` Back control, title 24/700, surface rows). Every colour
 * resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  type ArchivedContactRow,
  listArchived,
  restoreContact,
} from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import {
  computeImpact,
  impactSummaryLines,
  purgeContact,
} from "@/db/purge-dao";
import type { RootStackScreenProps } from "@/navigation/types";
import { buildNotificationPurgeCleanup } from "@/services/notifications/purge-notification-cleanup";
import { buildPhotoPurgeCleanup } from "@/services/photos/purge-photo-cleanup";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "archived-contacts";

/** "1 archived contact" / "N archived contacts". */
function countLabel(n: number): string {
  return `${n} archived contact${n === 1 ? "" : "s"}`;
}

/**
 * Promise wrapper over the native Alert so the impact-summary reads as ONE gate
 * (mirrors CustomFieldsScreen.confirmSummary). The confirm keeps RN's built-in
 * `style: "destructive"` (OS-rendered red — no theme token needed for the native
 * Alert; the in-app trigger button carries the `danger` token instead).
 */
function confirmPurge(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Delete permanently",
      message,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * The locked impact-summary body (UI-SPEC "Destructive confirmation — purge"):
 * "Permanently delete {name} and {parts}? This cannot be undone." The parts are
 * the genuine multi-row children only (interactions / fuel items / links), each
 * omitted when its count is 0 — never a custom-values or events count. When a
 * contact owns no such children, the "and {parts}" clause is dropped so the copy
 * stays grammatical.
 */
function purgeBody(name: string, parts: string[]): string {
  const blast = parts.length > 0 ? ` and ${parts.join(", ")}` : "";
  return `Permanently delete ${name}${blast}? This cannot be undone.`;
}

export function ArchivedContactsScreen({
  navigation,
}: RootStackScreenProps<"Archived">) {
  const { colors } = useTheme();
  const [rows, setRows] = useState<ArchivedContactRow[]>([]);

  const load = useCallback(async () => {
    try {
      setRows(await listArchived(getExecutor()));
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load archived contacts", err);
      Alert.alert(
        "Couldn't load archived contacts",
        "Please go back and retry.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const doRestore = useCallback(
    async (id: number) => {
      try {
        await restoreContact(getExecutor(), id, localDateTime());
        await load();
        // A restored favourite re-enters the widget projection (archived_at IS
        // NULL again). Purge is excluded — an already-archived contact is already
        // absent from the favourites branch, so purging it changes nothing.
        notifyWidgetDataChanged();
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to restore contact", err);
        Alert.alert("Couldn't restore", "Please try again.");
      }
    },
    [load],
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
          onPurgeExtensions: async (purgedId) => {
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
        Alert.alert("Couldn't delete", "Please try again.");
      }
    },
    [load],
  );

  return (
    <ScrollView
      testID="archived-contacts-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          testID="archived-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          Archived
        </Text>
      </View>

      {rows.length === 0 ? (
        <View testID="archived-empty" style={styles.emptyState}>
          <Text style={[styles.emptyHeading, { color: colors.textPrimary }]}>
            No archived contacts
          </Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            Contacts you archive are kept here until you delete them
            permanently.
          </Text>
        </View>
      ) : (
        <>
          <Text
            testID="archived-count"
            style={[styles.count, { color: colors.textSecondary }]}
          >
            {countLabel(rows.length)}
          </Text>

          {rows.map((contact) => (
            <View
              key={contact.id}
              testID={`archived-row-${contact.id}`}
              style={[
                styles.row,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.rowName, { color: colors.textPrimary }]}
              >
                {contact.name}
              </Text>
              <View style={styles.rowActions}>
                <Pressable
                  testID={`archived-restore-${contact.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Restore ${contact.name}`}
                  onPress={() => void doRestore(contact.id)}
                  style={[styles.actionBtn, { borderColor: colors.accent }]}
                >
                  <Text style={{ color: colors.accent }}>Restore</Text>
                </Pressable>
                <Pressable
                  testID={`archived-delete-${contact.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${contact.name} permanently`}
                  onPress={() => void doPurge(contact.id, contact.name)}
                  style={[styles.actionBtn, { borderColor: colors.danger }]}
                >
                  <Text style={{ color: colors.danger }}>
                    Delete permanently
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  count: {
    fontSize: 13,
    fontWeight: "600",
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
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  rowName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  rowActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
