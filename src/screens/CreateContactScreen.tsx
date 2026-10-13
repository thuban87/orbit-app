/**
 * CreateContactScreen (CRUD-01 / CRUD-02) — the lean create form. Fixed block
 * (Name → Category → Frequency → Last-spoke → Phone) FIRST, the `show_on_new`
 * custom block AFTER it, never interleaved (06-crud Cluster A). Save assembles a
 * single `createContactFull` call (one transaction), warns on a duplicate live
 * name, and `navigation.replace`s to the new contact's Profile so Back does not
 * return to the form. Started from the Settings tab (`host="settings"`), Save
 * instead pops the Settings stack back to where the user started and opens the
 * new Profile in the Contacts tab (D-50), where its Message action is live.
 *
 * The screen builds NO SQL and re-implements NO widget: the custom block maps
 * `defsForCreateForm` through `FieldValueInput` verbatim, and every value crosses
 * into the DAO as a bound param (T-04-02). All input-shaping correctness lives in
 * the node-tested `create-contact-logic.ts` (canSave gate, buildCreateInput) —
 * this file is the RN shell + navigation, device-UAT at the phase gate.
 *
 * CRUD-01 fix: the typed Phone is carried into the create input (previously
 * collected but dropped). Frequency defaults to Monthly (30) so a name-only save
 * succeeds — the DAO hard-rejects a non-positive interval, and an invalid custom
 * entry blocks Save before it can reach the DAO.
 *
 * 38.10 plan 14 (D-05, D-65, D-67, D-119): behind Show More the Things to
 * Remember sections are filled in on the form itself, in the same set and
 * order as Edit Contact (D-44) minus Imported (D-116): Last Talked About and
 * Current Location as always-visible "add an entry" rows (the shared D-66
 * field, Enter only closes the keyboard, a date capped at today; D-101,
 * D-121), Key People, Memories, Thought of Them, Gift Ideas and an inline Off
 * Limits list, each with a solid Add. Memory and Key People drafts carry
 * stable ids from one decrementing counter, so a delete in one section never
 * shifts another section's open form onto a different draft (convergence c7,
 * Claude C-04). Allow AI reads the real AI master and the per-type defaults
 * (D-27, D-92). Every entry field centres above the keyboard (D-66).
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { ContactMethodsEditor } from "@/components/ContactMethodsEditor";
import { CategoryChoiceSheet } from "@/components/category/CategoryChoiceSheet";
import {
  addMethodDraft,
  choosePrimary,
  type MethodGroups,
  removeMethodDraft,
  resolveEffectivePhoneRegion,
  updateMethodDraft,
} from "@/components/contact-methods-editor-model";
import { FieldValueInput } from "@/components/FieldValueInput";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import {
  type MemoryAiDefaults,
  type MemoryDraft,
  type MemoryDraftState,
  MemoryEditor,
  type MemoryEditorHandle,
  type MemoryEditPatch,
} from "@/components/MemoryEditor";
import {
  OffLimitsInlineEditor,
  type OffLimitsInlineEditorHandle,
  type OffLimitsInlineFields,
  type OffLimitsInlineItem,
} from "@/components/OffLimitsInlineEditor";
import {
  type RelationshipDraft,
  type RelationshipDraftState,
  RelationshipEditor,
  type RelationshipEditorHandle,
} from "@/components/RelationshipEditor";
import { ShellAppBar } from "@/components/ShellAppBar";
import { TriStateLastSpoke } from "@/components/TriStateLastSpoke";
import type { LastSpokeValue } from "@/components/tri-state-last-spoke-logic";
import {
  AccordionSection,
  AppText,
  Button,
  EntryDateField,
  EntryTextField,
  FieldError,
  KeyboardCenteringProvider,
  OptionSelectRow,
  useKeyboardCentering,
} from "@/components/ui";
import {
  clearFieldError,
  type FieldErrors,
  firstBlockingField,
  toFieldErrors,
} from "@/components/ui/field-error-logic";
import { useFirstErrorReveal } from "@/components/ui/use-first-error-reveal";
import {
  ADD_GIFT_IDEA,
  ADD_MEMORY,
  ADD_OFF_LIMITS_ITEM,
  ADD_THOUGHT_OF_THEM,
} from "@/constants/glossary";
import {
  getAiPermissionDefaults,
  memoryAiDefaultsMap,
} from "@/db/ai-permissions-dao";
import { getAppSettings } from "@/db/app-settings-dao";
import { isDuplicateName, listCategories } from "@/db/contact-read";
import { createContactFull } from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { listDefs } from "@/db/field-defs-dao";
import type { CustomFieldDef } from "@/db/field-types";
import { defsForCreateForm } from "@/db/field-values-dao";
import type { MemoryRow } from "@/db/memories-read";
import type { RelationshipRow } from "@/db/relationships-read";
import { newUid } from "@/db/uid";
import { useCategoryCatalogRefresh } from "@/hooks/use-category-catalog-refresh";
import { isAiMasterEnabled } from "@/logic/ai-enablement";
import { resolveCategorySelection } from "@/logic/category-logic";
import type { ContactMethodType } from "@/logic/contact-method-normalization";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import { navigationRef } from "@/navigation/linking";
import { openProfileInContactsTab } from "@/navigation/tab-entry";
import type { RootStackScreenProps } from "@/navigation/types";
import { getDeviceRegion } from "@/services/device-region";
import { confirm, notice } from "@/stores/confirm-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { formatLocalDate } from "@/utils/dates";
import { Logger } from "@/utils/logger";
import { beginInFlight, endInFlight } from "@/utils/single-flight";
import {
  addDraftItem,
  buildCreateInput,
  CREATE_FIELD_REVEAL_ORDER,
  CREATE_SECTION_FIELD_MAP,
  type CreateFormState,
  canSave,
  collectBlockingErrors,
  coordinateBoundToggle,
  coordinateCadenceSelection,
  createFormSeedSignature,
  createFormSeedState,
  type DraftItem,
  isCreateFormDirty,
  partitionMemoryRows,
  pickCreateSubEditor,
  removeDraftItem,
  replaceDraftItem,
  resolveErrorSection,
} from "./create-contact-logic";
import type { OffLimitsDraftRow } from "./edit-contact-logic";
import { sectionTitle } from "./section-editor-logic";

const LOG_SCOPE = "create-contact";

/**
 * The duplicate-name warning as ONE themed gate (D-27): Cancel, Back or a scrim
 * tap resolve false (nothing is written); "Save anyway" resolves true.
 */
function confirmDuplicate(name: string): Promise<boolean> {
  return confirm({
    title: "Duplicate name",
    message: `You already have a ${name} — save anyway?`,
    confirmLabel: "Save anyway",
    dismissable: true,
  });
}

/**
 * The clean baseline for the unsaved-work guard (D-15): built from the seed
 * function, never from live form state, so it exists from the first render.
 */
const CREATE_FORM_SEED_SIGNATURE = createFormSeedSignature(
  createFormSeedState(),
);

const CLOSED_DRAFT = { open: false, dirty: false } as const;

/** Enter in the two "add an entry" boxes only closes the keyboard (D-121). */
function dismissKeyboard(): void {
  Keyboard.dismiss();
}

// -- Draft → display-row adapters ---------------------------------------------
// The Show-More sections reuse the profile enrichment editors (same vocabulary as
// Edit Contact), but on the CREATE path there is no contact row yet: drafts are
// collected in local state and persisted ATOMICALLY by `createContactFull` on
// Save. These adapters render collected drafts as the editors' committed-row
// shape. Each draft's id is its stable counter id, never its array position
// (convergence c7, Claude C-04 / Cursor CU-02).
const DRAFT_TS = "";

function memoryDraftToRow(item: DraftItem<MemoryDraft>): MemoryRow {
  const { draft } = item;
  return {
    id: item.id,
    uid: "",
    contact_id: 0,
    type: draft.type,
    custom_label: draft.customLabel,
    value: draft.value,
    note: draft.note,
    url: draft.url,
    meaningful_date: draft.meaningfulDate,
    pinned: draft.pinned ? 1 : 0,
    outdated: draft.outdated ? 1 : 0,
    hidden: draft.hidden === null ? null : draft.hidden ? 1 : 0,
    provenance: "user",
    created_at: DRAFT_TS,
    modified_at: DRAFT_TS,
    deleted_at: null,
    // The draft's own choice, so reopening an AI-on draft shows it on (D-27;
    // convergence c1 F-U5, Codex C-12).
    allow_ai: draft.allowAi ?? 0,
    interaction_id: null,
    link_source: null,
    group_note_copy: 0,
    linked_note_ai_locked: 0,
  };
}

function relationshipDraftToRow(
  item: DraftItem<RelationshipDraft>,
): RelationshipRow {
  const { draft } = item;
  return {
    id: item.id,
    uid: "",
    contact_id: 0,
    person_name: draft.personName,
    relation_type: draft.relationType,
    linked_contact_id: draft.linkedContactId,
    // RelationshipEditor resolves the live linked name itself (plan 15, G-16).
    linked_contact_name: null,
    note: draft.note,
    pinned: draft.pinned ? 1 : 0,
    hidden: draft.hidden,
    created_at: DRAFT_TS,
    modified_at: DRAFT_TS,
    deleted_at: null,
  };
}

function offLimitsDraftToItem(row: OffLimitsDraftRow): OffLimitsInlineItem {
  return {
    id: row.id ?? 0,
    text: row.text ?? null,
    label: row.label ?? null,
    url: row.url ?? null,
  };
}

export type CreateContactScreenProps = RootStackScreenProps<"Create"> & {
  /**
   * Set by the Settings stack's wrapper (SettingsCreateHostRoute). A Settings-
   * hosted Profile disables Message (ADR-166 / 38.3 D-25), so a contact created
   * from Settings finishes on its Profile in the Contacts tab instead (D-50).
   */
  host?: "settings";
};

export function CreateContactScreen({
  navigation,
  host,
}: CreateContactScreenProps) {
  const { colors } = useTheme();
  // Every seeded field starts from the same seed the guard's baseline uses.
  const [seed] = useState(createFormSeedState);

  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [createDefs, setCreateDefs] = useState<CustomFieldDef[]>([]);

  // Fixed-block state.
  const [name, setName] = useState(seed.name);
  const [categoryId, setCategoryId] = useState<number | null>(seed.categoryId);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  // A contact created without touching cadence is Unbound (trackingEnabled=false)
  // with no cadence (intervalDays=null) — NOT the prior Monthly + Bound default
  // (CAPT-03, dossier §F). Unbound never gates Save on cadence, so intervalValid
  // starts true. Binding turns the gate on via coordinateBoundToggle.
  const [intervalDays, setIntervalDays] = useState<number | null>(
    seed.intervalDays,
  );
  const [intervalValid, setIntervalValid] = useState(seed.intervalValid);
  const [trackingEnabled, setTrackingEnabled] = useState(seed.trackingEnabled);
  const [lastSpoke, setLastSpoke] = useState<LastSpokeValue>(seed.lastSpoke);
  const [methods, setMethods] = useState<MethodGroups>(seed.methods);
  const [effectivePhoneRegion, setEffectivePhoneRegion] = useState<
    string | null
  >(getDeviceRegion());
  // Custom-block value map, keyed by col_name.
  const [values, setValues] = useState<Record<string, string | null>>(
    seed.values,
  );
  const [saving, setSaving] = useState(false);
  // The synchronous save guard (verification IN-04): `saving` is render state
  // for the disabled look; this ref is what makes Save single-flight, so a
  // second tap can neither run its own save nor re-enable Save early.
  const savingRef = useRef(false);

  // CONTROLLED accordion disclosure. Identity opens by default (the fewest-taps
  // create path); the parent owns which sections are open so a blocked Save can
  // reveal the erroring section (CAPT-14, Task 4). Advanced enrichment lives
  // behind Show More (Task 3).
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    identity: true,
    relationship: false,
    methods: false,
    lastTalked: false,
    keyPeople: false,
    currentLocation: false,
    memories: false,
    thoughtOfThem: false,
    giftIdeas: false,
    custom: false,
    offLimits: false,
  });
  const setSectionExpanded = useCallback((sectionId: string, next: boolean) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: next }));
  }, []);

  // Inline field errors (38.9 D-19, E-02): the message renders under its
  // field and clears when that field changes; Save stays pressable.
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const clearError = useCallback((field: string) => {
    setFieldErrors((current) => clearFieldError(current, field));
  }, []);

  // Reveal-and-focus targets (CAPT-14, D-19): the ScrollView + its inner
  // content view (the measure reference, E-X01), each section's root View, and
  // the Name field, so a blocked Save can expand the erroring section, scroll
  // its first invalid field into view and focus it.
  const { scrollRef, contentRef, reveal } = useFirstErrorReveal();
  const sectionRefs = useRef<Record<string, View | null>>({});
  const registerSectionRef = useCallback(
    (sectionId: string) => (node: View | null) => {
      sectionRefs.current[sectionId] = node;
    },
    [],
  );
  const nameFieldRef = useRef<View>(null);
  const nameInputRef = useRef<TextInput>(null);
  const revealAndFocus = useCallback(
    (field: string, sectionId: string) => {
      setSectionExpanded(sectionId, true);
      // The reveal runs a frame later, after the expand and the error text
      // have laid out. Best-effort: the expand is the load-bearing reveal; a
      // measure failure leaves the section open, just not auto-scrolled.
      const isName = field === "name";
      reveal(
        {
          get current() {
            return (
              (isName ? nameFieldRef.current : null) ??
              sectionRefs.current[sectionId]
            );
          },
        },
        isName ? nameInputRef : null,
      );
    },
    [reveal, setSectionExpanded],
  );

  // Show-More advanced enrichment (CAPT-01). All optional; each draft flows into
  // the single atomic create transaction via buildCreateInput — no rendered
  // control fails to persist (Review HIGH #4).
  const [showMore, setShowMore] = useState(false);
  // Memory, Key People and Off Limits drafts keep stable ids from one
  // decrementing counter, as Edit Contact's newRowIdRef does (convergence c7,
  // Claude C-04 / Cursor CU-02): Save, edit and delete find a draft by id.
  const newDraftIdRef = useRef(-1);
  const [memoryDraftItems, setMemoryDraftItems] = useState<
    DraftItem<MemoryDraft>[]
  >([]);
  const [relationshipDraftItems, setRelationshipDraftItems] = useState<
    DraftItem<RelationshipDraft>[]
  >([]);
  const [lastTalkedAbout, setLastTalkedAbout] = useState(seed.lastTalkedAbout);
  const [lastTalkedAboutDate, setLastTalkedAboutDate] = useState<
    string | undefined
  >(undefined);
  const [currentLocation, setCurrentLocation] = useState(seed.currentLocation);
  const [currentLocationDate, setCurrentLocationDate] = useState<
    string | undefined
  >(undefined);
  // Off Limits drafts are always Off Limits (D-11; NEW-1).
  const [offLimitsDrafts, setOffLimitsDrafts] = useState<OffLimitsDraftRow[]>(
    [],
  );
  // The real AI master (D-27) and the per-type new-item defaults (D-13,
  // D-92), as Edit Contact reads them. Until they load the switch stays off.
  const [globalAiEnabled, setGlobalAiEnabled] = useState(false);
  const [aiDefaults, setAiDefaults] = useState<MemoryAiDefaults | undefined>(
    undefined,
  );

  const commitCategories = useCallback(
    (current: Array<{ id: number; name: string }>) => {
      setCategories(current);
      setCategoryId((selected) => resolveCategorySelection(current, selected));
    },
    [],
  );
  const requestInitialCategories = useCategoryCatalogRefresh(commitCategories);

  const load = useCallback(async () => {
    try {
      const exec = getExecutor();
      const [defs, settings, permissionDefaults] = await Promise.all([
        listDefs(exec, { includeQuarantined: false }),
        getAppSettings(exec),
        getAiPermissionDefaults(exec),
      ]);
      setCreateDefs(defsForCreateForm(defs));
      setGlobalAiEnabled(isAiMasterEnabled(settings));
      setAiDefaults(memoryAiDefaultsMap(permissionDefaults));
      setEffectivePhoneRegion(
        resolveEffectivePhoneRegion(
          settings.phoneRegionOverride,
          getDeviceRegion(),
        ),
      );
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load create-form data", err);
      // Blocking (D-27): the form cannot be used as loaded.
      void notice({
        title: "Couldn't load the form",
        message: "Please reopen this screen.",
      });
    }
  }, []);

  useEffect(() => {
    void load();
    void requestInitialCategories();
  }, [load, requestInitialCategories]);

  const formState: CreateFormState = useMemo(
    () => ({
      name,
      categoryId,
      intervalDays,
      intervalValid,
      trackingEnabled,
      lastSpoke,
      methods,
      values,
      memories: memoryDraftItems.map((item) => item.draft),
      relationships: relationshipDraftItems.map((item) => item.draft),
      lastTalkedAbout,
      lastTalkedAboutDate,
      currentLocation,
      currentLocationDate,
      offLimits: offLimitsDrafts,
    }),
    [
      name,
      categoryId,
      intervalDays,
      intervalValid,
      trackingEnabled,
      lastSpoke,
      methods,
      values,
      memoryDraftItems,
      relationshipDraftItems,
      lastTalkedAbout,
      lastTalkedAboutDate,
      currentLocation,
      currentLocationDate,
      offLimitsDrafts,
    ],
  );

  // Unsaved-work guard (E-01; D-13, D-15): on from the first render, compared
  // against the seed, never waiting for a loaded baseline.
  const bypassRef = useRef(false);
  // The in-section editors keep an open draft's typing privately until it is
  // added (C5-M1; D-13, D-14): an open draft with typed text holds Back
  // (closing it first) and holds a fold of its section (D-68 under D-13). An
  // open empty draft never holds the user. Each MemoryEditor host has its own
  // ref and draft state (Memories, Thought of Them, Gift Ideas). Last Talked
  // About and Current Location have no draft (D-119): typed text there is
  // form dirt.
  const memoryEditorRef = useRef<MemoryEditorHandle>(null);
  const thoughtOfThemEditorRef = useRef<MemoryEditorHandle>(null);
  const giftIdeasEditorRef = useRef<MemoryEditorHandle>(null);
  const relationshipEditorRef = useRef<RelationshipEditorHandle>(null);
  const offLimitsEditorRef = useRef<OffLimitsInlineEditorHandle>(null);
  const [memoryDraft, setMemoryDraft] =
    useState<MemoryDraftState>(CLOSED_DRAFT);
  const [thoughtOfThemDraft, setThoughtOfThemDraft] =
    useState<MemoryDraftState>(CLOSED_DRAFT);
  const [giftIdeasDraft, setGiftIdeasDraft] =
    useState<MemoryDraftState>(CLOSED_DRAFT);
  const [relationshipDraft, setRelationshipDraft] =
    useState<RelationshipDraftState>(CLOSED_DRAFT);
  // The inline Off Limits editor's add or edit form (38.9 review CR-01).
  const [offLimitsDraft, setOffLimitsDraft] =
    useState<MemoryDraftState>(CLOSED_DRAFT);
  const pickedDraft = pickCreateSubEditor({
    memory: memoryDraft,
    relationship: relationshipDraft,
    offLimits: offLimitsDraft,
    giftIdeas: giftIdeasDraft,
    thoughtOfThem: thoughtOfThemDraft,
  });
  const { requestClose, settleHold } = useDiscardKeepGuard({
    hasUnsavedChanges: isCreateFormDirty(
      CREATE_FORM_SEED_SIGNATURE,
      createFormSeedSignature(formState),
    ),
    bypassRef,
    // A save in flight holds every exit, with no prompt (fix-pass WR-02).
    busyRef: savingRef,
    subEditor: {
      open: pickedDraft.open,
      dirty: pickedDraft.dirty,
      close: () => {
        if (pickedDraft.which === "memory") {
          memoryEditorRef.current?.closeDraft();
        } else if (pickedDraft.which === "relationship") {
          relationshipEditorRef.current?.closeDraft();
        } else if (pickedDraft.which === "offLimits") {
          offLimitsEditorRef.current?.closeDraft();
        } else if (pickedDraft.which === "giftIdeas") {
          giftIdeasEditorRef.current?.closeDraft();
        } else if (pickedDraft.which === "thoughtOfThem") {
          thoughtOfThemEditorRef.current?.closeDraft();
        }
      },
    },
  });

  // Every shared entry field on the form centres above the keyboard through
  // the provider below (D-66; convergence c1 F-U1).
  const { centering, bottomSpacer } = useKeyboardCentering({
    scrollRef,
    contentRef,
  });

  // -- Draft mutators: one list per kind, edited by stable id. --
  const addMemoryDraft = async (draft: MemoryDraft): Promise<boolean> => {
    const id = newDraftIdRef.current--;
    setMemoryDraftItems((prev) => addDraftItem(prev, draft, id));
    return true;
  };
  const editMemoryDraft = async (
    id: number,
    patch: MemoryEditPatch,
  ): Promise<boolean> => {
    setMemoryDraftItems((prev) => replaceDraftItem(prev, id, patch));
    return true;
  };
  const deleteMemoryDraft = (id: number) => {
    setMemoryDraftItems((prev) => removeDraftItem(prev, id));
  };
  const addOffLimitsDraft = (fields: OffLimitsInlineFields) => {
    const id = newDraftIdRef.current--;
    setOffLimitsDrafts((prev) => [...prev, { ...fields, id }]);
  };
  const editOffLimitsDraft = (id: number, fields: OffLimitsInlineFields) => {
    setOffLimitsDrafts((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...fields } : row)),
    );
  };
  const deleteOffLimitsDraft = (id: number) => {
    setOffLimitsDrafts((prev) => prev.filter((row) => row.id !== id));
  };

  // One memory list, split into its sections every render (convergence c3,
  // Claude C-02). Each row keeps its stable draft id.
  const memoryBuckets = partitionMemoryRows(
    memoryDraftItems.map(memoryDraftToRow),
  );
  // The two "add an entry" dates default to today and cannot pass it (D-101).
  const todayStored = formatLocalDate(new Date());
  const todayDate = new Date();

  const savable = canSave(formState) && !saving;

  async function handleSave() {
    if (savingRef.current) return;
    // Blocking validation reveals + focuses the erroring accordion rather than
    // silently no-op'ing a disabled button; the form state is preserved and no
    // completion is shown (CAPT-14, dossier §AD).
    const blocking = collectBlockingErrors(formState);
    const errors = toFieldErrors(blocking);
    setFieldErrors(errors);
    if (blocking.length > 0) {
      const field =
        firstBlockingField(CREATE_FIELD_REVEAL_ORDER, errors) ??
        blocking[0].field;
      const sectionId =
        CREATE_SECTION_FIELD_MAP[field] ??
        resolveErrorSection(blocking, CREATE_SECTION_FIELD_MAP);
      if (sectionId) revealAndFocus(field, sectionId);
      return;
    }
    const trimmed = name.trim();
    // Claimed before the first await, so it covers the duplicate-name confirm.
    if (!beginInFlight(savingRef)) return;
    setSaving(true);
    try {
      const exec = getExecutor();
      const currentCategories = await listCategories(exec);
      const currentCategoryId = resolveCategorySelection(
        currentCategories,
        categoryId,
      );
      setCategories(currentCategories);
      if (currentCategoryId !== categoryId) setCategoryId(currentCategoryId);
      // Duplicate-name warning fires on save (non-blocking, "save anyway").
      if (await isDuplicateName(exec, trimmed)) {
        if (!(await confirmDuplicate(trimmed))) {
          return; // Cancel — nothing is written.
        }
      }
      const input = buildCreateInput(
        { ...formState, categoryId: currentCategoryId },
        {
          now: localDateTime(),
          contactUid: newUid(),
          interactionUid: newUid(),
          createDefs,
          effectivePhoneRegion,
        },
      );
      const { contactId } = await createContactFull(exec, input);
      // Saved: leave for the new Profile without a prompt (D-08, Pitfall 6).
      bypassRef.current = true;
      if (host === "settings") {
        // D-50: the Settings stack returns to where the user started, and the
        // new person opens in the Contacts tab.
        navigation.goBack();
        openProfileInContactsTab(navigationRef.current, contactId);
      } else {
        navigation.replace("Profile", { contactId });
      }
    } catch (err) {
      bypassRef.current = false;
      Logger.error(LOG_SCOPE, "failed to save contact", err);
      showSnackbar({
        kind: "error",
        label: "Couldn't save contact. Please try again.",
      });
    } finally {
      endInFlight(savingRef);
      settleHold();
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      {/* House header (38.9 D-16, D-44): its Back calls goBack, which the
          unsaved-work guard above intercepts (D-13). While a save runs the
          guard holds Back, so the header draws it disabled (D-26; WR-02). */}
      <ShellAppBar variant="child" title="New contact" backDisabled={saving} />
      <ScrollView
        ref={scrollRef}
        innerViewRef={contentRef}
        testID="create-contact-screen"
        contentContainerStyle={styles.content}
      >
        <KeyboardCenteringProvider value={centering}>
          {/* -- Identity section (Name + Category) — open by default (CAPT-01). -- */}
          <AccordionSection
            sectionId="identity"
            title="Identity"
            expanded={expandedSections.identity}
            onExpandedChange={(next) => setSectionExpanded("identity", next)}
            containerRef={registerSectionRef("identity")}
          >
            <View ref={nameFieldRef} style={styles.field}>
              <AppText role="label" style={{ color: colors.textSecondary }}>
                Name
              </AppText>
              <TextInput
                ref={nameInputRef}
                testID="create-contact-name"
                accessibilityLabel="Name"
                value={name}
                onChangeText={(next) => {
                  setName(next);
                  clearError("name");
                }}
                placeholder="Their name"
                placeholderTextColor={colors.textPlaceholder}
                style={[
                  styles.input,
                  {
                    color: colors.textPrimary,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              />
              <FieldError
                testID="create-contact-name-error"
                message={fieldErrors.name}
              />
            </View>

            <View style={styles.field}>
              <AppText role="label" style={{ color: colors.textSecondary }}>
                Category
              </AppText>
              <OptionSelectRow
                testID="create-contact-category"
                label="Category"
                currentLabel={
                  categories.find((row) => row.id === categoryId)?.name ??
                  "Uncategorized"
                }
                onPress={() => setCategorySheetOpen(true)}
              />
              <CategoryChoiceSheet
                visible={categorySheetOpen}
                categories={categories}
                selectedId={categoryId}
                onSelect={setCategoryId}
                onRequestClose={() => setCategorySheetOpen(false)}
              />
            </View>
          </AccordionSection>

          {/* -- Relationship Basics: last-spoke + cadence/Bound coordination. -- */}
          <AccordionSection
            sectionId="relationship"
            title="Relationship Basics"
            expanded={expandedSections.relationship}
            onExpandedChange={(next) =>
              setSectionExpanded("relationship", next)
            }
            containerRef={registerSectionRef("relationship")}
          >
            <View style={styles.field}>
              <AppText role="label" style={{ color: colors.textSecondary }}>
                Last spoke
              </AppText>
              <TriStateLastSpoke
                testID="create-contact-last-spoke"
                value={lastSpoke}
                onChange={setLastSpoke}
              />
            </View>

            <View style={styles.field}>
              <AppText role="label" style={{ color: colors.textSecondary }}>
                Orbit participation
              </AppText>
              <View style={styles.lifecycleChoices}>
                {([true, false] as const).map((enabled) => {
                  const selected = trackingEnabled === enabled;
                  const label = enabled ? "Bound" : "Unbound";
                  return (
                    <Pressable
                      key={label}
                      testID={`create-contact-${label.toLowerCase()}`}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityState={{ selected }}
                      onPress={() => {
                        // Coordinate cadence + Bound as one unit (CAPT-03): binding
                        // with no cadence gates Save until a valid interval is picked;
                        // unbinding retains any interval as dormant.
                        const next = coordinateBoundToggle(
                          { intervalDays },
                          enabled,
                        );
                        setTrackingEnabled(next.trackingEnabled);
                        setIntervalDays(next.intervalDays);
                        setIntervalValid(next.intervalValid);
                        clearError("frequency");
                      }}
                      style={[
                        styles.lifecycleChoice,
                        {
                          borderColor: selected ? colors.accent : colors.border,
                          backgroundColor: selected
                            ? colors.accent
                            : colors.surface,
                        },
                      ]}
                    >
                      <AppText
                        role="label"
                        style={{
                          color: selected
                            ? colors.onAccent
                            : colors.textPrimary,
                        }}
                      >
                        {label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                {trackingEnabled
                  ? "Bound contacts appear in your active orbit and get reach-out reminders."
                  : "Unbound contacts keep their details and history without reach-out reminders."}
              </AppText>
            </View>

            {trackingEnabled ? (
              <View style={styles.field}>
                <AppText role="label" style={{ color: colors.textSecondary }}>
                  Frequency
                </AppText>
                <FrequencyPicker
                  testID="create-contact-frequency"
                  value={intervalDays ?? 0}
                  onChange={(v) => {
                    // Selecting a cadence turns Bound on (CAPT-03).
                    const next = coordinateCadenceSelection(v);
                    setTrackingEnabled(next.trackingEnabled);
                    setIntervalDays(next.intervalDays);
                    clearError("frequency");
                  }}
                  onValidityChange={setIntervalValid}
                />
              </View>
            ) : null}
          </AccordionSection>

          {/* -- Contact Methods section. -- */}
          <AccordionSection
            sectionId="methods"
            title="Contact Methods"
            expanded={expandedSections.methods}
            onExpandedChange={(next) => setSectionExpanded("methods", next)}
            containerRef={registerSectionRef("methods")}
          >
            <ContactMethodsEditor
              testID="create-contact-methods"
              methods={methods}
              onAdd={(type: ContactMethodType) =>
                setMethods((current) => addMethodDraft(current, type, newUid()))
              }
              onUpdate={(uid, patch) =>
                setMethods((current) => updateMethodDraft(current, uid, patch))
              }
              onRemove={(uid) =>
                setMethods((current) => removeMethodDraft(current, uid))
              }
              onChoosePrimary={(uid) =>
                setMethods((current) => choosePrimary(current, uid))
              }
            />
          </AccordionSection>

          {/* -- Show More: reveals the advanced enrichment sections (dossier §D). -- */}
          {showMore ? (
            <>
              {/* Last Talked About: an always-visible "add an entry" row
              (D-65, D-119). Enter only closes the keyboard (D-121); the form's
              Save records the entry with its capped date (D-101). */}
              <AccordionSection
                sectionId="lastTalked"
                title="Last Talked About"
                expanded={expandedSections.lastTalked}
                onExpandedChange={(next) =>
                  setSectionExpanded("lastTalked", next)
                }
              >
                <View style={styles.field}>
                  <EntryTextField
                    testID="create-contact-last-talked"
                    accessibilityLabel="Last talked about"
                    value={lastTalkedAbout}
                    onChangeText={setLastTalkedAbout}
                    onSubmit={dismissKeyboard}
                    placeholder="What did you last talk about?"
                  />
                  <EntryDateField
                    testID="create-contact-last-talked-date"
                    accessibilityLabel="Last talked about date"
                    value={lastTalkedAboutDate ?? todayStored}
                    onChange={setLastTalkedAboutDate}
                    maxDate={todayDate}
                  />
                </View>
              </AccordionSection>

              <AccordionSection
                sectionId="keyPeople"
                title="Key People"
                expanded={expandedSections.keyPeople}
                onExpandedChange={(next) =>
                  next
                    ? setSectionExpanded("keyPeople", true)
                    : requestClose(() => {
                        relationshipEditorRef.current?.closeDraft();
                        setSectionExpanded("keyPeople", false);
                      }, relationshipDraft.dirty)
                }
              >
                <RelationshipEditor
                  contactId={0}
                  ref={relationshipEditorRef}
                  onDraftStateChange={setRelationshipDraft}
                  onCancelRequest={(close) =>
                    requestClose(close, relationshipDraft.dirty)
                  }
                  busy={saving}
                  items={relationshipDraftItems.map(relationshipDraftToRow)}
                  onAdd={async (draft: RelationshipDraft) => {
                    const id = newDraftIdRef.current--;
                    setRelationshipDraftItems((prev) =>
                      addDraftItem(prev, draft, id),
                    );
                    return true;
                  }}
                  onEdit={async (id: number, draft: RelationshipDraft) => {
                    setRelationshipDraftItems((prev) =>
                      replaceDraftItem(prev, id, draft),
                    );
                    return true;
                  }}
                  onDelete={(id: number) =>
                    setRelationshipDraftItems((prev) =>
                      removeDraftItem(prev, id),
                    )
                  }
                />
              </AccordionSection>

              <AccordionSection
                sectionId="currentLocation"
                title="Current Location"
                expanded={expandedSections.currentLocation}
                onExpandedChange={(next) =>
                  setSectionExpanded("currentLocation", next)
                }
              >
                <View style={styles.field}>
                  <EntryTextField
                    testID="create-contact-current-location"
                    accessibilityLabel="Current location"
                    value={currentLocation}
                    onChangeText={setCurrentLocation}
                    onSubmit={dismissKeyboard}
                    placeholder="Where are they now?"
                  />
                  <EntryDateField
                    testID="create-contact-current-location-date"
                    accessibilityLabel="Current location date"
                    value={currentLocationDate ?? todayStored}
                    onChange={setCurrentLocationDate}
                    maxDate={todayDate}
                  />
                </View>
              </AccordionSection>

              <AccordionSection
                sectionId="memories"
                title={sectionTitle("general")}
                expanded={expandedSections.memories}
                onExpandedChange={(next) =>
                  next
                    ? setSectionExpanded("memories", true)
                    : requestClose(() => {
                        memoryEditorRef.current?.closeDraft();
                        setSectionExpanded("memories", false);
                      }, memoryDraft.dirty)
                }
              >
                <MemoryEditor
                  testID="create-contact-memories"
                  ref={memoryEditorRef}
                  onDraftStateChange={setMemoryDraft}
                  onCancelRequest={(close) =>
                    requestClose(close, memoryDraft.dirty)
                  }
                  busy={saving}
                  items={memoryBuckets.memories}
                  globalAiEnabled={globalAiEnabled}
                  aiDefaults={aiDefaults}
                  addButton={{ label: ADD_MEMORY }}
                  onAdd={addMemoryDraft}
                  onEdit={editMemoryDraft}
                  onDelete={deleteMemoryDraft}
                />
              </AccordionSection>

              <AccordionSection
                sectionId="thoughtOfThem"
                title={sectionTitle("thought_of_them")}
                expanded={expandedSections.thoughtOfThem}
                onExpandedChange={(next) =>
                  next
                    ? setSectionExpanded("thoughtOfThem", true)
                    : requestClose(() => {
                        thoughtOfThemEditorRef.current?.closeDraft();
                        setSectionExpanded("thoughtOfThem", false);
                      }, thoughtOfThemDraft.dirty)
                }
              >
                <MemoryEditor
                  testID="create-contact-thought-of-them"
                  ref={thoughtOfThemEditorRef}
                  onDraftStateChange={setThoughtOfThemDraft}
                  onCancelRequest={(close) =>
                    requestClose(close, thoughtOfThemDraft.dirty)
                  }
                  busy={saving}
                  items={memoryBuckets.thoughtOfThem}
                  fixedType="thought_of_them"
                  globalAiEnabled={globalAiEnabled}
                  aiDefaults={aiDefaults}
                  addButton={{ label: ADD_THOUGHT_OF_THEM }}
                  onAdd={addMemoryDraft}
                  onEdit={editMemoryDraft}
                  onDelete={deleteMemoryDraft}
                />
              </AccordionSection>

              <AccordionSection
                sectionId="giftIdeas"
                title={sectionTitle("gift_idea")}
                expanded={expandedSections.giftIdeas}
                onExpandedChange={(next) =>
                  next
                    ? setSectionExpanded("giftIdeas", true)
                    : requestClose(() => {
                        giftIdeasEditorRef.current?.closeDraft();
                        setSectionExpanded("giftIdeas", false);
                      }, giftIdeasDraft.dirty)
                }
              >
                <MemoryEditor
                  testID="create-contact-gift-ideas"
                  ref={giftIdeasEditorRef}
                  onDraftStateChange={setGiftIdeasDraft}
                  onCancelRequest={(close) =>
                    requestClose(close, giftIdeasDraft.dirty)
                  }
                  busy={saving}
                  items={memoryBuckets.giftIdeas}
                  fixedType="gift_idea"
                  globalAiEnabled={globalAiEnabled}
                  aiDefaults={aiDefaults}
                  addButton={{ label: ADD_GIFT_IDEA }}
                  onAdd={addMemoryDraft}
                  onEdit={editMemoryDraft}
                  onDelete={deleteMemoryDraft}
                />
              </AccordionSection>

              {createDefs.length > 0 ? (
                <AccordionSection
                  sectionId="custom"
                  title="Custom Fields"
                  expanded={expandedSections.custom}
                  onExpandedChange={(next) =>
                    setSectionExpanded("custom", next)
                  }
                >
                  <View
                    testID="create-contact-custom-block"
                    style={styles.customBlock}
                  >
                    {createDefs.map((def) => (
                      <View key={def.id} style={styles.field}>
                        <AppText
                          role="label"
                          style={{ color: colors.textSecondary }}
                        >
                          {def.label}
                        </AppText>
                        <FieldValueInput
                          testID={`create-contact-custom-${def.col_name}`}
                          field={def}
                          value={values[def.col_name] ?? null}
                          onChange={(v) =>
                            setValues((prev) => ({
                              ...prev,
                              [def.col_name]: v,
                            }))
                          }
                        />
                      </View>
                    ))}
                  </View>
                </AccordionSection>
              ) : null}

              {/* Off Limits: inline rows, always Off Limits (D-08, D-11), a
              solid "Add Off Limits Item" (D-67, D-87). */}
              <AccordionSection
                sectionId="offLimits"
                title="Off Limits"
                expanded={expandedSections.offLimits}
                onExpandedChange={(next) =>
                  next
                    ? setSectionExpanded("offLimits", true)
                    : requestClose(() => {
                        offLimitsEditorRef.current?.closeDraft();
                        setSectionExpanded("offLimits", false);
                      }, offLimitsDraft.dirty)
                }
              >
                <OffLimitsInlineEditor
                  ref={offLimitsEditorRef}
                  onDraftStateChange={setOffLimitsDraft}
                  onCancelRequest={(close) =>
                    requestClose(close, offLimitsDraft.dirty)
                  }
                  busy={saving}
                  testID="create-contact-off-limits"
                  items={offLimitsDrafts.map(offLimitsDraftToItem)}
                  addLabel={ADD_OFF_LIMITS_ITEM}
                  onAdd={addOffLimitsDraft}
                  onEdit={editOffLimitsDraft}
                  onDelete={deleteOffLimitsDraft}
                />
              </AccordionSection>
            </>
          ) : (
            <Button
              testID="create-contact-show-more"
              role="tertiary"
              label="Show More"
              onPress={() => setShowMore(true)}
            />
          )}

          {/* Save stays PRESSABLE when the form is incomplete so a blocked press
          reveals + focuses the erroring section (CAPT-14) rather than being an
          inert disabled button; it is only truly disabled while a save is in
          flight. Visual emphasis still follows `savable`. */}
          <Pressable
            testID="create-contact-save"
            accessibilityRole="button"
            accessibilityLabel="Save contact"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={() => void handleSave()}
            style={[
              styles.saveBtn,
              {
                backgroundColor: savable ? colors.accent : colors.surface,
                borderColor: savable ? colors.accent : colors.border,
              },
            ]}
          >
            <AppText
              role="label"
              style={{
                color: savable ? colors.onAccent : colors.textSecondary,
              }}
            >
              Save contact
            </AppText>
          </Pressable>
        </KeyboardCenteringProvider>
        {bottomSpacer}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  helper: { fontSize: 13, lineHeight: 18 },
  lifecycleChoices: { flexDirection: "row", gap: 8 },
  lifecycleChoice: {
    minHeight: 44,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  customBlock: {
    gap: 16,
  },
  saveBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
});
