import { describe, expect, it } from "vitest";
import type { LastSpokeValue } from "@/components/tri-state-last-spoke-logic";
import {
  type BuildCreateInputDeps,
  type CreateFormState,
  buildCreateInput,
  canSave,
  firstInteractionOccurredAt,
} from "./create-contact-logic";

const NOW = "2026-08-15 14:30:00";

function deps(overrides: Partial<BuildCreateInputDeps> = {}): BuildCreateInputDeps {
  return {
    now: NOW,
    contactUid: "c-uid",
    rowUid: "row-uid",
    interactionUid: "i-uid",
    createColNames: [],
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
    phone: "",
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

describe("buildCreateInput", () => {
  it("passes the typed phone through (CRUD-01 fix), trimmed, empty→null", () => {
    expect(buildCreateInput(state({ phone: "  555-1234 " }), deps()).phone).toBe(
      "555-1234",
    );
    expect(buildCreateInput(state({ phone: "" }), deps()).phone).toBeNull();
    expect(buildCreateInput(state({ phone: "   " }), deps()).phone).toBeNull();
  });

  it("trims the name and carries category + rarelyResponds=0 + uids", () => {
    const out = buildCreateInput(state({ name: "  Chris ", categoryId: 3 }), deps());
    expect(out.name).toBe("Chris");
    expect(out.categoryId).toBe(3);
    expect(out.rarelyResponds).toBe(0);
    expect(out.uid).toBe("c-uid");
    expect(out.rowUid).toBe("row-uid");
    expect(out.intervalDays).toBe(30);
    expect(out.now).toBe(NOW);
  });

  it("maps show_on_new columns to their values, missing → null", () => {
    const out = buildCreateInput(
      state({ values: { hobby: "chess", note: null } }),
      deps({ createColNames: ["hobby", "note", "absent"] }),
    );
    expect(out.customValues).toEqual([
      { col: "hobby", value: "chess" },
      { col: "note", value: null },
      { col: "absent", value: null },
    ]);
  });

  it("Today → firstInteraction occurredAt=now, manual, direction null", () => {
    const out = buildCreateInput(state({ lastSpoke: { kind: "today" } }), deps());
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
});
