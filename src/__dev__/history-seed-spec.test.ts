/**
 * History seed spec (38.8 Plan 01, D-30): the pure plan. Lean policy — only the
 * data/crash risks are asserted here (no future timestamps, group events
 * strictly before today, every dataset present, the two empty-family
 * contracts). Dataset shapes are exercised by the seed test and the device pass.
 */
import { describe, expect, it } from "vitest";
import {
  buildHistorySeedPlan,
  HISTORY_SEED_UID_PREFIX,
} from "./history-seed-spec";

/** Mid-year, 09:00 local — today-dated spec times after 09:00 must clamp. */
const NOW = new Date(2026, 5, 17, 9, 0, 0);
const NOW_STAMP = "2026-06-17 09:00:00";
const TODAY = "2026-06-17";
const STAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

const plan = buildHistorySeedPlan(NOW);

function allStamps(): string[] {
  return [
    ...plan.contacts.flatMap((c) => [
      ...c.interactions.map((i) => i.occurredAt),
      ...c.knowledge.map((k) => k.at),
      ...c.lifecycle.map((l) => l.occurredAt),
    ]),
    ...plan.groupEvents.map((g) => g.occurredAt),
  ];
}

describe("buildHistorySeedPlan", () => {
  it("reports the injected now as its local today and clamp ceiling", () => {
    expect(plan.today).toBe(TODAY);
    expect(plan.now).toBe(NOW_STAMP);
  });

  it("never schedules a record after the injected now (C3-04)", () => {
    const stamps = allStamps();
    expect(stamps.length).toBeGreaterThan(900);
    for (const stamp of stamps) {
      expect(stamp).toMatch(STAMP);
      expect(stamp <= NOW_STAMP).toBe(true);
    }
  });

  it("dates every group event strictly before today", () => {
    expect(plan.groupEvents).toHaveLength(2);
    for (const event of plan.groupEvents)
      expect(event.occurredAt.slice(0, 10) < TODAY).toBe(true);
  });

  it("has all eight datasets under the seed uid prefix", () => {
    expect(plan.contacts.map((c) => c.key).sort()).toEqual(
      [
        "archived",
        "dense",
        "empty",
        "long",
        "notes-only",
        "quiet-year",
        "sparse",
        "unbound",
      ].sort(),
    );
    for (const contact of plan.contacts)
      expect(contact.uid).toBe(`${HISTORY_SEED_UID_PREFIX}${contact.key}`);
  });

  it("keeps Empty free of every record family and Notes-only free of interactions", () => {
    const byKey = new Map(plan.contacts.map((c) => [c.key, c]));
    const empty = byKey.get("empty");
    expect(empty?.interactions).toEqual([]);
    expect(empty?.knowledge).toEqual([]);
    expect(empty?.lifecycle).toEqual([]);
    expect(empty?.archive).toBe(false);
    expect(
      plan.groupEvents.some((g) => g.participants.includes("empty")),
    ).toBe(false);
    const notes = byKey.get("notes-only");
    expect(notes?.interactions).toEqual([]);
    expect(
      plan.groupEvents.some((g) => g.participants.includes("notes-only")),
    ).toBe(false);
    expect(
      (notes?.knowledge.length ?? 0) + (notes?.lifecycle.length ?? 0),
    ).toBeGreaterThan(0);
  });
});
