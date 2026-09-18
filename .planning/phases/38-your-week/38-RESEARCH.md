# Phase 38: Digest & Navigation Restructure - Research

**Researched:** 2026-09-18
**Domain:** React Navigation shell restructure (bottom tabs → five-tab) + Digest recomposition from existing on-device SQLite reads (React Native / Expo, local-first)
**Confidence:** HIGH (structural navigation + reuse targets verified against disk); MEDIUM on two composition decisions that need owner/planner reconciliation (Your Week aggregation semantics; heatmap reuse-vs-adapt)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
> These D-NN are the cross-cutting **enforced guards** that must reach plan-phase. They do not replace the dossier — read it in full first.

- **D-01:** The authoritative product contract is `docs/dossier/milestone-2/phase-38-digest-navigation-restructure-dossier.md`. Plan against it, not against this shim or the retired "Your Week page" framing.
- **D-02:** Digest is a read/derive-only surface with **NO schema of its own** and **no persisted Digest snapshot/cache** (dossier §O). Any durable state it wants would force another backup-format bump on top of the recent one — a strong signal an upstream phase missed something. Discovering a migration need here is a stop-and-confirm, not a licence to add one.
- **D-03:** Do **not** decompose into one-plan-per-tab or one-plan-per-Digest-module (dossier §R). The coherent unit is the shell/home-model transition plus the minimum Digest composition needed to make it useful. Keep the phase narrow; do not opportunistically redesign Contacts, Events, or Settings while restructuring navigation (§K, §R).
- **D-04:** Up Next ordering uses **canonical relationship/orbit status/progress semantics** — do not invent Digest-specific urgency classifications (§D). Up Next takes first claim on its (max three) contacts; Horizon must dedup against them and not re-surface the same condition (§E).
- **D-05:** Reuse Phase 32 / Profile heatmap + history aggregation and canonical interaction / Group-Event reads; do **not** reimplement them or create parallel metric definitions (§H, §J, §O). Unbound-contact cadence aggregation follows whatever Phases 31/32 settled (ADR-062 guard) — do not invent a third answer.
- **D-06:** The inherited birthday obligation now lives at **Horizon → Birthdays** (forward 7-day window), **not** in Your Week — this corrects the earlier placeholder mapping (§F; ADR-076 superseding ADR-034).
- **D-07:** The dossier specifies no inline write actions in Up Next / Horizon (§D). If any interaction create/edit does appear, it must route through the single recency-writer core in one transaction (ADR-010/024/071); a write surfacing here otherwise signals scope drift.

### Claude's Discretion
Per dossier §I: "Put the [Your Week period] preference in Settings wherever it naturally fits at execution time." Per §A: proposed `TAB_ICON` glyphs are owner taste (see Navigation Patterns). Plan ordering/splits (subject to D-03's no-per-module rule).

### Deferred Ideas (OUT OF SCOPE)
Carried in dossier §Q: Digest customization beyond the Your Week period preference; configurable Up Next count / birthday horizon; Digest-specific FAB or inline outreach controls; calendar rotary / long-range history in Digest; Contacts or Events redesign; planned-event/calendar integration; broad Settings restructuring; repository-wide historical terminology cleanup.
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 38 requirement IDs are the dossier **§S Planning-Time Verification Checklist** (1–15). Each is mapped below to the concrete on-disk artifact that satisfies or must change for it. `[VERIFIED]` = the cited file was opened this session.

| §S # | Requirement | Research Support (verified on disk) |
|------|-------------|-------------------------------------|
| S.1 | Inventory root tabs/stacks + routes nested under Dashboard/Home | `src/navigation/RootNavigator.tsx` (4 tabs, `initialRouteName="DashboardTab"`); `DashboardStack.tsx` nests `Digest` + `GroupEvents` [VERIFIED] |
| S.2 | Verify origin-aware Profile from Contacts/Events/Digest/Orrery | `Profile` registered in `DashboardStackParamList` + `OrreryStackParamList` + `SettingsStackParamList`; origin machinery via `ComposeOrigin` and per-stack registration (`types.ts:14-26,74,170,290`) [VERIFIED] |
| S.3 | Audit global FAB mounting/actions | `<UniversalFab/>` mounted once at App shell (`App.tsx:400`), floats over all tabs; actions route to `DashboardTab` (`universal-fab-logic.ts:88-101`) [VERIFIED] |
| S.4 | Verify Settings Backup & Restore before removing Backup tab | `SettingsStackParamList` re-registers `Backup`/`BackupSettings`/`RestorePreview`/`RestoreResult` (dual-home, D-08); `SettingsStack.tsx` present (`types.ts:255-273`) [VERIFIED] |
| S.5 | Inventory user-facing Dashboard/Group Events labels | RootNavigator tab titles "Dashboard"/"Backup" (`RootNavigator.tsx:218,236`); HomeScreen header shortcuts "Your Week"/"Group Events" (`HomeScreen.tsx:1648-1711`) [VERIFIED] |
| S.6 | Canonical relationship/orbit status/progress for Up Next ordering | `src/db/status.ts` (`PROGRESS_SQL`/`STATUS_SQL`/`REASON_SQL`, thresholds) [VERIFIED] |
| S.7 | Overlooked/rogue + never-contacted reads + Up Next/Horizon dedup | `readOverlooked` (`digest-read.ts:109-124`); `countNeverContacted` (`dashboard-read.ts:540-554`) [VERIFIED]; dedup is NEW composition logic |
| S.8 | Next-seven-days birthday/date-boundary behavior | `daysUntilBirthday` (`birthday-logic.ts:165-204`); `listBirthdayCandidates` (`dashboard-read.ts:620-628`) [VERIFIED] — existing window helper is 30-day, needs 7-day filter |
| S.9 | Phase 32/Profile heatmap aggregation + reusable day-detail | `ActivityHeatmap.tsx`, `DateDetailSheet.tsx`, `services/history/buckets.ts`, `services/history/window.ts`, `db/history-read.ts` [VERIFIED] — all per-contact today |
| S.10 | Define Rolling 7 Days + locale-aware Calendar Week once | `buildSevenDays` exists (`window.ts:90-100`); **Calendar Week builder does NOT exist** — new helper needed (expo-localization available) |
| S.11 | Group Event contribution without double-counting | `group_events` + `interactions.group_event_id` (`migration 026`); `group-events-read.ts` [VERIFIED] — dedup semantics need reconciliation (see Open Questions) |
| S.12 | Period preference via existing Settings persistence | `app-settings-dao.ts` pattern (migration + `AppSettings` field + optional `PortableSettingsSnapshot`) [VERIFIED] — **no period pref exists yet**; new migration 030 |
| S.13 | Digest notification/deep-link routing to new Digest root | `notification-nav.ts:88-93` resets `[Home, Digest]` inside DashboardTab — must repoint to Digest tab root [VERIFIED] |
| S.14 | Tab reselect-to-root, state preservation, fresh-launch Digest, resume | `handleActiveTabPress` popToTop (`RootNavigator.tsx:91-118`); `initialRouteName` (`RootNavigator.tsx:191`) [VERIFIED] |
| S.15 | Physical Android UAT across all five tabs, Back, FAB, drill-through, heatmap, notification, themes | Reference device Pixel 6 Pro (see Validation Architecture) |
</phase_requirements>

## Summary

Phase 38 is **95% recomposition + navigation surgery, 5% new read-only DAOs, plus one small settings-preference migration**. The heavy lifting is a React Navigation restructure from the current **4-tab shell** (`DashboardTab` · `OrreryTab` · `BackupTab` · `SettingsTab`, with `Digest` and `GroupEvents` buried as *pushed screens inside* `DashboardStack`) to a **5-tab shell** (`Contacts` · `Events` · `Digest` · `Orrery` · `Settings`) where Digest is centered and the default launch root. The FAB is already a shell-global affordance (`App.tsx:400`) that shows on Digest and routes to Contacts — no FAB rebuild is needed, only a mounting/visibility audit. The Digest notification deep-link (`notification-nav.ts`) must be repointed from `[Home, Digest]`-inside-DashboardTab to the new Digest tab root.

The Digest surface itself (`DigestScreen.tsx` + `digest-read.ts`) is a shipped "Your week" retrospective that will be **substantially rewritten** into the three-module `Up Next · Horizon · Your Week` structure. Up Next and Horizon-Overlooked compose from the **existing canonical query-time status engine** (`status.ts`) and existing reads (`readOverlooked`, `countNeverContacted`); birthdays compose from the existing `daysUntilBirthday` parser (filtered to a NEW 7-day window); never a new relationship table (D-02 holds — all Digest data derives from `contacts`/`interactions`/`group_events`).

**Your Week is the only module needing genuinely new work**: there is **no app-wide (all-contacts) daily-activity aggregation** in the codebase today — every history read (`readContactHistory`, the heatmap feed) is per-contact. Your Week needs (a) new **read-only** DAOs for period metrics + a date→count map + app-wide day detail, (b) a **locale-aware Calendar Week window builder** (only Rolling-7 exists), and (c) a **new `app_settings` period-preference column** (migration 030) following the established declare-optional / emission-deferred pattern — **this does not require a backup-format bump and is not relationship-domain schema, so D-02 is satisfied**.

**Primary recommendation:** Restructure the shell first (keep internal name `DashboardTab` to avoid breaking the FAB's hardcoded tab target), promote Digest and GroupEvents to their own tab stacks, remove BackupTab, repoint the digest notification; then rewrite DigestScreen to compose Up Next + Horizon from existing status/birthday/overlooked reads; then add the new Your Week read-only DAOs + Calendar Week builder + period preference (migration 030) + a period-scoped heatmap that reuses the Phase 32 cell/bucket helpers without the lens/nav chrome.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Five-tab shell / root stacks / reselect-to-root / fresh-launch-to-Digest | Navigation shell (`src/navigation/`) | — | Structural; React Navigation `Tab.Navigator` + per-tab native stacks |
| Origin-aware Profile Back | Navigation shell | Screens | Profile re-registered per hosting stack; existing `ComposeOrigin` contract |
| Digest data (Up Next / Horizon / Your Week reads) | Data layer (`src/db/`) | Logic (`src/logic/`, `src/services/history/`) | Local-first SQLite; derive-never-store status engine; no network on read path |
| Digest presentation | Screens/components (`src/screens/DigestScreen.tsx`, `src/components/`) | Theme (`src/theme/`) | Recompose existing primitives (`ContactCard`, `Avatar`, `ChromeScrim`, `ActivityHeatmap`) |
| Period preference persistence | Data layer (`app-settings-dao` + migration) | Settings screens | Established settings-preference path; not relationship-domain schema |
| Digest notification deep-link | Navigation + notifications (`notification-nav.ts`, `notification-gate.tsx`) | — | Pure nav-intent resolver + gate adapter |
| Global FAB | App shell (`App.tsx`) | `universal-fab-logic` | Already shell-global; routes to Contacts stack |

## Standard Stack

**No new packages.** This phase is built entirely from in-repo primitives + already-installed libraries. Verified against `package.json` [VERIFIED: package.json].

### Core (already installed — versions from package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-navigation/bottom-tabs` | (in use) | The five-tab shell | Already the shell's tab navigator (`RootNavigator.tsx`) |
| `@react-navigation/native-stack` | (in use) | Per-tab stacks | Already every tab's stack pattern |
| `@react-navigation/native` | (in use) | `getFocusedRouteNameFromRoute`, `StackActions.popToTop`, `useFocusEffect` | Reselect-to-root + focus reads already use these |
| `expo` | ~57.0.13 | Runtime | — |
| `expo-localization` | ~57.0.1 | `getCalendars()[0].firstWeekday` for locale-aware Calendar Week (§I / S.10) | Already imported (`device-region.ts` uses `getLocales`) — `getCalendars` is the correct API for first-day-of-week |
| `expo-sqlite` | (in use) | On-device reads | All DAOs |
| `react-native-reanimated` | (in use) | FAB dial animation (existing) | No new animation needed |

### Supporting (in-repo modules to reuse — not libraries)
| Module | Path | Purpose |
|--------|------|---------|
| Query-time status engine | `src/db/status.ts` | `PROGRESS_SQL`/`STATUS_SQL`/`REASON_SQL` — Up Next ordering + Overlooked (D-04) |
| Digest reads | `src/db/digest-read.ts` | `readOverlooked`, `readRetrospective`, `readGentleLine` |
| Dashboard reads | `src/db/dashboard-read.ts` | `countNeverContacted`, `listBirthdayCandidates`, `BirthdayCandidate` |
| Birthday parser | `src/logic/birthday-logic.ts` | `daysUntilBirthday` (7-day filter for Horizon → Birthdays) |
| Heatmap components | `src/components/history/ActivityHeatmap.tsx`, `heatmap-cell.ts`, `DateDetailSheet.tsx` | Your Week visual/interaction language (§J) |
| Heatmap logic | `src/services/history/buckets.ts` (`buckets`, `heatmapLevel`), `window.ts` (`buildWindow`) | Date→count bucketing + window geometry |
| Group event reads | `src/db/group-events-read.ts` | Events metric + day-detail one-record rule |
| Settings persistence | `src/db/app-settings-dao.ts` | Period-preference column pattern |

**Installation:** none.

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** Every dependency (`@react-navigation/*`, `expo-localization`, `expo-sqlite`, `react-native-reanimated`) is already present and in active use per `package.json` [VERIFIED: package.json]. No SLOP/SUS surface.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────── App.tsx (shell) ───────────────────────┐
                         │  NavigationContainer(navigationRef)                            │
                         │    ├── RootNavigator  (Tab.Navigator, initialRoute=Digest*)    │
   fresh launch ────────▶│    │     ├─ ContactsTab  (DashboardStack: Home + children)     │
   (default → Digest)    │    │     ├─ EventsTab    (GroupEvents root + shared children)  │
   resume ──────────────▶│    │     ├─ DigestTab    (DigestScreen root + shared children) │◀── digest notification
   (preserves state)     │    │     ├─ OrreryTab    (OrreryStack)                          │    (notification-nav reset)
                         │    │     └─ SettingsTab  (SettingsStack, Backup dual-homed)    │
                         │    ├── <UniversalFab/>  (global; visible on Digest; →Contacts) │
                         │    └── NotificationResponseGate / WidgetLinkingGate            │
                         └───────────────────────────────────────────────────────────────┘
                                              │ reads (async, on focus, NO network)
                                              ▼
        ┌──────────────────────────── DigestScreen (rewrite) ────────────────────────────┐
        │  Up Next  ──▶ status.ts (STATUS_SQL/PROGRESS_SQL) ranked; ≤3; dedup source      │
        │  Horizon  ──▶ Birthdays: listBirthdayCandidates + daysUntilBirthday (0..6d)     │
        │            ─▶ Overlooked: readOverlooked (rogue) MINUS Up Next's 3 (dedup)      │
        │            ─▶ Never Contacted: countNeverContacted (conditional, drill-through) │
        │  Your Week ─▶ [NEW read-only] period metrics {peopleReached,interactions,events}│
        │            ─▶ [NEW read-only] date→count map → ActivityHeatmap cells (no chrome)│
        │            ─▶ day tap → [NEW read-only] app-wide day detail (inline, beneath)   │
        │  period pref ◀── app_settings.your_week_period (NEW migration 030)              │
        └────────────────────────────────────────────────────────────────────────────────┘
                 * fresh launch lands on Digest; background/resume preserves prior state.
```

### Recommended Project Structure (files this phase touches / adds)
```
src/navigation/
├── RootNavigator.tsx          # 4→5 tabs; add Digest+Events; remove Backup; reorder; initialRoute=Digest
├── tabs/
│   ├── DashboardStack.tsx     # remove Digest + GroupEvents pushed screens (they become roots)
│   ├── DigestStack.tsx        # NEW: DigestScreen root + shared child routes (Profile, etc.)
│   ├── EventsStack.tsx        # NEW: GroupEvents root + shared child routes
│   └── BackupStack.tsx        # deleted from tabs (Backup stays reachable via Settings)
├── types.ts                   # TabParamList: +DigestTab +EventsTab -BackupTab; new stack param lists
├── focused-route-classification.ts  # confirm Digest/GroupEvents roots are NOT focused-workflows
src/screens/
├── DigestScreen.tsx           # REWRITE → Up Next / Horizon / Your Week
├── HomeScreen.tsx             # remove "Your Week"/"Group Events" header shortcuts (§K)
src/db/
├── your-week-read.ts          # NEW read-only: period metrics + date→count + day detail
├── app-settings-dao.ts        # +your_week_period field (declare-optional in PortableSettingsSnapshot)
├── migrations/030-your-week-period.ts   # NEW: add app_settings column, seed default 'rolling7'
├── migrations/database.ts     # register migration030; TARGET_VERSION 29→30
src/services/history/
├── week-window.ts             # NEW: locale-aware Calendar Week builder (expo-localization firstWeekday)
src/services/notifications/
├── notification-nav.ts        # repoint digest intent to Digest tab root
```

### Pattern 1: Query-time status is DERIVED-NEVER-STORED (Up Next / Overlooked)
**What:** Up Next ordering and Overlooked membership both come from SQL fragments computed in the SELECT, never a stored column.
**When to use:** Every Up Next / Overlooked read.
**Example (verbatim fragments):**
```sql
-- Source: src/db/status.ts:59,72-78 [VERIFIED: src/db/status.ts:40-104]
-- PROGRESS_SQL = elapsed ÷ interval, day-granular at local midnight:
CAST(julianday(date('now','localtime')) - julianday(date(last_contact)) AS REAL) / interval_days
-- STATUS_SQL buckets: rogue (rarely_responds+wobble | >=ROGUE_K) / decay / wobble / stable
-- Thresholds (verbatim): STABLE_MAX = 0.8, WOBBLE_MAX = 1.0, ROGUE_K = 3
```
Up Next should ORDER BY the same `progress DESC` idiom `readOverlooked` uses (`digest-read.ts:122`) so "overdue/rogue naturally outrank approaching" (§D) with no Digest-local classification (D-04).

### Pattern 2: Reads on focus, cancelled-flag guard, null-vs-loaded sentinel
**What:** The shipped DigestScreen focus-effect pattern; keep it on rewrite.
**Example:**
```typescript
// Source: src/screens/DigestScreen.tsx:91-119 [VERIFIED]
useFocusEffect(useCallback(() => {
  let cancelled = false;
  (async () => {
    try {
      const exec = getExecutor();
      const [/* up-next, horizon, your-week reads */] = await Promise.all([ /* ... */ ]);
      if (!cancelled) setState({ phase: "loaded", data });
    } catch (err) { if (!cancelled) setState({ phase: "error" }); }
  })();
  return () => { cancelled = true; };
}, []));
```
Async reads only (never `...Sync`), no writer, no network — matches the local-first read-path rule.

### Pattern 3: Settings preference — declare-optional / emission-deferred (period pref)
**What:** Add a new `app_settings` column + `AppSettings` field + **optional** `PortableSettingsSnapshot` entry; do **not** add it to `getPortableSettingsSnapshot`'s SELECT and do **not** bump `BACKUP_FORMAT_VERSION`.
**Why:** This is the exact pattern used by Phase 32 (`historyLens`/`historyCycleCount`), 34, 35, 36.
**Example (the established comment contract):**
```typescript
// Source: src/db/app-settings-dao.ts:464-473 [VERIFIED]
// "--- History keys (Phase 32, D-11) — allowlisted + writable NOW, EMISSION DEFERRED.
//  Declared OPTIONAL (?:) ... Do NOT add these to the getPortableSettingsSnapshot
//  SELECT this phase and do NOT bump BACKUP_FORMAT_VERSION"
historyLens?: HistoryLens;
historyCycleCount?: HistoryCycleCount;
```
`BACKUP_FORMAT_VERSION` is currently **6** [VERIFIED: src/backup/types.ts:14]. Following this pattern, the Your Week period preference **does not touch it** — resolving the D-02 backup-bump concern.

### Anti-Patterns to Avoid
- **Renaming the internal `DashboardTab` route name.** The FAB hardcodes `navigate("DashboardTab", …)` (`universal-fab-logic.ts:88-101`, `UniversalFab.tsx:253`); renaming it breaks every FAB action. Keep the internal name; change only the user-facing tab **title** (§B DERIVED permits this).
- **Counting group-linked child interactions as per-participant activity.** §J: a Group Event is one record in day detail, not fake per-participant rows. Naïvely counting `interactions` rows inflates a group event by its participant count (see Open Questions).
- **Adding a relationship table or a Digest snapshot/cache.** D-02 — stop and confirm, do not implement.
- **Reusing `ActivityHeatmap` wholesale for Your Week.** It ships a lens switcher (Cycles/7 Days/Month/Year) + prev/next navigation (`ActivityHeatmap.tsx:271-323`), which violate §J's "no calendar rotary / long-range navigation." Reuse the *cell rendering + `heatmapScale` + `buckets`/`heatmapLevel`/`classifyHeatmapCell` helpers*, not the whole component's chrome (see Open Questions).
- **`toISOString().split('T')[0]`.** Use `formatLocalDate()` (`src/utils/dates.ts:17`) — the documented once-fixed UTC off-by-one.
- **Hardcoded colours.** Every colour through `useTheme().colors.*` including heatmap cells (already the pattern).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Who needs outreach" ranking | A Digest urgency score | `STATUS_SQL`/`PROGRESS_SQL`/`REASON_SQL` (`status.ts`) | D-04; canonical, derive-never-store, already tuned |
| Rogue/overlooked population | New rogue query | `readOverlooked` (`digest-read.ts:109-124`) | Deliberately omits mute filter + guards NULL `last_contact` — subtle and already correct |
| Never-contacted count | New count | `countNeverContacted` (`dashboard-read.ts:540-554`) | Honors `include_unbound_never_contacted` setting |
| Birthday days-until | New date math | `daysUntilBirthday` (`birthday-logic.ts`) | Fixes day-of drop + Feb-29 overflow; the single parser |
| Rolling-7 window | New geometry | `buildWindow("7days", …)` (`window.ts:90-100`) | Clamped-to-today, local-date-safe, node-tested |
| Date→count bucketing | New tally | `buckets()` + `heatmapLevel()` (`buckets.ts`) | Count-only invariant + saturation ramp already tuned |
| Heatmap cell fill/level | New classifier | `classifyHeatmapCell` (`heatmap-cell.ts`) | Structural current-cell marking (a11y, §P) |
| Day-detail row rendering | New sheet | `DateDetailSheet` (`DateDetailSheet.tsx`) — *with a caveat* | Interleaves families by icon; but shows no contact name (see Open Questions) |
| Reselect-tab-to-root | New handler | `handleActiveTabPress` (`RootNavigator.tsx:91-118`) | Already popToTop; extend to all 5 tabs |
| Locale first-day-of-week | Manual locale parse | `expo-localization` `getCalendars()[0].firstWeekday` | Installed; the correct API |

**Key insight:** Everything Up Next and Horizon need already exists as correct, tested reads. The only truly new *data* work is Your Week's app-wide aggregation — because every existing history read is per-contact.

## Runtime State Inventory

> This is primarily a navigation/UI recomposition, but it removes a tab and adds a migration, so the categories are answered explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | The only NEW stored state is `app_settings.your_week_period` (one preference column, default `'rolling7'`). No relationship-domain data. [VERIFIED: no such column today — `app-settings-dao.ts:234-400`] | Migration 030 (forward-only, additive column with DEFAULT). Irreversible in production — safe additive. |
| Live service config | Digest notification schedule (`digest-schedule.ts`) is unchanged; only the tap-routing target moves (code, not stored config). Notification `data.kind === "digest"` payload carries no route shape. [VERIFIED: notification-nav.ts:83-93] | Code edit in `notification-nav.ts` + gate; no stored migration. |
| OS-registered state | None. Tab removal/reorder is in-app JS; no OS registration embeds tab identity. | None — verified: shell tabs are `Tab.Screen` names only. |
| Secrets/env vars | None touched. | None. |
| Build artifacts | None. No package renames; no egg-info/native module changes. | None. |

**Migration numbering:** latest shipped migration is **029** (version 29; `024` was tombstoned/renumbered — it does not exist on disk) [VERIFIED: `src/db/migrations/` listing; `database.ts:47-99`]. `TARGET_VERSION = AI_CONFIGURATION_SCHEMA_VERSION` (29) [VERIFIED: database.ts:67]. The Your Week period migration is **030**, bumping `TARGET_VERSION` to 30. Never assume — this was verified against disk (per the "verify vs disk" memory rule).

## Common Pitfalls

### Pitfall 1: Renaming DashboardTab breaks the FAB
**What goes wrong:** FAB actions silently no-op or throw because `navigate("DashboardTab", …)` targets a route name that no longer exists.
**Why it happens:** The FAB is shell-global and hardcodes the tab name (`UniversalFab.tsx:253`, `universal-fab-logic.ts:88-101`).
**How to avoid:** Keep the internal `DashboardTab` route name; relabel only the visible **title**. §B DERIVED explicitly allows this.
**Warning signs:** FAB "Add Contact"/"Log" does nothing after the tab rename.

### Pitfall 2: Digest notification lands in the wrong tab
**What goes wrong:** After promotion, `resolveNotificationNav` still resets `[Home, Digest]` *inside DashboardTab*, so tapping the digest notification opens Contacts→Digest, not the Digest tab root (§N/§S.13).
**Why it happens:** `notification-nav.ts:88-93` predates the tab; the gate nests the flat routes in DashboardTab.
**How to avoid:** Repoint the digest intent to select the Digest tab root; audit `notification-gate.tsx` nesting. No legacy-migration machinery (no production users — §N planning note).
**Warning signs:** Back from a notification-opened Digest lands on Contacts/Home unexpectedly.

### Pitfall 3: Group Event double-counting in Your Week
**What goes wrong:** A group event with N participants counts as N interactions in the heatmap/metrics, or appears as N per-participant rows in day detail.
**Why it happens:** Group participation is stored as `interactions` rows carrying `group_event_id` (`migration 026`); a naïve `COUNT(*) FROM interactions` counts each child.
**How to avoid:** §J — treat a Group Event as ONE record in day detail and as the `Events` metric; decide (planner reconciliation) whether group-linked child interactions contribute to the `Interactions` metric and heatmap saturation, or are collapsed. Cite `group_events` + `interactions.group_event_id`.
**Warning signs:** A single dinner with 6 people shows "6 interactions" on its day cell.

### Pitfall 4: Up Next ↔ Horizon duplicate the same person
**What goes wrong:** A rogue contact appears both in Up Next (its 3) and in Horizon → Overlooked.
**Why it happens:** Both draw from the same rogue population.
**How to avoid:** §E/D-04 — Up Next takes first claim; Horizon Overlooked must exclude Up Next's chosen contact ids for the same condition. This dedup is NEW composition logic (no existing helper), so it must be explicit and tested.

### Pitfall 5: Birthday window mismatch (30-day vs 7-day)
**What goes wrong:** Reusing `resolveBirthdayWindow`/`countBirthdayPopulation` gives a 30-day window; Horizon → Birthdays must be **7 days** (§F/D-06).
**Why it happens:** The Dashboard birthday population is hardcoded `days >= 0 && days <= 30` (`dashboard-read.ts:302`) and ADR-076 describes a 30-day Dashboard population — a *different* surface from Horizon's 7-day forward window.
**How to avoid:** Reuse `daysUntilBirthday` + `listBirthdayCandidates` but filter `0 <= days <= 6` (soonest-first) for Horizon. Do not reuse the 30-day `resolveBirthdayWindow`. This window is independent of the Your Week period (§I).
**Warning signs:** Birthdays 3 weeks out show up in Horizon.

### Pitfall 6: Calendar Week assumes Sunday-first
**What goes wrong:** Calendar Week always starts Sunday regardless of locale.
**Why it happens:** `window.ts` hardcodes Sunday-first padding (`weekdayOf` → `getDay()===0`); there is no Calendar Week builder.
**How to avoid:** New `week-window.ts` using `expo-localization` `getCalendars()[0].firstWeekday` to derive the locale first day (§I: "no Orbit-specific Sunday/Monday preference"). Rolling-7 reuses `buildSevenDays`.

## Code Examples

### Horizon → Birthdays (7-day forward, soonest-first)
```typescript
// Compose from existing reads — NO new schema. Source shapes:
//   listBirthdayCandidates → {id,name,birthday}  [VERIFIED: dashboard-read.ts:620-628]
//   daysUntilBirthday(stored, today) → number|null [VERIFIED: birthday-logic.ts:165-204]
const candidates = await listBirthdayCandidates(exec);
const today = /* local midnight from formatLocalDate(new Date()) */;
const upcoming = candidates
  .map(c => ({ ...c, days: daysUntilBirthday(c.birthday, today) }))
  .filter(c => c.days !== null && c.days >= 0 && c.days <= 6)  // 7-day forward window (§F)
  .sort((a, b) => a.days! - b.days!);   // soonest first; 0 → "Today", 1 → "Tomorrow"
```

### Your Week app-wide date→count (NEW read-only; feeds ActivityHeatmap cells)
```sql
-- NEW read in your-week-read.ts. Mirrors digest-read.ts injection posture:
-- static string, only closed constants interpolated, local-wall-clock discipline.
-- (occurred_at is already local; bare date(col) — never re-run through 'localtime')
SELECT date(i.occurred_at) AS d, COUNT(*) AS n
  FROM interactions i
  JOIN contacts c ON c.id = i.contact_id
 WHERE c.archived_at IS NULL
   AND date(i.occurred_at) BETWEEN date(?) AND date(?)   -- period start/end (local YYYY-MM-DD)
 GROUP BY d;
-- People reached = COUNT(DISTINCT i.contact_id) over the same window (cf. readRetrospective).
-- Events = COUNT(*) FROM group_events WHERE date(occurred_at) BETWEEN ? AND ?.
-- Group-linked double-count handling: see Open Questions Q2.
```

### Reselect-to-root, extended to all five tabs (already generic)
```typescript
// Source: RootNavigator.tsx:91-118 [VERIFIED] — handleActiveTabPress popToTop is
// route-agnostic; wire the same `listeners={{ tabPress }}` onto the new Digest +
// Events Tab.Screens exactly as the existing four do (RootNavigator.tsx:219-249).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Digest = "Your week" retrospective (Reached / Overlooked / gentle line), pushed inside DashboardStack | Digest = home tab with Up Next / Horizon / Your Week | Phase 38 | DigestScreen rewrite; digest-read partly reused, partly superseded |
| Dashboard birthday banner (ADR-034) | Dashboard 30-day Birthdays population (ADR-076); richer birthday presentation → Horizon 7-day (D-06) | ADR-076 (2026-09-01) supersedes ADR-034 (partial) | Horizon owns forward-birthday presentation |
| 4-tab shell (Dashboard/Orrery/Backup/Settings) | 5-tab shell (Contacts/Events/Digest/Orrery/Settings) | Phase 38 | Structural; Backup tab removed (dual-homed in Settings since Phase 37, D-08) |

**Deprecated/outdated:**
- The task brief's "37.1 = period preference" is **incorrect**: Phase 37.1 on disk is **category-management** (`.planning/phases/37.1-category-management`), and **no period preference exists anywhere in `src`** [VERIFIED: broad grep, zero hits]. Phase 38 must introduce the period preference itself.
- `docs/dossier/.../planning-notes/phase-19-your-week-placeholder.md` — historical, superseded by the dossier.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Reason value naming `'overdue'`/`'unresponsive'` is stable label copy (branch logic is CITED/firm) | Up Next / Overlooked | LOW — copy only; `status.ts:96-98` already flags this as a prior assumption |
| A2 | The `Interactions` Your Week metric counts all qualifying `interactions` rows incl. group-linked children unless reconciled otherwise | Your Week | MEDIUM — affects headline number; §H PLANNING NOTE defers exact definition |
| A3 | Reusing heatmap *helpers* (not the whole `ActivityHeatmap` component) is the intended §J reuse | Your Week heatmap | MEDIUM — component ships lens/nav chrome §J forbids; planner must choose adapt path |
| A4 | Period preference stored as a TEXT enum (`'rolling7'` \| `'calendar_week'`) default `'rolling7'` | Period pref | LOW — shape is planner's; matches existing enum-column idiom |
| A5 | Digest tab should be a fresh `DigestStack` (not Digest left in DashboardStack) so origin-aware Back → Digest works | Shell | LOW — dossier §L requires Digest→Profile→Back→Digest; a shared stack would break origin |

## Open Questions

1. **Your Week heatmap: reuse component vs. reuse helpers?**
   - What we know: `ActivityHeatmap` renders count cells from a `HistoryWindow` + `Map<date,count>` and reuses `heatmapScale`, but ships a lens switcher + prev/next nav (`ActivityHeatmap.tsx:271-323`).
   - What's unclear: §J forbids "calendar rotary / long-range navigation," which the component's chrome effectively is.
   - Recommendation: build a thin period-scoped heatmap that reuses `buckets`/`heatmapLevel`/`classifyHeatmapCell` + `heatmapScale` + the cell `Pressable` pattern, without the lens/preset/prev/next controls. Confirm with planner (matches D-05 "reuse where practical," not "reuse verbatim").

2. **Group Event contribution to metrics/heatmap (double-count).**
   - What we know: group participation = `interactions` rows with `group_event_id` (migration 026); `Events` metric = `COUNT(group_events)`; §J says one record in day detail.
   - What's unclear: whether group-linked child interactions count toward the `Interactions` metric and heatmap saturation, or are collapsed to one.
   - Recommendation: planner reconciles against canonical interaction/Group-Event contracts (§H/§J PLANNING NOTE, D-05). Default assumption A2 = children count; flag for owner if it materially changes the headline.

3. **App-wide day detail: `DateDetailSheet` shows no contact name.**
   - What we know: `DateDetailSheet` was built per-contact (renders channel/note/time, no contact identity) (`DateDetailSheet.tsx`).
   - What's unclear: Your Week's inline day detail is app-wide, so a row needs to say *who*.
   - Recommendation: either extend the day-detail rows with a contact name/avatar for the app-wide context, or render an inline app-wide day list (not the profile sheet) beneath the heatmap. Planner decides; dossier §J says "inline beneath the heatmap," not specifically the sheet component.

4. **Period preference placement in Settings (§I discretion).**
   - What we know: Settings is decomposed into category screens (`SettingsStackParamList`); no obvious "Your Week"/"Digest" settings screen exists.
   - Recommendation: place it where it "naturally fits at execution time" (§I) — likely a Digest/Your Week row under an existing category (planner's call, D-03 forbids broad Settings restructuring).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@react-navigation/bottom-tabs` + `native-stack` | Five-tab shell | ✓ | in use | — |
| `expo-localization` (`getCalendars`) | Calendar Week first-day-of-week | ✓ | ~57.0.1 | Sunday-first default if `firstWeekday` unavailable |
| `expo-sqlite` | New read-only DAOs + migration | ✓ | in use | — |
| Pixel 6 Pro (physical) | On-device UAT (§S.15) | ✓ | reference device | desktop emulator (perf claims invalid there) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Calendar Week first-day-of-week degrades to a documented default if `getCalendars()` returns no `firstWeekday`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (node environment) — pervasive `*.test.ts`/`*.test.tsx` across `src/` |
| Config file | present (repo uses `vitest`; pure-logic modules are node-testable by design) |
| Quick run command | `npx vitest run <path>` (single file/module) |
| Full suite command | `npx vitest run` |
| Type gate | `npx tsc --noEmit` (NOT covered by vitest — see the "tsc in post-merge gate" memory; run before phase close) + `npm run check:colors` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| S.6/D-04 | Up Next ordering follows canonical status/progress; ≤3 | unit (pure) | `npx vitest run src/screens/DigestScreen*` (+ new up-next logic test) | ❌ Wave 0 (new logic module) |
| S.7/§E | Up Next ↔ Horizon dedup (no same-condition duplicate) | unit (pure) | `npx vitest run <horizon-dedup>.test.ts` | ❌ Wave 0 |
| S.8/D-06 | Birthdays 7-day forward, soonest-first, Today/Tomorrow tags | unit (pure) | reuse `birthday-logic.test.ts` + new window filter test | ⚠ partial (`birthday-logic.test.ts` exists) |
| S.10 | Rolling-7 vs locale Calendar Week boundaries | unit (pure) | `npx vitest run src/services/history/week-window.test.ts` | ❌ Wave 0 |
| S.11/§J | Group Event = one record; no per-participant double-count | unit (pure) | `npx vitest run src/db/your-week-read.test.ts` | ❌ Wave 0 |
| S.12 | Period preference persists via app_settings (migration 030) | unit + migration | `npx vitest run src/db/migrations/030-*.test.ts src/db/app-settings-dao.test.ts` | ❌ Wave 0 (migration test) |
| S.13/§N | Digest notification resolves to Digest tab root | unit (pure) | `npx vitest run src/services/notifications/notification-nav.ts` (extend existing) | ⚠ extend existing test |
| S.14 | Reselect-to-root, fresh-launch-Digest, resume preservation | unit + device | `npx vitest run` nav tests; device UAT | ⚠ partial |
| Your Week metrics | peopleReached/interactions/events over a period | unit (pure) | `npx vitest run src/db/your-week-read.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched module>` + `npx tsc --noEmit` on the touched surface.
- **Per wave merge:** `npx vitest run` (full) + `npx tsc --noEmit` + `npm run check:colors` (post-merge gate — vitest green ≠ tsc clean; see memory).
- **Phase gate:** full suite + tsc + check:colors green, then on-device UAT (below), before `/gsd-verify-work`.

### On-Device UAT surface (§S.15 — Pixel 6 Pro, debug build)
Prove — by driving the real app (screenshot + `uiautomator dump`), not just tests:
1. Fresh launch lands on **Digest** (centered tab); background→resume preserves the prior tab/stack (does not reset to Digest).
2. All five tabs switch (short crossfade, no swipe — SHELL-15); reselecting the active tab returns it to root.
3. Origin-aware Profile Back: Digest→Profile→Back→Digest; Contacts→Profile→Back→Contacts; Orrery→Profile→Back→Orrery; Events/detail→Profile→Back→Events context.
4. FAB visible on Digest with the Contacts actions; Backup tab absent; Backup & Restore still reachable via Settings.
5. Horizon Overlooked/Never-Contacted drill-through opens the canonical Contacts population/filter.
6. Your Week: period toggle (Rolling 7 / Calendar Week) drives metrics + heatmap + day detail consistently; day tap expands inline beneath the heatmap (no rotary); birthday window unaffected by the toggle.
7. Digest notification tap opens the Digest tab root; Back behaves.
8. Standard + Galaxy: identical IA/interaction, presentational differences only; heatmap day selection legible without colour (structural selected state).

### Wave 0 Gaps
- [ ] `src/db/your-week-read.test.ts` — period metrics + date→count + group-event dedup (S.11, metrics)
- [ ] `src/services/history/week-window.test.ts` — Rolling-7 vs locale Calendar Week (S.10)
- [ ] `src/db/migrations/030-your-week-period.test.ts` — additive column + default + version bump (S.12)
- [ ] Up Next ordering + Up Next↔Horizon dedup logic test(s) (S.6/S.7/§E)
- [ ] Extend `notification-nav` test for the Digest-tab-root intent (S.13)
- [ ] Horizon Birthdays 7-day filter test (S.8) — extends existing `birthday-logic.test.ts`

*(Existing infra covers status/birthday/window/bucket helpers; the gaps above are all new composition + the one migration.)*

## Security Domain

`security_enforcement` is not explicitly false; covered briefly because the phase is read-only + additive.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes (low) | All new reads are static SQL; the only interpolated values are closed constants + bound period dates (`?` params). No user free-text reaches any Digest query (matches `digest-read.ts` / `status.ts` injection posture). |
| V6 Cryptography | no | No crypto touched. |
| V1/V2/V3/V4 (authn/session/access) | no | Single-user on-device app; no auth surface. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via a period value | Tampering | Bind period start/end as parameters; never interpolate; keep the digest-read static-string rule |
| Data egress on a read path | Information Disclosure | Local-first — **no network on any Digest read path** (CLAUDE.md non-negotiable); the AI feature is irrelevant to Digest |
| Cross-contact data leak in app-wide day detail | Information Disclosure | Day detail is the user's own on-device data; no new exposure — but ensure archived contacts are excluded (`archived_at IS NULL`), matching existing reads |

## Sources

### Primary (HIGH confidence — files opened this session)
- `src/navigation/RootNavigator.tsx`, `tabs/DashboardStack.tsx`, `tabs/BackupStack.tsx`, `tabs/OrreryStack.tsx`, `navigation/types.ts`, `navigation/focused-route-classification.ts`, `navigation/reset-intents.ts` — shell structure
- `src/screens/DigestScreen.tsx`, `src/db/digest-read.ts`, `src/db/status.ts`, `src/db/dashboard-read.ts`, `src/logic/birthday-logic.ts` — Digest data
- `src/components/history/ActivityHeatmap.tsx`, `DateDetailSheet.tsx`, `src/services/history/buckets.ts`, `window.ts`, `src/db/history-read.ts` — Phase 32 reuse targets
- `src/db/app-settings-dao.ts`, `src/db/database.ts`, `src/db/migrations/` listing, `src/backup/types.ts` — settings/migration/backup facts
- `src/components/UniversalFab.tsx`, `src/components/universal-fab-logic.ts`, `App.tsx` — FAB + shell mounting
- `src/services/notifications/notification-nav.ts` — digest deep-link
- `docs/dossier/milestone-2/phase-38-...dossier.md`, `docs/decisions/ADR-076-...md`, `38-CONTEXT.md`, `38-UI-SPEC.md`, `.planning/REQUIREMENTS.md`

### Secondary (MEDIUM)
- `package.json` — dependency versions (grep, not full read)
- Broad grep sweeps (period preference absence; app-wide aggregation absence; FAB render site)

### Tertiary (LOW)
- Task-brief claim about Phase 37.1 (refuted against disk).

## Metadata

**Confidence breakdown:**
- Navigation restructure: HIGH — every current route/stack/tab read on disk.
- Up Next / Horizon composition: HIGH — all reuse targets verified; dedup logic is new but well-bounded.
- Your Week: MEDIUM — new read-only DAOs are straightforward, but group-event dedup semantics + heatmap reuse-vs-adapt need planner/owner reconciliation.
- Period preference / migration: HIGH — established pattern; migration number verified vs disk; no backup-format bump.
- Pitfalls: HIGH — each rooted in a cited file.

**Research date:** 2026-09-18
**Valid until:** ~2026-10-18 (stable; re-verify migration number + `BACKUP_FORMAT_VERSION` if any schema phase lands first)
