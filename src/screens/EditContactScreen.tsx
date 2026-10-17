/**
 * EditContactScreen (CRUD-03 / CAPT-04) — the always-show edit form, restructured
 * into DIRECT-ACCESS top-level accordion sections that expose the COMPLETE editable
 * record (dossier §E): Identity, Relationship Basics, Contact Methods, Last Talked
 * About, Key People/Relationships, Current Location, Memories, Custom Fields, Off
 * Limits. Every knowledge subdomain is a first-class TOP-LEVEL editing section (never
 * a nested knowledge drawer), composing the SAME canonical editors used
 * elsewhere (MemoryEditor / RelationshipEditor) plus the inline Off Limits editor.
 *
 * 38.10 plan 14 (D-05, D-65, D-67, D-116, D-119): the Things to Remember sections
 * are filled in on the form itself, in the D-44 order: Last Talked About, Key
 * People, Current Location, Memories, Thought of Them, Gift Ideas, Custom Fields,
 * Off Limits, Imported from Contacts App. One memory draft list feeds the four
 * memory sections through `partitionMemoryRows`, recomputed every render. Last
 * Talked About and Current Location are always-visible "add an entry" rows (the
 * shared D-66 field and a date capped at today, D-101) that start blank, so the
 * form's Save appends any non-blank entry (D-119, D-121). Every Things to
 * Remember delete is held until Save (D-104), and Allow AI is draft state saved
 * by Save (D-27). The shared entry fields centre above the keyboard through
 * `KeyboardCenteringProvider` (D-66).
 *
 * Seeded by `getContactForEdit` (metadata / custom-values / links / methods) PLUS an
 * EXPLICIT per-subdomain read for each knowledge section (`getContactForEdit` returns
 * NO knowledge subdomain — verified contact-read.ts:154-213): Memories →
 * `listMemoriesForContact`, Key People → `listRelationshipsForContact`, Off Limits →
 * `listOffLimitsForContact`. Last Talked About and Current Location seed blank.
 *
 * SINGLE form-level Save over the retained TWO-TRANSACTION boundary (dossier §AE):
 * metadata + ALL five knowledge subdomains persist through `updateContactFull` (one
 * txn, the sole `data_revision` bump), THEN links through `applyLinkDiff` (second
 * txn). No per-section saving; no collapsed transaction. Each knowledge section feeds
 * its seed↔draft diff into `buildEditInput` (34-05), which assembles the pinned
 * `{ add, edit, delete }` payloads `updateContactFull` applies.
 *
 * LAST-SPOKE BOUNDARY (owner ruling 2026-08-14 / CONTEXT Area 3): the tri-state
 * last-spoke control renders IF AND ONLY IF the seeded `contact.last_contact IS
 * NULL` (`neverContacted`). Choosing Today/Pick date passes a `firstInteraction`
 * to `updateContactFull`, which writes the FIRST touch through the single-writer
 * recency path (source='manual', direction=null) — the screen NEVER writes
 * `last_contact` directly. A contact that ALREADY has `last_contact` set shows NO
 * last-spoke control here: correcting an existing recency timeline is Phase 6.
 *
 * OFF LIMITS lives in its own table (38.10 D-08, D-11): the section reads and writes
 * only Off Limits rows, and it has no kind control.
 *
 * The screen builds NO SQL and re-implements NO custom widget: the input-shaping
 * correctness lives in the node-tested `edit-contact-logic.ts`. This file is the RN
 * shell + navigation, device-UAT at the phase gate.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { BirthdayField } from "@/components/BirthdayField";
import { ContactMethodsEditor } from "@/components/ContactMethodsEditor";
import { CategoryChoiceSheet } from "@/components/category/CategoryChoiceSheet";
import {
  addMethodDraft,
  canonicalDuplicateCopy,
  choosePrimary,
  removeMethodDraft,
  resolveEffectivePhoneRegion,
  seedMethodGroups,
  updateMethodDraft,
} from "@/components/contact-methods-editor-model";
import { FieldValueInput } from "@/components/FieldValueInput";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import { type LinkDraft, LinksEditor } from "@/components/LinksEditor";
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
import { PhotoSourcePicker } from "@/components/PhotoSourcePicker";
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
  OptionSheet,
  OrbitSwitch,
  useKeyboardCentering,
} from "@/components/ui";
import { chipTone } from "@/components/ui/chip-tone";
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
  RARELY_RESPONDS,
} from "@/constants/glossary";
import {
  getAiPermissionDefaults,
  memoryAiDefaultsMap,
} from "@/db/ai-permissions-dao";
import { getAppSettings } from "@/db/app-settings-dao";
import type { ContactLinkRow } from "@/db/contact-links-dao";
import {
  getContactForEdit,
  getContactHeader,
  isDuplicateName,
  listCategories,
} from "@/db/contact-read";
import type { updateContactFull } from "@/db/contacts-dao";
import {
  type CurrentStateEntryRow,
  getCurrentStateValues,
} from "@/db/current-state-history-read";
import { getExecutor, localDateTime } from "@/db/database";
import { listDefs } from "@/db/field-defs-dao";
import type { CustomFieldDef } from "@/db/field-types";
import { defsForEditForm } from "@/db/field-values-dao";
import { listMemoriesForContact } from "@/db/memories-read";
import {
  CURRENT_STATE_FIELD_REGISTRY,
  type CurrentStateFieldKey,
} from "@/db/memory-registry";
import {
  listOffLimitsForContact,
  type OffLimitsRow,
} from "@/db/off-limits-read";
import {
  listRelationshipsForContact,
  type RelationshipRow,
} from "@/db/relationships-read";
import { newUid } from "@/db/uid";
import { useCategoryCatalogRefresh } from "@/hooks/use-category-catalog-refresh";
import { isAiMasterEnabled } from "@/logic/ai-enablement";
import { resolveCategorySelection } from "@/logic/category-logic";
import type { ContactMethodType } from "@/logic/contact-method-normalization";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { applyLifecycleTransitionEffects } from "@/services/contact-lifecycle-effects";
import { getDeviceRegion } from "@/services/device-region";
import { reconcileSchedule } from "@/services/notifications/notification-schedule";
import {
  deleteStagedPhotosOwned,
  executeDeleteIntentOwned,
} from "@/services/photos/owned-master";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { confirm, notice } from "@/stores/confirm-store";
import { takeStagedPhotos } from "@/stores/photo-result-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { FREQUENCY_DAYS } from "@/types";
import { formatLocalDate } from "@/utils/dates";
import { Logger } from "@/utils/logger";
import { beginInFlight, endInFlight } from "@/utils/single-flight";
import { buildLinksForDiff } from "./contact-link-drafts";
import {
  partitionMemoryRows,
  pickCreateSubEditor,
  SOCIAL_BATTERY_SHEET_OPTIONS,
} from "./create-contact-logic";
import { mostRecentEntryCard } from "./edit-contact-display";
import {
  applyMemoryPatch,
  buildEditInput,
  type CurrentStateSeed,
  canSave,
  collectEditBlockingErrors,
  EDIT_FIELD_REVEAL_ORDER,
  EDIT_SECTION_FIELD_MAP,
  type EditFormState,
  isNeverContacted,
  type MemoryDraftRow,
  memoryDraftRowToItem,
  memoryRowToDraftRow,
  type OffLimitsDraftRow,
  type RelationshipDraftRow,
  resolveEditSaveExit,
  resolveErrorSection,
  seedEditState,
} from "./edit-contact-logic";
import {
  type EditContactBaselines,
  runEditContactSave,
} from "./edit-contact-save-coordinator";
import {
  sectionEmptyText,
  sectionEntryNoun,
  sectionTitle,
} from "./section-editor-logic";

const LOG_SCOPE = "edit-contact";

/** An editor with no open draft (D-14). */
const CLOSED_DRAFT = { open: false, dirty: false } as const;

/**
 * The Last Talked About / Current Location seed: always blank (38.10 plan 14;
 * convergence c3, Claude C-04). Both rows start blank, so a non-blank row is
 * a new entry even when its text matches the latest stored one (D-26, D-65);
 * a blank row writes nothing, so an untouched form stays clean.
 */
const BLANK_CURRENT_STATE: CurrentStateSeed = {};

/** Enter in the two "add an entry" boxes only closes the keyboard (D-121). */
function dismissKeyboard(): void {
  Keyboard.dismiss();
}

/**
 * Themed confirm so the duplicate-name warning reads as ONE gate; Back/scrim
 * resolves false, as Cancel does (D-27).
 */
function confirmDuplicate(name: string): Promise<boolean> {
  return confirm({
    title: "Duplicate name",
    message: `You already have a ${name} — save anyway?`,
    confirmLabel: "Save anyway",
    dismissable: true,
  });
}

/** Seed the editable links draft from the assembled (ordered) links. */
function toLinkDrafts(links: ContactLinkRow[]): LinkDraft[] {
  return links.map((l) => ({
    id: l.id,
    uid: l.uid,
    url: l.url,
    label: l.label,
  }));
}

// =============================================================================
// KNOWLEDGE-SUBDOMAIN SEED ADAPTERS (CAPT-04, dossier §E).
//
// Each knowledge section holds its editable draft as `EditFormState.{subdomain}` —
// a list of draft ROWS (the create-path semantic shape + an optional row `id`). An
// EXISTING seeded row carries its real DB `id`; a NEW row (added this session) is
// assigned a NEGATIVE synthetic id so it renders/edits/deletes as a distinct row
// yet — because no real (positive) seed id ever matches it — is diffed as an ADD by
// `buildEditInput` (which strips the id from every add). The seed baselines are held
// separately (`seeded*`) so the seed↔draft diff distinguishes unchanged/added/
// edited/deleted rows; the editors render each draft row back to its committed-row
// shape via the `*RowToItem` adapters. Each `*RowToDraftRow` seed adapter emits the
// SAME field shape the editor commits, so an untouched seeded row diffs equal.
// =============================================================================

/** Seed a relationship draft row from a committed row (keeps id + all fields). */
function relationshipRowToDraftRow(row: RelationshipRow): RelationshipDraftRow {
  return {
    personName: row.person_name,
    relationType: row.relation_type,
    linkedContactId: row.linked_contact_id,
    note: row.note,
    pinned: row.pinned === 1,
    hidden: row.hidden === 1 ? 1 : row.hidden === 0 ? 0 : null,
    id: row.id,
  };
}

/** Render a relationship draft row back to the editor's committed-row shape. */
function relationshipDraftRowToItem(
  row: RelationshipDraftRow,
  contactId: number,
  linkedName: string | null,
): RelationshipRow {
  return {
    id: row.id ?? 0,
    uid: "",
    contact_id: contactId,
    person_name: row.personName,
    relation_type: row.relationType ?? null,
    linked_contact_id: row.linkedContactId ?? null,
    linked_contact_name: linkedName,
    note: row.note ?? null,
    pinned: row.pinned ? 1 : 0,
    hidden: row.hidden ?? null,
    created_at: "",
    modified_at: "",
    deleted_at: null,
  };
}

/** Seed an Off Limits draft row from a committed row (D-11: content fields only). */
function offLimitsRowToDraftRow(row: OffLimitsRow): OffLimitsDraftRow {
  return { label: row.label, text: row.text, url: row.url, id: row.id };
}

/** Render an Off Limits draft row for the inline Off Limits editor. */
function offLimitsDraftRowToItem(row: OffLimitsDraftRow): OffLimitsInlineItem {
  return {
    id: row.id ?? 0,
    text: row.text ?? null,
    label: row.label ?? null,
    url: row.url ?? null,
  };
}

const DIRTY_CHECK_NOW = "2000-01-01 00:00:00";
const DIRTY_CHECK_UID = "dirty-check";

interface SignatureOptions {
  contactId: number;
  editDefs: Array<{ id: number; col_name: string }>;
  neverContacted: boolean;
  effectivePhoneRegion: string | null;
  seededMemories: MemoryDraftRow[];
  seededRelationships: RelationshipDraftRow[];
  seededOffLimits: OffLimitsDraftRow[];
  seededCurrentState: CurrentStateSeed;
}

function editInputSignature(
  state: EditFormState,
  options: SignatureOptions,
): string {
  return JSON.stringify(
    buildEditInput(state, {
      contactId: options.contactId,
      editDefs: options.editDefs,
      neverContacted: options.neverContacted,
      effectivePhoneRegion: options.effectivePhoneRegion,
      now: DIRTY_CHECK_NOW,
      interactionUid: DIRTY_CHECK_UID,
      seededMemories: options.seededMemories,
      seededRelationships: options.seededRelationships,
      seededOffLimits: options.seededOffLimits,
      seededCurrentState: options.seededCurrentState,
    }),
  );
}

function valuesSignature(values: Record<string, string | null>): string {
  return JSON.stringify(
    Object.entries(values).sort(([first], [second]) =>
      first.localeCompare(second),
    ),
  );
}

/** The knowledge seeds every hydration + partial-reseed reads (§E). */
interface KnowledgeSeeds {
  memories: MemoryDraftRow[];
  relationships: RelationshipDraftRow[];
  offLimits: OffLimitsDraftRow[];
  /** id → linked contact name, for the relationship editor's "Linked to" line. */
  relationshipLinkedNames: Map<number, string | null>;
}

export function EditContactScreen({
  navigation,
  route,
}: RootStackScreenProps<"Edit">) {
  const { colors } = useTheme();
  const { contactId } = route.params;

  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [socialBatterySheetOpen, setSocialBatterySheetOpen] = useState(false);
  const [editDefs, setEditDefs] = useState<CustomFieldDef[]>([]);
  const [form, setForm] = useState<EditFormState | null>(null);
  // Links: the seeded snapshot (the diff baseline) + the editable draft. Add/edit/
  // remove mutate ONLY the draft; nothing hits the DB until Save's applyLinkDiff.
  const [seededLinks, setSeededLinks] = useState<ContactLinkRow[]>([]);
  const [linksDraft, setLinksDraft] = useState<LinkDraft[]>([]);
  // Knowledge-subdomain seed baselines (the diff baselines). The editable drafts
  // live in `form` (memories/relationships/offLimits/lastTalkedAbout/currentLocation);
  // buildEditInput diffs each draft against its baseline here into {add,edit,delete}.
  const [seededMemories, setSeededMemories] = useState<MemoryDraftRow[]>([]);
  const [seededRelationships, setSeededRelationships] = useState<
    RelationshipDraftRow[]
  >([]);
  const [seededOffLimits, setSeededOffLimits] = useState<OffLimitsDraftRow[]>(
    [],
  );
  // The Allow-AI availability (real app setting, NOT a hardcoded false —
  // Review cycle-4 LOW #4 / D-04). A stubbed false would silently disable the
  // per-Memory Allow-AI control that 34-07's privacy design relies on.
  const [globalAiEnabled, setGlobalAiEnabled] = useState(false);
  // Per-type Allow AI defaults for new memories (D-13, D-92): a new entry and
  // a type change on an untouched switch take the type's own default.
  const [aiDefaults, setAiDefaults] = useState<MemoryAiDefaults | undefined>(
    undefined,
  );
  // id → linked contact name for existing relationships (display only).
  const relationshipLinkedNamesRef = useRef<Map<number, string | null>>(
    new Map(),
  );
  // Decrementing synthetic id source for NEW knowledge rows (never collides with a
  // real positive seed id, so a new row is always diffed as an add).
  const newRowIdRef = useRef(-1);
  // Captured from the seed: a never-contacted contact (last_contact IS NULL) is
  // the ONLY case that shows the last-spoke control (owner ruling — see header).
  const [neverContacted, setNeverContacted] = useState(false);
  const [initialTrackingEnabled, setInitialTrackingEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  // The synchronous save guard (verification IN-04): `saving` is render state
  // for the disabled look; this ref is what makes Save single-flight, so a
  // second tap can neither run its own save nor re-enable Save early.
  const savingRef = useRef(false);
  const [stale, setStale] = useState(false);
  const [effectivePhoneRegion, setEffectivePhoneRegion] = useState<
    string | null
  >(getDeviceRegion());
  const [duplicateHelper, setDuplicateHelper] = useState<{
    type: ContactMethodType;
    copy: string;
  } | null>(null);
  // Photo held as SEPARATE screen state — NOT in EditFormState. The photo is
  // written IMMEDIATELY through its own dedicated setContactPhoto/clearContactPhoto
  // DAO (RESEARCH Pitfall 6: updateContactMetadataCore deliberately omits `photo`),
  // never through the metadata Save path. Keeping it out of EditFormState keeps
  // buildEditInput/updateContactFull clean AND lets the focus re-read update only
  // the photo without reseeding — and discarding — unsaved form edits.
  const [photo, setPhoto] = useState<string | null>(null);
  const formRef = useRef<EditFormState | null>(null);
  const linksDraftRef = useRef<LinkDraft[]>([]);
  // The custom-field values actually COMMITTED to the DB — seeded pre-edit, and
  // updated on a successful Save. The teardown reconcile (below) deletes only the
  // staged cv- files this session persisted that NO committed value references, so
  // it can never delete a saved photo (a re-crop-in-place path equals its
  // committed value → referenced → kept). A ref so the unmount cleanup reads the
  // latest committed set, not a stale render closure.
  const committedValuesRef = useRef<Record<string, string | null>>({});
  // The metadata baseline is intentionally a built DAO input rather than raw
  // form state, so presentation-only state cannot trigger a discard prompt.
  const seedInputRef = useRef<string | null>(null);
  const bypassRef = useRef(false);

  // CONTROLLED accordion disclosure. Identity opens by default; the parent owns
  // which sections are open so a blocked Save can reveal the erroring section
  // (CAPT-14). Multiple sections may remain open simultaneously (dossier §E).
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
    imported: false,
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
  // Every shared entry field on the form centres above the keyboard through
  // the provider below (D-66; convergence c1 F-U1).
  const { centering, bottomSpacer } = useKeyboardCentering({
    scrollRef,
    contentRef,
  });
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

  // Read every knowledge subdomain seed for the contact (§E). `getContactForEdit`
  // returns NONE of these, so each needs its OWN explicit read. Off Limits rows
  // live in their own table (D-08, D-11). Used by initial hydration; later
  // saves advance from their transactional returns. Last Talked About and
  // Current Location seed blank (BLANK_CURRENT_STATE), so they need no read.
  const readKnowledgeSeeds = useCallback(async (): Promise<KnowledgeSeeds> => {
    const exec = getExecutor();
    const [memoryRows, relationshipRows, offLimitsRows] = await Promise.all([
      listMemoriesForContact(exec, contactId),
      listRelationshipsForContact(exec, contactId),
      listOffLimitsForContact(exec, contactId),
    ]);
    const relationshipLinkedNames = new Map<number, string | null>();
    for (const row of relationshipRows) {
      relationshipLinkedNames.set(row.id, row.linked_contact_name);
    }
    return {
      // Provenance, Allow AI and both lock markers ride in the draft row
      // (D-25, D-27, D-102, D-103; plan 09 adapters).
      memories: memoryRows.map(memoryRowToDraftRow),
      relationships: relationshipRows.map(relationshipRowToDraftRow),
      offLimits: offLimitsRows.map(offLimitsRowToDraftRow),
      relationshipLinkedNames,
    };
  }, [contactId]);

  const commitCategories = useCallback(
    (current: Array<{ id: number; name: string }>) => {
      setCategories(current);
      setForm((existing) =>
        existing
          ? {
              ...existing,
              categoryId: resolveCategorySelection(
                current,
                existing.categoryId,
              ),
            }
          : existing,
      );
    },
    [],
  );
  const requestInitialCategories = useCategoryCatalogRefresh(commitCategories);

  const load = useCallback(async () => {
    try {
      const exec = getExecutor();
      const defs = await listDefs(exec, { includeQuarantined: false });
      const [result, settings, knowledge, permissionDefaults] =
        await Promise.all([
          getContactForEdit(exec, contactId, defs),
          getAppSettings(exec),
          readKnowledgeSeeds(),
          getAiPermissionDefaults(exec),
        ]);
      if (!result) {
        void notice({
          title: "Couldn't load this contact",
          message: "Please go back and retry.",
        });
        return;
      }
      const nextEditDefs = defsForEditForm(defs);
      const nextNeverContacted = isNeverContacted(result);
      const nextPhoneRegion = resolveEffectivePhoneRegion(
        settings.phoneRegionOverride,
        getDeviceRegion(),
      );
      const nextForm: EditFormState = {
        ...seedEditState(result),
        memories: knowledge.memories,
        relationships: knowledge.relationships,
        offLimits: knowledge.offLimits,
        // Blank "add an entry" rows (D-65, D-119; convergence c3, Claude C-04).
        lastTalkedAbout: "",
        currentLocation: "",
      };
      relationshipLinkedNamesRef.current = knowledge.relationshipLinkedNames;
      setEditDefs(nextEditDefs);
      setNeverContacted(nextNeverContacted);
      setGlobalAiEnabled(isAiMasterEnabled(settings));
      setAiDefaults(memoryAiDefaultsMap(permissionDefaults));
      setSeededMemories(knowledge.memories);
      setSeededRelationships(knowledge.relationships);
      setSeededOffLimits(knowledge.offLimits);
      setForm(nextForm);
      setStale(false);
      setInitialTrackingEnabled(result.contact.trackingEnabled === 1);
      setEffectivePhoneRegion(nextPhoneRegion);
      seedInputRef.current = editInputSignature(nextForm, {
        contactId,
        editDefs: nextEditDefs,
        neverContacted: nextNeverContacted,
        effectivePhoneRegion: nextPhoneRegion,
        seededMemories: knowledge.memories,
        seededRelationships: knowledge.relationships,
        seededOffLimits: knowledge.offLimits,
        seededCurrentState: BLANK_CURRENT_STATE,
      });
      // The committed baseline for orphan cleanup: the pre-edit custom values.
      committedValuesRef.current = { ...result.values };
      setPhoto(result.contact.photo);
      setSeededLinks(result.links);
      setLinksDraft(toLinkDrafts(result.links));
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load edit-form data", err);
      void notice({
        title: "Couldn't load the form",
        message: "Please reopen this screen.",
      });
    }
  }, [contactId, readKnowledgeSeeds]);

  useEffect(() => {
    void load();
    void requestInitialCategories();
  }, [load, requestInitialCategories]);

  // LIGHT photo-only re-read: refresh ONLY the photo path, never the form (the
  // Avatar's display revision is published by the ownership layer, 38.6 D-01).
  // Wired to `useFocusEffect` so returning from CropPhotoScreen (which writes
  // setContactPhoto then goBack()s) updates the edit-surface avatar WITHOUT
  // calling load() — reseeding `form` would DISCARD the user's unsaved name/phone/
  // etc. edits. Also fired by the picker's `onChanged` (its Remove branch writes
  // the DAO inline).
  const refreshPhoto = useCallback(async () => {
    try {
      const row = await getContactHeader(getExecutor(), contactId);
      setPhoto(row?.photo ?? null);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to refresh photo", err);
    }
  }, [contactId]);

  useFocusEffect(
    useCallback(() => {
      void refreshPhoto();
    }, [refreshPhoto]),
  );

  // D-135: each field's Most Recent entry, shown as a small card above its
  // "See all". Its own state, never part of `form`, the seeded baseline or
  // the dirty signature. Read on focus (so on first focus too, alongside the
  // form's load), so an edit made on the history page through See all shows
  // on return without reloading the form.
  const [mostRecent, setMostRecent] = useState<
    Partial<Record<CurrentStateFieldKey, CurrentStateEntryRow>>
  >({});
  const refreshMostRecent = useCallback(async () => {
    try {
      setMostRecent(await getCurrentStateValues(getExecutor(), contactId));
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to read the most recent entries", err);
    }
  }, [contactId]);
  useFocusEffect(
    useCallback(() => {
      void refreshMostRecent();
    }, [refreshMostRecent]),
  );

  // ORPHAN CLEANUP (review cycle-2 MED custom-field orphan): a custom photo crop
  // persists its ~40 KB cv- master to disk BEFORE Save commits the field value, so
  // a Cancel / back-out / failed Save would leak it. On unmount, drain the staged
  // ledger and delete ONLY the staged files no COMMITTED value references — the
  // same "delete only files no committed row references" invariant purge (05-07)
  // uses, so a saved photo is NEVER deleted (a re-crop-in-place path equals its
  // committed value → referenced → kept). "If uncertain, don't delete": a missed
  // cleanup is bounded (self-healing on re-crop + purge-cleaned by 05-07), an
  // erroneous delete of a referenced file is not. Runs once, on real unmount.
  useEffect(() => {
    return () => {
      const staged = takeStagedPhotos();
      if (staged.length === 0) {
        return;
      }
      const committed = new Set(
        Object.values(committedValuesRef.current).filter(
          (v): v is string => v != null,
        ),
      );
      const orphanCandidates = staged.filter(
        (relPath) => !committed.has(relPath),
      );
      if (orphanCandidates.length > 0) {
        void deleteStagedPhotosOwned(getExecutor(), orphanCandidates).catch(
          (error) => {
            Logger.error("edit-contact", "staged photo cleanup failed", error);
          },
        );
      }
      for (const path of staged.filter((relPath) => committed.has(relPath))) {
        void executeDeleteIntentOwned(getExecutor(), path).catch((error) => {
          Logger.error(
            "edit-contact",
            "photo removal intent cleanup failed",
            error,
          );
        });
      }
    };
  }, []);

  // Narrow, typed field setter so each control mutates one key immutably.
  const setField = useCallback(
    <K extends keyof EditFormState>(key: K, value: EditFormState[K]) => {
      setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    [],
  );
  const setIntervalValid = useCallback(
    (valid: boolean) => {
      setField("intervalValid", valid);
      if (valid) clearError("frequency");
    },
    [setField, clearError],
  );

  // Links draft mutators — all local state; nothing persists until Save.
  const addLinkRow = useCallback(() => {
    setLinksDraft((prev) => [...prev, { uid: newUid(), url: "", label: null }]);
  }, []);
  const updateLinkRow = useCallback(
    (index: number, patch: Partial<Pick<LinkDraft, "url" | "label">>) => {
      setLinksDraft((prev) =>
        prev.map((l, i) => (i === index ? { ...l, ...patch } : l)),
      );
    },
    [],
  );
  const removeLinkRow = useCallback((index: number) => {
    setLinksDraft((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // -- Memories draft mutators (§E). New rows get a negative synthetic id; edits
  // preserve the row id so the diff routes an existing row to `edit`, a new row to
  // `add`, and a removed seeded row to `delete`. --
  const addMemoryRow = useCallback(
    async (draft: MemoryDraft): Promise<boolean> => {
      const id = newRowIdRef.current--;
      setForm((prev) =>
        prev
          ? { ...prev, memories: [...(prev.memories ?? []), { ...draft, id }] }
          : prev,
      );
      return true;
    },
    [],
  );
  // An in-form edit keeps the row's id, provenance and both lock markers
  // (applyMemoryPatch; D-25, D-102, D-103; convergence c1 F-U5). Allow AI
  // travels in the patch and is saved by the form's Save (D-27).
  const editMemoryRow = useCallback(
    async (id: number, patch: MemoryEditPatch): Promise<boolean> => {
      setForm((prev) =>
        prev
          ? {
              ...prev,
              memories: (prev.memories ?? []).map((row) =>
                row.id === id ? applyMemoryPatch(row, patch) : row,
              ),
            }
          : prev,
      );
      return true;
    },
    [],
  );
  const deleteMemoryRow = useCallback((id: number) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            memories: (prev.memories ?? []).filter((row) => row.id !== id),
          }
        : prev,
    );
  }, []);

  // -- Key People / Relationships draft mutators (§E). --
  const addRelationshipRow = useCallback(
    async (draft: RelationshipDraft): Promise<boolean> => {
      const id = newRowIdRef.current--;
      setForm((prev) =>
        prev
          ? {
              ...prev,
              relationships: [...(prev.relationships ?? []), { ...draft, id }],
            }
          : prev,
      );
      return true;
    },
    [],
  );
  const editRelationshipRow = useCallback(
    async (id: number, draft: RelationshipDraft): Promise<boolean> => {
      setForm((prev) =>
        prev
          ? {
              ...prev,
              relationships: (prev.relationships ?? []).map((row) =>
                row.id === id ? { ...draft, id } : row,
              ),
            }
          : prev,
      );
      return true;
    },
    [],
  );
  const deleteRelationshipRow = useCallback((id: number) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            relationships: (prev.relationships ?? []).filter(
              (row) => row.id !== id,
            ),
          }
        : prev,
    );
  }, []);

  // -- Off Limits draft mutators (§E). Every row is Off Limits (D-11); a new
  // row gets a negative synthetic id, and a delete is held until Save (D-104). --
  const addOffLimitsRow = useCallback((fields: OffLimitsInlineFields) => {
    const id = newRowIdRef.current--;
    setForm((prev) =>
      prev
        ? { ...prev, offLimits: [...(prev.offLimits ?? []), { ...fields, id }] }
        : prev,
    );
  }, []);
  const editOffLimitsRow = useCallback(
    (id: number, fields: OffLimitsInlineFields) => {
      setForm((prev) =>
        prev
          ? {
              ...prev,
              offLimits: (prev.offLimits ?? []).map((row) =>
                row.id === id ? { ...row, ...fields } : row,
              ),
            }
          : prev,
      );
    },
    [],
  );
  const deleteOffLimitsRow = useCallback((id: number) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            offLimits: (prev.offLimits ?? []).filter((row) => row.id !== id),
          }
        : prev,
    );
  }, []);

  // D-135: the Most Recent entry as a small, non-interactive card above the
  // field's "See all"; nothing when the field has no entry.
  const renderMostRecentCard = (
    fieldKey: CurrentStateFieldKey,
    testID: string,
  ) => {
    const card = mostRecentEntryCard(mostRecent[fieldKey]);
    if (!card) return null;
    return (
      <View
        testID={testID}
        style={[
          styles.mostRecentCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <AppText role="body" numberOfLines={2}>
          {card.value}
        </AppText>
        <AppText role="caption" style={{ color: colors.textSecondary }}>
          {card.dateLabel}
        </AppText>
      </View>
    );
  };

  const savable = useMemo(
    () => form !== null && canSave(form) && !saving && !stale,
    [form, saving, stale],
  );
  formRef.current = form;
  linksDraftRef.current = linksDraft;

  function applyCommittedBaseline(
    baseline: EditContactBaselines,
    submittedForm: EditFormState,
    methods: Awaited<ReturnType<typeof updateContactFull>>["methods"],
  ) {
    const committedMethods = seedMethodGroups({
      phone: methods.filter((method) => method.method_type === "phone"),
      email: methods.filter((method) => method.method_type === "email"),
    });
    setSeededMemories(baseline.memories);
    setSeededRelationships(baseline.relationships);
    setSeededOffLimits(baseline.offLimits);
    setSeededLinks(baseline.links);
    setLinksDraft(baseline.linksDraft);
    // The "add an entry" rows go blank again with today's date, so a Save
    // that keeps the form open (linksFailed, canonicalDuplicate) cannot append
    // the same entry twice (D-65, D-101; convergence c5, Claude C-02).
    setForm({
      ...baseline.form,
      lastTalkedAbout: "",
      lastTalkedAboutDate: undefined,
      currentLocation: "",
      currentLocationDate: undefined,
      methods:
        JSON.stringify(baseline.form.methods) ===
        JSON.stringify(submittedForm.methods)
          ? committedMethods
          : baseline.form.methods,
    });
    setNeverContacted(baseline.neverContacted);
    setInitialTrackingEnabled(baseline.initialTrackingEnabled);
    // The Save may have appended an entry; refresh the D-135 cards.
    void refreshMostRecent();
    committedValuesRef.current = { ...submittedForm.values };
    const committedForm: EditFormState = {
      ...submittedForm,
      memories: baseline.memories,
      relationships: baseline.relationships,
      offLimits: baseline.offLimits,
      lastTalkedAbout: "",
      lastTalkedAboutDate: undefined,
      currentLocation: "",
      currentLocationDate: undefined,
      lastSpoke: baseline.neverContacted
        ? submittedForm.lastSpoke
        : { kind: "not-yet" },
      methods: committedMethods,
    };
    seedInputRef.current = editInputSignature(committedForm, {
      contactId,
      editDefs,
      neverContacted: baseline.neverContacted,
      effectivePhoneRegion,
      seededMemories: baseline.memories,
      seededRelationships: baseline.relationships,
      seededOffLimits: baseline.offLimits,
      seededCurrentState: BLANK_CURRENT_STATE,
    });
  }

  async function handleSave() {
    if (!form || savingRef.current || stale) return;
    const blocking = collectEditBlockingErrors(form);
    const errors = toFieldErrors(blocking);
    setFieldErrors(errors);
    if (blocking.length > 0) {
      const field =
        firstBlockingField(EDIT_FIELD_REVEAL_ORDER, errors) ??
        blocking[0].field;
      const sectionId =
        EDIT_SECTION_FIELD_MAP[field] ??
        resolveErrorSection(blocking, EDIT_SECTION_FIELD_MAP);
      if (sectionId) revealAndFocus(field, sectionId);
      return;
    }
    // Claimed before the first await, so it covers the duplicate-name confirm.
    if (!beginInFlight(savingRef)) return;
    setSaving(true);
    try {
      const exec = getExecutor();
      const currentCategories = await listCategories(exec);
      const currentCategoryId = resolveCategorySelection(
        currentCategories,
        form.categoryId,
      );
      setCategories(currentCategories);
      if (currentCategoryId !== form.categoryId) {
        setField("categoryId", currentCategoryId);
      }
      const trimmed = form.name.trim();
      if (await isDuplicateName(exec, trimmed, contactId)) {
        if (!(await confirmDuplicate(trimmed))) return;
      }
      const submittedForm = { ...form, categoryId: currentCategoryId };
      const now = localDateTime();
      const input = buildEditInput(submittedForm, {
        now,
        contactId,
        interactionUid: newUid(),
        editDefs,
        neverContacted,
        effectivePhoneRegion,
        seededMemories,
        seededRelationships,
        seededOffLimits,
        seededCurrentState: BLANK_CURRENT_STATE,
      });
      const lifecycleDirection =
        submittedForm.trackingEnabled === initialTrackingEnabled
          ? null
          : submittedForm.trackingEnabled
            ? "bind"
            : "unbind";
      const outcome = await runEditContactSave({
        exec,
        input,
        submittedForm,
        getCurrentForm: () => formRef.current ?? submittedForm,
        submittedLinks: buildLinksForDiff(linksDraft),
        getCurrentLinks: () => buildLinksForDiff(linksDraftRef.current),
        seededLinks,
        seededMemories,
        seededRelationships,
        seededOffLimits,
        initialTrackingEnabled,
        neverContacted,
        toMemoryDraft: memoryRowToDraftRow,
        toRelationshipDraft: relationshipRowToDraftRow,
        toOffLimitsDraft: offLimitsRowToDraftRow,
        afterMetadataCommit: () => {
          if (lifecycleDirection) {
            void applyLifecycleTransitionEffects(
              contactId,
              lifecycleDirection,
              { exec },
            );
          } else {
            void reconcileSchedule(exec).catch((error) =>
              Logger.error(
                LOG_SCOPE,
                "reconcile after edit-save failed",
                error,
              ),
            );
            notifyWidgetDataChanged();
          }
        },
        refresh: async () => {
          const result = await getContactForEdit(exec, contactId, editDefs);
          if (!result) throw new Error("saved contact missing during refresh");
        },
      });
      if (outcome.status === "metadataFailed") {
        Logger.error(
          LOG_SCOPE,
          "failed to save contact metadata",
          outcome.error,
        );
        showSnackbar({
          kind: "error",
          label: "Couldn't save contact. Please try again.",
        });
        return;
      }
      applyCommittedBaseline(
        outcome.baseline,
        submittedForm,
        outcome.metadata.methods,
      );
      if (outcome.status === "linksFailed") {
        Logger.error(
          LOG_SCOPE,
          "links save failed (metadata committed)",
          outcome.error,
        );
        showSnackbar({
          kind: "error",
          label: "Contact saved — some links couldn't be saved. Try again.",
        });
        return;
      }
      if (outcome.status === "refreshFailed") {
        setStale(true);
        Logger.error(LOG_SCOPE, "saved contact refresh failed", outcome.error);
        // Blocking: the stale form must not be saved again (notice, D-27).
        void notice({
          title: "Contact saved, but the form couldn't refresh.",
          message: "Reopen it before saving again.",
        });
        return;
      }
      if (outcome.status === "canonicalDuplicate") {
        const duplicate = outcome.metadata.methodSaveResult;
        if (duplicate?.status !== "canonicalDuplicate") {
          throw new Error("canonical duplicate result missing method type");
        }
        setField(
          "methods",
          seedMethodGroups({
            phone: outcome.metadata.methods.filter(
              (method) => method.method_type === "phone",
            ),
            email: outcome.metadata.methods.filter(
              (method) => method.method_type === "email",
            ),
          }),
        );
        setDuplicateHelper({
          type: duplicate.methodType,
          copy: canonicalDuplicateCopy(duplicate.methodType),
        });
        return;
      }
      bypassRef.current = true;
      // Return to the Profile this Edit came from: go back to this contact's
      // Profile or Compose, else replace Edit with the Profile, so no second
      // Profile is pushed and no finished Edit stays in the stack (D-26, D-13).
      const exit = resolveEditSaveExit(navigation.getState(), contactId);
      if (exit.kind === "go-back") {
        navigation.goBack();
      } else {
        navigation.replace(exit.name, exit.params);
      }
    } catch (err) {
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

  const hasUnsavedChanges =
    form !== null &&
    (seedInputRef.current !==
      editInputSignature(form, {
        contactId,
        editDefs,
        neverContacted,
        effectivePhoneRegion,
        seededMemories,
        seededRelationships,
        seededOffLimits,
        seededCurrentState: BLANK_CURRENT_STATE,
      }) ||
      valuesSignature(form.values) !==
        valuesSignature(committedValuesRef.current) ||
      JSON.stringify(buildLinksForDiff(linksDraft)) !==
        JSON.stringify(buildLinksForDiff(toLinkDrafts(seededLinks))));

  // The in-section editors keep an open draft's typing privately until it is
  // added (D-13, same class as C5-M1; D-14): an open draft with typed text
  // holds Back (closing it first) and holds a fold of its section (D-68).
  // Each MemoryEditor host has its own ref and draft state (Memories, Thought
  // of Them, Gift Ideas, Imported; convergence c4, Claude C-02 / Cursor
  // CU-04, CU-05). Last Talked About and Current Location have no draft
  // (D-119): typed text there is form dirt. The route check and the save
  // bypass are unchanged.
  const memoryEditorRef = useRef<MemoryEditorHandle>(null);
  const thoughtOfThemEditorRef = useRef<MemoryEditorHandle>(null);
  const giftIdeasEditorRef = useRef<MemoryEditorHandle>(null);
  const importedEditorRef = useRef<MemoryEditorHandle>(null);
  const relationshipEditorRef = useRef<RelationshipEditorHandle>(null);
  const offLimitsEditorRef = useRef<OffLimitsInlineEditorHandle>(null);
  // Without card edit mode an entry's edit form opens after its section's
  // cards (D-130 left these hosts unchanged), so opening it scrolls the form
  // into view, as the section editors reveal an `editId` form (38.10
  // verification).
  const memoryFormRef = useRef<View>(null);
  const thoughtOfThemFormRef = useRef<View>(null);
  const giftIdeasFormRef = useRef<View>(null);
  const importedFormRef = useRef<View>(null);
  const relationshipFormRef = useRef<View>(null);
  const offLimitsFormRef = useRef<View>(null);
  const [memoryDraft, setMemoryDraft] =
    useState<MemoryDraftState>(CLOSED_DRAFT);
  const [thoughtOfThemDraft, setThoughtOfThemDraft] =
    useState<MemoryDraftState>(CLOSED_DRAFT);
  const [giftIdeasDraft, setGiftIdeasDraft] =
    useState<MemoryDraftState>(CLOSED_DRAFT);
  const [importedDraft, setImportedDraft] =
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
    imported: importedDraft,
  });
  const { requestClose, settleHold } = useDiscardKeepGuard({
    hasUnsavedChanges,
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
        } else if (pickedDraft.which === "imported") {
          importedEditorRef.current?.closeDraft();
        }
      },
    },
  });

  const inputStyle = [
    styles.input,
    {
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
  ];

  if (!form) {
    return (
      <View style={styles.root}>
        <ShellAppBar variant="child" title="Edit contact" />
        <View testID="edit-contact-loading" style={styles.loading}>
          <AppText role="body" style={{ color: colors.textSecondary }}>
            Loading…
          </AppText>
        </View>
      </View>
    );
  }

  // One memory draft list, split into its sections every render (convergence
  // c3, Claude C-02; D-116). The rows keep their ids, so each section's
  // add / edit / delete still edits the single list by id. The adapter
  // carries the draft's Allow AI (a reopened entry shows the draft value,
  // D-27), its provenance (D-25) and both lock markers (D-102, D-103).
  const memoryBuckets = partitionMemoryRows(
    (form.memories ?? []).map((row) => memoryDraftRowToItem(row, contactId)),
  );
  const relationshipItems = (form.relationships ?? []).map((row) =>
    relationshipDraftRowToItem(
      row,
      contactId,
      row.id != null
        ? (relationshipLinkedNamesRef.current.get(row.id) ?? null)
        : null,
    ),
  );
  const offLimitsItems = (form.offLimits ?? []).map(offLimitsDraftRowToItem);
  // The two "add an entry" dates default to today and cannot pass it (D-101).
  const todayStored = formatLocalDate(new Date());
  const todayDate = new Date();

  return (
    <View style={styles.root}>
      {/* House header (38.9 D-16, D-44). Title only: this is where the name and
          photo are edited, so no person line (D-64). Its Back calls goBack,
          which the unsaved-work guard above intercepts (D-13). While a save
          runs the guard holds Back, so it draws disabled (D-26; WR-02). */}
      <ShellAppBar variant="child" title="Edit contact" backDisabled={saving} />
      <ScrollView
        ref={scrollRef}
        innerViewRef={contentRef}
        testID="edit-contact-screen"
        contentContainerStyle={styles.content}
      >
        <KeyboardCenteringProvider value={centering}>
          {/* -- Identity: photo + name/category + birthday/social battery + the two
          reminder toggles — the exhaustive identity/admin section. -- */}
          <AccordionSection
            sectionId="identity"
            title="Identity"
            expanded={expandedSections.identity}
            onExpandedChange={(next) => setSectionExpanded("identity", next)}
            containerRef={registerSectionRef("identity")}
          >
            {/* Photo (edit-only — contactId always exists here). Held as SEPARATE state,
            written through its own DAO by PhotoSourcePicker/CropPhotoScreen, refreshed
            via the photo-only useFocusEffect above — never through the metadata Save. */}
            <View style={styles.field}>
              <AppText role="label" style={{ color: colors.textSecondary }}>
                Photo
              </AppText>
              <PhotoSourcePicker
                target={{ kind: "contact", contactId }}
                photo={photo}
                name={form.name}
                onChanged={refreshPhoto}
              />
            </View>

            <View ref={nameFieldRef} style={styles.field}>
              <AppText role="label" style={{ color: colors.textSecondary }}>
                Name
              </AppText>
              <TextInput
                ref={nameInputRef}
                testID="edit-contact-name"
                accessibilityLabel="Name"
                value={form.name}
                onChangeText={(v) => {
                  setField("name", v);
                  clearError("name");
                }}
                placeholder="Their name"
                placeholderTextColor={colors.textPlaceholder}
                style={inputStyle}
              />
              <FieldError
                testID="edit-contact-name-error"
                message={fieldErrors.name}
              />
            </View>

            <View style={styles.field}>
              <AppText role="label" style={{ color: colors.textSecondary }}>
                Category
              </AppText>
              <OptionSelectRow
                testID="edit-contact-category"
                label="Category"
                currentLabel={
                  categories.find((row) => row.id === form.categoryId)?.name ??
                  "Uncategorized"
                }
                onPress={() => setCategorySheetOpen(true)}
              />
              <CategoryChoiceSheet
                visible={categorySheetOpen}
                categories={categories}
                selectedId={form.categoryId}
                onSelect={(value) => setField("categoryId", value)}
                onRequestClose={() => setCategorySheetOpen(false)}
              />
            </View>

            {/* Birthday: the shared control (38.11 D-49 Clear, D-61 Year
            unknown asks for the year). Storage stays MM-DD when the year is
            unknown, YYYY-MM-DD when known (Pitfall 7). */}
            <BirthdayField
              testID="edit-contact-birthday"
              value={{
                input: form.birthdayInput,
                yearUnknown: form.birthdayYearUnknown,
                yearIsPlaceholder:
                  form.birthdayYearIsPlaceholder ?? form.birthdayYearUnknown,
              }}
              onChange={(next) =>
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        birthdayInput: next.input,
                        birthdayYearUnknown: next.yearUnknown,
                        birthdayYearIsPlaceholder: next.yearIsPlaceholder,
                      }
                    : prev,
                )
              }
            />

            <View style={styles.field}>
              <AppText role="label" style={{ color: colors.textSecondary }}>
                Social battery
              </AppText>
              {/* A stored value outside the options shows raw and is kept. */}
              <OptionSelectRow
                testID="edit-contact-social-battery"
                label="Social battery"
                currentLabel={form.socialBattery ?? "No selection"}
                onPress={() => setSocialBatterySheetOpen(true)}
              />
              <OptionSheet
                visible={socialBatterySheetOpen}
                title="Social battery"
                options={SOCIAL_BATTERY_SHEET_OPTIONS}
                selected={form.socialBattery}
                onSelect={(value) => setField("socialBattery", value)}
                onRequestClose={() => setSocialBatterySheetOpen(false)}
              />
            </View>

            {/* Behaviour toggles — the ToggleFieldWidget on/off "1"/"0" convention. */}
            <View style={styles.field}>
              <View style={styles.toggleRow}>
                <AppText role="label" style={{ color: colors.textPrimary }}>
                  {RARELY_RESPONDS}
                </AppText>
                <OrbitSwitch
                  testID="edit-contact-rarely-responds"
                  accessibilityLabel={RARELY_RESPONDS}
                  value={form.rarelyResponds === 1}
                  onValueChange={(v) => setField("rarelyResponds", v ? 1 : 0)}
                />
              </View>
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                Attempts to reach out won't reset their orbit
              </AppText>
            </View>
            {/* 38.12 D-96: the per-person mute switch is gone; a mute
            is now Snooze → "Until I turn it off". `remindersOff` stays in the
            form state as a pass-through (UpdateContactFullInput requires it). */}
          </AccordionSection>

          {/* -- Relationship Basics: Bound/Unbound + Frequency + (never-contacted)
          last-spoke. -- */}
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
                Orbit participation
              </AppText>
              <View style={styles.lifecycleChoices}>
                {([true, false] as const).map((enabled) => {
                  const selected = form.trackingEnabled === enabled;
                  const label = enabled ? "Bound" : "Unbound";
                  // Top-level choice: the primary (solid) chip tier (38.11
                  // D-85, ADR-203); the frequency chips stay the sub tier.
                  const tone = chipTone("primary", selected);
                  return (
                    <Pressable
                      key={label}
                      testID={`edit-contact-${label.toLowerCase()}`}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityState={{ selected }}
                      onPress={() =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                trackingEnabled: enabled,
                                intervalDays: enabled
                                  ? (current.intervalDays ??
                                    FREQUENCY_DAYS.Monthly)
                                  : current.intervalDays,
                                intervalValid: true,
                              }
                            : current,
                        )
                      }
                      style={[
                        styles.lifecycleChoice,
                        {
                          borderColor: colors[tone.border],
                          backgroundColor: colors[tone.fill],
                        },
                      ]}
                    >
                      <AppText
                        role="label"
                        style={{ color: colors[tone.label] }}
                      >
                        {label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                {form.trackingEnabled
                  ? "Bound contacts appear in your active orbit and get reach-out reminders."
                  : "Unbound contacts keep their details and history without reach-out reminders."}
              </AppText>
            </View>

            {form.trackingEnabled ? (
              <View style={styles.field}>
                <AppText role="label" style={{ color: colors.textSecondary }}>
                  Frequency
                </AppText>
                <FrequencyPicker
                  testID="edit-contact-frequency"
                  // Add / Edit only: the Custom… error waits for typing or a
                  // blocked Save, and is the field's one message (D-36).
                  errorAfterTyping
                  errorForced={fieldErrors.frequency !== undefined}
                  value={form.intervalDays ?? FREQUENCY_DAYS.Monthly}
                  onChange={(v) => setField("intervalDays", v)}
                  onValidityChange={setIntervalValid}
                />
              </View>
            ) : null}
            {/* LAST-SPOKE (owner ruling / CONTEXT Area 3): rendered ONLY when the
            seeded contact is never-contacted (last_contact IS NULL). Its Today/Pick
            date choice routes a FIRST interaction through updateContactFull's
            single-writer path — never a direct last_contact write. A contact that
            already has last_contact set has NO control here; timeline correction is
            Phase 6. Default "Not yet" so an untouched save logs nothing. */}
            {neverContacted ? (
              <View style={styles.field}>
                <AppText role="label" style={{ color: colors.textSecondary }}>
                  Last spoke
                </AppText>
                <TriStateLastSpoke
                  testID="edit-contact-last-spoke"
                  value={form.lastSpoke}
                  onChange={(v: LastSpokeValue) => setField("lastSpoke", v)}
                />
              </View>
            ) : null}
          </AccordionSection>

          {/* -- Contact Methods: phone/email + links (the reach fields). -- */}
          <AccordionSection
            sectionId="methods"
            title="Contact Methods"
            expanded={expandedSections.methods}
            onExpandedChange={(next) => setSectionExpanded("methods", next)}
            containerRef={registerSectionRef("methods")}
          >
            <ContactMethodsEditor
              testID="edit-contact-methods"
              methods={form.methods}
              duplicateHelper={duplicateHelper}
              onAdd={(type) =>
                setField(
                  "methods",
                  addMethodDraft(form.methods, type, newUid()),
                )
              }
              onUpdate={(uid, patch) =>
                // The warning follows the typing live (D-30; warn only, D-17).
                setField(
                  "methods",
                  updateMethodDraft(
                    form.methods,
                    uid,
                    patch,
                    effectivePhoneRegion,
                  ),
                )
              }
              onRemove={(uid) =>
                setField("methods", removeMethodDraft(form.methods, uid))
              }
              onChoosePrimary={(uid) =>
                setField("methods", choosePrimary(form.methods, uid))
              }
            />
            {/* Links (CRUD-04): grouped with the reach fields; edited as draft state,
            persisted once on Save via applyLinkDiff (the second transaction). */}
            <View style={styles.field}>
              <AppText role="label" style={{ color: colors.textSecondary }}>
                Links
              </AppText>
              <LinksEditor
                testID="edit-contact-links"
                links={linksDraft}
                onAdd={addLinkRow}
                onUpdate={updateLinkRow}
                onRemove={removeLinkRow}
              />
            </View>
          </AccordionSection>

          {/* -- Last Talked About: an always-visible "add an entry" row (D-65,
          D-119). Blank to start; the form's Save appends a non-blank entry
          dated by the capped picker (D-101). Enter only closes the keyboard
          (D-121). Earlier entries stay on its history page; the Most Recent one
          shows as a small card above "See all" (D-135). -- */}
          <AccordionSection
            sectionId="lastTalked"
            title="Last Talked About"
            expanded={expandedSections.lastTalked}
            onExpandedChange={(next) => setSectionExpanded("lastTalked", next)}
            containerRef={registerSectionRef("lastTalked")}
          >
            <View style={styles.field}>
              <EntryTextField
                testID="edit-contact-last-talked"
                accessibilityLabel={
                  CURRENT_STATE_FIELD_REGISTRY.last_talked_about.displayName
                }
                value={form.lastTalkedAbout ?? ""}
                onChangeText={(v) => setField("lastTalkedAbout", v)}
                onSubmit={dismissKeyboard}
                placeholder="What did you last talk about?"
              />
              <EntryDateField
                testID="edit-contact-last-talked-date"
                accessibilityLabel={`${CURRENT_STATE_FIELD_REGISTRY.last_talked_about.displayName} date`}
                value={form.lastTalkedAboutDate ?? todayStored}
                onChange={(date) => setField("lastTalkedAboutDate", date)}
                maxDate={todayDate}
              />
              {renderMostRecentCard(
                "last_talked_about",
                "edit-contact-last-talked-most-recent",
              )}
              <Button
                testID="edit-contact-last-talked-see-all"
                role="tertiary"
                label="See all"
                accessibilityLabel="See all Last Talked About entries"
                onPress={() =>
                  navigation.navigate("MemoryHistory", {
                    contactId,
                    fieldKey: "last_talked_about",
                  })
                }
              />
            </View>
          </AccordionSection>

          {/* -- Key People / Relationships. -- */}
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
            containerRef={registerSectionRef("keyPeople")}
          >
            <RelationshipEditor
              contactId={contactId}
              ref={relationshipEditorRef}
              formRef={relationshipFormRef}
              onEditOpen={() => reveal(relationshipFormRef)}
              onDraftStateChange={setRelationshipDraft}
              onCancelRequest={(close) =>
                requestClose(close, relationshipDraft.dirty)
              }
              busy={saving}
              items={relationshipItems}
              onAdd={addRelationshipRow}
              onEdit={editRelationshipRow}
              onDelete={deleteRelationshipRow}
            />
          </AccordionSection>

          {/* -- Current Location: the same "add an entry" row (D-65, D-101,
          D-119, D-121). -- */}
          <AccordionSection
            sectionId="currentLocation"
            title="Current Location"
            expanded={expandedSections.currentLocation}
            onExpandedChange={(next) =>
              setSectionExpanded("currentLocation", next)
            }
            containerRef={registerSectionRef("currentLocation")}
          >
            <View style={styles.field}>
              <EntryTextField
                testID="edit-contact-current-location"
                accessibilityLabel={
                  CURRENT_STATE_FIELD_REGISTRY.current_location.displayName
                }
                value={form.currentLocation ?? ""}
                onChangeText={(v) => setField("currentLocation", v)}
                onSubmit={dismissKeyboard}
                placeholder="Where are they now?"
              />
              <EntryDateField
                testID="edit-contact-current-location-date"
                accessibilityLabel={`${CURRENT_STATE_FIELD_REGISTRY.current_location.displayName} date`}
                value={form.currentLocationDate ?? todayStored}
                onChange={(date) => setField("currentLocationDate", date)}
                maxDate={todayDate}
              />
              {renderMostRecentCard(
                "current_location",
                "edit-contact-current-location-most-recent",
              )}
              {/* D-135 places the card above "See all" in both sections, and
                  D-53 gave Current Location the same See all and history
                  page (planner reading; owner may veto at plan 19). */}
              <Button
                testID="edit-contact-current-location-see-all"
                role="tertiary"
                label="See all"
                accessibilityLabel="See all Current Location entries"
                onPress={() =>
                  navigation.navigate("MemoryHistory", {
                    contactId,
                    fieldKey: "current_location",
                  })
                }
              />
            </View>
          </AccordionSection>

          {/* -- Memories (§E). Seeded by its OWN read (listMemoriesForContact)
          and shown through the `memories` bucket only. The Allow-AI control
          reflects the canonical AI master (isAiMasterEnabled, ADR-135 / 38.4
          RG-008), never a hardcoded false or the retired aiProvider field
          (Review cycle-4 LOW #4 / D-04); Allow AI is draft state saved by
          Save (D-27). -- */}
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
            containerRef={registerSectionRef("memories")}
          >
            <MemoryEditor
              testID="edit-contact-memories"
              entryNoun={sectionEntryNoun}
              ref={memoryEditorRef}
              formRef={memoryFormRef}
              onEditOpen={() => reveal(memoryFormRef)}
              onDraftStateChange={setMemoryDraft}
              onCancelRequest={(close) =>
                requestClose(close, memoryDraft.dirty)
              }
              busy={saving}
              items={memoryBuckets.memories}
              globalAiEnabled={globalAiEnabled}
              aiDefaults={aiDefaults}
              addButton={{ label: ADD_MEMORY }}
              onAdd={addMemoryRow}
              onEdit={editMemoryRow}
              onDelete={deleteMemoryRow}
            />
          </AccordionSection>

          {/* -- Thought of Them (D-65): its own type only. -- */}
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
            containerRef={registerSectionRef("thoughtOfThem")}
          >
            <MemoryEditor
              testID="edit-contact-thought-of-them"
              entryNoun={sectionEntryNoun("thought_of_them")}
              ref={thoughtOfThemEditorRef}
              formRef={thoughtOfThemFormRef}
              onEditOpen={() => reveal(thoughtOfThemFormRef)}
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
              onAdd={addMemoryRow}
              onEdit={editMemoryRow}
              onDelete={deleteMemoryRow}
            />
          </AccordionSection>

          {/* -- Gift Ideas (D-65): its own type only. -- */}
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
            containerRef={registerSectionRef("giftIdeas")}
          >
            <MemoryEditor
              testID="edit-contact-gift-ideas"
              entryNoun={sectionEntryNoun("gift_idea")}
              ref={giftIdeasEditorRef}
              formRef={giftIdeasFormRef}
              onEditOpen={() => reveal(giftIdeasFormRef)}
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
              onAdd={addMemoryRow}
              onEdit={editMemoryRow}
              onDelete={deleteMemoryRow}
            />
          </AccordionSection>

          {/* -- Custom block: EVERY non-quarantined field, as a top-level section. -- */}
          {editDefs.length > 0 ? (
            <AccordionSection
              sectionId="custom"
              title="Custom Fields"
              expanded={expandedSections.custom}
              onExpandedChange={(next) => setSectionExpanded("custom", next)}
              containerRef={registerSectionRef("custom")}
            >
              <View
                testID="edit-contact-custom-block"
                style={styles.customBlock}
              >
                {editDefs.map((def) => (
                  <View key={def.id} style={styles.field}>
                    <AppText
                      role="label"
                      style={{ color: colors.textSecondary }}
                    >
                      {def.label}
                    </AppText>
                    <FieldValueInput
                      testID={`edit-contact-custom-${def.col_name}`}
                      field={def}
                      contactId={contactId}
                      value={form.values[def.col_name] ?? null}
                      onChange={(v) =>
                        setForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                values: { ...prev.values, [def.col_name]: v },
                              }
                            : prev,
                        )
                      }
                    />
                  </View>
                ))}
              </View>
            </AccordionSection>
          ) : null}

          {/* -- Off Limits (§E): its own table, no kind control (D-08, D-11).
          Inline rows with the shared field and a solid "Add Off Limits Item"
          (D-67, D-87); deletes are held until Save (D-104). -- */}
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
            containerRef={registerSectionRef("offLimits")}
          >
            <OffLimitsInlineEditor
              ref={offLimitsEditorRef}
              formRef={offLimitsFormRef}
              onEditOpen={() => reveal(offLimitsFormRef)}
              onDraftStateChange={setOffLimitsDraft}
              onCancelRequest={(close) =>
                requestClose(close, offLimitsDraft.dirty)
              }
              busy={saving}
              testID="edit-contact-off-limits"
              items={offLimitsItems}
              addLabel={ADD_OFF_LIMITS_ITEM}
              onAdd={addOffLimitsRow}
              onEdit={editOffLimitsRow}
              onDelete={deleteOffLimitsRow}
            />
          </AccordionSection>

          {/* -- Imported from Contacts App (D-116): the imported contact notes,
          last as on the Profile (D-44). No Add (D-35); each note can be
          edited (its type stays fixed) or deleted, held until Save (D-104).
          An empty section shows a text-only line. -- */}
          <AccordionSection
            sectionId="imported"
            title={sectionTitle("imported")}
            expanded={expandedSections.imported}
            onExpandedChange={(next) =>
              next
                ? setSectionExpanded("imported", true)
                : requestClose(() => {
                    importedEditorRef.current?.closeDraft();
                    setSectionExpanded("imported", false);
                  }, importedDraft.dirty)
            }
            containerRef={registerSectionRef("imported")}
          >
            {memoryBuckets.imported.length === 0 ? (
              <AppText
                testID="edit-contact-imported-empty"
                role="body"
                style={{ color: colors.textSecondary }}
              >
                {sectionEmptyText("imported").body}
              </AppText>
            ) : null}
            <MemoryEditor
              testID="edit-contact-imported"
              entryNoun={sectionEntryNoun("imported")}
              ref={importedEditorRef}
              formRef={importedFormRef}
              onEditOpen={() => reveal(importedFormRef)}
              onDraftStateChange={setImportedDraft}
              onCancelRequest={(close) =>
                requestClose(close, importedDraft.dirty)
              }
              busy={saving}
              items={memoryBuckets.imported}
              showAdd={false}
              globalAiEnabled={globalAiEnabled}
              aiDefaults={aiDefaults}
              onAdd={addMemoryRow}
              onEdit={editMemoryRow}
              onDelete={deleteMemoryRow}
            />
          </AccordionSection>

          {/* Save stays PRESSABLE when the form is incomplete so a blocked press
          reveals + focuses the erroring section (CAPT-14) rather than being an
          inert disabled button; it is only truly disabled while a save is in
          flight. Visual emphasis still follows `savable`. */}
          <Pressable
            testID="edit-contact-save"
            accessibilityRole="button"
            accessibilityLabel="Save changes"
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
              Save changes
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
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    gap: 8,
  },
  mostRecentCard: {
    borderRadius: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACING.xs,
    padding: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lifecycleChoices: { flexDirection: "row", gap: 8 },
  lifecycleChoice: {
    minHeight: 44,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
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
