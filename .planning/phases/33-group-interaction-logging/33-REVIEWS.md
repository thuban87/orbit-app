---
phase: 33
cycle: 2
reviewers: [claude, codex]
reviewed_at: 2026-09-12T07:45:00Z
plans_reviewed: [33-01-PLAN.md, 33-02-PLAN.md, 33-03-PLAN.md, 33-04-PLAN.md, 33-05-PLAN.md, 33-06-PLAN.md, 33-07-PLAN.md]
models:
  claude: "opus (read-only subagent)"
  codex: "gpt-5.6-terra (reasoning=high)"
model_sources:
  claude: "subagent"
  codex: "banner"
---

# Cross-AI Plan Review — Phase 33: Group Interaction Logging (Cycle 2)

> Cycle 2 of the convergence loop. The 7 plans were revised (commit 50e7d9f) to resolve cycle-1's
> 5 HIGH + 9 actionable findings. Both reviewers re-verified FRESH against the live repo, and the
> maintainer (orchestrator) independently verified every load-bearing claim below against the code
> on disk (`recency-dao.ts`, `transaction.ts`, `history-read.ts`, `interaction-detail-logic.ts`,
> `ai-context-read.ts`, `tombstones-dao.ts`, `purge-dao.ts`, `export-manifest.ts`,
> `TouchpointRefineForm.tsx`, `ContactPicker.tsx`, `navigation/types.ts`, the three tab stacks,
> and the phase dossier) rather than trusting the reviewers' summaries.

## Consensus Summary

**All 11 cycle-1 findings (5 HIGH + 6 actionable MEDIUM) are genuinely RESOLVED** — both reviewers
agree, and the maintainer verified each fix against source (not just plan prose):
backup durable-`groupEventUid` linkage (Plan 05), `history-read.ts` group-context activation moved
into Plan 01 (HIGH #2), the `EditParticipant` route owner (HIGH #3), the `visibleFields` API on
`TouchpointRefineForm` (HIGH #4), the nullable per-field `updateGroupEventShared` patch (HIGH #5),
plus title/parent-UID guards, the `{bumpRevision}` passthrough, the writer audit, the
parent-never-counts metric test, and the discriminated multi-select picker. The data-correctness
spine (migration 026, single-writer fan-out, Group-Note egress ban, non-reentrant-mutex avoidance)
is well-designed and respects every recorded ADR/HANDOFF/dossier decision — **no plan reverses a
recorded decision**, and the A3 orphan-repair outcome is correctly held owner-pending.

**However, cycle 2 surfaces 5 NEW HIGH concerns — the plan set is NOT converged.** The residual risk
has shifted from the data model (now sound) to (a) the UI/navigation-activation layer and (b) three
write-contract gaps where a UI affordance has no DAO persistence path. Both reviewers independently
raise the **cross-stack route registration** crash (consensus). Codex additionally found three
write-contract gaps and an irreversible-migration contradiction; the maintainer verified all four
against disk and confirms them. These are plan-completeness / correctness gaps, not decision
reversals.

### Agreed Strengths (2+ reviewers, maintainer-verified)
- The recency-spine composition (`createGroupEvent` → `insertInteractionCore` + `recomputeLastContactCore` in one `inWriteTransaction`, trailing `bumpDataRevisionCore`) mirrors the real `createContactFull` pattern; the `editTouchpointFullCore` extraction correctly avoids the non-reentrant-mutex hang (`transaction.ts:49-64`, `recency-dao.ts:281-337`).
- The Group-Note AI-egress ban is preserved by structural non-action — `ai-context-read.ts:108-152` reads only `channel/quality/connected` aggregates and no note column from any table; keeping `group_events` out of it is sufficient and test-guarded.
- Cycle-1 HIGH #1 fix is accurate to the line: `export-manifest.ts:52` really exports `c.uid AS contactUid` (durable) and omits `duration`/`allow_ai`/`group_event_id`, exactly as the handoff claims.
- HIGH #4/#5 blockers were real and are fixed first: `TouchpointRefineForm.tsx:90-99` had no visibility API; the nullable patch correctly distinguishes omit-vs-`{value:null}`.

### Agreed Concerns (HIGH — consensus)
- **Cross-stack route registration (Claude HIGH + Codex HIGH).** The three new routes (`GroupEventDetail`, `EditGroupEvent`, `EditParticipant`) are planned for `DashboardStack` ONLY (Plans 02/06/07; grep confirms zero `OrreryStack`/`SettingsStack` references). But they are navigated from the history surface (`HistorySection.tsx`, typed `NativeStackNavigationProp<RootStackParamList>` at `:146`), which is hosted by `ContactProfileScreen` — registered in all THREE stacks (`DashboardStack.tsx:45`, `OrreryStack.tsx:52`, `SettingsStack.tsx:59`). `RootStackParamList` is a TYPE intersection of all four stacks (`navigation/types.ts:246-249`), so `navigation.navigate("GroupEventDetail", …)` type-checks everywhere and `tsc --noEmit` (the plans' only wiring gate) passes — yet a group-linked interaction opened from an Orrery- or Settings(Archived)-hosted profile throws "no screen named …" at runtime. This is the EXACT class the repo already fixed for `EditInteraction`/`ThingsToRemember`/`MemoryHistory`, documented at `navigation/types.ts:195-215`. Fix: register the route types in `OrreryStackParamList`/`SettingsStackParamList` and the `Stack.Screen`s in `OrreryStack.tsx`/`SettingsStack.tsx`.

### Divergent Views
- **Overall risk: Claude MEDIUM vs Codex HIGH.** Not a factual disagreement. Claude deep-verified the data layer (sound) and raised the single navigation HIGH + the purge-dao compile break, rating MEDIUM. Codex audited the edit/lifecycle DAO contracts and UI write-paths more aggressively and found four further HIGHs (direction/connected inheritance source, `ge_follow_*` not persisted by the edit core, Group-Note/split-transaction save, membership scoping), rating HIGH. Maintainer verification sides with Codex on the factual basis of all four — they are real gaps — while agreeing with both that none is a decision reversal or data-loss-on-existing-data defect. Net: **HIGH**, 5 concerns.
- **A3 orphan-repair.** Codex wants a *blocking owner checkpoint* before `33-BACKUP-HANDOFF.md` is finalized (D-10 says the outcome must be *decided* this phase, not merely recommended). Plan 05 currently flags it `owner_pending` with a recommended default. This is an owner-bucket decision to surface, not an engineering fix — see "Owner escalation" below.

### Owner escalation (surface, do not auto-resolve)
- **A3 restore orphan-repair outcome (D-10).** Plan 05's `<flagged_assumption owner_pending>` recommends detach-to-standalone but defers execution to Phase 36. D-10 requires the *rule* be decided in Phase 33. Confirm the rule (detach-to-standalone vs orphan-drop) so it becomes a locked Phase-36 input. Already surfaced in the plan; included here so it is not lost.

---

## Claude Review

# Cross-AI Plan Review — Phase 33 (Group Interaction Logging), Cycle 2

## 1. Summary

This is a strong, source-grounded revision. All five cycle-1 HIGH findings and all six cycle-1 MEDIUMs are genuinely resolved, each with a fix verifiable against the actual code (not just asserted in plan prose). The data-layer spine — migration 026, the `createGroupEvent` fan-out composing `insertInteractionCore`/`recomputeLastContactCore`, the newly-extracted `editTouchpointFullCore`, the `{bumpRevision}` passthrough, and the structural Group-Note egress ban — is correctly designed against the real `recency-dao.ts`/`transaction.ts`/`ai-context-read.ts` contracts, and the decision-reversal tripwires (D-04/D-05/D-07, ADR-010/024/071/078) are respected. The A3 orphan-repair outcome is correctly held as owner-pending rather than implemented — proper escalation discipline. However, this cycle found **one new HIGH** the plans do not address: the three new group routes are registered only in `DashboardStack`, but they are reachable from the history surface, which is hosted in the Orrery and Settings stacks too — a runtime "route not handled" crash that `tsc --noEmit` (the plans' only wiring gate) cannot catch because `RootStackParamList` is a type intersection. This is the exact regression class the repo already fixed once for `EditInteraction`/`ThingsToRemember` (`navigation/types.ts:195-209`). There is also a **MEDIUM** compile-break: adding the `group_event` tombstone type breaks an exhaustive `Record<TombstoneEntityType,…>` that no plan updates.

## 2. Strengths (verified against source)

- **The recency-spine composition is correct and matches the real primitives.** `createGroupEvent` (Plan 01) mirrors `createContactFull` exactly: `rejectFutureOccurredAt` before the txn, one `inWriteTransaction`, `insertInteractionCore` + `recomputeLastContactCore` per participant, trailing `bumpDataRevisionCore`. Verified against `src/db/recency-dao.ts:238-265,446-460` and `src/db/transaction.ts:49-64`. The non-reentrancy hazard is real and the `editTouchpointFullCore` extraction (Plan 01 Task 4) is the right structural fix — `editTouchpointFull` is currently the mutexed wrapper at `recency-dao.ts:281-337`, with no core yet.
- **The Group-Note AI-egress ban is preserved by non-action, and that is genuinely sufficient.** `ai-context-read.ts:108-152` selects only `channel, quality, connected` aggregates plus name/category/fuel/memories/custom-values and reads **no `note` column from any table** — confirmed at `ai-context-read.ts:117-122`. Keeping `group_events` out of this file (Plan 01 refuses to edit it) structurally prevents egress. The extended `ai-context-read.test.ts` assertion (group_note absent under `allow_ai` 0 and 1) is a sound regression guard.
- **Cycle-1 HIGH #1 fix is accurate down to the cited line.** Plan 05's `33-BACKUP-HANDOFF.md` serializes the link as durable `groupEventUid`, explicitly forbidding the local int on the wire, "mirroring how interactions already export `contactUid`." Verified at `export-manifest.ts:52`.
- **The writer audit correctly identified the exceptional interactions writers.** `restore-apply.ts:201` is a separate `INSERT…ON CONFLICT` that forces `allow_ai=0` and does not recompute `last_contact`; `purge-dao.ts:82` is a raw contact-scoped `DELETE`. Both correctly noted as intentionally outside the group-lifecycle path.
- **HIGH #4 was a real blocker and is properly fixed first.** `TouchpointRefineFormProps` is today exactly `{value, onChange, now, testID}` (`TouchpointRefineForm.tsx:90-99`) with no visibility API; Plan 06 Task 1 adds `visibleFields` (default all-visible) as a prerequisite, keeping the sole caller `EditInteractionScreen` unchanged.
- **HIGH #5 nullable-patch contract is well-specified.** Plan 03's per-field ops map correctly distinguishes "omit = leave unchanged" from "`{value:null}` = unset," satisfies D-09, and commits multi-field edits atomically with one trailing bump.
- **The single-bump accounting is internally consistent.** `insertTombstoneCore` already accepts `{bumpRevision = true}` (`tombstones-dao.ts:64`); `deleteInteractionCore` currently self-bumps. Plan 01 adds the passthrough; Plan 05 lifecycle ops pass `{bumpRevision:false}` inner and own one trailing bump.

## 3. Concerns

### HIGH — New group routes registered only in `DashboardStack`; reachable from Orrery/Settings-hosted profiles → runtime crash invisible to `tsc`
Plan 02 adds `GroupEventDetail`/`EditGroupEvent`/`EditParticipant` to the Dashboard stack param list only; Plans 06/07 register their screens in `DashboardStack.tsx` only. But these routes are navigated from the **history surface**: `HistorySection.tsx` (rendered by `ProfileModuleHost` → the contact profile) supplies `onViewGroupEvent`/`onEditGroupEvent`/`onEditParticipant`/`onConvertToGroup`, all of which `navigation.navigate(...)` to the new routes (Plan 07 Task 3). The contact profile is registered in **all three** stacks — `DashboardStack.tsx:45`, `OrreryStack.tsx:52`, `SettingsStack.tsx:59` — and `EditInteraction` is registered in all three precisely for this reason (`DashboardStack.tsx:60`, `OrreryStack.tsx:64`, `SettingsStack.tsx:73`). `RootStackParamList` is the **intersection** of all four stack param lists (`navigation/types.ts:246-249`), so adding the routes to only `DashboardStackParamList` still makes `navigation.navigate` type-check **everywhere**, and `npx tsc --noEmit` (the sole automated wiring gate in Plans 06/07) passes. This is exactly the bug `navigation/types.ts:195-209` documents having already fixed for `ThingsToRemember`/`MemoryHistory`/`EditInteraction`. Fix: register the route **types** in `OrreryStackParamList`/`SettingsStackParamList` and the **Stack.Screen**s in `OrreryStack.tsx`/`SettingsStack.tsx`, mirroring `EditInteraction`.

### MEDIUM — Adding the `group_event` tombstone type breaks the exhaustive `Record<TombstoneEntityType,…>` in `purge-dao.ts`; no plan updates it
Plan 01 Task 2 adds `"group_event"` to the `TombstoneEntityType` union (`tombstones-dao.ts:8-22`) and `assertTombstoneEntityType`. But `src/db/purge-dao.ts:80` declares `const PURGE_CHILDREN: Record<TombstoneEntityType, PurgeChildSpec | null>` as an object literal with exactly the current members. Adding a new union member makes this literal fail `Record`-exhaustiveness (TS2741, "Property 'group_event' is missing"). The correct disposition is `group_event: null` (a group event has no `contact_id`; the loop at `purge-dao.ts:293-322` skips null specs like `contact`/`custom_field_def`). No plan adds this entry, and **Plan 01's `<verify>` runs only `vitest` + `check:colors`, not `tsc --noEmit`**, so the break surfaces as a confusing compile failure in a sibling Wave-1 plan (Plan 02 runs `tsc`) rather than where the change was made. Fix: add `group_event: null` to `PURGE_CHILDREN` in Plan 01's scope and add `tsc --noEmit` to Plan 01's verify.

### LOW — `history-read.ts` LEFT JOIN introduces ambiguous unqualified columns
Plan 01 Task 3 adds `LEFT JOIN group_events ge` to `SELECT_INTERACTIONS`, but that SELECT lists `id, occurred_at, channel, quality, duration` **unqualified**. `group_events` shares those names (migration 026 shape), so post-JOIN they become ambiguous → SQLite "ambiguous column name." The plan qualifies only the new columns. Self-limiting (the task's own tests catch it), but the plan text should call out `i.`-qualifying the existing columns.

### LOW (positive) — A3 orphan-repair correctly escalated
Plan 05's `<flagged_assumption owner_pending>` holds the orphan outcome as owner-pending and does not implement it or touch `export-manifest.ts`/`restore-apply.ts` (D-10). Verified consistent with dossier §AC. Proper escalation, not a reversal.

## 4. Suggestions
1. Add `OrreryStackParamList`/`SettingsStackParamList` route types + `OrreryStack.tsx`/`SettingsStack.tsx` screen registrations for the three group routes, mirroring `EditInteraction`. Add a device-UAT step opening a group-linked interaction from an Orrery-hosted and Settings(Archived)-hosted profile.
2. Add `group_event: null` to `PURGE_CHILDREN` within Plan 01, and add `npx tsc --noEmit` to Plan 01's verify.
3. State explicitly in Plan 01 Task 3 that pre-existing `SELECT_INTERACTIONS` columns must be `i.`-qualified once the JOIN is added.
4. Plan 02's classification test should assert the `isFocusedWorkflow` default explicitly.

## 5. Risk Assessment: **MEDIUM**
The data correctness core is well-designed and the cycle-1 findings are genuinely closed with source-verified fixes (LOW risk there). Residual risk lives in the UI/navigation-activation layer: one reachable user-facing crash on a core flow that the plans' gate structurally cannot catch, plus one compile-break omission. Both are small, well-understood edits.

## Cycle-1 Finding Re-Verification
- **HIGH #1 (backup UID linkage): RESOLVED** — Plan 05 Task 3 serializes `groupEventUid`; `export-manifest.ts:52` confirms the `contactUid` pattern mirrored.
- **HIGH #2 (history-read group context): RESOLVED** — moved to Plan 01 (`files_modified:17`, Task 3); current code still inert (`history-read.ts:174` `isGroupLinked({})`); Plan 07 adds `HistorySection.tsx` and fixes the `InteractionDetail.tsx:178` mis-wire (verified on disk, as is the `:215-218` no-op).
- **HIGH #3 (edit-individual route): RESOLVED at Dashboard level** — Plan 02 route type + Plan 06 `EditParticipantScreen` owner + Plan 07 wiring. (Cross-stack gap reopens a *runtime* failure on this path — see new HIGH.)
- **HIGH #4 (TouchpointRefineForm visibility): RESOLVED** — verified no API today; Plan 06 Task 1 adds `visibleFields` default all-visible.
- **HIGH #5 (nullable patch): RESOLVED** — Plan 03 per-field ops map + tests.
- **MEDIUM title nonblank: RESOLVED** (Plan 01 create, Plan 05 convert). **convert parent UID: RESOLVED** (Plan 05). **tombstone multi-bump: RESOLVED** (Plan 01 passthrough + Plan 05 usage). **writer audit: RESOLVED as an audit, but missed the exhaustive `Record` type consumer** (purge-dao — see MEDIUM). **parent-never-counts test: RESOLVED** (Plan 01 contact-status-read). **multi-select discriminated union: RESOLVED** (Plan 02 + tsc gate).

---

## Codex Review

# Phase 33 Plan Review — Cycle 2

Overall: the revised plans substantially improve the prior version. The durable backup UID link, live history seam, route owner, visibility API, nullable shared-value patch, title/UID guards, and revision-bump strategy are all now explicitly planned. However, there are still several HIGH blockers in the data model and edit/lifecycle contracts. I would not freeze migration 026 or execute Plan 03/05/06/07 until those are resolved.

No plan proposes reversing a recorded ADR, HANDOFF decision, or dossier decision. The Group Note egress ban and recency-spine requirements are preserved.

## Cycle-1 finding recheck
- Backup linkage: resolved. Plan 05 correctly specifies durable `groupEventUid`, not local `group_event_id`.
- History group-context activation: resolved. Plan 01 now changes `history-read.ts` (currently selects no group ID and hard-codes `groupLinked` false).
- Participant editor route: partially resolved. `EditParticipant` exists in the Dashboard plan, but not the Orrery or Settings stacks that can also host a Profile/History surface.
- `TouchpointRefineForm` visibility: resolved in planning.
- Nullable shared patch: resolved. The explicit `{ value }` operation shape correctly distinguishes omission from clearing to `null`.

## Plan 01 — Data spine
Strengths: mirrors the single-writer composition; activates the history seam without touching the AI egress read; adds DAO-level title/parent-UID validation; the partial unique-index rationale is now accurate.

Concerns:
- **HIGH — schema cannot support "Follow event direction/connected."** The parent schema contains only `channel`, `quality`, `duration`; it has no event-level `direction` or `connected`. Yet every child starts with `ge_follow_direction` and `ge_follow_connected` set to `1` (Plan 01), and Plan 03 says clearing either override resolves from the "current event value," which does not exist. This must be decided before the irreversible migration checkpoint.

Risk: **HIGH** until the direction/connected inheritance source is explicitly designed and approved.

## Plan 02 — Picker and routes
Strengths: extending the existing picker is correct; the union prevents a multi-select mode from accidentally calling a single-select callback; `EditParticipant` is a concrete route contract.

Concerns:
- **MEDIUM — focused-route classification does not install a discard guard.** It only hides the tab bar and controls route density (`focused-route-classification.ts`, `RootNavigator.tsx:176`). Actual discard protection requires each screen to call `useDiscardKeepGuard` (`discard-keep-guard.ts:15`). Plan 06 should add dirty-state baselines + that hook to all three authoring screens.

Risk: **MEDIUM**.

## Plan 03 — Live inheritance and overrides
Strengths: the nullable patch + single-transaction fan-out are strong; correctly avoids nesting `inWriteTransaction`; accounts for the full-row update requirement.

Concerns:
- **HIGH — `editTouchpointFullCore` cannot save `ge_follow_*`.** The planned override mechanism says "set the target `ge_follow_<field>`" then write through the extracted edit core. But the real edit statement only updates ordinary interaction fields (`recency-dao.ts:303`) — it has no follow-flag columns. Plan 03 needs an explicit, scoped flag update in the same transaction, plus rollback tests.
- **HIGH — override/clear operations do not require the child to belong to `groupEventId`.** The inputs include `groupEventId`, but the task only reads the child and edits by interaction/contact IDs; the edit core scopes only `(id, contact_id)` (`recency-dao.ts:314`). A stale/malformed route could apply Group A's event value to a standalone or Group B child.
- **MEDIUM — participant notes have no persistence method.** The participant editor must expose a note, but Plan 03 accepts only the five structured fields.

Risk: **HIGH**.

## Plan 04 — Read layer
Strengths: explicit projections, deterministic order, `EXISTS`/dedup search, resolved participant projection.

Concerns:
- **LOW — specify an actual `LIKE … ESCAPE` clause and tests** for literal `%`, `_`, and the chosen escape character (`33-04-PLAN.md:95`).

Risk: **LOW**.

## Plan 05 — Lifecycle, conversion, backup handoff
Strengths: keeps the child UID while requiring a distinct parent UID on conversion; avoids FK cascade; suppresses inner revision bumps; durable UID linkage on the wire format.

Concerns:
- **HIGH — lifecycle methods accept an unverified UID separate from the deleted event ID.** The plan deletes by `groupEventId` but writes the tombstone using caller-supplied `uid` (`33-05-PLAN.md:154`). A mismatched input can delete Group A while tombstoning Group B. Fetch the parent by ID inside the transaction, assert it exists, and derive the tombstone UID from that row.
- **HIGH — remove/detach methods do not scope the child to its group.** `deleteGroupChild` receives only interaction/contact IDs and `detachParticipant` only interaction ID. Both must require `groupEventId` and assert `interactions.group_event_id = ?` before mutation.
- **MEDIUM — A3 is still owner-pending, despite D-10 requiring the outcome to be decided this phase.** Add a blocking owner checkpoint before finalizing `33-BACKUP-HANDOFF.md`.

Risk: **HIGH**.

## Plan 06 — Create/edit/participant forms
Strengths: `visibleFields` reuse; Group Log defaults + zero-participant UX; three-way participant-remove Sheet distinguished from a binary confirmation.

Concerns:
- **HIGH — one Edit Group Event save is split across transactions.** The plan calls `updateGroupEventShared` and `updateGroupEventDate` separately (`33-06-PLAN.md:190`). If one commits and the other fails, the form has partially persisted, contrary to the atomicity decision (GRP-11/D-08). Add a single `updateGroupEvent` core/wrapper accepting date, shared patch, and note, with one future guard, one transaction, one revision bump.
- **HIGH — Group Note is editable in the UI but no DAO operation persists it.** Plan 03's patch permits only channel/quality/duration; Plan 06 nevertheless says the form edits Group Note (`33-06-PLAN.md:190`).
- **MEDIUM — participant-note editing has the same missing write contract.**
- **MEDIUM — add explicit dirty-state/discard-guard work.** Route classification alone does not protect unsaved title/note/participant/shared-field changes.

Risk: **HIGH**.

## Plan 07 — Detail, browse, history activation
Strengths: explicit navigation callbacks eliminate the overloaded `onEdit` bug (verified: `InteractionDetail.tsx:178` routes "View Group Event" to `onEdit`, `:215` leaves `onEditGroup` a no-op); adding `HistorySection.tsx` finishes the history seam; browse/detail use the new read layer.

Concerns:
- **HIGH — routes registered only in Dashboard, but Profile/History is also hosted in Orrery and Settings stacks.** Plan 07 only edits `DashboardStack`. Existing route definitions explicitly duplicate `EditInteraction` into Orrery and Settings because a Profile in either stack otherwise navigates to an unregistered route (`types.ts:190-209`). Add `GroupEventDetail`/`EditGroupEvent`/`EditParticipant` to those stack types and register the screens there.
- **MEDIUM — Android conversion title entry is unspecified.** "Prompt for a nonblank event title" creates no Sheet/TextInput component or route (`33-07-PLAN.md:170`). Define a reusable in-app input Sheet; do not rely on an unspecified platform prompt.
- **MEDIUM — detail-card "Remove from group" refers to a Sheet local to another screen.** Plan 07 needs a shared callback/controller or its own correctly wired three-option Sheet (`33-07-PLAN.md:139`).

Risk: **HIGH**.

## Required replanning changes
1. Before the migration checkpoint, decide and encode the inheritance source for Direction and Connected; the current parent table cannot support the promised follow semantics.
2. Add a single atomic edit operation covering event date, shared patch, and Group Note.
3. Make override and lifecycle DAO operations verify parent/child membership and derive parent UID internally.
4. Add explicit persistence for follow flags, participant notes, and Group Note.
5. Add all group routes/screens to every stack that can host HistorySection/Profile.
6. Add a concrete Android-compatible title-entry UI for conversion.
7. Add an owner checkpoint to decide the restore-orphan rule before the Phase 36 handoff is finalized.

---

## Maintainer verification notes (orchestrator)

Every load-bearing claim above was checked against the code on disk, not taken from the reviewers:
- `recency-dao.ts:303-326` — the `editTouchpointFull` UPDATE sets `occurred_at, channel, direction, connected, quality, note, duration, allow_ai, modified_at` and **no `ge_follow_*` columns**, scoped by `(id, contact_id)` only. Confirms Codex's "core can't persist follow flags" and "no group-membership scoping" HIGHs.
- `purge-dao.ts:80` — `PURGE_CHILDREN` is an exhaustive `Record<TombstoneEntityType, …>`; the only exhaustive consumer of the union in `src/` (restore-apply imports tombstones generically). Confirms the compile-break MEDIUM.
- dossier §E/§G/§L — event-level shared/inherited values are Channel/Tone/Duration; the inheritance example uses only Tone+Duration; Direction/Connected are participant fields "where relevant" with no event-level value. Confirms the direction/connected inheritance-source HIGH is a real internal contradiction (not a dossier reversal).
- `navigation/types.ts:246-249` (intersection) + `types.ts:195-215` (documented prior fix) + stack registrations — confirms the cross-stack HIGH.
- Plan 06:190 (`updateGroupEventShared` + `updateGroupEventDate` as separate calls; "edit … Group Note") + Plan 03:145 (patch = channel/quality/duration only; no group_note; no `updateGroupEventNote` anywhere) — confirms the split-transaction and Group-Note-write-path HIGHs, and the participant-note MEDIUM.
