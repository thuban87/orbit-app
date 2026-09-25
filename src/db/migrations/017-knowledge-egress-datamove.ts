/**
 * Migration 017 — explicit Memory AI permission and no-loss fuel retirement.
 *
 * This forward-only step moves the two retired fuel populations only after each
 * source row has been copied and re-read successfully. The migration runner
 * owns the surrounding per-step transaction, so an integrity failure rolls the
 * schema change and every partial copy back together.
 */
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

export const MIGRATION017_INTEGRITY_CODE = "migration-017-integrity-failure";

/** A recognizable failure for a copy that cannot be proved lossless. */
export class Migration017IntegrityError extends Error {
  readonly code = MIGRATION017_INTEGRITY_CODE;

  constructor(reason: string) {
    super(`Migration 017 integrity failure: ${reason}`);
    this.name = "Migration017IntegrityError";
  }
}

export function isMigration017IntegrityError(
  error: unknown,
): error is Migration017IntegrityError {
  return (
    error instanceof Migration017IntegrityError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === MIGRATION017_INTEGRITY_CODE)
  );
}

export const ADD_MEMORIES_ALLOW_AI = `
ALTER TABLE memories
  ADD COLUMN allow_ai INTEGER NOT NULL DEFAULT 0;`;

interface FuelRow {
  id: number;
  uid: string;
  contact_id: number;
  text: string | null;
  url: string | null;
  created_at: string;
}

interface CopiedRow {
  fuelId: number;
  fuelUid: string;
  memoryUid: string;
  value: string | null;
}

function fail(reason: string): never {
  throw new Migration017IntegrityError(reason);
}

async function copyAndProve(
  exec: SqlExecutor,
  deps: MigrationDeps,
  sourceSql: string,
  sourceParams: unknown[],
  provenance: "share" | "user",
): Promise<CopiedRow[]> {
  const sourceRows = await exec.getAllAsync<FuelRow>(sourceSql, sourceParams);
  const copied: CopiedRow[] = [];
  const sourceUids = new Set<string>();

  for (const source of sourceRows) {
    if (!Number.isInteger(source.id) || typeof source.uid !== "string") {
      fail("unreadable fuel identity during copy");
    }
    if (sourceUids.has(source.uid)) {
      fail(`duplicate fuel uid during copy: ${source.uid}`);
    }
    sourceUids.add(source.uid);
    if (
      !Number.isInteger(source.contact_id) ||
      (source.text !== null && typeof source.text !== "string") ||
      (source.url !== null && typeof source.url !== "string") ||
      typeof source.created_at !== "string"
    ) {
      fail(`unreadable fuel row ${source.uid}`);
    }

    const memoryUid = deps.newUid();
    await exec.runAsync(
      `INSERT INTO memories (
         uid, contact_id, type, value, url, provenance, created_at, modified_at, allow_ai
       ) VALUES (?, ?, 'general', ?, ?, ?, ?, ?, 0)`,
      [
        memoryUid,
        source.contact_id,
        source.text,
        source.url,
        provenance,
        source.created_at,
        deps.now,
      ],
    );
    copied.push({
      fuelId: source.id,
      fuelUid: source.uid,
      memoryUid,
      value: source.text,
    });
  }

  if (copied.length !== sourceRows.length || new Set(copied.map((row) => row.fuelUid)).size !== sourceRows.length) {
    fail("source-to-memory mapping is incomplete");
  }
  for (const row of copied) {
    const memory = await exec.getFirstAsync<{
      uid: string;
      value: string | null;
      allow_ai: number;
    }>("SELECT uid, value, allow_ai FROM memories WHERE uid = ?", [row.memoryUid]);
    if (!memory || memory.uid !== row.memoryUid || memory.value !== row.value || memory.allow_ai !== 0) {
      fail(`post-copy proof failed for fuel ${row.fuelUid}`);
    }
  }
  return copied;
}

async function deleteCopiedRows(
  exec: SqlExecutor,
  copied: CopiedRow[],
): Promise<void> {
  for (const row of copied) {
    const result = await exec.runAsync("DELETE FROM fuel WHERE id = ?", [row.fuelId]);
    if (result.changes !== 1) {
      fail(`copied fuel row disappeared before deletion: ${row.fuelUid}`);
    }
  }
}

async function assertNoRows(
  exec: SqlExecutor,
  where: string,
  params: unknown[],
  description: string,
): Promise<void> {
  const remaining = await exec.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM fuel WHERE ${where}`,
    params,
  );
  if (remaining?.count !== 0) {
    fail(`${description} fuel rows remain after copy-and-remove`);
  }
}

export const migration017: Migration = {
  version: 17,
  async apply(exec: SqlExecutor, deps: MigrationDeps): Promise<void> {
    await exec.execAsync(ADD_MEMORIES_ALLOW_AI);

    const shareCaptures = await copyAndProve(
      exec,
      deps,
      `SELECT id, uid, contact_id, text, url, created_at
         FROM fuel
        WHERE kind = ? AND source = ?
        ORDER BY id`,
      ["topic", "share"],
      "share",
    );
    await deleteCopiedRows(exec, shareCaptures);
    await assertNoRows(
      exec,
      "kind = ? AND source = ?",
      ["topic", "share"],
      "share-capture",
    );

    // ADR-030 retirement: preserve every historical AI proposal, including an
    // off_limits proposal, as an AI-off Memory before removing retired fuel.
    const aiProposals = await copyAndProve(
      exec,
      deps,
      `SELECT id, uid, contact_id, text, url, created_at
         FROM fuel
        WHERE source = ?
        ORDER BY id`,
      ["ai"],
      "user",
    );
    await deleteCopiedRows(exec, aiProposals);
    await assertNoRows(exec, "source = ?", ["ai"], "AI-proposed");
  },
};
