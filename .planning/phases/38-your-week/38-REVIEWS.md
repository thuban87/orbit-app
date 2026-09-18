---
phase: 38
reviewers: [codex, claude]
reviewed_at: 2026-09-18T23:13:39Z
plans_reviewed: [38-01-PLAN.md, 38-02-PLAN.md, 38-03-PLAN.md, 38-04-PLAN.md, 38-05-PLAN.md, 38-06-PLAN.md, 38-07-PLAN.md]
models:
  codex: "gpt-5.6-sol (reasoning=low)"
  claude: "unknown (read-only Claude subagent — Write-gap fallback)"
models_sources:
  codex: "banner"
  claude: "subagent-fallback"
review_method_notes: >
  The built-in `claude` reviewer lane was NOT used: this run executes inside Claude Code
  (CLAUDE_CODE_ENTRYPOINT=cli), so the machinery skips its own lane for independence, and
  that lane is also the known Write-permission-gap hazard. Per the project's documented
  workaround, the Claude review was run as a READ-ONLY general-purpose subagent and its
  findings are aggregated here alongside the codex lane. The codex lane's first attempt was
  a transient "Selected model is at capacity" drop (empty stub); it was re-run and the
  second attempt returned a genuine source-grounded review.
cycle_summary:
  cycle: 1
  current_high: 10
  current_actionable: 16
  verdict: "Codex HIGH (blocking); Claude MEDIUM (low-leaning). Aggregator verified the three
    highest-stakes disputed HIGHs against disk and confirmed codex is correct on all three."
---

# Cross-AI Plan Review — Phase 38: Digest & Navigation Restructure

## Consensus Summary

Two independent reviewers assessed the 7-plan / 4-wave set. **Codex** rated the phase **HIGH
risk (blocking)** and raised ~10 HIGH concerns plus two owner-escalation flags. The **Claude
read-only subagent** rated it **MEDIUM (low-leaning)**, found **no** owner-escalation, and
surfaced three concrete MEDIUM items codex missed. The divergence is real, so the aggregator
opened the code on disk and verified the three highest-stakes disputed HIGHs. **All three
resolved in codex's favor** — the Claude subagent's more lenient read came from checking
comment blocks / reuse-intent rather than tracing the full data wiring and the live portable
projection (the diff-scoped miss CLAUDE.md warns about). The two reviews are complementary:
codex is stronger on data-layer contracts, the Claude subagent is stronger on the navigation
type-graph and the Backup-reachability deep link.

**Aggregator verification of the disputed HIGHs (evidence on disk):**

1. **Backup portability / "emission deferred" is stale (codex HIGH — CONFIRMED).** Codex says
   Plan 02's instruction to imitate the "declare optional, emission deferred" precedent is
   outdated; the Claude subagent said Plan 02 "correctly follows historyLens's still-deferred
   pattern." Disk settles it: `getPortableSettingsSnapshot` at `src/db/app-settings-dao.ts:888+`
   now includes `history_lens, history_cycle_count` in **both** its SELECT (~960) and its return
   map (~1013). Phase 36 already emitted the formerly-deferred keys; the "DEFERRED to Phase 36"
   comments at `:438-479` describe a state that no longer exists. Whether `yourWeekPeriod` is
   portable (and whether that needs a `BACKUP_FORMAT_VERSION` bump from the current 6 at
   `src/backup/types.ts:14`) is therefore a live wire-shape/risk decision the plan cannot settle
   by citing stale comments. **This is an OWNER decision (backup/risk posture).**

2. **Group-event heatmap saturation (codex HIGH — CONFIRMED).** Plan 02's group-event dedup
   ("ONE record") is explicitly scoped to the **Events metric** and **day detail** only
   (38-02-PLAN.md:26, :183, :187). The heatmap feed `readYourWeekDateCounts` (38-02-PLAN.md:182)
   counts qualifying `interactions` rows **including group-linked children** (:58, :181), so an
   N-participant Group Event saturates the heatmap cell N-fold while its day detail shows one
   record — an unresolved unit mismatch. The Claude subagent asserted this path was handled; it
   is not.

3. **`buckets()` feed-contract incompatibility (codex HIGH — CONFIRMED).** `buckets(window,
   interactions)` at `src/services/history/buckets.ts:52-70` takes an array of `{occurredAt}`
   records and increments each cell **once per row**. Plan 02 returns `{d, n}` aggregate rows and
   Plan 05 says the heatmap is "fed by `buckets()` over the date→count rows" (38-05-PLAN.md:143;
   38-02-PLAN.md:182). Feeding `{d, n}` through `buckets()` cannot preserve `n` — it either fails
   tsc (no `occurredAt`) or collapses every active date to a count of 1. Real data-wiring bug.

CodeRabbit-style diff-only caveats do not apply — both reviewers received the source-grounding
prompt and cited `file:line` evidence.

### Agreed Strengths
- **Internal `DashboardTab` id is preserved as the linchpin** — both note the FAB and
  notification reset hardcode it (`src/components/universal-fab-logic.ts`, `RootNavigator.tsx:91`),
  so keeping the id avoids a cascade of breakage.
- **Migration 030 is correctly grounded and gated** — additive `ADD COLUMN … DEFAULT … CHECK`,
  forward-only, head verified `029→030` at `src/db/database.ts:67`, `checkpoint:decision`
  one-way-door gate, no shipped-migration edit.
- **Reuse discipline is real, not asserted** — Up Next reuses the canonical status engine
  (`src/db/status.ts`), the heatmap reuses the helpers rather than the forbidden `ActivityHeatmap`
  chrome, and Backup & Restore genuinely survives Backup-tab removal via the Settings stack.
- **Local-first / theme / date discipline held throughout** — async on-device reads, no network
  on any read path, `check:colors` gated, `formatLocalDate` over `toISOString`, static Your Week
  surface (no animation-from-state).

### Agreed Concerns (highest priority)
- **Group-event aggregation semantics are under-specified across metrics, day detail, and the
  heatmap** — both reviewers flag it; codex is more precise that the heatmap date-count is a third,
  un-deduped path.
- **The period preference is placed in-context, not in a Settings row** — both note dossier §I
  ("put the preference in Settings"); the plan reads §I as the persistence path and places the
  toggle in-context, **and already surfaces this to the owner as a held decision** (38-05-PLAN.md:52).
  See owner-escalation note below.
- **User-facing "Group Events" terminology remains after the "Events" relabel** — `GroupEventsScreen`
  still renders `title="Group Events"`; no plan owns the string change.

### Divergent Views (aggregator-adjudicated)
- **Overall severity:** codex HIGH / blocking vs Claude MEDIUM. Given the three confirmed
  data-layer HIGHs, the aggregator sides with codex that the data-layer contracts are blocking,
  while agreeing with the Claude subagent that the navigation surgery itself is architecturally
  sound.
- **Backup portability:** codex (escalate) vs Claude (fine, format stays 6). Disk confirms codex.
- **Heatmap / `buckets()` wiring:** codex (broken) vs Claude (correct). Disk confirms codex.
- **Navigation completeness:** the Claude subagent uniquely caught the `linking.ts:67`
  `navigate("BackupTab", …)` share-intent deep link (a data-recovery path) and the stale
  `DashboardStackParamList` `Digest`/`GroupEvents` entries with their wave-ordering constraint;
  codex uniquely caught the omitted `RecentlyDeleted` route in the new stacks. These are three
  distinct, all-real navigation gaps — treat them as a union, not alternatives.

### OWNER-ESCALATION triggers (do NOT silently close)
Per CLAUDE.md, these are the owner's call (risk/backup posture, or a recorded-decision tension),
not planner discretion:

- **[ESCALATE] Backup portability of `yourWeekPeriod` (Plan 02).** The "emission deferred"
  precedent is spent (verified above). The owner must decide: (a) portable + format bump to 7;
  (b) portable as an optional field under an explicitly compatible format policy; or (c)
  deliberately device-local and omitted. This is a backup/wire-shape/risk decision.
- **[ESCALATE — already surfaced by the plan] Period preference omitted from a Settings row
  (Plan 05, dossier §I).** CONTEXT.md:72-73 states Phase 37 Settings "hosts the Your Week period
  preference (§I)," yet Plan 05 places it only as the in-context toggle citing D-03 (no broad
  Settings restructuring) and **explicitly flags it as a held owner decision** (38-05-PLAN.md:52).
  This is the owner's product call, not a silent reversal — but it must be answered before close,
  and the aggregator is naming it by name here rather than closing it.

---

## Codex Review

*Model: gpt-5.6-sol (reasoning=low). Source-grounded, repo access confirmed (extensive `file:line`
citations verified accurate on the disputed points).*

# Cross-AI Plan Review — Phase 38

## Overall assessment

The plans are unusually thorough and broadly align with the dossier, especially around local-first reads, canonical status reuse, migration discipline, notification routing, and physical-device verification. However, several cross-plan contract mismatches would prevent the phase from fully satisfying the settled product decisions. The most important are:

- Your Week heatmap counting conflicts with the Group Event "one event record" contract.
- The period preference is deliberately omitted from Settings despite the dossier explicitly placing it there.
- The proposed backup "emission deferred" pattern is stale now that Phase 36 has landed.
- Up Next currently selects stable contacts, making its neutral empty state effectively unreachable.
- Never Contacted lacks a row source for the promised preview.
- Digest/Events stacks omit at least one Profile-reachable route.
- User-facing "Group Events" terminology remains after the purported Events relabel.

Overall risk: **HIGH until the blocking contract issues are corrected.**

---

### Plan 38-01 — Five-tab shell + semantic routing

**Summary:** The shell restructuring is sound in outline: it preserves the internal `DashboardTab` identifier, promotes Digest and Events to independent stacks, removes the redundant Backup tab, and reuses the existing reselect-to-root implementation. The route-registration inventory is incomplete, however, and the plan does not finish the user-facing Group Events → Events terminology change.

**Strengths:**
- Preserving `DashboardTab` is correct. FAB targets are hardcoded to it in `universal-fab-logic.ts:28` and `UniversalFab.tsx:253`.
- Reusing `handleActiveTabPress` is appropriate: it generically identifies the focused child stack and dispatches `popToTop` at `RootNavigator.tsx:91`.
- Keeping Backup routes registered in Settings is supported by the existing dual-home contract at `types.ts:255`.
- Follows the existing per-stack route-duplication convention documented for Orrery at `types.ts:165`.

**Concerns:**
- **HIGH — DigestStack and EventsStack omit a Profile-reachable route.** Task 2 mirrors the Orrery sibling routes but omits `RecentlyDeleted`. Orrery registers it because Profile can reach it at `OrreryStack.tsx:64`, param contract at `types.ts:178`. A Profile opened from Digest or Events could navigate to an unregistered route at runtime.
- **MEDIUM — The Events relabel is incomplete.** The Events root still renders `title="Group Events"` and "group events" a11y/search copy at `GroupEventsScreen.tsx:68`. Neither this plan nor Plan 04 owns those strings, despite dossier §B.
- **LOW — The focused-route task is mostly a no-op.** Unknown routes already default to browse treatment at `focused-route-classification.ts:1`, and `Digest`/`GroupEvents` are already tested as browse routes at `focused-route-classification.test.ts:35`.

**Suggestions:** Build the new stack route sets by mechanically comparing to every target reachable from `ContactProfileScreen`; add `RecentlyDeleted`; own the `GroupEventsScreen` title relabel; add navigation tests that mount each navigator and traverse Profile → Recently Deleted.

**Risk:** MEDIUM-HIGH. Architecture right; incomplete route registration creates real runtime nav failures; terminology not fully owned.

---

### Plan 38-02 — Your Week data layer + migration 030

**Summary:** Period-window builder and additive settings migration are technically reasonable. The aggregation contract and backup treatment are not yet safe: the plan relies on a pre-Phase-36 "emission deferred" convention the live code has superseded, while the Group Event activity-unit definition is internally inconsistent.

**Strengths:**
- Reuses `buildWindow("7days", …)` at `window.ts:149`.
- `expo-localization` really does expose nullable 1–7 `firstWeekday`, so the resolver + Sunday fallback are appropriate.
- Migration 030 follows the forward-only registry; head/`TARGET_VERSION` centralized at `database.ts:67`.
- Bound date params + bare `date(stored_column)` match the local-wall-clock convention at `status.ts:11`.
- Human checkpoint before the irreversible migration.

**Concerns:**
- **HIGH — The backup rationale is stale and could silently make the new preference non-portable.** The plan imitates the old "declare optional, emission deferred" pattern (comments at `app-settings-dao.ts:464`), but Phase 36 already added the formerly-deferred fields to the portable projection at `app-settings-dao.ts:950` and return mapping at `:1013`. Whether `yourWeekPeriod` is portable / needs a format bump is a wire-shape/risk decision; `BACKUP_FORMAT_VERSION` is tied to portable JSON shape at `backup/types.ts:13`. **OWNER-ESCALATION** if the plan intends to omit or add the setting without following the landed Phase 36 backup policy.
- **HIGH — The heatmap aggregation does not honor "Group Event = one event record."** Group Event creation writes one parent and one child interaction per participant at `group-events-dao.ts:340`. A simple `COUNT(*) FROM interactions` contributes N heatmap units for an N-person event. The canonical Profile heatmap counts child interactions once each (`history-read.ts:19`), while the dossier changes the Digest contract to one Group Event activity record. The plan resolves day detail and the Events metric but leaves date-count saturation based on child rows.
- **MEDIUM — Conflates three distinct aggregation units** (Interactions vs Events vs the heatmap/day-detail activity unit); should not reuse one raw interaction query for all three.
- **MEDIUM — The "v1→v30 jump" test needs a precise fixture** — migration 030 requires migrations 2–29 to run first; use the full migration runner from a v1 fixture, not a standalone 030 invocation.

**Suggestions:** Add an explicit owner decision/checkpoint for backup portability (portable+bump / portable-optional / device-local-omitted); define a canonical Your Week activity unit (standalone interaction → one unit, distinct `group_event_id` → one unit, group children excluded from the heatmap unit query but counted in headline Interactions/People reached); test a 2–3 participant event against all outputs; name the migration test's starting schema version.

**Risk:** HIGH. Migration is low-complexity, but backup semantics and Group Event aggregation are durable cross-phase contracts and currently unresolved.

---

### Plan 38-03 — Up Next + Horizon composition logic

**Summary:** Pure-composition split is good; birthday/dedup well bounded. The Up Next SQL currently selects every tracked, previously-contacted person (including stable contacts), making the intended "nobody needs a nudge" empty state effectively unreachable.

**Strengths:**
- Reuses `PROGRESS_SQL`/`STATUS_SQL`/`REASON_SQL`/`STATUS_CADENCE_PRECONDITION` from `status.ts:53`.
- Leaving SQL uncapped and applying the cap after composition is sensible for dedup.
- The 0–6 birthday window correctly differs from the 0–30 Dashboard population at `dashboard-read.ts:292`.
- `daysUntilBirthday` handles malformed values, local-midnight, rollover, Feb 29 at `birthday-logic.ts:153`.

**Concerns:**
- **HIGH — Up Next will almost never be empty.** `STATUS_CADENCE_PRECONDITION` only requires tracking, cadence, and non-null `last_contact` at `status.ts:61` — not "needs attention." Sorting all such contacts by progress and taking three still shows stable contacts. The proposed empty copy will only appear when there are no eligible tracked contacts at all.
- **MEDIUM — "Approaching" is not defined by the proposed query.** The canonical Dashboard attention filter begins at `STABLE_MAX` and excludes active snoozes at `dashboard-query-logic.ts:173`. Reconcile whether Up Next means that canonical attention population, and snoozed treatment; don't silently choose "all tracked."
- **LOW — Birthday tie ordering under-specified** (equal-day should be deterministic, name then id).

**Suggestions:** Reuse/extract the canonical attention predicate; decide+test snoozed treatment; add tests (all-stable → empty; wobble/decay/rogue order; equal-progress deterministic; snoozed rule).

**Risk:** HIGH. DAO is simple, but its eligibility predicate changes Up Next's product meaning and breaks the designed empty state.

---

### Plan 38-04 — Notification routing + FAB audit + Contacts cleanup

**Summary:** Notification-routing design is structurally strong, preserving the FAB target is correct. Small test-reference errors, and terminology cleanup is incomplete when considered with Plan 01.

**Strengths:**
- Distinct `select-digest` intent is cleaner than overloading the Dashboard-stack reset shape.
- Pure resolver stays node-loadable (`notification-nav.ts:1`).
- The current gate always wraps the second route in `DashboardTab` at `notification-gate.tsx:129`, so a separate Digest reset adapter is necessary.
- FAB is globally mounted outside `RootNavigator` at `App.tsx:378`, visibility route-classification based at `UniversalFab.tsx:125`.

**Concerns:**
- **MEDIUM — Wrong gate test filename.** The repo has `notification-gate.test.tsx`, not `.test.ts`; the automated command as written fails.
- **MEDIUM — The existing concurrency guard must remain covered after branching.** `applyBodyNav` prevents an older async contact lookup from overwriting a newer destination (`notification-gate.test.tsx:76`); refactoring must preserve it for contact intents while letting Digest bypass the lookup.
- **MEDIUM — S-05 still incomplete.** Removing Home shortcuts doesn't change the Events root title/search labels (`GroupEventsScreen.tsx:68`).
- **LOW — FAB context narrower than the new stacks.** `getFocusedContactContext` recognizes only `DashboardTab`/`OrreryTab` (`universal-fab-logic.ts:135`); on a Digest/Events-origin Profile, Quick Log loses current-contact context and opens the picker.

**Suggestions:** Correct the test path to `.test.tsx`; add Digest gate tests (warm/cold/stale-request); own the Events-root relabel here or in Plan 01; extend the FAB audit to DigestTab/EventsTab Profile contexts.

**Risk:** MEDIUM. Core routing correct; remaining risks are integration and incomplete audit coverage.

---

### Plan 38-05 — Your Week presentation

**Summary:** Component decomposition and accessibility intent are good, but the planned data wiring cannot work as written. The DAO returns aggregated `{d, n}` rows while `buckets()` expects one `{occurredAt}` per activity; passing aggregate rows through it either fails type checking or collapses each active date to a count of one.

**Strengths:**
- Reuses heatmap classification + existing theme ramp; shared bucketer establishes zero-valued cells + local-date extraction at `buckets.ts:46`.
- Avoiding the full `ActivityHeatmap` is correct (it owns lens/navigation chrome beyond Digest's period).
- Structural selected state + accessible selection satisfy the non-color-only requirement.
- App-wide inline day-detail component is justified (Profile history row is contact-scoped).
- Persisting period changes through `updateAppSettings` follows the settings DAO write path.

**Concerns:**
- **HIGH — The heatmap feed contract is incompatible.** `buckets()` requires individual records with `occurredAt` and increments once per row (`buckets.ts:17`, `:62`). Plan 02 returns one `{d, n}` aggregate per date. "Feed by `buckets()` over the date→count rows" cannot preserve `n`.
- **HIGH — The UI inherits Plan 02's group-event saturation error.** Unless the DAO defines a union of standalone interactions and distinct Group Events, an N-participant event produces N heatmap units though its day detail is one row.
- **HIGH — The preference is not actually placed in Settings.** Dossier §I explicitly says "Put the preference in Settings wherever it naturally fits." This plan chooses only an in-context Digest control and declines a Settings row. That reverses a recorded product decision → **OWNER-ESCALATION**, not planner discretion.
- **MEDIUM — Focus lifecycle may cause redundant reads** (DigestScreen + YourWeekSection each do focus reads); define cancellation/stale-period protection on rapid toggle.
- **MEDIUM — Write-failure handling unspecified** (revert / error / diverged UI on `updateAppSettings` failure?).

**Suggestions:** Choose one heatmap input contract (individual canonical activity units + `buckets()`, OR aggregated counts built into the date map directly without `buckets()`); add an explicit Settings row or obtain owner approval to reverse §I; specify optimistic-toggle rollback + generation guards; test count>1 on the same day; test a multi-participant Group Event produces exactly one saturation unit.

**Risk:** HIGH. Visual design good, but the central data-to-heatmap link is invalid and a settled Settings decision is being reversed.

---

### Plan 38-06 — Digest surface assembly

**Summary:** Final screen composition follows Up Next → Horizon → Your Week and retains the focus/error pattern. It cannot yet implement the promised Never Contacted preview, and its cross-tab drill-through contract is underspecified relative to the Zustand-backed Contacts query state.

**Strengths:**
- Retains cancellation guard + null-vs-loaded sentinel (`DigestScreen.tsx:69`).
- Removing the legacy Back button is correct for a tab root (`DigestScreen.tsx:129`).
- Shared `ContactCard` avoids a second status-color system.
- Passing Up Next IDs into Horizon makes first-claim dedup explicit; keeps Up Next/Horizon read-only.

**Concerns:**
- **HIGH — Never Contacted has no row source for the promised preview.** `countNeverContacted` returns only a number (`dashboard-read.ts:539`); neither Plan 03 nor 06 introduces a query returning Never Contacted contacts. A "compact preview + count" cannot be rendered as planned.
- **HIGH — Cross-tab drill-through is not defined at the actual state boundary.** Contacts populations/filters live in a persisted Zustand store writing through `app_settings` (`dashboard-query-store.ts:92`). Navigating to bare `DashboardTab` does not establish a population/filter. The plan must specify whether it mutates the canonical store before navigation, adds typed route params consumed by Home, or introduces another intent.
- **MEDIUM — Overlooked has no exact canonical Contacts population** (available: favourites, birthdays, not-contacted, snoozed, all-contacts at `dashboard-query-logic.ts:5`; "needs attention" begins at `STABLE_MAX` at `:173`).
- **MEDIUM — Up Next empty behavior depends on Plan 03's unresolved eligibility bug.**
- **LOW — `grep -c 'DashboardTab'` is not behavioral verification.**

**Suggestions:** Add a canonical `listNeverContactedPreview` read (or reuse a proven list query with a limit); define an `openContactsQuery({populations, filters})` navigation/store intent with hydration + stale-state tests; decide Overlooked's target population (escalate if broader); add integration tests proving each overflow action changes the actual Contacts result set; resolve Plan 03's predicate first.

**Risk:** HIGH. Module composition is clear, but two required drill-through/preview behaviors lack implementable data and state contracts.

---

### Plan 38-07 — Regression, accessibility, themes, physical-device UAT

**Summary:** A consolidated full-suite + physical-device gate is appropriate. The proposed shell test is too source-structure-oriented, and the device task lacks the required environment precondition / blocked-state handling.

**Strengths:**
- Requiring Vitest, `tsc`, and the color gate separately is correct.
- Physical-device coverage well targeted (fresh launch, resume, origin-aware Back, FAB, notification routing, both themes, large text).
- Captures screenshots + accessibility-tree evidence.
- Correctly avoids emulator performance claims.

**Concerns:**
- **HIGH — The autonomous UAT task lacks the required first-use confirmation/precondition.** Repo instructions require confirming Orbit's package name and Metro tmux session with the owner before first use; previous plans encode that (e.g. `31-05-PLAN.md:119`). Plan 07 hardcodes the Metro remap and is marked autonomous.
- **HIGH — The plan does not define BLOCKED outcomes for unavailable hardware or test data.** Several checks require particular states (nonzero Never Contacted, multi-participant Group Event, a Digest notification, both themes, meaningful week activity). Rendering alone cannot prove them; provision a disposable fixture or record BLOCKED, never infer pass.
- **MEDIUM — The shell-contract test is likely to become a source scanner** (`TabParamList` erased at runtime; JSX order/listener count can't be proven by importing a type).
- **MEDIUM — "Fix nothing but the test" creates an execution dead end** if the gate finds a feature defect; the follow-up flow before UAT continues is undefined.
- **MEDIUM — Build instructions should cite the runbook.** Authoritative pipeline is `docs/runbooks/desktop-build-pipeline.md`; ADR-007 specifies tar-over-SSH/scp because rsync is absent on `droid` (`ADR-007:18`). The plan's "rsync/scp" wording isn't aligned.

**Suggestions:** Add an owner-confirmation precondition (package/session, exactly one authorized target); add a fixture strategy for all nonempty states; permit PASS/FAIL/BLOCKED and prohibit converting missing hardware/data into a pass; extract a runtime shell descriptor both `RootNavigator` and the test consume; define a repair loop (failed gate → owning-plan follow-up → full gate rerun → device UAT); record build SHA, package, device serial, API level, theme, fixture identity.

**Risk:** MEDIUM-HIGH. Acceptance matrix strong, but the execution protocol is not yet reliable enough for trustworthy phase closure.

---

### Codex — Consolidated required changes (block approval on these)

1. Correct Your Week's canonical activity-unit query so one Group Event contributes one heatmap/day-detail record while headline metrics retain separately-defined semantics.
2. Resolve backup portability for `yourWeekPeriod`; the "emission deferred" precedent is no longer current.
3. Honor dossier §I by adding the period preference to Settings, or obtain an explicit owner-approved reversal.
4. Filter Up Next to the canonical attention population so stable contacts don't make the empty state unreachable.
5. Add a Never Contacted preview row source.
6. Define real Contacts drill-through intents/store transitions for Never Contacted and Overlooked.
7. Register every Profile-reachable route in DigestStack and EventsStack, including `RecentlyDeleted`.
8. Complete the user-facing Events terminology update.
9. Correct the notification gate test filename and preserve stale-request coverage.
10. Strengthen Plan 07 with environment confirmation, fixtures, BLOCKED handling, and behavior-level shell tests.

---

## Claude Review

*Read-only general-purpose Claude subagent (Write-gap fallback per project runbook). Source-grounded;
repo access confirmed. Overall: MEDIUM (low-leaning).*

**Summary:** A strong, well-grounded plan set. The plans' `file:line` claims hold up: the current
4-tab shell, migration head (029→030), the group-event seam, the canonical status engine, the
heatmap helpers, and the `app_settings` declare-optional pattern are all as described. The phase
achieves its goal — a five-tab, Digest-centered home composed derive-only from existing reads.
This subagent found **no** owner-escalation trigger. Concerns are a small number of concrete,
unassigned edge/cleanup items — most notably a Backup-reachability deep link (`linking.ts:67`) that
no plan touches, a cross-plan tsc-ordering ambiguity around stale `DashboardStackParamList` entries,
and a `firstWeekday` index-conversion hazard.

> **Aggregator note:** This subagent's "no escalation / Plan 02 backup pattern is correct" conclusion
> was checked against disk and is **superseded** — `getPortableSettingsSnapshot` at
> `src/db/app-settings-dao.ts:888+` now emits `history_lens/history_cycle_count`, so the "emission
> deferred" precedent this subagent relied on is stale. Treat codex's backup HIGH as authoritative.

**Strengths (evidence):**
- Migration correctly grounded and gated; head `029-ai-configuration.ts`, `TARGET_VERSION` at
  `database.ts:67`; additive `ADD COLUMN … DEFAULT 'rolling7' CHECK(...)`, `checkpoint:decision` gate,
  `BACKUP_FORMAT_VERSION = 6` unchanged (`backup/types.ts:14`).
- Backup menu path survives removal — `SettingsStack.tsx:206-207` registers `Backup`/`BackupSettings`
  as real screens; dossier §K claim is true.
- Internal `DashboardTab` id preserved as the linchpin (FAB hardcodes it at
  `universal-fab-logic.ts:30,88,101,146`).
- FAB-on-Digest is automatic (denylist at `UniversalFab.tsx:148`; `Digest`/`GroupEvents` not in
  `FOCUSED_WORKFLOW_ROUTES` at `focused-route-classification.ts:7-11`), so Plan 04's "audit-only"
  framing is correct.
- Up Next reuses the canonical engine (D-04), matching `readOverlooked`'s `ORDER BY progress DESC`
  (`digest-read.ts:109`).
- Heatmap reuses helpers, not the forbidden chrome; structural day selection satisfies §P/HIST-18.
- Group-event double-count seam correctly identified (`interactions.group_event_id` at
  `026-group-events-schema.ts:32`, unique index :38).
- Local-first / theme / date discipline enforced throughout; no read-path network introduced.

**Concerns:**
- **MEDIUM — The Backup share-intent deep link (`linking.ts:67`) is unassigned.** `src/navigation/linking.ts:67`
  runs `navigationRef.current?.navigate("BackupTab", { screen: "Backup" })` — the path routing a shared
  `.orbitbackup` file into restore. Plan 01 removes `BackupTab` from `TabParamList` (`types.ts:352`), so
  this becomes a tsc error; the correct fix is repoint to `navigate("SettingsTab", { screen: "Backup" })`,
  but no plan lists `linking.ts` in `files_modified`. Dossier §S.4 is only partly discharged (the menu
  entry was verified, not this deep link). A data-recovery path.
- **MEDIUM — Stale `DashboardStackParamList` `Digest`/`GroupEvents` entries + cross-plan tsc ordering.**
  `types.ts:47` (`GroupEvents: undefined`) and `:155` (`Digest: undefined`) remain in the Contacts stack.
  Plan 01 removes only the `Stack.Screen` components — and must NOT remove these type entries in wave 1,
  because `notification-gate.tsx:151` and the digest `NavIntent` `{name:"Digest"}` literal require `Digest`
  to stay a valid `DashboardResetTarget` until Plan 04 (wave 2) repoints the intent. Risk: (a) an executor
  "cleaning up" the entries in Plan 01 breaks the wave-1 tsc gate; (b) if left permanently, `navigate("Digest")`
  inside the Contacts stack typechecks but fails at runtime. Assign the param-list removal to Plan 04.
- **MEDIUM — Calendar-week `firstWeekday` index conversion off-by-one.** Expo's `firstWeekday` is 1-based
  (1=Sunday…7=Saturday); `window.ts`'s `weekdayOf` uses `getDay()` which is 0-based (`window.ts:74`).
  Comparing the two spaces directly is off by one. Document the `firstWeekday − 1` mapping in Plan 02 Task 1
  and pin it with a test using the real Expo convention (firstWeekday=2 must start on Monday).
- **LOW — `38-VALIDATION.md` is an unfilled template** (`{pytest / jest / vitest}` placeholders,
  `status: draft`, `nyquist_compliant: false`). Per-plan verify blocks are solid; the phase-level contract
  was never populated.
- **LOW — Residual cross-stack `navigate("Home")` in the Digest surface.** `DigestScreen.tsx:171` has
  `onPressBacklog={() => navigation.navigate("Home")}`; `Home` is a `DashboardStack` route not in
  `DigestStackParamList`. Ensure no `navigate("Home")` survives Plan 06's rewrite.
- **LOW — Metric-granularity mismatch is user-visible** (one 4-person group coffee → 4 "Interactions" but
  1 "Event" and 1 day-detail record). Dossier-consistent and already surfaced as a reversible held decision;
  worth an explicit owner confirmation.

**Owner-escalation check (subagent's own):** none triggered. *(Aggregator: superseded on the backup item;
see note above.)*

**Suggestions (tied to plan/task):**
- Plan 01 Task 1: add `linking.ts` to `files_modified`, repoint `:67` to `navigate("SettingsTab", { screen: "Backup" })`, add acceptance `! grep -q '"BackupTab"' src/navigation/linking.ts`.
- Plan 01 Task 2 + Plan 04: state in Plan 01 that `Digest`/`GroupEvents` stay in `DashboardStackParamList`
  until routing is repointed; assign the removal to Plan 04.
- Plan 02 Task 1: document the `firstWeekday`(1=Sun) → `getDay()`(0=Sun) conversion + Monday-first test.
- Plan 06 Task 3: acceptance line that no `navigate("Home")` remains in the rewritten `DigestScreen`.
- Plan 07 / validate-phase: populate `38-VALIDATION.md` (vitest, commands, per-task map) or delete it.
- Owner batch: confirm (a) period-toggle placement in-context vs a Settings row (§I) and (b) the
  Interactions-vs-Events group-event granularity — both already flagged by the plans.

**Risk Assessment:** Overall MEDIUM (low-leaning). Architecture is sound, decision-aligned, reuse-based.
What keeps it from LOW is a cluster of concrete unassigned items (the `linking.ts` Backup deep link, the
stale `DashboardStackParamList` entries with their wave-ordering constraint, and the `firstWeekday`
conversion). With those assigned, it drops to LOW.

---

## How to incorporate this feedback

```
/gsd-plan-phase 38 --reviews
```

Before or during replanning, get owner decisions on the two escalation items (backup portability
of `yourWeekPeriod`; period preference in Settings vs in-context). The three confirmed data-layer
HIGHs (backup precedent, heatmap group-event unit, `buckets()` feed contract) and the union of the
navigation gaps (`RecentlyDeleted` registration + `linking.ts:67` deep link + stale
`DashboardStackParamList` entries) should be treated as blocking.
