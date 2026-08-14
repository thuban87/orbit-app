/**
 * DATA-07 benchmark harness — seed + timing + the owed localtime probe.
 *
 * This module proves the irreversible Phase-2 foundation is FAST and CORRECT on
 * the device it ships to. It times the REAL read queries the dashboard depends
 * on — `STATUS_SCAN` (the query-time status engine) and `NEWEST_PER_CONTACT`
 * (the timeline/AI recency head) — over a realistic seed, and runs the one-line
 * `date('now','localtime')` probe that P6 (RESEARCH) owes: `localtime` is
 * verified on glibc + Node's SQLite but not yet on Android/bionic, and a status
 * bucket that flips a calendar day early/late would only show up on device.
 *
 * ISOLATION (T-02-14 / DATA-04): this is a dev harness, not shipped wired. It
 * operates on the INJECTED `SqlExecutor` so it runs both node-side (tests, over
 * an in-memory `node:sqlite` DB) and on-device against a THROWAWAY ephemeral
 * expo DB (`orbit-bench.db`) that the caller opens, migrates, seeds, and DELETES
 * — NEVER `getDb()` / the live `orbit.db`. Seeding writes `last_contact` via
 * parameterized INSERTs into that throwaway DB only, so the benchmark is not a
 * second writer of `contacts.last_contact` and the single-writer recency DAO
 * invariant (DATA-04) is preserved.
 *
 * OBSERVABILITY: the single structured result line is emitted via `Logger.debug`,
 * which is a no-op until the caller raises the level (Logger defaults to "off",
 * src/utils/logger.ts). The on-device benchmark build calls `Logger.setLevel(
 * 'debug')` so the timings AND the localtime probe actually print to the
 * ReactNativeJS channel and can be captured as the binding DATA-07 evidence.
 */
import { NEWEST_PER_CONTACT, STATUS_SCAN } from "@/db/queries";
import type { SqlExecutor } from "@/db/types";
import { Logger } from "@/utils/logger";

// --- Tunable constants (top-of-file per project convention) ------------------

/**
 * Seed size for the on-device run. The product targets a personal contact book
 * (tens to low-hundreds of people), so 150 contacts is a comfortable ceiling for
 * v1. Tune here — it is the single knob for how heavy the STATUS_SCAN is.
 */
export const BENCH_CONTACTS = 150;
/**
 * Interactions per contact. 20 gives NEWEST_PER_CONTACT a real window to
 * partition over (3,000 interaction rows total at the default contact count).
 */
export const BENCH_PER_CONTACT = 20;
/**
 * "Acceptable" per-query budget in milliseconds on the physical Pixel. Both
 * STATUS_SCAN and NEWEST_PER_CONTACT run on the launch/read path, so this is
 * deliberately conservative — a full scan of tens-to-low-hundreds of contacts
 * must feel instant. If a real run exceeds this, the executor records the actual
 * numbers and flags them for owner review rather than loosening the threshold
 * (perf posture is the owner's call, CLAUDE.md).
 */
export const ACCEPTABLE_MS = 100;

/** Options for one benchmark seed. `now`/`newUid` are injected for determinism. */
export interface SeedOptions {
  /** How many contact rows to insert. */
  contacts: number;
  /** How many interaction rows to insert per contact. */
  perContact: number;
  /** Local wall-clock timestamp string (YYYY-MM-DD HH:MM:SS) for the seeded rows. */
  now: string;
  /** Merge-key UID minter (same dependency the migration runner threads). */
  newUid: () => string;
}

/** The single structured result of one benchmark run. */
export interface BenchmarkResult {
  /** Wall-clock milliseconds spent running STATUS_SCAN. */
  statusScanMs: number;
  /** Rows STATUS_SCAN returned (one per non-archived, contacted contact). */
  statusScanRows: number;
  /** Wall-clock milliseconds spent running NEWEST_PER_CONTACT. */
  newestPerContactMs: number;
  /** Rows NEWEST_PER_CONTACT returned (exactly one per contact). */
  newestPerContactRows: number;
  /** The `date('now','localtime')` device probe value (P6). */
  localtimeProbe: string;
  /** The budget both queries are measured against (echoes ACCEPTABLE_MS). */
  acceptableMs: number;
  /** True iff BOTH query durations are within `acceptableMs`. */
  withinBudget: boolean;
}

/** Monotonic-ish millisecond clock, preferring `performance.now` for sub-ms. */
function nowMs(): number {
  const perf = (globalThis as { performance?: { now?: () => number } })
    .performance;
  return typeof perf?.now === "function" ? perf.now() : Date.now();
}

/**
 * Bulk-insert `contacts` contact rows and `contacts × perContact` interaction
 * rows via parameterized INSERTs. Every contact is given a non-null
 * `last_contact` (= `now`) so it is in-scope for STATUS_SCAN's
 * `last_contact IS NOT NULL` filter. The whole seed runs inside one
 * hand-rolled transaction (BEGIN/COMMIT via the executor) so 3,000+ inserts do
 * not each pay a separate fsync — the same atomic-transaction shape the
 * migration runner uses. On any throw the transaction is rolled back and the
 * original error re-thrown, leaving the throwaway DB clean.
 */
export async function seedBenchmarkData(
  exec: SqlExecutor,
  opts: SeedOptions,
): Promise<void> {
  const { contacts, perContact, now, newUid } = opts;

  await exec.execAsync("BEGIN");
  try {
    for (let c = 0; c < contacts; c++) {
      const res = await exec.runAsync(
        `INSERT INTO contacts
           (uid, name, interval_days, last_contact, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newUid(), `Bench Contact ${c}`, 30, now, now, now],
      );
      const contactId = res.lastInsertRowId;

      for (let i = 0; i < perContact; i++) {
        await exec.runAsync(
          `INSERT INTO interactions
             (uid, contact_id, occurred_at, recorded_at, channel, source, modified_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newUid(), contactId, now, now, "unspecified", "benchmark", now],
        );
      }
    }
    await exec.execAsync("COMMIT");
  } catch (e) {
    await exec.execAsync("ROLLBACK").catch(() => {});
    throw e;
  }
}

/**
 * Time the two real read queries and run the localtime probe. Returns a single
 * `BenchmarkResult` and emits one structured `Logger.debug` line (visible only
 * when the caller has raised the log level — the device build sets it to debug).
 * Perf is a DEVICE claim: node-side this proves shape + row counts only.
 */
export async function runBenchmark(
  exec: SqlExecutor,
): Promise<BenchmarkResult> {
  const t0 = nowMs();
  const statusRows = await exec.getAllAsync<unknown>(STATUS_SCAN);
  const statusScanMs = nowMs() - t0;

  const t1 = nowMs();
  const newestRows = await exec.getAllAsync<unknown>(NEWEST_PER_CONTACT);
  const newestPerContactMs = nowMs() - t1;

  // P6 probe: log the device's notion of "today, local" so a bionic timezone
  // deviation from the wall clock is caught before status timing is trusted.
  const probe = await exec.getFirstAsync<{ d: string }>(
    "SELECT date('now','localtime') AS d",
  );
  const localtimeProbe = probe?.d ?? "";

  const result: BenchmarkResult = {
    statusScanMs,
    statusScanRows: statusRows.length,
    newestPerContactMs,
    newestPerContactRows: newestRows.length,
    localtimeProbe,
    acceptableMs: ACCEPTABLE_MS,
    withinBudget:
      statusScanMs <= ACCEPTABLE_MS && newestPerContactMs <= ACCEPTABLE_MS,
  };

  Logger.debug(
    "benchmark",
    "DATA-07 result",
    JSON.stringify({
      statusScanMs: Math.round(result.statusScanMs * 1000) / 1000,
      statusScanRows: result.statusScanRows,
      newestPerContactMs: Math.round(result.newestPerContactMs * 1000) / 1000,
      newestPerContactRows: result.newestPerContactRows,
      localtimeProbe: result.localtimeProbe,
      acceptableMs: result.acceptableMs,
      withinBudget: result.withinBudget,
    }),
  );

  return result;
}
