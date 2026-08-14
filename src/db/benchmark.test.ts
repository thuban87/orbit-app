/**
 * Benchmark harness — node-side correctness proof (DATA-07).
 *
 * The PERF assertion is device-only (CLAUDE.md: a legitimate timing claim needs
 * the physical Pixel + a release APK; the desktop emulator's render path is not
 * the app). These node:sqlite tests therefore prove only the harness's
 * CORRECTNESS — that `seedBenchmarkData` inserts exactly the requested row
 * counts and that `runBenchmark` times the REAL STATUS_SCAN / NEWEST_PER_CONTACT
 * constants, returns per-query durations + row counts, and runs the
 * `date('now','localtime')` probe (P6) — over the real migration-1 fixture.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  ACCEPTABLE_MS,
  type BenchmarkResult,
  runBenchmark,
  seedBenchmarkData,
} from "@/db/benchmark";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-14 12:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
});

async function countRows(table: string): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ${table}`,
  );
  return row?.n ?? -1;
}

describe("seedBenchmarkData", () => {
  it("inserts exactly `contacts` contacts and `contacts × perContact` interactions", async () => {
    await seedBenchmarkData(exec, {
      contacts: 12,
      perContact: 5,
      now: NOW,
      newUid: uid,
    });

    expect(await countRows("contacts")).toBe(12);
    expect(await countRows("interactions")).toBe(60);
  });

  it("gives every seeded contact a non-null last_contact (so STATUS_SCAN counts it)", async () => {
    await seedBenchmarkData(exec, {
      contacts: 8,
      perContact: 2,
      now: NOW,
      newUid: uid,
    });

    const row = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM contacts WHERE last_contact IS NULL",
    );
    expect(row?.n).toBe(0);
  });

  it("binds a distinct uid per row (no UNIQUE collision across contacts + interactions)", async () => {
    // A collision would throw on the NOT NULL UNIQUE `uid` columns.
    await expect(
      seedBenchmarkData(exec, {
        contacts: 20,
        perContact: 3,
        now: NOW,
        newUid: uid,
      }),
    ).resolves.not.toThrow();
    expect(await countRows("contacts")).toBe(20);
    expect(await countRows("interactions")).toBe(60);
  });
});

describe("runBenchmark", () => {
  let result: BenchmarkResult;

  beforeEach(async () => {
    await seedBenchmarkData(exec, {
      contacts: 25,
      perContact: 8,
      now: NOW,
      newUid: uid,
    });
    result = await runBenchmark(exec);
  });

  it("times STATUS_SCAN and returns one row per non-archived, contacted contact", () => {
    expect(result.statusScanRows).toBe(25);
    expect(typeof result.statusScanMs).toBe("number");
    expect(result.statusScanMs).toBeGreaterThanOrEqual(0);
  });

  it("times NEWEST_PER_CONTACT and returns exactly `contacts` rows", () => {
    expect(result.newestPerContactRows).toBe(25);
    expect(typeof result.newestPerContactMs).toBe("number");
    expect(result.newestPerContactMs).toBeGreaterThanOrEqual(0);
  });

  it("runs the date('now','localtime') probe and returns a YYYY-MM-DD string (P6)", () => {
    expect(result.localtimeProbe).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("reports the ACCEPTABLE_MS budget and whether both queries fit it", () => {
    expect(result.acceptableMs).toBe(ACCEPTABLE_MS);
    expect(typeof result.withinBudget).toBe("boolean");
    expect(result.withinBudget).toBe(
      result.statusScanMs <= ACCEPTABLE_MS &&
        result.newestPerContactMs <= ACCEPTABLE_MS,
    );
  });
});
