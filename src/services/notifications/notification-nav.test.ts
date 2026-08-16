/**
 * notification-nav — proof that the tap-routing DECISION is a pure, serializable
 * function, independent of the OS listener wiring (the gate applies the intent).
 *
 * The three cases the gate depends on:
 *   - decay body tap → a RESET to [Home, Compose{contactId}] so Back always lands
 *     on the dashboard regardless of the prior stack (Pitfall 7 / T-11-BACKSTACK),
 *   - birthday body tap → a NAVIGATE to Profile{contactId} (NOTIF-04),
 *   - a malformed / unknown payload → null (no navigation).
 * No react-navigation or expo import is exercised — this is node-loadable.
 */
import { describe, expect, it } from "vitest";
import { resolveNotificationNav } from "./notification-nav";

describe("resolveNotificationNav", () => {
  it("routes a decay body tap to a reset onto [Home, Compose{contactId}]", () => {
    expect(
      resolveNotificationNav({
        kind: "decay",
        contactId: 42,
        occurrenceKey: "2026-08-16",
      }),
    ).toEqual({
      type: "reset",
      index: 1,
      routes: [
        { name: "Home" },
        { name: "Compose", params: { contactId: 42 } },
      ],
    });
  });

  it("routes a birthday body tap to a navigate to Profile{contactId}", () => {
    expect(
      resolveNotificationNav({
        kind: "birthday",
        contactId: 7,
        occurrenceKey: "2026-08-16",
      }),
    ).toEqual({
      type: "navigate",
      name: "Profile",
      params: { contactId: 7 },
    });
  });

  it("returns null for an unknown kind", () => {
    expect(
      resolveNotificationNav({ kind: "mystery", contactId: 1 }),
    ).toBeNull();
  });

  it("returns null for a missing/non-numeric contactId", () => {
    expect(resolveNotificationNav({ kind: "decay" })).toBeNull();
    expect(
      resolveNotificationNav({ kind: "decay", contactId: "42" }),
    ).toBeNull();
  });

  it("returns null for a null / undefined / non-object payload", () => {
    expect(resolveNotificationNav(null)).toBeNull();
    expect(resolveNotificationNav(undefined)).toBeNull();
    expect(resolveNotificationNav("decay")).toBeNull();
    expect(resolveNotificationNav(42)).toBeNull();
  });
});
