/**
 * Post-log capture editor (CAPT-05, dossier §I).
 *
 * Opened by the Quick Log success snackbar's "Add Note" action, bound to the
 * just-created interaction. It saves EITHER an Interaction Note OR a basic
 * Memory — never both (the branch decision lives in the node-tested pure
 * `resolvePostLogSave`). "Create Memory Instead" turns the typed text into a
 * Memory (requested by DEFAULT_MEMORY_TYPE_KEY, D-11) and leaves the Interaction
 * Note empty; after a basic Memory is created it offers "Edit Memory" into the
 * full `MemoryEditor`.
 *
 * It carries its OWN save-in-flight guard (`savingRef`), separate from
 * runQuickLog's `pendingRef` which only protects the initial immediate write, so
 * a double-tapped Save commits at most once. Before a Note save it re-reads the
 * interaction; if it was already undone/deleted (Add-Note-after-Undo race) the
 * resolver returns "missing" and a friendly error is shown rather than editing a
 * deleted row. No colour literal (check:colors) — all colour via theme tokens.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { getAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { readInteractionForEdit } from "@/db/interaction-edit-read";
import {
  addMemory,
  deleteMemory,
  editMemory,
  restoreMemory,
  setMemoryAllowAi,
} from "@/db/memories-dao";
import { listMemoriesForContact, type MemoryRow } from "@/db/memories-read";
import { editTouchpointFull } from "@/db/recency-dao";
import { resolvePostLogSave } from "@/screens/post-log-note-logic";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import {
  MemoryEditor,
  type MemoryDraft,
  type MemoryEditPatch,
} from "./MemoryEditor";
import { AppText, Button, Sheet } from "./ui";

const LOG_SCOPE = "post-log-note-editor";
/** Locked failure copy (UI-SPEC Copywriting Contract). */
const SAVE_FAILED_MESSAGE = "Couldn't save. Please try again.";
/** Friendly copy when the interaction was undone before the note landed. */
const MISSING_INTERACTION_MESSAGE =
  "That interaction was undone, so there's nothing to add a note to.";

export interface PostLogNoteTarget {
  interactionId: number;
  contactId: number;
}

export interface PostLogNoteEditorProps {
  /** Non-null opens the editor bound to the created interaction; null closes it. */
  target: PostLogNoteTarget | null;
  onClose: () => void;
}

export function PostLogNoteEditor({ target, onClose }: PostLogNoteEditorProps) {
  const { colors } = useTheme();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdMemory, setCreatedMemory] = useState<MemoryRow | null>(null);
  const [editingMemory, setEditingMemory] = useState(false);
  const [globalAiEnabled, setGlobalAiEnabled] = useState(false);
  // Own single-flight guard, distinct from runQuickLog's pendingRef.
  const savingRef = useRef(false);

  const contactId = target?.contactId ?? null;
  const interactionId = target?.interactionId ?? null;

  // Reset every time the editor opens for a new interaction.
  useEffect(() => {
    if (!target) return;
    setText("");
    setError(null);
    setCreatedMemory(null);
    setEditingMemory(false);
    savingRef.current = false;
    let cancelled = false;
    void (async () => {
      try {
        const enabled =
          (await getAppSettings(getExecutor())).aiProvider !== "none";
        if (!cancelled) setGlobalAiEnabled(enabled);
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to read AI availability", err);
        if (!cancelled) setGlobalAiEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target]);

  const reReadCreatedMemory = useCallback(
    async (id: number, cId: number) => {
      const rows = await listMemoriesForContact(getExecutor(), cId);
      return rows.find((row) => row.id === id) ?? null;
    },
    [],
  );

  const saveNote = useCallback(async () => {
    if (contactId === null || interactionId === null) return;
    if (savingRef.current) return;
    savingRef.current = true;
    setError(null);
    try {
      const seed = await readInteractionForEdit(
        getExecutor(),
        contactId,
        interactionId,
      );
      const result = resolvePostLogSave({
        kind: "note",
        text,
        interactionId,
        interactionExists: seed !== null,
      });
      if (result.target === "noop") {
        onClose();
        return;
      }
      if (result.target === "missing" || seed === null) {
        setError(MISSING_INTERACTION_MESSAGE);
        return;
      }
      const now = localDateTime();
      await editTouchpointFull(getExecutor(), {
        interactionId: result.interactionId,
        contactId,
        occurredAt: seed.occurredAt,
        now,
        channel: seed.channel,
        direction: seed.direction,
        connected: seed.connected,
        quality: seed.quality,
        note: result.note,
        duration: seed.duration,
        allowAi: seed.allowAi,
      });
      onClose();
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to save interaction note", err);
      setError(SAVE_FAILED_MESSAGE);
    } finally {
      savingRef.current = false;
    }
  }, [contactId, interactionId, onClose, text]);

  const createMemory = useCallback(async () => {
    if (contactId === null) return;
    if (savingRef.current) return;
    savingRef.current = true;
    setError(null);
    try {
      const result = resolvePostLogSave({ kind: "memory", text });
      if (result.target === "noop") {
        onClose();
        return;
      }
      if (result.target !== "memory") return;
      const now = localDateTime();
      const id = await addMemory(getExecutor(), {
        contactId,
        type: result.type,
        value: result.value,
        createdAt: now,
        now,
      });
      const row = await reReadCreatedMemory(id, contactId);
      setCreatedMemory(row);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to create memory", err);
      setError(SAVE_FAILED_MESSAGE);
    } finally {
      savingRef.current = false;
    }
  }, [contactId, onClose, reReadCreatedMemory, text]);

  const onEditMemory = useCallback(
    async (id: number, patch: MemoryEditPatch): Promise<boolean> => {
      if (contactId === null) return false;
      try {
        await editMemory(getExecutor(), {
          id,
          contactId,
          ...patch,
          now: localDateTime(),
        });
        const row = await reReadCreatedMemory(id, contactId);
        setCreatedMemory(row);
        return true;
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to edit memory", err);
        return false;
      }
    },
    [contactId, reReadCreatedMemory],
  );

  // showAdd is false in this bound context, so onAdd is never reached; it is
  // provided to satisfy the MemoryEditor contract.
  const onAddMemory = useCallback(
    async (_draft: MemoryDraft): Promise<boolean> => false,
    [],
  );
  const onDeleteMemory = useCallback(
    (id: number) => {
      if (contactId === null) return;
      void deleteMemory(getExecutor(), { id, contactId, now: localDateTime() })
        .then(() => onClose())
        .catch((err) =>
          Logger.error(LOG_SCOPE, "failed to delete memory", err),
        );
    },
    [contactId, onClose],
  );
  const onRestoreMemory = useCallback(
    (id: number) => {
      if (contactId === null) return;
      void restoreMemory(getExecutor(), {
        id,
        contactId,
        now: localDateTime(),
      }).catch((err) =>
        Logger.error(LOG_SCOPE, "failed to restore memory", err),
      );
    },
    [contactId],
  );
  const onSetMemoryAllowAi = useCallback(
    (id: number, allow: boolean) => {
      if (contactId === null) return;
      void setMemoryAllowAi(getExecutor(), {
        id,
        contactId,
        allow,
        now: localDateTime(),
      }).catch((err) =>
        Logger.error(LOG_SCOPE, "failed to set memory AI permission", err),
      );
    },
    [contactId],
  );

  const editingExistingMemory = editingMemory && createdMemory !== null;

  return (
    <Sheet
      visible={target !== null}
      onRequestClose={onClose}
      variant={editingExistingMemory ? "expanded" : "compact"}
    >
      {editingExistingMemory && createdMemory ? (
        <View style={styles.body}>
          <AppText role="heading">Edit Memory</AppText>
          <MemoryEditor
            items={[createdMemory]}
            showAdd={false}
            onAdd={onAddMemory}
            onEdit={onEditMemory}
            onDelete={onDeleteMemory}
            onRestore={onRestoreMemory}
            onSetAllowAi={onSetMemoryAllowAi}
            globalAiEnabled={globalAiEnabled}
          />
          <Button role="tertiary" label="Done" onPress={onClose} />
        </View>
      ) : createdMemory ? (
        <View style={styles.body}>
          <AppText role="heading">Memory saved</AppText>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            Saved as a Memory, not a note on this interaction.
          </AppText>
          <View style={styles.actions}>
            <Button
              role="tertiary"
              label="Edit Memory"
              onPress={() => setEditingMemory(true)}
            />
            <Button role="primary" label="Done" onPress={onClose} />
          </View>
        </View>
      ) : (
        <View style={styles.body}>
          <AppText role="heading">Add Note</AppText>
          <TextInput
            accessibilityLabel="Note for the logged interaction"
            value={text}
            onChangeText={setText}
            placeholder="What happened?"
            placeholderTextColor={colors.textSecondary}
            multiline
            autoFocus
            style={[
              styles.input,
              {
                color: colors.textPrimary,
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          />
          {error ? (
            <AppText role="caption" style={{ color: colors.danger }}>
              {error}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <Button role="tertiary" label="Cancel" onPress={onClose} />
            <Button
              role="tertiary"
              label="Create Memory Instead"
              onPress={() => void createMemory()}
            />
            <Button
              role="primary"
              label={error ? "Retry" : "Save"}
              onPress={() => void saveNote()}
            />
          </View>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACING.base },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "flex-end",
  },
  input: {
    borderRadius: SPACING.sm,
    borderWidth: 1,
    minHeight: 84,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    textAlignVertical: "top",
  },
});
