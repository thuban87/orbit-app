import { describe, expect, it } from "vitest";
import {
  buildGroupEventDetailInteraction,
  groupEventDurationLabel,
} from "./group-event-detail-logic";

const event = {
  id: 7,
  uid: "event-7",
  title: "Dinner",
  occurredAt: "2026-09-10 18:00:00",
  channel: "Call",
  quality: "Positive",
  duration: 3600,
  groupNote: "Shared context",
  participants: [],
} as const;

const participant = {
  interactionId: 8,
  contactId: 9,
  contactName: "Alex",
  contactPhoto: null,
  channel: "Call",
  quality: "Positive",
  duration: 3600,
  direction: null,
  connected: 1,
  geFollowChannel: 1,
  geFollowQuality: 1,
  geFollowDuration: 1,
  note: "Participant note",
  allowAi: 1,
} as const;

describe("Group Event Detail view model", () => {
  it("uses the shared whole-seconds duration vocabulary", () => {
    expect(groupEventDurationLabel(3600)).toBe("1h");
    expect(groupEventDurationLabel(null)).toBeNull();
  });

  it("preserves the stored child Allow-AI value into InteractionDetail input", () => {
    expect(buildGroupEventDetailInteraction(event, participant)).toMatchObject({
      allowAi: 1,
      groupEventId: 7,
      groupLinked: true,
    });
  });
});
