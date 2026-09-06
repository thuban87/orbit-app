import { describe, expect, it } from "vitest";

import type { Line3Candidate } from "@/db/dashboard-knowledge-read";
import { CARD_PROMPTS, selectCardLine3 } from "@/logic/card-line3-selection";

const NOW = new Date("2026-09-06T12:00:00");

function candidate(
  overrides: Partial<Line3Candidate> & Pick<Line3Candidate, "id" | "value">,
): Line3Candidate {
  return {
    kind: "memory",
    contactId: 7,
    createdAt: "2026-09-01 12:00:00",
    type: "general",
    pinned: false,
    meaningfulDate: null,
    ...overrides,
  };
}

describe("selectCardLine3", () => {
  it("keeps imminent meaningful context above a shorter ordinary candidate", () => {
    const selection = selectCardLine3(
      [
        candidate({ id: 1, value: "Cat" }),
        candidate({ id: 2, value: "Upcoming trip", meaningfulDate: "2026-09-09" }),
      ],
      7,
      "Alex",
      NOW,
    );

    expect(selection).toMatchObject({ kind: "candidate", text: "Upcoming trip" });
  });

  it("prefers concise candidates only within the same tier", () => {
    const selection = selectCardLine3(
      [
        candidate({ id: 1, value: "A very long detail about a project that needs more space" }),
        candidate({ id: 2, value: "Hiking" }),
      ],
      7,
      "Alex",
      NOW,
    );

    expect(selection).toMatchObject({ kind: "candidate", text: "Hiking" });
  });

  it("excludes birthdays even when they are imminent", () => {
    const selection = selectCardLine3(
      [
        candidate({ id: 1, type: "birthday", value: "Birthday", meaningfulDate: "2026-09-07" }),
        candidate({ id: 2, value: "Ordinary context" }),
      ],
      7,
      "Alex",
      NOW,
    );

    expect(selection).toMatchObject({ kind: "candidate", text: "Ordinary context" });
  });

  it("uses stable keys rather than array order for equal compactness", () => {
    const older = candidate({ id: 3, value: "Same", createdAt: "2026-09-01 12:00:00" });
    const newer = candidate({ id: 8, value: "Same", createdAt: "2026-09-01 12:00:00" });

    expect(selectCardLine3([older, newer], 7, "Alex", NOW)).toMatchObject({ text: "Same", candidate: { id: 8 } });
    expect(selectCardLine3([newer, older], 7, "Alex", NOW)).toMatchObject({ text: "Same", candidate: { id: 8 } });
  });

  it("returns a stable short, card-specific prompt when no candidate is useful", () => {
    const contactId = 13;
    const first = selectCardLine3([], contactId, "Alex", NOW);

    expect(first).toEqual({
      kind: "prompt",
      text: CARD_PROMPTS[contactId % CARD_PROMPTS.length].replace("{name}", "Alex"),
    });
    expect(selectCardLine3([], contactId, "Alex", NOW)).toEqual(first);
    expect(CARD_PROMPTS).not.toContain("What should you remember about {name}?");
  });

  it("selects the only useful candidate directly", () => {
    expect(
      selectCardLine3([candidate({ id: 1, value: "\ud83d\udc15 Luna" })], 7, "Alex", NOW),
    ).toMatchObject({ kind: "candidate", text: "\ud83d\udc15 Luna" });
  });
});
