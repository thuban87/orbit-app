/**
 * 38.9 glossary contract (D-21, D-22, D-41, D-42, D-49, D-56).
 *
 * 1. The retired user-visible forms ("Not Contacted", "Not yet contacted",
 *    "Wobbling", "Favourite(s)", "Log Contact", "Dashboard(s)") never return
 *    to production copy. The scan parses every production file under `src/`
 *    (tests excluded) plus `app.config.ts` (the widget picker label) with the
 *    TypeScript compiler and visits only string literals, template pieces
 *    (`TemplateHead` / `TemplateMiddle` / `TemplateTail`, no-substitution
 *    templates) and `JsxText`. Comments and identifiers are never visited.
 *    38.9-15 adds "Group Event(s)" / "group event(s)" (D-22: "Event(s)" is
 *    the user-facing noun) and, in the files it converts only, the D-41
 *    developer wording ("Follows event", "overridden", "participant record",
 *    "Sensitive Operations", "Tombstones", "Related rows", "Format version",
 *    "cadence", "override(s)"). 38.11-12 adds "Archived contact(s)" /
 *    "Archived Contact(s)" (D-69: the user-facing name is "Bin").
 * 2. Every decided term keeps its value (D-41 rename guard).
 * 3. Persisted / OS-registered identifiers keep their spelling (D-49, D-12):
 *    population id `favourites`, widget provider `OrbitFavourites`, deep link
 *    `orbit://favourites`.
 *
 * Skip rules (code literals are not user-visible copy; review C2-M3, C4-L4):
 *   (a) module specifiers (`import`/`export … from`, `require(…)`,
 *       `import(…)`, `vi.mock(…)`/`vi.doMock(…)` first arguments);
 *   (b) property-name keys (object-literal property, type or interface
 *       member, class member, enum member);
 *   (c) literals inside a type (`"dashboard" | "x"` unions);
 *   (d) a literal or template piece inside an argument of the nearest
 *       enclosing call when that call is `Logger.*(…)`;
 *   (e) the same for `Error(…)` / `new Error(…)` (developer-only).
 *       `super(…)` in an Error subclass is still checked: such text can reach
 *       the screen.
 *
 * Matching rule (shared with Plan 15): a retired form matches as a whole
 * token. Only a letter, digit, `_`, `-` or `/` directly before or after it
 * joins it to a longer token and blocks the match. A literal containing `://`
 * is a URL and is not checked. Every form takes an optional plural `s`.
 * Capitalised forms match case-sensitively in any literal; lowercase forms
 * match only in a literal that contains whitespace, and a multi-word
 * lowercase form also matches its sentence-case variant.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { POPULATION_LABELS } from "@/components/control-surface/control-labels";
import * as glossary from "./glossary";

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");
const EXTRA_FILES = ["app.config.ts"];

interface RetiredForm {
  /** The singular form; an optional plural `s` is always accepted. */
  form: string;
  case: "capitalised" | "lowercase";
}

/** D-22, D-42, D-49. */
const RETIRED_FORMS: readonly RetiredForm[] = [
  { form: "Not Contacted", case: "capitalised" },
  { form: "Not contacted", case: "capitalised" },
  { form: "Not yet contacted", case: "capitalised" },
  { form: "Wobbling", case: "capitalised" },
  { form: "Favourite", case: "capitalised" },
  { form: "Log Contact", case: "capitalised" },
  { form: "Dashboard", case: "capitalised" },
  { form: "not yet contacted", case: "lowercase" },
  { form: "favourite", case: "lowercase" },
  { form: "dashboard", case: "lowercase" },
  // D-22: "Event(s)" is the user-facing noun for a group event (38.9-15).
  { form: "Group Event", case: "capitalised" },
  { form: "group event", case: "lowercase" },
  // D-22: the conversion entry and its prompt say "event" (verification IN-02).
  { form: "group interaction", case: "lowercase" },
  // 38.11 D-69: archived people are "the Bin" to the user (Settings → Bin).
  // Internal ids (`archived_at`, the `Archived` route, the `archive` event)
  // are not phrases, so these exact forms never catch them.
  { form: "Archived contact", case: "capitalised" },
  { form: "Archived Contact", case: "capitalised" },
  // The glossary spells user-visible words the American way ("color"); the
  // 38.12 star-color labels said "colour" (38.12-14 SUMMARY, fix-pass queue 2).
  { form: "Colour", case: "capitalised" },
  { form: "colour", case: "lowercase" },
];

/**
 * D-41 developer wording, rewritten in plain words by 38.9-15. Checked only in
 * the files that plan converts (`DEVELOPER_WORDING_FILES`), so the contract
 * does not pull unlisted screens into scope.
 */
const DEVELOPER_WORDING_FORMS: readonly RetiredForm[] = [
  { form: "Follows event", case: "capitalised" },
  { form: "follows event", case: "lowercase" },
  { form: "Overridden", case: "capitalised" },
  { form: "overridden", case: "lowercase" },
  { form: "Participant record", case: "capitalised" },
  { form: "participant record", case: "lowercase" },
  { form: "Sensitive Operation", case: "capitalised" },
  { form: "sensitive operation", case: "lowercase" },
  { form: "Tombstone", case: "capitalised" },
  { form: "Related rows", case: "capitalised" },
  { form: "Format version", case: "capitalised" },
  { form: "Cadence", case: "capitalised" },
  { form: "cadence", case: "lowercase" },
  { form: "Override", case: "capitalised" },
  { form: "override", case: "lowercase" },
];

/** The production files 38.9-15 converts (D-22, D-41). */
const DEVELOPER_WORDING_FILES: readonly string[] = [
  "src/screens/GroupEventDetailScreen.tsx",
  "src/screens/GroupLogScreen.tsx",
  "src/screens/EditGroupEventScreen.tsx",
  "src/screens/EditParticipantScreen.tsx",
  "src/components/group/GroupTitlePromptSheet.tsx",
  "src/components/digest/DigestDayDetail.tsx",
  "src/components/history/HistorySection.tsx",
  "src/components/history/HistoryStreamRows.tsx",
  "src/components/history/interaction-detail-logic.ts",
  "src/components/history/InteractionDetail.tsx",
  "src/components/history/GroupScopePrompt.tsx",
  "src/db/merge-dao.ts",
  "src/screens/dashboard-overflow-actions.ts",
  "src/components/group/ParticipantCard.tsx",
  "src/components/group/ParticipantOverrideEditor.tsx",
  "src/components/BulkActionSurface.tsx",
  "src/screens/RestorePreviewScreen.tsx",
  "src/screens/EditContactScreen.tsx",
  "src/screens/CreateContactScreen.tsx",
  "src/screens/contact-profile-logic.ts",
  "src/screens/BackupSettingsScreen.tsx",
  "src/screens/SystemBuilderScreen.tsx",
  "src/screens/SystemsManagementScreen.tsx",
  "src/screens/CategoryManagementScreen.tsx",
  "src/profile/template-manager-model.ts",
  "src/components/profile/ProfileBackgroundManager.tsx",
  "src/components/profile/ProfileTemplateManager.tsx",
  "src/screens/BulkImportSetupScreen.tsx",
  "src/screens/ContactProfileScreen.tsx",
];

/**
 * Developer-only literals that are never shown, allowlisted by file and exact
 * text (38.9-14 context): `fail(…)` text in the backup validator (the Backup
 * screen shows `restorePreviewFailure(reason).message` instead) and a console
 * warning.
 */
const DEVELOPER_ONLY: Readonly<Record<string, readonly string[]>> = {
  "src/backup/backup-schema.ts": [
    "appSettings has invalid Dashboard filters",
    // 38.9-15: `fail(…)` text, never shown (found by the C3-M2 re-grep).
    "interactions has an invalid Group Event UID",
    // 38.12-09: `fail(…)` text naming the D-112 wire key, never shown.
    "contacts has an invalid favourite",
  ],
  "src/stores/dashboard-query-store.ts": [
    "Dashboard preferences were malformed; using empty query axes.",
  ],
};

/** Collapse whitespace so JSX text compares by its words. */
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const JOINER = "[A-Za-z0-9_/-]";

function formPattern({ form, case: kind }: RetiredForm): RegExp {
  let body = escapeRegExp(form);
  if (kind === "lowercase" && form.includes(" ")) {
    const first = form[0] as string;
    body = `[${first.toUpperCase()}${first}]${escapeRegExp(form.slice(1))}`;
  }
  return new RegExp(`(?<!${JOINER})${body}s?(?!${JOINER})`);
}

interface FormPattern extends RetiredForm {
  re: RegExp;
}

const compile = (forms: readonly RetiredForm[]): FormPattern[] =>
  forms.map((f) => ({ ...f, re: formPattern(f) }));

const PATTERNS = compile(RETIRED_FORMS);
const DEVELOPER_WORDING_PATTERNS = compile(DEVELOPER_WORDING_FORMS);

/** The retired forms `text` contains, under the matching rule. */
function retiredFormsIn(
  text: string,
  patterns: readonly FormPattern[] = PATTERNS,
): string[] {
  if (text.includes("://")) return [];
  const spaced = /\s/.test(text);
  return patterns
    .filter((p) => (p.case === "capitalised" || spaced) && p.re.test(text))
    .map((p) => p.form);
}

type CopyNode =
  | ts.StringLiteral
  | ts.NoSubstitutionTemplateLiteral
  | ts.TemplateHead
  | ts.TemplateMiddle
  | ts.TemplateTail
  | ts.JsxText;

function isCopyNode(node: ts.Node): node is CopyNode {
  return (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node) ||
    ts.isJsxText(node)
  );
}

const isIdentifierNamed = (node: ts.Node, name: string) =>
  ts.isIdentifier(node) && node.text === name;

/** (a) The first argument of a module-loading call. */
function isModuleSpecifier(node: ts.Node): boolean {
  const parent = node.parent;
  if (
    (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) &&
    parent.moduleSpecifier === node
  ) {
    return true;
  }
  if (ts.isExternalModuleReference(parent)) return true;
  if (ts.isCallExpression(parent) && parent.arguments[0] === node) {
    const callee = parent.expression;
    if (callee.kind === ts.SyntaxKind.ImportKeyword) return true;
    if (isIdentifierNamed(callee, "require")) return true;
    if (
      ts.isPropertyAccessExpression(callee) &&
      isIdentifierNamed(callee.expression, "vi") &&
      (callee.name.text === "mock" || callee.name.text === "doMock")
    ) {
      return true;
    }
  }
  return false;
}

/** (b) The name of a property, member or enum member. */
function isPropertyNameKey(node: ts.Node): boolean {
  const parent = node.parent;
  if (ts.isComputedPropertyName(parent)) return true;
  return (
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isGetAccessorDeclaration(parent) ||
      ts.isSetAccessorDeclaration(parent) ||
      ts.isEnumMember(parent)) &&
    parent.name === node
  );
}

/** (c) Anywhere inside a type. */
function isInsideType(node: ts.Node): boolean {
  for (let n = node.parent; n !== undefined; n = n.parent) {
    if (ts.isLiteralTypeNode(n) || ts.isTemplateLiteralTypeNode(n)) {
      return true;
    }
    if (ts.isTypeNode(n) && !ts.isExpressionWithTypeArguments(n)) return true;
    if (ts.isStatement(n) || ts.isSourceFile(n)) return false;
  }
  return false;
}

/**
 * The nearest call or `new` expression that holds `node` inside one of its
 * ARGUMENTS (never its callee). A template piece's parent is its
 * `TemplateExpression`, so this walks up instead of reading `node.parent`.
 */
function nearestEnclosingCall(
  node: ts.Node,
): ts.CallExpression | ts.NewExpression | undefined {
  let child: ts.Node = node;
  for (let n = node.parent; n !== undefined; child = n, n = n.parent) {
    if (
      (ts.isCallExpression(n) || ts.isNewExpression(n)) &&
      (n.arguments ?? []).some((arg) => arg === child)
    ) {
      return n;
    }
  }
  return undefined;
}

/** (d) `Logger.*(…)` or (e) `Error(…)` / `new Error(…)`. */
function isDeveloperCall(node: ts.Node): boolean {
  const call = nearestEnclosingCall(node);
  if (call === undefined) return false;
  const callee = call.expression;
  if (isIdentifierNamed(callee, "Error")) return true;
  return (
    ts.isCallExpression(call) &&
    ts.isPropertyAccessExpression(callee) &&
    isIdentifierNamed(callee.expression, "Logger")
  );
}

function isSkipped(node: CopyNode): boolean {
  if (ts.isJsxText(node)) return false;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    if (isModuleSpecifier(node) || isPropertyNameKey(node)) return true;
  }
  return isInsideType(node) || isDeveloperCall(node);
}

interface RetiredHit {
  line: number;
  text: string;
  forms: string[];
}

/** Every user-visible literal in `source` that carries a retired form. */
function scanSource(
  file: string,
  source: string,
  patterns: readonly FormPattern[] = PATTERNS,
): RetiredHit[] {
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.ES2022,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const hits: RetiredHit[] = [];
  const visit = (node: ts.Node) => {
    if (isCopyNode(node) && !isSkipped(node)) {
      const forms = retiredFormsIn(node.text, patterns);
      if (forms.length > 0) {
        hits.push({
          line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          text: node.text,
          forms,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

function productionFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...productionFiles(path));
    } else if (/\.tsx?$/.test(name) && !name.includes(".test.")) {
      out.push(path);
    }
  }
  return out;
}

const SCANNED = [
  ...productionFiles(SRC),
  ...EXTRA_FILES.map((f) => join(ROOT, f)),
];

const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("glossary contract — the scanner", () => {
  const scan = (src: string, file = "sample.tsx") =>
    scanSource(file, src).map((h) => h.text);

  it("catches a template head and a JSX text node, and skips a comment", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a source sample.
    expect(scan("const a = `Wobbling for ${n} days`;")).toEqual([
      "Wobbling for ",
    ]);
    expect(scan("const a = <Text>No favourites yet</Text>;")).toEqual([
      "No favourites yet",
    ]);
    expect(scan("// Not yet contacted\n/* Dashboard */\nconst a = 1;")).toEqual(
      [],
    );
  });

  it("(a) skips module specifiers", () => {
    expect(
      scan(
        [
          'import x from "./Dashboard";',
          'export { y } from "./Favourite";',
          'const z = require("./Dashboard");',
          'const w = import("./Dashboard");',
          'vi.mock("./Dashboard", () => ({}));',
          'vi.doMock("./Dashboard");',
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("(b) skips property-name keys", () => {
    expect(
      scan(
        [
          'const a = { "Dashboard": 1 };',
          'interface B { "Favourite": string }',
          'type C = { "Wobbling": number };',
          'enum D { "Dashboard" = 1 }',
          'class E { "Dashboard" = 1 }',
        ].join("\n"),
        "sample.ts",
      ),
    ).toEqual([]);
  });

  it("(c) skips literals inside a type", () => {
    expect(scan('type T = "Dashboard" | "Favourites";', "sample.ts")).toEqual(
      [],
    );
  });

  it("(d) skips Logger.* arguments, including template pieces", () => {
    expect(
      scan(
        // biome-ignore lint/suspicious/noTemplateCurlyInString: a source sample.
        'Logger.warn("Dashboard failed"); Logger.error(`Favourite ${id} lost`);',
      ),
    ).toEqual([]);
  });

  it("(e) skips Error(…) and new Error(…) arguments, including templates", () => {
    expect(
      scan(
        [
          'throw new Error("Dashboard failed");',
          'throw Error("Favourite lost");',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: a source sample.
          "throw new Error(`Group Event id=${x} on the Dashboard`);",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("still checks super(…) in an Error subclass (that text can reach the screen)", () => {
    expect(
      scan(
        'class M extends Error { constructor() { super("Couldn\'t reset the Dashboard"); } }',
      ),
    ).toEqual(["Couldn't reset the Dashboard"]);
  });

  it("the nearest enclosing call decides, not any outer Logger/Error call", () => {
    expect(scan('Logger.warn(show("Dashboard"));')).toEqual(["Dashboard"]);
  });

  it.each([
    "Dashboard.",
    "Dashboard: x",
    "Reset Dashboards",
    "Couldn't update favourite. Try again.",
    "N not yet contacted →",
    "Not yet contacted",
    "Not contacted yet",
    "Favourites",
    "Log Contact",
    // 38.9-15 (D-22; review C3-M2).
    "Couldn't save this group event. Please try again.",
    "Group events can't be in the future.",
    "Group Events",
  ])("catches %j", (text) => {
    expect(retiredFormsIn(text).length).toBeGreaterThan(0);
  });

  it.each([
    "orbit://favourites",
    "favourite_rank",
    "./dashboard-read",
    "dashboard",
    "favourites",
    "dashboard-overflow",
    "DashboardTab",
    "OrbitFavourites",
    "Never Contacted",
    "Favorites",
    "Wobbly",
    // 38.9-15 (D-22; review C3-M2).
    "group_event",
    "group-event",
    "./group-event-refresh",
    "Edit Event",
  ])("skips %j", (text) => {
    expect(retiredFormsIn(text)).toEqual([]);
  });

  it("skips a group event in Error(…) and catches it in super(…) (38.9-15)", () => {
    expect(
      scan(
        [
          'throw new Error("Couldn\'t find this group event");',
          'class G extends Error { constructor() { super("These contacts share a Group Event"); } }',
        ].join("\n"),
      ),
    ).toEqual(["These contacts share a Group Event"]);
  });

  it.each([
    "Follows event: Phone",
    "Phone: overridden",
    "Edit participant record",
    "More sensitive operations",
    "Sensitive Operations",
    "Tombstones:",
    "Related rows:",
    "Format version:",
    "These contacts receive cadence reminders.",
    "Reset Overrides",
    "Overrides",
    "Category override",
  ])("catches D-41 developer wording %j", (text) => {
    expect(
      retiredFormsIn(text, DEVELOPER_WORDING_PATTERNS).length,
    ).toBeGreaterThan(0);
  });

  it.each(["override", "overrides", "inherited", "Same as event: Phone"])(
    "skips %j as D-41 developer wording (a bare discriminator has no space)",
    (text) => {
      expect(retiredFormsIn(text, DEVELOPER_WORDING_PATTERNS)).toEqual([]);
    },
  );
});

type Allowlist = Readonly<Record<string, readonly string[]>>;

/**
 * Scan `paths` for `patterns`; return the hits outside `allowlist` and the
 * allowlist entries that no longer match anything (stale: remove them).
 */
function audit(
  paths: readonly string[],
  patterns: readonly FormPattern[],
  allowlist: Allowlist,
): { offenders: string[]; stale: string[] } {
  const offenders: string[] = [];
  const seen = new Set<string>();
  const key = (file: string, text: string) => `${file}\u0000${squash(text)}`;
  for (const path of paths) {
    const rel = relative(ROOT, path).split("\\").join("/");
    const allowed = new Set((allowlist[rel] ?? []).map(squash));
    for (const hit of scanSource(rel, readFileSync(path, "utf8"), patterns)) {
      if (allowed.has(squash(hit.text))) {
        seen.add(key(rel, hit.text));
        continue;
      }
      offenders.push(
        `${rel}:${hit.line} [${hit.forms.join(", ")}] ${JSON.stringify(squash(hit.text))}`,
      );
    }
  }
  const stale = Object.entries(allowlist).flatMap(([file, texts]) =>
    texts
      .filter((t) => !seen.has(key(file, t)))
      .map((t) => `${file} ${JSON.stringify(t)}`),
  );
  return { offenders, stale };
}

describe("glossary contract — production copy (D-22, D-42, D-49)", () => {
  it("no production literal carries a retired form outside the allowlists", () => {
    const { offenders, stale } = audit(SCANNED, PATTERNS, DEVELOPER_ONLY);
    expect(offenders).toEqual([]);
    expect(stale).toEqual([]);
  }, 30_000);

  it("the D-41 developer wording is gone from the files 38.9-15 converts", () => {
    const paths = DEVELOPER_WORDING_FILES.map((f) => join(ROOT, f));
    for (const path of paths) expect(statSync(path).isFile()).toBe(true);
    const { offenders } = audit(paths, DEVELOPER_WORDING_PATTERNS, {});
    expect(offenders).toEqual([]);
  }, 30_000);

  it("scans app.config.ts (the widget picker label)", () => {
    expect(SCANNED.some((p) => p.endsWith("app.config.ts"))).toBe(true);
  });
});

describe("glossary contract — canonical terms (D-41, D-21)", () => {
  it("keeps every decided term's value (no rename)", () => {
    expect({
      NEVER_CONTACTED: glossary.NEVER_CONTACTED,
      FAVORITES: glossary.FAVORITES,
      FAVORITE: glossary.FAVORITE,
      LOG_INTERACTION: glossary.LOG_INTERACTION,
      STABLE: glossary.STABLE,
      WOBBLY: glossary.WOBBLY,
      DECAYING: glossary.DECAYING,
      ROGUE: glossary.ROGUE,
      GROUP_LOG: glossary.GROUP_LOG,
      DISSOLVE: glossary.DISSOLVE,
      TRANSMIT: glossary.TRANSMIT,
      BOUND: glossary.BOUND,
      UNBOUND: glossary.UNBOUND,
      ORBIT_PARTICIPATION: glossary.ORBIT_PARTICIPATION,
      INTERACTION_ASSIST: glossary.INTERACTION_ASSIST,
      QUARANTINE: glossary.QUARANTINE,
      DIGEST: glossary.DIGEST,
      CONTACTS: glossary.CONTACTS,
      EVENTS: glossary.EVENTS,
      ALLOW_AI: glossary.ALLOW_AI,
      ADD_NOTE: glossary.ADD_NOTE,
    }).toEqual({
      NEVER_CONTACTED: "Never Contacted",
      FAVORITES: "Favorites",
      FAVORITE: "Favorite",
      LOG_INTERACTION: "Log Interaction",
      STABLE: "Stable",
      WOBBLY: "Wobbly",
      DECAYING: "Decaying",
      ROGUE: "Rogue",
      GROUP_LOG: "Group Log",
      DISSOLVE: "Dissolve",
      TRANSMIT: "Transmit",
      BOUND: "Bound",
      UNBOUND: "Unbound",
      ORBIT_PARTICIPATION: "Orbit participation",
      INTERACTION_ASSIST: "Interaction Assist",
      QUARANTINE: "Quarantine",
      DIGEST: "Digest",
      CONTACTS: "Contacts",
      EVENTS: "Events",
      ALLOW_AI: "Allow AI",
      ADD_NOTE: "Add note",
    });
  });

  it("pins the channel and direction label maps (38.14 D-33, D-64)", () => {
    expect(glossary.CHANNEL_LABEL).toEqual({
      Message: "Message",
      Call: "Call",
      "In Person": "In Person",
      other: "Other",
      unspecified: "Unspecified",
    });
    expect(glossary.DIRECTION_LABEL).toEqual({
      outbound: "Outbound",
      inbound: "Inbound",
      mutual: "Mutual",
    });
  });

  it("the shared refine form reads its channel and direction labels from the glossary (38.14 D-33)", () => {
    const form = read("src/components/TouchpointRefineForm.tsx");
    expect(form).toContain("DIRECTION_LABEL[");
    expect(form).toMatch(
      /import \{[^}]*\bDIRECTION_LABEL\b[^}]*\} from "@\/constants\/glossary"/,
    );
    const logic = read("src/screens/log-interaction-logic.ts");
    expect(logic).toContain("CHANNEL_LABEL[");
    expect(logic).not.toMatch(
      /label: "(Message|Call|In Person|Other|Unspecified)"/,
    );
  });

  it("pins the Things to Remember terms (38.10 D-90)", () => {
    expect({
      OFF_LIMITS: glossary.OFF_LIMITS,
      THINGS_TO_REMEMBER: glossary.THINGS_TO_REMEMBER,
      CLOSE: glossary.CLOSE,
      NOT_SET: glossary.NOT_SET,
    }).toEqual({
      OFF_LIMITS: "Off Limits",
      THINGS_TO_REMEMBER: "Things to Remember",
      CLOSE: "Close",
      NOT_SET: "Not set",
    });
  });

  it("the Profile's Things to Remember surfaces read those terms from the glossary (38.10 D-90)", () => {
    const registry = read("src/profile/module-registry.ts");
    expect(registry).toContain("label: THINGS_TO_REMEMBER");
    expect(registry).toContain("label: OFF_LIMITS");
    const presentation = read("src/profile/knowledge-presentation.ts");
    expect(presentation).toContain("return NOT_SET;");
    expect(presentation).toContain("row.label ?? OFF_LIMITS");
    expect(presentation).not.toContain('"Not available yet"');
    const sheet = read("src/components/profile/ThingsToRemember.tsx");
    expect(sheet).toContain("label={CLOSE}");
    expect(sheet).not.toContain('label="Done"');
  });

  it("pins Rarely Responds and every user-visible site reads it (38.11-14 B11)", () => {
    expect(glossary.RARELY_RESPONDS).toBe("Rarely Responds");
    const edit = read("src/screens/EditContactScreen.tsx");
    expect(edit).toContain("{RARELY_RESPONDS}");
    expect(edit).toContain("accessibilityLabel={RARELY_RESPONDS}");
    const sheets = read("src/profile/relationship-sheet-model.ts");
    // The import plus the Gravity definition and the Status detail line.
    expect(sheets.split("RARELY_RESPONDS").length - 1).toBe(3);
    // The retired sentence-case spelling stays out of production copy.
    for (const path of [
      "src/screens/EditContactScreen.tsx",
      "src/profile/relationship-sheet-model.ts",
    ]) {
      expect(read(path)).not.toMatch(
        /"Rarely responds"|>\s*Rarely responds\s*</,
      );
    }
  });

  it("pins the Bin terms (38.11 D-69)", () => {
    expect({ BIN: glossary.BIN, MOVE_TO_BIN: glossary.MOVE_TO_BIN }).toEqual({
      BIN: "Bin",
      MOVE_TO_BIN: "Move to Bin",
    });
  });

  it("pins the Add/Edit Contact section Add labels (38.10 D-67, D-87, D-119)", () => {
    expect({
      ADD_OFF_LIMITS_ITEM: glossary.ADD_OFF_LIMITS_ITEM,
      ADD_MEMORY: glossary.ADD_MEMORY,
      ADD_GIFT_IDEA: glossary.ADD_GIFT_IDEA,
      ADD_THOUGHT_OF_THEM: glossary.ADD_THOUGHT_OF_THEM,
    }).toEqual({
      ADD_OFF_LIMITS_ITEM: "Add Off Limits Item",
      ADD_MEMORY: "Add Memory",
      ADD_GIFT_IDEA: "Add Gift Idea",
      ADD_THOUGHT_OF_THEM: "Add Thought of Them",
    });
    // Last Talked About and Current Location have no Add button (D-119).
    const values = Object.values(glossary).map(String);
    expect(values).not.toContain("Add Last Talked About");
    expect(values).not.toContain("Add Current Location");
  });

  it("Add and Edit Contact read those labels from the glossary (38.10 plan 14)", () => {
    for (const path of [
      "src/screens/EditContactScreen.tsx",
      "src/screens/CreateContactScreen.tsx",
    ]) {
      const screen = read(path);
      expect(screen).toContain("addLabel={ADD_OFF_LIMITS_ITEM}");
      expect(screen).toContain("addButton={{ label: ADD_MEMORY }}");
      expect(screen).toContain("addButton={{ label: ADD_GIFT_IDEA }}");
      expect(screen).toContain("addButton={{ label: ADD_THOUGHT_OF_THEM }}");
      expect(screen).not.toMatch(/Add Last Talked About|Add Current Location/);
    }
  });

  it("the share card reads its control labels from the glossary (38.10 D-77, D-78)", () => {
    const card = read("src/components/ShareConfirmationCard.tsx");
    expect(card).toMatch(
      /import \{[^}]*\bADD_NOTE\b[^}]*\bALLOW_AI\b[^}]*\} from "@\/constants\/glossary"/,
    );
    expect(card).toContain("label={ADD_NOTE}");
    expect(card).toContain("accessibilityLabel={ALLOW_AI}");
    expect(card).not.toContain('"Allow AI"');
    expect(card).not.toContain('"Add note"');
  });

  it("pins the Settings switch labels (38.12 D-130)", () => {
    expect({
      CHECK_IN_REMINDERS: glossary.CHECK_IN_REMINDERS,
      USE_AI_SUGGESTIONS: glossary.USE_AI_SUGGESTIONS,
    }).toEqual({
      CHECK_IN_REMINDERS: "Check-in reminders",
      USE_AI_SUGGESTIONS: "Use AI suggestions",
    });
    // The status names are not renamed alongside (D-05).
    expect(glossary.DECAYING).toBe("Decaying");
    const notifications = read("src/screens/SettingsNotificationsScreen.tsx");
    expect(notifications).toContain("title={CHECK_IN_REMINDERS}");
    expect(notifications).toContain("accessibilityLabel={CHECK_IN_REMINDERS}");
    expect(notifications).not.toContain("Decay reminders");
  });

  it("pins the Check linked contacts wording (38.12 D-49, D-103)", () => {
    expect({
      CHECK_LINKED_CONTACTS: glossary.CHECK_LINKED_CONTACTS,
      NOT_IN_PHONE_CONTACTS: glossary.NOT_IN_PHONE_CONTACTS,
      NEEDS_YOUR_CHOICE: glossary.NEEDS_YOUR_CHOICE,
      LINK_DIFFERENT_PHONE_CONTACT: glossary.LINK_DIFFERENT_PHONE_CONTACT,
      UNLINK_FROM_PHONE_CONTACT: glossary.UNLINK_FROM_PHONE_CONTACT,
    }).toEqual({
      CHECK_LINKED_CONTACTS: "Check linked contacts",
      NOT_IN_PHONE_CONTACTS: "Not in phone Contacts",
      NEEDS_YOUR_CHOICE: "Needs your choice",
      LINK_DIFFERENT_PHONE_CONTACT: "Link to a different phone contact",
      UNLINK_FROM_PHONE_CONTACT: "Unlink from phone contact",
    });
    // The reconcile screens draw these labels from the constants.
    const detail = read("src/screens/ReconcileDetailScreen.tsx");
    expect(detail).toContain("{LINK_DIFFERENT_PHONE_CONTACT}");
    expect(detail).toContain("{UNLINK_FROM_PHONE_CONTACT}");
    expect(detail).toContain("title={CHECK_LINKED_CONTACTS}");
    expect(read("src/screens/ReconcileGridScreen.tsx")).toContain(
      "return NEEDS_YOUR_CHOICE;",
    );
  });

  it("the Contacts population filter uses the glossary labels (D-42, D-49)", () => {
    expect(POPULATION_LABELS["not-contacted"]).toBe(glossary.NEVER_CONTACTED);
    expect(POPULATION_LABELS.favourites).toBe(glossary.FAVORITES);
  });
});

describe("glossary contract — persisted identifiers stay (D-49, D-12)", () => {
  it("population id `favourites` is unchanged", () => {
    expect(Object.keys(POPULATION_LABELS)).toContain("favourites");
  });

  it("widget provider `OrbitFavourites` is unchanged", () => {
    expect(read("src/services/widget/widget-refresh.ts")).toContain(
      'const WIDGET_NAME = "OrbitFavourites";',
    );
    expect(read("app.config.ts")).toContain('name: "OrbitFavourites"');
    expect(read("src/screens/SettingsHubScreen.tsx")).toContain(
      'widgetName: "OrbitFavourites"',
    );
  });

  it("deep link `orbit://favourites` is unchanged", () => {
    expect(read("src/services/widget/widget-render.tsx")).toContain(
      '"orbit://favourites"',
    );
  });
});

describe("glossary contract — leftover event sites use the event noun (D-22, D-74; review WR-03)", () => {
  // Owner-approved wording (D-74). "Group Log" (the action's name) and
  // "Group Note" stay; only these leftover "group" nouns are retired.
  const SITES: readonly {
    file: string;
    retired: string;
    approved: string;
  }[] = [
    {
      file: "src/screens/GroupEventDetailScreen.tsx",
      retired: "Delete group & interactions",
      approved: 'confirm: "Delete Event & Interactions"',
    },
    {
      file: "src/screens/GroupEventDetailScreen.tsx",
      retired: "The group and its shared note are removed.",
      approved: "The event and its shared note are removed.",
    },
    {
      file: "src/components/group/ParticipantCard.tsx",
      retired: "Remove from group",
      approved: '{ label: "Remove from event"',
    },
    {
      file: "src/screens/GroupLogScreen.tsx",
      retired: 'accessibilityLabel="Log group"',
      approved: 'accessibilityLabel="Log event"',
    },
    {
      file: "src/screens/GroupLogScreen.tsx",
      retired: "            Log group\n",
      approved: "            Log event\n",
    },
  ];

  for (const { file, retired, approved } of SITES) {
    it(`${file}: "${approved.trim()}"`, () => {
      const source = read(file).replace(/\r\n/g, "\n");
      expect(source).not.toContain(retired);
      expect(source).toContain(approved);
    });
  }
});

describe("glossary contract — the conversion entry uses the event noun (D-22; verification IN-02)", () => {
  // D-22 makes "Event(s)" the user-facing noun. This wording was chosen by
  // the 38.9 orchestrator, not approved under D-74; the owner may still veto
  // the exact text.
  const SITES: readonly { file: string; approved: string }[] = [
    {
      file: "src/components/history/InteractionDetail.tsx",
      // 38.14 D-66: a visible text Button now (the overflow action is gone).
      approved: 'label="Make this an event"',
    },
    {
      file: "src/components/group/GroupTitlePromptSheet.tsx",
      approved: '<AppText role="heading">Make this an event</AppText>',
    },
  ];

  for (const { file, approved } of SITES) {
    it(`${file}: "${approved}"`, () => {
      const source = read(file).replace(/\r\n/g, "\n");
      expect(source).not.toContain("group interaction");
      expect(source).toContain(approved);
    });
  }
});
