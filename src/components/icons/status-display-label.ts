import type { StatusDisplayState } from "@/components/contact-card-ring";

/** The shared, non-colour human-readable label for a display status. */
export function statusDisplayLabel(state: StatusDisplayState): string {
  switch (state) {
    case "stable":
      return "Stable";
    case "wobble":
      return "Wobbling";
    case "decay":
      return "Decaying";
    case "rogue":
      return "Rogue";
    case "snoozed":
      return "Snoozed";
    default:
      return "Not yet contacted";
  }
}
