/**
 * CustomFieldsScreen — the Settings → Custom Fields management surface
 * (§14.10 item 1). Lists field DEFINITIONS, creates/edits/reorders them, runs
 * the dynamic delete/quarantine action, and drives a type change through the
 * pre-flight summary. This composes the whole Phase-3 data layer into the
 * user-facing capability of FLD-02/03/04/05 and the FLD-07 curation flags.
 *
 * STORAGE (migration 006 / ADR-001): a field is a row in `custom_field_defs`;
 * its values are rows in `custom_field_values`, one per (contact, field). The
 * screen NEVER builds SQL: label/type/options input reaches the database only
 * through the tested DAO / field-ddl ops (makeColName in FieldDefForm derives
 * the stable slug kept on the definition) — the T-03-01 trust-boundary
 * mitigation. No DDL runs here; there are no per-field columns.
 *
 * DATA-SAFETY (§14.5 / T-03-02): the delete control is dynamic — the field's
 * value count decides Delete (immediate, no values) vs Quarantine (kept for
 * QUARANTINE_WINDOW_DAYS, has values). `deleteOrQuarantineField` re-checks
 * emptiness atomically, so the label here is an affordance and the DAO is the
 * guard.
 *
 * LIST (38.12 D-120): active fields are one reorderable list — a drag handle
 * and a ⋯ menu per row, no inline buttons, the destructive item last inside ⋯.
 *
 * TYPE / OPTIONS changes (§14.4): a type change runs `preflightTypeChange` and
 * shows the "N of M values will convert automatically. K need your input"
 * summary as the SINGLE confirmation (no separate second prompt), then
 * `applyTypeChange` with the CURRENT type so `field_history` records the
 * transition; an options edit runs `preflightOptionsChange` before
 * `changeFieldOptions` the same way. Values are never rewritten by a type
 * change. The type pre-flight checks the target type AND options (38.12 B-5);
 * when it flagged values, a "Review now" / "Later" offer follows the applied
 * change and opens the CustomFieldReview list (38.12 D-121).
 *
 * Every colour resolves through `useTheme().colors.*` — no colour literal
 * (CLAUDE.md). The executor comes from `getExecutor()` (Plan 07).
 */
import { type NavigationProp, useNavigation } from "@react-navigation/native";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ReorderableList, {
  type ReorderableListRenderItemInfo,
  type ReorderableListReorderEvent,
  useReorderableDrag,
} from "react-native-reorderable-list";
import {
  FIELD_TYPE_LABELS,
  type FieldDefDraft,
  FieldDefForm,
} from "@/components/FieldDefForm";
import { Icon } from "@/components/icons/Icon";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  AnchoredMenu,
  type AnchoredMenuItem,
} from "@/components/ui/AnchoredMenu";
import { QUARANTINE } from "@/constants/glossary";
import { resolveNewItemAiDefault } from "@/db/ai-permissions-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { createField, deleteOrQuarantineField } from "@/db/field-ddl";
import {
  changeFieldOptions,
  countFieldValues,
  listDefs,
  renameField,
  reorderFields,
  restoreField,
  updateFieldCuration,
  updateFieldShareWithAi,
} from "@/db/field-defs-dao";
import {
  applyTypeChange,
  preflightOptionsChange,
  preflightTypeChange,
} from "@/db/field-type-change";
import type { CustomFieldDef, NewFieldDef } from "@/db/field-types";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { SettingsStackParamList } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { QUARANTINE_WINDOW_DAYS } from "@/services/field-sweep";
import { confirm, notice } from "@/stores/confirm-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { formatDisplayDateOrFallback, parseLocalMs } from "@/utils/dates";
import { Logger } from "@/utils/logger";
import { plural, pluralWord } from "@/utils/plural";
import { beginInFlight, endInFlight } from "@/utils/single-flight";

const LOG_SCOPE = "custom-fields";

/** The active editor: creating a new def, or editing an existing one. */
type Editor =
  | { mode: "create" }
  | { mode: "edit"; field: CustomFieldDef }
  | null;

/** "1 needs your input" / "4 need your input" (38.12 D-71). */
function needsInput(count: number): string {
  return `${count} ${pluralWord(count, "needs", "need")} your input — fix now or later.`;
}

/**
 * Human summary of a type-change pre-flight: the §14.4 confirmation text
 * ("8 of 12 values will convert automatically. 4 need your input — fix now or
 * later."), every count agreeing in number (38.12 D-71, D-24). With nothing to
 * fix the "need your input" clause is left out (38.12 D-139).
 */
export function typeSummary(pf: {
  total: number;
  convert: readonly number[];
  flag: readonly number[];
}) {
  const converts = `${pf.convert.length} of ${plural(pf.total, "value")} will convert automatically.`;
  return pf.flag.length === 0
    ? converts
    : `${converts} ${needsInput(pf.flag.length)}`;
}

/**
 * The offer after a type change, or a dropdown options edit (38.12 D-153),
 * that flagged values (38.12 D-121): go fix them now on the "Review now" list,
 * or later. It is an offer, not a second confirmation to run the change
 * (D-24); the change has already applied.
 */
export function reviewOffer(label: string, flagged: number) {
  return {
    title: `${label} changed`,
    message: `${plural(flagged, "value")} ${pluralWord(flagged, "needs", "need")} your input.`,
    confirmLabel: "Review now",
    cancelLabel: "Later",
  };
}

/**
 * Human summary of an options-change pre-flight (same shape as typeSummary).
 * With nothing to fix the "need your input" clause is left out, as for a type
 * change (38.12 D-153, D-139 parity).
 */
export function optionsSummary(pf: {
  total: number;
  keep: readonly number[];
  flag: readonly number[];
}) {
  const kept = `${pf.keep.length} of ${plural(pf.total, "value")} will be kept.`;
  return pf.flag.length === 0 ? kept : `${kept} ${needsInput(pf.flag.length)}`;
}

/**
 * The display date a quarantined field is kept until (38.12 D-72): its
 * `quarantined_at` plus QUARANTINE_WINDOW_DAYS, the window the launch sweep
 * applies (field-sweep.ts). Null when the stored stamp cannot be read.
 */
export function quarantineKeptUntil(quarantinedAt: string): string | null {
  let kept: Date;
  try {
    kept = new Date(parseLocalMs(quarantinedAt));
  } catch {
    return null;
  }
  kept.setDate(kept.getDate() + QUARANTINE_WINDOW_DAYS);
  return formatDisplayDateOrFallback(kept, "") || null;
}

function typeLabel(type: CustomFieldDef["type"]): string {
  return FIELD_TYPE_LABELS[type] ?? type;
}

/**
 * A pre-flight summary as ONE themed gate (38.9 D-27). Non-destructive and
 * dismissable: Back or the scrim cancel, exactly like Cancel.
 */
function confirmSummary(title: string, message: string): Promise<boolean> {
  return confirm({ title, message, confirmLabel: "Apply", dismissable: true });
}

/** Move one row from `from` to `to` without mutating the source. */
export function moveFieldRows<T>(rows: readonly T[], from: number, to: number) {
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}

type FieldRowAction = "edit" | "up" | "down" | "remove";

/**
 * The ⋯ items for an active field row (D-120): Edit, Move up / Move down where
 * the row can move, and the destructive item last behind a separator. The
 * destructive item follows the data (D-24, HANDOFF §14.5): "Delete" for a
 * field with no values, "Quarantine" for one that has values.
 */
export function fieldMenuItems(input: {
  index: number;
  total: number;
  empty: boolean;
  onAction: (action: FieldRowAction) => void;
}): AnchoredMenuItem[] {
  const { index, total, empty, onAction } = input;
  return [
    {
      id: "edit",
      label: "Edit",
      icon: "edit",
      onPress: () => onAction("edit"),
    },
    ...(index > 0
      ? [
          {
            id: "up",
            label: "Move up",
            icon: "sort" as const,
            onPress: () => onAction("up"),
          },
        ]
      : []),
    ...(index < total - 1
      ? [
          {
            id: "down",
            label: "Move down",
            icon: "sort" as const,
            onPress: () => onAction("down"),
          },
        ]
      : []),
    {
      id: "remove",
      label: empty ? "Delete" : QUARANTINE,
      icon: "warning",
      danger: true,
      separatorBefore: true,
      onPress: () => onAction("remove"),
    },
  ];
}

/** Returns accessibility focus to a row's ⋯ once its menu closes. */
function useRowMenu() {
  const anchorRef = useRef<View>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    requestAnimationFrame(() => {
      const node = findNodeHandle(anchorRef.current);
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
    });
  }, []);
  return { anchorRef, menuOpen, openMenu: () => setMenuOpen(true), closeMenu };
}

function FieldRow({
  field,
  index,
  total,
  empty,
  onAction,
}: {
  field: CustomFieldDef;
  index: number;
  total: number;
  empty: boolean;
  onAction: (action: FieldRowAction) => void;
}) {
  const { colors } = useTheme();
  const drag = useReorderableDrag();
  const { anchorRef, menuOpen, openMenu, closeMenu } = useRowMenu();
  return (
    <View
      testID={`field-row-${field.id}`}
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Pressable
        testID={`field-drag-${field.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Reorder ${field.label}`}
        accessibilityHint="Long press and drag to reorder fields"
        onLongPress={drag}
        style={styles.iconTarget}
      >
        <Icon name="sort" size="md" tone="textSecondary" />
      </Pressable>
      <View style={styles.rowMain}>
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
          {field.label}
        </Text>
        <Text style={[styles.rowType, { color: colors.textSecondary }]}>
          {typeLabel(field.type)}
        </Text>
      </View>
      <Pressable
        ref={anchorRef}
        testID={`field-options-${field.id}`}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`Options for ${field.label}`}
        accessibilityState={{ expanded: menuOpen }}
        onPress={openMenu}
        style={styles.iconTarget}
      >
        <Icon name="overflow" size="md" tone="textSecondary" />
      </Pressable>
      <AnchoredMenu
        anchorRef={anchorRef}
        visible={menuOpen}
        accessibilityLabel={`Options for ${field.label}`}
        items={fieldMenuItems({ index, total, empty, onAction })}
        onRequestClose={closeMenu}
      />
    </View>
  );
}

/** A quarantined field: no drag (it keeps its place after the active ones). */
function QuarantinedFieldRow({
  field,
  onRestore,
}: {
  field: CustomFieldDef;
  onRestore: () => void;
}) {
  const { colors } = useTheme();
  const { anchorRef, menuOpen, openMenu, closeMenu } = useRowMenu();
  const keptUntil =
    field.quarantined_at === null
      ? null
      : quarantineKeptUntil(field.quarantined_at);
  return (
    <View
      testID={`quarantined-row-${field.id}`}
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.borderStrong },
      ]}
    >
      <View style={styles.rowMain}>
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
          {field.label}
        </Text>
        <Text style={[styles.rowType, { color: colors.textSecondary }]}>
          {keptUntil === null
            ? typeLabel(field.type)
            : `${typeLabel(field.type)} · kept until ${keptUntil}`}
        </Text>
      </View>
      <Pressable
        ref={anchorRef}
        testID={`field-options-${field.id}`}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`Options for ${field.label}`}
        accessibilityState={{ expanded: menuOpen }}
        onPress={openMenu}
        style={styles.iconTarget}
      >
        <Icon name="overflow" size="md" tone="textSecondary" />
      </Pressable>
      <AnchoredMenu
        anchorRef={anchorRef}
        visible={menuOpen}
        accessibilityLabel={`Options for ${field.label}`}
        items={[{ id: "restore", label: "Restore", onPress: onRestore }]}
        onRequestClose={closeMenu}
      />
    </View>
  );
}

/**
 * Back is the shared header's (38.9 D-16, D-44), rendered once above the
 * list/editor switch so every branch has it (review M4). With the field editor
 * open, the header's `goBack()` fires `beforeRemove`, which the sub-editor
 * guard below turns into the same dirty-aware close as the hardware Back
 * (D-14); the editor's own Cancel keeps `requestClose` (D-61).
 */
export function CustomFieldsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<SettingsStackParamList>>();
  // The last item scrolls fully above the shell FAB (38.4 D-52, OA-E3).
  const bottomClearance = useBottomClearance();
  const [defs, setDefs] = useState<CustomFieldDef[]>([]);
  // Contacts holding a value, per field: decides Delete vs Quarantine and
  // feeds "has values for N contacts" (D-72).
  const [valueCountById, setValueCountById] = useState<Record<number, number>>(
    {},
  );
  const [editor, setEditor] = useState<Editor>(null);
  const [newFieldShareDefault, setNewFieldShareDefault] = useState<0 | 1>(0);

  // In-screen sub-editor guard (G-04; D-14, D-61; RESEARCH DC-08): Back with
  // the field editor open closes it and stays (asking only when it holds typed
  // changes); its Cancel follows the same rule. A successful create/edit
  // closes directly through setEditor(null), with no prompt.
  const [editorDirty, setEditorDirty] = useState(false);
  // A create or edit is in flight (fix-pass WR-02). The ref is what the guard
  // reads at removal time; the state draws the header Back and the form's
  // Cancel and submit disabled (D-26; WR-02 follow-up).
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const bypassRef = useRef(false);
  const closeEditor = () => {
    setEditor(null);
    setEditorDirty(false);
  };
  const { requestClose, settleHold } = useDiscardKeepGuard({
    hasUnsavedChanges: false,
    bypassRef,
    // A create or edit in flight (its pre-flight summary included) holds every
    // exit, with no prompt and no editor close (fix-pass WR-02).
    busyRef: savingRef,
    subEditor: {
      open: editor !== null,
      dirty: editorDirty,
      close: closeEditor,
    },
  });

  /** Load all defs (incl. quarantined) and each field's value count. */
  const load = useCallback(async () => {
    try {
      const exec = getExecutor();
      const [all, shareDefault] = await Promise.all([
        listDefs(exec, { includeQuarantined: true }),
        resolveNewItemAiDefault(exec, "custom-field"),
      ]);
      const counts: Record<number, number> = {};
      for (const d of all) {
        counts[d.id] = await countFieldValues(exec, d.id);
      }
      setDefs(all);
      setNewFieldShareDefault(shareDefault);
      setValueCountById(counts);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load custom fields", err);
      void notice({
        title: "Couldn't load custom fields",
        message: "Please reopen this screen.",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = useMemo(
    () => defs.filter((d) => d.quarantined_at === null),
    [defs],
  );
  const quarantined = useMemo(
    () => defs.filter((d) => d.quarantined_at !== null),
    [defs],
  );

  // The create path uniquifies the slug against EVERY definition's col_name,
  // incl. quarantined ones, so a re-created label can't collide.
  const existingColNames = useMemo(
    () => new Set(defs.map((d) => d.col_name)),
    [defs],
  );
  const nextDisplayOrder = useMemo(
    () =>
      defs.length === 0 ? 0 : Math.max(...defs.map((d) => d.display_order)) + 1,
    [defs],
  );

  function reportError(err: unknown) {
    Logger.error(LOG_SCOPE, "field mutation failed", err);
    showSnackbar({
      kind: "error",
      label: "Couldn't update field. Please try again.",
    });
  }

  async function handleCreate(def: NewFieldDef) {
    if (!beginInFlight(savingRef)) return;
    setSaving(true);
    try {
      await createField(getExecutor(), def);
      setEditor(null);
      await load();
    } catch (err) {
      reportError(err);
    } finally {
      setSaving(false);
      endInFlight(savingRef);
      settleHold();
    }
  }

  async function handleEdit(field: CustomFieldDef, draft: FieldDefDraft) {
    if (!beginInFlight(savingRef)) return;
    setSaving(true);
    const exec = getExecutor();
    // Values the type change (D-121) or the dropdown options edit (D-153)
    // flagged, offered for review once it has applied.
    let flaggedByChange = 0;
    let applied = false;
    try {
      const labelChanged = draft.label !== field.label;
      const curationChanged =
        draft.show_on_new !== field.show_on_new ||
        draft.always_show !== field.always_show;
      const shareChanged = draft.share_with_ai !== field.share_with_ai;
      const typeChanged = draft.type !== field.type;
      const optionsChanged = draft.options !== field.options;

      // ALL-OR-NOTHING ON CANCEL (WR-03): the pre-flight summary is an
      // interactive gate, and the pre-flights (preflightTypeChange /
      // preflightOptionsChange) are strictly READ-ONLY. Run the gate FIRST,
      // before ANY write, so that cancelling it discards the entire edit —
      // label/curation are no longer committed ahead of a cancelled type or
      // options change. A type change and an options edit are mutually
      // exclusive gates (a type change to dropdown carries its options through
      // the type pre-flight), mirroring the original branch structure.
      if (typeChanged) {
        // The target type AND options (convergence c2 B-5): a text →
        // dropdown change flags values that are not among the new options.
        const pf = await preflightTypeChange(exec, field, {
          type: draft.type,
          options: draft.options,
        });
        if (!(await confirmSummary("Change field type", typeSummary(pf)))) {
          return; // cancelled — nothing has been written
        }
        flaggedByChange = pf.flag.length;
      } else if (optionsChanged) {
        const pf = await preflightOptionsChange(exec, field, draft.options);
        if (
          !(await confirmSummary("Change dropdown options", optionsSummary(pf)))
        ) {
          return; // cancelled — nothing has been written
        }
        // D-153: the same "Review now" offer when stored values are no longer
        // options (only a dropdown's options are written below).
        if (draft.type === "dropdown") flaggedByChange = pf.flag.length;
      }

      // Every gate passed — apply each diff. Each DAO op owns its OWN
      // `inWriteTransaction`; they are NEVER composed inside an outer
      // transaction (the shared mutex is non-reentrant — transaction.ts).
      // Label — a stable-slug rename edits `label` only.
      if (labelChanged) {
        await renameField(exec, field.id, draft.label, localDateTime());
      }
      // Curation flags — persisted via updateFieldCuration.
      if (curationChanged) {
        await updateFieldCuration(
          exec,
          field.id,
          draft.show_on_new,
          draft.always_show,
          localDateTime(),
        );
      }
      // Type change — applyTypeChange with the CURRENT type so field_history
      // records the transition (blast radius zero — no value rewrite). It runs
      // BEFORE the share write (38.12 review C-WR-01): the share writer clamps
      // a photo field to off against the STORED type, so a Photo → Text edit
      // with "Share with AI" turned on must reach it already as Text. A change
      // TO photo still ends off (both writers clamp, D-129/D-138).
      if (typeChanged) {
        await applyTypeChange(
          exec,
          { id: field.id, col_name: field.col_name, type: field.type },
          draft.type,
          localDateTime(),
        );
      }
      // AI-sharing opt-in — persisted via its own DEFS-row flag writer so a
      // toggled opt-in survives the edit (H7). Same standalone-transaction idiom
      // as the curation write; never composed inside an outer transaction.
      if (shareChanged) {
        await updateFieldShareWithAi(
          exec,
          field.id,
          draft.share_with_ai,
          localDateTime(),
        );
      }
      // Options persist whenever the edited field IS a dropdown and its options
      // moved — covering both a same-type options edit and a type change INTO
      // dropdown (matches the original behaviour, which only wrote options when
      // draft.type === "dropdown").
      if (optionsChanged && draft.type === "dropdown") {
        await changeFieldOptions(
          exec,
          field.id,
          draft.options,
          localDateTime(),
        );
      }

      setEditor(null);
      applied = true;
      await load();
    } catch (err) {
      reportError(err);
    } finally {
      setSaving(false);
      endInFlight(savingRef);
      settleHold();
    }
    // 38.12 D-121 / D-153: after a type change or an options edit that
    // flagged values, offer the "Review now" list. An offer to go fix, not a
    // second confirmation to run the change (D-24): the change has already
    // applied. No offer when nothing was flagged.
    if (applied && flaggedByChange > 0) {
      const reviewNow = await confirm({
        ...reviewOffer(draft.label, flaggedByChange),
        dismissable: true,
      });
      if (reviewNow) {
        navigation.navigate("CustomFieldReview", { fieldDefId: field.id });
      }
    }
  }

  /**
   * Move one active field from `from` to `to` (drag end, or Move up / Move
   * down). The reorder runs over the FULL set (active first, quarantined
   * after) so display_order stays a clean contiguous total order. The new
   * order shows at once so a dropped row stays where it landed; the reload
   * after the write (or after a failure) re-reads the stored order.
   */
  async function reorderActive(from: number, to: number) {
    if (from === to || to < 0 || to >= active.length) return;
    const reordered = moveFieldRows(active, from, to);
    const orderedIds = [
      ...reordered.map((d) => d.id),
      ...quarantined.map((d) => d.id),
    ];
    setDefs([...reordered, ...quarantined]);
    try {
      await reorderFields(getExecutor(), orderedIds, localDateTime());
    } catch (err) {
      reportError(err);
    }
    await load();
  }

  function onFieldAction(
    field: CustomFieldDef,
    index: number,
    action: FieldRowAction,
  ) {
    if (action === "edit") setEditor({ mode: "edit", field });
    else if (action === "up") void reorderActive(index, index - 1);
    else if (action === "down") void reorderActive(index, index + 1);
    else void onDeletePress(field);
  }

  async function onDeletePress(field: CustomFieldDef) {
    const count = valueCountById[field.id] ?? 0;
    const empty = count === 0;
    const verb = empty ? "Delete" : QUARANTINE;
    // The body says why the action differs (D-72): the field's values decide
    // it (HANDOFF §14.5, D-24).
    const message = empty
      ? `"${field.label}" has no values, so it will be deleted permanently.`
      : `"${field.label}" has values for ${plural(count, "contact")}, so it will be quarantined for ${QUARANTINE_WINDOW_DAYS} days. You can restore it before then.`;
    // An empty field is deleted permanently: a destructive, non-dismissable
    // confirm (D-06, ADR-086). A field with values is quarantined, which is
    // recoverable for the window (HANDOFF §14.5; "Quarantine" stays, D-41), so
    // it stays a plain dismissable confirm, as before.
    const confirmed = await confirm({
      title: `${verb} field`,
      message,
      confirmLabel: verb,
      destructive: empty,
    });
    if (confirmed) await doDelete(field);
  }

  async function doDelete(field: CustomFieldDef) {
    try {
      await deleteOrQuarantineField(
        getExecutor(),
        { id: field.id, col_name: field.col_name },
        localDateTime(),
      );
      await load();
    } catch (err) {
      reportError(err);
    }
  }

  async function doRestore(field: CustomFieldDef) {
    try {
      await restoreField(getExecutor(), field.id, localDateTime());
      await load();
    } catch (err) {
      reportError(err);
    }
  }

  // -- The create/edit form takes over the body when open; the header stays. --
  let body: ReactNode;
  if (editor !== null && editor.mode === "create") {
    body = (
      <FieldDefForm
        mode="create"
        existingColNames={existingColNames}
        nextDisplayOrder={nextDisplayOrder}
        initialShareWithAi={newFieldShareDefault}
        bottomClearance={bottomClearance}
        onDirtyChange={setEditorDirty}
        onSubmit={(def) => void handleCreate(def)}
        onCancel={() => requestClose(closeEditor, editorDirty)}
        busy={saving}
      />
    );
  } else if (editor !== null) {
    const editing = editor.field;
    body = (
      <FieldDefForm
        mode="edit"
        field={editing}
        bottomClearance={bottomClearance}
        onDirtyChange={setEditorDirty}
        onSubmit={(draft) => void handleEdit(editing, draft)}
        onCancel={() => requestClose(closeEditor, editorDirty)}
        busy={saving}
      />
    );
  } else {
    body = (
      <ReorderableList
        testID="custom-fields-screen"
        data={active}
        keyExtractor={(field) => String(field.id)}
        onReorder={({ from, to }: ReorderableListReorderEvent) =>
          void reorderActive(from, to)
        }
        style={styles.list}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
        ListHeaderComponent={
          <Pressable
            testID="custom-fields-new"
            accessibilityRole="button"
            accessibilityLabel="New field"
            onPress={() => setEditor({ mode: "create" })}
            style={[
              styles.newBtn,
              { backgroundColor: colors.accent, borderColor: colors.accent },
            ]}
          >
            <Text style={{ color: colors.onAccent, fontWeight: "600" }}>
              New field
            </Text>
          </Pressable>
        }
        ListEmptyComponent={
          <Text
            testID="custom-fields-empty"
            style={[styles.emptyNote, { color: colors.textSecondary }]}
          >
            No custom fields yet. Add one to start describing your people.
          </Text>
        }
        renderItem={({
          item,
          index,
        }: ReorderableListRenderItemInfo<CustomFieldDef>) => (
          <FieldRow
            field={item}
            index={index}
            total={active.length}
            empty={(valueCountById[item.id] ?? 0) === 0}
            onAction={(action) => onFieldAction(item, index, action)}
          />
        )}
        ListFooterComponent={
          quarantined.length > 0 ? (
            <View
              testID="custom-fields-quarantined"
              style={styles.quarantineSection}
            >
              <Text
                style={[styles.sectionHeading, { color: colors.textSecondary }]}
              >
                Quarantined
              </Text>
              {quarantined.map((field) => (
                <QuarantinedFieldRow
                  key={field.id}
                  field={field}
                  onRestore={() => void doRestore(field)}
                />
              ))}
            </View>
          ) : null
        }
      />
    );
  }

  return (
    <View style={styles.root}>
      {/* While a create or edit runs the guard holds Back (D-26; WR-02). */}
      <ShellAppBar
        variant="child"
        title="Custom Fields"
        backDisabled={saving}
      />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: 16,
    gap: 12,
  },
  newBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  emptyNote: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  list: { flex: 1 },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  rowMain: {
    flex: 1,
    gap: 2,
    paddingLeft: 4,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  rowType: {
    fontSize: 13,
  },
  iconTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  quarantineSection: {
    gap: 10,
    marginTop: 8,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
