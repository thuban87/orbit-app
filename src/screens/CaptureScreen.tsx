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
 *     only — no Linking.openURL anywhere in this file, T-10-01/T-10-05).
 *   - Close / system Back cancels WITHOUT writing — resetShareIntent() then
 *     finishActivity() (the native module from 10-01) returns to the source app.
 *   - Every colour resolves through `useTheme().colors.*` — zero hex literals
 *     (CLAUDE.md / check:colors). `Avatar` is used verbatim (size 64,
 *     cacheBust=modified_at) — its recyclingKey anti-face-flash is a correctness
 *     requirement in the recycling grid.
 *
 * The single-tap commit (write the fuel row + confirmation + auto-return) is wired
 * in Task 2 of this plan; this task renders the picker and registers the route.
 * =============================================================================
 */
import { useFocusEffect } from "@react-navigation/native";
import { useShareIntentContext } from "expo-share-intent";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import {
  type CapturePickRow,
  listCapturePickContacts,
} from "@/db/capture-read";
import { getExecutor } from "@/db/database";
import { resolveCapturePayload } from "@/logic/capture-logic";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import { finishActivity } from "../../modules/orbit-share-finish";

const LOG_SCOPE = "capture";

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

  // The face tile's single-tap commit (onPress) is wired in Task 2; here the tiles
  // render (faces, names, testIDs) so the grid + route are verifiable now.
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
});
