---
phase: 20-contact-reconciliation-merge
plan: "06"
subsystem: reconciliation
tags: [react-native, sqlite, bulk-review, birthday, device-uat, hermes-crypto]
requires:
  - phase: 20-05
    provides: resume prompt, relink lifecycle, durable reconciliation sessions
provides:
  - Durable non-destructive bulk birthday-flag review (Fix / Ignore) on a schema-generic resolution table
  - Consolidated Pixel device-UAT evidence for the whole Phase 20 reconciliation + merge feature set
affects: [reconciliation, contact-links, import-review]
actuals:
  tokens: 0
  tasks: 3
  commits: 5
tech-stack:
  added: []
  patterns: [durable resolution table (bulk_review_resolutions), guarded-global crypto with RNQC fallback]
key-files:
  created:
    - src/db/migrations/013-reconciliation-and-merge.ts (bulk_review_resolutions + reconcile tables; TARGET_VERSION 13)
    - src/db/bulk-review-dao.ts
    - src/db/bulk-review-read.ts
    - src/screens/BulkReviewScreen.tsx
  modified:
    - src/services/photos/reconcile-photo.ts (Bug B — guard globalThis.crypto, RNQC fallback)
    - src/components/FieldChoiceGroup.tsx (Bug C — unique React keys)
    - modules/orbit-contact-picker/android/src/main/AndroidManifest.xml (ADR-003)
    - plugins/withContactPickerPermission.js (ADR-003)
    - src/services/contacts/use-read-contacts-permission.ts (ADR-003)
    - src/screens/ReconcileDetailScreen.tsx (ADR-003 permission gate)
    - src/screens/ReconcileGridScreen.tsx (ADR-003 permission gate)
key-decisions:
  - "ADR-003: enable READ_CONTACTS on API 37+ for the reconcile re-read (owner-approved 2026-08-31); supersedes ADR-002's no-READ_CONTACTS-on-37 clause. Import stays permissionless."
  - "Device driving delegated to bounded per-task subagents; orchestrator independently DB-verifies every claim (WAL-aware run-as read). Real family PII (contacts 3-6) never mutated during UAT."
  - "Scenario 4 summary counts and bulk-apply write path verified via unit tests rather than the adb-undrivable bulk action-sheet; on-device equivalent per-card path exercised the same write."
patterns-established:
  - "Runtime crypto must be guarded: globalThis.crypto is undefined in Hermes; use WebCrypto when present, else RNQC. (uid.ts already guards; reconcile-photo.ts now does too.)"
requirements-completed: [RCN-02]
coverage:
  - id: D1
    description: Durable non-destructive bulk birthday-flag review (Fix writes a birthday + resolution; Ignore writes only a resolution)
    requirement: RCN-02
    verification:
      - kind: unit
        ref: src/db/bulk-review-dao.test.ts
        status: pass
      - kind: unit
        ref: src/db/bulk-review-read.test.ts
        status: pass
      - kind: device-uat
        ref: 20-UAT.md scenarios 7a (Fix) + 7b (Ignore)
        status: pass
    human_judgment: true
    rationale: Flag resolution UI + persistence-across-restart confirmed on the Pixel; DB-verified.
  - id: D2
    description: Phase 20 reconciliation + merge feature set validated end-to-end on device
    requirement: RCN-01
    verification:
      - kind: device-uat
        ref: 20-UAT.md scenarios 0-6 (import, merge, per-contact reconcile, bulk check, resume, source-missing/relink)
        status: pass
    human_judgment: true
    rationale: Real-hardware UAT across merge atomicity, reconcile classification, bulk scan, process-death resume, and relink; all DB-verified. Awaiting owner sign-off.
---

# Phase 20 Plan 06: Bulk Birthday Review + Consolidated Device UAT

Closes Phase 20. Task 1 (bulk birthday-flag review) shipped in the prior session;
this session ran the consolidated Pixel device-UAT that Task 2 gated, and fixed the
two correctness bugs (and one permission blocker) the now-working reconcile surfaced.

## Performance
- Automated suite: 185 files / 1783 tests green; `tsc --noEmit` clean; `check:colors` clean; biome lint clean on changed files.
- Device UAT: all 8 scenarios PASS on the Pixel 6 Pro (API 37), each independently DB-verified via WAL-aware `run-as` reads.

## Accomplishments
- **Bulk birthday review (RCN-02):** durable Fix/Ignore on `bulk_review_resolutions` (migration 013), non-destructive — Ignore touches no contact data; a resolved flag never re-surfaces across restart.
- **ADR-003 permission fix:** reconcile can read linked contacts on API 37 (`READ_CONTACTS` uncapped at both the module manifest and the config plugin). Unblocked the entire reconcile re-read path. Import remains permissionless.
- **Bug B (blocker) fixed** — `reconcile-photo.ts` `digest()` crashed the bulk scan on Hermes (`globalThis.crypto` undefined) whenever a linked source had a photo; now guards WebCrypto / falls back to RNQC.
- **Bug C fixed** — duplicate React keys for multi-value field choices in `FieldChoiceGroup`.

## Task Commits
- `3d56911` feat(20-06): add bulk birthday review resolver
- `a376901` fix(20-06): register bulk review cadence ownership
- `cd41b31` wip(20): ADR-003 READ_CONTACTS on API 37 for reconcile + UAT pause point
- `165b9e7` fix(20-06): guard globalThis.crypto in reconcile photo digest (Bug B)
- `eecea73` fix(20-06): unique React keys for multi-value field choices (Bug C)

## Device UAT results (all PASS — see 20-UAT.md scoreboard + uat-shots/)
| # | Scenario | Result |
|---|----------|--------|
| 0 | Import device→Orbit (Bound) | PASS |
| 1 | Merge atomic → survivor + tombstone | PASS |
| 2 | Merge with name/birthday/primary conflicts | PASS |
| 3 | Per-contact reconcile: conflict + no-re-nag (email-value edit, Finding-A-safe) | PASS |
| 4 | Bulk "Check linked contacts" (only-changed, eligibility gating, partial-resolve) | PASS (counts + bulk write path unit-covered; action-sheet not adb-drivable) |
| 5 | Process death mid-review → Resume preserves applied | PASS |
| 6 | Deleted source → "Source missing" → Relink | PASS |
| 7a / 7b | Bulk birthday review — Fix / Ignore | PASS |
| — | ADR-003 READ_CONTACTS on API 37 | PASS |

## Deviations from Plan
- **Bug B / Bug C** were not in the plan; they are correctness findings the now-working reconcile surfaced, fixed inline (both preserve existing behavior; no ADR/HANDOFF decision reversed). Diagnosis: `20-BUGB-DIAGNOSIS.md`.
- **Scenario 4** summary-counts and bulk-apply were verified via unit coverage + the equivalent per-card path, because the bulk action-sheet is an RN Modal whose backdrop swallows injected adb taps (a test-harness limitation, not an app defect).

## Issues Encountered / Follow-ups (non-blocking)
- **Finding A (robustness):** exact-string lookup-key matching orphans a link when a local contact is renamed/re-aggregated. Backlog hardening candidate (Android `lookupContact` refresh); out of Phase 20 scope.
- **Cosmetic:** methods-family conflict renders a serialized Orbit value (`email␟…`); a source-deleted Bound contact shows an "Unbound" badge while its link is still active. Both display-only.

## User Setup Required
- **Release gate (non-blocking):** file the Google Play Contacts declaration (CRM / Contact Management category) justifying `READ_CONTACTS` via the reconcile/change-detection use case before Play submission (ADR-003 obligation).

## Next Phase Readiness
- Phase 20 implementation + device UAT complete and **owner-signed-off (2026-08-31)**. `ZZ-UAT-` fixtures (Orbit contacts 7–17 + device raw 1130–1142) **RETAINED per owner** for reuse — cleanup declined. Real family PII (contacts 1–6) untouched throughout (verified byte-identical to the pre-UAT baseline). Next: Phase 21 (Interaction Assist & Reach Out).
