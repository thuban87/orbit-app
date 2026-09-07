import { expect, it, vi } from "vitest";
import type { OrreryContactTarget } from "@/logic/orrery-focus-logic";
import {
  closeBeforeAction,
  clusterCount,
  clusterRegion,
  clusterRows,
} from "./orrery-overlay-logic";

const a: OrreryContactTarget = { kind: "member", id: 1, uid: "a" };
const b: OrreryContactTarget = { kind: "contact-sun", id: 2, uid: "b" };
it("keeps zero/one/many loaded candidates with members first and no independent read", () => {
  expect(clusterRows([a, b], [], null)).toEqual([]);
  expect(clusterRows([a, b], [a], null)).toEqual([a]);
  expect(clusterRows([b, a, a], [a], b)).toEqual([a, b]);
  expect(clusterCount(1)).toBe("1 contact");
  expect(clusterCount(2)).toBe("2 contacts");
});
it("reserves a bounded panel region clear of measured shell and controls", () => {
  const rect = clusterRegion({
    width: 400,
    height: 700,
    obstacles: [{ x: 180, y: 480, width: 210, height: 200 }],
  });
  expect(rect).not.toBeNull();
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(480);
  expect(rect!.height).toBeLessThanOrEqual(280);
});
it("closes group before action and dismissal does not reopen it", () => {
  const order: string[] = [];
  const close = vi.fn(() => order.push("close"));
  closeBeforeAction(close, () => order.push("profile"));
  expect(order).toEqual(["close", "profile"]);
  expect(close).toHaveBeenCalledOnce();
});
