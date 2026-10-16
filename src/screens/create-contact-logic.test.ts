import { describe, expect, it } from "vitest";
import type { MethodGroups } from "@/components/contact-methods-editor-model";
import {
  addMethodDraft,
  removeMethodDraft,
} from "@/components/contact-methods-editor-model";
import type { LastSpokeValue } from "@/components/tri-state-last-spoke-logic";
import {
  firstBlockingField,
  toFieldErrors,
} from "@/components/ui/field-error-logic";
import { NEW_CONTACT_DEFAULT_INTERVAL_DAYS } from "@/constants/new-contact-defaults";
import { resolveCategorySelection } from "@/logic/category-logic";
import {
  addDraftItem,
  type BuildCreateInputDeps,
  buildCreateInput,
  CREATE_FIELD_REVEAL_ORDER,
  CREATE_SECTION_FIELD_MAP,
  type CreateFormState,
  canSave,
  canSaveOffLimitsForm,
  collectBlockingErrors,
  coordinateBoundToggle,
  coordinateCadenceSelection,
  createFormSeedSignature,
  createFormSeedState,
  firstInteractionOccurredAt,
  isCreateFormDirty,
  isOffLimitsFormDirty,
  normalizeOffLimitsForm,
  offLimitsFormDraft,
  offLimitsFormOpening,
  partitionMemoryRows,
  pickCreateSubEditor,
  removeDraftItem,
  replaceDraftItem,
  resolveErrorSection,
} from "./create-contact-logic";

const NOW = "2026-08-15 14:30:00";

function deps(
  overrides: Partial<BuildCreateInputDeps> = {},
): BuildCreateInputDeps {
  return {
    now: NOW,
    contactUid: "c-uid",
    interactionUid: "i-uid",
    createDefs: [],
    effectivePhoneRegion: "US",
    ...overrides,
  };
}

function state(overrides: Partial<CreateFormState> = {}): CreateFormState {
  return {
    name: "Chris",
    categoryId: null,
    intervalDays: 30,
    intervalValid: true,
    lastSpoke: { kind: "today" } as LastSpokeValue,
    methods: { phone: [], email: [] },
    values: {},
    ...overrides,
  };
}

describe("canSave", () => {
  it("blocks an empty or whitespace-only name", () => {
    expect(canSave(state({ name: "" }))).toBe(false);
    expect(canSave(state({ name: "   " }))).toBe(false);
  });

  it("blocks Save when the custom interval is invalid", () => {
    expect(canSave(state({ intervalValid: false }))).toBe(false);
  });

  it("allows a name-only save with a valid interval", () => {
    expect(canSave(state({ name: "Chris", intervalValid: true }))).toBe(true);
  });

  it("requires a valid cadence only while Bound", () => {
    expect(
      canSave(
        state({
          intervalDays: null as never,
          intervalValid: false,
          trackingEnabled: false,
        }),
      ),
    ).toBe(true);
    expect(
      canSave(state({ intervalValid: false, trackingEnabled: true })),
    ).toBe(false);
  });
});

describe("firstInteractionOccurredAt", () => {
  it("uses now for Today", () => {
    expect(firstInteractionOccurredAt({ kind: "today" }, NOW)).toBe(NOW);
  });

  it("pins a picked date to local midnight (never a bare 10-char date)", () => {
    expect(
      firstInteractionOccurredAt({ kind: "date", date: "2026-08-10" }, NOW),
    ).toBe("2026-08-10 00:00:00");
  });

  it("returns null for Not yet", () => {
    expect(firstInteractionOccurredAt({ kind: "not-yet" }, NOW)).toBeNull();
  });
});

describe("coordinateBoundToggle (Bound/Unbound cadence coordination — CAPT-03)", () => {
  it("unbinding retains any interval as dormant and never blocks Save", () => {
    expect(coordinateBoundToggle({ intervalDays: 30 }, false)).toEqual({
      trackingEnabled: false,
      intervalDays: 30,
      intervalValid: true,
    });
    expect(coordinateBoundToggle({ intervalDays: null }, false)).toEqual({
      trackingEnabled: false,
      intervalDays: null,
      intervalValid: true,
    });
  });

  it("binding with no cadence requires the user to pick a valid interval", () => {
    expect(coordinateBoundToggle({ intervalDays: null }, true)).toEqual({
      trackingEnabled: true,
      intervalDays: null,
      intervalValid: false,
    });
  });

  it("binding with a dormant cadence rebinds valid, reusing the interval", () => {
    expect(coordinateBoundToggle({ intervalDays: 30 }, true)).toEqual({
      trackingEnabled: true,
      intervalDays: 30,
      intervalValid: true,
    });
  });

  it("never models Unbound as interval_days=null (the flag is trackingEnabled)", () => {
    // A non-positive/invalid dormant interval does not count as a valid cadence.
    expect(coordinateBoundToggle({ intervalDays: 0 }, true)).toEqual({
      trackingEnabled: true,
      intervalDays: 0,
      intervalValid: false,
    });
  });
});

describe("coordinateCadenceSelection (selecting a cadence turns Bound on)", () => {
  it("selecting a valid cadence turns Bound on with that interval", () => {
    expect(coordinateCadenceSelection(14)).toEqual({
      trackingEnabled: true,
      intervalDays: 14,
      intervalValid: true,
    });
  });
});

describe("buildCreateInput", () => {
  it("passes ordered method drafts and region context to the aggregate contract", () => {
    const methods: MethodGroups = {
      phone: [
        {
          uid: "p1",
          type: "phone",
          value: "  555-1234 ",
          extension: "12",
          label: "Mobile",
          isPrimary: true,
        },
        {
          uid: "blank",
          type: "phone",
          value: "   ",
          extension: "",
          label: "Main",
        },
      ],
      email: [],
    };
    const out = buildCreateInput(
      state({ methods }),
      deps({ effectivePhoneRegion: "GB" }),
    );
    expect(out.methodDrafts).toEqual([
      {
        uid: "p1",
        type: "phone",
        value: "  555-1234 ",
        extension: "12",
        label: "Mobile",
        isPrimary: true,
      },
    ]);
    expect(out.methodNormalization).toEqual({ effectivePhoneRegion: "GB" });
    expect(out.trackingEnabled).toBe(true);
    expect(out).not.toHaveProperty("phone");
  });

  it("trims the name and carries category + rarelyResponds=0 + contact uid", () => {
    const out = buildCreateInput(
      state({ name: "  Chris ", categoryId: 3 }),
      deps(),
    );
    expect(out.name).toBe("Chris");
    expect(out.categoryId).toBe(3);
    expect(out.rarelyResponds).toBe(0);
    expect(out.uid).toBe("c-uid");
    expect(out).not.toHaveProperty("rowUid");
    expect(out.intervalDays).toBe(30);
    expect(out.now).toBe(NOW);
  });

  it("maps show_on_new definition pairs to their values, missing → null", () => {
    const out = buildCreateInput(
      state({ values: { hobby: "chess", note: null } }),
      deps({
        createDefs: [
          { id: 11, col_name: "hobby" },
          { id: 12, col_name: "note" },
          { id: 13, col_name: "absent" },
        ],
      }),
    );
    expect(out.customValues).toEqual([
      { fieldDefId: 11, value: "chess" },
      { fieldDefId: 12, value: null },
      { fieldDefId: 13, value: null },
    ]);
  });

  it("Today → firstInteraction occurredAt=now, manual, direction null", () => {
    const out = buildCreateInput(
      state({ lastSpoke: { kind: "today" } }),
      deps(),
    );
    expect(out.firstInteraction).toEqual({
      uid: "i-uid",
      occurredAt: NOW,
      source: "manual",
      direction: null,
    });
  });

  it("Pick date → firstInteraction occurredAt at local midnight", () => {
    const out = buildCreateInput(
      state({ lastSpoke: { kind: "date", date: "2026-08-10" } }),
      deps(),
    );
    expect(out.firstInteraction?.occurredAt).toBe("2026-08-10 00:00:00");
    expect(out.firstInteraction?.source).toBe("manual");
    expect(out.firstInteraction?.direction).toBeNull();
  });

  it("Not yet → no firstInteraction (never-contacted, NULL last_contact)", () => {
    const out = buildCreateInput(
      state({ lastSpoke: { kind: "not-yet" } }),
      deps(),
    );
    expect(out.firstInteraction).toBeUndefined();
  });

  it("omits all enrichment arrays on the lean name-only path", () => {
    const out = buildCreateInput(state(), deps());
    expect(out).not.toHaveProperty("memories");
    expect(out).not.toHaveProperty("relationships");
    expect(out).not.toHaveProperty("currentStateEntries");
    expect(out).not.toHaveProperty("offLimits");
  });

  it("passes memories, relationships and offLimits drafts through", () => {
    const out = buildCreateInput(
      state({
        memories: [{ type: "general", value: "Loves hiking" }],
        relationships: [{ personName: "Alex", relationType: "sibling" }],
        offLimits: [{ text: "politics" }],
      }),
      deps(),
    );
    expect(out.memories).toEqual([{ type: "general", value: "Loves hiking" }]);
    expect(out.relationships).toEqual([
      { personName: "Alex", relationType: "sibling" },
    ]);
    expect(out.offLimits).toEqual([{ text: "politics" }]);
  });

  it("sends only Off Limits content fields: an old kind or source on a host draft never reaches the DAO (D-11; NEW-1)", () => {
    // The legacy editor's drafts still carry a kind until plan 14.
    const hostDrafts = [
      { kind: "topic", source: "user", label: null, text: "health", url: null },
    ];
    const out = buildCreateInput(state({ offLimits: hostDrafts }), deps());
    expect(out.offLimits).toEqual([{ label: null, text: "health", url: null }]);
    expect(out.offLimits?.[0]).not.toHaveProperty("kind");
    expect(out.offLimits?.[0]).not.toHaveProperty("source");
  });

  it("carries a picked entry date on a current-state entry (D-65)", () => {
    const out = buildCreateInput(
      state({
        lastTalkedAbout: "Their trip",
        lastTalkedAboutDate: "2026-08-01",
        currentLocation: "Berlin",
      }),
      deps(),
    );
    expect(out.currentStateEntries).toEqual([
      {
        fieldKey: "last_talked_about",
        value: "Their trip",
        entryDate: "2026-08-01",
      },
      { fieldKey: "current_location", value: "Berlin" },
    ]);
  });

  it("maps non-blank Last Talked About + Current Location to currentStateEntries", () => {
    const out = buildCreateInput(
      state({ lastTalkedAbout: "  new job ", currentLocation: "Berlin" }),
      deps(),
    );
    expect(out.currentStateEntries).toEqual([
      { fieldKey: "last_talked_about", value: "new job" },
      { fieldKey: "current_location", value: "Berlin" },
    ]);
  });

  it("omits a blank/whitespace current-state value", () => {
    const out = buildCreateInput(
      state({ lastTalkedAbout: "   ", currentLocation: "Berlin" }),
      deps(),
    );
    expect(out.currentStateEntries).toEqual([
      { fieldKey: "current_location", value: "Berlin" },
    ]);
  });
});

describe("resolveErrorSection (CAPT-14 reveal-and-focus target)", () => {
  it("returns null when there are no blocking errors", () => {
    expect(resolveErrorSection([], CREATE_SECTION_FIELD_MAP)).toBeNull();
  });

  it("maps a name error to the Identity section id", () => {
    expect(
      resolveErrorSection([{ field: "name" }], CREATE_SECTION_FIELD_MAP),
    ).toBe("identity");
  });

  it("maps an invalid email to the Contact Methods section id", () => {
    expect(
      resolveErrorSection([{ field: "email" }], CREATE_SECTION_FIELD_MAP),
    ).toBe("methods");
  });

  it("returns the section of the FIRST blocking error (deterministic order)", () => {
    expect(
      resolveErrorSection(
        [{ field: "frequency" }, { field: "name" }],
        CREATE_SECTION_FIELD_MAP,
      ),
    ).toBe("relationship");
  });

  it("skips an unmapped field and resolves the next mapped one", () => {
    expect(
      resolveErrorSection(
        [{ field: "mystery" }, { field: "name" }],
        CREATE_SECTION_FIELD_MAP,
      ),
    ).toBe("identity");
  });
});

describe("collectBlockingErrors (Add Contact)", () => {
  it("is empty for a valid name-only form", () => {
    expect(collectBlockingErrors(state())).toEqual([]);
  });

  it("flags an empty/whitespace name in the Identity section", () => {
    const errors = collectBlockingErrors(state({ name: "  " }));
    expect(errors.some((e) => e.field === "name")).toBe(true);
    expect(resolveErrorSection(errors, CREATE_SECTION_FIELD_MAP)).toBe(
      "identity",
    );
  });

  it("flags an invalid cadence only while Bound (Relationship Basics)", () => {
    const bound = collectBlockingErrors(
      state({ trackingEnabled: true, intervalValid: false }),
    );
    expect(bound.some((e) => e.field === "frequency")).toBe(true);
    // Unbound never blocks Save on cadence.
    expect(
      collectBlockingErrors(
        state({ trackingEnabled: false, intervalValid: false }),
      ),
    ).toEqual([]);
  });
});

describe("Add Contact inline name error (38.9 D-19, E-02)", () => {
  it("an empty name yields the rendered message and is revealed first", () => {
    const errors = toFieldErrors(
      collectBlockingErrors(
        state({ name: " ", trackingEnabled: true, intervalValid: false }),
      ),
    );
    expect(errors.name).toBe("Enter a name to save.");
    expect(firstBlockingField(CREATE_FIELD_REVEAL_ORDER, errors)).toBe("name");
  });

  it("with a name, the invalid cadence is the first blocking field", () => {
    const errors = toFieldErrors(
      collectBlockingErrors(
        state({ trackingEnabled: true, intervalValid: false }),
      ),
    );
    expect(errors.name).toBeUndefined();
    expect(firstBlockingField(CREATE_FIELD_REVEAL_ORDER, errors)).toBe(
      "frequency",
    );
  });

  it("every field in the reveal order maps to a section", () => {
    for (const field of CREATE_FIELD_REVEAL_ORDER) {
      expect(CREATE_SECTION_FIELD_MAP[field]).toBeDefined();
    }
  });
});

describe("Add Contact dirty check against the seed (D-15, E-01)", () => {
  const baseline = createFormSeedSignature(createFormSeedState());
  const dirty = (state: CreateFormState) =>
    isCreateFormDirty(baseline, createFormSeedSignature(state));

  it("a fresh seed is clean, whatever uid its phone row carries", () => {
    expect(isCreateFormDirty(baseline, baseline)).toBe(false);
    expect(dirty(createFormSeedState())).toBe(false);
  });

  it("seeds Bound, Monthly and Last spoke Not yet (D-01, D-02, D-22)", () => {
    const seed = createFormSeedState();
    expect(seed).toMatchObject({
      name: "",
      categoryId: null,
      intervalDays: NEW_CONTACT_DEFAULT_INTERVAL_DAYS,
      intervalValid: true,
      trackingEnabled: true,
      lastSpoke: { kind: "not-yet" },
      values: {},
      memories: [],
      relationships: [],
      lastTalkedAbout: "",
      currentLocation: "",
      offLimits: [],
    });
    expect(seed.methods.phone).toHaveLength(1);
    expect(seed.methods.phone[0].value).toBe("");
    expect(seed.methods.email).toEqual([]);
  });

  it("a typed name is dirty", () => {
    expect(dirty({ ...createFormSeedState(), name: "A" })).toBe(true);
  });

  it("adding then removing a phone row leaves only uid differences: clean", () => {
    const seed = createFormSeedState();
    const added = addMethodDraft(seed.methods, "phone", "extra-uid");
    expect(dirty({ ...seed, methods: added })).toBe(true);
    const removed = removeMethodDraft(added, "extra-uid");
    expect(dirty({ ...seed, methods: removed })).toBe(false);
  });

  it("a name typed before categories resolve is dirty (no baseline wait)", () => {
    // Categories never committed: categoryId stays at its seed (null).
    expect(dirty({ ...createFormSeedState(), name: "A" })).toBe(true);
  });

  it("a failed load (no categories, no create defs) keeps the guard on", () => {
    const seed = createFormSeedState();
    expect(dirty(seed)).toBe(false);
    expect(dirty({ ...seed, name: "Sam" })).toBe(true);
  });

  it("a catalog refresh alone never makes an untouched form dirty", () => {
    const seed = createFormSeedState();
    // Refresh with no pick keeps null; a deleted pick resets to null.
    const refreshed = resolveCategorySelection([{ id: 1, name: "A" }], null);
    expect(dirty({ ...seed, categoryId: refreshed })).toBe(false);
    const deletedPick = resolveCategorySelection([{ id: 2, name: "B" }], 9);
    expect(dirty({ ...seed, categoryId: deletedPick })).toBe(false);
  });

  it("a user-chosen category is dirty", () => {
    expect(dirty({ ...createFormSeedState(), categoryId: 3 })).toBe(true);
  });

  it("unbinding is dirty; binding again returns to clean (D-09)", () => {
    const seed = createFormSeedState();
    const unbound = coordinateBoundToggle(seed, false);
    expect(dirty({ ...seed, ...unbound })).toBe(true);
    const rebound = coordinateBoundToggle(unbound, true);
    expect(dirty({ ...seed, ...rebound })).toBe(false);
  });

  it("the seed signature survives a round trip unchanged (not dirty)", () => {
    const seed = createFormSeedState();
    const roundTripped = JSON.parse(JSON.stringify(seed)) as typeof seed;
    expect(createFormSeedSignature(roundTripped)).toBe(
      createFormSeedSignature(seed),
    );
    expect(dirty(roundTripped)).toBe(false);
  });
});

describe("Add Contact new-contact defaults (D-01, D-02, D-22; 39 D-50, D-51)", () => {
  it("Bound -> Unbound -> Bound keeps Monthly and rebinds valid (E-05)", () => {
    const seed = createFormSeedState();
    const unbound = coordinateBoundToggle(seed, false);
    expect(unbound).toEqual({
      trackingEnabled: false,
      intervalDays: 30,
      intervalValid: true,
    });
    const rebound = coordinateBoundToggle(unbound, true);
    expect(rebound).toEqual({
      trackingEnabled: true,
      intervalDays: 30,
      intervalValid: true,
    });
  });

  it("a name-only save from the seed is Bound every 30 days with no first interaction (D-06)", () => {
    const seed = createFormSeedState();
    expect(canSave({ ...seed, name: "Ann" })).toBe(true);
    const out = buildCreateInput({ ...seed, name: "Ann" }, deps());
    expect(out.trackingEnabled).toBe(true);
    expect(out.intervalDays).toBe(30);
    expect(out.firstInteraction).toBeUndefined();
    expect("firstInteraction" in out).toBe(false);
  });
});

describe("pickCreateSubEditor (C5-M1; D-13, D-14)", () => {
  const closed = { open: false, dirty: false };
  const empty = { open: true, dirty: false };
  const typed = { open: true, dirty: true };

  it("no draft both open and typed into → nothing holds Back", () => {
    expect(
      pickCreateSubEditor({ memory: closed, relationship: closed }),
    ).toEqual({ open: false, dirty: false, which: null });
    expect(pickCreateSubEditor({ memory: empty, relationship: empty })).toEqual(
      {
        open: false,
        dirty: false,
        which: null,
      },
    );
  });

  it("picks the first open-and-dirty draft, memory before relationship", () => {
    expect(
      pickCreateSubEditor({ memory: typed, relationship: closed }),
    ).toEqual({
      open: true,
      dirty: true,
      which: "memory",
    });
    expect(pickCreateSubEditor({ memory: empty, relationship: typed })).toEqual(
      {
        open: true,
        dirty: true,
        which: "relationship",
      },
    );
    expect(pickCreateSubEditor({ memory: typed, relationship: typed })).toEqual(
      {
        open: true,
        dirty: true,
        which: "memory",
      },
    );
  });

  it("a typed Off Limits draft holds Back, after memory and relationship (review CR-01)", () => {
    expect(
      pickCreateSubEditor({
        memory: closed,
        relationship: closed,
        offLimits: typed,
      }),
    ).toEqual({ open: true, dirty: true, which: "offLimits" });
    expect(
      pickCreateSubEditor({
        memory: empty,
        relationship: typed,
        offLimits: typed,
      }),
    ).toEqual({ open: true, dirty: true, which: "relationship" });
    expect(
      pickCreateSubEditor({
        memory: closed,
        relationship: closed,
        offLimits: empty,
      }),
    ).toEqual({ open: false, dirty: false, which: null });
  });

  it("Gift Ideas, Thought of Them and Imported drafts hold Back in form order after Off Limits (38.10 plan 14)", () => {
    const base = { memory: closed, relationship: closed, offLimits: closed };
    expect(pickCreateSubEditor({ ...base, giftIdeas: typed })).toEqual({
      open: true,
      dirty: true,
      which: "giftIdeas",
    });
    expect(pickCreateSubEditor({ ...base, thoughtOfThem: typed })).toEqual({
      open: true,
      dirty: true,
      which: "thoughtOfThem",
    });
    expect(
      pickCreateSubEditor({
        ...base,
        offLimits: typed,
        giftIdeas: typed,
        thoughtOfThem: typed,
      }).which,
    ).toBe("offLimits");
    expect(
      pickCreateSubEditor({ ...base, giftIdeas: typed, thoughtOfThem: typed })
        .which,
    ).toBe("giftIdeas");
    expect(
      pickCreateSubEditor({ ...base, giftIdeas: empty, thoughtOfThem: empty }),
    ).toEqual({ open: false, dirty: false, which: null });
  });

  it("an open, typed-into Imported edit holds Back; an open untyped one does not (D-116; convergence c4, Claude C-02)", () => {
    const allClosed = {
      memory: closed,
      relationship: closed,
      offLimits: closed,
      giftIdeas: closed,
      thoughtOfThem: closed,
    };
    expect(pickCreateSubEditor({ ...allClosed, imported: typed })).toEqual({
      open: true,
      dirty: true,
      which: "imported",
    });
    expect(pickCreateSubEditor({ ...allClosed, imported: empty })).toEqual({
      open: false,
      dirty: false,
      which: null,
    });
    expect(
      pickCreateSubEditor({
        ...allClosed,
        thoughtOfThem: typed,
        imported: typed,
      }).which,
    ).toBe("thoughtOfThem");
  });
});

describe("partitionMemoryRows (convergence c3, Claude C-02; D-116)", () => {
  const rows = [
    { id: 1, type: "general" },
    { id: 2, type: "gift_idea" },
    { id: 3, type: "thought_of_them" },
    { id: 4, type: "imported" },
    { id: 5, type: "general" },
    { id: 6, type: "gift_idea" },
  ];

  it("puts each type in its own section, keeping ids and order", () => {
    expect(partitionMemoryRows(rows)).toEqual({
      memories: [
        { id: 1, type: "general" },
        { id: 5, type: "general" },
      ],
      giftIdeas: [
        { id: 2, type: "gift_idea" },
        { id: 6, type: "gift_idea" },
      ],
      thoughtOfThem: [{ id: 3, type: "thought_of_them" }],
      imported: [{ id: 4, type: "imported" }],
    });
  });

  it("a Gift Idea shows only in Gift Ideas, and imported never in Memories", () => {
    const buckets = partitionMemoryRows(rows);
    const all = [
      ...buckets.memories,
      ...buckets.giftIdeas,
      ...buckets.thoughtOfThem,
      ...buckets.imported,
    ];
    expect(all).toHaveLength(rows.length);
    expect(buckets.memories.some((row) => row.type === "imported")).toBe(false);
    expect(buckets.memories.some((row) => row.id === 2)).toBe(false);
  });

  it("an unregistered type lands in Memories (this plan only)", () => {
    expect(partitionMemoryRows([{ id: 9, type: "legacy" }]).memories).toEqual([
      { id: 9, type: "legacy" },
    ]);
  });

  it("a row retyped from general to gift_idea moves to Gift Ideas when recomputed", () => {
    const before = partitionMemoryRows(rows);
    expect(before.memories.map((row) => row.id)).toEqual([1, 5]);
    const retyped = rows.map((row) =>
      row.id === 1 ? { ...row, type: "gift_idea" } : row,
    );
    const after = partitionMemoryRows(retyped);
    expect(after.memories.map((row) => row.id)).toEqual([5]);
    expect(after.giftIdeas.map((row) => row.id)).toEqual([1, 2, 6]);
  });
});

describe("Add Contact stable draft ids (convergence c7, Claude C-04 / Cursor CU-02)", () => {
  it("removing the first draft then replacing the third by id changes the third, not index 2", () => {
    let items = addDraftItem([], { type: "general", value: "a" }, -1);
    items = addDraftItem(items, { type: "gift_idea", value: "b" }, -2);
    items = addDraftItem(items, { type: "general", value: "c" }, -3);
    items = removeDraftItem(items, -1);
    items = replaceDraftItem(items, -3, { type: "general", value: "C" });
    expect(items).toEqual([
      { id: -2, draft: { type: "gift_idea", value: "b" } },
      { id: -3, draft: { type: "general", value: "C" } },
    ]);
    // Nothing sits at index 2 any more; a position-based edit would miss.
    expect(items[2]).toBeUndefined();
  });

  it("replacing or removing an unknown id leaves the list unchanged", () => {
    const items = addDraftItem([], { value: "a" }, -1);
    expect(replaceDraftItem(items, -9, { value: "z" })).toEqual(items);
    expect(removeDraftItem(items, -9)).toEqual(items);
  });

  it("partitionMemoryRows over the mapped rows keeps the stable ids", () => {
    let items = addDraftItem([], { type: "general" }, -1);
    items = addDraftItem(items, { type: "thought_of_them" }, -2);
    items = addDraftItem(items, { type: "gift_idea" }, -3);
    items = removeDraftItem(items, -1);
    const rows = items.map((item) => ({ id: item.id, type: item.draft.type }));
    const buckets = partitionMemoryRows(rows);
    expect(buckets.thoughtOfThem).toEqual([
      { id: -2, type: "thought_of_them" },
    ]);
    expect(buckets.giftIdeas).toEqual([{ id: -3, type: "gift_idea" }]);
    expect(buckets.memories).toEqual([]);
  });
});

describe("inline Off Limits form rules (D-66, D-67, D-104)", () => {
  it("opens blank for an add and with the row's text and label for an edit", () => {
    expect(offLimitsFormDraft()).toEqual({ text: "", label: "" });
    expect(offLimitsFormDraft({ text: "Ex", label: null })).toEqual({
      text: "Ex",
      label: "",
    });
  });

  it("is dirty only when text or label changed after trimming", () => {
    const base = offLimitsFormDraft({ text: "Ex", label: "Family" });
    expect(isOffLimitsFormDirty(base, { text: "Ex ", label: "Family" })).toBe(
      false,
    );
    expect(isOffLimitsFormDirty(base, { text: "Exes", label: "Family" })).toBe(
      true,
    );
    expect(isOffLimitsFormDirty(base, { text: "Ex", label: "" })).toBe(true);
    expect(
      isOffLimitsFormDirty(offLimitsFormDraft(), { text: "  ", label: "" }),
    ).toBe(false);
  });

  it("saves with text, a label, or a stored link, never blank", () => {
    expect(canSaveOffLimitsForm({ text: "  ", label: "" })).toBe(false);
    expect(canSaveOffLimitsForm({ text: "Politics", label: "" })).toBe(true);
    expect(canSaveOffLimitsForm({ text: "", label: "Work" })).toBe(true);
    expect(
      canSaveOffLimitsForm({ text: "", label: "" }, "https://example.com"),
    ).toBe(true);
  });

  it("hands the host trimmed values, blank as null", () => {
    expect(normalizeOffLimitsForm({ text: " Politics ", label: " " })).toEqual({
      text: "Politics",
      label: null,
    });
  });
});

describe("offLimitsFormOpening: an edit form remounted below the list (38.10 review WR-01)", () => {
  const stored = { text: "Politics", label: "Work", url: "https://a.example" };

  it("opens on the stored row when nothing is carried", () => {
    expect(offLimitsFormOpening(stored)).toEqual({
      baseline: { text: "Politics", label: "Work" },
      draft: { text: "Politics", label: "Work" },
      url: "https://a.example",
    });
    expect(offLimitsFormOpening(null)).toEqual({
      baseline: { text: "", label: "" },
      draft: { text: "", label: "" },
      url: "",
    });
  });

  it("starts from the carried typing, keeping the stored value as the baseline", () => {
    const opening = offLimitsFormOpening(stored, {
      draft: { text: "Politics and the election", label: "Work" },
      url: "https://b.example",
    });
    expect(opening.baseline).toEqual({ text: "Politics", label: "Work" });
    expect(opening.draft.text).toBe("Politics and the election");
    expect(opening.url).toBe("https://b.example");
    // Dirty is still measured against what the row stores.
    expect(isOffLimitsFormDirty(opening.baseline, opening.draft)).toBe(true);
  });

  it("a carried draft equal to the stored value reads as untouched", () => {
    const opening = offLimitsFormOpening(stored, {
      draft: { text: "Politics ", label: "Work" },
      url: "https://a.example",
    });
    expect(isOffLimitsFormDirty(opening.baseline, opening.draft)).toBe(false);
  });

  it("keeps a carried blank link (the user cleared it)", () => {
    expect(
      offLimitsFormOpening(stored, {
        draft: { text: "Politics", label: "Work" },
        url: "",
      }).url,
    ).toBe("");
  });
});
