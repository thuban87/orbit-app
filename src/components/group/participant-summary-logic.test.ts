import { describe, expect, it } from "vitest";
import { resolveDisplay } from "@/logic/group-inheritance";
import {
  followLineLabel,
  participantChangeSummary,
} from "./participant-summary-logic";

/**
 * Participant wording names its fields (38.14 D-29; phase-12 :292, :296
 * "remain compact"): each follow line in the participant editor says which
 * field it is about, and the card summarises what is changed for that person.
 */

const event = { channel: "Call", quality: "Positive", duration: 3600 };
const child = (follow: {
  channel: 0 | 1;
  quality: 0 | 1;
  duration: 0 | 1;
}) => ({
  channel: "Call",
  quality: "Neutral",
  duration: 600,
  direction: null,
  connected: 1,
  geFollowChannel: follow.channel,
  geFollowQuality: follow.quality,
  geFollowDuration: follow.duration,
});

describe("followLineLabel (38.14 D-29)", () => {
  it("names the field on a Same as event line", () => {
    expect(followLineLabel("Channel", true)).toBe("Channel: same as event");
  });

  it("names the field on a changed line", () => {
    expect(followLineLabel("Tone", false)).toBe(
      "Tone: changed for this person",
    );
  });
});

describe("participantChangeSummary (38.14 D-29)", () => {
  it("nothing changed reads Same as event", () => {
    const display = resolveDisplay(
      child({ channel: 1, quality: 1, duration: 1 }),
      event,
    );
    expect(participantChangeSummary(display)).toBe("Same as event");
  });

  it("names the changed fields, compactly, in field order", () => {
    const display = resolveDisplay(
      child({ channel: 1, quality: 0, duration: 0 }),
      event,
    );
    expect(participantChangeSummary(display)).toBe(
      "Changed for this person: Tone, Duration",
    );
  });

  it("names a single changed field", () => {
    const display = resolveDisplay(
      child({ channel: 0, quality: 1, duration: 1 }),
      event,
    );
    expect(participantChangeSummary(display)).toBe(
      "Changed for this person: Channel",
    );
  });
});
