import { describe, expect, it } from "vitest";
import type { LastSpokeValue } from "@/components/tri-state-last-spoke-logic";
import {
  firstBlockingField,
  toFieldErrors,
} from "@/components/ui/field-error-logic";
import type { ContactEditRow, ContactForEdit } from "@/db/contact-read";
import type { MemoryRow } from "@/db/memories-read";
import {
  applyMemoryPatch,
  type BuildEditInputDeps,
  buildBirthdayForStorage,
  buildEditInput,
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
  parseBirthdayForForm,
  resolveEditSaveExit,
  resolveErrorSection,
  seedEditState,
} from "./edit-contact-logic";

const NOW = "2026-08-15 14:30:00";

function contactRow(overrides: Partial<ContactEditRow> = {}): ContactEditRow {
  return {
    id: 7,
    uid: "c-uid",
    name: "Chris",
    category_id: 3,
    interval_days: 30,
    social_battery: null,
    birthday: null,
    photo: null,
    last_contact: null,
    favourite_rank: null,
    trackingEnabled: 1,
    ring_seq: null,
    archived_at: null,
    snooze_until: null,
    rarely_responds: 0,
    reminders_off: 0,
    created_at: NOW,
    modified_at: NOW,
    category_label: "Friends",
    ...overrides,
  };
}

function forEdit(
  overrides: Partial<ContactEditRow> = {},
  values: Record<string, string | null> = {},
): ContactForEdit {
  const contact = contactRow(overrides);
  return {
    contact,
    categoryLabel: contact.category_label,
    values,
    links: [],
    methods: { phone: [], email: [] },
  };
}

function deps(overrides: Partial<BuildEditInputDeps> = {}): BuildEditInputDeps {
  return {
    now: NOW,
    contactId: 7,
    interactionUid: "i-uid",
    editDefs: [],
    neverContacted: false,
    effectivePhoneRegion: "US",
    ...overrides,
  };
}

function state(overrides: Partial<EditFormState> = {}): EditFormState {
  return {
    name: "Chris",
    categoryId: 3,
    intervalDays: 30,
    intervalValid: true,
    socialBattery: null,
    birthdayInput: null,
    birthdayYearUnknown: false,
    methods: { phone: [], email: [] },
    rarelyResponds: 0,
    remindersOff: 0,
    values: {},
    lastSpoke: { kind: "not-yet" } as LastSpokeValue,
    ...overrides,
  };
}

describe("isNeverContacted", () => {
  it("is true when last_contact IS NULL, false when set", () => {
    expect(isNeverContacted(forEdit({ last_contact: null }))).toBe(true);
    expect(
      isNeverContacted(forEdit({ last_contact: "2026-08-01 00:00:00" })),
    ).toBe(false);
  });
});

describe("parseBirthdayForForm (Pitfall 7)", () => {
  it("null -> unset", () => {
    expect(parseBirthdayForForm(null)).toEqual({
      birthdayInput: null,
      birthdayYearUnknown: false,
    });
  });

  it("MM-DD (5 chars) -> year unknown, leap-safe placeholder year", () => {
    expect(parseBirthdayForForm("02-29")).toEqual({
      birthdayInput: "2000-02-29",
      birthdayYearUnknown: true,
    });
  });

  it("YYYY-MM-DD -> year known", () => {
    expect(parseBirthdayForForm("1990-07-04")).toEqual({
      birthdayInput: "1990-07-04",
      birthdayYearUnknown: false,
    });
  });
});

describe("buildBirthdayForStorage (Pitfall 7)", () => {
  it("year known -> YYYY-MM-DD", () => {
    expect(buildBirthdayForStorage("1990-07-04", false)).toBe("1990-07-04");
  });

  it("year unknown -> MM-DD (string length distinguishes the two)", () => {
    expect(buildBirthdayForStorage("2000-02-29", true)).toBe("02-29");
    expect(buildBirthdayForStorage("2000-02-29", true)).toHaveLength(5);
  });

  it("null/empty -> null", () => {
    expect(buildBirthdayForStorage(null, false)).toBeNull();
    expect(buildBirthdayForStorage("", true)).toBeNull();
  });
});

describe("seedEditState", () => {
  it("seeds every fixed column, toggles, birthday split, and values map", () => {
    const s = seedEditState(
      forEdit(
        {
          name: "Sam",
          category_id: 5,
          interval_days: 14,
          social_battery: "Charger",
          birthday: "07-04",
          rarely_responds: 1,
          reminders_off: 1,
        },
        { hobby: "chess" },
      ),
    );
    expect(s.name).toBe("Sam");
    expect(s.categoryId).toBe(5);
    expect(s.intervalDays).toBe(14);
    expect(s.intervalValid).toBe(true);
    expect(s.socialBattery).toBe("Charger");
    expect(s.birthdayInput).toBe("2000-07-04");
    expect(s.birthdayYearUnknown).toBe(true);
    // 38.11 D-61 (V-10): a stored MM-DD seeds a placeholder year.
    expect(s.birthdayYearIsPlaceholder).toBe(true);
    expect(s.methods).toEqual({ phone: [], email: [] });
    expect(s.rarelyResponds).toBe(1);
    expect(s.remindersOff).toBe(1);
    expect(s.values).toEqual({ hobby: "chess" });
    expect(s.lastSpoke).toEqual({ kind: "not-yet" });
  });

  it("seeds ordered method drafts from the normalized read boundary", () => {
    const seeded = forEdit();
    seeded.methods.phone.push({
      id: 8,
      uid: "p-uid",
      contact_id: 7,
      method_type: "phone",
      raw_value: "555",
      display_value: "555",
      canonical_value: null,
      canonical_region: null,
      extension: "12",
      label: null,
      is_actionable: 0,
      is_primary: 1,
      display_order: 0,
      created_at: NOW,
      modified_at: NOW,
    });
    const s = seedEditState(seeded);
    expect(s.methods.phone[0]).toMatchObject({
      id: 8,
      uid: "p-uid",
      value: "555",
      extension: "12",
      isPrimary: true,
    });
  });
});

describe("canSave", () => {
  it("blocks an empty or whitespace-only name", () => {
    expect(canSave(state({ name: "" }))).toBe(false);
    expect(canSave(state({ name: "   " }))).toBe(false);
  });

  it("blocks Save when the custom interval is invalid", () => {
    expect(canSave(state({ intervalValid: false }))).toBe(false);
  });

  it("allows a valid name + interval", () => {
    expect(canSave(state({ name: "Chris" }))).toBe(true);
  });

  it("allows a never-assigned Unbound edit without a cadence", () => {
    expect(
      canSave(
        state({
          intervalDays: null as never,
          intervalValid: false,
          trackingEnabled: false,
        }),
      ),
    ).toBe(true);
  });
});

describe("buildEditInput", () => {
  it("carries method drafts and region context with id + toggles", () => {
    const out = buildEditInput(
      state({
        name: "  Chris ",
        methods: {
          phone: [
            {
              uid: "p1",
              type: "phone",
              value: "  555-1234 ",
              extension: "12",
              label: "Mobile",
            },
          ],
          email: [],
        },
        rarelyResponds: 1,
        remindersOff: 1,
      }),
      deps(),
    );
    expect(out.id).toBe(7);
    expect(out.name).toBe("Chris");
    expect(out.methodDrafts).toEqual([
      {
        uid: "p1",
        type: "phone",
        value: "  555-1234 ",
        extension: "12",
        label: "Mobile",
        isPrimary: undefined,
      },
    ]);
    expect(out.methodNormalization).toEqual({ effectivePhoneRegion: "US" });
    expect(out.trackingEnabled).toBe(true);
    expect(out.rarelyResponds).toBe(1);
    expect(out.remindersOff).toBe(1);
    expect(out).not.toHaveProperty("rowUid");
    expect(out.now).toBe(NOW);
  });

  it("stores MM-DD when the year is unknown, YYYY-MM-DD when known", () => {
    expect(
      buildEditInput(
        state({ birthdayInput: "2000-02-29", birthdayYearUnknown: true }),
        deps(),
      ).birthday,
    ).toBe("02-29");
    expect(
      buildEditInput(
        state({ birthdayInput: "1990-07-04", birthdayYearUnknown: false }),
        deps(),
      ).birthday,
    ).toBe("1990-07-04");
  });

  it("maps edit definition pairs to values, missing -> null", () => {
    const out = buildEditInput(
      state({ values: { hobby: "chess", note: null } }),
      deps({
        editDefs: [
          { id: 21, col_name: "hobby" },
          { id: 22, col_name: "note" },
          { id: 23, col_name: "absent" },
        ],
      }),
    );
    expect(out.customValues).toEqual([
      { fieldDefId: 21, value: "chess" },
      { fieldDefId: 22, value: null },
      { fieldDefId: 23, value: null },
    ]);
  });

  it("never-contacted + Today -> firstInteraction (manual, direction null)", () => {
    const out = buildEditInput(
      state({ lastSpoke: { kind: "today" } }),
      deps({ neverContacted: true }),
    );
    expect(out.firstInteraction).toEqual({
      uid: "i-uid",
      occurredAt: NOW,
      source: "manual",
      direction: null,
    });
  });

  it("never-contacted + Pick date -> firstInteraction at local midnight", () => {
    const out = buildEditInput(
      state({ lastSpoke: { kind: "date", date: "2026-08-10" } }),
      deps({ neverContacted: true }),
    );
    expect(out.firstInteraction?.occurredAt).toBe("2026-08-10 00:00:00");
  });

  it("never-contacted + Not yet -> no firstInteraction", () => {
    const out = buildEditInput(
      state({ lastSpoke: { kind: "not-yet" } }),
      deps({ neverContacted: true }),
    );
    expect(out.firstInteraction).toBeUndefined();
  });

  it("already-contacted -> NEVER a firstInteraction, even if Today is chosen", () => {
    const out = buildEditInput(
      state({ lastSpoke: { kind: "today" } }),
      deps({ neverContacted: false }),
    );
    expect(out.firstInteraction).toBeUndefined();
  });
});

// =============================================================================
// Plan 34-05 Task 3 — knowledge-subdomain payload assembly (CAPT-04, §E).
// =============================================================================

describe("buildEditInput — knowledge-subdomain diffs (CAPT-04, §E)", () => {
  it("omits every knowledge subdomain when the draft state is untouched (undefined)", () => {
    const out = buildEditInput(state(), deps());
    expect(out.memories).toBeUndefined();
    expect(out.relationships).toBeUndefined();
    expect(out.offLimits).toBeUndefined();
    expect(out.currentStateEntries).toBeUndefined();
  });

  it("omits a subdomain whose draft equals its seed (no add/edit/delete)", () => {
    const seeded: MemoryDraftRow[] = [
      { id: 1, type: "general", value: "same" },
    ];
    const out = buildEditInput(
      state({ memories: [{ id: 1, type: "general", value: "same" }] }),
      deps({ seededMemories: seeded }),
    );
    expect(out.memories).toBeUndefined();
  });

  it("emits {add,edit,delete} keyed by id: new -> add, changed existing -> edit (no duplicate), removed -> delete", () => {
    const seeded: MemoryDraftRow[] = [
      { id: 1, type: "general", value: "keep-but-edit" },
      { id: 2, type: "general", value: "to-remove" },
    ];
    const draft: MemoryDraftRow[] = [
      { id: 1, type: "general", value: "edited" }, // existing, changed -> edit
      { type: "general", value: "brand new" }, // no id -> add
      // id 2 dropped -> delete
    ];
    const out = buildEditInput(
      state({ memories: draft }),
      deps({ seededMemories: seeded }),
    );

    expect(out.memories?.add).toEqual([
      { type: "general", value: "brand new" },
    ]);
    expect(out.memories?.edit).toEqual([
      { id: 1, type: "general", value: "edited" },
    ]);
    // Edited row is in `edit`, NOT `add` (no duplicate).
    expect(
      out.memories?.add?.some(
        (m) => (m as { value: string }).value === "edited",
      ),
    ).toBe(false);
    expect(out.memories?.delete).toEqual([{ id: 2 }]);
  });

  it("current-state: emits an entry only when non-blank AND changed from seed", () => {
    // unchanged -> omitted
    expect(
      buildEditInput(
        state({ lastTalkedAbout: "same" }),
        deps({ seededCurrentState: { last_talked_about: "same" } }),
      ).currentStateEntries,
    ).toBeUndefined();

    // blank -> omitted
    expect(
      buildEditInput(state({ currentLocation: "   " }), deps())
        .currentStateEntries,
    ).toBeUndefined();

    // changed -> emitted (trimmed)
    expect(
      buildEditInput(
        state({ lastTalkedAbout: " new topic ", currentLocation: "Berlin" }),
        deps({ seededCurrentState: { last_talked_about: "old topic" } }),
      ).currentStateEntries,
    ).toEqual([
      { fieldKey: "last_talked_about", value: "new topic" },
      { fieldKey: "current_location", value: "Berlin" },
    ]);
  });

  it("current-state: a value equal to its seed emits nothing; a changed value emits exactly one (checker cycle 5 W-5)", () => {
    const seed = { last_talked_about: "Their trip" };
    expect(
      buildEditInput(
        state({ lastTalkedAbout: "Their trip" }),
        deps({ seededCurrentState: seed }),
      ).currentStateEntries,
    ).toBeUndefined();
    expect(
      buildEditInput(
        state({ lastTalkedAbout: "Their new job" }),
        deps({ seededCurrentState: seed }),
      ).currentStateEntries,
    ).toEqual([{ fieldKey: "last_talked_about", value: "Their new job" }]);
  });

  it("current-state: an explicitly dated entry is sent with its date, even when the text equals the seed (D-65)", () => {
    expect(
      buildEditInput(
        state({
          lastTalkedAbout: "Their trip",
          lastTalkedAboutDate: "2026-08-14",
        }),
        deps({ seededCurrentState: { last_talked_about: "Their trip" } }),
      ).currentStateEntries,
    ).toEqual([
      {
        fieldKey: "last_talked_about",
        value: "Their trip",
        entryDate: "2026-08-14",
      },
    ]);
  });

  it("Off Limits: every row is Off Limits; a removed seed row is a delete and a new row is a content-only add (D-11; NEW-1)", () => {
    const seeded: OffLimitsDraftRow[] = [
      { id: 10, text: "politics" },
      { id: 11, text: "coffee" },
    ];
    // A host draft still carrying the legacy editor's kind (until plan 14).
    const hostDraft = { kind: "topic", text: "religion" };
    const draft: OffLimitsDraftRow[] = [{ id: 11, text: "coffee" }, hostDraft];

    const out = buildEditInput(
      state({ offLimits: draft }),
      deps({ seededOffLimits: seeded }),
    );

    expect(out.offLimits?.delete).toEqual([{ id: 10 }]);
    expect(out.offLimits?.add).toEqual([{ text: "religion" }]);
    expect(out.offLimits?.add?.[0]).not.toHaveProperty("kind");
    expect(out.offLimits?.edit).toBeUndefined();
  });

  it("Off Limits: an edit in place sends only the id and content fields", () => {
    const seeded: OffLimitsDraftRow[] = [
      { id: 20, label: null, text: "old", url: null },
    ];
    const edited = {
      id: 20,
      kind: "off_limits",
      label: null,
      text: "new",
      url: null,
    };
    const out = buildEditInput(
      state({ offLimits: [edited] }),
      deps({ seededOffLimits: seeded }),
    );
    expect(out.offLimits?.edit).toEqual([
      { id: 20, label: null, text: "new", url: null },
    ]);
  });

  it("Off Limits: an extra key on an untouched row is not a change", () => {
    const seeded: OffLimitsDraftRow[] = [{ id: 30, text: "same" }];
    const draftRow = { id: 30, kind: "off_limits", text: "same" };
    expect(
      buildEditInput(
        state({ offLimits: [draftRow] }),
        deps({ seededOffLimits: seeded }),
      ).offLimits,
    ).toBeUndefined();
  });

  it("a deleted memory is only absent from the draft: the diff turns it into a delete at Save (D-104)", () => {
    const seeded: MemoryDraftRow[] = [
      { id: 5, type: "general", value: "keep" },
      { id: 6, type: "general", value: "drop" },
    ];
    const out = buildEditInput(
      state({ memories: [seeded[0]] }),
      deps({ seededMemories: seeded }),
    );
    expect(out.memories).toEqual({ delete: [{ id: 6 }] });
  });
});

// =============================================================================
// Memory draft adapters and Allow AI as draft state (D-25, D-27, D-102, D-103;
// checker cycle 2 W-1; convergence c1 F-U5).
// =============================================================================

function memoryRow(overrides: Partial<MemoryRow> = {}): MemoryRow {
  return {
    id: 41,
    uid: "m-uid",
    contact_id: 7,
    type: "general",
    custom_label: null,
    value: "A thing",
    note: null,
    url: null,
    meaningful_date: null,
    pinned: 0,
    outdated: 0,
    hidden: null,
    provenance: "user",
    created_at: NOW,
    modified_at: NOW,
    deleted_at: null,
    allow_ai: 0,
    interaction_id: null,
    link_source: null,
    group_note_copy: 0,
    linked_note_ai_locked: 0,
    ...overrides,
  };
}

describe("memory draft adapters (D-25, D-102, D-103)", () => {
  it("round-trips group_note_copy and linked_note_ai_locked through the draft", () => {
    const copy = memoryRow({ group_note_copy: 1 });
    const locked = memoryRow({ id: 42, linked_note_ai_locked: 1 });
    const copyItem = memoryDraftRowToItem(memoryRowToDraftRow(copy), 7);
    const lockedItem = memoryDraftRowToItem(memoryRowToDraftRow(locked), 7);
    expect(copyItem.group_note_copy).toBe(1);
    expect(copyItem.linked_note_ai_locked).toBe(0);
    expect(lockedItem.group_note_copy).toBe(0);
    expect(lockedItem.linked_note_ai_locked).toBe(1);
  });

  it("round-trips provenance import and allow_ai 1", () => {
    const row = memoryRow({ provenance: "import", allow_ai: 1 });
    const draft = memoryRowToDraftRow(row);
    expect(draft).toMatchObject({ id: 41, provenance: "import", allowAi: 1 });
    const item = memoryDraftRowToItem(draft, 7);
    expect(item.provenance).toBe("import");
    expect(item.allow_ai).toBe(1);
    expect(item.id).toBe(41);
    expect(item.interaction_id).toBeNull();
    expect(item.link_source).toBeNull();
  });

  it("a draft with no provenance maps to user", () => {
    const item = memoryDraftRowToItem({ type: "general", value: "new" }, 7);
    expect(item.provenance).toBe("user");
    expect(item.allow_ai).toBe(0);
    expect(item.group_note_copy).toBe(0);
    expect(item.linked_note_ai_locked).toBe(0);
  });

  it("applyMemoryPatch keeps provenance, the lock markers and the id, and takes the patched text (F-U5)", () => {
    const row = memoryRowToDraftRow(
      memoryRow({ provenance: "import", group_note_copy: 1 }),
    );
    const patched = applyMemoryPatch(row, {
      type: "general",
      value: "Edited text",
      provenance: "user",
      groupNoteCopy: 0,
    });
    expect(patched).toMatchObject({
      id: 41,
      value: "Edited text",
      provenance: "import",
      groupNoteCopy: 1,
      linkedNoteAiLocked: 0,
    });
  });

  it("an untouched seeded row diffs equal (no edit)", () => {
    const seeded = [memoryRowToDraftRow(memoryRow({ provenance: "import" }))];
    expect(
      buildEditInput(
        state({ memories: seeded.map((row) => ({ ...row })) }),
        deps({ seededMemories: seeded }),
      ).memories,
    ).toBeUndefined();
  });
});

describe("buildEditInput — Allow AI is draft state (D-27, D-102, D-103)", () => {
  it("an Allow AI change on an existing memory becomes allowAi on its edit patch", () => {
    const seeded = [memoryRowToDraftRow(memoryRow())];
    const out = buildEditInput(
      state({ memories: [{ ...seeded[0], allowAi: 1 }] }),
      deps({ seededMemories: seeded }),
    );
    expect(out.memories?.edit).toHaveLength(1);
    expect(out.memories?.edit?.[0]).toMatchObject({ id: 41, allowAi: 1 });
  });

  it("an unchanged Allow AI is not sent, and the edit patch never carries provenance or markers", () => {
    const seeded = [memoryRowToDraftRow(memoryRow({ provenance: "import" }))];
    const out = buildEditInput(
      state({ memories: [{ ...seeded[0], value: "changed" }] }),
      deps({ seededMemories: seeded }),
    );
    const patch = out.memories?.edit?.[0];
    expect(patch).toMatchObject({ id: 41, value: "changed" });
    expect(patch).not.toHaveProperty("allowAi");
    expect(patch).not.toHaveProperty("provenance");
    expect(patch).not.toHaveProperty("groupNoteCopy");
    expect(patch).not.toHaveProperty("linkedNoteAiLocked");
  });

  it("a Group Note copy set to allowAi 1 emits no allowAi 1 and no marker fields (W-1)", () => {
    const seeded = [memoryRowToDraftRow(memoryRow({ group_note_copy: 1 }))];
    const out = buildEditInput(
      state({ memories: [{ ...seeded[0], allowAi: 1 }] }),
      deps({ seededMemories: seeded }),
    );
    expect(out.memories).toBeUndefined();
    const edited = buildEditInput(
      state({ memories: [{ ...seeded[0], allowAi: 1, value: "edited" }] }),
      deps({ seededMemories: seeded }),
    );
    const patch = edited.memories?.edit?.[0];
    expect(patch).toMatchObject({ id: 41, value: "edited" });
    expect(patch).not.toHaveProperty("allowAi");
    expect(patch).not.toHaveProperty("groupNoteCopy");
    expect(patch).not.toHaveProperty("linkedNoteAiLocked");
  });

  it("a locked linked memory set to allowAi 1 emits no allowAi 1 and no marker fields (W-1)", () => {
    const seeded = [
      memoryRowToDraftRow(memoryRow({ linked_note_ai_locked: 1 })),
    ];
    const out = buildEditInput(
      state({ memories: [{ ...seeded[0], allowAi: 1, value: "edited" }] }),
      deps({ seededMemories: seeded }),
    );
    const patch = out.memories?.edit?.[0];
    expect(patch).toMatchObject({ id: 41, value: "edited" });
    expect(patch).not.toHaveProperty("allowAi");
    expect(patch).not.toHaveProperty("linkedNoteAiLocked");
  });

  it("a new memory's add carries its Allow AI choice but never a lock marker", () => {
    const out = buildEditInput(
      state({
        memories: [
          { type: "general", value: "new", allowAi: 1 },
          { type: "general", value: "odd", allowAi: 1, groupNoteCopy: 1 },
        ],
      }),
      deps(),
    );
    expect(out.memories?.add).toEqual([
      { type: "general", value: "new", allowAi: 1 },
      { type: "general", value: "odd", allowAi: 0 },
    ]);
  });
});

describe("resolveErrorSection + collectEditBlockingErrors (reveal-and-focus)", () => {
  it("maps the first blocking error to its section id", () => {
    const errors = collectEditBlockingErrors(state({ name: "   " }));
    expect(resolveErrorSection(errors, EDIT_SECTION_FIELD_MAP)).toBe(
      "identity",
    );
  });

  it("maps a cadence error to the relationship section", () => {
    const errors = collectEditBlockingErrors(
      state({ name: "OK", trackingEnabled: true, intervalValid: false }),
    );
    expect(resolveErrorSection(errors, EDIT_SECTION_FIELD_MAP)).toBe(
      "relationship",
    );
  });

  it("returns null when there are no blocking errors", () => {
    const errors = collectEditBlockingErrors(state());
    expect(errors).toEqual([]);
    expect(resolveErrorSection(errors, EDIT_SECTION_FIELD_MAP)).toBeNull();
  });
});

describe("Edit Contact inline name error (38.9 D-19, E-02)", () => {
  it("an empty name yields the rendered message and is revealed first", () => {
    const errors = toFieldErrors(
      collectEditBlockingErrors(
        state({ name: "", trackingEnabled: true, intervalValid: false }),
      ),
    );
    expect(errors.name).toBe("Enter a name to save.");
    expect(firstBlockingField(EDIT_FIELD_REVEAL_ORDER, errors)).toBe("name");
  });

  it("with a name, the invalid cadence is the first blocking field", () => {
    const errors = toFieldErrors(
      collectEditBlockingErrors(
        state({ name: "OK", trackingEnabled: true, intervalValid: false }),
      ),
    );
    expect(errors.name).toBeUndefined();
    expect(firstBlockingField(EDIT_FIELD_REVEAL_ORDER, errors)).toBe(
      "frequency",
    );
  });

  it("every field in the reveal order maps to a section", () => {
    for (const field of EDIT_FIELD_REVEAL_ORDER) {
      expect(EDIT_SECTION_FIELD_MAP[field]).toBeDefined();
    }
  });
});

describe("Last Talked About / Current Location rows start blank (38.10 plan 14; D-65, D-26)", () => {
  // Edit Contact seeds both rows and their CurrentStateSeed blank
  // (convergence c3, Claude C-04), so the latest stored entry never hides
  // a new entry with the same text.
  const BLANK_SEED = {};
  const YESTERDAY = "2026-08-14";

  it("the latest entry's text again on a new date is appended once (convergence c3, Claude C-04)", () => {
    // The contact's latest stored Last Talked About is also "soccer"; the
    // form does not see it, because the seed is blank.
    const out = buildEditInput(
      state({ lastTalkedAbout: "soccer", lastTalkedAboutDate: YESTERDAY }),
      deps({ seededCurrentState: BLANK_SEED }),
    );
    expect(out.currentStateEntries).toEqual([
      {
        fieldKey: "last_talked_about",
        value: "soccer",
        entryDate: YESTERDAY,
      },
    ]);
  });

  it("with today's default date (no pick) the same text is still appended once", () => {
    const out = buildEditInput(
      state({ lastTalkedAbout: "soccer" }),
      deps({ seededCurrentState: BLANK_SEED }),
    );
    expect(out.currentStateEntries).toEqual([
      { fieldKey: "last_talked_about", value: "soccer" },
    ]);
  });

  it("a blank row emits no entry, so an untouched form stays clean", () => {
    const untouched = state({ lastTalkedAbout: "", currentLocation: "" });
    const out = buildEditInput(
      untouched,
      deps({ seededCurrentState: BLANK_SEED }),
    );
    expect(out.currentStateEntries).toBeUndefined();
    // A picked date with no text is not an entry either.
    expect(
      buildEditInput(
        state({ lastTalkedAbout: "  ", lastTalkedAboutDate: YESTERDAY }),
        deps({ seededCurrentState: BLANK_SEED }),
      ).currentStateEntries,
    ).toBeUndefined();
  });

  it("a second Save after a partial save appends nothing (convergence c5, Claude C-02)", () => {
    const options = deps({ seededCurrentState: BLANK_SEED });
    const submitted = state({
      lastTalkedAbout: "soccer",
      lastTalkedAboutDate: YESTERDAY,
      currentLocation: "",
    });
    const first = buildEditInput(submitted, options);
    expect(first.currentStateEntries).toHaveLength(1);

    // applyCommittedBaseline after a linksFailed / canonicalDuplicate outcome
    // keeps the screen open with both rows blank, their dates reset to
    // today's default and the seed blank. The committed signature is built
    // the same way (editInputSignature = JSON.stringify(buildEditInput)).
    const afterPartialSave = {
      ...submitted,
      lastTalkedAbout: "",
      lastTalkedAboutDate: undefined,
      currentLocation: "",
      currentLocationDate: undefined,
    };
    const committed = {
      ...submitted,
      lastTalkedAbout: "",
      lastTalkedAboutDate: undefined,
      currentLocation: "",
      currentLocationDate: undefined,
    };
    expect(JSON.stringify(buildEditInput(afterPartialSave, options))).toBe(
      JSON.stringify(buildEditInput(committed, options)),
    );
    const second = buildEditInput(afterPartialSave, options);
    expect(second.currentStateEntries).toBeUndefined();
    const total =
      (first.currentStateEntries?.length ?? 0) +
      (second.currentStateEntries?.length ?? 0);
    expect(total).toBe(1);
  });
});

describe("resolveEditSaveExit: Edit save returns to the Profile it came from (D-26, D-13)", () => {
  type Route = { name: string; params?: { contactId?: number } };
  const stack = (...routes: Route[]) => ({
    routes: routes.map((route, i) => ({ key: `k${i}`, ...route })),
    index: routes.length - 1,
  });

  /** Apply the exit to a stack, as goBack / replace would. */
  function applyExit(
    state: ReturnType<typeof stack>,
    exit: ReturnType<typeof resolveEditSaveExit>,
  ): Route[] {
    const routes = state.routes.slice(0, state.index + 1);
    if (exit.kind === "go-back") return routes.slice(0, -1);
    return [...routes.slice(0, -1), { name: exit.name, params: exit.params }];
  }

  it("Profile(c) -> Edit(c) goes back", () => {
    const state = stack(
      { name: "Home" },
      { name: "Profile", params: { contactId: 7 } },
      { name: "Edit", params: { contactId: 7 } },
    );
    expect(resolveEditSaveExit(state, 7)).toEqual({ kind: "go-back" });
  });

  it("Profile(c) -> Compose(c) -> Edit(c) goes back to Compose", () => {
    const state = stack(
      { name: "Profile", params: { contactId: 7 } },
      { name: "Compose", params: { contactId: 7 } },
      { name: "Edit", params: { contactId: 7 } },
    );
    expect(resolveEditSaveExit(state, 7)).toEqual({ kind: "go-back" });
  });

  it("Home -> Edit(c) replaces Edit with Profile(c)", () => {
    const state = stack(
      { name: "Home" },
      { name: "Edit", params: { contactId: 7 } },
    );
    expect(resolveEditSaveExit(state, 7)).toEqual({
      kind: "replace",
      name: "Profile",
      params: { contactId: 7 },
    });
  });

  it("Profile(other) -> Edit(c) replaces with Profile(c), never another contact's Profile", () => {
    const state = stack(
      { name: "Profile", params: { contactId: 9 } },
      { name: "Edit", params: { contactId: 7 } },
    );
    expect(resolveEditSaveExit(state, 7)).toEqual({
      kind: "replace",
      name: "Profile",
      params: { contactId: 7 },
    });
  });

  it("after the exit no Edit route is left under the Profile (a later Bin/archive goBack cannot land on it)", () => {
    for (const state of [
      stack(
        { name: "Profile", params: { contactId: 7 } },
        { name: "Edit", params: { contactId: 7 } },
      ),
      stack({ name: "Home" }, { name: "Edit", params: { contactId: 7 } }),
    ]) {
      const after = applyExit(state, resolveEditSaveExit(state, 7));
      expect(after.some((route) => route.name === "Edit")).toBe(false);
      expect(after.at(-1)).toMatchObject({
        name: "Profile",
        params: { contactId: 7 },
      });
    }
  });

  it("a missing or empty state replaces with the Profile", () => {
    expect(resolveEditSaveExit(undefined, 7)).toEqual({
      kind: "replace",
      name: "Profile",
      params: { contactId: 7 },
    });
    expect(resolveEditSaveExit({ routes: [], index: 0 }, 7)).toMatchObject({
      kind: "replace",
    });
  });
});
