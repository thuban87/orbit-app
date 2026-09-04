import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import {
  DEFAULT_MEMORY_TYPE_KEY,
  MEMORY_TYPE_REGISTRY,
  PROVISIONAL_MEMORY_LABEL,
  type MemoryTypeKey,
} from "@/db/memory-registry";
import type { MemoryRow } from "@/db/memories-read";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { MemoryCard } from "./MemoryCard";
import { AppText } from "./ui";

const PROVENANCE_LABELS = {
  user: "Added by you",
  import: "Imported from Contacts",
  share: "From a shared capture",
} as const;

const MEMORY_TYPE_OPTIONS = (
  Object.keys(MEMORY_TYPE_REGISTRY) as MemoryTypeKey[]
).map((type) => ({ type, label: MEMORY_TYPE_REGISTRY[type].displayName }));

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function provenanceLabel(provenance: string): string {
  return (
    PROVENANCE_LABELS[provenance as keyof typeof PROVENANCE_LABELS] ??
    "Added to this contact"
  );
}

export interface MemoryDraft {
  type: MemoryTypeKey;
  customLabel: string | null;
  value: string | null;
  note: string | null;
  url: string | null;
  meaningfulDate: string | null;
  pinned: boolean;
  outdated: boolean;
  /** Null inherits the selected Memory type's visibility default. */
  hidden: boolean | null;
}

export interface MemoryEditPatch extends MemoryDraft {}

export interface MemoryEditorProps {
  items: MemoryRow[];
  /** Grouped callers render one editor per type; only the final group offers creation. */
  showAdd?: boolean;
  onAdd: (draft: MemoryDraft) => Promise<boolean>;
  onEdit: (id: number, patch: MemoryEditPatch) => Promise<boolean>;
  onDelete: (id: number) => void;
  onRestore: (id: number) => void;
  onSetAllowAi: (id: number, allow: boolean) => void;
  globalAiEnabled: boolean;
  testID?: string;
}

function TypePicker({
  value,
  onSelect,
}: {
  value: MemoryTypeKey;
  onSelect: (type: MemoryTypeKey) => void;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected =
    MEMORY_TYPE_OPTIONS.find((option) => option.type === value)?.label ??
    PROVISIONAL_MEMORY_LABEL;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Memory type: ${selected}`}
        onPress={() => setOpen(true)}
        style={[
          styles.typeTrigger,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <AppText role="body">{selected}</AppText>
      </Pressable>
      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Dismiss memory type options"
            onPress={() => setOpen(false)}
            style={StyleSheet.absoluteFill}
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
              data={MEMORY_TYPE_OPTIONS}
              keyExtractor={(item) => item.type}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={() => {
                    onSelect(item.type);
                    setOpen(false);
                  }}
                  style={[styles.option, { borderColor: colors.border }]}
                >
                  <AppText
                    role="body"
                    style={{
                      color:
                        item.type === value
                          ? colors.accent
                          : colors.textPrimary,
                    }}
                  >
                    {item.label}
                  </AppText>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

export function initialDraft(item?: MemoryRow): MemoryDraft {
  return {
    type: item?.type === "custom" ? "custom" : DEFAULT_MEMORY_TYPE_KEY,
    customLabel: item?.custom_label ?? null,
    value: item?.value ?? null,
    note: item?.note ?? null,
    url: item?.url ?? null,
    meaningfulDate: item?.meaningful_date ?? null,
    pinned: item?.pinned === 1,
    outdated: item?.outdated === 1,
    // A new Memory (and a legacy row with a malformed flag) must inherit the
    // registry default; only explicit database 0/1 values are overrides.
    hidden: item?.hidden === 1 ? true : item?.hidden === 0 ? false : null,
  };
}

/** Memory form with parent-owned persistence; it deliberately imports no writer DAO. */
export function MemoryEditor({
  items,
  showAdd = true,
  onAdd,
  onEdit,
  onDelete,
  onRestore,
  onSetAllowAi,
  globalAiEnabled,
  testID,
}: MemoryEditorProps) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState<MemoryRow | null>(null);
  const [draft, setDraft] = useState<MemoryDraft | null>(null);

  const openNew = () => {
    setEditing(null);
    setDraft(initialDraft());
  };
  const openExisting = (item: MemoryRow) => {
    setEditing(item);
    setDraft(initialDraft(item));
  };
  const close = () => {
    setEditing(null);
    setDraft(null);
  };
  const update = <K extends keyof MemoryDraft>(
    key: K,
    value: MemoryDraft[K],
  ) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };
  const commit = async () => {
    if (
      !draft ||
      (draft.type === "custom" && !blankToNull(draft.customLabel ?? ""))
    )
      return;
    const normalized: MemoryDraft = {
      ...draft,
      customLabel: blankToNull(draft.customLabel ?? ""),
      value: blankToNull(draft.value ?? ""),
      note: blankToNull(draft.note ?? ""),
      url: blankToNull(draft.url ?? ""),
      meaningfulDate: blankToNull(draft.meaningfulDate ?? ""),
    };
    const saved = editing
      ? await onEdit(editing.id, normalized)
      : await onAdd(normalized);
    if (saved) close();
  };
  const isCustom = draft?.type === "custom";
  const canSave = Boolean(
    draft &&
      blankToNull(draft.value ?? "") &&
      (!isCustom || blankToNull(draft.customLabel ?? "")),
  );

  return (
    <View testID={testID} style={styles.container}>
      {items.map((item) => (
        <MemoryCard
          key={item.id}
          memory={item}
          onPress={() => openExisting(item)}
        />
      ))}
      {!draft ? (
        showAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add memory"
            onPress={openNew}
            style={[styles.action, { borderColor: colors.border }]}
          >
            <AppText role="body" style={{ color: colors.accent }}>
              Add memory
            </AppText>
          </Pressable>
        ) : null
      ) : (
        <View
          style={[
            styles.form,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <AppText role="heading">
            {editing ? "Edit memory" : "Add memory"}
          </AppText>
          <TypePicker
            value={draft.type}
            onSelect={(type) => update("type", type)}
          />
          {isCustom ? (
            <TextInput
              accessibilityLabel="Custom memory label"
              value={draft.customLabel ?? ""}
              onChangeText={(value) => update("customLabel", value)}
              placeholder="Memory label"
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            />
          ) : null}
          <TextInput
            accessibilityLabel="Memory value"
            value={draft.value ?? ""}
            onChangeText={(value) => update("value", value)}
            placeholder="What should you remember?"
            placeholderTextColor={colors.textSecondary}
            multiline
            style={[
              styles.input,
              styles.multiline,
              {
                color: colors.textPrimary,
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          />
          <TextInput
            accessibilityLabel="Memory note optional"
            value={draft.note ?? ""}
            onChangeText={(value) => update("note", value)}
            placeholder="Note (optional)"
            placeholderTextColor={colors.textSecondary}
            multiline
            style={[
              styles.input,
              styles.multiline,
              {
                color: colors.textPrimary,
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          />
          <TextInput
            accessibilityLabel="Memory link optional"
            value={draft.url ?? ""}
            onChangeText={(value) => update("url", value)}
            placeholder="Link (optional)"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[
              styles.input,
              {
                color: colors.textPrimary,
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          />
          <TextInput
            accessibilityLabel="Meaningful date optional"
            value={draft.meaningfulDate ?? ""}
            onChangeText={(value) => update("meaningfulDate", value)}
            placeholder="Meaningful date (optional)"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              {
                color: colors.textPrimary,
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          />
          <View style={styles.toggleRow}>
            <AppText role="body">Pin memory</AppText>
            <Switch
              value={draft.pinned}
              onValueChange={(value) => update("pinned", value)}
            />
          </View>
          <View style={styles.toggleRow}>
            <AppText role="body">Mark outdated</AppText>
            <Switch
              value={draft.outdated}
              onValueChange={(value) => update("outdated", value)}
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.visibilityCopy}>
              <AppText role="body">Hide from Profile</AppText>
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                This is presentation only.
              </AppText>
            </View>
            <Switch
              value={draft.hidden === true}
              onValueChange={(value) => update("hidden", value)}
            />
          </View>
          {editing ? (
            <View style={styles.toggleRow}>
              <View style={styles.visibilityCopy}>
                <AppText role="body">Allow AI to use this</AppText>
                {!globalAiEnabled ? (
                  <AppText
                    role="caption"
                    style={{ color: colors.textSecondary }}
                  >
                    Turn on AI in Settings first
                  </AppText>
                ) : null}
              </View>
              <Switch
                accessibilityLabel="Allow AI to use this"
                accessibilityState={{ disabled: !globalAiEnabled }}
                disabled={!globalAiEnabled}
                value={editing.allow_ai === 1}
                onValueChange={(allow) => {
                  setEditing((current) =>
                    current ? { ...current, allow_ai: allow ? 1 : 0 } : current,
                  );
                  onSetAllowAi(editing.id, allow);
                }}
              />
            </View>
          ) : null}
          {editing ? (
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              {provenanceLabel(editing.provenance)}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            {editing ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Move memory to Recently Deleted"
                onPress={() => {
                  onDelete(editing.id);
                  close();
                }}
                style={[styles.action, { borderColor: colors.border }]}
              >
                <AppText role="body" style={{ color: colors.textSecondary }}>
                  Move to Recently Deleted
                </AppText>
              </Pressable>
            ) : null}
            {editing?.deleted_at ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Restore memory"
                onPress={() => onRestore(editing.id)}
                style={[styles.action, { borderColor: colors.border }]}
              >
                <AppText role="body" style={{ color: colors.accent }}>
                  Restore
                </AppText>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={close}
              style={[styles.action, { borderColor: colors.border }]}
            >
              <AppText role="body" style={{ color: colors.textSecondary }}>
                Cancel
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={editing ? "Save memory" : "Add memory"}
              accessibilityState={{ disabled: !canSave }}
              disabled={!canSave}
              onPress={() => void commit()}
              style={[
                styles.action,
                {
                  backgroundColor: canSave ? colors.accent : colors.surface,
                  borderColor: canSave ? colors.accent : colors.border,
                },
              ]}
            >
              <AppText
                role="body"
                style={{
                  color: canSave ? colors.background : colors.textSecondary,
                }}
              >
                {editing ? "Save" : "Add memory"}
              </AppText>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: "center",
    borderRadius: SPACING.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: SPACING.md,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  container: { gap: SPACING.sm },
  form: {
    borderRadius: SPACING.md,
    borderWidth: 1,
    gap: SPACING.sm,
    padding: SPACING.base,
  },
  input: {
    borderRadius: SPACING.sm,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  modalRoot: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: SPACING.lg,
  },
  multiline: { minHeight: 84, textAlignVertical: "top" },
  option: {
    borderBottomWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: SPACING.base,
  },
  scrim: { opacity: 0.82 },
  sheet: {
    borderRadius: SPACING.md,
    borderWidth: 1,
    maxWidth: 360,
    width: "100%",
  },
  toggleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
    minHeight: 44,
  },
  typeTrigger: {
    borderRadius: SPACING.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
  },
  visibilityCopy: { flex: 1, gap: SPACING.xs },
});
