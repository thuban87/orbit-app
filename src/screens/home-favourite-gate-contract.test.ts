/**
 * HomeScreen favourite gate contract (38.13 D-59, ADR-233; review R2-04, R5-01).
 *
 * Every Contacts star tap (the List row star, the Card star and the card
 * menu's Favorite) goes through ONE `onFavouriteTap`, which looks the row up by
 * id in `rowsByIdRef` and switches on `favouriteTapOutcome`: a Bound row
 * toggles, an Unbound row explains, an unknown id writes nothing.
 *
 * `toggleFavourite` and `onFavouriteTap` keep one identity across Population,
 * Filters, Sort and search changes: `toggleFavourite` requests its read through
 * the once-created scheduler, so neither deps list names `reload`, `query`,
 * `debouncedSearchText` or `rows` (38.13-08 passes `onFavouriteTap` to its
 * memoised rows; D-55 F1).
 *
 * Textual / AST, as the other HomeScreen contracts are (HomeScreen is too large
 * to render in the node test environment).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/screens/HomeScreen.tsx"),
  "utf8",
);
const file = ts.createSourceFile(
  "HomeScreen.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

/** The `useCallback(fn, [deps])` initialiser of `const <name> = …`. */
function callbackInitialiserOf(name: string): ts.CallExpression {
  let found: ts.CallExpression | null = null;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "useCallback"
    ) {
      found = node.initializer;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (found === null) {
    throw new Error(`HomeScreen \`${name} = useCallback(…)\` not found`);
  }
  return found;
}

function depsOf(name: string): string[] {
  const deps = callbackInitialiserOf(name).arguments[1];
  if (!deps || !ts.isArrayLiteralExpression(deps)) {
    throw new Error(`\`${name}\` has no dependency array`);
  }
  return deps.elements.map((element) => element.getText(file));
}

function bodyOf(name: string): string {
  return callbackInitialiserOf(name).arguments[0]?.getText(file) ?? "";
}

/** Every `toggleFavourite(` call site, as the name of its enclosing callback. */
function toggleFavouriteCallers(): string[] {
  const callers: string[] = [];
  const visit = (node: ts.Node, enclosing: string | null): void => {
    let next = enclosing;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "useCallback"
    ) {
      next = node.name.text;
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "toggleFavourite"
    ) {
      callers.push(next ?? "<render>");
    }
    ts.forEachChild(node, (child) => visit(child, next));
  };
  visit(file, null);
  return callers;
}

describe("HomeScreen star taps go through one gate (ADR-233; review R2-04)", () => {
  it("onFavouriteTap reads the row from rowsByIdRef and switches on favouriteTapOutcome", () => {
    const body = bodyOf("onFavouriteTap");
    expect(body).toContain("rowsByIdRef.current.get(contactId)");
    expect(body).toContain("favouriteTapOutcome(row)");
    expect(body).toContain("unboundStarExplanation(row.name)");
    expect(body).toContain("toggleFavourite(contactId, nextMembership)");
  });

  it("rowsByIdRef is built from the published rows", () => {
    expect(source).toMatch(
      /const rowsByIdRef = useRef\(new Map<number, DashboardRow>\(\)\);/,
    );
    expect(source).toMatch(
      /rowsByIdRef\.current = useMemo\(\s*\(\) => new Map\(rows\.map\(\(row\) => \[row\.id, row\]\)\),\s*\[rows\],\s*\);/,
    );
  });

  it("the List star, the CardGrid star and the card-menu star all call onFavouriteTap", () => {
    // 38.13-08: the memoised List row host flips what it renders and calls
    // the gate it receives as `onFavouriteTap={onFavouriteTap}`.
    expect(source).toContain("onFavouriteTap(contactId, !isFavourite);");
    expect(source).toContain("onFavouriteTap={onFavouriteTap}");
    expect(source).toContain("onToggleFavourite={onFavouriteTap}");
    expect(source).toContain(
      "onFavouriteTap(contextMenuContact.id, !contextMenuIsFavourite);",
    );
    expect(source).not.toContain("onToggleFavourite={toggleFavourite}");
  });

  it("toggleFavourite is called only by onFavouriteTap and its own Retry", () => {
    expect(toggleFavouriteCallers().sort()).toEqual(
      ["onFavouriteTap", "toggleFavourite"].sort(),
    );
  });

  it("the card menu receives the Unbound flag of its contact", () => {
    expect(source).toMatch(
      /unbound=\{\s*contextMenuContact !== null && isUnboundRow\(contextMenuContact\)\s*\}/,
    );
    expect(source).toContain("unbound={isUnboundRow(item)}");
  });
});

describe("favourite callbacks are query-independent (D-55 F1; review R5-01)", () => {
  const forbidden = ["reload", "query", "debouncedSearchText", "rows"];

  it("toggleFavourite's deps are exactly [favouriteStore, scheduler]", () => {
    expect(depsOf("toggleFavourite")).toEqual(["favouriteStore", "scheduler"]);
  });

  it("toggleFavourite requests its read through the scheduler, never reload", () => {
    const body = bodyOf("toggleFavourite");
    expect(body).toContain('scheduler.request("favourite")');
    expect(body).not.toMatch(/\breload\(/);
  });

  it("onFavouriteTap's deps are exactly [toggleFavourite]", () => {
    expect(depsOf("onFavouriteTap")).toEqual(["toggleFavourite"]);
  });

  it("neither deps list names reload, query, debouncedSearchText or rows", () => {
    for (const name of ["toggleFavourite", "onFavouriteTap"]) {
      const deps = depsOf(name);
      for (const word of forbidden) expect(deps).not.toContain(word);
    }
  });

  it("scheduler is the once-created schedulerRef value and favouriteStore comes from useState", () => {
    expect(source).toContain("const scheduler = schedulerRef.current;");
    expect(source).toMatch(/if \(schedulerRef\.current === null\) \{/);
    expect(source).toContain(
      "const [favouriteStore] = useState(createFavouriteOptimisticStore);",
    );
  });
});
