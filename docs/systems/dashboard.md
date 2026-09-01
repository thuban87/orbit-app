# Dashboard

**Last updated:** 2026-08-23
**Updated by phase:** 15-weekly-digest
**Owners:** `src/db/dashboard-read.ts`, `src/screens/HomeScreen.tsx`, `src/screens/NeverContactedScreen.tsx`, `src/components/ContactCard.tsx`, `src/components/BirthdayBanner.tsx`, `src/stores/dashboard-prefs-store.ts`

## Purpose

The dashboard is Orbit's everyday home for finding the next person to contact. It presents a local, flat contact list with controlled hidden populations, eligible conversational fuel, birthdays, favourites, and cause-aware empty states.

## Architecture

### Data Model

The dashboard owns no tables. It projects the on-device `contacts`, `categories`, and `fuel` tables, using query-time status and local wall-clock comparisons.

**Tables:**
- `contacts` — supplies lifecycle, recency, category, birthday, snooze, and favourite-rank data.
- `categories` — supplies an optional label for each dashboard card.
- `fuel` — supplies the one eligible ranked line and search-match snippet.

**Types** (`src/db/dashboard-read.ts`):
- `DashboardRow` — card projection with nullable status/progress for never-contacted people.
- `DashboardFilter` / `DashboardSort` — persisted dashboard control values.
- `NeverContactedSort` — sibling-list ordering values.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Preferences store | `src/stores/dashboard-prefs-store.ts` | Persists the selected sort and one active filter in AsyncStorage. |
| Read DAO | `src/db/dashboard-read.ts` | Owns dashboard population branches, ranked-fuel projection, search, counts, birthday candidates, and never-contacted reads. |
| Shared UI | `src/components/ContactCard.tsx` | Renders the shared dashboard and never-contacted card contract. |
| Home screen | `src/screens/HomeScreen.tsx` | Loads the dashboard, controls, birthday banner, empty states, and refresh paths. |
| Sibling list | `src/screens/NeverContactedScreen.tsx` | Lists non-archived people with no qualifying contact history. |

### Key Files

| File | Role |
|---|---|
| `src/db/dashboard-read.ts` | Parameter-bound dashboard, search, count, birthday, and first-contact SQL reads. |
| `src/screens/HomeScreen.tsx` | Home dashboard, controls, focus/foreground/pull refresh, and the Orrery entry. |
| `src/screens/NeverContactedScreen.tsx` | Separate first-contact backlog with its own sort control. |
| `src/components/ContactCard.tsx` | Shared card with avatar cache-busting, status, fuel, category, and favourite marker. |
| `src/components/contact-card-ring.ts` | Pure status-to-colour, opacity, and ring-weight resolver used by ContactCard. |
| `src/components/BirthdayBanner.tsx` | Seven-day birthday surface. |
| `src/logic/birthday-logic.ts` | Strict local-date birthday parsing and days-until computation. |
| `src/logic/dashboard-empty-logic.ts` | Pure cause-aware empty-state precedence. |
| `src/stores/dashboard-prefs-store.ts` | Device-local sort/filter preference persistence. |

## How It Works

### Loading the working list

1. `HomeScreen` reloads on native-stack focus, app foreground, and pull-to-refresh, with cancelled guards around async reads.
2. `listDashboard()` selects exactly one population branch: term, favourites, snoozed, or the normal contacted/not-snoozed population.
3. The query computes nullable status/progress, joins the category label, and uses the shared fuel eligibility/ranking fragments for a card line or search snippet.
4. `ContactCard` renders the resulting row and navigates to the contact profile when pressed.

### Sharing favourites with the widget

1. The favourites branch of `listDashboard()` already orders by `favourite_rank`, carries nullable query-time status, and selects the eligible fuel line.
2. The Widget system consumes that projection verbatim; it does not re-derive status or apply the dashboard's status sort.
3. `ContactCard` and widget avatars use the same stable, wobble, decay, and rogue status colours, with a neutral ring for never-contacted people.

### Reaching hidden populations

1. The normal list excludes archived, never-contacted, and currently snoozed people.
2. The dashboard shows a counted Not yet contacted entry, a counted Snoozed chip, and a count-less Archived entry.
3. Not yet contacted opens `NeverContactedScreen`, whose inverse query keeps status and progress null and defaults to oldest-added-first.
4. A profile snooze now writes the existing `snooze_until` field, so the Snoozed chip reflects real contact state rather than an empty future-facing branch.

### Opening the Orrery

1. The Home header keeps the dashboard as the primary working surface and exposes a compact Orbit button beside Settings.
2. The button navigates to the typed `Orrery` stack route without passing a contact snapshot or database state.
3. The Orrery rereads its own local projection on focus, so the dashboard does not own a second relationship-state calculation.

### Opening Your week

1. The Home header exposes a discreet, non-badged “Your week” action beside the existing destination controls.
2. The action navigates to the typed Digest route, which performs its own live retrospective and overlooked-population reads on focus.
3. The dashboard remains the always-current work surface; the digest is a separate retrospective and does not duplicate the decay or snoozed populations.

### Showing birthdays and empty states

1. `BirthdayBanner` receives every non-archived birthday candidate, including snoozed and never-contacted people.
2. `daysUntilBirthday()` validates the stored value, compares local midnights, and explicitly observes February 29 on February 28 in non-leap years.
3. `selectDashboardEmptyState()` gives search and active-filter empties precedence before distinguishing a truly empty database from hidden populations.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| Birthday window | 7 days | `src/components/BirthdayBanner.tsx` | Limits and orders upcoming birthday rows. |
| Default sort | `status` | `src/stores/dashboard-prefs-store.ts` | Starts the working list with the most overdue contacts first. |
| Default first-contact sort | `oldest` | `src/screens/NeverContactedScreen.tsx` | Prioritizes the longest-waiting first-contact backlog. |

## Decisions

- **ADR-032:** Flat Dashboard Discovery and In-Query Contact Search — makes the dashboard Home and owns local name-plus-fuel search.
- **ADR-033:** Profile Marking and Shared Drag-Reordered Favourites — supplies the card marker and favourites filter/management surface.
- **ADR-034:** Birthday Banner and Re-query Dashboard Freshness — defines birthday candidates and reliable local freshness.
- **ADR-039:** Pre-Scheduled Inexact Decay Reminders — reuses dashboard status and birthday semantics for local reminder candidates.
- **ADR-042:** Shared Status Palette for Dashboard and Widget Rings — makes the dashboard card and widget ring vocabulary identical.
- **ADR-043:** Static Globally Mirrored Favourites Widget — reuses the ranked favourites projection without altering it.
- **ADR-048:** Status-Default Static Orrery with a Single-Canvas Morph — adds the dashboard-reached relationship-map entry without displacing Home.
- **ADR-054:** Live Weekly Digest Retrospective and Overlooked Relationship Read — adds the separate, non-scoreboard weekly-retrospective entry.

## Gotchas

1. **Do not turn a never-contacted person into Stable.** `STATUS_SQL` has no null branch, so dashboard projections must explicitly return null status and progress when `last_contact` is null.
2. **Keep population branches mutually exclusive.** Search, favourites, and snoozed paths intentionally relax different default exclusions; appending filters to one restrictive base makes valid rows unreachable.
3. **Keep fuel exclusions in SQL.** `off_limits`, unconfirmed AI, and blank fuel must not be filtered in a component after projection.
4. **Do not use a database change listener for dashboard freshness.** It cannot observe writes from a different SQLite connection or headless context.
5. **Pass identity and cache busting to avatars.** `ContactCard` must provide `contactId` and `modified_at` so a recycled list cell cannot flash another person's photo.
6. **Snooze and notification suppression differ.** The Snoozed branch follows `snooze_until`; notification decay additionally respects mute, rare-response, rogue, and lifecycle suppression, while birthdays ignore them.
7. **Keep the widget projection rank- and null-status-preserving.** Re-sorting favourites or treating a null status as stable moves a no-undo mark target or misstates contact history.
8. **Keep the dashboard as the primary interface.** The Orbit button opens a glanceable map; it must not become a duplicate dashboard filter or a second status query owner.
9. **Keep the digest distinct from the due list.** “Your week” is a navigation entry to a separate live retrospective; do not add its count, overlooked groups, or a badge to Home.

## Related Systems

- **Contacts** — owns the source contact records, favourite writes, and profile destination.
- **Status engine** — supplies the query-time status and progress fragments.
- **Conversational fuel** — supplies eligible ranked lines and literal-safe search predicates.
- **App shell** — registers the sibling list and management routes.
- **Notifications** — reuses status and birthday-candidate semantics for OS reminders; the dashboard remains the in-app truth surface.
- **Widget** — reads the favourites projection as its state-free home-screen view.
- **Orrery** — opens from the header and independently reads the local contacted-relationship projection.
- **Digest** — opens from the header and independently reads a weekly retrospective plus non-nagged overlooked populations.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-15 | 08 | Created the dashboard, first-contact sibling list, favourites controls, birthday banner, and local refresh path. |
| 2026-08-16 | 11 | Activated the snoozed population through durable snooze writes and aligned reminder candidate semantics with dashboard status and birthdays. |
| 2026-08-16 | 12 | Added shared status rings and documented the widget's rank-preserving favourites projection. |
| 2026-08-17 | 13 | Added the dashboard header entry to the status-default Orrery. |
| 2026-08-23 | 15 | Added the non-badged “Your week” entry to the separate live digest surface. |
