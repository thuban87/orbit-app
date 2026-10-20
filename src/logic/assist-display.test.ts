/**
 * Banner and pending-list display copy (38.14 D-74, D-79; tests per D-48).
 */
import { describe, expect, it } from "vitest";
import {
  assistAnswerSnackbar,
  assistDestinationLine,
} from "@/logic/assist-display";

const NOW = "2026-10-20 16:00:00";

describe("assistDestinationLine (D-74, D-79)", () => {
  it("reads channel, destination and today's time", () => {
    expect(
      assistDestinationLine(
        {
          channel: "text",
          endpoint_display: "555-0101",
          handoff_at: "2026-10-20 14:14:00",
        },
        NOW,
      ),
    ).toBe("Text to 555-0101 · 2:14 PM");
  });

  it("names Call and Email by their channel", () => {
    expect(
      assistDestinationLine(
        {
          channel: "call",
          endpoint_display: "(555) 010-2020",
          handoff_at: "2026-10-20 09:05:30",
        },
        NOW,
      ),
    ).toBe("Call to (555) 010-2020 · 9:05 AM");
    expect(
      assistDestinationLine(
        {
          channel: "email",
          endpoint_display: "maya@example.com",
          handoff_at: "2026-10-20 14:14:00",
        },
        NOW,
      ),
    ).toBe("Email to maya@example.com · 2:14 PM");
  });

  it("omits the destination when there is none", () => {
    expect(
      assistDestinationLine(
        {
          channel: "text",
          endpoint_display: null,
          handoff_at: "2026-10-20 14:14:00",
        },
        NOW,
      ),
    ).toBe("Text · 2:14 PM");
    expect(
      assistDestinationLine(
        {
          channel: "text",
          endpoint_display: "  ",
          handoff_at: "2026-10-20 14:14:00",
        },
        NOW,
      ),
    ).toBe("Text · 2:14 PM");
  });

  it("says Yesterday for a handoff on the previous local day (rows live up to 24 h, D-09)", () => {
    expect(
      assistDestinationLine(
        {
          channel: "text",
          endpoint_display: "555-0101",
          handoff_at: "2026-10-19 14:14:00",
        },
        "2026-10-20 08:00:00",
      ),
    ).toBe("Text to 555-0101 · Yesterday 2:14 PM");
  });

  it("crosses a month boundary for Yesterday", () => {
    expect(
      assistDestinationLine(
        {
          channel: "call",
          endpoint_display: null,
          handoff_at: "2026-09-30 23:59:00",
        },
        "2026-10-01 00:10:00",
      ),
    ).toBe("Call · Yesterday 11:59 PM");
  });

  it("falls back to the full date and time for anything older", () => {
    expect(
      assistDestinationLine(
        {
          channel: "text",
          endpoint_display: null,
          handoff_at: "2026-10-17 14:14:00",
        },
        NOW,
      ),
    ).toBe("Text · Oct 17, 2026, 2:14 PM");
  });
});

describe("assistAnswerSnackbar (D-74)", () => {
  it("logged: names Message for text and email, Call for call, and the person", () => {
    expect(
      assistAnswerSnackbar({
        channel: "text",
        personName: "Maya",
        answer: "logged",
      }),
    ).toBe("Logged Message with Maya");
    expect(
      assistAnswerSnackbar({
        channel: "email",
        personName: "Maya",
        answer: "logged",
      }),
    ).toBe("Logged Message with Maya");
    expect(
      assistAnswerSnackbar({
        channel: "call",
        personName: "Maya",
        answer: "logged",
      }),
    ).toBe("Logged Call with Maya");
  });

  it("no answer: a logged Call that says no one answered", () => {
    expect(
      assistAnswerSnackbar({
        channel: "call",
        personName: "Maya",
        answer: "no-answer",
      }),
    ).toBe("Logged Call with Maya, no answer");
  });

  it("dismissed: says nothing was logged, naming channel and person", () => {
    expect(
      assistAnswerSnackbar({
        channel: "text",
        personName: "Maya",
        answer: "dismissed",
      }),
    ).toBe("Didn't log Message with Maya");
    expect(
      assistAnswerSnackbar({
        channel: "call",
        personName: "Maya",
        answer: "dismissed",
      }),
    ).toBe("Didn't log Call with Maya");
  });

  it("drops the name when there is none", () => {
    expect(
      assistAnswerSnackbar({
        channel: "text",
        personName: null,
        answer: "logged",
      }),
    ).toBe("Logged Message");
  });
});
