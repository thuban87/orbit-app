import { expect, it } from "vitest";
import type { OrrerySceneSnapshot } from "@/services/orrery-scene";
import { companionAction, companionRows } from "./orrery-companion-logic";

function scene(ids: number[]) {
  return {
    generation: 7,
    systemSnapshot: {
      members: ids.map((id) => ({
        id,
        uid: `uid-${id}`,
        name: "同名",
        photo: null,
        status: null,
      })),
      resolvedSunIdentity: { id: 9, uid: "outside" },
    },
    gravity: new Map(),
  } as unknown as OrrerySceneSnapshot;
}
it("preserves exact zero/one/many successful member identities and never appends an outside sun", () => {
  for (const ids of [[], [1], [3, 2, 1]]) {
    const rows = companionRows(scene(ids));
    expect(rows.map((row) => row.member.id)).toEqual(ids);
    expect(rows.every((row) => row.context === "Not contacted yet")).toBe(true);
  }
  expect(companionRows(null)).toEqual([]);
});
it("preserves qualifying sun once and keeps companion actions member-discriminated", () => {
  const snapshot = scene([9]);
  const rows = companionRows(snapshot);
  expect(rows).toHaveLength(1);
  expect(companionAction(snapshot, "focus", 9)).toMatchObject({
    kind: "focus",
    generation: 7,
    targets: [{ kind: "member", id: 9, uid: "uid-9" }],
  });
  expect(companionAction(snapshot, "profile", 10)).toBeNull();
});
