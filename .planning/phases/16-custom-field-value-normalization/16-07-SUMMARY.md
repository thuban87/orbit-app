---
phase: 16-custom-field-value-normalization
plan: "07"
subsystem: migration-validation
tags: [sqlite, migration-006, pixel, release-apk, debug-apk, uat]
requires:
  - phase: 16-01
    provides: normalized migration and pair-row schema
  - phase: 16-02
    provides: normalized writers and reads
  - phase: 16-06
    provides: purge and schema-consumer coverage
provides:
  - Populated upgrade, rollback, orphan-proceed, and scale evidence for migration 006.
  - Signed disposable Pixel UAT record using the correct release and debug variants.
  - Profile rendering and long-dropdown recovery refinements discovered during UAT.
affects: [16-08, phase-verification, phase-17]
requirements-completed: [CFN-01, CFN-02, CFN-03, CFN-04]
tech-stack:
  added: []
  patterns:
    - Release APK validates silent embedded-bundle upgrades; DEBUG plus Metro validates run-as fixture failure paths.
    - Database bootstrap shares one in-flight opening promise, preventing concurrent migration transactions.
key-files:
  created:
    - .planning/phases/16-custom-field-value-normalization/16-UPGRADE-UAT.md
  modified:
    - src/db/database.ts
    - src/screens/ContactProfileScreen.tsx
    - src/components/field-widgets/DropdownFieldWidget.tsx
key-decisions:
  - No AI provider was configured or invoked during device UAT; the inspector/privacy scenario is proven through its offline prompt-context and immutable-inspector contract tests.
  - A profile must render visible normalized custom values so invalid raw data retains its Tap-to-fix recovery route.
  - Dropdown selected values may wrap; option-sheet entries already wrap.
completed: 2026-08-24
status: complete
---

# Phase 16 Plan 07: Upgrade Proof and Pixel UAT Summary

**Migration 006 has automated scale coverage and completed disposable Pixel release/debug evidence, including loss-bearing rollback and orphan-column proceed.**

## Accomplishments

- Added the populated v5→v6 all-path proof, v1/v4/v5 bootstrap coverage, and a 200-contact × 15-definition upper-bound migration: 3,000 durable pairs in **130.2 ms** on Node/node:sqlite.
- Fixed a real concurrent bootstrap race that could surface `cannot start a transaction within a transaction` while the database opened.
- Proved the standalone release APK silently migrated a populated disposable v5 profile; seeded values, photo, edit/clear round trips, quarantine/restore, permanent empty-field deletion, raw-value recovery, and long-content wrapping all passed.
- Proved the DEBUG plus Metro path: loss-bearing missing-column migration stops before changes and retains v5 bytes; D-06a orphan data snapshots to `field_history` and proceeds silently to v6.
- UAT exposed two pre-existing display gaps: custom values were not rendered on the profile, and a selected long dropdown value was clamped to one line. Both were fixed and physically rerun in a standalone release APK.

## Device Evidence

- Pixel 6 Pro `1A071FDEE002BU`, Android 17 / SDK 37.
- Initial release migration proof: source `e96e339`, 151,712,718-byte APK, SHA-256 `e4af82e8d146539cc0a39586d5f2bcf00409248d98a7a5160c22919825574fb4`.
- Final release visual rerun: source `0694107`, 151,715,130-byte APK, SHA-256 `2d0a9999a2f4295688c47a8a61a04701cfd9df80f603b77ddd91403d2f9bf52f`.
- DEBUG failure fixture used Metro on dedicated port 8082 and `adb reverse tcp:8082 tcp:8082`; the owner’s unrelated Metro process on 8081 was not touched.
- Full details, commands, screenshots, UI dumps, failure DB observations, and explicit scope boundaries are in `16-UPGRADE-UAT.md`.

## Verification

- `npm test -- --run` — **104 files, 1348 tests passed**.
- `npx tsc --noEmit` — passed.
- `npm run check:colors` — passed.
- `npx vitest run src/db/ai-context-read.test.ts src/logic/ai-suggestion-compose-integration.test.ts` — **18 tests passed**, with no provider/API call.
- Legacy-table completeness gate passed: runtime references outside migrations/tests are explanatory comments only.

## Task Commits

1. **Task 1: populated automated proof matrix** — `ed9e31a`
2. **Task 2: UAT template and evidence** — `57be655`, `a8ff80a`, `50497a1`, plus final record completion in this plan commit
3. **Concurrent bootstrap remediation** — `e96e339`
4. **UAT-discovered profile and wrapping remediation** — `791f622`, `0694107`

## Scope Confirmation

Phase 16 does not add backup/export/restore, sync transport, conflict policy, tombstones, identity UI, or a custom-field redesign. The AI device inspection did not configure a provider or make an API request; its egress boundary and pre-send inspector representation were verified offline.

## Self-Check: PASSED

- Automated all-path, parameterized, upper-bound, rollback, and orphan-proceed tests are green.
- The release and debug UAT variants are both recorded as PASS against disposable data.
- No user data or port-8081 Metro process was modified.

---
*Phase: 16-custom-field-value-normalization*
*Completed: 2026-08-24*
