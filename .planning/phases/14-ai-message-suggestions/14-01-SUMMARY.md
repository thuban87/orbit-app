---
phase: 14-ai-message-suggestions
plan: 01
subsystem: db + ai-settings
status: complete
tags: [ai, settings, migration, securestore, egress-guard, ssrf]
requires: []
provides:
  - migration004 (app_settings AI columns, registered)
  - AppSettings AI fields + save-time endpoint validation
  - validateCustomEndpoint (shared URL-literal egress guard)
  - ai-key-store (provider-scoped SecureStore repository)
  - ai-types neutral provider/config/request types
  - non-public-vectors.json (shared JS/Kotlin manifest)
affects:
  - app_settings (schema v3 -> v4)
  - AiService.ts (compile only — untouched, L1)
tech-stack:
  added: [expo-secure-store@~57.0.1]
  patterns: [injected-dependency-repository, table-driven-cidr-guard, additive-forward-only-migration]
key-files:
  created:
    - src/db/migrations/004-ai-settings.ts
    - src/db/migrations/004-ai-settings.test.ts
    - src/services/ai-key-store.ts
    - src/services/ai-key-store.test.ts
    - src/ai/custom-endpoint.ts
    - src/ai/custom-endpoint.test.ts
    - src/ai/__fixtures__/non-public-vectors.json
  modified:
    - package.json
    - package-lock.json
    - app.config.ts
    - src/db/database.ts
    - src/db/app-settings-dao.ts
    - src/db/app-settings-dao.test.ts
    - src/services/ai-types.ts
    - src/services/notifications/notification-schedule.test.ts
decisions:
  - "Provider keys live ONLY in expo-secure-store; app_settings has no credential column (asserted via pragma)."
  - "Custom-endpoint rejection set is a table constant driven by a shared JS/Kotlin vector manifest (C4-H1/C5-H1)."
  - "ai_ack_* columns are excluded from the generic write map so only Plan 05's acknowledgeProvider can set them (C3-H3a)."
metrics:
  tasks: 2
  commits: 2
  files_created: 7
  files_modified: 8
  tests_added: 96 (Task 1) + new 004/DAO cases (Task 2); full suite 1121 passing
  completed: 2026-08-21
---

# Phase 14 Plan 01: AI Settings Schema, Key Boundary & Custom-Endpoint Guard Summary

Established the disabled-by-default AI settings schema (registered migration 004),
the device-only credential boundary (expo-secure-store), and the single shared
Custom-endpoint URL-literal egress guard — so every later provider/UI flow starts
from a typed, export-safe, opt-in state with no key ever entering SQLite.

## What was built

### Task 1 — key repository, neutral types, shared validator (commit 289cbdb)
- Installed `expo-secure-store@~57.0.1` via `npx expo install`; `package.json`
  **and** `package-lock.json` committed (M2). Registered the `expo-secure-store`
  config plugin (bare-string) in `app.config.ts` per the install instruction.
- `src/services/ai-key-store.ts`: a narrow **injected-dependency** repository
  mapping one cloud provider to one namespaced SecureStore item
  (`orbit.ai.key.<provider>`). Exposes only `getKey`/`setKey`/`deleteKey` for a
  single provider — no bulk/all-keys accessor, no serialization into settings.
  The native module is loaded via a lazy `import("expo-secure-store")` **inside
  each backend method**, so node/vitest never pull the native module into the
  graph. A missing/failed read degrades to `null` (ordinary reconfiguration).
  No `requireAuthentication` (T-14-02).
- `src/services/ai-types.ts`: added `AI_PROVIDER_IDS` (runtime source of truth
  for DAO validation), `AiCloudProviderId`, `AiProviderConfig`,
  `AiGenerationRequest`. Legacy `aiApiKey`/`aiApiKeys` retained intact (L1) —
  `AiService.ts` untouched and still compiles.
- `src/ai/custom-endpoint.ts`: single `validateCustomEndpoint(raw)` used by BOTH
  the DAO (save-time) and the future Plan 02 adapter (request-time). Empty input
  is the valid "unconfigured" state (C3-M5). Non-empty must be `https:`, host
  present, no credentials, not `.local`, and not any IP literal in the canonical
  non-public set. The rejection set is exported CIDR tables
  (`NON_PUBLIC_IPV4_CIDRS` / `NON_PUBLIC_IPV6_CIDRS` + IPv4-mapped/NAT64 unwrap
  prefixes) with a full BigInt IPv6 parser. All reason strings are static and
  never echo the raw URL/credentials.
- `src/ai/__fixtures__/non-public-vectors.json`: the shared, machine-readable
  `{address, expect}` manifest (representative + boundary per canonical row plus
  public accepts, incl. the C5-H1 additions). The Vitest suite iterates it; Plan
  07's Kotlin/JVM suite will read the SAME file (C5-H1 part-3).

### Task 2 — migration 004 + DAO extension (commit ba21c48)
- `src/db/migrations/004-ai-settings.ts`: 10 additive `ALTER TABLE app_settings
  ADD COLUMN` statements (`ai_provider` default `'none'`, empty config strings,
  four `ai_ack_*` default 0). No secret/key column. Migrations 001–003 untouched.
- `src/db/database.ts`: imported `migration004`, added it to the `runMigrations`
  array, and bumped `TARGET_VERSION` 3 → 4 (H6 — the only registration point;
  no `migrations/index.ts` created).
- `src/db/app-settings-dao.ts`: `AppSettings`/`AppSettingsRow`/SELECT read all 10
  new fields. Generic write surface (`COLUMN_OF`, now typed to a
  `WritableSettingsKey` union) exposes only the five config fields; the four
  `ai_ack_*` columns are excluded so a generic patch cannot set them (C3-H3a).
  Provider validated against `AI_PROVIDER_IDS`; a non-empty `aiCustomEndpoint`
  is validated via `validateCustomEndpoint` before the UPDATE opens (H2), an
  empty value clears it (C3-M5), and changing the endpoint resets `ai_ack_custom`
  to 0 in the SAME transaction (C3-H3b).

## Verification / gate outcomes

| Gate | Command | Result |
|---|---|---|
| Task 1 suites | `vitest run ai-key-store.test.ts custom-endpoint.test.ts` | 96 passed |
| Task 2 suites | `vitest run 004-ai-settings.test.ts app-settings-dao.test.ts notification-schedule.test.ts` | 80 passed |
| Full suite | `npx vitest run` | 86 files, **1121 passed** |
| Typecheck | `npx tsc --noEmit` | clean (AiService.ts unchanged, L1) |
| Colour gate | `npm run check:colors` | clean |
| Registration | `grep "TARGET_VERSION = 4"` / `grep -c "migration004"` | present / **2** (import + array) |
| No credential column | 004 test pragma-column assertion | passes (no key/secret/token/... column) |
| Lockfile (M2) | `git status --porcelain package-lock.json` | committed in 289cbdb |

## Deviations from Plan

**1. [Rule 3 — Blocking] Bumped `notification-schedule.test.ts` to schema v4**
- **Found during:** Task 2, running the full suite after extending the DAO read.
- **Issue:** `notification-schedule.ts`'s reconcile calls `getAppSettings`, whose
  SELECT now references the migration-004 AI columns. That test migrated only to
  v3, so `getAppSettings` would hit "no such column" at runtime.
- **Fix:** Imported `migration004` and migrated the test DB to v4 (target 4).
  This is a test-only schema bump, no behaviour change.
- **File modified:** `src/services/notifications/notification-schedule.test.ts`
  (not in the plan's `files_modified` list). **Commit:** ba21c48.

**2. [Housekeeping] Removed now-dead `migrateToV3` helper** in
`app-settings-dao.test.ts` (all DAO-read callers moved to v4; the v2 migration
tests still use `migrateToV2`). Biome flagged it as unused. Commit ba21c48.

No other deviations — the plan executed as written.

## Known Stubs

None. All wired: the validator is import-ready for the DAO (already consumed) and
the Plan 02 adapter; the key store is a live singleton; migration 004 is applied
by the runner.

## Notes for later plans

- **Plan 02** removes legacy `aiApiKey`/`aiApiKeys` and rewrites `AiService` to
  read keys from `ai-key-store` and call `validateCustomEndpoint` at request time
  (the module is already shared — do not add a second validator).
- **Plan 05** adds the dedicated `acknowledgeProvider` writer — the ONLY path
  allowed to set an `ai_ack_*` column to 1 (the generic patch cannot).
- **Plan 07** must consume `src/ai/__fixtures__/non-public-vectors.json`
  byte-identically and mirror the exported CIDR tables so the native resolved-host
  guard enforces the provably identical set (C4-H1).

## Self-Check: PASSED
- Created files verified on disk: `004-ai-settings.ts`, `ai-key-store.ts`,
  `custom-endpoint.ts`, `ai-types.ts` (extended), `non-public-vectors.json`.
- Commits verified in `git log`: 289cbdb (Task 1), ba21c48 (Task 2).
