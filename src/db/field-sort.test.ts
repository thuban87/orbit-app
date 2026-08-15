/**
 * node:sqlite coverage for sortExpr() (FLD-06). The number/toggle cases are
 * proven against REAL SQLite ordering — a string comparison would sort "10"
 * before "9", so these tests fail loudly if the CAST is dropped. The rejection
 * case proves the isSafeColName guard fires (T-03-01).
 */
import { describe, expect, it } from "vitest";
import { openTestDb } from "@/db/__testkit__/node-sqlite";
import { sortExpr } from "@/db/field-sort";

/** Create a one-TEXT-column table `t(v TEXT)` and insert `rows` in order. */
function seed(rows: string[]) {
  const db = openTestDb();
  db.exec('CREATE TABLE t ("v" TEXT);');
  const stmt = db.prepare('INSERT INTO t ("v") VALUES (?);');
  for (const r of rows) stmt.run(r);
  return db;
}

describe("sortExpr — numeric ordering via CAST AS REAL", () => {
  it("sorts numeric TEXT numerically, not lexicographically", () => {
    const db = seed(["10", "9", "2"]);
    const expr = sortExpr({ col_name: "v", type: "number" });
    expect(expr).toBe('CAST("v" AS REAL)');
    const ordered = db
      .prepare(`SELECT "v" AS v FROM t ORDER BY ${expr} ASC;`)
      .all() as { v: string }[];
    expect(ordered.map((r) => r.v)).toEqual(["2", "9", "10"]);
  });
});

describe("sortExpr — toggle ordering via CAST AS INTEGER", () => {
  it("groups '0' before '1'", () => {
    const db = seed(["1", "0", "1"]);
    const expr = sortExpr({ col_name: "v", type: "toggle" });
    expect(expr).toBe('CAST("v" AS INTEGER)');
    const ordered = db
      .prepare(`SELECT "v" AS v FROM t ORDER BY ${expr} ASC;`)
      .all() as { v: string }[];
    expect(ordered.map((r) => r.v)).toEqual(["0", "1", "1"]);
  });
});

describe("sortExpr — text/date return the bare quoted column (no CAST)", () => {
  it("text field is just the quoted column", () => {
    expect(sortExpr({ col_name: "v", type: "text" })).toBe('"v"');
    expect(sortExpr({ col_name: "note", type: "textarea" })).toBe('"note"');
    expect(sortExpr({ col_name: "pick", type: "dropdown" })).toBe('"pick"');
    expect(sortExpr({ col_name: "pic", type: "photo" })).toBe('"pic"');
  });

  it("date returns the bare quoted column (ISO text sorts chronologically)", () => {
    const db = seed(["2026-08-14", "2025-01-02", "2026-01-01"]);
    const expr = sortExpr({ col_name: "v", type: "date" });
    expect(expr).toBe('"v"');
    const ordered = db
      .prepare(`SELECT "v" AS v FROM t ORDER BY ${expr} ASC;`)
      .all() as { v: string }[];
    expect(ordered.map((r) => r.v)).toEqual([
      "2025-01-02",
      "2026-01-01",
      "2026-08-14",
    ]);
  });
});

describe("sortExpr — isSafeColName guard (T-03-01)", () => {
  it("throws on a col_name containing a double-quote", () => {
    expect(() =>
      sortExpr({ col_name: 'v"; DROP TABLE t; --', type: "text" }),
    ).toThrow(/unsafe col_name/);
  });

  it("throws on a col_name containing a space", () => {
    expect(() => sortExpr({ col_name: "my col", type: "number" })).toThrow(
      /unsafe col_name/,
    );
  });
});
