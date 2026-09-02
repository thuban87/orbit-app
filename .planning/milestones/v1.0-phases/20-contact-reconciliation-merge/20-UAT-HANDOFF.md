---
phase: 20-contact-reconciliation-merge
status: blocked
blocked_at: 20-06 Task 3 — Consolidated Pixel device UAT
created: 2026-08-30
target_device: Pixel 6 Pro (serial 1A071FDEE002BU, API 37)
do_not_use: Pixel 3a (serial 943AY0JR4P, API 32; unsupported for the contact picker)
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-02
  gap_snapshot: "blocked::scenarios=0"
---

# Phase 20 Device-UAT Handoff

## Current code and plan state

- Plans **20-01 through 20-05 are complete** with committed summaries.
- Plan **20-06 Tasks 1 and 2 are complete**:
  - `3d56911 feat(20-06): add bulk birthday review resolver`
  - `a376901 fix(20-06): register bulk review cadence ownership`
- Plan **20-06 Task 3 is not complete**. There is deliberately no `20-06-SUMMARY.md` and Phase 20 must not be marked complete.
- The latest automated baseline was green: `npm test` = **183 files / 1,778 tests**, plus `npx tsc --noEmit` and `npm run check:colors`.
- A later executor reported **185 files / 1,783 tests** before the UAT checkpoint, but its device-fixture work was interrupted and must not be treated as UAT evidence.

## Device facts already verified

Use **only** the Pixel 6 Pro target in this handoff:

```bash
adb -s 1A071FDEE002BU shell getprop ro.product.model  # Pixel 6 Pro
adb -s 1A071FDEE002BU shell getprop ro.build.version.sdk  # 37
```

The prior device pass established:

- A fresh Phase-20 debug APK built successfully on `droid`, installed with `adb install -r`, launched normally, and migrated the on-device database to `user_version=13`.
- `run-as com.bwales.orbit id` succeeds.
- Metro was reachable through Pixel-only reverse `tcp:8081 → tcp:8082` during the earlier pass.
- Before fixture creation was authorized, the WAL-aware snapshot had:

| Item | Count |
|---|---:|
| Contacts | 6 |
| Active source links | 5 |
| Reconciliation sessions | 0 |
| Reconciliation cards | 0 |
| Bulk-review resolutions | 0 |
| Unreadable-birthday import rows | 0 |

## Important interruption warning

A fixture/UAT executor was **interrupted before it returned any report**. It made no repository commit and recorded no completed UAT scenario, but it may have made device-only test changes after receiving authorization to create fixtures.

Do **not** claim any UAT scenario passed. Before creating new fixtures or deleting anything, audit the Pixel 6 Pro for any newly added test contact/source rows and for rows in:

- `contacts`
- `external_contact_links`
- `reconciliation_sessions`
- `reconciliation_session_cards`
- `bulk_review_resolutions`
- `import_session_rows`

Treat the existing six contacts as potentially personal data. Do not delete or modify them. Limit cleanup to contacts and system-contact records that can be positively identified as dedicated UAT fixtures.

## Required UAT acceptance scenarios

The authoritative scenario list is Plan 20-06 Task 2 at `20-06-PLAN.md:115`:

1. Merge two contacts atomically: land on survivor profile; absorbed contact is gone and tombstoned, not archived.
2. Merge contacts with name, birthday, and primary-method conflicts: selections resolve correctly.
3. Per-contact Update from Contacts: additions are recommended, conflicts require manual choice, and kept values do not re-nag.
4. Bulk Check linked contacts: only changed contacts appear; partial resolution persists; summary counts are correct; `Use Contact Values` is absent when a conflict is selected.
5. Kill mid-review: Resume restores unresolved work while preserving already-applied changes.
6. Delete a linked phone contact: app reports Source missing rather than removals; Relink re-runs review; Orbit data stays intact.
7. Review flagged items: `Fix` stores a valid birthday and clears the flag; `Ignore` clears the flag without setting a birthday or changing other contact data.

Expected limitation to record, not treat as failure: after a merge, survivor notification refresh is eventually consistent and occurs on the next foreground launch sweep.

## Fixture requirements

Create isolated, clearly named fixtures only after the interruption audit:

- Two Orbit contacts with a merge conflict in name, birthday, and phone/email primary methods.
- At least one **Bound** contact linked to a source contact with both additive and conflicting edits.
- A pending reconciliation session/card with at least one applied action to exercise process-death resume.
- A linked source contact that can be removed to exercise Source missing → Relink safely.
- At least one import-session row attached to a fixture contact containing an unparseable birthday source value, so `Review flagged items` has a live row.

Because the picker is API-gated at 37+, do not use the Pixel 3a for these scenarios.

## Recommended execution discipline

1. Audit the interruption state and record exact fixture identifiers before mutating anything.
2. Write a small executable fixture setup/cleanup script or a concise UAT checklist with exact SQL/ADB commands before app-driving. Do not improvise fixtures during the seven scenarios.
3. Create fixtures, capture their IDs, run one scenario at a time, and record evidence directly in this file or a new `20-UAT.md`.
4. Remove only the recorded fixture IDs and verify that cleanup, preserving all pre-existing device data.
5. Only after all seven scenarios have evidence and owner sign-off, write `20-06-SUMMARY.md`, run phase verification, and advance Phase 20.

## Repository working state

Pre-existing/unrelated local changes have been preserved throughout:

```text
M  .planning/STATE.md
M  .planning/config.json
?? .gsd/
?? .planning/debug/wave1-integration-regressions.md
?? docs/dossier/milestone-2/
```

No Phase 20 tracking files were committed by the executors. The next agent should preserve this dirty state and avoid `git reset`, `git checkout --`, or broad cleanup commands.
