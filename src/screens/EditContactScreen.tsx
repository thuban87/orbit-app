/**
 * EditContactScreen (CRUD-03 / CAPT-04) — the always-show edit form, restructured
 * into DIRECT-ACCESS top-level accordion sections that expose the editable record
 * (dossier §E). Every subdomain is a first-class TOP-LEVEL editing section (never a
 * nested Things-to-Remember drawer), composing the SAME canonical editors used
 * elsewhere. This slice ships the metadata sections (Identity, Relationship Basics,
 * Contact Methods, Custom Fields) PLUS the first knowledge subdomain — Memories —
 * wired end-to-end; the remaining four knowledge sections follow.
 *
 * Seeded by `getContactForEdit` (metadata / custom-values / links / methods) PLUS an
 * EXPLICIT per-subdomain read for each knowledge section (`getContactForEdit` returns
 * NO knowledge subdomain — verified contact-read.ts:154-213): Memories →
 * `listMemoriesForContact`.
 *
 * SINGLE form-level Save over the retained TWO-TRANSACTION boundary (dossier §AE):
 * metadata + knowledge subdomains persist through `updateContactFull` (one txn, the
 * sole `data_revision` bump), THEN links through `applyLinkDiff` (second txn). No
 * per-section saving; no collapsed transaction. Each knowledge section feeds its
 * seed↔draft diff into `buildEditInput` (34-05), which assembles the pinned
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
 * The screen builds NO SQL and re-implements NO custom widget: the input-shaping
 * correctness lives in the node-tested `edit-contact-logic.ts`. This file is the RN
 * shell + navigation, device-UAT at the phase gate.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { ContactMethodsEditor } from "@/components/ContactMethodsEditor";
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
  initialDraft as initialMemoryDraft,
  MemoryEditor,
  type MemoryDraft,
  type MemoryEditPatch,
} from "@/components/MemoryEditor";
import { PhotoSourcePicker } from "@/components/PhotoSourcePicker";
import { TriStateLastSpoke } from "@/components/TriStateLastSpoke";
import type { LastSpokeValue } from "@/components/tri-state-last-spoke-logic";
import { AccordionSection, AppText } from "@/components/ui";
import { getAppSettings } from "@/db/app-settings-dao";
import {
  applyLinkDiff,
  type ContactLinkRow,
  type DraftLink,
} from "@/db/contact-links-dao";
import {
  getContactForEdit,
  getContactHeader,
  isDuplicateName,
  listCategories,
} from "@/db/contact-read";
import { updateContactFull } from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { listDefs } from "@/db/field-defs-dao";
import type { CustomFieldDef } from "@/db/field-types";
import { defsForEditForm } from "@/db/field-values-dao";
import { setMemoryAllowAi } from "@/db/memories-dao";
import { listMemoriesForContact, type MemoryRow } from "@/db/memories-read";
import { newUid } from "@/db/uid";
import type { ContactMethodType } from "@/logic/contact-method-normalization";
import type { RootStackScreenProps } from "@/navigation/types";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import { applyLifecycleTransitionEffects } from "@/services/contact-lifecycle-effects";
import { getDeviceRegion } from "@/services/device-region";
import { reconcileSchedule } from "@/services/notifications/notification-schedule";
import { deletePhoto } from "@/services/photos/photo-storage";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { takeStagedPhotos } from "@/stores/photo-result-store";
import { useTheme } from "@/theme";
import { FREQUENCY_DAYS, parseDate } from "@/types";
import { formatLocalDate } from "@/utils/dates";
import { Logger } from "@/utils/logger";
import {
  buildEditInput,
  canSave,
  type EditFormState,
  isNeverContacted,
  type MemoryDraftRow,
  seedEditState,
} from "./edit-contact-logic";

const LOG_SCOPE = "edit-contact";

/** The social-battery options (native picker). "" = No selection → stored NULL. */
const SOCIAL_BATTERY_OPTIONS = ["Charger", "Neutral", "Drain"] as const;

/** Promise wrapper over Alert so the duplicate-name warning reads as ONE gate. */
function confirmDuplicate(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Duplicate name",
      `You already have a ${name} — save anyway?`,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Save anyway", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
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

/**
 * Shape the draft for `applyLinkDiff`: trim url/label, empty label → null, and
 * DROP blank-url rows (an added-then-untyped row, or a cleared existing link).
 * Dropping a cleared existing (id-bearing) row makes the diff DELETE it — the
 * intuitive "empty the URL to remove the link" behaviour.
 */
function buildLinksForDiff(draft: LinkDraft[]): DraftLink[] {
  return draft
    .map((l) => ({
      id: l.id,
      uid: l.uid,
      url: l.url.trim(),
      label: l.label && l.label.trim().length > 0 ? l.label.trim() : null,
    }))
    .filter((l) => l.url.length > 0);
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
// shape via the `*RowToItem` adapters below.
// =============================================================================

/** Seed a Memory draft row from a committed row (keeps its real id + all fields). */
function memoryRowToDraftRow(row: MemoryRow): MemoryDraftRow {
  return { ...initialMemoryDraft(row), id: row.id };
}

/** Render a Memory draft row back to the editor's committed-row shape. */
function memoryDraftRowToItem(
  row: MemoryDraftRow,
  contactId: number,
  allowAi: number,
): MemoryRow {
  return {
    id: row.id ?? 0,
    uid: "",
    contact_id: contactId,
    type: row.type,
    custom_label: row.customLabel ?? null,
    value: row.value ?? null,
    note: row.note ?? null,
    url: row.url ?? null,
    meaningful_date: row.meaningfulDate ?? null,
    pinned: row.pinned ? 1 : 0,
    outdated: row.outdated ? 1 : 0,
    hidden: row.hidden == null ? null : row.hidden ? 1 : 0,
    provenance: "user",
    created_at: "",
    modified_at: "",
    deleted_at: null,
    allow_ai: allowAi,
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
  /** id → allow_ai, for the Memory editor's edit-only Allow-AI control display. */
  memoryAllowAi: Map<number, number>;
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
  const [editDefs, setEditDefs] = useState<CustomFieldDef[]>([]);
  const [form, setForm] = useState<EditFormState | null>(null);
  // Links: the seeded snapshot (the diff baseline) + the editable draft. Add/edit/
  // remove mutate ONLY the draft; nothing hits the DB until Save's applyLinkDiff.
  const [seededLinks, setSeededLinks] = useState<ContactLinkRow[]>([]);
  const [linksDraft, setLinksDraft] = useState<LinkDraft[]>([]);
  // Knowledge-subdomain seed baselines (the diff baselines). The editable drafts
  // live in `form` (memories); buildEditInput diffs each draft against its baseline
  // here into {add,edit,delete}.
  const [seededMemories, setSeededMemories] = useState<MemoryDraftRow[]>([]);
  // The edit-only Allow-AI availability (real app setting, NOT a hardcoded false —
  // Review cycle-4 LOW #4 / D-04). A stubbed false would silently disable the
  // per-Memory Allow-AI control that 34-07's privacy design relies on.
  const [globalAiEnabled, setGlobalAiEnabled] = useState(false);
  // id → allow_ai for existing Memories (display only; the toggle persists
  // IMMEDIATELY via setMemoryAllowAi, exactly like ThingsToRememberScreen).
  const memoryAllowAiRef = useRef<Map<number, number>>(new Map());
  // Decrementing synthetic id source for NEW knowledge rows (never collides with a
  // real positive seed id, so a new row is always diffed as an add).
  const newRowIdRef = useRef(-1);
  // Captured from the seed: a never-contacted contact (last_contact IS NULL) is
  // the ONLY case that shows the last-spoke control (owner ruling — see header).
  const [neverContacted, setNeverContacted] = useState(false);
  const [initialTrackingEnabled, setInitialTrackingEnabled] = useState(true);
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [saving, setSaving] = useState(false);
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
  const [photoModifiedAt, setPhotoModifiedAt] = useState<string | undefined>();
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
    memories: false,
    custom: false,
  });
  const setSectionExpanded = useCallback((sectionId: string, next: boolean) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: next }));
  }, []);

  // Reveal-and-focus targets (CAPT-14): the scroll container + each section's root
  // View, so a blocked Save can expand the erroring section and scroll it into
  // view via the AccordionSection interface (blocked-save wiring lands with the
  // validation slice).
  const scrollRef = useRef<ScrollView>(null);
  const sectionRefs = useRef<Record<string, View | null>>({});
  const registerSectionRef = useCallback(
    (sectionId: string) => (node: View | null) => {
      sectionRefs.current[sectionId] = node;
    },
    [],
  );

  // Read every knowledge subdomain seed for the contact (§E). `getContactForEdit`
  // returns NONE of these, so each needs its OWN explicit read. Used by initial
  // hydration AND the links-failure partial reseed.
  const readKnowledgeSeeds = useCallback(async (): Promise<KnowledgeSeeds> => {
    const exec = getExecutor();
    const memoryRows = await listMemoriesForContact(exec, contactId);
    const memoryAllowAi = new Map<number, number>();
    for (const row of memoryRows) memoryAllowAi.set(row.id, row.allow_ai);
    return {
      memories: memoryRows.map(memoryRowToDraftRow),
      memoryAllowAi,
    };
  }, [contactId]);

  const load = useCallback(async () => {
    try {
      const exec = getExecutor();
      const defs = await listDefs(exec, { includeQuarantined: false });
      const [cats, result, settings, knowledge] = await Promise.all([
        listCategories(exec),
        getContactForEdit(exec, contactId, defs),
        getAppSettings(exec),
        readKnowledgeSeeds(),
      ]);
      if (!result) {
        Alert.alert("Couldn't load this contact", "Please go back and retry.");
        return;
      }
      setCategories(cats);
      const nextEditDefs = defsForEditForm(defs);
      const nextNeverContacted = isNeverContacted(result);
      const nextPhoneRegion = resolveEffectivePhoneRegion(
        settings.phoneRegionOverride,
        getDeviceRegion(),
      );
      const nextForm: EditFormState = {
        ...seedEditState(result),
        memories: knowledge.memories,
      };
      memoryAllowAiRef.current = knowledge.memoryAllowAi;
      setEditDefs(nextEditDefs);
      setNeverContacted(nextNeverContacted);
      setGlobalAiEnabled(settings.aiProvider !== "none");
      setSeededMemories(knowledge.memories);
      setForm(nextForm);
      setInitialTrackingEnabled(result.contact.trackingEnabled === 1);
      setEffectivePhoneRegion(nextPhoneRegion);
      seedInputRef.current = editInputSignature(nextForm, {
        contactId,
        editDefs: nextEditDefs,
        neverContacted: nextNeverContacted,
        effectivePhoneRegion: nextPhoneRegion,
        seededMemories: knowledge.memories,
      });
      // The committed baseline for orphan cleanup: the pre-edit custom values.
      committedValuesRef.current = { ...result.values };
      setPhoto(result.contact.photo);
      setPhotoModifiedAt(result.contact.modified_at);
      setSeededLinks(result.links);
      setLinksDraft(toLinkDrafts(result.links));
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load edit-form data", err);
      Alert.alert("Couldn't load the form", "Please reopen this screen.");
    }
  }, [contactId, readKnowledgeSeeds]);

  useEffect(() => {
    void load();
  }, [load]);

  // LIGHT photo-only re-read: refresh ONLY the photo + its cache-bust token, never
  // the form. Wired to `useFocusEffect` so returning from CropPhotoScreen (which
  // writes setContactPhoto then goBack()s) updates the edit-surface avatar WITHOUT
  // calling load() — reseeding `form` would DISCARD the user's unsaved name/phone/
  // etc. edits. Also fired by the picker's `onChanged` (its Remove branch writes
  // the DAO inline).
  const refreshPhoto = useCallback(async () => {
    try {
      const row = await getContactHeader(getExecutor(), contactId);
      setPhoto(row?.photo ?? null);
      setPhotoModifiedAt(row?.modified_at);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to refresh photo", err);
    }
  }, [contactId]);

  useFocusEffect(
    useCallback(() => {
      void refreshPhoto();
    }, [refreshPhoto]),
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
      for (const relPath of staged) {
        if (!committed.has(relPath)) {
          deletePhoto(relPath);
        }
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
    (valid: boolean) => setField("intervalValid", valid),
    [setField],
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
  const editMemoryRow = useCallback(
    async (id: number, patch: MemoryEditPatch): Promise<boolean> => {
      setForm((prev) =>
        prev
          ? {
              ...prev,
              memories: (prev.memories ?? []).map((row) =>
                row.id === id ? { ...patch, id } : row,
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
  // The Allow-AI toggle persists IMMEDIATELY (not through Save), mirroring
  // ThingsToRememberScreen — it is a per-item privacy control, not draft state.
  const setMemoryAllowAiFor = useCallback(
    async (id: number, allow: boolean): Promise<void> => {
      try {
        await setMemoryAllowAi(getExecutor(), {
          id,
          contactId,
          allow,
          now: localDateTime(),
        });
        memoryAllowAiRef.current.set(id, allow ? 1 : 0);
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to set memory AI permission", err);
      }
    },
    [contactId],
  );

  const savable = useMemo(
    () => form !== null && canSave(form) && !saving,
    [form, saving],
  );

  // Re-seed the metadata form AND the knowledge subdomains from the just-committed
  // rows after a partial save (links failed but metadata+knowledge committed) — so
  // the user never sees a stale or rolled-back view and a retry neither re-adds
  // already-persisted knowledge rows nor mis-detects them. Deliberately leaves
  // `linksDraft` INTACT for retry.
  async function reseedMetadataAfterPartialSave() {
    try {
      const exec = getExecutor();
      const defs = await listDefs(exec, { includeQuarantined: false });
      const [result, knowledge] = await Promise.all([
        getContactForEdit(exec, contactId, defs),
        readKnowledgeSeeds(),
      ]);
      if (result) {
        const nextEditDefs = defsForEditForm(defs);
        const nextNeverContacted = isNeverContacted(result);
        const nextForm: EditFormState = {
          ...seedEditState(result),
          memories: knowledge.memories,
        };
        memoryAllowAiRef.current = knowledge.memoryAllowAi;
        setEditDefs(nextEditDefs);
        setNeverContacted(nextNeverContacted);
        setSeededMemories(knowledge.memories);
        setForm(nextForm);
        committedValuesRef.current = { ...result.values };
        seedInputRef.current = editInputSignature(nextForm, {
          contactId,
          editDefs: nextEditDefs,
          neverContacted: nextNeverContacted,
          effectivePhoneRegion,
          seededMemories: knowledge.memories,
        });
        // seededLinks is unchanged: applyLinkDiff rolled back, so the DB links
        // still equal the original baseline — keep it as the retry diff baseline.
      }
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to re-seed after partial save", err);
    }
  }

  async function handleSave() {
    if (!form || !canSave(form) || saving) {
      return;
    }
    const trimmed = form.name.trim();
    setSaving(true);
    try {
      const exec = getExecutor();
      // Duplicate-name warning fires on save (non-blocking), excluding self.
      if (await isDuplicateName(exec, trimmed, contactId)) {
        if (!(await confirmDuplicate(trimmed))) {
          return; // Cancel — nothing is written.
        }
      }
      const now = localDateTime();
      const lifecycleDirection =
        form.trackingEnabled === initialTrackingEnabled
          ? null
          : form.trackingEnabled
            ? "bind"
            : "unbind";
      const input = buildEditInput(form, {
        now,
        contactId,
        interactionUid: newUid(),
        editDefs,
        neverContacted,
        effectivePhoneRegion,
        seededMemories,
      });

      // TWO-TRANSACTION BOUNDARY (by design): metadata + knowledge subdomains
      // (updateContactFull, one txn) and links (applyLinkDiff, second txn) are
      // SEPARATE transactions, so link writes never bloat the metadata transaction.
      // Metadata + knowledge FIRST.
      let saveResult: Awaited<ReturnType<typeof updateContactFull>>;
      try {
        saveResult = await updateContactFull(exec, input);
      } catch (err) {
        // Metadata failed → NOTHING persisted. Generic save-failure copy.
        Logger.error(LOG_SCOPE, "failed to save contact metadata", err);
        Alert.alert("Couldn't save contact. Please try again.");
        return;
      }

      // Custom values (incl. any cv- photo path) are now COMMITTED — update the
      // orphan-cleanup baseline so the teardown reconcile keeps the saved photo.
      committedValuesRef.current = { ...form.values };

      // RECONCILE-AFTER-SAVE (review item B): reminders_off + interval_days are
      // now persisted (updateContactFull committed above). After H5/A a future
      // decay notification is pre-parked per eligible contact, so muting a contact
      // or changing its interval must cancel/re-arm the OS schedule IMMEDIATELY —
      // the launch-only reconcile would let the stale notification fire first
      // (NOTIF-03). Fire-and-forget + Logger-guarded: it must NOT block the save or
      // the navigation, and a stale/purged row or OS hiccup must not surface as an
      // unhandled rejection. Placed here so it runs on a successful metadata commit
      // even if the later links diff fails (the mute/interval change is already
      // persisted). reconcileSchedule is self-coordinating (concurrent calls
      // coalesce), and the app is alive here so channels exist — a full reconcile
      // is safe, exactly as the settings-change reconcile does.
      if (lifecycleDirection) {
        void applyLifecycleTransitionEffects(contactId, lifecycleDirection, {
          exec,
        });
      } else {
        void reconcileSchedule(exec).catch((e) =>
          Logger.error(LOG_SCOPE, "reconcile after edit-save failed", e),
        );
        notifyWidgetDataChanged();
      }

      // Metadata (incl. the first interaction) is now COMMITTED and last_contact
      // is set. Clear the never-contacted first-interaction intent in LOCAL STATE
      // immediately, independent of the links diff or any reseed. This is the
      // load-bearing guard against re-emitting firstInteraction on a retry: if we
      // instead relied on the best-effort reseedMetadataAfterPartialSave() below
      // and that reseed itself threw, a retry would re-emit firstInteraction, the
      // DAO would reject the double-log, and the form would wedge until remount.
      if (neverContacted && input.firstInteraction) {
        setNeverContacted(false);
        setField("lastSpoke", { kind: "not-yet" });
      }

      // Metadata is COMMITTED. Now the links diff in its own transaction.
      try {
        await applyLinkDiff(exec, {
          contactId,
          seeded: seededLinks,
          current: buildLinksForDiff(linksDraft),
          now,
        });
      } catch (err) {
        // PARTIAL SAVE: the links diff rolled back atomically, but the contact
        // METADATA + KNOWLEDGE STAY COMMITTED. Do NOT show the generic "Couldn't
        // save contact" copy (it would falsely imply nothing saved). Re-seed the
        // metadata + knowledge from the committed rows, KEEP linksDraft for retry,
        // and STAY on the form (no navigation).
        Logger.error(LOG_SCOPE, "links save failed (metadata committed)", err);
        await reseedMetadataAfterPartialSave();
        Alert.alert("Contact saved — some links couldn't be saved. Try again.");
        return;
      }

      if (saveResult.methodSaveResult?.status === "canonicalDuplicate") {
        setField(
          "methods",
          seedMethodGroups({
            phone: saveResult.methods.filter(
              (method) => method.method_type === "phone",
            ),
            email: saveResult.methods.filter(
              (method) => method.method_type === "email",
            ),
          }),
        );
        setDuplicateHelper({
          type: saveResult.methodSaveResult.methodType,
          copy: canonicalDuplicateCopy(saveResult.methodSaveResult.methodType),
        });
        return;
      }
      bypassRef.current = true;
      navigation.navigate("Profile", { contactId });
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to save contact", err);
      Alert.alert("Couldn't save contact. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function onBirthdayChange(event: DateTimePickerEvent, date?: Date) {
    setShowBirthdayPicker(false);
    if (event.type !== "set" || !date) {
      return; // Android cancel/dismiss — keep the prior value.
    }
    setField("birthdayInput", formatLocalDate(date));
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
      }) ||
      valuesSignature(form.values) !==
        valuesSignature(committedValuesRef.current) ||
      JSON.stringify(buildLinksForDiff(linksDraft)) !==
        JSON.stringify(buildLinksForDiff(toLinkDrafts(seededLinks))));

  useDiscardKeepGuard({ hasUnsavedChanges, bypassRef });

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
      <View testID="edit-contact-loading" style={styles.loading}>
        <AppText role="body" style={{ color: colors.textSecondary }}>
          Loading…
        </AppText>
      </View>
    );
  }

  const birthdayLabel = form.birthdayInput
    ? form.birthdayYearUnknown
      ? form.birthdayInput.slice(5) // MM-DD (year hidden)
      : form.birthdayInput
    : "Set birthday";
  const birthdaySeed =
    (form.birthdayInput ? parseDate(form.birthdayInput) : null) ?? new Date();
  const memoryItems = (form.memories ?? []).map((row) =>
    memoryDraftRowToItem(
      row,
      contactId,
      row.id != null ? (memoryAllowAiRef.current.get(row.id) ?? 0) : 0,
    ),
  );

  return (
    <ScrollView
      ref={scrollRef}
      testID="edit-contact-screen"
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          testID="edit-contact-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { borderColor: colors.border }]}
        >
          <AppText role="label" style={{ color: colors.textSecondary }}>
            Back
          </AppText>
        </Pressable>
        <AppText role="display" accessibilityRole="header">
          Edit contact
        </AppText>
      </View>

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
            cacheBust={photoModifiedAt}
            onChanged={refreshPhoto}
          />
        </View>

        <View style={styles.field}>
          <AppText role="label" style={{ color: colors.textSecondary }}>
            Name
          </AppText>
          <TextInput
            testID="edit-contact-name"
            accessibilityLabel="Name"
            value={form.name}
            onChangeText={(v) => setField("name", v)}
            placeholder="Their name"
            placeholderTextColor={colors.textSecondary}
            style={inputStyle}
          />
        </View>

        <View style={styles.field}>
          <AppText role="label" style={{ color: colors.textSecondary }}>
            Category
          </AppText>
          <View
            style={[
              styles.pickerShell,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Picker
              testID="edit-contact-category"
              accessibilityLabel="Category"
              selectedValue={form.categoryId ?? -1}
              onValueChange={(v) =>
                setField("categoryId", v === -1 ? null : Number(v))
              }
              dropdownIconColor={colors.textSecondary}
              style={{ color: colors.textPrimary }}
            >
              <Picker.Item label="No category" value={-1} />
              {categories.map((c) => (
                <Picker.Item key={c.id} label={c.name} value={c.id} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Birthday: native date picker + a "Year unknown" toggle (the native
            picker has no month/day-only mode, so year-optional is app logic —
            MM-DD when unknown, YYYY-MM-DD when known; Pitfall 7). */}
        <View style={styles.field}>
          <AppText role="label" style={{ color: colors.textSecondary }}>
            Birthday
          </AppText>
          <Pressable
            testID="edit-contact-birthday"
            accessibilityRole="button"
            accessibilityLabel="Birthday"
            onPress={() => setShowBirthdayPicker(true)}
            style={[
              styles.input,
              styles.birthdayTrigger,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <AppText
              role="body"
              style={{
                color: form.birthdayInput
                  ? colors.textPrimary
                  : colors.textSecondary,
              }}
            >
              {birthdayLabel}
            </AppText>
          </Pressable>
          <View style={styles.toggleRow}>
            <AppText role="label" style={{ color: colors.textPrimary }}>
              Year unknown
            </AppText>
            <Switch
              testID="edit-contact-birthday-year-unknown"
              accessibilityLabel="Year unknown"
              value={form.birthdayYearUnknown}
              onValueChange={(v) => setField("birthdayYearUnknown", v)}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          {showBirthdayPicker ? (
            <DateTimePicker
              testID="edit-contact-birthday-picker"
              value={birthdaySeed}
              mode="date"
              onChange={onBirthdayChange}
            />
          ) : null}
        </View>

        <View style={styles.field}>
          <AppText role="label" style={{ color: colors.textSecondary }}>
            Social battery
          </AppText>
          <View
            style={[
              styles.pickerShell,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Picker
              testID="edit-contact-social-battery"
              accessibilityLabel="Social battery"
              selectedValue={form.socialBattery ?? ""}
              onValueChange={(v) =>
                setField("socialBattery", v === "" ? null : String(v))
              }
              dropdownIconColor={colors.textSecondary}
              style={{ color: colors.textPrimary }}
            >
              <Picker.Item label="No selection" value="" />
              {SOCIAL_BATTERY_OPTIONS.map((o) => (
                <Picker.Item key={o} label={o} value={o} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Behaviour toggles — the ToggleFieldWidget on/off "1"/"0" convention. */}
        <View style={styles.field}>
          <View style={styles.toggleRow}>
            <AppText role="label" style={{ color: colors.textPrimary }}>
              Rarely responds
            </AppText>
            <Switch
              testID="edit-contact-rarely-responds"
              accessibilityLabel="Rarely responds"
              value={form.rarelyResponds === 1}
              onValueChange={(v) => setField("rarelyResponds", v ? 1 : 0)}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            Attempts to reach out won't reset their orbit
          </AppText>
        </View>

        <View style={styles.field}>
          <View style={styles.toggleRow}>
            <AppText role="label" style={{ color: colors.textPrimary }}>
              Mute reminders
            </AppText>
            <Switch
              testID="edit-contact-reminders-off"
              accessibilityLabel="Mute reminders"
              value={form.remindersOff === 1}
              onValueChange={(v) => setField("remindersOff", v ? 1 : 0)}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            Keep them in Orbit, but never get reminders about them.
          </AppText>
        </View>
      </AccordionSection>

      {/* -- Relationship Basics: Bound/Unbound + Frequency + (never-contacted)
          last-spoke. -- */}
      <AccordionSection
        sectionId="relationship"
        title="Relationship Basics"
        expanded={expandedSections.relationship}
        onExpandedChange={(next) => setSectionExpanded("relationship", next)}
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
                              ? (current.intervalDays ?? FREQUENCY_DAYS.Monthly)
                              : current.intervalDays,
                            intervalValid: true,
                          }
                        : current,
                    )
                  }
                  style={[
                    styles.lifecycleChoice,
                    {
                      borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: selected ? colors.accent : colors.surface,
                    },
                  ]}
                >
                  <AppText
                    role="label"
                    style={{
                      color: selected ? colors.background : colors.textPrimary,
                    }}
                  >
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            {form.trackingEnabled
              ? "Bound contacts appear in your active orbit and receive cadence reminders."
              : "Unbound contacts keep their details and history without active cadence reminders."}
          </AppText>
        </View>

        {form.trackingEnabled ? (
          <View style={styles.field}>
            <AppText role="label" style={{ color: colors.textSecondary }}>
              Frequency
            </AppText>
            <FrequencyPicker
              testID="edit-contact-frequency"
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
            setField("methods", addMethodDraft(form.methods, type, newUid()))
          }
          onUpdate={(uid, patch) =>
            setField("methods", updateMethodDraft(form.methods, uid, patch))
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

      {/* -- Memories (§E). Seeded by its OWN read (listMemoriesForContact); the
          Allow-AI control reflects the REAL app AI setting (getAppSettings), never a
          hardcoded false (Review cycle-4 LOW #4 / D-04). -- */}
      <AccordionSection
        sectionId="memories"
        title="Memories"
        expanded={expandedSections.memories}
        onExpandedChange={(next) => setSectionExpanded("memories", next)}
        containerRef={registerSectionRef("memories")}
      >
        <MemoryEditor
          testID="edit-contact-memories"
          items={memoryItems}
          globalAiEnabled={globalAiEnabled}
          onAdd={addMemoryRow}
          onEdit={editMemoryRow}
          onDelete={deleteMemoryRow}
          onRestore={() => {}}
          onSetAllowAi={(id, allow) => void setMemoryAllowAiFor(id, allow)}
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
          <View testID="edit-contact-custom-block" style={styles.customBlock}>
            {editDefs.map((def) => (
              <View key={def.id} style={styles.field}>
                <AppText role="label" style={{ color: colors.textSecondary }}>
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

      <Pressable
        testID="edit-contact-save"
        accessibilityRole="button"
        accessibilityLabel="Save changes"
        accessibilityState={{ disabled: !savable }}
        disabled={!savable}
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
            color: savable ? colors.background : colors.textSecondary,
          }}
        >
          Save changes
        </AppText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  field: {
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  birthdayTrigger: {
    minHeight: 44,
    justifyContent: "center",
  },
  pickerShell: {
    borderWidth: 1,
    borderRadius: 8,
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
