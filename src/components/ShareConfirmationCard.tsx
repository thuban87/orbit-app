// biome-ignore-all lint/a11y/useValidAriaRole: `role` is Orbit Button's visual-role domain prop, not ARIA.
/**
 * ShareConfirmationCard: the interactive card a share shows once it is saved
 * (Phase 38.10 D-77, D-78, D-79, D-83, D-87, D-99, D-100, D-120; I-04 via D-07).
 *
 * The share is already written to Thought of Them when this mounts (D-04,
 * D-12). The card lets the user move it with the section chips (every copy
 * together, D-79), undo it, add a note, or allow AI (off by default, D-78;
 * disabled and off while Last Talked About is selected, D-99). It closes back
 * to the source app after `SHARE_CARD_AUTO_CLOSE_MS` unless something holds
 * it: a touch on the card, a pending write, the note editor, a discard prompt,
 * or Orbit not being the active app (D-77; CLAUDE.md: pause on background).
 *
 * =============================================================================
 * LOAD-BEARING INVARIANTS:
 *   - All logic is the pure `share-card-logic` reducer; the state is mirrored
 *     in a ref so a second tap in the same frame sees the pending write
 *     (single-flight, convergence c1 F-U4).
 *   - A move adopts the refs `moveShareRowsWithAi` returned before any later
 *     action reads them; a failed write keeps the committed refs, section and
 *     switch. The switch shows the stored permission (c2 G-U1).
 *   - The screen keys this card on its share sequence, so a new share remounts
 *     it with a fresh reducer and its timer is cleared on unmount (c3, c4).
 *   - The timer is a plain `setTimeout` (never per-frame React state). The
 *     callback the screen passes finishes only for an unchanged sequence while
 *     the app is active (c4, c5).
 *   - No RN Modal, no Alert, only `OrbitSwitch` for the switch. Every colour
 *     resolves through `useTheme()` (check:colors).
 *   - D-147: the card never rises above the safe-area top. The screen passes
 *     `maxHeight` (`shareCardMaxHeight`); past it the body is a bounded
 *     ScrollView (content-sized until the cap, the Sheet D-32 pattern) and the
 *     open note block is kept in view on every layout change
 *     (`shareCardNoteScrollY`). The scroll offset lives in a ref, never state.
 * =============================================================================
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  AppState,
  Keyboard,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button } from "@/components/ui/Button";
import { chipTone } from "@/components/ui/chip-tone";
import { EntryTextField } from "@/components/ui/EntryTextField";
import { OrbitSwitch } from "@/components/ui/OrbitSwitch";
import { ADD_NOTE, ALLOW_AI } from "@/constants/glossary";
import type { ShareRowRef, ShareSection } from "@/db/capture-dao";
import {
  canStartCardWrite,
  confirmationLabel,
  createAutoCloseTimer,
  createdLabel,
  initialShareCardState,
  SHARE_CARD_AUTO_CLOSE_MS,
  SHARE_CHIP_ORDER,
  SHARE_SECTION_LABELS,
  type ShareCardAction,
  type ShareCardState,
  type ShareCardWriteResult,
  type ShareUndoResult,
  type ShareUndoTarget,
  type ShareWriteOutcome,
  shareCardNoteScrollY,
  shareCardReducer,
  undoTarget,
} from "@/logic/share-card-logic";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

/** The screen-owned writes the card asks for; each is seq-guarded by the screen. */
export interface ShareCardActions {
  move: (
    rows: readonly ShareRowRef[],
    section: ShareSection,
  ) => Promise<ShareWriteOutcome<{ rows: ShareRowRef[]; aiOn: boolean }>>;
  setAi: (
    rows: readonly ShareRowRef[],
    allow: boolean,
  ) => Promise<ShareWriteOutcome<boolean>>;
  undo: (
    target: ShareUndoTarget,
  ) => Promise<ShareWriteOutcome<ShareUndoResult>>;
  saveNote: (
    rows: readonly ShareRowRef[],
    note: string,
  ) => Promise<ShareWriteOutcome<void>>;
}

export interface ShareConfirmationCardHandle {
  discardOpened: () => void;
  discardClosed: () => void;
}

export interface ShareConfirmationCardProps {
  rows: readonly ShareRowRef[];
  /** Set when the share created its contact (D-83), so Undo can remove it (D-100). */
  createdContactId: number | null;
  /** The people the share was saved to, in pick order. */
  contactNames: readonly string[];
  actions: ShareCardActions;
  /** The screen's auto-close (seq- and app-state-guarded finish). */
  onAutoClose: () => void;
  /** Done: return to the source app now (D-74). */
  onDone: () => void;
  /** Mirrors the note editor for the screen's Back handler (38.9 D-33). */
  onNoteStateChange?: (note: { editing: boolean; text: string }) => void;
  /** Space below the card: the keyboard lift or the system bar inset (I-02, I-16). */
  bottomOffset: number;
  /**
   * The card's height cap, so it stays below the safe-area top (D-147,
   * `shareCardMaxHeight`); null = no cap. Past it the body scrolls.
   */
  maxHeight: number | null;
}

/** Settle a card write from the screen's outcome. A stale result is ignored. */
function settle<T>(
  outcome: ShareWriteOutcome<T>,
  dispatch: (action: ShareCardAction) => void,
  toResult: (value: T) => ShareCardWriteResult,
): void {
  if (outcome.status === "ok") {
    dispatch({ type: "writeSucceeded", result: toResult(outcome.value) });
  } else if (outcome.status === "failed" || outcome.status === "busy") {
    dispatch({ type: "writeFailed" });
  }
}

export const ShareConfirmationCard = forwardRef<
  ShareConfirmationCardHandle,
  ShareConfirmationCardProps
>(function ShareConfirmationCard(
  {
    rows,
    createdContactId,
    contactNames,
    actions,
    onAutoClose,
    onDone,
    onNoteStateChange,
    bottomOffset,
    maxHeight,
  },
  ref,
) {
  const { colors } = useTheme();
  const [state, setState] = useState<ShareCardState>(() =>
    initialShareCardState(rows, createdContactId),
  );
  // The synchronous mirror: every dispatch reduces from here, so two taps in
  // one frame cannot both start a write (single-flight).
  const stateRef = useRef(state);
  const dispatch = useCallback((action: ShareCardAction) => {
    const next = shareCardReducer(stateRef.current, action);
    if (next !== stateRef.current) {
      stateRef.current = next;
      setState(next);
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      discardOpened: () => dispatch({ type: "discardOpened" }),
      discardClosed: () => dispatch({ type: "discardClosed" }),
    }),
    [dispatch],
  );

  // The auto-close timer: cleared while any hold is set, re-armed in full
  // when the last one clears, disposed on unmount (D-77; c4, c5).
  const timerRef = useRef<ReturnType<typeof createAutoCloseTimer> | null>(null);
  if (timerRef.current === null) {
    timerRef.current = createAutoCloseTimer({
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (handle) =>
        clearTimeout(handle as ReturnType<typeof setTimeout>),
      ms: SHARE_CARD_AUTO_CLOSE_MS,
      onFire: () => dispatch({ type: "timeout" }),
    });
  }
  useEffect(() => {
    timerRef.current?.sync(state);
  }, [state]);
  useEffect(() => () => timerRef.current?.dispose(), []);

  const onAutoCloseRef = useRef(onAutoClose);
  onAutoCloseRef.current = onAutoClose;
  useEffect(() => {
    if (state.finished) onAutoCloseRef.current();
  }, [state.finished]);

  // The app-inactive hold (convergence c5): background clears the pending
  // timeout; returning to active re-arms it for the full duration.
  useEffect(() => {
    if (AppState.currentState !== "active") dispatch({ type: "backgrounded" });
    const sub = AppState.addEventListener("change", (next) => {
      dispatch({ type: next === "active" ? "foregrounded" : "backgrounded" });
    });
    return () => sub.remove();
  }, [dispatch]);

  const onNoteStateChangeRef = useRef(onNoteStateChange);
  onNoteStateChangeRef.current = onNoteStateChange;
  useEffect(() => {
    onNoteStateChangeRef.current?.({
      editing: state.noteEditing,
      text: state.note,
    });
  }, [state.noteEditing, state.note]);

  const onChip = useCallback(
    (section: ShareSection) => {
      const current = stateRef.current;
      if (!canStartCardWrite(current) || section === current.section) return;
      const committedRows = current.committed.rows;
      dispatch({ type: "selectChip", section });
      void actions.move(committedRows, section).then((outcome) =>
        settle(outcome, dispatch, (value) => ({
          kind: "move",
          rows: value.rows,
          section,
          aiOn: value.aiOn,
        })),
      );
    },
    [actions, dispatch],
  );

  const onToggleAi = useCallback(() => {
    const current = stateRef.current;
    if (!canStartCardWrite(current) || current.aiDisabled) return;
    const allow = !current.aiOn;
    dispatch({ type: "toggleAi" });
    void actions
      .setAi(current.committed.rows, allow)
      .then((outcome) =>
        settle(outcome, dispatch, (aiOn) => ({ kind: "ai", aiOn })),
      );
  }, [actions, dispatch]);

  const onUndo = useCallback(() => {
    const current = stateRef.current;
    if (!canStartCardWrite(current)) return;
    const target = undoTarget(current);
    dispatch({ type: "undo" });
    void actions
      .undo(target)
      .then((outcome) => settle(outcome, dispatch, () => ({ kind: "undo" })));
  }, [actions, dispatch]);

  const onSaveNote = useCallback(() => {
    // The note field unmounts without a blur when a button closes it, so
    // Android leaves the keyboard up with no field; a later share then opens
    // with the keyboard gap still reserved (38.10-19 device pass).
    Keyboard.dismiss();
    const current = stateRef.current;
    const note = current.note.trim();
    // A blank note is a Skip: no write (WR-02).
    if (note.length === 0) {
      dispatch({ type: "noteClosed" });
      return;
    }
    if (!canStartCardWrite(current)) return;
    dispatch({ type: "saveNote" });
    void actions
      .saveNote(current.committed.rows, note)
      .then((outcome) => settle(outcome, dispatch, () => ({ kind: "note" })));
  }, [actions, dispatch]);

  // D-147: keep the open note block in view whenever the body's viewport,
  // its content or the block itself is laid out again (the keyboard shrinking
  // the cap, the field growing a line). Refs only; one scrollTo per change.
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const noteLayoutRef = useRef<{ top: number; height: number } | null>(null);
  const revealNote = useCallback(() => {
    const note = noteLayoutRef.current;
    if (note === null) return;
    const y = shareCardNoteScrollY({
      scrollY: scrollYRef.current,
      viewportHeight: viewportHeightRef.current,
      contentHeight: contentHeightRef.current,
      noteTop: note.top,
      noteHeight: note.height,
    });
    if (y === null) return;
    scrollYRef.current = y;
    scrollRef.current?.scrollTo({ y, animated: false });
  }, []);
  const onBodyLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewportHeightRef.current = event.nativeEvent.layout.height;
      revealNote();
    },
    [revealNote],
  );
  const onBodyContentSize = useCallback(
    (_width: number, height: number) => {
      contentHeightRef.current = height;
      revealNote();
    },
    [revealNote],
  );
  const onBodyScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollYRef.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );
  const onNoteLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      noteLayoutRef.current = { top: y, height };
      revealNote();
    },
    [revealNote],
  );
  useEffect(() => {
    if (!state.noteEditing) noteLayoutRef.current = null;
  }, [state.noteEditing]);

  const busy = state.writePending !== null;
  const locked = busy || state.undone;
  const savedLine = confirmationLabel(contactNames, state.section);

  return (
    <View
      testID="capture-confirmation-card"
      onTouchStart={() => dispatch({ type: "touchStart" })}
      onTouchEnd={() => dispatch({ type: "touchEnd" })}
      onTouchCancel={() => dispatch({ type: "touchEnd" })}
      style={[
        styles.card,
        {
          bottom: bottomOffset,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        maxHeight === null ? null : { maxHeight },
      ]}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        onLayout={onBodyLayout}
        onContentSizeChange={onBodyContentSize}
        onScroll={onBodyScroll}
        scrollEventThrottle={16}
      >
        {createdContactId !== null ? (
          <Text
            testID="capture-created-label"
            style={[styles.label, { color: colors.textPrimary }]}
          >
            {createdLabel(contactNames[0] ?? "")}
          </Text>
        ) : null}
        <Text
          testID="capture-confirmation-toast"
          accessibilityLiveRegion="polite"
          style={[styles.label, { color: colors.textPrimary }]}
        >
          {savedLine}
        </Text>

        <View style={styles.chips}>
          {SHARE_CHIP_ORDER.map((section) => {
            const selected = state.section === section;
            const tone = chipTone("primary", selected);
            return (
              <Pressable
                key={section}
                testID={`capture-chip-${section}`}
                accessibilityRole="button"
                accessibilityLabel={SHARE_SECTION_LABELS[section]}
                accessibilityState={{ selected, disabled: locked }}
                disabled={locked}
                onPress={() => onChip(section)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: colors[tone.fill],
                    borderColor: colors[tone.border],
                    opacity: locked && !selected ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipLabel, { color: colors[tone.label] }]}>
                  {SHARE_SECTION_LABELS[section]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {state.noteEditing ? (
          <View
            testID="capture-note-block"
            style={styles.noteBlock}
            onLayout={onNoteLayout}
          >
            {/* D-136 S5: the D-66 wrapping entry field. It wraps to about 3
              lines and Enter saves (it blurs first, then onSaveNote also
              dismisses the keyboard). Capture has no
              KeyboardCenteringProvider, so it does not centre (D-66 scope). */}
            <EntryTextField
              testID="capture-note-input"
              autoFocus
              accessibilityLabel="Note"
              value={state.note}
              onChangeText={(text) => dispatch({ type: "setNote", text })}
              placeholder={
                'Add your words — e.g. "for Dad, he asked about this"'
              }
              onSubmit={onSaveNote}
            />
            <View style={styles.actions}>
              <Button
                testID="capture-note-skip"
                role="tertiary"
                label="Skip"
                accessibilityLabel="Skip note"
                disabled={busy}
                onPress={() => {
                  Keyboard.dismiss();
                  dispatch({ type: "noteClosed" });
                }}
              />
              <Button
                testID="capture-note-done"
                role="tertiary"
                label="Save note"
                disabled={busy}
                onPress={onSaveNote}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.aiRow}>
          <Text style={[styles.aiLabel, { color: colors.textPrimary }]}>
            {ALLOW_AI}
          </Text>
          <OrbitSwitch
            testID="capture-allow-ai"
            accessibilityLabel={ALLOW_AI}
            value={state.aiOn}
            disabled={state.aiDisabled || locked}
            busy={state.writePending === "ai"}
            onValueChange={onToggleAi}
          />
        </View>

        <View style={styles.actions}>
          <Button
            testID="capture-undo"
            role="tertiary"
            label="Undo"
            disabled={locked}
            onPress={onUndo}
          />
          {state.noteEditing ? null : (
            <>
              <Button
                testID="capture-note-affordance"
                role="tertiary"
                label={ADD_NOTE}
                disabled={locked}
                onPress={() => dispatch({ type: "noteOpened" })}
              />
              <Button
                testID="capture-done"
                role="primary"
                label="Done"
                disabled={busy}
                onPress={onDone}
              />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    left: SPACING.base,
    right: SPACING.base,
    borderWidth: 1,
    borderRadius: 12,
    // The scrolling body is clipped to the rounded card (D-147).
    overflow: "hidden",
  },
  // Content-sized until the cap, then shrinks and scrolls (D-147; the Sheet
  // D-32 pattern).
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: {
    padding: SPACING.base,
    gap: SPACING.md,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  noteBlock: {
    gap: 8,
  },
  aiRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  aiLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 8,
  },
});
