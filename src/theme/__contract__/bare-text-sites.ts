/**
 * Bare-text site classifier (38.5-01, dossier P-6; D-02 scope: text that sits
 * directly on the background art, with no glass or opaque backing).
 * TEST / TOOL SUPPORT ONLY — never imported by app code. The CLI
 * `scripts/bare-text-inventory.ts` runs it over the repo and writes the 38.4
 * brief's `bare-text-sites.csv` columns; `src/theme/bare-text-sites.test.ts`
 * pins its behaviour on in-memory fixtures.
 *
 * It replaces the 38.4 brief's uncommitted scratch walker (brief §C) with the
 * same method:
 *
 *   - Foregrounds: `AppText`, RN `Text`, `Icon`, `Ionicons`, `ActivityIndicator`,
 *     `StatusGlyph`, `TextInput` (always self-filled, so never bare) and the
 *     fill-less `Button` roles (`tertiary` draws `accentText`, `iconOnly` draws
 *     `textPrimary`; every other role paints its own fill).
 *   - Backing classes (38.4 RG029 inventory §0):
 *       glass   `GlassSurface` (any treatment), `ChromeScrim`, `ShellAppBar`
 *               (the glass set is `SCOPE_ELEMENTS` of `glass-scope-reads.ts`)
 *       opaque  a `style`/`contentContainerStyle` `backgroundColor` from the
 *               `surface` / `surfaceElevated` / `background` palette keys, or
 *               a `Sheet` / `Modal` / `ConfirmDialog`
 *       fill    a `backgroundColor` from any other SOLID palette key (an
 *               accent or danger pill). Not in the brief's list; text on a solid
 *               fill is not on the art (38.5-01 deviation, reported).
 *       wrapper a component whose `children` (or other rendered prop) renders
 *               inside one of the above, discovered by fixpoint
 *       no-art  the chain reaches the `Orrery` route, which forces the `none`
 *               background (38.5 CONTEXT, deferred list)
 *   - A foreground with no backing inside its own component is followed across
 *     component boundaries to EVERY render site (JSX tag, component-valued prop,
 *     route registration), up to a route in `src/navigation`. Same-file render
 *     helpers and JSX-valued locals are followed to their references.
 *   - bare: every chain reaches a route unbacked; backed: every chain is backed;
 *     mixed: some of each; unmounted: no chain reaches a route.
 *
 * Tokens resolve from the colour expression (`colors.X`, `scoped.X`,
 * `palette.X`, `tone="X"`, a local alias of one) or the role default, written
 * `X(default)`. An expression the walker cannot resolve is written `expr:…`.
 * A conditional colour lists every branch, joined with `|`.
 *
 * Layout columns (x band, alignment, vertical position) are not derived and are
 * written `ESTIMATED(n/a)`. `verification` defaults to
 * `ESTIMATED(AST-traced, not hand-read)`; hand verification is recorded in the
 * committed CSV, not here.
 *
 * KNOWN LIMITS (syntactic; no type checker): a colour string passed as a prop
 * from another file is `expr:<prop>`; a style built by a helper call is not
 * read; identifier shadowing of a component name is not modelled.
 */
import ts from "typescript";
import { densityForRoute } from "../../navigation/focused-route-classification";
import { resolvePalette } from "../theme-presets";
import { ICON_SIZE, type IconSizeToken } from "../tokens/icon-size";
import { BACKGROUND_VEIL_OPACITY } from "../tokens/surface";
import { TYPOGRAPHY, type TypographyRole } from "../tokens/typography";
import { SCOPE_ELEMENTS, type SourceFileInput } from "./glass-scope-reads";

export type { SourceFileInput };

export const BARE_TEXT_CSV_COLUMNS = [
  "screen/route",
  "file:line",
  "component",
  "element",
  "token",
  "role/size",
  "floor",
  "x_band_dp",
  "alignment",
  "vertical_position",
  "density",
  "verification",
  "parent_chain_note",
  "bare_kind",
] as const;

export type BackingKind =
  | "glass"
  | "opaque"
  | "fill"
  | "self-filled"
  | "no-art";

export interface Chain {
  terminal: "route" | "backed" | "unmounted" | "cycle";
  route?: string;
  routeFile?: string;
  backing?: BackingKind;
  /** Innermost first. */
  note: string[];
}

export type SiteClassification = "bare" | "backed" | "mixed" | "unmounted";

export interface ForegroundSite {
  file: string;
  line: number;
  component: string;
  element: string;
  token: string;
  roleSize: string;
  floor: string;
  classification: SiteClassification;
  backingKinds: BackingKind[];
  /** Routes reached by at least one UNBACKED chain. */
  bareRoutes: string[];
  chains: Chain[];
}

export interface BareTextRow {
  route: string;
  fileLine: string;
  component: string;
  element: string;
  token: string;
  roleSize: string;
  floor: string;
  xBand: string;
  alignment: string;
  verticalPosition: string;
  density: string;
  verification: string;
  parentChainNote: string;
  bareKind: "bare" | "mixed";
}

export interface BareTextAnalysis {
  sites: ForegroundSite[];
  rows: BareTextRow[];
  /** Route name → registering file(s). */
  routes: Map<string, string[]>;
  /** Discovered backed wrapper slots: `file#Component.slot` → kind. */
  wrappers: Map<string, BackingKind>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GLASS_TAGS = new Set<string>(SCOPE_ELEMENTS.map((s) => s.element));
const OPAQUE_TAGS = new Set(["Sheet", "Modal", "ConfirmDialog"]);
const OPAQUE_KEYS = new Set(["surface", "surfaceElevated", "background"]);
/** Translucent by design (~72-77%), so never a backing. */
const TRANSLUCENT_KEYS = new Set(["profileBackgroundScrim"]);

const PALETTE_KEYS: ReadonlySet<string> = new Set(
  Object.keys(resolvePalette("standard", "light")),
);

/** Files whose internal foregrounds are counted at their call sites instead. */
const PRIMITIVE_FILES = new Set([
  "src/components/ui/AppText.tsx",
  "src/components/ui/Button.tsx",
  "src/components/icons/Icon.tsx",
  "src/components/icons/StatusGlyph.tsx",
]);

/** Dev-only routes (never shipped) are not inventoried. */
const DEV_ROUTES = new Set(["__ThemePreview"]);
/** Routes that force the `none` background: text there is not on the art. */
const NO_ART_ROUTES = new Set(["Orrery"]);

const PROFILE_DENSITY =
  "profile-own-BackgroundHost (presentation; profileBackgroundScrim #..B8/#..C4 ~72-77% over contact photo or theme art)";

const DEFAULT_VERIFICATION = "ESTIMATED(AST-traced, not hand-read)";
const LAYOUT_NA = "ESTIMATED(n/a)";
const MAX_NOTE_CHAINS = 12;

const HOOKS_WITH_DEPS = new Set([
  "useCallback",
  "useMemo",
  "useEffect",
  "useLayoutEffect",
  "useImperativeHandle",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FunctionLike =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration;

function isFunctionLike(node: ts.Node): node is FunctionLike {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

function unwrap(expr: ts.Expression): ts.Expression {
  let e = expr;
  while (
    ts.isParenthesizedExpression(e) ||
    ts.isAsExpression(e) ||
    ts.isNonNullExpression(e) ||
    ts.isSatisfiesExpression(e)
  ) {
    e = e.expression;
  }
  return e;
}

function posixDirname(p: string): string {
  const i = p.lastIndexOf("/");
  return i < 0 ? "" : p.slice(0, i);
}

function posixNormalize(p: string): string {
  const out: string[] = [];
  for (const part of p.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

function tagText(
  el: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sf: ts.SourceFile,
): string {
  return el.tagName.getText(sf);
}

function attr(
  el: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  name: string,
): ts.JsxAttribute | undefined {
  for (const p of el.attributes.properties) {
    if (ts.isJsxAttribute(p) && p.name.getText() === name) return p;
  }
  return undefined;
}

function attrExpr(
  el: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  name: string,
): ts.Expression | undefined {
  const a = attr(el, name);
  if (!a?.initializer) return undefined;
  if (ts.isStringLiteral(a.initializer)) return a.initializer;
  if (ts.isJsxExpression(a.initializer) && a.initializer.expression)
    return a.initializer.expression;
  return undefined;
}

/** All string-literal values an expression can take (literal or conditional). */
function literalValues(expr: ts.Expression | undefined): string[] | undefined {
  if (!expr) return undefined;
  const e = unwrap(expr);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e))
    return [e.text];
  if (ts.isConditionalExpression(e)) {
    const a = literalValues(e.whenTrue);
    const b = literalValues(e.whenFalse);
    if (a && b) return [...a, ...b];
  }
  return undefined;
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

// ---------------------------------------------------------------------------
// Corpus model
// ---------------------------------------------------------------------------

interface ComponentDef {
  key: string;
  file: string;
  name: string;
  /** The function node (or alias VariableDeclaration) that is the component root. */
  root: ts.Node;
  fn?: FunctionLike;
}

interface ImportRef {
  spec: string;
  /** Imported name, or "default". */
  imported: string;
}

interface FileInfo {
  file: string;
  sf: ts.SourceFile;
  components: Map<string, ComponentDef>;
  imports: Map<string, ImportRef>;
  /** `export { A as B } from "x"` → B → {spec, imported: A}; `export *` under "*". */
  reexports: Map<string, ImportRef>;
  starExports: string[];
  defaultExport?: string;
  /** `StyleSheet.create` object properties by name. */
  styleObjects: Map<string, ts.ObjectLiteralExpression>;
}

function parse(file: string, source: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function componentFnOf(
  init: ts.Expression | undefined,
): FunctionLike | "alias" | undefined {
  if (!init) return undefined;
  const e = unwrap(init);
  if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) return e;
  if (ts.isCallExpression(e)) {
    const callee = e.expression.getText();
    if (/(^|\.)(memo|forwardRef)$/.test(callee)) {
      const arg = e.arguments[0];
      if (!arg) return undefined;
      const inner = unwrap(arg);
      if (ts.isArrowFunction(inner) || ts.isFunctionExpression(inner))
        return inner;
      if (ts.isIdentifier(inner)) return "alias";
    }
  }
  return undefined;
}

function buildFileInfo(file: string, source: string): FileInfo {
  const sf = parse(file, source);
  const info: FileInfo = {
    file,
    sf,
    components: new Map(),
    imports: new Map(),
    reexports: new Map(),
    starExports: [],
    styleObjects: new Map(),
  };
  const addComponent = (name: string, root: ts.Node, fn?: FunctionLike) => {
    if (!/^[A-Z]/.test(name)) return;
    info.components.set(name, { key: `${file}#${name}`, file, name, root, fn });
  };
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) {
      addComponent(st.name.text, st, st);
      if (st.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword))
        info.defaultExport = st.name.text;
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue;
        const fn = componentFnOf(d.initializer);
        if (fn === "alias") addComponent(d.name.text, d);
        else if (fn) addComponent(d.name.text, fn, fn);
      }
    } else if (ts.isImportDeclaration(st)) {
      const spec = (st.moduleSpecifier as ts.StringLiteral).text;
      const clause = st.importClause;
      if (!clause || clause.isTypeOnly) continue;
      if (clause.name)
        info.imports.set(clause.name.text, { spec, imported: "default" });
      const nb = clause.namedBindings;
      if (nb && ts.isNamedImports(nb)) {
        for (const el of nb.elements) {
          if (el.isTypeOnly) continue;
          info.imports.set(el.name.text, {
            spec,
            imported: (el.propertyName ?? el.name).text,
          });
        }
      }
    } else if (ts.isExportDeclaration(st)) {
      const spec = st.moduleSpecifier
        ? (st.moduleSpecifier as ts.StringLiteral).text
        : undefined;
      if (!st.exportClause) {
        if (spec) info.starExports.push(spec);
      } else if (ts.isNamedExports(st.exportClause)) {
        for (const el of st.exportClause.elements) {
          const local = (el.propertyName ?? el.name).text;
          if (spec) info.reexports.set(el.name.text, { spec, imported: local });
          else if (el.name.text !== local) {
            const def = info.components.get(local);
            if (def) info.components.set(el.name.text, def);
          }
        }
      }
    } else if (ts.isExportAssignment(st) && ts.isIdentifier(st.expression)) {
      info.defaultExport = st.expression.text;
    }
  }
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(sf) === "StyleSheet.create" &&
      node.arguments[0] &&
      ts.isObjectLiteralExpression(unwrap(node.arguments[0]))
    ) {
      const obj = unwrap(node.arguments[0]) as ts.ObjectLiteralExpression;
      for (const p of obj.properties) {
        if (
          ts.isPropertyAssignment(p) &&
          ts.isObjectLiteralExpression(unwrap(p.initializer)) &&
          !info.styleObjects.has(p.name.getText(sf))
        ) {
          info.styleObjects.set(
            p.name.getText(sf),
            unwrap(p.initializer) as ts.ObjectLiteralExpression,
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return info;
}

// ---------------------------------------------------------------------------
// The analyzer
// ---------------------------------------------------------------------------

class Analyzer {
  files = new Map<string, FileInfo>();
  componentByRoot = new Map<ts.Node, ComponentDef>();
  componentByKey = new Map<string, ComponentDef>();
  /** component key → identifier references across the corpus. */
  refs = new Map<string, { file: string; id: ts.Identifier }[]>();
  wrappers = new Map<string, BackingKind>();
  routes = new Map<string, string[]>();
  private suffixMemo = new Map<string, Chain[]>();
  private inProgress = new Set<string>();
  private localRoot: ts.Node | undefined;

  constructor(inputs: readonly SourceFileInput[]) {
    for (const f of inputs)
      this.files.set(f.file, buildFileInfo(f.file, f.source));
    for (const info of this.files.values()) {
      for (const def of info.components.values()) {
        this.componentByRoot.set(def.root, def);
        this.componentByKey.set(def.key, def);
      }
    }
    for (const info of this.files.values()) this.indexRefs(info);
  }

  // ---- resolution --------------------------------------------------------

  private resolveModule(fromFile: string, spec: string): string | undefined {
    let base: string;
    if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
    else if (spec.startsWith("."))
      base = posixNormalize(`${posixDirname(fromFile)}/${spec}`);
    else return undefined;
    for (const c of [
      base,
      `${base}.tsx`,
      `${base}.ts`,
      `${base}/index.tsx`,
      `${base}/index.ts`,
    ]) {
      if (this.files.has(c)) return c;
    }
    return undefined;
  }

  private resolveExport(
    file: string,
    name: string,
    depth = 0,
  ): ComponentDef | undefined {
    if (depth > 6) return undefined;
    const info = this.files.get(file);
    if (!info) return undefined;
    const local = name === "default" ? info.defaultExport : name;
    if (local) {
      const def = info.components.get(local);
      if (def) return def;
      if (name === "default") {
        const imp = info.imports.get(local);
        if (imp) {
          const t = this.resolveModule(file, imp.spec);
          if (t) return this.resolveExport(t, imp.imported, depth + 1);
        }
      }
    }
    const re = info.reexports.get(name);
    if (re) {
      const t = this.resolveModule(file, re.spec);
      if (t) return this.resolveExport(t, re.imported, depth + 1);
    }
    // A local import re-exported by name (`import { X } …; export { X }`).
    const imp = info.imports.get(name);
    if (imp && name !== "default") {
      const t = this.resolveModule(file, imp.spec);
      if (t) {
        const hit = this.resolveExport(t, imp.imported, depth + 1);
        if (hit) return hit;
      }
    }
    for (const spec of info.starExports) {
      const t = this.resolveModule(file, spec);
      if (!t) continue;
      const hit = this.resolveExport(t, name, depth + 1);
      if (hit) return hit;
    }
    return undefined;
  }

  resolveName(file: string, name: string): ComponentDef | undefined {
    const info = this.files.get(file);
    if (!info) return undefined;
    const local = info.components.get(name);
    if (local) return local;
    const imp = info.imports.get(name);
    if (!imp) return undefined;
    const t = this.resolveModule(file, imp.spec);
    return t ? this.resolveExport(t, imp.imported) : undefined;
  }

  private importSpec(file: string, name: string): string | undefined {
    return this.files.get(file)?.imports.get(name)?.spec;
  }

  private indexRefs(info: FileInfo) {
    const { sf, file } = info;
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) && isValueReference(node)) {
        const def = this.resolveName(file, node.text);
        if (def && !(def.file === file && isDeclName(node, def))) {
          const list = this.refs.get(def.key) ?? [];
          list.push({ file, id: node });
          this.refs.set(def.key, list);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  // ---- backing -----------------------------------------------------------

  private lineOf(file: string, node: ts.Node): number {
    const sf = this.files.get(file)?.sf;
    if (!sf) return 0;
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  }

  /** Palette keys an expression can resolve to (`expr:` for the unresolvable). */
  colorKeys(file: string, expr: ts.Expression, depth = 0): string[] {
    const sf = this.files.get(file)?.sf as ts.SourceFile;
    const e = unwrap(expr);
    if (depth > 5) return [`expr:${e.getText(sf)}`];
    if (ts.isPropertyAccessExpression(e)) {
      const n = e.name.text;
      if (PALETTE_KEYS.has(n)) return [n];
      return [exprToken(e.getText(sf))];
    }
    if (ts.isElementAccessExpression(e)) {
      const arg = e.argumentExpression;
      if (ts.isStringLiteral(arg) && PALETTE_KEYS.has(arg.text))
        return [arg.text];
      if (
        ts.isPropertyAccessExpression(e.expression) &&
        PALETTE_KEYS.has(e.expression.name.text)
      )
        return [e.expression.name.text];
      return [exprToken(e.getText(sf))];
    }
    if (ts.isConditionalExpression(e))
      return uniq([
        ...this.colorKeys(file, e.whenTrue, depth + 1),
        ...this.colorKeys(file, e.whenFalse, depth + 1),
      ]);
    if (ts.isBinaryExpression(e)) {
      const op = e.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken)
        return this.colorKeys(file, e.right, depth + 1);
      if (
        op === ts.SyntaxKind.BarBarToken ||
        op === ts.SyntaxKind.QuestionQuestionToken
      )
        return uniq([
          ...this.colorKeys(file, e.left, depth + 1),
          ...this.colorKeys(file, e.right, depth + 1),
        ]);
    }
    if (ts.isIdentifier(e)) {
      const init = localInitializer(e);
      if (init) return this.colorKeys(file, init, depth + 1);
      return [`expr:${e.text}`];
    }
    if (ts.isStringLiteral(e))
      return [e.text === "transparent" ? "transparent" : `literal:${e.text}`];
    return [exprToken(e.getText(sf))];
  }

  /** The solid palette key(s) a style's backgroundColor paints, if unconditional. */
  styleBackground(
    file: string,
    expr: ts.Expression,
    depth = 0,
  ): string[] | undefined {
    if (depth > 5) return undefined;
    const info = this.files.get(file) as FileInfo;
    const e = unwrap(expr);
    const body = styleFunctionBody(e);
    if (body) return this.styleBackground(file, body, depth + 1);
    if (ts.isObjectLiteralExpression(e)) {
      for (const p of e.properties) {
        if (
          ts.isPropertyAssignment(p) &&
          p.name.getText(info.sf) === "backgroundColor"
        ) {
          const keys = this.colorKeys(file, p.initializer);
          if (
            keys.length > 0 &&
            keys.every((k) => PALETTE_KEYS.has(k) && !TRANSLUCENT_KEYS.has(k))
          )
            return keys;
        } else if (ts.isSpreadAssignment(p)) {
          const r = this.styleBackground(file, p.expression, depth + 1);
          if (r) return r;
        }
      }
      return undefined;
    }
    if (ts.isArrayLiteralExpression(e)) {
      for (const el of e.elements) {
        const inner = unwrap(el as ts.Expression);
        if (ts.isBinaryExpression(inner)) continue; // conditional entry: not always painted
        const r = this.styleBackground(file, inner, depth + 1);
        if (r) return r;
      }
      return undefined;
    }
    if (ts.isConditionalExpression(e)) {
      const a = this.styleBackground(file, e.whenTrue, depth + 1);
      const b = this.styleBackground(file, e.whenFalse, depth + 1);
      return a && b ? uniq([...a, ...b]) : undefined;
    }
    if (ts.isIdentifier(e)) {
      const init = localInitializer(e);
      return init ? this.styleBackground(file, init, depth + 1) : undefined;
    }
    if (ts.isPropertyAccessExpression(e)) {
      const obj = info.styleObjects.get(e.name.text);
      return obj ? this.styleBackground(file, obj, depth + 1) : undefined;
    }
    return undefined;
  }

  backingOf(
    file: string,
    el: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
    slot: string,
  ): { kind: BackingKind; label: string } | undefined {
    const sf = this.files.get(file)?.sf as ts.SourceFile;
    const tag = tagText(el, sf);
    const at = `${tag}@${this.lineOf(file, el)}`;
    if (GLASS_TAGS.has(tag))
      return { kind: "glass", label: `backed:glass ${at}` };
    if (OPAQUE_TAGS.has(tag))
      return { kind: "opaque", label: `backed:opaque ${at}` };
    for (const styleAttr of ["style", "contentContainerStyle"]) {
      const s = attrExpr(el, styleAttr);
      if (!s) continue;
      const keys = this.styleBackground(file, s);
      if (keys) {
        const kind: BackingKind = keys.every((k) => OPAQUE_KEYS.has(k))
          ? "opaque"
          : "fill";
        return { kind, label: `backed:${kind} ${at}{bg ${keys.join("|")}}` };
      }
    }
    const def = this.resolveName(file, tag);
    if (def) {
      const w = this.wrappers.get(`${def.key}.${slot}`);
      if (w)
        return { kind: w, label: `backed:${w} ${at} via ${def.name}.${slot}` };
    }
    return undefined;
  }

  // ---- the walk ----------------------------------------------------------

  private describe(
    file: string,
    el: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
    slot?: string,
  ): string {
    const sf = this.files.get(file)?.sf as ts.SourceFile;
    const tag = tagText(el, sf);
    const style = attrExpr(el, "style");
    let hint = "";
    const tid = literalValues(attrExpr(el, "testID"));
    if (style) {
      const m = /styles\.(\w+)/.exec(style.getText(sf));
      if (m) hint = `{${m[1]}}`;
    }
    if (!hint && tid) hint = `{#${tid[0]}}`;
    return `${tag}@${this.lineOf(file, el)}${hint}${slot && slot !== "children" ? `.${slot}` : ""}`;
  }

  /** Walk from `start` (a JSX element or a reference) up to a backing, route or component root. */
  walk(file: string, start: ts.Node, visiting: Set<string>): Chain[] {
    const segs: string[] = [];
    let prev: ts.Node = start;
    let node: ts.Node | undefined = start.parent;
    let attrName: string | undefined;
    const sf = this.files.get(file)?.sf as ts.SourceFile;
    while (node) {
      if (ts.isJsxAttribute(node)) {
        attrName = node.name.getText(sf);
      } else if (
        ts.isJsxOpeningElement(node) ||
        ts.isJsxSelfClosingElement(node)
      ) {
        if (ts.isJsxAttributes(prev)) {
          const tag = tagText(node, sf);
          if (attrName === "component" && /\.Screen$/.test(tag)) {
            const name = literalValues(attrExpr(node, "name"))?.[0];
            if (name) return [this.routeChain(name, file, segs)];
          }
          const b = this.backingOf(file, node, attrName ?? "?");
          if (b)
            return [
              { terminal: "backed", backing: b.kind, note: [...segs, b.label] },
            ];
          segs.push(this.describe(file, node, attrName));
        }
        attrName = undefined;
      } else if (ts.isJsxElement(node)) {
        if (prev !== node.openingElement && prev !== node.closingElement) {
          const b = this.backingOf(file, node.openingElement, "children");
          if (b)
            return [
              { terminal: "backed", backing: b.kind, note: [...segs, b.label] },
            ];
          segs.push(this.describe(file, node.openingElement));
        }
      } else if (this.localRoot && node === this.localRoot) {
        return [{ terminal: "unmounted", note: [...segs, "⟨root⟩"] }];
      } else if (this.componentByRoot.has(node)) {
        const def = this.componentByRoot.get(node) as ComponentDef;
        // The backing primitives' own internals are backed by construction
        // (ShellAppBar paints its scrim as an absolute-fill SIBLING of its text).
        if (GLASS_TAGS.has(def.name))
          return [
            {
              terminal: "backed",
              backing: "glass",
              note: [...segs, `backed:glass inside ⟨${def.name}⟩`],
            },
          ];
        if (OPAQUE_TAGS.has(def.name))
          return [
            {
              terminal: "backed",
              backing: "opaque",
              note: [...segs, `backed:opaque inside ⟨${def.name}⟩`],
            },
          ];
        if (this.localRoot)
          return [{ terminal: "unmounted", note: [...segs, "⟨root⟩"] }];
        return this.cross(def, segs, visiting);
      } else if (isFunctionLike(node)) {
        const bound = boundName(node);
        if (bound)
          return this.followRefs(file, bound.name, bound.decl, segs, visiting);
      } else if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        prev === node.initializer
      ) {
        return this.followRefs(file, node.name.text, node, segs, visiting);
      } else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        prev === node.right &&
        ts.isIdentifier(node.left)
      ) {
        // `body = (<JSX/>)`: follow the reads of the assigned local.
        return this.followRefs(file, node.left.text, node, segs, visiting);
      } else if (
        (ts.isPropertyAssignment(node) ||
          ts.isShorthandPropertyAssignment(node)) &&
        ts.isObjectLiteralExpression(node.parent) &&
        isRouteRegistry(node.parent, sf)
      ) {
        return [this.routeChain(node.name.getText(sf), file, segs)];
      } else if (
        ts.isCallExpression(node) &&
        prev !== node.expression &&
        node.arguments.some((a) => a === prev)
      ) {
        // JSX handed to a same-file render helper (`card(lane, <Body/>)`):
        // backed if the helper renders that parameter inside a backing.
        const index = node.arguments.findIndex((a) => a === prev);
        const helper = this.helperBacking(file, node, index, visiting);
        if (helper)
          return [
            {
              terminal: "backed",
              backing: helper.kind,
              note: [...segs, helper.label],
            },
          ];
      } else if (
        (ts.isPropertyAssignment(node) ||
          ts.isShorthandPropertyAssignment(node)) &&
        ts.isObjectLiteralExpression(node.parent) &&
        isCallArgument(node.parent)
      ) {
        // JSX handed to a call inside an object (a store or portal request,
        // e.g. `panelStore.open({ content: <Panel/> })`): the real host is
        // elsewhere and is not traced. Flag it for hand review.
        const call = callOf(node.parent) as ts.CallExpression;
        segs.push(
          `hosted:${call.expression.getText(sf).replace(/\s+/g, "")}.${node.name.getText(sf)}@${this.lineOf(file, node)}(UNTRACED HOST)`,
        );
      } else if (ts.isSourceFile(node)) {
        return [{ terminal: "unmounted", note: [...segs, "⟨module⟩"] }];
      }
      prev = node;
      node = node.parent;
    }
    return [{ terminal: "unmounted", note: segs }];
  }

  /** Does the same-file helper `callee(…)` render argument `index` inside a backing? */
  private helperBacking(
    file: string,
    call: ts.CallExpression,
    index: number,
    visiting: Set<string>,
  ): { kind: BackingKind; label: string } | undefined {
    if (!ts.isIdentifier(call.expression) || index < 0) return undefined;
    const name = call.expression.text;
    const fn = findLocalFunction(call, name);
    if (!fn?.body) return undefined;
    const param = fn.parameters[index];
    if (!param || !ts.isIdentifier(param.name)) return undefined;
    const paramName = param.name.text;
    const usages: ts.Identifier[] = [];
    const visit = (n: ts.Node) => {
      if (
        ts.isIdentifier(n) &&
        n.text === paramName &&
        n !== param.name &&
        isValueReference(n) &&
        isRenderedPosition(n)
      )
        usages.push(n);
      ts.forEachChild(n, visit);
    };
    visit(fn.body);
    if (usages.length === 0) return undefined;
    const saved = this.localRoot;
    this.localRoot = fn;
    const chains = usages.flatMap((u) => this.walk(file, u, visiting));
    this.localRoot = saved;
    if (chains.length === 0 || !chains.every((c) => c.terminal === "backed"))
      return undefined;
    const kind = chains[0].backing as BackingKind;
    return {
      kind,
      label: `backed:${kind} via helper ${name}(arg ${index})@${this.lineOf(file, fn)} [${chains[0].note[chains[0].note.length - 1]}]`,
    };
  }

  private routeChain(name: string, file: string, segs: string[]): Chain {
    const regs = this.routes.get(name) ?? [];
    if (!regs.includes(file)) regs.push(file);
    this.routes.set(name, regs);
    if (NO_ART_ROUTES.has(name))
      return {
        terminal: "backed",
        backing: "no-art",
        route: name,
        routeFile: file,
        note: [...segs, `route:${name}@${file} (no art)`],
      };
    return {
      terminal: "route",
      route: name,
      routeFile: file,
      note: [...segs, `route:${name}@${file}`],
    };
  }

  private followRefs(
    file: string,
    name: string,
    decl: ts.Node,
    segs: string[],
    visiting: Set<string>,
  ): Chain[] {
    const key = `${file}:${name}:${decl.pos}`;
    if (visiting.has(key))
      return [{ terminal: "cycle", note: [...segs, `cycle ${name}`] }];
    const scope = enclosingScope(decl);
    const refs: ts.Identifier[] = [];
    const visit = (n: ts.Node) => {
      if (
        ts.isIdentifier(n) &&
        n.text === name &&
        isValueReference(n) &&
        !isAssignmentTarget(n) &&
        !inHookDeps(n)
      )
        refs.push(n);
      ts.forEachChild(n, visit);
    };
    visit(scope);
    if (refs.length === 0)
      return [{ terminal: "unmounted", note: [...segs, `unused ${name}`] }];
    const next = new Set(visiting);
    next.add(key);
    const out: Chain[] = [];
    for (const r of refs) {
      const start = jsxStartOf(r);
      for (const c of this.walk(file, start, next))
        out.push({
          ...c,
          note: [...segs, `{${name}}@${this.lineOf(file, r)}`, ...c.note],
        });
    }
    return out;
  }

  private cross(
    def: ComponentDef,
    segs: string[],
    visiting: Set<string>,
  ): Chain[] {
    if (visiting.has(def.key))
      return [{ terminal: "cycle", note: [...segs, `cycle ⟨${def.name}⟩`] }];
    const suffix = this.suffix(def, visiting);
    return suffix.map((c) => ({
      ...c,
      note: [...segs, `⟨${def.name}⟩`, ...c.note],
    }));
  }

  /** Every chain from a component's render sites upward (memoized). */
  private suffix(def: ComponentDef, visiting: Set<string>): Chain[] {
    const memo = this.suffixMemo.get(def.key);
    if (memo) return memo;
    if (this.inProgress.has(def.key)) return [];
    this.inProgress.add(def.key);
    const next = new Set(visiting);
    next.add(def.key);
    const out: Chain[] = [];
    const seen = new Set<string>();
    for (const { file, id } of this.refs.get(def.key) ?? []) {
      const start = jsxStartOf(id);
      const isTag = start !== id;
      for (const c of this.walk(file, start, next)) {
        const chain: Chain = {
          ...c,
          note: [
            isTag
              ? `<${id.text}>@${file}:${this.lineOf(file, id)}`
              : `${id.text}@${file}:${this.lineOf(file, id)}`,
            ...c.note,
          ],
        };
        const k = `${chain.terminal}|${chain.route}|${chain.backing}|${chain.note.join("<")}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(chain);
      }
    }
    if (out.length === 0)
      out.push({ terminal: "unmounted", note: ["(no render site)"] });
    this.inProgress.delete(def.key);
    this.suffixMemo.set(def.key, out);
    return out;
  }

  // ---- wrapper discovery ---------------------------------------------------

  discoverWrappers() {
    for (let pass = 0; pass < 8; pass++) {
      let changed = false;
      for (const def of this.componentByKey.values()) {
        if (!def.fn) continue;
        for (const [slot, usages] of slotUsages(def.fn)) {
          if (usages.length === 0) continue;
          this.localRoot = def.fn;
          const chains = usages.flatMap((u) =>
            this.walk(def.file, jsxStartOf(u), new Set()),
          );
          this.localRoot = undefined;
          const backed =
            chains.length > 0 && chains.every((c) => c.terminal === "backed");
          const k = `${def.key}.${slot}`;
          const kind = backed ? (chains[0].backing as BackingKind) : undefined;
          if (kind && this.wrappers.get(k) !== kind) {
            this.wrappers.set(k, kind);
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
  }

  // ---- foregrounds -------------------------------------------------------

  collectSites(): ForegroundSite[] {
    const sites: ForegroundSite[] = [];
    for (const info of this.files.values()) {
      const { file, sf } = info;
      if (!file.endsWith(".tsx")) continue;
      if (
        !file.startsWith("src/screens/") &&
        !file.startsWith("src/components/")
      )
        continue;
      if (PRIMITIVE_FILES.has(file)) continue;
      if (file.includes("/__dev__/")) continue;
      if (
        file.startsWith("src/components/orrery/") &&
        [...info.imports.values()].some((i) =>
          i.spec.includes("react-native-skia"),
        )
      )
        continue;
      const visit = (node: ts.Node) => {
        if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
          const fg = this.foreground(file, node);
          if (fg) {
            const start = ts.isJsxOpeningElement(node) ? node.parent : node;
            const own = attrExpr(node, "style");
            const ownFill = own ? this.styleBackground(file, own) : undefined;
            const chains: Chain[] = fg.selfFilled
              ? [
                  {
                    terminal: "backed",
                    backing: "self-filled",
                    note: ["TextInput (self-filled)"],
                  },
                ]
              : ownFill
                ? [
                    {
                      terminal: "backed",
                      backing: "fill",
                      note: [`own backgroundColor ${ownFill.join("|")}`],
                    },
                  ]
                : this.walk(file, start, new Set());
            sites.push(this.makeSite(file, node, fg, chains));
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    return sites;
  }

  private makeSite(
    file: string,
    el: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
    fg: Foreground,
    chains: Chain[],
  ): ForegroundSite {
    const bareChains = chains.filter((c) => c.terminal === "route");
    const backedChains = chains.filter((c) => c.terminal === "backed");
    const backingKinds = uniq(
      backedChains.map((c) => c.backing as BackingKind),
    );
    let classification: SiteClassification;
    if (bareChains.length > 0 && backedChains.length > 0)
      classification = "mixed";
    else if (bareChains.length > 0) classification = "bare";
    else if (backedChains.length > 0) classification = "backed";
    else classification = "unmounted";
    return {
      file,
      line: this.lineOf(file, el),
      component: enclosingComponentName(el, this.componentByRoot),
      element: fg.element,
      token: fg.token,
      roleSize: fg.roleSize,
      floor: fg.floor,
      classification,
      backingKinds,
      bareRoutes: uniq(bareChains.map((c) => c.route as string)).filter(
        (r) => !DEV_ROUTES.has(r),
      ),
      chains,
    };
  }

  /** Style `color` keys: `definite` when an unconditional entry sets it. */
  styleProp(
    file: string,
    expr: ts.Expression,
    prop: string,
    depth = 0,
  ): { values: ts.Expression[]; definite: boolean } {
    const info = this.files.get(file) as FileInfo;
    const none = { values: [] as ts.Expression[], definite: false };
    if (depth > 5) return none;
    const e = unwrap(expr);
    const body = styleFunctionBody(e);
    if (body) return this.styleProp(file, body, prop, depth + 1);
    if (ts.isObjectLiteralExpression(e)) {
      let out = none;
      for (const p of e.properties) {
        if (ts.isPropertyAssignment(p) && p.name.getText(info.sf) === prop)
          out = { values: [p.initializer], definite: true };
        else if (ts.isShorthandPropertyAssignment(p) && p.name.text === prop)
          out = { values: [p.name], definite: true };
        else if (ts.isSpreadAssignment(p)) {
          const r = this.styleProp(file, p.expression, prop, depth + 1);
          if (r.definite) out = r;
          else if (r.values.length)
            out = {
              values: [...out.values, ...r.values],
              definite: out.definite,
            };
        }
      }
      return out;
    }
    if (ts.isArrayLiteralExpression(e)) {
      let out = none;
      for (const el of e.elements) {
        const inner = unwrap(el as ts.Expression);
        if (
          ts.isBinaryExpression(inner) &&
          inner.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        ) {
          const r = this.styleProp(file, inner.right, prop, depth + 1);
          if (r.values.length)
            out = {
              values: [...out.values, ...r.values],
              definite: out.definite,
            };
          continue;
        }
        const r = this.styleProp(file, inner, prop, depth + 1);
        if (r.definite) out = r;
        else if (r.values.length)
          out = {
            values: [...out.values, ...r.values],
            definite: out.definite,
          };
      }
      return out;
    }
    if (ts.isConditionalExpression(e)) {
      const a = this.styleProp(file, e.whenTrue, prop, depth + 1);
      const b = this.styleProp(file, e.whenFalse, prop, depth + 1);
      return {
        values: [...a.values, ...b.values],
        definite: a.definite && b.definite,
      };
    }
    if (ts.isIdentifier(e)) {
      const init = localInitializer(e);
      return init ? this.styleProp(file, init, prop, depth + 1) : none;
    }
    if (ts.isPropertyAccessExpression(e)) {
      const obj = info.styleObjects.get(e.name.text);
      return obj ? this.styleProp(file, obj, prop, depth + 1) : none;
    }
    return none;
  }

  private foreground(
    file: string,
    el: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  ): Foreground | undefined {
    const sf = this.files.get(file)?.sf as ts.SourceFile;
    const tag = tagText(el, sf);
    const rnSpec = this.importSpec(file, tag);
    const style = attrExpr(el, "style");
    const colorFromStyle = (fallback: string | undefined): string => {
      const r = style
        ? this.styleProp(file, style, "color")
        : { values: [], definite: false };
      const keys = uniq(r.values.flatMap((v) => this.colorKeys(file, v)));
      const all = r.definite
        ? keys
        : uniq([...(fallback ? [fallback] : []), ...keys]);
      return all.length ? all.join("|") : "unset";
    };
    const numberOf = (prop: string): string | undefined => {
      if (!style) return undefined;
      const r = this.styleProp(file, style, prop);
      const v = r.values[r.values.length - 1];
      if (!v) return undefined;
      const u = unwrap(v);
      if (ts.isNumericLiteral(u)) return u.text;
      if (ts.isStringLiteral(u)) return `"${u.text}"`;
      return undefined;
    };
    if (tag === "AppText") {
      const roleLit = literalValues(attrExpr(el, "role"));
      const role = (roleLit?.[0] ?? (attr(el, "role") ? undefined : "body")) as
        | TypographyRole
        | undefined;
      const t = role ? TYPOGRAPHY[role] : undefined;
      const sizeOverride = numberOf("fontSize");
      const size = sizeOverride ? Number(sizeOverride) : t?.size;
      const weight = t?.weight;
      const token = colorFromStyle(
        t ? `${t.colorToken}(default)` : "textPrimary(default)",
      );
      return {
        element: "AppText",
        token,
        roleSize: t ? `${role} ${size}/${weight}` : "AppText ?",
        floor: textFloor(size, weight),
      };
    }
    if (tag === "Text" && (rnSpec === "react-native" || rnSpec === undefined)) {
      const size = numberOf("fontSize");
      const weight = numberOf("fontWeight");
      const sizeNum = size ? Number(size) : undefined;
      const weightNum = weight
        ? Number(weight.replace(/"/g, "")) ||
          (weight.includes("bold") ? 700 : undefined)
        : undefined;
      return {
        element: "Text",
        token: colorFromStyle(undefined),
        roleSize: `Text ${size ?? "?"}${weight ? `/${weight}` : ""}`,
        floor: textFloor(sizeNum, weightNum),
      };
    }
    if (tag === "TextInput") {
      return {
        element: "TextInput",
        token: "n/a",
        roleSize: "TextInput",
        floor: "4.5",
        selfFilled: true,
      };
    }
    if (tag === "Icon") {
      const tone = attrExpr(el, "tone");
      const token = tone
        ? this.toneKeys(file, tone).join("|")
        : "textPrimary(default)";
      const sz = (literalValues(attrExpr(el, "size"))?.[0] ??
        "md") as IconSizeToken;
      return {
        element: "Icon",
        token,
        roleSize: `icon ${ICON_SIZE[sz] ?? "?"}`,
        floor: "3.0",
      };
    }
    if (
      tag === "Ionicons" ||
      (tag === "ActivityIndicator" &&
        (rnSpec === "react-native" || rnSpec === undefined))
    ) {
      const c = attrExpr(el, "color");
      const token = c
        ? uniq(this.colorKeys(file, c)).join("|")
        : "platform-default";
      const size = attrExpr(el, "size");
      return {
        element: tag,
        token,
        roleSize:
          tag === "Ionicons"
            ? `icon ${size ? size.getText(sf) : "?"}`
            : "ActivityIndicator ",
        floor: "3.0",
      };
    }
    if (tag === "StatusGlyph") {
      return {
        element: "StatusGlyph",
        token: "status",
        roleSize: "icon",
        floor: "3.0",
      };
    }
    if (tag === "Button" && rnSpec !== "react-native") {
      const roles = literalValues(attrExpr(el, "role")) ?? [];
      if (roles.includes("tertiary"))
        return {
          element: "Button-link",
          token: "accentText",
          roleSize: "label 14/600",
          floor: "4.5",
        };
      if (roles.includes("iconOnly"))
        return {
          element: "Button-icon",
          token: "textPrimary",
          roleSize: `icon ${ICON_SIZE.md}`,
          floor: "3.0",
        };
      return undefined;
    }
    return undefined;
  }

  private toneKeys(file: string, expr: ts.Expression, depth = 0): string[] {
    const sf = this.files.get(file)?.sf as ts.SourceFile;
    const e = unwrap(expr);
    if (ts.isStringLiteral(e)) return [e.text];
    if (ts.isConditionalExpression(e) && depth < 5)
      return uniq([
        ...this.toneKeys(file, e.whenTrue, depth + 1),
        ...this.toneKeys(file, e.whenFalse, depth + 1),
      ]);
    if (ts.isIdentifier(e) && depth < 5) {
      const init = localInitializer(e);
      if (init) return this.toneKeys(file, init, depth + 1);
    }
    return [exprToken(e.getText(sf))];
  }

  rows(sites: ForegroundSite[]): BareTextRow[] {
    const rows: BareTextRow[] = [];
    for (const s of sites) {
      if (s.classification !== "bare" && s.classification !== "mixed") continue;
      const notes = uniq(
        s.chains
          .filter((c) => c.terminal === "route" || c.terminal === "backed")
          .map((c) => c.note.join(" < ")),
      );
      const shown = notes.slice(0, MAX_NOTE_CHAINS);
      const note =
        shown.join(" || ") +
        (notes.length > shown.length
          ? ` || (+${notes.length - shown.length} more chains)`
          : "");
      for (const route of s.bareRoutes) {
        rows.push({
          route,
          fileLine: `${s.file}:${s.line}`,
          component: s.component,
          element: s.element,
          token: s.token,
          roleSize: s.roleSize,
          floor: s.floor,
          xBand: LAYOUT_NA,
          alignment: LAYOUT_NA,
          verticalPosition: LAYOUT_NA,
          density: densityLabel(route),
          verification: DEFAULT_VERIFICATION,
          parentChainNote: note,
          bareKind: s.classification,
        });
      }
    }
    rows.sort(
      (a, b) =>
        a.route.localeCompare(b.route) ||
        compareFileLine(a.fileLine, b.fileLine),
    );
    return rows;
  }
}

interface Foreground {
  element: string;
  token: string;
  roleSize: string;
  floor: string;
  selfFilled?: boolean;
}

function callOf(
  obj: ts.ObjectLiteralExpression,
): ts.CallExpression | undefined {
  let p: ts.Node = obj.parent;
  while (ts.isParenthesizedExpression(p) || ts.isAsExpression(p)) p = p.parent;
  return ts.isCallExpression(p) && p.arguments.some((a) => unwrap(a) === obj)
    ? p
    : undefined;
}

function isCallArgument(obj: ts.ObjectLiteralExpression): boolean {
  return callOf(obj) !== undefined;
}

/** The function bound to `name` that is visible from `from` (lexical walk). */
function findLocalFunction(
  from: ts.Node,
  name: string,
): FunctionLike | undefined {
  let n: ts.Node | undefined = from.parent;
  while (n) {
    const statements: readonly ts.Statement[] | undefined =
      ts.isBlock(n) || ts.isSourceFile(n) ? n.statements : undefined;
    if (statements) {
      for (const st of statements) {
        if (ts.isFunctionDeclaration(st) && st.name?.text === name) return st;
        if (ts.isVariableStatement(st)) {
          for (const d of st.declarationList.declarations) {
            if (
              !ts.isIdentifier(d.name) ||
              d.name.text !== name ||
              !d.initializer
            )
              continue;
            const init = unwrap(d.initializer);
            if (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
              return init;
          }
        }
      }
    }
    n = n.parent;
  }
  return undefined;
}

/** An object literal bound (through `as const` / `satisfies`) to a `*ROUTE_COMPONENTS` const. */
function isRouteRegistry(
  obj: ts.ObjectLiteralExpression,
  sf: ts.SourceFile,
): boolean {
  let p: ts.Node = obj.parent;
  while (
    ts.isAsExpression(p) ||
    ts.isSatisfiesExpression(p) ||
    ts.isParenthesizedExpression(p)
  )
    p = p.parent;
  return (
    ts.isVariableDeclaration(p) && /ROUTE_COMPONENTS$/.test(p.name.getText(sf))
  );
}

/** A `Pressable` style callback's returned style (`({ pressed }) => [...]`). */
function styleFunctionBody(e: ts.Expression): ts.Expression | undefined {
  if (!ts.isArrowFunction(e) && !ts.isFunctionExpression(e)) return undefined;
  if (!ts.isBlock(e.body)) return e.body;
  let ret: ts.Expression | undefined;
  const visit = (n: ts.Node) => {
    if (ret) return;
    if (ts.isReturnStatement(n) && n.expression) ret = n.expression;
    else if (!isFunctionLike(n)) ts.forEachChild(n, visit);
  };
  ts.forEachChild(e.body, visit);
  return ret;
}

function compareFileLine(a: string, b: string): number {
  const [fa, la] = splitFileLine(a);
  const [fb, lb] = splitFileLine(b);
  return fa.localeCompare(fb) || la - lb;
}

export function splitFileLine(fl: string): [string, number] {
  const i = fl.lastIndexOf(":");
  return [fl.slice(0, i), Number(fl.slice(i + 1))];
}

function exprToken(text: string): string {
  const compact = text.replace(/\s+/g, " ");
  const m = /\.(\w+)\b/.exec(compact);
  const keys = [...compact.matchAll(/\.(\w+)/g)]
    .map((x) => x[1])
    .filter((k) => PALETTE_KEYS.has(k));
  if (keys.length) return `expr:${uniq(keys).join("|")}`;
  return `expr:${m ? compact.slice(0, 40) : compact.slice(0, 40)}`;
}

/** WCAG floor for text: large (>= 24, or >= 18.66 bold) is 3.0; 20sp semibold kept at 4.5 ("4.5*"). */
export function textFloor(
  size: number | undefined,
  weight: number | undefined,
): string {
  if (size === undefined) return "4.5";
  if (size >= 24) return "3.0";
  if (size >= 18.66 && (weight ?? 400) >= 700) return "3.0";
  if (size >= 18.66 && (weight ?? 400) >= 600) return "4.5*";
  return "4.5";
}

export function densityLabel(route: string): string {
  if (route === "Profile") return PROFILE_DENSITY;
  const d = densityForRoute(route);
  return `${d} (veil galaxy ${BACKGROUND_VEIL_OPACITY.galaxy[d]} / standard ${BACKGROUND_VEIL_OPACITY.standard[d]})`;
}

/** True for an identifier used as a value (not a declaration, property name, import, type). */
function isValueReference(id: ts.Identifier): boolean {
  const p = id.parent;
  if (!p) return false;
  if (
    ts.isImportSpecifier(p) ||
    ts.isImportClause(p) ||
    ts.isNamespaceImport(p) ||
    ts.isExportSpecifier(p)
  )
    return false;
  if (ts.isExportAssignment(p)) return false;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
  if (ts.isPropertyAssignment(p) && p.name === id) return false;
  if (ts.isJsxAttribute(p)) return false;
  if (ts.isJsxClosingElement(p)) return false;
  if (
    ts.isTypeReferenceNode(p) ||
    ts.isTypeQueryNode(p) ||
    ts.isQualifiedName(p) ||
    ts.isExpressionWithTypeArguments(p)
  )
    return false;
  if (ts.isBindingElement(p) && p.propertyName === id) return false;
  if (
    ts.isMethodDeclaration(p) ||
    ts.isPropertySignature(p) ||
    ts.isPropertyDeclaration(p)
  )
    return false;
  if (ts.isTypeAliasDeclaration(p) || ts.isInterfaceDeclaration(p))
    return false;
  if (
    (ts.isVariableDeclaration(p) ||
      ts.isFunctionDeclaration(p) ||
      ts.isParameter(p) ||
      ts.isBindingElement(p) ||
      ts.isClassDeclaration(p)) &&
    p.name === id
  )
    return false;
  if (ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p))
    return false;
  return true;
}

function isDeclName(id: ts.Identifier, def: ComponentDef | undefined): boolean {
  const p = id.parent;
  if (def && (p === def.root || (ts.isVariableDeclaration(p) && p.name === id)))
    return true;
  return !isValueReference(id);
}

function isAssignmentTarget(id: ts.Identifier): boolean {
  const p = id.parent;
  return (
    ts.isBinaryExpression(p) &&
    p.left === id &&
    p.operatorToken.kind === ts.SyntaxKind.EqualsToken
  );
}

function inHookDeps(id: ts.Identifier): boolean {
  const p = id.parent;
  if (!ts.isArrayLiteralExpression(p)) return false;
  const call = p.parent;
  return (
    ts.isCallExpression(call) &&
    call.arguments.indexOf(p) > 0 &&
    HOOKS_WITH_DEPS.has(call.expression.getText().replace(/^React\./, ""))
  );
}

/** The walk start for a reference: the JSX element for a tag name, else the identifier. */
function jsxStartOf(id: ts.Identifier): ts.Node {
  const p = id.parent;
  if (
    (ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p)) &&
    p.tagName === id
  )
    return ts.isJsxOpeningElement(p) ? p.parent : p;
  return id;
}

/** The name a non-component function is bound to (declaration, `const x = …`, `useCallback`). */
function boundName(
  fn: FunctionLike,
): { name: string; decl: ts.Node } | undefined {
  if (ts.isFunctionDeclaration(fn) && fn.name)
    return { name: fn.name.text, decl: fn };
  let p: ts.Node = fn.parent;
  while (ts.isParenthesizedExpression(p) || ts.isAsExpression(p)) p = p.parent;
  if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name))
    return { name: p.name.text, decl: p };
  if (
    ts.isCallExpression(p) &&
    /^(React\.)?(useCallback|useMemo)$/.test(p.expression.getText()) &&
    ts.isVariableDeclaration(p.parent) &&
    ts.isIdentifier(p.parent.name)
  ) {
    // useMemo(() => <JSX/>) binds the RESULT; useCallback binds the function.
    return { name: p.parent.name.text, decl: p.parent };
  }
  return undefined;
}

/** The block or function body (or file) a declaration's name is visible in. */
function enclosingScope(decl: ts.Node): ts.Node {
  let n: ts.Node | undefined = decl.parent;
  while (n) {
    if (isFunctionLike(n) || ts.isSourceFile(n)) return n;
    n = n.parent;
  }
  return decl.getSourceFile();
}

/** A local `const x = <init>` visible from `id`, found by a lexical walk. */
function localInitializer(id: ts.Identifier): ts.Expression | undefined {
  let n: ts.Node | undefined = id.parent;
  while (n) {
    const statements: readonly ts.Statement[] | undefined =
      ts.isBlock(n) || ts.isSourceFile(n) ? n.statements : undefined;
    if (statements) {
      for (const st of statements) {
        if (!ts.isVariableStatement(st)) continue;
        for (const d of st.declarationList.declarations) {
          if (
            ts.isIdentifier(d.name) &&
            d.name.text === id.text &&
            d.initializer &&
            !d.initializer.getText().includes("=>")
          )
            return d.initializer;
        }
      }
    }
    n = n.parent;
  }
  return undefined;
}

function enclosingComponentName(
  node: ts.Node,
  byRoot: Map<ts.Node, ComponentDef>,
): string {
  let n: ts.Node | undefined = node.parent;
  let topLevel: string | undefined;
  while (n) {
    const def = byRoot.get(n);
    if (def) return def.name;
    if (isFunctionLike(n)) {
      const b = boundName(n);
      if (
        b &&
        (ts.isSourceFile(b.decl.parent) ||
          ts.isSourceFile(b.decl.parent?.parent?.parent))
      )
        topLevel = b.name;
    }
    n = n.parent;
  }
  return topLevel ?? "(module)";
}

/** Rendered uses of a component's props: slot name → reference identifiers. */
function slotUsages(fn: FunctionLike): Map<string, ts.Identifier[]> {
  const out = new Map<string, ts.Identifier[]>();
  const param = fn.parameters[0];
  if (!param || !fn.body) return out;
  const bindings = new Map<string, string>(); // local name → slot
  let propsName: string | undefined;
  if (ts.isObjectBindingPattern(param.name)) {
    for (const el of param.name.elements) {
      if (!ts.isIdentifier(el.name)) continue;
      bindings.set(
        el.name.text,
        el.propertyName ? el.propertyName.getText() : el.name.text,
      );
    }
  } else if (ts.isIdentifier(param.name)) {
    propsName = param.name.text;
  }
  const visit = (n: ts.Node) => {
    if (
      ts.isIdentifier(n) &&
      isValueReference(n) &&
      bindings.has(n.text) &&
      isRenderedPosition(n)
    ) {
      const slot = bindings.get(n.text) as string;
      out.set(slot, [...(out.get(slot) ?? []), n]);
    }
    if (
      propsName &&
      ts.isPropertyAccessExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === propsName &&
      ts.isIdentifier(n.name) &&
      isRenderedPosition(n)
    ) {
      const slot = n.name.text;
      out.set(slot, [...(out.get(slot) ?? []), n.name]);
    }
    ts.forEachChild(n, visit);
  };
  visit(fn.body);
  return out;
}

function isRenderedPosition(node: ts.Node): boolean {
  let n: ts.Node =
    ts.isIdentifier(node) &&
    ts.isPropertyAccessExpression(node.parent) &&
    node.parent.name === node
      ? node.parent
      : node;
  for (;;) {
    const p = n.parent;
    if (!p) return false;
    if (
      ts.isParenthesizedExpression(p) ||
      ts.isAsExpression(p) ||
      ts.isNonNullExpression(p)
    ) {
      n = p;
      continue;
    }
    if (ts.isConditionalExpression(p) && p.condition !== n) {
      n = p;
      continue;
    }
    if (
      ts.isBinaryExpression(p) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(p.operatorToken.kind)
    ) {
      if (
        p.right === n ||
        p.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken
      ) {
        n = p;
        continue;
      }
      return false;
    }
    return (
      ts.isJsxExpression(p) ||
      ts.isReturnStatement(p) ||
      (ts.isArrowFunction(p) && p.body === n)
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify every foreground under `src/screens` and `src/components` among
 * `files` (repo-relative paths; include `src/navigation` for the route
 * registrations and every `.ts` barrel the imports pass through).
 */
export function classifyBareTextSites(
  files: readonly SourceFileInput[],
): BareTextAnalysis {
  const a = new Analyzer(files);
  a.discoverWrappers();
  const sites = a.collectSites();
  sites.sort((x, y) => x.file.localeCompare(y.file) || x.line - y.line);
  return { sites, rows: a.rows(sites), routes: a.routes, wrappers: a.wrappers };
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Serialize rows in the brief's 14 columns. */
export function rowsToCsv(rows: readonly BareTextRow[]): string {
  const lines = [BARE_TEXT_CSV_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.route,
        r.fileLine,
        r.component,
        r.element,
        r.token,
        r.roleSize,
        r.floor,
        r.xBand,
        r.alignment,
        r.verticalPosition,
        r.density,
        r.verification,
        r.parentChainNote,
        r.bareKind,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

/** Minimal RFC-4180 CSV parser (quoted cells, doubled quotes, embedded commas). */
export function parseCsv(text: string): Record<string, string>[] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      records.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    records.push(row);
  }
  const [header, ...body] = records;
  return body
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}
