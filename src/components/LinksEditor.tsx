/**
 * LinksEditor (CRUD-04) — the repeatable per-contact links editor mounted in the
 * edit form. Controlled: the parent owns the `linksDraft` array and this renders
 * it, routing every add/edit/remove back up as a callback (no DB access here —
 * persistence is the parent's single `applyLinkDiff` on Save).
 *
 * Each row is a URL input + an optional label input + a remove `✕` + an "Open"
 * affordance. Empty state shows "No links yet" with "+ Add link" directly below.
 *
 * OPEN-SCHEME SAFETY (T-04-09, reviews-mode POSITIVE allowlist). The open handler
 * uses `/^https?:\/\//i` — NOT a `://`-substring test. Only http/https open as
 * typed; ANY other input has a leading `scheme:`/`scheme://` stripped and
 * `https://` prepended, so `file://…`, `intent://…#Intent;…;end`, and
 * `javascript://…` are NEVER handed to the OS as typed (they become `https://…`).
 * A no-scheme string (`example.com`) just gains `https://`. `Linking.openURL` runs
 * in try/catch; a failure shows "Couldn't open this link." — we deliberately do
 * NOT call `canOpenURL`, so the Android-11 `<queries>` manifest stays unneeded.
 *
 * The scheme-strip regex requires a dot-free scheme (`[a-z][a-z0-9+-]*`) so a
 * schemeless `host:port` (e.g. `example.com:8080/p`) is not mis-stripped — real
 * hostile schemes (file/intent/javascript) contain no dot. Either way the result
 * always begins `https://`, so the security property holds regardless.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "links-editor";

/** A draft link row the editor renders (seeded rows carry an `id`; new rows don't). */
export interface LinkDraft {
  id?: number;
  /** Stable merge-key — present on seeded rows, minted (`newUid()`) for new rows. */
  uid: string;
  url: string;
  label: string | null;
}

export interface LinksEditorProps {
  links: LinkDraft[];
  onAdd: () => void;
  onUpdate: (
    index: number,
    patch: Partial<Pick<LinkDraft, "url" | "label">>,
  ) => void;
  onRemove: (index: number) => void;
  /** Override the open behaviour (defaults to the safe internal handler). */
  onOpen?: (url: string) => void;
  testID?: string;
}

/**
 * Normalise a user-typed link to a web URL. http/https pass through as typed;
 * everything else has a leading dot-free `scheme:`/`scheme://` stripped and
 * `https://` prepended (POSITIVE allowlist — T-04-09).
 */
export function normaliseLinkUrl(raw: string): string {
  const url = raw.trim();
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  const stripped = url.replace(/^[a-z][a-z0-9+-]*:(\/\/)?/i, "");
  return `https://${stripped}`;
}

/** Open a link as a web URL behind the allowlist; failures show the open-error copy. */
async function openLinkUrl(rawUrl: string): Promise<void> {
  try {
    await Linking.openURL(normaliseLinkUrl(rawUrl));
  } catch (err) {
    Logger.error(LOG_SCOPE, "failed to open link", err);
    Alert.alert("Couldn't open this link.");
  }
}

export function LinksEditor({
  links,
  onAdd,
  onUpdate,
  onRemove,
  onOpen,
  testID,
}: LinksEditorProps) {
  const { colors } = useTheme();

  const inputStyle = [
    styles.input,
    {
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
  ];

  const handleOpen = (url: string) => {
    if (onOpen) {
      onOpen(url);
      return;
    }
    void openLinkUrl(url);
  };

  return (
    <View testID={testID} style={styles.container}>
      {links.length === 0 ? (
        <Text
          testID="links-editor-empty"
          style={[styles.empty, { color: colors.textSecondary }]}
        >
          No links yet
        </Text>
      ) : (
        links.map((link, index) => (
          <View
            key={link.uid}
            testID={`links-editor-row-${index}`}
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <TextInput
              testID={`links-editor-url-${index}`}
              accessibilityLabel="Link URL"
              value={link.url}
              onChangeText={(v) => onUpdate(index, { url: v })}
              placeholder="https://…"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={inputStyle}
            />
            <TextInput
              testID={`links-editor-label-${index}`}
              accessibilityLabel="Link label (optional)"
              value={link.label ?? ""}
              onChangeText={(v) => onUpdate(index, { label: v })}
              placeholder="Label (optional)"
              placeholderTextColor={colors.textSecondary}
              style={inputStyle}
            />
            <View style={styles.rowActions}>
              <Pressable
                testID={`links-editor-open-${index}`}
                accessibilityRole="link"
                accessibilityLabel={`Open link ${link.label || link.url}`}
                hitSlop={12}
                onPress={() => handleOpen(link.url)}
                style={styles.openBtn}
                disabled={link.url.trim().length === 0}
              >
                <Text
                  style={{
                    color:
                      link.url.trim().length === 0
                        ? colors.textSecondary
                        : colors.accent,
                  }}
                >
                  Open
                </Text>
              </Pressable>
              <Pressable
                testID={`links-editor-remove-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Remove link ${link.label || link.url}`}
                hitSlop={12}
                onPress={() => onRemove(index)}
                style={styles.removeBtn}
              >
                <Text
                  style={[styles.removeGlyph, { color: colors.textSecondary }]}
                >
                  ✕
                </Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Pressable
        testID="links-editor-add"
        accessibilityRole="button"
        accessibilityLabel="Add link"
        onPress={onAdd}
        hitSlop={8}
        style={styles.addBtn}
      >
        <Text style={{ color: colors.accent, fontWeight: "600" }}>
          + Add link
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  openBtn: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
  },
  removeBtn: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  removeGlyph: {
    fontSize: 18,
    fontWeight: "600",
  },
  addBtn: {
    minHeight: 44,
    justifyContent: "center",
  },
});
