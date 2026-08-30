import { describe, expect, it } from "vitest";
import { toPickerRows } from "./contact-picker-source";

describe("toPickerRows", () => {
  it("keeps every method for search while choosing one subtitle", () => {
    expect(
      toPickerRows([
        {
          lookupKey: "ada",
          displayName: "Ada Lovelace",
          methods: ["+1 555 0100", "ada@example.com"],
          photoThumbUri: "content://contacts/ada/photo",
        },
      ]),
    ).toEqual([
      {
        lookupKey: "ada",
        displayName: "Ada Lovelace",
        primaryMethod: "+1 555 0100",
        searchMethods: ["+1 555 0100", "ada@example.com"],
        photoThumbUri: "content://contacts/ada/photo",
      },
    ]);
  });

  it("keeps nameless and method-less contacts pickable", () => {
    expect(
      toPickerRows([
        {
          lookupKey: "name-only",
          displayName: null,
          methods: [],
          photoThumbUri: null,
        },
      ]),
    ).toEqual([
      {
        lookupKey: "name-only",
        displayName: "Unnamed contact",
        primaryMethod: null,
        searchMethods: [],
        photoThumbUri: null,
      },
    ]);
  });
});
