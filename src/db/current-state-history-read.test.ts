/**
 * Current-state reads in date order (D-45, D-51, D-53; convergence c1 F-D9,
 * c10 CU-01): Most Recent is the latest entry date, then entry time where
 * present, else creation time, else id. One order builder serves every
 * reader, with an alias form for joined queries.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  addCurrentStateEntry,
  setCurrentStateValue,
} from "@/db/current-state-history-dao";
import {
  currentStateOrderSql,
  getCurrentStateHistory,
  getCurrentStateValue,
  getCurrentStateValues,
} from "@/db/current-state-history-read";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-04 12:00:00";
let uidCounter = 0;
const uid = () => `current-state-read-uid-${++uidCounter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

async function makeContact(name = "Read contact"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

describe("current-state history reads", () => {
  it("returns null and an empty history for an unpopulated field", async () => {
    const contactId = await makeContact();

    await expect(
      getCurrentStateValue(exec, contactId, "current_location"),
    ).resolves.toBeNull();
    await expect(
      getCurrentStateHistory(exec, contactId, "current_location"),
    ).resolves.toEqual([]);
  });

  it("returns a single entry as Most Recent and as the only history row", async () => {
    const contactId = await makeContact();
    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: NOW,
    });

    expect(
      await getCurrentStateValue(exec, contactId, "current_location"),
    ).toEqual(
      expect.objectContaining({ value: "Chicago", entry_date: "2026-09-04" }),
    );
    const history = await getCurrentStateHistory(
      exec,
      contactId,
      "current_location",
    );
    expect(history).toHaveLength(1);
    // Exactly the rebuilt table's columns: no "current" flag (D-45).
    expect(Object.keys(history[0]).sort()).toEqual(
      [
        "contact_id",
        "created_at",
        "entry_date",
        "entry_time",
        "field_key",
        "from_share",
        "group_note_copy",
        "id",
        "interaction_id",
        "link_source",
        "modified_at",
        "uid",
        "url",
        "value",
      ].sort(),
    );
  });

  it("orders by entry date: a backdated entry slots into Previous", async () => {
    const contactId = await makeContact();
    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      entryDate: "2026-09-01",
      now: "2026-09-01 09:00:00",
    });
    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Madison",
      entryDate: "2026-09-03",
      now: "2026-09-03 09:00:00",
    });
    // Added last, but dated before Madison.
    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Backdated",
      entryDate: "2026-09-02",
      now: NOW,
    });

    expect(
      (await getCurrentStateHistory(exec, contactId, "current_location")).map(
        (row) => row.value,
      ),
    ).toEqual(["Madison", "Backdated", "Chicago"]);
    expect(
      (await getCurrentStateValue(exec, contactId, "current_location"))?.value,
    ).toBe("Madison");
    expect(
      (await getCurrentStateValues(exec, contactId)).current_location?.value,
    ).toBe("Madison");
  });

  it("orders within a day by entry time, else creation time, else id", async () => {
    const contactId = await makeContact();
    // Created latest, but its entry time is the earliest of the day.
    await addCurrentStateEntry(exec, {
      contactId,
      fieldKey: "last_talked_about",
      value: "Morning call",
      entryDate: "2026-09-04",
      entryTime: "08:00:00",
      createdAt: "2026-09-04 20:00:00",
      now: NOW,
    });
    await addCurrentStateEntry(exec, {
      contactId,
      fieldKey: "last_talked_about",
      value: "Noon direct",
      entryDate: "2026-09-04",
      createdAt: "2026-09-04 12:00:00",
      now: NOW,
    });
    await addCurrentStateEntry(exec, {
      contactId,
      fieldKey: "last_talked_about",
      value: "Noon direct, later id",
      entryDate: "2026-09-04",
      createdAt: "2026-09-04 12:00:00",
      now: NOW,
    });

    expect(
      (await getCurrentStateHistory(exec, contactId, "last_talked_about")).map(
        (row) => row.value,
      ),
    ).toEqual(["Noon direct, later id", "Noon direct", "Morning call"]);
  });

  it("returns the stored url and link_source on history rows (c10 CU-01)", async () => {
    const contactId = await makeContact();
    const interactionId = (
      await exec.runAsync(
        `INSERT INTO interactions
           (uid, contact_id, occurred_at, recorded_at, note, source, modified_at)
         VALUES ('interaction-1', ?, '2026-09-01 10:00:00', ?, 'Their trip', 'manual', ?)`,
        [contactId, NOW, NOW],
      )
    ).lastInsertRowId;
    await addCurrentStateEntry(exec, {
      contactId,
      fieldKey: "last_talked_about",
      value: "Their trip",
      entryDate: "2026-09-01",
      entryTime: "10:00:00",
      url: "https://example.test/trip",
      interactionId,
      linkSource: "note",
      now: NOW,
    });

    expect(
      await getCurrentStateHistory(exec, contactId, "last_talked_about"),
    ).toEqual([
      expect.objectContaining({
        url: "https://example.test/trip",
        link_source: "note",
        interaction_id: interactionId,
        entry_time: "10:00:00",
        group_note_copy: 0,
        from_share: 0,
      }),
    ]);
  });

  it("batches every field's Most Recent and excludes malformed keys without deleting them", async () => {
    const contactId = await makeContact();
    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: NOW,
    });
    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "last_talked_about",
      value: "Old topic",
      entryDate: "2026-08-01",
      now: NOW,
    });
    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "last_talked_about",
      value: "Coffee",
      now: NOW,
    });
    await exec.runAsync(
      `INSERT INTO current_state_entries
         (uid, contact_id, field_key, value, entry_date, created_at, modified_at)
       VALUES (?, ?, 'legacy_key', 'kept on disk', '2026-09-04', ?, ?)`,
      [uid(), contactId, NOW, NOW],
    );

    const values = await getCurrentStateValues(exec, contactId);
    expect(values.current_location?.value).toBe("Chicago");
    expect(values.last_talked_about?.value).toBe("Coffee");
    expect(values).not.toHaveProperty("legacy_key");
    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM current_state_entries WHERE field_key = 'legacy_key'",
      ),
    ).toEqual({ count: 1 });
  });
});

describe("currentStateOrderSql (D-51; F-D9)", () => {
  it("builds the bare and the aliased form, and refuses a non-literal alias", () => {
    expect(currentStateOrderSql()).toBe(
      "entry_date DESC, COALESCE(entry_time, substr(created_at,12,8)) DESC, id DESC",
    );
    expect(currentStateOrderSql("s")).toBe(
      "s.entry_date DESC, COALESCE(s.entry_time, substr(s.created_at,12,8)) DESC, s.id DESC",
    );
    expect(() => currentStateOrderSql("s; DROP TABLE x")).toThrow(
      "invalid alias",
    );
    expect(() => currentStateOrderSql("S")).toThrow("invalid alias");
  });

  it("orders a backdated entry correctly in a query joined to contacts", async () => {
    const contactId = await makeContact();
    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Newer",
      entryDate: "2026-09-03",
      now: "2026-09-03 09:00:00",
    });
    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Backdated",
      entryDate: "2026-09-01",
      now: NOW,
    });

    // Bare `id` / `created_at` would be ambiguous against contacts c.
    const joined = await exec.getAllAsync<{ value: string; name: string }>(
      `SELECT s.value, c.name
         FROM current_state_entries s
         JOIN contacts c ON c.id = s.contact_id
        WHERE s.contact_id = ?
        ORDER BY ${currentStateOrderSql("s")}`,
      [contactId],
    );
    expect(joined.map((row) => row.value)).toEqual(["Newer", "Backdated"]);
    const bare = await exec.getAllAsync<{ value: string }>(
      `SELECT value FROM current_state_entries WHERE contact_id = ?
        ORDER BY ${currentStateOrderSql()}`,
      [contactId],
    );
    expect(bare.map((row) => row.value)).toEqual(["Newer", "Backdated"]);
  });
});
