---
status: awaiting_human_verify
trigger: "Release-device Replace-all confirmation expires the validated preview instead of applying the restore."
created: "2026-08-26"
updated: "2026-08-26"
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-02
  status: awaiting_human_verify
---

# Debug Session: Replace preview expiry

## Symptoms

- Expected: confirming Replace and restore from a valid preview creates/verifies the configured safety snapshot, applies the restore, and opens RestoreResult with aggregate totals.
- Actual: the physical Pixel release build returns to `Preview expired — Choose the backup file again to preview it safely.` after confirmation.
- Errors: no crash or FATAL was found in immediate device log capture.
- Timeline: first observed during Plan 17-11 release-device UAT; reproducible after reopening the confirmation.
- Reproduction: select a valid readable automatic backup, choose Replace all, accept the configured-destination confirmation, then confirm Replace and restore.

## Current Focus

- bug_class: bohrbug
- hypothesis: The confirmation/apply path invalidates or consumes the process-local validated-preview cache before the apply callback reads it.

reasoning_checkpoint:
  hypothesis: "The Replace-all path re-reads the opaque cache token only after asynchronous destination lookup and native confirmation, so a cache lifecycle loss during that wait yields Preview expired despite the candidate having already passed validation."
  confirming_evidence:

    - "The reported screen was initially a valid preview and its route token does not change; source maps the later Preview expired state directly to a null cache read."
    - "The new agent-authored test deterministically returns `{ status: 'expired' }` when the cache is invalidated during confirmation, reproducing the exact observed state."
    - "The database executor is a stable cached connection; getAppSettings only reads settings and cannot delete preview-cache entries."
  falsification_test: "If capturing the candidate before the asynchronous handoff still returns Preview expired in the new test, or if the original late read is not reached on the reported sequence, this hypothesis is false."
  fix_rationale: "Capture the already validated candidate before awaiting any Replace-all preflight or confirmation, then apply that captured candidate; a later cache eviction cannot invalidate a preview that the current route has already safely established."
  blind_spots: "The exact Android lifecycle event that makes the process-local Map unavailable was not observable without prohibited device UAT, but the code must tolerate that observable cache-loss boundary."
  candidate_causes:

    - "code: delayed cache reread after asynchronous confirmation"
    - "config: changing backup destination affects snapshot availability but selects apply recovery, not Preview expired"
    - "environment: native confirmation may expose a JS/module lifecycle boundary"
    - "data: invalid manifest is excluded by the successfully rendered validated preview"
  and_gate: "no — delayed reread is sufficient to produce the failure; configuration/environment may expose it but are not required causes."

- hypothesis: Confirmed fix captures the validated candidate before any Replace-all asynchronous preflight or confirmation and applies that candidate after the user accepts.
- test: Automated verification is complete; await the parent workflow's decision on any user-environment verification because this delegated task explicitly prohibits release-device UAT.
- expecting: The parent can present the resulting device check separately if required; no further local code action is needed.
- next_action: Do not invoke a device build, APK install, or physical UAT. Report the accepted guardrail and changed files to the parent agent.

## Evidence

- timestamp: "2026-08-26"
  source: physical Pixel 6 Pro release UAT
  observation: Reproduced preview expiry after valid Replace-all confirmation; no immediate crash/FATAL.

- timestamp: "2026-08-26"
  source: local investigation
  observation: No debug knowledge base exists; the repository has a Vitest suite and the symptom's RestorePreviewScreen and backup restore code are present locally.
  implication: No known-resolution candidate applies; this is a deterministic Bohrbug, so source tracing and a focused Vitest reproduction are appropriate.

- timestamp: "2026-08-26"
  source: src/screens/RestorePreviewScreen.tsx
  observation: Confirmation merely toggles component state and awaits Alert; apply then reads the original route token. The screen only discards that token after a successful apply.
  implication: No intentional token discard occurs in the visible confirmation callback, so the next inspection must determine whether the cache itself loses valid entries across an await or a screen remount.

- timestamp: "2026-08-26"
  source: src/screens/backup-restore-logic.ts and BackupScreen.tsx
  observation: The route contains only an opaque token plus aggregate preview; the manifest is held in a module-scoped Map, and only a successful apply calls discard. Existing cache tests cover store/read and a missing cold-start token, but no confirm→apply lifecycle.
  implication: The symptom can only arise when the module-scoped Map is unavailable (process/JS reload) or when the same token resolves against a different module instance; ordinary confirmation state changes do not delete the entry.

- timestamp: "2026-08-26"
  source: SBFL eligibility check
  observation: A Vitest suite exists, but no current failing automated test is available for this physical-UAT defect.
  implication: Spectrum-based fault localization is skipped; a focused, agent-authored regression test must first reproduce the lifecycle defect.

- timestamp: "2026-08-26"
  source: focused baseline and git history
  observation: `backup-restore-logic.test.ts` passes 8/8. Commit 3301e2b added an asynchronous `getAppSettings` lookup immediately before the native replace confirmation, while RestorePreviewScreen still waits until after confirmation to read the cache for apply.
  implication: Existing tests miss the async confirmation handoff; the defect is in code, not an invalid manifest or the configured-destination branch.

- timestamp: "2026-08-26"
  source: source control flow
  observation: `Preview expired` is only rendered when `restorePreviewCache.read(route.params.token)` is null: at initial mount, a token-change effect, or the late apply lookup. In the reported sequence initial mount was valid and the route token is unchanged.
  implication: The observed post-confirmation transition directly localizes to the late apply lookup; neither snapshot failure nor backup-data validation can select this UI state.

- timestamp: "2026-08-26"
  source: red regression test
  observation: `keeps a validated preview available while Replace-all awaits its confirmation` fails deterministically: after cache eviction during the await, `confirmReplaceAllRestore` returns `{ status: 'expired' }` instead of the validated candidate.
  implication: The hypothesis is confirmed. The test's oracle is specified: a preview already validated for the current restore route remains the candidate for that user-confirmed operation.

- timestamp: "2026-08-26"
  source: automated verification
  observation: Full Vitest passed 126 files / 1460 tests and TypeScript completed with no diagnostics. Controlled revert of the early cache capture made the target test fail (including its already-expired boundary); restoring the hunk returned the target suite to 11/11 passing.
  implication: The fix is causally linked to the reported failure. Mutation testing is unavailable because no Stryker configuration exists.

## Eliminated

- hypothesis: Native Android confirmation tap failed to reach the app
  reason: The app transitioned deterministically to its own Preview expired recovery state after confirmation.

## Resolution

- root_cause: "Replace-all re-read its process-local validated-preview cache only after asynchronous preflight/confirmation; a cache loss during that wait produced the Preview expired recovery state instead of applying the candidate already validated for the active route."
- fix: "Added confirmReplaceAllRestore, which reads the validated cache candidate before async destination/confirmation work; RestorePreviewScreen applies that captured candidate, and regression coverage exercises cache loss during confirmation plus expired and cancelled boundaries."
- oracle_type: "specified — the active route's fully validated preview must remain the restore candidate for a user-confirmed Replace-all operation."
- verification: "target_test: pass (11/11 focused tests); adjacent_tests: pass (full Vitest 126 files / 1460 tests); typecheck: pass (`npx tsc --noEmit`); biome_lint: pass (three changed files); mutation_check: skipped (no Stryker configuration); no_op_deletion: pass (diff is additive capture/handoff logic with no removed behavior); revert_and_reconfirm: pass (controlled delayed-read revert failed 2 regression assertions; early capture reapplied and focused suite passed); guardrail_verdict: accepted."
- files_changed: "src/screens/backup-restore-logic.ts, src/screens/RestorePreviewScreen.tsx, src/screens/backup-restore-logic.test.ts"
