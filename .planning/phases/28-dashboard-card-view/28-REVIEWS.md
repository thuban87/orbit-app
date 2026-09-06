---
phase: 28
cycle: 2
reviewers: [codex, claude]
reviewed_at: 2026-09-06T07:09:17Z
plans_reviewed: [28-01-PLAN.md, 28-02-PLAN.md, 28-03-PLAN.md, 28-04-PLAN.md, 28-05-PLAN.md, 28-06-PLAN.md, 28-07-PLAN.md]
revision_commit: 81ab2c2
models:
  codex: "gpt-5.6-terra (reasoning=medium)"
  claude: "claude-opus-4-8 (read-only subagent)"
model_sources:
  codex: "banner"
  claude: "orchestrator-known"
---

# Cross-AI Plan Review — Phase 28 (Dashboard Card View) — CYCLE 2

Re-review of the CURRENT plans on disk after the cycle-1 revision (commit `81ab2c2`, which
incorporated cycle-1 feedback: 2 HIGH + 12 actionable). Two independent source-grounded reviewers:

- **Codex** (`gpt-5.6-terra`, reasoning=medium) — ran in-repo with file access; verified claims against source.
- **Claude** (`claude-opus-4-8`) — ran as a **read-only subagent** (per project convention: the skill's
  built-in `claude -p` lane fails on a Write-permission gap; a read-only subagent is the reliable path and
  keeps the pass independent of the orchestrator's write context). Verified every finding against code on disk.

Both reviewers, and the orchestrator's own independent spot-verification, opened the actual DAOs, stores,
navigation types, and HomeScreen — not just the plan text — per the project's "review the code, not the diff"
mandate.

## Consensus Summary

**Both reviewers agree: the revised plan set is substantially sound. HIGH concerns: 0.** No decision
reversal (D-01..D-12, ADR-010/018/024/025/071/075, HANDOFF), no local-first violation (no network on any
read/write path, no migration — the frequency guard rides the *existing* migration-011 CHECK, `localDateTime()`
not `toISOString`, theme tokens gated by `check:colors`, animation reduced-motion-gated with an explicit
no-per-frame-setState prohibition), and the single-recency-writer spine (ADR-010/024/071) plus immutable-event
trail (ADR-025) are composed, never bypassed.

### Both cycle-1 HIGH fixes verified SOUND (independently, against real code)

- **HIGH-1 (CARDV-09 — GroupLog route param + Phase 33 deferral): SOUND.** `src/navigation/types.ts:34` is
  currently `GroupLog: undefined;`; the GroupLog screen is a placeholder (`FabActionPlaceholders.tsx:41`,
  wired at `DashboardStack.tsx:38`). Extending the param to `{ participantIds?: number[] } | undefined` is
  additive and serializable, matches the file's route-param convention, and does **not** reverse D-10 —
  Group Event domain behaviour stays Phase 33 (`GroupEvents` is already a Phase-33 placeholder). The plan's
  claim that `universal-fab-logic.ts:92` "never preselects" is FAB-scoped (not a multi-select constraint) is
  correct — verified it sits inside `resolveFabTarget`'s `case "GroupLog"`.
- **HIGH-2 (CARDV-08 — bulkQuickLog receipt + atomic undoBulkQuickLog): SOUND.** Verified: the write mutex
  is non-reentrant (`mutex.ts:32-36`; `transaction.ts` documents the nested-txn hang); `insertInteractionCore`
  / `recomputeLastContactCore` are already exported non-mutexed cores (`recency-dao.ts:425-428`);
  `deleteInteractionCore` is correctly identified as the yet-to-be-extracted inner body of `deleteTouchpoint`
  (`recency-dao.ts:313-346`, which today does **not** bump); `bumpDataRevisionCore` is the single revision bump
  (`data-revision-dao.ts:5-21`). Composing N non-mutexed cores in one outer transaction with a single bump is
  correct — `last_contact` lands on `now` (correlated `MAX(occurred_at)`), no deadlock, no double-bump. The
  `direction:"outbound"` pin is genuinely required (insert defaults direction to `null` at `recency-dao.ts:205`)
  and the `connected:1` pin is required for the `rarely_responds = 0 OR i.connected = 1` recompute filter.

### The 28-07 `<flagged_assumption>` (per-action eligibility) is a correctly-recorded owner-bucket escalation

Both reviewers confirm its facts against migration 011 (`CHECK (tracking_enabled = 0 OR interval_days IS NOT
NULL)` at line 37 makes setting a cadence on an Unbound contact schema-legal, exactly as stated) and treat it
as **RESOLVED** (owner decision surfaced with a safe default) — not an unresolved actionable finding.

### Agreed Strengths

- The highest-risk plan, **28-02 (bulk-actions-dao)**, is correct-by-construction and matches every referenced
  writer on disk: one outer `inWriteTransaction` per bulk op, non-mutexed `*Core` composition, immutable
  lifecycle events, recency recompute, single revision bump, and an unusually strong node:sqlite test plan
  (both reviewers rate its correctness highly).
- **28-01** closes the cycle-1 CardGrid prop-contract gap — the full shared list-surface contract
  (data-gating, skeleton-vs-empty, pull-to-refresh + error-retry, header, bottom clearance) is threaded
  explicitly, mapping to real FlatList props at `HomeScreen.tsx:1055-1118`.
- **28-04** correctly applies the cycle-1 fix: compactness is a within-tier tiebreak (not an additive score),
  so a compact "other" candidate can never outrank an imminent meaningful date; a separate short prompt list
  avoids reusing List's full-sentence prompts.
- **28-05** composes the menu from `Sheet`/`overlay-base` (not the text-only `OverflowMenu`) and adds
  card-level `accessibilityActions` (cycle-1 fixes reflected); Delete/Archive excluded, no swipe duplication.
- **28-03/06** enforce the frozen-universe snapshot in the store (`enterSelection` re-entry no-op;
  `removeFromUniverse` drops from both sets) and replace (not add-a-bottom-bar) the control area; Back exits
  selection before nav.

### Agreed / highest-priority Concern

- **Frozen-universe enforcement gap across the refresh path (MEDIUM — codex, orchestrator-verified).** The
  store correctly never *recomputes* `frozenUniverse`, but the renderer/toggle path is not fenced to it.
  `HomeScreen` re-queries `rows` on focus (`HomeScreen.tsx:678`), foreground/AppState-active (`:690`), and
  pull-to-refresh (`:706`), **and** 28-07 refreshes the shared model after every committed bulk op (`28-07`
  Task 2). 28-06 renders the live `rows` and routes every card tap to `toggle(id)` (`28-03:85` accepts any id;
  `28-06:92,115`). So a row that enters the live result set *after* selection began (e.g. a background
  "mark-contacted" write, or a data change from a bulk op) can render a card and be toggled/acted on — an
  id outside the snapshot. Select All is safe (uses `frozenUniverse`); toggle and render are not. This
  under-enforces D-12 / SS S / Pitfall-6 (it strengthens, rather than reverses, the decision — so MEDIUM, not
  a reversal-HIGH). Claude's L6 touches the adjacent angle (Select-All must seed from the *full* result array,
  not a windowed subset).

### Divergent Views

- **28-02 photo-core boundary citation.** Codex (MEDIUM): the plan's parenthetical that the revision bump
  "lives in `setContactPhoto`'s public wrapper, `contacts-dao.ts:658`" is **factually inverted** — the bump is
  *inside* `setContactPhotoCore` (line 658); the public wrapper `setContactPhoto` (661-670) merely delegates.
  An implementer reading the core will see a bump the plan attributes elsewhere. Claude reads the plan's
  *instruction* ("copy only the single-column UPDATE + `changes===1` guard, not the trailing bump") as
  correctly handled and does not flag the citation. **Orchestrator adjudication:** codex is factually right —
  the bump is in the Core at :658, not the wrapper; the *instruction* is nonetheless clear and correct. Worth
  a one-line citation fix so a future reader isn't confused, but low functional risk.

## Actionable (MEDIUM / LOW) findings — not yet incorporated into the plans

| # | Sev | Plan(s) | Finding | Fix needed in PLAN.md |
|---|-----|---------|---------|-----------------------|
| A1 | MEDIUM | 28-03 / 28-06 / 28-07 | Frozen-universe not fenced on the toggle/render path; live re-query + post-op refresh can introduce out-of-universe ids that render and are selectable | 28-03: make `toggle(id)` a no-op unless `frozenUniverse.includes(id)` (+ test). 28-06: render only `rows` whose id ∈ `frozenUniverse` while selection is active. 28-07: add an acceptance criterion depending on those before bulk-refresh wiring lands (+ UAT: refresh mid-selection introduces no selectable new id) |
| A2 | MEDIUM | 28-07 | Net-new bulk **Snooze preset** picker and bulk **Set Category** picker are unspecified (no affordance/testID/confirm+announce copy/a11y) in an otherwise meticulous surface | Specify both pickers (which of `PRESET_MODIFIERS`; category source + component), testIDs (`bulk-snooze-preset-{id}`/`bulk-category-{id}`), and confirm/announce copy in Task 2 |
| A3 | MEDIUM | 28-02 | Photo-core citation inverted: bump is inside `setContactPhotoCore` (`contacts-dao.ts:658`), not the public wrapper (divergent — codex flags, Claude reads instruction as handled; orchestrator confirms codex factually correct) | Reword truths line 24 / Task 1 (:102): "`setContactPhotoCore` itself owns its bump; copy only its bound single-column UPDATE + `changes===1` guard, never its bump." Drop the "lives in the public wrapper :658" claim |
| A4 | MEDIUM | 28-04 | Selector is told to *mirror* `list-row-selection.ts`'s **private** `formatLocalDate` (lines 30-35) rather than import the shared helper — risks perpetuating duplicated local-date logic (CLAUDE.md: use `formatLocalDate()` from `src/utils/dates.ts`) | Amend Task 1 to require importing `formatLocalDate` from `src/utils/dates.ts` for imminent-date comparisons; prohibit a new/mirrored local formatter |
| A5 | LOW | 28-02 | `undoBulkQuickLog` described "behavior-identical to N single-contact `deleteTouchpoint` undos", but it adds a `bumpDataRevisionCore` `deleteTouchpoint` omits (more correct, not identical) | Reword the truth line to "identical per-row reversal, plus a single data-revision bump the single-row path omits" |
| A6 | LOW | 28-05 | Long-press menu "Snooze" routes to "the existing single-contact snooze flow" but `snoozeContact` needs a `SnoozePreset` — the concrete affordance/default is unnamed | Name the snooze-preset affordance the menu reuses (or state the default preset) |
| A7 | LOW | 28-06 | Frozen universe seeded from "current rows' ids" is correct only if `rows` is the full result set (it is — FlatList virtualizes render only), but the assumption is implicit | Add a one-line note that `currentEligibleIds` must be the full result array, never a windowed subset |
| A8 | LOW | 28-01 / 28-02 / 28-03 | Frontmatter/label tidy: 28-02 is `wave: 1` in frontmatter but wave 2 in the roadmap (disjoint files, harmless); 28-03 `depends_on:[28-01]` is spurious for a pure Zustand store | Align the roadmap wave label; relax 28-03 to `depends_on: []` (harmless, improves parallelism) |

**Not counted (already resolved / not a plan change):** the per-action-eligibility `<flagged_assumption>`
(properly recorded owner escalation — RESOLVED); Claude L2 (`bulkAddFavourites` idempotency — already covered
by 28-02 Task 3); Claude L5 (28-04 `HomeScreen.tsx:601` gate shape — the plan already instructs the correct
widening; a verify-at-execution note, not a plan gap); the CARDV-09 2+→placeholder path (per D-10; owner
visibility only, do not reopen).

**Counts — HIGH: 0. Actionable MEDIUM/LOW: 8 (A1-A8; 4 MEDIUM, 4 LOW).**

---

## Codex Review


Overall: the revised plan set is substantially sound. It preserves the locked no-migration, composed-writer, immutable-event, local-only, theme-token, and Group Event ownership decisions. I found no decision reversal or local-first invariant violation. One medium cross-plan gap remains around enforcing the frozen selection universe after dashboard refreshes.

## Cycle-1 HIGH fix verdicts

- **HIGH-1 / CARDV-09 — Sound.** Plan 07 changes only `DashboardStackParamList.GroupLog` to `{ participantIds?: number[] } | undefined` and routes selected numeric IDs; it explicitly defers consumption. The actual route is currently a placeholder: `src/navigation/types.ts:34`, `src/navigation/tabs/DashboardStack.tsx:38`, and `src/screens/placeholders/FabActionPlaceholders.tsx:41-48`. This is an additive handoff compatible with D-10, not implementation of Group Event behavior.

- **HIGH-2 / CARDV-08 — Sound as planned, but not yet implemented on disk.** The mutex is non-reentrant (`src/db/mutex.ts:32-35`; `src/db/transaction.ts:12-23`). Existing non-mutexed recency cores are real: `insertInteraction` and `recomputeLastContact` at `src/db/recency-dao.ts:159-214`, exported as cores at `src/db/recency-dao.ts:425-428`. `bumpDataRevisionCore` performs one singleton revision increment at `src/db/data-revision-dao.ts:5-21`. `deleteInteractionCore` does not yet exist—the current mutexed `deleteTouchpoint` body is at `src/db/recency-dao.ts:313-345`—but Plan 02 specifies extracting precisely that body, including scoped lookup/delete, tombstone insertion, and recency recompute. Composing it once per receipt entry in one outer transaction, then bumping revision once, is correct and avoids both deadlock and stale `last_contact`.

## 28-01 — Grid tracer and icon registry

**Summary:** A well-scoped renderer tracer. It correctly replaces the per-item card branch with a distinct grid scroll container while retaining the shared data, refresh, empty, error, and optimistic-favourite paths.

**Strengths**

- Uses the existing row model, whose nullable card inputs are explicit in `src/db/dashboard-read.ts:91-110`.
- Preserves the existing membership-only favourite behavior from `src/screens/HomeScreen.tsx:1071-1079`; it does not expose or sort on rank.
- Correctly composes existing status primitives: `ringVisual` resolves tokenized ring colors/widths (`src/components/contact-card-ring.ts:45-61`) and `StatusGlyph` resolves through the single registry (`src/components/icons/StatusGlyph.tsx:48-55`).
- Explicitly carries the FlatList surface contract that currently lives at `src/screens/HomeScreen.tsx:1055-1118`, avoiding a blank/errorless Card mode.

**Concerns**

- None found.

**Suggestions**

- No required plan change.

**Risk Assessment:** **LOW.** The plan is additive, presentation-only, and accurately follows existing dashboard renderer seams.

## 28-02 — Bulk actions DAO

**Summary:** The highest-risk plan is conceptually correct: it uses one outer write transaction, non-mutexed per-contact cores, immutable lifecycle events, recency recomputation, and one revision bump. Its test plan is unusually strong.

**Strengths**

- Correctly identifies that nested writers would deadlock under the shared promise-chain mutex (`src/db/transaction.ts:12-23`).
- Correctly pins Quick Log’s direction to `"outbound"`; the current insert default is actually `null`, not outbound (`src/db/recency-dao.ts:204-210`).
- Correctly preserves recency: `recomputeLastContact` is the sole `last_contact` writer and handles `rarely_responds` connected-only behavior (`src/db/recency-dao.ts:145-175`).
- Correctly requires archive events, matching the current archive writer’s guarded update plus `recordEventCore` composition (`src/db/contacts-dao.ts:541-561`).
- The receipt-based undo design correctly scopes deletion by both interaction and contact IDs, matching the existing safe delete path (`src/db/recency-dao.ts:321-344`).

**Concerns**

- **MEDIUM — Plan 02 misstates the photo-core boundary, which could cause an implementer to copy the wrong pattern.** The plan says the revision bump “lives in `setContactPhoto`’s public wrapper” at Plan 02:24 and :102, but the actual bump is inside `setContactPhotoCore` at `src/db/contacts-dao.ts:637-659`; the wrapper merely delegates at `src/db/contacts-dao.ts:661-669`. The desired bulk-core rule is still right—new category/frequency cores must not bump—but the cited example is factually inverted.

**Suggestions**

- Update Plan 02 Task 1 to say: “Unlike the intended new bulk-only cores, `setContactPhotoCore` itself currently owns its revision bump; copy only its bound-update and `changes===1` guard, never its bump.” Remove the claim that the public wrapper owns line 658.

**Risk Assessment:** **MEDIUM.** The transaction model is sound, but the incorrect source claim is directly adjacent to the single-bump invariant and should be corrected before execution.

## 28-03 — Selection store

**Summary:** The store is a clean, appropriately ephemeral Zustand model with good unit coverage for entry, selection, Select All, archive removal, and exit.

**Strengths**

- Correctly keeps selection separate from durable query preferences; the existing query store is persistence-oriented while the dashboard session store provides the relevant in-memory analogue.
- The frozen-universe snapshot and `removeFromUniverse` semantics faithfully implement D-12.
- Tests cover re-entry, empty selection, Select All, archive removal, and reset.

**Concerns**

- **MEDIUM — `toggle(id)` is not constrained to the frozen universe.** Plan 03:85 allows any ID to be added. HomeScreen deliberately refreshes query results on focus, foregrounding, and pull-to-refresh (`src/screens/HomeScreen.tsx:678-700`), so a live result arriving after selection begins can present an ID that was not in the snapshot. Plan 06 then calls `toggle(id)` directly. This weakens D-12’s frozen-universe boundary.

**Suggestions**

- Amend Plan 03 Task 1: make `toggle(id)` a no-op unless `frozenUniverse.includes(id)`.
- Add a test proving an out-of-universe `toggle(99)` cannot alter `selectedIds`.

**Risk Assessment:** **MEDIUM.** The state model is otherwise correct, but this is the primary remaining D-12 enforcement gap.

## 28-04 — Adaptive card content and search mode

**Summary:** The plan correctly reuses the shared knowledge read and search-match presentation while giving Cards a compact, deterministic selection policy.

**Strengths**

- Correctly recognizes that the existing candidate read is batched and must not become a per-card read (`src/db/dashboard-knowledge-read.ts:156-172`).
- Preserves the existing strict priority ordering—imminent, pinned, then other—from `src/logic/list-row-selection.ts:77-101`.
- Correctly identifies the live gating issue: current HomeScreen only reads candidates in normal List mode, so Card mode requires the specified widening.
- Reuses the List search model rather than inventing match offsets or snippet semantics (`src/components/ListRow.tsx:122-134`, `:178-233`).

**Concerns**

- **MEDIUM — The plan tells the new selector to mirror a local date formatter instead of requiring the repository date helper.** `src/logic/list-row-selection.ts:30-40` implements a private `formatLocalDate`, while the required shared helper exists at `src/utils/dates.ts:17-22`. Plan 04:77-89 directs the new selector to mirror the analogue without explicitly using the shared helper. That risks perpetuating the prohibited duplicated local-date logic.

**Suggestions**

- Amend Plan 04 Task 1 to require importing `formatLocalDate` from `src/utils/dates.ts` for imminent-date comparisons and prohibit a new local formatter.

**Risk Assessment:** **MEDIUM.** The data and presentation architecture is sound; the date-helper compliance detail needs tightening.

## 28-05 — Long-press context menu

**Summary:** The menu plan respects the locked eight-item scope, avoids swipe duplication, and correctly separates presentational sheet UI from canonical action routing.

**Strengths**

- Correctly does not assume `OverflowMenu` supports icons; it is text-only (`src/components/OverflowMenu.tsx:27-37`).
- Uses the existing accessible-action pattern from `ListRow` (`src/components/ListRow.tsx:141-155`) rather than requiring users to perform a long press.
- Correctly excludes Archive and Delete, preserving the separation between a normal per-contact menu and the multi-select bulk surface.

**Concerns**

- None found.

**Suggestions**

- No required plan change.

**Risk Assessment:** **LOW.** It has a clear component boundary and preserves all locked interaction constraints.

## 28-06 — Multi-select mode

**Summary:** The control-area replacement, mode-dependent tap behavior, noninteractive star, explicit exit, and Back interception all align with D-12.

**Strengths**

- Correctly enables the currently disabled overflow entry at `src/screens/dashboard-overflow-actions.ts:39-44`.
- Correctly replaces the normal controls rather than adding a bottom bar, matching the layout currently composed around `DashboardControlRow`, search, and the view toggle in `src/screens/HomeScreen.tsx:1000-1053`.
- Uses a focused hardware Back handler, appropriate because HomeScreen is a root shell route; `ShellAppBar` only renders a Back affordance for child variants (`src/components/ShellAppBar.tsx:96-106`).

**Concerns**

- **MEDIUM — The plan inherits the unfenced toggle issue from Plan 03.** Plan 06:115 passes live rendered rows into `CardGrid` and Plan 06:92 routes every card press to `onToggleSelect`; meanwhile dashboard reloads can change `rows` (`src/screens/HomeScreen.tsx:678-700`). Without filtering cards to `frozenUniverse` and/or rejecting non-member toggles, a refreshed row outside the snapshot can be selected.

**Suggestions**

- Amend Plan 06 Task 2 to render only `rows` whose IDs remain in `frozenUniverse` while selection mode is active.
- Depend on the Plan 03 toggle membership guard as defense in depth.

**Risk Assessment:** **MEDIUM.** This is the same frozen-universe correctness issue, now at the renderer boundary.

## 28-07 — Bulk action surface and wiring

**Summary:** The bulk surface correctly limits scope to the decided operations, retains selection after ordinary writes, handles archive disappearance, and keeps Group Log routing as a Phase 33 handoff.

**Strengths**

- Explicit Add/Remove Favorites and Snooze/Unsnooze honor the binary-membership and no-ambiguous-toggle decisions.
- Archive copy and non-destructive presentation align with the real reversible archive model (`src/db/contacts-dao.ts:529-561`).
- Correctly avoids the existing one-interaction Undo controller, whose callback receives one `{contactId, interactionId}` pair (`src/screens/HomeScreen.tsx:384-392`).
- Correctly refreshes widget and shell consumers only after committed work, following the existing quick-log wiring (`src/screens/HomeScreen.tsx:394-409`).
- The properly recorded eligibility owner assumption is not an unresolved actionable finding.

**Concerns**

- **MEDIUM — Archive removal is handled, but refreshed non-archived rows are not explicitly kept outside the frozen selection universe.** Plan 07:134 removes archived IDs, but Plan 07:137 refreshes the dashboard after every bulk operation. Combined with Plan 03:85 and Plan 06:115, a refresh can introduce a row not in the original universe that remains selectable. This is a D-12 correctness gap, not an Archive-specific issue.

**Suggestions**

- Add an explicit Plan 07 dependency/acceptance criterion requiring the Plan 03 membership guard and Plan 06 frozen-row filtering before bulk refresh wiring lands.
- Add device/UAT coverage: enter selection, cause a refresh that changes matching rows, verify no new ID can be selected or acted on.

**Risk Assessment:** **MEDIUM.** The DAO and routing design are good; the remaining risk is selection-universe integrity across the required refresh path.

---

## Claude Review

*Ran as a read-only Claude subagent (see Consensus Summary for why).*


**Reviewer:** Independent source-grounded review (Claude). Read-only.
**Method:** Every finding below was checked against the actual code on disk, not the plan text.
Files opened and traced: `src/db/recency-dao.ts`, `mutex.ts`, `transaction.ts`, `events-dao.ts`,
`data-revision-dao.ts`, `snooze-dao.ts`, `favourites-dao.ts`, `contacts-dao.ts` (archive/photo/metadata
cores), `bulk-review-dao.ts`, `log-guards.ts`, `migrations/011-contact-lifecycle-schema.ts`,
`src/navigation/types.ts`, `src/components/universal-fab-logic.ts`, `src/services/quick-log-command.ts`,
`src/screens/HomeScreen.tsx` (quick-log path + render branch), `src/screens/dashboard-overflow-actions.ts`,
plus all 7 PLAN.md files and `28-CONTEXT.md`.

---

## VERDICT ON THE TWO CYCLE-1 HIGH FIXES

### HIGH-1 (CARDV-09 / 28-07 — GroupLog route param + Phase 33 deferral): **SOUND**

Verified against `src/navigation/types.ts`:
- Line 34 is exactly `GroupLog: undefined;` today — the plan's premise is accurate.
- The proposed change to `GroupLog: { participantIds?: number[] } | undefined` is **additive and
  serializable** (`number[]`, no callbacks), matching the file's stated route-param convention
  (`CropPhoto`, `Compose`, `SurvivorSelect` all carry serializable object params). No existing route is
  altered.
- **Does NOT reverse D-10.** D-10 grants this phase "only the action, the routing, and multi-select UX";
  Group Event domain behavior belongs to the later phase. `GroupEvents` is already a Phase-33 placeholder
  (`types.ts:30-31`), and the plan explicitly defers `participantIds` consumption to Phase 33
  (`28-07` truths line 23, prohibition line 48). This is a handoff contract, not a domain implementation.
- The plan's claim that the FAB's "never preselects here" comment is **FAB-scoped** is correct:
  `universal-fab-logic.ts:92` is inside `resolveFabTarget`'s `case "GroupLog"` and governs only the
  shell FAB's navigation, not multi-select routing. Using it as a constraint on Phase 28 would be a
  misread; the plan correctly does not treat it as one.
- `GroupLog` is a reachable registered screen (the shell FAB already routes to it at
  `universal-fab-logic.ts:93`), so navigating to it with params is safe.

No regression, no new problem introduced.

### HIGH-2 (CARDV-08 / 28-02 — bulkQuickLog receipt + atomic undoBulkQuickLog): **SOUND**

Each sub-claim verified against real code:

- **(a) Mutex is non-reentrant — CONFIRMED.** `mutex.ts:32-36` is a single promise chain
  (`const run = chain.then(fn, fn); chain = run.catch(...)`); `transaction.ts:11-29` documents that a
  nested `inWriteTransaction` is a permanent hang. The plan's "compose non-mutexed cores, one outer
  transaction" design is the only correct approach and is applied consistently.
- **(b) Composable non-mutexed cores exist / will exist — CONFIRMED.**
  - `insertInteractionCore`, `recomputeLastContactCore` are already exported non-mutexed cores
    (`recency-dao.ts:425-428`).
  - `deleteInteractionCore` does **not** exist yet — it is the inner body of `deleteTouchpoint`
    (`recency-dao.ts:313-346`), which the plan correctly proposes to extract in Task 1. The plan's
    description of that body (uid lookup scoped by `id AND contact_id`, `insertTombstoneCore`, DELETE
    scoped by both keys, `recomputeLastContact`) matches the source exactly.
  - `bumpDataRevisionCore` is the single revision bump (`data-revision-dao.ts:5-22`) — CONFIRMED.
- **(c) Batch-in-one-transaction + single-bump is correct — CONFIRMED.**
  - `bulkQuickLog`: per distinct contact (ids come from a `Set`), one `insertInteractionCore` +
    `recomputeLastContactCore`, then one `bumpDataRevisionCore`. Because `recomputeLastContact` is a
    correlated `MAX(occurred_at)` over current rows (`recency-dao.ts:164-176`) and all occurredAt = now,
    `last_contact` lands on `now` correctly — no stale/wrong recency, no double bump.
  - The **direction pin to `"outbound"` is genuinely required**: `insertInteraction` defaults
    `direction` to `null` (`recency-dao.ts:205` `i.direction ?? null`), and the canonical Quick Log shape
    is `direction:"outbound"` (`quick-log-command.ts:32`). The plan pins it explicitly — correct.
  - The **`connected:1` pin also matters**: the rarely_responds recompute filter is
    `rarely_responds = 0 OR i.connected = 1` (`recency-dao.ts:170`); pinning `connected=1` guarantees
    `last_contact` advances even for a rarely_responds contact. Plan 02 tests this exact case
    (Task 3 item 2) — good.
  - `undoBulkQuickLog`: per receipt entry, `deleteInteractionCore` (re-looks up the uid from the row, so
    the receipt needs only `{contactId, interactionId}` — correct), then one bump. A receipt entry
    matching 0 rows throws → whole undo rolls back (atomic). `rejectFutureOccurredAt(now, now)` up front
    only validates format (occurredAt===now), matching the single-contact path — correct.

One small accuracy caveat (LOW, below): `undoBulkQuickLog` adds a `bumpDataRevisionCore` that the
single-contact `deleteTouchpoint` does **not** call — so it is not strictly "behavior-identical," it is
slightly *more* correct. Not a defect.

---

## CROSS-CUTTING ASSESSMENT

- **No decision reversals found.** D-03..D-12 are all honored. No ADR (010/018/024/025/071/075) or
  HANDOFF entry is weakened. No control is removed by name.
- **Local-first invariants intact.** No network on any read/write path; no migration ships (D-03 — the
  frequency guard rides on the *existing* migration-011 CHECK, verified below); `localDateTime()` used,
  no `toISOString().split()`; theme tokens enforced via `check:colors` gates; animation is reduced-motion
  gated with an explicit "no per-frame setState" prohibition (28-07 Task 3). All good.
- **The single-recency-writer spine (ADR-010/024/071) and immutable-event trail (ADR-025) are composed,
  never bypassed** — `bulkQuickLog`→`recomputeLastContactCore`, `bulkArchive`→`archiveContactCore`→
  `recordEventCore`. Verified the source cores exist and are the right ones.
- **The `<flagged_assumption>` in 28-07 is a correctly-recorded owner-bucket escalation, and its facts
  check out.** Migration 011 has `CHECK (interval_days IS NULL OR (typeof(interval_days)='integer' AND
  interval_days>0))` (line 36) and `CHECK (tracking_enabled = 0 OR interval_days IS NOT NULL)` (line 37),
  plus the `contacts_prevent_cadence_clear` trigger (181-186). So setting a positive interval on an
  Unbound (`tracking_enabled=0`) contact IS schema-legal, exactly as the assumption states, and
  `setContactFrequencyCore` never writes NULL so it never trips the trigger. This is RESOLVED (owner
  decision surfaced with a safe default), not an unresolved finding — I do not count it.

**HIGH concerns: 0. Actionable MEDIUM: 1. Actionable LOW: 6.**

---

## PER-PLAN REVIEW

### 28-01 — Tracer: avatar-first grid + icon registry (CARDV-01/02/03)

**Summary.** Clean tracer. Replaces the legacy `ContactCard` card branch
(`HomeScreen.tsx:1091-1104`, verified — it renders `ContactCard` with `isFavourite` but no
`onToggleFavourite`, so the "non-functional star" claim is accurate) with a presentational `GridCard` +
virtualized `CardGrid`, and lands 7 registry icons. Reuses the shared status/favourite/recency primitives
rather than re-deriving them.

**Strengths.**
- Container-level view-mode swap inside the existing `resultTransitionStyle` Animated.View
  (`HomeScreen.tsx:1054`) with exactly one scroll container per mode — verified that today's code branches
  at `renderItem` level (`1058-1104`), so the plan's "move the branch up" instruction is grounded.
- `CardGrid` is required to thread the **full** shared list-surface contract explicitly (data-gating,
  `ListEmptyComponent` skeleton-vs-empty, `refreshControl` pull-to-refresh + error-retry, header,
  `bottomClearance`) — the cycle-1 gap is closed, and each threaded prop maps to a real prop on the
  current FlatList (`1105-1118`).
- `numColumns` re-mount key gotcha and Avatar `cacheBust=modified_at` recycling correctness both called
  out (Task 3).

**Concerns.**
- **LOW** — `28-01` frontmatter `depends_on: []`, `wave: 1`, but it and `28-02` both sit in wave 1 while
  the prompt's roadmap places `28-02` in wave 2. Files are disjoint (icons/grid vs DAOs), so parallel
  wave-1 execution is safe; this is a doc/label drift, not a correctness issue.

**Suggestions.** None blocking. Optionally note in the plan that `ContactCard` remains in use elsewhere
(it is imported by the current card branch only) so the executor does not delete it.

**Risk: LOW.**

### 28-02 — bulk-actions-dao: non-mutexed cores + 8 atomic composers (CARDV-07/08/10/11)

**Summary.** The highest-risk plan, and the most carefully specified. Every core extraction and composer
matches the real DAOs. This is where I concentrated verification (see HIGH-2 above).

**Strengths (all verified in source).**
- `archiveContact` (`contacts-dao.ts:536-563`) is exactly the mutexed body the plan lifts into
  `archiveContactCore` (UPDATE `WHERE id=? AND archived_at IS NULL` + `changes===1` + `recordEventCore`),
  and the wrapper keeps its trailing bump — the plan's "wrappers stay behavior-identical" instruction is
  correct.
- The plan correctly distinguishes `setContactPhotoCore` (`contacts-dao.ts:637-658`), whose public core
  *does* call `bumpDataRevisionCore` at :658 — and instructs the new category/frequency cores to copy
  only the single-column UPDATE + `changes===1` shape, **not** the trailing bump. This is the subtle trap
  it was warned about in cycle 1; it is handled.
- Correctly forbids routing category/frequency through `updateContactMetadataCore`
  (`contacts-dao.ts:312-339`), which clobbers `name/interval_days/tracking_enabled/social_battery/...` —
  verified that core rewrites the whole row.
- `setContactFrequencyCore` positive-integer guard is justified and doubly safe against both the
  `interval_days > 0` CHECK and the `contacts_prevent_cadence_clear` trigger (migration 011:36-37,181-186).
- events-dao comment fix is **factually warranted**: `events-dao.ts:18-20,37-38` still claims snooze/
  unsnooze have "no producer yet," but `snooze-dao.ts:103-110,136-143` already compose `recordEventCore`
  for `snooze`/`unsnooze`. Comment-only correction is right.
- Snooze cores: `snoozeContact`/`clearSnooze` (`snooze-dao.ts:79-146`) are mutexed twins composing
  `recordEventCore` in-txn; extraction to cores (minus `inWriteTransaction`/bump) is straightforward and
  the plan passes a fresh `newUid()` per contact for the event uid.

**Concerns.**
- **LOW** — Claim precision: `undoBulkQuickLog` is described as "behavior-identical to N single-contact
  deleteTouchpoint undos," but it adds one `bumpDataRevisionCore` that `deleteTouchpoint`
  (`recency-dao.ts:313-346`) does **not** call. The added bump is arguably *more* correct (an undo is a
  real data change the backup-freshness gate should see). Recommend editing the truth line to say
  "identical per-row reversal, plus a single data-revision bump the single-row path omits" so a future
  reader is not confused. (Side observation, out of scope: the single-contact touchpoint-delete path
  never bumps `data_revision`, so a lone Quick Log undo may not mark the DB dirty for backup — pre-existing,
  not this phase's to fix.)
- **LOW** — `bulkAddFavourites` idempotency: `setFavouriteRankCore` runs
  `favourite_rank = (SELECT COALESCE(MAX(favourite_rank),-1)+1 ...)` per contact; re-adding an existing
  favourite moves its rank. The plan's truth line already states "rank may move but membership is
  unchanged" (binary star reads `!== null`), which is correct per ADR-075 — no action needed, but worth a
  test asserting the star still reads membership after a rank move (Task 3 item covers "idempotent re-add"
  — good).

**Suggestions.** Apply the LOW claim-precision edit to the `undoBulkQuickLog` truth line. No functional
change required.

**Risk: LOW-MEDIUM** (data-layer, but exceptionally well grounded and test-gated with node:sqlite).

### 28-03 — dashboard-selection-store (CARDV-05/06/12)

**Summary.** Pure in-memory Zustand store (mode / selectedIds:Set / frozenUniverse), no persist, no DB.
Modeled on `dashboard-session-store`. Correctly frozen-universe semantics and `removeFromUniverse` on
both sets. Well tested.

**Strengths.** `enterSelection` re-entry no-op (never re-snapshots the frozen universe) directly enforces
D-12 / Pitfall-6; `removeFromUniverse` drops ids from both `selectedIds` and `frozenUniverse` so archived
cards can never re-enter via Select All. Grep-gate for `persist|updateAppSettings|getExecutor|AsyncStorage`.

**Concerns.**
- **LOW** — `depends_on: [28-01]` is spurious: a pure Zustand store imports nothing from the grid/icon
  work. This needlessly serializes it after 28-01 (harmless, just less parallelism). Could be `wave: 1,
  depends_on: []`.

**Suggestions.** Optionally relax the dependency. Otherwise none.

**Risk: LOW.**

### 28-04 — Card content: adaptive line-3 + search mode (CARDV-02/03)

**Summary.** Adds a compactness-biased line-3 selector reusing the shared `readLine3Candidates` read and
List's search-presentation helpers; widens the HomeScreen candidate-read gate to include card mode.

**Strengths.**
- Cycle-1 fix is properly reflected: compactness is a **within-tier tiebreak**, not an additive score, so
  a compact "other" candidate can never outrank an imminent meaningful date (truths line 22; Task 1
  mirrors `list-row-selection.ts:77-102` tier order). This is the right correction.
- Separate SHORT prompt list (not List's full-sentence PROMPTS), deterministic per contact via
  `contactId % len` — avoids flicker.
- Reuses the shared read; the gate-widening at `HomeScreen.tsx:601` is the correct mechanism (the list
  branch's `line3ByContactId`/`searchResult`/`searchSnippet` wiring at `1080-1086` is real and verified).

**Concerns.**
- **LOW** — I did not independently open `HomeScreen.tsx:601` (the `viewMode === "list" && !isListSearch`
  gate); I verified the surrounding list-branch wiring is real, which makes the claim plausible, but the
  exact line/condition is taken on the plan's word. Downgrade to an open item: the executor should
  confirm the gate's exact shape before widening it. Not asserted as wrong.

**Suggestions.** None blocking.

**Risk: LOW.**

### 28-05 — Long-press context menu (CARDV-04)

**Summary.** Locked 8-item per-contact menu composed from `Sheet`/`overlay-base` (not the text-only
`OverflowMenu`), routed to canonical flows, plus card-level accessibility actions.

**Strengths.**
- Cycle-1 fixes reflected: (a) the menu is composed from `Sheet`/`overlay-base`, with an explicit note
  that `OverflowAction` is text-only (label/onPress/disabled/accessibilityLabel/testID) and must not be
  handed icon rows; (b) card-level `accessibilityActions` + `onAccessibilityAction` on the GridCard
  itself (mirroring `ListRow.tsx:141-155`) so AT users reach actions without a long-press. Both are the
  right calls.
- Correctly excludes Delete/Archive from the long-press menu (SS M) and adds no swipe gesture (SS L).
- Tap vs long-press disambiguation via RN Pressable's mutual exclusivity is accurate.

**Concerns.**
- **LOW** — The menu's "Snooze" item routes to "the existing single-contact snooze flow," but
  `snoozeContact` requires a `SnoozePreset` (`snooze-dao.ts:39,79`). The plan does not say whether the
  single-tap Snooze presents the 3-preset picker or applies a default. If a profile snooze-preset picker
  already exists it is fine to reuse; the plan should name it so the executor doesn't invent an
  inconsistent affordance.

**Suggestions.** Name the concrete snooze-preset affordance the menu reuses (or state the default preset).

**Risk: LOW.**

### 28-06 — Multi-select mode (CARDV-05/06/12)

**Summary.** Turns the store + Select entry into the live surface: per-card selection control, tap-to-
toggle, count + announcement, control-area lock/replace, Select All over the frozen universe, Android
Back exits selection first. Enables the previously-disabled overflow "Select Contacts" entry.

**Strengths.**
- Verified the overflow entry is currently `disabled:true` with a no-op `onPress`
  (`dashboard-overflow-actions.ts:39-44`, testID `dashboard-select-contacts-entry`), so the "enable +
  wire onSelectContacts, keep testID, update its test" instruction is grounded.
- Control-area **replacement** (not a new bottom bar), frozen Select-All, and query-store non-mutation on
  enter/exit all directly enforce D-12.
- `BackHandler` hardwareBackPress returning `true` while selection is active (consuming Back before nav)
  is the correct pattern and is gated to focus.

**Concerns.**
- **LOW** — The frozen universe is seeded from "the current rows' ids." This is correct **only if `rows`
  is the complete result set**, not a virtualized page. In this codebase the dashboard read returns the
  full `DashboardRow[]` and FlatList virtualizes rendering only, so `rows.map(r=>r.id)` is the full
  eligible universe — but the plan should state that assumption explicitly so Select-All can never
  silently under-select. (No evidence it is paginated; flagged for confirmation, not asserted as a bug.)

**Suggestions.** Add a one-line note that `currentEligibleIds` must be the full result array (not a
windowed subset).

**Risk: LOW.**

### 28-07 — Bulk-action surface + count-aware routing + confirm/undo + archive-vanish + a11y (CARDV-07..12)

**Summary.** Wires Plan 02's DAO into the Plan 06 surface. Both cycle-1 HIGH fixes live here and are
sound (above). Explicit fav/snooze (no toggle-all), Archive non-destructive + `removeFromUniverse`,
Sensitive Ops = Frequency only, commit-truthful feedback, one widget/shell refresh per commit,
reduced-motion-gated transitions.

**Strengths (verified).**
- Uses `undoBulkQuickLog(receipt)`, explicitly **not** `createQuickLogUndoController` — verified the
  latter keys on a single `interactionId` (`universal-fab-logic.ts:64-79`) and genuinely cannot reverse N
  rows. Correct.
- `notifyWidgetDataChanged()` + `bumpShellRefresh()` once per commit mirrors the real single quick-log
  path at `HomeScreen.tsx:405-406` (verified) — a dashboard reload alone would leave the widget stale.
- No bulk Delete, no destructive confirm, no Gravity; Archive copy describes archiving not quarantine
  (D-07/D-08). Count-aware Log routing branches on `selectedIds.size` (1 → individual, 2+ → GroupLog,
  0 → disabled).

**Concerns.**
- **MEDIUM** — **Under-specified net-new pickers for bulk Snooze and bulk Set Category.** Task 2 says
  "surface the 3 presets" and "present the existing category options," but unlike the rest of this
  plan (which pins testIDs, a11y, confirm copy, and thresholds) these two selection UIs have no concrete
  affordance, testID, confirm/announcement copy, or a11y spec. There is no existing *bulk* preset/category
  picker to reuse (the single-contact flows differ), so the executor is left to invent them — risking an
  ad-hoc or inaccessible control in an otherwise meticulous surface. **Suggested PLAN.md change:** in
  28-07 Task 2, specify the affordance for `onSnooze` (which of the 3 `PRESET_MODIFIERS` presets, via what
  control) and `onSetCategory` (category source + picker component + testIDs like
  `bulk-snooze-preset-{id}` / `bulk-category-{id}`), and add their confirm/announcement copy to the
  Copywriting reference the plan already cites.
- **LOW** — CARDV-09 is only *partially* deliverable in this phase by design: 2+ Log routes to the
  `GroupLog` **placeholder**, which ignores `participantIds` until Phase 33. This is exactly what D-10
  decided (routing yes, group-logging no), so it is **not** a reversal or defect — but the owner should be
  aware that in a "release readiness" milestone, tapping Log Interaction with 2+ selected lands on a
  placeholder screen. Enforcing the decision, not reopening it; noted for owner visibility only.

**Suggestions.** Apply the MEDIUM picker-spec edit. No change to the routing/deferral (decided).

**Risk: MEDIUM** (breadth of UI wiring + the two under-specified pickers; the data-layer correctness it
depends on is owned and proven in Plan 02).

---

## CONSOLIDATED FINDINGS

| # | Sev | Plan | Finding | Fix |
|---|-----|------|---------|-----|
| M1 | MEDIUM | 28-07 | Bulk Snooze preset picker + bulk Set Category picker are net-new but unspecified (no affordance/testID/copy/a11y) | Specify both pickers + testIDs + confirm copy in Task 2 |
| L1 | LOW | 28-02 | `undoBulkQuickLog` "behavior-identical" claim is imprecise — it adds a bump `deleteTouchpoint` lacks (more correct, not identical) | Reword the truth line |
| L2 | LOW | 28-02 | `bulkAddFavourites` rank-move idempotency — correct per ADR-075; ensure a test asserts star reads membership after re-add | Confirm Task 3 covers it (it does) |
| L3 | LOW | 28-01/02 | Wave-label drift: 28-02 is wave 1 in frontmatter, wave 2 in the roadmap (disjoint files, harmless) | Align the roadmap label |
| L4 | LOW | 28-03 | `depends_on:[28-01]` is spurious for a pure store | Relax to `wave:1, depends_on:[]` |
| L5 | LOW | 28-04 | `HomeScreen.tsx:601` gate shape taken on the plan's word (surrounding wiring verified) | Executor confirms exact condition before widening |
| L6 | LOW | 28-06 | Frozen universe = "current rows' ids" is correct only if `rows` is the full result set | Add a one-line note it must be the full array |
| — | (owner) | 28-07 | Per-action eligibility `<flagged_assumption>` | Correctly recorded owner escalation — RESOLVED, not counted |
| — | (decided) | 28-07 | CARDV-09 2+ path terminates at a placeholder until Phase 33 | Per D-10; owner visibility only, do not reopen |

**HIGH: 0. Actionable MEDIUM: 1 (M1). Actionable LOW: 6 (L1-L6).**

## OVERALL RISK: **LOW-MEDIUM**

The data-layer core (28-02), which is where this repo's expensive bugs live, is correct-by-construction
and matches every referenced writer on disk. Both cycle-1 HIGH fixes are sound and introduce no
regression. The residual risk is concentrated in 28-07's UI breadth and its two under-specified pickers
(M1). No decision reversal, no local-first violation, no recency/event-trail bypass. Recommend applying
M1 and L1 before execution; L2-L6 are polish.
