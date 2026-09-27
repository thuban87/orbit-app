/**
 * FAB bottom-clearance contract (38.4 D-52, OA-E3).
 *
 * The shell FAB floats over every route outside `FOCUSED_WORKFLOW_ROUTES`
 * (`UniversalFab` hides only on focused workflows and while the keyboard is
 * open). Any such screen that scrolls must let its last item scroll fully above
 * the FAB, so its scroll content ends with the shared `useBottomClearance()`
 * padding (the measured tab bar + FAB_SIZE + FAB_EDGE_GAP).
 *
 * The FAB-bearing screen set is DERIVED, never hand-kept:
 *   1. the tab stacks are the `@/navigation/tabs/*` modules RootNavigator mounts;
 *   2. each stack's routes come from its `<Stack.Screen name component>`
 *      registrations, or from its `*_ROUTE_COMPONENTS` name→component map;
 *   3. a route wrapper defined in the stack file (for example
 *      `AIPermissionsRoute`) resolves to the screen component it renders;
 *   4. focused routes (`isFocusedWorkflow`) and dev-only routes are dropped.
 *
 * Every remaining screen file either applies the clearance to a scroll
 * container (its `contentContainerStyle`, or a list footer spacer), or sits in
 * `FAB_CLEARANCE_ALLOWLIST` with a reason. A screen whose own file renders no
 * scroll container must be allowlisted too, so a screen that delegates its
 * scroll to a child component cannot slip through unexamined. A stale entry
 * (no longer FAB-bearing, or now cleared) fails.
 *
 * The scan is textual, as `sheet-consumers-contract.test.ts` and
 * `settings-chrome-contract.test.ts` are.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SPACING } from "@/theme/tokens/spacing";
import { isFocusedWorkflow } from "./focused-route-classification";
import { FAB_EDGE_GAP, FAB_SIZE } from "./use-bottom-clearance";

const ROOT = process.cwd();

/** Dev-only routes: compiled out of release bundles, never a user screen. */
const DEV_ONLY_ROUTES = new Set(["__ThemePreview"]);

/**
 * FAB-bearing screens that need no clearance of their own, each with the
 * reason. Keyed by the screen file relative to the repo root.
 */
const FAB_CLEARANCE_ALLOWLIST: Readonly<Record<string, string>> = {
  "src/screens/OrreryScreen.tsx":
    "A full-screen Skia canvas with no scroll container; nothing can end under the FAB.",
};

/**
 * Components that own the scroll container for part of a FAB-bearing screen.
 * The host passes its `useBottomClearance()` down as a REQUIRED
 * `bottomClearance` prop (so TypeScript enforces the hand-off), and the
 * component applies it to its scroll content. Keyed by component file → host.
 */
const DELEGATED_SCROLL_COMPONENTS: Readonly<Record<string, string>> = {
  "src/components/CardGrid.tsx": "src/screens/HomeScreen.tsx",
  "src/components/FieldDefForm.tsx": "src/screens/CustomFieldsScreen.tsx",
};

const SCROLL_CONTAINER =
  /<(Animated\.ScrollView|ScrollView|FlatList|SectionList|ReorderableList|NestedReorderableList)\b/;

function read(file: string): string {
  return readFileSync(join(ROOT, file), "utf8");
}

/** Source with line and block comments removed (string literals kept). */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

function resolveModule(specifier: string): string | null {
  const base = join(ROOT, "src", specifier);
  for (const candidate of [`${base}.tsx`, `${base}.ts`]) {
    if (existsSync(candidate)) return candidate.slice(ROOT.length + 1);
  }
  return null;
}

/** identifier → repo-relative file, for every `@/…` named import. */
function importMap(source: string): Map<string, string> {
  const map = new Map<string, string>();
  const pattern = /import\s*\{([^}]*)\}\s*from\s*"@\/([^"]+)"/g;
  for (const match of source.matchAll(pattern)) {
    const file = resolveModule(match[2]);
    if (!file) continue;
    for (const raw of match[1].split(",")) {
      const name = raw
        .replace(/^\s*type\s+/, "")
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name) map.set(name, file);
    }
  }
  return map;
}

/** The tab stacks RootNavigator actually mounts. */
function tabStackFiles(): string[] {
  const source = read("src/navigation/RootNavigator.tsx");
  const files = [
    ...source.matchAll(/from\s*"@\/(navigation\/tabs\/[A-Za-z]+)"/g),
  ]
    .map((match) => resolveModule(match[1]))
    .filter((file): file is string => file !== null);
  return files;
}

/** Brace-balanced body of `function name(` in `source`, or null. */
function functionBody(source: string, name: string): string | null {
  const start = source.search(new RegExp(`function\\s+${name}\\s*\\(`));
  if (start < 0) return null;
  // Skip the parameter list (it may contain destructuring braces).
  let index = source.indexOf("(", start);
  let parens = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === "(") parens += 1;
    else if (source[index] === ")") {
      parens -= 1;
      if (parens === 0) break;
    }
  }
  const open = source.indexOf("{", index);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return null;
}

/** A registered component identifier → the screen file it renders. */
function resolveComponent(
  stack: string,
  source: string,
  imports: Map<string, string>,
  component: string,
): string {
  const direct = imports.get(component);
  if (direct) return direct;
  const body = functionBody(source, component);
  if (body) {
    for (const tag of body.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)) {
      const file = imports.get(tag[1]);
      if (file) return file;
    }
  }
  throw new Error(`${stack}: cannot resolve route component ${component}`);
}

interface Registration {
  stack: string;
  route: string;
  file: string;
}

function registrations(): Registration[] {
  const out: Registration[] = [];
  for (const stack of tabStackFiles()) {
    const source = stripComments(read(stack));
    const imports = importMap(source);
    const pairs: [string, string][] = [];
    for (const match of source.matchAll(
      /<Stack\.Screen\s+name="([^"]+)"\s+component=\{([A-Za-z0-9_]+)\}/g,
    )) {
      pairs.push([match[1], match[2]]);
    }
    const map = source.match(
      /const\s+[A-Z_]+_ROUTE_COMPONENTS\s*=\s*\{([\s\S]*?)\}\s*as const/,
    );
    if (map) {
      for (const entry of map[1].split(",")) {
        const [key, value] = entry.split(":").map((part) => part.trim());
        if (key) pairs.push([key, value || key]);
      }
    }
    if (pairs.length === 0) throw new Error(`${stack}: no routes parsed`);
    for (const [route, component] of pairs) {
      if (DEV_ONLY_ROUTES.has(route)) continue;
      out.push({
        stack,
        route,
        file: resolveComponent(stack, source, imports, component),
      });
    }
  }
  return out;
}

const ALL_REGISTRATIONS = registrations();

/** FAB-bearing screen file → the routes that show it. */
const FAB_BEARING = new Map<string, string[]>();
for (const { route, file } of ALL_REGISTRATIONS) {
  if (isFocusedWorkflow(route)) continue;
  FAB_BEARING.set(file, [...(FAB_BEARING.get(file) ?? []), route]);
}

/** Brace-balanced `{…}` expressions following `attr=` in `source`. */
function attributeExpressions(source: string, attr: string): string[] {
  const out: string[] = [];
  const pattern = new RegExp(`\\b${attr}=\\{`, "g");
  for (const match of source.matchAll(pattern)) {
    const open = (match.index ?? 0) + match[0].length - 1;
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          out.push(source.slice(open, i + 1));
          break;
        }
      }
    }
  }
  return out;
}

function rendersScroll(source: string): boolean {
  return SCROLL_CONTAINER.test(source);
}

/** Why the file fails the clearance rule, or null when it passes. */
function clearanceViolation(source: string): string | null {
  if (
    !/import\s*\{[^}]*\buseBottomClearance\b[^}]*\}\s*from\s*"@\/navigation\/use-bottom-clearance"/.test(
      source,
    )
  ) {
    return "does not import useBottomClearance";
  }
  const binding = source.match(
    /const\s+([A-Za-z0-9_]+)\s*=\s*useBottomClearance\(\)/,
  );
  if (!binding) return "does not call useBottomClearance()";
  const name = new RegExp(`\\b${binding[1]}\\b`);
  const reaches = [
    ...attributeExpressions(source, "contentContainerStyle"),
    ...attributeExpressions(source, "ListFooterComponent"),
  ].some((expression) => name.test(expression));
  return reaches
    ? null
    : `${binding[1]} never reaches a contentContainerStyle or ListFooterComponent`;
}

describe("FAB clearance: derived FAB-bearing route set (D-52)", () => {
  it("parses routes from every mounted tab stack", () => {
    const stacks = new Set(ALL_REGISTRATIONS.map(({ stack }) => stack));
    expect([...stacks].sort()).toEqual([
      "src/navigation/tabs/DashboardStack.tsx",
      "src/navigation/tabs/DigestStack.tsx",
      "src/navigation/tabs/EventsStack.tsx",
      "src/navigation/tabs/OrreryStack.tsx",
      "src/navigation/tabs/SettingsStack.tsx",
    ]);
  });

  it("resolves route wrappers to the screen they render", () => {
    const routeFile = (route: string) =>
      ALL_REGISTRATIONS.find(
        (entry) =>
          entry.route === route &&
          entry.stack === "src/navigation/tabs/SettingsStack.tsx",
      )?.file;
    expect(routeFile("AIPermissions")).toBe(
      "src/screens/AIPermissionsScreen.tsx",
    );
    expect(routeFile("Backup")).toBe("src/screens/BackupScreen.tsx");
    expect(routeFile("Profile")).toBe("src/screens/ContactProfileScreen.tsx");
  });

  it("drops focused workflows and dev-only routes, keeps browse routes", () => {
    const routes = new Set([...FAB_BEARING.values()].flat());
    expect(routes.has("Home")).toBe(true);
    expect(routes.has("Digest")).toBe(true);
    expect(routes.has("AIPermissions")).toBe(true);
    expect(routes.has("Create")).toBe(false);
    expect(routes.has("BulkImportSetup")).toBe(false);
    expect(routes.has("__ThemePreview")).toBe(false);
  });
});

describe("FAB clearance: every FAB-bearing scroll screen (D-52)", () => {
  const files = [...FAB_BEARING.keys()].sort();

  it.each(files)("%s", (file) => {
    const source = stripComments(read(file));
    const reason = FAB_CLEARANCE_ALLOWLIST[file];
    if (reason !== undefined) {
      expect(reason.trim().length).toBeGreaterThan(0);
      // An allowlisted screen that now applies the clearance is stale.
      expect(clearanceViolation(source)).not.toBeNull();
      return;
    }
    expect(
      rendersScroll(source),
      `${file} renders no scroll container of its own; allowlist it with a reason`,
    ).toBe(true);
    expect(clearanceViolation(source), file).toBeNull();
  });

  it("allowlist entries are all FAB-bearing screens with reasons", () => {
    for (const [file, reason] of Object.entries(FAB_CLEARANCE_ALLOWLIST)) {
      expect(FAB_BEARING.has(file), `${file} is not FAB-bearing`).toBe(true);
      expect(reason.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("FAB clearance: delegated scroll components (D-52)", () => {
  it.each(Object.entries(DELEGATED_SCROLL_COMPONENTS))(
    "%s applies the clearance its host %s passes",
    (component, host) => {
      expect(FAB_BEARING.has(host), `${host} is not FAB-bearing`).toBe(true);
      const source = stripComments(read(component));
      expect(rendersScroll(source)).toBe(true);
      // Required, not optional: the host cannot forget it.
      expect(source).toMatch(/\bbottomClearance: number;/);
      const reaches = attributeExpressions(
        source,
        "contentContainerStyle",
      ).some((expression) => /\bbottomClearance\b/.test(expression));
      expect(reaches).toBe(true);
      expect(stripComments(read(host))).toMatch(
        /bottomClearance=\{bottomClearance\}/,
      );
    },
  );
});

describe("FAB clearance: geometry tokens (D-52)", () => {
  it("keeps FAB_SIZE 56 and FAB_EDGE_GAP on SPACING.base (16)", () => {
    expect(FAB_SIZE).toBe(56);
    expect(SPACING.base).toBe(16);
    expect(FAB_EDGE_GAP).toBe(SPACING.base);
    expect(read("src/navigation/use-bottom-clearance.ts")).toMatch(
      /FAB_EDGE_GAP\s*=\s*SPACING\.base/,
    );
  });
});
