---
status: awaiting_human_verify
trigger: "Fixed release Replace-all reaches restore apply but returns the generic safe failure instead of RestoreResult."
created: "2026-08-26"
updated: "2026-08-26"
---

# Debug Session: Replace apply failure

## Symptoms

- Expected: confirming Replace and restore from a valid automatic-backup preview should show non-dismissable applying progress, then RestoreResult totals and the configured-destination safety-snapshot disclosure.
- Actual: after the fixed preview-cache release APK is installed, confirmation returns to RestorePreview with `Couldn't restore this backup. Your local data hasn't changed. Please try again.`
- Errors: no crash or FATAL in immediate device log capture.
- Timeline: observed immediately after the prior Preview expired fix; the same valid automatic backup and configured-destination flow reached this later boundary.
- Reproduction: open valid automatic-backup preview, choose Replace all, accept the configured-destination confirmation, then confirm Replace and restore.

## Current Focus

- bug_class: bohrbug at the UI/result mapping boundary; the underlying snapshot failure remains unclassified without a redacted native/export stage signal.
- hypothesis: `writeVerifiedSnapshot` caught source-export, encryption/passphrase, SAF create/write/read-back, and retention failures without an observable boundary; the approved diagnostic now logs a fixed stage code while retaining the existing safe result behavior.
- test: Local tests assert the exact fixed stage code for representative export, encryption, passphrase, SAF, and retention failures, then a device reproduction will identify the actual failed prerequisite.
- expecting: The next configured-destination Replace-all reproduction will emit one of the redacted `pre-restore-snapshot:*` codes below, without paths, URI/content data, passphrases, keys, filenames, or raw native error text.
- reasoning_checkpoint:
  hypothesis: "A single unclassified catch causes the generic restore recovery because it discards the failing prerequisite; a fixed stage code at each operation boundary restores diagnostic observability without changing snapshot behavior."
  confirming_evidence:
    - "Source trace shows `writeVerifiedSnapshot()` catches exceptions from export, encryption, SAF create/write/read-back, and retention and returns only `{ status: 'failed' }`."
    - "The observed Restore Preview recovery maps this generic status to the same user-facing failure message for every thrown prerequisite."
  falsification_test: "If the snapshot service already emits distinct redacted stage codes, or if a representative dependency failure cannot be associated with exactly one fixed stage before the catch, this diagnostic design is insufficient."
  fix_rationale: "Wrapping each prerequisite in a stage marker preserves the existing failure result and safety behavior while revealing which boundary rejected during an approved device reproduction."
  blind_spots: "The actual device failure stage and any platform-native exception details cannot be observed without the later user reproduction; this change intentionally does not identify its root cause."
  candidate_causes:
    - "code: one broad catch discards the operation boundary that failed."
    - "config: the persisted SAF grant may be unable to create/write/read a new snapshot."
    - "data: a current local photo reference may be unreadable during export."
    - "environment: SecureStore or native filesystem behavior may reject passphrase/encryption or SAF work."
  and_gate: "no; one failed prerequisite independently produces the generic status."
- diagnostic_strategy:
  - "snapshot-export: export build or portable-manifest validation failed."
  - "encryption: envelope encryption failed or unexpectedly yielded no contents."
  - "passphrase-absent | passphrase-unavailable: encrypted snapshot was fail-closed before export."
  - "saf-create | saf-write | saf-read-back: the native adapter wraps only the corresponding SAF boundary in a redacted error marker; an untagged storage implementation falls back to saf-write."
  - "retention: post-write SAF list/prune failed; the verified snapshot remains written, as before."
  - "unclassified: only an unexpected error outside those operation wrappers."
- logging_contract: "`Logger.diagnostic('backup-snapshot', 'pre-restore-snapshot:<fixed-code>')` is an always-on native error log with exactly the fixed scope and code; it never receives an Error object or any runtime content."
- next_action: parent rebuilds the release APK, obtains user consent, and has the user repeat the configured-destination Replace-all flow while collecting the fixed `pre-restore-snapshot:*` code from device logs; resume investigation from that code.

## Evidence

- timestamp: "2026-08-26"
  source: Pixel 6 Pro release UAT with APK SHA-256 d3d7604c5552a6d03b5c35c51ddb372a37ffdb88b862e995abcad415b04b1ee2
  observation: Confirmed Replace-all passed preview-cache handling but returned the generic pre-commit restore failure; local data remained unchanged.
- timestamp: "2026-08-26"
  source: source trace
  observation: `applyRestore` checks the configured destination before planning or transaction work; Replace-all returns `pre-restore-snapshot-failed` unless `createVerifiedPreRestoreSnapshot()` resolves with status `written`. `RestorePreviewScreen` supplies that callback, and maps the status to the exact observed generic message.
  implication: The observed no-change behavior is expected for an unavailable/failed/busy snapshot; the failure is isolated to snapshot construction or its SAF write/read-back dependency.
- timestamp: "2026-08-26"
  source: focused-test invocation
  observation: Vitest rejected the Jest-only `--runInBand` option before executing any tests.
  implication: This command failure is tooling-only and does not bear on the product hypothesis; rerun without the unsupported flag.
- timestamp: "2026-08-26"
  source: focused Vitest
  observation: `src/backup/restore-apply.test.ts`, `src/services/backup/backup-service.test.ts`, and `src/screens/backup-restore-logic.test.ts` passed (32 tests).
  implication: The dependency-present success and failure-status contracts work under injected test doubles, but no test exercises the actual React Native SAF/SecureStore/photo-export integration.
- timestamp: "2026-08-26"
  source: snapshot and storage implementation trace
  observation: `createPreRestoreSnapshot` passes the same export, SAF, encryption, and passphrase dependencies used by the launch automatic-backup sweep. `createAutomaticBackupService.writeVerifiedSnapshot()` catches every exception from export, encryption, SAF create/write/read-back, and retention operations and reduces it to `{ status: "failed" }`; the RestorePreview screen maps both that status and thrown callback errors to the same generic message.
  implication: The device-visible symptom proves a pre-transaction safety snapshot did not complete, but does not distinguish which prerequisite failed.
- timestamp: "2026-08-26"
  source: exporter and Expo SDK 57 SAF reference
  observation: Current-data export fails closed when any referenced local photo cannot be read; Expo's documented SAF writer requires a newly created SAF file, then write/read operations against that created URI. Both failures are collapsed by the snapshot service.
  implication: A readable selected automatic backup does not establish that the current local dataset is exportable or that the saved folder grant can still create, write, and read a new snapshot.
- timestamp: "2026-08-26"
  source: complete automatic snapshot and SAF adapter trace
  observation: "`createAutomaticBackupService.writeVerifiedSnapshot()` has one outer catch for export/encryption/SAF errors, while `createSafStorage().writeVerified()` performs SAF create, write, and JSON read-back in one method. Retention list/prune errors are separately swallowed after a verified write. `Logger.error` accepts a fixed scope/message without requiring an error object."
  implication: "A safe diagnostic can add fixed stage codes in the service and tag only the SAF adapter's create/write/read-back boundaries; retention can log a fixed code while preserving its existing non-fatal behavior."
- timestamp: "2026-08-26"
  source: first focused Vitest attempt after adding diagnostic tests
  observation: "Vitest loaded React Native's Flow source and stopped before executing tests because the backup service imported the SAF error class from the React-Native-dependent SAF adapter."
  implication: "The redacted SAF stage marker must live in a dependency-free module so service-level diagnostics can be tested without loading the native adapter."
- timestamp: "2026-08-26"
  source: focused diagnostics and adjacent restore tests
  observation: "`backup-service.test.ts` passed 17 tests and the backup-service, restore-apply, restore-logic, and runtime-integration suites passed 39 tests; `tsc --noEmit` passed. The new assertions prove each emitted pre-restore diagnostic has exactly two fixed arguments: `backup-snapshot` and a stage code."
  implication: "The diagnostics preserve snapshot results while preventing the tested export, encryption, SAF, passphrase, and retention failures from logging their thrown content."
- timestamp: "2026-08-26"
  source: diagnostic-site mutation test
  observation: "Changing the emitted code to `unclassified` caused the new focused test to fail with expected-vs-received stage-code assertions; restoring the fixed stage emission returned all four focused suites to 39 passing tests and `tsc --noEmit` to success."
  implication: "The regression assertions are sensitive to the stage-specific diagnostic behavior and reject a generic replacement code."
- timestamp: "2026-08-26"
  source: final local diagnostic validation
  observation: "Biome lint passed for all five changed implementation/test files; focused Biome check passed for the formatted logger, RN-free stage marker, and focused test. `git diff --check` passed. No Android build, ADB command, or device UAT was run."
  implication: "The committed diagnostic is locally type-checked, linted, focused-test verified, and ready only for the parent-controlled device reproduction."

## Eliminated

- hypothesis: The earlier delayed preview-token reread remains the direct failure cause.
  reason: The fixed APK no longer returned Preview expired; it entered the later generic apply-error recovery path.

## Resolution

- root_cause: "Not yet determined. The original generic pre-restore snapshot failure still represents independent export, encryption/passphrase, SAF, retention, or unexpected-failure branches; device reproduction must select the actual branch."
- fix: "Temporary redacted pre-restore snapshot diagnostic. It adds fixed stage markers for source export, encryption/passphrase, SAF create/write/read-back, retention, and an unexpected fallback without changing the snapshot result or restore safety behavior."
- verification: |
    commit: a24bcb5 (debug: add redacted pre-restore snapshot stages)
    target_test: pass — src/services/backup/backup-service.test.ts (17 tests)
    adjacent_tests: pass — backup-service, restore-apply, backup-restore-logic, and phase-17-runtime-integration (39 tests)
    typecheck: pass — tsc --noEmit
    lint: pass — Biome lint on all five changed files; focused Biome check passed where formatting baseline permits
    no_op_deletion: pass — additive stage markers and assertions; no behavior deletion
    mutation_check: skipped — Stryker is not configured
    diagnostic_site_reconfirm: pass — replacing every code with unclassified made the focused diagnostic assertions fail; restoring fixed stage emission made them pass
    device_verification: pending — explicitly deferred to the parent/user-approved release reproduction
- files_changed:
  - src/utils/logger.ts
  - src/services/backup/saf-write-error.ts
  - src/services/backup/saf-storage.ts
  - src/services/backup/backup-service.ts
  - src/services/backup/backup-service.test.ts
