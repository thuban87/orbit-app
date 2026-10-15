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
import {
  type AccessibilityActionEvent,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { RegisteredModal } from "@/components/ui/RegisteredModal";
import type { MemoryRow } from "@/db/memories-read";
import {
  DEFAULT_MEMORY_TYPE_KEY,
  HIDE_FROM_PROFILE_ENABLED,
  isMemoryTypeKey,
  MEMORY_TYPE_REGISTRY,
  type MemoryTypeKey,
  PROVISIONAL_MEMORY_LABEL,
} from "@/db/memory-registry";
import { aiLockReason, memoryAiLock } from "@/logic/ai-lock";
import { isValidLinkInput, LINK_FIELD_ERROR } from "@/logic/url-validation";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { formatDisplayDateOrFallback } from "@/utils/dates";
import {
  type AddPlacement,
  type CardEditSlot,
  cardEditSlots,
} from "./card-edit-slots";
import {
  isPickableStoredDate,
  pickerSeedFromStored,
  storedFromPickerEvent,
} from "./date-pick-logic";
import { Icon } from "./icons/Icon";
import { normaliseLinkUrl } from "./LinksEditor";
import { MemoryCard, memoryTypeLabel, openMemoryLink } from "./MemoryCard";
import { AppText, Button, EntryTextField, FieldError, OrbitSwitch } from "./ui";

const PROVENANCE_LABELS = {
  user: "Added by you",
  import: "Imported from Contacts",
  share: "From a shared capture",
} as const;

/** The Button.tsx disabled look (D-26 "dimmed") for this file's Pressables. */
const DISABLED_OPACITY = 0.5;

// D-35: only user-pickable types are offered; imported is written by the
// Contacts import alone.
const MEMORY_TYPE_OPTIONS = (
  Object.keys(MEMORY_TYPE_REGISTRY) as MemoryTypeKey[]
)
  .filter((type) => MEMORY_TYPE_REGISTRY[type].userPickable)
  .map((type) => ({ type, label: MEMORY_TYPE_REGISTRY[type].displayName }));

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
  /**
   * Allow AI is draft state (D-27): Save writes it, Cancel discards it.
   * Numeric because the draft flows unchanged into `CreateMemoryInput`
   * (checker cycle 3 W-3). A locked row stays 0 (D-98, D-102, D-103).
   */
  allowAi: 0 | 1;
}

export interface MemoryEditPatch extends MemoryDraft {}

/** Per-type Allow AI defaults for new entries (D-13, D-92); missing → 0. */
export type MemoryAiDefaults = Partial<Record<MemoryTypeKey, 0 | 1>>;

/**
 * One entry's name for the form heading and the add button ("Gift Idea" →
 * "Add Gift Idea" / "Edit Gift Idea"; D-137 W14, D-141). A function names
 * each entry by its own type (a host whose form has a type picker, Update
 * Contact).
 */
export type MemoryEntryNoun = string | ((type: MemoryTypeKey) => string);

/** The noun for an entry of `type`, or null without an `entryNoun`. PURE. */
function entryNounFor(
  entryNoun: MemoryEntryNoun | undefined,
  type: MemoryTypeKey,
): string | null {
  if (entryNoun === undefined) return null;
  return typeof entryNoun === "function" ? entryNoun(type) : entryNoun;
}

export interface MemoryEditorProps {
  items: MemoryRow[];
  /** Grouped callers render one editor per type; only the final group offers creation. */
  showAdd?: boolean;
  onAdd: (draft: MemoryDraft) => Promise<boolean>;
  onEdit: (id: number, patch: MemoryEditPatch) => Promise<boolean>;
  /**
   * Returns `false` (synchronously) when the host drops the delete because
   * its save is in flight; the form then stays open (38.9 third fix pass
   * IN-01). Any other return (nothing, `true`, a promise from an async host)
   * counts as accepted, so hosts that ignore this contract are unchanged.
   */
  onDelete: (id: number) => unknown;
  globalAiEnabled: boolean;
  /**
   * Opens this item's edit form on first render, so its options (Allow AI,
   * Delete, Cancel, Save) show without a tap on its card. The editor reads it
   * only when it mounts, so a host that loads first mounts the editor after
   * its read (the section editor's `editId`, D-107).
   */
  initiallyEditingId?: number;
  /**
   * Per-type Allow AI defaults seeding a new entry's switch (D-13, D-92).
   * Optional: a missing map or type gives 0 (fails closed).
   */
  aiDefaults?: MemoryAiDefaults;
  /**
   * Hides the type picker and forces this type on new entries (a section
   * host: the section editors, plan 14's inline Gift Ideas / Thought of Them).
   */
  fixedType?: MemoryTypeKey;
  /** No list: the add form is open from the start (plan 17's add screen). */
  addOnly?: boolean;
  /**
   * Opt-in solid primary Add (D-67: the Add/Edit Contact inline sections).
   * Absent → the outlined Add action ("Add memory", or "Add <noun>" with `entryNoun`).
   */
  addButton?: { label: string };
  /**
   * When set, tapping an entry linked to an interaction calls this instead of
   * opening its form; long-press and the "Edit" screen-reader action open the
   * form (D-107). Unlinked entries keep tap-to-edit.
   */
  onOpenLinked?: (item: MemoryRow) => void;
  /** A linked entry's immediate Pin / Unpin screen-reader action (D-107). */
  onTogglePin?: (item: MemoryRow) => void;
  /** Section editors: a hidden entry is dimmed with "Show on Profile" (D-17). */
  onShowOnProfile?: (item: MemoryRow) => void;
  /** Section editors: every entry offers "Move" (D-84). */
  onMove?: (item: MemoryRow) => void;
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
   * Cancel, Save and Delete are held and drawn disabled (D-26) until it
   * settles. Allow AI ignores taps and is announced busy, not drawn
   * disabled, so it never shows Off over a stored On (the OrbitSwitch `busy`
   * rule, C5-M2). The memory cards are held too (third
   * fix pass WR-02): a card tap would swap the draft being saved for that
   * memory's stored values, so a failed save would lose the typed edit.
   * Absent → false.
   */
  busy?: boolean;
  /**
   * Card edit mode (D-130; the section editors only): every card has a pencil;
   * an existing entry's form opens in place of its card, with Move (when
   * `onMove` is set) and a red Delete at its top and the Open link above its
   * fields; resting cards show no Move; while a form is open the other cards
   * and the Add are held. Absent → the editor renders exactly as before
   * (Add/Edit Contact, Update Contact, + → Memory).
   */
  cardEditMode?: boolean;
  /** Attached to the open form's outer View, so a host can scroll it into view. */
  formRef?: Ref<View>;
  /**
   * Called when an existing entry's form opens (its card's tap, long-press or
   * screen-reader Edit). A host whose form opens after the cards (Add/Edit
   * Contact, no card edit mode) scrolls `formRef` into view from here, so the
   * tap visibly opens something. Absent → nothing.
   */
  onEditOpen?: () => void;
  /**
   * Where the Add sits (D-131; the section editors). "top": the add slot comes
   * first and the editor renders NO Add of its own (the host renders the bar
   * and calls `openNew()` on the handle); a new entry's form opens in that
   * first slot. Absent → "end", the editor's own Add after the cards.
   */
  addPlacement?: AddPlacement;
  /**
   * The section's own entry name (D-137 W14; D-141): the form heading reads
   * "Add <noun>" / "Edit <noun>" and the add form's button (and the outlined
   * Add) "Add <noun>". The edit form's spoken "Save memory" stays. Absent →
   * "Add memory" / "Edit memory", unchanged.
   */
  entryNoun?: MemoryEntryNoun;
  /** Exposes `closeDraft()` so the host's Back can close the open draft (D-14). */
  ref?: Ref<MemoryEditorHandle>;
  testID?: string;
}

export interface MemoryDraftState {
  open: boolean;
  dirty: boolean;
  /** The open draft is a NEW entry (D-131: the host hides its top Add bar). */
  adding?: boolean;
}

export interface MemoryEditorHandle {
  /** Closes the open draft form without saving (no prompt). */
  closeDraft: () => void;
  /** Opens a new entry's form (held while the host saves, as the Add is). */
  openNew: () => void;
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
  // From the registry, so a non-pickable stored type (imported) still shows
  // its own name rather than the fallback noun.
  const selected =
    MEMORY_TYPE_REGISTRY[value]?.displayName ?? PROVISIONAL_MEMORY_LABEL;

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

/**
 * A registered type the user may not pick (imported, D-35): its row shows the
 * type as static text and can never be retyped from the editor.
 */
export function isLockedMemoryType(type: MemoryTypeKey): boolean {
  return !MEMORY_TYPE_REGISTRY[type].userPickable;
}

export function initialDraft(item?: MemoryRow): MemoryDraft {
  return {
    // D-25 G-01: keep the stored type; an unregistered one falls back.
    type:
      item !== undefined && isMemoryTypeKey(item.type)
        ? item.type
        : DEFAULT_MEMORY_TYPE_KEY,
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
    // A locked row stays 0 whatever is stored (D-98, D-102, D-103).
    allowAi:
      item !== undefined && memoryAiLock(item) === null && item.allow_ai === 1
        ? 1
        : 0,
  };
}

/**
 * A new entry's draft as the add form opens (38.9 D-14/D-15 baseline): the
 * host's fixed type or the default type, and that type's own Allow AI
 * default (D-13, D-92; 0 when the host passes no map). PURE.
 */
export function newMemoryDraft({
  fixedType,
  aiDefaults,
}: {
  fixedType?: MemoryTypeKey;
  aiDefaults?: MemoryAiDefaults;
} = {}): MemoryDraft {
  const type = fixedType ?? DEFAULT_MEMORY_TYPE_KEY;
  return { ...initialDraft(), type, allowAi: aiDefaults?.[type] ?? 0 };
}

/**
 * The draft after the user picks a type (convergence c1 F-U3): a new entry
 * whose switch is untouched takes the new type's default; a touched switch
 * and an existing entry keep their Allow AI (D-13: defaults affect new items
 * only). PURE.
 */
export function draftAfterTypeChange(
  draft: MemoryDraft,
  type: MemoryTypeKey,
  {
    aiDefaults,
    allowAiTouched,
    isNew,
  }: { aiDefaults?: MemoryAiDefaults; allowAiTouched: boolean; isNew: boolean },
): MemoryDraft {
  if (!isNew || allowAiTouched) return { ...draft, type };
  return { ...draft, type, allowAi: aiDefaults?.[type] ?? 0 };
}

/**
 * The Link field's error (G-13 via D-89): null when blank or a web address,
 * where a missing scheme is added only by `normaliseLinkUrl`. PURE.
 */
export function memoryLinkError(draft: MemoryDraft): string | null {
  return isValidLinkInput(draft.url ?? "", normaliseLinkUrl)
    ? null
    : LINK_FIELD_ERROR;
}

/**
 * Whether a draft can be saved: a non-blank value or a non-blank label, the
 * rule `addMemoryCore` / `editMemoryCore` enforce (D-86, D-89 NEW-9), and a
 * Link that is blank or valid (G-13). PURE.
 */
export function canSaveMemoryDraft(draft: MemoryDraft): boolean {
  return (
    (blankToNull(draft.value ?? "") !== null ||
      blankToNull(draft.customLabel ?? "") !== null) &&
    memoryLinkError(draft) === null
  );
}

/** Text fields compare blank-equivalent: typed-then-erased reads as untouched. */
function sameText(a: string | null, b: string | null): boolean {
  return (a ?? "") === (b ?? "");
}

/**
 * Whether an open draft differs from what it opened with (38.9 D-14, D-61):
 * `initial` is the draft as it was opened (its baseline). PURE.
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
    initial.hidden === draft.hidden &&
    initial.allowAi === draft.allowAi
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

/**
 * The draft state a host's guard reads (D-14): dirty against the draft as it
 * was opened (`baseline`), so an untouched seeded Add is clean (38.9 D-14/D-15;
 * convergence c7, Claude C-02). PURE.
 */
export function memoryDraftState(
  baseline: MemoryDraft | null,
  draft: MemoryDraft | null,
): MemoryDraftState {
  if (draft === null) return { open: false, dirty: false };
  return {
    open: true,
    dirty: isMemoryDraftDirty(baseline ?? initialDraft(), draft),
  };
}

export interface MemoryEditorOpeningState {
  editing: MemoryRow | null;
  draft: MemoryDraft | null;
  baseline: MemoryDraft | null;
}

/**
 * The editor's opening state: the form for `initiallyEditingId` when that item
 * is in `items`, otherwise closed (the cards alone). PURE (D-73).
 */
export function initialEditorState(
  items: readonly MemoryRow[],
  initiallyEditingId?: number,
): MemoryEditorOpeningState {
  const item =
    initiallyEditingId === undefined
      ? undefined
      : items.find((candidate) => candidate.id === initiallyEditingId);
  if (!item) return { editing: null, draft: null, baseline: null };
  const draft = initialDraft(item);
  return { editing: item, draft, baseline: draft };
}

/** The opening state for an `addOnly` editor or a list editor. PURE. */
function openingEditorState(
  items: readonly MemoryRow[],
  options: {
    addOnly: boolean;
    initiallyEditingId?: number;
    fixedType?: MemoryTypeKey;
    aiDefaults?: MemoryAiDefaults;
  },
): MemoryEditorOpeningState {
  if (!options.addOnly) {
    return initialEditorState(items, options.initiallyEditingId);
  }
  const draft = newMemoryDraft(options);
  return { editing: null, draft, baseline: draft };
}

/**
 * The editor's render order (D-130 card edit mode; see `cardEditSlots`): with
 * `cardEditMode` an open edit takes its card's index; otherwise every card,
 * then the form or the Add. PURE.
 */
export function memoryEditorSlots(input: {
  items: readonly MemoryRow[];
  editingId: number | null;
  adding: boolean;
  cardEditMode: boolean;
  addOnly: boolean;
  showAdd: boolean;
  addPlacement?: AddPlacement;
}): CardEditSlot<MemoryRow>[] {
  return cardEditSlots(input);
}

/** The linked-entry screen-reader action names (D-107). */
const EDIT_ACTION = "edit";
const TOGGLE_PIN_ACTION = "togglePin";

/** Memory form with parent-owned persistence; it deliberately imports no writer DAO. */
export function MemoryEditor({
  items,
  showAdd = true,
  onAdd,
  onEdit,
  onDelete,
  globalAiEnabled,
  initiallyEditingId,
  aiDefaults,
  fixedType,
  addOnly = false,
  addButton,
  onOpenLinked,
  onTogglePin,
  onShowOnProfile,
  onMove,
  onDraftStateChange,
  onCancelRequest,
  busy = false,
  cardEditMode = false,
  formRef,
  onEditOpen,
  addPlacement = "end",
  entryNoun,
  ref,
  testID,
}: MemoryEditorProps) {
  const { colors } = useTheme();
  const opening = () =>
    openingEditorState(items, {
      addOnly,
      initiallyEditingId,
      fixedType,
      aiDefaults,
    });
  const [editing, setEditing] = useState<MemoryRow | null>(
    () => opening().editing,
  );
  const [draft, setDraft] = useState<MemoryDraft | null>(() => opening().draft);
  // The draft as it was opened: the dirty baseline (38.9 D-14/D-15).
  const [baseline, setBaseline] = useState<MemoryDraft | null>(
    () => opening().baseline,
  );
  // Whether the user flipped Allow AI on the open draft (convergence c1 F-U3).
  const [allowAiTouched, setAllowAiTouched] = useState(false);
  // The meaningful date's native picker (38.9 D-65), as TriStateLastSpoke does.
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Single-flight Save (G-15): a double tap or Enter + tap commits once.
  const committingRef = useRef(false);

  const openNew = () => {
    if (busy) return; // held while the host saves (third fix pass WR-02)
    const seeded = newMemoryDraft({ fixedType, aiDefaults });
    setEditing(null);
    setDraft(seeded);
    setBaseline(seeded);
    setAllowAiTouched(false);
  };
  const openExisting = (item: MemoryRow) => {
    // Held while the host saves the open draft (third fix pass WR-02).
    if (busy) return;
    const opened = initialDraft(item);
    setEditing(item);
    setDraft(opened);
    setBaseline(opened);
    setAllowAiTouched(false);
    // The host's reveal waits a frame, so the form has mounted by then.
    onEditOpen?.();
  };
  const close = () => {
    setEditing(null);
    setDraft(null);
    setBaseline(null);
  };

  // Draft state for the host's guard (D-14). The callback is read through a
  // ref so a fresh closure each render never re-fires the report.
  const { open: draftOpen, dirty: draftDirty } = memoryDraftState(
    baseline,
    draft,
  );
  const adding = draft !== null && editing === null;
  const onDraftStateChangeRef = useRef(onDraftStateChange);
  onDraftStateChangeRef.current = onDraftStateChange;
  useEffect(() => {
    onDraftStateChangeRef.current?.({
      open: draftOpen,
      dirty: draftDirty,
      adding,
    });
  }, [draftOpen, draftDirty, adding]);
  useEffect(
    () => () => onDraftStateChangeRef.current?.({ open: false, dirty: false }),
    [],
  );
  useImperativeHandle(ref, () => ({ closeDraft: close, openNew }));
  const update = <K extends keyof MemoryDraft>(
    key: K,
    value: MemoryDraft[K],
  ) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };
  // D-98, D-102, D-103: a locked row's switch is off and disabled, and the
  // draft never carries 1 for it.
  const aiLock = editing ? memoryAiLock(editing) : null;
  const commit = async () => {
    if (!draft || busy || !canSaveMemoryDraft(draft)) return;
    if (committingRef.current) return;
    committingRef.current = true;
    try {
      const normalized = normalizeMemoryDraft(
        aiLock === null ? draft : { ...draft, allowAi: 0 },
      );
      const saved = editing
        ? await onEdit(editing.id, normalized)
        : await onAdd(normalized);
      if (saved) close();
    } finally {
      committingRef.current = false;
    }
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
  const canSave = draft !== null && canSaveMemoryDraft(draft);
  const linkError = draft === null ? null : memoryLinkError(draft);
  // The draft's type is fixed when it is not user-pickable (D-35).
  const typeLocked = draft !== null && isLockedMemoryType(draft.type);
  // D-137 W14 / D-141: the section's own entry name, when the host gives one.
  // The open form names its draft's type (it follows the type picker); the
  // closed Add names the type a new entry starts as.
  const formNoun = draft === null ? null : entryNounFor(entryNoun, draft.type);
  const formHeading = formNoun
    ? `${editing ? "Edit" : "Add"} ${formNoun}`
    : editing
      ? "Edit memory"
      : "Add memory";
  const addFormLabel = formNoun ? `Add ${formNoun}` : "Add memory";
  const newNoun = entryNounFor(entryNoun, fixedType ?? DEFAULT_MEMORY_TYPE_KEY);
  const outlinedAddLabel = newNoun ? `Add ${newNoun}` : "Add memory";
  // An outlined action the host's save holds: dimmed while busy (D-26).
  const heldActionStyle = [
    styles.action,
    { borderColor: colors.border },
    busy ? styles.disabled : null,
  ];

  // D-130 (this plan only: the Off Limits editor's `controlsHeld` rule): in
  // card edit mode an open form holds every other card and the Add, so a tap
  // never replaces a typed draft silently.
  const formHeld = cardEditMode && draft !== null;
  const cardsHeld = busy || formHeld;
  const addHeld = busy || draft !== null;
  const addActionStyle = [
    styles.action,
    { borderColor: colors.border },
    addHeld ? styles.disabled : null,
  ];

  const renderCard = (item: MemoryRow) => {
    // D-107: with a host that opens links, a linked entry's tap opens
    // its interaction; Edit and Pin/Unpin are on long-press and the
    // screen-reader actions. Unlinked entries keep tap-to-edit.
    const linked = onOpenLinked !== undefined && item.interaction_id !== null;
    const linkedProps = linked
      ? {
          onPress: () => {
            if (busy) return;
            onOpenLinked?.(item);
          },
          onLongPress: () => openExisting(item),
          // Proposed wording (this plan only; plan-19 wording review).
          accessibilityLabel: `Open the interaction for this ${memoryTypeLabel(item)} entry`,
          accessibilityHint: "Long-press or use actions to edit or pin.",
          accessibilityActions: [
            { name: EDIT_ACTION, label: "Edit" },
            ...(onTogglePin
              ? [
                  {
                    name: TOGGLE_PIN_ACTION,
                    label: item.pinned === 1 ? "Unpin" : "Pin",
                  },
                ]
              : []),
          ],
          onAccessibilityAction: (event: AccessibilityActionEvent) => {
            if (event.nativeEvent.actionName === EDIT_ACTION) {
              openExisting(item);
            } else if (
              event.nativeEvent.actionName === TOGGLE_PIN_ACTION &&
              !busy
            ) {
              onTogglePin?.(item);
            }
          },
        }
      : { onPress: () => openExisting(item) };
    return (
      <MemoryCard
        key={item.id}
        memory={item}
        // A card tap replaces the open draft, so the save holds it (WR-02).
        disabled={cardsHeld}
        {...linkedProps}
        // No Show on Profile while the switch is off (D-134).
        onShowOnProfile={
          HIDE_FROM_PROFILE_ENABLED && onShowOnProfile
            ? () => onShowOnProfile(item)
            : undefined
        }
        // D-130: in card edit mode Move is only in the open form.
        onMove={onMove && !cardEditMode ? () => onMove(item) : undefined}
        onEditPress={cardEditMode ? () => openExisting(item) : undefined}
      />
    );
  };

  // Outside card edit mode the Add renders only while no form is open.
  const renderAdd = () =>
    addButton ? (
      // D-67 opt-in: a solid primary Add (Add/Edit Contact, plan 14; the
      // section editors, D-130).
      <Button
        key="memory-editor-add"
        role="primary"
        label={addButton.label}
        disabled={addHeld}
        onPress={() => openNew()}
      />
    ) : (
      <Pressable
        key="memory-editor-add"
        accessibilityRole="button"
        accessibilityLabel={outlinedAddLabel}
        accessibilityState={{ disabled: addHeld }}
        disabled={addHeld}
        onPress={openNew}
        style={addActionStyle}
      >
        <AppText role="body" style={{ color: colors.accentText }}>
          {outlinedAddLabel}
        </AppText>
      </Pressable>
    );

  // D-130: Move closes the form through the host's dirty-aware close first,
  // then hands the stored row to the host's move sheet (38.9 D-14 via D-19).
  const moveFromForm = (row: MemoryRow) => {
    if (busy || !onMove) return;
    const closeThenMove = () => {
      close();
      onMove(row);
    };
    if (onCancelRequest) onCancelRequest(closeThenMove);
    else closeThenMove();
  };

  // The one form markup, rendered in place of its card (card edit mode) or
  // after the list (every other host).
  const renderForm = () => {
    if (draft === null) return null;
    return (
      <View
        key="memory-editor-form"
        ref={formRef}
        style={[
          styles.form,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {cardEditMode && editing ? (
          // D-130: Move (D-84 sections) and the red Delete only in edit
          // mode, at the top right of the open card.
          <View style={styles.formHeader}>
            <AppText role="heading" style={styles.formHeading}>
              {formHeading}
            </AppText>
            <View style={styles.formHeaderActions}>
              {onMove ? (
                <Button
                  role="secondary"
                  label="Move"
                  accessibilityLabel="Move"
                  disabled={busy}
                  onPress={() => moveFromForm(editing)}
                />
              ) : null}
              {/* D-69: Delete is immediate; the host deletes and owns Undo. */}
              <Button
                role="destructive"
                label="Delete"
                accessibilityLabel="Delete memory"
                disabled={busy}
                onPress={() => {
                  if (busy) return; // held while the host saves (IN-01)
                  if (onDelete(editing.id) === false) return;
                  close();
                }}
              />
            </View>
          </View>
        ) : (
          <AppText role="heading">{formHeading}</AppText>
        )}
        {cardEditMode && editing?.url ? (
          // D-130, D-24: the card's Open link stays in edit mode.
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Open memory link"
            hitSlop={8}
            onPress={() => openMemoryLink(editing.url ?? "")}
            style={styles.link}
          >
            <AppText role="caption" style={{ color: colors.accentText }}>
              Open link
            </AppText>
          </Pressable>
        ) : null}
        {typeLocked ? (
          // D-35: a non-pickable stored type (Imported) is shown, never
          // offered for change (convergence c3, Claude C-03).
          <AppText
            role="body"
            accessibilityLabel={`Memory type, ${MEMORY_TYPE_REGISTRY[draft.type].displayName}`}
            style={styles.typeStatic}
          >
            {MEMORY_TYPE_REGISTRY[draft.type].displayName}
          </AppText>
        ) : fixedType ? null : (
          <TypePicker
            value={draft.type}
            onSelect={(type) =>
              setDraft((current) =>
                current
                  ? draftAfterTypeChange(current, type, {
                      aiDefaults,
                      allowAiTouched,
                      isNew: editing === null,
                    })
                  : current,
              )
            }
          />
        )}
        {/* D-86: every memory type takes an optional label. */}
        <TextInput
          accessibilityLabel="Label (optional)"
          value={draft.customLabel ?? ""}
          onChangeText={(value) => update("customLabel", value)}
          placeholder="Label (optional)"
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
        {/* D-66: the shared entry field; Enter runs the same guarded
              commit as Save, so it never submits what Save refuses. */}
        <EntryTextField
          accessibilityLabel="Memory value"
          value={draft.value ?? ""}
          onChangeText={(value) => update("value", value)}
          onSubmit={() => void commit()}
          placeholder="What should you remember?"
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
        <FieldError message={linkError} testID="memory-link-error" />
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
        {/* Hide from Profile is switched off (D-134): the row is gated, not
              removed, and the draft keeps the stored `hidden` unchanged. */}
        {HIDE_FROM_PROFILE_ENABLED ? (
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
        ) : null}
        {/* D-27: Allow AI is draft state on the Add and Edit forms alike;
              Save writes it and Cancel discards it. */}
        <View style={styles.toggleRow}>
          <View style={styles.visibilityCopy}>
            <AppText role="body">Allow AI to use this</AppText>
            {aiLock !== null ? (
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                {aiLockReason(aiLock)}
              </AppText>
            ) : !globalAiEnabled ? (
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                Turn on AI in Settings first
              </AppText>
            ) : null}
          </View>
          <OrbitSwitch
            accessibilityLabel="Allow AI to use this"
            disabled={aiLock !== null || !globalAiEnabled}
            busy={busy}
            value={aiLock === null && draft.allowAi === 1}
            onValueChange={(allow) => {
              if (busy || aiLock !== null) return; // held / locked
              setAllowAiTouched(true);
              update("allowAi", allow ? 1 : 0);
            }}
          />
        </View>
        {editing ? (
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            {provenanceLabel(editing.provenance)}
          </AppText>
        ) : null}
        <View style={styles.actions}>
          {editing && !cardEditMode ? (
            // D-69: Delete is immediate; the host deletes and owns Undo.
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete memory"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => {
                if (busy) return; // held while the host saves (IN-01)
                // Close only when the host takes the delete (third fix
                // pass IN-01).
                if (onDelete(editing.id) === false) return;
                close();
              }}
              style={heldActionStyle}
            >
              <AppText role="body" style={{ color: colors.danger }}>
                Delete
              </AppText>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => (onCancelRequest ? onCancelRequest(close) : close())}
            style={heldActionStyle}
          >
            <AppText role="body" style={{ color: colors.textSecondary }}>
              Cancel
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editing ? "Save memory" : addFormLabel}
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
              {editing ? "Save" : addFormLabel}
            </AppText>
          </Pressable>
        </View>
      </View>
    );
  };

  const slots = memoryEditorSlots({
    items,
    editingId: editing?.id ?? null,
    adding,
    cardEditMode,
    addOnly,
    showAdd,
    addPlacement,
  });

  return (
    <View testID={testID} style={styles.container}>
      {slots.map((slot) =>
        slot.kind === "card"
          ? renderCard(slot.item)
          : slot.kind === "form"
            ? renderForm()
            : // D-131: with the Add at the top the host renders the bar.
              addPlacement === "top"
              ? null
              : renderAdd(),
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
  formHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "space-between",
  },
  formHeaderActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "flex-end",
    marginLeft: "auto",
  },
  formHeading: { flexShrink: 1, paddingTop: SPACING.sm },
  input: {
    borderRadius: SPACING.sm,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  link: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44 },
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
  typeStatic: {
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
    textAlignVertical: "center",
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
