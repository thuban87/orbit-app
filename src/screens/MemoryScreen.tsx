/**
 * MemoryScreen — the full Memory creation/editing experience owned by Update
 * Contact (CAPT-06, dossier §K). It composes the shipped `MemoryEditor`
 * (Memory Type selected INSIDE the editor; less-common metadata below the
 * primary value) rather than cloning Memory-edit controls; §K's canonical full
 * editor lives here, not in Quick Log.
 *
 * Route contract: `{ contactId? }` only — selection is in-screen, so no
 * `memoryId` param is needed. The screen lists the contact's existing Memories
 * (via `listMemoriesForContact`) plus an Add affordance. Selecting an existing
 * Memory edits it IN PLACE through `editMemory` (no duplicate); Add creates one
 * through `addMemory`. Either inner Save RETURNS to the Update Contact chooser
 * with the same contact targeted (dossier §AA) — a failed save preserves the
 * editor's state and never shows completion (CAPT-14).
 *
 * AI permission is EDIT-only (Review cycle-2 MEDIUM 34-07): on CREATE, a new
 * Memory's `allow_ai` comes from the registry default (`aiDefault`, OFF for
 * general/custom/imported) via `addMemoryCore` — this screen adds NO create-time
 * AI control and does not extend the draft. The "Allow AI to use this" control
 * MemoryEditor renders only when editing an existing Memory; its `globalAiEnabled`
 * is derived from the real AI-provider setting (Review cycle-4 LOW #4), never a
 * stub, so it reflects the actual global AI posture (D-04, ADR-078).
 *
 * Read tri-state (38.3 RG-035, D-24): the memories read drives a `ReadPhase` —
 * loading, then either the editor over SUCCESSFULLY read rows or a read-error
 * state with Retry. The editor never opens over a failed read (a failed read is
 * not an empty list). A failed re-read after a committed restore / delete /
 * AI-permission write shows the read error; the write is neither undone nor
 * retried (D-04).
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import {
  type MemoryDraft,
  MemoryEditor,
  type MemoryEditPatch,
} from "@/components/MemoryEditor";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText, Button } from "@/components/ui";
import { getAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import {
  addMemory,
  deleteMemory,
  editMemory,
  restoreMemory,
  setMemoryAllowAi,
} from "@/db/memories-dao";
import { listMemoriesForContact, type MemoryRow } from "@/db/memories-read";
import { type ReadPhase, readLoading, runGatedRead } from "@/logic/read-phase";
import type { DashboardScreenProps } from "@/navigation/types";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { createLatestRequestAuthority } from "@/utils/latest-request";
import { Logger } from "@/utils/logger";
import { beginInFlight, endInFlight } from "@/utils/single-flight";

const LOG_SCOPE = "memory-screen";

export function MemoryScreen({
  navigation,
  route,
}: DashboardScreenProps<"Memory">) {
  const { colors } = useTheme();
  const contactId = route.params?.contactId ?? null;
  const [memoriesPhase, setMemoriesPhase] =
    useState<ReadPhase<MemoryRow[]>>(readLoading);
  // Only the latest load may publish; blur invalidates outstanding reads (D-23).
  const readAuthority = useMemo(() => createLatestRequestAuthority(), []);
  // Derived from the real AI-provider setting — the edit-only "Allow AI" control
  // must reflect the actual global posture, never a hardcoded stub (cycle-4 #4).
  const [globalAiEnabled, setGlobalAiEnabled] = useState(false);
  // Single-flight guard: block a second concurrent write while one is in flight
  // so a double-tap cannot create a duplicate Memory (CAPT-06 idempotency). The
  // React `saving` state is async and cannot close the double-tap window on its
  // own (review WR-03); `savingRef` flips synchronously and is the real guard.
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  // A successful inner Save returns to the Update Contact chooser (dossier §AA).
  // Navigating is deferred to an effect (not fired inside the async save
  // handler) so MemoryEditor finishes its own close() before this screen
  // unmounts — avoiding a setState-on-unmounted warning mid-commit.
  const [savedTick, setSavedTick] = useState(0);

  /**
   * Load AI availability, then the memories. NEVER rejects. The AI-availability
   * read keeps its fallback-to-false behaviour (not the audited branch); the
   * memories read lands in `loaded` or `error` and never publishes `[]` for a
   * failure. Only the current load may publish — a load superseded while its
   * AI read was in flight stops before starting its own memories read.
   */
  const load = useCallback(async (): Promise<void> => {
    if (contactId === null) return;
    const token = readAuthority.begin();
    let aiEnabled = false;
    try {
      aiEnabled = (await getAppSettings(getExecutor())).aiProvider !== "none";
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to load AI availability", error);
    }
    if (!readAuthority.isCurrent(token)) return;
    setGlobalAiEnabled(aiEnabled);
    await runGatedRead({
      gate: readAuthority,
      read: () => listMemoriesForContact(getExecutor(), contactId),
      publish: setMemoriesPhase,
      onError: (error) =>
        Logger.error(LOG_SCOPE, "failed to load memories", error),
    });
  }, [contactId, readAuthority]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => readAuthority.invalidate();
    }, [load, readAuthority]),
  );

  // Return to the Update Contact chooser after a committed save (deferred).
  useEffect(() => {
    if (savedTick > 0) navigation.goBack();
  }, [savedTick, navigation]);

  const returnToChooser = () => setSavedTick((tick) => tick + 1);
  const failureNotice = () =>
    showSnackbar({
      kind: "error",
      label: "Couldn't save. Please try again.",
      action: {
        label: "Dismiss",
        accessibilityLabel: "Dismiss error",
        onPress: () => {},
      },
    });

  const add = async (draft: MemoryDraft): Promise<boolean> => {
    if (contactId === null) return false;
    // Claim the slot synchronously — a double-tap must not INSERT twice (WR-03).
    if (!beginInFlight(savingRef)) return false;
    setSaving(true);
    try {
      const now = localDateTime();
      await addMemory(getExecutor(), {
        contactId,
        ...draft,
        createdAt: now,
        now,
      });
      returnToChooser();
      return true;
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to add memory", error);
      failureNotice();
      return false;
    } finally {
      setSaving(false);
      endInFlight(savingRef);
    }
  };

  const edit = async (id: number, patch: MemoryEditPatch): Promise<boolean> => {
    if (contactId === null) return false;
    if (!beginInFlight(savingRef)) return false;
    setSaving(true);
    try {
      await editMemory(getExecutor(), {
        id,
        contactId,
        ...patch,
        now: localDateTime(),
      });
      returnToChooser();
      return true;
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to edit memory", error);
      failureNotice();
      return false;
    } finally {
      setSaving(false);
      endInFlight(savingRef);
    }
  };

  // Post-write re-reads sit OUTSIDE the write's catch: `load` never rejects, so
  // a failed re-read after a committed write shows the read error and is never
  // logged or treated as a failed write, and the write is never retried (D-04).
  const restore = (id: number) => {
    if (contactId === null) return;
    void (async () => {
      try {
        await restoreMemory(getExecutor(), {
          id,
          contactId,
          now: localDateTime(),
        });
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to restore memory", error);
        return;
      }
      await load();
    })();
  };

  const remove = (id: number) => {
    if (contactId === null) return;
    void (async () => {
      try {
        await deleteMemory(getExecutor(), {
          id,
          contactId,
          now: localDateTime(),
        });
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to delete memory", error);
        return;
      }
      void load();
      showSnackbar({
        kind: "success",
        label: "Moved to Recently Deleted",
        action: {
          label: "Undo",
          accessibilityLabel: "Undo moving memory to Recently Deleted",
          onPress: () => restore(id),
        },
      });
    })();
  };

  const setAllowAi = (id: number, allow: boolean) => {
    if (contactId === null) return;
    void (async () => {
      try {
        await setMemoryAllowAi(getExecutor(), {
          id,
          contactId,
          allow,
          now: localDateTime(),
        });
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to set memory AI permission", error);
        return;
      }
      await load();
    })();
  };

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Memory" />
      <ScrollView contentContainerStyle={styles.content}>
        {contactId === null ? (
          <AppText role="body" style={{ color: colors.textSecondary }}>
            Open a contact to add or edit a Memory.
          </AppText>
        ) : memoriesPhase.phase === "loading" ? (
          <View
            testID="memory-screen-loading"
            accessibilityLabel="Loading memories"
            style={styles.readState}
          >
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : memoriesPhase.phase === "error" ? (
          <View testID="memory-screen-read-error" style={styles.readError}>
            <AppText role="body" style={{ color: colors.textPrimary }}>
              {"Couldn't load memories"}
            </AppText>
            <Button
              role="tertiary"
              label="Retry"
              accessibilityLabel="Retry loading memories"
              onPress={() => void load()}
            />
          </View>
        ) : (
          <MemoryEditor
            testID="memory-screen-editor"
            items={memoriesPhase.data}
            onAdd={add}
            onEdit={edit}
            onDelete={remove}
            onRestore={restore}
            onSetAllowAi={setAllowAi}
            globalAiEnabled={globalAiEnabled}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: SPACING.md, padding: SPACING.base },
  readState: { minHeight: 88, alignItems: "center", justifyContent: "center" },
  readError: { gap: SPACING.sm, alignItems: "flex-start" },
});
