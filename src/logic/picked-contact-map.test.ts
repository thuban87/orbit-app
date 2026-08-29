import { describe, expect, it } from "vitest";
import { mapPickedContact } from "./picked-contact-map";

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
        photoTempUri: "file:///cache/ada.jpg",
      },
      { categoryId: 12, effectivePhoneRegion: "US" },
    );

    expect(result).toMatchObject({
      nameRequired: false,
      externalContactId: "android:opaque/contact",
      photoTempUri: "file:///cache/ada.jpg",
      birthday: "1990-05-14",
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
