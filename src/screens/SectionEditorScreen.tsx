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
 * - Card edit mode (D-130): a pencil on every card; the pencil or a tap on an
 *   unlinked card opens that card's form in its place, with Move and a red
 *   Delete at its top (hidden at rest); a linked card's pencil opens it too.
 *   The Add is solid.
 * - Section Add FAB (D-131): the solid Add sits at the top, above the entries,
 *   and a new entry's form opens in its place. Scrolled out of view, it morphs
 *   into the bottom-left FAB (the page's icon with a +), whose tap scrolls to
 *   the top and opens the add form. Imported has no Add, so no FAB (D-35).
 * - Hidden entries are dimmed with "Show on Profile" (D-17), but only while
 *   `HIDE_FROM_PROFILE_ENABLED` is on; it is off (D-134), so every entry
 *   shows plainly.
 * - Every entry but Imported can move to another D-84 section through
 *   `MoveEntrySheet`, with the D-85 confirm and Undo (D-118).
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import {
  type MemoryAiDefaults,
  type MemoryDraft,
  type MemoryDraftState,
  MemoryEditor,
  type MemoryEditorHandle,
  type MemoryEditPatch,
} from "@/components/MemoryEditor";
import { MoveEntrySheet } from "@/components/MoveEntrySheet";
import {
  SectionAddFab,
  useSectionAddMorph,
  useSectionFabClearance,
} from "@/components/SectionAddFab";
import { ShellAppBar } from "@/components/ShellAppBar";
import { sectionFabIcon } from "@/components/section-add-fab-logic";
import {
  AppText,
  Button,
  EmptyState,
  KeyboardCenteringProvider,
  useKeyboardCentering,
} from "@/components/ui";
import { useFirstErrorReveal } from "@/components/ui/use-first-error-reveal";
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
import { HIDE_FROM_PROFILE_ENABLED } from "@/db/memory-registry";
import { useContactHeader } from "@/hooks/use-contact-header";
import { isAiMasterEnabled } from "@/logic/ai-enablement";
import { linkedEntryRoute } from "@/logic/linked-entry-route";
import { type ReadPhase, readLoading, runGatedRead } from "@/logic/read-phase";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import { isFocusedWorkflow } from "@/navigation/focused-route-classification";
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
  canMove,
  deletedSnackbar,
  LINKED_ENTRY_NEEDS_TEXT,
  moveSectionOf,
  openEditTarget,
  restoredSnackbar,
  savedSnackbar,
  sectionAddLabel,
  sectionEmptyText,
  sectionEntries,
  sectionEntryNoun,
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

  // D-66: the entry field centres above the keyboard; the same ScrollView
  // pair scrolls an `editId` form into view (D-130).
  const { scrollRef, contentRef, reveal } = useFirstErrorReveal();
  const { centering, bottomSpacer } = useKeyboardCentering({
    scrollRef,
    contentRef,
  });
  // D-130: the form opens in place of its card. A tap opens it where the
  // card was, on screen; an `editId` (the Profile's item Edit, D-107) may
  // name an entry further down, so its form is scrolled into view once.
  const formRef = useRef<View>(null);
  useEffect(() => {
    if (typeof initialEditId === "number") reveal(formRef);
  }, [initialEditId, reveal]);

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
      // D-132: a delete reports in the warning style.
      showSnackbar({
        kind: "warning",
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

  // D-84: Move opens the shared sheet for that entry (never for Imported).
  const [moveItem, setMoveItem] = useState<MemoryRow | null>(null);
  const moveSection = moveSectionOf(type);
  const openMoveSheet = (item: MemoryRow) => {
    if (savingRef.current) return;
    setMoveItem(item);
  };

  const empty = sectionEmptyText(type);
  const addable = canAdd(type);

  // D-131: the top Add morphs into the bottom-left FAB once it scrolls off.
  const focusedRoute = isFocusedWorkflow(route.name);
  // A section with no Add (Imported) has no FAB, so it never reports one.
  const morph = useSectionAddMorph({
    loaded: phase.phase === "loaded" && addable,
    formOpen: draftState.open,
    focusedRoute,
  });
  const fabClearance = useSectionFabClearance(focusedRoute);
  const openNewFromFab = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    editorRef.current?.openNew();
  };

  return (
    <View style={styles.root} onLayout={morph.onRootLayout}>
      {/* While an add or edit runs the guard holds Back (D-26; WR-02). */}
      <ShellAppBar
        variant="child"
        title={title}
        person={person}
        backDisabled={saving}
      />
      <Animated.ScrollView
        ref={scrollRef}
        innerViewRef={contentRef}
        onLayout={morph.onViewportLayout}
        onScroll={morph.scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          // The last entry scrolls fully above the section FAB.
          { paddingBottom: fabClearance },
        ]}
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
              {addable && !draftState.adding ? (
                // D-131: the solid Add at the top (D-130), the one Add on the
                // page; a new entry's form opens in its place. Held while a
                // form is open or a save runs.
                <View onLayout={morph.onBarLayout}>
                  {/* biome-ignore lint/a11y/useValidAriaRole: Button role is the design-system hierarchy role. */}
                  <Button
                    testID="section-editor-add"
                    role="primary"
                    label={sectionAddLabel(type)}
                    disabled={saving || draftState.open}
                    onPress={() => editorRef.current?.openNew()}
                  />
                </View>
              ) : null}
              {phase.data.rows.length === 0 && !draftState.open ? (
                // D-68: text only; the top Add is the one action. D-145: it
                // hides while the add form is open.
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
                cardEditMode
                formRef={formRef}
                addPlacement="top"
                entryNoun={sectionEntryNoun(type)}
                items={phase.data.rows}
                fixedType={type}
                showAdd={addable}
                globalAiEnabled={phase.data.globalAiEnabled}
                aiDefaults={phase.data.aiDefaults}
                initiallyEditingId={initialEditId}
                onAdd={add}
                onEdit={edit}
                onDelete={remove}
                onOpenLinked={openLinked}
                onTogglePin={togglePin}
                onShowOnProfile={
                  HIDE_FROM_PROFILE_ENABLED ? showOnProfile : undefined
                }
                onMove={
                  canMove(type) ? (item) => openMoveSheet(item) : undefined
                }
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
      </Animated.ScrollView>
      {moveItem !== null && moveSection !== null ? (
        <MoveEntrySheet
          entryRef={{ table: "memories", id: moveItem.id, contactId }}
          row={moveItem}
          section={moveSection}
          contactName={person?.name ?? null}
          onMoved={() => void load()}
          onMoveUndone={() => void load()}
          onClose={() => setMoveItem(null)}
        />
      ) : null}
      {addable ? (
        // Rendered last, so it floats over the content (D-131).
        <SectionAddFab
          morph={morph}
          icon={sectionFabIcon(type)}
          label={sectionAddLabel(type)}
          hint="Scrolls to the top and opens the add form."
          onPress={openNewFromFab}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: SPACING.md, padding: SPACING.base },
  readState: { minHeight: 88, alignItems: "center", justifyContent: "center" },
  readError: { gap: SPACING.sm, alignItems: "flex-start" },
});
