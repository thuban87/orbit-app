import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UNBOUND_IMPORT } from "@/db/import-session-dao";
import { FREQUENCY_DAYS } from "@/types";
import {
  BULK_BOUND_BLURB,
  BULK_IMPORT_DEFAULT_FREQUENCY,
  bulkLifecycleChoice,
  initialBulkLifecycle,
} from "./bulk-import-setup-logic";

/**
 * 38.4 D-57 (owner, OA-E2): bulk import setup offers Bound or Unbound for the
 * whole batch, defaulting to Unbound; Bound carries one batch frequency.
 */
describe("bulk import setup lifecycle logic (D-57)", () => {
  it("defaults the batch frequency to Monthly", () => {
    expect(BULK_IMPORT_DEFAULT_FREQUENCY).toBe(FREQUENCY_DAYS.Monthly);
  });

  it("builds a Bound lifecycle with the picked frequency, or the default", () => {
    expect(bulkLifecycleChoice(true, 14)).toEqual({
      trackingEnabled: true,
      intervalDays: 14,
    });
    expect(bulkLifecycleChoice(true, null)).toEqual({
      trackingEnabled: true,
      intervalDays: FREQUENCY_DAYS.Monthly,
    });
  });

  it("never carries a cadence when Unbound, even if one was picked first", () => {
    expect(bulkLifecycleChoice(false, null)).toEqual(UNBOUND_IMPORT);
    expect(bulkLifecycleChoice(false, 90)).toEqual(UNBOUND_IMPORT);
  });

  it("restores the saved choice from the session", () => {
    expect(
      initialBulkLifecycle({
        batchTrackingEnabled: true,
        batchIntervalDays: 7,
      }),
    ).toEqual({ trackingEnabled: true, intervalDays: 7 });
    expect(
      initialBulkLifecycle({
        batchTrackingEnabled: false,
        batchIntervalDays: null,
      }),
    ).toEqual({ trackingEnabled: false, intervalDays: null });
  });

  it("says binding puts every imported contact on reminders at this frequency", () => {
    expect(BULK_BOUND_BLURB).toMatch(/every imported contact/i);
    expect(BULK_BOUND_BLURB).toMatch(/reminders/i);
    expect(BULK_BOUND_BLURB).toMatch(/frequency/i);
  });
});

const screen = readFileSync(
  join(__dirname, "BulkImportSetupScreen.tsx"),
  "utf8",
);

function functionBody(name: string): string {
  const start = screen.indexOf(`async function ${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  const next = screen.indexOf("\n  async function ", start + 1);
  const nextPlain = screen.indexOf("\n  function ", start + 1);
  const ends = [next, nextPlain].filter((index) => index > -1);
  return screen.slice(start, ends.length ? Math.min(...ends) : undefined);
}

describe("BulkImportSetupScreen lifecycle source contract (D-57)", () => {
  it("offers Unbound then Bound as a radio group with selected state", () => {
    expect(screen).toContain('accessibilityRole="radiogroup"');
    expect(screen).toContain('accessibilityRole="radio"');
    expect(screen).toMatch(/accessibilityState=\{\{\s*selected/);
    const unbound = screen.indexOf('"Unbound"');
    const bound = screen.indexOf('"Bound"');
    expect(unbound).toBeGreaterThan(-1);
    expect(bound).toBeGreaterThan(unbound);
    expect(screen).toContain("Orbit participation");
  });

  it("renders the frequency picker and blurb only inside the Bound branch", () => {
    const branch = /\{trackingEnabled \? \(([\s\S]*?)\) : null\}/.exec(screen);
    expect(branch).not.toBeNull();
    const inside = branch?.[1] ?? "";
    expect(inside).toContain("<FrequencyPicker");
    expect(inside).toContain("BULK_BOUND_BLURB");
    expect(screen.split("<FrequencyPicker").length - 1).toBe(1);
    expect(screen.split("{BULK_BOUND_BLURB}").length - 1).toBe(1);
  });

  it("persists the category and lifecycle in one write before any contact is created", () => {
    const start = functionBody("startBatch");
    expect(start).toContain("setSessionBatchDefaults(");
    expect(start).toContain("bulkLifecycleChoice(");
    expect(start.indexOf("setSessionBatchDefaults(")).toBeLessThan(
      start.indexOf('navigation.navigate("ImportProgress"'),
    );
    const combine = functionBody("onCombine");
    expect(combine).toContain("setSessionBatchDefaults(");
    expect(combine.indexOf("setSessionBatchDefaults(")).toBeLessThan(
      combine.indexOf("combineCluster("),
    );
    expect(combine).toContain(
      "const lifecycle = bulkLifecycleChoice(trackingEnabled, intervalDays)",
    );
    const combineArgs = combine.slice(combine.indexOf("combineCluster("));
    expect(combineArgs).toMatch(/\blifecycle,/);
    // The same value is saved on the session and passed to the combine.
    expect(combine).toMatch(/\{ categoryId: currentCategoryId, lifecycle \}/);
    expect(screen.split("setSessionBatchDefaults(").length - 1).toBe(2);
    expect(screen).not.toContain("setSessionBatchCategory(");
  });

  it("restores the saved choice on load", () => {
    const load = screen.slice(
      screen.indexOf("const load = useCallback("),
      screen.indexOf("useEffect(() => {"),
    );
    expect(load).toContain("initialBulkLifecycle(session)");
  });

  // 38.4 review Lane A WR-01: load() runs on mount AND on every focus. It must
  // restore category and lifecycle from the session only while the user has
  // not edited, so a late mount read or a focus return never overwrites an
  // unsaved Bound/frequency/category choice.
  it("restores category and lifecycle from the session only before the user edits", () => {
    expect(screen).toContain("const editedRef = useRef(false);");
    const mark = screen.slice(
      screen.indexOf("function markEdited()"),
      screen.indexOf("}", screen.indexOf("function markEdited()")),
    );
    expect(mark).toContain("editedRef.current = true;");
    expect(mark).toContain("setEdited(true);");
    // Every edit goes through markEdited, so the ref can never lag the state.
    expect(screen.split("setEdited(true)").length - 1).toBe(1);

    const load = screen.slice(
      screen.indexOf("const load = useCallback("),
      screen.indexOf("useEffect(() => {"),
    );
    const guardAt = load.indexOf("if (!editedRef.current) {");
    expect(guardAt).toBeGreaterThan(-1);
    const guarded = load.slice(guardAt, load.indexOf("}", guardAt));
    for (const restore of [
      "setCategoryId(session.batchCategoryId)",
      "setTrackingEnabled(saved.trackingEnabled)",
      "setIntervalDays(saved.intervalDays)",
    ]) {
      expect(guarded, restore).toContain(restore);
      expect(load.split(restore).length - 1, restore).toBe(1);
    }
    // The count and the category list still refresh on every load.
    expect(load.slice(0, guardAt)).toContain("setCount(counts.pending)");
    expect(load).toContain("setCategories(nextCategories)");
  });

  it("keeps the 38.3 B-CR-02 focus reset of saving", () => {
    const focus = screen.slice(screen.indexOf("useFocusEffect("));
    expect(focus.slice(0, focus.indexOf("[load]"))).toContain(
      "setSaving(false);",
    );
  });

  it("labels accent fills in onAccent, never the page background (ADR-084)", () => {
    expect(screen).not.toContain("colors.background");
    expect(screen.split("colors.onAccent").length - 1).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("keeps the category behaviour", () => {
    expect(screen).toContain("CATEGORY_SEARCH_THRESHOLD");
    expect(screen).toContain("CategoryChoiceSheet");
    expect(screen).toContain("resolveCategorySelection");
    expect(screen).toContain("await listCategories(exec)");
  });
});
