---
status: awaiting_human_verify
trigger: "Fix the post-Wave-1 integration regressions in /home/bwales/projects/orbit-app: (1) src/db/migrations/full-chain.test.ts expects migration 013/TARGET_VERSION 13; (2) src/backup/phase-17-integration.test.ts deletion policy must cover new reconciliation_session_cards behavior appropriately; (3) src/db/lifecycle-consumer-ledger.test.ts must map the new nullable cadence consumer in src/db/merge-dao.ts following existing ledger conventions and required supporting docs if the test mandates it."
created: 2026-08-30T20:23:55-05:00
updated: 2026-08-30T20:28:30-05:00
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

bug_class: bohrbug
hypothesis: The Plan 20-01 change set registered migration 013, added merge-time reconciliation_session_cards cleanup, and read nullable interval_days without extending three independent integration contracts and their required ledger documentation.
test: Apply the smallest additive assertions/policy/ledger entries, then rerun the original test command and adjacent migration/merge tests.
expecting: The tests pass while retaining strict checks for version 13, explicit card-lifecycle policy, and merge-dao's nullable cadence read.
next_action: Await parent/user confirmation that the focused test and type-check verification is sufficient; the implementation changes are committed separately at the parent's request.
reasoning_checkpoint:
  hypothesis: "Plan 20-01 causes the three deterministic regressions because its migration/merge additions were not mirrored in the version-chain assertion, hard-delete policy, and nullable-cadence owner ledger."
  confirming_evidence:
    - "src/db/database.ts registers migration013 and exports TARGET_VERSION = 13, while full-chain.test.ts directly asserts 12."
    - "merge-dao.ts explicitly deletes reconciliation_session_cards before deleting an absorbed contact; phase-17-integration.test.ts reports that table has neither a tombstone nor an explicit non-mergeable policy."
    - "merge-dao.ts selects contacts.interval_days as a nullable field; lifecycle-consumer-ledger.test.ts directly reports src/db/merge-dao.ts as unmapped and requires the companion validation document to mirror the entry."
  falsification_test: "If migration 013 were not registered, merge-dao did not delete cards, or merge-dao did not reference interval_days, the respective direct test failure and source inspection would contradict this hypothesis."
  fix_rationale: "Updating the stale expected version, documenting the intentionally non-mergeable child-card deletion behavior, and mapping the nullable snapshot consumer restores the exact contracts without weakening their coverage."
  blind_spots: "This is a contract-maintenance fix; it does not exercise every future reconciliation-card state or independently prove all merge semantics beyond the existing merge-dao tests."
  candidate_causes:
    - "code: the three contract tests/ledger were omitted from the Plan 20-01 implementation change set."
    - "config: a migration registry mismatch could have made version 13 unavailable, but database.ts and the runtime failure prove migration013 is registered."
    - "environment: a Node/Vitest or SQLite version difference could have produced a spurious failure, but all failures are direct deterministic assertion mismatches."
    - "data: fixture shape could have exposed an unexpected deletion, but the failures arise from static source scanning and a literal version assertion."
  and_gate: "no — each failing contract is independently caused by its missing corresponding update; no combination of conditions is required for any individual failure."

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Post-Wave-1 integration tests reflect migration 013/TARGET_VERSION 13, include reconciliation_session_cards in the backup deletion policy, and account for the nullable cadence consumer in the lifecycle ledger.
actual: The three specified integration tests regress after Plan 20-01.
errors: Integration assertions are stale relative to the Wave-1 schema and merge-dao additions.
reproduction: Run the three specified test files using the repository test runner.
started: After Plan 20-01 Wave-1 changes.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-08-30T20:23:55-05:00
  checked: .planning/debug/knowledge-base.md
  found: No semantically related resolution; the only prior entry concerns Android startup readiness.
  implication: Investigate this schema-contract regression from code and tests rather than applying a known-pattern fix.
- timestamp: 2026-08-30T20:28:00-05:00
  checked: Plan 20-01, src/db/database.ts, src/db/migrations/full-chain.test.ts, src/backup/phase-17-integration.test.ts, src/db/lifecycle-consumer-ledger.test.ts, and src/db/merge-dao.ts
  found: Plan 20-01 requires registering migration 013 and TARGET_VERSION 13, explicit in-transaction deletion of reconciliation_session_cards during merge, and a nullable interval_days read in merge-dao's full contact snapshot. The tests still assert version 12 or lack corresponding policy/ledger entries.
  implication: The likely root cause is incomplete cross-cutting test/documentation contract maintenance after an additive schema and DAO change.
- timestamp: 2026-08-30T20:30:00-05:00
  checked: `npx vitest run src/db/migrations/full-chain.test.ts src/backup/phase-17-integration.test.ts src/db/lifecycle-consumer-ledger.test.ts`
  found: All three named tests fail deterministically: TARGET_VERSION is 13 rather than 12; reconciliation_session_cards lacks a deletion-policy classification; and src/db/merge-dao.ts is an unmapped interval_days consumer.
  implication: The hypothesis is confirmed with direct observations; the source implementation is present and the three integration contracts are stale.
- timestamp: 2026-08-30T20:28:00-05:00
  checked: Revert-and-reconfirm of only the three changed test hunks
  found: Reverting the hunks restored all original three failures; reapplying them made the original tests and the adjacent migration-013/merge/reconciliation tests pass.
  implication: The minimal contract updates, rather than an environmental change, resolve the regressions.
- timestamp: 2026-08-30T20:28:30-05:00
  checked: `npx tsc --noEmit`, `git diff --check`, and `npx biome check` on the changed TypeScript tests
  found: TypeScript and diff whitespace checks pass. Biome reports pre-existing whole-file formatting/import-order issues in phase-17-integration.test.ts and lifecycle-consumer-ledger.test.ts outside these additive hunks; no automated formatting was applied to avoid unrelated file-wide churn.
  implication: The patch is type-safe and whitespace-clean; formatting debt is unrelated to this regression fix.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "Plan 20-01 added migration 013, explicit reconciliation_session_cards deletion, and a nullable interval_days merge snapshot without updating the migration-chain expectation, backup deletion-policy contract, and nullable-cadence consumer ledger/validation table."
fix: "Updated the migration-chain test for migration 013/TARGET_VERSION 13, classified reconciliation_session_cards as explicitly non-mergeable device-local reconciliation workflow state, and recorded merge-dao's nullable-cadence snapshot in the enforced ledger and companion validation table."
verification:
  target_test: { result: pass, suites_run: ["src/db/migrations/full-chain.test.ts", "src/backup/phase-17-integration.test.ts", "src/db/lifecycle-consumer-ledger.test.ts"], tests: 15 }
  mutation_check: { result: skipped, reason_if_skipped: "No Stryker dependency, script, or configuration is present in package.json/repository." }
  no_op_deletion: { result: pass, deletion_justified_by_rca: false, evidence: "Diff is additive: migration-013 assertion, explicit deletion policy, owner ledger entry, and companion table row. No behavior or assertion was weakened." }
  adjacent_tests: { result: pass, suites_run: ["src/db/migrations/013-reconciliation-and-merge.test.ts", "src/db/merge-dao.test.ts", "src/backup/reconciliation.test.ts"], tests: 13 }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  typecheck: { result: pass, command: "npx tsc --noEmit" }
  formatting: { result: skipped, reason: "Biome reports pre-existing whole-file issues outside changed hunks; no file-wide reformat applied." }
  guardrail_verdict: accepted
oracle_type: specified
files_changed:
  - src/db/migrations/full-chain.test.ts
  - src/backup/phase-17-integration.test.ts
  - src/db/lifecycle-consumer-ledger.test.ts
  - .planning/phases/18.2-bound-unbound-lifecycle/18.2-VALIDATION.md
