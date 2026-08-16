/**
 * CaptureScreen (CAP-01/02/03/04) — the share-sheet contact picker. A grid of faces
 * that files whatever the user shared (a link, a text selection) onto a contact as
 * ONE conversational-fuel row, then returns to the source app. The 95% path is
 * exactly one tap; long-press promotes to multi-select (fan-out to N contacts), the
 * ＋ tile inline-creates a name-only contact, and an optional note recomposes the
 * just-written row(s)' display text.
 *
 * =============================================================================
 * LOAD-BEARING INVARIANTS (this is the share→fuel→return surface):
 *   - The payload is drained from `useShareIntentContext()` and resolved via
 *     `resolveCapturePayload` (the pure 10-02 resolver) into `{ displayText, url }`.
 *     The url column is ALWAYS canonical and NEVER opened during capture (store
 *     only — the screen never navigates to or opens the url, T-10-01/T-10-05).
 *   - A single tap writes the fuel row IMMEDIATELY (kind='topic', source='share'),
 *     BEFORE any prompt — `resetOnBackground` kills an un-written payload, so the
 *     write must not wait behind the optional note (T-10-04 / D-CAP write-on-pick).
 *   - Long-press enters multi-select; Done writes N INDEPENDENT fuel rows in ONE
 *     transaction via `captureMultiAttach` (never a join table, never a nested
 *     mutex). Done is DISABLED + guarded at zero selection (B3) — no empty
 *     transaction, no "Saved to 0 contacts".
 *   - Capture writes ONLY fuel. It NEVER touches `contacts.last_contact` or writes
 *     an interaction row — capture is not a touchpoint (DATA-04 single-writer). The
 *     inline-create path omits `firstInteraction` so a new contact lands NULL
 *     last_contact (never-contacted); sharing a link is not "contacting".
 *   - EVERY commit path (single-tap, multi Done, inline Create & save, note-Done)
 *     shares the ONE `isCommittingRef` in-flight latch (set BEFORE the first
 *     `await`, cleared in `finally`) and disables its control while set — a rapid
 *     double-tap cannot double-write (B2/C2). A SINGLE `localDateTime()` stamp is
 *     reused per write (A10).
 *   - The returned rowid(s) + contactId(s) are retained in `writtenRows` so the
 *     optional note can editFuel the exact row(s) by id + contactId — there is NO
 *     uid-based fuel lookup (A1/A2). The note recompose applies to ALL N rows
 *     ATOMICALLY via the `captureMultiNote` DAO (never an inline transaction, B1).
 *   - A focused `useFocusEffect` hardware-Back handler owns Back (A6/C1): Back EXITS
 *     multi-select whenever the mode is active (any count) WITHOUT writing, else
 *     cancels via the shared `cancelCapture()`. The Close pill ALWAYS calls
 *     `cancelCapture()` (resetShareIntent → finishActivity); it never merely exits
 *     the mode.
 *   - Confirmation ("Saved to …") + auto-return use setState + a `useRef`
 *     setTimeout — NEVER a per-frame React-state animation (CLAUDE.md). The timer
 *     is cleared on unmount and cancelled the moment the note affordance is touched.
 *   - Every colour resolves through `useTheme().colors.*` — zero hex literals
 *     (CLAUDE.md / check:colors). `Avatar` is used verbatim (size 64,
 *     cacheBust=modified_at) — its recyclingKey anti-face-flash is a correctness
 *     requirement in the recycling grid.
 * =============================================================================
 */
import { useFocusEffect } from "@react-navigation/native";
import { useShareIntentContext } from "expo-share-intent";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import { captureMultiAttach, captureMultiNote } from "@/db/capture-dao";
import {
  type CapturePickRow,
  listCapturePickContacts,
} from "@/db/capture-read";
import { getExecutor, localDateTime } from "@/db/database";
import { addFuel, editFuel, type NewFuelItem } from "@/db/fuel-dao";
import { newUid } from "@/db/uid";
import { resolveCapturePayload } from "@/logic/capture-logic";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import { finishActivity } from "../../modules/orbit-share-finish";

const LOG_SCOPE = "capture";

/**
 * How long the "Saved to …" confirmation shows before Orbit finishes back to the
 * source app (the brief-toast-then-return lock, CONTEXT #3). A single-number tunable
 * per CLAUDE.md — touching the note affordance cancels this timer entirely so the
 * note is never rushed.
 */
const AUTO_RETURN_MS = 1500;

/** One fuel row written by a commit, retained for the optional-note recompose. */
type WrittenRow = { id: number; contactId: number };

/** The recycling-grid cell union: a real face, or the always-present ＋ tile. */
type GridItem = { kind: "face"; row: CapturePickRow } | { kind: "new" };

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
  const { shareIntent, resetShareIntent } = useShareIntentContext();

  // Resolve the share payload ONCE per intent → { displayText, url }. Memoized on
  // the shareIntent identity so a re-render never re-derives (the resolver is pure).
  const payload = useMemo(
    () =>
      resolveCapturePayload({
        text: shareIntent.text ?? "",
        webUrl: shareIntent.webUrl,
        title: shareIntent.meta?.title,
      }),
    [shareIntent],
  );

  const [rows, setRows] = useState<CapturePickRow[]>([]);
  // The just-written rows, retained so the optional note can editFuel the exact
  // row(s) by id + contactId (A1/A2). Set the instant a commit resolves.
  const [writtenRows, setWrittenRows] = useState<WrittenRow[]>([]);
  // Drives the confirmation surface + face-tile disabling. `committing` disables the
  // grid while a write is in flight; `savedLabel` (non-null) shows the toast text.
  const [committing, setCommitting] = useState(false);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);

  // Multi-select (CAP-02): `multiSelect` is the mode flag, `selected` the chosen
  // contact ids. Long-press enters the mode; tap toggles; Done fans out.
  const [multiSelect, setMultiSelect] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Optional-note surface: `noteOpen` reveals the multiline field (cancelling the
  // auto-return), `noteText` is its contents. On Done the note recomposes the
  // just-written row(s)' display text to `note — base` (url untouched).
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  // ONE in-flight latch shared by EVERY commit path (single-tap, multi Done, inline
  // create, note-Done — B2/C2). A ref (not state) so the guard is synchronous — set
  // BEFORE the first await, cleared in finally — and a rapid double-tap that fires
  // before a re-render still early-returns.
  const isCommittingRef = useRef(false);
  // The auto-return timer id; cleared on unmount and cancelled when the note
  // affordance is touched (setState + setTimeout, never a per-frame animation).
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel the share and return to the source app WITHOUT writing. The SINGLE cancel
  // path (A6/C1): the Close pill calls it unconditionally, and the focused Back
  // handler calls it only when NOT in multi-select (in multi-select, Back exits the
  // mode instead — see the BackHandler effect).
  const cancelCapture = useCallback(() => {
    resetShareIntent();
    finishActivity();
  }, [resetShareIntent]);

  // Leave multi-select WITHOUT writing — clears the selection and drops the bar.
  const exitMultiSelect = useCallback(() => {
    setMultiSelect(false);
    setSelected(new Set());
  }, []);

  // Load the picker grid on every focus (favourites → capture-MRU → rest, includes
  // never-contacted, excludes archived). A `cancelled` guard drops a superseded
  // focus's result (the ComposeScreen idiom). Local SQLite; no network on the read.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const result = await listCapturePickContacts(getExecutor());
          if (!cancelled) {
            setRows(result);
          }
        } catch (err) {
          Logger.error(LOG_SCOPE, "failed to load capture contacts", err);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Focused hardware/system-Back handler (A6/C1, mirrors the ComposeScreen idiom —
  // useFocusEffect + BackHandler, return true to consume so native-stack does not
  // pop/finish). SPLIT by semantics: Back EXITS multi-select whenever the mode is
  // active (any selection count, even zero) WITHOUT writing; otherwise it cancels
  // capture. The Close pill is Back-independent and ALWAYS cancels.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (multiSelect) {
          exitMultiSelect();
          return true;
        }
        cancelCapture();
        return true;
      });
      return () => sub.remove();
    }, [multiSelect, exitMultiSelect, cancelCapture]),
  );

  // Clear a pending auto-return timer on unmount (no finish/setState after teardown).
  useEffect(() => {
    return () => {
      if (returnTimer.current) {
        clearTimeout(returnTimer.current);
        returnTimer.current = null;
      }
    };
  }, []);

  // Arm the brief-toast → auto-return (setState + setTimeout, never a per-frame
  // animation). Shared by every commit path; cancelled the moment "Add a note" is
  // touched so the note is never rushed.
  const armAutoReturn = useCallback(() => {
    if (returnTimer.current) {
      clearTimeout(returnTimer.current);
    }
    returnTimer.current = setTimeout(() => {
      returnTimer.current = null;
      resetShareIntent();
      finishActivity();
    }, AUTO_RETURN_MS);
  }, [resetShareIntent]);

  // Single-tap commit — write ONE fuel row immediately, then confirm + auto-return.
  // Guarded against a rapid double-tap by the shared `isCommittingRef` (set before
  // the first await, cleared in finally) AND `committing` disabling the faces (B2).
  const onPickFace = useCallback(
    async (row: CapturePickRow) => {
      if (isCommittingRef.current) {
        return;
      }
      isCommittingRef.current = true;
      setCommitting(true);
      try {
        // ONE stamp reused for createdAt + now (A10) — not two independent calls.
        const stamp = localDateTime();
        const fuelId = await addFuel(getExecutor(), {
          uid: newUid(),
          contactId: row.id,
          kind: "topic",
          source: "share",
          text: payload.displayText,
          url: payload.url,
          createdAt: stamp,
          now: stamp,
        });
        // Retain the rowid + contactId for the note recompose (A1/A2) — there is no
        // uid-based fuel lookup; the note edits this exact row by id+contactId.
        setWrittenRows([{ id: fuelId, contactId: row.id }]);
        setSavedLabel(`Saved to ${row.name}`);
        armAutoReturn();
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to write capture fuel", err);
        // Leave the payload intact (still live until background) for a retry.
        Alert.alert("Couldn't save", "Please try again.");
      } finally {
        isCommittingRef.current = false;
        setCommitting(false);
      }
    },
    [payload, armAutoReturn],
  );

  // Long-press a face → enter multi-select with that face selected.
  const onLongPressFace = useCallback((row: CapturePickRow) => {
    setMultiSelect(true);
    setSelected(new Set([row.id]));
  }, []);

  // In multi-select, a tap TOGGLES a face in/out of the selection set.
  const onToggleFace = useCallback((row: CapturePickRow) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(row.id)) {
        next.delete(row.id);
      } else {
        next.add(row.id);
      }
      return next;
    });
  }, []);

  // Multi-select Done — fan N INDEPENDENT fuel rows into ONE transaction via
  // captureMultiAttach (CAP-02). B3: guard `selected.size === 0` BEFORE building any
  // row or opening the transaction (Done is also disabled at zero). B2: the shared
  // isCommittingRef latch is set before the first await and cleared in finally.
  const onDoneMulti = useCallback(async () => {
    if (selected.size === 0) {
      return;
    }
    if (isCommittingRef.current) {
      return;
    }
    isCommittingRef.current = true;
    setCommitting(true);
    try {
      // ONE stamp reused across all N rows' createdAt + now (A10).
      const stamp = localDateTime();
      const newRows: NewFuelItem[] = [...selected].map((contactId) => ({
        uid: newUid(),
        contactId,
        kind: "topic",
        source: "share",
        text: payload.displayText,
        url: payload.url,
        createdAt: stamp,
        now: stamp,
      }));
      // captureMultiAttach returns the ordered { id, contactId }[] — store it so the
      // optional note can recompose all N rows by id + contactId (A1).
      const written = await captureMultiAttach(getExecutor(), newRows);
      setWrittenRows(written);
      setSavedLabel(`Saved to ${written.length} contacts`);
      // Drop the multi-select bar; the confirmation surface takes over.
      setMultiSelect(false);
      setSelected(new Set());
      armAutoReturn();
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to write multi-attach fuel", err);
      Alert.alert("Couldn't save", "Please try again.");
    } finally {
      isCommittingRef.current = false;
      setCommitting(false);
    }
  }, [selected, payload, armAutoReturn]);

  // Touching "Add a note" cancels the auto-return (the note is never rushed) and
  // reveals the note field. No timer runs while the note is open.
  const onAddNote = useCallback(() => {
    if (returnTimer.current) {
      clearTimeout(returnTimer.current);
      returnTimer.current = null;
    }
    setNoteOpen(true);
  }, []);

  // Note Done — recompose the written row(s)' display text to `note — base` and
  // patch text ONLY (url/created_at untouched). C2: gated on the SAME shared
  // isCommittingRef latch (set before the first await, cleared in finally, the
  // button disabled while set) so a rapid double-tap cannot re-apply. Keyed by BOTH
  // id AND contactId — there is no uid-based fuel lookup (A1). Single row uses the
  // `editFuel` DAO wrapper; N>1 applies atomically via the `captureMultiNote` DAO
  // (editFuelCore × N in ONE transaction) — the screen NEVER opens a transaction
  // inline (B1). A blank/whitespace note leaves the base untouched → treated as Skip.
  const onNoteDone = useCallback(async () => {
    if (isCommittingRef.current) {
      return;
    }
    isCommittingRef.current = true;
    setCommitting(true);
    try {
      const composed = resolveCapturePayload({
        text: shareIntent.text ?? "",
        webUrl: shareIntent.webUrl,
        title: shareIntent.meta?.title,
        note: noteText,
      }).displayText;
      // Only write when the recompose yields a non-blank text (a blank note leaves
      // the base as-is — nothing to patch). ONE stamp for the edit `now` (A10).
      if (composed !== null) {
        const stamp = localDateTime();
        if (writtenRows.length === 1) {
          const { id, contactId } = writtenRows[0];
          await editFuel(getExecutor(), {
            id,
            contactId,
            text: composed,
            now: stamp,
          });
        } else if (writtenRows.length > 1) {
          await captureMultiNote(getExecutor(), writtenRows, composed, stamp);
        }
      }
      setNoteOpen(false);
      armAutoReturn();
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to apply capture note", err);
      Alert.alert("Couldn't save", "Please try again.");
    } finally {
      isCommittingRef.current = false;
      setCommitting(false);
    }
  }, [shareIntent, noteText, writtenRows, armAutoReturn]);

  // Note Skip — dismiss the note field and arm the auto-return with the unchanged
  // single-tap / multi display text (no write).
  const onNoteSkip = useCallback(() => {
    setNoteOpen(false);
    armAutoReturn();
  }, [armAutoReturn]);

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

  // Empty-payload defensive branch: nothing usable to save → error state + Close.
  if (payload.displayText === null && payload.url === null) {
    return (
      <View
        testID="capture-picker-root"
        style={[styles.errorRoot, { backgroundColor: colors.background }]}
      >
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

  const data: GridItem[] = [
    ...rows.map((row): GridItem => ({ kind: "face", row })),
    { kind: "new" },
  ];

  const header = (
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
        {/* Search reveal — icon-only, keyboard stays CLOSED (NOT autofocused). The
            revealed search field + live filtering land in Task 3. */}
        <Pressable
          testID="capture-search-reveal"
          accessibilityRole="button"
          accessibilityLabel="Search contacts"
          style={styles.searchReveal}
        >
          <Text style={{ color: colors.textSecondary }}>🔍</Text>
        </Pressable>
      </View>

      {/* Payload preview strip — WHAT is being filed, before WHO. */}
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
          {payload.displayText ?? payload.url}
        </Text>
        {payload.url ? (
          <Text
            numberOfLines={1}
            style={[styles.previewHost, { color: colors.textSecondary }]}
          >
            {hostOf(payload.url)}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: GridItem }) => {
    if (item.kind === "new") {
      return (
        <Pressable
          testID="capture-new-contact-tile"
          accessibilityRole="button"
          accessibilityLabel="New contact"
          style={[styles.tile, styles.newTile, { borderColor: colors.accent }]}
        >
          <View style={styles.newGlyphBox}>
            <Text style={[styles.newGlyph, { color: colors.accent }]}>＋</Text>
          </View>
          <Text
            numberOfLines={1}
            style={[styles.tileName, { color: colors.textPrimary }]}
          >
            New contact
          </Text>
        </Pressable>
      );
    }

    const { row } = item;
    const isSelected = multiSelect && selected.has(row.id);
    return (
      <Pressable
        testID={`capture-face-${row.id}`}
        accessibilityRole="button"
        accessibilityLabel={
          multiSelect ? `Select ${row.name}` : `Save to ${row.name}`
        }
        accessibilityState={{ disabled: committing, selected: isSelected }}
        disabled={committing}
        onPress={() => (multiSelect ? onToggleFace(row) : void onPickFace(row))}
        onLongPress={() => onLongPressFace(row)}
        style={[
          styles.tile,
          isSelected ? styles.tileSelected : null,
          isSelected ? { borderColor: colors.borderStrong } : null,
        ]}
      >
        <View>
          <Avatar
            photo={row.photo}
            name={row.name}
            contactId={row.id}
            cacheBust={row.modified_at}
            size={64}
          />
          {isSelected ? (
            <View
              testID={`capture-face-check-${row.id}`}
              style={[styles.checkBadge, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.checkGlyph, { color: colors.background }]}>
                ✓
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          style={[styles.tileName, { color: colors.textPrimary }]}
        >
          {row.name}
        </Text>
      </Pressable>
    );
  };

  const doneDisabled = selected.size === 0 || committing;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        testID="capture-picker-root"
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) =>
          item.kind === "new" ? "new" : `face-${item.row.id}`
        }
        numColumns={3}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.grid}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
      />

      {/* Multi-select "Done · N" bar — overlays the grid while in multi-select. B3:
          disabled at zero selection (dimmed + accessibilityState), and the handler
          guards `selected.size === 0` before writing. */}
      {multiSelect ? (
        <View
          testID="capture-multiselect-bar"
          style={[
            styles.multiBar,
            { backgroundColor: colors.accent, opacity: doneDisabled ? 0.5 : 1 },
          ]}
        >
          <Pressable
            testID="capture-multiselect-done"
            accessibilityRole="button"
            accessibilityLabel={`Save to ${selected.size} contacts`}
            accessibilityState={{ disabled: doneDisabled }}
            disabled={doneDisabled}
            onPress={() => void onDoneMulti()}
            style={styles.multiDone}
          >
            <Text style={[styles.multiDoneLabel, { color: colors.background }]}>
              Done · {selected.size}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Confirmation + optional-note surface — the "Saved to …" toast and, until
          the note is opened, the "Add a note" affordance (which cancels the
          auto-return). Once opened, the multiline note field + Done/Skip replace the
          affordance; Done recomposes the written row(s)' display text to `note —
          base` (url untouched), keyed by id + contactId. setState + setTimeout only,
          never a per-frame animation. */}
      {savedLabel !== null && writtenRows.length > 0 ? (
        <View
          style={[
            styles.confirmSurface,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            testID="capture-confirmation-toast"
            style={[styles.confirmText, { color: colors.textPrimary }]}
          >
            {savedLabel}
          </Text>

          {noteOpen ? (
            <View style={styles.noteBlock}>
              <TextInput
                testID="capture-note-input"
                multiline
                value={noteText}
                onChangeText={setNoteText}
                placeholder={
                  'Add your words — e.g. "for Dad, he asked about this"'
                }
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.noteInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
              />
              <View style={styles.noteActions}>
                <Pressable
                  testID="capture-note-skip"
                  accessibilityRole="button"
                  accessibilityLabel="Skip note"
                  onPress={onNoteSkip}
                  style={styles.noteSkip}
                >
                  <Text
                    style={[
                      styles.noteSkipText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Skip
                  </Text>
                </Pressable>
                <Pressable
                  testID="capture-note-done"
                  accessibilityRole="button"
                  accessibilityLabel="Save note"
                  accessibilityState={{ disabled: committing }}
                  disabled={committing}
                  onPress={() => void onNoteDone()}
                  style={styles.noteDone}
                >
                  <Text style={[styles.noteDoneText, { color: colors.accent }]}>
                    Done
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              testID="capture-note-affordance"
              accessibilityRole="button"
              accessibilityLabel="Add a note"
              onPress={onAddNote}
              style={styles.noteAffordance}
            >
              <Text
                style={[styles.noteAffordanceText, { color: colors.accent }]}
              >
                Add a note
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    padding: 16,
    gap: 12,
  },
  column: {
    gap: 12,
  },
  headerBlock: {
    gap: 16,
    marginBottom: 12,
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
  searchReveal: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
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
  tile: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    gap: 8,
  },
  tileSelected: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
  },
  checkBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  checkGlyph: {
    fontSize: 12,
    fontWeight: "700",
  },
  tileName: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  newTile: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    justifyContent: "center",
  },
  newGlyphBox: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  newGlyph: {
    fontSize: 24,
    fontWeight: "700",
  },
  multiBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  multiDone: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  multiDoneLabel: {
    fontSize: 16,
    fontWeight: "700",
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
  confirmSurface: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    flexDirection: "column",
    alignItems: "stretch",
  },
  confirmText: {
    fontSize: 13,
    fontWeight: "600",
  },
  noteAffordance: {
    minHeight: 44,
    justifyContent: "center",
  },
  noteAffordanceText: {
    fontSize: 16,
    fontWeight: "600",
  },
  noteBlock: {
    gap: 12,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "400",
    minHeight: 88,
    textAlignVertical: "top",
  },
  noteActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 16,
  },
  noteSkip: {
    minHeight: 44,
    justifyContent: "center",
  },
  noteSkipText: {
    fontSize: 16,
    fontWeight: "600",
  },
  noteDone: {
    minHeight: 44,
    justifyContent: "center",
  },
  noteDoneText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
