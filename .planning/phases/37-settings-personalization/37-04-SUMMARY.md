---
phase: 37-settings-personalization
plan: 04
subsystem: ui
tags: [settings, contacts, custom-fields, archived, contacts-permission, d-03, category-reservation, react-navigation]

# Dependency graph
requires:
  - phase: 37-settings-personalization
    plan: 01
    provides: SettingsHubScreen at the preserved Settings route, transitional SettingsMore monolith, SETTINGS_REGISTERED_ROUTES contract + source-scan test, settings-hub-model.ts
  - phase: 37-settings-personalization
    plan: 03
    provides: SettingsAppearanceScreen migrated-category pattern (ShellAppBar variant=child + onBack; fresh-read-on-focus persist posture)
  - phase: 19.1-older-android-contact-picker-hybrid
    provides: use-read-contacts-permission (getContactsPermissionState, openContactsSettings, requestContactsPermission), contact import + resumable reconcile
provides:
  - SettingsContactsScreen (§E) at the registered SettingsContacts route — Contact Sources (permission surface + Import + reconcile + review-flagged + phone-region), Relationship Structure (Custom Fields + reserved Categories slot), Contact Management (Archived)
  - settings-contacts-model.ts — frozen §E section model + isActiveContactsRow guard + settings-contacts-model.test.ts
  - CategoryManagement route NAME reserved in SettingsStackParamList (typed-but-unregistered, D-03 — no screen, no row, no CRUD)
  - Settings monolith slimmed — Contact methods, Contacts Integration, Custom Fields, Archived groups removed
affects: [37-05, 37-06, 37-07, 37-08]

actuals:
  tokens: 13800
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Category screen renders from a frozen section model (settings-contacts-model.ts); the screen owns behaviour, the model owns section/row structure + order, and a source-scan test proves every active route row resolves to a real <Stack.Screen>"
    - "Contacts permission/status surface reuses the existing use-read-contacts-permission service (fresh OS read on focus, never cached); denied/permanent -> openContactsSettings handoff, priming -> single intentional-tap grant (no re-nag loop), capabilities stay visible (§G)"
    - "IA reservation as an inert 'reserved' row kind: holds a route name + section-order slot but isActiveContactsRow returns false, so the screen renders nothing — no dead placeholder, no CRUD (D-03 / §K)"

key-files:
  created:
    - src/screens/SettingsContactsScreen.tsx
    - src/screens/settings-contacts-model.ts
    - src/screens/settings-contacts-model.test.ts
  modified:
    - src/navigation/types.ts
    - src/navigation/tabs/SettingsStack.tsx
    - src/navigation/settings-routes.ts
    - src/screens/settings-hub-model.ts
    - src/screens/SettingsScreen.tsx

key-decisions:
  - "Every contact-admin destination (Custom Fields, Archived, Review flagged, resumable reconcile, Import) is reused BY NAVIGATION to its canonical manager — no manager reimplemented (§Q anti-duplication); the phone-region override is the only preference write this plan carries, via the existing validated phoneRegionOverridePatch + updateAppSettings path"
  - "Phone-region override ordered LOWER within Contact Sources (§E) — a formatting fallback, not a primary source action; enforced by settings-contacts-model.test.ts"
  - "Contacts permission surface built on the EXISTING use-read-contacts-permission (getContactsPermissionState / openContactsSettings / requestContactsPermission) — no new permission API, no re-nag loop; permission-dependent capabilities stay visible with explanation rather than hidden (§G)"
  - "Categories IA reserved as a route NAME + inert section slot only (D-03 / §K): CategoryManagement added to SettingsStackParamList but excluded from SETTINGS_REGISTERED_ROUTES, no <Stack.Screen>, no rendered row, no category writer. The categories table stays read-only (verified: only migration-001 seed, migration-007 uid rewrite, restore-apply upsert)"
  - "No schema change; TARGET_VERSION stays 29, BACKUP_FORMAT_VERSION stays 5 (D-06)"

requirements-completed: []

coverage:
  - id: T1
    description: "Contacts section model has §E order (Contact Sources → Relationship Structure → Contact Management), every active route row resolves to a registered <Stack.Screen>, and phone-region is ordered lower within Contact Sources"
    verification:
      - kind: unit
        ref: "src/screens/settings-contacts-model.test.ts"
        status: pass
    human_judgment: false
  - id: T2
    description: "D-03 regression guard: no active row targets CategoryManagement; the reserved slot is inert (isActiveContactsRow false) and NOT registered as a <Stack.Screen>"
    verification:
      - kind: unit
        ref: "src/screens/settings-contacts-model.test.ts#renders NO active row targeting CategoryManagement / holds the CategoryManagement slot as an inert reserved row"
        status: pass
      - kind: unit
        ref: "src/navigation/settings-routes.test.ts#does NOT register CategoryManagement"
        status: pass
    human_judgment: false
  - id: T3
    description: "SettingsContacts is in SETTINGS_REGISTERED_ROUTES, registered as a <Stack.Screen>, and the hub row is at §A index 1 in canonical §A order"
    verification:
      - kind: unit
        ref: "src/navigation/settings-routes.test.ts + src/screens/settings-hub-model.test.ts"
        status: pass
    human_judgment: false
  - id: UAT
    description: "Device UAT: each Contacts row reaches the same destination/behaviour as the old monolith (Custom Fields, Archived, Review flagged, Check linked resumable reconcile, Import, phone-region modal write); with Contacts denied the handoff opens Android app settings; no Categories row is visible"
    verification: []
    human_judgment: true
    rationale: "Navigation parity, the phone-region write, and the permission handoff / OS status surface are UI-observable and OS-dependent; deferred to end-of-phase Pixel UAT (verify-ui-on-pixel-yourself)."

duration: 20min
completed: 2026-09-14
status: complete
---

# Phase 37 Plan 04: Contacts & Relationships Category (§E) Summary

**The Contacts & Relationships category ships: the Contact methods (phone region, resumable reconcile, review-flagged), Contacts Integration (import), Custom Fields, and Archived rows migrate out of the SettingsMore monolith into a sectioned SettingsContactsScreen (Contact Sources / Relationship Structure / Contact Management) that reuses every canonical manager by navigation, adds a Contacts permission/status surface built on the existing use-read-contacts-permission service, and reserves the Categories IA slot as a route name only (D-03) — no dead placeholder, no Category CRUD, no schema or backup-format change.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files:** 8 (3 created, 5 modified)
- **Task commits:** 3

## Accomplishments

- **SettingsContactsScreen (§E, Task 1).** A new category screen rendered from a frozen section model, in canonical §E order:
  - **Contact Sources** — a Contacts permission/status surface, Import contacts, Check linked contacts (resumable reconcile), Review flagged items, and the phone-region override ordered lower.
  - **Relationship Structure** — Custom Fields (+ the inert Categories reservation added in Task 2).
  - **Contact Management** — Archived contacts.
  Every destination is reused by navigation to its canonical manager (`CustomFields`, `Archived`, `BulkReview`, `ReconcileGrid`) — none reimplemented. The migrated behaviours (`onImportContacts`, `onCheckLinkedContacts` with the pending-session resume prompt, the phone-region modal + `savePhoneRegionOverride` write, review-flagged navigation) are carried verbatim from the monolith.
- **Contacts permission surface (§E/§G, Task 1).** Built on the EXISTING `use-read-contacts-permission` service: it reads OS status fresh on focus via `getContactsPermissionState()` (never cached), renders the status, and branches on the verdict — `granted` shows status; `denied`/`permanent` show an actionable **Open system settings** row wired to `openContactsSettings()` (Orbit cannot flip the OS grant itself); `priming` offers a single intentional-tap **Allow Contacts access** grant via `requestContactsPermission()` with no re-nag loop. Import and Check-linked stay visible regardless of verdict, with explanation (§G) — never hidden. No new permission API was introduced.
- **Route registration + hub row (Task 1).** `SettingsContacts: undefined` added to `SettingsStackParamList`, a `SettingsContactsRoute` wrapper + `<Stack.Screen>` registered in `SettingsStack.tsx`, `"SettingsContacts"` appended to `SETTINGS_REGISTERED_ROUTES`, and the **Contacts & Relationships** hub row inserted at §A index 1 (after Appearance, before Interactions).
- **Categories IA reservation (D-03 / §K, Task 2).** `CategoryManagement: undefined` added to `SettingsStackParamList` as a stable internal address for the future Category Management phase, and its section-order slot held under Relationship Structure as an inert `reserved` row (`isActiveContactsRow` returns false → renders nothing). It is deliberately EXCLUDED from `SETTINGS_REGISTERED_ROUTES`, has NO `<Stack.Screen>`, no rendered row, and no category writer. The `categories` table stays read-only — verified on disk that its only three writers remain the migration-001 seed, the migration-007 uid rewrite, and the `restore-apply.ts` upsert.
- **Monolith slimmed (Task 1).** The Contact methods section, Contacts Integration section, phone-region modal + `ResumeReconcilePrompt`, Custom Fields row, and Archived row (plus now-orphaned imports/state/handlers/constants/styles) were removed from `SettingsScreen.tsx` — no duplicate write surface remains. Notifications, AI hub, Add Orbit widget, and Systems stay for later plans.
- **Regression test (Task 3).** `settings-contacts-model.test.ts` asserts §E section order, that every active route row resolves to a registered `<Stack.Screen>` (source-scan), the phone-region lower-ordering, and — the key D-03 guard — that the `CategoryManagement` reservation yields no active/rendered row and is not registered.
- No migration added; `TARGET_VERSION` stays 29, `BACKUP_FORMAT_VERSION` stays 5 (D-06).

## Task Commits

1. **Task 1:** SettingsContacts category (§E) — migrate contact-methods, import, Custom Fields, Archived — `c4e494b` (feat)
2. **Task 2:** reserve Categories IA slot (D-03) — route name only, no row, no CRUD — `9a550a8` (feat)
3. **Task 3:** contacts-model section shape + Categories-reservation inertness guard — `10ce241` (test)

## Files

- **Created:** `src/screens/SettingsContactsScreen.tsx`, `src/screens/settings-contacts-model.ts`, `src/screens/settings-contacts-model.test.ts`
- **Modified:** `src/navigation/types.ts` (SettingsContacts + reserved CategoryManagement), `src/navigation/tabs/SettingsStack.tsx` (route + wrapper), `src/navigation/settings-routes.ts` (append SettingsContacts), `src/screens/settings-hub-model.ts` (hub row §A index 1), `src/screens/SettingsScreen.tsx` (migrated groups + orphans removed)

## Deviations from Plan

**1. [Rule 3 - Blocking type] Constrained the model's route type to param-less Settings routes.**
- **Found during:** Task 1 (`npx tsc --noEmit`).
- **Issue:** Typing `SettingsContactsRouteRow.route` as the full `keyof SettingsStackParamList` broke `navigation.navigate(row.route)` — the broad union includes param-carrying routes, so `navigate` demanded a params argument (TS2769).
- **Fix:** Narrowed the route type to the param-less subset (`{ [K in keyof SettingsStackParamList]: undefined extends SettingsStackParamList[K] ? K : never }[...]`). All Contacts targets (CustomFields, Archived, BulkReview) and the CategoryManagement reservation are param-less, so this is exact, not a widening. No behaviour change.
- **Files:** `src/screens/settings-contacts-model.ts`
- **Commit:** `c4e494b`

No other deviations — the plan executed as written.

## Deferred Issues

- **Pre-existing, unrelated: `src/components/orrery/orrery-controls-render.test.tsx` fails to transform** (`SyntaxError: Unexpected token 'typeof'`, 0 tests run). A Phase 29 vitest transform error predating this plan; none of this plan's commits touch orrery. Out of scope (executor scope boundary). The rest of the suite is green: 3574 tests pass across 375 files.
- **Roadmap follow-up owed (D-03, owner's bucket):** a "Category Management" phase (CRUD + deletion cascade to Orrery Systems, custom-System rules, profile assignments, backup) is an unscheduled dependency. This plan reserves only the route name/IA slot; the manager itself is deferred. Raise with the owner at phase close.

## Known Stubs

None. The Categories slot is a deliberate, tested, INERT reservation (D-03 / §K) — it renders nothing and is guarded by `settings-contacts-model.test.ts`, not a dead placeholder. Every rendered Contacts row drives a live navigation or a live write (phone-region override / permission handoff / import / reconcile).

## Threat Flags

None new. The one preference write (phone-region override) reuses the monolith's validated `phoneRegionOverridePatch` + `updateAppSettings` path (T-37-01 mitigated — no inline SQL). The Contacts permission status is READ and surfaced; no new grant path or egress (T-37 boundary unchanged). The Categories reservation adds a route name only, with an automated guard asserting no rendered row and no category CRUD writer (T-37-05 mitigated, D-03). No data leaves the device.

## User Setup Required

None for automated verification. Device UAT (see coverage UAT) on the owner's Pixel: confirm each Contacts row reaches the same destination/behaviour as the old monolith (Custom Fields, Archived, Review flagged, Check linked resumable reconcile, Import, phone-region modal write), that with Contacts denied the handoff opens Android app settings, and that no Categories row is visible. Deferred to end-of-phase UAT.

## Verification

- `npx tsc --noEmit` — clean (project-wide).
- `npm run check:colors` — clean.
- `npx vitest run src/screens/settings-contacts-model.test.ts src/screens/settings-hub-model.test.ts src/navigation/settings-routes.test.ts` — green.
- `npx biome check` on all touched files — clean.
- Full suite: 3574 tests pass; 1 pre-existing unrelated transform failure (see Deferred Issues).

## Self-Check: PASSED

All three created files present on disk; all five modified files present; all three task commits (`c4e494b`, `9a550a8`, `10ce241`) exist in git history.
