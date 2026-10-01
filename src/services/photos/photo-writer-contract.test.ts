/**
 * Source-scan contract for canonical photo bytes and their display revision
 * (38.6 D-01/D-19).
 *
 * Display revisions are published by the ownership layer (`owned-master.ts` →
 * `notifyPhotoBytesChanged`, the only caller of the store's bump). This scan
 * makes a future writer that bypasses it fail loudly. It pins, over `src/`
 * (tests excluded), exactly which files may:
 *   - call or import the store's bump (`bumpPhotoCacheBust`);
 *   - call or import `notifyPhotoBytesChanged` (owned-master, plus the
 *     replace-all restore cleanup delete in restore-apply);
 *   - import a raw canonical byte writer from photo-storage (`persistMaster`,
 *     `deletePhoto`, and the `.bak`/`.tmp` reconcile move
 *     `reconcilePhotoWritesForCanonical`, which only owned-master may import);
 *   - import the plain (revision-less) photo URI resolver;
 *   - import the display URI resolver (`resolvePhotoDisplayUri`, only via
 *     `photo-display.ts`, so no surface builds a display URI with the wrong
 *     cache policy).
 *
 * It checks WHO may touch these symbols — it does not prove that each
 * byte-changing branch notifies. That positive coverage (every persist,
 * delete intent, settle/finalize and reconcile publishes a revision) lives in
 * `owned-master.test.ts` and the restore tests.
 *
 * Imports are read with the TypeScript parser, so every form counts: static
 * named / namespace / default imports, `export … from` re-exports, and dynamic
 * `await import(...)` whether destructured (multi-line, cast or not), read via a
 * property, or bound to a whole-module name. A whole-module or namespace use of
 * a restricted module counts as importing ALL its restricted symbols.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const PHOTO_STORAGE = "src/services/photos/photo-storage";
const OWNED_MASTER = "src/services/photos/owned-master";
const DISPLAY_STORE = "src/stores/photo-cache-bust-store";
const BUMP = "bumpPhotoCacheBust";
const NOTIFY = "notifyPhotoBytesChanged";
/** photo-storage exports that move a `.bak` onto a canonical (changes displayed bytes). */
const RECONCILE_WRITERS = [
  "reconcilePhotoWritesForCanonical",
  // Deleted as dead surface (review WR-07); pinned so it cannot quietly return.
  "reconcilePhotoWrites",
] as const;
const RAW_WRITERS = [
  "persistMaster",
  "deletePhoto",
  ...RECONCILE_WRITERS,
] as const;
const PLAIN_RESOLVER = "resolvePhotoUri";
const DISPLAY_RESOLVER = "resolvePhotoDisplayUri";

/** Files allowed to publish a display revision (call or import the store's bump). */
const REVISION_PUBLISHERS = [
  // The ownership layer: notifyPhotoBytesChanged is the single publisher.
  "src/services/photos/owned-master.ts",
];

/** Files allowed to call or import `notifyPhotoBytesChanged`. */
const NOTIFY_CALLERS = [
  // Defines it; every owned persist / delete intent / settle / reconcile calls it.
  "src/services/photos/owned-master.ts",
  // Replace-all restore cleanup: deletes a canonical under the path lock, then
  // notifies only once the bytes are really gone.
  "src/backup/restore-apply.ts",
];

/** Files allowed to import the `.bak` reconcile move (holds the path lock, notifies). */
const RECONCILE_WRITER_IMPORTERS = ["src/services/photos/owned-master.ts"];

/** Files allowed to import the display URI resolver. */
const DISPLAY_RESOLVER_IMPORTERS = [
  // The one display source (revision-query / no-cache) every surface uses.
  "src/components/photo-display.ts",
];

/** Files allowed to import the raw canonical byte writers from photo-storage. */
const RAW_WRITER_IMPORTERS = [
  // The ownership layer itself (persist, delete intents, settle/finalize).
  "src/services/photos/owned-master.ts",
  // Holds the path lock already; passes the raw writers into the owned *Locked primitives.
  "src/services/import/import-photo-retry.ts",
  // Default remove/exists for owned delete intents + the replace-all cleanup delete (notifies after).
  "src/backup/restore-apply.ts",
];

/** Files allowed to import the plain, revision-less photo URI resolver. */
const PLAIN_RESOLVER_IMPORTERS = [
  // Builds the display source (revision-query / no-cache) from the plain path.
  "src/components/photo-display.ts",
  // Widget RemoteViews: native bitmap read, not expo-image.
  "src/services/widget/widget-photo.ts",
  // Share sheet export of the master file, not a display.
  "src/services/backup/share-export.ts",
  // Stages canonical bytes for a merge re-home (file copy source).
  "src/services/photos/merge-photo-rehome.ts",
  // Orrery Skia texture gate (38.6-04 D-11): Skia and the manipulator read the plain file.
  "src/components/orrery/use-orrery-photo.ts",
];

// ---------------------------------------------------------------------------
// Pure matchers
// ---------------------------------------------------------------------------

/** A module a source file uses, and which of its names ("*" = all of them). */
interface ModuleUse {
  module: string;
  names: ReadonlySet<string> | "*";
}

/** Resolve an import specifier to a repo-relative module id without extension. */
function resolveModule(fromFile: string, specifier: string): string {
  let resolved: string;
  if (specifier.startsWith("@/")) resolved = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith("."))
    resolved = posix.join(posix.dirname(fromFile), specifier);
  else return specifier;
  return resolved.replace(/\.(tsx?|jsx?)$/, "").replace(/\/index$/, "");
}

const parsed = new Map<string, ts.SourceFile>();
function parse(fileName: string, source: string): ts.SourceFile {
  const key = `${fileName}\0${source}`;
  const hit = parsed.get(key);
  if (hit) return hit;
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  parsed.set(key, file);
  return file;
}

const WRAPPERS = new Set([
  ts.SyntaxKind.AwaitExpression,
  ts.SyntaxKind.ParenthesizedExpression,
  ts.SyntaxKind.AsExpression,
  ts.SyntaxKind.SatisfiesExpression,
  ts.SyntaxKind.NonNullExpression,
  ts.SyntaxKind.TypeAssertionExpression,
]);

/** Which names a dynamic `import(...)` result is consumed as. */
function dynamicImportNames(
  call: ts.CallExpression,
): ReadonlySet<string> | "*" {
  let node: ts.Node = call;
  while (node.parent && WRAPPERS.has(node.parent.kind)) node = node.parent;
  const parent = node.parent;
  if (
    parent &&
    ts.isVariableDeclaration(parent) &&
    parent.initializer === node &&
    ts.isObjectBindingPattern(parent.name)
  ) {
    const names = new Set<string>();
    for (const element of parent.name.elements) {
      if (element.dotDotDotToken) return "*";
      const key = element.propertyName ?? element.name;
      if (!ts.isIdentifier(key) && !ts.isStringLiteral(key)) return "*";
      names.add(key.text);
    }
    return names;
  }
  if (
    parent &&
    ts.isPropertyAccessExpression(parent) &&
    parent.expression === node &&
    parent.name.text !== "then"
  )
    return new Set([parent.name.text]);
  if (
    parent &&
    ts.isElementAccessExpression(parent) &&
    parent.expression === node &&
    ts.isStringLiteral(parent.argumentExpression)
  )
    return new Set([parent.argumentExpression.text]);
  // Bound to a whole-module name, `.then(...)`, passed along: all names.
  return "*";
}

/** Every module a source file uses at runtime (type-only imports excluded). */
function moduleUses(fileName: string, source: string): ModuleUse[] {
  const uses: ModuleUse[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.importClause;
      if (!clause?.isTypeOnly) {
        const names = new Set<string>();
        let all = false;
        if (clause?.name) names.add("default");
        const bindings = clause?.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) all = true;
        else if (bindings)
          for (const element of bindings.elements)
            if (!element.isTypeOnly)
              names.add((element.propertyName ?? element.name).text);
        uses.push({
          module: resolveModule(fileName, node.moduleSpecifier.text),
          names: all ? "*" : names,
        });
      }
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !node.isTypeOnly
    ) {
      const clause = node.exportClause;
      const names =
        !clause || ts.isNamespaceExport(clause)
          ? ("*" as const)
          : new Set(
              clause.elements
                .filter((element) => !element.isTypeOnly)
                .map((element) => (element.propertyName ?? element.name).text),
            );
      uses.push({
        module: resolveModule(fileName, node.moduleSpecifier.text),
        names,
      });
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const [arg] = node.arguments;
      uses.push({
        module:
          arg && ts.isStringLiteralLike(arg)
            ? resolveModule(fileName, arg.text)
            : "<non-literal dynamic import>",
        names: dynamicImportNames(node),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(fileName, source));
  return uses;
}

/** The restricted `symbols` a source file imports from `module` (in any form). */
function importedSymbols(
  fileName: string,
  source: string,
  module: string,
  symbols: readonly string[],
): string[] {
  const found = new Set<string>();
  for (const use of moduleUses(fileName, source)) {
    if (use.module !== module) continue;
    for (const symbol of symbols)
      if (use.names === "*" || use.names.has(symbol)) found.add(symbol);
  }
  return [...found].sort();
}

/** True when the source calls `name(...)` directly or as a member (`x.name(...)`). */
function callsFunction(
  fileName: string,
  source: string,
  name: string,
): boolean {
  let hit = false;
  const visit = (node: ts.Node): void => {
    if (hit) return;
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (
        (ts.isIdentifier(callee) && callee.text === name) ||
        (ts.isPropertyAccessExpression(callee) && callee.name.text === name)
      )
        hit = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(fileName, source));
  return hit;
}

// Rule predicates over one file (pure: file name + source text).
function publishesRevision(file: string, source: string): boolean {
  return (
    callsFunction(file, source, BUMP) ||
    importedSymbols(file, source, DISPLAY_STORE, [BUMP]).length > 0
  );
}
function callsNotify(file: string, source: string): boolean {
  return (
    callsFunction(file, source, NOTIFY) ||
    importedSymbols(file, source, OWNED_MASTER, [NOTIFY]).length > 0
  );
}
function importsRawWriter(file: string, source: string): boolean {
  return importedSymbols(file, source, PHOTO_STORAGE, RAW_WRITERS).length > 0;
}
function importsReconcileWriter(file: string, source: string): boolean {
  return (
    importedSymbols(file, source, PHOTO_STORAGE, RECONCILE_WRITERS).length > 0
  );
}
function importsDisplayResolver(file: string, source: string): boolean {
  return (
    importedSymbols(file, source, PHOTO_STORAGE, [DISPLAY_RESOLVER]).length > 0
  );
}
function importsPlainResolver(file: string, source: string): boolean {
  return (
    importedSymbols(file, source, PHOTO_STORAGE, [PLAIN_RESOLVER]).length > 0
  );
}
function mixesExpoImageWithPlainResolver(
  file: string,
  source: string,
): boolean {
  return (
    moduleUses(file, source).some((use) => use.module === "expo-image") &&
    importsPlainResolver(file, source)
  );
}

// ---------------------------------------------------------------------------
// Tree walk
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set(["__testkit__", "__dev__", "node_modules"]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...sourceFiles(path));
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !/\.test\.tsx?$/.test(entry.name) &&
      !entry.name.endsWith(".d.ts")
    )
      out.push(path.split("\\").join("/"));
  }
  return out;
}

const TREE = sourceFiles("src").map((file) => ({
  file,
  source: readFileSync(file, "utf8"),
}));
const matching = (rule: (file: string, source: string) => boolean) =>
  TREE.filter(({ file, source }) => rule(file, source))
    .map(({ file }) => file)
    .sort();

// ---------------------------------------------------------------------------
// Fixtures: every matcher bites before it is trusted over the tree
// ---------------------------------------------------------------------------

const AT = "src/services/example/fixture.ts";
const NEAR = "src/services/photos/fixture.ts";

describe("import matchers catch every import form", () => {
  const violating: Array<[string, string, string]> = [
    [
      "static named (alias)",
      AT,
      'import { persistMaster } from "@/services/photos/photo-storage";',
    ],
    [
      "static named, renamed",
      AT,
      'import { deletePhoto as rm } from "@/services/photos/photo-storage";',
    ],
    [
      "static namespace (relative)",
      NEAR,
      'import * as ps from "./photo-storage";',
    ],
    [
      "relative from another directory",
      AT,
      'import { persistMaster } from "../photos/photo-storage";',
    ],
    [
      "dynamic destructured",
      AT,
      'async function f() { const { persistMaster } = await import("@/services/photos/photo-storage"); }',
    ],
    [
      "dynamic destructured, multi-line",
      NEAR,
      `async function f() {
        const {
          listCanonicalSidecarPaths,
          deletePhoto,
        } = await import(
          "./photo-storage"
        );
      }`,
    ],
    [
      "dynamic destructured with a cast",
      AT,
      'async function f() { const { persistMaster } = (await import("@/services/photos/photo-storage")) as { persistMaster: () => void }; }',
    ],
    [
      "dynamic whole-module binding",
      NEAR,
      'async function f() { const m = await import("./photo-storage"); m.anything(); }',
    ],
    [
      "dynamic property read",
      AT,
      'async function f() { (await import("@/services/photos/photo-storage")).deletePhoto("x"); }',
    ],
    [
      "dynamic .then()",
      AT,
      'import("@/services/photos/photo-storage").then((m) => m.persistMaster);',
    ],
    ["re-export", NEAR, 'export { persistMaster } from "./photo-storage";'],
    ["star re-export", NEAR, 'export * from "./photo-storage";'],
  ];
  it.each(violating)("detects a raw-writer import: %s", (_, file, source) => {
    expect(importsRawWriter(file, source)).toBe(true);
  });

  const clean: Array<[string, string, string]> = [
    [
      "an unrestricted named import",
      AT,
      'import { contactPhotoRelPath } from "@/services/photos/photo-storage";',
    ],
    [
      "a type-only import",
      AT,
      'import type { persistMaster } from "@/services/photos/photo-storage";',
    ],
    [
      "an inline type-only specifier",
      AT,
      'import { type persistMaster, relPathForTarget } from "@/services/photos/photo-storage";',
    ],
    [
      "the owned-master sidecar dynamic import",
      NEAR,
      'async function f() { const { listCanonicalSidecarPaths } = await import("./photo-storage"); }',
    ],
    [
      "a same-named symbol from another module",
      AT,
      'import { persistMaster } from "@/services/photos/other-storage";',
    ],
    [
      "a type query (not a runtime import)",
      AT,
      'let x: typeof import("@/services/photos/photo-storage");',
    ],
  ];
  it.each(clean)("ignores %s", (_, file, source) => {
    expect(importsRawWriter(file, source)).toBe(false);
  });

  it("resolves the alias and relative specifiers to the same module", () => {
    expect(resolveModule(AT, "@/services/photos/photo-storage")).toBe(
      PHOTO_STORAGE,
    );
    expect(resolveModule(NEAR, "./photo-storage")).toBe(PHOTO_STORAGE);
    expect(resolveModule(AT, "../photos/photo-storage.ts")).toBe(PHOTO_STORAGE);
  });

  it.each([
    [
      "static named",
      'import { resolvePhotoUri } from "@/services/photos/photo-storage";',
    ],
    ["static namespace", 'import * as ps from "../photos/photo-storage";'],
    [
      "dynamic destructured",
      'async function f() { const { resolvePhotoUri } = await import("../photos/photo-storage"); }',
    ],
    [
      "dynamic whole-module",
      'async function f() { const m = await import("@/services/photos/photo-storage"); }',
    ],
  ])("detects a plain-resolver import: %s", (_, source) => {
    expect(importsPlainResolver(AT, source)).toBe(true);
  });
  it("ignores the display resolver", () => {
    expect(
      importsPlainResolver(
        AT,
        'import { resolvePhotoDisplayUri } from "@/services/photos/photo-storage";',
      ),
    ).toBe(false);
  });
});

describe("revision publisher matcher", () => {
  it.each([
    ["a direct call", `${BUMP}("avatars/contact-1.jpg");`],
    ["a member call", `store.${BUMP}(path);`],
    [
      "a renamed import",
      `import { ${BUMP} as b } from "@/stores/photo-cache-bust-store";`,
    ],
    [
      "a dynamic import",
      'async function f() { const s = await import("@/stores/photo-cache-bust-store"); }',
    ],
  ])("detects %s", (_, source) => {
    expect(publishesRevision(AT, source)).toBe(true);
  });
  it.each([
    [
      "a display read",
      'import { getPhotoCacheBust } from "@/stores/photo-cache-bust-store"; getPhotoCacheBust(p);',
    ],
    ["a mention in a comment", `// never call ${BUMP}(x) here`],
    ["the ownership-layer notify", "notifyPhotoBytesChanged(canonical);"],
  ])("ignores %s", (_, source) => {
    expect(publishesRevision(AT, source)).toBe(false);
  });
});

describe("expo-image + plain resolver matcher", () => {
  const COMPONENT = "src/components/Fixture.tsx";
  it("detects a component that renders expo-image from a plain URI", () => {
    expect(
      mixesExpoImageWithPlainResolver(
        COMPONENT,
        'import { Image } from "expo-image";\nimport { resolvePhotoUri } from "@/services/photos/photo-storage";\nexport const A = () => <Image source={{ uri: resolvePhotoUri(p) }} />;',
      ),
    ).toBe(true);
  });
  it("accepts a component that renders through the display source", () => {
    expect(
      mixesExpoImageWithPlainResolver(
        COMPONENT,
        'import { Image } from "expo-image";\nimport { usePhotoDisplay } from "@/components/photo-display";',
      ),
    ).toBe(false);
  });
});

describe("reconcile writer matcher (WR-07)", () => {
  it.each([
    [
      "static named",
      'import { reconcilePhotoWritesForCanonical } from "@/services/photos/photo-storage";',
    ],
    [
      "the removed whole-directory reconcile",
      'import { reconcilePhotoWrites } from "@/services/photos/photo-storage";',
    ],
    [
      "dynamic destructured, renamed",
      'async function f() { const { reconcilePhotoWritesForCanonical: r } = await import("../photos/photo-storage"); }',
    ],
    ["static namespace", 'import * as ps from "../photos/photo-storage";'],
  ])("detects %s (and counts it as a raw writer)", (_, source) => {
    expect(importsReconcileWriter(AT, source)).toBe(true);
    expect(importsRawWriter(AT, source)).toBe(true);
  });
  it.each([
    [
      "the sidecar listing",
      'import { listCanonicalSidecarPaths } from "@/services/photos/photo-storage";',
    ],
    [
      "the owned reconcile",
      'import { reconcilePhotoWritesOwned } from "@/services/photos/owned-master";',
    ],
  ])("ignores %s", (_, source) => {
    expect(importsReconcileWriter(AT, source)).toBe(false);
  });
});

describe("notify caller matcher (WR-07)", () => {
  it.each([
    ["a direct call", `${NOTIFY}("avatars/contact-1.jpg");`],
    ["a member call", `owned.${NOTIFY}(path);`],
    [
      "a renamed import",
      `import { ${NOTIFY} as n } from "@/services/photos/owned-master";`,
    ],
    ["a relative import", `import { ${NOTIFY} } from "./owned-master";`],
    [
      "a dynamic destructured import",
      `async function f() { const { ${NOTIFY} } = await import("@/services/photos/owned-master"); }`,
    ],
  ])("detects %s", (_, source) => {
    expect(callsNotify(NEAR, source)).toBe(true);
  });
  it.each([
    [
      "another owned-master import",
      'import { persistOwnedMaster } from "@/services/photos/owned-master";',
    ],
    ["a mention in a comment", `// the owner calls ${NOTIFY}(x) after`],
    ["the store bump", `${BUMP}(canonical);`],
  ])("ignores %s", (_, source) => {
    expect(callsNotify(NEAR, source)).toBe(false);
  });
});

describe("display resolver matcher (WR-07)", () => {
  it.each([
    [
      "static named",
      'import { resolvePhotoDisplayUri } from "@/services/photos/photo-storage";',
    ],
    [
      "dynamic property read",
      'async function f() { (await import("@/services/photos/photo-storage")).resolvePhotoDisplayUri(p, undefined); }',
    ],
    ["static namespace", 'import * as ps from "../photos/photo-storage";'],
  ])("detects %s", (_, source) => {
    expect(importsDisplayResolver(AT, source)).toBe(true);
  });
  it.each([
    [
      "the plain resolver",
      'import { resolvePhotoUri } from "@/services/photos/photo-storage";',
    ],
    [
      "the display hook",
      'import { usePhotoDisplay } from "@/components/photo-display";',
    ],
  ])("ignores %s", (_, source) => {
    expect(importsDisplayResolver(AT, source)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The contract over the real tree
// ---------------------------------------------------------------------------

// Each scan parses all of src/ with the TypeScript parser; under full-suite load a
// single scan can exceed the 5 s default, so the source scans get a wider budget.
describe("photo writer contract (src/, tests excluded)", {
  timeout: 30_000,
}, () => {
  it("scans a real tree", () => {
    expect(TREE.length).toBeGreaterThan(100);
    expect(TREE.some(({ file }) => file.endsWith("owned-master.ts"))).toBe(
      true,
    );
  });

  it("classifies the existing dynamic photo-storage imports correctly", () => {
    const owned = TREE.find(({ file }) =>
      file.endsWith("src/services/photos/owned-master.ts"),
    );
    const uses = moduleUses(owned!.file, owned!.source).filter(
      (use) => use.module === PHOTO_STORAGE && use.names !== "*",
    );
    expect(
      uses.some(
        (use) =>
          use.names !== "*" && use.names.has("listCanonicalSidecarPaths"),
      ),
    ).toBe(true);
  });

  it("only the ownership layer publishes a display revision", () => {
    expect(matching(publishesRevision)).toEqual(REVISION_PUBLISHERS);
  });

  it("only owned-master and the restore cleanup call notifyPhotoBytesChanged", () => {
    expect(matching(callsNotify)).toEqual([...NOTIFY_CALLERS].sort());
  });

  it("only owned-master imports the .bak reconcile move", () => {
    expect(matching(importsReconcileWriter)).toEqual(
      [...RECONCILE_WRITER_IMPORTERS].sort(),
    );
  });

  it("display-resolver importers are exactly the allowlist", () => {
    expect(matching(importsDisplayResolver)).toEqual(
      [...DISPLAY_RESOLVER_IMPORTERS].sort(),
    );
  });

  it("only the owned importers import the raw byte writers", () => {
    expect(matching(importsRawWriter)).toEqual(
      [...RAW_WRITER_IMPORTERS].sort(),
    );
  });

  it("no component or screen that imports expo-image resolves a plain photo URI", () => {
    expect(
      matching(
        (file, source) =>
          (file.startsWith("src/components/") ||
            file.startsWith("src/screens/")) &&
          mixesExpoImageWithPlainResolver(file, source),
      ),
    ).toEqual([]);
  });

  it("plain-resolver importers are exactly the allowlist", () => {
    expect(matching(importsPlainResolver)).toEqual(
      [...PLAIN_RESOLVER_IMPORTERS].sort(),
    );
  });
});
