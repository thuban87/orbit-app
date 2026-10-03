/**
 * Orrery perf fixture — seed, verify, re-anchor and restore (38.7 Plan 01, D-56).
 *
 * DEV-ONLY. Reached solely from the `__DEV__` dev menu (`uat-probes.ts`, which
 * App.tsx requires only inside `if (__DEV__)`), so it never enters a release
 * bundle (dev-override-release-guard.test.ts). It writes the deterministic spec
 * in `orrery-seed-spec.ts` (the labs' shared Size cast + an All Contacts stress
 * set) on a TEST phone so the Day-1 baseline, the D-44 spike and the final
 * release pass measure the same data. No network, no device Contacts, no AI.
 *
 * Every write goes through the app's own Core writers inside ONE
 * `inWriteTransaction` per step (the mutex is non-reentrant, so nothing here
 * calls a wrapped writer from inside one):
 *   - `createContactFullCore` (contact + latest touchpoint + moons),
 *   - `insertInteractionCore` + `recomputeLastContactCore` (older history; the
 *     single recency writer derives `last_contact`, never set directly),
 *   - `saveSystemDefinitionCore` (custom Systems with explicit includes, the
 *     shape the System Builder writes),
 *   - `editTouchpointFullCore` (re-anchoring),
 *   - `setContactPhotoCore` / `clearContactPhotoCore` (photos),
 *   - `updateAppSettings` / `rewriteRingSeq` (C-M5 Orrery inputs).
 *
 * A part (cast or stress) is created in a single transaction, so an interrupted
 * seed leaves either all of a part's rows or none. Photos are file writes and
 * run after the commit; a missing one is caught by verification.
 *
 * Idempotent, but never by name alone: when a part's marker System exists the
 * part is VERIFIED and reported `present` only if it matches the spec exactly;
 * otherwise `partial` with its problems, and nothing further is written (the
 * operator stops and reports; a measured fixture is never silently topped up).
 */
import {
  getAppSettings,
  type OrrerySystemId,
  updateAppSettings,
} from "@/db/app-settings-dao";
import {
  clearContactPhotoCore,
  createContactFullCore,
  setContactPhotoCore,
} from "@/db/contacts-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { localDateTime } from "@/db/database";
import { listOrbitingContacts } from "@/db/orrery-read";
import { readOrrerySystemMembersCore } from "@/db/orrery-system-read";
import {
  editTouchpointFullCore,
  insertInteractionCore,
  recomputeLastContactCore,
} from "@/db/recency-dao";
import { rewriteRingSeq } from "@/db/ring-seq-dao";
import {
  type CustomSystem,
  listCustomSystems,
  saveSystemDefinitionCore,
} from "@/db/systems-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { ALL_CONTACTS_SYSTEM } from "@/logic/orrery-system-logic";
import { formatLocalDate } from "@/utils/dates";
import {
  buildOrrerySeedPlan,
  CAST_MARKER_SYSTEM_NAME,
  FIXTURE_PHOTO_PX,
  ORRERY_FIXTURE_PREFERENCES,
  type OrrerySeedPlan,
  SEED_SPEC_VERSION,
  type SeedMember,
  type SeedPart,
  STRESS_SYSTEM_NAME,
} from "./orrery-seed-spec";

// --- Tunables -----------------------------------------------------------------
/** Contacts per IN (…) read; well under SQLite's bound-parameter limit. */
const ID_CHUNK = 400;
/** Problems listed per check before the rest is summarised as a count. */
const MAX_LISTED = 8;

// --- Types --------------------------------------------------------------------
export interface OrrerySeedDeps {
  /** Write the spec's procedural photo for one contact (file + DB reference). */
  writePhoto(
    exec: SqlExecutor,
    contactId: number,
    seedIndex: number,
  ): Promise<void>;
  /**
   * Remove a contact's photo. Optional: without it the DB reference is cleared
   * through `clearContactPhotoCore` only (node tests have no file system).
   */
  clearPhoto?(exec: SqlExecutor, contactId: number, now: string): Promise<void>;
  now(): Date;
  log?(message: string): void;
}

/** `skipped` = absent, not created because another part is `partial`. */
export type SeedPartStatus = "created" | "present" | "partial" | "skipped";

export interface OrrerySeedResult {
  cast: SeedPartStatus;
  stress: SeedPartStatus;
  allContacts: number;
  offsetDays: number | null;
  problems: string[];
}

export interface OrreryFixtureVerification {
  ok: boolean;
  /** The common age (days) of every seeded contact's touchpoints; null if none. */
  offsetDays: number | null;
  problems: string[];
  /** The same problems by part; `orrery` = preferences, sun and ring order. */
  parts: Record<SeedPart | "orrery", string[]>;
}

export interface VerifyOptions {
  /** The sun occupant recorded at seed time (null = the user, the default). */
  expectedSunContactId?: number | null;
}

interface SeededContact {
  spec: SeedMember;
  id: number;
  interval: number | null;
  rarely: number;
  photo: string | null;
  lastContact: string | null;
}

// --- Date helpers (local calendar, never UTC) ---------------------------------
const DAY_MS = 86_400_000;

/** Whole local calendar days from `fromDate` (YYYY-MM-DD) to `toDate`. */
function calendarDayDiff(fromDate: string, toDate: string): number {
  const [fy, fm, fd] = fromDate.split("-").map(Number);
  const [ty, tm, td] = toDate.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS,
  );
}

/** `hour`:00:00 local, `daysAgo` calendar days before `anchor`'s local day. */
function touchpointAt(anchor: Date, daysAgo: number, hour: number): string {
  return localDateTime(
    new Date(
      anchor.getFullYear(),
      anchor.getMonth(),
      anchor.getDate() - daysAgo,
      hour,
      0,
      0,
    ),
  );
}

/** Shift a stored local `YYYY-MM-DD HH:MM:SS` by whole calendar days. */
function shiftLocal(stored: string, days: number): string {
  const [date, time = "00:00:00"] = stored.split(" ");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm, ss] = time.split(":").map(Number);
  return localDateTime(new Date(y, m - 1, d + days, hh, mm, ss));
}

function listed(label: string, items: readonly string[]): string {
  const shown = items.slice(0, MAX_LISTED).join(", ");
  const more =
    items.length > MAX_LISTED ? ` (+${items.length - MAX_LISTED} more)` : "";
  return `${label}: ${shown}${more}`;
}

function chunks<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += ID_CHUNK)
    out.push(items.slice(i, i + ID_CHUNK));
  return out;
}

const marks = (n: number) => Array.from({ length: n }, () => "?").join(", ");

// --- Reads ----------------------------------------------------------------------
async function systemsByName(
  exec: SqlExecutor,
): Promise<Map<string, CustomSystem>> {
  const systems = await listCustomSystems(exec);
  return new Map(systems.map((system) => [system.name, system]));
}

/** Members through the Orrery's own custom-System read (what the Orrery draws). */
async function memberIdsByName(
  exec: SqlExecutor,
  system: CustomSystem,
): Promise<Map<string, number[]>> {
  const result = await readOrrerySystemMembersCore(exec, {
    kind: "custom",
    uid: system.uid,
  });
  const byName = new Map<string, number[]>();
  for (const member of result.members)
    byName.set(member.name, [...(byName.get(member.name) ?? []), member.id]);
  return byName;
}

/**
 * Resolve each seeded contact through its part's widest System ("Size 120" for
 * the cast, "Orrery Stress" for the stress set). A name that resolves to zero
 * or several members is a problem, never a guess.
 */
async function resolveSeeded(
  exec: SqlExecutor,
  plan: OrrerySeedPlan,
  systems: Map<string, CustomSystem>,
  parts: Record<SeedPart | "orrery", string[]>,
): Promise<SeededContact[]> {
  const seeded: SeededContact[] = [];
  for (const part of ["cast", "stress"] as const) {
    const widest = plan.systems
      .filter((s) => s.part === part)
      .reduce((a, b) => (b.members.length > a.members.length ? b : a));
    const system = systems.get(widest.name);
    if (!system) continue;
    const byName = await memberIdsByName(exec, system);
    const ambiguous: string[] = [];
    const ids: Array<{ spec: SeedMember; id: number }> = [];
    for (const spec of plan[part]) {
      const found = byName.get(spec.name) ?? [];
      if (found.length === 1) ids.push({ spec, id: found[0] });
      else if (found.length > 1) ambiguous.push(spec.name);
    }
    if (ambiguous.length)
      parts[part].push(listed(`${widest.name} has duplicate names`, ambiguous));
    for (const batch of chunks(ids)) {
      const rows = await exec.getAllAsync<{
        id: number;
        interval_days: number | null;
        rarely_responds: number;
        photo: string | null;
        last_contact: string | null;
      }>(
        `SELECT id, interval_days, rarely_responds, photo, last_contact
           FROM contacts WHERE id IN (${marks(batch.length)})`,
        batch.map((entry) => entry.id),
      );
      const byId = new Map(rows.map((row) => [row.id, row]));
      for (const entry of batch) {
        const row = byId.get(entry.id);
        if (!row) continue;
        seeded.push({
          spec: entry.spec,
          id: row.id,
          interval: row.interval_days,
          rarely: row.rarely_responds,
          photo: row.photo,
          lastContact: row.last_contact,
        });
      }
    }
  }
  return seeded;
}

async function touchpointsByContact(
  exec: SqlExecutor,
  ids: readonly number[],
): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  for (const batch of chunks(ids)) {
    const rows = await exec.getAllAsync<{
      contact_id: number;
      occurred_at: string;
    }>(
      `SELECT contact_id, occurred_at FROM interactions
        WHERE contact_id IN (${marks(batch.length)})`,
      [...batch],
    );
    for (const row of rows)
      out.set(row.contact_id, [
        ...(out.get(row.contact_id) ?? []),
        row.occurred_at,
      ]);
  }
  for (const list of out.values()) list.sort().reverse();
  return out;
}

async function moonsByContact(
  exec: SqlExecutor,
  ids: readonly number[],
): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  for (const batch of chunks(ids)) {
    const rows = await exec.getAllAsync<{
      contact_id: number;
      person_name: string;
      relation_type: string | null;
    }>(
      `SELECT contact_id, person_name, relation_type FROM relationships
        WHERE deleted_at IS NULL AND contact_id IN (${marks(batch.length)})`,
      [...batch],
    );
    for (const row of rows)
      out.set(row.contact_id, [
        ...(out.get(row.contact_id) ?? []),
        `${row.person_name}/${row.relation_type ?? ""}`,
      ]);
  }
  for (const list of out.values()) list.sort();
  return out;
}

/** Spec ring order: contacted seeded contacts, cast then stress, by index. */
function specRingOrder(seeded: readonly SeededContact[]): number[] {
  return seeded
    .filter((entry) => entry.spec.days !== null)
    .sort(
      (a, b) =>
        (a.spec.part === b.spec.part ? 0 : a.spec.part === "cast" ? -1 : 1) ||
        a.spec.index - b.spec.index,
    )
    .map((entry) => entry.id);
}

const sameIds = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

// --- Verify ---------------------------------------------------------------------
/**
 * Check the fixture against the spec as of `now`: every Size System's exact
 * membership (through the Orrery's member read), the stress membership, photo
 * presence, interval, rarely-responds, moons, every touchpoint at ONE common
 * offset, the three Orrery preferences, the sun occupant and the seeded
 * contacts' relative ring order.
 */
export async function verifyOrreryPerfFixture(
  exec: SqlExecutor,
  now: Date,
  options: VerifyOptions = {},
): Promise<OrreryFixtureVerification> {
  const plan = buildOrrerySeedPlan();
  const parts: Record<SeedPart | "orrery", string[]> = {
    cast: [],
    stress: [],
    orrery: [],
  };
  const systems = await systemsByName(exec);

  for (const specSystem of plan.systems) {
    const problems = parts[specSystem.part];
    const system = systems.get(specSystem.name);
    if (!system) {
      problems.push(`System "${specSystem.name}" is missing`);
      continue;
    }
    const expected = new Set(
      specSystem.members.map((i) => plan[specSystem.part][i].name),
    );
    const actual = await memberIdsByName(exec, system);
    const missing = [...expected].filter((name) => !actual.has(name));
    const extra = [...actual.keys()].filter((name) => !expected.has(name));
    if (missing.length)
      problems.push(listed(`${specSystem.name} is missing`, missing));
    if (extra.length)
      problems.push(listed(`${specSystem.name} has extra members`, extra));
  }

  const seeded = await resolveSeeded(exec, plan, systems, parts);
  const ids = seeded.map((entry) => entry.id);
  const touchpoints = await touchpointsByContact(exec, ids);
  const moons = await moonsByContact(exec, ids);
  const today = formatLocalDate(now);

  // Per-touchpoint age beyond the spec; the common value is the fixture offset.
  const offsets = new Map<SeededContact, number[]>();
  const tally = new Map<number, number>();
  for (const entry of seeded) {
    const { spec } = entry;
    const problems = parts[spec.part];
    const label = `${spec.name} (${spec.part} ${spec.index})`;
    if (entry.interval !== spec.interval)
      problems.push(
        `${label}: interval ${entry.interval} != spec ${spec.interval}`,
      );
    if (entry.rarely !== spec.rarely)
      problems.push(
        `${label}: rarely-responds ${entry.rarely} != spec ${spec.rarely}`,
      );
    if ((entry.photo !== null) !== spec.photo)
      problems.push(
        `${label}: photo ${entry.photo === null ? "absent" : "present"}, spec ${spec.photo ? "has one" : "has none"}`,
      );
    const wantMoons = spec.moons
      .map((m) => `${m.personName}/${m.relationType}`)
      .sort();
    const gotMoons = moons.get(entry.id) ?? [];
    if (wantMoons.join("|") !== gotMoons.join("|"))
      problems.push(
        `${label}: moons [${gotMoons.join(", ")}] != spec [${wantMoons.join(", ")}]`,
      );
    const stored = touchpoints.get(entry.id) ?? [];
    if (stored.length !== spec.touchpoints.length) {
      problems.push(
        `${label}: ${stored.length} touchpoints != spec ${spec.touchpoints.length}`,
      );
      continue;
    }
    if (spec.days === null) {
      if (entry.lastContact !== null)
        problems.push(`${label}: never-contacted but last_contact is set`);
      continue;
    }
    if (entry.lastContact !== stored[0])
      problems.push(
        `${label}: last_contact ${entry.lastContact} != latest touchpoint ${stored[0]}`,
      );
    const ages = stored.map(
      (occurred, k) =>
        calendarDayDiff(occurred.slice(0, 10), today) -
        spec.touchpoints[k].daysAgo,
    );
    offsets.set(entry, ages);
    for (const age of ages) tally.set(age, (tally.get(age) ?? 0) + 1);
  }

  let offsetDays: number | null = null;
  for (const [age, count] of tally)
    if (offsetDays === null || count > (tally.get(offsetDays) ?? 0))
      offsetDays = age;
  for (const [entry, ages] of offsets)
    if (ages.some((age) => age !== offsetDays))
      parts[entry.spec.part].push(
        `${entry.spec.name} (${entry.spec.part} ${entry.spec.index}): touchpoint ages [${ages.join(", ")}] differ from the common offset ${offsetDays}`,
      );

  // C-M5: the persistent Orrery inputs.
  const settings = await getAppSettings(exec);
  const pinned = ORRERY_FIXTURE_PREFERENCES;
  if (settings.orreryDensity !== pinned.density)
    parts.orrery.push(
      `orrery_density ${settings.orreryDensity} != ${pinned.density}`,
    );
  if (settings.orrerySatellitesEnabled !== pinned.satellitesEnabled)
    parts.orrery.push(
      `orrery_satellites_enabled ${settings.orrerySatellitesEnabled} != ${pinned.satellitesEnabled}`,
    );
  const lastSystem = systems.get(pinned.lastSystemName);
  if (lastSystem && settings.orreryLastSystem !== `custom:${lastSystem.uid}`)
    parts.orrery.push(
      `orrery_last_system ${settings.orreryLastSystem} is not "${pinned.lastSystemName}"`,
    );
  const expectedSun = options.expectedSunContactId ?? null;
  if (settings.sunContactId !== expectedSun)
    parts.orrery.push(
      `sun_contact_id ${settings.sunContactId} != seed-time ${expectedSun}`,
    );
  const orbiting = (
    await listOrbitingContacts(exec, {
      excludeContactId: settings.sunContactId,
    })
  ).map((row) => row.id);
  const seededIds = new Set(specRingOrder(seeded));
  const actualOrder = orbiting.filter((id) => seededIds.has(id));
  const wantOrder = specRingOrder(seeded).filter(
    (id) => id !== settings.sunContactId,
  );
  if (!sameIds(actualOrder, wantOrder)) {
    const byId = new Map(seeded.map((entry) => [entry.id, entry.spec.name]));
    const firstDiff = wantOrder.findIndex((id, i) => actualOrder[i] !== id);
    parts.orrery.push(
      `ring order differs from the spec at position ${firstDiff} (spec ${byId.get(wantOrder[firstDiff])}, actual ${byId.get(actualOrder[firstDiff])})`,
    );
  }

  const problems = [...parts.cast, ...parts.stress, ...parts.orrery];
  return { ok: problems.length === 0, offsetDays, problems, parts };
}

// --- Seed -----------------------------------------------------------------------
/** Write one part (contacts, touchpoints, moons, its Systems) in ONE transaction. */
async function createPart(
  exec: SqlExecutor,
  plan: OrrerySeedPlan,
  part: SeedPart,
  anchor: Date,
  now: string,
): Promise<number[]> {
  return inWriteTransaction(exec, async () => {
    const ids: number[] = [];
    for (const spec of plan[part]) {
      const [latest, ...older] = spec.touchpoints;
      const { contactId } = await createContactFullCore(exec, {
        uid: newUid(),
        name: spec.name,
        intervalDays: spec.interval,
        rarelyResponds: spec.rarely,
        now,
        firstInteraction: latest
          ? {
              uid: newUid(),
              occurredAt: touchpointAt(anchor, latest.daysAgo, latest.hour),
              channel: latest.channel,
              direction: "outbound",
              connected: 1,
            }
          : undefined,
        relationships: spec.moons.map((moon) => ({
          personName: moon.personName,
          relationType: moon.relationType,
        })),
      });
      for (const touchpoint of older)
        await insertInteractionCore(exec, contactId, now, {
          uid: newUid(),
          occurredAt: touchpointAt(anchor, touchpoint.daysAgo, touchpoint.hour),
          channel: touchpoint.channel,
          direction: "outbound",
          connected: 1,
        });
      if (older.length) await recomputeLastContactCore(exec, contactId, now);
      ids.push(contactId);
    }
    for (const system of plan.systems.filter((s) => s.part === part))
      await saveSystemDefinitionCore(exec, {
        systemRef: null,
        name: system.name,
        rules: [],
        overrideIntent: system.members.map((i) => ({
          contactId: ids[i],
          mode: "include" as const,
        })),
        prunableExclusionContactIds: [],
        now,
      });
    await bumpDataRevisionCore(exec);
    return ids;
  });
}

/** A part with no marker System must also have no seeded contacts lying around. */
async function strayContacts(
  exec: SqlExecutor,
  members: readonly SeedMember[],
): Promise<string[]> {
  const found: string[] = [];
  for (const batch of chunks(members.map((m) => m.name))) {
    const rows = await exec.getAllAsync<{ name: string }>(
      `SELECT name FROM contacts WHERE archived_at IS NULL
         AND name IN (${marks(batch.length)})`,
      batch,
    );
    found.push(...rows.map((row) => row.name));
  }
  return found;
}

async function countAllContacts(exec: SqlExecutor): Promise<number> {
  const result = await readOrrerySystemMembersCore(exec, ALL_CONTACTS_SYSTEM);
  return result.members.length;
}

/**
 * Seed the Size cast and the stress set once. See the module header for the
 * idempotency rule. A part created while the other is already present is
 * written at the present part's offset, so the whole fixture ages together.
 */
export async function seedOrreryPerfFixture(
  exec: SqlExecutor,
  deps: OrrerySeedDeps,
): Promise<OrrerySeedResult> {
  const nowDate = deps.now();
  const now = localDateTime(nowDate);
  const plan = buildOrrerySeedPlan();
  const systems = await systemsByName(exec);
  const markers: Record<SeedPart, string> = {
    cast: CAST_MARKER_SYSTEM_NAME,
    stress: STRESS_SYSTEM_NAME,
  };
  const present: Record<SeedPart, boolean> = {
    cast: systems.has(markers.cast),
    stress: systems.has(markers.stress),
  };
  const before =
    present.cast || present.stress
      ? await verifyOrreryPerfFixture(exec, nowDate)
      : null;
  const status: Record<SeedPart, SeedPartStatus> = {
    cast: "skipped",
    stress: "skipped",
  };
  const problems: string[] = [];
  for (const part of ["cast", "stress"] as const) {
    if (present[part]) {
      const partProblems = before?.parts[part] ?? [];
      status[part] = partProblems.length ? "partial" : "present";
      problems.push(...partProblems);
    } else {
      const strays = await strayContacts(exec, plan[part]);
      if (strays.length) {
        status[part] = "partial";
        problems.push(
          listed(
            `${part} contacts exist without the "${markers[part]}" System`,
            strays,
          ),
        );
      }
    }
  }
  if (before) problems.push(...before.parts.orrery);

  const blocked = status.cast === "partial" || status.stress === "partial";
  const toCreate = (["cast", "stress"] as const).filter(
    (part) => !blocked && !present[part],
  );
  const offsetDays = before?.offsetDays ?? 0;
  if (toCreate.length) {
    // Anchor the new part at the existing fixture's age (0 on a fresh phone).
    const anchor = new Date(
      nowDate.getFullYear(),
      nowDate.getMonth(),
      nowDate.getDate() - offsetDays,
    );
    const created = new Map<SeedPart, number[]>();
    for (const part of toCreate)
      created.set(part, await createPart(exec, plan, part, anchor, now));
    for (const [part, ids] of created)
      for (const spec of plan[part])
        if (spec.photo)
          await deps.writePhoto(exec, ids[spec.index], spec.photoSeed);
    const prefs = await restoreOrreryPerfFixturePreferences(exec, deps);
    const after = await verifyOrreryPerfFixture(exec, nowDate);
    problems.length = 0;
    problems.push(...prefs.problems);
    for (const part of ["cast", "stress"] as const) {
      problems.push(...after.parts[part]);
      if (created.has(part))
        status[part] = after.parts[part].length ? "partial" : "created";
    }
    problems.push(...after.parts.orrery.filter((p) => !problems.includes(p)));
  }

  const allContacts = await countAllContacts(exec);
  const finalOffset = toCreate.length
    ? offsetDays
    : (before?.offsetDays ?? null);
  deps.log?.(
    `orrery-seed cast=${status.cast} stress=${status.stress} allContacts=${allContacts} spec=${SEED_SPEC_VERSION} offsetDays=${finalOffset}${problems.length ? ` problems=${problems.join(" | ")}` : ""}`,
  );
  return {
    cast: status.cast,
    stress: status.stress,
    allContacts,
    offsetDays: finalOffset,
    problems,
  };
}

// --- Re-anchor ------------------------------------------------------------------
/**
 * Shift every seeded contact's touchpoints by whole days so that, as of
 * `deps.now()`, every one sits at `offsetDays` beyond its spec age. Status is
 * derived at query time from `date('now','localtime')`, so seeded data ages
 * between the baseline and the final pass; this puts it back. Each row goes
 * through `editTouchpointFullCore` (every stored column re-supplied, recency
 * recomputed by the single writer), in ONE transaction.
 */
export async function reanchorOrreryPerfFixture(
  exec: SqlExecutor,
  deps: OrrerySeedDeps,
  options: { offsetDays: number } & VerifyOptions,
): Promise<OrreryFixtureVerification> {
  if (!Number.isInteger(options.offsetDays) || options.offsetDays < 0)
    throw new Error(
      `reanchorOrreryPerfFixture: offsetDays must be a whole number >= 0, got ${options.offsetDays}`,
    );
  const nowDate = deps.now();
  const now = localDateTime(nowDate);
  const today = formatLocalDate(nowDate);
  const plan = buildOrrerySeedPlan();
  const parts: Record<SeedPart | "orrery", string[]> = {
    cast: [],
    stress: [],
    orrery: [],
  };
  const seeded = await resolveSeeded(
    exec,
    plan,
    await systemsByName(exec),
    parts,
  );
  const edits: Array<{
    id: number;
    contactId: number;
    occurredAt: string;
    channel: string;
    direction: string | null;
    connected: number;
    quality: string | null;
    note: string | null;
    duration: number | null;
    allowAi: number;
  }> = [];
  for (const batch of chunks(
    seeded.filter((entry) => entry.lastContact !== null),
  )) {
    const byId = new Map(batch.map((entry) => [entry.id, entry]));
    const rows = await exec.getAllAsync<{
      id: number;
      contact_id: number;
      occurred_at: string;
      channel: string;
      direction: string | null;
      connected: number;
      quality: string | null;
      note: string | null;
      duration: number | null;
      allow_ai: number;
    }>(
      `SELECT id, contact_id, occurred_at, channel, direction, connected,
              quality, note, duration, allow_ai
         FROM interactions WHERE contact_id IN (${marks(batch.length)})`,
      batch.map((entry) => entry.id),
    );
    for (const row of rows) {
      const entry = byId.get(row.contact_id);
      if (!entry?.lastContact || entry.spec.days === null) continue;
      // Age of the contact's latest touchpoint beyond its spec age, today.
      const current =
        calendarDayDiff(entry.lastContact.slice(0, 10), today) -
        entry.spec.days;
      const shift = current - options.offsetDays;
      if (shift === 0) continue;
      edits.push({
        id: row.id,
        contactId: row.contact_id,
        occurredAt: shiftLocal(row.occurred_at, shift),
        channel: row.channel,
        direction: row.direction,
        connected: row.connected,
        quality: row.quality,
        note: row.note,
        duration: row.duration,
        allowAi: row.allow_ai,
      });
    }
  }
  const future = edits.filter((edit) => edit.occurredAt > now);
  if (future.length)
    throw new Error(
      `reanchorOrreryPerfFixture: offset ${options.offsetDays} would move ${future.length} touchpoint(s) into the future`,
    );
  if (edits.length)
    await inWriteTransaction(exec, async () => {
      for (const edit of edits)
        await editTouchpointFullCore(exec, {
          interactionId: edit.id,
          contactId: edit.contactId,
          occurredAt: edit.occurredAt,
          now,
          channel: edit.channel,
          direction: edit.direction,
          connected: edit.connected,
          quality: edit.quality,
          note: edit.note,
          duration: edit.duration,
          allowAi: edit.allowAi,
        });
      await bumpDataRevisionCore(exec);
    });
  deps.log?.(
    `orrery-reanchor offsetDays=${options.offsetDays} edited=${edits.length}`,
  );
  return verifyOrreryPerfFixture(exec, nowDate, options);
}

// --- Restore photos -------------------------------------------------------------
/**
 * Put back the spec's procedural photo set: rewrite every spec photo (bytes are
 * deterministic, so later portraits at the same path are replaced) and remove
 * any photo the spec does not have (e.g. Plan 10's test portraits).
 */
export async function restoreOrreryPerfFixturePhotos(
  exec: SqlExecutor,
  deps: OrrerySeedDeps,
  options: VerifyOptions = {},
): Promise<OrreryFixtureVerification> {
  const nowDate = deps.now();
  const now = localDateTime(nowDate);
  const plan = buildOrrerySeedPlan();
  const parts: Record<SeedPart | "orrery", string[]> = {
    cast: [],
    stress: [],
    orrery: [],
  };
  const seeded = await resolveSeeded(
    exec,
    plan,
    await systemsByName(exec),
    parts,
  );
  let written = 0;
  let cleared = 0;
  for (const entry of seeded) {
    if (entry.spec.photo) {
      await deps.writePhoto(exec, entry.id, entry.spec.photoSeed);
      written += 1;
    } else if (entry.photo !== null) {
      if (deps.clearPhoto) await deps.clearPhoto(exec, entry.id, now);
      else
        await inWriteTransaction(exec, () =>
          clearContactPhotoCore(exec, entry.id, now),
        );
      cleared += 1;
    }
  }
  deps.log?.(`orrery-photos written=${written} cleared=${cleared}`);
  return verifyOrreryPerfFixture(exec, nowDate, options);
}

// --- Restore Orrery preferences (C-M5) ------------------------------------------
/**
 * Reset the persistent Orrery inputs the workload depends on: density,
 * satellites and last System through `updateAppSettings`, and the ring order
 * (seeded contacts in spec order, then every other orbiting contact in its
 * current relative order, sun excluded) through `rewriteRingSeq`. The sun is
 * left alone; a sun that differs from the seed-time value is reported.
 */
export async function restoreOrreryPerfFixturePreferences(
  exec: SqlExecutor,
  deps: OrrerySeedDeps,
  options: VerifyOptions = {},
): Promise<{ problems: string[]; wrote: string[]; rewroteRing: boolean }> {
  const now = localDateTime(deps.now());
  const plan = buildOrrerySeedPlan();
  const problems: string[] = [];
  const wrote: string[] = [];
  const systems = await systemsByName(exec);
  const settings = await getAppSettings(exec);
  const pinned = ORRERY_FIXTURE_PREFERENCES;
  const patch: {
    orreryDensity?: typeof pinned.density;
    orrerySatellitesEnabled?: 0 | 1;
    orreryLastSystem?: OrrerySystemId;
  } = {};
  if (settings.orreryDensity !== pinned.density)
    patch.orreryDensity = pinned.density;
  if (settings.orrerySatellitesEnabled !== pinned.satellitesEnabled)
    patch.orrerySatellitesEnabled = pinned.satellitesEnabled;
  const lastSystem = systems.get(pinned.lastSystemName);
  if (!lastSystem)
    problems.push(`System "${pinned.lastSystemName}" is missing`);
  else if (settings.orreryLastSystem !== `custom:${lastSystem.uid}`)
    patch.orreryLastSystem = `custom:${lastSystem.uid}`;
  if (Object.keys(patch).length) {
    await updateAppSettings(exec, patch, now);
    wrote.push(...Object.keys(patch));
  }
  const expectedSun = options.expectedSunContactId ?? null;
  if (settings.sunContactId !== expectedSun)
    problems.push(
      `sun_contact_id ${settings.sunContactId} != seed-time ${expectedSun} (left unchanged)`,
    );

  const parts: Record<SeedPart | "orrery", string[]> = {
    cast: [],
    stress: [],
    orrery: [],
  };
  const seeded = await resolveSeeded(exec, plan, systems, parts);
  const full = (
    await listOrbitingContacts(exec, {
      excludeContactId: settings.sunContactId,
    })
  ).map((row) => row.id);
  const inFull = new Set(full);
  const seededOrder = specRingOrder(seeded).filter((id) => inFull.has(id));
  const seededSet = new Set(seededOrder);
  const desired = [...seededOrder, ...full.filter((id) => !seededSet.has(id))];
  const rewroteRing = !sameIds(full, desired);
  if (rewroteRing)
    await rewriteRingSeq(exec, desired, now, settings.sunContactId);
  deps.log?.(
    `orrery-prefs wrote=[${wrote.join(",")}] ring=${rewroteRing ? "rewritten" : "unchanged"}`,
  );
  return { problems, wrote, rewroteRing };
}

// --- Device deps (lazy native requires; dev menu only) ---------------------------
/** Deterministic 0..1 from an integer seed (fixture pixel maths). */
function pixelHash(n: number): number {
  return (((n + 1) * 7919 + 104729) % 1009) / 1009;
}

/** Procedural head-and-shoulders portrait as JPEG bytes (Skia CPU raster). */
function renderPortrait(seed: number): Uint8Array {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ImageFormat, Skia } =
    require("@shopify/react-native-skia") as typeof import("@shopify/react-native-skia");
  const px = FIXTURE_PHOTO_PX;
  const surface = Skia.Surface.Make(px, px);
  if (!surface) throw new Error("orrery-seed: no CPU raster surface");
  const canvas = surface.getCanvas();
  const pixel = (r: number, g: number, b: number) =>
    Float32Array.of(r, g, b, 1);
  const h = (k: number) => pixelHash(seed * 31 + k);
  const bg = Skia.Paint();
  bg.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: 0, y: 0 },
      { x: 0, y: px },
      [
        pixel(0.2 + 0.6 * h(1), 0.3 + 0.5 * h(2), 0.5 + 0.4 * h(3)),
        pixel(0.1 + 0.3 * h(4), 0.1 + 0.3 * h(1), 0.2 + 0.3 * h(5)),
      ],
      null,
      0,
    ),
  );
  canvas.drawRect(Skia.XYWHRect(0, 0, px, px), bg);
  const tone = 0.25 + 0.6 * h(6);
  const skin = Skia.Paint();
  skin.setColor(pixel(tone + 0.15, tone * 0.85 + 0.05, tone * 0.7));
  const shirt = Skia.Paint();
  shirt.setColor(pixel(h(7), h(8) * 0.8, h(9)));
  const hair = Skia.Paint();
  const hairTone = 0.05 + 0.5 * h(10);
  hair.setColor(pixel(hairTone * 1.2, hairTone * 0.9, hairTone * 0.6));
  canvas.drawOval(Skia.XYWHRect(38, 176, 180, 150), shirt);
  canvas.drawRect(Skia.XYWHRect(108, 150, 40, 40), skin);
  canvas.drawOval(Skia.XYWHRect(74, 50, 108 + 10 * h(11), 120), hair);
  canvas.drawOval(Skia.XYWHRect(82, 70, 92, 108), skin);
  const eye = Skia.Paint();
  eye.setColor(pixel(0.08, 0.08, 0.1));
  canvas.drawCircle(110, 118, 5, eye);
  canvas.drawCircle(146, 118, 5, eye);
  surface.flush();
  const image = surface.makeImageSnapshot();
  const bytes = image.encodeToBytes(ImageFormat.JPEG, 88);
  image.dispose();
  surface.dispose?.();
  return bytes;
}

/**
 * Device deps: procedural JPEG → cache temp file → the owned crash-safe master
 * write (`persistOwnedMaster`, which also refreshes the display revision and
 * the Orrery derivative) → `setContactPhotoCore`. Removal goes through
 * `removeOwnedMaster` with `clearContactPhotoCore` as its reference clear.
 */
export const defaultOrrerySeedDeps: OrrerySeedDeps = {
  async writePhoto(exec, contactId, seedIndex) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File, Paths } =
      require("expo-file-system") as typeof import("expo-file-system");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { persistOwnedMaster } =
      require("@/services/photos/owned-master") as typeof import("@/services/photos/owned-master");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { contactPhotoRelPath } =
      require("@/db/photo-relative-path") as typeof import("@/db/photo-relative-path");
    const temp = new File(Paths.cache, `orrery-seed-${contactId}.jpg`);
    if (temp.exists) temp.delete();
    temp.create();
    temp.write(renderPortrait(seedIndex));
    try {
      const relative = await persistOwnedMaster(
        exec,
        temp.uri,
        contactPhotoRelPath(contactId),
      );
      await inWriteTransaction(exec, () =>
        setContactPhotoCore(exec, contactId, relative, localDateTime()),
      );
    } finally {
      if (temp.exists) temp.delete();
    }
  },
  async clearPhoto(exec, contactId, now) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { removeOwnedMaster } =
      require("@/services/photos/owned-master") as typeof import("@/services/photos/owned-master");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { contactPhotoRelPath } =
      require("@/db/photo-relative-path") as typeof import("@/db/photo-relative-path");
    await removeOwnedMaster(exec, contactPhotoRelPath(contactId), {
      clearReferenceCore: (locked) =>
        clearContactPhotoCore(locked, contactId, now),
    });
  },
  now: () => new Date(),
  log: (message) => console.log(message),
};
