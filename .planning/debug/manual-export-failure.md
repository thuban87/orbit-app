---
status: investigating
trigger: "Release-device readable manual export fails before Android sharing, independently blocking Replace-all safety snapshots."
created: "2026-08-26"
updated: "2026-08-26"
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-02
  status: investigating
---

# Debug Session: Manual export failure

## Symptoms

- Expected: with encryption enabled, selecting the explicit readable-JSON portability override creates an export and opens Android sharing.
- Actual: the release app reports export creation/sharing failed before a file is saved or the share surface can be used.
- Errors: no raw device error is retained or surfaced because export failures are intentionally privacy-safe.
- Timeline: observed after the Replace-all pre-restore snapshot failure; it is an independent direct use of the same export boundary.
- Reproduction: open Backup, press Export now, choose Export readable JSON, then observe the generic export failure.

## Current Focus

- bug_class: bohrbug
- hypothesis: A current local photo reference is unreadable; `buildExportManifest` intentionally rejects the entire portable manifest before any manual file/share operation. The readable override rules out encryption/passphrase as the direct cause.
- test: The existing focused export-manifest regression exercises exactly this failure; manual-service tests verify that an exporter rejection yields `export-failed` before the share adapter.
- expecting: Both suites pass locally; this establishes the failure mechanism but cannot identify the affected on-device photo without a redacted operation-stage diagnostic or inspecting device data.
- next_action: parent decides whether to add manual export stage diagnostics in the next release, or to reproduce with an on-device data-repair surface; no source fix is safe without identifying the failing resource.

## Evidence

- timestamp: "2026-08-26"
  source: Pixel 6 Pro diagnostic release UAT
  observation: Explicit readable manual export failed before native sharing; no output file was selected or restored.

- timestamp: "2026-08-26"
  source: complete manual export and manifest trace
  observation: "Readable export bypasses encryption and passphrase resolution, then calls buildExportManifest before cache-file creation or expo-sharing. The manifest builder turns a rejected/empty profile, contact, or custom-photo read into BackupPhotoUnreadableError; the manual service's outer catch maps it to export-failed and never invokes the share adapter."
  implication: "Encryption/passphrase and Android sharing are eliminated for the direct readable failure. A bad current photo reference is the leading data cause; cache-file creation/read remains an uninstrumented alternative."

- timestamp: "2026-08-26"
  source: focused local Vitest
  observation: "src/backup/export-manifest.test.ts and src/services/backup/backup-service.test.ts passed (19 tests). The export-manifest test asserts that one unreadable referenced photo rejects the whole export; the manual-service tests assert a failed export does not open sharing."
  implication: "The production failure behavior is intentional fail-closed preservation of portable completeness, not an encryption or share-sheet defect. No new source change can safely restore the export without identifying/repairing the affected local resource."

## Eliminated

- hypothesis: Automatic backup daily cadence alone explains the Replace safety snapshot failure.
  reason: Manual export, which does not use automatic cadence, fails at the same current-data export boundary.

- hypothesis: Encryption passphrase or envelope encryption causes the direct readable-JSON failure.
  reason: "readableOverride makes resolveWriteEncryptionMode plaintext and skips encryption before buildExportManifest."

- hypothesis: Android share availability/open is the direct readable-JSON failure.
  reason: "buildExportManifest, cache write, and read-back occur before share.isAvailable/open; the observed failure is reported before sharing."

## Resolution

- root_cause: "Most likely an unreadable current local photo reference: the shared manifest builder fails closed before manual sharing when any profile/contact/custom photo cannot be read. Exact affected resource remains unobservable because the boundary deliberately redacts it; uninstrumented cache write/read is the remaining code/environment alternative."
- fix: "No safe production change applied. Omitting or silently clearing the photo would create an incomplete backup. A later release needs fixed, content-free manual-export stage diagnostics (or a user-facing photo repair flow) to distinguish manifest resource failure from cache-file I/O."
- verification: "Focused local Vitest: src/backup/export-manifest.test.ts and src/services/backup/backup-service.test.ts — 19/19 passing. No Android build, ADB, or device interaction performed."
- files_changed: ""
