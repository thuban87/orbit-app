import { describe, expect, it } from "vitest";
import { METHOD_LABELS } from "@/components/contact-methods-editor-model";
import { pickedMethodLabel } from "@/logic/picked-method-label";

describe("pickedMethodLabel (D-47, D-102)", () => {
  it.each([
    [2, "Mobile"],
    [1, "Home"],
    [3, "Work"],
    [12, "Main"],
    [7, "Other"],
    [4, "Other"],
  ])("phone TYPE %i → %s", (code, label) => {
    expect(pickedMethodLabel("phone", code, null)).toBe(label);
  });

  it.each([
    [1, "Home"],
    [2, "Work"],
    [4, "Mobile"],
    [3, "Other"],
  ])("email TYPE %i → %s", (code, label) => {
    expect(pickedMethodLabel("email", code, null)).toBe(label);
  });

  it("a custom TYPE takes the phone's own label text, trimmed", () => {
    expect(pickedMethodLabel("phone", 0, "Gym")).toBe("Gym");
    expect(pickedMethodLabel("email", 0, "  Club  ")).toBe("Club");
  });

  it("a custom TYPE with no label text is Other", () => {
    expect(pickedMethodLabel("phone", 0, null)).toBe("Other");
    expect(pickedMethodLabel("phone", 0, "   ")).toBe("Other");
  });

  it("no TYPE code means no label", () => {
    expect(pickedMethodLabel("phone", null, null)).toBeNull();
    expect(pickedMethodLabel("email", undefined, "Ignored")).toBeNull();
  });

  it("every standard result is one of Orbit's label choices", () => {
    for (const type of ["phone", "email"] as const)
      for (const code of [1, 2, 3, 4, 7, 12, 99])
        expect(METHOD_LABELS).toContain(pickedMethodLabel(type, code, null));
  });
});
