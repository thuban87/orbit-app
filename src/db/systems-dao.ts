/** Durable custom-System definitions and cross-kind override reads/writes. */
import type { OrrerySystemId } from "@/db/app-settings-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { inWriteTransaction, type ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import {
  BUILTIN_SYSTEM_LABELS,
  parseSystemRef,
  type OrrerySystemRef,
} from "@/logic/orrery-system-logic";

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

export interface SystemRuleDraft {
  family: string;
  value: string;
}

export interface DeletedSystemSnapshot {
  uid: string;
  name: string;
  rules: SystemRuleDraft[];
  overrides: Array<{ contactId: number; mode: SystemOverrideMode }>;
  prefs: { displayOrder: number | null; hidden: 0 | 1 } | null;
}

export interface SystemOverrideIntent {
  contactId: number;
  mode: SystemOverrideMode | null;
}

export interface SystemDefinitionDraft {
  /** null creates a custom System; a custom ref edits that definition. */
  systemRef: OrrerySystemId | null;
  name: string;
  rules: readonly SystemRuleDraft[];
  overrideIntent: readonly SystemOverrideIntent[];
  prunableExclusionContactIds: readonly number[];
  now: string;
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

function normalizeSystemName(name: string): string {
  const normalized = name.trim();
  if (!normalized) throw new Error("Give this System a name.");
  return normalized;
}

function assertOneChange(op: string, changes: number): void {
  if (changes !== 1) {
    throw new Error(`${op}: expected one changed row, got ${changes}`);
  }
}

async function getCustomSystemForRef(
  exec: ReadOnlyExecutor,
  systemRef: OrrerySystemId,
): Promise<CustomSystem> {
  const ref = assertMutableCustomRef(systemRef);
  const system = await getSystem(exec, ref.uid);
  if (!system) throw new Error("systems-dao: unknown custom System");
  return system;
}

/** Ensure a syntactically valid System token still exists in its catalog. */
export async function assertKnownSystemRef(
  exec: ReadOnlyExecutor,
  systemRef: OrrerySystemId,
): Promise<OrrerySystemRef> {
  const ref = parseSystemRef(systemRef);
  if (!ref) throw new Error("systems-dao: unknown System reference");
  if (ref.kind === "builtin") {
    if (Object.hasOwn(BUILTIN_SYSTEM_LABELS, ref.id)) return ref;
  } else if (ref.kind === "category") {
    if (
      await exec.getFirstAsync("SELECT id FROM categories WHERE uid = ?", [
        ref.uid,
      ])
    )
      return ref;
  } else if (await exec.getFirstAsync("SELECT id FROM systems WHERE uid = ?", [ref.uid])) {
    return ref;
  }
  throw new Error("systems-dao: unknown System reference");
}

/** Base predicates are read-only; only custom definitions may change their shape. */
export function assertMutableCustomRef(
  systemRef: OrrerySystemId,
): Extract<OrrerySystemRef, { kind: "custom" }> {
  const ref = parseSystemRef(systemRef);
  if (ref?.kind !== "custom") {
    throw new Error("systems-dao: immutable System definitions cannot be changed");
  }
  return ref;
}

/** Insert a custom definition while an outer writer owns the transaction. */
export async function createCustomSystemCore(
  exec: SqlExecutor,
  input: { name: string; now: string },
): Promise<CustomSystem> {
  const name = normalizeSystemName(input.name);
  await assertUniqueSystemName(exec, { name });
  const uid = newUid();
  const result = await exec.runAsync(
    "INSERT INTO systems (uid, name, created_at, modified_at) VALUES (?, ?, ?, ?)",
    [uid, name, input.now, input.now],
  );
  return {
    id: result.lastInsertRowId,
    uid,
    name,
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
  await setSystemOverrideCore(exec, input);
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

export async function renameSystemCore(
  exec: SqlExecutor,
  input: { systemRef: OrrerySystemId; name: string; now: string },
): Promise<CustomSystem> {
  const system = await getCustomSystemForRef(exec, input.systemRef);
  const name = normalizeSystemName(input.name);
  await assertUniqueSystemName(exec, { name, excludeId: system.id });
  const result = await exec.runAsync(
    "UPDATE systems SET name = ?, modified_at = ? WHERE id = ?",
    [name, input.now, system.id],
  );
  assertOneChange("renameSystem", result.changes);
  return { ...system, name, modifiedAt: input.now };
}

export function renameSystem(
  exec: SqlExecutor,
  input: { systemRef: OrrerySystemId; name: string; now: string },
): Promise<CustomSystem> {
  return inWriteTransaction(exec, async () => {
    const system = await renameSystemCore(exec, input);
    await bumpDataRevisionCore(exec);
    return system;
  });
}

export async function deleteSystemCore(
  exec: SqlExecutor,
  input: { systemRef: OrrerySystemId },
): Promise<DeletedSystemSnapshot> {
  const system = await getCustomSystemForRef(exec, input.systemRef);
  const rules = await exec.getAllAsync<{ family: string; value: string }>(
    "SELECT family, value FROM system_rules WHERE system_id = ? ORDER BY id",
    [system.id],
  );
  const overrides = await exec.getAllAsync<{
    contactId: number;
    mode: SystemOverrideMode;
  }>(
    "SELECT contact_id AS contactId, mode FROM system_overrides WHERE system_ref = ? ORDER BY id",
    [input.systemRef],
  );
  const prefs = await exec.getFirstAsync<{
    displayOrder: number | null;
    hidden: 0 | 1;
  }>(
    "SELECT display_order AS displayOrder, hidden FROM system_prefs WHERE system_ref = ?",
    [input.systemRef],
  );
  const deletedOverrides = await exec.runAsync(
    "DELETE FROM system_overrides WHERE system_ref = ?",
    [input.systemRef],
  );
  if (deletedOverrides.changes !== overrides.length) {
    throw new Error("deleteSystem: override rows changed during delete");
  }
  const deletedPrefs = await exec.runAsync(
    "DELETE FROM system_prefs WHERE system_ref = ?",
    [input.systemRef],
  );
  if (deletedPrefs.changes !== (prefs ? 1 : 0)) {
    throw new Error("deleteSystem: preference row changed during delete");
  }
  const deletedSystem = await exec.runAsync("DELETE FROM systems WHERE id = ?", [
    system.id,
  ]);
  assertOneChange("deleteSystem", deletedSystem.changes);
  return { uid: system.uid, name: system.name, rules, overrides, prefs };
}

export function deleteSystem(
  exec: SqlExecutor,
  input: { systemRef: OrrerySystemId },
): Promise<DeletedSystemSnapshot> {
  return inWriteTransaction(exec, async () => {
    const snapshot = await deleteSystemCore(exec, input);
    await bumpDataRevisionCore(exec);
    return snapshot;
  });
}

export async function restoreDeletedSystemCore(
  exec: SqlExecutor,
  input: { snapshot: DeletedSystemSnapshot; now: string },
): Promise<CustomSystem> {
  const { snapshot, now } = input;
  await assertUniqueSystemName(exec, { name: snapshot.name });
  const inserted = await exec.runAsync(
    "INSERT INTO systems (uid, name, created_at, modified_at) VALUES (?, ?, ?, ?)",
    [snapshot.uid, snapshot.name, now, now],
  );
  const system: CustomSystem = {
    id: inserted.lastInsertRowId,
    uid: snapshot.uid,
    name: snapshot.name,
    createdAt: now,
    modifiedAt: now,
  };
  for (const rule of snapshot.rules) {
    await exec.runAsync(
      "INSERT INTO system_rules (uid, system_id, family, value, created_at) VALUES (?, ?, ?, ?, ?)",
      [newUid(), system.id, rule.family, rule.value, now],
    );
  }
  const systemRef = `custom:${snapshot.uid}` as OrrerySystemId;
  for (const override of snapshot.overrides) {
    await exec.runAsync(
      "INSERT INTO system_overrides (uid, system_ref, contact_id, mode, created_at) VALUES (?, ?, ?, ?, ?)",
      [newUid(), systemRef, override.contactId, override.mode, now],
    );
  }
  if (snapshot.prefs) {
    await exec.runAsync(
      "INSERT INTO system_prefs (uid, system_ref, display_order, hidden, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)",
      [
        newUid(),
        systemRef,
        snapshot.prefs.displayOrder,
        snapshot.prefs.hidden,
        now,
        now,
      ],
    );
  }
  return system;
}

export function restoreDeletedSystem(
  exec: SqlExecutor,
  input: { snapshot: DeletedSystemSnapshot; now: string },
): Promise<CustomSystem> {
  return inWriteTransaction(exec, async () => {
    const system = await restoreDeletedSystemCore(exec, input);
    await bumpDataRevisionCore(exec);
    return system;
  });
}

export async function setSystemOverrideCore(
  exec: SqlExecutor,
  input: {
    systemRef: OrrerySystemId;
    contactId: number;
    mode: SystemOverrideMode | null;
    now: string;
  },
): Promise<void> {
  await assertKnownSystemRef(exec, input.systemRef);
  if (input.mode === null) {
    await exec.runAsync(
      "DELETE FROM system_overrides WHERE system_ref = ? AND contact_id = ?",
      [input.systemRef, input.contactId],
    );
    return;
  }
  assertOverrideMode(input.mode);
  const result = await exec.runAsync(
    `INSERT INTO system_overrides (uid, system_ref, contact_id, mode, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(system_ref, contact_id) DO UPDATE SET mode = excluded.mode`,
    [newUid(), input.systemRef, input.contactId, input.mode, input.now],
  );
  assertOneChange("setSystemOverride", result.changes);
}

export function setSystemOverride(
  exec: SqlExecutor,
  input: {
    systemRef: OrrerySystemId;
    contactId: number;
    mode: SystemOverrideMode | null;
    now: string;
  },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await setSystemOverrideCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

export async function pruneSystemExclusionsCore(
  exec: SqlExecutor,
  input: { systemRef: OrrerySystemId; contactIds: readonly number[] },
): Promise<void> {
  await assertKnownSystemRef(exec, input.systemRef);
  const contactIds = [...new Set(input.contactIds)];
  if (!contactIds.length) return;
  await exec.runAsync(
    `DELETE FROM system_overrides
      WHERE system_ref = ? AND mode = 'exclude'
        AND contact_id IN (${contactIds.map(() => "?").join(", ")})`,
    [input.systemRef, ...contactIds],
  );
}

export function pruneSystemExclusions(
  exec: SqlExecutor,
  input: { systemRef: OrrerySystemId; contactIds: readonly number[] },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await pruneSystemExclusionsCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

export async function resetSystemOverridesCore(
  exec: SqlExecutor,
  input: { systemRef: OrrerySystemId },
): Promise<void> {
  await assertKnownSystemRef(exec, input.systemRef);
  await exec.runAsync("DELETE FROM system_overrides WHERE system_ref = ?", [
    input.systemRef,
  ]);
}

export function resetSystemOverrides(
  exec: SqlExecutor,
  input: { systemRef: OrrerySystemId },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await resetSystemOverridesCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

/** Replace a custom System's complete predicate while the caller owns the transaction. */
export async function setSystemRulesCore(
  exec: SqlExecutor,
  input: {
    systemRef: OrrerySystemId;
    rules: readonly SystemRuleDraft[];
    now: string;
  },
): Promise<void> {
  const system = await getCustomSystemForRef(exec, input.systemRef);
  await exec.runAsync("DELETE FROM system_rules WHERE system_id = ?", [system.id]);
  for (const rule of input.rules) {
    const result = await exec.runAsync(
      "INSERT INTO system_rules (uid, system_id, family, value, created_at) VALUES (?, ?, ?, ?, ?)",
      [newUid(), system.id, rule.family, rule.value, input.now],
    );
    assertOneChange("setSystemRules", result.changes);
  }
}

export function setSystemRules(
  exec: SqlExecutor,
  input: {
    systemRef: OrrerySystemId;
    rules: readonly SystemRuleDraft[];
    now: string;
  },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await setSystemRulesCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

/** Deterministic duplicate labels are checked case-insensitively by the caller. */
export function nextDuplicateName(
  baseName: string,
  existingNamesLowercased: ReadonlySet<string>,
): string {
  const base = normalizeSystemName(baseName);
  let ordinal = 1;
  while (true) {
    const candidate = ordinal === 1 ? `${base} Copy` : `${base} Copy ${ordinal}`;
    if (!existingNamesLowercased.has(candidate.toLocaleLowerCase())) return candidate;
    ordinal += 1;
  }
}

/** Convert closed immutable predicates into the editable stored-rule vocabulary. */
export function mapBuiltinPredicateToRules(
  system: Exclude<OrrerySystemRef, { kind: "custom" }>,
): SystemRuleDraft[] {
  if (system.kind === "category") {
    return [{ family: "category", value: system.uid }];
  }
  switch (system.id) {
    case "all-contacts":
      return [{ family: "scope", value: "population" }];
    case "favorites":
      return [{ family: "favorite", value: "on" }];
    case "needs-attention":
      return [{ family: "needs-attention", value: "on" }];
    case "not-contacted":
      return [{ family: "not-contacted", value: "on" }];
    case "snoozed":
      return [{ family: "snoozed", value: "on" }];
    case "chargers":
      return [{ family: "social-battery", value: "Charger" }];
  }
}

async function existingSystemNamesLowercased(
  exec: ReadOnlyExecutor,
): Promise<Set<string>> {
  const [systems, categories] = await Promise.all([
    exec.getAllAsync<{ name: string }>("SELECT name FROM systems"),
    exec.getAllAsync<{ name: string }>("SELECT name FROM categories"),
  ]);
  return new Set(
    [
      ...Object.values(BUILTIN_SYSTEM_LABELS),
      ...systems.map((system) => system.name),
      ...categories.map((category) => category.name),
    ].map(
      (name) => name.toLocaleLowerCase(),
    ),
  );
}

async function duplicateSource(
  exec: ReadOnlyExecutor,
  systemRef: OrrerySystemId,
): Promise<{
  name: string;
  rules: SystemRuleDraft[];
  overrides: Array<{ contactId: number; mode: SystemOverrideMode }>;
}> {
  const ref = await assertKnownSystemRef(exec, systemRef);
  if (ref.kind === "custom") {
    const system = await getCustomSystemForRef(exec, systemRef);
    const [rules, overrides] = await Promise.all([
      listSystemRules(exec, system.id),
      listSystemOverrides(exec, systemRef),
    ]);
    return {
      name: system.name,
      rules: rules.map(({ family, value }) => ({ family, value })),
      overrides: overrides.map(({ contactId, mode }) => ({ contactId, mode })),
    };
  }
  if (ref.kind === "category") {
    const category = await exec.getFirstAsync<{ name: string }>(
      "SELECT name FROM categories WHERE uid = ?",
      [ref.uid],
    );
    if (!category) throw new Error("systems-dao: unknown System reference");
    return { name: category.name, rules: mapBuiltinPredicateToRules(ref), overrides: [] };
  }
  return {
    name: BUILTIN_SYSTEM_LABELS[ref.id],
    rules: mapBuiltinPredicateToRules(ref),
    overrides: [],
  };
}

export async function duplicateSystemCore(
  exec: SqlExecutor,
  input: { systemRef: OrrerySystemId; now: string },
): Promise<CustomSystem> {
  const source = await duplicateSource(exec, input.systemRef);
  const name = nextDuplicateName(
    source.name,
    await existingSystemNamesLowercased(exec),
  );
  const duplicate = await createCustomSystemCore(exec, { name, now: input.now });
  const duplicateRef = `custom:${duplicate.uid}` as OrrerySystemId;
  await setSystemRulesCore(exec, {
    systemRef: duplicateRef,
    rules: source.rules,
    now: input.now,
  });
  for (const override of source.overrides) {
    await setSystemOverrideCore(exec, {
      systemRef: duplicateRef,
      contactId: override.contactId,
      mode: override.mode,
      now: input.now,
    });
  }
  return duplicate;
}

export function duplicateSystem(
  exec: SqlExecutor,
  input: { systemRef: OrrerySystemId; now: string },
): Promise<CustomSystem> {
  return inWriteTransaction(exec, async () => {
    const duplicate = await duplicateSystemCore(exec, input);
    await bumpDataRevisionCore(exec);
    return duplicate;
  });
}

/** Compose custom definition writes without nesting the non-reentrant mutex. */
export async function saveSystemDefinitionCore(
  exec: SqlExecutor,
  draft: SystemDefinitionDraft,
): Promise<CustomSystem> {
  const system =
    draft.systemRef === null
      ? await createCustomSystemCore(exec, { name: draft.name, now: draft.now })
      : await renameSystemCore(exec, {
          systemRef: draft.systemRef,
          name: draft.name,
          now: draft.now,
        });
  const systemRef = `custom:${system.uid}` as OrrerySystemId;
  await setSystemRulesCore(exec, { systemRef, rules: draft.rules, now: draft.now });
  for (const intent of draft.overrideIntent) {
    await setSystemOverrideCore(exec, {
      systemRef,
      contactId: intent.contactId,
      mode: intent.mode,
      now: draft.now,
    });
  }
  await pruneSystemExclusionsCore(exec, {
    systemRef,
    contactIds: draft.prunableExclusionContactIds,
  });
  return system;
}

export function saveSystemDefinition(
  exec: SqlExecutor,
  draft: SystemDefinitionDraft,
): Promise<CustomSystem> {
  return inWriteTransaction(exec, async () => {
    const system = await saveSystemDefinitionCore(exec, draft);
    await bumpDataRevisionCore(exec);
    return system;
  });
}

/** Immutable bases own only manual deltas, never a systems or rules row. */
export async function saveMembershipOverridesCore(
  exec: SqlExecutor,
  input: {
    systemRef: OrrerySystemId;
    overrideIntent: readonly SystemOverrideIntent[];
    prunableExclusionContactIds: readonly number[];
    now: string;
  },
): Promise<void> {
  await assertKnownSystemRef(exec, input.systemRef);
  for (const intent of input.overrideIntent) {
    await setSystemOverrideCore(exec, {
      systemRef: input.systemRef,
      contactId: intent.contactId,
      mode: intent.mode,
      now: input.now,
    });
  }
  await pruneSystemExclusionsCore(exec, {
    systemRef: input.systemRef,
    contactIds: input.prunableExclusionContactIds,
  });
}

export function saveMembershipOverrides(
  exec: SqlExecutor,
  input: {
    systemRef: OrrerySystemId;
    overrideIntent: readonly SystemOverrideIntent[];
    prunableExclusionContactIds: readonly number[];
    now: string;
  },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await saveMembershipOverridesCore(exec, input);
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
