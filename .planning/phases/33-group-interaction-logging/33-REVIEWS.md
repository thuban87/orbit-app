---
phase: 33
reviewers: [claude, codex]
reviewed_at: 2026-09-12T05:14:57Z
plans_reviewed: [33-01-PLAN.md, 33-02-PLAN.md, 33-03-PLAN.md, 33-04-PLAN.md, 33-05-PLAN.md, 33-06-PLAN.md, 33-07-PLAN.md]
models:
  claude: "sonnet (reasoning=low)"
  codex: "gpt-5.6-terra (reasoning=low)"
model_sources:
  claude: "pinned"
  codex: "banner"
---

# Cross-AI Plan Review — Phase 33: Group Interaction Logging

## Consensus Summary

Both reviewers independently verified the plans against the live repo (migration head, the `inWriteTransaction` non-reentrancy mutex, the recency-DAO cores, the `ai-context-read.ts` closed egress projection, the backup export column list, `ContactPicker`'s current contract, and the dormant `GroupScopePrompt`/`GroupEventsScreen` seams) and **agree the core data-model architecture is sound**: a separate `group_events` parent plus ordinary child `interactions`, resolved values materialized on the child with discrete `ge_follow_*` flags, fanned out through the non-mutexed `*Core` primitives inside exactly one `inWriteTransaction` per mutation. Both confirm the load-bearing `editTouchpointFullCore` extraction (Plan 01 Task 4) is correctly identified as a prerequisite that prevents a permanent on-device deadlock, and that the AI-egress ban and backup non-bump disciplines are honored.

**The reviewers diverge sharply on overall risk: Claude rates LOW (zero HIGH concerns); Codex rates HIGH (four HIGH concerns).** The divergence is complementary, not contradictory. Claude deep-verified the data layer and invariant preservation and found them accurate; Codex focused on the completeness of the UI/presentation plans (06/07) and the backup handoff (05) and found several missing file edits and under-specified API contracts. Maintainer spot-check against disk confirms Codex's factual basis on the two most consequential HIGHs: `TouchpointRefineForm` (src/components/TouchpointRefineForm.tsx:45-106) exposes only `{value, onChange, now, testID}` and always renders every field — it has no field-visibility API, yet Plans 06 Task 2 assumes it can expose "ONLY the overridable subset"; and `HistoryInteractionRecord` (src/db/history-read.ts:38-54) carries only `groupLinked: boolean` with an explicit "INERT SEAM (D-12)... no group-event-id column" comment, so Plan 07's activation of `buildGroupContext` requires modifying `history-read.ts` (whether it is in the edit file-list, not just read-first, is the open gap). None of the HIGH findings reverse a recorded ADR/HANDOFF decision or risk data loss — they are plan-completeness and contract-precision gaps to resolve before execution.

### Agreed Strengths
- Migration numbering is correct and self-verified: `TARGET_VERSION=25`, head migration is `migration025`, so **026 is genuinely head+1** (src/db/database.ts:51,63,91). Both flagged the irreversible-migration checkpoint as appropriately gated.
- The `editTouchpointFullCore` extraction (Plan 01 Task 4) is load-bearing, not cosmetic: composing the mutexed `editTouchpointFull` inside Plan 03's fan-out transaction would nest `inWriteTransaction` and hang permanently on device. Both verified the wrapper body at src/db/recency-dao.ts:281-337 and the mutex at src/db/transaction.ts.
- The AI-egress ban is enforced as a genuine non-action and is structurally checkable: `group_events`/`group_note` never appear in `ai-context-read.ts` (closed projection, src/db/ai-context-read.ts:8-27 / 101-121).
- Dependency/wave ordering is sound; no plan reads or writes a table before the plan that creates it.
- Reuse of shipped seams (FAB → GroupLog route, Dashboard Group Events entry, bulk-log participant passing, the shared `ContactPicker`) is consistent with existing code.

### Agreed Concerns
- **Exhaustive writer audit is under-specified.** Both reviewers independently raised that CLAUDE.md's "the graph cannot enumerate SQL writers" mandate is not fully discharged: Claude wants a full-repo `grep -rn "editTouchpointFull("` caller audit as a Plan 01 Task 4 precondition (not just "existing DAO suite passes"); Codex wants the read-first lists to explicitly audit the exceptional existing writers — restore's direct upsert (src/backup/restore-apply.ts:190-201), the contact purge SQL (src/db/purge-dao.ts:82), and migration 025's interaction updates (src/db/migrations/025-interaction-history-schema.ts:44-72).
- **Parent-never-counts needs at least one metric-read test.** Codex notes Status/Gravity/Intensity consume interaction rows through other paths; the structural separation is strong but deserves a regression test with a group child.

### Divergent Views
- **Overall risk: Claude LOW vs Codex HIGH.** Root cause is scope of scrutiny, not a factual disagreement: Claude validated the data layer (accurate) and treated the UI plans' verification as acceptably manual/device per the phase's own Validation Strategy; Codex audited the UI/backup plan file-lists and contracts and found concrete omissions (below). Maintainer verification sided with Codex on the factual basis of its HIGHs while agreeing with Claude that none are decision reversals or data-loss defects.
- **`TouchpointRefineForm` reuse.** Codex flags it as a HIGH blocker (no visibility API exists); Claude did not examine it. Verified: the component has no field-visibility API today, so Plan 06 needs either a deliberate visibility API or extracted field controls as an explicit prerequisite task.
- **Backup linkage representation.** Codex flags (HIGH) that the handoff lists `interactions.group_event_id` (a local int) as an additive backup column (Plan 05 line 171 item 2) while also saying restore "relinks by uid" (line 40) — internally muddy; the wire shape should be `groupEventUid`. Not edited this phase (deferred to Phase 36, D-10; A3 owner-pending), but the handoff spec is a Plan 05 deliverable, so the imprecision propagates.

## Claude Review

# Cross-AI Plan Review — Phase 33: Group Interaction Logging

Verified against the live repo (not just the plan text) for the load-bearing claims: migration head (`TARGET_VERSION=25`, migration025 is the last registered step, confirmed in `src/db/database.ts:63` and `src/db/migrations/025-interaction-history-schema.ts:8`), `inWriteTransaction` non-reentrancy (`src/db/transaction.ts:49-64`), the recency cores and their exact bodies (`src/db/recency-dao.ts:159-460`), the `ai-context-read.ts` closed egress projection (`src/db/ai-context-read.ts:8-27`), `ContactPicker`'s current single-select contract (`src/components/ContactPicker.tsx:22-30`), the complete dormant `GroupScopePrompt` (`src/components/history/GroupScopePrompt.tsx:1-56`), the `GroupEventsScreen` placeholder (`src/screens/GroupEventsScreen.tsx:1-26`), existing route types (`src/navigation/types.ts:37,51`), the tombstone entity union (`src/db/tombstones-dao.ts:8-22`), and the backup export's interaction column list (`src/backup/export-manifest.ts:52`, which indeed omits `duration`/`allow_ai`/any group columns). `foreign_keys=ON` is confirmed enabled per-connection (`src/db/database.ts:163`), so the `ON DELETE SET NULL` FK the migration adds is a real safety net, not decorative.

## Summary

This is an unusually well-grounded plan set: nearly every RESEARCH/PATTERNS claim I checked against the actual files on disk turned out to be accurate, including subtle ones (the exact non-reentrancy hazard in `transaction.ts`, the absence of `duration`/`allow_ai` in today's backup export, the "unspecified" vs "In Person" channel-default distinction, migration 025's explicit comment forbidding `group_event_id` in itself). The core architectural bet — materialize resolved values on the child row with discrete `ge_follow_*` flags, fan out through non-mutexed `*Core` primitives inside exactly one `inWriteTransaction` per mutation — is correct and matches every invariant in CLAUDE.md/the ADRs. The single biggest genuine engineering contribution is Plan 01 Task 4's extraction of `editTouchpointFullCore`: without it, Plan 03's shared-value/date fan-outs would call the mutexed `editTouchpointFull` inside their own transaction and hang permanently on device — this is a real, previously-nonexistent primitive that had to be identified and built, and the plan set does that in the right place (before anything depends on it) with the right dependency-graph gating (Plan 03 depends on 33-01).

## Strengths

- **Migration numbering is correct and self-verified.** `TARGET_VERSION=25` and `MIGRATIONS` head = `migration025` (`src/db/database.ts:51,63,91`) confirm 026 is genuinely head+1; the plan's blocking checkpoint before Task 1 is appropriate given CLAUDE.md's "irreversible in production" migration rule.
- **The `editTouchpointFullCore` extraction is correctly scoped and load-bearing, not cosmetic.** Verified `editTouchpointFull`'s current body (`recency-dao.ts:281-337`) is exactly the mutexed wrapper the plan describes — one `inWriteTransaction` around an UPDATE-every-column + `changes!==1` throw + `recomputeLastContact` + `bumpDataRevisionCore`. Plan 01 Task 4 correctly identifies that composing this wrapper (rather than a non-mutexed core) inside Plan 03's group fan-out would nest `inWriteTransaction`, which is confirmed to be a permanent hang per `transaction.ts:11-29`'s single-promise-chain mutex. This is exactly the class of bug the sweep-deadlock comment at the top of `transaction.ts` already warns about, and the plan set closes it correctly before Plan 03 needs it.
- **The AI-egress ban is enforced as a genuine non-action, verified structurally.** `ai-context-read.ts:8-27`'s own header explicitly states "the free-text interaction column ... [is] NEVER selected here" — the plan's decision to touch only the test file, never the source, is the right call and is checkable: `group_events`/`group_note` never need to appear in that file for GRP-05 to hold.
- **Dependency/wave ordering is sound.** Plan 02 (multi-select picker + route types) and Plan 04 (reads) have no DAO dependency and correctly run in Wave 1/2 parallel to the schema tracer; Plan 03 (inheritance edits) and Plan 05 (lifecycle) correctly gate on `33-01`; Plan 06 (screens) correctly gates on all of 02/03/04/05 before wave 4; Plan 07 (presentation + seam activation) is last, wave 5. No plan reads/writes a table before the plan that creates it.
- **The backup non-bump discipline is honored and internally consistent.** Plan 05 explicitly does not touch `export-manifest.ts`/`restore-apply.ts` and instead produces `33-BACKUP-HANDOFF.md`; this correctly matches D-10 and the verified fact that today's interaction export (`export-manifest.ts:52`) already omits `duration`/`allow_ai`, which the handoff doc is told to flag as a joint gap for Phase 36.
- **Archived-participant and no-cap decisions are preserved rather than "fixed."** Plan 05 Task 1 explicitly instructs "Do NOT add an archived guard" and no plan introduces a participant cap — both correctly avoid reversing D-07 and dossier §K.
- **Channel-default handling is precise.** `insertInteractionCore`'s own default is `"unspecified"` (`recency-dao.ts:153`), not "In Person" — every plan correctly passes `channel ?? "In Person"` explicitly at each call site rather than relying on the core's default, so D-09's Group-Log-specific default is never silently lost to the core's generic default.

## Concerns

- **MEDIUM — the `editTouchpointFull` → `editTouchpointFullCore` refactor (Plan 01 Task 4) doesn't require an exhaustive caller audit before changing the wrapper's internal shape.** CLAUDE.md is explicit that "the knowledge graph cannot enumerate SQL writers" and every writer of `interactions`/`last_contact` must be read manually. The task's `<read_first>` only lists the function itself and the transaction/mutex primitives — it never asks the executor to `grep -rn "editTouchpointFull("` across the whole tree to enumerate every existing caller before splitting the function. The plan asserts "existing recency-dao suite passes unchanged" as sufficient proof, but that only covers unit tests of the DAO itself, not every screen-level caller's actual runtime behavior. Given this refactor changes what is and isn't inside a transaction body, I'd want the plan to explicitly mandate a full-repo grep for `editTouchpointFull` callers as a task precondition, not just rely on the existing test suite staying green.
- **LOW/MEDIUM — the partial-index rationale conflates two different SQLite behaviors.** RESEARCH/PATTERNS (and Plan 01 Task 2) describe `idx_group_member_unique ... WHERE group_event_id IS NOT NULL` as relying on "SQLite treats NULLs as distinct" for standalone rows to coexist. In fact, since the predicate excludes `group_event_id IS NULL` rows from the index entirely, standalone rows never enter the index at all — the "NULL-distinct" framing is unnecessary to explain why they coexist (they're just not indexed), though it happens to also be true as a general SQLite UNIQUE-index fact. This is a documentation-accuracy nit, not a functional bug — the partial index correctly achieves "at most one row per (event, contact)" — but the test task should be written to assert the actual behavior (duplicate `(group_event_id, contact_id)` rejected; multiple `NULL group_event_id` rows for the same contact unconstrained) rather than asserting a "NULL-distinct" mechanism that isn't actually what's providing the guarantee.
- **LOW — Plan 06/07's device-only (`<human-check>`) verification is the sole check for several must-have truths.** A number of `must_haves.truths` entries (e.g., "FAB → Group Log opens directly... no pre-picker", "shared edit fans out to following participants... in each contact's history") are only verified by a human walking through the Pixel build, per the phase's own Validation Strategy classification of GRP-08/09 as "manual/device." That's consistent with the phase's own test map, but it does mean several GRP-03/04/06 UI-level truths in Plan 06 have no automated regression coverage once this phase ships — a future refactor could silently break the fan-out-to-UI wiring without any CI signal, only surfacing on the next manual pass.
- **LOW — Plan 03's `updateGroupEventShared`/`updateGroupEventDate` fan-out cost is unbounded and only "accepted" via a Pitfall note, not enforced.** RESEARCH's Pitfall 2 explicitly says there's no product cap and treats a 40-participant fan-out as "correct, just costly," which is consistent with dossier §K's explicit no-cap decision — this is a deliberate, documented tradeoff rather than an oversight, but worth flagging as a place where a future large real-world group (a wedding, a reunion) could produce a noticeably slow single-transaction edit with no backpressure or progress UI, since the whole edit is one atomic transaction by design (GRP-11).

## Suggestions

- Add an explicit task step (or fold into Plan 01 Task 4) requiring a full-repo `grep -rn "editTouchpointFull\b"` before/after the extraction, with the result recorded in the task's summary, to satisfy CLAUDE.md's "read every writer" mandate rather than trusting the existing test suite alone.
- Rewrite the migration-026 test's rationale comment (and the Plan 01 Task 2 action text) to describe the partial index accurately: rows with `group_event_id IS NULL` are excluded from the index (not "distinct within it"), so they're unconstrained by construction, while non-null `(group_event_id, contact_id)` pairs are uniquely constrained.
- Since GRP-03/04/06's UI-level correctness in Plan 06 currently rests entirely on manual Pixel verification, consider whether a thin RN-free integration test (seeding a `createGroupEvent` + `updateGroupEventShared` + `resolveParticipants` round trip already covered in Plan 03/04's DAO tests) could be referenced explicitly from Plan 06's acceptance criteria as a regression backstop for the *logic* half of that wiring, even though the screen rendering itself stays manual.

## Risk Assessment

**LOW.** The plan set is unusually well fact-checked against the actual codebase (every load-bearing claim I independently verified — migration head, mutex non-reentrancy, the exact wrapper body being extracted, the AI-egress projection's closed column set, the backup export's missing columns, the channel-default constant, the FK enforcement pragma — turned out accurate on disk). The architecture correctly preserves every `[DECIDED]`/ADR invariant I cross-checked (D-04 Group Note egress ban, D-05 single-writer composition, D-07 archived participants, D-09 Group Log defaults, D-10 backup non-bump, D-11 three-way remove/scope prompt, ADR-025 Group Events ≠ lifecycle events). The concerns above are refinements (audit rigor on a refactor, a documentation-accuracy nit, coverage gaps that are already acknowledged as manual/device by the phase's own validation strategy) rather than defects that would cause data loss, a hang, or a reversed decision.

---

## Codex Review

# Phase 33 Plan Review

## Summary

The plan has a strong data-model direction: a separate `group_events` parent plus ordinary child `interactions` preserves the existing metric/read consumers, and its recency-core composition correctly recognizes the non-reentrant transaction boundary. However, several concrete seams are currently missing from the plan: backup linkage is specified using a nonportable database ID, the History/UI activation cannot work without modifying omitted data and navigation files, and the proposed reuse of `TouchpointRefineForm` is incompatible with its current all-fields-only API. Overall, the phase is well scoped but needs revision before execution.

## Strengths

- The migration number is correctly grounded. The registered migration head is 025 and `TARGET_VERSION` resolves to the Phase-32 version at [src/db/database.ts:50-92](/home/bwales/projects/orbit-app/src/db/database.ts:50), so migration 026 is currently the valid next number.

- Plan 01 correctly uses the real single-writer spine. `insertInteraction` is the canonical bound insert at [src/db/recency-dao.ts:193-235](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:193), and `recomputeLastContact` is explicitly the sole `last_contact` writer at [src/db/recency-dao.ts:159-191](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:159). Looping those cores inside one outer transaction is the right mechanism.

- The no-nested-transaction concern is real and correctly addressed. The current public `editTouchpointFull` opens `inWriteTransaction` itself at [src/db/recency-dao.ts:281-336](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:281), while the available composition exports presently cover only insert and recompute at [src/db/recency-dao.ts:446-460](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:446). Extracting an edit core before fan-out is necessary.

- Group Note egress is correctly treated as a closed-projection constraint. The AI aggregate query selects only `channel`, `quality`, and `connected` from `interactions` at [src/db/ai-context-read.ts:101-121](/home/bwales/projects/orbit-app/src/db/ai-context-read.ts:101), with an explicit prohibition on free text and event-table reads. Keeping `group_events` out of this reader satisfies the decision structurally.

- Extending rather than replacing `ContactPicker` is consistent with the existing shared picker. It already owns archived-search behavior at [src/components/ContactPicker.tsx:65-97](/home/bwales/projects/orbit-app/src/components/ContactPicker.tsx:65) and archived/snoozed markers at [src/components/ContactPicker.tsx:175-210](/home/bwales/projects/orbit-app/src/components/ContactPicker.tsx:175).

- Existing shell seams are genuinely available: the FAB routes directly to `GroupLog` at [src/components/universal-fab-logic.ts:91-94](/home/bwales/projects/orbit-app/src/components/universal-fab-logic.ts:91), Dashboard already exposes Group Events at [src/screens/HomeScreen.tsx:1620-1626](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:1620), and bulk logging already passes selected participant IDs at [src/screens/HomeScreen.tsx:1016-1025](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:1016).

## Concerns

- **HIGH — The backup handoff uses the wrong linkage representation.** Plan 05 says Phase 36 should serialize `interactions.group_event_id`. That is a local SQLite integer and cannot survive export/restore into a database where parent IDs differ. Existing backup relationships use durable UIDs—for example, interactions export `contactUid`, not `contact_id`, at [src/backup/export-manifest.ts:52](/home/bwales/projects/orbit-app/src/backup/export-manifest.ts:52), and restore maps those UIDs back to local IDs at [src/backup/restore-apply.ts:180-201](/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:180). The handoff must specify `groupEventUid` on an interaction’s wire shape, resolving it to `group_events.id` during restore.

- **HIGH — Plan 07 cannot activate group context with its listed files.** `HistoryInteractionRecord` has only `groupLinked: boolean`, not `groupEventId`, title, or Group Note ([src/db/history-read.ts:38-54](/home/bwales/projects/orbit-app/src/db/history-read.ts:38)). Its SQL currently does not select `group_event_id` ([src/db/history-read.ts:136-175](/home/bwales/projects/orbit-app/src/db/history-read.ts:136)). Yet `InteractionDetail` receives exactly that record ([src/components/history/HistorySection.tsx:360-378](/home/bwales/projects/orbit-app/src/components/history/HistorySection.tsx:360)) and calls `buildGroupContext(interaction)` ([src/components/history/InteractionDetail.tsx:81-85](/home/bwales/projects/orbit-app/src/components/history/InteractionDetail.tsx:81)). Plan 07 must include `history-read.ts`, likely `HistorySection.tsx`, and revised tests/props to fetch and route real group context.

- **HIGH — “Edit individual interaction” has no reachable implementation route.** Today the scope prompt’s individual callback delegates to ordinary `EditInteraction` ([src/components/history/InteractionDetail.tsx:208-218](/home/bwales/projects/orbit-app/src/components/history/InteractionDetail.tsx:208)), while `HistorySection` navigates directly to that route ([src/components/history/HistorySection.tsx:366-372](/home/bwales/projects/orbit-app/src/components/history/HistorySection.tsx:366)). Plan 07 says it will route to `ParticipantOverrideEditor`, but that is only planned as a component, not a route, modal owner, or navigation contract. Add a concrete participant-override route/modal design and the necessary stack/type registrations.

- **HIGH — `TouchpointRefineForm` cannot presently be reused as described.** Its only public props are a complete `TouchpointRefineValue`, `onChange`, `now`, and test ID ([src/components/TouchpointRefineForm.tsx:45-106](/home/bwales/projects/orbit-app/src/components/TouchpointRefineForm.tsx:45)); it always renders date/time ([src/components/TouchpointRefineForm.tsx:162-190](/home/bwales/projects/orbit-app/src/components/TouchpointRefineForm.tsx:162), then direction and connected ([src/components/TouchpointRefineForm.tsx:218-258](/home/bwales/projects/orbit-app/src/components/TouchpointRefineForm.tsx:218)). Group-event shared editing must not expose participant direction/connected, and participant override editing must not expose date/time. Plan 06 needs either a deliberate field-visibility API on this component or extracted reusable field controls; its current file list omits that prerequisite.

- **HIGH — `updateGroupEventShared` needs an explicit nullable patch contract.** The planned signature `{ channel?, quality?, duration? }` cannot distinguish “leave Tone unchanged” from “set Tone to null/unset,” which is required by GRP-03. It also does not define atomic behavior when multiple shared fields change in one Save. Use a discriminated field/value operation or a patch where key presence is detectable, and test setting `quality`/`duration` to `null`.

- **MEDIUM — Group Event title is only SQL-non-null, not validated as meaningful.** `title TEXT NOT NULL` accepts `""`. The plan calls the title required but does not require DAO-level trim/nonblank validation. Since `createGroupEvent` is a reusable write API, enforce a nonblank trimmed title before its transaction and test it.

- **MEDIUM — Convert lacks a Group Event UID input or minting step.** Plan 05’s proposed `convertInteractionToGroupEvent({ interactionId, contactId, title, now })` must insert into a parent with `uid TEXT NOT NULL UNIQUE`. It needs a supplied/minted UID explicitly; preserving the child interaction UID does not provide a parent UID.

- **MEDIUM — Tombstone/revision behavior is underspecified.** `deleteInteractionCore` calls `insertTombstoneCore` ([src/db/recency-dao.ts:340-367](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:340)), and that core bumps the revision by default ([src/db/tombstones-dao.ts:60-79](/home/bwales/projects/orbit-app/src/db/tombstones-dao.ts:60)). A group deletion looping children, writing a parent tombstone, and then doing a trailing bump will bump revision N+2 times, contrary to the plans’ “single trailing bump” claims. Decide whether multiple bumps are acceptable or extend the delete/tombstone composition APIs to suppress inner bumps.

- **MEDIUM — The plan does not fully satisfy its required writer audit.** Manual production writers include restore’s direct interaction upsert at [src/backup/restore-apply.ts:190-201](/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:190), destructive contact purge SQL at [src/db/purge-dao.ts:82](/home/bwales/projects/orbit-app/src/db/purge-dao.ts:82), and migration-time interaction updates at [src/db/migrations/025-interaction-history-schema.ts:44-72](/home/bwales/projects/orbit-app/src/db/migrations/025-interaction-history-schema.ts:44). The plans correctly constrain new group writes, but their read-first lists should explicitly audit these existing exceptional writers and document why each preserves or intentionally replaces recency behavior.

- **MEDIUM — “Parent never counts everywhere” is only partially tested.** Plan 01 adds history/heatmap tests, but Status, Gravity, and Intensity consume ordinary interaction rows through other paths. The parent being separate is a strong structural defense, but tests should cover at least one affected metric read/service with a group child to prevent a future join or union from treating the parent as activity.

- **LOW — Plan 02’s multi-select props need a type-safe discriminated union.** `onSelect` is currently required ([src/components/ContactPicker.tsx:22-30](/home/bwales/projects/orbit-app/src/components/ContactPicker.tsx:22)). Simply adding optional `mode`/`onConfirm` while retaining a required `onSelect` makes multi mode awkward and risks accidental callbacks. Define `mode: "single"` with `onSelect`, versus `mode: "multi"` with `onConfirm`, so callers are compiler-checked.

## Suggestions

- Revise `33-BACKUP-HANDOFF.md` to define:
  - `groupEvents[]` keyed by `uid`
  - `interactions[].groupEventUid`, never local `group_event_id`
  - restore order: upsert parents by UID, map UID → local ID, then upsert children
  - orphan handling: clear local link and all `ge_follow_*` flags if the parent UID is absent.

- Expand Plan 07’s file ownership to include:
  - `src/db/history-read.ts` and its test;
  - `src/components/history/HistorySection.tsx`;
  - navigation types/stack registration for a participant-override destination;
  - a group-context read that joins `group_events` only for local presentation, never AI egress.

- Add an explicit controlled-field extraction/configuration task before Plan 06. It should prove that shared Group Event fields and participant override fields cannot accidentally render prohibited controls.

- Redesign `updateGroupEventShared` as an explicit patch API that supports nullable values and one transaction for all changed shared fields; add tests for clearing Tone/Duration and mixed follow/override children.

- Require DAO-level title validation and mint/receive a unique parent UID for both creates and conversions.

- Add a transaction/revision policy to the lifecycle plan: either accept documented multiple revision bumps or make all composed tombstone/core operations support `bumpRevision: false` and perform exactly one final bump.

- Make the UI plans run a typecheck/build validation in addition to `check:colors`; color checks cannot verify route registration, prop compatibility, or navigation wiring.

## Risk Assessment

**HIGH.** The underlying schema/recency approach is sound, but the current plan cannot deliver the required history/detail/edit flows without omitted source changes, and the proposed backup linkage would corrupt or flatten group relationships on restore. Address those issues before approving execution; afterward, the remaining risk is primarily the irreversible migration checkpoint and fan-out correctness, both of which are well covered by the planned DAO tests.

---
