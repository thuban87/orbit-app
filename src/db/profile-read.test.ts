import { performance } from "node:perf_hooks";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import {
  ProfileOptionalSectionError,
  readProfileSnapshot,
  type ProfileReadDependencies,
} from "@/db/profile-read";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-09 12:00:00";
const OPTIONS = { now: NOW, themeBackground: "theme:galaxy" };
let exec: SqlExecutor;
let sequence = 0;
const uid = () => `profile-snapshot-${++sequence}`;

beforeEach(async () => {
  sequence = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
    defaultPhoneRegion: "US",
  });
});

async function contact(name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, tracking_enabled, created_at, modified_at)
     VALUES (?, ?, 30, 1, ?, ?)`,
    [uid(), name, NOW, NOW],
  );
  return result.lastInsertRowId;
}

describe("coherent local Profile snapshot", () => {
  it("composes identity, presentation, metrics inputs, methods, knowledge, and history in one snapshot", async () => {
    const contactId = await contact();
    await exec.runAsync(
      `INSERT INTO interactions
         (uid, contact_id, occurred_at, recorded_at, channel, direction,
          connected, source, modified_at)
       VALUES (?, ?, '2026-09-01 09:00:00', ?, 'call', 'outbound', 1, 'manual', ?)`,
      [uid(), contactId, NOW, NOW],
    );
    await exec.runAsync(
      "UPDATE contacts SET last_contact = '2026-09-01 09:00:00' WHERE id = ?",
      [contactId],
    );

    const snapshot = await readProfileSnapshot(exec, contactId, OPTIONS);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.identity).toMatchObject({ id: contactId, name: "Alex" });
    expect(snapshot?.presentation.factoryLayout.version).toBe(1);
    expect(snapshot?.impactInputs.interactions).toHaveLength(1);
    expect(snapshot?.metrics.status.available).toBe(true);
    expect(snapshot?.methods).toEqual({ phone: [], email: [] });
    expect(snapshot?.knowledge.status).toBe("ready");
    expect(snapshot?.history.status).toBe("ready");
  });

  it("returns null for a missing contact rather than an empty section-shaped snapshot", async () => {
    expect(await readProfileSnapshot(exec, 999999, OPTIONS)).toBeNull();
  });

  it("contains only explicitly classified optional-section failures", async () => {
    const contactId = await contact();
    const dependencies: Partial<ProfileReadDependencies> = {
      readKnowledge: async () => {
        throw new ProfileOptionalSectionError("knowledge", "Unavailable for now");
      },
    };
    const result = await readProfileSnapshot(exec, contactId, OPTIONS, dependencies);
    expect(result?.knowledge).toEqual({
      status: "error",
      message: "Unavailable for now",
    });
    expect(result?.history.status).toBe("ready");
  });

  it("rolls back and rejects schema, corruption, and unclassified reader failures", async () => {
    const contactId = await contact();
    const statements: string[] = [];
    const wrapped: SqlExecutor = {
      ...exec,
      execAsync: async (sql) => {
        statements.push(sql);
        return exec.execAsync(sql);
      },
      runAsync: exec.runAsync.bind(exec),
      getFirstAsync: exec.getFirstAsync.bind(exec),
      getAllAsync: exec.getAllAsync.bind(exec),
    };
    await expect(
      readProfileSnapshot(wrapped, contactId, OPTIONS, {
        readHistory: async () => {
          throw new Error("no such table: interactions");
        },
      }),
    ).rejects.toThrow("no such table");
    expect(statements).toEqual(["BEGIN", "ROLLBACK"]);
  });

  it("keeps thousands of interactions inside a deterministic local budget without changing metric semantics", async () => {
    const contactId = await contact();
    await exec.execAsync("BEGIN");
    for (let index = 0; index < 3_000; index += 1) {
      await exec.runAsync(
        `INSERT INTO interactions
           (uid, contact_id, occurred_at, recorded_at, channel, direction,
            connected, source, modified_at)
         VALUES (?, ?, ?, ?, 'call', 'outbound', 1, 'manual', ?)`,
        [
          uid(),
          contactId,
          `2026-08-${String((index % 28) + 1).padStart(2, "0")} 09:00:00`,
          NOW,
          NOW,
        ],
      );
    }
    await exec.execAsync("COMMIT");
    await exec.runAsync(
      "UPDATE contacts SET last_contact = '2026-08-28 09:00:00' WHERE id = ?",
      [contactId],
    );

    const started = performance.now();
    const result = await readProfileSnapshot(exec, contactId, OPTIONS);
    const elapsedMs = performance.now() - started;
    expect(result?.impactInputs.interactions).toHaveLength(3_000);
    expect(result?.metrics.gravity).toMatchObject({ available: true });
    // Generous deterministic regression ceiling for the node:sqlite fixture;
    // this is a local query/derivation budget, not a device rendering claim.
    expect(elapsedMs).toBeLessThan(2_000);
  });
});
