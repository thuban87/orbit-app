import { describe, expect, it } from "vitest";
import { researchItemDisplayValue } from "./compose-research-logic";

const THIS_YEAR = new Date().getFullYear();

describe("researchItemDisplayValue (38.9 D-66, D-70; render only)", () => {
  it("formats the first-class birthday with the birthday formatter (D-70)", () => {
    expect(
      researchItemDisplayValue({
        id: "firstclass:birthday",
        value: `${THIS_YEAR}-06-02`,
      }),
    ).toBe(`Jun 2, ${THIS_YEAR}`);
    expect(
      researchItemDisplayValue({ id: "firstclass:birthday", value: "02-29" }),
    ).toBe("Feb 29");
  });

  it("formats a custom Date field value and keeps a rejected one raw", () => {
    expect(
      researchItemDisplayValue({
        id: "custom:4",
        value: `${THIS_YEAR - 1}-06-02`,
        fieldType: "date",
      }),
    ).toBe(`Jun 2, ${THIS_YEAR - 1}`);
    expect(
      researchItemDisplayValue({
        id: "custom:4",
        value: "next spring",
        fieldType: "date",
      }),
    ).toBe("next spring");
  });

  it("leaves other custom types and non-custom items unchanged", () => {
    expect(
      researchItemDisplayValue({
        id: "custom:5",
        value: `${THIS_YEAR}-10-20`,
        fieldType: "text",
      }),
    ).toBe(`${THIS_YEAR}-10-20`);
    expect(
      researchItemDisplayValue({
        id: "memory:1",
        value: `${THIS_YEAR}-10-20`,
      }),
    ).toBe(`${THIS_YEAR}-10-20`);
  });
});
