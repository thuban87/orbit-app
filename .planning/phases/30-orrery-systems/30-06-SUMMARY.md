---
phase: 30-orrery-systems
plan: "06"
subsystem: systems-management
tags: [react-native, navigation, sqlite, zustand, systems]
requires:
  - phase: 30-orrery-systems
    provides: Systems DAO lifecycle and immutable-base guards
  - phase: 30-orrery-systems
    provides: SystemBuilder routes in both navigation stacks
  - phase: 30-orrery-systems
    provides: Orrery preference observer for live cross-stack selection
provides:
  - Flat Systems Management surface reachable from Orrery and Settings
  - Contact-safe custom-System deletion with short-lived Undo
  - Hydrate-before-save active-System fallback through the global preferences channel
affects: [30-05-system-switcher, 30-07-manage-members, 30-08-system-builder, 30-10-preference-observer]
tech-stack:
  added: []
  patterns:
    - Systems management reads and writes only through Systems DAO/read-layer contracts
    - Cross-stack selected-System changes hydrate then publish via the global Orrery preferences store
key-files:
  created:
    - src/screens/SystemsManagementScreen.tsx
    - src/screens/SystemsManagementScreen.test.tsx
  modified:
    - src/navigation/types.ts
    - src/navigation/tabs/OrreryStack.tsx
    - src/navigation/tabs/SettingsStack.tsx
    - src/screens/SettingsScreen.tsx
decisions:
  - "SystemsManagement is a dual-stack route; SystemBuilder remains the Edit and immutable-base override authoring seam registered by Plan 08."
  - "Active custom-System deletion and successful Undo publish selection only through hydrate-then-save on the global Orrery preferences store."
metrics:
  duration: 5m 8s
  completed: 2026-09-08
status: complete
actuals:
  tokens: 7045
  tasks: 3
  commits: 3
---

# Phase 30 Plan 06: Systems Management Summary

**A dual-entry Systems screen now manages ordered System definitions, immutable-base overrides, and contact-safe custom lifecycle actions.**

## Accomplishments

- Registered `SystemsManagement` in both Orrery and Settings stacks and added the Settings entry.
- Built a flat, reorderable list with All Contacts pinned, live member counts, text-plus-icon health indicators, and kind-correct actions.
- Wired rename, duplicate, visibility, override reset, delete/Undo, and active-System persistence exclusively through DAO and preferences-store contracts.

## Task Commits

1. **Task 1: Register the SystemsManagement route + Settings entry** — `c1d6f7b`
2. **Task 2: Flat management list and per-kind controls** — `242f621`
3. **Task 3: Contact-safe lifecycle mutations and active selection fallback** — `b159a21`

## Key Contracts

- All Contacts is pinned first and never exposes Rename, Delete, or Hide; it remains override-authorable through **Manage Members**.
- Built-in and Category rows preserve their immutable bases and enter `SystemBuilder` with `{ systemRef }`; custom Edit enters with `{ systemUid }`.
- Deleting an active custom System publishes `builtin:all-contacts` only after preferences hydration. A successful Undo restores the UID-stable snapshot, then republished `custom:<uid>`; a failed restore only shows a non-destructive snackbar.

## Deviations from Plan

None - plan executed as written.

## Known Stubs

None.

## Verification

- Passed: `npx vitest run src/screens/SystemsManagementScreen.test.tsx` (5 tests).
- Passed: `npx tsc --noEmit -p tsconfig.json`, Biome lint, and `npm run check:colors`.
- Passed: systems-management DAO-only SQL check (no System SQL in the screen).
- `npm test`: 2,613 tests passed. The pre-existing Flow parser failures in `src/backup/restore-apply.test.ts` and `src/stores/orrery-system-store.test.ts` remain; neither suite ran and no Plan 30-06 test failed.

## Self-Check: PASSED

- Verified all six changed source/test files exist.
- Verified commits `c1d6f7b`, `242f621`, and `b159a21` exist in local history.
