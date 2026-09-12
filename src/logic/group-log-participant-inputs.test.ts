import { describe, expect, it, vi } from "vitest";
import { toGroupParticipantInputs } from "./group-log-participant-inputs";

describe("toGroupParticipantInputs", () => {
  it("mints one distinct child uid for every selected contact", () => {
    const mintUid = vi
      .fn()
      .mockReturnValueOnce("child-a")
      .mockReturnValueOnce("child-b")
      .mockReturnValueOnce("child-c");

    expect(toGroupParticipantInputs([12, 18, 29], mintUid)).toEqual([
      { contactId: 12, uid: "child-a" },
      { contactId: 18, uid: "child-b" },
      { contactId: 29, uid: "child-c" },
    ]);
    expect(
      new Set(mintUid.mock.results.map((result) => result.value)).size,
    ).toBe(3);
  });

  it("returns no child inputs for an event-first empty selection", () => {
    const mintUid = vi.fn();
    expect(toGroupParticipantInputs([], mintUid)).toEqual([]);
    expect(mintUid).not.toHaveBeenCalled();
  });

  it("leaves the parent uid to a separate mint", () => {
    const mintUid = vi
      .fn()
      .mockReturnValueOnce("parent")
      .mockReturnValueOnce("child-a")
      .mockReturnValueOnce("child-b");
    const parentUid = mintUid();
    const children = toGroupParticipantInputs([12, 18], mintUid);

    expect(parentUid).not.toEqual(children[0]?.uid);
    expect(parentUid).not.toEqual(children[1]?.uid);
  });
});
