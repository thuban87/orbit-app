/** ADR-077 inspection intents; ADR-047 sun identity never implies membership. */
import type { OrreryTargetValidation } from "@/db/orrery-action-read";
import type { ContactIdentity } from "@/db/orrery-system-read";
import {
  type CameraRect,
  MIN_HIT_RADIUS,
  type OrreryIntent,
  type ProjectedFrame,
} from "./orrery-camera-logic";
import { type OrrerySystemRef, systemRefId } from "./orrery-system-logic";

export type OrreryContactTarget = ContactIdentity & {
  kind: "member" | "contact-sun";
};
export const FOCUS_OFFSCREEN_MARGIN = 44;
export function sameContact(
  a: ContactIdentity | null | undefined,
  b: ContactIdentity | null | undefined,
): boolean {
  "worklet";
  return !!a && !!b && a.id === b.id && a.uid === b.uid;
}
export function orderContactTargets(
  targets: readonly OrreryContactTarget[],
  members: readonly ContactIdentity[],
): OrreryContactTarget[] {
  "worklet";
  const unique: OrreryContactTarget[] = [];
  for (const target of targets) {
    const index = unique.findIndex((other) => sameContact(target, other));
    if (index < 0) unique.push(target);
    else if (target.kind === "contact-sun") unique[index] = target;
  }
  const rank = (target: OrreryContactTarget) => {
    "worklet";
    const index = members.findIndex((member) => sameContact(target, member));
    return index < 0 ? members.length : index;
  };
  return unique.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      a.id - b.id ||
      (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0),
  );
}
export function resolveOrreryTap(
  frame: ProjectedFrame,
  x: number,
  y: number,
  identities: readonly OrreryContactTarget[],
  visibleNames: readonly string[],
  members: readonly ContactIdentity[],
): OrreryIntent {
  "worklet";
  const bodies = frame.bodies.filter(
    (body) =>
      body.interactive !== false &&
      body.id > 0 &&
      x >= 0 &&
      y >= 0 &&
      x <= frame.viewport.width &&
      y <= frame.viewport.height &&
      Math.hypot(x - body.x, y - body.y) <=
        Math.max(MIN_HIT_RADIUS, body.hitRadius),
  );
  const targets = orderContactTargets(
    bodies.flatMap((body) => {
      const kind = body.kind === "sun" ? "contact-sun" : "member";
      const identity = identities.find(
        (item) => item.id === body.id && item.kind === kind,
      );
      return identity ? [identity] : [];
    }),
    members,
  );
  const named = bodies.some((body) =>
    visibleNames.includes(`${body.kind}:${body.id}`),
  );
  return {
    generation: frame.generation,
    ids: targets.map((target) => target.id),
    targets,
    kind:
      targets.length === 0
        ? "clear"
        : targets.length > 1
          ? "group"
          : named
            ? "profile"
            : "focus",
  };
}
export function validateOrreryContactTarget(
  target: OrreryContactTarget,
  result: OrreryTargetValidation,
): boolean {
  return (
    result.status === "ready" &&
    sameContact(target, result.identity) &&
    (target.kind === "member"
      ? result.isMember
      : sameContact(target, result.resolvedSunIdentity))
  );
}
/** Snapshot reconciliation is presentation-only; every action still probes SQL. */
export function reconcileFocus(
  target: OrreryContactTarget | null,
  members: readonly ContactIdentity[],
  sun: ContactIdentity | null,
): OrreryContactTarget | null {
  return target &&
    (target.kind === "member"
      ? members.some((member) => sameContact(target, member))
      : sameContact(target, sun))
    ? target
    : null;
}
export function focusEffectivelyOffscreen(
  frame: ProjectedFrame,
  id: number,
): boolean {
  "worklet";
  const body = frame.bodies.find(
    (item) => item.id === id && item.interactive !== false,
  );
  if (!body) return true;
  const rect: CameraRect = frame.viewport.usable ?? {
    x: 0,
    y: 0,
    width: frame.viewport.width,
    height: frame.viewport.height,
  };
  const reach =
    Math.max(body.hitRadius, MIN_HIT_RADIUS) + FOCUS_OFFSCREEN_MARGIN;
  return (
    body.x + reach < rect.x ||
    body.x - reach > rect.x + rect.width ||
    body.y + reach < rect.y ||
    body.y - reach > rect.y + rect.height
  );
}
export type OrreryCancellation =
  | "superseded"
  | "clear"
  | "outside"
  | "recenter"
  | "system"
  | "blur"
  | "background"
  | "dispose";
export function createOrreryFocusController(io: {
  current: () => { generation: number; system: OrrerySystemRef } | null;
  validate: (
    system: OrrerySystemRef,
    target: OrreryContactTarget,
  ) => Promise<OrreryTargetValidation>;
  focus: (targets: OrreryContactTarget[]) => void;
  group: (targets: OrreryContactTarget[]) => void;
  clear: () => void;
  openProfile: (id: number) => void;
  reject: (reason: "removed" | "missing-category" | "error") => void;
}) {
  let action = 0;
  return {
    cancel(_reason: OrreryCancellation) {
      action++;
    },
    async dispatch(intent: OrreryIntent) {
      if (intent.kind === "none") return;
      const ticket = ++action;
      if (intent.kind === "clear") {
        io.clear();
        return;
      }
      const current = io.current();
      if (
        !current ||
        current.generation !== intent.generation ||
        !intent.targets?.length
      )
        return;
      const live = () => {
        const latest = io.current();
        return (
          ticket === action &&
          latest?.generation === current.generation &&
          systemRefId(latest.system) === systemRefId(current.system)
        );
      };
      const targets: OrreryContactTarget[] = [];
      try {
        for (const target of intent.targets) {
          const result = await io.validate(current.system, target);
          if (!live()) return;
          if (result.status === "missing-category") {
            io.reject("missing-category");
            return;
          }
          if (validateOrreryContactTarget(target, result)) targets.push(target);
        }
      } catch {
        if (live()) io.reject("error");
        return;
      }
      if (!live()) return;
      if (!targets.length) {
        io.reject("removed");
        return;
      }
      if (intent.kind === "profile" && targets.length === 1)
        io.openProfile(targets[0].id);
      else if (intent.kind === "group") io.group(targets);
      else io.focus(targets);
    },
  };
}
