import type { StatusDisplayState } from "@/components/contact-card-ring";
import {
  DECAYING,
  NEVER_CONTACTED,
  ROGUE,
  STABLE,
  WOBBLY,
} from "@/constants/glossary";

/** The shared, non-colour human-readable label for a display status. */
export function statusDisplayLabel(state: StatusDisplayState): string {
  switch (state) {
    case "stable":
      return STABLE;
    case "wobble":
      return WOBBLY;
    case "decay":
      return DECAYING;
    case "rogue":
      return ROGUE;
    case "snoozed":
      return "Snoozed";
    default:
      return NEVER_CONTACTED;
  }
}
