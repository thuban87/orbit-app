/**
 * ADR-011: query-time health; D-05 explicitly widens only All/Not to neutral rows.
 * ADR-046: dense read-time ring order, never persisted display ranks or progress.
 * ADR-047: global sun identity/lifecycle is independent of selected membership.
 * ADR-093: reuse scoped Dashboard predicates only, never Dashboard store state.
 */
import { getAppSettings } from "@/db/app-settings-dao";
import { getContactHeader } from "@/db/contact-read";
import { getContactStatus, type ProfileStatus } from "@/db/contact-status-read";
import { readOrreryImpactInputsCore } from "@/db/orrery-impact-read";
import { listOrbitingContacts } from "@/db/orrery-read";
import { getProfile } from "@/db/profile-dao";
import { PROGRESS_SQL, STATUS_SQL } from "@/db/status";
import { inReadSnapshot, type ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import {
  ALL_CONTACTS_SYSTEM,
  buildOrrerySystemWhere,
  type OrrerySystemRef,
} from "@/logic/orrery-system-logic";
import {
  mapSunOccupantLookup,
  sunOccupantIsSelf,
} from "@/logic/sun-occupant-logic";

export interface ContactIdentity {
  id: number;
  uid: string;
}
export interface OrreryCategory {
  id: number;
  uid: string;
  name: string;
  display_order: number;
}
export interface OrrerySystemMember extends ContactIdentity {
  name: string;
  photo: string | null;
  ring_seq: number | null;
  status: ProfileStatus | null;
  progress: number | null;
  last_contact: string | null;
  rarely_responds: number;
  favourite_rank: number | null;
  created_at?: string;
}
export interface OrreryMembersResult {
  status: "ready" | "missing-category";
  system: OrrerySystemRef;
  members: OrrerySystemMember[];
}

/** No mutex/BEGIN: also callable inside the guarded rank writer's transaction. */
export async function readOrrerySystemMembersCore(
  exec: ReadOnlyExecutor,
  system: OrrerySystemRef,
): Promise<OrreryMembersResult> {
  const where = buildOrrerySystemWhere(system);
  if (
    system.kind === "category" &&
    !(await exec.getFirstAsync("SELECT id FROM categories WHERE uid=?", [
      system.uid,
    ]))
  )
    return { status: "missing-category", system, members: [] };
  const members = await exec.getAllAsync<OrrerySystemMember>(
    `SELECT c.id,c.uid,c.name,c.photo,c.ring_seq,c.rarely_responds,c.favourite_rank,c.last_contact,c.created_at,
    CASE WHEN c.last_contact IS NULL THEN NULL ELSE (${PROGRESS_SQL}) END AS progress,
    CASE WHEN c.last_contact IS NULL THEN NULL ELSE (${STATUS_SQL}) END AS status
    FROM contacts c WHERE ${where.sql}
    ORDER BY COALESCE(c.ring_seq,1e9),c.created_at,c.id`,
    where.params,
  );
  return { status: "ready", system, members };
}

/** All composition receives ro, including the complete batched Gravity history. */
export async function readOrrerySystemSnapshotCore(
  ro: ReadOnlyExecutor,
  system: OrrerySystemRef,
) {
  const settings = await getAppSettings(ro);
  const profile = await getProfile(ro);
  const header =
    settings.sunContactId === null
      ? null
      : await getContactHeader(ro, settings.sunContactId);
  const status =
    settings.sunContactId === null
      ? null
      : await getContactStatus(ro, settings.sunContactId);
  const occupant = mapSunOccupantLookup(header, status?.status ?? null);
  const self = sunOccupantIsSelf({
    sunContactId: settings.sunContactId,
    occupant,
  });
  const savedSunIdentity =
    settings.sunContactId === null
      ? null
      : await ro.getFirstAsync<ContactIdentity>(
          "SELECT id,uid FROM contacts WHERE id=?",
          [settings.sunContactId],
        );
  const resolvedSunIdentity = self ? null : savedSunIdentity;
  const categories = await ro.getAllAsync<OrreryCategory>(
    "SELECT id,uid,name,display_order FROM categories ORDER BY display_order,uid",
  );
  const result = await readOrrerySystemMembersCore(ro, system);
  const impactInputs = await readOrreryImpactInputsCore(ro, [
    ...result.members.map((member) => member.id),
    ...(resolvedSunIdentity ? [resolvedSunIdentity.id] : []),
  ]);
  const orbiting = result.members.filter(
    (member) => member.id !== resolvedSunIdentity?.id,
  );
  const complete = await listOrbitingContacts(ro, {
    excludeContactId: resolvedSunIdentity?.id,
  });
  const completeContactedOrder = complete.map((row) => row.id);
  // A single static scan avoids N identity seeks while retaining the saved-sun
  // fingerprint even when archived/Unbound/neutral or outside this System.
  const identities = await ro.getAllAsync<ContactIdentity>(
    `SELECT id,uid FROM contacts WHERE
    (archived_at IS NULL AND tracking_enabled=1 AND last_contact IS NOT NULL) OR id=?`,
    [settings.sunContactId],
  );
  const byId = new Map(identities.map((row) => [row.id, row]));
  const contactIdentities = completeContactedOrder.map((id) => {
    const identity = byId.get(id);
    if (!identity)
      throw new Error("Incomplete Orrery contact identity snapshot");
    return identity;
  });
  if (
    savedSunIdentity &&
    !contactIdentities.some((row) => row.id === savedSunIdentity.id)
  )
    contactIdentities.push(savedSunIdentity);
  return {
    ...result,
    impactInputs,
    categories,
    orbiting,
    settings,
    profile,
    header,
    occupant,
    savedSunContactId: settings.sunContactId,
    resolvedSunIdentity,
    completeContactedOrder,
    contactIdentities,
    eligibleContactedVisibleIds: orbiting
      .filter((row) => row.last_contact !== null)
      .map((row) => row.id),
  };
}
export type OrrerySystemSnapshot = Awaited<
  ReturnType<typeof readOrrerySystemSnapshotCore>
>;
export function readOrrerySystemSnapshot(
  exec: SqlExecutor,
  system: OrrerySystemRef = ALL_CONTACTS_SYSTEM,
): Promise<OrrerySystemSnapshot> {
  return inReadSnapshot(exec, (ro) => readOrrerySystemSnapshotCore(ro, system));
}
/** Deletion is a domain result, never confused with a database failure. */
export class MissingOrreryCategoryError extends Error {
  constructor(public readonly snapshot: OrrerySystemSnapshot) {
    super("Orrery category no longer exists");
  }
}
