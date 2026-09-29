/**
 * DEV-only module release guard (38.5-06; T-38.5-06-01).
 *
 * `__dev__` modules (the ThemePreview harness, the 38.5 art-treatment override
 * and its combo sync) must never reach a release bundle. Metro inlines
 * `__DEV__` as `false` in a release build and folds `__DEV__ ? require(...) :
 * null` to `null`, dropping the require (the SettingsStack ThemePreview
 * precedent). So the rule: every app source file outside a `__dev__` folder
 * that references a `__dev__/` module does so ONLY as `__DEV__ ? require("…")…
 * : null`. A static `import`, a dynamic `import()`, or an unguarded
 * `require()` fails.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = join(__dirname, "..", "..");
const SRC = join(REPO, "src");

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "node_modules" || name === "__dev__") continue;
      walk(path, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/**
 * A module specifier naming a `__dev__/` module: a single-, double- or
 * backtick-quoted string (code review IN-05: a template literal is a valid
 * `require` / `import()` argument too).
 */
const DEV_SPECIFIER = String.raw`["'\`][^"'\`\n]*__dev__\/[^"'\`\n]*["'\`]`;

/**
 * Every reference to a `__dev__/` module in `source` that is NOT inside the
 * guarded form `__DEV__ ? require("…")[.member] : null`.
 */
function unguardedDevReferences(source: string): string[] {
  const code = stripComments(source);
  const offenders: string[] = [];
  const guarded = new RegExp(
    String.raw`__DEV__\s*\?\s*require\(\s*${DEV_SPECIFIER}\s*\)(?:\s*\.\s*[A-Za-z_$][\w$]*)*\s*:\s*null\b`,
    "g",
  );
  // Blank out every guarded use, then any remaining __dev__ module reference
  // (import, import(), require(), export … from) is unguarded.
  const rest = code.replace(guarded, (m) => " ".repeat(m.length));
  const reference = new RegExp(
    String.raw`(?:\bimport\b[^;]*?\bfrom\s*|\bexport\b[^;]*?\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)${DEV_SPECIFIER}`,
    "g",
  );
  for (const m of rest.matchAll(reference)) offenders.push(m[0]);
  return offenders;
}

describe("unguardedDevReferences — the rule itself", () => {
  it.each([
    [
      "the SettingsStack precedent",
      `const X = __DEV__\n  ? require("@/components/ui/__dev__/ThemePreviewScreen").default\n  : null;`,
    ],
    [
      "a guarded JSON require",
      `const o = __DEV__ ? require("./__dev__/art-treatment-dev-overrides.json") : null;`,
    ],
    [
      "a comment that names a __dev__ path",
      `// see src/__dev__/uat-probes.ts\n/* import x from "./__dev__/y" */`,
    ],
    [
      "a plain string that is not a module reference",
      `if (file.includes("/__dev__/")) {}`,
    ],
    [
      "a guarded template-literal require",
      "const o = __DEV__ ? require(`./__dev__/overrides.json`) : null;",
    ],
  ])("passes %s", (_label, source) => {
    expect(unguardedDevReferences(source)).toEqual([]);
  });

  it.each([
    ["a static import", `import { A } from "@/components/ui/__dev__/A";`],
    ["a side-effect import", `import "@/components/ui/__dev__/A";`],
    ["a type-free re-export", `export { A } from "./__dev__/A";`],
    ["a dynamic import", `const m = await import("./__dev__/A");`],
    ["an unguarded require", `const m = require("./__dev__/A");`],
    [
      "a require guarded the wrong way round",
      `const m = __DEV__ ? null : require("./__dev__/A");`,
    ],
    [
      "a require behind a runtime flag, not __DEV__",
      `const m = enabled ? require("./__dev__/A") : null;`,
    ],
    [
      "an unguarded template-literal require",
      "const m = require(`./__dev__/A`);",
    ],
    [
      "a template-literal dynamic import",
      "const m = await import(`./__dev__/A`);",
    ],
  ])("fails %s", (_label, source) => {
    expect(unguardedDevReferences(source).length).toBeGreaterThan(0);
  });
});

describe("dev-override release guard (repo)", () => {
  const files = walk(SRC, []).map((path) => ({
    file: relative(REPO, path),
    source: readFileSync(path, "utf8"),
  }));

  it("scans the real source tree", () => {
    expect(files.length).toBeGreaterThan(150);
  });

  it("every app reference to a __dev__ module is a __DEV__-guarded require", () => {
    const offenders = files.flatMap(({ file, source }) =>
      unguardedDevReferences(source).map((ref) => `${file}: ${ref}`),
    );
    expect(offenders).toEqual([]);
  });

  it("the art-treatment override and its combo sync are reached only through guarded requires", () => {
    const guardedIn = (file: string, specifier: string) => {
      const source = files.find((f) => f.file === file)?.source ?? "";
      return new RegExp(
        String.raw`__DEV__\s*\?\s*require\(\s*"${specifier.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}"\s*\)`,
      ).test(stripComments(source));
    };
    expect(
      guardedIn(
        "src/theme/use-art-treatment.ts",
        "./__dev__/art-treatment-dev-overrides.json",
      ),
    ).toBe(true);
    expect(
      guardedIn(
        "src/navigation/RootNavigator.tsx",
        "@/components/ui/__dev__/ArtSheetComboSync",
      ),
    ).toBe(true);
  });
});
