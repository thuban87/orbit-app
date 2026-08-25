/**
 * sortExpr() is a latent helper for a future normalized value-row join. These
 * tests prove it never treats the compatibility `col_name` as SQL syntax.
 */
import { describe, expect, it } from "vitest";
import { openTestDb } from "@/db/__testkit__/node-sqlite";
import { sortExpr } from "@/db/field-sort";
import type { FieldType } from "@/schemas/types";

const VALUE_ALIAS = "values_table";

/** Seed raw normalized TEXT values under the literal alias required by sortExpr. */
function seed(rows: string[]) {
  const db = openTestDb();
  db.exec("CREATE TABLE custom_field_values (value TEXT);");
  const statement = db.prepare("INSERT INTO custom_field_values (value) VALUES (?);");
  for (const row of rows) statement.run(row);
  return db;
}

describe("sortExpr — static normalized-value expressions", () => {
  const expectations: ReadonlyArray<{ type: FieldType; expression: string }> = [
    { type: "number", expression: `CAST(${VALUE_ALIAS}.value AS REAL)` },
    { type: "toggle", expression: `CAST(${VALUE_ALIAS}.value AS INTEGER)` },
    { type: "text", expression: `${VALUE_ALIAS}.value` },
    { type: "textarea", expression: `${VALUE_ALIAS}.value` },
    { type: "dropdown", expression: `${VALUE_ALIAS}.value` },
    { type: "photo", expression: `${VALUE_ALIAS}.value` },
    { type: "date", expression: `${VALUE_ALIAS}.value` },
  ];

  it.each(expectations)("emits the fixed expression for $type", ({ type, expression }) => {
    expect(sortExpr({ col_name: "legacy_compatibility_key", type })).toBe(expression);
  });

  it("orders raw number TEXT numerically through the literal normalized alias", () => {
    const db = seed(["10", "9", "2"]);
    const expression = sortExpr({ col_name: "score", type: "number" });
    const ordered = db
      .prepare(`SELECT ${VALUE_ALIAS}.value FROM custom_field_values AS ${VALUE_ALIAS} ORDER BY ${expression} ASC`)
      .all() as { value: string }[];
    expect(ordered.map((row) => row.value)).toEqual(["2", "9", "10"]);
  });

  it("orders raw toggle TEXT through the literal normalized alias", () => {
    const db = seed(["1", "0", "1"]);
    const expression = sortExpr({ col_name: "enabled", type: "toggle" });
    const ordered = db
      .prepare(`SELECT ${VALUE_ALIAS}.value FROM custom_field_values AS ${VALUE_ALIAS} ORDER BY ${expression} ASC`)
      .all() as { value: string }[];
    expect(ordered.map((row) => row.value)).toEqual(["0", "1", "1"]);
  });

  it("does not let hostile col_name metadata alter the emitted SQL", () => {
    const hostile = 'value); DROP TABLE custom_field_values; --';
    expect(sortExpr({ col_name: hostile, type: "number" })).toBe(
      `CAST(${VALUE_ALIAS}.value AS REAL)`,
    );
    expect(sortExpr({ col_name: hostile, type: "text" })).toBe(
      `${VALUE_ALIAS}.value`,
    );
  });
});
