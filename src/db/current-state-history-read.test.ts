import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { setCurrentStateValue } from "@/db/current-state-history-dao";
import {
  getCurrentStateHistory,
  getCurrentStateValue,
  getCurrentStateValues,
} from "@/db/current-state-history-read";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-04 12:00:00";
let uidCounter = 0;
const uid = () => `current-state-read-uid-${++uidCounter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid: uid });
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

    await expect(getCurrentStateValue(exec, contactId, "current_location")).resolves.toBeNull();
    await expect(getCurrentStateHistory(exec, contactId, "current_location")).resolves.toEqual([]);
  });

  it("returns a current-only value with no earlier entries", async () => {
    const contactId = await makeContact();
    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: NOW,
    });

    expect(await getCurrentStateValue(exec, contactId, "current_location")).toEqual(
      expect.objectContaining({ value: "Chicago", is_current: 1 }),
    );
    const history = await getCurrentStateHistory(exec, contactId, "current_location");
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(expect.objectContaining({ value: "Chicago", is_current: 1 }));
    expect(history.filter((row) => row.is_current === 0)).toEqual([]);
  });

  it("returns current plus the full newest-first backlist", async () => {
    const contactId = await makeContact();
    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: NOW,
    });
    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Madison",
      now: "2026-09-05 12:00:00",
    });

    expect((await getCurrentStateHistory(exec, contactId, "current_location")).map((row) => [
      row.value,
      row.is_current,
    ])).toEqual([
      ["Madison", 1],
      ["Chicago", 0],
    ]);
  });

  it("batches recognized current fields and excludes malformed keys without deleting them", async () => {
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
      value: "Coffee",
      now: NOW,
    });
    await exec.runAsync(
      `INSERT INTO current_state_entries
         (uid, contact_id, field_key, value, is_current, created_at, modified_at)
       VALUES (?, ?, 'legacy_key', 'kept on disk', 1, ?, ?)`,
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
