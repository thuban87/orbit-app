import { describe, expect, it } from "vitest";
import {
  buildDetailRows,
  buildGroupContext,
  showSparkle,
} from "./interaction-detail-logic";
import type {
  GroupLinkedDetailInput,
  InteractionDetailInput,
} from "./interaction-detail-logic";

const base: InteractionDetailInput = {
  channel: "Message",
  occurredAt: "2026-09-11 14:30:00",
  direction: "Outgoing",
  connected: 1,
  quality: "Positive",
  duration: 1500, // 25m
  note: "Talked about the trip",
  allowAi: 0,
};

const rowKeys = (input: InteractionDetailInput) =>
  buildDetailRows(input).map((r) => r.key);

describe("buildDetailRows — no blank fields (HIST-11)", () => {
  it("omits the duration row entirely when duration is absent", () => {
    expect(rowKeys({ ...base, duration: null })).not.toContain("duration");
  });

  it("omits the Tone row entirely when quality is absent", () => {
    expect(rowKeys({ ...base, quality: null })).not.toContain("tone");
  });

  it("omits the note row entirely when the note is absent or blank", () => {
    expect(rowKeys({ ...base, note: null })).not.toContain("note");
    expect(rowKeys({ ...base, note: "   " })).not.toContain("note");
  });

  it("omits the direction row when direction is absent", () => {
    expect(rowKeys({ ...base, direction: null })).not.toContain("direction");
  });

  it("omits the channel row when the channel is unspecified", () => {
    expect(rowKeys({ ...base, channel: "unspecified" })).not.toContain(
      "channel",
    );
  });

  it("renders every present field with a non-empty value (no blanks)", () => {
    const rows = buildDetailRows(base);
    expect(rows.map((r) => r.key)).toEqual([
      "channel",
      "datetime",
      "direction",
      "connected",
      "tone",
      "duration",
      "note",
    ]);
    for (const row of rows) {
      expect(row.value.trim().length).toBeGreaterThan(0);
      expect(row.label.trim().length).toBeGreaterThan(0);
    }
    expect(rows.find((r) => r.key === "duration")?.value).toBe("25m");
  });

  it("shows the connected state textually for a no-reply interaction", () => {
    const rows = buildDetailRows({ ...base, connected: 0 });
    expect(rows.find((r) => r.key === "connected")?.value).toBe("No reply");
  });
});

describe("showSparkle — privacy gate strictly on allow_ai===1 (HIST-11, D-04)", () => {
  it("is true only when allow_ai is exactly 1", () => {
    expect(showSparkle({ allowAi: 1 })).toBe(true);
  });

  it("is false when allow_ai is 0", () => {
    expect(showSparkle({ allowAi: 0 })).toBe(false);
  });

  it("is false when allow_ai is undefined", () => {
    expect(showSparkle({})).toBe(false);
  });
});

describe("buildGroupContext — dormant inert seam (D-12)", () => {
  it("produces no group context for a real Phase-32 (standalone) interaction", () => {
    // No group-event id on the record -> the isGroupLinked predicate is false.
    expect(buildGroupContext(base)).toBeNull();
  });

  it("shapes group context ONLY for a synthetic group-linked input (predicate forced true)", () => {
    const synthetic: GroupLinkedDetailInput = {
      ...base,
      note: "My side of it",
      groupEventId: 7,
      groupTitle: "Dinner with the crew",
      groupNote: "Shared group recap — never sent to AI",
    };
    const ctx = buildGroupContext(synthetic);
    expect(ctx).not.toBeNull();
    expect(ctx?.groupTitle).toBe("Dinner with the crew");
    // The group note is a DISTINCT field, never concatenated into the participant note.
    expect(ctx?.groupNote).toBe("Shared group recap — never sent to AI");
    expect(ctx?.participantNote).toBe("My side of it");
    expect(ctx?.groupNote).not.toBe(ctx?.participantNote);
    expect(ctx?.showViewGroupEvent).toBe(true);
  });
});
