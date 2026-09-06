import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("expo-sqlite", () => ({}));
import { bulkQuickLog } from "@/db/bulk-actions-dao";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { createContactFull } from "@/db/contacts-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-06 12:00:00";
let uidCounter = 0;
const uid = () => `bulk-uid-${++uidCounter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
    defaultPhoneRegion: "US",
  });
});

async function seedContact(name: string): Promise<number> {
  const { contactId } = await createContactFull(exec, {
    uid: uid(),
    name,
    intervalDays: 14,
    now: NOW,
  });
  return contactId;
}

describe("bulkQuickLog", () => {
  it("records one canonical outbound interaction and a receipt per contact", async () => {
    const ids = await Promise.all([seedContact("A"), seedContact("B")]);

    const receipt = await bulkQuickLog(exec, ids, NOW);

    expect(receipt.map((entry) => entry.contactId)).toEqual(ids);
    expect(await exec.getAllAsync(
      "SELECT contact_id, channel, direction, connected, quality, source FROM interactions ORDER BY contact_id",
    )).toEqual([
      { contact_id: ids[0], channel: "unspecified", direction: "outbound", connected: 1, quality: null, source: "manual" },
      { contact_id: ids[1], channel: "unspecified", direction: "outbound", connected: 1, quality: null, source: "manual" },
    ]);
  });
});
