import { describe, expect, it } from "vitest";
import {
  buildGroupEventDetailInteraction,
  closeThenOpenEventEditor,
  closeThenOpenParticipantEditor,
  closeThenOpenParticipantProfile,
  eventDetailRouteKeyBelow,
  groupEventDurationLabel,
  resolveDetailParticipant,
  withSavedTitle,
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

  it("closes the interaction detail before opening the participant profile", () => {
    const calls: string[] = [];
    const navigate = (route: "Profile", params: { contactId: number }) => {
      calls.push(`navigate:${route}:${params.contactId}`);
    };

    closeThenOpenParticipantProfile({
      close: () => calls.push("close"),
      navigate,
      contactId: 9,
    });

    expect(calls).toEqual(["close", "navigate:Profile:9"]);
  });
});

describe("close-before-push editors (38.14 review B-CR-01)", () => {
  it("closes the sheet before pushing Edit participant, with the captured ids", () => {
    const calls: string[] = [];
    closeThenOpenParticipantEditor({
      close: () => calls.push("close"),
      navigate: (route, params) =>
        calls.push(
          `navigate:${route}:${params.groupEventId}:${params.interactionId}:${params.contactId}`,
        ),
      groupEventId: 7,
      interactionId: 8,
      contactId: 9,
    });
    expect(calls).toEqual(["close", "navigate:EditParticipant:7:8:9"]);
  });

  it("closes the sheet before pushing Edit Event", () => {
    const calls: string[] = [];
    closeThenOpenEventEditor({
      close: () => calls.push("close"),
      navigate: (route, params) =>
        calls.push(`navigate:${route}:${params.groupEventId}`),
      groupEventId: 7,
    });
    expect(calls).toEqual(["close", "navigate:EditGroupEvent:7"]);
  });
});

describe("resolveDetailParticipant (38.14 D-28)", () => {
  const refreshed = (note: string) => ({
    ...event,
    participants: [
      { ...participant, note },
      { ...participant, interactionId: 10, contactId: 11, contactName: "Sam" },
    ],
  });

  it("returns the participant from the refreshed event, not a snapshot", () => {
    expect(resolveDetailParticipant(refreshed("edited"), [], 8)).toMatchObject({
      interactionId: 8,
      note: "edited",
    });
  });

  it("returns null once the participant left the event", () => {
    const left = { ...event, participants: [refreshed("x").participants[1]] };
    expect(resolveDetailParticipant(left, [], 8)).toBeNull();
  });

  it("returns null when the participant was removed in this session", () => {
    expect(resolveDetailParticipant(refreshed("x"), [8], 8)).toBeNull();
    expect(resolveDetailParticipant(refreshed("x"), [8], 10)).toMatchObject({
      contactName: "Sam",
    });
  });

  it("returns null with no id or no event", () => {
    expect(resolveDetailParticipant(refreshed("x"), [], null)).toBeNull();
    expect(resolveDetailParticipant(null, [], 8)).toBeNull();
  });
});

describe("rename hand-off from Edit Event (38.14 D-91)", () => {
  const stack = (routes: { key: string; name: string; params?: object }[]) => ({
    index: routes.length - 1,
    routes,
  });

  it("finds the detail of the same event directly below Edit Event", () => {
    expect(
      eventDetailRouteKeyBelow(
        stack([
          { key: "list", name: "GroupEvents" },
          {
            key: "detail",
            name: "GroupEventDetail",
            params: { groupEventId: 7 },
          },
          { key: "edit", name: "EditGroupEvent", params: { groupEventId: 7 } },
        ]),
        7,
      ),
    ).toBe("detail");
  });

  it("hands nothing back when Back lands elsewhere or on another event", () => {
    // Opened from a Profile's history: Back returns to the Profile.
    expect(
      eventDetailRouteKeyBelow(
        stack([
          { key: "profile", name: "Profile", params: { contactId: 9 } },
          { key: "edit", name: "EditGroupEvent", params: { groupEventId: 7 } },
        ]),
        7,
      ),
    ).toBeNull();
    expect(
      eventDetailRouteKeyBelow(
        stack([
          {
            key: "detail",
            name: "GroupEventDetail",
            params: { groupEventId: 8 },
          },
          { key: "edit", name: "EditGroupEvent", params: { groupEventId: 7 } },
        ]),
        7,
      ),
    ).toBeNull();
    // A detail further down the stack is not the one Back returns to.
    expect(
      eventDetailRouteKeyBelow(
        stack([
          {
            key: "detail",
            name: "GroupEventDetail",
            params: { groupEventId: 7 },
          },
          { key: "profile", name: "Profile", params: { contactId: 9 } },
          { key: "edit", name: "EditGroupEvent", params: { groupEventId: 7 } },
        ]),
        7,
      ),
    ).toBeNull();
    expect(eventDetailRouteKeyBelow(stack([]), 7)).toBeNull();
  });

  it("shows the saved title at once and otherwise leaves the event alone", () => {
    expect(withSavedTitle(event, "Supper")).toEqual({
      ...event,
      title: "Supper",
    });
    expect(withSavedTitle(event, "  Supper  ")?.title).toBe("Supper");
    expect(withSavedTitle(event, undefined)).toBe(event);
    expect(withSavedTitle(event, "   ")).toBe(event);
    expect(withSavedTitle(event, "Dinner")).toBe(event);
    expect(withSavedTitle(null, "Supper")).toBeNull();
  });
});
