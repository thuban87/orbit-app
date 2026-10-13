// biome-ignore-all lint/a11y/useValidAriaRole: `role` is Orbit Button's visual-role domain prop, not ARIA.
/**
 * CaptureScreen (CAP-01/02/03/04; Phase 38.10 D-04, D-12, D-74, D-77, D-79,
 * D-83, D-89, D-100, D-120) — the share-sheet contact picker. Whatever the user
 * shared (a link, a text selection) is saved the moment a person is picked, as
 * one Thought of Them memory per person (D-04, D-79). The confirmation card
 * then lets the user move it with the section chips, undo it, add a note or
 * allow AI, and closes back to the source app (D-74, D-77).
 *
 * =============================================================================
 * LOAD-BEARING INVARIANTS (this is the share→save→return surface):
 *   - The share is written BEFORE any prompt or card interaction (D-12;
 *     T-10-04): `resetOnBackground` kills an unwritten payload.
 *   - SHARE SEQUENCE (convergence c3, c4, c10, c11, c12): a live share intent
 *     with a new identity advances `seq`, during render (idempotent for the
 *     same intent). The library's reset to its empty default object on
 *     background never advances it, so the card, its rows and its Undo
 *     survive a background trip. Each `seq` snapshots its payload; every
 *     write, the note base, the preview strip and the "Nothing to save" gate
 *     read that snapshot, never the live intent. The same render resets every
 *     screen-owned share state (search, multi-select, note mirror, the
 *     New-contact sheet, the mounted card). `seq` keys the card.
 *   - EVERY async share handler (pick, multi-select Done, inline create and
 *     every card action) runs through `runShareWrite`: ONE `isCommittingRef`
 *     latch (set before the first await, cleared in finally), the `seq`
 *     captured at the start, and UI published only for an unchanged `seq`.
 *     The database write stands either way.
 *   - The list is inert while the card is up or a pick write is pending
 *     (`shareListLocked`, WR-01); each pick handler also returns early.
 *   - Capture writes ONLY share rows. It never touches `last_contact` or writes
 *     an interaction (DATA-04; capture is not a touchpoint). Inline create is
 *     name-only and never-contacted (D-83).
 *   - Undo returns to the unlocked list with the same `seq` and snapshot
 *     (D-120); it never calls `finishActivity()`. A share that created its
 *     contact is undone through `undoCreateContactAndShare` (D-100, D-110).
 *   - The card's own timer is the only auto-close (no screen-level finish
 *     timer). It finishes only for an unchanged `seq` while the app is active.
 *   - Back (38.9 D-33 via `resolveCaptureBack`) closes the innermost surface
 *     first; a typed name or note shows "Discard changes?" first. The Close
 *     pill always cancels (`resetShareIntent` → `finishActivity`).
 *   - Capture keeps its own chrome (no shell app bar), never uses the native
 *     alert and opens no RN Modal. Every colour resolves through
 *     `useTheme().colors.*` (check:colors).
 * =============================================================================
 */
import { useFocusEffect } from "@react-navigation/native";
import { useShareIntentContext } from "expo-share-intent";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  Keyboard,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ContactPickerList } from "@/components/ContactPicker";
import {
  type ShareCardActions,
  ShareConfirmationCard,
  type ShareConfirmationCardHandle,
} from "@/components/ShareConfirmationCard";
import { Button } from "@/components/ui/Button";
import { sheetKeyboardLayout } from "@/components/ui/sheet-contract";
import { NEW_CONTACT_DEFAULT_INTERVAL_DAYS } from "@/constants/new-contact-defaults";
import {
  applyShareNote,
  createContactAndShare,
  moveShareRowsWithAi,
  type ShareRowRef,
  setShareRowsAllowAi,
  shareToContacts,
  undoCreateContactAndShare,
  undoShareRows,
} from "@/db/capture-dao";
import {
  type CapturePickRow,
  listCapturePickContacts,
} from "@/db/capture-read";
import { getExecutor, localDateTime } from "@/db/database";
import type { PurgeExtensions } from "@/db/purge-dao";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import {
  advanceShareSequence,
  buildAutoCloseCallback,
  captureViewPayload,
  isLiveShareIntent,
  runShareWrite,
  type ShareIntentLike,
  type ShareSequence,
  type ShareSnapshot,
  type ShareUndoResult,
  shareListLocked,
  shareScreenAfterUndo,
  takeShareSnapshot,
  undoResultSnackbar,
} from "@/logic/share-card-logic";
import { confirmDiscard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { resolveCaptureBack } from "@/screens/capture-back-logic";
import { buildNotificationPurgeCleanup } from "@/services/notifications/purge-notification-cleanup";
import { deleteImportStaging } from "@/services/photos/photo-storage";
import { buildPhotoPurgeCleanup } from "@/services/photos/purge-photo-cleanup";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import { finishActivity } from "../../modules/orbit-share-finish";

const LOG_SCOPE = "capture";

/** Space between a bottom surface and the keyboard or system bar (I-02, I-16). */
const BOTTOM_SURFACE_MARGIN = 16;

const SAVE_FAILED = {
  kind: "error",
  label: "Couldn't save. Please try again.",
} as const;
const UNDO_FAILED = {
  kind: "error",
  label: "Couldn't undo. Please try again.",
} as const;

/** The share sequence and the payload snapshot it writes from. */
interface SequenceState {
  sequence: ShareSequence;
  snapshot: ShareSnapshot | null;
}

/** The mounted confirmation card: the written rows and who they went to. */
interface MountedCard {
  rows: ShareRowRef[];
  createdContactId: number | null;
  names: string[];
}

/** Advance the share sequence from `prev`; snapshot only when it moves. */
function nextSequenceState(
  prev: SequenceState,
  intent: unknown,
): SequenceState {
  const sequence = advanceShareSequence(
    prev.sequence,
    intent,
    isLiveShareIntent(intent),
  );
  if (sequence === prev.sequence) return prev;
  return {
    sequence,
    snapshot: takeShareSnapshot(sequence.seq, intent as ShareIntentLike),
  };
}

const NO_SEQUENCE: SequenceState = {
  sequence: { intent: null, seq: 0 },
  snapshot: null,
};

/**
 * Post-commit cleanup for a D-100 purge, composed as ArchivedContactsScreen
 * composes it: import staging, then photos, then notifications, each in its
 * own try/catch so one failure cannot skip the others (checker cycle 3 W-4).
 */
function buildShareUndoPurgeCleanup(exec: SqlExecutor): PurgeExtensions {
  const photoCleanup = buildPhotoPurgeCleanup(exec);
  const notifCleanup = buildNotificationPurgeCleanup();
  return async (purgedId, { importStagingPaths }) => {
    try {
      for (const path of importStagingPaths) deleteImportStaging(path);
    } catch (err) {
      Logger.error(LOG_SCOPE, "post-commit import staging cleanup failed", err);
    }
    try {
      await photoCleanup(purgedId);
    } catch (err) {
      Logger.error(LOG_SCOPE, "post-commit photo cleanup failed", err);
    }
    try {
      await notifCleanup(purgedId);
    } catch (err) {
      Logger.error(LOG_SCOPE, "post-commit notification cleanup failed", err);
    }
  };
}

/**
 * The bare host of a canonical url, for the preview strip's second line. Never
 * throws (a malformed url falls back to itself); pure display only — the url is
 * never opened here.
 */
function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

export function CaptureScreen(_props: RootStackScreenProps<"Capture">) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { shareIntent, resetShareIntent } = useShareIntentContext();

  const [rows, setRows] = useState<CapturePickRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  // The mounted confirmation card (null = the list is showing).
  const [card, setCard] = useState<MountedCard | null>(null);
  // A pick / multi Done / inline create write is in flight.
  const [committing, setCommitting] = useState(false);

  // Multi-select (CAP-02, I-09): the screen owns the mode flag for Back
  // (38.9 D-33); the embedded list owns the selection and clears it when the
  // flag turns off. "Select several" or a long-press enters it.
  const [multiSelect, setMultiSelect] = useState(false);

  // The card's note editor, mirrored for Back (38.9 D-33).
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  // Inline name-only create (CAP-04, D-83).
  const [inlineOpen, setInlineOpen] = useState(false);
  const [inlineName, setInlineName] = useState("");

  // The always-visible search (D-80), owned here so Back can clear it first
  // (38.9 D-33: "search open" means "search has text").
  const [searchText, setSearchText] = useState("");

  // ---- Share sequence (render-time; c3, c4, c11, c12) -------------------------
  const [sequenceState, setSequenceState] = useState<SequenceState>(() =>
    nextSequenceState(NO_SEQUENCE, shareIntent),
  );
  let current = sequenceState;
  const advanced = nextSequenceState(sequenceState, shareIntent);
  if (advanced !== sequenceState) {
    // React's "adjust state while rendering": the render that first sees a new
    // live share already uses the new seq and snapshot, and every screen-owned
    // share state starts fresh in the same step (never in an effect).
    current = advanced;
    setSequenceState(advanced);
    setCard(null);
    setMultiSelect(false);
    setNoteOpen(false);
    setNoteText("");
    setInlineOpen(false);
    setInlineName("");
    setSearchText("");
  }
  const seq = current.sequence.seq;
  const snapshot = current.snapshot;
  // The current seq for async handlers' after-await check. Written during
  // render on purpose: it is idempotent and must already hold the new seq when
  // a write that started under the old one resolves.
  const seqRef = useRef(seq);
  seqRef.current = seq;
  // The mounted card as of this render, for the Undo publish.
  const cardStateRef = useRef(card);
  cardStateRef.current = card;

  // ONE in-flight latch shared by EVERY write path (picks and card actions).
  const isCommittingRef = useRef(false);
  const cardRef = useRef<ShareConfirmationCardHandle>(null);

  // ---- Keyboard and system bars (I-02, I-16) ---------------------------------
  const [keyboardHeight, setKeyboardHeight] = useState(() =>
    Keyboard.isVisible() ? (Keyboard.metrics()?.height ?? 0) : 0,
  );
  const [frameHeight, setFrameHeight] = useState(0);
  const restingFrameHeight = useRef(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (event) =>
      setKeyboardHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const onRootLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    restingFrameHeight.current = Math.max(restingFrameHeight.current, height);
    setFrameHeight(height);
  }, []);
  const { lift } = sheetKeyboardLayout({
    variant: "compact",
    frameHeight,
    restingFrameHeight: restingFrameHeight.current,
    keyboardHeight,
    topClearance: insets.top,
  });
  const bottomOffset =
    BOTTOM_SURFACE_MARGIN + (lift > 0 ? lift : insets.bottom);

  // Cancel the share and return to the source app WITHOUT writing. The Close
  // pill, Done and Back's cancel all use it.
  const cancelCapture = useCallback(() => {
    resetShareIntent();
    finishActivity();
  }, [resetShareIntent]);

  // Leave multi-select WITHOUT writing; the list drops its selection.
  const exitMultiSelect = useCallback(() => {
    setMultiSelect(false);
  }, []);

  // Load the picker (favourites → share recency → rest, includes never-contacted,
  // excludes archived; D-30, D-12). A superseded request is dropped. Local
  // SQLite; no network on the read.
  const rowsRequest = useRef(0);
  const loadRows = useCallback(() => {
    const request = ++rowsRequest.current;
    setRowsLoading(true);
    void listCapturePickContacts(getExecutor())
      .then((result) => {
        if (rowsRequest.current === request) setRows(result);
      })
      .catch((err) => {
        Logger.error(LOG_SCOPE, "failed to load capture contacts", err);
      })
      .finally(() => {
        if (rowsRequest.current === request) setRowsLoading(false);
      });
  }, []);
  useFocusEffect(
    useCallback(() => {
      loadRows();
      return () => {
        rowsRequest.current += 1;
      };
    }, [loadRows]),
  );

  // Close the inline New-contact surface and drop its typed name.
  const closeInlineCreate = useCallback(() => {
    setInlineOpen(false);
    setInlineName("");
  }, []);

  // Clear the search text and restore the full list.
  const closeSearch = useCallback(() => {
    setSearchText("");
  }, []);

  // Focused hardware/system-Back handler (A6/C1; 38.9 D-33): Back first closes
  // the innermost open surface (New-contact, then search, then multi-select
  // WITHOUT writing), and a typed name or note shows the shared "Discard
  // changes?" prompt (D-13, D-14). The card's auto-close is held while the
  // note prompt shows (D-77). Discarding a note cancels: the rows are already
  // written, only the note is lost. A second Back while the prompt is pending
  // gets false from the single-flight confirmDiscard() (review C2-L3).
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        const outcome = resolveCaptureBack({
          inlineOpen,
          inlineName,
          searchOpen: searchText !== "",
          multiSelect,
          noteOpen,
          noteText,
        });
        switch (outcome) {
          case "close-inline":
            closeInlineCreate();
            break;
          case "prompt-discard-inline":
            void confirmDiscard().then((discard) => {
              if (discard) closeInlineCreate();
            });
            break;
          case "close-search":
            closeSearch();
            break;
          case "exit-multi-select":
            exitMultiSelect();
            break;
          case "prompt-discard-note":
            cardRef.current?.discardOpened();
            void confirmDiscard().then((discard) => {
              cardRef.current?.discardClosed();
              if (discard) cancelCapture();
            });
            break;
          case "cancel-capture":
            cancelCapture();
            break;
        }
        return true;
      });
      return () => sub.remove();
    }, [
      inlineOpen,
      inlineName,
      searchText,
      multiSelect,
      noteOpen,
      noteText,
      closeInlineCreate,
      closeSearch,
      exitMultiSelect,
      cancelCapture,
    ]),
  );

  const listLocked = shareListLocked({
    cardMounted: card !== null,
    writePending: committing,
  });

  /** Write a share to picked people, then mount the card (D-04, D-77, D-79). */
  const shareTo = useCallback(
    (people: readonly CapturePickRow[]) => {
      if (snapshot === null || people.length === 0) {
        return Promise.resolve({ status: "busy" } as const);
      }
      const stamp = localDateTime();
      return runShareWrite({
        latch: isCommittingRef,
        startSeq: seqRef.current,
        currentSeq: () => seqRef.current,
        onBusyChange: setCommitting,
        write: () =>
          shareToContacts(
            getExecutor(),
            people.map((person) => person.id),
            snapshot.payload,
            stamp,
          ),
        onSuccess: (written) => {
          setCard({
            rows: written,
            createdContactId: null,
            names: people.map((person) => person.name),
          });
          setMultiSelect(false);
        },
        onError: (err) => {
          Logger.error(LOG_SCOPE, "failed to save share", err);
          showSnackbar(SAVE_FAILED);
        },
      });
    },
    [snapshot],
  );

  // Single-tap commit — save the share immediately, then show the card.
  const onPick = useCallback(
    async (row: CapturePickRow) => {
      // WR-01: the defensive twin of the list's disable.
      if (
        shareListLocked({
          cardMounted: card !== null,
          writePending: isCommittingRef.current,
        })
      ) {
        return;
      }
      await shareTo([row]);
    },
    [card, shareTo],
  );

  // Multi-select Done — N independent share rows in ONE transaction (CAP-02,
  // D-79). The list keeps the selection when this throws, so a failed share
  // can be retried: report it (snackbar), then rethrow (convergence c11).
  const onConfirmMulti = useCallback(
    async (contactIds: number[]) => {
      if (contactIds.length === 0) return;
      if (
        shareListLocked({
          cardMounted: card !== null,
          writePending: isCommittingRef.current,
        })
      ) {
        throw new Error("capture: a share is already being saved");
      }
      const byId = new Map(rows.map((row) => [row.id, row]));
      const people = contactIds
        .map((id) => byId.get(id))
        .filter((row): row is CapturePickRow => row !== undefined);
      const outcome = await shareTo(people);
      if (outcome.status === "failed") throw outcome.error;
      if (outcome.status === "busy") {
        throw new Error("capture: a share is already being saved");
      }
    },
    [card, rows, shareTo],
  );

  // "New contact" → the name-only create sheet, starting with the search
  // text (D-82, I-07).
  const onOpenInlineCreate = useCallback((typed: string) => {
    setInlineName(typed.trim());
    setInlineOpen(true);
  }, []);

  // Inline Create & save — a NAME-ONLY, never-contacted contact (monthly
  // default, D-83) and its share in ONE transaction (D-28, NEW-3). A7: a blank
  // name never reaches createContactAndShare.
  const onInlineSubmit = useCallback(async () => {
    const trimmedName = inlineName.trim();
    if (trimmedName.length === 0 || snapshot === null) return;
    if (
      shareListLocked({
        cardMounted: card !== null,
        writePending: isCommittingRef.current,
      })
    ) {
      return;
    }
    // ONE stamp for the contact and its share (A10); both get it as created_at.
    const stamp = localDateTime();
    await runShareWrite({
      latch: isCommittingRef,
      startSeq: seqRef.current,
      currentSeq: () => seqRef.current,
      onBusyChange: setCommitting,
      // NAME-ONLY: no first interaction, so last_contact stays NULL
      // (never-contacted, CAP-04 — sharing a link is not "contacting").
      write: () =>
        createContactAndShare(
          getExecutor(),
          {
            uid: newUid(),
            name: trimmedName,
            intervalDays: NEW_CONTACT_DEFAULT_INTERVAL_DAYS,
            // Explicit normalized empty set: Capture remains name-only and Bound by
            // the v11 DDL default without reviving retired scalar phone/email inputs.
            methodDrafts: [],
          },
          snapshot.payload,
          stamp,
        ),
      onSuccess: ({ contactId, rows: written }) => {
        setCard({
          rows: written,
          createdContactId: contactId,
          names: [trimmedName],
        });
        setInlineOpen(false);
        setInlineName("");
        setMultiSelect(false);
      },
      onError: (err) => {
        Logger.error(LOG_SCOPE, "failed inline-create share", err);
        showSnackbar(SAVE_FAILED);
      },
    });
  }, [inlineName, snapshot, card]);

  // ---- Card actions (every one seq-guarded and single-flight) ----------------
  const cardActions = useMemo<ShareCardActions>(() => {
    const write = <T,>(
      run: () => Promise<T>,
      onSuccess?: (value: T) => void,
      failure: { kind: "error"; label: string } = SAVE_FAILED,
    ) =>
      runShareWrite({
        latch: isCommittingRef,
        startSeq: seqRef.current,
        currentSeq: () => seqRef.current,
        write: run,
        onSuccess,
        onError: (err) => {
          Logger.error(LOG_SCOPE, "share card write failed", err);
          showSnackbar(failure);
        },
      });
    return {
      move: (written, section) =>
        write(() =>
          moveShareRowsWithAi(getExecutor(), written, section, localDateTime()),
        ),
      setAi: (written, allow) =>
        write(async () => {
          await setShareRowsAllowAi(
            getExecutor(),
            written,
            allow,
            localDateTime(),
          );
          return allow;
        }),
      saveNote: (written, note) =>
        snapshot === null
          ? Promise.resolve({ status: "busy" } as const)
          : write(() =>
              applyShareNote(
                getExecutor(),
                written,
                note,
                snapshot.shareText,
                localDateTime(),
              ),
            ),
      undo: (target) =>
        write(
          async (): Promise<ShareUndoResult> => {
            const exec = getExecutor();
            const stamp = localDateTime();
            if (target.kind === "create-and-share") {
              const { contactRemoved } = await undoCreateContactAndShare(
                exec,
                target.contactId,
                target.rows,
                stamp,
                { onPurgeExtensions: buildShareUndoPurgeCleanup(exec) },
              );
              return { kind: "create-and-share", contactRemoved };
            }
            await undoShareRows(exec, target.rows, stamp);
            return { kind: "share" };
          },
          (result) => {
            // D-120: back to the unlocked list with the same shared item.
            const mounted = cardStateRef.current;
            const after = shareScreenAfterUndo({
              seq: seqRef.current,
              snapshot,
              card: mounted,
              noteOpen: false,
              noteText: "",
              searchText: "",
            });
            setCard(after.card);
            setNoteOpen(after.noteOpen);
            setNoteText(after.noteText);
            showSnackbar(undoResultSnackbar(result, mounted?.names[0] ?? ""));
            loadRows();
          },
          UNDO_FAILED,
        ),
    };
  }, [snapshot, loadRows]);

  const onAutoClose = useMemo(
    () =>
      buildAutoCloseCallback({
        armedSeq: seq,
        currentSeq: () => seqRef.current,
        appState: () => AppState.currentState,
        finish: cancelCapture,
      }),
    [seq, cancelCapture],
  );

  const onNoteStateChange = useCallback(
    (note: { editing: boolean; text: string }) => {
      setNoteOpen(note.editing);
      setNoteText(note.text);
    },
    [],
  );

  // ---- Render --------------------------------------------------------------

  const closePill = (
    <Pressable
      testID="capture-close"
      accessibilityRole="button"
      accessibilityLabel="Cancel"
      onPress={cancelCapture}
      style={[styles.closePill, { borderColor: colors.border }]}
    >
      <Text style={[styles.closeLabel, { color: colors.textSecondary }]}>
        Close
      </Text>
    </Pressable>
  );

  // Empty-payload defensive branch: no snapshot yet, or a share that resolves
  // to nothing (c10). Reads the snapshot, so a background reset never lands here.
  const viewPayload = captureViewPayload(snapshot);
  if (viewPayload === null) {
    return (
      <View testID="capture-picker-root" style={styles.errorRoot}>
        <Text
          testID="capture-error-state"
          style={[styles.errorText, { color: colors.danger }]}
        >
          Nothing to save
        </Text>
        {closePill}
      </View>
    );
  }

  return (
    <View
      testID="capture-picker-root"
      style={styles.root}
      onLayout={onRootLayout}
    >
      <View style={styles.headerBlock}>
        <View style={styles.headerRow}>
          {closePill}
          <Text
            testID="capture-title"
            accessibilityRole="header"
            style={[styles.title, { color: colors.textPrimary }]}
          >
            Save to…
          </Text>
        </View>

        {/* Payload preview strip — WHAT is being filed, before WHO (the snapshot). */}
        <View
          testID="capture-payload-preview"
          style={[
            styles.preview,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            numberOfLines={1}
            style={[styles.previewText, { color: colors.textPrimary }]}
          >
            {viewPayload.displayText ?? viewPayload.url}
          </Text>
          {viewPayload.url ? (
            <Text
              numberOfLines={1}
              style={[styles.previewHost, { color: colors.textSecondary }]}
            >
              {hostOf(viewPayload.url)}
            </Text>
          ) : null}
        </View>
      </View>

      {/* The app's list picker with always-visible search (D-80): favourites,
          then share recency, never archived, never-contacted included (D-30,
          D-12). Keyed on the share sequence so a new share starts fresh (I-14).
          Inert while the card is up or a pick is pending (WR-01). */}
      <View
        style={[
          styles.listArea,
          { paddingBottom: lift > 0 ? lift : insets.bottom },
        ]}
      >
        <ContactPickerList
          key={seq}
          style={styles.list}
          rows={rows}
          loading={rowsLoading && rows.length === 0}
          keepSourceOrder
          allowArchivedSearch={false}
          tapToSelect
          multiSelectEntry
          searchResetKey={seq}
          searchText={searchText}
          onSearchTextChange={setSearchText}
          multiSelect={multiSelect}
          onMultiSelectChange={setMultiSelect}
          disabled={listLocked}
          onPick={(row) => {
            const picked = rows.find((r) => r.id === row.id);
            if (picked) void onPick(picked);
          }}
          onConfirm={onConfirmMulti}
          confirmErrorLabel="Couldn't save. Please try again."
          leadingAction={{
            label: "New contact",
            testID: "capture-new-contact",
            onPress: onOpenInlineCreate,
          }}
        />
      </View>

      {inlineOpen ? (
        <View
          testID="capture-inline-create"
          style={[
            styles.inlineSurface,
            {
              bottom: bottomOffset,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <TextInput
            testID="capture-inline-name-input"
            autoFocus
            value={inlineName}
            onChangeText={setInlineName}
            placeholder="Name"
            placeholderTextColor={colors.textPlaceholder}
            returnKeyType="done"
            onSubmitEditing={() => void onInlineSubmit()}
            style={[
              styles.inlineInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
          {/* NEW-3: a visible Cancel; Back still prompts for a typed name. */}
          <View style={styles.inlineActions}>
            <Button
              testID="capture-inline-cancel"
              role="tertiary"
              label="Cancel"
              accessibilityLabel="Cancel new contact"
              disabled={committing}
              onPress={closeInlineCreate}
            />
            <Button
              testID="capture-inline-submit"
              role="primary"
              label="Create & save"
              accessibilityLabel="Create and save"
              disabled={inlineName.trim().length === 0 || committing}
              onPress={() => void onInlineSubmit()}
            />
          </View>
        </View>
      ) : null}

      {/* The confirmation card (D-77): the share is already saved. Keyed on the
          share sequence, so a new share remounts it fresh (c3). */}
      {card !== null ? (
        <ShareConfirmationCard
          key={seq}
          ref={cardRef}
          rows={card.rows}
          createdContactId={card.createdContactId}
          contactNames={card.names}
          actions={cardActions}
          onAutoClose={onAutoClose}
          onDone={cancelCapture}
          onNoteStateChange={onNoteStateChange}
          bottomOffset={bottomOffset}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBlock: {
    gap: 16,
    padding: 16,
    paddingBottom: 12,
  },
  listArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  list: {
    flex: 1,
  },
  inlineActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  closePill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  closeLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
  },
  preview: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  previewText: {
    fontSize: 15,
    fontWeight: "400",
  },
  previewHost: {
    fontSize: 13,
    fontWeight: "600",
  },
  errorRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 16,
  },
  errorText: {
    fontSize: 24,
    fontWeight: "700",
  },
  inlineSurface: {
    position: "absolute",
    left: 16,
    right: 16,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  inlineInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "400",
    minHeight: 44,
  },
});
