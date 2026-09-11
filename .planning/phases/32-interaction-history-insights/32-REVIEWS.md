---
phase: 32
reviewers: [codex, claude]
reviewed_at: 2026-09-11T20:06:10Z
plans_reviewed: [32-01-PLAN.md, 32-02-PLAN.md, 32-03-PLAN.md, 32-04-PLAN.md, 32-05-PLAN.md, 32-06-PLAN.md, 32-07-PLAN.md, 32-08-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-opus-4-8 (read-only subagent, repo-grounded)"
model_sources:
  codex: "banner"
  claude: "orchestrator-subagent"
---

# Cross-AI Plan Review — Phase 32

Both lanes reviewed against the actual source on disk (not plan text alone). The
`interactions` table is shared and Phase 32 owns migration 025 that rewrites its
`quality`/`channel` VALUES in place; both reviewers enumerated the table's writers
before asserting invariants, per the project rule. Lanes that ran: **codex**
(gpt-5.6-terra, reasoning=low) and **claude** (Opus 4.8 read-only subagent). No lane
was dropped; both produced full, file:line-cited reviews.

## Consensus Summary

The migration itself — the phase's self-identified highest risk — is its **best-handled**
area, and both reviewers verified this against source: `interactions.quality`/`channel`
are CHECK-less (`001-initial.ts:103,106`) so the `ALTER ADD COLUMN + UPDATE ... CASE`
remap needs no table rebuild; head is correctly re-derived (`profile-presentation.ts:4`
= v24 → 025 next); the value-comparison consumer list (`ai-context-read.ts:132-136`,
`digest-read.ts:158-161`) is complete; `interaction_assists.channel` transport CHECK is
correctly left untouched; the recency single-writer spine and immutable-events contract
are consumed, not bypassed; local-first, theme-token, `formatLocalDate`, and Skia/worklet
discipline are all honored with mechanical grep gates.

The residual risk is concentrated in **cross-phase seams and route wiring**, where the two
reviewers diverge on severity: codex rates the phase **HIGH ("do not execute unchanged")**
and raises a HIGH per affected plan; claude rates it **MEDIUM**, folding routes/restore into
MEDIUM and reserving its single HIGH for the group/Phase-33 coupling. The orchestrator note
(reviewing the code on disk) confirms the load-bearing claims from both: no `group_events`
schema exists today; `SettingsStack.tsx:55` hosts Profile but Plan 04 registers
`EditInteraction` only in Dashboard+Orrery; `LogContact` is `LogContactPlaceholderScreen`
(`DashboardStack.tsx:37`); `restore-apply.ts:189` inserts `quality` verbatim with no remap.

### Agreed Strengths
- **Migration 025 is additive/forward-only and correctly numbered (025), with a complete, grep-verified consumer list.** (both) `interactions` is CHECK-less so no rebuild; `allow_ai INTEGER NOT NULL DEFAULT 0 CHECK(allow_ai IN (0,1))` mirrors the `memories.allow_ai` precedent.
- **The recency-DAO single-writer spine is consumed, not bypassed** (`editTouchpointFull` scopes by id AND contact_id, asserts changes===1, recomputes recency; `deleteTouchpoint` writes the tombstone in-txn). Plans 04/07 route through these exact entry points. (both)
- **`interaction_assists` transport CHECK (`call|text|email`, `014-interaction-assists.ts:12`) is correctly preserved**, with vocabulary mapped at log time in `markAssistLogged`. (both)
- **Privacy gate is fail-closed:** `allow_ai` defaults 0/OFF, sparkle strictly gated on `allow_ai===1`, and Phase 32 does not wire note egress. (claude; consistent with codex)

### Agreed Concerns (highest priority — raised or corroborated by both)
- **[HIGH] Group-linked behavior (HIST-16/17, D-10 group clauses) in Plans 03 & 07 depends on Phase-33 schema that does not exist yet.** No `group_event_id` column and no `group_events` table exist in `src/` (only an empty placeholder screen); D-07 places that linkage in Phase 33 (migration 026+). Plan 03 Task 3 asserts a "group-parent+child pair, parent excluded from counts" acceptance criterion that is **not constructible** against the Phase-32 schema; Plan 07 renders group context/note/"View Group Event" keyed on the missing field. **Escalation, not a closeable finding:** the wrong resolution — an executor adding `group_event_id` to migration 025 to make the fixture pass — reverses D-07 (an owner-recorded sequencing decision). Reframe as an inert seam (group predicate hard-false until Phase 33), drop the not-yet-representable fixtures, and surface to the owner. (codex HIGH ×2 plans; claude HIGH + explicit D-07 reversal trap)
- **[HIGH] The restore/export path re-opens the vocabulary miscount the migration closes.** `restore-apply.ts:189` INSERTs `interactions.quality`/`channel` from the backup **verbatim**; `export-manifest.ts:52` serializes them raw; `BACKUP_FORMAT_VERSION` stays 4. A format-4 backup captured *before* Phase 32 (values `good`/`fine`/`hard`, `text`/`email`) restored onto a v25 device lands legacy literals that migration 025 never re-remaps, so `ai-context-read.ts:132` / `digest-read.ts:158` silently miscount — the same D-06/Pitfall-1 failure via the restore backdoor. No plan or clearly-chartered Phase-36 item covers value-remap-on-restore. (codex HIGH — framed as widened-schema; claude MEDIUM — framed as vocabulary miscount; orchestrator verified the vocabulary angle against source)
- **[HIGH] New Edit/Log routes are not reachable from a Settings-originated Profile.** Profile is hosted in three stacks (`Dashboard:44`, `Settings:55`, `Orrery:50`), but Plan 04 registers `EditInteraction` only in Dashboard+Orrery (mirroring `Edit`), and `LogContact` lives only in Dashboard. React Navigation throws on an unregistered route name. Register both in all Profile-hosting stacks (or at RootStack) and make it a hard acceptance criterion, not a Plan-08 backstop. (codex HIGH; claude MEDIUM)

### Divergent Views
- **Overall severity: codex HIGH vs claude MEDIUM.** Codex treats each under-specified downstream plan as an independent HIGH blocker; claude judges the migration foundation solid enough that the phase is MEDIUM and drops to LOW once the group coupling + restore gap are resolved. Both agree the plan set should not execute unchanged.
- **Plan 01 checkpoint (quality→tone rename gate):** codex rates HIGH — the roadmap/D-06 already settle "keep the `quality` column," so presenting the rename as a blocking owner choice reopens a settled decision (and risks a reversal if an executor picks rename). Claude read the same checkpoint as merely confirming the irreversible mechanics and did not flag it. Treat as: remove the redundant rename option, keep "retain `quality`" as a plan invariant.
- **Plan 03 intensity window-scoping:** codex HIGH — `computeContactIntensity` (`impact.ts:134`) computes its own cadence-sized period over all `ImpactInputs.interactions` (`impact-read.ts:55`), so a wrapper cannot truthfully claim "same selected Heatmap window" without a new window-aware intensity API. Claude did not separately raise this. Worth resolving before Plan 05 consumes it.

---

## Codex Review

# Phase 32 Plan Review

Overall: **HIGH risk; do not execute unchanged.** The migration/recency discipline is strong, but several plans depend on Phase 33 schema and routes that do not exist yet, and Plan 01 reopens a decision already locked in the roadmap.

## Plan 01 — Migration / vocabulary / refine form

**Summary:** Good migration-first sequencing and strong test intent, but the blocking checkpoint conflicts with the settled Phase 32 schema contract.

**Strengths**

- Correctly keeps migration registration explicit; the live chain ends at `profilePresentationMigration` version 24 in [database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:62).
- Correctly routes ordinary interaction writes through the recency DAO, whose insert/edit paths are the production DML chokepoints in [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:195) and [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:281).
- Correctly preserves `interaction_assists` as a transport vocabulary: its persisted CHECK is `call|text|email` in [014-interaction-assists.ts](/home/bwales/projects/orbit-app/src/db/migrations/014-interaction-assists.ts:12).

**Concerns**

- **HIGH — The checkpoint reopens a settled decision.** The supplied roadmap explicitly says migration 025 retains SQL column `quality`; this is no longer an owner choice. The plan’s “rename-tone” option should be removed, not presented as a blocking decision.
- **HIGH — It does not update all actual restore/export paths for the widened live schema.** Export currently selects only `quality`, `note`, etc., with no `duration` or `allow_ai` in [export-manifest.ts](/home/bwales/projects/orbit-app/src/backup/export-manifest.ts:48); restore likewise has a fixed interaction INSERT/UPSERT shape in [restore-apply.ts](/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:189). Deferring portable wire changes to Phase 36 is correct, but the plan needs an explicit compatibility test/documented behavior for an interim export/restore, otherwise those new local values silently disappear.
- **MEDIUM — The plan omits `LastInteractionType`, still defined as old vocabulary in [types.ts](/home/bwales/projects/orbit-app/src/types.ts:43).** Either migrate/deprecate it or demonstrate it is intentionally unrelated to persisted interaction channels.
- **MEDIUM — “Keep internal field names `good/fine/hard`” is a confusing semantic mismatch.** `readInteractionAggregates` currently returns those exact fields in [ai-context-read.ts](/home/bwales/projects/orbit-app/src/db/ai-context-read.ts:132). If retained, the alias needs a type/comment that makes `good → Positive`, etc. mechanically unambiguous.

**Suggestions**

- Remove the rename checkpoint and make “retain `quality` column” a plan invariant.
- Add an explicit interim-backup behavior test and a Phase 36 handoff test case.
- Include `src/types.ts` in the consumer audit or document why it is not a domain interaction vocabulary.

**Risk:** **HIGH** — irreversible migration plus incomplete wire-shape/consumer inventory.

## Plan 02 — Bind/Unbind events

**Summary:** Small, well-scoped plan that correctly composes within the existing transaction.

**Strengths**

- `bindContact` and `unbindContact` already own one `inWriteTransaction` each in [contact-lifecycle-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-lifecycle-dao.ts:42) and [contact-lifecycle-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-lifecycle-dao.ts:92).
- `recordEventCore` is specifically a non-transaction-opening composition primitive in [events-dao.ts](/home/bwales/projects/orbit-app/src/db/events-dao.ts:60).
- No migration is needed: event `type` is text without a schema CHECK.

**Concerns**

- **LOW — “event is not editable through any lifecycle path” is not directly testable from this DAO test alone.** Immutability is enforced structurally by absence of an event-update API, not by a bind/unbind behavior assertion.

**Suggestions**

- Test rollback: force `recordEventCore` or revision bump to fail and prove both the contact lifecycle change and event insert roll back.

**Risk:** **LOW**.

## Plan 03 — Aggregation and history read

**Summary:** Correctly extracts pure date math, but currently cannot fulfill its Group Event promises and misstates intensity reuse.

**Strengths**

- Uses local-date discipline consistent with [formatLocalDate usage](/home/bwales/projects/orbit-app/src/db/database.ts:108).
- Correctly treats nullable cadence as a tagged unavailable condition; the existing canonical guard is in [impact.ts](/home/bwales/projects/orbit-app/src/services/impact.ts:134).
- Keeps the new history read local and read-only, consistent with the existing interim projection in [profile-history-read.ts](/home/bwales/projects/orbit-app/src/db/profile-history-read.ts:43).

**Concerns**

- **HIGH — Group Event parent/child exclusion is impossible at this phase’s dependency point.** There is no `group_event_id`, Group Event table, or parent schema today; Phase 33 owns that later migration. Plan 03 depends only on 32-01, yet claims it can test a parent/child pair and exclude parent rows. This must become a Phase 33-provided query seam or a later integration task.
- **HIGH — `computeContactIntensity` is not window-scoped.** It receives all `ImpactInputs.interactions` and computes its own cadence-sized period in [impact.ts](/home/bwales/projects/orbit-app/src/services/impact.ts:134); `ImpactInputs` itself loads all contact interactions in [impact-read.ts](/home/bwales/projects/orbit-app/src/db/impact-read.ts:55). A wrapper cannot truthfully claim “same selected Heatmap window” unless it filters/copies inputs or extracts a lower-level window-aware intensity function.
- **MEDIUM — The plan chooses the Unbound Cycles fallback (“default to 7 Days”) despite research marking it as an unresolved owner-coordination decision.**

**Suggestions**

- Remove group-specific behavior from 32-03 and define an extensible interaction-row shape; add Group Event exclusion once Phase 33 storage exists.
- Specify a new pure window-scoped intensity API and tests proving changes to lens/page alter its result.
- Stop for the owner’s Unbound-Cycles decision before implementing it.

**Risk:** **HIGH**.

## Plan 04 — Edit Interaction route

**Summary:** Correct recency-writer intent, but it lacks the data-loading dependency and route coverage needed to work.

**Strengths**

- Correctly prohibits direct interaction SQL; `editTouchpointFull` scopes by both interaction and contact, checks exactly one changed row, then recomputes recency in [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:281).
- Correctly preserves failure/rollback semantics through the DAO transaction.

**Concerns**

- **HIGH — The route has no identified way to load the full interaction.** The existing profile history read selects no note and no new columns in [profile-history-read.ts](/home/bwales/projects/orbit-app/src/db/profile-history-read.ts:48). Proposed `history-read.ts` is Plan 03, but Plan 04 does not depend on it.
- **HIGH — Registration omits Settings.** Settings also hosts `ContactProfileScreen` in [SettingsStack.tsx](/home/bwales/projects/orbit-app/src/navigation/tabs/SettingsStack.tsx:55), but the plan adds EditInteraction only to Dashboard and Orrery. A profile opened from Settings would navigate to an unregistered route.
- **MEDIUM — It duplicates the future-date guard despite saying it will not.** The DAO guard is already authoritative in [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:267). UI prevalidation is fine for inline feedback, but it must be explicitly described as UX-only and tested to agree with the DAO, not as a second source of truth.
- **MEDIUM — Its specified error copy differs from the existing refine-form copy** (“That time is in the future…”) in [TouchpointRefineForm.tsx](/home/bwales/projects/orbit-app/src/components/TouchpointRefineForm.tsx:56).

**Suggestions**

- Depend on 32-03 and add a `readInteractionForEdit(contactId, interactionId)` read.
- Register the route in every stack that renders Profile, including Settings, or use a root route.
- Consolidate the future-date message/validation contract.

**Risk:** **HIGH**.

## Plan 05 — Heatmap, intensity, preferences

**Summary:** Good presentational separation and token discipline, but persistence and intensity wiring are underspecified.

**Strengths**

- Static RN Views are appropriate for a heatmap; no Skia loop is needed.
- The token-only approach matches the project’s existing theme pattern.
- Context-card callbacks keep sheet ownership out of the presentation component.

**Concerns**

- **HIGH — Adding accessors is not enough for `app_settings` persistence.** The DAO has a closed `AppSettings` model, SQL row type, SELECT, writable key union, and column map: [app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:90), [app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:438), and [app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:464). The plan’s files are sufficient, but its action must explicitly modify all of these seams and validate lens/preset values.
- **MEDIUM — “Intensity over the same window” remains blocked by Plan 03’s incorrect wrapper design.**
- **MEDIUM — The planned `heatmapScale` definition conflates empty-cell and active-level semantics.** It separately adds `heatmapCellEmpty`; specify which index applies to a real zero-count cell versus a structural Month blank.

**Suggestions**

- Enumerate all DAO model/mapping/validation edits, not merely “add accessors.”
- Add component/logic tests for a real zero, a structural blank, and cycle-current emphasis.

**Risk:** **MEDIUM-HIGH**.

## Plan 06 — Rolodex browser

**Summary:** Good separation of wheel math from RN rendering and strong motion/a11y intent.

**Strengths**

- Correctly keeps leap-year/date-clamp logic node-testable.
- Correctly requires non-gesture navigation and reduced-motion support.
- Correctly avoids opening detail on scroll; actions remain explicit.

**Concerns**

- **MEDIUM — “Conditionally mounted when focused/backgrounded” is not achievable from the proposed component boundary without passing focus/AppState in.** Neither `RolodexWheel` nor `RolodexBrowser` currently owns navigation focus; make the ownership/API explicit.
- **MEDIUM — The plan allows optional Skia glow but doesn’t include a defined token contract for that glow.** Theme-token colors are required even in Skia draws.
- **LOW — The proposed verification grep for `useState` is over-broad.** React state for selected date/drawer visibility is acceptable; only per-frame animation state is prohibited.

**Suggestions**

- Pass `isFocused`/app-active state from the screen or place the lifecycle hook in Browser.
- Replace the `useState` grep with a testable architectural assertion: gesture updates shared values; committed selection only updates state after settling.

**Risk:** **MEDIUM**.

## Plan 07 — Detail sheet / group routing

**Summary:** Correct hard-delete and Allow-AI intent, but it is prematurely implementing Phase 33 behavior.

**Strengths**

- Correctly uses `deleteTouchpoint`, which writes the tombstone, deletes by both keys, and recomputes recency in [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:313).
- Correctly keeps the sparkle a presentation of the durable `allow_ai` gate rather than transmitting notes.
- Adding labels to `TimelineRow` is aligned with its safe raw-type fallback in [TimelineRow.tsx](/home/bwales/projects/orbit-app/src/components/TimelineRow.tsx:25).

**Concerns**

- **HIGH — Group context, child overrides, Group Note, and “Edit Group Event” are not implementable before Phase 33.** No group schema or route exists; a placeholder navigation target is not a usable HIST-17 implementation.
- **HIGH — “Knowledge changes editable per owning model” has no identified source/query contract.** Existing timeline read unions only `interactions` and `events` in [timeline-read.ts](/home/bwales/projects/orbit-app/src/db/timeline-read.ts:63). Plan 03 similarly only specifies interactions/lifecycle data. The third required record family needs an explicit source and edit-routing map.
- **MEDIUM — Delete’s mutation behavior has no node test.** A UI grep cannot prove tombstone, recency recomputation, or failed-delete preservation; the DAO already has test seams and should be exercised.

**Suggestions**

- Defer Group Event UI behavior to an explicit Phase 33 integration plan, retaining only a future-compatible interaction detail seam now.
- Define knowledge-change record types and every owning model route before building the sheet.
- Add DAO-level delete regression tests covering newest/non-newest and failure rollback.

**Risk:** **HIGH**.

## Plan 08 — Profile assembly

**Summary:** Correctly targets the renderer seam, but it cannot deliver canonical logging or valid navigation with the planned dependencies.

**Strengths**

- Replacing only `renderHistory` is the right preservation boundary; the current temporary renderer is isolated in [ProfileModuleHost.tsx](/home/bwales/projects/orbit-app/src/components/profile/ProfileModuleHost.tsx:387).
- The existing route is presently a placeholder, confirming the plan correctly recognizes Phase 32 owns the future route contract: [FabActionPlaceholders.tsx](/home/bwales/projects/orbit-app/src/screens/placeholders/FabActionPlaceholders.tsx:26).

**Concerns**

- **HIGH — It claims empty-date logging routes into “canonical detailed logging,” but the only registered `LogContact` screen is a placeholder in DashboardStack** at [DashboardStack.tsx](/home/bwales/projects/orbit-app/src/navigation/tabs/DashboardStack.tsx:37), and it has no `prefillDate` consumption. Phase 34 must own the actual form; Phase 32 can only establish a typed route contract and an intentionally unavailable placeholder path.
- **HIGH — Profile navigation is origin-stack-local.** `ContactProfileScreen` calls navigation from whichever stack rendered it, including Settings; it currently routes “history” to ThingsToRemember in [ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:393). Plan 08 must redesign that callback contract and ensure all target routes exist in all profile-hosting stacks.
- **MEDIUM — It says lifecycle-only contacts should show history rather than an empty state, but Plan 03’s history read must return a distinct “has lifecycle records” signal; the plan currently only describes interactions and markers informally.**

**Suggestions**

- Make the Phase 32 behavior an explicit typed intent (`LogContact { contactId, prefillDate }`) with a Phase 34 acceptance test that consumes it.
- Add route registration/forwarding for Dashboard, Orrery, and Settings.
- Add a lifecycle-only fixture through HistorySection, not just pure orchestration logic.

**Risk:** **HIGH**.

## Required replanning changes

1. Remove the Plan 01 `quality → tone` decision gate; retaining `quality` is settled.
2. Resolve the Unbound Cycles fallback with the owner before implementation.
3. Fix Plan 03 intensity architecture so it is genuinely scoped to the selected History window.
4. Move all Group Event-dependent behavior from Plans 03/07 into Phase 33 or a post-33 integration plan.
5. Add a complete interaction-load read and correct stack registration before Plan 04.
6. Specify interim backup behavior for `duration` and `allow_ai`, since current export/restore fixed projections omit both.

---

## Claude Review

# Cross-AI Peer Review — Phase 32: Interaction History & Insights

**Reviewer:** Claude (Opus 4.8), independent peer review
**Method:** Every claim below was checked against the actual code on disk in `/home/bwales/projects/orbit-app`, not against plan text alone. The `interactions` table's writers were enumerated by full-tree grep before asserting any invariant about it (per the project's "read every writer" rule). `file:line` citations are from files opened this session.

---

## 1. Summary (overall)

This is a strong, unusually well-grounded plan set. The phase's self-identified highest risk — the forward-only, irreversible `quality`/`channel` vocabulary migration on the shared `interactions` table — is planned correctly: additive `ALTER + UPDATE` only (the table is CHECK-less, so no rebuild), jump-from-v1 tested, `allow_ai` mirroring an exact prior precedent, and the value-comparison consumer list is **complete and accurate** as verified by grep. The single-writer recency spine, the immutable-events contract, local-first read paths, and the Skia/worklet discipline are all correctly identified and consumed rather than re-implemented. The residual risk is concentrated in three places the plans under-handle: (1) the **group-linked behaviors (HIST-16/17, D-10 group clauses) depend on Phase 33 schema that does not exist yet**, making parts of Plans 03/07 untestable at Phase 32 and creating a D-07-reversal trap; (2) the **restore path does not remap the migrated vocabulary**, re-opening the exact Pitfall-1 miscount via a backdoor; and (3) **route reachability from a Settings-originated Profile** is not covered for the new Edit/Log routes. None of these is a fatal design flaw; all are addressable before execution.

**Overall risk: MEDIUM.**

---

## 2. Strengths (with evidence)

- **The irreversible migration is correctly scoped as additive.** `interactions` has no CHECK on `channel`/`quality` (`src/db/migrations/001-initial.ts:103,106` — `channel TEXT NOT NULL DEFAULT 'unspecified'`, `quality TEXT`), so the plan's `ALTER ADD COLUMN + UPDATE ... CASE` shape needs no table rebuild and cannot hit a `DROP COLUMN`/rebuild hazard. `allow_ai INTEGER NOT NULL DEFAULT 0 CHECK(allow_ai IN (0,1))` mirrors the verified precedent in `017-knowledge-egress-datamove.ts` (memories.allow_ai). Migration head is correctly re-verified: `PROFILE_PRESENTATION_SCHEMA_VERSION = 24` (`src/db/migrations/profile-presentation.ts:4`), `TARGET_VERSION = PROFILE_PRESENTATION_SCHEMA_VERSION` (`src/db/database.ts:62`) → next = 25. (Plan 01)

- **The D-06 consumer list is complete — verified independently.** A full-tree grep for value literals `'good'/'fine'/'hard'` returns exactly: `src/db/ai-context-read.ts:132-136`, `src/db/digest-read.ts:158-161`, and the form enum `src/components/TouchpointRefineForm.tsx:73`. Both value-comparison consumers (`ai-context-read`, `digest-read`) are in Plan 01's `files_modified`. The other `interactions.channel`/`quality` readers (`src/db/timeline-read.ts:75-123`, `src/components/TimelineRow.tsx:67-79`) are **pass-through** (they render the raw string, no literal comparison), so they display the migrated vocabulary correctly with no logic change — confirmed by reading `TimelineRow.tsx:67-79`. (Plan 01)

- **Channel value-consumers are correctly triaged as out of scope.** Every `channel === "call"|"text"|"email"` site I found (`AssistBanner.tsx:15`, `AssistConfirmation.tsx:43`, `ReachOutRouter.tsx:53-68`, `PendingConfirmationsSheet.tsx:20`, `services/reach-out/handoff.ts:60-71`, and `ContactProfileScreen.tsx:196` which feeds `performReachOut`) operates on the **assist/reach-out transport vocabulary** (`call|text|email`, CHECK-locked at `014-interaction-assists.ts:12`), not `interactions.channel`. D-06 deliberately preserves that transport CHECK and maps at log time (`markAssistLogged`). The plan's decision to leave these untouched is correct. (Plan 01)

- **The single-writer recency spine is consumed, never bypassed.** `editTouchpointFull` (`recency-dao.ts:258-310`) rejects a future `occurred_at` *before* opening the transaction (`:268`), scopes the UPDATE by `id AND contact_id` (`:289`), asserts `changes === 1` (`:302`), and always `recomputeLastContact` (`:307`). `deleteTouchpoint`/`deleteInteractionCore` (`:313-351`) writes an `entityType:"interaction"` tombstone in-txn (`:326-327`) before the DELETE and recomputes. Plans 04 and 07 consume these exact entry points with source-grep gates against bespoke `UPDATE/DELETE interactions`. This is exactly right. (Plans 04, 07)

- **Bind/unbind (Plan 02) is precise and low-risk — every claim verified.** `recordEventCore`'s signature (`events-dao.ts:60-79`) matches the plan's call `{uid, contactId, type, occurredAt, detail, now}` exactly. `bindContact`/`unbindContact` each already run a single `inWriteTransaction` ending in `bumpDataRevisionCore` (`contact-lifecycle-dao.ts:43-80`, `:92-106`), so inserting `recordEventCore` before that call composes cores in one txn with no nesting. `EventType` is `"archive"|"restore"|"snooze"|"unsnooze"` (`events-dao.ts:36`) and `events.type` is CHECK-less → additive at the TS union only, no migration. A grep for any exhaustive `EventType` switch in `restore-apply.ts`/`backup-schema.ts` returned **nothing**, confirming the plan's premise that bind/unbind round-trip verbatim (`restore-apply.ts` inserts `events.type` as text). (Plan 02)

- **Local-first is honored on every read path.** `history-read` is specified as a `ReadOnlyExecutor` with no transaction and no network; the aggregation seam (`window/buckets/cycles/intensity-window`) is pure functions with no DAO/store import. No plan introduces a network dependency. (Plan 03)

- **Skia/animation discipline directly addresses the known on-device hazards.** The heatmap is deliberately static RN `View` cells (no `useClock`, no render loop) — sidestepping the worklet-forward-ref crash surface entirely (Plan 05, grep-gated against `Skia|useClock`). The Rolodex wheel (the only animated surface) mandates Reanimated shared values (never per-frame setState), helper worklets defined above callers, `useReducedMotionShared` in a worklet, and pause-on-blur via conditional mount — mirroring the proven `OrreryCanvas` pattern and the `worklet-forward-ref-hazard` memory. (Plans 05, 06)

- **The privacy gate is fail-closed and correctly placed.** `allow_ai DEFAULT 0 CHECK(allow_ai IN (0,1))` is the durable OFF default; the sparkle is strictly gated on `allow_ai === 1` (Plan 07 Task 1, unit-tested); Phase 32 explicitly does **not** wire note egress (`ai-context-read.ts:101-122` still selects only channel/quality/connected). This honors D-04's owner trip-wire. Even the restore INSERT omits `allow_ai` (`restore-apply.ts:189`), so restored rows default to 0 (OFF) — fail-closed. (Plans 01, 07)

- **Theme-token discipline and `formatLocalDate`.** `heatmapScale`/marker tokens are per-palette with a `check:colors` gate (Plan 05); date math mandates `formatLocalDate()` (exists at `src/utils/dates.ts:17`) with a `toISOString` grep-gate (Plans 03, 06). Both are project non-negotiables and are enforced mechanically.

---

## 3. Concerns (severity-tagged, with evidence and mechanism)

### HIGH

- **[HIGH] Group-linked behavior (HIST-16/HIST-17, D-10 group clauses) cannot be implemented or tested at Phase 32 — and the plans' fixtures tempt a D-07 reversal.**
  Evidence: a full grep for `group_event_id`/`group_events` finds **no such column and no such table** anywhere in `src/` — only an empty placeholder `GroupEventsScreen.tsx` and a nav route. `interactions` (`001-initial.ts:97-106`) has no group linkage. D-07 explicitly places `group_event_id` in **Phase 33 (migration 026+)** and forbids Phase 32 adding it.
  Yet Plan 03 Task 3 asserts a testable behavior — *"a group-parent-plus-child pair proving the parent is excluded from counts"* — and an acceptance criterion *"the group-parent+child fixture yields one interaction record (the child) and a count that does not include the parent."* That fixture is **not constructible** against the Phase-32 schema: there is no way to mark an interaction as a group child or represent a parent row. Plan 07 similarly builds `GroupScopePrompt` and group-context rendering (badge/title/group note/View Group Event) keyed on a linkage field that will not exist until Phase 33.
  Mechanism / why it's HIGH: an executor told to "prove the parent is excluded" has two bad paths — (a) write a **vacuous or misleading test** that greens without exercising the invariant, or (b) **add `group_event_id` to migration 025 to make the fixture representable**, which reverses D-07 (an owner-recorded sequencing decision) via exactly the "make the test pass" instinct CLAUDE.md warns against. The count-only invariant is in fact satisfied *structurally* (Phase 33 parents will live in a separate `group_events` table and never be `interactions` rows), so nothing needs a runtime filter — but the plans frame it as a testable filter over data that cannot exist yet.
  Required fix: reframe the group surfaces in Plans 03/07 as **inert seams** gated on a group-linkage predicate that is hard-`false` until Phase 33; **drop the "group-parent+child" fixtures** as not-yet-representable and replace the acceptance criterion with "counts come only from `interactions` rows (parents are not `interactions` rows)"; keep `GroupScopePrompt`/group-context as unmounted-until-Phase-33 code with a note. This is an escalation-adjacent item because the wrong resolution reverses D-07 — surface it to the owner rather than letting an executor decide at the keyboard.

### MEDIUM

- **[MEDIUM] Restore of a pre-Phase-32 backup does not remap the migrated vocabulary — Pitfall 1 via the restore backdoor.**
  Evidence: migration 025's `UPDATE interactions SET quality/channel = CASE ...` runs **only during schema upgrade**. Restore is a separate path: `restore-apply.ts:189` does `INSERT INTO interactions (... quality ...) VALUES (...)` with the backed-up value **verbatim** (also the serializer `export-manifest.ts:52` selects `i.quality` raw). `BACKUP_FORMAT_VERSION` is already `4` (`export-manifest.test.ts:28`) and Phase 32 does **not** bump it, so a format-4 backup captured *before* Phase 32 (containing `quality='good'`, `channel='text'`) is accepted (`MAX_SUPPORTED_BACKUP_FORMAT_VERSION = BACKUP_FORMAT_VERSION`, `backup-schema.ts:16,778`) and its legacy literals land in a v25 DB. The now-migrated consumers `ai-context-read.ts:132` (`r.quality === "Positive"`) and `digest-read.ts:158` then **silently miscount** — the exact failure mode the plan guards against for on-device rows, re-introduced through restore.
  Mechanism: the migration and the restore INSERT are two different writers of `interactions`; the plan closes the migration writer but not the restore writer. Neither Plan 01 nor a clearly-chartered Phase 36 item covers *value*-remap-on-restore (Phase 36 / AICFG-17 covers the format bump and "retired keys," not a same-named column's value vocabulary).
  Required fix: at minimum add an explicit hand-off note that Phase 36's restore validation must value-remap legacy `quality`/`channel` on ingest, and add a Phase-32 test asserting the miscount does not occur *or* documenting it as a known gap for the 32→36 window. Best: a small remap-on-restore guard in the restore ingest for interaction rows.

- **[MEDIUM] EditInteraction and empty-date LogContact routes may not resolve from a Settings-originated Profile.**
  Evidence: `ContactProfileScreen` ("Profile") is registered in **three** stacks — `DashboardStack.tsx:44`, `SettingsStack.tsx:55`, `OrreryStack.tsx:50`. But `Edit` is registered only in Dashboard (`:57`) and Orrery (`:57`) — **not** Settings; and `LogContact` only in Dashboard (`:37`). Plan 04 registers `EditInteraction` mirroring `Edit` (Dashboard + Orrery only), so it inherits the SettingsStack gap. Profile is reachable from the Settings tab (Archived Contacts → Profile per DASHC-09/SHELL-12). From such a Profile, the History section's Edit action → `EditInteraction` and empty-date → `LogContact` would fail to resolve in the current navigator.
  Mechanism: React Navigation throws when navigating to a route name absent from the active stack (absent a parent-level registration). Plan 08's backstop flags this *for LogContact only* ("register in the relevant stack(s) or route via root if it does not"); nothing addresses `EditInteraction` in SettingsStack.
  Required fix: register `EditInteraction` (and confirm `LogContact`) in **all three** Profile-hosting stacks, or register them at `RootStack` (the research notes `RootStackParamList` reachability) so any origin resolves. Make this an explicit acceptance criterion, not a deferred backstop.

- **[MEDIUM] Plan 01 is large (17 files / ~85k tokens / confidence: low) and its Task 3 is a hard dependency of three downstream plans.**
  Evidence: the `scope_acceptance` block consciously (and correctly) keeps the migration + `ai-context-read`/`digest-read` consumers atomic, permitting only Task 3 (the `TouchpointRefineForm` extension + backup allowlist) to slip to a follow-up commit. But Plan 04 (wraps the extended form), Plan 05 (reads `history_lens`/`history_cycle_count` via `app-settings-dao`), and Plan 07 (renders the `allow_ai` sparkle from the new column) all depend on Task 3's outputs.
  Mechanism: if Task 3 lands as a later commit, Waves 2–3 could begin against an incomplete Plan 01 (missing form fields / uncommitted column readers), producing tsc breaks or building against a stale contract.
  Required fix: make the follow-up-commit seam explicit that **Task 3 must land before Wave 2 starts**, and gate wave promotion on the full Plan-01 file set, not just Tasks 1–2.

### LOW

- **[LOW] `QualityAggregate` internal field names drift from stored values.** Plan 01 Task 2 keeps `{good, fine, hard}` field names in `prompt-types.ts:113-114` while the SQL now stores `Positive/Neutral/Negative` (RESEARCH A3, minimal blast radius). The aggregate stays *correct* (only the comparison literal changes; `ai-context-read.ts:132-136` still increments the same field), but a field literally named `good` will count `Positive` rows. Documented as an alias — a maintainability smell, not a bug. Acceptable; ensure the in-file comment is unmissable.

- **[LOW] `duration`/`allow_ai` are not in the backup this phase (by design) → restore resets them.** `restore-apply.ts:189` and `export-manifest.ts:52` list neither column, so a restore drops `duration` (→NULL) and resets `allow_ai` (→0, fail-closed). This is the intended Phase-36 boundary, but a user who set `allow_ai=1` and restores loses that state. Safe (fail-closed) and correct for now; add it to the Phase-36 hand-off so serialization + a "restore never falsely appears more-permissive" check are not forgotten.

- **[LOW] `heatmapScale` must clear AA across all four palettes.** Count-saturation ramps can compress low-end contrast; Plan 05 flags authoring the tokens to pass palette contrast tests and (correctly) makes current-cycle a *structural* cue, not a hue. Final density/large-text QA is deferred to Phase 40 — reasonable, but keep the `check:colors`/contrast assertion in the Plan-05 gate, not only Phase 40.

- **[LOW] `EditTouchpointFullInput` gains `duration`/`allow_ai`; existing callers must thread them.** Note that a grep finds **no current production caller** of `editTouchpointFull` outside comments (`recency-dao.ts` internal + doc refs in `touchpoint-refine-logic.ts`/`TouchpointRefineForm.tsx`); the live callers are `deleteTouchpoint` (`HomeScreen.tsx:485`, `UniversalFab.tsx:130`). This makes Plan 04 the *first* real consumer of `editTouchpointFull` — which cleanly validates the "one canonical Edit route" claim — but also means the input-type widening is compiler-gated with essentially no legacy call sites at risk. Low.

---

## 4. Suggestions

1. **Resolve the group-linkage coupling before execution (owner-facing).** Decide explicitly: Phase 32 ships group surfaces as inert seams (predicate hard-false, no group fixtures), OR the owner authorizes moving `group_event_id` earlier (a D-07 reversal — owner's call). Do not let an executor infer this from a "prove exclusion" acceptance criterion. Rewrite Plan 03 Task 3 and Plan 07 Task 3 accordingly.
2. **Add a restore-vocabulary guard or an explicit Phase-36 hand-off** for legacy `quality`/`channel` values on ingest, plus a test over a legacy-format-4 fixture asserting `ai-context-read`/`digest-read` counts are not silently zeroed post-restore.
3. **Register `EditInteraction` + `LogContact` in all Profile-hosting stacks (Dashboard/Settings/Orrery) or at RootStack**, and promote this from a Plan-08 backstop to a hard acceptance criterion in Plan 04 and Plan 08.
4. **Gate Wave-2 promotion on the complete Plan-01 file set** (including Task 3), given Plans 04/05/07 depend on the extended form/columns.
5. **Keep one node test that migrates a jump-from-v1 fixture and then runs `readInteractionAggregates` + the digest gentle-line over the result** (Plan 01 already implies this in Pitfall 1) — it is the single highest-value regression guard in the phase; make it non-optional.
6. **Add an assertion that `interaction_assists.channel` CHECK is untouched** (a source-grep that `014-interaction-assists.ts:12`'s CHECK is unchanged), so no executor "helpfully" migrates the transport vocabulary and breaks the assist path.

---

## 5. Risk Assessment

**Overall: MEDIUM.**

Justification: the phase's *stated* highest risk — the irreversible on-device vocabulary migration — is, on verification, its *best-handled* area: additive-only, correctly numbered, jump-from-v1 tested, precedent-backed, and consumer-complete (the value-comparison consumer list is exactly two files, both in the plan; channel transport consumers are correctly excluded). The recency-spine, immutable-events, local-first, theme-token, and Skia/worklet non-negotiables are all consumed rather than violated, with mechanical grep/`check:colors` gates. That earns a lot of trust.

The MEDIUM (not LOW) rating comes from three verified gaps that live where correctness bugs live in this repo — the data layer and cross-phase seams: (1) the group-linked requirements are chartered to Phase 32 but their schema is Phase 33, creating untestable acceptance criteria and a D-07-reversal trap; (2) the restore writer of `interactions` re-opens the exact vocabulary miscount the migration closes; and (3) the new Edit/Log routes may not resolve from a Settings-originated Profile. None is a deep design error — each is a scoping/hand-off/registration fix — but (1) and (2) can produce silently-wrong data on unreachable devices, which is precisely the failure class this project is most anxious about. Resolve (1) and (2) with owner input, register the routes, and the phase drops comfortably to LOW.

