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

/**
 * Allow live Profile opens for either lifecycle state, but require a live Bound
 * contact for the active-cadence Compose quick action. Favourites has no contact
 * target and remains a valid projection-level route.
 */
export async function guardWidgetIntent(
  intent: WidgetNavIntent | null,
  lookup: WidgetContactLookup,
): Promise<WidgetNavIntent | null> {
  if (intent === null) {
    return null;
  }

  const target = intent.routes[1];
  if (target.name === "ManageFavourites") {
    return intent;
  }

  const contact = await lookup(target.params.contactId);
  if (contact === null || contact.archived_at !== null) {
    return null;
  }

  if (target.name === "Compose" && contact.trackingEnabled !== 1) {
    return null;
  }

  return intent;
}
