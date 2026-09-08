/** Coherent local scene read; no image decoding, writes, or nested mutex. */

import { getAppSettings } from "@/db/app-settings-dao";
import { getContactHeader } from "@/db/contact-read";
import { getContactStatus } from "@/db/contact-status-read";
import { readOrreryImpactInputsCore } from "@/db/orrery-impact-read";
import type { OrrerySatellite } from "@/db/orrery-satellites-read";
import {
  MissingOrreryCategoryError,
  MissingOrreryCustomSystemError,
  type OrrerySystemMember,
  type OrrerySystemSnapshot,
  readOrrerySystemSnapshot,
} from "@/db/orrery-system-read";
import { getProfile } from "@/db/profile-dao";
import { PROGRESS_SQL, STATUS_SQL } from "@/db/status";
import { inReadSnapshot, type ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import type { OrreryIntent, WorldBody } from "@/logic/orrery-camera-logic";
import { SUN_RADIUS } from "@/logic/orrery-geometry-logic";
import {
  ALL_CONTACTS_SYSTEM,
  type OrrerySystemRef,
  systemRefId,
} from "@/logic/orrery-system-logic";
import {
  deriveOrreryWorld,
  gravityMassModifier,
  orderOrreryMembers,
} from "@/logic/orrery-world-logic";
import {
  mapSunOccupantLookup,
  type SunOccupantLookup,
  sunOccupantIsSelf,
} from "@/logic/sun-occupant-logic";
import type { GravityResult } from "@/services/gravity-logic";
import { computeContactGravity } from "@/services/impact";
import type { OrreryPreferences } from "@/stores/orrery-preferences-store";
import { formatLocalDate } from "@/utils/dates";

export interface OrrerySceneSnapshot {
  /** Durable presentation inputs; density geometry/moons expand in 29-04/10. */
  preferences: OrreryPreferences;
  generation: number;
  dataRevision: number;
  contacts: OrrerySystemMember[];
  system: OrrerySystemRef;
  systemSnapshot: OrrerySystemSnapshot;
  world: WorldBody[];
  extent: number;
  gravity: Map<number, GravityResult>;
  sun: {
    sunContactId: number | null;
    selfSunColour: string | null;
    selfPhoto: string | null;
    selfName: string;
    occupant: SunOccupantLookup | null;
    sunContactName: string;
  };
}

/**
 * Geometry-bearing scene data for an unsaved System draft. This uses the exact
 * Phase 29 world derivation as the saved Orrery, but deliberately has no
 * persistent System identity or write capability.
 */
export interface ProvisionalOrreryScene {
  preferences: OrreryPreferences;
  contacts: OrrerySystemMember[];
  world: WorldBody[];
  extent: number;
  gravity: Map<number, GravityResult>;
  sun: OrrerySceneSnapshot["sun"];
}

export { NEUTRAL_RESTING_ANGLE } from "@/logic/orrery-world-logic";

const PROVISIONAL_MEMBER_SELECT = `SELECT c.id,c.uid,c.name,c.photo,c.ring_seq,c.rarely_responds,c.favourite_rank,c.last_contact,c.created_at,
  CASE WHEN c.last_contact IS NULL THEN NULL ELSE (${PROGRESS_SQL}) END AS progress,
  CASE WHEN c.last_contact IS NULL THEN NULL ELSE (${STATUS_SQL}) END AS status
  FROM contacts c`;

function sceneNow(): string {
  const date = new Date();
  return `${formatLocalDate(date)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function deriveSceneGeometry(input: {
  contacts: readonly OrrerySystemMember[];
  density: OrreryPreferences["density"];
  impactInputs: ReadonlyMap<
    number,
    Parameters<typeof computeContactGravity>[0]
  >;
  sunContactId: number | null;
  self: boolean;
  now: string;
}) {
  const contacts = orderOrreryMembers(input.contacts);
  const gravity = new Map(
    [...input.impactInputs].map(([id, inputs]) => [
      id,
      computeContactGravity(inputs, input.now),
    ]),
  );
  const { bodies: world, extent } = deriveOrreryWorld(
    contacts,
    input.density,
    gravity,
    {
      id: input.self ? 0 : (input.sunContactId ?? 0),
      kind: "sun",
      x: 0,
      y: 0,
      radius:
        SUN_RADIUS *
        (input.self
          ? 1
          : gravityMassModifier(gravity.get(input.sunContactId ?? 0))),
      ringRadius: 0,
    },
  );
  return { contacts, gravity, world, extent };
}

async function readProvisionalMembers(
  ro: ReadOnlyExecutor,
  memberIds: readonly number[],
): Promise<OrrerySystemMember[]> {
  const ids = [
    ...new Set(memberIds.filter((id) => Number.isSafeInteger(id) && id > 0)),
  ];
  if (!ids.length) return [];
  return ro.getAllAsync<OrrerySystemMember>(
    `${PROVISIONAL_MEMBER_SELECT} WHERE c.id IN (${ids.map(() => "?").join(", ")})
     ORDER BY COALESCE(c.ring_seq,1e9),c.created_at,c.id`,
    ids,
  );
}

/**
 * Expands a builder-resolved id set into the same full scene inputs that drive
 * the saved Orrery. The one read snapshot prevents member, gravity, settings,
 * profile, and sun data from being assembled across different database states.
 */
export function readProvisionalOrreryScene(
  exec: SqlExecutor,
  memberIds: readonly number[],
): Promise<ProvisionalOrreryScene> {
  return inReadSnapshot(exec, async (ro) => {
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
    const resolvedSunIdentity =
      self || settings.sunContactId === null
        ? null
        : await ro.getFirstAsync<{ id: number; uid: string }>(
            "SELECT id,uid FROM contacts WHERE id=?",
            [settings.sunContactId],
          );
    const members = (await readProvisionalMembers(ro, memberIds)).filter(
      (member) => member.id !== resolvedSunIdentity?.id,
    );
    const impactInputs = await readOrreryImpactInputsCore(ro, [
      ...members.map((member) => member.id),
      ...(resolvedSunIdentity ? [resolvedSunIdentity.id] : []),
    ]);
    const { contacts, gravity, world, extent } = deriveSceneGeometry({
      contacts: members,
      density: settings.orreryDensity,
      impactInputs,
      sunContactId: settings.sunContactId,
      self,
      now: sceneNow(),
    });
    return {
      preferences: {
        density: settings.orreryDensity,
        satellitesEnabled: settings.orrerySatellitesEnabled,
        lastSystem: settings.orreryLastSystem,
      },
      contacts,
      world,
      extent,
      gravity,
      sun: {
        sunContactId: settings.sunContactId,
        selfSunColour: settings.selfSunColour,
        selfPhoto: profile?.photo ?? null,
        selfName: profile?.name ?? "",
        occupant,
        sunContactName: header?.name ?? "",
      },
    };
  });
}

export async function loadOrreryScene(
  exec: SqlExecutor,
  generation = 0,
  system: OrrerySystemRef = ALL_CONTACTS_SYSTEM,
): Promise<OrrerySceneSnapshot> {
  const snapshot = await readOrrerySystemSnapshot(exec, system);
  if (snapshot.status === "missing-category")
    throw new MissingOrreryCategoryError(snapshot);
  if (snapshot.status === "missing-custom")
    throw new MissingOrreryCustomSystemError(snapshot);
  const { settings, profile, header, occupant } = snapshot;
  const self = snapshot.resolvedSunIdentity === null;
  // A scene can queue behind photo-inclusive backup or app writes and its full
  // history read can delay Quick Log. Batching bounds statements, not latency.
  // Compute, layout and image work stay OUTSIDE the FIFO mutex. Cancellation
  // invalidates publication immediately, but cannot dequeue the current SQL.
  const { contacts, gravity, world, extent } = deriveSceneGeometry({
    contacts: snapshot.orbiting,
    density: settings.orreryDensity,
    impactInputs: snapshot.impactInputs,
    sunContactId: settings.sunContactId,
    self,
    now: sceneNow(),
  });
  return {
    preferences: {
      density: settings.orreryDensity,
      satellitesEnabled: settings.orrerySatellitesEnabled,
      lastSystem: settings.orreryLastSystem,
    },
    generation,
    system,
    systemSnapshot: snapshot,
    dataRevision: settings.dataRevision,
    contacts,
    world,
    extent,
    gravity,
    sun: {
      sunContactId: settings.sunContactId,
      selfSunColour: settings.selfSunColour,
      selfPhoto: profile?.photo ?? null,
      selfName: profile?.name ?? "",
      occupant,
      sunContactName: header?.name ?? "",
    },
  };
}

export interface OrreryLoadState {
  status: "loading" | "ready" | "error";
  snapshot: OrrerySceneSnapshot | null;
}

export interface OrrerySatelliteState {
  status: "loading" | "ready" | "error";
  sceneGeneration: number | null;
  rows: OrrerySatellite[];
}
/** Optional reads own a separate generation and cannot publish into core scene state.
 * Call reload(null,false) synchronously when the System request/lifecycle changes.
 */
export function createOrrerySatelliteController(
  load: (scene: OrrerySceneSnapshot) => Promise<OrrerySatellite[]>,
  publish: (state: OrrerySatelliteState) => void,
) {
  let generation = 0;
  let pending: { scene: OrrerySceneSnapshot; work: Promise<void> } | null =
    null;
  return {
    reload(scene: OrrerySceneSnapshot | null, enabled: boolean): Promise<void> {
      if (enabled && scene && pending?.scene === scene) return pending.work;
      const ticket = ++generation;
      pending = null;
      const sceneGeneration = scene?.generation ?? null;
      publish({
        status: enabled && scene ? "loading" : "ready",
        sceneGeneration,
        rows: [],
      });
      if (!scene || !enabled) return Promise.resolve();
      const work = (async () => {
        try {
          const rows = await load(scene);
          if (ticket !== generation) return;
          publish({
            status: "ready",
            sceneGeneration,
            rows: rows.filter((row) =>
              scene.systemSnapshot.members.some(
                (parent) =>
                  parent.id === row.parentId && parent.uid === row.parentUid,
              ),
            ),
          });
        } catch {
          if (ticket === generation)
            publish({ status: "error", sceneGeneration, rows: [] });
        }
      })().finally(() => {
        if (ticket === generation) pending = null;
      });
      pending = { scene, work };
      return work;
    },
  };
}
/** The current request owns publication; retained failure data is not actionable. */
export function createOrrerySceneController(
  load: (generation: number) => Promise<OrrerySceneSnapshot>,
  publish: (state: OrreryLoadState) => void,
) {
  let generation = 0;
  let snapshot: OrrerySceneSnapshot | null = null;
  let active = false;
  return {
    current: () =>
      active && snapshot?.generation === generation ? snapshot : null,
    cancel: () => {
      generation++;
      active = false;
    },
    async reload() {
      const request = ++generation;
      active = true;
      publish({ status: "loading", snapshot });
      try {
        const result = await load(request);
        if (!active || request !== generation) return;
        snapshot = { ...result, generation: request };
        publish({ status: "ready", snapshot });
      } catch {
        if (active && request === generation)
          publish({ status: "error", snapshot });
      }
    },
  };
}

/** Discrete UI intents only cross to JS. Fresh read + generation check flank await. */
export function createOrreryIntentDispatcher(adapters: {
  current: () => OrrerySceneSnapshot | null;
  validate: () => Promise<OrrerySceneSnapshot>;
  focus: (ids: number[]) => void;
  group: (ids: number[]) => void;
  clear: () => void;
  openProfile: (id: number) => void;
}) {
  let request = 0;
  let navigatedGeneration = -1;
  return async (intent: OrreryIntent): Promise<void> => {
    if (intent.kind === "none") return;
    const ticket = ++request;
    if (adapters.current()?.generation !== intent.generation) return;
    if (intent.kind === "clear") {
      adapters.clear();
      return;
    }
    if (intent.kind === "profile" && navigatedGeneration === intent.generation)
      return;
    let fresh: OrrerySceneSnapshot;
    try {
      fresh = await adapters.validate();
    } catch {
      return;
    }
    if (
      ticket !== request ||
      adapters.current()?.generation !== intent.generation
    )
      return;
    const current = adapters.current();
    if (!current || systemRefId(current.system) !== systemRefId(fresh.system))
      return;
    const identity = (scene: OrrerySceneSnapshot, id: number) =>
      scene.systemSnapshot.members.find((row) => row.id === id)?.uid ??
      (scene.systemSnapshot.resolvedSunIdentity?.id === id
        ? scene.systemSnapshot.resolvedSunIdentity.uid
        : undefined);
    if (
      intent.ids.length === 0 ||
      intent.ids.some(
        (id) =>
          id <= 0 ||
          !fresh.world.some((body) => body.id === id) ||
          identity(current, id) === undefined ||
          identity(current, id) !== identity(fresh, id),
      )
    )
      return;
    if (intent.kind === "profile" && intent.ids.length === 1) {
      navigatedGeneration = intent.generation;
      adapters.openProfile(intent.ids[0]);
    } else if (intent.kind === "group") adapters.group(intent.ids);
    else if (intent.kind === "focus") adapters.focus(intent.ids);
  };
}
