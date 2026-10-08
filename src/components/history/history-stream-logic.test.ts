/**
 * History stream model (38.8 D-14/D-15/D-18, D-33..D-36, D-39, D-62).
 *
 *   • orderStreamRecords: timestamp desc, then interaction / lifecycle /
 *     knowledge, then id desc; stable `${family}-${id}` keys.
 *   • buildStreamModel: years newest first with the current year always
 *     present; interaction-only year counts; an all-family day index.
 *   • dayLabel / dayAccessibilityLabel: Today / Yesterday from local dates,
 *     otherwise "Fri Oct 2"; accessible labels carry the full date and year.
 */
import { describe, expect, it } from "vitest";
import type {
  HistoryInteractionRecord,
  HistoryKnowledgeRecord,
  HistoryLifecycleRecord,
} from "@/db/history-read";
import {
  buildStreamModel,
  dayAccessibilityLabel,
  dayLabel,
  orderStreamRecords,
  type StreamSource,
} from "./history-stream-logic";

const TODAY = "2026-10-07";

function interaction(
  id: number,
  occurredAt: string,
  extra: Partial<HistoryInteractionRecord> = {},
): HistoryInteractionRecord {
  return {
    id,
    occurredAt,
    date: occurredAt.slice(0, 10),
    channel: "Call",
    direction: "outbound",
    connected: 1,
    quality: null,
    note: null,
    duration: null,
    allowAi: 0,
    groupEventId: null,
    groupTitle: null,
    groupNote: null,
    groupLinked: false,
    ...extra,
  };
}

function lifecycle(id: number, occurredAt: string): HistoryLifecycleRecord {
  return {
    id,
    occurredAt,
    date: occurredAt.slice(0, 10),
    type: "snooze",
    detail: null,
  };
}

function knowledge(id: number, createdAt: string): HistoryKnowledgeRecord {
  return {
    id,
    fieldKey: "last_talked_about",
    date: createdAt.slice(0, 10),
    createdAt,
    value: "value",
    isCurrent: 1,
  };
}

function source(parts: Partial<StreamSource>): StreamSource {
  return {
    interactions: [],
    lifecycleEvents: [],
    knowledgeChanges: [],
    ...parts,
  };
}

describe("orderStreamRecords", () => {
  it("orders newest first across all three families", () => {
    const ordered = orderStreamRecords(
      source({
        interactions: [interaction(1, "2026-10-01 09:00:00")],
        lifecycleEvents: [lifecycle(1, "2026-10-03 09:00:00")],
        knowledgeChanges: [knowledge(1, "2026-10-02 09:00:00")],
      }),
    );
    expect(ordered.map((r) => r.key)).toEqual([
      "lifecycle-1",
      "knowledge-1",
      "interaction-1",
    ]);
  });

  it("breaks equal timestamps by family (interaction, lifecycle, knowledge) then id desc", () => {
    const at = "2026-10-05 12:00:00";
    const ordered = orderStreamRecords(
      source({
        knowledgeChanges: [knowledge(9, at)],
        lifecycleEvents: [lifecycle(3, at), lifecycle(7, at)],
        interactions: [interaction(4, at), interaction(11, at)],
      }),
    );
    expect(ordered.map((r) => r.key)).toEqual([
      "interaction-11",
      "interaction-4",
      "lifecycle-7",
      "lifecycle-3",
      "knowledge-9",
    ]);
  });

  it("keys records by family + id so equal ids across families never collide", () => {
    const ordered = orderStreamRecords(
      source({
        interactions: [interaction(5, "2026-10-05 10:00:00")],
        lifecycleEvents: [lifecycle(5, "2026-10-05 10:00:00")],
        knowledgeChanges: [knowledge(5, "2026-10-05 10:00:00")],
      }),
    );
    const keys = ordered.map((r) => r.key);
    expect(new Set(keys).size).toBe(3);
    expect(keys).toEqual(["interaction-5", "lifecycle-5", "knowledge-5"]);
  });

  it("is deterministic regardless of input order", () => {
    const records = source({
      interactions: [
        interaction(2, "2026-10-05 10:00:00"),
        interaction(1, "2026-10-05 10:00:00"),
      ],
    });
    const reversed = source({
      interactions: [...records.interactions].reverse(),
    });
    expect(orderStreamRecords(records).map((r) => r.key)).toEqual(
      orderStreamRecords(reversed).map((r) => r.key),
    );
  });

  it("uses createdAt for knowledge records and occurredAt for the others", () => {
    const [first] = orderStreamRecords(
      source({ knowledgeChanges: [knowledge(1, "2026-10-05 10:00:00")] }),
    );
    expect(first.at).toBe("2026-10-05 10:00:00");
    expect(first.date).toBe("2026-10-05");
    expect(first.family).toBe("knowledge");
  });
});

describe("buildStreamModel", () => {
  it("groups by year, newest first, with the current year first", () => {
    const model = buildStreamModel(
      source({
        interactions: [
          interaction(1, "2026-03-01 09:00:00"),
          interaction(2, "2024-05-01 09:00:00"),
          interaction(3, "2025-06-01 09:00:00"),
        ],
      }),
      TODAY,
    );
    expect(model.currentYear).toBe(2026);
    expect(model.years.map((y) => y.year)).toEqual([2026, 2025, 2024]);
    expect(model.years[0].isCurrent).toBe(true);
    expect(model.years[1].isCurrent).toBe(false);
  });

  it("always includes the current year, empty when it has no records (D-36)", () => {
    const model = buildStreamModel(
      source({ interactions: [interaction(1, "2025-06-01 09:00:00")] }),
      TODAY,
    );
    expect(model.years.map((y) => y.year)).toEqual([2026, 2025]);
    expect(model.years[0].records).toEqual([]);
    expect(model.years[0].interactionCount).toBe(0);
  });

  it("skips years without records and counts interaction rows only (D-18, D-35)", () => {
    const model = buildStreamModel(
      source({
        interactions: [
          interaction(1, "2025-06-01 09:00:00"),
          interaction(2, "2025-06-02 09:00:00"),
        ],
        lifecycleEvents: [lifecycle(1, "2025-06-03 09:00:00")],
        knowledgeChanges: [knowledge(1, "2022-01-03 09:00:00")],
      }),
      TODAY,
    );
    expect(model.years.map((y) => y.year)).toEqual([2026, 2025, 2022]);
    expect(model.years[1].interactionCount).toBe(2);
    expect(model.years[1].records).toHaveLength(3);
    // A knowledge-only older year still gets a row, with zero interactions.
    expect(model.years[2].interactionCount).toBe(0);
    expect(model.years[2].records).toHaveLength(1);
  });

  it("indexes every day across all three families, newest first", () => {
    const model = buildStreamModel(
      source({
        interactions: [interaction(1, "2026-10-05 09:00:00")],
        lifecycleEvents: [lifecycle(1, "2026-10-05 08:00:00")],
        knowledgeChanges: [knowledge(1, "2026-10-01 08:00:00")],
      }),
      TODAY,
    );
    expect(model.days).toEqual(["2026-10-05", "2026-10-01"]);
    expect(model.dayIndex.get("2026-10-05")?.map((r) => r.key)).toEqual([
      "interaction-1",
      "lifecycle-1",
    ]);
    expect(model.dayIndex.get("2026-10-01")?.map((r) => r.key)).toEqual([
      "knowledge-1",
    ]);
  });

  it("returns only the empty current year for an empty history", () => {
    const model = buildStreamModel(source({}), TODAY);
    expect(model.years).toHaveLength(1);
    expect(model.days).toEqual([]);
    expect(model.dayIndex.size).toBe(0);
  });

  it("takes the current year from the local today string", () => {
    const model = buildStreamModel(source({}), "2027-01-01");
    expect(model.currentYear).toBe(2027);
    expect(model.years[0].year).toBe(2027);
  });
});

describe("dayLabel / dayAccessibilityLabel (D-33)", () => {
  it("labels today and yesterday by name", () => {
    expect(dayLabel("2026-10-07", TODAY)).toBe("Today");
    expect(dayLabel("2026-10-06", TODAY)).toBe("Yesterday");
  });

  it("labels other days with weekday, month and day", () => {
    expect(dayLabel("2026-10-02", TODAY)).toBe("Fri Oct 2");
    expect(dayLabel("2026-10-05", TODAY)).toBe("Mon Oct 5");
  });

  it("finds yesterday across a month boundary", () => {
    expect(dayLabel("2026-09-30", "2026-10-01")).toBe("Yesterday");
    expect(dayLabel("2026-09-29", "2026-10-01")).toBe("Tue Sep 29");
  });

  it("finds yesterday across a year boundary", () => {
    expect(dayLabel("2026-12-31", "2027-01-01")).toBe("Yesterday");
    expect(dayLabel("2027-01-01", "2027-01-01")).toBe("Today");
    expect(dayLabel("2026-12-30", "2027-01-01")).toBe("Wed Dec 30");
  });

  it("finds yesterday across a leap day", () => {
    expect(dayLabel("2028-02-29", "2028-03-01")).toBe("Yesterday");
  });

  it("carries the full date and year in the accessible label", () => {
    expect(dayAccessibilityLabel("2026-10-02", TODAY)).toBe(
      "Friday, October 2, 2026",
    );
    expect(dayAccessibilityLabel("2026-10-07", TODAY)).toBe(
      "Today, Wednesday, October 7, 2026",
    );
    expect(dayAccessibilityLabel("2026-12-31", "2027-01-01")).toBe(
      "Yesterday, Thursday, December 31, 2026",
    );
  });
});
