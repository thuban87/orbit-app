import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { migration008 } from "@/db/migrations/008-restore-photo-journal";
import { migration009 } from "@/db/migrations/009-contact-method-normalization";
import { migration010 } from "@/db/migrations/010-contact-method-label";
import { migration011 } from "@/db/migrations/011-contact-lifecycle-schema";
import { migration012 } from "@/db/migrations/012-import-sessions";
import { migration013 } from "@/db/migrations/013-reconciliation-and-merge";
import { migration014 } from "@/db/migrations/014-interaction-assists";
import {
  createPendingAssist,
  markAssistDismissed,
  markAssistFailed,
  markAssistLogged,
} from "@/db/interaction-assist-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-31 12:00:00";
const MIGRATIONS = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010,
  migration011,
  migration012,
  migration013,
  migration014,
];

let exec: SqlExecutor;
let counter = 0;
const uid = () => `uid-${++counter}`;

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, 14, { now: NOW, newUid: uid });
});

async function contact(name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, 30, ?, ?)`,
    [uid(), name, NOW, NOW],
  );
  return result.lastInsertRowId;
}

describe("interaction assist write DAO", () => {
  it("creates a pending assist and expires the oldest when a sixth is created", async () => {
    const contactId = await contact();
    const assistUids = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        createPendingAssist(exec, {
          contactId,
          channel: "call",
          endpointValue: "+15551234567",
          now: `2026-08-31 12:00:0${index}`,
        }),
      ),
    );

    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM interaction_assists WHERE status = 'pending'",
      ),
    ).toEqual({ count: 5 });
    expect(
      await exec.getFirstAsync<{ status: string; resolved_at: string | null }>(
        "SELECT status, resolved_at FROM interaction_assists WHERE uid = ?",
        [assistUids[0]],
      ),
    ).toEqual({ status: "expired", resolved_at: "2026-08-31 12:00:05" });
  });

  it("logs the original handoff once through the recency path", async () => {
    const contactId = await contact();
    const assistUid = await createPendingAssist(exec, {
      contactId,
      channel: "call",
      endpointValue: "+15551234567",
      now: "2026-08-31 11:00:00",
    });

    await markAssistLogged(exec, {
      assistUid,
      connected: 0,
      note: "Left voicemail",
      now: NOW,
    });
    await markAssistLogged(exec, {
      assistUid,
      connected: 1,
      now: NOW,
    });

    expect(
      await exec.getAllAsync<{
        uid: string;
        contact_id: number;
        occurred_at: string;
        direction: string;
        connected: number;
        note: string | null;
        source: string;
      }>(
        "SELECT uid, contact_id, occurred_at, direction, connected, note, source FROM interactions",
      ),
    ).toEqual([
      {
        uid: expect.not.stringMatching(/^reachout:/),
        contact_id: contactId,
        occurred_at: "2026-08-31 11:00:00",
        direction: "outbound",
        connected: 0,
        note: "Left voicemail",
        source: "assist",
      },
    ]);
    expect(
      await exec.getFirstAsync<{ last_contact: string | null }>(
        "SELECT last_contact FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ last_contact: "2026-08-31 11:00:00" });
    expect(
      await exec.getFirstAsync<{ status: string }>(
        "SELECT status FROM interaction_assists WHERE uid = ?",
        [assistUid],
      ),
    ).toEqual({ status: "logged" });
  });

  it("does not log dismissed or failed assists", async () => {
    const contactId = await contact();
    const dismissedUid = await createPendingAssist(exec, {
      contactId,
      channel: "text",
      endpointValue: "+15551234567",
      now: "2026-08-31 11:00:00",
    });
    const failedUid = await createPendingAssist(exec, {
      contactId,
      channel: "email",
      endpointValue: "alex@example.com",
      now: "2026-08-31 11:00:01",
    });

    await markAssistDismissed(exec, { assistUid: dismissedUid, now: NOW });
    await markAssistFailed(exec, { assistUid: failedUid, now: NOW });
    await markAssistLogged(exec, { assistUid: dismissedUid, connected: 1, now: NOW });
    await markAssistLogged(exec, { assistUid: failedUid, connected: 1, now: NOW });

    expect(await exec.getAllAsync("SELECT id FROM interactions")).toEqual([]);
  });

  it("rejects a future handoff before it can mutate interaction or recency state", async () => {
    const contactId = await contact();
    const assistUid = await createPendingAssist(exec, {
      contactId,
      channel: "call",
      endpointValue: null,
      now: "2026-08-31 12:00:01",
    });

    await expect(
      markAssistLogged(exec, { assistUid, connected: 1, now: NOW }),
    ).rejects.toThrow("future");
    expect(await exec.getAllAsync("SELECT id FROM interactions")).toEqual([]);
    expect(
      await exec.getFirstAsync<{ status: string }>(
        "SELECT status FROM interaction_assists WHERE uid = ?",
        [assistUid],
      ),
    ).toEqual({ status: "pending" });
    expect(
      await exec.getFirstAsync<{ last_contact: string | null }>(
        "SELECT last_contact FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ last_contact: null });
  });

  it("uses the re-read survivor after an assist is reparented in the confirmation gap", async () => {
    const survivorId = await contact("Survivor");
    const absorbedId = await contact("Absorbed");
    const assistUid = await createPendingAssist(exec, {
      contactId: absorbedId,
      channel: "email",
      endpointValue: "absorbed@example.com",
      now: "2026-08-31 11:00:00",
    });
    const baseExec = exec;
    let assistSelects = 0;
    exec = {
      ...baseExec,
      async getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null> {
        if (sql.includes("FROM interaction_assists") && ++assistSelects === 2) {
          await baseExec.runAsync(
            "UPDATE interaction_assists SET contact_id = ? WHERE uid = ?",
            [survivorId, assistUid],
          );
          await baseExec.runAsync("DELETE FROM contacts WHERE id = ?", [absorbedId]);
        }
        return baseExec.getFirstAsync<T>(sql, params);
      },
    };

    await markAssistLogged(exec, { assistUid, connected: 1, now: NOW });

    expect(
      await exec.getFirstAsync<{ contact_id: number }>(
        "SELECT contact_id FROM interactions",
      ),
    ).toEqual({ contact_id: survivorId });
    expect(
      await exec.getFirstAsync<{ last_contact: string | null }>(
        "SELECT last_contact FROM contacts WHERE id = ?",
        [survivorId],
      ),
    ).toEqual({ last_contact: "2026-08-31 11:00:00" });
  });

  it("safely no-ops when the assist disappears in the confirmation gap", async () => {
    const contactId = await contact();
    const assistUid = await createPendingAssist(exec, {
      contactId,
      channel: "text",
      endpointValue: "+15551234567",
      now: "2026-08-31 11:00:00",
    });
    const baseExec = exec;
    let assistSelects = 0;
    exec = {
      ...baseExec,
      async getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null> {
        if (sql.includes("FROM interaction_assists") && ++assistSelects === 2) {
          await baseExec.runAsync("DELETE FROM interaction_assists WHERE uid = ?", [
            assistUid,
          ]);
        }
        return baseExec.getFirstAsync<T>(sql, params);
      },
    };

    await markAssistLogged(exec, { assistUid, connected: 1, now: NOW });

    expect(await exec.getAllAsync("SELECT id FROM interactions")).toEqual([]);
    expect(
      await exec.getFirstAsync<{ last_contact: string | null }>(
        "SELECT last_contact FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ last_contact: null });
  });
});
