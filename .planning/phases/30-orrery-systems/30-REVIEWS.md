---
phase: 30
reviewers: [codex, claude]
reviewed_at: 2026-09-08T11:44:25Z        # cycle 1
reviewed_at_cycle2: 2026-09-08T12:37:11Z  # cycle 2 (this file accumulates per cycle)
cycles: 2
plans_reviewed: [30-01-PLAN.md, 30-02-PLAN.md, 30-03-PLAN.md, 30-04-PLAN.md, 30-05-PLAN.md, 30-06-PLAN.md, 30-07-PLAN.md, 30-08-PLAN.md, 30-09-PLAN.md, 30-10-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-opus (read-only subagent lane)"
model_sources:
  codex: "banner"
  claude: "orchestrator-subagent"
cycle2_summary:
  current_high: 3
  current_actionable: 12
---

# Cross-AI Plan Review — Phase 30 (Orrery Systems)

> **Lane provenance.** The `codex` lane ran through the standard gsd-review runner (source-grounded prompt, real repo access). The `claude` lane was run as a **read-only analysis subagent by the orchestrator**, not via `claude -p` — the headless `claude` reviewer has a known Write-permission failure in this repo (MEMORY: "Claude reviewer via subagent"). The owner explicitly approved using the Claude lane for this run. Both lanes had full repo read access and verified plan claims against source on disk. Neither lane wrote, committed, or pushed anything.

## Consensus Summary

Both reviewers independently confirm the **data layer (plans 30-01 → 30-04) is the strongest part of the phase**: the migration number (022 / `TARGET_VERSION` 22) is verified correct against disk, the migration is additive/forward-only with the irreversible table shape correctly gated behind a human `checkpoint:decision`, predicate/gravity/backup references are accurate at the cited lines, writes are injection-safe (`?`-bound, closed-vocabulary), and `newUid()` guards the Hermes `crypto` hazard. No ADR/HANDOFF decision reversal was found by either reviewer; D-05, D-06, D-07, and E-02 are all honored, and the D-09 "reduced-motion hook doesn't exist" premise is correctly disk-corrected in plan 30-10 (the ADR-085 hook exists).

**The reviewers diverge on overall risk.** Claude rates the phase **MEDIUM** (1 HIGH), locating essentially all residual risk in plan 30-10's Skia render-loop wiring. Codex rates it **HIGH** (multiple HIGH findings), surfacing a broader set of cross-plan integration and product-completeness gaps (naming uniqueness, stale-exclusion pruning ownership, All-Contacts duplication, undo ID remapping, selector data-flow ownership, Settings-stack builder reachability, draft-count resolver, and save atomicity). The orchestrator code-verified the two most consequential divergent Codex HIGHs (30-06 Settings-stack builder unreachability and 30-08 non-atomic save) and **both check out as real** — the divergence reflects Codex reaching integration gaps Claude did not enumerate, not Codex overreach. Where the reviewers overlap (30-10 renderer scope, focus-clear conflict, delta source-ids), they agree on the mechanism and differ only on severity label.

### Agreed Strengths
- Migration 022 is a correctly-handled one-way door: number re-verified on disk (D-03), additive/forward-only, no `app_settings` ALTER (021 already added `orrery_last_system`), and the table shape gated behind a blocking human checkpoint.
- Correct reuse of Phase-29 / Dashboard machinery rather than redefinition (D-10): `buildFilterWhere` (OR-within/AND-across families), Gravity kept as a post-query TypeScript pass, the existing `OrrerySystemRef` closed union extended with a `custom` kind.
- Backup work is correctly declare-only (D-06): no format bump, version pinned so a premature Phase-36 bump fails CI; `assertOrreryLastSystem` widened to accept `custom:<uid>`.
- D-07 honored across 30-02/03/06: a rule referencing a deleted Category becomes a needs-attention `BrokenRule`, never silently rewritten or deleted; other valid rules keep resolving.
- Injection-safe, local-first, theme-token and worklet-forward-ref hazards explicitly addressed.

### Agreed Concerns
- **HIGH (both) — 30-10 renderer scope gap.** The declared file set (`orrery-switch-animation.ts` pure math + `OrreryScreen.tsx`) cannot render the per-body "spin + shedding/capture" transition (ORRS-13); the Skia body drawing lives in `<OrreryWorld>` (rendered at `OrreryScreen.tsx:800`), which is out of scope and receives no transition/intensity prop. As scoped, only a camera-level spin is buildable. This gap is device-UAT-only and invisible to `npm test`.
- **MEDIUM (both) — 30-10 focus-clear conflict.** `OrreryScreen.tsx:282-288` unconditionally calls `setFocusTargets([])` on any requested-System change; focus preservation (ORRS-12) cannot work unless this (and the `:639-652` re-validation) is replaced, not merely supplemented. (Codex rates this HIGH.)
- **MEDIUM (both) — 30-10 membership-delta source ids.** `select()` sets `snapshot: null` during loading, so a naive `subscribe((next, previous))` never sees old-ready and new-ready members in one transition; source ids must be stashed at the loading edge and diffed at the ready edge.

### Divergent Views
- **Overall risk:** Codex **HIGH** vs Claude **MEDIUM** — see summary above.
- **30-01 name uniqueness:** Codex HIGH (custom name can collide with a built-in/Category label — cross-catalog uniqueness not enforced); Claude did not raise it.
- **30-02 stale-exclusion pruning:** Codex HIGH (resolver surfaces `prunableExclusionContactIds` but no write path deletes them — no prune owner); Claude treated the prunable-ids surface as adequate.
- **30-03 All Contacts duplication & undo restore:** Codex HIGH on both (empty-rule custom ≠ population scope; snapshot rules reference old `system_id` with no remap contract); Claude rated plan 03 clean (≤ LOW).
- **30-05 selector data flow:** Codex HIGH (no owner supplies prefs/customs/override flags/counts/broken-rule results to the selector); Claude rated 30-05 ≤ LOW.
- **30-06 Settings-stack builder reachability:** Codex HIGH — **orchestrator-verified real** (SystemBuilder is OrreryStack-only per plan 08; SystemsManagement + its Create/Edit is reachable from the Settings stack per plan 06); Claude praised the wave sequencing and did not check cross-stack reachability.
- **30-08 draft live-count resolver & save atomicity:** Codex HIGH on both — save atomicity **orchestrator-verified real** (three public non-reentrant DAO writes composed with no wrapping core transaction); Claude rated 30-08 ≤ LOW.
- **30-01 custom read routing:** Claude MEDIUM (custom branch must precede `buildOrrerySystemWhere` at `orrery-system-read.ts:58`, plus a `custom` throw-guard, or it returns `undefined`→throws and tsc fails); Codex did not raise this specific ordering trap.


## Codex Review

# Plan Review — Phase 30 Orrery Systems

## Overall summary

The plan set has strong architectural grounding: it correctly extends the existing `OrrerySystemRef` pipeline, preserves the migration/backup sequencing, reuses Dashboard predicate logic, and identifies several real implementation seams. However, several cross-plan gaps would leave required behavior unreachable: custom-name uniqueness does not cover generated Systems, stale exclusions are never actually pruned, the builder is unreachable from Settings, draft live counts cannot use a stored-System resolver, and the switch-animation plan omits the renderer that must implement it. Overall risk: **HIGH until these are resolved.**

## 30-01 — Migration and thin vertical slice

**Strengths**

- Correctly recognizes that migration 021 already owns `orrery_last_system`; it exists as an `app_settings` column in [`021-orrery-preferences.ts:16`]( /home/bwales/projects/orbit-app/src/db/migrations/021-orrery-preferences.ts:16), while current schema head is 21 in [`database.ts:47`]( /home/bwales/projects/orbit-app/src/db/database.ts:47).
- Extending the existing closed union is the right direction: `OrrerySystemRef` currently has builtin/category branches in [`orrery-system-logic.ts:23-26`]( /home/bwales/projects/orbit-app/src/logic/orrery-system-logic.ts:23).
- The plan correctly avoids changing `app_settings` in migration 022 and routes custom reads through the existing member-read chokepoint.

**Concerns**

- **HIGH — case-insensitive uniqueness is incomplete.** The proposed unique index only compares custom rows in `systems`. It permits a custom System called “Favorites,” “All Contacts,” or a current Category name, because builtins are code constants ([`orrery-system-logic.ts:31-39`]( /home/bwales/projects/orbit-app/src/logic/orrery-system-logic.ts:31)) and Categories live in a separate table ([`001-initial.ts:41-49`]( /home/bwales/projects/orbit-app/src/db/migrations/001-initial.ts:41)). That violates the phase’s cross-catalog unique-name requirement and makes management/switcher labels ambiguous.
- **MEDIUM — the plan’s manual-only resolver must explicitly subtract exclusions.** Its stated stub returns eligible inclusions, but `system_overrides` stores both modes. The vertical slice should prove `(includes − excludes)`, not only inclusion eligibility.

**Suggestions**

- Define and test uniqueness against the complete generated catalog: builtin labels, Category names, and custom names. Because SQLite cannot express this as one cross-table unique index, enforce it transactionally in the DAO and define Category rename collision behavior for Phase 37.
- Make the thin resolver return `eligibleIncludes − excludes` from day one.

**Risk assessment:** **MEDIUM.** The migration approach is sound, but this is a one-way schema checkpoint and needs the catalog-wide naming rule settled before sign-off.

## 30-02 — Rule resolver

**Strengths**

- Correctly reuses the Dashboard SQL vocabulary: `buildFilterWhere` already implements OR within families and AND across families ([`dashboard-query-logic.ts:75-122`]( /home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:75)).
- Correctly retains Gravity as a post-query TypeScript filter; `filterByGravity` is explicitly designed that way ([`dashboard-gravity-filter.ts:19-38`]( /home/bwales/projects/orbit-app/src/logic/dashboard-gravity-filter.ts:19)).
- The default active scope and explicit not-contacted scope match existing semantics ([`dashboard-query-logic.ts:149-160`]( /home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:149)).

**Concerns**

- **HIGH — “prunableExclusionContactIds” does not satisfy “discarded.”** The resolver only returns stale exclusions; no plan assigns a transactionally safe DAO call that deletes them. The rows will otherwise persist indefinitely and repeatedly be reported on every read.
- **MEDIUM — candidate ordering is unspecified.** The proposed `SELECT c.id` needs an explicit stable `ORDER BY`; `filterByGravity` intentionally preserves input order ([`dashboard-gravity-filter.ts:25-37`]( /home/bwales/projects/orbit-app/src/logic/dashboard-gravity-filter.ts:25)). Without it, later membership and count behavior can vary.
- **MEDIUM — broken-rule metadata needs a stable identifier.** `{ family, value, reason }` alone cannot distinguish duplicate malformed rows or support precise repair/delete from builder/management.

**Suggestions**

- Add a DAO-owned `pruneSystemExclusionsCore` called only from an intentional write path, or state that pruning occurs on the next successful System save. Do not let a nominal read silently write.
- Include `ruleUid` in `BrokenRule`, and define a deterministic candidate ordering compatible with Orrery ring ordering.

**Risk assessment:** **HIGH.** It owns the phase’s central correctness rules, and stale-exclusion deletion currently has no implementation owner.

## 30-03 — Systems DAO

**Strengths**

- The proposed core/public transaction split matches the repo’s non-reentrant transaction rule ([`transaction.ts:12-23`]( /home/bwales/projects/orbit-app/src/db/transaction.ts:12)).
- Metadata-only deletion is appropriately isolated from contacts; the contact foreign-key pattern is established in [`001-initial.ts:84-94`]( /home/bwales/projects/orbit-app/src/db/migrations/001-initial.ts:84).
- It correctly protects built-in/category definitions from mutation at the DAO boundary.

**Concerns**

- **HIGH — duplicating All Contacts cannot produce an equivalent editable custom System.** Current All Contacts uses `DASHBOARD_POPULATION_SCOPE_WHERE`, including both contacted and never-contacted contacts ([`orrery-system-logic.ts:84-89`]( /home/bwales/projects/orbit-app/src/logic/orrery-system-logic.ts:84)). A custom System with “no rules” resolves from `ACTIVE_SEGREGATION_WHERE`, which excludes never-contacted contacts ([`dashboard-query-logic.ts:149-151`]( /home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:149)). The proposed empty-rule mapping therefore changes membership.
- **HIGH — Undo restore lacks an ID remapping contract.** A deleted snapshot’s `system_rules.system_id` references the old local integer ID. Re-inserting the definition can produce a new ID, so restore must map rules to the newly inserted row rather than replaying old `system_id` values.
- **MEDIUM — reorder/hide APIs need catalog validation.** A bare `system_ref` string can otherwise create preferences for nonexistent custom/category Systems. Current `parseSystemRef` validates only grammar, not existence ([`orrery-system-logic.ts:42-52`]( /home/bwales/projects/orbit-app/src/logic/orrery-system-logic.ts:42)).

**Suggestions**

- Add a custom-System scope/base-mode capable of representing All Contacts exactly, or explicitly make “Duplicate All Contacts” unavailable and reconcile that with ORRS-03.
- Define `DeletedSystemSnapshot` in portable identifiers/values, not old local IDs; restore definition first, obtain new ID, then insert rules/overrides/prefs in one transaction.
- Validate submitted reorder sets against the actual complete catalog and reject duplicates/missing references.

**Risk assessment:** **HIGH.** The DAO is the invariant boundary; the All Contacts duplication and undo flaws are user-visible correctness failures.

## 30-04 — Backup contract

**Strengths**

- Correctly keeps wire emission out of this phase. The current export only emits the explicit manifest entity list ([`export-manifest.ts:45-85`]( /home/bwales/projects/orbit-app/src/backup/export-manifest.ts:45)), and portable settings intentionally omit Orrery preferences from their SELECT ([`app-settings-dao.ts:581-619`]( /home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:581)).
- Correctly notes that format 4 is current ([`backup/types.ts:14`]( /home/bwales/projects/orbit-app/src/backup/types.ts:14)).
- Restore validation already delegates `orreryLastSystem` to the settings validator ([`backup-schema.ts:211-220`]( /home/bwales/projects/orbit-app/src/backup/backup-schema.ts:211)).

**Concerns**

- **HIGH — the plan claims stale custom references already fall back safely, but current code only has a category-specific domain result.** `readOrrerySystemMembersCore` recognizes missing categories ([`orrery-system-read.ts:59-65`]( /home/bwales/projects/orbit-app/src/db/orrery-system-read.ts:59)), and the store only specially handles `MissingOrreryCategoryError` ([`orrery-system-store.ts:107-116`]( /home/bwales/projects/orbit-app/src/stores/orrery-system-store.ts:107)). There is no equivalent missing-custom behavior yet.
- **LOW — pinning a version-number test is brittle.** Phase 36 is explicitly intended to update it; the test adds churn without proving byte-identical export behavior.

**Suggestions**

- Add a declared `missing-custom-system` read/store result in plans 01/03 before documenting fallback as guaranteed.
- Test the actual exported manifest shape before and after the phase, rather than merely pinning `BACKUP_FORMAT_VERSION`.

**Risk assessment:** **MEDIUM.** Declare-only sequencing is right, but the documented fallback currently does not exist.

## 30-05 — Switcher

**Strengths**

- Retains the existing selector lifecycle, which correctly dismisses on loss of focus and backgrounding ([`OrrerySystemSelector.tsx:71-79`]( /home/bwales/projects/orbit-app/src/components/orrery/OrrerySystemSelector.tsx:71)).
- A pure `buildSystemChoices` expansion is testable; the current function is already pure ([`orrery-controls-logic.ts:7-26`]( /home/bwales/projects/orbit-app/src/components/orrery/orrery-controls-logic.ts:7)).
- Central semantic icon keys fit the existing registry model ([`icon-registry.ts:33-87`]( /home/bwales/projects/orbit-app/src/components/icons/icon-registry.ts:33)).

**Concerns**

- **HIGH — no data-flow owner supplies preferences, custom Systems, override flags, counts, or broken-rule results.** The existing selector receives only `{ state, availableHeight, enabled }` ([`OrrerySystemSelector.tsx:24-31`]( /home/bwales/projects/orbit-app/src/components/orrery/OrrerySystemSelector.tsx:24)), and current state provides only categories/catalog snapshot data. Plan 05 modifies neither the selector API’s parent nor the store/read model that would provide the required catalog.
- **MEDIUM — resolving every custom System on dropdown open can issue many reads and Gravity-history scans.** `readOrreryImpactInputsCore` is batched but still fetches interaction history for requested contacts ([`orrery-impact-read.ts:23-64`]( /home/bwales/projects/orbit-app/src/db/orrery-impact-read.ts:23)).

**Suggestions**

- Add a catalog-read model and explicit owner—likely `OrreryScreen` or the System store—that loads all choice descriptors before rendering the selector.
- Define a bounded count strategy and caching/invalidation key, then device-test it with many Systems and large memberships.

**Risk assessment:** **HIGH.** The plan’s desired UI cannot be wired through the currently declared files/interfaces.

## 30-06 — Systems Management

**Strengths**

- Correctly separates management from the selector; current selector is a simple radio chooser ([`OrrerySystemSelector.tsx:148-177`]( /home/bwales/projects/orbit-app/src/components/orrery/OrrerySystemSelector.tsx:148)).
- Registering a route in both stacks is consistent with the separate existing Orrery and Settings navigators ([`OrreryStack.tsx:30-56`]( /home/bwales/projects/orbit-app/src/navigation/tabs/OrreryStack.tsx:30), [`SettingsStack.tsx:30-60`]( /home/bwales/projects/orbit-app/src/navigation/tabs/SettingsStack.tsx:30)).
- DAO-only writes and snackbar Undo align with existing architecture.

**Concerns**

- **HIGH — create/edit are unavailable from Settings.** Plan 08 registers `SystemBuilder` only in `OrreryStack`, while this plan registers management in both stacks. Navigation from Settings management to an Orrery-only route cannot resolve.
- **HIGH — the declared wave ordering knowingly exposes dead actions.** Plan 06 ships before Plan 08 but promises Create/Edit; its proposed “route-exists check or TODO seam” means it does not actually meet ORRS-09 during Wave 3.
- **MEDIUM — deletion fallback is only UI-local.** Current launch restoration parses the saved preference then selects it ([`OrreryScreen.tsx:329-338`]( /home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:329)); deleting a System must repair/fallback a persisted active custom ref, not merely call `select(All Contacts)` when this screen happens to be open.

**Suggestions**

- Register a shared builder route in both stacks, or make Settings management navigate into the Orrery stack with a typed nested route.
- Move builder route registration/minimal builder shell to Plan 06, or defer Create/Edit actions until Plan 08.
- Make active-System deletion atomically update the persisted preference or add a reliable missing-custom fallback at startup.

**Risk assessment:** **HIGH.** Required flows are currently unreachable from one mandated entry point.

## 30-07 — Manage Members

**Strengths**

- Reusing `contact-picker-selection` is appropriate; its `toggleSelection` and client-side filtering are generic and pure ([`contact-picker-selection.ts:3-33`]( /home/bwales/projects/orbit-app/src/logic/contact-picker-selection.ts:3)).
- Virtualization is a reasonable implementation requirement for large lists.
- Retaining archived manual includes is aligned with dynamic membership semantics.

**Concerns**

- **MEDIUM — the plan needs an explicit local-photo adaptation.** `ContactPickerRow.photoThumbUri` is defined as an ephemeral external thumbnail URI ([`contact-picker-source.ts:10-17`]( /home/bwales/projects/orbit-app/src/logic/contact-picker-source.ts:10)), while Orrery/contact rows hold a local relative photo path ([`orrery-system-read.ts:34-44`]( /home/bwales/projects/orbit-app/src/db/orrery-system-read.ts:34)). Reusing the picker row shape without documenting conversion risks broken avatars.
- **MEDIUM — override intent needs a single replacement operation.** The schema’s one-row-per `(system_ref, contact_id)` constraint means toggling include ↔ exclude requires an upsert/replace operation; plan 01 only specifies insertion and plan 03 does not clearly define mode replacement.

**Suggestions**

- Use a System-member row type or explicitly normalize local photo paths before rendering.
- Add `setSystemOverride(ref, contactId, mode | null)` as the builder/grid’s only override persistence API.

**Risk assessment:** **MEDIUM.** UI structure is sound, but its data contract needs tightening.

## 30-08 — Builder HUD

**Strengths**

- Correctly keeps Dashboard UI state separate while reusing its predicate logic.
- Correctly requires the shell’s shared discard guard rather than inventing a dialog.
- The eight-axis vocabulary matches the existing filter families plus the distinct System-only axes.

**Concerns**

- **HIGH — a stored-System resolver cannot calculate a provisional draft’s live count.** The planned resolver takes a custom `ref` and reads persisted rules/overrides. A newly authored or unsaved changed draft has neither. The plan needs a resolver variant accepting draft rules/override intent rather than calling `resolveCustomSystemMembers` directly.
- **HIGH — save is not atomic as written.** The sequence “create → set rules → persist overrides” risks a partially created System when a later operation fails. Public DAO wrappers must not be composed inside another write transaction because the repository’s transaction primitive is explicitly non-reentrant ([`transaction.ts:12-23`]( /home/bwales/projects/orbit-app/src/db/transaction.ts:12)). This needs one `saveSystemDefinitionCore` within one public transaction.
- **MEDIUM — existing focus/accessibility overlay behavior cannot simply be copied from the selector.** The selector only makes its own panel modal ([`OrrerySystemSelector.tsx:112-147`]( /home/bwales/projects/orbit-app/src/components/orrery/OrrerySystemSelector.tsx:112)); the builder must explicitly make the entire production Orrery inaccessible/inert.

**Suggestions**

- Add `resolveMembershipFromDefinition(exec, { rules, overrides, now })` for drafts and use the persisted resolver as a wrapper around it.
- Add one transactional DAO command for create/edit/rules/override replacement and only call `store.select` after commit.
- Specify how the builder registers a shell transient and hides the canvas from accessibility focus.

**Risk assessment:** **HIGH.** Both live counts and failure-safe saving are presently architecturally incomplete.

## 30-09 — Preview

**Strengths**

- Reusing the real scene geometry is the correct intent; scene generation derives world geometry from loaded contacts and density ([`orrery-scene.ts:52-105`]( /home/bwales/projects/orbit-app/src/services/orrery-scene.ts:52)).
- The plan correctly avoids Profile navigation from an unsaved workflow.
- Keeping preview projection pure/testable is a good split.

**Concerns**

- **MEDIUM — member IDs alone are insufficient layout input.** The real world derivation uses ordered member records, contact attributes, density, gravity, and sun identity—not only IDs ([`orrery-scene.ts:62-91`]( /home/bwales/projects/orbit-app/src/services/orrery-scene.ts:62)). The preview contract must explicitly obtain equivalent provisional scene inputs or it will silently reimplement geometry.
- **MEDIUM — the plan must define preview lifecycle pause behavior.** The real canvas stops its ambient Skia loop by unmounting while unfocused/backgrounded ([`OrreryCanvas.tsx:1-21`]( /home/bwales/projects/orbit-app/src/components/orrery/OrreryCanvas.tsx:1)); the new preview canvas needs the same lifecycle guarantee.

**Suggestions**

- Have preview consume a shared exported “derive provisional scene/world” function, not a marker mapper from IDs.
- Require focus/AppState gating/unmounting for the preview canvas and test its no-Profile behavior independently.

**Risk assessment:** **MEDIUM.** The product intent is clear, but its geometry and lifecycle inputs are underspecified.

## 30-10 — Switch animation and framing

**Strengths**

- Last-active preference persistence/restoration already has a solid seam: the preferences store maps `lastSystem` to `orreryLastSystem` ([`orrery-preferences-store.ts:37-56`]( /home/bwales/projects/orbit-app/src/stores/orrery-preferences-store.ts:37)) and Orrery initialization selects it after hydration ([`OrreryScreen.tsx:329-338`]( /home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:329)).
- Using `useReducedMotionShared` is correct: it is specifically designed for render-loop consumers without React rerenders ([`use-reduced-motion.ts:101-117`]( /home/bwales/projects/orbit-app/src/theme/use-reduced-motion.ts:101)).
- Pure overlap-based intensity and focus-preservation functions are appropriate unit-test targets.

**Concerns**

- **HIGH — the current screen clears focus immediately whenever the requested System changes.** [`OrreryScreen.tsx:281-288`]( /home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:281) unconditionally calls `setFocusTargets([])`. Plan 10 must replace this behavior, not merely add `preservedFocus`.
- **HIGH — declared files omit `OrreryWorld`, which owns render-loop transitions and keyed resources.** It currently handles frame transitions with Reanimated/Skia imports ([`OrreryWorld.tsx:1-20`]( /home/bwales/projects/orbit-app/src/components/orrery/OrreryWorld.tsx:1)) and receives all render inputs through its props ([`OrreryWorld.tsx:191-225`]( /home/bwales/projects/orbit-app/src/components/orrery/OrreryWorld.tsx:191)). A spin/shedding/capture transition cannot be fully implemented only by editing `OrreryScreen`.
- **MEDIUM — source membership must be captured before selection clears/replaces the scene.** The store publishes `snapshot: null` while a different System loads ([`orrery-system-store.ts:80-102`]( /home/bwales/projects/orbit-app/src/stores/orrery-system-store.ts:80)), so “compute on snapshot transition” is not sufficient without a pre-switch ref.

**Suggestions**

- Add `OrreryWorld.tsx` to the plan and define a shared-value transition contract it consumes.
- Capture source member IDs/focus before calling `select`, preserve only shared focus after destination membership resolves, and replace the unconditional clear effect.
- Add a missing-custom fallback before relying on persisted custom selection at startup.

**Risk assessment:** **HIGH.** This plan currently conflicts with an existing focus-clearing effect and omits the component that performs the render-loop transition.

---

## Claude Review

*Run as a read-only orchestrator subagent (see Lane provenance above), not `claude -p`.*

# Phase 30 (Orrery Systems) — Claude Peer Review

**Reviewer lane:** Claude (read-only, code-verified). Method: every plan claim checked against the actual file on disk, not the plan's summary. SQL-writer invariants hand-checked across `src/db/` and `src/logic/` (the graph cannot enumerate SQL writers).

**Baseline verified on disk (D-03):** migrations run `001`…`021-orrery-preferences.ts`; `TARGET_VERSION = 21` (`src/db/database.ts:56`). Next migration is **022** — the number every plan uses is correct. `BACKUP_FORMAT_VERSION = 4` (`src/backup/types.ts:14`). `orrery_last_system` already exists (`021-orrery-preferences.ts:16`). `use-reduced-motion.ts` (ADR-085 hook) **exists** on disk with `useReducedMotionShared()`/`useReducedMotion()`.

---

## Concern count

- **HIGH: 1**
- **MEDIUM: 3**
- **LOW: 4**

HIGH headline: **Plan 10's declared file set (OrreryScreen.tsx + a pure math module) cannot render the per-body "spin + shedding/capture" animation (ORRS-13) — the Skia body drawing lives in `<OrreryWorld>`, which is not in scope and receives no transition/intensity prop.**

---

## Per-plan review

### 30-01 — Systems persistence foundation + thin vertical slice
**Summary.** Migration 022 (four tables: `systems`, `system_rules`, `system_overrides`, `system_prefs`), the `custom` ref kind, widened `orrery_last_system` grammar, a minimal manual-only resolver, custom-kind routing in the read layer, and a switcher entry. A `checkpoint:decision` (blocking-human) gates the irreversible table shape.

**Strengths.**
- Correctly treats migration 022 as a one-way door and escalates the table decomposition to a human checkpoint (Task 1) — exactly right for an irreversible, unrepairable-on-device schema (CLAUDE.md data-layer rule).
- Re-verify-on-disk step for the migration number (D-03) is present in Task 2 behavior, not assumed.
- Injection-safe by construction: `uid` via `newUid()` (guards Hermes `crypto`, `src/db/uid.ts:19-23`), `mode` CHECK-constrained, family/kind tokens from closed constants. No `app_settings` ALTER (021 already added the column, verified `021-orrery-preferences.ts:16`).
- Union extension is the right shape: the closed union today is only `builtin | category` (`src/logic/orrery-system-logic.ts:24-26`); adding `custom` and riding the unchanged Phase-29 read pipeline honors D-10.

**Concerns.**
- **MEDIUM — custom routing must precede `buildOrrerySystemWhere`, and that function needs a custom guard.** `readOrrerySystemMembersCore` calls `buildOrrerySystemWhere(system)` **unconditionally at `src/db/orrery-system-read.ts:58`**, before any kind check. `buildOrrerySystemWhere` (`src/logic/orrery-system-logic.ts:73-115`) has a `category` branch then `switch (system.id)` with **no `default`**; for a `custom` ref `system.id` is absent, the switch matches nothing, the function returns `undefined`, and `where.sql` at line 59/70 throws at runtime. The plan's action says route custom "inside" the function and "keep the builtin/category path exactly as-is" — a literal reading leaves line 58 first and crashes. Also, once `custom` joins the union, `buildOrrerySystemWhere`'s `switch (system.id)` will not type-check (`.id` doesn't exist on the custom member) unless the function narrows/guards `custom` explicitly. The plan under-specifies both: it needs an **early custom branch before line 58** and a `custom` guard (throw) in `buildOrrerySystemWhere`. tsc will catch the type half; the ordering half is a runtime trap.
- **LOW — ref-keyed overrides/prefs are not FK-protected against a `systems` deletion.** `system_overrides`/`system_prefs` key on `system_ref TEXT`, not `systems.id`, so only `deleteSystem()` (plan 03) prevents orphans; any other deletion path orphans them. This is the acknowledged Option-A trade-off; fine given DAO-sole-writer, but worth an integrity test.

**Suggestions.** Spell out the custom early-return in `readOrrerySystemMembersCore` and the `custom` throw-guard in `buildOrrerySystemWhere` in the plan body so the executor doesn't follow "keep as-is" literally.

---

### 30-02 — Custom-System membership resolver
**Summary.** `resolveCustomSystemMembers`: map rules → canonical Dashboard filters (OR-within/AND-across), post-query Gravity TS pass, E-02 scope rule, include/exclude overrides with dynamic-bucket exclusion pruning, non-destructive broken-rule detection.

**Strengths.**
- Every referenced fragment is real and at the cited lines: `ACTIVE_SEGREGATION_WHERE` (`dashboard-query-logic.ts:149-151`), `DASHBOARD_POPULATION_SCOPE_WHERE` (154-155), `NOT_CONTACTED_WHERE` (157), `FAVOURITES_WHERE` (158), `SNOOZED_WHERE` (159-160), `SOCIAL_BATTERY_VALUES` (38), `NEEDS_ATTENTION_VALUE` (39), `CONTACT_FREQUENCY_BANDS` (29-34), `DASHBOARD_FILTER_FAMILIES` (14-20).
- `buildFilterWhere` expects category as `/^\d+$/` **integer id strings** (`dashboard-query-logic.ts:83-90`); the plan correctly resolves category **uid→id via a bound `IN(…)` join** and passes id strings — no identifier interpolation.
- Gravity-as-post-query is verified correct: `buildFilterWhere` deliberately emits no gravity SQL (comment at `dashboard-query-logic.ts:113-114`), and `filterByGravity(candidateIds, selectedTiers, loadInputs, now)` preserves candidate order (`dashboard-gravity-filter.ts:19-38`). The plan's signature and "batch-load once, look up per id" loader match.
- D-07 honored: a `category:<uid>` rule with no matching row becomes a `BrokenRule` and is **omitted from the WHERE, never deleted or rewritten** — no decision reversal.
- E-02 preserved: base scope stays `ACTIVE_SEGREGATION_WHERE` unless a Not-Contacted rule widens it, mirroring the built-in not-contacted path (`orrery-system-logic.ts:85-89`).

**Concerns.**
- **LOW — empty `buildFilterWhere` composition.** `buildFilterWhere` returns `sql: ""` when no filter-family values are selected (`dashboard-query-logic.ts:115`). A boolean-only rule set (favorite/snoozed/not-contacted only, no category/battery/frequency/needs-attention) must not `AND ()` an empty string into the candidate WHERE. Executor detail; ensure a boolean-only-rules test exists.

**Suggestions.** Add an explicit test for "rules present but `buildFilterWhere.sql === ''`" so the empty-fragment guard is proven.

---

### 30-03 — Full Systems DAO (CRUD/duplicate/reorder/visibility/overrides)
**Summary.** Rename/delete(+Undo snapshot)/duplicate/reorder/hide-show/reset, CI-unique names, built-in/Category immutability, All-Contacts protection, contact-safe delete — all `changes===1`-guarded, `?`-bound, single-writer.

**Strengths.**
- Reuses the verified `memories-dao` idiom (core+mutex, `assertOneChange`, `inWriteTransaction` + `bumpDataRevisionCore`) — the cited neighbors exist.
- Immutability + All-Contacts protection enforced at the **write boundary** (assertMutableCustomRef, reject hide/delete of `builtin:all-contacts`), not only in UI — correct defense-in-depth, and a concrete test asserts the `contacts` row-count is unchanged by delete (ORRS-10).
- `mapBuiltinPredicateToRules` draws from the real built-in predicate map (`orrery-system-logic.ts:82-113`) — duplicating a built-in into editable custom rules is grounded in actual source.
- `grep -rn "INSERT INTO system\|UPDATE system\|DELETE FROM system" src/components src/screens` as an acceptance gate correctly enforces DAO-only writes.

**Concerns.** None above LOW. (The ref-keyed-orphan note is filed under plan 01.)

**Suggestions.** In `deleteSystem`, assert `system_overrides`/`system_prefs` ref-keyed rows are gone in the same transaction (not just the `systems` row) so the Option-A cleanup is regression-tested.

---

### 30-04 — Backup contract (declare-only)
**Summary.** Restore accepts widened `custom:<uid>` last-active (auto via the widened `assertOrreryLastSystem`), documents the Phase-36 Systems serialization/orphan-repair contract, proves no wire/format change.

**Strengths.**
- Correctly declare-only per D-06: no format bump, no `export-manifest.ts`/`FORWARD_MIGRATIONS` edit; pins the version so a premature bump fails CI. `BACKUP_FORMAT_VERSION = 4` verified.
- `assertOrreryLastSystem` (`app-settings-dao.ts:74-84`) is the single restore validator and is widened by plan 01 — the "flows through automatically" claim is accurate.
- Malformed-token rejection (not coercion) is the right posture and matches the existing regex grammar.

**Concerns.**
- **LOW — pin against the true source.** `BACKUP_FORMAT_VERSION` is defined in `src/backup/types.ts:14`, not `export-manifest.ts` (which imports it). The read_first line implies the constant lives in export-manifest; the pin test should assert against `types.ts` (or the imported binding) to be meaningful.

**Suggestions.** None material.

---

### 30-05 — Switcher: order, visibility, counts, empty/broken severity
**Summary.** Three central icon keys, ordered/visible/counted/severity `buildSystemChoices`, custom rows + Manage Systems entry — icon shape + text, never hue alone.

**Strengths.**
- `buildSystemChoices` today (`orrery-controls-logic.ts:7-26`) maps BUILTIN_SYSTEMS + categories; the plan's "pure function over already-read inputs" keeps it node-testable — consistent with the existing shape.
- "Never hue alone" (icon + text + a11y suffix) satisfies the accessibility invariant; central icon-registry keys (no inline glyphs) match the repo convention.
- Preserves the existing focus/AppState dismiss lifecycle in `OrrerySystemSelector.tsx` — correctly flagged as must-not-break.

**Concerns.**
- **LOW — broken state on the ACTIVE view is not wired.** The scene snapshot status is only `"ready" | "missing-category"` (`orrery-system-read.ts:47-51`); `brokenRules` is surfaced by `resolveCustomSystemMembers` (plan 02) to the switcher, but when a broken custom System is the **active** view, the Orrery screen has no needs-attention channel from the snapshot. Product gap, not an ORRS-11 blocker (ORRS-11 is the switcher).

**Suggestions.** Note in the SUMMARY whether the active broken-System indicator is intended for a later plan/phase, so it isn't assumed delivered.

---

### 30-06 — Systems Management screen + routes
**Summary.** Flat management screen (CRUD/duplicate/reorder/hide-show/reset), reachable from Orrery + Settings stacks, contact-safe delete + short-lived Undo, CI-unique names.

**Strengths.**
- All referenced infra exists: `navigation/types.ts`, `OrreryStack.tsx`, `SettingsStack.tsx`, `snackbar-store.ts`, `ArchivedContactsScreen.tsx`, `orrery-system-store.ts` (fallback to `ALL_CONTACTS_SYSTEM` verified in `select`).
- Delete UX matches D-07/ORRS-10 (simple confirm + Undo via `DeletedSystemSnapshot`/`restoreDeletedSystem`, **no** 30-day quarantine, never touches contacts). Active-System-deleted → store fallback to All Contacts is correctly wired to `store.select(ALL_CONTACTS_SYSTEM)`.
- Explicit "never silently rewrite a broken rule" prohibition — repair only through the editor (D-07).

**Concerns.** None above LOW. Task 2 sensibly gates the custom-Edit → builder navigate behind a route-exists/TODO seam because plan 08 lands in a later wave (06 is wave 3, 08 is wave 4) — good sequencing awareness.

**Suggestions.** Confirm the two `SystemsManagement` registrations (Orrery + Settings stacks) and the plan-08 `SystemBuilder` route (also OrreryStack) don't collide when 08 edits the same files in the next wave — sequential waves make it safe, but the SUMMARY should note the shared files.

---

### 30-07 — Manage Members grid
**Summary.** Searchable, virtualized, multi-select avatar grid over the existing contact-picker **logic** modules; rule matches preselected; deselect = exclude-in-place; Add People = eligible-active inclusion; counts total·added·excluded.

**Strengths.**
- Reuses `contact-picker-selection.ts` + `contact-picker-source.ts` (both exist) rather than inventing a second selection system (dossier §M) — correctly avoids the ContactPicker single-select modal.
- §F eligibility (Archived/Unbound excluded from Add People, but a retained Archived manual-include shown as unavailable) is a real correctness case and is explicitly tested.
- Dynamic-bucket semantics (an exclusion means nothing once the contact stops matching) are consistent with plan 02's `prunableExclusionContactIds`.
- Reuses shared predicate constants (`ACTIVE_SEGREGATION_WHERE`/population scope) — no hand-rolled eligibility predicate.

**Concerns.** None above LOW.

**Suggestions.** The plan leans on a component render smoke test under vitest (no react-test-renderer in the repo per `use-reduced-motion.ts` header). Keep the assertion in the **pure logic** test; treat the grid's virtualization/large-membership behavior as device UAT (already listed).

---

### 30-08 — System Builder HUD
**Summary.** Multi-page floating HUD (Definition → Manage Members → Preview), accordion rules over eight axes (Birthday omitted), live match count, save-switch semantics, `useDiscardKeepGuard`, override reset.

**Strengths.**
- `useDiscardKeepGuard` exists (`src/navigation/discard-keep-guard.ts`, already consumed by `EditContactScreen.tsx`) — the "reuse verbatim" instruction is grounded.
- Save-switch semantics (save-new switches via `store.select`; edit-active keeps active; edit-non-active returns without switching) match ORRS-08 and the store's `select` behavior.
- Correctly reuses the HUD-over-canvas pattern from `OrrerySystemSelector` (GlassSurface + OrreryObstacle + shellTransientStore + focus/AppState lifecycle).
- Prohibits sharing Dashboard live UI/query state (predicate LOGIC only) — ADR-093 honored; closed-vocabulary rule values only (no free text → SQL).

**Concerns.** None above LOW. The "do not rebuild the production Orrery on each rule toggle" (§O) is a `backstop`/device item, appropriately not unit-asserted.

**Suggestions.** Ensure the live-count call debounces `resolveCustomSystemMembers` (a full candidate SELECT + gravity pass per keystroke/toggle can be costly at scale) — the plan says "debounced"; keep it.

---

### 30-09 — Full-canvas Preview
**Summary.** Simplified Skia render over the **reused** Phase-29 layout, pan/zoom (no tilt/yaw), no-Profile body tap, Save-from-Preview/Edit, textual a11y summary, discard guard.

**Strengths.**
- Pure `buildPreviewMarkers`/`previewMembershipSummary` split (Skia-free, node-testable) is the right seam; explicitly imports Phase-29 layout math rather than reimplementing it (D-10).
- Explicitly cites the **worklet forward-ref hazard** ("define worklet helpers above callers") and the Skia colour-token rule — the two device-only traps this repo has hit.
- No-Profile-from-Preview and no tilt/yaw are enforced with grep gates.

**Concerns.**
- Shares the plan-10 renderer-scope question at lower severity: Preview at least **creates its own** `SystemPreviewCanvas.tsx`, so it owns its Skia draw surface (unlike plan 10). The device-verify backstops are appropriate.

**Suggestions.** State which Phase-29 layout function is imported (the plan says "grep for the projection/layout helper") — pin the exact symbol in the SUMMARY so plan-10/future work reuses the same one.

---

### 30-10 — System-switch experience (persistence, Home framing, focus, animation)
**Summary.** Persist/restore last-active (incl. `custom:<uid>`), land at canonical Home framing, preserve a shared focus, membership-delta-adaptive spin + shedding/capture on the Skia render loop, Reduced-Motion crossfade. Pure delta/intensity/focus math + wiring into OrreryScreen.

**Strengths.**
- **D-09 disk-correction handled correctly.** The plan explicitly notes D-09's "hook does not exist yet" premise is stale — `use-reduced-motion.ts` exists (ADR-085) and exposes `useReducedMotionShared()` (a `SharedValue<boolean>` the Skia loop reads via `useDerivedValue`, never `setState`) — verified `use-reduced-motion.ts:106-118`. Consuming it is not a decision reversal; it's a fact correction. `OrreryScreen.tsx:213` already calls `useReducedMotionShared()`.
- Pure math module (no React/Skia imports, grep-gated) is the right, unit-testable seam; count-independent intensity (identical sets ≈ 0, full turnover ≈ 1) is a sound design.
- Correctly prohibits per-frame React state and camera persistence, and correctly insists Skia perf be measured on the Pixel, not the emulator (MEMORY).

**Concerns.**
- **HIGH — the declared file set cannot render "spin + shedding/capture" (ORRS-13).** `files_modified` is only `orrery-switch-animation.ts` (pure math) + `OrreryScreen.tsx`. The actual Skia body drawing is in `<OrreryWorld>` (rendered at `OrreryScreen.tsx:800`), which receives `scene/camera/pose/viewport/colors/focusedIds/satellites/…` but **no transition/intensity prop** and is **not in scope**. A per-body shedding (departing members) / capture (entering members) animation requires the renderer to consume the intensity `SharedValue` and the entering/leaving id sets — i.e. changes to `OrreryWorld` and its Skia draw code. With the declared files, only a **camera-level spin** (via the existing `pose` shared value) is achievable; the signature per-body shedding/capture half of ORRS-13 is unbuildable as scoped. Because ORRS-13's animation is a `backstop`/device-UAT item (not unit-catchable), this gap will surface only at device UAT. Add `OrreryWorld` (and whatever child owns the body draw) to the plan, or explicitly re-scope the animation to camera-only and record that as a decision.
- **MEDIUM — focus preservation conflicts with existing unconditional focus-clear.** `OrreryScreen.tsx:282-288` **clears** `focusTargets` on any `requested.id` change (`setFocusTargets([])`), and `:639-652` re-validates focus against the new members and flags `"removed"`. "Preserve a focus present in BOTH source and destination" (ORRS-12) cannot work unless these are modified. The plan doesn't call out reconciling with 282-288/639-652; naive wiring will either always-clear (existing behavior wins) or double-handle focus.
- **MEDIUM — membership-delta source ids aren't available in a single store transition.** `select()` sets `snapshot: null` during loading then the new snapshot on ready (`orrery-system-store.ts:66-124`, esp. `:93`). The `subscribe((next, previous))` callback therefore never sees the **old** ready members and the **new** ready members in one transition: at loading, `next.snapshot` is null; at ready, `previous.snapshot` is null. The plan says compute the delta from "previous vs next member id sets" — a naive `previous.snapshot.members` read yields null/empty and a wrong intensity. Source ids must be stashed at the loading edge and diffed at the ready edge.

**Suggestions.** (1) Add the renderer file(s) to scope or re-scope the animation and record it. (2) Replace the 282-288 clear with `preservedFocus(...)`-aware logic and note it in the plan. (3) Specify the stash-at-loading / diff-at-ready delta capture explicitly.

---

## Cross-plan concerns

1. **Renderer boundary is the phase's real risk locus.** Plans 01-04 (migration/DAO/resolver/backup) are code-grounded, injection-safe, forward-only, and reference-accurate — low risk. Risk concentrates where plans touch the **Skia render loop / camera / focus** against the actual `OrreryScreen`+`OrreryWorld`+`orrery-system-store` machinery (plan 10, and to a lesser extent 09). Those behaviors are device-verified `backstop`s, so scope gaps there won't be caught by `npm test` and will slip to UAT.

2. **Wave-shared file edits are sequenced, not parallel — good, but note them.** `orrery-controls-logic.ts` (plans 01 → 05), `systems-dao.ts` (01 → 03), `system-rule-resolver.ts` (01 → 02), `navigation/types.ts`+`OrreryStack.tsx` (06 → 08), `SystemBuilderScreen.tsx` (08 → 09) are each edited across waves. Wave ordering prevents clobber, but plan 05 lists `depends_on: [30-02,30-03,30-06]` without `30-01` even though it extends plan-01's `buildSystemChoices` — safe transitively (02/03 depend on 01) but worth an explicit note.

3. **Decision integrity — no reversals detected.** D-07 (broken rules stay needs-attention, never rewritten/deleted) is honored across plans 02/03/06. E-02 (never-contacted only when explicitly requested) is preserved in the resolver's scope rule. D-06 (declare-only backup, Phase-36 owns the bump) is honored in plan 04. D-05 (last-active is an `app_settings` preference, not a `systems` row) holds. No ADR/HANDOFF entry is deleted, weakened, or inverted.

4. **Hazard sweep (all clean where in scope):** local-first preserved (every read is SQLite, no network path added); theme tokens enforced via `npm run check:colors` incl. Skia draws; `newUid()` guards Hermes `crypto` (`uid.ts:19-23`); worklet forward-ref hazard explicitly cited in 09/10; migration additive/forward-only, no edit to 001-021, no `app_settings` ALTER in 022; portrait-lock and `formatLocalDate` unaffected. Custom-field invariants (migration 006/ADR-001) are untouched — this phase adds the `system_*` tables, not `custom_field_*`, and `sortExpr()`/`field_history` are not in play.

---

## Overall risk assessment: **MEDIUM**

Justification: The data layer (plans 01-04) — the place this repo's correctness bugs historically live — is the strongest part: migration number verified against disk, all predicate/gravity/backup references verified accurate at the cited lines, injection-safe, forward-only, and with the irreversible schema shape correctly gated behind a human checkpoint. That half is LOW risk. The MEDIUM rating is driven by plan 10: one HIGH scope gap (the per-body switch animation cannot be rendered from the declared files) plus two MEDIUM integration gaps (focus-preservation vs. the existing unconditional focus-clear, and delta source-ids vs. the store's null-during-loading behavior), all in device-verified territory that `npm test` will not catch — and one MEDIUM in plan 01 (custom routing order / `buildOrrerySystemWhere` guard). None is a decision reversal; all are recoverable with the wiring made explicit before execution.


---

# Cross-AI Plan Review — Phase 30 (Orrery Systems) — CYCLE 2

> **Cycle 2** re-review of the CURRENT plans on disk after the cycle-1 replan (commit `a6f4d02` — "reachability, atomicity, data-flow, renderer scope, missing-System handling"). Reviewers: `codex` (gpt-5.6-terra, reasoning=low, source-grounded runner lane) and `claude` (Opus, read-only orchestrator subagent — the headless `claude -p` lane has a known Write-permission failure in this repo; owner explicitly approved the Claude lane for this run). Both had full repo read access and verified plan claims against source; neither wrote, committed, or pushed. This section ACCUMULATES onto the cycle-1 record above — it does not replace it. Findings are judged only for whether they REMAIN unresolved against the current plans; cycle-1 items the replan incorporated or deferred in a PLAN.md are not recounted.

## Cycle 2 Consensus Summary

The replan is **substantially stronger** and both reviewers agree on it: **every cycle-1 HIGH is genuinely incorporated into the current PLAN.md files, and each fix rests on a disk fact both lanes (and the orchestrator) independently re-verified.** Cross-catalog name uniqueness, custom read-routing order + `buildOrrerySystemWhere` throw-guard, the `missing-custom` domain result, atomic `saveSystemDefinition` (single non-reentrant transaction), uid-preserving undo restore, All-Contacts `scope:population` duplication, the `resolveMembershipFromDefinition` draft engine, the OrreryScreen data-flow owner + `catalog` prop, the Settings-stack `SystemBuilder` registration (both stacks) with corrected wave ordering (06 now depends on 08), `OrreryWorld` brought into plan-10 scope, the focus-clear replacement, the stash-at-loading/diff-at-ready delta capture, and the declare-only backup contract with the real missing-custom fallback chain — all present and disk-grounded. No ADR/HANDOFF/dossier decision is reversed (D-05/D-06/D-07/E-02 hold; `custom_field_*` invariants untouched).

**The reviewers diverge on residual risk, and the divergence is one of coverage, not contradiction — the same shape as cycle 1.** Claude rates the phase **MEDIUM with zero unresolved HIGH**, having scoped its pass to *whether the cycle-1 fixes were incorporated* (they were) plus internal consistency and the render-loop. Codex rates the phase **HIGH ("should not execute until the resolver → member-grid → builder → preview data contracts are repaired")**, reaching a NEW cluster of cross-plan **consumer-contract** gaps that the replan exposed but did not close. **The orchestrator code-verified every consequential Codex HIGH against source on disk and all check out as real** — this is Codex reaching integration seams Claude did not enumerate, not Codex overreach. Symmetrically, Claude surfaced one NEW render-pipeline finding (plan-10 Task 3 duplicating the existing `orrery-frame` shed/capture pipeline) that Codex did not raise and the orchestrator also verified as real. The two lanes are complementary.

### Orchestrator verification (code, not the diff — not the reviewer summaries)
Confirmed against source on disk:
- **`candidateIds` is absent from the resolver return.** `resolveMembershipFromDefinition` returns `{ memberIds, brokenRules, prunableExclusionContactIds }` (`30-02-PLAN.md:165,170`); `resolveCandidateIds` is internal only. 30-07's `deriveMemberRows(candidateIds, includeIds, excludeIds, contactRows)` and the builder's embedded grid need the pre-override candidate set to classify member/excluded/added (ORRS-06). Real, unresolved.
- **`SystemBuilder` is an opaque native `Stack.Screen`.** `OrrerySystemSelector` is a **component rendered inside `OrreryScreen`** (`OrreryScreen.tsx:818`, over the canvas at `:800`) — not a route — so its "HUD over the live Orrery" model does not transfer to a pushed opaque route; there is **no `presentation: 'transparentModal'`** anywhere in the stacks. Plan 08's "make the entire production Orrery behind the HUD inert" has nothing behind it. Real, unresolved.
- **Provisional-scene inputs are unsourced.** The real derivation (`orrery-scene.ts`) needs ordered member records + impact inputs + density + sun/settings; the resolver returns ids and `systems-members-read` returns `{id,name,photo,searchMethods}`. No plan produces the scene inputs for an unsaved draft's id set. Real, unresolved.
- **`matchesQuery`/`filterRows` are typed to `ContactPickerRow`** (`contact-picker-selection.ts:17,28-32`), which requires `lookupKey/displayName/primaryMethod/photoThumbUri`; 30-07's `SystemMemberRow` is `{id,name,photo,searchMethods}` with no adapter specified. Real.
- **`deriveHomePose(world, viewport)` is the canonical Home framing** (`OrreryScreen.tsx:714,755`); `HOME_CAMERA` is only the initial seed (`:212`). Plan 10 Task 2's "send to HOME_CAMERA" contradicts its own "canonical Home framing" must-have. Real.
- **Dossier §R limits Hide/Show to built-in/category** ("Built-in/category-derived Systems may be Hidden/Shown"); 30-03's `setSystemHidden` accepting custom refs diverges. Real.
- **`orrery-frame.ts` already sheds/captures on generation change** (`beginWorldTransition` 39-72, `sampleWorldTransition` 74-93; driven in `OrreryWorld.tsx:245,259,278,292`); 30-10 references `orrery-frame` zero times and proposes a redundant parallel entering/leaving prop. Real.
- **30-06 is missing its `</objective>` closing tag** (all 9 other plans have it). Real.

### Agreed Strengths (both lanes)
- Migration 022 number (`TARGET_VERSION → 22`) re-verified on disk; additive/forward-only; no `app_settings` ALTER; irreversible table shape gated behind a blocking human checkpoint.
- All cycle-1 HIGHs incorporated with accurate disk citations (unusually, the plans' "verified against source" claims hold up).
- Atomic save rationale is real (`transaction.ts` non-reentrant); DAO-only-writer grep gates; injection-safe closed-vocabulary writes; Hermes-crypto + worklet-forward-ref hazards cited; local-first and theme-token invariants preserved; no decision reversals.

### Agreed / cross-cutting Concerns
- Residual risk concentrates in the **render loop and the cross-plan data contracts feeding the authoring UI** (plans 05/07/08/09/10), all device-verified `backstop` territory that `npm test` will not catch.

### Divergent Views
- **Overall risk:** Codex **HIGH** (execute-blocking data-contract repairs) vs Claude **MEDIUM** (no unresolved HIGH). Orchestrator adjudication: the three Codex data-contract HIGHs are **real and unresolved** (verified above); the phase carries **3 unresolved HIGH** into cycle 2. This is a coverage divergence — Claude did not probe the consumer contracts — not a factual disagreement.
- **Plan 10 Task 3:** Claude MEDIUM (duplicates the existing `orrery-frame` pipeline) — Codex did not raise it; orchestrator-verified real.
- **`ContactPickerRow` reuse (30-07):** Codex HIGH (type-incompatible) — orchestrator rates it MEDIUM (a mechanical adapter closes it) but confirms it is unspecified. Claude did not raise it.

## Cycle 2 — Unresolved HIGH concerns (orchestrator-adjudicated, verified real)
1. **Resolver contract omits `candidateIds` (30-02 → 30-07/30-08).** The pre-override rule-candidate set is needed to render exclude-in-place (ORRS-06) and the builder's embedded grid; `resolveMembershipFromDefinition` does not return it. *Change:* add `candidateIds` to `ResolvedMembership`/the draft-engine return in 30-02, and have 30-07/30-08 consume it.
2. **Builder HUD presentation/canvas ownership unspecified & self-contradictory (30-08).** `SystemBuilder` is a normal opaque `Stack.Screen`, so there is no live Orrery behind it to make inert; the plan mixes "own canvas" and "production Orrery behind the HUD" without deciding. *Change:* specify either a transparent/modal presentation that retains the Orrery route underneath, or make the builder own its own background scene/canvas, and re-target the a11y-inert requirement accordingly.
3. **Provisional-scene inputs are produced by no plan (30-09).** The shared `orrery-scene` derivation seam needs full member records + impact inputs + density + sun/settings for an unsaved draft's id set; nothing supplies them. *Change:* add a `readProvisionalOrreryScene(exec, memberIds)` read/service seam (batching member records + impact inputs + settings + sun) as the Preview's input, owned by 30-09 (or 30-02/30-07).

## Cycle 2 — Actionable non-HIGH concerns (not yet in any PLAN.md task/AC/must-have; not deferred)
1. **[MED] 30-07** — `matchesQuery`/`filterRows` are typed to `ContactPickerRow`; `SystemMemberRow` cannot feed them. *Change:* add an explicit `SystemMemberRow → ContactPickerRow` adapter (search/selection only, local `photo` kept separate) to Task 1/3.
2. **[MED] 30-10 Task 3** — reconcile with the existing `orrery-frame` world-transition pipeline (`beginWorldTransition`/`sampleWorldTransition`, already driven by OrreryWorld) instead of a parallel enter/leave prop. *Change:* pass only the `switchIntensity` SharedValue + a spin term (modulating the existing transition's magnitude/easing), drop the redundant entering/leaving id-set prop, add `src/logic/orrery-frame.ts` to Task 3 read_first.
3. **[MED] 30-10 Task 2** — Home framing. *Change:* replace "send the destination camera to `HOME_CAMERA`" with `deriveHomePose(destination.world, viewport)` (canonical framing at `OrreryScreen.tsx:714/755`); keep `HOME_CAMERA` only as the initial seed.
4. **[MED] 30-10** — active broken-canvas state (E7) has no data path. *Change:* add a `brokenRules`/`systemHealth` signal to `OrreryMembersResult`/the scene snapshot so the active-canvas needs-attention affordance has a source (currently a device-verify backstop with nothing feeding it).
5. **[MED] 30-03 Task 3** — `setSystemHidden` accepts custom refs; dossier §R limits Hide/Show to built-in/category (custom is deleted). *Change:* reject `{kind:"custom"}` in `setSystemHiddenCore` + add a DAO test.
6. **[MED] 30-05 Task 2/3** — the "bounded COUNT" still triggers a full member resolve + a per-System `readOrreryImpactInputsCore` scan for custom/gravity Systems (N per dropdown-open). *Change:* specify an async, revision-keyed count cache with progressive row updates / batched non-gravity SQL counts + a cap, in the must-haves (not only as a device-UAT backstop).
7. **[MED] 30-02 Task 1** — closed-token validation defines sentinels for category/battery/frequency/needs-attention/gravity but not for the Favorite/Not-Contacted/Snoozed/`scope:population` boolean/system axes. *Change:* define + test exported sentinel constants for those axes so a malformed boolean-axis value becomes a `BrokenRule`.
8. **[LOW] 30-06** — the `<objective>` block is not closed before `<execution_context>` (missing `</objective>`; all 9 other plans have it). *Change:* add the closing tag.
9. **[LOW] 30-10 Task 2** — the missing-custom catch re-enters `select(ALL_CONTACTS_SYSTEM)` from inside `select()`'s catch (re-entrant, unlike the terminal missing-category branch). *Change:* note the generation/`same`-guard interaction so it cannot loop.
10. **[LOW] 30-02 Task 2** — fix the `readOrreryImpactInputsCore` citation (defined at `orrery-impact-read.ts:23`, invoked at `orrery-system-read.ts:109`) and state whether the resolver **injects** the gravity loader (preferred, matches `dashboard-gravity-filter.ts`) or imports it (logic→db inversion).
11. **[LOW] 30-09 Task 1** — pin the exact current `orrery-scene` derivation symbol to factor the provisional entry point from, replacing the guess-set grep (`generateScene|deriveScene`) in the acceptance criteria.
12. **[LOW] 30-04 Task 2** — the contract doc should explicitly state custom-rule Category UIDs remain portable identifiers, repaired as broken rules, never silently discarded.

None of the above reverses a recorded decision. The three HIGHs are cross-plan contract repairs (touch plans 02/07/08/09); the non-HIGH items are plan-text tightenings, only #2/#3/#4 touching device-observable behavior.

---

## Codex Review (Cycle 2)

*Model: gpt-5.6-terra (reasoning=low); source-grounded gsd-review runner lane. Graph queries were unavailable in the sandbox (`tsx` IPC), so Codex verified directly against source + dossiers.*

## Overall

The replan is substantially stronger: it correctly extends the existing System union/read/store pipeline, preserves the migration and backup sequencing, and addresses the prior missing-custom, atomic-save, route-order, and Skia ownership problems. I found four remaining cross-plan implementation gaps, two of them high-impact.

Graph queries could not run in this sandbox (`tsx` cannot create its IPC pipe), so I verified directly against the source and dossiers instead.

### 30-01 — Foundation

Summary: Sound thin-slice approach, with the irreversible schema correctly human-gated.

Strengths:

- Correctly avoids re-adding `orrery_last_system`; it already exists in migration 021 and `TARGET_VERSION` is currently 21. [021-orrery-preferences.ts:12](/home/bwales/projects/orbit-app/src/db/migrations/021-orrery-preferences.ts:12), [database.ts:56](/home/bwales/projects/orbit-app/src/db/database.ts:56)
- The proposed early custom routing is necessary: the current reader calls `buildOrrerySystemWhere()` before any kind-specific handling. [orrery-system-read.ts:54](/home/bwales/projects/orbit-app/src/db/orrery-system-read.ts:54)
- The custom `WHERE` throw-guard correctly protects the current builtin-only `switch (system.id)`. [orrery-system-logic.ts:73](/home/bwales/projects/orbit-app/src/logic/orrery-system-logic.ts:73)

Concerns: None remaining beyond the intended blocking schema-shape checkpoint.

Suggestions: Keep the checkpoint and explicitly record the chosen ref-keyed cleanup invariant in the migration test.

Risk: MEDIUM — solely because it is a forward-only migration.

### 30-02 — Resolver

Summary: Correct predicate composition and scope handling, but its return contract is insufficient for the downstream member editor.

Strengths:

- It preserves the critical default segregation: active scope requires `last_contact IS NOT NULL`, while the population scope deliberately does not. [dashboard-query-logic.ts:149](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:149)
- Keeping Gravity out of SQL is correct; the canonical implementation is a TypeScript post-filter. [dashboard-gravity-filter.ts:19](/home/bwales/projects/orbit-app/src/logic/dashboard-gravity-filter.ts:19)
- Stable candidate ordering matches the existing Orrery member read ordering. [orrery-system-read.ts:66](/home/bwales/projects/orbit-app/src/db/orrery-system-read.ts:66)

Concerns:

- HIGH — `resolveMembershipFromDefinition` returns only `memberIds`, broken rules, and prunable exclusions, but Manage Members requires the pre-override `candidateIds` to distinguish rule matches from manual additions/exclusions. [30-02-PLAN.md:163](/home/bwales/projects/orbit-app/.planning/phases/30-orrery-systems/30-02-PLAN.md:163), [30-07-PLAN.md:156](/home/bwales/projects/orbit-app/.planning/phases/30-orrery-systems/30-07-PLAN.md:156) Without it, re-opening an editor cannot accurately render “Excluded in place.”
- MEDIUM — closed-token validation is incomplete in the stated mapper: it validates category, battery, frequency, needs-attention, and gravity, but does not define/validate the required sentinel values for Favorite, Not Contacted, Snoozed, or `scope:population`. [30-02-PLAN.md:103](/home/bwales/projects/orbit-app/.planning/phases/30-orrery-systems/30-02-PLAN.md:103)

Suggestions: Return `candidateIds` in `ResolvedMembership`, and define exported constants plus malformed-row tests for every boolean/system-only rule value.

Risk: HIGH — this contract drives both membership correctness and the authoring UI.

### 30-03 — DAO

Summary: Strong transaction and deletion design; one permission boundary remains broader than the dossier.

Strengths:

- The plan respects the project’s non-reentrant transaction contract. [transaction.ts:12](/home/bwales/projects/orbit-app/src/db/transaction.ts:12)
- UID-preserving restore is the right design for ref-keyed override/preferences records.
- All-Contacts duplication correctly needs `scope:population`; an empty custom definition would otherwise use active-only scope. [30-03-PLAN.md:136](/home/bwales/projects/orbit-app/.planning/phases/30-orrery-systems/30-03-PLAN.md:136)

Concerns:

- MEDIUM — `setSystemHidden` is specified to accept every known ref, including custom Systems. [30-03-PLAN.md:167](/home/bwales/projects/orbit-app/.planning/phases/30-orrery-systems/30-03-PLAN.md:167) The dossier deliberately limits hide/show to built-in and category Systems; custom Systems are deleted instead. [phase-09-orrery-systems-dossier.md:371](/home/bwales/projects/orbit-app/docs/dossier/milestone-2/phase-09-orrery-systems-dossier.md:371) Enforce that boundary in the DAO, not just the screen.

Suggestions: Reject `{kind:"custom"}` in `setSystemHiddenCore` and add a DAO test.

Risk: MEDIUM.

### 30-04 — Backup contract

Summary: Correctly declare-only and well sequenced.

Strengths:

- Restore already validates the preference through `assertOrreryLastSystem`. [backup-schema.ts:211](/home/bwales/projects/orbit-app/src/backup/backup-schema.ts:211)
- The backup format is currently 4 in the canonical types module. [types.ts:14](/home/bwales/projects/orbit-app/src/backup/types.ts:14)
- Export currently has no Systems-table reads, so preserving this plan’s “no emission” constraint protects the wire shape. [export-manifest.ts:40](/home/bwales/projects/orbit-app/src/backup/export-manifest.ts:40)

Concerns: None material.

Suggestions: Make the document explicitly state that custom-rule Category UIDs remain portable identifiers and are repaired as broken rules, never silently discarded.

Risk: LOW.

### 30-05 — Switcher

Summary: The data-flow owner is now clear, but the count strategy is not genuinely bounded at scale.

Strengths:

- `OrreryScreen` is the right owner; today the selector receives only state/height/enabled and derives only builtins/categories. [OrrerySystemSelector.tsx:28](/home/bwales/projects/orbit-app/src/components/orrery/OrrerySystemSelector.tsx:28), [orrery-controls-logic.ts:7](/home/bwales/projects/orbit-app/src/components/orrery/orrery-controls-logic.ts:7)
- Icon-and-text severity meets the dossier’s non-color-only rule. [30-UI-SPEC.md:84](/home/bwales/projects/orbit-app/.planning/phases/30-orrery-systems/30-UI-SPEC.md:84)

Concerns:

- MEDIUM — “bounded COUNT” conflicts with the stated custom path: custom/Gravity counts resolve full member ID sets. [30-05-PLAN.md:132](/home/bwales/projects/orbit-app/.planning/phases/30-orrery-systems/30-05-PLAN.md:132) Gravity itself iterates every candidate. [dashboard-gravity-filter.ts:30](/home/bwales/projects/orbit-app/src/logic/dashboard-gravity-filter.ts:30) Opening a switcher with many custom Systems can therefore trigger N full resolutions.

Suggestions: Specify an asynchronous, revision-keyed count cache with progressive row updates; batch non-Gravity SQL counts; defer/cancel work when the selector closes.

Risk: MEDIUM.

### 30-06 — Management

Summary: Route sequencing and active-delete persistence are now sound.

Strengths:

- Both stacks are independent native navigators, so registering the builder and management routes in both is necessary. [OrreryStack.tsx:30](/home/bwales/projects/orbit-app/src/navigation/tabs/OrreryStack.tsx:30), [SettingsStack.tsx:30](/home/bwales/projects/orbit-app/src/navigation/tabs/SettingsStack.tsx:30)
- The preferences store persists `lastSystem` through the application settings writer. [orrery-preferences-store.ts:47](/home/bwales/projects/orbit-app/src/stores/orrery-preferences-store.ts:47)

Concerns:

- LOW — the plan’s `<objective>` block is not closed before `<execution_context>`. [30-06-PLAN.md:55](/home/bwales/projects/orbit-app/.planning/phases/30-orrery-systems/30-06-PLAN.md:55) This may not break execution, but it makes structured-plan tooling less reliable.

Suggestions: Close `</objective>` before the execution context.

Risk: LOW.

### 30-07 — Manage Members

Summary: Local-photo handling and virtualized-grid intent are good, but the picker-logic reuse is currently type-incompatible.

Strengths:

- It correctly rejects use of `photoThumbUri`, which is explicitly ephemeral rather than a durable Orbit photo path. [contact-picker-source.ts:14](/home/bwales/projects/orbit-app/src/logic/contact-picker-source.ts:14)
- The lifecycle rule correctly retains archived manual inclusions but does not render them as members. [phase-09-orrery-systems-dossier.md:126](/home/bwales/projects/orbit-app/docs/dossier/milestone-2/phase-09-orrery-systems-dossier.md:126)

Concerns:

- HIGH — `filterRows`/`matchesQuery` accept `ContactPickerRow`, which requires `lookupKey`, `displayName`, `primaryMethod`, and `photoThumbUri`. [contact-picker-selection.ts:17](/home/bwales/projects/orbit-app/src/logic/contact-picker-selection.ts:17), [contact-picker-source.ts:10](/home/bwales/projects/orbit-app/src/logic/contact-picker-source.ts:10) The plan instead defines `SystemMemberRow` as `{id, name, photo, searchMethods}` while also saying it will pass those rows to picker logic. [30-07-PLAN.md:131](/home/bwales/projects/orbit-app/.planning/phases/30-orrery-systems/30-07-PLAN.md:131) That does not type-check or faithfully reuse the logic.
- HIGH — it depends on `candidateIds`, which Plan 02 does not expose. [30-07-PLAN.md:156](/home/bwales/projects/orbit-app/.planning/phases/30-orrery-systems/30-07-PLAN.md:156)

Suggestions: Define an explicit adapter from `SystemMemberRow` to `ContactPickerRow` for search/selection only, preserving the local `photo` separately; add `candidateIds` to the resolver contract.

Risk: HIGH.

### 30-08 — Builder

Summary: Atomic save and dual-stack routing are correctly covered, but the floating-HUD mechanism is not compatible with the current stack architecture as written.

Strengths:

- Calling a single DAO composite after edits is necessary under the explicitly non-reentrant transaction primitive. [transaction.ts:19](/home/bwales/projects/orbit-app/src/db/transaction.ts:19)
- The plan correctly avoids switching a newly-created System before the write commits.

Concerns:

- HIGH — the plan describes a HUD over the “production Orrery behind” the builder, but `SystemBuilder` is planned as a normal screen in native stacks. Existing Orrery rendering exists only inside `OrreryScreen`. [OrreryScreen.tsx:799](/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:799), [OrreryStack.tsx:42](/home/bwales/projects/orbit-app/src/navigation/tabs/OrreryStack.tsx:42) Navigating to a standard new stack screen does not leave that screen as an accessible/inert background. The plan must choose a transparent/modal presentation with a retained Orrery route, or make the builder explicitly own a background scene/canvas.
- HIGH — it needs the unresolved pre-override candidate IDs for the embedded member grid. [30-08-PLAN.md:165](/home/bwales/projects/orbit-app/.planning/phases/30-orrery-systems/30-08-PLAN.md:165)

Suggestions: Specify the route presentation and ownership of the behind-HUD canvas; complete the resolver/grid contract before execution.

Risk: HIGH.

### 30-09 — Preview

Summary: Correctly identifies that member IDs alone are insufficient, but no upstream plan supplies the required scene inputs.

Strengths:

- Reusing the scene derivation is right: the real scene uses ordered contacts, derived Gravity, preferences, sun identity, and world derivation. [orrery-scene.ts:57](/home/bwales/projects/orbit-app/src/services/orrery-scene.ts:57), [orrery-scene.ts:75](/home/bwales/projects/orbit-app/src/services/orrery-scene.ts:75)
- Lifecycle gating follows the existing unmount-to-stop-clock contract. [OrreryCanvas.tsx:2](/home/bwales/projects/orbit-app/src/components/orrery/OrreryCanvas.tsx:2)

Concerns:

- HIGH — no planned API produces provisional scene records. The resolver returns IDs, not contact records/impact inputs/sun/profile/settings. [30-02-PLAN.md:165](/home/bwales/projects/orbit-app/.planning/phases/30-orrery-systems/30-02-PLAN.md:165) The member read proposed in Plan 07 only carries ID, name, photo, and search data. [30-07-PLAN.md:131](/home/bwales/projects/orbit-app/.planning/phases/30-orrery-systems/30-07-PLAN.md:131) That cannot feed the real scene derivation, which needs impact inputs and settings. [orrery-scene.ts:69](/home/bwales/projects/orbit-app/src/services/orrery-scene.ts:69)

Suggestions: Add a `readProvisionalOrreryScene(exec, memberIds)` read/service seam that batches complete member records, impact inputs, settings, profile, and sun identity, then invokes the shared world derivation.

Risk: HIGH.

### 30-10 — Switch experience

Summary: The renderer ownership, stale-custom fallback, and loading-edge stash address prior risks; Home framing and broken-canvas state remain underspecified.

Strengths:

- The loading-edge stash design matches the store: a new different System clears the snapshot during loading. [orrery-system-store.ts:89](/home/bwales/projects/orbit-app/src/stores/orrery-system-store.ts:89)
- The plan correctly replaces the existing unconditional focus clear. [OrreryScreen.tsx:281](/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:281)
- `OrreryWorld` is the correct renderer owner and already retains exiting resources across scene changes. [OrreryWorld.tsx:116](/home/bwales/projects/orbit-app/src/components/orrery/OrreryWorld.tsx:116)

Concerns:

- MEDIUM — sending the camera directly to `HOME_CAMERA` is not the current canonical Home framing. The current implementation calculates Home from the destination world and viewport via `deriveHomePose`. [OrreryScreen.tsx:711](/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:711) Directly assigning `HOME_CAMERA` risks failing fit/readability for different System sizes.
- MEDIUM — active broken-state UI is only called a device backstop; no plan carries `brokenRules` from the resolver into `OrreryMembersResult`/scene snapshot. The current snapshot carries only result members/status. [orrery-system-read.ts:47](/home/bwales/projects/orbit-app/src/db/orrery-system-read.ts:47) The active-canvas needs-attention state therefore has no proposed data path.

Suggestions: Define Home as `deriveHomePose(destination.world, viewport)` while clearing prior camera state; add `brokenRules` or a `systemHealth` signal to the snapshot and render it deliberately.

Risk: MEDIUM.

The phase should not execute until the resolver → member-grid → builder → preview data contracts are repaired.

## Claude Review (Cycle 2)

*Run as a read-only orchestrator subagent (see Lane provenance above), not `claude -p`. Independent Claude (Opus), code-verified: every load-bearing plan claim checked against the file on disk.*

# Cross-AI Plan Review — Phase 30 (Orrery Systems), CYCLE 2

**Scope discipline:** judged only whether concerns REMAIN against the *current* plans (post-`a6f4d02`); cycle-1 findings the replan incorporated or deferred in a PLAN.md are not recounted.

## Baseline re-verified on disk (this cycle)
- `TARGET_VERSION = 21` (`src/db/database.ts:56`); migration head is `021-orrery-preferences.ts`. Next migration is **022** — every plan's number is correct.
- `BACKUP_FORMAT_VERSION = 4` (`src/backup/types.ts:14`) — plan 04's pin target is right.
- `transaction.ts:12-13,47` documents the non-reentrant mutex — plans 03/08's atomicity rationale is real.
- `useReducedMotionShared()` (`src/theme/use-reduced-motion.ts:106`) and `useReducedMotion()` (`:125`) exist — plan 10's D-09 disk-correction holds.
- `OrrerySystemRef` union is `builtin | category` (`src/logic/orrery-system-logic.ts:24-26`) — extension target correct.
- `contact-picker-source.ts:16` — "Ephemeral external thumbnail URI; never a durable photo-storage path" — plan 07's photo claim verified verbatim.

**Every cycle-1 HIGH is genuinely incorporated into the current plans**, and each fix's disk premise re-verified. Only one cosmetic mis-citation found.

## 30-01 — Persistence foundation + thin vertical slice
**Strengths.** The two cycle-1 traps are fixed with the exact disk mechanism: `readOrrerySystemMembersCore` calls `buildOrrerySystemWhere(system)` **unconditionally at `orrery-system-read.ts:58`**, and `buildOrrerySystemWhere` (`orrery-system-logic.ts:73-115`) has a `switch (system.id)` with **no `default`** (implicit `undefined` return). Plan 01 mandates an early custom branch before line 58 and a `custom` throw-guard. `missing-category`/`MissingOrreryCategoryError` (`orrery-system-read.ts:48,167`) is the real template the `missing-custom` result parallels. Cross-catalog uniqueness correctly reasoned as un-expressible in one SQLite index and pushed into a DAO check.
**Concerns.** None ≥ MEDIUM. Cycle-1 Claude MEDIUM (routing order + guard), Codex HIGH (uniqueness), Codex MEDIUM (exclusion subtraction) all **RESOLVED**. **Risk: LOW.**

## 30-02 — Rule resolver
**Strengths.** Candidate `ORDER BY COALESCE(c.ring_seq,1e9),c.created_at,c.id` matches `readOrrerySystemMembersCore`'s live ordering (`orrery-system-read.ts:71`). `resolveMembershipFromDefinition(draft)` cleanly resolves the cycle-1 draft-count HIGH. Gravity-as-post-query with injected loader matches `filterByGravity(candidateIds, tiers, loadInputs, now)` (`dashboard-gravity-filter.ts:19-22`).
**Concerns.**
- **LOW — NEW — cosmetic mis-citation.** Task 2 `read_first` says `readOrreryImpactInputsCore` is at "`orrery-system-read.ts` lines 108-112". It is **defined** in `src/db/orrery-impact-read.ts:23` and merely *invoked* at `orrery-system-read.ts:109`.
- **LOW — NEW — layering direction.** If the resolver imports `readOrreryImpactInputsCore` directly from `orrery-impact-read.ts`, it inverts the injected-loader convention (`dashboard-gravity-filter.ts` takes a loader). Not circular, functional — but injecting keeps the logic layer db-free.
**Risk: LOW.** Cycle-1 concerns (ordering, `ruleUid`, empty-`sql` guard, draft engine, `scope:population`) all **RESOLVED**.

## 30-03 — Full Systems DAO
**Strengths.** `saveSystemDefinitionCore` composes only non-mutexed `…Core` helpers inside **one** `inWriteTransaction`, never nesting public wrappers — answers the atomicity HIGH; grounded in `transaction.ts:12-13`. `restoreDeletedSystem` preserves the original `uid` and re-inserts rules against the *new* row id — fixes the undo-remapping HIGH; portable `DeletedSystemSnapshot` avoids replaying stale `system_id`. All-Contacts → single `scope:population` rule. DAO-only-writer enforced by a grep gate.
**Concerns.** None ≥ MEDIUM. Cycle-1 HIGHs (atomicity, All-Contacts, undo, prune owner) + MEDIUMs (override replacement, catalog validation) all **RESOLVED**. **Risk: LOW.**

## 30-04 — Backup contract (declare-only)
**Strengths.** The backstop must-have now names the **real** fallback chain (plan-01 `missing-custom` → plan-10 launch fallback) instead of the cycle-1 phantom pre-existing fallback. Pin target corrected to `types.ts:14` (= 4); export-manifest left untouched.
**Concerns.** None ≥ MEDIUM. Cycle-1 HIGH + LOWs **RESOLVED**. **Risk: LOW.**

## 30-05 — Switcher
**Strengths.** The data-flow HIGH is answered with the verified fact: selector today takes only `{state, availableHeight, enabled}` (`OrrerySystemSelector.tsx:30-35`) and calls `buildSystemChoices(state.categories)` (`:50`). Plan 05 adds a `catalog` prop, names OrreryScreen owner. Bounded, dropdown-open, revision-cached counts incorporated.
**Concerns.**
- **LOW — NEW — count cost real but only deferred.** `countSystemMembers` for a custom/gravity System runs a candidate SELECT + a per-System `readOrreryImpactInputsCore` batch; many gravity Systems → non-trivial at dropdown-open. Record the caching key + a cap strategy in the SUMMARY rather than discovering cost on-device.
**Risk: LOW–MEDIUM.**

## 30-06 — Systems Management + routes
**Strengths.** Settings-stack reachability HIGH resolved structurally: `OrreryStack.tsx`/`SettingsStack.tsx` are confirmed separate navigators; plan 06 now `depends_on:[30-03,30-08]` (wave 5, after builder wave 4) so Create/Edit navigate to a live `SystemBuilder` route in **both** stacks — no dead TODO seam. Active-System delete now **persists** `orrery_last_system = builtin:all-contacts`.
**Concerns.** None ≥ MEDIUM. Cycle-1 HIGHs/MEDIUM **RESOLVED**. **Risk: LOW.**

## 30-07 — Manage Members grid
**Strengths.** Local-photo fix grounded in `contact-picker-source.ts:16`; `systems-members-read` returns durable `c.photo` with a test asserting ≠ external thumb URI. Override intent emits `{contactId, mode|null}` deltas keyed to the single replacement op.
**Concerns.** None ≥ MEDIUM raised in this lane. Both cycle-1 MEDIUMs **RESOLVED**. (See Codex Cycle-2 for the `ContactPickerRow` adapter and `candidateIds` gaps — orchestrator-verified real.) **Risk: LOW.**

## 30-08 — Builder HUD
**Strengths.** Draft live-count + save-atomicity HIGHs answered with plan-02/03 primitives; Task 3 tests assert `saveSystemDefinition` once and `store.select` only after commit (not at all on forced failure). Whole-canvas inert via a shell transient. Edit-non-active `goBack()`s rather than depending on the later `SystemsManagement` route.
**Concerns.** None ≥ MEDIUM raised in this lane. (See Codex Cycle-2 for the HUD-over-opaque-route presentation gap and the `candidateIds` dependency — orchestrator-verified real.) **Risk: LOW–MEDIUM.**

## 30-09 — Full-canvas Preview
**Strengths.** Member-ids-insufficient MEDIUM answered by consuming a shared `orrery-scene` derivation. Preview owns its own `SystemPreviewCanvas`, needing no OrreryWorld edit. Lifecycle-pause MEDIUM answered by mirroring `OrreryCanvas`'s unmount-while-unfocused; worklet forward-ref hazard cited.
**Concerns.**
- **LOW — NEW — "shared provisional entry point" asserted, not located.** Task 1 requires *exposing* a provisional entry point of `orrery-scene.ts` but doesn't name the exact current derivation function to factor out (acceptance grep is a guess-set `orrery-scene|generateScene|deriveScene`). Pin the real exported symbol. (See Codex Cycle-2 for the deeper provisional-scene INPUT-sourcing HIGH.)
**Risk: LOW–MEDIUM.**

## 30-10 — System-switch experience
**Strengths (all disk-verified).** Focus-clear: `OrreryScreen.tsx:283-288` is the requested-id effect calling `setFocusTargets([])` at **line 285**; plan replaces (not supplements) it and reconciles the `:641-648` re-validation, leaving the eight other event-specific clears untouched. Delta source-ids: store sets `snapshot: same ? before.snapshot : null` during loading (`orrery-system-store.ts:92-93`) — on a real switch `same` is false → snapshot→null, the exact trap the stash-at-loading design avoids. Renderer scope: OrreryWorld now in `files_modified`; verified it receives `scene/pose/…/focusedIds/satellites` (`OrreryWorld.tsx:191-224`) with **no** transition/intensity prop and reads `useReducedMotionShared()` at `:228`, rendered at `OrreryScreen.tsx:800`. Startup fallback: `loadOrreryScene` throws `MissingOrreryCategoryError` (`orrery-scene.ts:58-59`), store catch special-cases it (`orrery-system-store.ts:115-121`); the parallel missing-custom throw + silent All-Contacts re-select is a coherent extension.
**Concerns.**
- **MEDIUM — NEW — Task 3's transition contract duplicates OrreryWorld's existing generation-keyed world-transition pipeline, unreconciled.** OrreryWorld already sheds/captures on every scene-generation change: `beginWorldTransition(from, world, generation)` (`orrery-frame.ts:39-72`) computes leaving bodies (in `from`, not `world` → end `opacity:0`, `radius*0.75`, `interactive:false`) and entering bodies (→ start `opacity:0`, grow to `1`); `sampleWorldTransition` (`:74-93`) interpolates; OrreryWorld drives it via `mergeResources`/`pruneResources`/`projectAnimatedFrame` (`OrreryWorld.tsx:245,259,278,292`). A System switch already produces a new generation → this exact shed/capture. Plan 10 Task 3 proposes a **separate** entering/leaving member-id-set prop consumed by the per-body draw — re-deriving what `beginWorldTransition` already tracks. An executor could build a parallel transition that double-animates opacity/radius or fights the sampled frame; a device-UAT `backstop`, so `npm test` won't catch it. What ORRS-13 genuinely adds is (a) the membership-delta **intensity** SharedValue and (b) a per-body **spin** — both should *modulate* the existing `orrery-frame` transition, not stand beside it. *Fix:* rewrite Task 3 to integrate with (scale/extend) `beginWorldTransition`/`sampleWorldTransition`, pass only the intensity SharedValue + spin, drop the redundant id-set prop; add `orrery-frame.ts` to read_first.
- **LOW — NEW — re-entrant silent re-select.** The missing-category branch sets a terminal `status:"missing-category"` (`orrery-system-store.ts:117`); plan 10's missing-custom branch instead re-enters `select(ALL_CONTACTS_SYSTEM)` from inside a `select()` catch — re-entrant, minting a new generation while unwinding the failed one. Almost certainly fine, but note the generation/`same`-guard interaction so no select loop forms.
- Cycle-1: renderer scope HIGH **RESOLVED** (OrreryWorld in scope) but see the NEW MEDIUM about *how*; focus-clear **RESOLVED**; delta source-ids **RESOLVED**; startup fallback **RESOLVED**.
**Risk: MEDIUM** — residual risk still concentrates here, now as one device-only integration concern.

## Cross-plan observations (Claude, Cycle 2)
1. **Wave/dependency graph coherent.** W1: 01 · W2: 02,03,04 · W3: 07,10 · W4: 08 · W5: 06,09 · W6: 05. Shared-file edits are sequential: `navigation/*`+stacks (08 W4 → 06 W5), `orrery-scene.ts` (10 W3 → 09 W5), `OrreryScreen.tsx` (10 W3 → 05 W6), `SystemBuilderScreen.tsx` (08 W4 → 09 W5). No within-wave clobber. Note that 06 and 08 both edit all three nav files — safe only because 08 (W4) precedes 06 (W5).
2. **Decision integrity — no reversals.** D-05, D-06, D-07, E-02 all held; no ADR/HANDOFF entry deleted/weakened/inverted; `custom_field_*`/`sortExpr()`/`field_history` untouched (this phase adds `system_*` tables only).
3. **Hazard sweep clean where in scope:** local-first preserved; theme-token rule gated by `npm run check:colors` incl. Skia; `newUid()` Hermes-crypto guard reused; worklet forward-ref cited in 09/10; migration additive/forward-only, no `app_settings` ALTER in 022.

## Claude closing
**Overall phase risk: MEDIUM.** Data layer (01–04) LOW; every cycle-1 HIGH incorporated and disk-verified. This lane found **no unresolved HIGH** — but note it scoped to cycle-1-incorporation + internal consistency and did **not** enumerate the downstream consumer contracts where the Codex lane found new HIGHs (candidateIds, builder presentation, provisional-scene inputs); the orchestrator verified those Codex HIGHs are real (see Cycle-2 Consensus). Claude's actionable items: (1) [MED] 30-10 Task 3 reconcile with `orrery-frame`; (2) [LOW] 30-10 re-entrant re-select note; (3) [LOW] 30-02 citation + loader-injection direction; (4) [LOW] 30-09 pin the exact `orrery-scene` symbol; (5) [LOW] 30-05 record count caching key + cap.
