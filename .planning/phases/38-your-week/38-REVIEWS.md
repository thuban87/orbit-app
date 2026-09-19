---
phase: 38
reviewers: [codex, claude]
reviewed_at: 2026-09-19T00:36:17Z
plans_reviewed: [38-01-PLAN.md, 38-02-PLAN.md, 38-03-PLAN.md, 38-04-PLAN.md, 38-05-PLAN.md, 38-06-PLAN.md, 38-07-PLAN.md]
models:
  codex: "gpt-5.6-sol (reasoning=low)"
  claude: "unknown (read-only Claude subagent — Write-gap fallback)"
model_sources:
  codex: "banner"
  claude: "subagent-fallback"
review_method_notes: >
  Convergence CYCLE 2. The built-in `claude` reviewer lane was NOT used: this run executes
  inside Claude Code (CLAUDE_CODE_ENTRYPOINT=cli), so the machinery skips its own lane for
  independence, and that lane is also the known Write-permission-gap hazard (project MEMORY).
  Per the documented workaround the Claude review was run as a READ-ONLY general-purpose
  subagent and aggregated alongside the codex lane. The codex lane returned a genuine
  source-grounded review on the first attempt (gpt-5.6-sol, reasoning=low). The aggregator
  independently re-verified every disputed HIGH against the code on disk before recording it
  (CLAUDE.md "Review the code, not the diff").
cycle_summary:
  cycle: 2
  current_high: 3
  current_actionable: 11
  verdict: >
    Cycle-2 revisions resolved all 10 cycle-1 HIGH gaps on paper and both reviewers confirm the
    hard data-layer contracts (group-event heatmap unit, buckets() feed, backup portability
    policy, Up Next attention floor, migration 030) are now correct. THREE HIGHs remain, all
    verified on disk by the aggregator: (1) Plan 02 wires yourWeekPeriod into a NONEXISTENT
    KEY_TO_COLUMN instead of the live COLUMN_OF/WritableSettingsKey/AppSettingsRow/validate path
    — this breaks the DECIDED D-08 restore and D-09 toggle persistence (implementation defect in
    a decided item, not a decision re-raise); (2) Plan 06 drill-through mutates only one query
    axis, leaving the orthogonal axis stale so the drilled Contacts list can be empty/narrowed
    and desynced from the Digest preview/count (partially-resolved cycle-1 HIGH); (3) Plan 07 is
    marked autonomous:true while its owner-confirmation precondition must HALT. No owner-escalation
    trigger: D-08/D-09 are implemented per the owner's ruling (only their implementation is
    flagged), and no plan deletes/weakens/inverts an ADR/HANDOFF/dossier decision.
---

# Cross-AI Plan Review — Phase 38: Digest & Navigation Restructure (Convergence Cycle 2)

## Consensus Summary

Two independent reviewers assessed the 7-plan / 4-wave set after the cycle-1 revision (commits
6fd031c + 929f687). Both agree cycle 2 is a strong, disciplined response: **codex** rated it
**HIGH until three blockers are fixed, MEDIUM after**; the **read-only Claude subagent** rated it
**LOW–MEDIUM**. Both verified, against the code on disk, that the hardest cycle-1 data-layer
contracts are now genuinely resolved — the group-event heatmap-saturation unit (Plan 02 Task 4),
the `buckets()` feed mismatch (Plan 05 builds the `{d,n}` Map directly, avoiding `buckets()`), the
Up Next attention floor (Plan 03 reuses the canonical `dashboard-query-logic.ts:173` predicate
verbatim), migration 030 numbering + `TARGET_VERSION` repoint, and the backup-portability *policy*
for `yourWeekPeriod` (emit + allowlist + `FORWARD_MIGRATIONS[6]` + format bump 6→7, per owner
ruling D-08). The navigation gaps (`RecentlyDeleted` registration, `linking.ts:67` share-intent
deep link, stale `DashboardStackParamList` entries with correct wave ordering, Events relabel) are
each owned. **D-08 and D-09 are implemented per the owner's ruling and are NOT re-raised** — only
their concrete implementation is examined.

The divergence between the two reviews is real and the aggregator adjudicated it against disk. The
Claude subagent verified the *backup emission policy* and rated the whole phase LOW–MEDIUM, but it
did **not** trace the generic settings-**writer** path or the Plan 07 autonomy flag — exactly the
two places codex went deeper. On both, disk confirms codex.

**Aggregator verification of the disputed / load-bearing findings (evidence on disk):**

1. **Plan 02 writer wiring is broken (codex HIGH — CONFIRMED).** Plan 02 Task 2 instructs adding
   `your_week_period` to a `KEY_TO_COLUMN` map (38-02-PLAN.md:153,173). **There is no
   `KEY_TO_COLUMN` in the live DAO.** The generic writer iterates `Object.keys(COLUMN_OF)`
   (`src/db/app-settings-dao.ts:1486`), so a writable key must appear in `WritableSettingsKey`
   (`:531`), `AppSettingsRow` (`:587`), and `COLUMN_OF` (`:692`), and restore-originated values are
   validated in `validateAppSettingsPatch` (`:1270`) — restore casts external JSON to
   `AppSettingsPatch` at `src/backup/restore-apply.ts:1592`. As written, the executor would follow
   a citation to a symbol that does not exist and never wire the column — so `updateAppSettings`
   would silently never persist `your_week_period`, breaking BOTH the decided D-09 toggle/Settings
   row and the decided D-08 restore. This is an implementation defect in a decided item, which the
   review charter says to flag; it is **not** a decision re-raise.

2. **Plan 06 drill-through leaves a stale query axis (codex HIGH / Claude MEDIUM — CONFIRMED).**
   `setPopulations` writes only `dashboardPopulations` and `setFilters` writes only
   `dashboardFilters` (`src/stores/dashboard-query-store.ts:92-111`); neither clears the other, and
   the Contacts WHERE is `population AND filter` (`src/logic/dashboard-query-logic.ts:103-104,280`).
   Plan 06 sets Never Contacted → `setPopulations(['not-contacted'])` only and Overlooked →
   `setFilters({'needs-attention':['on']})` only (38-06-PLAN.md:135). With a pre-existing persisted
   filter, the Never Contacted drill yields `not-contacted AND needs-attention` = empty
   (`not-contacted` is `last_contact IS NULL`, `needs-attention` requires `last_contact IS NOT
   NULL`), while the Digest preview (fetched with `filters:{}`) and `countNeverContacted` still show
   N — a visible desync. The cycle-1 "define the state boundary" HIGH is only **partially**
   resolved: the plan now writes state but only half of it.

3. **Plan 07 autonomy contradicts its own precondition (codex HIGH — CONFIRMED).** Frontmatter is
   `autonomous: true` (38-07-PLAN.md:10), while `user_setup` (:12-17) and the Task 2
   `<precondition>` (:107) require the owner to confirm package name, Metro tmux session, and a
   single authorized target, and to **HALT if unconfirmed**. An autonomous executor cannot satisfy
   that owner interaction. The cycle-1 "lacks first-use confirmation" HIGH was addressed in the task
   text but re-opened by the unchanged autonomy flag.

4. **D-08 backup *policy* is implemented correctly (both reviewers — CONFIRMED, NOT a concern).**
   `getPortableSettingsSnapshot` now emits the formerly-deferred keys (`history_lens`,
   `history_cycle_count`) in its SELECT (`src/db/app-settings-dao.ts:960`) and return map (`:1013`),
   so the "emission-deferred" precedent is genuinely spent; `parseBackupManifest` hard-fails on a
   missing `FORWARD_MIGRATIONS[from]` (`src/backup/backup-schema.ts:989-996`), so Plan 02's
   `FORWARD_MIGRATIONS[6]` step is mandatory and correct. `BACKUP_FORMAT_VERSION = 6`
   (`src/backup/types.ts:14`) → 7 is coherent. The remaining Plan 02 defect is the *writer* wiring
   (finding 1), not the emission/format policy.

Both reviewers received the source-grounding prompt and cited `file:line` evidence, so no
diff-only caveat applies.

### Agreed Strengths
- **Migration 030 is correctly grounded and gated.** Additive `ALTER TABLE app_settings ADD COLUMN
  your_week_period TEXT NOT NULL DEFAULT 'rolling7' CHECK(...)`, forward-only, head verified
  `029→030` with `TARGET_VERSION` repointed to the new head constant (`src/db/database.ts:67`),
  proven through the full migration runner from a v1 fixture, gated by a one-way-door checkpoint.
- **Group-event activity-unit contract resolves the cycle-1 heatmap saturation.** One
  `group_events` parent + one child interaction per participant (`group-events-dao.ts:340`); Plan 02
  splits headline Interactions (include children) from the deduped activity unit (standalone +
  distinct group event), with an N-participant→1-unit regression test.
- **`buckets()` feed mismatch eliminated** — Plan 05 builds the date→count Map directly from
  `{d,n}` rows instead of routing aggregates through `buckets()` (which increments once per row,
  `src/services/history/buckets.ts:52-69`).
- **Up Next attention floor makes the empty state reachable** — reuses the canonical
  `PROGRESS_SQL >= STABLE_MAX AND (snooze cleared)` predicate (`dashboard-query-logic.ts:173`) plus
  `STATUS_CADENCE_PRECONDITION`; all-stable→empty and snoozed-excluded tests specified.
- **Backup-portability policy + `FORWARD_MIGRATIONS[6]`** correctly follow the landed Phase 36
  emit-and-bump mechanism (D-08).
- **Navigation surgery is sound** — `DashboardTab` id preserved (FAB hardcodes it,
  `universal-fab-logic.ts:82-104`), `RecentlyDeleted` registered, `linking.ts:67` repointed to
  Settings→Backup, stale `Digest`/`GroupEvents` param entries retained in wave 1 and removed in
  Plan 04 wave 2 after all referencers repoint, no orphaned type consumer breaks.
- **firstWeekday off-by-one closed** — mandatory documented `firstWeekday - 1` conversion (Expo
  1-based vs `getDay()` 0-based) with a Monday-first test.
- **Local-first / theme / date discipline held** — async on-device reads, no read-path network,
  `check:colors` + `tsc` gated, `formatLocalDate` over `toISOString`, static Your Week surface.

### Agreed Concerns (highest priority)
- **Plan 06 Horizon drill-through is only half-wired** (both reviewers). Sets one query axis and
  leaves the other stale; can empty/narrow the drilled Contacts list and desync it from the Digest
  preview/count. Codex HIGH, Claude MEDIUM-but-"blocking-for-close." Aggregator: treat as blocking.
- **Group-event aggregation still under-specifies the archived-participant rule** (codex). Does an
  event with all participants archived count as an activity unit? Undefined across metric / date
  count / day detail.
- **Plan 07 execution protocol** — the failed-gate repair loop is procedurally ambiguous in a
  sequential executor (both the autonomy contradiction above and the "hand back to the owning plan"
  wording).

### Divergent Views (aggregator-adjudicated)
- **Overall severity:** codex HIGH-until-fixed vs Claude LOW–MEDIUM. Given three disk-confirmed
  HIGHs, the aggregator sides with codex that the phase is blocking until they are fixed, while
  agreeing with the Claude subagent that the architecture and data-layer *reasoning* are sound.
- **Plan 02 writer wiring:** codex HIGH vs Claude silent ("implemented correctly"). Disk confirms
  codex — the Claude subagent verified the emission/format policy but not the writer path
  (`COLUMN_OF`/`WritableSettingsKey`/`validateAppSettingsPatch`). The diff-scoped miss CLAUDE.md
  warns about.
- **Plan 07 autonomy:** codex HIGH vs Claude silent. Disk confirms codex (`autonomous: true` vs a
  must-halt precondition).
- **Drill-through severity:** codex HIGH vs Claude MEDIUM. Both agree it must be fixed before close;
  counted as an unresolved HIGH (partially-resolved cycle-1 HIGH, fix not verified complete).

### OWNER-ESCALATION triggers
**None.** D-08 and D-09 are implemented per the owner's rulings (only their implementation is
flagged, per the review charter). No new finding deletes, weakens, or inverts an ADR / HANDOFF /
dossier decision — D-02's "no persisted Digest snapshot/cache" is respected (`yourWeekPeriod` is an
`app_settings` preference, not a Digest cache). One MEDIUM notes the reverse pathology: Plan 02's
checkpoint **re-asks** the already-settled D-08 decision (drip-feeding a decided item back to the
owner) and should be downgraded to a non-decision verification gate.

---

## Codex Review

*Model: gpt-5.6-sol (reasoning=low). Source-grounded, repo access confirmed; `file:line` citations
spot-checked accurate by the aggregator on all three HIGHs.*

# Summary

Cycle 2 is substantially improved: most cycle-1 defects are now explicitly owned, tested, and sequenced. The navigation promotion, portable preference decision, group-event heatmap semantics, Settings placement, notification routing, and device-UAT evidence model are much clearer.

The plans are not yet convergence-ready. I found three blocking issues:

1. Plan 02 does not fully wire `yourWeekPeriod` into the actual generic settings writer.
2. Plan 06’s drill-through preserves stale query axes, so it can open the wrong Contacts result set.
3. Plan 07 remains marked autonomous despite an explicit owner-confirmation prerequisite.

There are also two medium plan-quality issues: Plan 02 reopens a settled D-08 decision via a blocking checkpoint, and Plan 05 does not prohibit interaction with future Calendar Week cells.

Overall risk: **HIGH until the three blockers are corrected; MEDIUM afterward.**

---

# Plan 01 — Five-tab shell and semantic routing

## Summary

Plan 01 is well grounded and correctly sequences the shell transition. It addresses the important cycle-1 navigation omissions without prematurely removing the old notification route types.

## Strengths

- Preserving the internal `DashboardTab` identifier is correct. FAB destinations currently hardcode it for Create, Group Log, Log Contact, Update Contact, and Memory in `src/components/universal-fab-logic.ts:82-104`.
- Keeping the old `Digest` and `GroupEvents` param entries temporarily is a sound wave-order decision. The current digest notification still produces `[Home, Digest]` at `src/services/notifications/notification-nav.ts:76-92`, and the gate converts that through `resetToDashboardWith` at `src/navigation/notification-gate.tsx:129-152`.
- Repointing the shared-backup link to Settings is correct because the Settings stack actually registers the canonical Backup screen at `src/navigation/tabs/SettingsStack.tsx:202-207`.
- The plan now accounts for Profile-reachable routes instead of merely adding `Profile`. Existing stacks demonstrate why this is necessary: the Orrery stack contract includes `RecentlyDeleted`, history routes, Group Event routes, Compose, photo cropping, and merge routes at `src/navigation/types.ts:165-213`.
- The user-facing Events relabel is appropriately scoped. It does not propose renaming internal `GroupEvent` route or table identities.

## Concerns

No blocking source-grounded concern found.

### LOW — `focused-route-classification.ts` remains a likely verification-only task

The plan already acknowledges this. Keep it explicitly no-op if the current classifier does not hide these roots; do not manufacture churn merely to satisfy the file list.

## Suggestions

- In the navigation mount test, exercise one route reachable through Profile, such as `RecentlyDeleted`, in each new stack. Type completeness alone does not prove matching `Stack.Screen` registration.
- Update stale comments in `src/navigation/types.ts:147-153` and `src/navigation/types.ts:256-262` when their old Dashboard/Backup-tab descriptions cease to be true. This is documentation synchronization, not repository-wide terminology cleanup.

## Risk Assessment

**LOW.** The route promotion is invasive, but the plan now protects the important route identities and defers stale type removal until the notification transition is complete.

---

# Plan 02 — Your Week data, migration, settings, and backup v7

## Summary

The aggregation and backup design is much stronger than cycle 1, especially the explicit distinction between headline interaction counts and deduplicated activity units. However, the settings-writer instructions omit required pieces of the live DAO contract, which can make both toggles and restore fail at runtime.

## Strengths

- Migration 030 is the correct next schema version. The registered chain currently ends at migration 029 and `TARGET_VERSION` points to its constant at `src/db/database.ts:48-55` and `src/db/database.ts:67-100`.
- The portable-setting decision now follows the landed backup mechanism:
  - `BACKUP_FORMAT_VERSION` is currently 6 at `src/backup/types.ts:14`.
  - The parser requires an entry for every intermediate version at `src/backup/backup-schema.ts:987-1000`.
  - The current registry ends with `5 → 6` at `src/backup/backup-schema.ts:105-128`.
  - Therefore the proposed `FORWARD_MIGRATIONS[6]` is necessary and correct.
- D-08 is implemented conceptually correctly: emit the field, allowlist it, bump the format, and add a forward migration. The live snapshot already emits formerly deferred fields such as history preferences at `src/db/app-settings-dao.ts:925-969` and `src/db/app-settings-dao.ts:1013-1021`.
- The group-event activity-unit distinction is justified by the schema. A group event has one parent and one linked interaction per participant through `group_event_id` and the unique participant index at `src/db/migrations/026-group-events-schema.ts:18-39`.
- Building the heatmap map directly from `{d,n}` correctly avoids `buckets()`, which increments once per input row at `src/services/history/buckets.ts:52-69`.
- Testing a full migration jump is appropriate. The authoritative registered-chain test uses `MIGRATIONS`, `TARGET_VERSION`, and the real runner at `src/db/migrations/full-chain.test.ts:15-22`.

## Concerns

### HIGH — Task 2 does not completely add `yourWeekPeriod` to the generic writer

The plan says to add the field to `AppSettings`, `PortableSettingsSnapshot`, and a `KEY_TO_COLUMN` mapping. There is no `KEY_TO_COLUMN` in the live DAO; the actual writer contract has four separate pieces:

- `WritableSettingsKey` at `src/db/app-settings-dao.ts:531-584`
- `AppSettingsRow` at `src/db/app-settings-dao.ts:586-656`
- `COLUMN_OF` at `src/db/app-settings-dao.ts:687-746`
- `validateAppSettingsPatch` at `src/db/app-settings-dao.ts:1270-1395`

The plan explicitly names only a nonexistent `KEY_TO_COLUMN` and never requires:

- `yourWeekPeriod` in `WritableSettingsKey`,
- `your_week_period` in `AppSettingsRow`,
- `yourWeekPeriod: "your_week_period"` in `COLUMN_OF`,
- a runtime enum validator for restore-originated data.

This is not just typing hygiene. Restore casts manifest entries to `AppSettingsPatch` at `src/backup/restore-apply.ts:1588-1596`, so external JSON bypasses compile-time union safety. Without the actual mapping, the generic writer can construct an invalid column assignment; without DAO validation, malformed format-7 input is deferred to SQLite’s constraint instead of being rejected at the intended boundary.

### MEDIUM — The checkpoint reopens settled owner decision D-08

The blocking checkpoint offers “proceed or hold” after D-08 has already decided portability and format 7. That conflicts with the repository instruction not to drip-feed settled decisions back to the owner.

A migration safety checkpoint could confirm the exact SQL and wire diff, but it should not ask whether to implement the already-ratified decision.

### MEDIUM — “Archived contacts are excluded everywhere” is under-specified for group-event parents

`group_events` has no archived state or direct contact identity at `src/db/migrations/026-group-events-schema.ts:18-29`. The plan says archived contacts are excluded everywhere, while also defining an event as one parent-level activity unit. It must say whether a group event:

- always counts, regardless of current participant archival state, or
- counts only if at least one linked participant is currently non-archived.

Without that definition, metrics, date counts, and day detail may implement different inclusion rules.

## Suggestions

Revise Task 2 to require all of:

```text
- Add YourWeekPeriod validator.
- Add yourWeekPeriod to WritableSettingsKey.
- Add your_week_period to AppSettingsRow.
- Add yourWeekPeriod: "your_week_period" to COLUMN_OF.
- Invoke the validator from validateAppSettingsPatch.
- Test malformed restore input as well as direct invalid writes.
```

Replace the decision checkpoint with a non-decision verification gate: confirm migration number 030, exact additive SQL, format 7, `FORWARD_MIGRATIONS[6]`, and no unrelated schema/wire expansion.

Define one explicit archived-participant rule and test it across metrics, date counts, and day detail.

## Risk Assessment

**HIGH.** A missing writer mapping would break both D-09 UI surfaces and D-08 restore portability. The schema and backup architecture are otherwise sound.

---

# Plan 03 — Up Next and Horizon composition

## Summary

Plan 03 now resolves the main cycle-1 issue: Up Next is a true attention population rather than all tracked contacts. The canonical predicate and deterministic pure composition are well chosen.

## Strengths

- The attention threshold is correctly shared from `STABLE_MAX = 0.8` at `src/db/status.ts:35-42`.
- The plan preserves the required status precondition documented at `src/db/status.ts:53-64`.
- `STATUS_SQL` and `REASON_SQL` are kept canonical rather than reimplemented; their bucket and reason behavior is defined at `src/db/status.ts:72-78` and `src/db/status.ts:100-104`.
- Snooze exclusion matches the intended attention-filter semantics rather than inventing Digest-local logic.
- Up Next remains uncapped at the DAO seam, allowing composition to select three and deduplicate Horizon correctly.
- The 7-day birthday filter correctly avoids the existing 30-day dashboard population. The live dashboard resolver explicitly uses `days <= 30` at `src/db/dashboard-read.ts:292-307`.
- Equal-day birthday ordering now has deterministic name/id tie-breaks.

## Concerns

### LOW — The “why-present” value is nullable for wobble/decay candidates

`REASON_SQL` only names rogue branches; non-rogue wobble and decay rows return `NULL` at `src/db/status.ts:96-104`. Up Next includes everything at or above `STABLE_MAX`, so the presentation plan must derive explanatory copy from canonical `status` when `reason` is null.

Plan 06 mentions canonical reason/status, which mostly closes this, but a direct test should pin wobble and decay copy.

## Suggestions

- Add a composition or presentation test for all canonical statuses:
  - wobble → approaching/due-soon copy,
  - decay → overdue copy based on status,
  - rogue + overdue reason,
  - rogue + unresponsive reason.
- Keep copy derivation separate from selection logic so changing prose cannot alter population membership.

## Risk Assessment

**LOW.** The primary population and dedup semantics are now correct and testable.

---

# Plan 04 — Notification routing, Contacts cleanup, and FAB audit

## Summary

Plan 04 correctly handles the semantic fallout of promoting Digest and Events. It now covers the notification route, stale Dashboard routes, the live overflow action, and FAB context.

## Strengths

- A distinct digest intent is appropriate because the current intent union hardcodes a Dashboard-stack reset at `src/services/notifications/notification-nav.ts:31-52`.
- The gate’s stale-request guard is real and worth preserving:
  - request IDs are assigned at `src/navigation/notification-gate.tsx:174-176` and `src/navigation/notification-gate.tsx:199-216`;
  - application rechecks `isCurrent()` before navigating at `src/navigation/notification-gate.tsx:129-151`.
- Repointing the overflow action is necessary. It currently calls `navigation.navigate("GroupEvents")` at `src/screens/dashboard-overflow-actions.ts:20-29`; once DashboardStack stops registering the screen, that becomes a live runtime failure.
- Removing stale Dashboard param entries after repointing callers closes a genuine “typechecks but crashes” hazard.
- Extending FAB context to Digest and Events is justified. The current recognizer accepts only `DashboardTab` and `OrreryTab` at `src/components/universal-fab-logic.ts:135-160`.
- The plan correctly preserves `DashboardTab` as the FAB destination at `src/components/universal-fab-logic.ts:82-104`.

## Concerns

No blocking source-grounded concern found.

### LOW — Cross-tab overflow typing needs the parent navigator shape, not merely a widened string union

The live overflow interface accepts a single stack-route argument at `src/screens/dashboard-overflow-actions.ts:3-6`. `navigate("EventsTab", {screen: "GroupEvents"})` requires either a correctly typed parent/tab navigation callback or a dedicated action callback. Simply widening the existing route union will not model the second parameter.

## Suggestions

Prefer a callback-oriented interface:

```ts
interface DashboardOverflowNavigation {
  openEvents(): void;
  navigateLocal(route: "UnboundContacts" | "Archived"): void;
}
```

That keeps cross-tab behavior out of the pure action builder and avoids weakening route typing.

## Risk Assessment

**LOW.** The important concurrency and dead-route hazards are now explicitly covered.

---

# Plan 05 — Your Week presentation and Settings row

## Summary

Plan 05 correctly implements D-09 and fixes the cycle-1 heatmap feed mismatch. The remaining gap is future-day behavior in Calendar Week.

## Strengths

- D-09 is now implemented with a true single source of truth: both surfaces use the same `app_settings` field and DAO writer.
- `SettingsInteractionsScreen` is a reasonable existing home. It already reads settings on focus at `src/screens/SettingsInteractionsScreen.tsx:57-71` and persists generic settings through `updateAppSettings` at `src/screens/SettingsInteractionsScreen.tsx:73-89`.
- The direct `{d,n}` map construction is correct because `buckets()` expects raw `{occurredAt}` rows and increments per row at `src/services/history/buckets.ts:17-21` and `src/services/history/buckets.ts:52-69`.
- Reusing `classifyHeatmapCell` and `heatmapLevel` preserves the established saturation semantics at `src/components/history/heatmap-cell.ts:39-47`.
- The plan correctly avoids reusing the full `ActivityHeatmap` chrome.
- Structural selection plus `accessibilityState.selected` addresses the color-independent selection requirement.
- Stale-read generation guarding and write-failure rollback materially improve the period toggle.

## Concerns

### MEDIUM — Future Calendar Week cells are not required to be non-interactive

The planned Calendar Week window contains all seven days and marks dates after today with `isFuture: true`. The existing heatmap treats future cells as inaccessible, non-interactive blanks at `src/components/history/ActivityHeatmap.tsx:196-211`.

Plan 05 instead says “each real cell” is a touch target and does not instruct `YourWeekHeatmap` to exclude `isFuture`. That could allow selecting future dates and opening meaningless empty day detail.

### LOW — The must-have/key-link language still says it reuses `buckets()`

The implementation correctly forbids calling `buckets()` on aggregate rows, but the artifact and key-link descriptions still claim `buckets()` reuse. That contradiction could mislead an executor.

## Suggestions

- Require `cell.isFuture` to render as a non-interactive structural blank, matching `ActivityHeatmap`.
- Add a test proving future Calendar Week cells have no button role and cannot call `onSelectDay`.
- Remove `buckets()` from Plan 05’s key-link and artifact descriptions; say it reuses `heatmapLevel`, `classifyHeatmapCell`, and `heatmapScale`.

## Risk Assessment

**MEDIUM.** The core presentation model is correct, but future-day behavior should be pinned before implementation.

---

# Plan 06 — Digest assembly

## Summary

Plan 06 has good module composition, loading/error semantics, and real preview-row sourcing. Its drill-through contract is still incorrect because it updates only one query axis and leaves stale filters or populations active.

## Strengths

- The Never Contacted preview now has an actual row source. `countNeverContacted` is only a count, while `listDashboardPopulation` returns full `DashboardRow[]` at `src/db/dashboard-read.ts:380-410`.
- The plan correctly mutates the persisted Zustand/SQLite query state before navigation. Store setters persist through `updateAppSettings` at `src/stores/dashboard-query-store.ts:92-110`.
- Using the canonical `not-contacted` population and `needs-attention` filter is grounded in the live closed vocabularies at `src/logic/dashboard-query-logic.ts:5-22` and `src/logic/dashboard-query-logic.ts:69-70`.
- Removing the old Digest Back affordance is correct for a tab root.
- Separating read loading/error state from presentation avoids empty-state flashes.
- The screen’s responsibility for passing selected Up Next IDs into Horizon makes dedup explicit and testable.

## Concerns

### HIGH — Drill-through preserves stale query axes and may open the wrong list

The plan specifies:

- Never Contacted: call `setPopulations(['not-contacted'])`
- Overlooked: call `setFilters({'needs-attention':['on']})`

But the store setters only replace their own axis:

- `setPopulations` leaves `filters` unchanged at `src/stores/dashboard-query-store.ts:92-99`.
- `setFilters` leaves `populations` unchanged at `src/stores/dashboard-query-store.ts:100-110`.

Dashboard population and filters are then AND-composed at `src/db/dashboard-read.ts:380-406`.

Consequences:

- Never Contacted drill-through can retain an old category, gravity, or attention filter.
- Overlooked drill-through can retain an old birthdays, favourites, or not-contacted population.
- The resulting Contacts list may be empty or materially different from the requested canonical target.

This means the cycle-1 “mutate the real state boundary” finding is only partially resolved.

### MEDIUM — The plan describes a capped DAO read, but `listDashboardPopulation` has no cap argument

The live signature is `(exec, query, now)` and returns the entire filtered result at `src/db/dashboard-read.ts:380-410`. The plan can still create a compact preview by slicing after the read, but it should not claim the database read itself is capped unless it adds a dedicated bounded query.

## Suggestions

Define atomic query-state helpers for these destinations, for example:

```ts
openNeverContacted:
  populations = ["not-contacted"]
  filters = {}
  sort = "default"

openNeedsAttention:
  populations = []
  filters = { "needs-attention": ["on"] }
  sort = "default"
```

Prefer one store method that persists all relevant axes in one `updateAppSettings` transaction, rather than sequential setters that can briefly expose mixed state.

Behavioral tests should start from deliberately conflicting prior state and verify the final complete query state, not only the changed axis.

Clarify whether preview rows are fetched fully and sliced, or add a legitimate bounded read if dataset size warrants it.

## Risk Assessment

**HIGH.** The current drill-through can visibly fail a core Phase 38 acceptance criterion.

---

# Plan 07 — Regression gate and physical-device UAT

## Summary

The verification content is markedly better than cycle 1: it requires behavioral rendering, reproducible metadata, fixtures, and PASS/FAIL/BLOCKED outcomes. The execution metadata still contradicts the required owner precondition.

## Strengths

- Rendering `RootNavigator` is materially stronger than source scanning or importing erased `TabParamList` types.
- Runtime `TAB_ICON` key assertions are appropriate because the current map is intentionally typed to the tab param keys.
- The plan correctly distinguishes Vitest, TypeScript, and color gates.
- PASS/FAIL/BLOCKED avoids falsely inferring success from a rendered screen.
- The disposable fixture requirements cover the otherwise untestable non-empty states: Never Contacted, multi-participant Group Event, notification routing, week activity, and both themes.
- Recording SHA, package, serial, API level, theme, and fixture identity makes the UAT reproducible.
- The repair loop now routes failures back to the owning plan rather than blind-patching cross-cutting code.

## Concerns

### HIGH — The plan is marked autonomous despite a blocking owner-confirmation precondition

Frontmatter says `autonomous: true`, while `user_setup` and Task 2 require the owner to confirm:

- package name,
- Metro tmux session,
- exactly one authorized target.

Task 2 says execution must halt if this is unconfirmed. An autonomous executor cannot satisfy that owner interaction safely. This is especially important because the repository device instructions explicitly prohibit guessing these values.

### MEDIUM — Plan 07’s feature-code repair loop is procedurally ambiguous

It says Plan 07 modifies only the test and validation file, while defects are handed back to “the owning plan.” In a sequential execution system, already-completed plans may not literally resume themselves. The intended behavior should be stated as:

- stop Plan 07,
- record the owning plan and defect,
- execute a scoped fix under that plan’s verification contract,
- rerun the full phase gate,
- then resume UAT.

## Suggestions

- Set `autonomous: false`.
- Add an explicit blocking human checkpoint before any ADB/build command.
- Make Task 1 autonomous and Task 2 checkpoint-gated.
- Correct the objective’s output filename from `shell-contract.test.ts` to the actual planned `shell-contract.test.tsx`.
- Require offline mode during at least one Digest read-path check, consistent with the local-first acceptance condition.

## Risk Assessment

**HIGH operationally.** The verification design is good, but its current autonomy declaration can cause unsafe or impossible execution.

---

# Cycle-1 Finding Resolution Matrix

| Cycle-1 finding class | Cycle-2 status |
|---|---|
| New Digest/Events stacks omit `RecentlyDeleted` and other Profile-reachable routes | **Resolved** in Plan 01 with full route registration and traversal testing |
| Events root still displays “Group Events” | **Resolved** in Plan 01 through scoped user-facing relabeling |
| Shared-backup deep link targets removed `BackupTab` | **Resolved** in Plan 01 by repointing to Settings → Backup |
| Stale Dashboard `Digest`/`GroupEvents` entries and unsafe removal ordering | **Resolved** through Plan 01 retention followed by Plan 04 removal |
| D-08 portability/format-bump owner escalation | **Owner-resolved**, and Plan 02 conceptually implements format 7 correctly; **implementation remains incomplete** because the actual generic writer contract is not fully specified |
| Group Event saturates heatmap N times | **Resolved** by the parent-as-one-activity-unit definition and regression test |
| `{d,n}` aggregate rows incompatible with `buckets()` | **Resolved** by direct map construction; stale prose references to `buckets()` should be removed |
| Aggregation units conflated | **Resolved** by separating headline metrics from heatmap/day-detail activity units |
| Migration test does not prove long upgrade path | **Resolved in intent** with a real-runner fixture requirement |
| Locale `firstWeekday` off-by-one | **Resolved** with explicit 1-based → 0-based conversion and Monday test |
| Up Next includes stable contacts / empty state unreachable | **Resolved** through the canonical attention floor |
| Snoozed treatment undefined | **Resolved** through canonical active-snooze exclusion |
| Birthday tie ordering under-specified | **Resolved** with name/id tie-break |
| Notification stale-request guard may be lost | **Resolved** in Plan 04 with explicit preservation and tests |
| Wrong notification-gate test extension | **Resolved** by targeting the `.tsx` test |
| FAB context excludes Digest/Events Profile | **Resolved** in Plan 04 |
| Never Contacted has no row source | **Resolved** with `listDashboardPopulation` |
| Drill-through only navigates without setting Contacts state | **Partially resolved**: it now writes state, but fails to clear conflicting axes |
| Overlooked lacks an exact canonical population | **Resolved** through the canonical `needs-attention` filter |
| Settings placement of period preference | **Owner-resolved and correctly incorporated** in Plan 05 as two surfaces over one key |
| Rapid toggle stale reads | **Resolved** with generation/cancellation guard |
| Period write failure leaves UI divergent | **Resolved** with rollback requirement |
| Device UAT lacks owner-confirmed target | **Partially resolved** in task text, but contradicted by `autonomous: true` |
| Device UAT lacks fixtures/BLOCKED outcomes | **Resolved** |
| Shell contract test risks source scanning | **Resolved** through rendered navigator/runtime assertions |
| Verification plan has no repair path | **Resolved in intent**, with minor procedural clarification still needed |
| Validation template remains unfilled | **Resolved by explicit Plan 07 ownership** |

# Final Recommendation

Revise before execution:

1. Complete Plan 02’s live `app-settings-dao` writer contract and remove the redundant D-08 decision checkpoint.
2. Make Plan 06 drill-through atomically replace the full relevant Contacts query state.
3. Make Plan 07 non-autonomous with a real blocking owner checkpoint.
4. Pin future Calendar Week cells as non-interactive.
5. Clarify group-event inclusion when all participants are archived.

After those changes, the plan set should be suitable for another convergence check with an expected overall risk of **MEDIUM**.

---

## Claude Review

*Read-only general-purpose Claude subagent (Write-gap fallback per project MEMORY). Source-grounded;
repo access confirmed (27 tool calls, verified against disk). Overall: LOW–MEDIUM.*

> **Aggregator note:** This subagent verified the backup *emission/format policy* and the data-layer
> contracts thoroughly, but did **not** trace the generic settings-**writer** path
> (`COLUMN_OF`/`WritableSettingsKey`/`validateAppSettingsPatch`) or the Plan 07 `autonomous` flag.
> Codex did, and disk confirms codex on both. Treat codex's Plan 02 writer-wiring HIGH and Plan 07
> autonomy HIGH as authoritative; this subagent's "no new HIGH except drill-through" is otherwise
> corroborated.

### Summary

The 7 revised plans are a strong, disciplined response to cycle-1. Every disputed cycle-1 HIGH was
verified against the actual source and **all are genuinely resolved**: the group-event
heatmap-saturation contract is now a group-deduped activity-unit count (Plan 02 Task 4), the
`buckets()` feed mismatch is eliminated by building the date→count Map directly from `{d,n}` rows
(Plan 05 Task 3), the backup-portability decision is correctly implemented per owner ruling D-08
(Plan 02 Task 3, and the "emission-deferred" precedent is in fact spent), the Up Next attention
floor makes the empty state reachable (Plan 03 Task 1, predicate matches the canonical dashboard
filter verbatim), Never Contacted gets a real row source, the Settings row lands per D-09 with a
single source of truth, and the navigation gaps are each owned with correct wave ordering. D-08 and
D-09 are implemented correctly — no re-raise. The one **new** issue worth blocking on is the Horizon
drill-through: it now mutates the persisted Contacts query store (fixing the cycle-1 HIGH) but only
sets one query axis each, leaving the orthogonal axis stale in a way that can empty or narrow the
drilled list and desync it from the Digest preview/count. Everything else is LOW.

### Strengths (verified on disk)

- **D-08 premise confirmed correct.** `getPortableSettingsSnapshot` now emits the formerly-deferred
  keys — `history_lens, history_cycle_count` in the SELECT at `src/db/app-settings-dao.ts:960` and
  the return map at `:1013-1014`. So the cycle-1 "emission-deferred is stale" HIGH was right, and
  Plan 02's decision to follow the landed emit-and-bump policy rather than the comment pattern at
  `:435-489` is well-grounded.
- **The `FORWARD_MIGRATIONS[6]` requirement is real.** `parseBackupManifest` loops `from = version;
  from < MAX; from++` and hard-fails on a missing `FORWARD_MIGRATIONS[from]`
  (`src/backup/backup-schema.ts:989-996`); bumping `MAX_SUPPORTED` to 7 makes a `[6]` entry
  mandatory — Plan 02 Task 3 correctly provides it. Head verified: `BACKUP_FORMAT_VERSION = 6`
  (`src/backup/types.ts:14`), last forward migration `5→6` (`:127`).
- **Migration numbering is correct.** Head `029-ai-configuration.ts`,
  `TARGET_VERSION = AI_CONFIGURATION_SCHEMA_VERSION` (`src/db/database.ts:67`), no `030` on disk;
  additive `ALTER TABLE … ADD COLUMN … DEFAULT … CHECK` matches migration 029's posture exactly.
- **Up Next attention floor is the canonical predicate, verbatim** (`dashboard-query-logic.ts:173-175`
  `PROGRESS_SQL >= STABLE_MAX AND (snooze cleared)`), with `STATUS_CADENCE_PRECONDITION`
  (`status.ts:62-64`) guarding the NULL-progress hazard.
- **Group-event double-count seam is real and correctly handled** — `createGroupEvent` writes one
  parent + one child per participant (`src/db/group-events-dao.ts:340-373`); Plan 02's two-unit-family
  split resolves saturation with an N→1 regression test.
- **firstWeekday off-by-one correctly closed** — `getDay()` 0-based (`window.ts:74-76`) vs Expo
  1-based; Plan 02 mandates and documents `firstWeekday - 1` with a `firstWeekday=2 → Monday` test.
- **Navigation gaps all owned with sound wave ordering** — `linking.ts:67` repointed in wave 1; stale
  `DashboardStackParamList` `Digest`/`GroupEvents` entries retained in wave 1, removed in Plan 04
  wave 2 after all three referencers (`notification-nav.ts:43/91`, `HomeScreen.tsx:1656/1689`,
  `dashboard-overflow-actions.ts:28`) repoint; no orphaned type consumer breaks
  (`DigestScreen.tsx:79`/`GroupEventsScreen.tsx:34` typed via the intersection still resolve).
- **Referenced infrastructure all exists** — `SegmentedControl`, `ContactCard`, `heatmap-cell.ts`,
  `ActivityHeatmap`, `DateDetailSheet`, `listDashboardPopulation` (`dashboard-read.ts:380`),
  `countNeverContacted` (`:540`), `settings-interactions-logic.ts` + `SettingsInteractionsScreen`;
  Plan 06's `listDashboardPopulation` query shape matches `DashboardQueryState`.

### Concerns

**Cycle-1 status:** all 10 codex consolidated required-changes and all Claude MEDIUM/LOW items are
**RESOLVED** except drill-through, which is **partially resolved and introduces a new gap**.

- **MEDIUM (new this cycle) — Horizon drill-through mutates only one query axis; the stale orthogonal
  axis can empty/narrow the drilled list and desync it from the Digest preview/count.**
  `setPopulations` replaces populations only (`dashboard-query-store.ts:92-98`); `setFilters`
  replaces filters only (`:100-111`); final Contacts WHERE is `populationWhere AND filterWhere`
  (`dashboard-query-logic.ts:103-104,280`). Plan 06 sets Never Contacted → `setPopulations(['not-contacted'])`
  (leaves filters) and Overlooked → `setFilters({'needs-attention':['on']})` (leaves populations).
  If persisted `dashboardFilters` contains `needs-attention`, the Never Contacted drill yields
  `not-contacted AND needs-attention` = empty (`not-contacted` = `last_contact IS NULL`,
  `needs-attention` requires `last_contact IS NOT NULL`), while the preview (`filters:{}`) + count
  show N. Fix: set **both** axes explicitly, or call the existing `resetDashboardView`
  (`dashboard-query-logic.ts:285`) first, and make the preview/count use the same `filters:{}`
  semantics the drill lands on. *(Aggregator: codex rates this HIGH; counted as an unresolved HIGH.)*
- **LOW (new/carryover) — stale "emission deferred / Phase 36 scope" comments remain false** at
  `src/backup/backup-schema.ts:180-215` and `src/db/app-settings-dao.ts:435-489`, contradicting disk
  (`:960/:1013`). Plan 02 declines to *follow* them but does not *correct* them — the exact
  confident-but-false-comment landmine CLAUDE.md warns about. Suggest Plan 02 Task 3 delete/repoint
  them adjacent to the `yourWeekPeriod` emission.
- **LOW — Up Next "why-present" line has no reason for wobble/decay contacts.** `REASON_SQL` is
  non-null only for `rogue` (`status.ts:100-104`); a `progress ≥ STABLE_MAX` but `< ROGUE_K` row
  yields `reason = NULL`. The executor must fall back to `status` when `reason` is NULL or those
  rows render a blank context line. (Plan mentions status — a clarity nit.)
- **LOW — "capped read" wording for `listDashboardPopulation` is imprecise** — signature
  `(exec, query, now)` has no limit param (`dashboard-read.ts:380-383`); the cap is applied in JS via
  `previewWithOverflow(rows, cap)` after fetching the full set. Functionally fine; just note it reads
  all rows then slices.
- **LOW — minor line-cite drift in Plan 01** — cites the Events-root title at `:68/:72`; `title="Group
  Events"` is only at `:72`. The grep acceptance still works; cosmetic.

### Suggestions (each tied to a PLAN.md change)

- **Plan 06 Task 2 `<action>`/`<acceptance_criteria>` + drill-through truth:** set both axes — Never
  Contacted → `setPopulations(['not-contacted'])` **and** `setFilters({})`; Overlooked →
  `setPopulations(['all-contacts'])` **and** `setFilters({'needs-attention':['on']})` (or
  `resetDashboardView` then apply). Add a behavioral test that with a **pre-existing** persisted
  filter/population the drill still lands on the full intended set.
- **Plan 06 Task 3 `<action>`:** state the Never Contacted preview read and the drill use identical
  `filters:{}` semantics so count and drilled list agree.
- **Plan 02 Task 3 `<action>`:** correct (not just ignore) the now-false "emission deferred / Phase 36
  scope" comments at `backup-schema.ts:180-215` and `app-settings-dao.ts:435-489`.
- **Plan 06 Task 1 `<action>`:** make explicit that the why-present line falls back to `status`
  (wobble/decay) when `REASON_SQL` is NULL.

### Risk Assessment

**Overall: LOW–MEDIUM.** The data-layer contracts that made cycle-1 HIGH risk are correctly resolved
and verified against disk; the migration/backup one-way doors are gated, forward-only, and coherent;
the architecture is sound. The single item keeping it above LOW is the one-axis drill-through gap — a
real functional bug in a primary Horizon affordance, conditional on the user's persisted Contacts
state, with a small well-scoped fix. *(Aggregator addendum: plus the Plan 02 writer-wiring HIGH and
Plan 07 autonomy HIGH this subagent did not trace — see codex + the aggregator verification above.)*

**Owner-escalation check (subagent's own):** none triggered. D-08 and D-09 are implemented correctly
and not re-raised; no plan deletes/weakens/inverts an ADR/HANDOFF/dossier decision (D-02's "no
persisted Digest snapshot" is respected).

---

## How to incorporate this feedback

```
/gsd-plan-phase 38 --reviews
```

Treat the three verified HIGHs as blocking for cycle 3: (1) Plan 02 — wire `yourWeekPeriod` through
the real `COLUMN_OF`/`WritableSettingsKey`/`AppSettingsRow`/`validateAppSettingsPatch` contract, not
the nonexistent `KEY_TO_COLUMN`; (2) Plan 06 — make the drill-through set both query axes atomically
(and align the preview/count semantics); (3) Plan 07 — set `autonomous: false` (or gate Task 2 behind
a blocking human checkpoint). Fold the 11 actionable MEDIUM/LOW items into the owning plans. No owner
decision is pending — D-08 and D-09 are already ruled.
