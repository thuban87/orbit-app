import { describe, expect, it } from "vitest";
import {
  isBirthdayUnreadable,
  mapBirthdayForStorage,
  mapPickedContact,
} from "./picked-contact-map";

describe("mapPickedContact", () => {
  it("maps the allowed fields into an Unbound create input with the phone region", () => {
    const result = mapPickedContact(
      {
        lookupKey: "android:opaque/contact",
        displayName: "  Ada Lovelace  ",
        methods: [
          { type: "phone", value: "+1 (312) 555-0100" },
          { type: "email", value: "ada@example.test" },
        ],
        birthday: "1990-05-14",
        note: "Raw provider note",
        photoTempUri: "file:///cache/ada.jpg",
      },
      { categoryId: 12, effectivePhoneRegion: "US" },
    );

    expect(result).toMatchObject({
      nameRequired: false,
      externalContactId: "android:opaque/contact",
      photoTempUri: "file:///cache/ada.jpg",
      birthday: "1990-05-14",
      note: "Raw provider note",
      input: {
        name: "Ada Lovelace",
        intervalDays: null,
        trackingEnabled: false,
        categoryId: 12,
        methodNormalization: { effectivePhoneRegion: "US" },
      },
    });
    expect(result.input.uid).toEqual(expect.any(String));
    expect(result.input.methodDrafts).toEqual([
      expect.objectContaining({ type: "phone", value: "+1 (312) 555-0100" }),
      expect.objectContaining({ type: "email", value: "ada@example.test" }),
    ]);
    expect(
      result.input.methodDrafts?.every((draft) => draft.uid.length > 0),
    ).toBe(true);
  });

  it("preserves a non-blank note but treats absent or blank notes as empty", () => {
    const options = { categoryId: null, effectivePhoneRegion: null };
    const contact = (note?: string | null) => ({
      lookupKey: "notes",
      displayName: "Note Person",
      methods: [],
      birthday: null,
      note,
      photoTempUri: null,
    });

    expect(mapPickedContact(contact(" raw provider note "), options).note).toBe(
      " raw provider note ",
    );
    expect(mapPickedContact(contact("  "), options).note).toBeNull();
    expect(mapPickedContact(contact(), options).note).toBeNull();
  });

  it("flags a missing name for callers while leaving the create input blank", () => {
    const result = mapPickedContact(
      {
        lookupKey: "unnamed",
        displayName: "   ",
        methods: [],
        birthday: null,
        photoTempUri: null,
      },
      { categoryId: null, effectivePhoneRegion: null },
    );

    expect(result.nameRequired).toBe(true);
    expect(result.input.name).toBe("");
    expect(result.input.categoryId).toBeNull();
  });

  it("keeps known and year-unknown birthdays only when calendar-valid", () => {
    const options = { categoryId: null, effectivePhoneRegion: null };
    const contact = (birthday: string | null) => ({
      lookupKey: birthday ?? "none",
      displayName: "Birthday Person",
      methods: [],
      birthday,
      photoTempUri: null,
    });

    expect(mapPickedContact(contact("1990-05-14"), options).birthday).toBe(
      "1990-05-14",
    );
    expect(mapPickedContact(contact("--05-14"), options).birthday).toBe(
      "05-14",
    );
    expect(mapPickedContact(contact("05-14"), options).birthday).toBe("05-14");
    expect(mapPickedContact(contact("02-30"), options).birthday).toBeNull();
  });

  it("canonicalizes unambiguous slash birthdays without guessing ambiguous dates", () => {
    expect(mapBirthdayForStorage("2019/03/04")).toBe("2019-03-04");
    expect(mapBirthdayForStorage("13/04/1990")).toBe("1990-04-13");
    expect(mapBirthdayForStorage("04/13/1990")).toBe("1990-04-13");
    expect(mapBirthdayForStorage("04/04/1990")).toBe("1990-04-04");
    expect(mapBirthdayForStorage("03/04/1990")).toBeNull();
    expect(mapBirthdayForStorage("2021/02/29")).toBeNull();
    expect(mapBirthdayForStorage("02/30")).toBeNull();
  });

  it("identifies present but unreadable birthdays with the shared canonicalizer", () => {
    expect(isBirthdayUnreadable("03/04/1990")).toBe(true);
    expect(isBirthdayUnreadable("13/04/1990")).toBe(false);
    expect(isBirthdayUnreadable(null)).toBe(false);
    expect(isBirthdayUnreadable("  ")).toBe(false);
  });

  it("drops unrecognized picker method types", () => {
    const result = mapPickedContact(
      {
        lookupKey: "only-methods",
        displayName: "Method Person",
        methods: [
          { type: "phone", value: "3125550100" },
          { type: "website", value: "https://example.test" },
        ] as unknown as Array<{ type: "phone" | "email"; value: string }>,
        birthday: null,
        photoTempUri: null,
      },
      { categoryId: null, effectivePhoneRegion: null },
    );

    expect(result.input.methodDrafts).toHaveLength(1);
    expect(result.input.methodDrafts?.[0]).toMatchObject({ type: "phone" });
  });
});
