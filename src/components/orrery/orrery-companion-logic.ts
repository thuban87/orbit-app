import type { OrreryIntent } from "@/logic/orrery-camera-logic";
import { labelContext } from "@/logic/orrery-label-logic";
import type { OrrerySceneSnapshot } from "@/services/orrery-scene";
/** Exact committed System order, including qualifying sun once. No broad lookup. */
export function companionRows(scene: OrrerySceneSnapshot | null) {
  return (
    scene?.systemSnapshot.members.map((member) => ({
      member,
      context: labelContext(member.status, scene.gravity?.get(member.id)),
    })) ?? []
  );
}
export function companionAction(
  scene: OrrerySceneSnapshot,
  kind: "focus" | "profile",
  id: number,
): OrreryIntent | null {
  const member = scene.systemSnapshot.members.find((row) => row.id === id);
  return member
    ? {
        kind,
        ids: [id],
        generation: scene.generation,
        targets: [{ kind: "member", id, uid: member.uid }],
      }
    : null;
}
