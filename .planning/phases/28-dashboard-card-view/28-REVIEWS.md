---
phase: 28
reviewers: [codex, claude]
reviewed_at: 2026-09-06T06:33:28Z
plans_reviewed: [28-01-PLAN.md, 28-02-PLAN.md, 28-03-PLAN.md, 28-04-PLAN.md, 28-05-PLAN.md, 28-06-PLAN.md, 28-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-opus-4-8 (read-only subagent)"
model_sources:
  codex: "banner"
  claude: "subagent"
---

# Cross-AI Plan Review — Phase 28 (Dashboard Card View)

## Consensus Summary

Both reviewers independently verified the plans against the code on disk (every finding below carries `file:line` evidence; neither review ran without repo access). Both converge on a strong verdict for the phase's highest-risk work — the atomic bulk data layer. The core/wrapper extraction idiom the plans copy is the repo's shipped pattern (`bulk-review-dao.ts:72-137`), the non-reentrant write mutex is real and correctly respected (`mutex.ts:32-36`, `transaction.ts:49-64`), `bulkQuickLog` routes through the sole recency writer (`recomputeLastContactCore`, `recency-dao.ts:159-176`), and `bulkArchive` preserves the immutable lifecycle-event trail (`contacts-dao.ts:541-562`, ADR-025). **No decision reversal was found** — ADR-018 (no bulk delete; archive reversible; purge stays manual per-contact) and ADR-075 (binary favourite membership, rank never surfaces) are upheld; no migration ships (D-03); no network is introduced on any read path; `localDateTime()`/`formatLocalDate()` is mandated.

The reviewers **diverge on severity**. Codex raised three HIGH concerns; Claude raised none. The aggregator adjudicated each against the source:

- Codex HIGH-1 (Group Log preloaded participants) — **UPHELD as HIGH.** Real gap.
- Codex HIGH-2 (bulk Quick Log Undo contract) — **UPHELD as HIGH.** Real gap.
- Codex HIGH-3 (revision-bump: "copy `setContactPhotoCore`" would bump N times) — **DOWNGRADED to LOW (clarity).** Plan 02's explicit core specs (28-02:105-106) define the new category/frequency cores as bare single-column UPDATEs with no bump, and D-04 (28-02:22) mandates the bump exactly once per bulk transaction; the "copy the `setContactPhotoCore` shape" parenthetical (28-02:109) enumerates only the `?`-bound UPDATE + `changes===1` guard, not the bump. Claude independently reached the same conclusion (Plan 02 "correctly" mirrors the shape). An executor following the explicit core defs produces correct code; the only residual is wording that could be tightened.

### Agreed Strengths
- Mutex-safe composition: compose non-mutexed `*Core`s inside one `inWriteTransaction`, never loop a mutexed top-level writer (both reviewers, `transaction.ts:49-64`, `mutex.ts:32-36`).
- `bulkQuickLog` uses the single recency writer spine; `bulkArchive` keeps the immutable event trail (both, `recency-dao.ts:414`, `contacts-dao.ts:536-563`).
- Category/frequency use new single-column cores instead of the metadata-clobbering `updateContactMetadataCore`; frequency guard respects the migration-011 `CHECK(interval_days > 0)` + `contacts_prevent_cadence_clear` trigger (both, `contacts-dao.ts:637-658`, `011-...:36,181-186`).
- Ephemeral selection store correctly modeled (frozen universe, no persistence), unlike the persisted query store (both).
- GridCard reuses ListRow's verified shared status/ring/favourite primitives — no forked source, D-11 (both, `ListRow.tsx:105-275`, `contact-card-ring.ts`).

### Agreed Concerns
- **Plan 04 line-3 selection** — both flag that the compactness bias must not disturb the shared candidate read/tiering: codex on the type-only-import purity contradiction and the `viewMode === "list"` candidate gate; Claude on the additive-vs-tiered ranking mismatch. Same subsystem, complementary findings.

### Divergent Views
- **Group Log preloaded participants (CARDV-09).** Codex: HIGH blocker — the `GroupLog` route takes no params (`navigation/types.ts:34`), is a placeholder (`DashboardStack.tsx:38`), and the FAB deliberately "never preselects" (`universal-fab-logic.ts:92`), so Plan 07 cannot route 2+ "with participants preloaded" as written. Claude: did not flag. Adjudication: UPHELD — the requirement cannot be delivered without a route-param contract the plan does not define.
- **Bulk Quick Log Undo (CARDV-08).** Codex: HIGH — `createQuickLogUndoController` accepts one `interactionId` (`universal-fab-logic.ts:56`), `bulkQuickLog` writes N and returns no batch receipt (28-02:23), so Plan 07's "reuse the existing fast-action Undo contract" (28-07:118) can't reverse a batch. Claude: did not flag Undo (its Plan 02 MEDIUM was the interaction *shape*, a separate point). Adjudication: UPHELD — a genuine reversibility gap.
- **Revision-bump contradiction.** Codex HIGH vs Claude "correct." Adjudicated to LOW clarity (see above).

## Codex Review

_Model: gpt-5.6-terra (reasoning=low). Source-grounded (file:line citations present)._

## Summary

The plan sequence is strong on the core data invariants: it recognizes the non-reentrant write mutex, preserves the sole recency writer, and treats bulk archive as lifecycle-event-bearing rather than a raw update. However, two implementation blockers need resolution before execution: Group Log cannot currently receive preloaded participants, and bulk Quick Log has no viable atomic Undo design. There is also a contradiction in the proposed extracted-core/bump-revision contract.

## Strengths

- Plan 01 correctly replaces a legacy, non-interactive Card implementation. The current card branch renders `ContactCard` inside HomeScreen’s list `renderItem` at [HomeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:1055), and that component uses a literal `★` rather than the semantic icon registry at [ContactCard.tsx](/home/bwales/projects/orbit-app/src/components/ContactCard.tsx:181). The planned `GridCard`/`CardGrid` split is an appropriate correction.

- The card plans correctly reuse Dashboard-owned semantics rather than rederive them. `DashboardRow` already provides nullable `status`, `last_contact`, `snooze_until`, and favorite membership storage at [dashboard-read.ts](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:91). `ListRow` already composes snooze display state and ring rendering at [ListRow.tsx](/home/bwales/projects/orbit-app/src/components/ListRow.tsx:105).

- Plan 02 correctly identifies the mutex risk. Nested `inWriteTransaction` calls permanently deadlock by design, as documented and implemented in [transaction.ts](/home/bwales/projects/orbit-app/src/db/transaction.ts:12). The proposed “one outer transaction plus non-mutexed cores” is the required model.

- The recency and archive portions of Plan 02 align with actual code. `insertInteractionCore` and `recomputeLastContactCore` are exported specifically for caller-owned transactions at [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:414), while archive currently pairs its guarded update with `recordEventCore` at [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:536).

- Plan 03’s ephemeral Zustand model fits the existing store conventions and correctly freezes result membership. It avoids durable query-store behavior, which currently performs persisted writes via its settings-facing actions.

- Plan 04 correctly builds on a bounded, batched knowledge read: `readLine3Candidates` already deduplicates contact IDs and fetches candidate sources in three bounded reads, rather than per-row queries, at [dashboard-knowledge-read.ts](/home/bwales/projects/orbit-app/src/db/dashboard-knowledge-read.ts:161). Birthday exclusion is already implemented defensively in the list selector at [list-row-selection.ts](/home/bwales/projects/orbit-app/src/logic/list-row-selection.ts:42).

- Plan 06’s control-area replacement is compatible with the actual screen layout: `DashboardControlRow`, search, and view toggle are distinct regions at [HomeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:982). It can genuinely replace them without adding a bottom bar.

## Concerns

- **HIGH — Plan 07 cannot route 2+ selected contacts to Group Log with participants preloaded.** `GroupLog` is explicitly typed with no params at [navigation/types.ts](/home/bwales/projects/orbit-app/src/navigation/types.ts:30), its current screen is a placeholder at [DashboardStack.tsx](/home/bwales/projects/orbit-app/src/navigation/tabs/DashboardStack.tsx:37), and the FAB deliberately states Group Log “never preselects” at [universal-fab-logic.ts](/home/bwales/projects/orbit-app/src/components/universal-fab-logic.ts:91). This is a real phase-ordering/API blocker, not wiring work inside HomeScreen.

- **HIGH — Plan 07’s “small bulk Quick Log + Undo” is unspecified and cannot reuse the existing single-interaction Undo contract.** `bulkQuickLog` is planned to write N interactions, while `createQuickLogUndoController` accepts exactly one `{contactId, interactionId}` at [universal-fab-logic.ts](/home/bwales/projects/orbit-app/src/components/universal-fab-logic.ts:54). `runQuickLog` receives one returned interaction ID from `recordTouchpoint` at [quick-log-command.ts](/home/bwales/projects/orbit-app/src/services/quick-log-command.ts:86). The plan must define a returned batch receipt and an atomic batch-reversal writer—or drop Undo for bulk Quick Log.

- **HIGH — Plan 02 contradicts itself on revision bumps in extracted cores.** It requires all cores to omit `bumpDataRevisionCore`, with each bulk composer bumping once. But it says category/frequency cores should copy `setContactPhotoCore`; the actual photo core itself calls `bumpDataRevisionCore` at [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:637). Copying that full shape violates the “exactly once per bulk transaction” invariant. The new category/frequency cores need a no-bump core plus a public transaction-owning wrapper, matching the bulk-review pattern.

- **MEDIUM — Plan 04 has an internally conflicting purity criterion.** It directs `card-line3-selection.ts` to import the candidate type from `dashboard-knowledge-read`, but its acceptance criterion says the file must import “no `src/db` module.” The existing pure selector does use a type-only DB import at [list-row-selection.ts](/home/bwales/projects/orbit-app/src/logic/list-row-selection.ts:1). Permit type-only imports, or move the candidate type to a neutral module.

- **MEDIUM — Plan 04’s claim that it will reuse the existing candidate read needs an explicit change to the current view-mode gate.** HomeScreen only reads candidates when `query.viewMode === "list"` at [HomeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:601). The plan must amend that condition to include normal Card mode; otherwise Card mode has no candidate data to select from.

- **MEDIUM — Plan 05 does not meet its own accessibility requirement for card-level actions.** Making menu rows accessible after opening the menu is not equivalent to exposing actions on the card. `ListRow` demonstrates actual `accessibilityActions` plus `onAccessibilityAction` at [ListRow.tsx](/home/bwales/projects/orbit-app/src/components/ListRow.tsx:141). GridCard should expose at least Select, View Profile, Quick Log, Log Interaction, Message, and Edit through card accessibility actions.

- **MEDIUM — Plan 07 needs explicit widget/shell refresh handling after every successful bulk write.** HomeScreen’s single quick-log path calls both `notifyWidgetDataChanged` and `bumpShellRefresh` at [HomeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:394). A dashboard reload alone does not refresh widgets or other shell consumers. Bulk actions should perform these once after commit, not once per contact.

- **LOW — The plan describes `OverflowMenu` as a semantic-icon-compatible action-sheet pattern, but its current API supports only text rows.** `OverflowAction` contains label/callback/disabled/test ID only at [OverflowMenu.tsx](/home/bwales/projects/orbit-app/src/components/OverflowMenu.tsx:27). `CardContextMenu` and `BulkActionSurface` should either extend this API deliberately or compose the existing modal/sheet primitives directly.

## Suggestions

- Add a dependency/seam prerequisite before Plan 07: define a serializable Group Log draft route parameter, its participant-preload contract, and ownership in the Group Interaction Logging phase. Do not silently broaden Phase 28 to implement Group Event persistence.

- Change `bulkQuickLog` to return a batch receipt containing all inserted interaction IDs. If Undo remains required, add a dedicated atomic `undoBulkQuickLog(receipt)` DAO that deletes only those rows and recomputes recency for every affected contact in one transaction.

- Specify two layers for category and frequency:
  - non-mutexed, no-revision `*Core` functions for bulk composition;
  - public wrappers that open one transaction and bump revision once for standalone callers.

- Update Plan 04’s existing read condition to fetch candidates when the Dashboard is in either normal List or normal Card mode; preserve search behavior separately.

- Add source-level and behavior tests for:
  - Card accessibility actions;
  - one widget/shell refresh per committed bulk operation;
  - group-route participant handoff once the owning route exists;
  - bulk Quick Log Undo atomicity, if retained.

## Risk Assessment

**HIGH** until the Group Log handoff and bulk Quick Log Undo contracts are resolved. The remaining work is mostly well-contained and follows existing architectural safeguards, but these two gaps would either fail type-checking/current navigation behavior or produce an incomplete/incorrect user-facing bulk workflow.

---

## Claude Review

_Model: claude-opus-4-8, run as a read-only subagent (the `claude -p` reviewer lane is skipped inside Claude Code / has a known Write-permission gap). Source-grounded (file:line citations present)._

# Cross-AI Peer Review — Phase 28 (Dashboard Card View)

**Reviewer:** independent Claude reviewer (source-grounded against code on disk)
**Scope:** 28-01…28-07 PLAN.md + 28-CONTEXT.md, verified against src/db, src/components, src/screens, src/stores, src/logic, migrations, and ADR-018/ADR-075.

## 1. Summary

This is a strong, unusually well source-grounded plan set. Every high-risk data-layer claim I checked against the actual code held up: the non-reentrant mutex is real (`src/db/mutex.ts:32-36`, `src/db/transaction.ts:11-29`), the core/wrapper extraction idiom the plans copy is exactly how the repo already composes atomic writes (`src/db/bulk-review-dao.ts:72-137`, `src/db/contacts-dao.ts` `createContactFull`), and the cited extraction targets, ADRs, and line references are accurate (a welcome change from prior planning artifacts). No decision reversals: ADR-018 (no bulk delete; archive is the recoverable removal; purge stays manual per-contact) and ADR-075 (binary favourite membership, rank never leaks) are honored, and CARDV-01…12 are fully covered across the seven plans with correct wave serialization of the shared `HomeScreen`/`GridCard` edits. The concerns are **specification gaps, not architectural flaws** — chiefly (a) the bulk Quick Log interaction shape is left partly to defaults and diverges from the canonical single-contact Quick Log, and (b) the `CardGrid` prop contract omits the empty/error/loading/refresh/header/padding surface the plan's own must_haves require it to reuse. Both are fixable with plan-text edits; no re-architecture is needed.

## 2. Strengths

- **The mutex-composition strategy is correct-by-construction and matches the codebase.** Plan 02's rule "compose non-mutexed `*Core`s inside one `inWriteTransaction`, never loop a mutexed top-level writer" is exactly the constraint enforced by `src/db/transaction.ts:49-64` + `src/db/mutex.ts:32-36` (a nested `inWriteTransaction` is a permanent hang). The `*Core`/wrapper split is already the shipped idiom (`bulk-review-dao.ts:72-137`, `recency-dao.ts:414-428`).
- **bulkArchive preserves the immutable lifecycle-event trail (ADR-025).** The existing `archiveContact` already composes `recordEventCore` inside its one transaction with the `archived_at IS NULL` guard + `changes===1` throw (`contacts-dao.ts:541-562`); extracting `archiveContactCore` and looping it is behavior-identical, and the rollback-on-already-archived case (Plan 02 must_have + test) is guaranteed by that same guard.
- **bulkQuickLog routes through the sole recency writer (ADR-010/024/071).** `recomputeLastContactCore` is the MAX-based recompute (`recency-dao.ts:159-176`); composing `insertInteractionCore` + `recomputeLastContactCore` per id is the correct spine, and `rejectFutureOccurredAt` (`log-guards.ts:68-82`) throws synchronously before the transaction opens — Plan 02 calls it up-front, correctly.
- **Category/frequency correctly avoid the metadata-clobber writer.** `updateContactMetadataCore` rewrites the whole mutable column set (`contacts-dao.ts:316-333`); Plan 02 explicitly forbids routing single-column bulk ops through it and instead mirrors the single-column `setContactPhotoCore` shape (`contacts-dao.ts:637-659`). The `setContactFrequencyCore` positive-integer guard correctly respects migration 011's `CHECK (interval_days ... > 0)` (`011-contact-lifecycle-schema.ts:36`) and the `contacts_prevent_cadence_clear` trigger (`:181-186`) by never writing NULL.
- **No decision reversal.** ADR-018 is *Accepted / one-way* ("permanent deletion lives only in the Archived list; destructive UI uses the `danger` token") — Plan 07 keeps bulk delete out, makes Archive reversible, and styles Archive **non-destructive** (danger reserved for purge), which is consistent, not a weakening. ADR-075 (binary membership, rank never surfaces) is upheld: `GridCard` reads `favourite_rank !== null` for membership only (Plan 01 prohibition), matching the shipped list row (`HomeScreen.tsx:1071-1078`).
- **GridCard reuses the verified shared status/favourite primitives, no forked source (D-11).** ListRow's composition is exactly as the plan cites: `displayState = isSnoozed(...) ? "snoozed" : status` (`ListRow.tsx:106-108`), snooze→neutral ring via `ringVisual(null,...)` (`:110-113`, `contact-card-ring.ts:58-61`), star at `:251-266`, and the never-contacted glyph guard `displayState !== null ? <StatusGlyph/> : null` (`:267-275`). `statusGlyph`/`ringVisual` are the single source (`contact-card-ring.ts`).
- **Selection store is correctly ephemeral (contrast the persisted query store).** Plan 03's pure `create<T>()((set)=>...)` model matches `dashboard-session-store.ts:21-27` (no persist, no exec, no DB) and is deliberately unlike `dashboard-query-store` — the frozen-universe invariant (D-12) is sound and testable.
- **Requirements + waves.** CARDV-01…12 (`REQUIREMENTS.md:115-126`) each map to a plan; the shared `HomeScreen.tsx`/`GridCard.tsx` edits are serialized across waves (P01→P04→P05→P06→P07), and within wave 2 the parallel plans touch disjoint trees (P02 `src/db`, P03 `src/stores`, P04 `src/components`+`HomeScreen`), so there is no concurrent edit of a single file.
- **Local-first intact.** No new dependency, no network on any read path, `localDateTime()`/`formatLocalDate()` mandated (Plan 07), no migration (D-03) — all honored.

## 3. Concerns

- **MEDIUM — Plan 02 bulkQuickLog leaves the interaction field shape to defaults, diverging from the canonical Quick Log.** The plan's behavior spec passes only `{uid, occurredAt, source}` to `insertInteractionCore` (28-02 Task 2). The canonical single-contact Quick Log (`src/services/quick-log-command.ts:87-97`) writes `channel:"unspecified", direction:"outbound", connected:1, quality:null, source:"manual"`. `insertInteractionCore` defaults (`recency-dao.ts:140-142,204-209`) supply `connected=1`, `channel="unspecified"`, `source="manual"` — **but `direction` defaults to `null`, not `"outbound"`** (`recency-dao.ts:205`). So a bulk-logged interaction will differ from a normally-quick-logged one on `direction` (and, if the executor overrides any default, potentially `connected` — which the recompute filter `contacts.rarely_responds = 0 OR i.connected = 1` at `recency-dao.ts:170` depends on for rarely-responds contacts). `quick-log-command.ts` is **not** in Plan 02's read_first, so the executor has no pointer to the shape it must match. Mechanism: inconsistent `direction` feeds the intensity/gravity math differently for bulk vs single logs. *Fix:* pin the exact shape in the plan and add a test that (1) asserts the written row matches the canonical Quick Log fields and (2) asserts `last_contact` updates for a `rarely_responds=1` contact.

- **MEDIUM — Plan 01 CardGrid prop contract omits the shared empty/error/loading/refresh/header/padding surface it is required to reuse.** The must_haves (28-01) say the card branch reuses the shared `ListEmptyComponent`, loading skeleton, error state, and empty/error content. But today those are all owned by the *single shared FlatList* in `HomeScreen.tsx:1055-1119`: `data={error||showInitialSkeleton?[]:rows}`, `ListEmptyComponent={showInitialSkeleton?<ListLoadingSkeleton/>:listEmpty}` (`:1106`), `refreshControl` pull-to-refresh + error-retry (`:1111-1118`), `ListHeaderComponent={listHeader}` (`:1105`), and `contentContainerStyle` with `bottomClearance` (`:1107-1110`). Because a grid needs its own `numColumns` FlatList, these cannot be inherited implicitly — yet Plan 01 Task 3's CardGrid prop list is only `rows, now, onPressContact, favouriteOverlay, onToggleFavourite`. As written, a literal implementation loses pull-to-refresh, the "Pull down to try again" retry, the header, and bottom clearance in card mode. The parenthetical "mirror how the branch is chosen today" is misleading: today the branch is at *renderItem* level inside one FlatList (`:1058-1104`), not at container level. *Fix:* enumerate CardGrid's full prop contract (data-gating for error/skeleton, `ListEmptyComponent`, `refreshControl`, `ListHeaderComponent`, `contentContainerStyle`/`bottomClearance`) and state that HomeScreen selects container-level between the list FlatList and CardGrid while keeping both inside the `resultTransitionStyle` `Animated.View` (`:1054`).

- **MEDIUM — Plan 04's selectCardLine3 "additive compactness bonus" does not match the analog's tiered model.** `selectLine3` is not a scored function: it is strict priority tiers — imminent → pinned → other → prompt, with birthdays pre-excluded and ties broken by a stable `(createdAt,id,kind,type)` key (`src/logic/list-row-selection.ts:77-102`). Plan 04 says "reuse the List relevance ordering as the base, then apply a compactness bonus (additive)" — there is no base *score* to add to, and a naive flat-score rewrite could let a compact "other" candidate outrank an imminent meaningful date, contradicting both the analog and the plan's own "trivial short fact must not displace much more useful context." *Fix:* specify that compactness only breaks ties **within** a tier (preserving imminent > pinned > other and the birthday exclusion), and note that Card needs its **own short prompt list** — the existing `PROMPTS` (`list-row-selection.ts:5-16`) are long sentences, unsuitable for the compact grid ("Add a detail", etc.).

- **LOW — No per-action eligibility filtering of the frozen selection universe.** Bulk ops apply to every selected id regardless of contact type. `bulkSetFrequency` on an Unbound (`tracking_enabled=0`) contact is schema-legal (the `CHECK (tracking_enabled=0 OR interval_days IS NOT NULL)` at `011-...:37` is satisfied by any positive value) but semantically sets a cadence on an untracked contact; likewise bulk snooze on a never-contacted contact. The plans define the frozen universe as "eligible result universe" but never define per-action eligibility. Likely acceptable per the dossier, but worth an explicit owner confirmation rather than an implicit default.

- **LOW — Plan 02 `depends_on: [28-01]` is over-conservative.** Plan 02 is pure data layer (`src/db/*`) with no symbol or file dependency on Plan 01 (UI/icons/HomeScreen). It could run in wave 1 alongside P01, shortening the critical path. Harmless as-is; noting only because P02 is the phase's longest-pole work.

- **LOW — Stale doc comment left unaddressed.** `events-dao.ts:18-19,37-38` still claim `snooze`/`unsnooze` "have no producing feature," but `snooze-dao.ts:103-110,136-143` already produce them. Plan 02 correctly notes the comment is stale but does not schedule the one-line correction; leaving it invites a future agent to "reserve" an already-live event type.

## 4. Suggestions (concrete PLAN.md edits)

1. **28-02:** In Task 2 behavior and acceptance_criteria, pin `bulkQuickLog`'s interaction to `{channel:"unspecified", direction:"outbound", connected:1, quality:null, source:"manual"}` to match `runQuickLog` (`quick-log-command.ts:87-97`); add `src/services/quick-log-command.ts` to Task 2/3 read_first; add a test asserting the written columns and a `rarely_responds=1` recency-update case.
2. **28-01:** In Task 3, expand the `CardGrid` prop signature to thread `ListEmptyComponent`/loading, error data-gating, `refreshControl`, `ListHeaderComponent`, and `contentContainerStyle`/`bottomClearance`; add an acceptance criterion that card mode retains pull-to-refresh, error-retry, header, and bottom clearance. State that HomeScreen swaps at container level inside the existing `Animated.View` (`HomeScreen.tsx:1054`).
3. **28-04:** Reframe the ranking spec as "compactness breaks ties within the existing imminent→pinned→other tiers," not an additive score; require a separate short Card prompt list; keep birthday exclusion explicit.
4. **28-07 / 28-CONTEXT:** Add one line on per-action eligibility (does frequency/snooze apply to Unbound/never-contacted selected contacts?) — either confirm "applies to all selected" or filter. Owner-bucket if it changes product behavior.
5. **28-02:** Optionally correct the stale `events-dao.ts` producer comment as a trivial in-plan doc fix.
6. **Optional:** Move Plan 02 to wave 1 (drop `depends_on: [28-01]`) to parallelize the longest-pole data-layer work.

## 5. Risk Assessment

**Overall: MEDIUM (leaning low-medium).**

The highest-risk work — the atomic bulk data layer — is correct-by-construction, matches the repo's proven composition idiom, honors the single-recency-writer and immutable-event ADRs, and ships no migration; I verified each cited extraction target and constraint against the code. There are no decision reversals, no network on a read path, and full requirement coverage with sound wave ordering. What keeps this at MEDIUM rather than LOW is a cluster of **specification gaps in the plan text** — the bulk Quick Log interaction shape (a data-layer consistency issue in exactly the subsystem CLAUDE.md warns about), the underspecified CardGrid empty/error/refresh contract, and the mismatch between Plan 04's scoring language and the tiered selector it claims to mirror. None require re-architecture; all are closable by tightening the plans before execution. If suggestion (1) in particular is not adopted, expect a subtle bulk-vs-single Quick Log divergence that a diff-scoped review would miss.

---

## Aggregator Adjudication (verified against source on disk)

The following were re-verified by the aggregator by opening the cited files:

- `GroupLog: undefined` at `src/navigation/types.ts:34`; placeholder at `src/navigation/tabs/DashboardStack.tsx:38`; "never preselects here" at `src/components/universal-fab-logic.ts:92`. → Codex HIGH-1 holds.
- `createQuickLogUndoController` keys on a single `interactionId` (`src/components/universal-fab-logic.ts:56,64-75`); `bulkQuickLog` (28-02:23) writes N with no returned batch receipt. → Codex HIGH-2 holds.
- `setContactPhotoCore` calls `bumpDataRevisionCore` (`src/db/contacts-dao.ts:658`), but Plan 02's explicit core defs (28-02:105-106) omit any bump and D-04 (28-02:22) fixes the bump at once-per-bulk-transaction. → Codex HIGH-3 downgraded to LOW clarity.
- `HomeScreen.tsx:601` gates `readLine3Candidates` on `query.viewMode === "list"`; Plan 04 wires a card branch but never states the gate must be widened to card mode. → Codex MEDIUM (view-mode gate) holds.
- Plan 04 Task 1 source assertion (28-04:94) says "no `src/db` module" yet "reuses the candidate types from `dashboard-knowledge-read`" (which is `src/db`). The analog uses a type-only DB import (`list-row-selection.ts:1`). → Codex MEDIUM (purity criterion) holds; permit type-only imports.

**Unresolved HIGH concerns: 2** (Group Log preloaded participants; bulk Quick Log Undo contract).
**Actionable non-HIGH concerns not yet in any PLAN.md: 12** (see both reviews' Concerns/Suggestions — bulkQuickLog interaction shape; CardGrid prop contract; Plan 04 within-tier tiebreak + short prompt list; Plan 04 view-mode gate; Plan 04 type-only import; Plan 05 card accessibility actions; Plan 07 widget/shell refresh once per commit; OverflowMenu text-only API; per-action eligibility (owner-bucket if behavioral); revision-bump no-bump clarity; events-dao stale comment fix; Plan 02 depends_on over-conservative).

To incorporate feedback into planning:
  /gsd-plan-phase 28 --reviews
