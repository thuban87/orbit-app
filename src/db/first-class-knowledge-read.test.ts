import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  getFirstClassDerived,
  getFirstClassFields,
} from "@/db/first-class-knowledge-read";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-04 12:00:00";
let uidCounter = 0;
const uid = () => `first-class-read-uid-${++uidCounter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid: uid });
});

async function makeContact(
  options: Partial<{
    birthday: string | null;
    socialBattery: string | null;
    intervalDays: number | null;
    categoryId: number | null;
    trackingEnabled: number;
  }> = {},
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, birthday, social_battery, interval_days, category_id, tracking_enabled, created_at, modified_at)
     VALUES (?, 'Alex', ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      options.birthday ?? null,
      options.socialBattery ?? null,
      options.intervalDays === undefined ? 30 : options.intervalDays,
      options.categoryId ?? null,
      options.trackingEnabled ?? 1,
      NOW,
      NOW,
    ],
  );
  return result.lastInsertRowId;
}

async function addInteraction(contactId: number): Promise<void> {
  await exec.runAsync(
    `INSERT INTO interactions
       (uid, contact_id, occurred_at, recorded_at, channel, direction,
        connected, quality, note, source, modified_at)
     VALUES (?, ?, '2026-09-03 12:00:00', ?, 'text', 'outbound', 1, NULL, NULL, 'manual', ?)`,
    [uid(), contactId, NOW, NOW],
  );
}

describe("getFirstClassFields", () => {
  it("loads the stored first-class contact properties in one result", async () => {
    const category = await exec.runAsync(
      `INSERT INTO categories (uid, name, display_order, created_at, modified_at)
       VALUES (?, 'Close friends', 99, ?, ?)`,
      [uid(), NOW, NOW],
    );
    const contactId = await makeContact({
      birthday: "1990-01-02",
      socialBattery: "high",
      intervalDays: 14,
      categoryId: category.lastInsertRowId,
    });

    await expect(getFirstClassFields(exec, contactId)).resolves.toEqual({
      birthday: "1990-01-02",
      socialBattery: "high",
      intervalDays: 14,
      categoryName: "Close friends",
    });
  });

  it("returns a null category for a contact without one", async () => {
    const contactId = await makeContact();
    await expect(getFirstClassFields(exec, contactId)).resolves.toEqual({
      birthday: null,
      socialBattery: null,
      intervalDays: 30,
      categoryName: null,
    });
  });

  it("returns null for a missing contact", async () => {
    await expect(getFirstClassFields(exec, 999_999)).resolves.toBeNull();
  });
});

describe("getFirstClassDerived", () => {
  it("returns gravity and intensity for a Bound contact with history", async () => {
    const contactId = await makeContact();
    await addInteraction(contactId);

    const result = await getFirstClassDerived(exec, contactId, NOW);
    expect(result?.gravity).toEqual(expect.objectContaining({ tierName: expect.any(String) }));
    expect(result?.intensity).toEqual(expect.objectContaining({ currentCount: 1 }));
  });

  it("returns both derived values as null when a Bound contact has no history", async () => {
    const contactId = await makeContact();

    await expect(getFirstClassDerived(exec, contactId, NOW)).resolves.toEqual({
      gravity: null,
      intensity: null,
    });
  });

  it("keeps gravity but collapses Unbound intensity to null when history exists", async () => {
    const contactId = await makeContact({ intervalDays: null, trackingEnabled: 0 });
    await addInteraction(contactId);

    const result = await getFirstClassDerived(exec, contactId, NOW);
    expect(result?.gravity).toEqual(expect.objectContaining({ tierName: expect.any(String) }));
    expect(result?.intensity).toBeNull();
  });

  it("returns null for a missing contact", async () => {
    await expect(getFirstClassDerived(exec, 999_999, NOW)).resolves.toBeNull();
  });
});
