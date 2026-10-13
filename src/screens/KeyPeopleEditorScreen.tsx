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
 * - The empty state is text only: the editor's own "Add key person" is the
 *   single D-68 action.
 * - Hidden rows are dimmed with "Show on Profile" by the editor; that button
 *   calls `onEdit` with `hidden: 0` (D-17). Pin and Unpin are the form's Pin
 *   switch, saved through `editRelationship`.
 * - Delete is immediate with an Undo snackbar naming the person, then a
 *   confirming snackbar (D-69; 38.9 D-39/D-46 via D-19). No restore prop.
 * - The note field centres above the keyboard (D-66, D-75). Back closes an
 *   open form first, asking only when it holds changes (38.9 D-13/D-14).
 * - Focused route: no bottom clearance (fab-clearance-contract).
 *
 * Snackbar wording is proposed (this plan only) for the plan-19 wording
 * review. Every colour resolves through `useTheme().colors.*` (CLAUDE.md).
 */
import { useFocusEffect } from "@react-navigation/native";
import { type RefObject, useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import {
  type RelationshipDraft,
  type RelationshipDraftState,
  RelationshipEditor,
  type RelationshipEditorHandle,
} from "@/components/RelationshipEditor";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  AppText,
  Button,
  EmptyState,
  KeyboardCenteringProvider,
  useKeyboardCentering,
} from "@/components/ui";
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

  // D-66 on a D-75 editor: the note field centres above the keyboard.
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
      read: () => listRelationshipsForContact(getExecutor(), contactId),
      publish: setPhase,
      onLoaded: (rows) => {
        if (editConsumedRef.current) return;
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
  const remove = (id: number) => {
    if (savingRef.current) return;
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
      showSnackbar({
        kind: "success",
        label: `Deleted key person${forName(nameRef.current)}`,
        action: {
          label: "Undo",
          accessibilityLabel: "Undo deleting the key person",
          onPress: () => undoDelete(snapshot),
        },
      });
    })();
  };

  return (
    <View style={styles.root}>
      {/* While an add or edit runs the guard holds Back (D-26). */}
      <ShellAppBar
        variant="child"
        title={TITLE}
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
              {rows.length === 0 ? (
                // D-68: text only; the editor's own "Add key person" acts.
                <EmptyState
                  testID="key-people-editor-empty"
                  icon="list"
                  heading="No key people yet"
                  body="Use Add key person below to add the first one."
                />
              ) : null}
              <RelationshipEditor
                ref={editorRef}
                contactId={contactId}
                items={rows}
                initiallyEditingId={initialEditId}
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
