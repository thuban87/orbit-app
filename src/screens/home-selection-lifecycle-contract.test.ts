/**
 * HomeScreen Card-view selection contract (38.13 D-72, D-76, D-77, D-40;
 * ADR-102, ADR-233; reviews R1-03, R1-04, R3-01, R4-01, R5-02).
 *
 * - The selection universe is built by `selectionUniverseIds` in both entry
 *   paths (D-77, one constant).
 * - The bar's Bound/favourite flags live in React state (`selectionLifecycle`)
 *   so every replacement re-renders the bar (R4-01). They are refreshed from
 *   the database after each bulk outcome and on each Home publish while
 *   selecting, and a refresh result is applied only when the pure
 *   `shouldApplyLifecycleRefresh` rule says it is current (R5-02).
 * - Favorite, Remove from Favorites and Snooze classify the selected ids with
 *   `readSelectionLifecycle` and `bulkWriteIds` before any write or sheet, and
 *   count only the people written (R1-03, R1-04).
 * - While selecting, the control row and search row are hidden and the bar
 *   is the root view's last in-flow child (D-72, D-76).
 *
 * Textual and AST-based, as the other HomeScreen contracts are (HomeScreen is
 * too large to render in the node test environment).
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

/** The body text of `const name = useCallback(fn, deps)` (or a plain arrow). */
function bodyOf(name: string): string {
  let found: string | null = null;
  const visit = (node: ts.Node): void => {
    if (found !== null) return;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer
    ) {
      const init = node.initializer;
      if (
        ts.isCallExpression(init) &&
        ts.isIdentifier(init.expression) &&
        init.expression.text === "useCallback"
      ) {
        found = init.arguments[0]?.getText(file) ?? null;
      } else {
        found = init.getText(file);
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (found === null) throw new Error(`HomeScreen \`${name}\` not found`);
  return found;
}

/** Every useEffect body in HomeScreen with its deps text. */
function effects(): { body: string; deps: string }[] {
  const out: { body: string; deps: string }[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "useEffect"
    ) {
      out.push({
        body: node.arguments[0]?.getText(file) ?? "",
        deps: node.arguments[1]?.getText(file) ?? "",
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

describe("the selection universe (D-77; ADR-102)", () => {
  it.each(["enterCardSelection", "onSelectContacts"])(
    "%s builds the frozen universe with selectionUniverseIds(rows, SELECTION_INCLUDES_UNBOUND)",
    (name) => {
      expect(bodyOf(name)).toContain(
        "selectionUniverseIds(rows, SELECTION_INCLUDES_UNBOUND)",
      );
    },
  );

  it.each(["enterCardSelection", "onSelectContacts"])(
    "%s captures the entry lifecycle map in React state",
    (name) => {
      expect(bodyOf(name)).toContain("setSelectionLifecycle(");
    },
  );
});

describe("the lifecycle map is React state, refreshed and gated (R4-01, R5-02)", () => {
  it("is held with useState, never written through a ref", () => {
    expect(source).toMatch(
      /const \[selectionLifecycle, setSelectionLifecycle\] =\s*useState/,
    );
    expect(source).not.toMatch(/selectionLifecycleRef\.current\s*=/);
  });

  it("commitBulkOutcome refreshes the map", () => {
    expect(bodyOf("commitBulkOutcome")).toContain(
      "refreshSelectionLifecycle()",
    );
  });

  it("a Home publish while selecting refreshes the map (an effect on the published rows)", () => {
    const publish = effects().find(
      (effect) =>
        effect.body.includes("refreshSelectionLifecycle()") &&
        effect.body.includes("selectionMode"),
    );
    expect(publish, "no publish-path refresh effect").toBeDefined();
    expect(publish?.deps).toMatch(/\brows\b/);
    expect(publish?.deps).toMatch(/\bselectionMode\b/);
  });

  it("applies a refresh result only inside a shouldApplyLifecycleRefresh branch fed both session ids", () => {
    const refresh = bodyOf("refreshSelectionLifecycle");
    expect(refresh).toContain("readSelectionLifecycle(getExecutor()");
    const guard = refresh.indexOf("shouldApplyLifecycleRefresh(");
    expect(guard).toBeGreaterThanOrEqual(0);
    const apply = refresh.indexOf("setSelectionLifecycle(");
    expect(apply).toBeGreaterThan(guard);
    // Exactly one apply, and it sits after the guard.
    expect(refresh.split("setSelectionLifecycle(").length).toBe(2);
    const guardCall = refresh.slice(guard, refresh.indexOf("})", guard) + 2);
    expect(guardCall).toContain("requestSessionId");
    expect(guardCall).toContain("currentSessionId");
    // The current session is read from the store when the read resolves.
    const resolveRead = refresh.indexOf(".then(");
    const storeRead = refresh.indexOf(
      "useDashboardSelectionStore.getState()",
      resolveRead,
    );
    expect(storeRead).toBeGreaterThan(resolveRead);
    expect(guard).toBeGreaterThan(storeRead);
  });

  it("the bar's enabled states come from selectionApplicability", () => {
    expect(source).toContain("selectionApplicability(");
  });
});

describe("Favorite, Remove from Favorites and Snooze skip Unbound people (D-77; R1-03, R1-04)", () => {
  const handlers = [
    ["onBulkAddFavourites", "add-favorites", "bulkAddFavourites("],
    ["onBulkRemoveFavourites", "remove-favorites", "bulkRemoveFavourites("],
    ["onBulkOpenSnoozePicker", "snooze", "setSnoozePicker("],
  ] as const;

  it.each(handlers)(
    "%s reads the lifecycle, then filters with bulkWriteIds, before %s",
    (name, action, sink) => {
      const body = bodyOf(name);
      const read = body.indexOf("readSelectionLifecycle(getExecutor(), ids)");
      const filter = body.search(new RegExp(`bulkWriteIds\\(\\s*"${action}"`));
      const write = body.indexOf(sink);
      expect(read).toBeGreaterThanOrEqual(0);
      expect(filter).toBeGreaterThan(read);
      expect(write).toBeGreaterThan(filter);
      // The claim must still be held after the read.
      expect(body).toContain("bulkActionInputClaimRef.current !== claim");
      // Nothing to write: release the claim and stop.
      expect(body).toMatch(
        /if \(writeIds\.length === 0\) \{\s*releaseBulkAction\(claim\);\s*return;/,
      );
    },
  );

  it.each(handlers.slice(0, 2))(
    "%s builds the outcome copy from the filtered count",
    (name) => {
      const body = bodyOf(name);
      expect(body).toContain("plural(writeIds.length");
      expect(body).not.toContain("plural(ids.length");
    },
  );

  it("the bulk snooze sheet opens over the filtered ids only", () => {
    const body = bodyOf("onBulkOpenSnoozePicker");
    expect(body).toContain("setSnoozePicker({");
    expect(body).toMatch(/ids: writeIds/);
  });
});

describe("selection layout (D-72, D-76)", () => {
  it("hides the control row while selecting", () => {
    expect(source).toContain(
      "{selectionMode ? null : <DashboardControlRow />}",
    );
    expect(source).not.toContain("dashboard-selection-controls");
  });

  it("hides the search row while selecting", () => {
    expect(source).toMatch(
      /\{!selectionMode \? \(\s*<View testID="dashboard-search-row"/,
    );
  });

  it("renders the bar once, after the list region and before the overlay host", () => {
    expect(source.split("<BulkActionSurface").length).toBe(2);
    const bar = source.indexOf("<BulkActionSurface");
    const cards = source.indexOf('testID="dashboard-card-results"');
    const overlayHost = source.indexOf("<DashboardOverlayHost />");
    expect(bar).toBeGreaterThan(cards);
    expect(overlayHost).toBeGreaterThan(bar);
  });
});

describe("a bar action's pre-write read shows busy, never a silent drop (38.13 review A-IN-01)", () => {
  it("Favorite, Remove from Favorites, Snooze and Set Category read under readForBulkAction", () => {
    for (const name of [
      "onBulkAddFavourites",
      "onBulkRemoveFavourites",
      "onBulkOpenSnoozePicker",
      "onBulkOpenCategoryPicker",
    ]) {
      expect(bodyOf(name)).toMatch(/void readForBulkAction\(\s*claim,/);
    }
  });

  it("the bar receives the reading state", () => {
    expect(source).toMatch(
      /<BulkActionSurface[\s\S]*?reading=\{bulkReadingClaim !== null\}/,
    );
  });
});

describe("long-press on a card enters selection (38.13 D-90)", () => {
  it("CardGrid's long-press is enterCardSelection, the same entry as the Select action", () => {
    expect(source).toContain("onLongPressContact={enterCardSelection}");
    expect(source).toContain("onSelect={enterCardSelection}");
  });

  it("the per-card context menu is retired: no import, state or render remains", () => {
    expect(source).not.toContain("CardContextMenu");
    expect(source).not.toContain("contextMenuContactId");
    expect(source).not.toContain("openCardContextMenu");
  });

  it("the card's Snooze… accessibility action still opens the shared card snooze sheet (38.11 D-81)", () => {
    expect(source).toContain("onOpenSnooze={openCardSnooze}");
    expect(bodyOf("openCardSnooze")).toContain("setCardSnooze({");
  });

  it("enterCardSelection seeds the long-pressed card into the frozen universe", () => {
    expect(bodyOf("enterCardSelection")).toContain(
      "enterSelection(universe, contactId)",
    );
  });
});
