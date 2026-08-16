import { describe, expect, it } from "vitest";
import {
  ACTION_MARK,
  ACTION_SNOOZE,
  actionUid,
  BIRTHDAY_CHANNEL,
  birthdayBody,
  birthdayIdentifier,
  DECAY_CATEGORY,
  DECAY_PRIVATE_CHANNEL,
  DECAY_PUBLIC_CHANNEL,
  decayBody,
  decayIdentifier,
  FOREGROUND_NOTIFICATION_BEHAVIOR,
  type NotificationData,
} from "./notification-ids";

describe("stable per-contact identifiers", () => {
  it("namespaces decay vs birthday so they never collide", () => {
    expect(decayIdentifier(7)).toBe("decay:7");
    expect(birthdayIdentifier(7)).toBe("birthday:7");
    // A decay and a birthday for the SAME contact are distinct identifiers.
    expect(decayIdentifier(7)).not.toBe(birthdayIdentifier(7));
  });

  it("keys on contactId so a re-nag replaces the prior shade entry", () => {
    expect(decayIdentifier(7)).toBe(decayIdentifier(7));
    expect(decayIdentifier(7)).not.toBe(decayIdentifier(8));
  });
});

describe("generic body copy (verbatim UI-SPEC strings, no emoji)", () => {
  it("decay body is the name-only overdue copy", () => {
    expect(decayBody("Sam")).toBe("Sam — time to reach out.");
  });

  it("birthday body is the plain-text day-of copy", () => {
    expect(birthdayBody("Sam")).toBe("It's Sam's birthday today.");
  });

  it("substitutes only the name — no other dynamic text", () => {
    expect(decayBody("Alex Rivera")).toBe("Alex Rivera — time to reach out.");
    expect(birthdayBody("Alex Rivera")).toBe(
      "It's Alex Rivera's birthday today.",
    );
  });
});

describe("versioned channel ids", () => {
  it("exports the three immutable channel constants", () => {
    expect(DECAY_PRIVATE_CHANNEL).toBe("decay-private-v1");
    expect(DECAY_PUBLIC_CHANNEL).toBe("decay-public-v1");
    expect(BIRTHDAY_CHANNEL).toBe("birthday-v1");
  });
});

describe("category + action ids", () => {
  it("uses an underscore category id (hyphens are risky in Expo)", () => {
    expect(DECAY_CATEGORY).toBe("decay_actions");
    expect(DECAY_CATEGORY).not.toContain("-");
  });

  it("exports the two headless action ids", () => {
    expect(ACTION_MARK).toBe("mark");
    expect(ACTION_SNOOZE).toBe("snooze");
  });
});

describe("foreground-presentation policy (item D — silent, no-banner)", () => {
  it("suppresses banner + shade-list AND stays silent (all four flags false)", () => {
    // The dashboard is the in-app surface, so a nudge firing while foregrounded
    // is deliberately suppressed and kept silent (calm/anti-nag mandate). This is
    // the coverage the 11-01 setNotificationHandler mock stub was added to enable.
    expect(FOREGROUND_NOTIFICATION_BEHAVIOR.shouldShowBanner).toBe(false);
    expect(FOREGROUND_NOTIFICATION_BEHAVIOR.shouldShowList).toBe(false);
    expect(FOREGROUND_NOTIFICATION_BEHAVIOR.shouldPlaySound).toBe(false);
    expect(FOREGROUND_NOTIFICATION_BEHAVIOR.shouldSetBadge).toBe(false);
  });
});

describe("actionUid — deterministic idempotency key", () => {
  const data: NotificationData = {
    kind: "decay",
    contactId: 7,
    occurrenceKey: "2026-09-01",
  };

  it("composes a stable TEXT uid from action + kind + contactId + occurrenceKey", () => {
    expect(actionUid(ACTION_MARK, data)).toBe("notif:mark:decay:7:2026-09-01");
  });

  it("is a pure function — same inputs always yield the same uid", () => {
    expect(actionUid(ACTION_MARK, data)).toBe(actionUid(ACTION_MARK, data));
    expect(actionUid(ACTION_MARK, { ...data })).toBe(
      actionUid(ACTION_MARK, { ...data }),
    );
  });

  it("is collision-distinct across occurrenceKey", () => {
    expect(actionUid(ACTION_MARK, data)).not.toBe(
      actionUid(ACTION_MARK, { ...data, occurrenceKey: "2026-09-08" }),
    );
  });

  it("is collision-distinct across action", () => {
    expect(actionUid(ACTION_MARK, data)).not.toBe(
      actionUid(ACTION_SNOOZE, data),
    );
  });

  it("is collision-distinct across contactId", () => {
    expect(actionUid(ACTION_MARK, data)).not.toBe(
      actionUid(ACTION_MARK, { ...data, contactId: 8 }),
    );
  });

  it("is collision-distinct across kind", () => {
    const birthday: NotificationData = { ...data, kind: "birthday" };
    expect(actionUid(ACTION_MARK, data)).not.toBe(
      actionUid(ACTION_MARK, birthday),
    );
  });
});
