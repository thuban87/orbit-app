---
phase: 30
reviewers: [codex, claude]
reviewed_at: 2026-09-08T11:44:25Z
plans_reviewed: [30-01-PLAN.md, 30-02-PLAN.md, 30-03-PLAN.md, 30-04-PLAN.md, 30-05-PLAN.md, 30-06-PLAN.md, 30-07-PLAN.md, 30-08-PLAN.md, 30-09-PLAN.md, 30-10-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-opus (read-only subagent lane)"
model_sources:
  codex: "banner"
  claude: "orchestrator-subagent"
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
