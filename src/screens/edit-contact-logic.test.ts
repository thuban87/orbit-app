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
    phone: null,
    email: null,
    photo: null,
    last_contact: null,
    favourite_rank: null,
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
  return { contact, categoryLabel: contact.category_label, values };
}

function deps(overrides: Partial<BuildEditInputDeps> = {}): BuildEditInputDeps {
  return {
    now: NOW,
    contactId: 7,
    rowUid: "row-uid",
    interactionUid: "i-uid",
    editColNames: [],
    neverContacted: false,
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
    phone: "",
    email: "",
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
          phone: "555-1234",
          email: "sam@example.com",
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
    expect(s.phone).toBe("555-1234");
    expect(s.email).toBe("sam@example.com");
    expect(s.rarelyResponds).toBe(1);
    expect(s.remindersOff).toBe(1);
    expect(s.values).toEqual({ hobby: "chess" });
    expect(s.lastSpoke).toEqual({ kind: "not-yet" });
  });

  it("null phone/email seed as empty strings for the TextInputs", () => {
    const s = seedEditState(forEdit({ phone: null, email: null }));
    expect(s.phone).toBe("");
    expect(s.email).toBe("");
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
});

describe("buildEditInput", () => {
  it("trims name/phone/email (empty->null) and carries id + rowUid + toggles", () => {
    const out = buildEditInput(
      state({
        name: "  Chris ",
        phone: "  555-1234 ",
        email: "  ",
        rarelyResponds: 1,
        remindersOff: 1,
      }),
      deps(),
    );
    expect(out.id).toBe(7);
    expect(out.name).toBe("Chris");
    expect(out.phone).toBe("555-1234");
    expect(out.email).toBeNull();
    expect(out.rarelyResponds).toBe(1);
    expect(out.remindersOff).toBe(1);
    expect(out.rowUid).toBe("row-uid");
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

  it("maps edit columns to values, missing -> null", () => {
    const out = buildEditInput(
      state({ values: { hobby: "chess", note: null } }),
      deps({ editColNames: ["hobby", "note", "absent"] }),
    );
    expect(out.customValues).toEqual([
      { col: "hobby", value: "chess" },
      { col: "note", value: null },
      { col: "absent", value: null },
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
