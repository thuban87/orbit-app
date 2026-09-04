import { describe, expect, it } from "vitest";
import { rowsForKnowledgeDisplay } from "./things-to-remember-ordering";

describe("rowsForKnowledgeDisplay", () => {
  it("retains DAO order when hidden rows are included", () => {
    const rows = [
      { id: "hidden-pinned", hidden: true },
      { id: "visible-unpinned", hidden: false },
      { id: "hidden-old", hidden: true },
    ];

    expect(rowsForKnowledgeDisplay(rows, true, (row) => row.hidden).map((row) => row.id)).toEqual([
      "hidden-pinned", "visible-unpinned", "hidden-old",
    ]);
    expect(rowsForKnowledgeDisplay(rows, false, (row) => row.hidden).map((row) => row.id)).toEqual([
      "visible-unpinned",
    ]);
  });
});
