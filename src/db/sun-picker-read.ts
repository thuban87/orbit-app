/**
 * Sun-picker candidate read (ORR-06) — the favourites-first contact list the
 * Settings sun-picker (13-06) consumes. Pure READ-ONLY: no transaction, no
 * writer, no migration, no network — a single `getAllAsync`. On-device SQLite.
 *
 * Mirrors `listFavourites` (dashboard-read.ts:288) in shape. Differences:
 *   - it is NOT favourites-only: it returns EVERY non-archived Bound contact, so
 *     anyone tracked by the proactive lifecycle can be chosen as the sun
 *     (favourites merely sort first);
 *   - never-contacted contacts ARE included (C2-2 downstream: a never-contacted
 *     sun has `getContactStatus` status null, so 13-04/05 `resolveSunOccupant`
 *     accepts `status: ProfileStatus | null` and glows the neutral fallback —
 *     this read deliberately keeps them eligible);
 *   - archived contacts are excluded structurally.
 *
 * ORDERING: `(favourite_rank IS NULL)` is the primary sort key — 0 for a
 * favourite, 1 for the rest — so favourites come first, ordered by
 * `favourite_rank ASC`; everyone else follows alphabetically (`name COLLATE
 * NOCASE`), with `id` as the final stable tiebreak.
 *
 * The synthetic "Me / self" option (NULL id) is prepended by the Settings picker
 * UI, NOT here — this read returns only real contacts.
 *
 * ROW SHAPE (38.12 D-81): each row carries the shared contact picker's columns
 * (`PickerContactRow`), so Settings → Appearance can hand these rows to
 * `ContactPickerList` as host rows and reuse the one picker.
 *
 * INJECTION: a fully static query — no runtime value is interpolated or bound.
 */
import type { PickerContactRow } from "@/db/picker-read";
import type { SqlExecutor } from "@/db/types";

/**
 * One sun-picker row: a shared contact-picker row (38.12 D-81). `photo` is the
 * raw relative path or null — never resolved here (mirrors orrery-read C2-1).
 * `archived_at` is always null (archived contacts are excluded).
 */
export type SunCandidate = PickerContactRow;

/**
 * The favourites-first candidate list: non-archived Bound contacts, favourites by
 * rank then everyone else by name.
 */
export function listSunCandidates(exec: SqlExecutor): Promise<SunCandidate[]> {
  return exec.getAllAsync<SunCandidate>(
    `SELECT id, name, photo, modified_at, favourite_rank, last_contact,
            snooze_until, archived_at
       FROM contacts
      WHERE archived_at IS NULL AND tracking_enabled = 1
      ORDER BY (favourite_rank IS NULL), favourite_rank ASC, name COLLATE NOCASE, id`,
  );
}
