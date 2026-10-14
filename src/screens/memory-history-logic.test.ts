/**
 * The history page's rules (Phase 38.10 D-41, D-45, D-47, D-48, D-84, D-101,
 * D-107; convergence c1 F-U8 / F-U12, c6 CU-04, c10 Claude C-05).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { addCurrentStateEntry } from "@/db/current-state-history-dao";
import {
  type CurrentStateEntryRow,
  getCurrentStateHistory,
} from "@/db/current-state-history-read";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import {
  canEditDate,
  canMoveFrom,
  groupHistoryRows,
  HISTORY_MOST_RECENT,
  HISTORY_PREVIOUS,
  historyAddLabel,
  historyDeletedSnackbar,
  historyFabSection,
  historyRestoredSnackbar,
  historyRowDate,
  historyTitle,
  isPickableEntryDate,
  maxPickableDate,
  memorySavedLabel,
  returnsToSameProfile,
  rowPressAction,
} from "./memory-history-logic";
import { openEditTarget } from "./section-editor-logic";

const NOW = "2026-10-05 14:30:00";
const TODAY = new Date(2026, 9, 5, 14, 30);

function row(
  id: number,
  overrides: Partial<CurrentStateEntryRow> = {},
): CurrentStateEntryRow {
  return {
    id,
    uid: `uid-${id}`,
    contact_id: 1,
    field_key: "last_talked_about",
    value: `entry ${id}`,
    entry_date: "2026-10-05",
    entry_time: null,
    url: null,
    interaction_id: null,
    link_source: null,
    group_note_copy: 0,
    from_share: 0,
    created_at: NOW,
    modified_at: NOW,
    ...overrides,
  };
}

describe("ordering against the real SQL order (D-45, D-51)", () => {
  let exec: SqlExecutor;
  let uidCounter = 0;
  const uid = () => `history-logic-uid-${++uidCounter}`;

  beforeEach(async () => {
    uidCounter = 0;
    exec = nodeSqliteExecutor(openTestDb());
    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
      now: NOW,
      newUid: uid,
    });
  });

  it("slots a backdated entry into Previous, under an older-created entry", async () => {
    const contact = await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?)`,
      [uid(), "Ana", 30, NOW, NOW],
    );
    const contactId = contact.lastInsertRowId;
    const latest = await addCurrentStateEntry(exec, {
      contactId,
      fieldKey: "last_talked_about",
      value: "Her new job",
      entryDate: "2026-10-01",
      now: "2026-10-01 09:00:00",
    });
    // Added later, but about an earlier day.
    const backdated = await addCurrentStateEntry(exec, {
      contactId,
      fieldKey: "last_talked_about",
      value: "The hiking trip",
      entryDate: "2026-09-12",
      now: NOW,
    });

    const rows = await getCurrentStateHistory(
      exec,
      contactId,
      "last_talked_about",
    );
    const groups = groupHistoryRows(rows, "last_talked_about", TODAY);

    expect(groups.mostRecent?.row.id).toBe(latest);
    expect(groups.previous.map((model) => model.row.id)).toEqual([backdated]);
  });
});

describe("groupHistoryRows: Most Recent is a full row (convergence c10)", () => {
  const rows = [
    row(3, { entry_date: "2026-10-04" }),
    row(2, {
      entry_date: "2026-09-30",
      entry_time: "18:05:00",
      interaction_id: 40,
      link_source: "note",
    }),
    row(1, { entry_date: "2026-09-12" }),
  ];

  it("splits the SQL order into Most Recent and Previous", () => {
    const groups = groupHistoryRows(rows, "last_talked_about", TODAY);
    expect(groups.mostRecent?.row.id).toBe(3);
    expect(groups.previous.map((model) => model.row.id)).toEqual([2, 1]);
  });

  it("gives Most Recent the same row actions as a Previous row", () => {
    const groups = groupHistoryRows(rows, "last_talked_about", TODAY);
    const latest = groups.mostRecent;
    const earlierUnlinked = groups.previous[1];
    expect(latest).not.toBeNull();
    expect(Object.keys(latest ?? {}).sort()).toEqual(
      Object.keys(earlierUnlinked).sort(),
    );
    expect(latest).toMatchObject({
      pressAction: "edit",
      canEditDate: true,
      canMove: true,
      dateLabel: "Oct 4",
    });
    expect(earlierUnlinked).toMatchObject({
      pressAction: "edit",
      canEditDate: true,
      canMove: true,
    });
  });

  it("hands every row, Most Recent included, to openEditTarget", () => {
    const groups = groupHistoryRows(rows, "last_talked_about", TODAY);
    expect(groups.rows.map((entry) => entry.id)).toEqual([3, 2, 1]);
    // A Profile Edit on the latest entry opens its form.
    expect(openEditTarget(3, groups.rows)).toBe(3);
    expect(openEditTarget(99, groups.rows)).toBeUndefined();
  });

  it("returns no Most Recent and no Previous for an empty field", () => {
    const groups = groupHistoryRows([], "current_location", TODAY);
    expect(groups).toEqual({ mostRecent: null, previous: [], rows: [] });
  });

  it("offers no Move on the Current Location page (D-84; F-U12)", () => {
    const groups = groupHistoryRows(
      rows.map((entry) => ({ ...entry, field_key: "current_location" })),
      "current_location",
      TODAY,
    );
    expect(groups.mostRecent?.canMove).toBe(false);
    expect(groups.previous.every((model) => !model.canMove)).toBe(true);
  });

  it("names the groups as the Profile does", () => {
    expect(HISTORY_MOST_RECENT).toBe("Most Recent");
    expect(HISTORY_PREVIOUS).toBe("Previous");
  });
});

describe("historyRowDate: the date the entry is about, date only (CU-04)", () => {
  it("shows a backdated entry's own date, never its capture time", () => {
    const label = historyRowDate(
      { entry_date: "2026-09-12", created_at: "2026-10-05 14:30:00" },
      TODAY,
    );
    expect(label).toBe("Sep 12");
    expect(label).not.toMatch(/\d:\d/);
  });

  it("falls back to the creation date when there is no entry date", () => {
    expect(
      historyRowDate(
        { entry_date: null, created_at: "2026-10-05 14:30:00" },
        TODAY,
      ),
    ).toBe("Oct 5");
  });

  it("shows the year outside the current year", () => {
    expect(
      historyRowDate(
        { entry_date: "2025-06-02", created_at: "2026-10-05 14:30:00" },
        TODAY,
      ),
    ).toBe("Jun 2, 2025");
  });
});

describe("linked rows (D-41, D-107)", () => {
  const linked = row(5, { interaction_id: 12, link_source: "note" });
  const unlinked = row(6);

  it("opens the interaction on a linked row's tap, the form otherwise", () => {
    expect(rowPressAction(linked)).toBe("openLinked");
    expect(rowPressAction(unlinked)).toBe("edit");
  });

  it("never edits a linked row's date", () => {
    expect(canEditDate(linked)).toBe(false);
    expect(canEditDate(unlinked)).toBe(true);
  });
});

describe("the date cap (D-101)", () => {
  it("is today's local date", () => {
    expect(maxPickableDate(TODAY)).toBe("2026-10-05");
    // Late evening stays on the local day (CLAUDE.md formatLocalDate rule).
    expect(maxPickableDate(new Date(2026, 9, 5, 23, 45))).toBe("2026-10-05");
  });

  it("accepts today and earlier, refuses tomorrow", () => {
    expect(isPickableEntryDate("2026-10-05", TODAY)).toBe(true);
    expect(isPickableEntryDate("2025-01-01", TODAY)).toBe(true);
    expect(isPickableEntryDate("2026-10-06", TODAY)).toBe(false);
    expect(isPickableEntryDate("not a date", TODAY)).toBe(false);
  });
});

describe("canMoveFrom (D-84; F-U12)", () => {
  it("is true only for Last Talked About", () => {
    expect(canMoveFrom("last_talked_about")).toBe(true);
    expect(canMoveFrom("current_location")).toBe(false);
  });
});

describe("titles and snackbars (D-89; 38.9 D-39/D-46; F-U8)", () => {
  it("titles the page from the Profile registry", () => {
    expect(historyTitle("last_talked_about")).toBe("Last Talked About");
    expect(historyTitle("current_location")).toBe("Current Location");
  });

  it("puts the verb first and names the person", () => {
    expect(historyDeletedSnackbar("Last Talked About", "Ana")).toBe(
      "Deleted Last Talked About entry for Ana",
    );
    expect(historyRestoredSnackbar("Current Location", "Ana")).toBe(
      "Current Location entry restored for Ana",
    );
  });

  it("drops the name while the person line has not loaded", () => {
    expect(historyDeletedSnackbar("Last Talked About", null)).toBe(
      "Deleted Last Talked About entry",
    );
  });
});

describe("memorySavedLabel (D-64; convergence c2 G-U6)", () => {
  it("keeps the owner's wording for + → Memory and the general type", () => {
    expect(memorySavedLabel(undefined, "Ana")).toBe("Memory saved for Ana");
    expect(memorySavedLabel("general", "Ana")).toBe("Memory saved for Ana");
  });

  it("names a Profile section's type from the registry", () => {
    expect(memorySavedLabel("gift_idea", "Ana")).toBe(
      "Saved to Gift Ideas for Ana",
    );
    expect(memorySavedLabel("thought_of_them", "Ana")).toBe(
      "Saved to Thought of Them for Ana",
    );
  });

  it("drops the name while the person line has not loaded", () => {
    expect(memorySavedLabel(undefined, null)).toBe("Memory saved");
  });
});

describe("returnsToSameProfile (convergence c1 F-U11, Claude C-15)", () => {
  const memory = { name: "Memory", params: { contactId: 7 } };

  it("is true when that contact's Profile is directly below", () => {
    const routes = [
      { name: "Dashboard" },
      { name: "Profile", params: { contactId: 7 } },
      memory,
    ];
    expect(returnsToSameProfile(routes, 2, 7)).toBe(true);
  });

  it("is false for another contact's Profile", () => {
    const routes = [{ name: "Profile", params: { contactId: 8 } }, memory];
    expect(returnsToSameProfile(routes, 1, 7)).toBe(false);
  });

  it("is false for the Dashboard or nothing below", () => {
    expect(returnsToSameProfile([{ name: "Dashboard" }, memory], 1, 7)).toBe(
      false,
    );
    expect(returnsToSameProfile([memory], 0, 7)).toBe(false);
  });

  it("reads the route directly below, not any lower Profile", () => {
    const routes = [
      { name: "Profile", params: { contactId: 7 } },
      { name: "EditContact", params: { contactId: 7 } },
      memory,
    ];
    expect(returnsToSameProfile(routes, 2, 7)).toBe(false);
  });
});

describe("the history page's top Add and section FAB (D-131)", () => {
  it("historyAddLabel is today's Add wording, Add + the page title", () => {
    expect(historyAddLabel("last_talked_about")).toBe(
      `Add ${historyTitle("last_talked_about")}`,
    );
    expect(historyAddLabel("current_location")).toBe(
      `Add ${historyTitle("current_location")}`,
    );
  });

  it("historyFabSection maps each field to its sectionFabIcon key", () => {
    expect(historyFabSection("last_talked_about")).toBe("last_talked_about");
    expect(historyFabSection("current_location")).toBe("current_location");
  });
});
