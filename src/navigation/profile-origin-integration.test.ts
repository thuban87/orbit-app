import { describe, expect, it } from "vitest";
import { profileOriginIntent } from "@/screens/contact-profile-logic";

describe("Profile origin integration", () => {
  it.each([
    "dashboard",
    "orrery",
    "settings",
    "widget",
    "notification",
  ] as const)("keeps %s on the native origin-aware Back path", (origin) => {
    expect(profileOriginIntent(origin, 42)).toEqual({
      origin,
      route: { contactId: 42 },
      back: "native-go-back",
    });
  });

  it("keeps the Profile-only openReachOut route contract serializable", () => {
    const intent = profileOriginIntent("notification", 42, true);
    expect(JSON.parse(JSON.stringify(intent))).toEqual(intent);
    expect(intent.route).toEqual({ contactId: 42, openReachOut: true });
  });
});
