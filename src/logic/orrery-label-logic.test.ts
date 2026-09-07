import { describe, expect, it } from "vitest";
import { allocateLabels, labelContext, rectanglesTouch, semanticLevel, IDENTITY_ENTER, IDENTITY_EXIT, DETAIL_ENTER, DETAIL_EXIT, type LabelCandidate } from "./orrery-label-logic";

const viewport = { width: 800, height: 600 };
const candidate = (id: string, patch: Partial<LabelCandidate> = {}): LabelCandidate => ({ id, name: id, x: 100, y: 100, width: 100, height: 20, opacity: 1, ...patch });
describe("semantic labels", () => {
  it("uses both sides and exact inclusive thresholds with hysteresis", () => {
    expect(semanticLevel(IDENTITY_ENTER - 1e-6, "overview")).toBe("overview");
    expect(semanticLevel(IDENTITY_ENTER, "overview")).toBe("identity");
    expect(semanticLevel(IDENTITY_ENTER + 1e-6, "overview")).toBe("identity");
    expect(semanticLevel(IDENTITY_EXIT, "identity")).toBe("identity");
    expect(semanticLevel(IDENTITY_EXIT - 1e-6, "identity")).toBe("overview");
    expect(semanticLevel(DETAIL_ENTER - 1e-6, "identity")).toBe("identity");
    expect(semanticLevel(DETAIL_ENTER, "identity")).toBe("detail");
    expect(semanticLevel(DETAIL_ENTER + 1e-6, "identity")).toBe("detail");
    expect(semanticLevel(DETAIL_EXIT, "detail")).toBe("detail");
    expect(semanticLevel(DETAIL_EXIT - 1e-6, "detail")).toBe("identity");
    expect(semanticLevel(1, "detail")).toBe("overview");
    expect(semanticLevel(4, "overview")).toBe("detail");
  });
  it("keeps an oscillating zoom boundary stable and permits zero overview labels", () => {
    let level = semanticLevel(2, "overview");
    for (const zoom of [1.99, 2.01, 1.95, 2]) level = semanticLevel(zoom, level);
    expect(level).toBe("identity");
    expect(allocateLabels([candidate("one")], "overview", viewport)).toEqual([]);
    expect(allocateLabels([], "detail", viewport)).toEqual([]);
  });
  it("prioritizes focused then cluster then favorites, with stable identity ties", () => {
    const all = [candidate("other"), candidate("favorite", { favorite: true }), candidate("cluster", { cluster: true }), candidate("focus", { focused: true })];
    expect(allocateLabels(all, "identity", viewport).map((b) => b.id)).toEqual(["focus"]);
    expect(allocateLabels(all.filter((b) => !b.focused), "identity", viewport)[0].id).toBe("cluster");
    expect(allocateLabels(all.filter((b) => !b.focused && !b.cluster), "identity", viewport)[0].id).toBe("favorite");
    expect(allocateLabels([candidate("z"), candidate("a")], "identity", viewport)[0].id).toBe("a");
  });
  it("ranks isolated clean fitting names ahead of opportunistic crowded names", () => {
    const result = allocateLabels([candidate("a"), candidate("b"), candidate("z", { x: 400 })], "identity", viewport);
    expect(result.map((b) => b.id)).toEqual(["z", "a"]);
  });
  it("counts touching edges as collisions and respects measured controls/panel exclusions", () => {
    expect(rectanglesTouch({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 10, width: 10, height: 10 })).toBe(true);
    expect(rectanglesTouch({ x: 0, y: 0, width: 10, height: 10 }, { x: 10.001, y: 0, width: 10, height: 10 })).toBe(false);
    expect(allocateLabels([candidate("covered", { focused: true })], "detail", { ...viewport, obstacles: [{ x: 80, y: 80, width: 200, height: 100 }] })).toEqual([]);
    expect(allocateLabels([candidate("outside", { x: 799 })], "detail", viewport)).toEqual([]);
  });
  it("preserves full Unicode identity and accommodates native OS-scaled measurements", () => {
    const name = "👨‍👩‍👧‍👦 Zoë e\u0301 東京 مرحبا";
    const normal = allocateLabels([candidate("id", { name })], "identity", viewport)[0];
    expect(normal.name).toBe(name);
    const scaled = allocateLabels([candidate("id", { name, width: 200, height: 40 })], "identity", viewport)[0];
    expect(scaled.name).toBe(name);
    expect(scaled.rect.height).toBe(40);
  });
  it("omits missing context and suppresses detail before sacrificing another name", () => {
    expect(labelContext(null, undefined)).toBe("Not contacted yet");
    expect(labelContext(undefined, undefined)).toBeUndefined();
    const item = candidate("name", { context: "Deep gravity", contextWidth: 100, contextHeight: 20 });
    expect(allocateLabels([item], "identity", viewport)[0].contextRect).toBeUndefined();
    expect(allocateLabels([item], "detail", viewport)[0].contextRect).toBeDefined();
    const crowded = allocateLabels([item, candidate("other", { y: 125 })], "detail", viewport);
    expect(crowded).toHaveLength(2);
    expect(crowded.find((b) => b.id === "name")?.contextRect).toBeUndefined();
  });
});
