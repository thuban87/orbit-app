---
phase: 29
cycle: 1
reviewers: [codex, claude]
reviewed_at: 2026-09-07T00:34:11-05:00
plans_reviewed: [29-01-PLAN.md, 29-02-PLAN.md, 29-03-PLAN.md, 29-04-PLAN.md, 29-05-PLAN.md, 29-06-PLAN.md, 29-07-PLAN.md, 29-08-PLAN.md, 29-09-PLAN.md, 29-10-PLAN.md, 29-11-PLAN.md, 29-12-PLAN.md]
models:
  codex: "gpt-5.6-sol (reasoning=medium)"
  claude: "claude-opus-5 (reasoning=medium)"
model_sources:
  codex: "pinned"
  claude: "pinned"
---

# Cross-AI Plan Review — Phase 29, Cycle 1

## Codex Review

# Summary

Phase 29 is well designed and substantially complete, but I recommend conditional approval after resolving one blocking verification issue and two implementation-contract gaps.

The plan set correctly covers ORRC-01–16, follows the dossier and applicable ADRs, preserves existing SQLite invariants, and sequences the work coherently across 12 dependent waves. The strongest portions are the guarded filtered reorder, explicit neutral handling for never-contacted contacts, one-frame render/hit architecture, persistence boundary, and race-aware lifecycle design.

No files were edited and no device commands were run. The required `graph:ask` queries were attempted for the governed Orrery, settings, relationships, navigation, and backup files, but every invocation failed before reading the graph because `tsx` could not open its IPC socket (`EPERM`). I therefore made no inference from graph absence and verified governance directly against the ADR bodies and source.

# Strengths

- The canonical-view transition accurately implements the ratified ADR reversal. The current code still owns two modes, a morph shared value, and endpoint-specific hit geometry ([OrreryScreen.tsx:121](/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:121), [OrreryScreen.tsx:179](/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:179), [OrreryScreen.tsx:403](/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:403)). Plan 29-01 removes only that superseded behavior while preserving static timestamp placement and the clock lifecycle, matching ADR-077 exactly ([ADR-077:18](/home/bwales/projects/orbit-app/docs/decisions/ADR-077-single-canonical-orrery-with-a-constrained-inspection-camera.md:18), [29-01-PLAN.md:94](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-01-PLAN.md:94)).

- Never-contacted semantics are handled correctly. The existing default Orrery read deliberately requires `last_contact IS NOT NULL` ([orrery-read.ts:89](/home/bwales/projects/orbit-app/src/db/orrery-read.ts:89)); removing that predicate would let SQL’s final `ELSE 'stable'` fabricate health ([status.ts:53](/home/bwales/projects/orbit-app/src/db/status.ts:53), [status.ts:72](/home/bwales/projects/orbit-app/src/db/status.ts:72)). Plan 29-03 instead keeps the default reader unchanged and introduces explicit All Contacts/Not Contacted null-health branches ([29-03-PLAN.md:98](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-03-PLAN.md:98)). That honors both the dossier amendment and ADR-011.

- The filtered reorder design is unusually thorough. The current writer checks uniqueness, complete contacted population, and one affected row per update in one transaction ([ring-seq-dao.ts:60](/home/bwales/projects/orbit-app/src/db/ring-seq-dao.ts:60)). Plan 29-09 retains those controls and additionally revalidates saved sun, complete order, System membership at the current SQLite day, and ID/UID fingerprints under the same lock before merging visible slots ([29-09-PLAN.md:88](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-09-PLAN.md:88)). This closes stale Favorites/category/snooze/midnight and numeric-ID reuse cases without widening neutral-body rank eligibility.

- Preference migration and backup boundaries are correct. The live schema head is 20 ([database.ts:55](/home/bwales/projects/orbit-app/src/db/database.ts:55)), and Plan 29-02 requires an execution-time head recheck before allocating head+1 ([29-02-PLAN.md:93](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-02-PLAN.md:93)). It adds durable settings and restore validation while preserving current format 4 and deliberate export omission ([29-02-PLAN.md:116](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-02-PLAN.md:116), [types.ts:14](/home/bwales/projects/orbit-app/src/backup/types.ts:14), [app-settings-dao.ts:519](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:519)). Camera and focus remain nonportable session state.

- The projected-frame architecture directly addresses the current correctness fault: rendering interpolates while hit testing reads a JS endpoint map ([OrreryScreen.tsx:314](/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:314), [OrreryScreen.tsx:414](/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:414)). Plans 29-01/04/05 consistently establish one interpolated frame for drawing, labels, depth, and interaction. Installed Skia supports `Group.zIndex`, and its native recorder preserves source order at equal depth ([Common.ts:92](/home/bwales/projects/orbit-app/node_modules/@shopify/react-native-skia/src/dom/types/Common.ts:92), [RNRecorder.h:55](/home/bwales/projects/orbit-app/node_modules/@shopify/react-native-skia/cpp/api/recorder/RNRecorder.h:55)).

- Reduced Motion and lifecycle planning is grounded in the actual implementation. The hook already exists, but a live event can currently be overwritten by a late initial seed ([use-reduced-motion.ts:61](/home/bwales/projects/orbit-app/src/theme/use-reduced-motion.ts:61)). Plan 29-11 specifically fixes that race, cancels active camera continuation, and unmounts the clock-owning canvas subtree rather than merely freezing its output ([29-11-PLAN.md:108](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-11-PLAN.md:108)).

# Concerns

## HIGH

- Native acceptance is described but is not actually a blocking completion gate.

  Plan 29-01 calls its native tracer prerequisite “before expansion,” but explicitly permits recording it as pending while the task’s `<done>` condition says the tracer passed ([29-01-PLAN.md:88](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-01-PLAN.md:88), [29-01-PLAN.md:89](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-01-PLAN.md:89)). Plan 29-12 is autonomous, directs the executor to mark native checks pending, and accepts creation of a pending checklist as done ([29-12-PLAN.md:13](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-12-PLAN.md:13), [29-12-PLAN.md:114](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-12-PLAN.md:114), [29-12-PLAN.md:118](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-12-PLAN.md:118)).

  Node tests cannot establish native Skia depth, gesture arbitration, TalkBack focus, live animation cancellation, or real navigation reachability. Those are central parts of ORRC-02/03/07/10/15/16, not optional polish.

  Action: make Phase 29 completion explicitly block on an owner-confirmed native checkpoint. If the device is unavailable, execution may finish the code and checklist, but phase verification should remain `AWAITING HUMAN VERIFICATION`, not complete. Either enforce the Plan 29-01 tracer before Wave 2 or remove the “before expansion” claim and make the final native gate unambiguously blocking.

## MEDIUM

- The satellite policy for a globally assigned contact sun excluded from the active System is an unsettled product decision.

  Plan 29-03 deliberately keeps such a sun visible and actionable outside membership ([29-03-PLAN.md:98](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-03-PLAN.md:98), [29-03-PLAN.md:100](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-03-PLAN.md:100)). Plan 29-10, however, limits satellite parents to current System members and includes only a “qualifying” member sun ([29-10-PLAN.md:30](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-10-PLAN.md:30), [29-10-PLAN.md:90](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-10-PLAN.md:90)). The dossier says satellites appear around their parent Orbit contact and does not settle this nonmember-sun corner ([phase dossier:434](/home/bwales/projects/orbit-app/docs/dossier/milestone-2/phase-08-orrery-camera-scale-exploration-dossier.md:434)).

  This determines visible product behavior, so it belongs to the owner. Ask whether a visible global contact sun retains its moons when the selected System excludes that contact. Then encode the decision and a test; do not decide it during implementation.

- The coherent snapshot promises a read-only, scalable Gravity seam, but the necessary reader changes are not owned concretely.

  `inReadSnapshot` exposes only `getFirstAsync` and `getAllAsync` and holds the global mutex for the entire read ([transaction.ts:38](/home/bwales/projects/orbit-app/src/db/transaction.ts:38), [transaction.ts:67](/home/bwales/projects/orbit-app/src/db/transaction.ts:67)). Existing settings/category/impact helpers accept full `SqlExecutor` ([app-settings-dao.ts:425](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:425), [contact-read.ts:49](/home/bwales/projects/orbit-app/src/db/contact-read.ts:49), [impact-read.ts:52](/home/bwales/projects/orbit-app/src/db/impact-read.ts:52)). More importantly, `getImpactInputs` reads one contact and its complete interaction history per call.

  Plans 29-03/04 say to adapt read-only signatures and collect impact inputs in the snapshot, but neither plan owns `src/db/impact-read.ts` or specifies a batched implementation ([29-03-PLAN.md:8](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-03-PLAN.md:8), [29-03-PLAN.md:99](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-03-PLAN.md:99), [29-04-PLAN.md:8](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-04-PLAN.md:8)). The natural implementation would be N contact queries while holding the shared mutex, delaying every app write for large All Contacts scenes. The research explicitly recommended extending the impact reader ([29-RESEARCH.md:308](/home/bwales/projects/orbit-app/.planning/phases/29-orrery-camera-scale-exploration/29-RESEARCH.md:308)).

  Action: add a concrete batched `ReadOnlyExecutor` Gravity-input reader to Plan 29-03 or 29-04, include `src/db/impact-read.ts` in ownership/artifacts, and prohibit closing over the outer writable executor merely to satisfy existing function signatures.

## LOW

No additional actionable LOW concerns. Minor native tuning, exact gesture constants, large-System performance calibration, and final artwork are already explicitly deferred to the proper later phase.

# Suggestions

- Add an explicit phase status transition: automated completion → `AWAITING NATIVE ACCEPTANCE` → verified only after the checklist passes.
- Record the owner’s nonmember-sun satellite ruling in Phase 29 context or an amendment before execution reaches Plan 29-10.
- Define the batch Gravity-reader signature in Plan 29-03 so Plans 04, 08, and the companion list consume the same coherent data rather than independently rebuilding it.
- Keep the current one-plan-per-wave ordering. The repeated ownership of `OrreryScreen`, `OrreryWorld`, camera state, and gesture composition makes parallel execution unsafe despite the long schedule.

# Overall Risk Assessment

**Plan risk: MEDIUM, conditional approval. Execution risk: HIGH.**

The data-integrity and decision-governance portions are strong enough to proceed once the two contract gaps are resolved. The remaining execution risk comes from the breadth of the shared native interaction rewrite—Skia projection/depth, four competing gestures, accessibility overlays, transient navigation, and SQLite-backed live populations—rather than from missing requirement coverage.

The plan set should achieve ORRC-01–16 if implemented faithfully and if native acceptance becomes a real completion gate. As written, it can finish with essential native behavior still marked pending, so it does not yet guarantee achievement of every phase goal.

---

## Claude Review

I verified the plans against the source on disk. Here is the review.

---

# Phase 29 Plan Review — Orrery Camera, Scale & Exploration

## Summary

Twelve plans, one per sequential wave, covering ORRC-01–16. I read every plan in full and verified their load-bearing claims against the repository at `/home/bwales/projects/orbit-app`: the migration chain, the ring-order writer and every guard it holds, the transaction primitives, the relationships schema, the reduced-motion controller, the categories/sun/status reads, the Skia depth API, and the current `OrreryScreen`.

**The factual base is unusually accurate.** Every schema, API, and ADR claim I checked was correct, including the ones that correct stale upstream notes (migration head, backup format, reduced-motion existence, relationships existence). The governance handling is correct: ADR-077's partial supersession of ADR-048 is real and recorded on both documents, and the plans preserve rather than erode ADR-011, ADR-046, ADR-047, and ADR-062. **I found no decision reversal requiring owner escalation.**

The concerns below are gaps in sequencing, verification mechanism, and efficiency — not in product intent.

---

## Strengths

**The reorder guard analysis is correct and the eligibility boundary is honored, not quietly widened.** `rewriteRingSeq` (`src/db/ring-seq-dao.ts:66-121`) holds three guards — uniqueness, an exact COUNT match against the effective orbiting population, and a per-row scoped `UPDATE` asserting `changes === 1` — over `last_contact IS NOT NULL AND archived_at IS NULL AND tracking_enabled = 1`. Plan 29-09 preserves all three, adds expected-order/sun/ID-UID fingerprints and a lock-time membership recheck, and explicitly records that displaying a never-contacted body does **not** authorize widening its rank persistence, routing that extension to the owner instead. That is exactly the AGENTS.md §"Whose decision is it" boundary applied correctly under pressure.

**The composition-under-one-lock design respects the non-reentrancy rule.** `inWriteTransaction` and `inReadSnapshot` both wrap `withMutex`, which `src/db/transaction.ts:14-27` documents as non-reentrant with a permanent-hang failure mode. Plan 29-03 answers this by exporting `readOrrerySystemMembersCore(exec: ReadOnlyExecutor, …)` as a mutex-free, transaction-composable core that 29-09 calls on the already-locked executor. `ReadOnlyExecutor` is a real exported type (`src/db/transaction.ts:42`) and `SqlExecutor` satisfies it structurally, so this compiles as specified.

**D-05 is implemented as a widening, not a deletion.** `listOrbitingContacts` (`src/db/orrery-read.ts:96-98`) pins `last_contact IS NOT NULL`, and `STATUS_SQL` ends in a `'stable'` fallback, so stripping that predicate would silently render never-contacted people as healthy. Plan 29-03 keeps the default read intact, adds explicit All Contacts / Not Contacted paths, and uses a null-progress/null-status branch modeled on the existing `CARD_STATUS` nullable projection. It also reuses the real closed predicates (`FAVOURITES_WHERE`, `SNOOZED_WHERE`, `NOT_CONTACTED_WHERE` at `src/logic/dashboard-query-logic.ts:157-160`) without importing Dashboard store state.

**The reduced-motion seed race is real and correctly diagnosed.** In `createReducedMotionController` (`src/theme/use-reduced-motion.ts:73-92`) the listener is registered synchronously but the `isReduceMotionEnabled()` seed resolves later and calls `emit(value)` guarded only by `disposed` — so a live `true` event that fires before the seed resolves is overwritten by a stale `false`. Plan 29-11-02's event-generation guard fixes precisely this, and does so by extending ADR-085's hook rather than replacing it.

**Schema facts are current, not inherited.** `TARGET_VERSION = 20` with `migration020` last registered (`src/db/database.ts:56,58-79`), making 021 correct; `BACKUP_FORMAT_VERSION = 4` (`src/backup/types.ts:14`), correctly contradicting the older "Phase 36 v4 bump" wording. The optional-key-without-emission pattern 29-02-03 copies is the real one — `PORTABLE_SETTINGS_KEYS` already allowlists theme and dashboard keys (`src/backup/backup-schema.ts:159-172`) that `PortableSettingsSnapshot` declares optional and does not emit (`src/db/app-settings-dao.ts:214-231`).

**The native depth strategy is verified, not assumed.** `GroupProps` declares `zIndex?: number` (`node_modules/@shopify/react-native-skia/src/dom/types/Common.ts:92-94`) and the native recorder sorts sibling groups by it with a stable equal-value tie (`cpp/api/recorder/RNRecorder.h:45-65`). Plan 29-05's requirement that sun and contact billboards be *direct siblings* under one depth parent follows from that sibling-local sort — a subtlety that would have produced a sun that can never be occluded if missed.

**Category identity is UID-based.** `listCategories` returns only `id, name` (`src/db/contact-read.ts:49-54`), while the table carries a `uid` from migration 001. Plan 29-03 correctly notes the header omits UID and reads it directly, keeping System identity off both display names and device-local integer IDs.

---

## Concerns

### HIGH — 1. The legacy radial reorder gesture is never retired, and waves 1–8 leave it live against a widened population

`OrreryScreen.tsx:556-624` currently races `Gesture.Tap` against a `Gesture.Pan` whose `onEnd` calls `commitFromWorklet` → `commitRingSeq` (`:500-542`), which maps the current `orbiting` array to IDs, runs `computeRingReorder`, and calls `rewriteRingSeq`.

Plan 29-01's action removes "its mode toggle and endpoint hit refs" and adds "real one-finger pan" — but says nothing about the existing pan-reorder. Reorder is only rebuilt in **29-09, wave 9**. Two mechanisms break in the interval:

- **Gesture ownership.** From wave 1, one-finger drag is claimed by camera pan while the legacy reorder pan is still composed into the canvas gesture. Whichever wins, the other silently stops working or fires alongside it — and ORRC-10's whole point is that ordinary drag must pan, never reorder.
- **Guard failure once membership widens.** From wave 3, the member list becomes the System list, which for All Contacts includes never-contacted rows. If `commitRingSeq` still derives `orderedIds` from that list, Guard 2's COUNT (`last_contact IS NOT NULL …`) mismatches and Guard 3's scoped `UPDATE` returns `changes !== 1`. Every drag then throws and shows the legacy `Alert.alert("Couldn't reorder")` — for six waves.

No task action, acceptance criterion, verify command, or explicit deferral in any of the twelve plans addresses this. The guards mean data is safe; the user-facing regression window is the problem.

### MEDIUM — 2. The "controlled SQLite-clock test executor" prescribed in 29-09 and 29-12 cannot be built as specified

Both plans require exercising local-midnight membership transitions "through a controlled SQLite-clock executor over real SQL," and 29-09 correctly notes that JS fake timers cannot move SQLite's clock. But the time source is hardcoded inside the SQL itself — `date('now','localtime')` in `PROGRESS_SQL` (`src/db/status.ts:59`) and in `SNOOZED_WHERE` (`src/logic/dashboard-query-logic.ts:159-160`) — and the test adapter is a thin `DatabaseSync` wrapper (`src/db/__testkit__/node-sqlite.ts:29-56`) with no hook that could intercept it. No such executor exists, and none can be written without changing shipped SQL.

This matters because it is the acceptance gate for the phase's most dangerous write path. An executor handed an unbuildable mechanism will either invent a fake one or stall. The invariant itself is fine — re-running the predicates inside the lock *does* naturally evaluate at the current SQLite day.

**Fix:** replace the mechanism with fixture-relative time. Seed `snooze_until` and `last_contact` at offsets that straddle the boundary relative to the real `date('now','localtime')`, so the same row is Snoozed under one fixture and not under another. That proves the same predicate without a clock hook. Alternatively, thread an explicit `currentLocalDay` parameter through `readOrrerySystemMembersCore` — which also makes the core deterministic — but that touches shared status SQL and deserves a deliberate decision rather than an executor's improvisation.

### MEDIUM — 3. Per-member Gravity has no owned batched read, and runs inside the global write mutex

Plan 29-04-01 derives body mass via `computeContactGravity` over "canonical impact inputs collected inside the scene snapshot." The only existing entry point is `getImpactInputs` (`src/db/impact-read.ts:52`), which is strictly per-contact and returns **every interaction row** for that contact. Running it per member means N queries × full history, and the scene snapshot runs under `inReadSnapshot`, which acquires the same non-reentrant mutex every writer uses (`src/db/transaction.ts:76-89`) — so the whole thing blocks all app writes for its duration, on every Orrery focus, refresh, and System switch.

RESEARCH says "Prefer batched impact/relationship input reads to a query per body." PATTERNS says "Research's optional batched impact adapter likewise needs its own file scope if selected." **No plan's `files_modified` or `artifacts` list contains one.** The optimization is recommended twice and owned by nobody, so the default outcome is the per-body path.

At the owner's stated scale (tens of contacts, PROJECT.md §10) this will function. It is still the wrong shape to ship, and it is the kind of thing Phase 40 hardening will be asked to unpick.

### MEDIUM — 4. Per-tap validation re-reads the full System snapshot on the core tap→Profile path

Plan 29-08-01 requires that focus and Profile dispatch "obtain authoritative validation through an injected `readOrrerySystemSnapshot` call." That snapshot is the coherent read defined in 29-03: settings, sun header, category catalog, all members, plus impact inputs — under `inReadSnapshot`'s mutex and `BEGIN`.

Running that on every unambiguous tap contradicts the project's stated core value ("collapse the taps between 'you're overdue with X' and the message actually being sent," PROJECT.md §Core Value) and compounds concern 3, since the snapshot carries the Gravity reads with it. The staleness the plan is defending against is real and worth defending against — but a narrow bound query (does this contact ID still carry this UID, is it still live, is it still a member of this System, is it still the resolved sun) answers it at a fraction of the cost.

Note this is not a correctness objection: the validation contract in 29-08 is well specified, and the excluded-sun cases it enumerates are genuinely subtle and correctly handled.

### MEDIUM — 5. Twelve strictly-chained waves, at least one of them chained without a dependency

Every plan declares `depends_on` on its immediate predecessor, producing a fully serial 12-wave chain. COVERAGE justifies this as shared mutable files (`OrreryScreen.tsx`, `OrreryWorld.tsx`, `use-orrery-camera.ts`), which is fair for most of the chain.

It is not fair for 29-02. That plan owns migration 021, the app-settings DAO extension, the preferences store, and the portable allowlist — it shares only `OrreryScreen.tsx`, and only for a control it admits will be replaced in its own second task. Blocking the phase's single irreversible schema step behind a rendering tracer delays the one artifact that most benefits from landing early and being exercised across the remaining waves.

### LOW — 6. Plan 29-06 modifies shell-owned files

`files_modified` includes `src/navigation/RootNavigator.tsx` and `src/components/UniversalFab.tsx` — the app shell delivered under ADR-080. The plan is explicit and narrow ("Preserve universal capture routes, existing FAB position, tab height consumers and Back behavior") and the measurement seam genuinely cannot live anywhere else, since the FAB is mounted beside `RootNavigator` in a different coordinate space from the canvas. Recording it here so the shell edit is a noticed decision rather than an incidental diff.

### LOW — 7. No task maintains the ADR graph bridge

AGENTS.md §"The ADR bridge" states that graphify mints ADR nodes **only** from `ADR-NNN` tokens in JS/TS comments, and that `docs/decisions/adr-registry.ts` must be regenerated when ADRs change. This phase strips the ADR-048 morph behavior out of `OrbitBody.tsx` and `OrreryScreen.tsx` and replaces it with ADR-077 behavior, but no plan updates citation comments or runs `npm run gen:adr-registry`. Plan 29-12 updates `docs/systems/orrery.md` only. Result: code→ADR edges pointing at the superseded half of ADR-048 go stale, in a repo whose stated first-stop discovery tool is the graph.

### LOW — 8. `orrery_last_system` cannot be constrained by a CHECK, leaving the DAO as sole guard

29-02-01 specifies closed built-in tokens or `category:<UID>` with "a bounded nonempty UID payload," existence deliberately not enforced by FK. A SQL `CHECK` can cover the built-in enum but not the open-ended category form, so validation rests entirely on `validateAppSettingsPatch` and `updateAppSettingsCore`. The plan does route restore through the core (correctly — that is where hand-edited backup values arrive), so the coverage is there; it is worth stating explicitly in the migration that the column-level constraint is intentionally partial, so a later reader does not mistake the absent CHECK for an oversight.

---

## Suggestions

1. **Add a task action and acceptance criterion to 29-01** that removes the legacy radial-reorder `Gesture.Pan`, `commitRingSeq`, `bodiesShared`/`dragMetrics`, and the ghost-ring preview from `OrreryScreen.tsx` at the same time it introduces camera pan — with an explicit, user-visible statement that ring reorder is unavailable until 29-09. Removing it is safer than leaving it: a live legacy writer against a widening member list is exactly the class of bug the guards exist to catch loudly, and no user should meet that alert.

2. **Replace the clock-executor language in 29-09 and 29-12** with fixture-relative straddling of `date('now','localtime')`, or make `currentLocalDay` an explicit parameter of the shared membership core. Either is testable today; the currently specified mechanism is not.

3. **Give the batched impact read an owner.** Add `src/db/orrery-impact-read.ts` (or equivalent) to 29-04's `files_modified` and `artifacts`, returning per-member Gravity inputs in one bound query, and state that the per-body `getImpactInputs` path is not to be used from the scene loader.

4. **Narrow 29-08's per-tap validation** to a bound identity/membership/sun probe rather than the full coherent snapshot, and say so in the task action so an executor does not reach for `readOrrerySystemSnapshot` because it is the closest thing to hand.

5. **Move 29-02 to wave 1** alongside (or ahead of) the tracer, dropping its `depends_on`. Its only overlap with 29-01 is a control it replaces itself, and landing the migration first gives every later wave a real preference column to read.

6. **Add ADR citation upkeep to 29-12-02**: update `ADR-048`/`ADR-077` tokens in the touched Orrery source comments and run `npm run gen:adr-registry`, so the graph reflects the supersession the code just enacted.

---

## Risk Assessment

**Overall: MEDIUM.** These plans are materially better grounded than the artifacts they derive from — they correct three stale upstream claims, verify the installed Skia depth API rather than assuming it, and identify a genuine latent race in shipped reduced-motion code. The two areas that would ordinarily carry the most risk in this phase are the ones handled best.

*Data-layer risk: LOW.* The reorder path preserves every existing guard, adds four more, composes correctly under the single non-reentrant lock, and refuses to widen rank eligibility without the owner. The migration is additive, correctly numbered, and correctly withholds backup emission. The only data-layer weakness is a verification mechanism (concern 2), not an invariant.

*Product-decision risk: LOW.* No `[DECIDED]`/`[REJECTED]` item is reopened and no accepted ADR is reversed. The one behavior change that could look like a reversal — replacing `OrreryScreen`'s "render with defaults, no error UI" catch (`OrreryScreen.tsx:255-262`) with explicit failure copy — is covered by the owner-approved UI-SPEC of 2026-09-06 and does not touch the offline read-path rule it cites, which concerns network calls, not local SQL failures. **No escalation is required.**

*Integration and sequencing risk: MEDIUM.* Concern 1 is the one I would fix before execution starts, because it degrades a shipped feature for most of the phase and the fix costs a paragraph in 29-01. Concerns 3 and 4 are efficiency debts that will function at the owner's scale and then need unpicking in hardening.

*Verification risk: MEDIUM.* Automated coverage is strong for pure math, SQL, and controllers. The plans are commendably honest that native Skia depth, gesture arbitration, TalkBack, and all performance claims remain unproven and phone-only (D-10) — but that means a large share of ORRC-02, -03, -07, -09, -10, and -16 rests on a native checklist that does not yet have device time scheduled. Nothing in the plans overstates this; it is simply where the residual risk sits.

---

## Consensus Summary

Both source-grounded reviewers found the 12-plan sequence unusually thorough on decision governance, never-contacted segregation, filtered reorder integrity, backup boundaries, reduced-motion lifecycle, and the shared projected-frame design. Both independently identified the missing owned batch reader for Gravity inputs. Claude found one unresolved HIGH sequencing defect: Plan 29-01 introduces one-finger camera pan without explicitly retiring the existing radial-reorder pan, while the replacement reorder gesture does not arrive until Plan 29-09.

### Agreed Strengths

- The plans preserve the contacted-only default read while widening only named Systems for never-contacted contacts.
- The complete-order and filtered-member rank guards remain transactional and are expanded for stale sun, membership, local-day, and ID/UID changes.
- Migration 021 is conditional on an execution-time head check; current backup format 4 and deferred emission are stated correctly.
- One current projected frame governs drawing, depth, labels, and hit testing; native-only claims stay assigned to human verification.

### Agreed Concerns

- **HIGH — legacy radial reorder remains live when camera pan lands.** Plan 29-01 introduces one-finger camera pan but does not retire the current radial-reorder `Gesture.Pan`, `commitRingSeq`, or ghost preview; the deliberate stationary-hold replacement does not arrive until Plan 29-09. Plan 29-01 must remove or disable the legacy gesture and assert that ordinary drag pans without a rank write throughout the intermediate waves.
- **MEDIUM — Gravity batch reader has no plan owner.** Both reviewers found that the only current reader, `getImpactInputs`, runs per contact and reads full interaction history. Plans collect Gravity inputs inside the global mutex-held snapshot but do not modify or replace `src/db/impact-read.ts`. Plan 29-03 or 29-04 must own a batched `ReadOnlyExecutor` reader and prohibit per-member calls or closing over the outer writable executor.

### Divergent Views and Dispositions

- **Codex HIGH — native acceptance is not blocking:** discounted as already incorporated. Plan 29-12 line 117 explicitly requires the complete native checklist as its human check; `.planning/config.json` sets `human_verify_mode: end-of-phase`; the execution workflow persists outstanding human verification as pending UAT and advances only after canonical verification passes. Device evidence correctly remains pending before execution and phase completion remains gated afterward. The raw finding is retained above.
- **Codex MEDIUM — satellites of a globally visible contact sun excluded from the active System:** accepted as an owner-decision checkpoint. The dossier says satellites appear around their parent Orbit contact but does not settle whether this visible nonmember sun remains an eligible parent. Plan 29-03 keeps that sun visible/actionable while Plan 29-10 restricts satellite parents to System members plus a qualifying member sun. The plan must record the owner's choice.
- **Claude MEDIUM — controlled SQLite-clock executor cannot exist over the current adapter:** accepted. `date('now','localtime')` is embedded in production SQL and the node SQLite adapter has no clock interception seam. Plans 29-09 and 29-12 must use an executable fixture-relative boundary method or explicitly add an approved injectable day seam.
- **Claude MEDIUM — full coherent System snapshot on every tap:** accepted as actionable unless explicitly deferred with rationale. Plan 29-08 currently makes the latency-sensitive focus/Profile path reread settings, category catalog, members, and Gravity inputs under the global mutex. It should own a narrow identity/membership/sun validation query, or explicitly justify and defer that optimization.
- **Claude MEDIUM — move migration Plan 29-02 earlier:** rejected as advisory. The existing fully serial order is deliberate because `OrreryScreen.tsx` is shared across the tracer and preference wiring, and no release occurs between waves.
- **Claude LOW — shell files are touched:** informational. Plan 29-06 explicitly owns the narrow measurement edits and preserves shell behavior.
- **Claude LOW — ADR graph citation upkeep absent:** accepted. Since Phase 29 replaces the superseded ADR-048 behavior with ADR-077 behavior in source, Plan 29-12 should update source comment citations and regenerate the ADR registry as needed; graph rebuilding remains outside this plan unless separately required.
- **Claude LOW — partial SQL CHECK for open-ended category System IDs:** discounted as already incorporated. Plan 29-02 explicitly puts closed validation in both the public DAO and restore core and intentionally avoids an existence foreign key; the migration can document the partial database constraint during implementation.

## Verification Coverage

### Source grounding

- Effective authority: `grep` (deterministic `drift-guard authority`). Under this authority, signatures and runtime behavior beyond declarations are **UNCHECKABLE / INFO** unless established by full source reading; they were not silently treated as symbol verification.
- Verified existing declarations include: `inReadSnapshot` (`src/db/transaction.ts:74`), `listOrbitingContacts` (`src/db/orrery-read.ts:89`), `progressToAngle` (`src/logic/orrery-geometry-logic.ts:109`), `polarToXY` (`src/logic/orrery-geometry-logic.ts:118`), `shortestAngleDelta` (`src/logic/orrery-geometry-logic.ts:221`), `computeRingReorder` (`src/logic/ring-reorder-logic.ts:25`), `rewriteRingSeq` (`src/db/ring-seq-dao.ts:60`), `buildPopulationWhere` and the four shared predicates (`src/logic/dashboard-query-logic.ts:154`), `getPortableSettingsSnapshot` (`src/db/app-settings-dao.ts:519`), `updateAppSettings` (`src/db/app-settings-dao.ts:910`), `updateAppSettingsCore` (`src/db/app-settings-dao.ts:961`), `computeContactGravity` (`src/services/impact.ts:88`), `resolveRelationshipVisibility` (`src/db/relationships-read.ts:39`), `resolveSunOccupant` (`src/logic/sun-occupant-logic.ts:120`), `useReducedMotionShared` (`src/theme/use-reduced-motion.ts:103`), `runMigrations` (`src/db/migrations/runner.ts:32`), `TARGET_VERSION` (`src/db/database.ts:55`), and `BACKUP_FORMAT_VERSION` (`src/backup/types.ts:14`).
- All referenced existing project and dependency paths were checked on disk. Paths declared in each plan's `Artifacts this phase produces` and plan output SUMMARY/checklist paths were excluded as new artifacts. No existing path or declaration was MISSING or AMBIGUOUS.
- Signature compatibility, worklet/native behavior, SQLite time behavior, gesture arbitration, Skia depth, TalkBack, and device performance remain **UNCHECKABLE / INFO** under grep; the plans assign these to source tracing, tests, or native human checks. The unavailable controlled SQLite-clock mechanism is separately actionable above.
- Graph-first queries succeeded in the orchestrator environment. All relevant returned governance edges were **INFERRED**, including ADR-048's partial supersession by ADR-077; none was presented as a code assertion. The Codex lane's own sandbox could not open the Graphify `tsx` IPC socket and disclosed that limitation in its raw review.
- Preflight structural codebase drift was skipped with reason `no-structure-md`; this is recorded as skipped, not passed.

### Cross-artifact fact drift

- Deterministic phase-status comparison returned `uncheckable`: STATE says `Ready to execute`; ROADMAP says `Planned`, a status outside the seam's recognized vocabulary. Authority is STATE.md. This is coverage-only and excluded from convergence counts.
- CONTEXT D-08 says Reduced Motion does not exist in `src/`, while current source exports and consumes the Phase 23 live hook and Plan 29-11 extends it. The actual source and plans carry the current fact; CONTEXT contains the stale copy.
- CONTEXT D-03 says a backup v4 bump belongs to Phase 36, while current `BACKUP_FORMAT_VERSION` is already 4 and the plans correctly reserve coordinated later preference emission/versioning for Phase 36. This is advisory artifact drift, excluded from convergence counts.
- ROADMAP requirements ORRC-01 through ORRC-16 exactly match the union of plan requirement references. No contradictory success-criterion or glossary pair was found beyond the two stale CONTEXT facts above.

## Current Cycle Disposition

- Current unresolved HIGH: 1.
- Current actionable non-HIGH: 5.
- Owner decision required before replanning: whether a globally assigned contact sun that remains visible while excluded from the active System retains its relationship satellites.
