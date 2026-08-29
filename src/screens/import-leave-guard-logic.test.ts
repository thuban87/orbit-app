import { describe, expect, it } from "vitest";
import type { ImportSessionRow } from "@/db/import-session-read";
import { hasUnresolvedRows } from "./import-leave-guard-logic";

function row(
  rowStatus: ImportSessionRow["rowStatus"],
  contactId: number | null = 1,
): Pick<ImportSessionRow, "rowStatus" | "contactId"> {
  return { rowStatus, contactId };
}

describe("hasUnresolvedRows", () => {
  it("returns false when there are no rows", () => {
    expect(hasUnresolvedRows([])).toBe(false);
  });

  it("returns false for imported and linked rows", () => {
    expect(hasUnresolvedRows([row("imported"), row("linked")])).toBe(false);
  });

  it("does not treat resolved skipped and linked rows as unresolved", () => {
    expect(
      hasUnresolvedRows([
        row("imported"),
        row("skipped", null),
        row("linked"),
      ]),
    ).toBe(false);
  });

  it.each(["pending", "needs_review", "failed"] as const)(
    "returns true when a row is %s",
    (rowStatus) => {
      expect(hasUnresolvedRows([row("imported"), row(rowStatus)])).toBe(true);
    },
  );

  it("does not infer unresolved work from a null contact id", () => {
    expect(hasUnresolvedRows([row("skipped", null)])).toBe(false);
  });
});
