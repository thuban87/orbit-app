/**
 * HomeScreen session contract (38.13 D-24, D-29).
 *
 * D-24: a search term left in the session store never filters the list when
 * Contacts mounts again. The debounced term that drives the read starts empty,
 * and a mount effect clears the session search before the first focus read.
 * The clear never runs inside a useState initialiser or a setSearchExpanded
 * updater (React runs both during render; see home-search-toggle-contract).
 *
 * D-29: the Back listener resolves through resolveHomeBack, defers to an open
 * shell transient, and closes the search through onToggleSearch.
 *
 * Textual, as the other screen contracts are (HomeScreen is too large to
 * render in the node test environment).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/screens/HomeScreen.tsx"),
  "utf8",
);

const MOUNT_CLEAR =
  'useEffect(() => {\n    useDashboardSessionStore.getState().setSearchText("");\n  }, []);';

function backListener(): string {
  const start = source.indexOf('"hardwareBackPress"');
  expect(start, "Back listener not found").toBeGreaterThanOrEqual(0);
  const end = source.indexOf("return () => subscription.remove();", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("HomeScreen session search on mount (D-24)", () => {
  it("starts the debounced search term empty, never from the store", () => {
    expect(source).toContain(
      'const [debouncedSearchText, setDebouncedSearchText] = useState("");',
    );
    expect(source).not.toMatch(
      /setDebouncedSearchText\] = useState\(\s*searchText\s*\)/,
    );
  });

  it("clears the session search in a mount effect", () => {
    expect(source).toContain(MOUNT_CLEAR);
  });

  it("declares the mount clear before the debounce effect and the first focus read", () => {
    const clear = source.indexOf(MOUNT_CLEAR);
    const debounce = source.indexOf("() => setDebouncedSearchText(searchText)");
    const focusRead = source.indexOf('reload("focus");');
    expect(clear).toBeGreaterThanOrEqual(0);
    expect(debounce).toBeGreaterThan(clear);
    expect(focusRead).toBeGreaterThan(clear);
  });

  it("never clears the search inside a useState initialiser or a state updater", () => {
    expect(source).not.toMatch(/useState\(\s*\(\)\s*=>\s*\{[^}]*setSearchText/);
    expect(source).not.toMatch(/setSearchExpanded\(\s*\(/);
    expect(source.match(/setSearchExpanded\(/g)).toHaveLength(1);
  });
});

describe("HomeScreen Reset Dashboard View (D-31, D-04)", () => {
  function resetBody(): string {
    const start = source.indexOf("const resetDashboard = useCallback(");
    expect(start, "resetDashboard not found").toBeGreaterThanOrEqual(0);
    const end = source.indexOf("} catch (error) {", start);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  it("resets the view, clears the session, then scrolls both views to the top", () => {
    const body = resetBody();
    const reset = body.indexOf(
      "await useDashboardQueryStore.getState().resetDashboardView(getExecutor());",
    );
    const clear = body.indexOf(
      "useDashboardSessionStore.getState().clearSession();",
    );
    const list = body.indexOf(
      "listRef.current?.scrollToOffset({ offset: 0, animated: false });",
    );
    const grid = body.indexOf(
      "cardGridRef.current?.scrollToOffset({ offset: 0, animated: false });",
    );
    expect(reset).toBeGreaterThanOrEqual(0);
    expect(clear).toBeGreaterThan(reset);
    expect(list).toBeGreaterThan(clear);
    expect(grid).toBeGreaterThan(clear);
  });

  it("never changes the view mode on Reset beyond the store's own reset", () => {
    expect(resetBody()).not.toContain("setViewMode(");
  });

  it("passes the refs to the List FlatList and the Card grid", () => {
    expect(source).toContain("ref={listRef}");
    expect(source).toContain("listRef={cardGridRef}");
  });
});

describe("HomeScreen Android Back (D-29)", () => {
  it("resolves every press through resolveHomeBack with the shell transient state", () => {
    const listener = backListener();
    expect(listener).toContain("resolveHomeBack({");
    expect(listener).toContain(
      "anyTransientOpen: shellTransientStore.getState().isAnyOpen(),",
    );
    expect(listener).toContain("selectionMode,");
    expect(listener).toContain("searchExpanded,");
  });

  it("exits selection, closes the search through onToggleSearch, otherwise returns false", () => {
    const listener = backListener();
    expect(listener).toMatch(
      /action === "exit-selection"\) \{\s*exitBulkSelection\(\);\s*return true;/,
    );
    expect(listener).toMatch(
      /action === "close-search"\) \{\s*onToggleSearch\(\);\s*return true;/,
    );
    expect(listener).toMatch(/return false;\s*\},\s*\);\s*$/);
  });

  it("re-registers when the search or selection state changes", () => {
    expect(source).toContain(
      "}, [exitBulkSelection, onToggleSearch, searchExpanded, selectionMode]),",
    );
  });
});
