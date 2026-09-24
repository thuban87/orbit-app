import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

interface MissingProvenance {
  file: string;
  line: number;
}

function inspect(
  source: string,
  file: string,
): { calls: number; missing: MissingProvenance[] } {
  const syntax = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  let calls = 0;
  const missing: MissingProvenance[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(syntax) === "addMemoryCore"
    ) {
      calls += 1;
      const input = node.arguments[1];
      const hasImportProvenance =
        input &&
        ts.isObjectLiteralExpression(input) &&
        input.properties.some(
          (property) =>
            ts.isPropertyAssignment(property) &&
            property.name.getText(syntax) === "provenance" &&
            ts.isStringLiteral(property.initializer) &&
            property.initializer.text === "import",
        );
      if (!hasImportProvenance) {
        missing.push({
          file,
          line:
            syntax.getLineAndCharacterOfPosition(node.getStart(syntax)).line +
            1,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(syntax);
  return { calls, missing };
}

describe("imported note provenance guard", () => {
  it("covers every import-originated addMemoryCore call with explicit import provenance", () => {
    const root = process.cwd();
    const paths = [
      ...readdirSync(join(root, "src/services/import"))
        .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
        .map((name) => `src/services/import/${name}`),
      ...readdirSync(join(root, "src/db"))
        .filter(
          (name) =>
            /^(?:.*import.*|bulk-review.*)\.ts$/.test(name) &&
            !name.endsWith(".test.ts"),
        )
        .map((name) => `src/db/${name}`),
    ];
    const results = paths.map((path) =>
      inspect(readFileSync(join(root, path), "utf8"), path),
    );
    expect(
      results.reduce((sum, result) => sum + result.calls, 0),
    ).toBeGreaterThanOrEqual(2);
    expect(results.flatMap((result) => result.missing)).toEqual([]);
  });

  it("reports a missing provenance with file and line in a source fixture", () => {
    expect(
      inspect("addMemoryCore(exec, { type: 'imported' });", "fixture.ts"),
    ).toEqual({ calls: 1, missing: [{ file: "fixture.ts", line: 1 }] });
  });
});
