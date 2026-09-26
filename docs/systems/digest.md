# Digest

**Last updated:** 2026-09-26
**Updated by phase:** 38.4-audit-remediation-ui-performance-release
**Owners:** `src/db/digest-read.ts`, `src/db/up-next-read.ts`, `src/db/your-week-read.ts`, `src/logic/digest-composition.ts`, `src/screens/DigestScreen.tsx`, `src/screens/digest-refresh.ts`, `src/services/notifications/digest-schedule.ts`

## Purpose

Digest is Orbit’s local, default home for relationship care: act through Up Next, look ahead through Horizon, then reflect through Your Week. It derives every visible item from canonical SQLite data on focus, on committed in-process writes while focused, and after each resume sweep; it owns no relationship-domain table, snapshot, cache, backend, or network read path.

## Architecture

### Data Model

Digest reads existing state and persists only the portable app-wide period preference.

**Tables:**
- `contacts` — supplies canonical status/progress, birthdays, lifecycle state, and people reached.
- `interactions` and `group_events` — supply Your Week metrics, heatmap activity, and inline day detail. Migration 031 indexes both on `occurred_at` (`idx_interactions_occurred_at`, `idx_group_events_occurred_at`) so those reads are bounded to the period.
- `app_settings` — supplies `your_week_period` (`rolling-7-days` or `calendar-week`) and the independent digest notification policy.

**Types:**
- `UpNextRow` (`src/db/up-next-read.ts`) — one canonically ranked relationship-attention candidate.
- `DigestComposition` (`src/logic/digest-composition.ts`) — capped Up Next and deduplicated Horizon section inputs.
- `YourWeekDayRow` (`src/db/your-week-read.ts`) — one visible interaction or Group Event day-detail record.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|-------|------|----------------|
| Read DAO | `src/db/up-next-read.ts` | Reads canonical status/progress-ranked outreach candidates. |
| Read DAO | `src/db/digest-read.ts` | Reads Horizon birthdays, overlooked people, and Never Contacted inputs. |
| Read DAO | `src/db/your-week-read.ts` | Aggregates app-wide metrics, heatmap counts, and group-deduplicated day detail. |
| Pure logic | `src/logic/digest-composition.ts` | Caps Up Next at three and removes its claims from Horizon. |
| Period service | `src/services/history/week-window.ts` | Defines Rolling 7 Days and locale-aware Calendar Week once. |
| Screen | `src/screens/DigestScreen.tsx` | Owns every Digest refresh trigger (focus, shell tick, post-sweep foreground tick) and canonical Contacts drill navigation. |
| Refresh controller | `src/screens/digest-refresh.ts` | Defers hidden triggers to focus, gates publication with one latest-request authority, and keeps a loaded body mounted across a failed refresh. |
| Scheduler | `src/services/notifications/digest-schedule.ts` | Reconciles the separate singleton weekly OS request. |

### Key Files

| File | Role |
|---|---|
| `src/screens/DigestScreen.tsx` | Mounts Up Next, Horizon, and Your Week in fixed order; opens Profiles and Contacts drills. |
| `src/components/digest/UpNextSection.tsx` | Shows at most three explainable Profile-opening candidates without inline outreach writes. |
| `src/components/digest/HorizonSection.tsx` | Shows separate conditional birthdays, overlooked, and Never Contacted groups. |
| `src/components/digest/YourWeekSection.tsx` | Follows Digest's `refreshSignal`, synchronizes the period preference, and mounts selected-day detail inline. |
| `src/components/digest/your-week-section-logic.ts` | Pure period controller: in-flight write marker, safe Settings adoption, re-window day retention, shared period-read authority; the token-scoped day-detail state machine (`startDayRead` / `settleDayRead` / `failDayRead` / `clearDayDetail`). |
| `src/components/digest/DigestDayDetail.tsx` | Renders the selected day from its read state: inline loading indicator, "Couldn't load this day" with Retry, empty copy only after a successful empty read, or the day's rows. |
| `src/components/digest/DigestListTransition.tsx` | The standard Up Next/Horizon list transition, skipped on first render and off under reduced motion. |
| `src/components/digest/YourWeekHeatmap.tsx` | Reuses shared heatmap language with a non-colour-only selected state. |
| `src/db/your-week-read.ts` | Excludes group-linked child interactions and includes each Group Event parent once. |

## How It Works

### Opening Digest

1. Fresh launch and a Digest notification select the Digest tab; resume keeps the user’s active tab and stack.
2. `DigestScreen` is the single refresh-trigger owner and renders all three major sections even when their data is empty. It re-reads:
   - on every focus;
   - on the shell tick — a committed Quick Log/Undo, assist confirmation, or warm notification action — while Digest stays focused (D-13);
   - on the post-sweep foreground tick, published after the launch/foreground sweep settles, so a resume reflects the sweep's purges and expiry (D-14).

   A shell or foreground trigger while Digest is hidden reads nothing; the next focus read covers it (no background reads). One latest-request authority gates publication, so an older read never overwrites a newer one. A failed refresh over an already-loaded Digest keeps the body mounted and shows a compact "Couldn't refresh Up Next and Horizon" notice with Retry; only a failure before anything has loaded shows the full error. Each accepted trigger also bumps a Digest-owned `refreshSignal` that Your Week follows instead of its own focus effect — on acceptance, not success, so Your Week still re-windows when the outer read fails.
3. An Up Next or Horizon birthday row opens Profile in the Digest stack, so Back returns to Digest.

### Composing Up Next and Horizon

1. `readUpNext()` uses the shared status/progress SQL; `digest-composition.ts` applies the deterministic three-person cap.
2. Horizon independently reads its next-seven-day birthdays, overlooked people, and Never Contacted candidates.
3. Up Next receives first claim on its contacts, then Horizon removes matching overlooked conditions rather than duplicating them.
4. A scalable Horizon drill calls `setPopulationsAndFilters()` before selecting Contacts, so its persisted count, preview, and destination use the same canonical query state. The opt-in Unbound exception is limited to `not-contacted`.

### Reflecting in Your Week

1. `week-window.ts` derives the selected Rolling 7 Days or device-locale Calendar Week and supplies the same bounds to metrics, heatmap, and day detail.
2. `your-week-read.ts` reads canonical activity: group-linked child rows do not count as separate events, while a Group Event parent appears once. Every period predicate (metrics, heatmap date counts, day detail) is two conjuncts (38.4 RG-028, `performance/AUD-PERF-004`):
   - a half-open string range `occurred_at >= date(?) AND occurred_at < date(?, '+1 day')`, which lets SQLite SEARCH the migration-031 `idx_interactions_occurred_at` / `idx_group_events_occurred_at` indexes instead of scanning lifetime history on every Digest open;
   - the original `date(occurred_at)` residual (`BETWEEN date(?) AND date(?)`, or `= date(?)` for one day), which keeps results exact — e.g. a malformed value the string range admits but `date()` rejects stays excluded.

   Every bound is a `?` parameter. Results are identical to the pre-38.4 reads for every stored form a live writer produces (`YYYY-MM-DD HH:MM:SS` via `rejectFutureOccurredAt`), plus date-only, `T`-separated, fractional-second, and malformed values; `src/db/your-week-read.test.ts` proves this against the legacy predicates as an oracle, alongside EXPLAIN QUERY PLAN and growing-history fixtures. **Accepted edge (not repaired, 38.2 D-23):** a timezone-suffixed `occurred_at` — reachable only through a hand-crafted backup, since `restore-apply.ts` writes backup strings without format validation — can fall outside the string range where `date()` would have shifted it across a UTC day, so it may drop out of a Your Week window it previously appeared in.
3. A heatmap selection expands `DigestDayDetail` beneath the heatmap. The visual language and count classification reuse the Profile History helpers without adding rotary or long-range navigation.
4. Settings and the in-context toggle both write the same validated portable `your_week_period` setting; Horizon birthdays and weekly notification cadence do not use it.
5. On each `refreshSignal`, Your Week keeps the chosen period and re-windows to the current local day (D-15). No timer detects the new day (D-22). A selected day survives while it is still a real day in the new window, including across a tab return (D-26), and is re-read; otherwise it clears.
6. A period changed in Settings is adopted on the next refresh, but only when no in-context toggle write is in flight and no toggle has begun since that settings read started. A refresh can therefore never revert an in-flight toggle. Every period read (refresh, toggle, rollback) goes through one request authority, so the most recently begun read wins.
7. Selected-day detail is an explicit `idle | loading | loaded | error` state (D-16). A heatmap tap, the detail's Retry, and a refresh that retained the day each start a **new** request with a fresh token from a latest-request authority; only the current `loading` token may settle or fail. The stale guard is therefore request-scoped, not date equality: re-selecting the same date or retrying makes any older read for that date — or any other — unable to publish rows or an error. Loading shows a small inline indicator; a failure shows "Couldn't load this day" with Retry; "No activity on this date." appears only after a successful empty read. Clearing the selection (period change, rollback, a day outside the new window) returns to `idle` and retires the outstanding read. A debug-only fault hook (`applyUatFault("digest-day-read")`, inert outside `__DEV__`) can delay or reject the next day read for device UAT.

### List transitions

When a refresh changes Up Next or Horizon while Digest stays mounted, rows use the standard list transition (D-13). A leaving row fades out, an arriving row fades in, and the rest shift into place, using Reanimated's built-in `FadeOut`/`FadeIn` (`MOTION.fast`) and `LinearTransition` (`MOTION.base`) builders. `DigestListGroup` skips entering animations on first render. Under reduced motion there is no transition at all.

### Delivering the weekly prompt

1. The independent scheduler reads the master setting, `digest_enabled`, and delivery hour.
2. It maintains only `digest:weekly` with generic copy and a private channel; it is separate from decay/birthday scheduling.
3. A body tap resolves to the semantic Digest root rather than recreating the retired Dashboard route shape.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| Up Next cap | `3` | `src/logic/digest-composition.ts` | Bounds the action-oriented home module. |
| Birthday window | next `7` days | `src/db/digest-read.ts` | Horizon-only forward-looking birthday range. |
| `your_week_period` default | `rolling-7-days` | `src/db/migrations/030-your-week-period.ts` | Portable default selected for metrics and detail. |
| `DIGEST_WEEKDAY` | `1` | `src/services/notifications/digest-schedule.ts` | Sunday weekly delivery. |

## Decisions

- **ADR-054:** Live Weekly Digest Retrospective and Overlooked Relationship Read — partially superseded by the fixed home composition; its local live-read boundary remains.
- **ADR-055:** Dedicated Weekly Digest Scheduling and Persisted Notification Policy — retains the separate weekly prompt and durable notification gate.
- **ADR-062:** Bound/Unbound Lifecycle and One-Way Cadence Assignment — is partially superseded only for opted-in Unbound Never Contacted population semantics.
- **ADR-076:** Population-Reached Birthdays Without a Dashboard Banner — moves richer birthday presentation to Horizon.
- **ADR-147:** Derived Digest Composition and Canonical Contacts Drill-Through — establishes the fixed sections, canonical reads, claim deduplication, and drill contract.
- **ADR-148:** Portable Your Week Period and Group-Deduplicated Activity Aggregation — establishes the period setting and aggregate boundary.

## Gotchas

1. **Do not cache or persist a Digest snapshot.** The screen is a derived local read surface; `your_week_period` is an app preference, not Digest state.
2. **Do not invent urgency or rewrite status SQL.** Up Next uses canonical relationship/orbit semantics and Horizon respects its first claim.
3. **Birthdays are not Your Week activity.** Their independent next-seven-day window never changes with the period toggle.
4. **Keep the Unbound exception exact.** It applies only to opted-in `not-contacted`, never to other active-cadence populations.
5. **Do not double-count Group Events.** Exclude their linked child interactions from event activity and project the parent once.
6. **Do not add a Digest trigger outside `DigestScreen`.** Sections follow Digest's refresh ownership; a section-level focus effect or private AppState listener reintroduces pre-sweep resume reads and double reads.
7. **A selected day is not immediately empty.** Day detail is `idle | loading | loaded | error`. A pending read shows the inline indicator, a failed one "Couldn't load this day" with Retry; never render "No activity on this date." for anything but a successful empty read. Every read (tap, Retry, retained-day refresh) takes a fresh request token. Never guard publication with `selectedDay === date` — a slower older read for the same date would overwrite the newer one.
8. **Seven 44dp heatmap targets need compact-width treatment.** Fixed cells plus outer padding can overflow 360dp-or-narrower layouts.
9. **Keep both halves of every Your Week predicate.** Dropping the `occurred_at` range falls back to a lifetime-history scan; dropping the `date()` residual lets malformed values the range admits into the counts. Never wrap the range column in a function, and never interpolate a period bound.

## Related Systems

- **App shell** — makes Digest the default tab and owns semantic notification resets.
- **Dashboard** — is the Contacts query owner used by Horizon drill-through.
- **Interaction history** — provides the reusable heatmap language and local week-window helper.
- **Group events** — owns the canonical parent/participant model aggregated as one event.
- **Backup & restore** — carries the portable period preference in format v7.
- **Notifications** — owns request/channel plumbing and production-versus-DEV request isolation.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-23 | 15 | Created the live weekly retrospective, overlooked relationship read, Sunday scheduling, and dashboard entry. |
| 2026-08-27 | 18.2 | Made the active overlooked projection Bound-only while retaining inclusive retrospective history. |
| 2026-09-02 | 25 | Repointed the backlog action to live Home while retaining the never-contacted count. |
| 2026-09-02 | 32 | Lockstepped the gentle-line count onto the migrated `Negative` Tone value. |
| 2026-09-02 | 38 | Replaced the retrospective-first screen with fixed Up Next, Horizon, and Your Week modules; added portable period selection and group-deduplicated activity reads. |
| 2026-09-25 | 38.3 | Live Digest refresh (RG-026, react-native/AUD-RN-006, reliability-testing/AUD-REL-013): focus, shell-tick and post-sweep foreground triggers with one authority; Your Week follows a Digest-owned signal and keeps its period across a new day (D-15); standard list transition for Up Next and Horizon (D-13). |
| 2026-09-25 | 38.3 | Truthful day detail (RG-026, reliability-testing/AUD-REL-014; closes Phase 38 WR-01): explicit `idle \| loading \| loaded \| error` day-detail states with request-scoped tokens, inline loading indicator, "Couldn't load this day" + Retry, empty copy only after a successful empty read (D-16). |
| 2026-09-26 | 38.3 | Your Week keeps a loaded heatmap and day detail on a refresh failure and shows a compact "Couldn't refresh Your Week" notice with a read-only Retry; the full "Couldn't load Your Week" state (also with Retry) appears only when nothing has loaded (review B-WR-06). |
| 2026-09-26 | 38.4 | Bounded Your Week reads via occurred_at indexes (RG-028, performance/AUD-PERF-004): migration 031 adds `idx_interactions_occurred_at` / `idx_group_events_occurred_at`; metrics, date counts, and day detail use a half-open range plus the retained `date()` residual with oracle-proven identical results; no Digest cache (ADR-148, D-18). |
