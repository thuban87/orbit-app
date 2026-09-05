/**
 * Database-backed post-parse guard for widget intents.
 *
 * Widget URLs are strict-minted by `resolveWidgetUri`; this guard deliberately
 * runs afterwards because a valid URL can still point to lifecycle state that has
 * changed since the widget last rendered.
 */
import type { WidgetNavIntent } from "@/navigation/widget-linking";

export type WidgetContactLookup = (contactId: number) => Promise<{
  archived_at: string | null;
  trackingEnabled: number;
} | null>;

export type WidgetIntentGuardResult =
  | { ok: true; intent: WidgetNavIntent }
  | { ok: false; reason: "missing" | "archived" | "ineligible" };

/**
 * Allow live Profile opens for either lifecycle state, but require a live Bound
 * contact for the active-cadence Compose quick action. The Home-only Favorites
 * route has no contact target and remains a valid projection-level route.
 */
export async function guardWidgetIntent(
  intent: WidgetNavIntent | null,
  lookup: WidgetContactLookup,
): Promise<WidgetIntentGuardResult> {
  if (intent === null) {
    return { ok: false, reason: "missing" };
  }

  if (intent.index === 0) {
    return { ok: true, intent };
  }

  const target = intent.routes[1];
  const contact = await lookup(target.params.contactId);
  if (contact === null) {
    return { ok: false, reason: "missing" };
  }
  if (contact.archived_at !== null) {
    return { ok: false, reason: "archived" };
  }

  if (target.name === "Compose" && contact.trackingEnabled !== 1) {
    return { ok: false, reason: "ineligible" };
  }

  return { ok: true, intent };
}
