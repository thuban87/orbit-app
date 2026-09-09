import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("expo-sqlite", () => ({}));
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  setProfileContactFrequency,
  snoozeProfileContact,
  unsnoozeProfileContact,
} from "@/db/profile-relationship-actions";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-09 12:00:00";
const LATER = "2026-09-09 13:00:00";
let uidCounter = 0;
const uid = () => `profile-action-${++uidCounter}`;

let exec: SqlExecutor;
let contactId: number;

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
    defaultPhoneRegion: "US",
  });
  contactId = (
    await exec.runAsync(
      `INSERT INTO contacts
         (uid,name,interval_days,tracking_enabled,last_contact,created_at,modified_at)
       VALUES(?,?,30,1,?,?,?)`,
      [uid(), "Profile action", NOW, NOW, NOW],
    )
  ).lastInsertRowId;
});

async function contactRow() {
  return exec.getFirstAsync<{
    interval_days: number | null;
    tracking_enabled: number;
    snooze_until: string | null;
    last_contact: string | null;
    modified_at: string;
  }>(
    `SELECT interval_days,tracking_enabled,snooze_until,last_contact,modified_at
       FROM contacts WHERE id=?`,
    [contactId],
  );
}

async function eventTypes() {
  const rows = await exec.getAllAsync<{ type: string }>(
    "SELECT type FROM events WHERE contact_id=? ORDER BY id",
    [contactId],
  );
  return rows.map((row) => row.type);
}

async function revision() {
  return (
    await exec.getFirstAsync<{ data_revision: number }>(
      "SELECT data_revision FROM app_settings WHERE id=1",
    )
  )?.data_revision;
}

function traceTransactions(base: SqlExecutor) {
  const statements: string[] = [];
  const traced: SqlExecutor = {
    ...base,
    execAsync: async (sql) => {
      statements.push(sql);
      return base.execAsync(sql);
    },
    runAsync: (sql, params) => base.runAsync(sql, params),
    getFirstAsync: (sql, params) => base.getFirstAsync(sql, params),
    getAllAsync: (sql, params) => base.getAllAsync(sql, params),
  };
  return { traced, statements };
}

describe("setProfileContactFrequency", () => {
  it("uses the live scalar core behavior and bumps revision exactly once", async () => {
    await exec.runAsync(
      "UPDATE contacts SET tracking_enabled=0 WHERE id=?",
      [contactId],
    );
    await setProfileContactFrequency(exec, {
      contactId,
      intervalDays: 14,
      now: LATER,
    });

    expect(await contactRow()).toEqual({
      interval_days: 14,
      tracking_enabled: 0,
      snooze_until: null,
      last_contact: NOW,
      modified_at: LATER,
    });
    expect(await eventTypes()).toEqual([]);
    expect(await revision()).toBe(1);
  });

  it("rejects invalid cadence and rolls back when revision publication fails", async () => {
    await expect(
      setProfileContactFrequency(exec, {
        contactId,
        intervalDays: 0,
        now: LATER,
      }),
    ).rejects.toThrow(/positive integer/);

    const broken: SqlExecutor = {
      ...exec,
      execAsync: (sql) => exec.execAsync(sql),
      getFirstAsync: (sql, params) => exec.getFirstAsync(sql, params),
      getAllAsync: (sql, params) => exec.getAllAsync(sql, params),
      runAsync: (sql, params) =>
        sql.includes("data_revision")
          ? Promise.reject(new Error("revision failed"))
          : exec.runAsync(sql, params),
    };
    await expect(
      setProfileContactFrequency(broken, {
        contactId,
        intervalDays: 7,
        now: LATER,
      }),
    ).rejects.toThrow("revision failed");
    expect((await contactRow())?.interval_days).toBe(30);
    expect(await revision()).toBe(0);
  });

  it("opens exactly one transaction around the core and revision bump", async () => {
    const { traced, statements } = traceTransactions(exec);
    await setProfileContactFrequency(traced, {
      contactId,
      intervalDays: 7,
      now: LATER,
    });
    expect(statements).toEqual(["BEGIN", "COMMIT"]);
  });
});

describe("Profile snooze actions", () => {
  it("supports presets and one resolved custom local date", async () => {
    await snoozeProfileContact(exec, {
      contactId,
      preset: "3d",
      now: NOW,
    });
    expect((await contactRow())?.snooze_until).not.toBeNull();
    expect(await eventTypes()).toEqual(["snooze"]);
    expect(await revision()).toBe(1);

    await snoozeProfileContact(exec, {
      contactId,
      until: "2026-10-12",
      now: LATER,
    });
    expect((await contactRow())?.snooze_until).toBe("2026-10-12");
    expect(await eventTypes()).toEqual(["snooze", "snooze"]);
    expect(await revision()).toBe(2);
  });

  it("validates custom dates before writing", async () => {
    for (const until of ["not-a-date", "2026-02-30", "2026-09-09"]) {
      await expect(
        snoozeProfileContact(exec, { contactId, until, now: NOW }),
      ).rejects.toThrow(/future local date/);
    }
    expect(await eventTypes()).toEqual([]);
    expect(await revision()).toBe(0);
  });

  it("preserves unconditional repeated-state snooze and unsnooze events", async () => {
    const request = {
      contactId,
      until: "2026-10-12" as const,
      now: NOW,
    };
    await snoozeProfileContact(exec, request);
    await snoozeProfileContact(exec, request);
    await unsnoozeProfileContact(exec, { contactId, now: LATER });
    await unsnoozeProfileContact(exec, { contactId, now: LATER });

    expect(await eventTypes()).toEqual([
      "snooze",
      "snooze",
      "unsnooze",
      "unsnooze",
    ]);
    expect(await revision()).toBe(4);
  });

  it("rolls back the contact row and immutable event when revision fails", async () => {
    const broken: SqlExecutor = {
      ...exec,
      execAsync: (sql) => exec.execAsync(sql),
      getFirstAsync: (sql, params) => exec.getFirstAsync(sql, params),
      getAllAsync: (sql, params) => exec.getAllAsync(sql, params),
      runAsync: (sql, params) =>
        sql.includes("data_revision")
          ? Promise.reject(new Error("revision failed"))
          : exec.runAsync(sql, params),
    };
    await expect(
      snoozeProfileContact(broken, {
        contactId,
        until: "2026-10-12",
        now: NOW,
      }),
    ).rejects.toThrow("revision failed");
    expect((await contactRow())?.snooze_until).toBeNull();
    expect(await eventTypes()).toEqual([]);
    expect(await revision()).toBe(0);
  });

  it("deduplicates only concurrent pending submissions, then records later repeats", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held = false;
    const delayed: SqlExecutor = {
      ...exec,
      execAsync: (sql) => exec.execAsync(sql),
      getFirstAsync: (sql, params) => exec.getFirstAsync(sql, params),
      getAllAsync: (sql, params) => exec.getAllAsync(sql, params),
      runAsync: async (sql, params) => {
        if (!held && sql.startsWith("UPDATE contacts SET snooze_until")) {
          held = true;
          await gate;
        }
        return exec.runAsync(sql, params);
      },
    };
    const input = { contactId, until: "2026-10-12", now: NOW } as const;
    const first = snoozeProfileContact(delayed, input);
    const duplicate = snoozeProfileContact(delayed, input);
    expect(duplicate).toBe(first);
    release();
    await Promise.all([first, duplicate]);
    expect(await eventTypes()).toEqual(["snooze"]);

    await snoozeProfileContact(delayed, input);
    expect(await eventTypes()).toEqual(["snooze", "snooze"]);
  });

  it("uses one outer transaction for custom snooze and unsnooze", async () => {
    const first = traceTransactions(exec);
    await snoozeProfileContact(first.traced, {
      contactId,
      until: "2026-10-12",
      now: NOW,
    });
    expect(first.statements).toEqual(["BEGIN", "COMMIT"]);

    const second = traceTransactions(exec);
    await unsnoozeProfileContact(second.traced, { contactId, now: LATER });
    expect(second.statements).toEqual(["BEGIN", "COMMIT"]);
  });
});
