/**
 * FuelEditor (FUEL-01/FUEL-02) — the controlled per-item conversational-fuel list
 * mounted in a "Conversational Fuel" section on `ContactProfileScreen`. Follows
 * the `LinksEditor` posture: the PARENT owns persistence (calls `fuel-dao` then
 * `load()`); this component holds NO DB access and imports no DAO.
 *
 * =============================================================================
 * DRAFT / COMMIT BOUNDARY (the ONE piece of local state — review MEDIUM-4/3):
 *   The editor's ONLY persistent local state is a single transient "new item"
 *   draft (kind/label/text/url). The draft becomes a persisted row ONLY on an
 *   explicit "Add" tap AND only when the draft text is non-blank — there is NO
 *   per-keystroke write and NO blank-row insert (so a blank draft can never top
 *   the ranking). The persisted rows are fully CONTROLLED from the loaded
 *   `items` (no per-row local mirror).
 *
 *   EXISTING rows use UNCONTROLLED inputs: a `value={row.text}` controlled input
 *   with commit-on-blur and no per-row mirror is NOT implementable — the field
 *   would freeze between keystrokes until the next `load()`. So each existing
 *   row's TextInputs render with `defaultValue` (keyed by row id, so a `load()`
 *   that changes the list re-maps inputs to the right row) and commit on
 *   `onEndEditing`/blur via `onEdit(id, patch)`; the kind picker (a discrete
 *   control) commits immediately on selection. The parent then runs the matching
 *   `fuel-dao` writer and `await load()`.
 * =============================================================================
 *
 * BLANK → NULL NORMALIZATION happens HERE, at the single onAdd/onEdit commit
 * boundary: each optional (label/text/url) is `trim()`-ed and a length-0 result
 * is emitted as `null`, so a blank/whitespace/newline-only optional is stored
 * NULL, not `""` (matching the "stored NULL when blank" must_have without relying
 * on SQL TRIM). `kind` is never nulled.
 *
 * `off_limits` rows are editable here like any other kind (this editor is the ONE
 * surface that shows them) but carry a `borderStrong` outline + an "Off-limits ·
 * private" pill 🔒 + a helper line — visual reinforcement only; the structural
 * "never leaves the device / never glanceable" guarantee is Plan 02's in-query
 * exclusion. Every colour resolves through `useTheme().colors.*` (CLAUDE.md /
 * check:colors) — no net-new token, no raw hex.
 *
 * Age, the ranked line, the AI-unconfirmed state, and search are Plans 02–04 —
 * this slice renders only add/edit/delete across the 5 kinds + optional
 * label/url.
 */
import { useState } from "react";
import {
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { FuelKind } from "@/db/fuel-dao";
import type { FuelItem } from "@/db/fuel-read";
import { useTheme } from "@/theme";
import { normaliseLinkUrl } from "./LinksEditor";

/** The 5 kinds in editor order, each with its human copy (UI-SPEC copywriting). */
const KIND_OPTIONS: readonly { kind: FuelKind; label: string }[] = [
  { kind: "recent", label: "Recent" },
  { kind: "topic", label: "Topic" },
  { kind: "fact", label: "Fact" },
  { kind: "gift", label: "Gift idea" },
  { kind: "off_limits", label: "Off-limits" },
];

/** The default kind for a new draft — never `off_limits`, never transmitted (UI-SPEC #6). */
const DEFAULT_KIND: FuelKind = "topic";

function kindLabel(kind: FuelKind): string {
  return KIND_OPTIONS.find((o) => o.kind === kind)?.label ?? "Choose a kind";
}

/** Trim, and emit NULL for a blank/whitespace-only optional (the commit boundary). */
function blankToNull(raw: string): string | null {
  const v = raw.trim();
  return v.length === 0 ? null : v;
}

/** A fully-normalized new fuel item the parent persists via `addFuel`. */
export interface FuelDraft {
  kind: FuelKind;
  label: string | null;
  text: string | null;
  url: string | null;
}

/** A single-field edit to an existing row (already normalized); the parent merges. */
export interface FuelEditPatch {
  kind?: FuelKind;
  label?: string | null;
  text?: string | null;
  url?: string | null;
}

export interface FuelEditorProps {
  items: FuelItem[];
  onAdd: (draft: FuelDraft) => void;
  onEdit: (id: number, patch: FuelEditPatch) => void;
  onDelete: (id: number) => void;
  testID?: string;
}

/** Open a fuel link behind LinksEditor's http/https allowlist. */
function openFuelUrl(rawUrl: string): void {
  void Linking.openURL(normaliseLinkUrl(rawUrl)).catch(() => {});
}

/**
 * The kind picker — a `Pressable` trigger opening a `Modal` + `FlatList` of the 5
 * human kind labels (the `DropdownFieldWidget` pattern, zero new deps). The
 * selected kind renders in `accent`.
 */
function KindPicker({
  value,
  onSelect,
  testID,
}: {
  value: FuelKind;
  onSelect: (kind: FuelKind) => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`Kind: ${kindLabel(value)}`}
        onPress={() => setOpen(true)}
        style={[
          styles.kindTrigger,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={{ color: colors.textPrimary }}>{kindLabel(value)}</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Dismiss kind options"
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          >
            <View
              style={[
                StyleSheet.absoluteFill,
                styles.scrim,
                { backgroundColor: colors.background },
              ]}
            />
          </Pressable>

          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
              },
            ]}
          >
            <FlatList
              data={KIND_OPTIONS}
              keyExtractor={(item) => item.kind}
              renderItem={({ item }) => {
                const isSelected = item.kind === value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    onPress={() => {
                      onSelect(item.kind);
                      setOpen(false);
                    }}
                    style={[styles.option, { borderColor: colors.border }]}
                  >
                    <Text
                      style={{
                        color: isSelected ? colors.accent : colors.textPrimary,
                      }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

/**
 * One EXISTING (persisted) fuel row — uncontrolled inputs seeded by `defaultValue`,
 * committing on blur via `onEdit`; the kind picker commits immediately. `off_limits`
 * rows carry the private marker.
 */
function FuelRow({
  item,
  index,
  onEdit,
  onDelete,
}: {
  item: FuelItem;
  index: number;
  onEdit: (id: number, patch: FuelEditPatch) => void;
  onDelete: (id: number) => void;
}) {
  const { colors } = useTheme();
  const isOffLimits = item.kind === "off_limits";

  const inputStyle = [
    styles.input,
    {
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
  ];

  return (
    <View
      testID={`fuel-editor-row-${index}`}
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: isOffLimits ? colors.borderStrong : colors.border,
        },
      ]}
    >
      <View style={styles.rowHeader}>
        <KindPicker
          testID={`fuel-editor-kind-${index}`}
          value={item.kind}
          onSelect={(kind) => onEdit(item.id, { kind })}
        />
        <Pressable
          testID={`fuel-editor-remove-${index}`}
          accessibilityRole="button"
          accessibilityLabel="Delete fuel item"
          hitSlop={12}
          onPress={() => onDelete(item.id)}
          style={styles.removeBtn}
        >
          <Text style={[styles.removeGlyph, { color: colors.textSecondary }]}>
            ✕
          </Text>
        </Pressable>
      </View>

      {isOffLimits ? (
        <View style={styles.offLimits}>
          <View style={[styles.pill, { borderColor: colors.border }]}>
            <Text style={[styles.pillText, { color: colors.textSecondary }]}>
              🔒 Off-limits · private
            </Text>
          </View>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            Never shared with AI, never shown at a glance.
          </Text>
        </View>
      ) : null}

      <TextInput
        testID={`fuel-editor-text-${index}`}
        accessibilityLabel="Fuel text"
        defaultValue={item.text ?? ""}
        onEndEditing={(e) =>
          onEdit(item.id, { text: blankToNull(e.nativeEvent.text) })
        }
        placeholder="What's worth saying?"
        placeholderTextColor={colors.textSecondary}
        multiline
        style={[...inputStyle, styles.multiline]}
      />
      <TextInput
        testID={`fuel-editor-label-${index}`}
        accessibilityLabel="Label (optional)"
        defaultValue={item.label ?? ""}
        onEndEditing={(e) =>
          onEdit(item.id, { label: blankToNull(e.nativeEvent.text) })
        }
        placeholder="Label (optional)"
        placeholderTextColor={colors.textSecondary}
        style={inputStyle}
      />
      <View style={styles.urlRow}>
        <TextInput
          testID={`fuel-editor-url-${index}`}
          accessibilityLabel="Link (optional)"
          defaultValue={item.url ?? ""}
          onEndEditing={(e) =>
            onEdit(item.id, { url: blankToNull(e.nativeEvent.text) })
          }
          placeholder="https://…"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={[...inputStyle, styles.urlInput]}
        />
        <Pressable
          testID={`fuel-editor-open-${index}`}
          accessibilityRole="link"
          accessibilityLabel="Open link"
          hitSlop={12}
          disabled={(item.url ?? "").trim().length === 0}
          onPress={() => item.url && openFuelUrl(item.url)}
          style={styles.openBtn}
        >
          <Text
            style={{
              color:
                (item.url ?? "").trim().length === 0
                  ? colors.textSecondary
                  : colors.accent,
            }}
          >
            Open
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The new-item draft row — the editor's ONLY controlled/local state. Rendered
 * when the user taps "+ Add fuel"; commits only on "Add" with non-blank text.
 */
function DraftRow({
  onCommit,
  onCancel,
}: {
  onCommit: (draft: FuelDraft) => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const [kind, setKind] = useState<FuelKind>(DEFAULT_KIND);
  const [text, setText] = useState("");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  const canAdd = text.trim().length > 0;
  const isOffLimits = kind === "off_limits";

  const inputStyle = [
    styles.input,
    {
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
  ];

  return (
    <View
      testID="fuel-editor-draft"
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: isOffLimits ? colors.borderStrong : colors.border,
        },
      ]}
    >
      <KindPicker
        testID="fuel-editor-draft-kind"
        value={kind}
        onSelect={setKind}
      />

      {isOffLimits ? (
        <View style={styles.offLimits}>
          <View style={[styles.pill, { borderColor: colors.border }]}>
            <Text style={[styles.pillText, { color: colors.textSecondary }]}>
              🔒 Off-limits · private
            </Text>
          </View>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            Never shared with AI, never shown at a glance.
          </Text>
        </View>
      ) : null}

      <TextInput
        testID="fuel-editor-draft-text"
        accessibilityLabel="Fuel text"
        value={text}
        onChangeText={setText}
        placeholder="What's worth saying?"
        placeholderTextColor={colors.textSecondary}
        multiline
        style={[...inputStyle, styles.multiline]}
      />
      <TextInput
        testID="fuel-editor-draft-label"
        accessibilityLabel="Label (optional)"
        value={label}
        onChangeText={setLabel}
        placeholder="Label (optional)"
        placeholderTextColor={colors.textSecondary}
        style={inputStyle}
      />
      <TextInput
        testID="fuel-editor-draft-url"
        accessibilityLabel="Link (optional)"
        value={url}
        onChangeText={setUrl}
        placeholder="https://…"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={inputStyle}
      />
      <View style={styles.draftActions}>
        <Pressable
          testID="fuel-editor-draft-cancel"
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={onCancel}
          style={[styles.draftBtn, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Cancel</Text>
        </Pressable>
        <Pressable
          testID="fuel-editor-draft-add"
          accessibilityRole="button"
          accessibilityLabel="Add fuel item"
          accessibilityState={{ disabled: !canAdd }}
          disabled={!canAdd}
          onPress={() =>
            onCommit({
              kind,
              text: blankToNull(text),
              label: blankToNull(label),
              url: blankToNull(url),
            })
          }
          style={[
            styles.draftBtn,
            {
              backgroundColor: canAdd ? colors.accent : colors.surface,
              borderColor: canAdd ? colors.accent : colors.border,
            },
          ]}
        >
          <Text
            style={{
              color: canAdd ? colors.background : colors.textSecondary,
              fontWeight: "600",
            }}
          >
            Add
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function FuelEditor({
  items,
  onAdd,
  onEdit,
  onDelete,
  testID,
}: FuelEditorProps) {
  const { colors } = useTheme();
  const [drafting, setDrafting] = useState(false);

  const commitDraft = (draft: FuelDraft) => {
    onAdd(draft);
    setDrafting(false);
  };

  return (
    <View testID={testID} style={styles.container}>
      {items.length === 0 && !drafting ? (
        <Text
          testID="fuel-editor-empty"
          style={[styles.empty, { color: colors.textSecondary }]}
        >
          No fuel yet
        </Text>
      ) : (
        items.map((item, index) => (
          <FuelRow
            key={item.id}
            item={item}
            index={index}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
      )}

      {drafting ? (
        <DraftRow onCommit={commitDraft} onCancel={() => setDrafting(false)} />
      ) : (
        <Pressable
          testID="fuel-editor-add"
          accessibilityRole="button"
          accessibilityLabel="Add fuel"
          onPress={() => setDrafting(true)}
          hitSlop={8}
          style={styles.addBtn}
        >
          <Text style={{ color: colors.accent, fontWeight: "600" }}>
            + Add fuel
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  empty: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  kindTrigger: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  multiline: {
    minHeight: 44,
  },
  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  urlInput: {
    flex: 1,
  },
  openBtn: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
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
  offLimits: {
    gap: 4,
  },
  pill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  helper: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  draftActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },
  draftBtn: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    minHeight: 44,
    justifyContent: "center",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  scrim: {
    opacity: 0.85,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: 12,
    maxHeight: "60%",
    overflow: "hidden",
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
