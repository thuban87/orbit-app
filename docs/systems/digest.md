# Digest

**Last updated:** 2026-09-02
**Updated by phase:** 38-your-week
**Owners:** `src/db/digest-read.ts`, `src/db/up-next-read.ts`, `src/db/your-week-read.ts`, `src/logic/digest-composition.ts`, `src/screens/DigestScreen.tsx`, `src/services/notifications/digest-schedule.ts`

## Purpose

Digest is Orbit’s local, default home for relationship care: act through Up Next, look ahead through Horizon, then reflect through Your Week. It derives every visible item from canonical SQLite data when the screen is focused; it owns no relationship-domain table, snapshot, cache, backend, or network read path.

## Architecture

### Data Model

Digest reads existing state and persists only the portable app-wide period preference.

**Tables:**
- `contacts` — supplies canonical status/progress, birthdays, lifecycle state, and people reached.
- `interactions` and `group_events` — supply Your Week metrics, heatmap activity, and inline day detail.
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
| Screen | `src/screens/DigestScreen.tsx` | Reloads live sections on focus and owns canonical Contacts drill navigation. |
| Scheduler | `src/services/notifications/digest-schedule.ts` | Reconciles the separate singleton weekly OS request. |

### Key Files

| File | Role |
|---|---|
| `src/screens/DigestScreen.tsx` | Mounts Up Next, Horizon, and Your Week in fixed order; opens Profiles and Contacts drills. |
| `src/components/digest/UpNextSection.tsx` | Shows at most three explainable Profile-opening candidates without inline outreach writes. |
| `src/components/digest/HorizonSection.tsx` | Shows separate conditional birthdays, overlooked, and Never Contacted groups. |
| `src/components/digest/YourWeekSection.tsx` | Synchronizes the period preference and mounts selected-day detail inline. |
| `src/components/digest/YourWeekHeatmap.tsx` | Reuses shared heatmap language with a non-colour-only selected state. |
| `src/db/your-week-read.ts` | Excludes group-linked child interactions and includes each Group Event parent once. |

## How It Works

### Opening Digest

1. Fresh launch and a Digest notification select the Digest tab; resume keeps the user’s active tab and stack.
2. `DigestScreen` refreshes local reads on focus and renders all three major sections even when their data is empty.
3. An Up Next or Horizon birthday row opens Profile in the Digest stack, so Back returns to Digest.

### Composing Up Next and Horizon

1. `readUpNext()` uses the shared status/progress SQL; `digest-composition.ts` applies the deterministic three-person cap.
2. Horizon independently reads its next-seven-day birthdays, overlooked people, and Never Contacted candidates.
3. Up Next receives first claim on its contacts, then Horizon removes matching overlooked conditions rather than duplicating them.
4. A scalable Horizon drill calls `setPopulationsAndFilters()` before selecting Contacts, so its persisted count, preview, and destination use the same canonical query state. The opt-in Unbound exception is limited to `not-contacted`.

### Reflecting in Your Week

1. `week-window.ts` derives the selected Rolling 7 Days or device-locale Calendar Week and supplies the same bounds to metrics, heatmap, and day detail.
2. `your-week-read.ts` reads canonical activity: group-linked child rows do not count as separate events, while a Group Event parent appears once.
3. A heatmap selection expands `DigestDayDetail` beneath the heatmap. The visual language and count classification reuse the Profile History helpers without adding rotary or long-range navigation.
4. Settings and the in-context toggle both write the same validated portable `your_week_period` setting; Horizon birthdays and weekly notification cadence do not use it.

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
6. **A selected day is not immediately empty.** Day detail remains asynchronous; preserve a loading/error state until its matching read completes.
7. **Seven 44dp heatmap targets need compact-width treatment.** Fixed cells plus outer padding can overflow 360dp-or-narrower layouts.

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
