/**
 * widget-mark — headless mark-contacted write seam (WDG-02), behavioural proof.
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL single-writer recency DAO (via `widgetMarkContacted`), asserting
 * the load-bearing widget-tap contract WITHOUT a device:
 *   - exactly ONE interactions row per genuine tap, source='widget',
 *     direction='outbound', the resolved Default Interaction Channel (38.14
 *     D-59; Message when the settings cannot be read), connected=1, quality null;
 *   - `contacts.last_contact` recomputed to the marked timestamp (the DAO's MAX);
 *   - a SECOND genuine tap inserts a SECOND distinct row (no accidental dedup —
 *     LOG-06 mints a fresh uid per tap, unlike the notification path's
 *     deterministic exactly-once key).
 *
 * The killed-app native round-trip (WIDGET_CLICK → headless task) is device-only
 * (12-08); this proves the write core over the same harness as recency-dao.test.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration025 } from "@/db/migrations/025-interaction-history-schema";
import { runMigrations } from "@/db/migrations/runner";
import { createContactWithInteraction } from "@/db/recency-dao";
import type { SqlExecutor } from "@/db/types";
import { widgetMarkContacted } from "@/services/widget/widget-mark";

const NOW = "2026-08-14 12:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  // migration 025 adds interactions.duration/allow_ai (the columns the recency
  // writer now populates); it requires app_settings (002). The runner applies only
  // array members <= target, so 003-024 stay skipped.
  await runMigrations(exec, [migration001, migration002, migration025], 25, {
    now: NOW,
    newUid: uid,
  });
});

async function makeContact(): Promise<number> {
  // The "not yet / don't know" path — no first interaction, last_contact NULL.
  const { contactId } = await createContactWithInteraction(exec, {
    uid: uid(),
    name: "Alex",
    intervalDays: 30,
    now: NOW,
  });
  return contactId;
}

async function lastContact(contactId: number): Promise<string | null> {
  const row = await exec.getFirstAsync<{ last_contact: string | null }>(
    "SELECT last_contact FROM contacts WHERE id = ?",
    [contactId],
  );
  return row?.last_contact ?? null;
}

interface WidgetRow {
  id: number;
  uid: string;
  source: string;
  direction: string | null;
  channel: string;
  connected: number;
  quality: string | null;
  note: string | null;
  occurred_at: string;
}

async function rows(contactId: number): Promise<WidgetRow[]> {
  return exec.getAllAsync<WidgetRow>(
    `SELECT id, uid, source, direction, channel, connected, quality, note, occurred_at
       FROM interactions WHERE contact_id = ? ORDER BY id ASC`,
    [contactId],
  );
}

describe("widget-mark — headless single-writer mark (WDG-02)", () => {
  it("writes exactly one widget-sourced interaction with the one-tap defaults", async () => {
    const c = await makeContact();
    expect(await lastContact(c)).toBeNull();

    const { interactionId } = await widgetMarkContacted(exec, c, NOW);
    expect(interactionId).toBeGreaterThan(0);

    const all = await rows(c);
    expect(all).toHaveLength(1);
    const r = all[0];
    expect(r.source).toBe("widget");
    expect(r.direction).toBe("outbound");
    // This minimal schema predates the channel settings (migration 027), so
    // the settings read fails and the tap still writes, on Message (D-59).
    expect(r.channel).toBe("Message");
    expect(r.connected).toBe(1);
    expect(r.quality).toBeNull();
    expect(r.note).toBeNull();
    expect(r.occurred_at).toBe(NOW);
  });

  it("recomputes last_contact to the marked timestamp via the DAO's MAX", async () => {
    const c = await makeContact();
    await widgetMarkContacted(exec, c, NOW);
    expect(await lastContact(c)).toBe(NOW);
  });

  it("a repeat genuine tap inserts a SECOND distinct row (no accidental dedup)", async () => {
    const c = await makeContact();
    const first = await widgetMarkContacted(exec, c, NOW);
    const second = await widgetMarkContacted(exec, c, NOW);

    expect(second.interactionId).not.toBe(first.interactionId);

    const all = await rows(c);
    expect(all).toHaveLength(2);
    // Distinct rows carry distinct uids (freshly minted per tap, LOG-06).
    expect(all[0].uid).not.toBe(all[1].uid);
    // Both are widget-sourced.
    expect(all.every((r) => r.source === "widget")).toBe(true);
    // last_contact equals the (identical) marked timestamp.
    expect(await lastContact(c)).toBe(NOW);
  });
});

describe("widget-mark — the resolved Default Interaction Channel (38.14 D-59)", () => {
  it("still writes, on Message, when the settings row is missing", async () => {
    const c = await makeContact();
    await exec.runAsync("DELETE FROM app_settings");

    await widgetMarkContacted(exec, c, NOW);

    const all = await rows(c);
    expect(all).toHaveLength(1);
    expect(all[0].channel).toBe("Message");
    expect(all[0].direction).toBe("outbound");
  });

  it("records the user's default channel, outbound, on the full schema", async () => {
    const full = nodeSqliteExecutor(openTestDb());
    await runMigrations(full, MIGRATIONS, TARGET_VERSION, {
      now: NOW,
      newUid: uid,
      defaultPhoneRegion: "US",
    });
    await full.runAsync(
      "UPDATE app_settings SET default_interaction_channel = 'remember', remembered_interaction_channel = 'In Person' WHERE id = 1",
    );
    const { contactId } = await createContactWithInteraction(full, {
      uid: uid(),
      name: "Alex",
      intervalDays: 30,
      now: NOW,
    });

    await widgetMarkContacted(full, contactId, NOW);

    const stored = await full.getAllAsync<{
      channel: string;
      direction: string | null;
      source: string;
    }>(
      "SELECT channel, direction, source FROM interactions WHERE contact_id = ?",
      [contactId],
    );
    expect(stored).toEqual([
      { channel: "In Person", direction: "outbound", source: "widget" },
    ]);
  });
});
