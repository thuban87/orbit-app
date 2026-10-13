import { describe, expect, it } from "vitest";
import { linkedEntryRoute } from "@/logic/linked-entry-route";

describe("linkedEntryRoute (D-37, D-48; checker B5)", () => {
  it("opens the event for a Group Note copy", () => {
    expect(
      linkedEntryRoute({
        interactionId: 7,
        contactId: 3,
        groupEventId: 11,
        linkSource: "group_note",
      }),
    ).toEqual({ name: "GroupEventDetail", params: { groupEventId: 11 } });
  });

  it("opens the participant editor for a participant's own note in an event", () => {
    expect(
      linkedEntryRoute({
        interactionId: 7,
        contactId: 3,
        groupEventId: 11,
        linkSource: "note",
      }),
    ).toEqual({
      name: "EditParticipant",
      params: { groupEventId: 11, interactionId: 7, contactId: 3 },
    });
  });

  it("opens Edit Interaction for a standalone note", () => {
    expect(
      linkedEntryRoute({
        interactionId: 7,
        contactId: 3,
        groupEventId: null,
        linkSource: "note",
      }),
    ).toEqual({
      name: "EditInteraction",
      params: { contactId: 3, interactionId: 7 },
    });
  });

  it("falls back to the interaction for a group_note link outside an event", () => {
    expect(
      linkedEntryRoute({
        interactionId: 7,
        contactId: 3,
        groupEventId: null,
        linkSource: "group_note",
      }),
    ).toEqual({
      name: "EditInteraction",
      params: { contactId: 3, interactionId: 7 },
    });
  });

  it("has no route when the interaction no longer exists", () => {
    expect(linkedEntryRoute(null)).toBeNull();
  });
});
