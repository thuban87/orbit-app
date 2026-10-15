// biome-ignore-all lint/a11y/useValidAriaRole: AppText / Button `role` is a typography / hierarchy role.
/**
 * KeyPeopleEditorScreen — the Key People section's own editor (Phase 38.10
 * D-75). Route `{ contactId, editId? }`.
 *
 * - Read: the ADR-168 gated read of the contact's live key people, hidden
 *   ones included; a failed read shows Retry, never an empty list.
 * - Hosts the shared `RelationshipEditor`, mounted after the read so its
 *   `initiallyEditingId` (read at mount) can open `editId`'s form once per
 *   navigation; an entry that is gone falls back to the list (D-107).
 * - Section Add FAB (D-131): the solid "Add Key Person" sits at the top,
 *   above the rows and the empty state, rendered by this screen (the editor
 *   runs with its Add placement at the top and renders no Add of its own); a
 *   new key person's form opens in its place. Scrolled out of view, it morphs
 *   into the bottom-left FAB (the people icon with a +), whose tap scrolls to
 *   the top and opens the add form.
 * - The empty state is text only: the top Add is the single D-68 action.
 * - Card edit mode (D-130): each row has a pencil at its top right; the
 *   pencil or a tap on the row opens its form in the row's place, with a red
 *   Delete at its top (no Move: Key People is not a D-84 section).
 * - Hidden rows are dimmed with "Show on Profile" by the editor; that button
 *   calls `onEdit` with `hidden: 0` (D-17). Pin and Unpin are the form's Pin
 *   switch, saved through `editRelationship`.
 * - Delete is immediate with an Undo snackbar naming the person, then a
 *   confirming snackbar (D-69; 38.9 D-39/D-46 via D-19). No restore prop.
 * - The note field centres above the keyboard (D-66, D-75). Back closes an
 *   open form first, asking only when it holds changes (38.9 D-13/D-14).
 * - Focused route: no shell-FAB clearance (fab-clearance-contract); the
 *   scroll content clears the section FAB instead (D-131).
 *
 * Snackbar wording is proposed (this plan only) for the plan-19 wording
 * review. Every colour resolves through `useTheme().colors.*` (CLAUDE.md).
 */
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import {
  type RelationshipDraft,
  type RelationshipDraftState,
  RelationshipEditor,
  type RelationshipEditorHandle,
} from "@/components/RelationshipEditor";
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
import { getExecutor, localDateTime } from "@/db/database";
import {
  addRelationship,
  deleteRelationshipNow,
  editRelationship,
  type RelationshipSnapshot,
  undoRelationshipDelete,
} from "@/db/relationships-dao";
import {
  listRelationshipsForContact,
  type RelationshipRow,
} from "@/db/relationships-read";
import { useContactHeader } from "@/hooks/use-contact-header";
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
import { openEditTarget } from "./section-editor-logic";

const LOG_SCOPE = "key-people-editor";
const TITLE = "Key People";
/** The page's Add wording (D-137 W19). */
const ADD_LABEL = "Add Key Person";

/** " for Ann", or "" while the person line has not loaded. */
function forName(name: string | null): string {
  return name === null || name.trim() === "" ? "" : ` for ${name}`;
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

/** Whether an edit only clears Hide from Profile (the row's Show on Profile). */
function isShowOnProfile(
  row: RelationshipRow | undefined,
  draft: RelationshipDraft,
): boolean {
  return (
    row !== undefined &&
    row.hidden === 1 &&
    draft.hidden === 0 &&
    draft.personName === row.person_name &&
    draft.relationType === row.relation_type &&
    draft.linkedContactId === row.linked_contact_id &&
    draft.note === row.note &&
    draft.pinned === (row.pinned === 1)
  );
}

export function KeyPeopleEditorScreen({
  route,
}: RootStackScreenProps<"KeyPeopleEditor">) {
  const { colors } = useTheme();
  const { contactId, editId } = route.params;
  // D-45: the person line under the fixed title.
  const person = useContactHeader(contactId);
  // Snackbars fired after an await read the latest name.
  const nameRef = useRef<string | null>(null);
  nameRef.current = person?.name ?? null;

  const [phase, setPhase] = useState<ReadPhase<RelationshipRow[]>>(readLoading);
  // Only the latest load may publish; blur invalidates outstanding reads.
  const readAuthority = useMemo(() => createLatestRequestAuthority(), []);
  // `editId` is resolved once, at the first successful read (D-107).
  const editConsumedRef = useRef(false);
  const [initialEditId, setInitialEditId] = useState<number | undefined>(
    undefined,
  );

  // Single-flight for add and edit; `saving` holds Back and the editor.
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  // In-screen sub-editor guard (38.9 D-14 via D-19).
  const editorRef = useRef<RelationshipEditorHandle>(null);
  const [draftState, setDraftState] = useState<RelationshipDraftState>({
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

  // D-66 on a D-75 editor: the note field centres above the keyboard; the
  // same ScrollView pair scrolls an `editId` form into view (D-130).
  const { scrollRef, contentRef, reveal } = useFirstErrorReveal();
  const { centering, bottomSpacer } = useKeyboardCentering({
    scrollRef,
    contentRef,
  });
  // D-130: the form opens in place of its row. A tap opens it where the row
  // was, on screen; an `editId` may name a row further down, so its form is
  // scrolled into view once.
  const formRef = useRef<View>(null);
  useEffect(() => {
    if (typeof initialEditId === "number") reveal(formRef);
  }, [initialEditId, reveal]);

  /** NEVER rejects: a failure lands in the error phase (D-04). */
  const load = useCallback(async (): Promise<void> => {
    await runGatedRead({
      gate: readAuthority,
      read: () => listRelationshipsForContact(getExecutor(), contactId),
      publish: setPhase,
      onLoaded: (rows) => {
        // Later loads clear it, as SectionEditor does: a Retry after a failed
        // re-read remounts the editor, which must not reopen that row's form
        // unasked (review IN-02).
        if (editConsumedRef.current) {
          setInitialEditId(undefined);
          return;
        }
        editConsumedRef.current = true;
        setInitialEditId(openEditTarget(editId, rows));
      },
      onError: (error) =>
        Logger.error(LOG_SCOPE, "failed to load Key People", error),
    });
  }, [contactId, editId, readAuthority]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => readAuthority.invalidate();
    }, [load, readAuthority]),
  );

  const rows = phase.phase === "loaded" ? phase.data : [];

  /** One add or edit, single-flight; the editor closes its form on true. */
  const write = async (
    run: () => Promise<unknown>,
    success: string,
  ): Promise<boolean> => {
    if (!beginInFlight(savingRef)) return false;
    setSaving(true);
    try {
      await run();
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to save a key person", error);
      errorNotice("Couldn't save. Please try again.");
      return false;
    } finally {
      setSaving(false);
      endInFlight(savingRef);
      settleHold();
    }
    void load();
    showSnackbar({ kind: "success", label: success });
    return true;
  };

  const add = (draft: RelationshipDraft): Promise<boolean> => {
    const now = localDateTime();
    return write(
      () =>
        addRelationship(getExecutor(), {
          contactId,
          personName: draft.personName,
          relationType: draft.relationType,
          linkedContactId: draft.linkedContactId,
          note: draft.note,
          pinned: draft.pinned,
          hidden: draft.hidden,
          createdAt: now,
          now,
        }),
      `Added key person${forName(nameRef.current)}`,
    );
  };

  // Save, Pin / Unpin (the form's switch) and the row's Show on Profile all
  // go through `editRelationship` (D-17, D-21).
  const edit = (id: number, draft: RelationshipDraft): Promise<boolean> => {
    const row = rows.find((candidate) => candidate.id === id);
    return write(
      () =>
        editRelationship(getExecutor(), {
          id,
          contactId,
          personName: draft.personName,
          relationType: draft.relationType,
          linkedContactId: draft.linkedContactId,
          note: draft.note,
          pinned: draft.pinned,
          hidden: draft.hidden,
          now: localDateTime(),
        }),
      isShowOnProfile(row, draft)
        ? `Shown on Profile${forName(nameRef.current)}`
        : `Saved key person${forName(nameRef.current)}`,
    );
  };

  const undoDelete = (snapshot: RelationshipSnapshot) => {
    void (async () => {
      try {
        await undoRelationshipDelete(getExecutor(), snapshot, localDateTime());
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to undo a delete", error);
        errorNotice("Couldn't undo the delete.");
        return;
      }
      void load();
      showSnackbar({
        kind: "success",
        label: `Key person restored${forName(nameRef.current)}`,
      });
    })();
  };

  // D-69: the delete happens at once (a hard delete with a tombstone) and
  // Undo puts it back, relinked by the linked contact's uid.
  // `false` tells the editor the delete was dropped, so its form stays open
  // (the MemoryEditor contract; 38.10-18 moved Delete into the form).
  const remove = (id: number): boolean => {
    if (savingRef.current) return false;
    void (async () => {
      let snapshot: RelationshipSnapshot;
      try {
        snapshot = await deleteRelationshipNow(getExecutor(), {
          id,
          contactId,
          now: localDateTime(),
        });
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to delete a key person", error);
        errorNotice("Couldn't delete. Please try again.");
        return;
      }
      void load();
      // D-132: a delete reports in the warning style.
      showSnackbar({
        kind: "warning",
        label: `Deleted key person${forName(nameRef.current)}`,
        action: {
          label: "Undo",
          accessibilityLabel: "Undo deleting the key person",
          onPress: () => undoDelete(snapshot),
        },
      });
    })();
    return true;
  };

  // D-131: the top Add morphs into the bottom-left FAB once it scrolls off.
  const focusedRoute = isFocusedWorkflow(route.name);
  const morph = useSectionAddMorph({
    loaded: phase.phase === "loaded",
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
      {/* While an add or edit runs the guard holds Back (D-26). */}
      <ShellAppBar
        variant="child"
        title={TITLE}
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
          // The last row scrolls fully above the section FAB.
          { paddingBottom: fabClearance },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <KeyboardCenteringProvider value={centering}>
          {phase.phase === "loading" ? (
            <View
              testID="key-people-editor-loading"
              accessibilityLabel={`Loading ${TITLE}`}
              style={styles.readState}
            >
              <ActivityIndicator color={colors.accentText} />
            </View>
          ) : phase.phase === "error" ? (
            <View
              testID="key-people-editor-read-error"
              style={styles.readError}
            >
              <AppText role="body" style={{ color: colors.textPrimary }}>
                {`Couldn't load ${TITLE}`}
              </AppText>
              <Button
                role="tertiary"
                label="Retry"
                accessibilityLabel={`Retry loading ${TITLE}`}
                onPress={() => void load()}
              />
            </View>
          ) : (
            <>
              {draftState.adding ? null : (
                // D-131: the solid Add at the top (D-130), the one Add on the
                // page; a new key person's form opens in its place. Held
                // while a form is open or a save runs.
                <View onLayout={morph.onBarLayout}>
                  <Button
                    testID="key-people-editor-add"
                    role="primary"
                    label={ADD_LABEL}
                    disabled={saving || draftState.open}
                    onPress={() => editorRef.current?.openNew()}
                  />
                </View>
              )}
              {rows.length === 0 && !draftState.open ? (
                // D-68: text only; the top Add is the one action. D-145: it
                // hides while the add form is open.
                <EmptyState
                  testID="key-people-editor-empty"
                  icon="list"
                  heading="No Key People yet"
                  body="Use Add Key Person above to add the first one."
                />
              ) : null}
              <RelationshipEditor
                ref={editorRef}
                contactId={contactId}
                items={rows}
                initiallyEditingId={initialEditId}
                cardEditMode
                formRef={formRef}
                addPlacement="top"
                onAdd={add}
                onEdit={edit}
                onDelete={remove}
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
      {/* Rendered last, so it floats over the content (D-131). */}
      <SectionAddFab
        morph={morph}
        icon={sectionFabIcon("key_people")}
        label={ADD_LABEL}
        hint="Scrolls to the top and opens the add form."
        onPress={openNewFromFab}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: SPACING.md, padding: SPACING.base },
  readState: { minHeight: 88, alignItems: "center", justifyContent: "center" },
  readError: { gap: SPACING.sm, alignItems: "flex-start" },
});
