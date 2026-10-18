import { describe, expect, it } from "vitest";
import { isBulkActionAvailable } from "@/components/candidate-card-grid-actions";

describe("isBulkActionAvailable", () => {
  const allAdditive = [{ id: 1, additive: true }];
  const mixed = [
    { id: 1, additive: true },
    { id: 2, additive: false },
  ];
  const eligibility = (
    _action: string,
    items: readonly { additive: boolean }[],
  ) => items.every((item) => item.additive);

  it("blocks Use Contact Values for an ineligible live selection", () => {
    expect(
      isBulkActionAvailable("use-contact-values", mixed, eligibility),
    ).toBe(false);
  });

  it("allows Use Contact Values for an all-additive live selection", () => {
    expect(
      isBulkActionAvailable("use-contact-values", allAdditive, eligibility),
    ).toBe(true);
  });

  it("keeps existing callers eligible when no predicate is supplied", () => {
    expect(isBulkActionAvailable("keep-orbit", mixed)).toBe(true);
  });
});

describe("the grid's own actions (fix-pass queue 3)", () => {
  it("offers only Check linked contacts' two bulk actions", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(__dirname, "CandidateCardGrid.tsx"),
      "utf8",
    );
    expect(source).toContain(
      'export type BulkAction = "keep-orbit" | "use-contact-values";',
    );
    expect(source).not.toMatch(/"import-new"|Link to Existing/);
  });
});
