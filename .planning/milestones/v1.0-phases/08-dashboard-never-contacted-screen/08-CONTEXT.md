# Phase 8: Dashboard & Never-Contacted Screen - Context

**Gathered:** 2026-08-15
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — dossier 08 is fully `[DECIDED]` (no `[OPEN]` items); this run settled the four operational items dossier 08 left "deferred to phase discussion." Visual/copy/layout stay the owner's design pass (→ UI-SPEC). Query/index/nav-mechanism stay "deferred to planning."

<domain>
## Phase Boundary

The app's everyday home screen and its sibling hidden-population screens — the operational skeleton, not the visual design (owner designs card/grid layout directly, HANDOFF §12.4). In scope: the dashboard as the HOME/landing screen (a flat, status-sorted list excluding never-contacted + archived + currently-snoozed); the sort/filter/segment controls; the name+fuel search box (absorbing Phase 7's cross-contact fuel search); the card content contract (avatar, status ring incl. rogue, name, required one-line fuel preview, category label, favourite marker — nothing log-derived); the "Not yet contacted (N)" sibling screen (domain 8 owns it); the "Snoozed (N)" segment; a count-less "Archived" entry; the 7-day birthday banner (excludes archived only — overrides snooze/never-contacted suppression); the profile favourite star + the net-new shared "Manage favourites" reorder screen; and the offline, focus/AppState/pull-to-refresh freshness path.

Excludes: the orrery (domain 9 — do NOT merge, HANDOFF §7), the profile screen internals, custom-field/photo internals, birthday *notifications* (domain 11), the weekly *digest* (domain 14), and pure visual layout (owner's design pass).

Requirements: DASH-01…DASH-07.
</domain>

<decisions>
## Implementation Decisions

### Area 1 — Never-Contacted screen (domain 8 owns it)
- **Card:** reuse the same dashboard card component (renders the fuel line); no status-sort emphasis since never-contacted have no `last_contact`.
- **Sort:** OFFER ALL THREE sort options on the screen — oldest-added-first (`created_at ASC`), newest-added-first, and A–Z by name — **defaulting to oldest-added-first** ("clear the longest-waiting backlog first"). *(Owner refinement 2026-08-15: expose the full sort control, not a single fixed order.)*
- **Reached from:** a counted "Not yet contacted (N)" entry on the dashboard that pushes the sibling screen onto the existing native-stack (NOT a dashboard segment — dossier rejected that).
- **Empty state:** a calm "you've reached everyone / no one is waiting" state (exact copy = owner's design pass).

### Area 2 — "Manage favourites" screen (net-new; shared with widget config, domain 12)
- **One shared screen, two entry points** (dossier's steer) — not two separate screens.
- **Entry points (v1):** the favourites filter's "Manage" affordance + a Settings row. The widget config wires into the same screen at Phase 12.
- **Reorder mechanism:** a drag-reorder list. The exact library is a **planning decision** and, because it adds a dependency, the owner confirms it at plan review (risk/posture is the owner's bucket).
- **Scope:** reorder-only. Marking a favourite stays the per-contact profile star (Cluster D). (Unstar-on-this-screen was offered and declined.)

### Area 3 — Filter / segment affordance
- **Control style:** a chip row (glanceable, modern Android) — not the plugin's dropdown menu.
- **Combination:** a single active filter in v1 (matches the plugin picker; simplest). (Multi-select combine offered and declined.)
- **Snoozed/favourites placement:** peers in the one chip row; the Snoozed chip carries its count.
- **Persistence:** persist last-used sort+filter across launches (AsyncStorage is the idiomatic choice; a SQLite settings row is an acceptable planning-time alternative). (Force-reset-on-launch offered and declined.)

### Area 4 — Search behavior (the dashboard absorbs Phase 7's fuel search)
- **UX:** a live in-place filter of the flat list (dossier default #4). (Distinct results view offered and declined.)
- **Fuel-match vs name-match:** on a fuel match, the card shows the matching fuel snippet (reuse Phase 7's `FuelSearchResultRow` idea) so the user sees *why* it matched; name matches render the normal card.
- **Backend:** reuse/extend `searchFuel` (name AND fuel text, `off_limits` excluded, unconfirmed `source='ai'` excluded — the existing Phase 7 query already does this). Honors INDEX [dashboard → fuel].
- **Standalone Settings search:** retire the Phase 7 Settings entry and relocate search to the dashboard (Phase 7 explicitly flagged this relocation as expected, NOT a reversal). The `FuelSearch`/`FuelSearchResultRow` components are the reusable units the dashboard absorbs. (Keeping both offered and declined.)

### Adopted straight from dossier 08 "Decisions made without you" (owner may veto at plan review)
- The contact-count ("N contacts") is retained in some header form.
- Rogue contacts sort at the far end of the continuous status band (exact rogue-vs-decay ordering is domain 9's threshold call, not the dashboard's) — rogue contacts are NOT hidden from the dashboard.
- The birthday-banner window stays 7 days.
- The plugin's hardcoded category-group map is dropped entirely; the dashboard is a single flat list, sort is the only organizer.

### Claude's Discretion (delegated to planning / implementation)
- The default dashboard query + indexes (`archived_at IS NULL AND last_contact IS NOT NULL AND (snooze_until IS NULL OR snooze_until <= now)`) and the segment/filter variants.
- The freshness wiring: `useFocusEffect` re-query + `AppState`→active listener + pull-to-refresh; async-only query API (never the `...Sync` variants — HANDOFF §3 read-path guarantee).
- The name+fuel search query shape and whether it needs its own index at this scale (FTS5 stays deferred to v2).
- The recency-sort tiebreak and handling of derived `daysSinceContact`.
- The nav mechanism confirmation (the app already runs react-navigation native-stack from Phase 4; the dashboard becomes the home/initial route).
- The drag-reorder library selection (owner confirms the dependency at plan review).
- Where last-used sort/filter is persisted (AsyncStorage vs SQLite settings row).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/screens/HomeScreen.tsx` — current placeholder shell (title + "New contact" + "Settings"); Phase 8 transforms it into the real dashboard. Already wired to `useNavigation` + `RootStackParamList`.
- `src/db/queries.ts` — `STATUS_SCAN` (dashboard status scan built on `PROGRESS_SQL`/`STATUS_SQL`), `NEWEST_PER_CONTACT`, `NEWEST_FOR_CONTACT`, `statusOrder` (Phase 2 dashboard-scan foundation).
- `src/db/contact-status-read.ts` — `getContactStatus` (single-contact query-time status).
- `src/db/fuel-read.ts` — `getRankedFuel` (top-ranked fuel line, `off_limits` + unconfirmed `source='ai'` excluded in-query) and `searchFuel` (cross-contact name AND fuel search, same exclusions) — the search backend the dashboard absorbs.
- `src/screens/FuelSearch.tsx` + `FuelSearchResultRow` — Phase 7's minimal search screen + reusable presentational result row.
- Avatar component + `avatarSwatches`/`avatarSwatchText` tokens (Phase 5) — themed-swatch+initials fallback.
- `RankedFuelLine` (Phase 7) — the one-line fuel preview render unit.
- `src/navigation/RootNavigator.tsx` + `src/navigation/types.ts` (`RootStackParamList`) — native-stack app shell (Phase 4); `headerShown:false`, each screen owns its Back chrome.
- Migration-1 columns already present (no new migration): `favourite_rank INTEGER` (ordered nullable rank), `snooze_until TEXT`, `birthday TEXT` (optional year), `ring_seq INTEGER`; user-editable `categories` table (single-select FK).

### Established Patterns
- All colours resolve through `useTheme().colors.*` — zero hardcoded colours, incl. any Skia. `check:colors` gate enforces this.
- Data layer through DAOs in `src/db/` — never inline queries in components; reads use the **async** expo-sqlite API only.
- Correctness-critical logic extracted into react-native-free `*-logic.ts` modules and node-tested under Vitest; `.tsx` screens are device-UAT.
- `formatLocalDate()` / `date('now','localtime')` for all dates (never `toISOString().split()`).
- Status/rogue/gravity colour tokens already exist (Phase 6: `status`, `rogue`, `gravityTiers`).

### Integration Points
- `src/navigation/RootNavigator.tsx` + `types.ts` — register the never-contacted + manage-favourites routes; dashboard is the home/initial route.
- `HomeScreen.tsx` — becomes the dashboard surface.
- `SettingsScreen.tsx` — gains a "Manage favourites" row; loses the standalone fuel-search entry.
- `ContactProfileScreen.tsx` — gains the favourite star toggle (profile screen is unowned in INDEX; domain 8 exports this).
</code_context>

<specifics>
## Specific Ideas

- **Birthday parser — fix two ported bugs** in the single new parser (dossier F4): (1) the **day-of drop** (contact vanishes from the banner ON their birthday because `today` carries a time-of-day while `birthdayThisYear` is local midnight, so `< today` rolls it forward ~365 days and the "Today!" branch is dead code); (2) **Feb-29 → Mar-1** in non-leap years via JS `Date` overflow. The single parser (Phase 11's birthday notification reuses it) keeps an optional year.
- **`recyclingKey={contactId}`** on card avatars (`expo-image`) is a **correctness** requirement, not an optimization — prevents a recycled row flashing the previous contact's face.
- **Freshness is NOT a change-listener.** `addDatabaseChangeListener` is connection-scoped and structurally blind to the headless widget/notification "mark contacted" writes — use `useFocusEffect` re-query + `AppState`→active listener (+ pull-to-refresh).
- **`off_limits` (and unconfirmed `source='ai'`) fuel excluded from the search index** — matches every other glanceable surface.
- Birthday banner iterates a deliberate predicate (**exclude archived only**) — never the plugin's all-contacts loop.
</specifics>

<deferred>
## Deferred Ideas

- Weekly **digest** — wholesale to domain 14 (dashboard reserves no digest surface in v1).
- Birthday **notifications** — domain 11 (dashboard owns only the banner).
- The birthday banner's tap later offering a **message action** (rather than only opening the profile) — interacts with domain 11's compose/SMS handoff; not v1.
- **FTS5** search — deferred to v2 (plain `LIKE` scan is free at this scale).
- Reconcile the **07-photos SDK version-label drift** (workpaper pinned to SDK 55 / RN 0.83.4 while the project runs SDK 57 / RN 0.86) — a label reconcile at planning time; changes no decision.
</deferred>
