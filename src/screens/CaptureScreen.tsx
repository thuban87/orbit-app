/**
 * CaptureScreen (CAP-01/02/03) — the share-sheet contact picker. A grid of faces
 * that files whatever the user shared (a link, a text selection) onto a contact as
 * ONE conversational-fuel row, then returns to the source app. This is the 95%
 * path: exactly one tap.
 *
 * =============================================================================
 * LOAD-BEARING INVARIANTS (this is the share→fuel→return surface):
 *   - The payload is drained from `useShareIntentContext()` and resolved ONCE via
 *     `resolveCapturePayload` (the pure 10-02 resolver) into `{ displayText, url }`.
 *     The url column is ALWAYS canonical and NEVER opened during capture (store
 *     only — the screen never navigates to or opens the url, T-10-01/T-10-05).
 *   - A single tap writes the fuel row IMMEDIATELY (kind='topic', source='share'),
 *     BEFORE any prompt — `resetOnBackground` kills an un-written payload, so the
 *     write must not wait behind the optional note (T-10-04 / D-CAP write-on-pick).
 *   - Capture writes ONLY fuel. It NEVER touches `contacts.last_contact` or writes
 *     an interaction row — capture is not a touchpoint (DATA-04 single-writer).
 *   - The commit is guarded by `isCommittingRef` (set BEFORE the first `await`,
 *     cleared in `finally`) and the faces disable while committing, so a rapid
 *     double-tap cannot write two rows (B2). A SINGLE `localDateTime()` stamp is
 *     reused for createdAt + now (A10).
 *   - The returned rowid + contactId are retained in `writtenRows` so the optional
 *     note (10-06) can `editFuel` the exact row by id + contactId — there is NO
 *     uid-based fuel lookup (A1/A2).
 *   - Confirmation ("Saved to {name}") + auto-return use setState + a `useRef`
 *     setTimeout — NEVER a per-frame React-state animation (CLAUDE.md). The timer
 *     is cleared on unmount and cancelled the moment the note affordance is touched.
 *   - Close / system Back cancels WITHOUT writing — resetShareIntent() then
 *     finishActivity() (the native module from 10-01) returns to the source app.
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
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import {
  type CapturePickRow,
  listCapturePickContacts,
} from "@/db/capture-read";
import { getExecutor, localDateTime } from "@/db/database";
import { addFuel } from "@/db/fuel-dao";
import { newUid } from "@/db/uid";
import { resolveCapturePayload } from "@/logic/capture-logic";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import { finishActivity } from "../../modules/orbit-share-finish";

const LOG_SCOPE = "capture";

/**
 * How long the "Saved to {name}" confirmation shows before Orbit finishes back to
 * the source app (the brief-toast-then-return lock, CONTEXT #3). A single-number
 * tunable per CLAUDE.md — touching the note affordance cancels this timer entirely
 * so the note is never rushed.
 */
const AUTO_RETURN_MS = 1500;

/** One fuel row written by the single-tap commit, retained for the 10-06 note. */
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
  // The just-written rows, retained so the 10-06 note can editFuel the exact row by
  // id + contactId (A1/A2). Set the instant the single-tap write resolves.
  const [writtenRows, setWrittenRows] = useState<WrittenRow[]>([]);
  // Drives the confirmation surface + face-tile disabling. `committing` disables the
  // grid while a write is in flight; `savedName` (non-null) shows "Saved to {name}".
  const [committing, setCommitting] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);

  // In-flight latch for the single-tap commit (B2). A ref (not state) so the guard
  // is synchronous — set BEFORE the first await, cleared in finally — and a rapid
  // double-tap that fires before a re-render still early-returns.
  const isCommittingRef = useRef(false);
  // The auto-return timer id; cleared on unmount and cancelled when the note
  // affordance is touched (setState + setTimeout, never a per-frame animation).
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel the share and return to the source app WITHOUT writing. (The focused
  // hardware/system-Back handler is formalized in 10-06's shared close handler, A6;
  // here the Close pill is the cancel affordance.)
  const onCancel = useCallback(() => {
    resetShareIntent();
    finishActivity();
  }, [resetShareIntent]);

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

  // Clear a pending auto-return timer on unmount (no finish/setState after teardown).
  useEffect(() => {
    return () => {
      if (returnTimer.current) {
        clearTimeout(returnTimer.current);
        returnTimer.current = null;
      }
    };
  }, []);

  // Single-tap commit — write ONE fuel row immediately, then confirm + auto-return.
  // Guarded against a rapid double-tap by `isCommittingRef` (set before the first
  // await, cleared in finally) AND the `committing` state disabling the faces (B2).
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
        // Retain the rowid + contactId for the 10-06 note recompose (A1/A2) — there
        // is no uid-based fuel lookup; the note edits this exact row by id+contactId.
        setWrittenRows([{ id: fuelId, contactId: row.id }]);
        setSavedName(row.name);
        // Arm the auto-return (setState + setTimeout, never a per-frame animation).
        if (returnTimer.current) {
          clearTimeout(returnTimer.current);
        }
        returnTimer.current = setTimeout(() => {
          returnTimer.current = null;
          resetShareIntent();
          finishActivity();
        }, AUTO_RETURN_MS);
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to write capture fuel", err);
        // Leave the payload intact (still live until background) for a retry.
        Alert.alert("Couldn't save", "Please try again.");
      } finally {
        isCommittingRef.current = false;
        setCommitting(false);
      }
    },
    [payload, resetShareIntent],
  );

  // Touching "Add a note" cancels the auto-return so the note is never rushed. The
  // note field + its recompose write land in 10-06; here this is the timer cancel.
  const onAddNote = useCallback(() => {
    if (returnTimer.current) {
      clearTimeout(returnTimer.current);
      returnTimer.current = null;
    }
  }, []);

  // ---- Render --------------------------------------------------------------

  const closePill = (
    <Pressable
      testID="capture-close"
      accessibilityRole="button"
      accessibilityLabel="Cancel"
      onPress={onCancel}
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
            revealed search field + live filtering land in 10-06. */}
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
    return (
      <Pressable
        testID={`capture-face-${row.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Save to ${row.name}`}
        accessibilityState={{ disabled: committing }}
        disabled={committing}
        onPress={() => void onPickFace(row)}
        style={styles.tile}
      >
        <Avatar
          photo={row.photo}
          name={row.name}
          contactId={row.id}
          cacheBust={row.modified_at}
          size={64}
        />
        <Text
          numberOfLines={1}
          style={[styles.tileName, { color: colors.textPrimary }]}
        >
          {row.name}
        </Text>
      </Pressable>
    );
  };

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

      {/* Confirmation + optional-note surface — "Saved to {name}" + the note
          affordance (which cancels the auto-return). Shown via setState after the
          write; the note field + recompose write land in 10-06, editing the exact
          `writtenRows` row(s) by id + contactId. */}
      {savedName !== null && writtenRows.length > 0 ? (
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
            Saved to {savedName}
          </Text>
          <Pressable
            testID="capture-note-affordance"
            accessibilityRole="button"
            accessibilityLabel="Add a note"
            onPress={onAddNote}
            style={styles.noteAffordance}
          >
            <Text style={[styles.noteAffordanceText, { color: colors.accent }]}>
              Add a note
            </Text>
          </Pressable>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
});
