/** ADR-077 / D-07: navigation-session camera only; never serialized. */
import { type CameraPose, clampCameraPose } from "./orrery-camera-logic";
import type { OrreryContactTarget } from "./orrery-focus-logic";

export interface OrrerySessionSnapshot {
  pose: CameraPose;
  focus: OrreryContactTarget | null;
  systemId: string;
}
export function restoreOrrerySession({
  saved,
  systemId,
  members,
  sun,
  extent,
}: {
  saved: OrrerySessionSnapshot | null;
  systemId: string;
  members: readonly { id: number; uid: string }[];
  sun: { id: number; uid: string } | null;
  extent: number;
}): OrrerySessionSnapshot | null {
  if (!saved || saved.systemId !== systemId) return null;
  const target = saved.focus;
  const candidates =
    target?.kind === "contact-sun" ? (sun ? [sun] : []) : members;
  const valid =
    target &&
    candidates.some((row) => row.id === target.id && row.uid === target.uid);
  return {
    ...saved,
    pose: clampCameraPose(saved.pose, extent),
    focus: valid ? target : null,
  };
}
