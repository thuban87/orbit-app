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
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  type MemoryDraft,
  MemoryEditor,
  type MemoryEditPatch,
} from "@/components/MemoryEditor";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText } from "@/components/ui";
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
import type { DashboardScreenProps } from "@/navigation/types";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "memory-screen";

export function MemoryScreen({
  navigation,
  route,
}: DashboardScreenProps<"Memory">) {
  const { colors } = useTheme();
  const contactId = route.params?.contactId ?? null;
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  // Derived from the real AI-provider setting — the edit-only "Allow AI" control
  // must reflect the actual global posture, never a hardcoded stub (cycle-4 #4).
  const [globalAiEnabled, setGlobalAiEnabled] = useState(false);
  // Single-flight guard: block a second concurrent write while one is in flight
  // so a double-tap cannot create a duplicate Memory (CAPT-06 idempotency).
  const [saving, setSaving] = useState(false);
  // A successful inner Save returns to the Update Contact chooser (dossier §AA).
  // Navigating is deferred to an effect (not fired inside the async save
  // handler) so MemoryEditor finishes its own close() before this screen
  // unmounts — avoiding a setState-on-unmounted warning mid-commit.
  const [savedTick, setSavedTick] = useState(0);

  const load = useCallback(
    async (cancelled: () => boolean = () => false) => {
      if (contactId === null) return;
      const exec = getExecutor();
      try {
        const aiEnabled = (await getAppSettings(exec)).aiProvider !== "none";
        if (!cancelled()) setGlobalAiEnabled(aiEnabled);
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to load AI availability", error);
        if (!cancelled()) setGlobalAiEnabled(false);
      }
      const rows = await listMemoriesForContact(exec, contactId);
      if (!cancelled()) setMemories(rows);
    },
    [contactId],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void load(() => cancelled).catch((error) => {
        Logger.error(LOG_SCOPE, "failed to load memories", error);
        if (!cancelled) setMemories([]);
      });
      return () => {
        cancelled = true;
      };
    }, [load]),
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
    if (contactId === null || saving) return false;
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
    }
  };

  const edit = async (id: number, patch: MemoryEditPatch): Promise<boolean> => {
    if (contactId === null || saving) return false;
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
    }
  };

  const restore = (id: number) => {
    if (contactId === null) return;
    void restoreMemory(getExecutor(), { id, contactId, now: localDateTime() })
      .then(() => load())
      .catch((error) =>
        Logger.error(LOG_SCOPE, "failed to restore memory", error),
      );
  };

  const remove = (id: number) => {
    if (contactId === null) return;
    void deleteMemory(getExecutor(), { id, contactId, now: localDateTime() })
      .then(() => {
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
      })
      .catch((error) =>
        Logger.error(LOG_SCOPE, "failed to delete memory", error),
      );
  };

  const setAllowAi = (id: number, allow: boolean) => {
    if (contactId === null) return;
    void setMemoryAllowAi(getExecutor(), {
      id,
      contactId,
      allow,
      now: localDateTime(),
    })
      .then(() => load())
      .catch((error) =>
        Logger.error(LOG_SCOPE, "failed to set memory AI permission", error),
      );
  };

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Memory" />
      <ScrollView contentContainerStyle={styles.content}>
        {contactId === null ? (
          <AppText role="body" style={{ color: colors.textSecondary }}>
            Open a contact to add or edit a Memory.
          </AppText>
        ) : (
          <MemoryEditor
            testID="memory-screen-editor"
            items={memories}
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
});
