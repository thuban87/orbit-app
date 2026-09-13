import { describe, expect, it } from "vitest";
import type { MethodGroups } from "@/components/contact-methods-editor-model";
import type { LastSpokeValue } from "@/components/tri-state-last-spoke-logic";
import {
  type BuildCreateInputDeps,
  buildCreateInput,
  collectBlockingErrors,
  coordinateBoundToggle,
  coordinateCadenceSelection,
  CREATE_SECTION_FIELD_MAP,
  type CreateFormState,
  canSave,
  firstInteractionOccurredAt,
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
        offLimits: [{ kind: "off_limits", text: "politics" }],
      }),
      deps(),
    );
    expect(out.memories).toEqual([{ type: "general", value: "Loves hiking" }]);
    expect(out.relationships).toEqual([
      { personName: "Alex", relationType: "sibling" },
    ]);
    expect(out.offLimits).toEqual([{ kind: "off_limits", text: "politics" }]);
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
