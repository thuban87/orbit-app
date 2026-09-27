/**
 * 38.4 D-57 (owner, OA-E2) source contract: every bulk create path receives
 * the batch lifecycle from the session, the setup choice or the review input —
 * never from a literal Bound value — and Duplicate Review's Import as new runs
 * the post-commit reminder/widget effects after a Bound import.
 *
 * Textual: production `.ts`/`.tsx` under `src/`, tests excluded.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");
const SRC = join(ROOT, "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(path) && !/\.test\.(ts|tsx)$/.test(path)
      ? [path]
      : [];
  });
}

/** The argument text of the call whose `(` is at `open`, paren-balanced. */
function callArgs(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  throw new Error("unbalanced call");
}

const SEAMS = ["importContactRecord", "importRowAsNew", "combineCluster"];

describe("bulk create lifecycle provenance (D-57)", () => {
  const calls = sourceFiles(SRC).flatMap((path) => {
    const text = readFileSync(path, "utf8");
    return SEAMS.flatMap((seam) =>
      [...text.matchAll(new RegExp(`\\b(await\\s+)?${seam}\\(`, "g"))]
        .filter((match) => !/function\s+$/.test(text.slice(0, match.index)))
        .map((match) => {
          const open = (match.index ?? 0) + match[0].length - 1;
          return {
            file: relative(ROOT, path),
            seam,
            args: callArgs(text, open),
          };
        }),
    );
  });

  it("finds the production callers of every seam", () => {
    const files = new Set(calls.map((call) => `${call.file}:${call.seam}`));
    for (const expected of [
      "src/services/import/import-driver.ts:importContactRecord",
      "src/services/import/import-driver.ts:importRowAsNew",
      "src/services/import/import-acquire.ts:importContactRecord",
      "src/screens/DuplicateReviewScreen.tsx:importRowAsNew",
      "src/screens/BulkImportSetupScreen.tsx:combineCluster",
    ]) {
      expect(files.has(expected), expected).toBe(true);
    }
  });

  it("every call passes a lifecycle, and none builds a literal Bound value", () => {
    for (const call of calls) {
      const where = `${call.file} ${call.seam}(`;
      expect(call.args, where).toMatch(/\blifecycle\b/);
      expect(call.args, where).not.toMatch(/\blifecycle:\s*\{/);
      expect(call.args, where).not.toMatch(/trackingEnabled:\s*true/);
    }
  });

  it("the driver reads the lifecycle from the session only", () => {
    const driver = readFileSync(
      join(SRC, "services/import/import-driver.ts"),
      "utf8",
    );
    expect(driver).toContain(
      "const lifecycle = sessionBatchLifecycle(session)",
    );
    const runParams = /export interface RunImportBatchParams \{([^}]*)\}/.exec(
      driver,
    )?.[1];
    expect(runParams).toBeDefined();
    expect(runParams).not.toMatch(/\blifecycle\b/);
  });
});

describe("Duplicate Review Import as new (D-57)", () => {
  const screen = readFileSync(
    join(SRC, "screens/DuplicateReviewScreen.tsx"),
    "utf8",
  );

  it("passes the session's batch lifecycle to importRowAsNew", () => {
    const open = screen.indexOf("importRowAsNew(");
    expect(open).toBeGreaterThan(-1);
    expect(callArgs(screen, open + "importRowAsNew".length)).toContain(
      "lifecycle: sessionBatchLifecycle(session)",
    );
  });

  it("runs the Bound import effects once, after the latched import-new write, on a Bound session", () => {
    const effects = [...screen.matchAll(/applyBoundImportEffects\(/g)];
    expect(effects).toHaveLength(1);
    const at = effects[0].index ?? 0;
    const write = screen.indexOf(
      "await runLatchedWrite(() =>\n      runBulkResolveThenRecover(",
    );
    expect(write).toBeGreaterThan(-1);
    expect(at).toBeGreaterThan(write);
    const guard = screen.slice(write, at);
    expect(guard).toMatch(/action === "import-new"/);
    expect(guard).toMatch(/sessionBatchLifecycle\(session\)\.trackingEnabled/);
  });
});
