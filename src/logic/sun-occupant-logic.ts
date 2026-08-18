/**
 * sun-occupant-logic — who/what colour the orrery sun is (ORR-05/ORR-06, A7).
 *
 * PURE, RN-free, node-testable: no I/O, no SQL, no `react-native`. The screen
 * reads `app_settings` (sun_contact_id, self_sun_colour) and — when a contact is
 * the sun — looks that contact up (photo, status, archived) BEFORE calling this,
 * then this function decides the final occupant + glow colour in one place.
 *
 * Contract:
 *   - `sun_contact_id` NULL → the SELF sun. Glow = the user's picked
 *     `self_sun_colour`, or `starPalette[0]` (gold) when unset — the NULL default
 *     is resolved HERE at read, never stored in the DB (Pitfall 3).
 *   - a live, non-archived contact → that CONTACT is the sun. Glow = its STATUS
 *     colour (the self star pick applies to the self-sun only). The status colour
 *     comes from `orreryRingStyle(status, colors).color`, REUSING the single
 *     status→colour map — a never-contacted contact-sun (status `null`, C2-2)
 *     therefore glows the neutral `colors.border`, NOT a new colour, NOT
 *     `starPalette[0]`.
 *   - an ARCHIVED or MISSING occupant → falls back to SELF (A7). Archiving is soft
 *     (`archived_at`), so the migration-003 FK does NOT null the setting on
 *     archive; this resolver guarantees the sun never glows a hidden contact.
 *
 * No hex literal — every colour comes from `selfSunColour` / `starPalette` (both
 * passed in) or the resolved palette via `orreryRingStyle` (check:colors).
 */
import type { ProfileStatus } from "@/db/contact-status-read";
import type { ThemePalette } from "@/theme/theme-types";
import { orreryRingStyle } from "./orrery-ring-logic";

/**
 * The screen-resolved sun-contact lookup, or `null` when the id is missing/
 * unknown. `status` is NULLABLE because a never-contacted contact-sun has
 * `getContactStatus` status `null` (C2-2).
 */
export interface SunOccupantLookup {
  photo: string | null;
  status: ProfileStatus | null;
  archived: boolean;
}

/** Everything `resolveSunOccupant` needs — all reads done by the caller. */
export interface SunOccupantInput {
  /** `app_settings.sun_contact_id` — a positive contacts.id, or NULL = self. */
  sunContactId: number | null;
  /** `app_settings.self_sun_colour` — a 6-hex string, or NULL (→ starPalette[0]). */
  selfSunColour: string | null;
  /** The self-sun star palette; `starPalette[0]` is the gold default. */
  starPalette: readonly string[];
  /** The self profile photo (used when the sun resolves to self). */
  selfPhoto: string | null;
  /** The resolved sun-contact, or `null` when the id is missing/unknown. */
  occupant: SunOccupantLookup | null;
  /** The resolved palette — supplies the neutral/status glow via orreryRingStyle. */
  colors: ThemePalette;
}

/** The resolved sun occupant: self, or a specific contact, plus its glow colour. */
export type SunOccupant =
  | { kind: "self"; photo: string | null; glowColor: string }
  | {
      kind: "contact";
      contactId: number;
      photo: string | null;
      glowColor: string;
    };

/**
 * The SINGLE archived/missing→self policy (A7). The stored sun occupant resolves
 * to SELF when there is no contact id, OR its looked-up contact is missing, OR it
 * is archived. Both the canvas (`resolveSunOccupant`) and Settings' occupant-name
 * read call THIS, so the two can never silently disagree about a hidden occupant
 * if the predicate later grows a dimension (e.g. a snooze/reminders-off flag).
 */
export function sunOccupantIsSelf(input: {
  sunContactId: number | null;
  occupant: Pick<SunOccupantLookup, "archived"> | null;
}): boolean {
  return (
    input.sunContactId === null ||
    input.occupant === null ||
    input.occupant.archived
  );
}

/**
 * Resolve the orrery sun occupant + glow colour. PURE. See the module contract:
 * NULL / archived / missing all resolve to self; a live contact glows its status
 * colour (never-contacted → the neutral border reused from orrery-ring-logic).
 */
export function resolveSunOccupant(input: SunOccupantInput): SunOccupant {
  const {
    sunContactId,
    selfSunColour,
    starPalette,
    selfPhoto,
    occupant,
    colors,
  } = input;

  // Self sun: explicit NULL id, OR an archived/missing occupant (A7) — via the
  // shared predicate. Glow is the picked star colour, falling back to the gold
  // default resolved at read. The trailing null legs are logically subsumed by
  // `sunOccupantIsSelf` (they are two of its three cases); they remain only to
  // narrow `sunContactId`/`occupant` to non-null for the contact branch below.
  if (
    sunOccupantIsSelf({ sunContactId, occupant }) ||
    sunContactId === null ||
    occupant === null
  ) {
    return {
      kind: "self",
      photo: selfPhoto,
      glowColor: selfSunColour ?? starPalette[0],
    };
  }

  // A live, non-archived contact is the sun: glow = its STATUS colour, reusing the
  // single status→colour map (a null status → colors.border neutral, C2-2).
  return {
    kind: "contact",
    contactId: sunContactId,
    photo: occupant.photo,
    glowColor: orreryRingStyle(occupant.status, colors).color,
  };
}
