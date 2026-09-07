/** Coherent local scene read; no image decoding, writes, or nested mutex. */
import {
  MissingOrreryCategoryError,
  type OrrerySystemMember,
  type OrrerySystemSnapshot,
  readOrrerySystemSnapshot,
} from "@/db/orrery-system-read";
import type { SqlExecutor } from "@/db/types";
import type { OrreryIntent, WorldBody } from "@/logic/orrery-camera-logic";
import {
  deriveOrreryMetrics,
  drawnRadius,
  polarToXY,
  progressToAngle,
  ringRadius,
} from "@/logic/orrery-geometry-logic";
import {
  ALL_CONTACTS_SYSTEM,
  type OrrerySystemRef,
} from "@/logic/orrery-system-logic";
import type { SunOccupantLookup } from "@/logic/sun-occupant-logic";
import type { OrreryPreferences } from "@/stores/orrery-preferences-store";

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
  sun: {
    sunContactId: number | null;
    selfSunColour: string | null;
    selfPhoto: string | null;
    selfName: string;
    occupant: SunOccupantLookup | null;
    sunContactName: string;
  };
}

export const NEUTRAL_RESTING_ANGLE = 0;

export async function loadOrreryScene(
  exec: SqlExecutor,
  generation = 0,
  system: OrrerySystemRef = ALL_CONTACTS_SYSTEM,
): Promise<OrrerySceneSnapshot> {
  const snapshot = await readOrrerySystemSnapshot(exec, system);
  if (snapshot.status === "missing-category")
    throw new MissingOrreryCategoryError(snapshot);
  const { settings, profile, header, occupant } = snapshot;
  const self = snapshot.resolvedSunIdentity === null;
  const contacts = snapshot.orbiting;
  // Fixed world spacing, independent of viewport. 29-04 expands density/Home.
  // Give the reused drift resolver enough WORLD extent to avoid its legacy
  // viewport clamp; no contact is compressed onto a phone's outer rim.
  const extent = 160 + contacts.length * 34;
  const metrics = deriveOrreryMetrics(
    extent * 2 + 100,
    extent * 2 + 100,
    contacts.length,
  );
  const world: WorldBody[] = contacts.map((contact, rank) => ({
    id: contact.id,
    kind: "contact",
    radius: metrics.PLANET_RADIUS,
    ringRadius: ringRadius(rank, metrics),
    ...polarToXY(
      0,
      0,
      contact.progress === null || contact.status === null
        ? ringRadius(rank, metrics)
        : drawnRadius(contact.progress, rank, contact.status, metrics),
      contact.progress === null
        ? NEUTRAL_RESTING_ANGLE
        : progressToAngle(contact.progress),
    ),
  }));
  world.push({
    id: self ? 0 : (settings.sunContactId ?? 0),
    kind: "sun",
    x: 0,
    y: 0,
    radius: metrics.SUN_RADIUS,
    ringRadius: 0,
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
    if (
      intent.ids.length === 0 ||
      intent.ids.some(
        (id) => id <= 0 || !fresh.world.some((body) => body.id === id),
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
