/**
 * notification-nav — the PURE tap-routing decision, separate from the OS listener
 * wiring (notification-gate.tsx applies the intent it returns).
 *
 * It is node-loadable: NO react-navigation and NO expo import. It returns a
 * serializable, discriminated nav-intent — a plain description of "what to do" —
 * so the routing logic is unit-tested without a navigator or the OS in the loop.
 *
 * Two intents, one per notification kind:
 *   - decay body tap → a RESET onto [Home, Compose{contactId}]. A reset (not a
 *     navigate) so Back ALWAYS lands on the dashboard regardless of the stack the
 *     OS handed us under singleTask/onNewIntent — TaskStackBuilder does not
 *     compose with singleTask, so the back-stack is a JS concern (Pitfall 7 /
 *     T-11-BACKSTACK). `index: 1` selects Compose as the focused route.
 *   - birthday body tap → a NAVIGATE to Profile{contactId} (NOTIF-04).
 *
 * A malformed / unknown payload returns null so the gate performs no navigation.
 */
import type { NotificationData } from "./notification-ids";

/**
 * A serializable navigation intent the gate applies to `navigationRef.current`
 * (`reset(...)` for a reset intent, `navigate(...)` for a navigate intent). The
 * shapes mirror react-navigation's `reset`/`navigate` arguments so the gate is a
 * thin adapter with no branching logic of its own.
 */
export type NavIntent =
  | {
      type: "reset";
      index: 1;
      routes: [
        { name: "Home" },
        { name: "Compose"; params: { contactId: number } },
      ];
    }
  | { type: "navigate"; name: "Profile"; params: { contactId: number } };

/**
 * Narrow an arbitrary tap payload (cold-start data is loosely typed) to a valid
 * `NotificationData`. Anything else — wrong kind, missing/non-numeric contactId,
 * a non-object — is treated as malformed and routes nowhere.
 */
function isNotificationData(d: unknown): d is NotificationData {
  if (typeof d !== "object" || d === null) {
    return false;
  }
  const rec = d as Record<string, unknown>;
  return (
    (rec.kind === "decay" || rec.kind === "birthday") &&
    typeof rec.contactId === "number"
  );
}

/**
 * Resolve a tapped notification's `data` payload to a serializable nav intent, or
 * null when the payload is malformed. Pure — no navigator, no OS, no side effect.
 */
export function resolveNotificationNav(data: unknown): NavIntent | null {
  if (!isNotificationData(data)) {
    return null;
  }

  if (data.kind === "decay") {
    return {
      type: "reset",
      index: 1,
      routes: [
        { name: "Home" },
        { name: "Compose", params: { contactId: data.contactId } },
      ],
    };
  }

  // kind === "birthday" (the only other narrowed value).
  return {
    type: "navigate",
    name: "Profile",
    params: { contactId: data.contactId },
  };
}
