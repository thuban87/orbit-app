/**
 * Post-log Add Note sheet (CAPT-05, dossier §I; Phase 38.10 D-37, D-42, D-95).
 *
 * Opened by the Quick Log success snackbar's "Add Note" action, bound to the
 * just-created interaction. It saves the interaction's note and, through the
 * one-section "Also save to" picker (D-42), optionally a linked entry in Last
 * Talked About, Gift Ideas, Thought of Them or Memories: one text in two
 * places (D-37), written in the same transaction by `saveNoteWithLinkedEntry`.
 * The decision lives in the node-tested pure `resolvePostLogSave`; the
 * destination is `effectiveAlsoSaveTo(note, chosen)` and a blanked note resets
 * the picker to None (convergence c10, Codex C-01). The old separate memory
 * path and its follow-up editor are gone (D-42).
 *
 * The sheet has no Allow AI switch of its own: the interaction's switch lives
 * on Log Interaction and Edit Interaction, and a linked entry follows it
 * (D-49).
 *
 * F-18 layout (D-42; 38.9 feedback and button-order standards): one action
 * row, Cancel then Save; a successful save shows a snackbar naming the person
 * (and the section); an empty Save closes with nothing written.
 *
 * It carries its OWN save-in-flight guard (`savingRef`), separate from
 * runQuickLog's `pendingRef` which only protects the initial immediate write, so
 * a double-tapped Save commits at most once. Before a save it re-reads the
 * interaction; if it was already undone/deleted (Add-Note-after-Undo race) the
 * resolver returns "missing" and a friendly error is shown rather than editing a
 * deleted row. No colour literal (check:colors) — all colour via theme tokens.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { getExecutor, localDateTime } from "@/db/database";
import { readInteractionForEdit } from "@/db/interaction-edit-read";
import type { LinkedSection } from "@/db/linked-entry-dao";
import { editTouchpointFull, saveNoteWithLinkedEntry } from "@/db/recency-dao";
import { useContactHeader } from "@/hooks/use-contact-header";
import {
  addedNoteSnackbar,
  alsoSaveChoiceAfterNoteChange,
  canAlsoSave,
} from "@/logic/also-save-to-logic";
import { confirmDiscard } from "@/navigation/discard-keep-guard";
import {
  resolvePostLogSave,
  shouldPromptOnNoteClose,
} from "@/screens/post-log-note-logic";
import { bumpShellRefresh } from "@/stores/shell-refresh-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import { AlsoSaveToPicker } from "./AlsoSaveToPicker";
import { PersonLine } from "./PersonLine";
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
  // "Also save to" (D-42, D-95): one section or None; None once the note is
  // blank (convergence c10, Codex C-01).
  const [alsoSaveTo, setAlsoSaveTo] = useState<LinkedSection | null>(null);
  // Set beside savingRef: the ref is the guard, `busy` is render state for the
  // disabled look, so every control the save holds reads as disabled (D-26;
  // fix-pass WR-01).
  const [busy, setBusy] = useState(false);
  // Own single-flight guard, distinct from runQuickLog's pendingRef.
  const savingRef = useRef(false);

  const contactId = target?.contactId ?? null;
  const interactionId = target?.interactionId ?? null;
  // D-45: who the note is for, under the sheet's heading.
  const person = useContactHeader(contactId);

  // Reset every time the editor opens for a new interaction.
  useEffect(() => {
    if (!target) return;
    setText("");
    setError(null);
    setAlsoSaveTo(null);
    savingRef.current = false;
    setBusy(false);
  }, [target]);

  const onChangeText = useCallback((next: string) => {
    setText(next);
    setAlsoSaveTo((chosen) => alsoSaveChoiceAfterNoteChange(next, chosen));
  }, []);

  const saveNote = useCallback(async () => {
    if (contactId === null || interactionId === null) return;
    if (savingRef.current) return;
    savingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const seed = await readInteractionForEdit(
        getExecutor(),
        contactId,
        interactionId,
      );
      const result = resolvePostLogSave({
        text,
        interactionId,
        interactionExists: seed !== null,
        alsoSaveTo,
      });
      if (result.target === "noop") {
        onClose();
        return;
      }
      if (result.target === "missing" || seed === null) {
        setError(MISSING_INTERACTION_MESSAGE);
        return;
      }
      const input = {
        interactionId: result.interactionId,
        contactId,
        occurredAt: seed.occurredAt,
        now: localDateTime(),
        channel: seed.channel,
        direction: seed.direction,
        connected: seed.connected,
        quality: seed.quality,
        note: result.note,
        duration: seed.duration,
        allowAi: seed.allowAi,
      };
      if (result.alsoSaveTo !== null) {
        // The note and its linked entry in one transaction (D-37, D-42).
        await saveNoteWithLinkedEntry(getExecutor(), input, result.alsoSaveTo);
      } else {
        await editTouchpointFull(getExecutor(), input);
      }
      // 38.3 D-21: publish the committed note to foreground consumers (Profile,
      // History, Dashboard) before closing — same shell tick as the Quick Log.
      bumpShellRefresh();
      // F-18 / 38.9 D-39, D-46: the save is no longer silent.
      showSnackbar({
        kind: "success",
        label: addedNoteSnackbar({
          personName: person?.name ?? null,
          section: result.alsoSaveTo,
        }),
      });
      onClose();
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to save interaction note", err);
      setError(SAVE_FAILED_MESSAGE);
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }, [alsoSaveTo, contactId, interactionId, onClose, person, text]);

  // The one dirty-aware close for every exit that is not a save (D-14, D-61;
  // review CR-02, verification WR-01): Back, the scrim and Cancel. Typed text
  // or a chosen section asks "Discard changes?" first; untouched closes at
  // once. confirmDiscard() is single-flight, so a second exit while the prompt
  // is up never closes twice. A successful save still closes directly through
  // onClose (D-61).
  const requestSheetClose = () => {
    // A save in flight owns the close (verification IN-01): its success closes
    // the sheet, its failure leaves it open with the error. Opening "Discard
    // changes?" now would leave the prompt over a sheet that is already gone.
    if (savingRef.current) return;
    if (!shouldPromptOnNoteClose({ text, alsoSaveTo })) {
      onClose();
      return;
    }
    void confirmDiscard().then((discard) => {
      if (discard) onClose();
    });
  };

  return (
    <Sheet
      visible={target !== null}
      onRequestClose={requestSheetClose}
      variant="compact"
    >
      <View style={styles.body}>
        <AppText role="heading">Add Note</AppText>
        {person ? (
          <PersonLine
            name={person.name}
            photo={person.photo}
            contactId={person.contactId}
          />
        ) : null}
        <TextInput
          accessibilityLabel="Note for the logged interaction"
          value={text}
          onChangeText={onChangeText}
          placeholder="What happened?"
          placeholderTextColor={colors.textPlaceholder}
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
        <AlsoSaveToPicker
          testID="post-log-note-also-save-to"
          value={alsoSaveTo}
          onChange={setAlsoSaveTo}
          disabled={busy || !canAlsoSave(text)}
        />
        {error ? (
          <AppText role="caption" style={{ color: colors.danger }}>
            {error}
          </AppText>
        ) : null}
        <View style={styles.actions}>
          <Button
            role="tertiary"
            label="Cancel"
            disabled={busy}
            onPress={requestSheetClose}
          />
          <Button
            role="primary"
            label={error ? "Retry" : "Save"}
            disabled={busy}
            onPress={() => void saveNote()}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACING.base },
  // F-18: one row, Cancel then Save (38.9 D-06 button order); no wrap.
  actions: {
    flexDirection: "row",
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
