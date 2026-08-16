---
phase: 11-actionable-notifications
plan: 01
subsystem: infra
tags: [expo-notifications, expo-task-manager, notifications, vitest-mocks, idempotency, sqlite]

# Dependency graph
requires:
  - phase: 08-dashboard
    provides: "daysUntilBirthday parser (reused by later birthday scheduling); dashboard as offline source of truth"
  - phase: 09-compose
    provides: "Compose route + graceful phone-less degrade (the body-tap target)"
provides:
  - "expo-notifications + expo-task-manager installed (SDK-57 pinned) and the notifications config plugin registered once"
  - "node-safe vitest doubles for expo-notifications + expo-task-manager (Wave-0 suites can seed + assert)"
  - "notification-ids: single source for identifiers, channel/category/action ids, generic body copy, NotificationData contract, and the deterministic actionUid idempotency key"
affects: [11-02, 11-05, 11-06, 11-07, 11-08, 11-10, 11-12, 11-13, channels, notification-actions, notification-schedule, response-gate]

# Tech tracking
tech-stack:
  added: [expo-notifications ~57.0.11, expo-task-manager ~57.0.10]
  patterns:
    - "Single-source constants module (mirrors src/db/status.ts posture): identifiers/copy/channel ids live in one react-native-free file so scheduler and handler cannot drift"
    - "Deterministic actionUid as an idempotency key: pure function of (action, kind, contactId, occurrenceKey) collides re-delivered taps on the existing UNIQUE(uid) constraint"
    - "Root-level __mocks__ manual doubles, dependency-free, seedable via __set*/__reset helpers for node vitest env"

key-files:
  created:
    - __mocks__/expo-notifications.ts
    - __mocks__/expo-task-manager.ts
    - src/services/notifications/notification-ids.ts
    - src/services/notifications/notification-ids.test.ts
  modified:
    - package.json
    - package-lock.json
    - app.config.ts

key-decisions:
  - "expo-task-manager omitted from the RESEARCH Package Legitimacy Audit but is first-party Expo (same provenance as expo-notifications); installed via npx expo install, no blocking-human legitimacy checkpoint needed"
  - "expo-notifications registered as a bare string plugin (no options: no custom icon/sound, no FCM); expo-task-manager ships no config plugin so adds no plugins entry"
  - "No google-services.json, no exact-alarm permission — the FCM-less local-notification path is the decided architecture"
  - "DECAY_CATEGORY uses an underscore (decay_actions) not a hyphen — permanent id, fixed before ship (review item 9 / A4)"

patterns-established:
  - "notification-ids is the single import point for every notification identifier/copy/id constant"
  - "actionUid(action, data) is the one deterministic idempotency key derivation"

requirements-completed: [NOTIF-01, NOTIF-02, NOTIF-04, NOTIF-05]

coverage:
  - id: D1
    description: "expo-notifications + expo-task-manager installed at SDK-57 versions and the notifications config plugin registered exactly once (no duplicate-plugin)"
    requirement: NOTIF-01
    verification:
      - kind: unit
        ref: "node package.json deps guard + npx tsc --noEmit"
        status: pass
      - kind: other
        ref: "app.config.ts renders plugins with expo-notifications count === 1 (tsx probe)"
        status: pass
      - kind: manual_procedural
        ref: "Pixel-UAT: expo prebuild --clean + release APK on droid; no duplicate-plugin error; registerTaskAsync resolves at runtime"
        status: unknown
    human_judgment: true
    rationale: "Native config only fully proven by a desktop prebuild + on-device APK run; this Linux box cannot build APKs. JS-side (deps + tsc + single-plugin) is auto-proven; the prebuild/runtime facet is Pixel-UAT."
  - id: D2
    description: "Node-safe expo-notifications + expo-task-manager test doubles the Wave-0 suites can seed and assert against"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (mocks typecheck under **/*.ts include) + biome check __mocks__"
        status: pass
    human_judgment: false
  - id: D3
    description: "notification-ids shared contract: identifiers, versioned channel ids, category/action ids, verbatim body copy, NotificationData(occurrenceKey), deterministic actionUid"
    requirement: NOTIF-02
    verification:
      - kind: unit
        ref: "src/services/notifications/notification-ids.test.ts (14 cases: identifiers/copy/channels/category/actions + actionUid determinism & collision-distinctness)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-16
status: complete
---

# Phase 11 Plan 01: Notification Native Enablement & Shared Contracts Summary

**expo-notifications + expo-task-manager installed and plugin-registered once, node-safe vitest doubles for both, and the single `notification-ids` module owning every identifier/channel/category/action id, the verbatim generic body copy, the occurrence-scoped `NotificationData` type, and the deterministic `actionUid` idempotency key.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-08-16
- **Tasks:** 3
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments
- Installed `expo-notifications ~57.0.11` and `expo-task-manager ~57.0.10` via `npx expo install` (both SDK-57 pinned) and registered `expo-notifications` as a bare string plugin in `app.config.ts` (Set-deduped, appears exactly once).
- Created dependency-free `__mocks__/expo-notifications.ts` and `__mocks__/expo-task-manager.ts` doubles covering the full Wave-0 surface (schedule/cancel/getAll with a seedable full-request backing array, channels, categories, permissions, response listener, cold-start get/clear, `setNotificationHandler` recording its handler, `AndroidImportance.LOW`, `DEFAULT_ACTION_IDENTIFIER`, `defineTask` recording name+callback).
- Created `src/services/notifications/notification-ids.ts` — the single source of truth for identifiers, channel/category/action ids, generic body copy, `NotificationData`, and the pure deterministic `actionUid` — TDD'd with 14 co-located vitest cases (RED then GREEN).

## Task Commits

Each task was committed atomically:

1. **Task 1: Install expo-notifications + expo-task-manager, register plugin** - `5165735` (feat)
2. **Task 2: Node-safe expo-notifications + expo-task-manager test doubles** - `a4b910d` (test)
3. **Task 3: Shared notification-ids constants module (TDD)** - `6f68d8e` (feat; RED+GREEN in one commit)

## Files Created/Modified
- `package.json` / `package-lock.json` - expo-notifications ~57.0.11 + expo-task-manager ~57.0.10 dependencies
- `app.config.ts` - expo-notifications string plugin added to the deduped Set (exactly once; no tuple)
- `__mocks__/expo-notifications.ts` - vitest double: stubs + enums + DEFAULT_ACTION_IDENTIFIER + seedable getAllScheduled + __reset
- `__mocks__/expo-task-manager.ts` - vitest double: defineTask (records name+callback), isTaskDefined, __reset
- `src/services/notifications/notification-ids.ts` - identifiers, channels, category/actions, body builders, NotificationData, actionUid
- `src/services/notifications/notification-ids.test.ts` - 14 cases

## Decisions Made
- **expo-task-manager provenance (Assumption A1 / T-11-SC closed):** resolved to `~57.0.10`; it is first-party Expo (github.com/expo/expo monorepo, SDK-bundled, the documented peer of `registerTaskAsync`) — same provenance/verdict as expo-notifications. Installed via `npx expo install` so the SDK pin resolved. No `[ASSUMED]`/`[SUS]`/`[SLOP]` package, so no blocking-human legitimacy checkpoint was required.
- **expo-notifications resolved to `~57.0.11`.**
- Bare string plugin only (no plugin options); no `google-services.json`, no exact-alarm permission, no FCM config — the FCM-less path is the decided architecture (CONTEXT §Timing & controls, OQ-3).
- `expo-task-manager` ships no config plugin, so it adds no plugins entry — installing the dependency alone is sufficient.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The dedup-verification tsx probe initially failed on an ESM/CJS interop quirk (`m.default` was the module namespace, not the function); re-ran resolving `typeof mod === "function" ? mod : mod.default`. Result confirmed `expo-notifications` appears exactly once. No code change.
- Pre-existing unrelated Vite config warning ("ESM syntax in a file loaded as CommonJS", vitest.config.ts) prints on every vitest run — not introduced here, tests pass.

## Native / Build Note (prebuild requirement)
Task 1 changes native config. On-device verification therefore requires `expo prebuild --clean` + a release APK via the desktop-build pipeline (`docs/runbooks/desktop-build-pipeline.md`) — this Linux box cannot build APKs. The phase-gate Pixel-UAT must confirm: the prebuild succeeds on droid with the plugin registered (no duplicate-plugin error) and `registerTaskAsync` resolves at runtime. Not executed here (out of scope for a sequential-executor on this box).

## Verification Results
- `npx vitest run` — **721/721 pass** (58 files), including the 14 new notification-ids cases.
- `npx tsc --noEmit` — clean.
- `npm run check:colors` — clean.
- `npx biome check` on new files — clean.
- app.config.ts plugins array contains `expo-notifications` exactly once (tsx probe).

## Next Phase Readiness
- Downstream notification plans (channels, actions, scheduler, response gate, cold-start handler, foreground handler) can now import `notification-ids` for a single identifier/copy/idempotency source and drive their unit suites against the two node-safe doubles.
- Native runtime (prebuild + registerTaskAsync) stays a phase-gate Pixel-UAT item, per the MVP sequencing exception.

## Self-Check: PASSED

All created files exist on disk; all task commits (`5165735`, `a4b910d`, `6f68d8e`) present in git history.

---
*Phase: 11-actionable-notifications*
*Completed: 2026-08-16*
