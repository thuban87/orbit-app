/**
 * SectionEditorScreen — one memory-type section's editor (Phase 38.10 D-75):
 * Memories, Thought of Them, Gift Ideas or Imported, one shared design that
 * edits only that section. Route `{ contactId, type, editId? }`.
 *
 * - Read: the ADR-168 gated-read pattern. One `ReadPhase` loads the app
 *   settings (the AI master, `isAiMasterEnabled`), the per-type Allow AI
 *   defaults and the section's live rows, hidden ones included; a failed read
 *   shows Retry, never an empty list.
 * - `editId` opens that entry's edit form after the read, once per
 *   navigation; an entry that is gone falls back to the list (D-107).
 * - Linked entries: tap opens the interaction; Edit and Pin/Unpin are on
 *   long-press and the screen-reader actions (D-107, D-37, D-48).
 * - Hidden entries are dimmed with "Show on Profile" (D-17).
 * - Delete is immediate with an Undo snackbar naming the person (D-69;
 *   38.9 D-39/D-46). Pin/Unpin carries Undo too.
 * - Allow AI travels in the editor's draft; Save writes it with the text
 *   through the `editMemory` wrapper (D-27, D-13).
 * - The entry field centres above the keyboard (D-66).
 * - Back closes an open draft first (38.9 D-14 via D-19).
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md).
 */
import { useFocusEffect } from "@react-navigation/native";
import { type RefObject, useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import {
  type MemoryAiDefaults,
  type MemoryDraft,
  type MemoryDraftState,
  MemoryEditor,
  type MemoryEditorHandle,
  type MemoryEditPatch,
} from "@/components/MemoryEditor";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  AppText,
  Button,
  EmptyState,
  KeyboardCenteringProvider,
  useKeyboardCentering,
} from "@/components/ui";
import {
  getAiPermissionDefaults,
  memoryAiDefaultsMap,
} from "@/db/ai-permissions-dao";
import { getAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import {
  getLinkedInteractionRefCore,
  LinkedNoteBlankError,
} from "@/db/linked-entry-dao";
import {
  addMemory,
  deleteMemoryNow,
  editMemory,
  type MemorySnapshot,
  undoMemoryDelete,
} from "@/db/memories-dao";
import { listMemoriesForContact, type MemoryRow } from "@/db/memories-read";
import { useContactHeader } from "@/hooks/use-contact-header";
import { isAiMasterEnabled } from "@/logic/ai-enablement";
import { linkedEntryRoute } from "@/logic/linked-entry-route";
import { type ReadPhase, readLoading, runGatedRead } from "@/logic/read-phase";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { createLatestRequestAuthority } from "@/utils/latest-request";
import { Logger } from "@/utils/logger";
import { beginInFlight, endInFlight } from "@/utils/single-flight";
import {
  addedSnackbar,
  canAdd,
  deletedSnackbar,
  LINKED_ENTRY_NEEDS_TEXT,
  openEditTarget,
  restoredSnackbar,
  savedSnackbar,
  sectionEmptyText,
  sectionEntries,
  sectionPinSnackbar,
  sectionPinUndoneSnackbar,
  sectionTitle,
  shownOnProfileSnackbar,
} from "./section-editor-logic";

const LOG_SCOPE = "section-editor";

interface SectionEditorData {
  rows: MemoryRow[];
  globalAiEnabled: boolean;
  aiDefaults: MemoryAiDefaults;
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

export function SectionEditorScreen({
  navigation,
  route,
}: RootStackScreenProps<"SectionEditor">) {
  const { colors } = useTheme();
  const { contactId, type, editId } = route.params;
  const title = sectionTitle(type);
  // D-45: the person line under the fixed title.
  const person = useContactHeader(contactId);
  // Snackbars fired after an await read the latest name.
  const nameRef = useRef<string | null>(null);
  nameRef.current = person?.name ?? null;

  const [phase, setPhase] = useState<ReadPhase<SectionEditorData>>(readLoading);
  // Only the latest load may publish; blur invalidates outstanding reads.
  const readAuthority = useMemo(() => createLatestRequestAuthority(), []);
  // `editId` opens its form once per navigation (D-107; convergence c6).
  const editConsumedRef = useRef(false);
  const [initialEditId, setInitialEditId] = useState<number | undefined>(
    undefined,
  );

  // Single-flight for add and edit (a double tap must not write twice);
  // `saving` mirrors it for the header's Back and the editor's held controls.
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  // In-screen sub-editor guard (38.9 D-14 via D-19): Back with a draft open
  // closes it first, asking only when it holds changes.
  const editorRef = useRef<MemoryEditorHandle>(null);
  const [draftState, setDraftState] = useState<MemoryDraftState>({
    open: false,
    dirty: false,
  });
  const bypassRef = useRef(false);
  const { requestClose, settleHold } = useDiscardKeepGuard({
    hasUnsavedChanges: false,
    bypassRef,
    busyRef: savingRef,
    subEditor: {
      open: draftState.open,
      dirty: draftState.dirty,
      close: () => editorRef.current?.closeDraft(),
    },
  });

  // D-66: the entry field centres above the keyboard.
  const scrollRef = useRef<ScrollView>(null);
  // ScrollView.d.ts types `innerViewRef` as a non-null `RefObject<View>`
  // (as use-first-error-reveal.ts widens it).
  const contentRef = useRef<View>(null) as RefObject<View>;
  const { centering, bottomSpacer } = useKeyboardCentering({
    scrollRef,
    contentRef,
  });

  /** NEVER rejects: a failure lands in the error phase (D-04). */
  const load = useCallback(async (): Promise<void> => {
    await runGatedRead({
      gate: readAuthority,
      read: async (): Promise<SectionEditorData> => {
        const exec = getExecutor();
        const settings = await getAppSettings(exec);
        const defaults = await getAiPermissionDefaults(exec);
        const rows = await listMemoriesForContact(exec, contactId);
        return {
          rows: sectionEntries(rows, type),
          globalAiEnabled: isAiMasterEnabled(settings),
          aiDefaults: memoryAiDefaultsMap(defaults),
        };
      },
      publish: setPhase,
      onLoaded: (data) => {
        if (editConsumedRef.current) {
          setInitialEditId(undefined);
          return;
        }
        editConsumedRef.current = true;
        setInitialEditId(openEditTarget(editId, data.rows));
      },
      onError: (error) =>
        Logger.error(LOG_SCOPE, "failed to load the section", error),
    });
  }, [contactId, type, editId, readAuthority]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => readAuthority.invalidate();
    }, [load, readAuthority]),
  );

  const saveFailed = (error: unknown) =>
    errorNotice(
      error instanceof LinkedNoteBlankError
        ? LINKED_ENTRY_NEEDS_TEXT
        : "Couldn't save. Please try again.",
    );

  const add = async (draft: MemoryDraft): Promise<boolean> => {
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
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to add an entry", error);
      saveFailed(error);
      return false;
    } finally {
      setSaving(false);
      endInFlight(savingRef);
      settleHold();
    }
    void load();
    showSnackbar({
      kind: "success",
      label: addedSnackbar(title, nameRef.current),
    });
    return true;
  };

  // Text and a changed Allow AI save in one transaction through the
  // `editMemory` wrapper (D-27, D-49; it refuses a locked row, D-102/D-103).
  const edit = async (id: number, patch: MemoryEditPatch): Promise<boolean> => {
    if (!beginInFlight(savingRef)) return false;
    setSaving(true);
    try {
      await editMemory(getExecutor(), {
        id,
        contactId,
        ...patch,
        now: localDateTime(),
      });
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to save an entry", error);
      saveFailed(error);
      return false;
    } finally {
      setSaving(false);
      endInFlight(savingRef);
      settleHold();
    }
    void load();
    showSnackbar({
      kind: "success",
      label: savedSnackbar(title, nameRef.current),
    });
    return true;
  };

  const undoDelete = (snapshot: MemorySnapshot) => {
    void (async () => {
      try {
        await undoMemoryDelete(getExecutor(), snapshot, localDateTime());
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to undo a delete", error);
        errorNotice("Couldn't undo the delete.");
        return;
      }
      void load();
      showSnackbar({
        kind: "success",
        label: restoredSnackbar(title, nameRef.current),
      });
    })();
  };

  // D-69: the delete happens at once (a hard delete with a tombstone; a
  // linked entry's interaction and note stay, D-37) and Undo puts it back.
  const remove = (id: number): boolean => {
    if (savingRef.current) return false;
    void (async () => {
      let snapshot: MemorySnapshot;
      try {
        snapshot = await deleteMemoryNow(getExecutor(), {
          id,
          contactId,
          now: localDateTime(),
        });
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to delete an entry", error);
        errorNotice("Couldn't delete. Please try again.");
        return;
      }
      void load();
      showSnackbar({
        kind: "success",
        label: deletedSnackbar(title, nameRef.current),
        action: {
          label: "Undo",
          accessibilityLabel: `Undo deleting the ${title} entry`,
          onPress: () => undoDelete(snapshot),
        },
      });
    })();
    return true;
  };

  /** Write `pinned`, reload, then report; Undo writes the previous value. */
  const writePin = async (id: number, pinned: boolean): Promise<boolean> => {
    try {
      await editMemory(getExecutor(), {
        id,
        contactId,
        pinned,
        now: localDateTime(),
      });
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to pin or unpin an entry", error);
      return false;
    }
    void load();
    return true;
  };

  // D-107 / D-21: a linked entry's immediate Pin / Unpin, with Undo
  // (38.9 D-39 via D-19).
  const togglePin = (item: MemoryRow) => {
    if (savingRef.current) return;
    const next = item.pinned !== 1;
    void (async () => {
      if (!(await writePin(item.id, next))) {
        errorNotice("Couldn't save. Please try again.");
        return;
      }
      showSnackbar({
        kind: "success",
        label: sectionPinSnackbar(next, nameRef.current),
        action: {
          label: "Undo",
          accessibilityLabel: next ? "Undo pin" : "Undo unpin",
          onPress: () => {
            void (async () => {
              if (!(await writePin(item.id, !next))) {
                errorNotice(
                  next ? "Couldn't undo the pin." : "Couldn't undo the unpin.",
                );
                return;
              }
              showSnackbar({
                kind: "success",
                label: sectionPinUndoneSnackbar(next, nameRef.current),
              });
            })();
          },
        },
      });
    })();
  };

  // D-17: a hidden entry stays recoverable here.
  const showOnProfile = (item: MemoryRow) => {
    if (savingRef.current) return;
    void (async () => {
      try {
        await editMemory(getExecutor(), {
          id: item.id,
          contactId,
          hidden: false,
          now: localDateTime(),
        });
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to show an entry on Profile", error);
        errorNotice("Couldn't save. Please try again.");
        return;
      }
      void load();
      showSnackbar({
        kind: "success",
        label: shownOnProfileSnackbar(nameRef.current),
      });
    })();
  };

  // D-107: a linked entry opens its interaction (D-37, D-48; checker B5).
  const openLinked = (item: MemoryRow) => {
    const interactionId = item.interaction_id;
    if (interactionId === null) return;
    void (async () => {
      let target: ReturnType<typeof linkedEntryRoute>;
      try {
        const ref = await getLinkedInteractionRefCore(
          getExecutor(),
          interactionId,
        );
        target = linkedEntryRoute(
          ref === null
            ? null
            : {
                ...ref,
                linkSource:
                  item.link_source === "group_note" ? "group_note" : "note",
              },
        );
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to open the interaction", error);
        return;
      }
      if (target === null) {
        // The interaction is gone; the entry is standalone now.
        void load();
        return;
      }
      switch (target.name) {
        case "GroupEventDetail":
          navigation.navigate("GroupEventDetail", target.params);
          return;
        case "EditParticipant":
          navigation.navigate("EditParticipant", target.params);
          return;
        case "EditInteraction":
          navigation.navigate("EditInteraction", target.params);
          return;
      }
    })();
  };

  const empty = sectionEmptyText(type);

  return (
    <View style={styles.root}>
      {/* While an add or edit runs the guard holds Back (D-26; WR-02). */}
      <ShellAppBar
        variant="child"
        title={title}
        person={person}
        backDisabled={saving}
      />
      <ScrollView
        ref={scrollRef}
        innerViewRef={contentRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <KeyboardCenteringProvider value={centering}>
          {phase.phase === "loading" ? (
            <View
              testID="section-editor-loading"
              accessibilityLabel={`Loading ${title}`}
              style={styles.readState}
            >
              <ActivityIndicator color={colors.accentText} />
            </View>
          ) : phase.phase === "error" ? (
            <View testID="section-editor-read-error" style={styles.readError}>
              {/* biome-ignore lint/a11y/useValidAriaRole: AppText role is a typography role. */}
              <AppText role="body" style={{ color: colors.textPrimary }}>
                {`Couldn't load ${title}`}
              </AppText>
              {/* biome-ignore lint/a11y/useValidAriaRole: Button role is the design-system hierarchy role. */}
              <Button
                role="tertiary"
                label="Retry"
                accessibilityLabel={`Retry loading ${title}`}
                onPress={() => void load()}
              />
            </View>
          ) : (
            <>
              {phase.data.rows.length === 0 ? (
                // D-68: text only; MemoryEditor's own Add is the one action.
                <EmptyState
                  testID="section-editor-empty"
                  icon="list"
                  heading={empty.heading}
                  body={empty.body}
                />
              ) : null}
              <MemoryEditor
                testID="section-editor"
                ref={editorRef}
                items={phase.data.rows}
                fixedType={type}
                showAdd={canAdd(type)}
                globalAiEnabled={phase.data.globalAiEnabled}
                aiDefaults={phase.data.aiDefaults}
                initiallyEditingId={initialEditId}
                onAdd={add}
                onEdit={edit}
                onDelete={remove}
                onOpenLinked={openLinked}
                onTogglePin={togglePin}
                onShowOnProfile={showOnProfile}
                onDraftStateChange={setDraftState}
                onCancelRequest={(close) =>
                  requestClose(close, draftState.dirty)
                }
                busy={saving}
              />
            </>
          )}
        </KeyboardCenteringProvider>
        {bottomSpacer}
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
