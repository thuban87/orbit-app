---
phase: 32
reviewers: [codex, claude]
reviewed_at: 2026-09-11T21:49:21Z
plans_reviewed: [32-01-PLAN.md, 32-02-PLAN.md, 32-03-PLAN.md, 32-04-PLAN.md, 32-05-PLAN.md, 32-06-PLAN.md, 32-07-PLAN.md, 32-08-PLAN.md]
review_cycle: 4
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-opus-4-8"
model_sources:
  codex: "banner"
  claude: "self-report"
---

# Cross-AI Plan Review — Phase 32

## Consensus Summary

Both prompt-fed, source-grounded reviewers (Codex and an independent Claude session) converge on the same verdict: **the current Phase 32 plans are ready to execute, with zero unresolved HIGH or MEDIUM correctness/privacy/sequencing/recorded-decision concerns.** This is cycle 4; cycles 1–3 drove 20 → 8 → 1 unresolved concerns, and the single cycle-3 HIGH is now closed.

Both reviewers independently verified the cycle-3 HIGH against the actual code: `restore-apply.ts:189`'s interactions upsert omits `allow_ai` from BOTH the INSERT column list and the `ON CONFLICT(uid) DO UPDATE SET` arm, and `reconciliation.ts:370-373` emits the `update` action only when a backup row wins over an existing local row. Plan 02 Task 3's addition of `allow_ai=0` to the SET arm therefore makes restore fail-closed on both paths (fresh insert → column DEFAULT 0; merge/update → forced OFF), enforcing D-04 without adding `allow_ai` to the wire payload and without bumping `BACKUP_FORMAT_VERSION`. No recorded decision is reversed.

The one non-consensus item is a Codex suggestion (not a severity-tagged concern): Plan 01's `files_modified` frontmatter omits `src/types.ts` even though Task 2 documents `LastInteractionType` in that file. This is cosmetic — Task 2's `<action>` and `<acceptance_criteria>` already instruct the in-file comment on `src/types.ts`, so /gsd-execute-phase performs the edit regardless of the manifest list. It is not actionable (the work is already incorporated into the plan body).

### Agreed Strengths
- Migration 025 correctly sequenced at head+1 (head = 24, `database.ts:62`); additive ALTER+UPDATE, jump-from-v1 tested; SQL column stays `quality`.
- Vocabulary map lives once in `interaction-vocabulary.ts`; migration CASE literals frozen in-file and test-pinned equal to the shared helper — no drift, no runtime coupling.
- Every live legacy-literal consumer covered in lockstep (`ai-context-read.ts`, `digest-read.ts`), plus the `markAssistLogged` email→Message path (014 CHECK permits `email`).
- Lifecycle events composed via the non-mutexed `recordEventCore` inside the already-open bind/unbind transactions — no nested-transaction hang.
- D-12 "inert seam" is structurally true: no `group_event_id` column exists anywhere in `src/`, so group predicates resolve hard-false; no group schema is smuggled into 025.
- Single recency writer preserved for every interaction mutation (edit via `editTouchpointFull`, delete via `deleteTouchpoint`).
- Cross-stack route-registration gaps (LogContact, EditInteraction, ThingsToRemember/MemoryHistory in SettingsStack/OrreryStack) are real latent crashes, correctly and decision-preservingly closed.

### Agreed Concerns
- None at HIGH or MEDIUM. Both reviewers explicitly declined to manufacture nits and rated the convergence to zero as the correct outcome.

### Divergent Views
- Codex raised one cosmetic suggestion (Plan 01 `files_modified` manifest omits `src/types.ts`); Claude did not raise it. Assessed as non-actionable — the edit is already specified in Task 2's action/acceptance-criteria, so it is not invisible to execute-phase.
- Overall risk rating: both land at aggregate MEDIUM, driven entirely by the irreversible migration 025 (gated by a blocking human checkpoint) and the device-only Skia Rolodex verification (Pixel UAT) — inherent to the work, not plan defects.

---

## Codex Review

## Overall

The plans are ready to execute. I found no unresolved HIGH or MEDIUM correctness, privacy, sequencing, or recorded-decision violations in the current revision.

The cycle-3 restore concern is genuinely closed by Plan 02’s explicit `allow_ai=0` merge-arm requirement: baseline restore currently has an `ON CONFLICT` update that would otherwise preserve destination columns ([restore-apply.ts](/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:189)). The plan now targets exactly that path.

Risk assessment: **MEDIUM overall**, solely because migration 025 is irreversible and the phase is large—not because the plan has an unaddressed design flaw.

## Plan 01 — Migration and vocabulary lockstep

**Summary:** Sound. It correctly owns migration 025 and locks the high-risk vocabulary rewrite to its live consumers.

**Strengths:**

- The migration is correctly sequenced after schema 24: `TARGET_VERSION` is currently 24 and the registry ends at the profile-presentation migration ([database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:62), [database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:88)).
- The plan correctly preserves `quality` as the SQL column; the existing schema is CHECK-less for both `quality` and `channel`, so an additive ALTER plus value UPDATE is appropriate ([001-initial.ts](/home/bwales/projects/orbit-app/src/db/migrations/001-initial.ts:96)).
- It covers the real stale-literal hazards: AI aggregation still compares `good/fine/hard` ([ai-context-read.ts](/home/bwales/projects/orbit-app/src/db/ai-context-read.ts:124)) and digest does likewise ([digest-read.ts](/home/bwales/projects/orbit-app/src/db/digest-read.ts:154)).
- It correctly includes the assist writer: it currently passes the transport channel through unchanged ([interaction-assist-dao.ts](/home/bwales/projects/orbit-app/src/db/interaction-assist-dao.ts:98)), while the transport CHECK allows `email` ([014-interaction-assists.ts](/home/bwales/projects/orbit-app/src/db/migrations/014-interaction-assists.ts:8)).

**Concerns:** None.

**Suggestions:** The declared `files_modified` list omits `src/types.ts`, although Task 2 explicitly audits/comments on `LastInteractionType`. Add it for manifest accuracy.

**Risk:** **HIGH** operationally due to the irreversible migration; mitigation coverage is strong.

## Plan 02 — Lifecycle events and restore compatibility

**Summary:** Sound. It closes both restore backdoors and uses the established in-transaction event primitive.

**Strengths:**

- `bindContact` and `unbindContact` already own write transactions ([contact-lifecycle-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-lifecycle-dao.ts:43), [contact-lifecycle-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-lifecycle-dao.ts:92)), while `recordEventCore` is expressly the no-new-transaction composition primitive ([events-dao.ts](/home/bwales/projects/orbit-app/src/db/events-dao.ts:60)).
- The plan’s restore remap is necessary: restore currently inserts backup interaction `quality` and `channel` verbatim ([restore-apply.ts](/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:189)).
- The merge-path `allow_ai=0` requirement is correctly targeted. A default only protects fresh inserts; the existing conflict-update clause otherwise preserves local values ([restore-apply.ts](/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:189)).

**Concerns:** None.

**Suggestions:** None.

**Risk:** **MEDIUM**; restore reconciliation is shared infrastructure, but the plan’s focused regression tests are appropriate.

## Plan 03 — History aggregation and read seam

**Summary:** Sound. It separates pure date/aggregation logic from database reads and preserves the Phase 32 inert group seam.

**Strengths:**

- The plan correctly avoids `computeContactIntensity` for historical windows: that function derives its period from cadence and consumes all inputs ([impact.ts](/home/bwales/projects/orbit-app/src/services/impact.ts:134)). Its proposed use of the lower-level `computeIntensity` is the correct seam ([intensity-logic.ts](/home/bwales/projects/orbit-app/src/services/intensity-logic.ts:104)).
- It accounts for the actual intensity time-bound behavior, which excludes rows after `now` and measures the interval backward from it ([intensity-logic.ts](/home/bwales/projects/orbit-app/src/services/intensity-logic.ts:110)). The fixed past-window test is therefore meaningful.
- It correctly iterates all current-state keys; the existing history DAO is explicitly single-field ([current-state-history-read.ts](/home/bwales/projects/orbit-app/src/db/current-state-history-read.ts:61)), and the registry currently has two keys ([memory-registry.ts](/home/bwales/projects/orbit-app/src/db/memory-registry.ts:65)).

**Concerns:** None.

**Suggestions:** None.

**Risk:** **MEDIUM**; date-window semantics are easy to regress, but the proposed pure tests cover the important boundaries.

## Plan 04 — Canonical edit route

**Summary:** Sound. It preserves the single-writer recency contract and resolves the cross-stack route issue.

**Strengths:**

- The plan correctly routes writes through `editTouchpointFull`, which scopes by both interaction and contact, validates changes, and recomputes recency ([recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:258)).
- The shared future-date copy exists and is exported for reuse ([TouchpointRefineForm.tsx](/home/bwales/projects/orbit-app/src/components/TouchpointRefineForm.tsx:55)).
- Settings really does host `Profile` but not the proposed edit route today ([SettingsStack.tsx](/home/bwales/projects/orbit-app/src/navigation/tabs/SettingsStack.tsx:53)), so all-three-stack registration is necessary and planned.

**Concerns:** None.

**Suggestions:** None.

**Risk:** **MEDIUM**; it adds a mutation entry point, but it is intentionally thin over the established DAO.

## Plan 05 — Heatmap, intensity, and persisted controls

**Summary:** Sound. It threads persistence through the actual closed settings model while respecting Phase 36’s wire-format boundary.

**Strengths:**

- The plan identifies every needed settings seam: `PortableSettingsSnapshot` drives `AppSettingsPatch` ([app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:226), [app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:286)); runtime reads are separately defined in `getAppSettings` ([app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:493)).
- It correctly leaves export emission alone: the portable snapshot has its own distinct SELECT ([app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:597)).
- Static RN cells are appropriate: no animation/read-path work is needed for count buckets.

**Concerns:** None.

**Suggestions:** None.

**Risk:** **LOW–MEDIUM**; primarily visual and persistence wiring, with good token/a11y constraints.

## Plan 06 — Rolodex browser

**Summary:** Sound. It isolates date correctness in testable logic and puts focus/AppState ownership at the browser boundary.

**Strengths:**

- The approach respects the project’s rendering rule: animation must pause off-focus/background, and must not use React state per frame.
- The proposed reduced-motion split matches existing infrastructure: the project already provides a shared-value hook for worklets and a React-tree boolean hook.
- The drawer’s lifecycle-inclusive count is correctly distinct from heatmap count-only behavior.

**Concerns:** None.

**Suggestions:** Keep the optional Skia glow omitted unless a genuinely suitable existing token provides the intended visual result; the plan already permits that.

**Risk:** **MEDIUM**; device-only gesture/worklet behavior is the primary remaining validation area.

## Plan 07 — Detail sheet, delete, and group seam

**Summary:** Sound. It preserves hard delete, consent signaling, and Phase 33 ownership.

**Strengths:**

- Hard delete is routed to the correct existing primitive: it writes a tombstone, deletes with both IDs, and recomputes recency ([recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:313)).
- The plan correctly treats group functionality as dormant. There is no `group_event_id` in the current interaction schema ([001-initial.ts](/home/bwales/projects/orbit-app/src/db/migrations/001-initial.ts:96)), so it does not attempt an impossible Phase 32 fixture.
- Exporting and consuming the event-label map is a sensible way to avoid a dead bind/unbind label change: it is currently private ([TimelineRow.tsx](/home/bwales/projects/orbit-app/src/components/TimelineRow.tsx:24)).

**Concerns:** None.

**Suggestions:** None.

**Risk:** **MEDIUM**; destructive UX needs Pixel verification, while the actual data deletion path is already well-contained.

## Plan 08 — Profile assembly and route contracts

**Summary:** Sound. It replaces the actual timeline stub without changing persisted layout mechanics and closes origin-stack crashes.

**Strengths:**

- The planned replacement targets the exact weak renderer: `renderHistory()` currently renders a few `channel · occurredAt` rows and “View all history” ([ProfileModuleHost.tsx](/home/bwales/projects/orbit-app/src/components/profile/ProfileModuleHost.tsx:387)).
- It correctly identifies the current bad history route: Profile’s `onOpenHistory` currently navigates to `ThingsToRemember` ([ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:397)).
- It correctly closes Settings registration gaps: Settings currently lacks `LogContact`, `ThingsToRemember`, and `MemoryHistory` despite hosting Profile ([SettingsStack.tsx](/home/bwales/projects/orbit-app/src/navigation/tabs/SettingsStack.tsx:38)).
- Extending `LogContact` from its current `{ contactId?: number }` contract ([types.ts](/home/bwales/projects/orbit-app/src/navigation/types.ts:39)) with `prefillDate` is the right Phase 32/34 seam.

**Concerns:** None.

**Suggestions:** None.

**Risk:** **MEDIUM**; integration-heavy, but dependencies and Settings-origin reachability are explicitly covered.

## Verdict

**Approve for execution after the planned irreversible-migration checkpoint.** The current plans preserve all listed locked constraints: no group schema in 025, no Phase 32 backup-format bump, retained `quality` column, offline/local read paths, and single-writer interaction mutations.

---

## Claude Review

Repo access: YES — I read the actual source on disk (all 8 plans, 32-CONTEXT, and every interactions writer/reader, migration head, restore-apply, reconciliation, events-dao, contact-lifecycle-dao, app-settings-dao, impact/intensity-logic, and the three navigation stacks) and verified the plans' file:line claims against it.

**Source-grounding performed (key verifications):**
- Head migration = 24 (`PROFILE_PRESENTATION_SCHEMA_VERSION = 24`, `database.ts:62`), so migration 025 = head+1 — Plan 01's precondition is correct.
- **No `group_event_id` / `groupEventId` exists anywhere in `src/`** (grep empty) → the D-12 "inert seam" framing in Plans 02/03/07 is structurally true: the group-link predicate resolves hard-false because the column does not exist.
- **Every writer of `interactions` enumerated:** `recency-dao.ts:195/281/332` (the single spine — Plan 01 extends), `purge-dao.ts:82` (contact-scoped DELETE, no vocab/consent), `benchmark.ts:120` (dev-only, no importer; writes `channel='unspecified'`, no quality, no legacy value → harmless), `restore-apply.ts:189` (the separate writer — Plan 02 owns). No writer is missed; nothing else can reintroduce legacy vocabulary or an unsafe consent bit.
- `ai-context-read.ts:132-138` and `digest-read.ts:157-160` tally `'good'/'fine'/'hard'` literals — confirmed as the live consumers Plan 01 Task 2 must remap.
- `export-manifest.ts:52` SELECTs the live `i.quality, i.channel` columns → post-migration it auto-emits the new vocabulary, so no source change / no format bump is needed (Plan 02 claim correct).

---

### Plan 01 — Migration 025 + consumer lockstep + refine form
**Summary:** Ships the irreversible on-device migration (Tone/channel value remap, nullable `duration`, `allow_ai NOT NULL DEFAULT 0 CHECK(0,1)`, two `app_settings` history prefs), the single `interaction-vocabulary.ts` map, every live-literal consumer in lockstep, and the extended `TouchpointRefineForm`. **Strengths:** correctly keeps the SQL column named `quality` (locked invariant, avoids Phase-36 coupling); freezes migration CASE literals in-file while test-pinning them equal to the shared helper (prevents drift without runtime dependence); routes `markAssistLogged` email→Message through the shared helper (014 CHECK verified to permit `email`); atomic-commit rationale for not splitting Task 1/2 is sound (a partial rename silently zeroes AI/digest counts). Verified `insertInteraction` (`:195`) and `editTouchpointFull` (`:281`) column lists — adding `duration`/`allow_ai` as bound params is mechanical and preserves the id-AND-contact_id + changes===1 + recompute contract. **Concerns:** none new. **Risk: LOW-MEDIUM** (irreversible migration, but additive ALTER+UPDATE, jump-from-v1 tested, blocking human checkpoint gates the one-way door).

### Plan 02 — Lifecycle events + restore fail-closed (the cycle-3 HIGH)
**Summary:** Adds `bind`/`unbind` to `EventType` (verified `events-dao.ts:36` currently `archive|restore|snooze|unsnooze`), produced inside the existing `bindContact`/`unbindContact` transactions via the non-mutexed `recordEventCore` (`:60`), plus the restore-side vocabulary remap and the allow_ai fail-closed fix. **Cycle-3 HIGH verification (the review's central ask):** I confirmed against `restore-apply.ts:189` that the interactions upsert **omits `allow_ai` from both the INSERT column list AND the `ON CONFLICT(uid) DO UPDATE SET` arm**. I confirmed `reconciliation.ts:370-373` emits `kind: localRow ? "update" : "insert"` only when `rowWinner.source === "incoming"` — i.e. the UPDATE arm fires exactly when a backup row wins over an existing local row. Therefore:
- Fresh insert (replace-all path deletes-then-inserts; merge insert of a new uid) → no `allow_ai` bound → column DEFAULT 0. **Fail-closed. ✓**
- Merge/update over an existing `allow_ai=1` row with a field-less backup winner → without the fix, DEFAULT never fires and consent silently survives. Plan 02 Task 3 adds `allow_ai=0` to the SET arm → forced OFF. **Fail-closed on BOTH paths. ✓**

This is a real defect, correctly and minimally fixed; it enforces D-04, does not add `allow_ai` to the wire payload, and does not bump `BACKUP_FORMAT_VERSION` — no recorded decision reversed. **Strengths:** in-transaction event composition avoids the non-reentrant-mutex hang (verified `bindContact` opens `inWriteTransaction` at `:43`); single-source vocabulary map consumed, not duplicated. **Concerns:** none new. **Risk: LOW.**

### Plan 03 — Aggregation seam (window/buckets/cycles/intensity + history-read)
**Summary:** Pure window/bucket/cycle math and the canonical `history-read` DAO, count-only, group seam inert. **Cycle-2 HIGH verification (window-scoped intensity):** I read `intensity-logic.ts:104-138` and `impact.ts:134-146`. `computeIntensity(interactions, periodDays, rarelyResponds, now)` — signature exactly matches Plan 03's specified call `computeIntensity(filtered, periodDays, rarelyResponds, effectiveNow)`. The math (`periodStartMs = nowMs − periodDays·MS_PER_DAY`; excludes `occurredAt > now`; `currentCount = rows ≥ periodStartMs`) confirms the plan's reasoning: with `effectiveNow = window-end` and `periodDays = window-span`, `periodStart` lands at the window start → `currentCount` = qualifying rows inside the window; with real `now`, a past window reads ~0. The fixed-value `currentCount === N` regression is the right guard. The `{available:false}` guard (verified in `computeContactIntensity`: `trackingEnabled !== 1 || intervalDays === null`) is correctly re-asserted in `intensity-window` since it bypasses the wrapper. **Concerns:** none new. **Risk: LOW-MEDIUM** (correctness-critical count/intensity math, but pure and heavily tested).

### Plan 04 — Edit Interaction route
**Summary:** New `readInteractionForEdit` (contact-scoped, selects note+duration+allow_ai), a node-tested logic module, and `EditInteractionScreen` saving only through `editTouchpointFull`. **Reachability verification:** confirmed `SettingsStack.tsx:55` registers `Profile` but **not** `Edit`/`EditInteraction` (nor does it register the contact-edit screen), and Profile is reachable in Settings via Archived → Profile — so registering `EditInteraction` in all three stacks is genuinely required (React Navigation throws otherwise). Reuse of the shipped `FUTURE_DATETIME_MESSAGE` and the "UI guard agrees with DAO `rejectFutureOccurredAt`" test avoid a second source of truth. **Concerns:** none new. **Risk: LOW.**

### Plan 05 — Heatmap/Intensity/context-card + theme tokens + persistence
**Summary:** Static count-only heatmap, neutral intensity chart, anchored context card, new per-palette tokens, and lens/preset persistence. **Verification:** every claimed `app-settings-dao.ts` seam line checked and correct — `PortableSettingsSnapshot:226`, `AppSettingsPatch:286`, `WritableSettingsKey:312`, `AppSettingsRow:353`, `COLUMN_OF:438`, `getAppSettings` runtime SELECT `:493-496`, `getPortableSettingsSnapshot:597` (the Phase-36-reserved emitter that must stay untouched). The declare-optional-in-snapshot / emit-in-runtime-SELECT-only split is exactly the shipped Phase-23/25/31 pattern (the file already carries a `:254-262` comment naming "Plan 05"). Static RN Views (no Skia loop) correctly sidestep the worklet hazard for the heatmap. **Concerns:** none new. **Risk: LOW-MEDIUM** (broad DAO surface + palette contrast, both gated by tests/`check:colors`).

### Plan 06 — Rolodex History Browser (the only animated surface)
**Summary:** Node-tested date roll/clamp/marker logic plus Reanimated/GH wheels with explicit RolodexBrowser-owned pause-on-blur and reduced-motion. **Strengths:** directly honors the recorded worklet-forward-ref hazard (helpers above callers), the "no per-frame setState" rule with the correct nuance (committed selection state allowed), and conditional-mount lifecycle ownership. Skia glow is token-or-dropped. **Concerns:** none new; the load-bearing on-device correctness (Skia/render-loop perf, worklet crash) is legitimately a Pixel-UAT backstop, not a plan defect. **Risk: MEDIUM** (device-only verification, inherent to an animated surface — well-mitigated).

### Plan 07 — Detail Sheet / Interaction Detail / hard-delete / group seam
**Summary:** Shared Detail Sheet interleaving interactions + read-only lifecycle + knowledge-change rows, sparkle gated strictly on `allow_ai===1`, hard-delete via `deleteTouchpoint`, and a dormant `GroupScopePrompt`. **Dead-code claim verified:** `EVENT_LABELS` is private at `TimelineRow.tsx:25`; the only `TimelineRow` hit outside the component is an unrelated `interface TimelineRow` in `timeline-read.ts:56` — **no `.tsx` imports the TimelineRow component**, so the plan's "export EVENT_LABELS and have the mounted DateDetailSheet consume it" argument (edit is live, not dead code) is accurate. Delete correctly points at the DAO regression in Plan 01 and only proves UI routing. Group surfaces reference no `group_event_id` (grep-gated). **Concerns:** none new. **Risk: LOW-MEDIUM.**

### Plan 08 — Assembly + cross-stack route registration
**Summary:** Mounts `HistorySection` behind the `ProfileModuleHost` renderer seam, wires cell/drawer→sheet, the lifecycle-only≠empty predicate (Plan 03's `hasLifecycleRecords`), and the typed `LogContact {contactId, prefillDate}` contract. **Reachability verification (HIGH class):** confirmed `OrreryStack` does **not** register `LogContact`, and `SettingsStack` registers **neither** `LogContact` nor `ThingsToRemember`/`MemoryHistory` (Dashboard/Orrery both register the latter two). Since ContactProfileScreen's knowledge nav targets `ThingsToRemember` and Profile is reachable from Settings, a Settings-originated knowledge-change edit crashes today — a real latent gap the plan closes decision-preservingly by registering the existing screens. All three cross-stack gaps (LogContact, EditInteraction via Plan 04, ThingsToRemember/MemoryHistory) are real and correctly fixed. Correctly reframes HIST-15 as the route contract only (Phase-34 owns the form). **Concerns:** none new. **Risk: LOW-MEDIUM.**

---

## Overall consensus & risk

**No new correctness, safety, or privacy defect found.** The cycle-3 HIGH — restore fail-closed for `allow_ai` on the merge/update path — is **genuinely and verifiably resolved** in the current `32-02-PLAN.md`: grounded against `restore-apply.ts:189` (upsert omits `allow_ai` on both arms) and `reconciliation.ts:370-373` (update fires only on a backup-wins-over-local row), the `allow_ai=0` SET-arm fix makes restore fail-closed on both the fresh-insert (DEFAULT 0) and merge/update paths, while leaving the wire payload and `BACKUP_FORMAT_VERSION` untouched — enforcing D-04 without reversing any recorded decision.

Every load-bearing file:line claim I sampled across all 8 plans was accurate (migration head, the interactions writers, the app-settings-dao seams, `computeIntensity`'s signature/math, EVENT_LABELS privacy, and the three navigation stacks). The plans respect the project's non-negotiables: SQL column stays `quality`, no `group_event_id` in migration 025 (D-07/D-12), single recency writer, no format bump, local-first. The earlier cycles' HIGHs (window-scoped intensity, app-settings seam completeness, markAssistLogged email→Message, TimelineRow dead-code, cross-stack reachability) are all present in the current revisions with grounded acceptance criteria.

**This converges to zero unresolved concerns — the correct outcome for cycle 4.** I am deliberately not manufacturing nits: the remaining backstops (Pixel UAT of the Rolodex render loop, large-text reflow, on-device delete-failure) are legitimately device-only and correctly scoped as such.

**Aggregate phase risk: MEDIUM**, dominated by (a) the irreversible migration 025 — well-mitigated by the additive shape, jump-from-v1 testing, consumer lockstep, and the blocking human checkpoint; and (b) the Skia Rolodex, verifiable only on the physical Pixel. Both are inherent to the work, not plan deficiencies.

---
