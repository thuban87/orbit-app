---
phase: 32
reviewers: [codex, claude]
reviewed_at: 2026-09-11T21:31:36Z
cycle: 3
plans_reviewed: [32-01-PLAN.md, 32-02-PLAN.md, 32-03-PLAN.md, 32-04-PLAN.md, 32-05-PLAN.md, 32-06-PLAN.md, 32-07-PLAN.md, 32-08-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=high)"
  claude: "claude-opus-4-8 (read-only subagent)"
model_sources:
  codex: "banner"
  claude: "harness"
---

# Cross-AI Plan Review — Phase 32 (Convergence Cycle 3)

Both lanes ran source-grounded (repo read access) over all eight PLAN.md files on disk as revised in commit bd3d726. The orchestrator independently verified every load-bearing claim below against the actual code (restore-apply.ts, recency-dao.ts, ai-context-read.ts, interaction-assist-dao.ts, database.ts/migrations, export-manifest.ts) rather than trusting reviewer summaries.

## Consensus Summary

Cycle 3 is nearly converged. Both reviewers independently confirm that every cycle-2 architectural finding is resolved in the current plan text with concrete tasks, acceptance criteria, prohibitions, and grep-gates: the email-assist channel remap (incl. `email → Message`), the frozen migration CASE literals, the restore-ingest vocabulary backdoor, the quality-column-retained lock, the D-07/D-12 inert group seam (no `group_event_id`, no constructible parent fixture), the window-scoped intensity fix, the complete knowledge-change family, the EVENT_LABELS/TimelineRow dead-code resolution, and the SettingsStack route-registration crash fixes. Migration 025 is the correct head+1 (verified: TARGET_VERSION=PROFILE_PRESENTATION_SCHEMA_VERSION=24), adds no group schema, and BACKUP_FORMAT_VERSION (4) is not bumped — all recorded-decision guardrails hold.

**One HIGH remains, raised by codex and independently verified, that the current PLAN.md does not yet address:** the restore path's `ON CONFLICT(uid) DO UPDATE` arm for `interactions` (restore-apply.ts:189) omits `allow_ai` from its SET list, so in **merge-mode** restore an already-present interaction row with `allow_ai=1` keeps that consent bit even when the winning backup row carries no permission field. Plan 02's must_have (line 27-29) and threat T-32-07c claim restore is fail-closed and "can NEVER" be more-permissive — true only for the INSERT/replace-all path (replace-all wipes interactions first via `replaceAllReset`, so the DEFAULT 0 applies), false for the merge/update path. This is a consent/privacy-bit correctness gap; the fix enforces D-04's fail-closed intent and reverses no recorded decision.

### Agreed Strengths
- Migration 025 is the correct next number, self-verified on disk, constraint-safe (channel/quality are CHECK-less TEXT — no rebuild), and consumer-complete (repo-wide grep confirms only ai-context-read, digest-read, TouchpointRefineForm compare the old vocabulary).
- Single-writer recency spine is airtight: `insertInteraction as insertInteractionCore` (recency-dao.ts:431) means duration/allow_ai added once cover every writer.
- The email-assist backdoor (interaction-assist-dao.ts:105 raw channel; 014 CHECK permits 'email') and the restore vocabulary backdoor (restore-apply.ts:189, export-manifest.ts:52) are both real and correctly closed through the single shared `interaction-vocabulary.ts` map.
- D-07/D-12 group seam is genuinely inert — no group_event_id referenced, grep-gate + prohibition forbid adding it early (a stop-and-ask).

### Agreed Concerns
- None rated HIGH/MEDIUM by both. The one HIGH below is a divergence (codex found it; claude did not probe that path).

### Divergent Views
- **allow_ai fail-closed on merge-mode restore (HIGH, codex only).** Codex traced the `ON CONFLICT DO UPDATE` consent-bit gap and rated it HIGH. Claude's review verified the restore *vocabulary* remap but treated the "restore backdoor" as vocabulary-only and did not examine the allow_ai update arm, concluding LOW / terminate. The orchestrator independently confirmed codex is correct: replace-all wipes interactions before upsert (fail-closed), but merge-mode emits `update` actions whose SQL preserves the destination `allow_ai`. The divergence resolves in codex's favor. **This is the sole item blocking termination.**

---

## Codex Review

# Cross-AI Plan Review — Phase 32, Convergence Cycle 3

## Summary

The revised eight-plan sequence is substantially ready: it preserves the locked migration ordering and schema boundary, puts the vocabulary migration and all live literal consumers in the same first wave, makes the Phase-33 group behavior genuinely inert, and has concrete source-level verification for the cycle-2 navigation, intensity, and settings-persistence gaps. One HIGH privacy/correctness gap remains in Plan 02: its claim that omitting `allow_ai` from restore is always fail-closed is false for an existing interaction updated through SQLite's `ON CONFLICT` arm. That path retains the destination's old `allow_ai=1`, even when the incoming backup contains no permission field. This must be corrected before execution; no recorded decision needs to change.

## Plan 01 — Migration 025 and vocabulary lockstep

### Summary

This is a well-bounded, correctly ordered irreversible migration plan. It explicitly keeps the SQL column name `quality`, does not introduce group schema, freezes the migration CASE expressions, and moves every currently verified literal consumer and live assist writer in lockstep.

### Strengths

- The planned ALTER-plus-UPDATE shape is appropriate for the existing schema: `interactions.channel` and `interactions.quality` are unconstrained TEXT columns, so neither a table rebuild nor a column rename is necessary. [src/db/migrations/001-initial.ts:96-110](src/db/migrations/001-initial.ts#L96-L110)
- Registration is correctly located at the one authoritative migration list and target version. The current list ends in version 24's profile-presentation migration, so the plan's required on-disk head check before adding 025 is sound. [src/db/database.ts:62-90](src/db/database.ts#L62-L90)
- The plan addresses both stale value readers that would otherwise silently undercount after the value migration: AI context compares `good`/`fine`/`hard` at [src/db/ai-context-read.ts:124-142](src/db/ai-context-read.ts#L124-L142), and the digest does the same at [src/db/digest-read.ts:154-166](src/db/digest-read.ts#L154-L166).
- It correctly closes the previously identified assist-writer path, including `email`. The current writer passes the raw transport channel to `insertInteractionCore` [src/db/interaction-assist-dao.ts:98-111](src/db/interaction-assist-dao.ts#L98-L111), while the transport schema permits `call`, `text`, and `email` [src/db/migrations/014-interaction-assists.ts:8-16](src/db/migrations/014-interaction-assists.ts#L8-L16). Plan 01 now requires all three remaps and tests them.
- Requiring frozen CASE literals in migration 025 is the right safeguard. The runner executes migration code at upgrade time [src/db/migrations/runner.ts:43-66](src/db/migrations/runner.ts#L43-L66); a future edit to a runtime mapping helper must not alter the historical meaning of a shipped migration.
- The recency-write work remains on the only established mutation spine. Existing inserts and full edits are centralized at [src/db/recency-dao.ts:180-213](src/db/recency-dao.ts#L180-L213) and [src/db/recency-dao.ts:258-309](src/db/recency-dao.ts#L258-L309), respectively.

### Concerns

- None found in the current plan. The prior email-remap, mutable-migration-helper, quality-column rename, and group-schema issues are explicitly resolved in the current tasks and prohibitions.

### Suggestions

- Retain the required jump-from-v1 migration test and add the new-row/default assertion through the normal recency writer as specified, rather than only through raw SQL. This directly proves the UI-facing write path gets `allow_ai=0`.

### Risk Assessment

**HIGH, controlled.** The migration is inherently irreversible on user devices, but the plan has the right checkpoint, frozen mapping, jump-chain test, and consumer-lockstep scope to contain that risk.

## Plan 02 — Lifecycle events and restore mapping

### Summary

The bind/unbind event work and vocabulary restore remap are well placed in Wave 2 and correctly compose inside existing transactions. However, the plan's fail-closed assertion for an omitted `allow_ai` field is incomplete and false for a merge update of an existing interaction.

### Strengths

- `recordEventCore` is the correct primitive for the proposed producers: it is insert-only and intentionally assumes an already-open transaction. [src/db/events-dao.ts:47-79](src/db/events-dao.ts#L47-L79) Both `bindContact` and `unbindContact` already own an `inWriteTransaction` body. [src/db/contact-lifecycle-dao.ts:27-82](src/db/contact-lifecycle-dao.ts#L27-L82), [src/db/contact-lifecycle-dao.ts:90-106](src/db/contact-lifecycle-dao.ts#L90-L106) This avoids the documented non-reentrant transaction deadlock. [src/db/transaction.ts:12-23](src/db/transaction.ts#L12-L23)
- No event schema migration is needed: `events.type` is unconstrained `TEXT NOT NULL`. [src/db/migrations/001-initial.ts:115-125](src/db/migrations/001-initial.ts#L115-L125)
- The plan correctly treats restore as an independent interaction writer. Today it inserts raw `r.channel` and `r.quality`, including in the conflict-update path. [src/backup/restore-apply.ts:179-191](src/backup/restore-apply.ts#L179-L191) Routing those bindings through Plan 01's shared vocabulary helper closes the legacy backup backdoor without changing the backup wire version.
- The planned event timestamp is precise (`occurredAt: now`) and testable, rather than inferred from an unrelated contact field.

### Concerns

- **HIGH — restore is not fail-closed for `allow_ai` when the interaction UID already exists.** Plan 02 says omission from the INSERT makes every restored row default to OFF and therefore “can NEVER” be more permissive. [32-02-PLAN.md:27-29](.planning/phases/32-interaction-history-insights/32-02-PLAN.md#L27-L29), [32-02-PLAN.md:123-135](.planning/phases/32-interaction-history-insights/32-02-PLAN.md#L123-L135) That is only true for a newly inserted UID. The actual restore SQL has `ON CONFLICT(uid) DO UPDATE`, and its update list does not assign `allow_ai`; therefore an existing destination interaction with `allow_ai=1` retains that ON state when a legacy backup row wins the reconciliation update. [src/backup/restore-apply.ts:189](src/backup/restore-apply.ts#L189) `upsertChildren` is invoked for both insert and update winners during restore. [src/backup/restore-apply.ts:287-316](src/backup/restore-apply.ts#L287-L316) This violates the plan's explicit privacy guarantee, not merely its test coverage.

### Suggestions

- Keep the Phase-36 serialization boundary, but make the legacy/no-field restore conflict arm explicitly fail closed: add `allow_ai = 0` to the interaction `ON CONFLICT ... DO UPDATE SET` list, without adding the column to the INSERT/wire payload. Add a regression that seeds a v25 destination row with the same UID and `allow_ai=1`, restores a winning legacy-format row that lacks the field, and asserts it becomes `0`. The existing insert-default test remains useful but does not exercise this path.
- Consider setting `duration = NULL` on that same legacy conflict-update path if restore semantics are intended to represent the incoming legacy record completely. This is a product/merge-policy clarification, so it is lower priority than the consent gate and should not block the `allow_ai=0` fix.

### Risk Assessment

**HIGH until the conflict-update consent case is fixed.** The gap is on the privacy gate for a user-invoked local restore; once the `ON CONFLICT` path is made explicit and regression-tested, the remaining lifecycle and vocabulary work is **MEDIUM** risk.

## Plan 03 — Aggregation and canonical history read

### Summary

This plan now gives the phase a sound reusable read/aggregation seam. It specifically resolves the historical-window intensity defect identified last cycle and keeps group behavior inert without borrowing Phase 33 schema.

### Strengths

- The plan correctly avoids the existing `computeContactIntensity` wrapper for historical windows: that wrapper uses a contact-cadence period over all loaded interactions. [src/services/impact.ts:134-146](src/services/impact.ts#L134-L146) The current pure core instead derives its count from the supplied `now` and `periodDays`. [src/services/intensity-logic.ts:104-139](src/services/intensity-logic.ts#L104-L139) Requiring a window-end `effectiveNow`, a window-span period, and a fixed-value historical test is the necessary correction.
- The nullable cadence guard matches existing behavior: the current service returns `{ available: false }` before cadence arithmetic for unbound/null-cadence contacts. [src/services/impact.ts:123-145](src/services/impact.ts#L123-L145)
- Iterating `CURRENT_STATE_FIELD_KEYS` is necessary and now explicit. The registered keys are currently `last_talked_about` and `current_location` [src/db/memory-registry.ts:57-76](src/db/memory-registry.ts#L57-L76), while `getCurrentStateHistory` accepts only one field key per query. [src/db/current-state-history-read.ts:61-73](src/db/current-state-history-read.ts#L61-L73)
- The group seam is appropriately structural: Phase 32 does not have a group discriminator in the current interaction table [src/db/migrations/001-initial.ts:96-110](src/db/migrations/001-initial.ts#L96-L110), and the plan forbids both a group join and a constructible group fixture. This preserves D-07/D-12.

### Concerns

- None found in the current plan. The previous historical-intensity, incomplete knowledge-family, and premature group-schema findings are addressed by concrete actions and test criteria.

### Suggestions

- In the implementation, make the “real dates” represented by Month leading/trailing cells explicit in the window type so that `periodDays` cannot accidentally include structural blank cells. The plan's current wording already points to this; a named invariant in the type will make it harder to regress.

### Risk Assessment

**MEDIUM.** The math is correctness-sensitive, but it is isolated into pure modules with exact historical-window, boundary, and unbound regression tests.

## Plan 04 — Canonical Edit Interaction

### Summary

The plan is correctly thin at the UI boundary: it loads a complete contact-scoped row, uses the established form and future-date copy, and delegates mutation to the recency spine from every Profile-hosting stack.

### Strengths

- The proposed edit read is correctly scoped by both interaction ID and contact ID, matching the mutation guard's protection against cross-contact stale recency. [src/db/recency-dao.ts:272-307](src/db/recency-dao.ts#L272-L307)
- Reusing the exported future-date message is concrete and avoids divergent UI copy. [src/components/TouchpointRefineForm.tsx:55-57](src/components/TouchpointRefineForm.tsx#L55-L57)
- The current navigator topology confirms the need to register the new route in all three stacks: Profile is present in Dashboard [src/navigation/types.ts:34-55](src/navigation/types.ts#L34-L55), Orrery [src/navigation/types.ts:126-149](src/navigation/types.ts#L126-L149), and Settings [src/navigation/types.ts:164-177](src/navigation/types.ts#L164-L177). The plan explicitly closes all three.

### Concerns

- None found.

### Suggestions

- Keep the planned mismatched-contact read test; it is the most direct proof the route cannot load an interaction belonging to another profile even if passed a stale numeric ID.

### Risk Assessment

**LOW.** It reuses established, tested single-writer and navigation patterns rather than creating a second write path.

## Plan 05 — Heatmap, intensity presentation, and durable preferences

### Summary

The plan correctly separates static presentational rendering from persistence and aggregation. It now names every currently required app-settings seam while preserving the Phase-36 portable-emission boundary.

### Strengths

- The current DAO is a closed model: the runtime read has an explicit SELECT and return mapping [src/db/app-settings-dao.ts:493-588](src/db/app-settings-dao.ts#L493-L588), writable keys flow through `COLUMN_OF` [src/db/app-settings-dao.ts:438-477](src/db/app-settings-dao.ts#L438-L477), and patches derive from `PortableSettingsSnapshot`. [src/db/app-settings-dao.ts:226-288](src/db/app-settings-dao.ts#L226-L288) Plan 05 now explicitly covers each required seam.
- It correctly avoids the export projection. `getPortableSettingsSnapshot` is a deliberately separate wire seam [src/db/app-settings-dao.ts:591-635](src/db/app-settings-dao.ts#L591-L635), and existing Phase 23/25/29/31 preferences demonstrate the optional-declare/restore-accept, later-emission pattern. [src/backup/backup-schema.ts:156-186](src/backup/backup-schema.ts#L156-L186)
- The plan's static RN heatmap is proportionate: no existing render-loop mechanism is needed for a count grid. It also keeps real zero-count cells distinct from structural Month blanks, avoiding a misleading visual equivalence.

### Concerns

- None found.

### Suggestions

- Add a small pure cell-classification test beside the presentation component, as the plan requires, rather than relying on a visual/device assertion for the zero-versus-structural-blank distinction.

### Risk Assessment

**MEDIUM.** Persistence is fully specified; remaining risk is palette/a11y density, appropriately covered by token checks and Pixel UAT.

## Plan 06 — Rolodex browser

### Summary

The browser plan has a clear separation between node-testable calendar logic and device-only gesture/render behavior. Its lifecycle ownership and reduced-motion requirements align with established application constraints.

### Strengths

- The date math is correctly isolated from the TSX renderer and uses the same local-time discipline needed by interaction storage; existing interaction timestamps are explicitly local wall-clock values. [src/db/recency-dao.ts:34-50](src/db/recency-dao.ts#L34-L50)
- The plan's worklet and conditional-mount rules correctly follow the project's non-reentrancy/performance posture. The app already documents that focused/background lifecycle must be considered, and the existing transaction source demonstrates the repository's emphasis on explicit ownership rather than nested helpers. [src/db/transaction.ts:12-29](src/db/transaction.ts#L12-L29)
- The drawer contract correctly includes lifecycle counts, unlike the heatmap count. That separation matches the existing independent interaction/event persistence tables. [src/db/migrations/001-initial.ts:96-125](src/db/migrations/001-initial.ts#L96-L125)

### Concerns

- None found.

### Suggestions

- At the phase Pixel gate, explicitly test non-gesture wheel controls at today, the maximum prior-year boundary, and leap-day clamping. The plan already requires device UAT; naming these three states makes the accessibility result auditable.

### Risk Assessment

**MEDIUM.** The logic is testable, but worklet ordering, gesture behavior, and background pause behavior require physical-device verification.

## Plan 07 — Detail sheet, interaction detail, and hard delete

### Summary

The plan correctly brings all three record families together without creating an unauthorized group persistence model. Delete remains a UI delegation to the existing tombstone/recompute DAO, while the group surface is deliberately dormant.

### Strengths

- The delete path is grounded in the existing core: it records an interaction tombstone, deletes by both IDs, and recomputes recency inside the transaction. [src/db/recency-dao.ts:312-350](src/db/recency-dao.ts#L312-L350) The plan puts DAO correctness tests in Plan 01 and asks Plan 07 only to prove UI routing.
- The plan's lifecycle labels are not dead-code work: the current map has only four labels [src/components/TimelineRow.tsx:24-30](src/components/TimelineRow.tsx#L24-L30), and the new sheet is explicitly required to import the exported map rather than reuse an unmounted row component.
- It treats `allow_ai` as an exact consent indicator—sparkle only for `1`—which fits the current AI read's deliberate exclusion of interaction-note free text. [src/db/ai-context-read.ts:94-106](src/db/ai-context-read.ts#L94-L106)

### Concerns

- None found. Group-related UI is correctly constrained to a hard-false seam and prohibited from reading or creating `group_event_id` before Phase 33.

### Suggestions

- Keep the synthetic predicate-true unit test limited to an in-memory detail shape, exactly as planned. It proves future presentation shape without masquerading as a Phase-32 database scenario.

### Risk Assessment

**MEDIUM.** It joins several UI paths and a destructive action, but it delegates data integrity to the existing single writer and has specific device failure-path UAT.

## Plan 08 — Profile integration and routing contract

### Summary

The final assembly plan now correctly upgrades only the Profile History renderer seam and closes all known origin-stack route gaps. It appropriately defines the backfill route context while leaving the actual detailed logging form to Phase 34.

### Strengths

- The current History renderer is a contained replaceable seam: it renders the interim list and “View all history” action inside `renderHistory`. [src/components/profile/ProfileModuleHost.tsx:387-408](src/components/profile/ProfileModuleHost.tsx#L387-L408) Mounting `HistorySection` there can preserve the surrounding persisted module/layout machinery. [src/components/profile/ProfileModuleHost.tsx:410-480](src/components/profile/ProfileModuleHost.tsx#L410-L480)
- The plan correctly identifies the present Settings navigation gap. `ContactProfileScreen` reuses `ThingsToRemember` for knowledge navigation [src/screens/ContactProfileScreen.tsx:393-414](src/screens/ContactProfileScreen.tsx#L393-L414), while Settings currently registers Profile but neither `ThingsToRemember` nor `MemoryHistory`. [src/navigation/tabs/SettingsStack.tsx:44-76](src/navigation/tabs/SettingsStack.tsx#L44-L76) Dashboard already registers both. [src/navigation/tabs/DashboardStack.tsx:44-57](src/navigation/tabs/DashboardStack.tsx#L44-L57) Plan 08 explicitly adds the missing Settings registrations.
- It similarly recognizes that the current `LogContact` placeholder is registered in Dashboard [src/navigation/tabs/DashboardStack.tsx:35-44](src/navigation/tabs/DashboardStack.tsx#L35-L44) but not Orrery or Settings. Adding typed `prefillDate` and all-stack registration is the correct route-contract boundary for Phase 34.
- The lifecycle-only empty-state distinction is well placed in the orchestration logic, supplied by the canonical read rather than inferred from a UI list length.

### Concerns

- None found in the revised plan. The former Settings-originated knowledge-change crash is concretely addressed by route types, screen registrations, and a Settings-origin UAT.

### Suggestions

- Preserve the plan's wording in the final summary that the destination remains a Phase-32 placeholder. This prevents phase verification from over-crediting HIST-15 before Phase 34 supplies the actual detailed form.

### Risk Assessment

**MEDIUM.** It is the integration point for all prior work, but it has clear source-level registration checks and a focused Pixel UAT matrix.

## Overall Risk Assessment

**HIGH until Plan 02's existing-UID restore conflict is made fail-closed; MEDIUM after that correction.** All cycle-2 architectural concerns are resolved in the current plans with specific implementation and verification requirements. The remaining issue is narrow but high impact because `allow_ai` is a consent/privacy bit: SQLite defaults apply only on INSERT, while the real restore code also has an `ON CONFLICT ... DO UPDATE` branch that preserves omitted columns. Fixing that branch and adding the matching regression will make the phase plan executable without changing the settled Phase 32/33/36 boundaries.

---

## Claude Review

# Phase 32 Plan Review — Convergence Cycle 3 (Claude, independent cross-AI)

## 1. Summary

Phase 32's eight plans are in strong, well-converged shape; cycles 1–2 have driven the
substantive risks to ground and cycle-3 revisions (commit bd3d726) are accurate against the
code on disk. I independently verified the highest-risk claims — the migration number, the
CHECK-less remap target, the *complete* set of `quality`/`channel` literal consumers, the
single shared interaction-insert writer, the intensity-window off-by-one, the EventType gap,
the restore/export backdoor, the app-settings-dao seam line references, the "TimelineRow is
unmounted" claim, and the SettingsStack route gaps — and every one checks out. The recorded
decisions the review must protect are respected: migration 025 is the correct next number and
adds **no** group schema, `BACKUP_FORMAT_VERSION` is untouched, the SQL column stays `quality`,
and no read path gains a network dependency. I found **no new HIGH or MEDIUM concern** the
current PLAN.md files do not already address, and nothing that can only be fixed by reversing a
recorded decision. Overall risk is **LOW**; I recommend terminating the convergence loop.

## 2. Strengths (with evidence)

- **Migration number is correct and self-verified.** `TARGET_VERSION = PROFILE_PRESENTATION_SCHEMA_VERSION`
  (`src/db/database.ts:62`), and `profile-presentation.ts:4` sets that to `24`. So Phase 32 is `025`,
  exactly as D-12 and every plan state. Plan 01 also re-mandates re-checking head+1 on disk
  (`32-01-PLAN.md` Task 1 `<precondition>`). No drift.
- **The remap is provably constraint-safe.** `001-initial.ts:103` (`channel TEXT NOT NULL DEFAULT 'unspecified'`)
  and `:106` (`quality TEXT`) are both CHECK-less, so the `UPDATE … SET quality/channel = CASE …`
  cannot violate a constraint — the plan's ALTER+UPDATE-only, no-rebuild claim holds.
- **The quality/channel consumer audit is genuinely complete.** A repo-wide grep for `'good'|'fine'|'hard'`
  (non-test) returns exactly `ai-context-read.ts:132-136`, `digest-read.ts:158-161`, and
  `TouchpointRefineForm.tsx:73` — precisely the three surfaces Plan 01 Tasks 2/3 remap. No hidden
  fourth consumer. `in-person` literals appear only in `src/types.ts` (the `LastInteractionType`
  the plan documents as dead) and `TouchpointRefineForm.tsx`.
- **`LastInteractionType` really is unused.** `src/types.ts:40-44,82` declare the type and the optional
  `Contact.lastInteraction`, and a non-test grep for `lastInteraction` finds **zero** populators —
  Plan 01's "audit-and-document, exclude from migration" disposition is factually right.
- **Single-writer discipline is airtight.** `insertInteractionCore` is literally
  `insertInteraction as insertInteractionCore` (`recency-dao.ts:431`); capture-dao, bulk-actions-dao,
  contacts-dao, and interaction-assist-dao all funnel through the one `insertInteraction`
  (`recency-dao.ts:179`). Adding `duration`/`allow_ai` as optional-with-default columns there covers
  every writer without breaking the other callers — a real strength of routing it through one function.
- **The email-assist gap is real and correctly closed.** `interaction-assist-dao.ts:105` passes
  `channel: transactionAssist.channel` raw into the interaction insert; the 014 transport CHECK
  permits `email`, so without the cycle-2 fix an email assist would persist a retired `email` value
  into a v25 row. Plan 01 Task 2 routes it through `remapLegacyChannel`.
- **The restore backdoor is real and correctly closed.** `restore-apply.ts` writes `r.quality`/`r.channel`
  verbatim in the interactions `INSERT … ON CONFLICT` (the `if (entity === "interactions")` line), and
  `export-manifest.ts` SELECTs the live `i.quality, i.channel` — so remap-on-ingest (Plan 02 Task 3) plus
  "export needs no change" (guard test only) is the right split.
- **Intensity-window's off-by-one is specified correctly.** `intensity-logic.ts:110-139` computes
  `periodStartMs = nowMs - periodDays*MS_PER_DAY` and counts rows in `[periodStart, now]`. Plan 03 pins
  `periodDays` = *inclusive* local-day count (first→last) and `effectiveNow` = window-end 23:59:59; using
  the inclusive count (not the 30-vs-31 difference) is exactly what keeps the window's first day inside
  the period. The fixed-value regression (`currentCount === N`) is the right assertion.
- **EventType gap and composition primitive verified.** `events-dao.ts:36` is `archive|restore|snooze|unsnooze`
  (no bind/unbind); `recordEventCore` (`:60-79`) is insert-only, `?`-bound, non-mutexed — matching Plan 02's
  in-transaction, immutable producers exactly.
- **The "TimelineRow is unmounted" reasoning is true.** The only non-test hit for `TimelineRow` outside the
  component file is `src/db/timeline-read.ts:56`, which is an unrelated local `interface TimelineRow`. There
  is no `@/components/TimelineRow` import and no `<TimelineRow` JSX anywhere. So exporting `EVENT_LABELS`
  (`TimelineRow.tsx:25`) and consuming it in DateDetailSheet keeps the bind/unbind labels live, as Plan 07 claims.
- **App-settings-dao line references are all accurate** (Plan 05): `:92` AppSettings, `:226`
  PortableSettingsSnapshot, `:286` AppSettingsPatch, `:312` WritableSettingsKey, `:353` AppSettingsRow,
  `:438` COLUMN_OF, `:496` getAppSettings runtime SELECT, `:597`/`:627` the reserved snapshot SELECT.
- **SettingsStack route gaps are real.** The plans correctly identify that `EditInteraction` (Plan 04),
  `LogContact`, `ThingsToRemember`, and `MemoryHistory` (Plan 08) must be added to SettingsStack because
  Profile is hosted there — a genuine crash-avoidance fix, not a backstop.
- **No cross-wave tsc coupling on the declare-only keys.** `PORTABLE_SETTINGS_KEYS` is a plain
  `Set([...string literals])` (`backup-schema.ts:133`), not `Set<keyof PortableSettingsSnapshot>`, so Plan 01
  adding `historyLens`/`historyCycleCount` at wave 1 does not require the Plan 05 type change to compile —
  matching the existing Phase-23/25/29/30/31 precedent keys in the same set.

## 3. Concerns

No HIGH or MEDIUM concerns. Every candidate I probed is already handled in a current PLAN.md.

- **[LOW] Plan 05's negative grep-gate depends on brace column.** The
  `! awk '/function getPortableSettingsSnapshot/,/^}/' … | grep -q 'history_lens…'` gate
  (`32-05-PLAN.md` Task 1 `<verify>`) delimits the function body by a `}` in column 0. This is correct for the
  current top-level `export async function getPortableSettingsSnapshot` (`app-settings-dao.ts:597`), but it is a
  brittle way to scope a region. **Already adequately addressed** by the co-equal "BACKUP_FORMAT_VERSION unchanged
  (git diff)" and "PortableSettingsSnapshot emission untouched" assertions, so this is a robustness nit, not a gap.
- **[LOW] Plan 02 Task 2 leaves the exhaustive-EventType-switch outcome conditional.** The task says "if one
  exists, widen it; if not, record the finding." I checked the one live rendering consumer (`TimelineRow.tsx:48`)
  and it uses a safe `EVENT_LABELS[item.type] ?? item.type` fallback, and `restore-apply` inserts `type` verbatim
  — so no reader throws today. The round-trip test is a sufficient guard. **Already addressed**; noting only so the
  executor treats "no throwing switch found" as the expected (verified) outcome, not a loose end.

## 4. Suggestions

- **`32-05-PLAN.md` (Task 1 verify):** optionally harden the region-scoped gate against a future re-indent of
  `getPortableSettingsSnapshot` by anchoring on the next `export`/`function` boundary rather than `/^}/`
  (e.g. `awk '/export async function getPortableSettingsSnapshot/{f=1} f&&/^}/{print;exit} f'`). Non-blocking;
  the git-diff assertion already backstops it.
- **`32-02-PLAN.md` (Task 2 done-note):** state the verified expectation inline — "no exhaustive EventType
  switch throws (TimelineRow uses `?? item.type`; restore inserts verbatim)" — so the executor records a
  confirmation rather than re-deriving it. Cosmetic.

No plan change is required for either; both are polish.

## 5. Risk Assessment

**Overall: LOW.**

Justification: the phase's single irreversible, unreachable-device action (migration 025) is correctly numbered,
constraint-safe (CHECK-less columns), consumer-complete (verified repo-wide), single-writer-routed, gated behind
an explicit one-way-door checkpoint, and proven by a jump-from-v1 fixture test. The two systemic data-integrity
traps cycles 1–2 surfaced — the email-channel path and the restore-ingest backdoor — are both real, both routed
through the one shared `interaction-vocabulary.ts` map, and both test-pinned. The intensity off-by-one is pinned
to an exact inclusive-day formula with a fixed-value regression. Every recorded-decision guardrail (no group
schema in 025, no format bump, `quality` column retained, local-first read paths) is enforced by prohibitions
and grep-gates, and nothing in the plans requires reversing an ADR or HANDOFF entry. The residual risk lives
entirely in UI-integration surfaces (Rolodex worklet safety, cross-stack route registration, on-device render)
that are correctly deferred to node tests plus Pixel phase-gate UAT. I recommend the convergence loop terminate.
