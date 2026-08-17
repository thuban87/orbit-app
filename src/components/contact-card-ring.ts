/**
 * ringVisual (12-01) — the PURE status→ring mapping for the dashboard
 * `ContactCard`, extracted into an RN-free sibling module (mirroring
 * `avatar-initials.ts` beside `Avatar.tsx`) so it is node-unit-testable without
 * loading `react-native`. `ContactCard.tsx` imports and RE-EXPORTS it, so the
 * helper is still "exported from ContactCard" for app consumers.
 *
 * This RETIRES the OD-1 opacity-as-signal placeholder: colour is now the primary
 * status channel (via the owner-approved shared tokens), border WEIGHT is the
 * redundant CVD-safe channel, and opacity only distinguishes the never-contacted
 * neutral (a faint ring = "no status yet") from the four real, fully-opaque
 * states.
 *
 * The in-app card version carries an OPACITY concept the forthcoming headless
 * widget mapping (`widget-colors.ts`, planned in 12-03) will lack; the two tables
 * are meant to stay consistent but deliberately separate (the widget has no theme
 * provider).
 *
 * Every colour resolves through the passed theme palette — NO hex literal here
 * (CLAUDE.md / check:colors).
 */
import type { ProfileStatus } from "@/db/contact-status-read";
import type { ThemePalette } from "@/theme/theme-types";

/** The resolved ring style for a status: colour + opacity + border weight. */
export interface RingVisual {
  color: string;
  opacity: number;
  width: number;
}

/**
 * Map a query-time status (or `null` never-contacted) to its ring visual against
 * a resolved theme palette. PURE — no `react-native`, no render, no side effects.
 *
 * - color: stable→statusStable, wobble→statusWobble, decay→statusDecay,
 *   rogue→rogue, null→border (neutral).
 * - opacity: 1.0 for every REAL status (opacity is no longer the status signal);
 *   0.5 for null so "no status yet" reads as absence, not a band.
 * - width (border weight, the redundant CVD channel): escalates with
 *   overdue-ness — stable 2 / wobble 3 / decay 4 (thickest, the "act now"
 *   state) / rogue 3; null keeps a thin neutral 2.
 */
export function ringVisual(
  status: ProfileStatus | null,
  colors: ThemePalette,
): RingVisual {
  switch (status) {
    case "stable":
      return { color: colors.statusStable, opacity: 1, width: 2 };
    case "wobble":
      return { color: colors.statusWobble, opacity: 1, width: 3 };
    case "decay":
      return { color: colors.statusDecay, opacity: 1, width: 4 };
    case "rogue":
      return { color: colors.rogue, opacity: 1, width: 3 };
    default:
      // null / never-contacted → faint neutral ring, thin weight.
      return { color: colors.border, opacity: 0.5, width: 2 };
  }
}
