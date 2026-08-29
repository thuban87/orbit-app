import { describe, expect, it } from "vitest";
import type { LastSpokeValue } from "@/components/tri-state-last-spoke-logic";
import type { ContactEditRow, ContactForEdit } from "@/db/contact-read";
import {
  type BuildEditInputDeps,
  buildBirthdayForStorage,
  buildEditInput,
  canSave,
  type EditFormState,
  isNeverContacted,
  parseBirthdayForForm,
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
