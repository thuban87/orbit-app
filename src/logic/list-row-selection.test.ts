import { describe, expect, it } from "vitest";

import type { Line3Candidate } from "@/db/dashboard-knowledge-read";
import { PROMPTS, selectLine3 } from "@/logic/list-row-selection";

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

describe("selectLine3", () => {
  it("prioritizes imminent useful context over pinned and ordinary candidates", () => {
    const selected = selectLine3(
      [
        candidate({ id: 1, value: "Ordinary context" }),
        candidate({ id: 2, value: "Pinned context", pinned: true }),
        candidate({ id: 3, value: "Upcoming trip", meaningfulDate: "2026-09-09" }),
      ],
      7,
      "Alex",
      NOW,
    );

    expect(selected).toMatchObject({ kind: "candidate", text: "Upcoming trip", type: "general" });
  });

  it("never selects birthday knowledge, including when it would otherwise be imminent", () => {
    const selected = selectLine3(
      [
        candidate({ id: 1, type: "birthday", value: "Birthday", meaningfulDate: "2026-09-07", pinned: true }),
        candidate({ id: 2, value: "Ordinary context" }),
      ],
      7,
      "Alex",
      NOW,
    );

    expect(selected).toMatchObject({ kind: "candidate", text: "Ordinary context" });
  });

  it("breaks equal-tier ties by stable identity rather than input ordering", () => {
    const older = candidate({ id: 3, value: "Older id", createdAt: "2026-09-01 12:00:00" });
    const newer = candidate({ id: 8, value: "Newer id", createdAt: "2026-09-01 12:00:00" });
    const reversed = [newer, older];

    expect(selectLine3([older, newer], 7, "Alex", NOW)).toMatchObject({ text: "Newer id" });
    expect(selectLine3(reversed, 7, "Alex", NOW)).toMatchObject({ text: "Newer id" });
  });

  it("uses a stable per-contact completeness prompt when no useful context exists", () => {
    const contactId = 13;
    const selection = selectLine3([], contactId, "Alex", NOW);

    expect(selection).toEqual({
      kind: "prompt",
      text: PROMPTS[contactId % PROMPTS.length].replace("{name}", "Alex"),
    });
    expect(selectLine3([], contactId, "Alex", NOW)).toEqual(selection);
  });

  it("uses the UI-SPEC completeness prompts verbatim", () => {
    expect(PROMPTS).toEqual([
      "Add something to remember about {name}",
      "What should you remember about {name}?",
      "Add a detail about {name}",
      "Fill in a little more about {name}",
      "What's useful to know about {name}?",
      "Add some context about {name}",
      "Save something worth remembering about {name}",
      "Add a note, detail, or memory about {name}",
      "Tell Orbit a little more about {name}",
      "Nothing remembered about {name} yet",
    ]);
  });
});
