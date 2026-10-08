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
  dayNodeKey,
  emptyYearLabel,
  historyScrollMode,
  initialStreamState,
  isCurrentScroll,
  isYearOpen,
  orderStreamRecords,
  type PendingHistoryScroll,
  pendingScrollOn,
  resolveHeatmapTarget,
  revealAnnouncement,
  STREAM_CHUNK,
  STREAM_INITIAL_VISIBLE,
  type StreamSource,
  snapToDayEnd,
  streamStateOnExpandYear,
  streamStateOnReveal,
  streamStateOnShowOlder,
  visibleYear,
  yearRowLabel,
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

// --- Task 2: view state, chunking and year labels (D-34, D-35, D-36, D-39) ---

/** `count` interactions, one per day going back from `start`, newest first. */
function dailyInteractions(
  count: number,
  start: { y: number; m: number; d: number },
  firstId = 1,
): HistoryInteractionRecord[] {
  const out: HistoryInteractionRecord[] = [];
  for (let i = 0; i < count; i++) {
    const day = new Date(start.y, start.m - 1, start.d - i);
    const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    out.push(interaction(firstId + i, `${ymd} 10:00:00`));
  }
  return out;
}

/** `count` interactions on one date, newest first. */
function sameDayInteractions(
  count: number,
  date: string,
  firstId = 1,
): HistoryInteractionRecord[] {
  const out: HistoryInteractionRecord[] = [];
  for (let i = 0; i < count; i++) {
    const minute = String(59 - i).padStart(2, "0");
    out.push(interaction(firstId + i, `${date} 10:${minute}:00`));
  }
  return out;
}

describe("view state (D-34, D-62)", () => {
  const model = buildStreamModel(
    source({
      interactions: [
        interaction(1, "2026-10-01 09:00:00"),
        interaction(2, "2025-06-01 09:00:00"),
        interaction(3, "2024-06-01 09:00:00"),
      ],
    }),
    TODAY,
  );

  it("starts fresh with only the current year open and no extra chunks", () => {
    const state = initialStreamState();
    expect(state.openYears.size).toBe(0);
    expect(state.shown.size).toBe(0);
    expect(isYearOpen(state, model, 2026)).toBe(true);
    expect(isYearOpen(state, model, 2025)).toBe(false);
    expect(isYearOpen(state, model, 2024)).toBe(false);
  });

  it("opens an older year only after it is expanded", () => {
    const state = streamStateOnExpandYear(initialStreamState(), 2025);
    expect(isYearOpen(state, model, 2025)).toBe(true);
    expect(isYearOpen(state, model, 2024)).toBe(false);
  });

  it("expanding is immutable and idempotent", () => {
    const initial = initialStreamState();
    const once = streamStateOnExpandYear(initial, 2025);
    expect(initial.openYears.has(2025)).toBe(false);
    expect(streamStateOnExpandYear(once, 2025)).toBe(once);
  });
});

describe("snapToDayEnd", () => {
  const records = orderStreamRecords(
    source({
      interactions: [
        ...sameDayInteractions(3, "2026-10-05", 1),
        ...sameDayInteractions(2, "2026-10-04", 10),
      ],
    }),
  );

  it("extends a cut that falls inside a day to the end of that day", () => {
    expect(snapToDayEnd(records, 1)).toBe(3);
    expect(snapToDayEnd(records, 2)).toBe(3);
    expect(snapToDayEnd(records, 4)).toBe(5);
  });

  it("keeps a cut that already falls on a day boundary", () => {
    expect(snapToDayEnd(records, 3)).toBe(3);
    expect(snapToDayEnd(records, 5)).toBe(5);
  });

  it("clamps to the record count and never goes below zero", () => {
    expect(snapToDayEnd(records, 99)).toBe(5);
    expect(snapToDayEnd(records, 0)).toBe(0);
    expect(snapToDayEnd([], 20)).toBe(0);
  });
});

describe("visibleYear chunking (D-39, D-18)", () => {
  it("exposes both tunables at 20", () => {
    expect(STREAM_INITIAL_VISIBLE).toBe(20);
    expect(STREAM_CHUNK).toBe(20);
  });

  it("shows the newest STREAM_INITIAL_VISIBLE records and flags older ones", () => {
    const model = buildStreamModel(
      source({ interactions: dailyInteractions(45, { y: 2026, m: 10, d: 7 }) }),
      TODAY,
    );
    const view = visibleYear(initialStreamState(), model, 2026);
    expect(view.visibleCount).toBe(20);
    expect(view.hasOlder).toBe(true);
    const shownDays = view.months.flatMap((m) => m.days);
    expect(shownDays).toHaveLength(20);
    expect(shownDays[0].date).toBe("2026-10-07");
    expect(shownDays[0].label).toBe("Today");
  });

  it("extends the cut to the end of the day when records 20 and 21 share a date", () => {
    const model = buildStreamModel(
      source({
        interactions: [
          ...dailyInteractions(19, { y: 2026, m: 10, d: 7 }, 1),
          ...sameDayInteractions(3, "2026-09-18", 100),
          ...dailyInteractions(10, { y: 2026, m: 9, d: 10 }, 200),
        ],
      }),
      TODAY,
    );
    const view = visibleYear(initialStreamState(), model, 2026);
    expect(view.visibleCount).toBe(22);
    expect(view.hasOlder).toBe(true);
    const lastDay = view.months.at(-1)?.days.at(-1);
    expect(lastDay?.date).toBe("2026-09-18");
    expect(lastDay?.records).toHaveLength(3);
  });

  it("shows a dense 25-record day whole on first render", () => {
    const model = buildStreamModel(
      source({
        interactions: [
          ...sameDayInteractions(25, "2026-10-06", 1),
          ...dailyInteractions(30, { y: 2026, m: 9, d: 30 }, 100),
        ],
      }),
      TODAY,
    );
    const view = visibleYear(initialStreamState(), model, 2026);
    expect(view.visibleCount).toBe(25);
    expect(view.hasOlder).toBe(true);
    expect(view.months[0].days[0].records).toHaveLength(25);
  });

  it("has no older records once the year is fully shown", () => {
    const model = buildStreamModel(
      source({ interactions: dailyInteractions(12, { y: 2026, m: 10, d: 7 }) }),
      TODAY,
    );
    const view = visibleYear(initialStreamState(), model, 2026);
    expect(view.visibleCount).toBe(12);
    expect(view.hasOlder).toBe(false);
  });

  it("groups the visible slice by month with full-name labels", () => {
    const model = buildStreamModel(
      source({
        interactions: [
          interaction(1, "2026-10-02 09:00:00"),
          interaction(2, "2026-09-28 09:00:00"),
        ],
      }),
      TODAY,
    );
    const view = visibleYear(initialStreamState(), model, 2026);
    expect(
      view.months.map((m) => [m.key, m.label, m.accessibilityLabel]),
    ).toEqual([
      ["2026-10", "October", "October 2026"],
      ["2026-09", "September", "September 2026"],
    ]);
    expect(view.months[0].days[0].label).toBe("Fri Oct 2");
    expect(view.months[0].days[0].accessibilityLabel).toBe(
      "Friday, October 2, 2026",
    );
  });
});

describe("streamStateOnShowOlder (D-39)", () => {
  const model = buildStreamModel(
    source({
      interactions: [
        ...dailyInteractions(19, { y: 2026, m: 10, d: 7 }, 1),
        ...sameDayInteractions(3, "2026-09-18", 100),
        ...dailyInteractions(60, { y: 2026, m: 9, d: 10 }, 200),
        ...dailyInteractions(30, { y: 2025, m: 12, d: 31 }, 400),
      ],
    }),
    TODAY,
  );

  it("adds STREAM_CHUNK records to the snapped visible count", () => {
    const next = streamStateOnShowOlder(initialStreamState(), model, 2026);
    // First render shows 22 (snapped), so the request becomes 22 + 20.
    expect(next.shown.get(2026)).toBe(42);
    expect(visibleYear(next, model, 2026).visibleCount).toBe(42);
  });

  it("never shrinks and never touches other years", () => {
    const once = streamStateOnShowOlder(initialStreamState(), model, 2026);
    const twice = streamStateOnShowOlder(once, model, 2026);
    expect(twice.shown.get(2026)).toBeGreaterThan(once.shown.get(2026) ?? 0);
    expect(twice.shown.has(2025)).toBe(false);
    expect(once.openYears).toBe(twice.openYears);
  });

  it("is immutable", () => {
    const initial = initialStreamState();
    streamStateOnShowOlder(initial, model, 2026);
    expect(initial.shown.size).toBe(0);
  });

  it("eventually shows the whole year, then hasOlder is false", () => {
    let state = initialStreamState();
    for (let i = 0; i < 10; i++)
      state = streamStateOnShowOlder(state, model, 2026);
    const view = visibleYear(state, model, 2026);
    expect(view.visibleCount).toBe(82);
    expect(view.hasOlder).toBe(false);
  });

  it("ignores a year the model does not have", () => {
    const initial = initialStreamState();
    expect(streamStateOnShowOlder(initial, model, 1999)).toBe(initial);
  });
});

describe("year labels (D-35, D-36)", () => {
  it("pluralises interaction counts", () => {
    expect(yearRowLabel(2025, 1)).toBe("2025 · 1 interaction");
    expect(yearRowLabel(2025, 34)).toBe("2025 · 34 interactions");
    expect(yearRowLabel(2023, 0)).toBe("2023 · 0 interactions");
  });

  it("names an empty current year", () => {
    expect(emptyYearLabel(2027)).toBe("Nothing logged in 2027 yet");
  });
});

describe("resolveHeatmapTarget — a day (D-19, D-21)", () => {
  const model = buildStreamModel(
    source({
      interactions: [interaction(1, "2026-10-02 09:00:00")],
      lifecycleEvents: [lifecycle(2, "2026-10-05 08:00:00")],
      knowledgeChanges: [knowledge(3, "2026-10-04 08:00:00")],
    }),
    TODAY,
  );

  it("reveals a day with interactions", () => {
    expect(
      resolveHeatmapTarget(model, { kind: "date", date: "2026-10-02" }),
    ).toEqual({
      kind: "reveal",
      days: ["2026-10-02"],
      scrollDay: "2026-10-02",
      highlightDays: ["2026-10-02"],
    });
  });

  it("reveals a lifecycle-only or knowledge-only day (emptiness from the day index)", () => {
    expect(
      resolveHeatmapTarget(model, { kind: "date", date: "2026-10-05" }).kind,
    ).toBe("reveal");
    expect(
      resolveHeatmapTarget(model, { kind: "date", date: "2026-10-04" }).kind,
    ).toBe("reveal");
  });

  it("resolves a day with no record of any family to empty-day", () => {
    expect(
      resolveHeatmapTarget(model, { kind: "date", date: "2026-10-06" }),
    ).toEqual({ kind: "empty-day", date: "2026-10-06" });
  });

  it("keys day nodes by date", () => {
    expect(dayNodeKey("2026-10-02")).toBe("day:2026-10-02");
  });
});

describe("streamStateOnReveal (D-18)", () => {
  // 2025: 39 single-record days (Dec 31 → Nov 23), then 3 records on Nov 20,
  // then 20 single-record days from Nov 15. 2026: a few current-year days.
  const model = buildStreamModel(
    source({
      interactions: [
        ...dailyInteractions(5, { y: 2026, m: 10, d: 7 }, 1),
        ...dailyInteractions(39, { y: 2025, m: 12, d: 31 }, 100),
        ...sameDayInteractions(3, "2025-11-20", 200),
        ...dailyInteractions(20, { y: 2025, m: 11, d: 15 }, 300),
      ],
    }),
    TODAY,
  );

  it("changes nothing for a day already visible in the open current year", () => {
    const state = initialStreamState();
    expect(streamStateOnReveal(state, model, ["2026-10-05"])).toBe(state);
  });

  it("opens a collapsed older year and grows it in whole chunks until the whole day renders", () => {
    const state = initialStreamState();
    const next = streamStateOnReveal(state, model, ["2025-11-20"]);
    expect(isYearOpen(next, model, 2025)).toBe(true);
    // Records 39..41 are the target day: 40 = 20 + one chunk reaches it, and
    // day snapping extends the slice to the day's end.
    expect(next.shown.get(2025)).toBe(40);
    const visible = visibleYear(next, model, 2025);
    expect(visible.visibleCount).toBe(42);
    expect(visible.hasOlder).toBe(true);
    const day = visible.months
      .flatMap((m) => m.days)
      .find((d) => d.date === "2025-11-20");
    expect(day?.records).toHaveLength(3);
    // The original state is untouched and other years are unchanged.
    expect(state.openYears.size).toBe(0);
    expect(next.shown.has(2026)).toBe(false);
  });

  it("never shrinks a year that already shows more", () => {
    const state = {
      openYears: new Set([2025]),
      shown: new Map([[2025, 80]]),
    };
    expect(streamStateOnReveal(state, model, ["2025-11-20"])).toBe(state);
  });

  it("ignores a day with no records", () => {
    const state = initialStreamState();
    expect(streamStateOnReveal(state, model, ["2024-01-01"])).toBe(state);
  });
});

describe("historyScrollMode (C2-02)", () => {
  it("scrolls immediately when the target is already rendered (the reveal only grows content below it)", () => {
    const registry = new Map([["day:2026-10-02", {}]]);
    expect(historyScrollMode(registry, "day:2026-10-02")).toBe("immediate");
  });

  it("waits for the target's layout when it is not rendered yet (a collapsed year)", () => {
    const registry = new Map([["day:2026-10-02", {}]]);
    expect(historyScrollMode(registry, "day:2025-06-01")).toBe("await-layout");
  });
});

describe("pendingScrollOn / isCurrentScroll (C2-02, C2-03)", () => {
  const request = (gen: number, key = "day:2026-10-02") =>
    ({ type: "request", key, gen, mode: "immediate" }) as const;

  it("records a request as not yet retried", () => {
    expect(pendingScrollOn(null, request(1))).toEqual({
      key: "day:2026-10-02",
      gen: 1,
      mode: "immediate",
      retried: false,
    });
  });

  it("clears on a successful result", () => {
    const pending = pendingScrollOn(null, request(1));
    expect(pendingScrollOn(pending, { type: "result", gen: 1, ok: true })).toBe(
      null,
    );
  });

  it("ignores an older generation's result", () => {
    const pending = pendingScrollOn(
      pendingScrollOn(null, request(1)),
      request(2),
    );
    expect(pendingScrollOn(pending, { type: "result", gen: 1, ok: true })).toBe(
      pending,
    );
    expect(
      pendingScrollOn(pending, { type: "result", gen: 1, ok: false }),
    ).toBe(pending);
    expect(isCurrentScroll(pending, 1)).toBe(false);
    expect(isCurrentScroll(pending, 2)).toBe(true);
  });

  it("retries once after a failure, then clears", () => {
    const pending = pendingScrollOn(null, request(1));
    const retried = pendingScrollOn(pending, {
      type: "result",
      gen: 1,
      ok: false,
    });
    expect(retried).toEqual({ ...pending, retried: true });
    expect(isCurrentScroll(retried, 1)).toBe(true);
    expect(
      pendingScrollOn(retried, { type: "result", gen: 1, ok: false }),
    ).toBe(null);
  });

  it("drops an older pending retry on a newer stream action", () => {
    const retried = pendingScrollOn(pendingScrollOn(null, request(1)), {
      type: "result",
      gen: 1,
      ok: false,
    });
    const cleared = pendingScrollOn(retried, { type: "stream-action" });
    expect(cleared).toBe(null);
    expect(isCurrentScroll(cleared, 1)).toBe(false);
  });

  it("replaces a retried request with a newer one", () => {
    const retried: PendingHistoryScroll = pendingScrollOn(
      pendingScrollOn(null, request(1)),
      { type: "result", gen: 1, ok: false },
    );
    const next = pendingScrollOn(retried, request(2, "day:2026-10-05"));
    expect(next).toEqual({
      key: "day:2026-10-05",
      gen: 2,
      mode: "immediate",
      retried: false,
    });
    expect(isCurrentScroll(next, 1)).toBe(false);
  });

  it("is never current with nothing pending", () => {
    expect(isCurrentScroll(null, 1)).toBe(false);
  });
});

describe("resolveHeatmapTarget — a cycle span (D-20, D-21)", () => {
  const model = buildStreamModel(
    source({
      interactions: [
        interaction(1, "2026-09-02 09:00:00"),
        interaction(2, "2026-09-08 09:00:00"),
      ],
      lifecycleEvents: [lifecycle(3, "2026-09-06 08:00:00")],
      knowledgeChanges: [
        knowledge(4, "2026-09-05 08:00:00"),
        knowledge(5, "2026-08-20 08:00:00"),
      ],
    }),
    TODAY,
  );

  it("reveals every day of the span with records (any family), newest first, scrolling to the newest", () => {
    expect(
      resolveHeatmapTarget(model, {
        kind: "cycle",
        start: "2026-09-01",
        end: "2026-09-07",
      }),
    ).toEqual({
      kind: "reveal",
      days: ["2026-09-06", "2026-09-05", "2026-09-02"],
      scrollDay: "2026-09-06",
      highlightDays: ["2026-09-06", "2026-09-05", "2026-09-02"],
      span: { start: "2026-09-01", end: "2026-09-07" },
    });
  });

  it("reveals a span whose only records are knowledge changes (interaction count zero)", () => {
    const resolution = resolveHeatmapTarget(model, {
      kind: "cycle",
      start: "2026-08-15",
      end: "2026-08-28",
    });
    expect(resolution.kind).toBe("reveal");
    if (resolution.kind === "reveal") {
      expect(resolution.days).toEqual(["2026-08-20"]);
    }
  });

  it("resolves a span with no record of any family to empty-span", () => {
    expect(
      resolveHeatmapTarget(model, {
        kind: "cycle",
        start: "2026-09-09",
        end: "2026-09-15",
      }),
    ).toEqual({ kind: "empty-span", start: "2026-09-09", end: "2026-09-15" });
  });
});

describe("a span crossing New Year (Pitfall 4)", () => {
  // 2026: 30 daily records Oct 7 back, plus Jan 1 (record 30). 2025: 22
  // records on Dec 31, then Dec 28 (record 22).
  const model = buildStreamModel(
    source({
      interactions: [
        ...dailyInteractions(30, { y: 2026, m: 10, d: 7 }, 1),
        interaction(50, "2026-01-01 09:00:00"),
        ...sameDayInteractions(22, "2025-12-31", 100),
        interaction(200, "2025-12-28 09:00:00"),
      ],
    }),
    TODAY,
  );

  it("returns days in both years and opens and grows every year it touches", () => {
    const resolution = resolveHeatmapTarget(model, {
      kind: "cycle",
      start: "2025-12-27",
      end: "2026-01-02",
    });
    expect(resolution.kind).toBe("reveal");
    if (resolution.kind !== "reveal") return;
    expect(resolution.days).toEqual(["2026-01-01", "2025-12-31", "2025-12-28"]);
    expect(resolution.scrollDay).toBe("2026-01-01");
    const next = streamStateOnReveal(
      initialStreamState(),
      model,
      resolution.days,
    );
    expect(isYearOpen(next, model, 2025)).toBe(true);
    expect(next.shown.get(2026)).toBe(40);
    expect(next.shown.get(2025)).toBe(40);
    const rendered = (year: number) =>
      visibleYear(next, model, year)
        .months.flatMap((m) => m.days)
        .map((d) => d.date);
    expect(rendered(2026)).toContain("2026-01-01");
    expect(rendered(2025)).toContain("2025-12-28");
  });
});

describe("revealAnnouncement (D-23)", () => {
  it("names a day's full date with the year", () => {
    expect(
      revealAnnouncement(
        {
          kind: "reveal",
          days: ["2026-10-02"],
          scrollDay: "2026-10-02",
          highlightDays: ["2026-10-02"],
        },
        TODAY,
      ),
    ).toBe("Showing Friday, October 2, 2026");
  });

  it("names both ends of a span with their years", () => {
    expect(
      revealAnnouncement(
        {
          kind: "reveal",
          days: ["2026-09-02"],
          scrollDay: "2026-09-02",
          highlightDays: ["2026-09-02"],
          span: { start: "2026-09-01", end: "2026-09-07" },
        },
        TODAY,
      ),
    ).toBe("Showing Tuesday, September 1, 2026 to Monday, September 7, 2026");
  });
});
