/**
 * D-55 (owner, 2026-09-27; OA-E1): the Contacts header count is the number of
 * contacts the ACTIVE VIEW displays — List rows or Card rows (the frozen subset
 * in Card selection mode) — for the active population, filters and search. It
 * supersedes the Phase 26 total-live header rule (`26-UAT.md` "Product
 * observation") and D-51's "record, don't change". `countLiveContacts` stays
 * for the cause-aware empty state only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  dashboardHeaderCount,
  dashboardHeaderCountLabel,
} from "@/logic/dashboard-header-count";

const base = {
  error: false,
  initialLoading: false,
  viewMode: "list" as const,
  listRowCount: 0,
  cardRowCount: 0,
};

describe("dashboardHeaderCount — the displayed contacts (D-55)", () => {
  it("List view counts the List rows, whatever the live total is", () => {
    // Today's header would read the live total (e.g. 6); D-55 reads the rows.
    expect(
      dashboardHeaderCount({ ...base, listRowCount: 5, cardRowCount: 25 }),
    ).toBe(5);
  });

  it("Card view counts the Card rows", () => {
    expect(
      dashboardHeaderCount({
        ...base,
        viewMode: "card",
        listRowCount: 25,
        cardRowCount: 25,
      }),
    ).toBe(25);
  });

  it("a search showing 2 results counts 2", () => {
    expect(
      dashboardHeaderCount({ ...base, listRowCount: 2, cardRowCount: 2 }),
    ).toBe(2);
  });

  it("Card selection mode counts the frozen subset it shows", () => {
    expect(
      dashboardHeaderCount({
        ...base,
        viewMode: "card",
        listRowCount: 25,
        cardRowCount: 3,
      }),
    ).toBe(3);
  });

  it("is hidden on a read error", () => {
    expect(
      dashboardHeaderCount({ ...base, error: true, listRowCount: 4 }),
    ).toBeNull();
  });

  it("is hidden while the initial skeleton shows", () => {
    expect(
      dashboardHeaderCount({ ...base, initialLoading: true, listRowCount: 4 }),
    ).toBeNull();
  });

  it("is hidden when nothing is displayed (the empty state speaks)", () => {
    expect(dashboardHeaderCount({ ...base, cardRowCount: 7 })).toBeNull();
    expect(
      dashboardHeaderCount({ ...base, viewMode: "card", listRowCount: 7 }),
    ).toBeNull();
  });
});

describe("dashboardHeaderCountLabel", () => {
  it("keeps today's copy", () => {
    expect(dashboardHeaderCountLabel(1)).toBe("1 contact");
    expect(dashboardHeaderCountLabel(2)).toBe("2 contacts");
    expect(dashboardHeaderCountLabel(25)).toBe("25 contacts");
  });
});

describe("HomeScreen wiring (source contract)", () => {
  const home = readFileSync(
    join(__dirname, "..", "screens", "HomeScreen.tsx"),
    "utf8",
  );
  const headerStart = home.indexOf("const listHeader = (");
  const header = home.slice(
    headerStart,
    home.indexOf("const listEmptyContent", headerStart),
  );

  it("the shared listHeader renders the helper's label from dashboardHeaderCount", () => {
    expect(home).toMatch(/const headerCount = dashboardHeaderCount\(\{/);
    expect(header).toContain('testID="dashboard-header-count"');
    expect(header).toContain("dashboardHeaderCountLabel(headerCount)");
    expect(header).toContain("headerCount !== null");
    expect(header).not.toContain("counts.live");
  });

  it("the count uses the rows each view renders", () => {
    const call = home.slice(
      home.indexOf("const headerCount = dashboardHeaderCount({"),
      home.indexOf("});", home.indexOf("const headerCount")),
    );
    expect(call).toContain("listRowCount: rows.length");
    expect(call).toContain("cardRowCount: cardRows.length");
    expect(call).toContain("viewMode: query.viewMode");
    expect(call).toContain("initialLoading: showInitialSkeleton");
  });

  it("the empty state still reads the live count, and the read still counts it", () => {
    const empty = home.slice(
      home.indexOf("selectDashboardEmptyState({"),
      home.indexOf("});", home.indexOf("selectDashboardEmptyState({")),
    );
    expect(empty).toContain("live: counts.live");
    expect(home.match(/countLiveContacts\(exec\)/g)).toHaveLength(1);
  });
});
