/**
 * Pure Group Event inheritance resolution.
 *
 * Group Events own only Channel, Tone (`quality`), and Duration. Direction and
 * Connected remain participant-owned, deliberately without a follow flag.
 */

export type InheritableGroupField = "channel" | "quality" | "duration";

export interface GroupInheritanceEvent {
  readonly channel: string;
  readonly quality: string | null;
  readonly duration: number | null;
}

export interface GroupInheritanceChild {
  readonly channel: string;
  readonly quality: string | null;
  readonly duration: number | null;
  readonly direction: string | null;
  readonly connected: number;
  readonly geFollowChannel: number | null;
  readonly geFollowQuality: number | null;
  readonly geFollowDuration: number | null;
}

export interface InheritedDisplay<Value> {
  readonly label: string;
  readonly value: Value;
  readonly following: boolean;
}

export interface ParticipantDisplay<Value> {
  readonly label: string;
  readonly value: Value;
}

export interface GroupInheritanceDisplay {
  readonly channel: InheritedDisplay<string>;
  readonly quality: InheritedDisplay<string | null>;
  readonly duration: InheritedDisplay<number | null>;
  readonly direction: ParticipantDisplay<string | null>;
  readonly connected: ParticipantDisplay<number>;
}

const fieldMeta = {
  channel: { followKey: "geFollowChannel", label: "Channel" },
  quality: { followKey: "geFollowQuality", label: "Tone" },
  duration: { followKey: "geFollowDuration", label: "Duration" },
} as const;

function isFollowing(
  child: GroupInheritanceChild,
  field: InheritableGroupField,
): boolean {
  return child[fieldMeta[field].followKey] === 1;
}

function inheritedDisplay<Field extends InheritableGroupField>(
  child: GroupInheritanceChild,
  event: GroupInheritanceEvent,
  field: Field,
): InheritedDisplay<GroupInheritanceChild[Field]> {
  const following = isFollowing(child, field);
  return {
    label: fieldMeta[field].label,
    value: (following ? event[field] : child[field]) as GroupInheritanceChild[Field],
    following,
  };
}

/** Resolve participant-facing values without importing database or UI code. */
export function resolveDisplay(
  child: GroupInheritanceChild,
  event: GroupInheritanceEvent,
): GroupInheritanceDisplay {
  return {
    channel: inheritedDisplay(child, event, "channel"),
    quality: inheritedDisplay(child, event, "quality"),
    duration: inheritedDisplay(child, event, "duration"),
    direction: { label: "Direction", value: child.direction },
    connected: { label: "Connected", value: child.connected },
  };
}

/** Return the exact live-inheritance fan-out target set for one shared field. */
export function computeFollowingChildren<Child extends GroupInheritanceChild>(
  children: readonly Child[],
  field: InheritableGroupField,
): Child[] {
  return children.filter((child) => isFollowing(child, field));
}
