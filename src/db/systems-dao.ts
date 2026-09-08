/** Durable custom-System definitions and cross-kind override reads/writes. */
import {
  assertOrreryLastSystem,
  type OrrerySystemId,
} from "@/db/app-settings-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { inWriteTransaction, type ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { BUILTIN_SYSTEM_LABELS } from "@/logic/orrery-system-logic";

export interface CustomSystem {
  id: number;
  uid: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
}

export interface SystemRule {
  id: number;
  uid: string;
  systemId: number;
  family: string;
  value: string;
  createdAt: string;
}

export type SystemOverrideMode = "include" | "exclude";
export interface SystemOverride {
  id: number;
  uid: string;
  systemRef: OrrerySystemId;
  contactId: number;
  mode: SystemOverrideMode;
  createdAt: string;
}

export interface SystemPref {
  id: number;
  uid: string;
  systemRef: OrrerySystemId;
  displayOrder: number | null;
  hidden: 0 | 1;
  createdAt: string;
  modifiedAt: string;
}

function mapSystem(row: {
  id: number;
  uid: string;
  name: string;
  created_at: string;
  modified_at: string;
}): CustomSystem {
  return {
    id: row.id,
    uid: row.uid,
    name: row.name,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
  };
}

/**
 * Prevent names that would make the cross-kind selector ambiguous. SQLite can
 * enforce custom-vs-custom only, so this transaction-scoped preflight also
 * covers static built-ins and mutable Categories.
 */
export async function assertUniqueSystemName(
  exec: ReadOnlyExecutor,
  input: { name: string; excludeId?: number },
): Promise<void> {
  const duplicate = await exec.getFirstAsync<{ id: number }>(
    `SELECT id FROM systems
      WHERE name = ? COLLATE NOCASE AND id != ?
      LIMIT 1`,
    [input.name, input.excludeId ?? -1],
  );
  const builtin = Object.values(BUILTIN_SYSTEM_LABELS).some(
    (label) => label.toLocaleLowerCase() === input.name.toLocaleLowerCase(),
  );
  const category = await exec.getFirstAsync<{ id: number }>(
    "SELECT id FROM categories WHERE name = ? COLLATE NOCASE LIMIT 1",
    [input.name],
  );
  if (duplicate || builtin || category) {
    throw new Error(`A System named ${input.name} already exists`);
  }
}

/** Insert a custom definition while an outer writer owns the transaction. */
export async function createCustomSystemCore(
  exec: SqlExecutor,
  input: { name: string; now: string },
): Promise<CustomSystem> {
  await assertUniqueSystemName(exec, { name: input.name });
  const uid = newUid();
  const result = await exec.runAsync(
    "INSERT INTO systems (uid, name, created_at, modified_at) VALUES (?, ?, ?, ?)",
    [uid, input.name, input.now, input.now],
  );
  return {
    id: result.lastInsertRowId,
    uid,
    name: input.name,
    createdAt: input.now,
    modifiedAt: input.now,
  };
}

/** Insert and bump the durable backup revision under one shared writer lock. */
export function createCustomSystem(
  exec: SqlExecutor,
  input: { name: string; now: string },
): Promise<CustomSystem> {
  return inWriteTransaction(exec, async () => {
    const system = await createCustomSystemCore(exec, input);
    await bumpDataRevisionCore(exec);
    return system;
  });
}

function assertOverrideMode(mode: string): asserts mode is SystemOverrideMode {
  if (mode !== "include" && mode !== "exclude") {
    throw new Error("systems-dao: override mode must be include or exclude");
  }
}

/** Insert a manual inclusion/exclusion while an outer writer owns the transaction. */
export async function addSystemOverrideCore(
  exec: SqlExecutor,
  input: {
    systemRef: OrrerySystemId;
    contactId: number;
    mode: SystemOverrideMode;
    now: string;
  },
): Promise<void> {
  assertOrreryLastSystem("systemRef", input.systemRef);
  assertOverrideMode(input.mode);
  await exec.runAsync(
    `INSERT INTO system_overrides (uid, system_ref, contact_id, mode, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [newUid(), input.systemRef, input.contactId, input.mode, input.now],
  );
}

export function addSystemOverride(
  exec: SqlExecutor,
  input: {
    systemRef: OrrerySystemId;
    contactId: number;
    mode: SystemOverrideMode;
    now: string;
  },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await addSystemOverrideCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

export async function listCustomSystems(
  exec: ReadOnlyExecutor,
): Promise<CustomSystem[]> {
  const rows = await exec.getAllAsync<{
    id: number;
    uid: string;
    name: string;
    created_at: string;
    modified_at: string;
  }>(
    "SELECT id, uid, name, created_at, modified_at FROM systems ORDER BY name COLLATE NOCASE, id",
  );
  return rows.map(mapSystem);
}

export async function getSystem(
  exec: ReadOnlyExecutor,
  uid: string,
): Promise<CustomSystem | null> {
  const row = await exec.getFirstAsync<{
    id: number;
    uid: string;
    name: string;
    created_at: string;
    modified_at: string;
  }>(
    "SELECT id, uid, name, created_at, modified_at FROM systems WHERE uid = ?",
    [uid],
  );
  return row ? mapSystem(row) : null;
}

export function listSystemRules(
  exec: ReadOnlyExecutor,
  systemId: number,
): Promise<SystemRule[]> {
  return exec.getAllAsync<SystemRule>(
    `SELECT id, uid, system_id AS systemId, family, value, created_at AS createdAt
       FROM system_rules WHERE system_id = ? ORDER BY id`,
    [systemId],
  );
}

export function listSystemOverrides(
  exec: ReadOnlyExecutor,
  systemRef: OrrerySystemId,
): Promise<SystemOverride[]> {
  return exec.getAllAsync<SystemOverride>(
    `SELECT id, uid, system_ref AS systemRef, contact_id AS contactId, mode,
            created_at AS createdAt
       FROM system_overrides WHERE system_ref = ? ORDER BY id`,
    [systemRef],
  );
}

export function listSystemPrefs(exec: ReadOnlyExecutor): Promise<SystemPref[]> {
  return exec.getAllAsync<SystemPref>(
    `SELECT id, uid, system_ref AS systemRef, display_order AS displayOrder,
            hidden, created_at AS createdAt, modified_at AS modifiedAt
       FROM system_prefs ORDER BY display_order, id`,
  );
}
