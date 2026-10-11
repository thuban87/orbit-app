import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { RegisteredModal } from "@/components/ui/RegisteredModal";
import type { MemoryRow } from "@/db/memories-read";
import {
  DEFAULT_MEMORY_TYPE_KEY,
  MEMORY_TYPE_REGISTRY,
  type MemoryTypeKey,
  PROVISIONAL_MEMORY_LABEL,
} from "@/db/memory-registry";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { formatDisplayDateOrFallback } from "@/utils/dates";
import {
  isPickableStoredDate,
  pickerSeedFromStored,
  storedFromPickerEvent,
} from "./date-pick-logic";
import { Icon } from "./icons/Icon";
import { MemoryCard } from "./MemoryCard";
import { AppText, OrbitSwitch } from "./ui";

const PROVENANCE_LABELS = {
  user: "Added by you",
  import: "Imported from Contacts",
  share: "From a shared capture",
} as const;

/** The Button.tsx disabled look (D-26 "dimmed") for this file's Pressables. */
const DISABLED_OPACITY = 0.5;

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
  /**
   * Opens this item's edit form on first render, so its options (Allow AI,
   * Move to Recently Deleted, Cancel, Save) show without a tap on its card.
   * Used where the editor shows one known memory (post-log Edit Memory, D-73).
   */
  initiallyEditingId?: number;
  /**
   * Reports whether a draft form is open and holds typed changes (38.9 D-14),
   * on every change and `{ open: false, dirty: false }` on unmount. Optional:
   * consumers that do not guard the draft omit it.
   */
  onDraftStateChange?: (state: MemoryDraftState) => void;
  /**
   * When given, the form's Cancel calls this with the editor's own close
   * instead of closing at once, so the host can route it through the shared
   * dirty-aware `requestClose` (D-61). Absent → Cancel closes at once.
   */
  onCancelRequest?: (close: () => void) => void;
  /**
   * The host's save is in flight (38.9 fix-pass WR-01, IN-01): the form's
   * Cancel, Save, Move to Recently Deleted and Restore are held and drawn
   * disabled (D-26) until it settles. Allow AI ignores taps and is announced
   * busy, not drawn disabled, so it never shows Off over a stored On (the
   * OrbitSwitch `busy` rule, C5-M2). Absent → false.
   */
  busy?: boolean;
  /** Exposes `closeDraft()` so the host's Back can close the open draft (D-14). */
  ref?: Ref<MemoryEditorHandle>;
  testID?: string;
}

export interface MemoryDraftState {
  open: boolean;
  dirty: boolean;
}

export interface MemoryEditorHandle {
  /** Closes the open draft form without saving (no prompt). */
  closeDraft: () => void;
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
      {/* The trigger exposes the current kind as its value (38.4 RG-030,
          ui-accessibility/AUD-UIA-005), not only inside a combined label. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Memory type"
        accessibilityValue={{ text: selected }}
        accessibilityHint="Opens the memory type options"
        onPress={() => setOpen(true)}
        style={[
          styles.typeTrigger,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <AppText role="body">{selected}</AppText>
      </Pressable>
      <RegisteredModal
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
              renderItem={({ item }) => {
                const isSelected = item.type === value;
                // Selection is announced (accessibilityState) and marked with a
                // filled `select` glyph, never by colour alone (AUD-UIA-005).
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      onSelect(item.type);
                      setOpen(false);
                    }}
                    style={[styles.option, { borderColor: colors.border }]}
                  >
                    <AppText
                      role="body"
                      style={[
                        styles.optionLabel,
                        {
                          color: isSelected
                            ? colors.accentText
                            : colors.textPrimary,
                        },
                      ]}
                    >
                      {item.label}
                    </AppText>
                    {isSelected ? (
                      <Icon name="select" state="active" tone="accentText" />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </RegisteredModal>
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

/** Text fields compare blank-equivalent: typed-then-erased reads as untouched. */
function sameText(a: string | null, b: string | null): boolean {
  return (a ?? "") === (b ?? "");
}

/**
 * Whether an open draft differs from what it opened with (38.9 D-14, D-61):
 * `initial` is `initialDraft(editing ?? undefined)`. PURE.
 */
export function isMemoryDraftDirty(
  initial: MemoryDraft,
  draft: MemoryDraft,
): boolean {
  return !(
    initial.type === draft.type &&
    sameText(initial.customLabel, draft.customLabel) &&
    sameText(initial.value, draft.value) &&
    sameText(initial.note, draft.note) &&
    sameText(initial.url, draft.url) &&
    sameText(initial.meaningfulDate, draft.meaningfulDate) &&
    initial.pinned === draft.pinned &&
    initial.outdated === draft.outdated &&
    initial.hidden === draft.hidden
  );
}

/**
 * The draft as it is handed to `onAdd` / `onEdit`: blank optional text becomes
 * null and text is trimmed. A cleared (null) or blank meaningful date is null;
 * a picked one is already the stored YYYY-MM-DD (D-65). PURE.
 */
export function normalizeMemoryDraft(draft: MemoryDraft): MemoryDraft {
  return {
    ...draft,
    customLabel: blankToNull(draft.customLabel ?? ""),
    value: blankToNull(draft.value ?? ""),
    note: blankToNull(draft.note ?? ""),
    url: blankToNull(draft.url ?? ""),
    meaningfulDate: blankToNull(draft.meaningfulDate ?? ""),
  };
}

/** The draft state a host's guard reads (D-14). PURE. */
export function memoryDraftState(
  editing: MemoryRow | null,
  draft: MemoryDraft | null,
): MemoryDraftState {
  if (draft === null) return { open: false, dirty: false };
  return {
    open: true,
    dirty: isMemoryDraftDirty(initialDraft(editing ?? undefined), draft),
  };
}

/**
 * The editor's opening state: the form for `initiallyEditingId` when that item
 * is in `items`, otherwise closed (the cards alone). PURE (D-73).
 */
export function initialEditorState(
  items: readonly MemoryRow[],
  initiallyEditingId?: number,
): { editing: MemoryRow | null; draft: MemoryDraft | null } {
  const item =
    initiallyEditingId === undefined
      ? undefined
      : items.find((candidate) => candidate.id === initiallyEditingId);
  return item
    ? { editing: item, draft: initialDraft(item) }
    : { editing: null, draft: null };
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
  initiallyEditingId,
  onDraftStateChange,
  onCancelRequest,
  busy = false,
  ref,
  testID,
}: MemoryEditorProps) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState<MemoryRow | null>(
    () => initialEditorState(items, initiallyEditingId).editing,
  );
  const [draft, setDraft] = useState<MemoryDraft | null>(
    () => initialEditorState(items, initiallyEditingId).draft,
  );
  // The meaningful date's native picker (38.9 D-65), as TriStateLastSpoke does.
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  // Draft state for the host's guard (D-14). The callback is read through a
  // ref so a fresh closure each render never re-fires the report.
  const { open: draftOpen, dirty: draftDirty } = memoryDraftState(
    editing,
    draft,
  );
  const onDraftStateChangeRef = useRef(onDraftStateChange);
  onDraftStateChangeRef.current = onDraftStateChange;
  useEffect(() => {
    onDraftStateChangeRef.current?.({ open: draftOpen, dirty: draftDirty });
  }, [draftOpen, draftDirty]);
  useEffect(
    () => () => onDraftStateChangeRef.current?.({ open: false, dirty: false }),
    [],
  );
  useImperativeHandle(ref, () => ({ closeDraft: close }));
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
    const normalized = normalizeMemoryDraft(draft);
    const saved = editing
      ? await onEdit(editing.id, normalized)
      : await onAdd(normalized);
    if (saved) close();
  };
  // A pick stores the local YYYY-MM-DD through `update`, so it is a draft
  // change for the Plan 02 guard; a dismiss stores nothing (D-65, D-23).
  const onMeaningfulDatePicked = (event: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(false);
    const stored = storedFromPickerEvent(event.type, date);
    if (stored !== null) update("meaningfulDate", stored);
  };
  const meaningfulDate = draft?.meaningfulDate ?? null;
  const hasMeaningfulDate =
    meaningfulDate !== null && meaningfulDate.trim() !== "";
  // D-48 display, raw when it is not a date (legacy free text is shown as
  // stored, never migrated or repaired; D-65). "Pick a date" when empty (D-67).
  const meaningfulDateText = hasMeaningfulDate
    ? formatDisplayDateOrFallback(meaningfulDate, meaningfulDate)
    : "Pick a date";
  const meaningfulDateInvalid =
    hasMeaningfulDate && !isPickableStoredDate(meaningfulDate);
  const isCustom = draft?.type === "custom";
  const canSave = Boolean(
    draft &&
      blankToNull(draft.value ?? "") &&
      (!isCustom || blankToNull(draft.customLabel ?? "")),
  );
  // An outlined action the host's save holds: dimmed while busy (D-26).
  const heldActionStyle = [
    styles.action,
    { borderColor: colors.border },
    busy ? styles.disabled : null,
  ];

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
            <AppText role="body" style={{ color: colors.accentText }}>
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
              placeholderTextColor={colors.textPlaceholder}
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
            placeholderTextColor={colors.textPlaceholder}
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
            placeholderTextColor={colors.textPlaceholder}
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
            placeholderTextColor={colors.textPlaceholder}
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
          {/* Meaningful date (38.9 D-65, D-67): a native date picker, full
              date only, no range limit; optional, with Clear. */}
          <View style={styles.dateField}>
            <AppText role="label">Meaningful date (optional)</AppText>
            <View style={styles.dateRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Meaningful date"
                accessibilityValue={{ text: meaningfulDateText }}
                accessibilityHint="Opens the date picker"
                onPress={() => setShowDatePicker(true)}
                style={[
                  styles.input,
                  styles.dateTrigger,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <AppText
                  role="body"
                  style={{
                    color: hasMeaningfulDate
                      ? colors.textPrimary
                      : colors.textPlaceholder,
                  }}
                >
                  {meaningfulDateText}
                </AppText>
              </Pressable>
              {hasMeaningfulDate ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear meaningful date"
                  onPress={() => update("meaningfulDate", null)}
                  style={[styles.action, { borderColor: colors.border }]}
                >
                  <AppText role="body" style={{ color: colors.textSecondary }}>
                    Clear
                  </AppText>
                </Pressable>
              ) : null}
            </View>
            {meaningfulDateInvalid ? (
              <AppText role="caption" style={{ color: colors.danger }}>
                Not a date
              </AppText>
            ) : null}
            {showDatePicker ? (
              <DateTimePicker
                testID="memory-meaningful-date-picker"
                value={pickerSeedFromStored(meaningfulDate)}
                mode="date"
                onChange={onMeaningfulDatePicked}
              />
            ) : null}
          </View>
          <View style={styles.toggleRow}>
            <AppText role="body">Pin memory</AppText>
            <OrbitSwitch
              accessibilityLabel="Pin memory"
              value={draft.pinned}
              onValueChange={(value) => update("pinned", value)}
            />
          </View>
          <View style={styles.toggleRow}>
            <AppText role="body">Mark outdated</AppText>
            <OrbitSwitch
              accessibilityLabel="Mark outdated"
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
            <OrbitSwitch
              accessibilityLabel="Hide from Profile"
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
              <OrbitSwitch
                accessibilityLabel="Allow AI to use this"
                disabled={!globalAiEnabled}
                busy={busy}
                value={editing.allow_ai === 1}
                onValueChange={(allow) => {
                  if (busy) return; // held while the host saves (IN-01)
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
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={() => {
                  if (busy) return; // held while the host saves (IN-01)
                  onDelete(editing.id);
                  close();
                }}
                style={heldActionStyle}
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
                accessibilityState={{ disabled: busy }}
                // Held while busy by `disabled`; it has no local side effect
                // and the host also ignores it during a save (IN-01).
                disabled={busy}
                onPress={() => onRestore(editing.id)}
                style={heldActionStyle}
              >
                <AppText role="body" style={{ color: colors.accentText }}>
                  Restore
                </AppText>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() =>
                onCancelRequest ? onCancelRequest(close) : close()
              }
              style={heldActionStyle}
            >
              <AppText role="body" style={{ color: colors.textSecondary }}>
                Cancel
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={editing ? "Save memory" : "Add memory"}
              accessibilityState={{ disabled: !canSave || busy }}
              disabled={!canSave || busy}
              onPress={() => void commit()}
              style={[
                styles.action,
                {
                  backgroundColor: canSave ? colors.accent : colors.surface,
                  borderColor: canSave ? colors.accent : colors.border,
                },
                busy ? styles.disabled : null,
              ]}
            >
              <AppText
                role="body"
                style={{
                  color: canSave ? colors.onAccent : colors.textSecondary,
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
  dateField: { gap: SPACING.xs },
  dateRow: { alignItems: "center", flexDirection: "row", gap: SPACING.sm },
  dateTrigger: { flex: 1, justifyContent: "center" },
  disabled: { opacity: DISABLED_OPACITY },
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
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    minHeight: 44,
    justifyContent: "space-between",
    paddingHorizontal: SPACING.base,
  },
  optionLabel: { flex: 1 },
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
