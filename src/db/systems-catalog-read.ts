/** Read-only catalog and bounded count primitives for the Orrery System switcher. */
import {
  ORRERY_BUILTIN_SYSTEM_IDS,
  type OrrerySystemId,
} from "@/db/app-settings-dao";
import { localDateTime } from "@/db/database";
import type { ImpactInputs } from "@/db/impact-read";
import { readOrreryImpactInputsCore } from "@/db/orrery-impact-read";
import {
  listCustomSystems,
  listSystemPrefs,
  type SystemPref,
} from "@/db/systems-dao";
import type { ReadOnlyExecutor } from "@/db/transaction";
import {
  BUILTIN_SYSTEMS,
  buildOrrerySystemWhere,
  type OrrerySystemRef,
  type SystemDescriptor,
  systemRefId,
} from "@/logic/orrery-system-logic";
import {
  type BrokenRule,
  resolveCustomSystemMembers,
  type SystemGravityInputsLoader,
} from "@/logic/system-rule-resolver";

type FixedSystemRef = Exclude<OrrerySystemRef, { kind: "custom" }>;

/** The selector's complete, non-resolved catalog descriptor. */
export type SystemCatalogEntry = SystemDescriptor & {
  displayOrder: number | null;
  hidden: boolean;
  hasOverrides: boolean;
  /** Category fallback order is its durable display order. */
  categoryOrder?: number;
  /** Custom fallback order is durable creation time, never its mutable name. */
  createdAt?: string;
};

export interface SystemMemberCount {
  count: number;
  brokenRules: BrokenRule[];
}

function systemPrefByRef(
  prefs: readonly SystemPref[],
): Map<OrrerySystemId, SystemPref> {
  return new Map(prefs.map((pref) => [pref.systemRef, pref]));
}

function catalogEntry(
  descriptor: SystemDescriptor,
  prefs: ReadonlyMap<OrrerySystemId, SystemPref>,
  overridden: ReadonlySet<OrrerySystemId>,
  extra: Pick<SystemCatalogEntry, "categoryOrder" | "createdAt"> = {},
): SystemCatalogEntry {
  const pref = prefs.get(descriptor.id);
  return {
    ...descriptor,
    displayOrder: pref?.displayOrder ?? null,
    hidden: pref?.hidden === 1,
    hasOverrides: overridden.has(descriptor.id),
    ...extra,
  };
}

/**
 * Reads descriptors only. Membership resolution deliberately waits until the
 * user opens the switcher, where it can be bounded and cancelled by the owner.
 */
export async function readSystemsCatalog(
  exec: ReadOnlyExecutor,
): Promise<SystemCatalogEntry[]> {
  const [categories, customSystems, prefs, overrideRows] = await Promise.all([
    exec.getAllAsync<{ uid: string; name: string; display_order: number }>(
      "SELECT uid, name, display_order FROM categories ORDER BY display_order, uid",
    ),
    listCustomSystems(exec),
    listSystemPrefs(exec),
    exec.getAllAsync<{ systemRef: OrrerySystemId }>(
      "SELECT DISTINCT system_ref AS systemRef FROM system_overrides",
    ),
  ]);
  const prefByRef = systemPrefByRef(prefs);
  const overridden = new Set(overrideRows.map((row) => row.systemRef));
  return [
    ...BUILTIN_SYSTEMS.map((row) => catalogEntry(row, prefByRef, overridden)),
    ...categories.map((row) =>
      catalogEntry(
        {
          id: `category:${row.uid}` as OrrerySystemId,
          ref: { kind: "category", uid: row.uid },
          name: row.name,
        },
        prefByRef,
        overridden,
        { categoryOrder: row.display_order },
      ),
    ),
    ...customSystems.map((row) =>
      catalogEntry(
        {
          id: `custom:${row.uid}` as OrrerySystemId,
          ref: { kind: "custom", uid: row.uid },
          name: row.name,
        },
        prefByRef,
        overridden,
        { createdAt: row.createdAt },
      ),
    ),
  ];
}

type OverrideRow = {
  systemRef: OrrerySystemId;
  contactId: number;
  mode: "include" | "exclude";
};

/**
 * One fixed-predicate COUNT pass, then a bounded override correction pass.
 * SQL fragments come only from the closed System enum; every runtime value is
 * still parameter-bound.
 */
export async function countBuiltinAndCategorySystemMembers(
  exec: ReadOnlyExecutor,
  refs: readonly FixedSystemRef[],
): Promise<Map<OrrerySystemId, number>> {
  const unique = [
    ...new Map(refs.map((ref) => [systemRefId(ref), ref])).values(),
  ];
  const counts = new Map<OrrerySystemId, number>(
    unique.map((ref) => [systemRefId(ref), 0]),
  );
  if (!unique.length) return counts;

  const countParts: string[] = [];
  const countParams: unknown[] = [];
  for (const ref of unique) {
    const where = buildOrrerySystemWhere(ref);
    countParts.push(
      `SELECT ? AS systemRef, COUNT(*) AS count FROM contacts c WHERE ${where.sql}`,
    );
    countParams.push(systemRefId(ref), ...where.params);
  }
  const countRows = await exec.getAllAsync<{
    systemRef: OrrerySystemId;
    count: number;
  }>(countParts.join(" UNION ALL "), countParams);
  for (const row of countRows) counts.set(row.systemRef, row.count);

  const ids = unique.map(systemRefId);
  const overrides = await exec.getAllAsync<OverrideRow>(
    `SELECT system_ref AS systemRef, contact_id AS contactId, mode
       FROM system_overrides WHERE system_ref IN (${ids.map(() => "?").join(", ")})`,
    ids,
  );
  if (!overrides.length) return counts;

  const refById = new Map(unique.map((ref) => [systemRefId(ref), ref]));
  const matchParts: string[] = [];
  const matchParams: unknown[] = [];
  for (const override of overrides) {
    const ref = refById.get(override.systemRef);
    if (!ref) continue;
    const where = buildOrrerySystemWhere(ref);
    matchParts.push(
      `SELECT ? AS systemRef, c.id AS contactId,
        CASE WHEN ${where.sql} THEN 1 ELSE 0 END AS candidate,
        CASE WHEN c.archived_at IS NULL AND c.tracking_enabled = 1 THEN 1 ELSE 0 END AS eligible
       FROM contacts c WHERE c.id = ?`,
    );
    matchParams.push(override.systemRef, ...where.params, override.contactId);
  }
  const matches = await exec.getAllAsync<{
    systemRef: OrrerySystemId;
    contactId: number;
    candidate: 0 | 1;
    eligible: 0 | 1;
  }>(matchParts.join(" UNION ALL "), matchParams);
  const matchByKey = new Map(
    matches.map((row) => [`${row.systemRef}:${row.contactId}`, row]),
  );
  for (const override of overrides) {
    const match = matchByKey.get(`${override.systemRef}:${override.contactId}`);
    if (!match) continue;
    const count = counts.get(override.systemRef) ?? 0;
    if (override.mode === "exclude" && match.candidate === 1)
      counts.set(override.systemRef, Math.max(0, count - 1));
    if (
      override.mode === "include" &&
      match.candidate === 0 &&
      match.eligible === 1
    )
      counts.set(override.systemRef, count + 1);
  }
  return counts;
}

function makeGravityInputsLoader(
  exec: ReadOnlyExecutor,
): SystemGravityInputsLoader {
  const cache = new Map<number, ImpactInputs>();
  const preload = async (ids: readonly number[]) => {
    const missing = ids.filter((id) => !cache.has(id));
    if (!missing.length) return;
    const inputs = await readOrreryImpactInputsCore(exec, missing);
    for (const [id, input] of inputs) cache.set(id, input);
  };
  const loader: SystemGravityInputsLoader = async (id) => {
    await preload([id]);
    return cache.get(id) ?? null;
  };
  loader.preload = preload;
  return loader;
}

/**
 * Count one System. Custom Systems always use the resolver (including a
 * gravity-free custom definition) so rules and overrides retain their meaning.
 */
export async function countSystemMembers(
  exec: ReadOnlyExecutor,
  ref: OrrerySystemRef,
): Promise<SystemMemberCount> {
  if (ref.kind !== "custom") {
    return {
      count:
        (await countBuiltinAndCategorySystemMembers(exec, [ref])).get(
          systemRefId(ref),
        ) ?? 0,
      brokenRules: [],
    };
  }
  const resolved = await resolveCustomSystemMembers(
    exec,
    ref,
    localDateTime(),
    makeGravityInputsLoader(exec),
  );
  return {
    count: resolved.memberIds.length,
    brokenRules: resolved.brokenRules,
  };
}

export { ORRERY_BUILTIN_SYSTEM_IDS };
