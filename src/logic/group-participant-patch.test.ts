import { describe, expect, it } from "vitest";

import {
  buildParticipantFieldPatch,
  buildParticipantFollowPatch,
  type ParticipantPatchDraft,
} from "@/logic/group-participant-patch";

type Field = "channel" | "quality" | "duration";

/** Parent event values the "following" drafts resolve to. */
const PARENT = { channel: "Call", quality: "Positive", duration: 3600 };

function draft(
  overrides: {
    value?: Partial<ParticipantPatchDraft["value"]>;
    follow?: Partial<ParticipantPatchDraft["follow"]>;
  } = {},
): ParticipantPatchDraft {
  return {
    value: {
      channel: PARENT.channel,
      quality: PARENT.quality,
      duration: PARENT.duration,
      direction: "outbound",
      connected: 1,
      note: "private note",
      ...overrides.value,
    },
    follow: {
      channel: true,
      quality: true,
      duration: true,
      ...overrides.follow,
    },
  };
}

/** Per field: an existing override value and a different edited value. */
const CASES: Record<
  Field,
  { override: string | number; edited: string | number }
> = {
  channel: { override: "Message", edited: "In Person" },
  quality: { override: "Negative", edited: "Neutral" },
  duration: { override: 600, edited: 1200 },
};

describe("buildParticipantFollowPatch", () => {
  for (const field of ["channel", "quality", "duration"] as const) {
    const { override, edited } = CASES[field];
    const parent = PARENT[field];

    describe(field, () => {
      it("following → following, unchanged: no entry", () => {
        expect(buildParticipantFollowPatch(draft(), draft())).toEqual({});
      });

      it("following → overridden: emits the detached value", () => {
        const next = draft({
          value: { [field]: edited },
          follow: { [field]: false },
        });
        expect(buildParticipantFollowPatch(draft(), next)).toEqual({
          [field]: { follow: false, value: edited },
        });
      });

      it("overridden → Follow event: emits follow true", () => {
        const initial = draft({
          value: { [field]: override },
          follow: { [field]: false },
        });
        const next = draft({
          value: { [field]: parent },
          follow: { [field]: true },
        });
        expect(buildParticipantFollowPatch(initial, next)).toEqual({
          [field]: { follow: true },
        });
      });

      it("overridden → overridden with a new value: emits the new value (AUD-REL-006)", () => {
        const initial = draft({
          value: { [field]: override },
          follow: { [field]: false },
        });
        const next = draft({
          value: { [field]: edited },
          follow: { [field]: false },
        });
        expect(buildParticipantFollowPatch(initial, next)).toEqual({
          [field]: { follow: false, value: edited },
        });
      });

      it("overridden → overridden, unchanged: no entry", () => {
        const initial = draft({
          value: { [field]: override },
          follow: { [field]: false },
        });
        expect(buildParticipantFollowPatch(initial, draft(initial))).toEqual(
          {},
        );
      });

      it("an override edited to equal the parent stays detached (ADR-125: equality never implies follow)", () => {
        const initial = draft({
          value: { [field]: override },
          follow: { [field]: false },
        });
        const next = draft({
          value: { [field]: parent },
          follow: { [field]: false },
        });
        const patch = buildParticipantFollowPatch(initial, next);
        expect(patch).toEqual({ [field]: { follow: false, value: parent } });
        expect(patch[field]).not.toEqual({ follow: true });
      });
    });
  }

  it("overridden Tone → null emits an explicit null override", () => {
    const initial = draft({
      value: { quality: "Negative" },
      follow: { quality: false },
    });
    const next = draft({
      value: { quality: null },
      follow: { quality: false },
    });
    expect(buildParticipantFollowPatch(initial, next)).toEqual({
      quality: { follow: false, value: null },
    });
  });

  it("overridden null Tone → value emits the new value", () => {
    const initial = draft({
      value: { quality: null },
      follow: { quality: false },
    });
    const next = draft({
      value: { quality: "Neutral" },
      follow: { quality: false },
    });
    expect(buildParticipantFollowPatch(initial, next)).toEqual({
      quality: { follow: false, value: "Neutral" },
    });
  });

  it("overridden Duration → null and null → value both emit", () => {
    const withValue = draft({
      value: { duration: 600 },
      follow: { duration: false },
    });
    const withNull = draft({
      value: { duration: null },
      follow: { duration: false },
    });
    expect(buildParticipantFollowPatch(withValue, withNull)).toEqual({
      duration: { follow: false, value: null },
    });
    expect(buildParticipantFollowPatch(withNull, withValue)).toEqual({
      duration: { follow: false, value: 600 },
    });
  });

  it("an explicit equal-valued override against a following baseline stays detached", () => {
    // User detached the field without changing the value (e.g. picked the same
    // value): follow flips false, so the op is an override, never a follow.
    const next = draft({ follow: { channel: false } });
    expect(buildParticipantFollowPatch(draft(), next)).toEqual({
      channel: { follow: false, value: PARENT.channel },
    });
  });

  it("emits only the changed fields when several are edited", () => {
    const initial = draft({
      value: { channel: "Message", duration: 600 },
      follow: { channel: false, duration: false },
    });
    const next = draft({
      value: { channel: "In Person", duration: 600, quality: "Negative" },
      follow: { channel: false, duration: false, quality: false },
    });
    expect(buildParticipantFollowPatch(initial, next)).toEqual({
      channel: { follow: false, value: "In Person" },
      quality: { follow: false, value: "Negative" },
    });
  });
});

describe("buildParticipantFieldPatch", () => {
  it("an unchanged draft yields an empty field patch", () => {
    expect(buildParticipantFieldPatch(draft(), draft())).toEqual({});
  });

  it("includes only changed direct fields", () => {
    expect(
      buildParticipantFieldPatch(
        draft(),
        draft({ value: { direction: null } }),
      ),
    ).toEqual({ direction: null });
    expect(
      buildParticipantFieldPatch(draft(), draft({ value: { connected: 0 } })),
    ).toEqual({ connected: 0 });
    expect(
      buildParticipantFieldPatch(draft(), draft({ value: { note: null } })),
    ).toEqual({ note: null });
    expect(
      buildParticipantFieldPatch(
        draft(),
        draft({
          value: { direction: "inbound", connected: 0, note: "changed" },
        }),
      ),
    ).toEqual({ direction: "inbound", connected: 0, note: "changed" });
  });

  it("ignores inheritable-field edits (those belong to the follow patch)", () => {
    expect(
      buildParticipantFieldPatch(
        draft(),
        draft({ value: { channel: "Message" }, follow: { channel: false } }),
      ),
    ).toEqual({});
  });
});
