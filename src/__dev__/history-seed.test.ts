/**
 * History seed, end to end (38.8 Plan 01, D-30): the seed writes the spec
 * through the real DAO Core writers into a FULLY migrated node-sqlite database,
 * and the canonical `readContactHistory` reads each dataset back.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { localDateTime, MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { readContactHistory } from "@/db/history-read";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { formatLocalDate } from "@/utils/dates";
import { seedHistoryFixture } from "./history-seed";
import { HISTORY_SEED_UID_PREFIX } from "./history-seed-spec";

vi.mock("expo-sqlite", () => ({}));

/** Mid-year, mid-morning local now (exercises the today clamp). */
const NOW = new Date(2026, 5, 17, 9, 30, 0);
const TODAY = formatLocalDate(NOW);

let db: ReturnType<typeof openTestDb>;
let exec: SqlExecutor;
let seq = 0;

beforeEach(async () => {
  db = openTestDb();
  exec = nodeSqliteExecutor(db);
  seq = 0;
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: localDateTime(NOW),
    newUid: () => `mig-${++seq}`,
    defaultPhoneRegion: "US",
  });
});
afterEach(() => db.close());

function deps(now: Date = NOW) {
  const logs: string[] = [];
  return { logs, deps: { now: () => now, log: (m: string) => logs.push(m) } };
}

async function idOf(key: string): Promise<number> {
  const row = await exec.getFirstAsync<{ id: number }>(
    "SELECT id FROM contacts WHERE uid = ?",
    [`${HISTORY_SEED_UID_PREFIX}${key}`],
  );
  if (!row) throw new Error(`no seeded contact ${key}`);
  return row.id;
}

describe("seedHistoryFixture", () => {
  it("writes the Long contact and readContactHistory reads its interaction back", async () => {
    const { deps: d, logs } = deps();
    const result = await seedHistoryFixture(exec, d);
    expect(result.status).toBe("created");
    const history = await readContactHistory(exec, await idOf("long"));
    expect(history.interactions).toHaveLength(1);
    expect(history.interactions[0].date).toBe(TODAY);
    expect(logs[0]).toMatch(/^history-seed created contacts=1 /);
  });
});
