# Digest

**Last updated:** 2026-08-27
**Updated by phase:** 18.2-bound-unbound-lifecycle
**Owners:** `src/db/digest-read.ts`, `src/logic/digest-logic.ts`, `src/screens/DigestScreen.tsx`, `src/services/notifications/digest-schedule.ts`

## Purpose

The digest gives a person a calm, local weekly retrospective without turning relationship care into a score. Its live “Your week” screen shows people reached, people quietly slipping, and a rare gentle quality signal; a Sunday notification and a dashboard entry both lead to that same on-device read surface.

## Architecture

### Data Model

The digest has no table and stores no per-contact state. It reads existing SQLite interactions and contacts at screen-open time; its only durable policy is the notification toggle in the singleton `app_settings` row.

**Tables:**
- `interactions` — supplies all recent touchpoints and optional `good` / `fine` / `hard` quality marks.
- `contacts` — supplies names, photos, lifecycle state, recency, rare-response state, and the never-contacted backlog.
- `app_settings` — supplies the master notification setting, `digest_enabled`, and the shared delivery hour.

**Types** (`src/db/digest-read.ts`):
- `RetrospectiveRow` — one non-archived person and their latest touchpoint in the inclusive trailing window.
- `OverlookedRow` — one non-archived rogue person, including the shared status-engine reason.
- `GentleLine` — the neutral hard-quality tally and its distinct named people.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Read DAO | `src/db/digest-read.ts` | Reads retrospective, overlooked, and quality-mark inputs without writes or a network path. |
| Pure logic | `src/logic/digest-logic.ts` | Owns local day labels, group capping, and the conservative effortful threshold. |
| Screen | `src/screens/DigestScreen.tsx` | Reloads live data on focus and renders the fixed calm section order. |
| Scheduler | `src/services/notifications/digest-schedule.ts` | Reconciles the singleton weekly OS request from persisted settings. |

### Key Files

| File | Role |
|---|---|
| `src/db/digest-read.ts` | Read-only SQLite chokepoint; imports shared status SQL rather than re-deriving it. |
| `src/logic/digest-logic.ts` | Tunable windows, group cap, local weekday tag, and effortful-line policy. |
| `src/screens/DigestScreen.tsx` | Typed live screen with profile and never-contacted destinations. |
| `src/services/notifications/digest-schedule.ts` | Owns the `digest:weekly` request and launch-sweep registration. |

## How It Works

### Opening Your week

1. The user presses “Your week” on Home, or taps the Sunday notification; both reach the typed `Digest` route.
2. `DigestScreen` reloads its inputs in parallel on focus with a cancelled-result guard.
3. `readRetrospective()` returns one row per non-archived person touched in the inclusive trailing seven-day window, regardless of direction or connection outcome.
4. `readOverlooked()` reads shared rogue status directly and splits `overdue` people into Drifting and `unresponsive` people into Gone quiet; it intentionally does not apply the decay-push mute.
5. The screen reuses the dashboard never-contacted count, applies the quality gate, then renders retrospective, gentle line, overlooked groups, backlog nudge, or the unified all-quiet state.
6. Retrospective and gentle-line reads remain all-relationship-history, including Unbound contacts; only the active-cadence overlooked projection is Bound-only.

### Delivering the weekly prompt

1. The separate digest scheduler reads the master setting, `digest_enabled`, and delivery hour.
2. When both gates are on, it maintains exactly one Sunday-morning `digest:weekly` request with frozen generic copy; when either is off, it cancels that request.
3. A launch-sweep hook repeats the idempotent reconcile, while a notification tap resets the native stack to Home then Digest.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `RETROSPECTIVE_WINDOW_DAYS` | `6` | `src/logic/digest-logic.ts` | Produces an inclusive seven-day retrospective window. |
| `EFFORTFUL_WINDOW_DAYS` | `14` | `src/logic/digest-logic.ts` | Produces a deliberately wider inclusive quality-mark window. |
| `GROUP_CAP` | `6` | `src/logic/digest-logic.ts` | Keeps each overlooked group calm before “+N more”. |
| `EFFORTFUL_MIN_HARD` / `EFFORTFUL_MIN_FRACTION` | `3` / `0.5` | `src/logic/digest-logic.ts` | Requires both an absolute and proportional hard-mark signal. |
| `DIGEST_WEEKDAY` | `1` | `src/services/notifications/digest-schedule.ts` | Schedules Sunday delivery. |

## Decisions

- **ADR-054:** Live Weekly Digest Retrospective and Overlooked Relationship Read — keeps the screen live, local, non-scoreboard, and distinct from the dashboard.
- **ADR-055:** Dedicated Weekly Digest Scheduling and Persisted Notification Policy — supplies the weekly prompt and durable scheduling gate.
- **ADR-062:** Bound/Unbound Lifecycle and One-Way Cadence Assignment — gates only active overlooked work while preserving relationship history.

## Gotchas

1. **The overlooked population is the inverse of decay eligibility.** Do not reuse the decay-suppression predicate: muted rogue and rarely-responding people belong here, while never-contacted people appear only through the backlog nudge.
2. **Stored timestamps are local wall-clock values.** Use bare `date(stored_column)` and convert only SQLite's current time; UTC conversion can move an edge touchpoint.
3. **Keep the quality line rare.** The threshold requires both a count and fraction so a single difficult conversation never becomes a relationship verdict.
4. **A weekly trigger still needs device proof.** The physical-device test confirms its Sunday fire and Expo’s headless re-arm for the next occurrence.
5. **Do not describe the whole digest as Bound-only.** The retrospective and gentle line intentionally retain Unbound relationship history.

## Related Systems

- **Notifications** — owns the versioned channel, OS request plumbing, response gate, and global policy conventions.
- **Dashboard** — provides the in-app entry and the never-contacted backlog destination.
- **Status engine** — supplies the sole rogue/status expressions used by the overlooked read.
- **Interaction log** — supplies the touchpoints and quality marks the digest reflects.
- **Persistence core** — migrates the durable digest toggle and runs launch-sweep hooks after readiness.
- **App shell** — registers the route and guarantees the notification tap’s dashboard-rooted Back stack.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-23 | 15 | Created the live weekly retrospective, overlooked relationship read, Sunday scheduling, and dashboard entry. |
| 2026-08-27 | 18.2 | Made the active overlooked projection Bound-only while retaining inclusive retrospective history. |
