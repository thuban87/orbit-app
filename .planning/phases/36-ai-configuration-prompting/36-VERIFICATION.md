---
phase: 36-ai-configuration-prompting
verified: 2026-09-14T18:55:00Z
status: passed
score: 108/108 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 101/108
  gaps_closed:
    - "OpenRouter browser authorization now completes through an owner-approved one-shot localhost callback on the physical Pixel."
    - "The seven retained device and visual backstops are recorded passed in 36-UAT.md."
  gaps_remaining: []
  regressions: []
advisory_prohibition_reviews:
  - "36-01 judgment: AI is opt-in and permission defaults ship off — supported by code audit; no contrary UAT evidence."
  - "36-02 judgment: OpenRouter models/pricing/recommendations are runtime data — supported by code audit; no contrary UAT evidence."
  - "36-02 judgment: catalog refresh is not on a general read/app-launch path — supported by code audit; no contrary UAT evidence."
  - "36-03 judgment: personalization cannot replace the immutable system contract — supported by code audit; no contrary UAT evidence."
  - "36-04 judgment: permission UI exposes semantic labels, not raw storage ids — supported by code audit; no contrary UAT evidence."
  - "36-05 judgment: Custom is described as advanced OpenAI-compatible HTTPS, not arbitrary HTTP — supported by code and device UI evidence."
  - "36-06 judgment: personalization is subordinate to Orbit's system/privacy/output contract — supported by code audit; no contrary UAT evidence."
  - "36-06 judgment: pricing is not fetched per keystroke — supported by local debounce/cache code audit; no contrary UAT evidence."
  - "36-07 judgment: no app-wide Sentry/observability pipeline was introduced — supported by code audit; no contrary UAT evidence."
  - "36-09 judgment: AI-off UI is collapsed to toggle, preservation note, and management escape hatch — supported by code and prior device evidence."
  - "36-09 judgment: no second live legacy provider configuration surface remains — supported by code and device navigation evidence."
---

# Phase 36: AI Configuration & Prompting Verification Report

**Phase Goal:** AI becomes an explicit, user-owned capability — three connection lanes, a real global switch, user-controlled personalization, exact egress permissions, and backup format v5.
**Verified:** 2026-09-14T18:55:00Z
**Status:** passed
**Re-verification:** Yes — after Plan 36-11 localhost OAuth and UAT gap closure

## Goal Achievement

All five roadmap criteria and all 17 AICFG requirements are implemented. Plan 36-11 replaces OpenRouter's unsupported custom-scheme provider callback with the approved on-device loopback callback, and `36-UAT.md` records all seven device/visual checks passed. No automated, implementation, or UAT gap remains.

### Roadmap Success Criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Global master switch preserves all AI configuration and leaves credential management reachable | ✓ VERIFIED | `ai-config-store` writes only `ai_enabled`; `SettingsScreen` renders the off-state escape hatch; availability distinguishes `off`. |
| 2 | Three lanes, one active, activate-on-success, exact model/no substitution | ✓ VERIFIED | `ai_connections` has a unique lane, the active pointer stores a lane, setup activates only after credential/model persistence, exact OpenRouter model lookup is required, Custom credentials are endpoint-bound and optional, and real OpenRouter authorization completed on the Pixel. |
| 3 | Immutable prompt, personalization, estimates/overflow, ephemeral Adjust | ✓ VERIFIED | `resolvePrompt` is the frozen sole builder; Writing Style/sections are subordinate; full-payload overflow is checked locally before egress; Adjust is an ephemeral lifecycle argument. |
| 4 | Exact permission egress, including Message Focus emphasis | ✓ VERIFIED | Generation re-reads current Research eligibility, projects only fresh permitted selections, emits a bounded focus-emphasis DATA block in the exact immutable payload, retains ordinary context, and exposes that exact block in Compose disclosure. |
| 5 | Failures/diagnostics, secure credentials, complete v5 roundtrip and repair | ✓ VERIFIED | Categorized failures preserve session state; diagnostic fields are allowlisted; secrets stay in SecureStore/out of backup; v5 entity/preference/background roundtrip and repair are implemented. |

### Consolidated Must-Haves

The original PLAN frontmatter contributes 107 detailed truths. Roadmap criteria add the non-duplicate Message Focus emphasis contract; closure Plans 36-10 and 36-11 refine existing AICFG-08 and AICFG-03/04 truths without increasing the deduplicated total. All 108 truths are now verified. No truth is failed and no accepted override exists.

| Plan | Truths | Result | Notes |
|---|---:|---|---|
| 36-01 | 13 | ✓ | Migration 029, master switch, lane pointer, readiness, and active generation wiring verified. |
| 36-02 | 10 | ✓ | OAuth/state/catalog/pricing logic verified; Plan 36-11 and physical-device UAT close the unsupported provider-callback assumption. |
| 36-03 | 13 | ✓ | Permitted memories and structured recent interactions flow through the sole prompt builder; Off Limits and Group Notes cannot enter; Adjust is ephemeral. |
| 36-04 | 8 | ✓ | Defaults, search/drill-in, bulk rules, and creation-writer wiring verified; dedup behavior is tested. |
| 36-05 | 12 | ✓ | Three setup lanes, secure key handling, Custom guards, model binding, activation ordering, browser loading, and long-text layout verified. |
| 36-06 | 11 | ✓ | Writing Style, sections/import-copy design, source-deletion durability, long layout, local estimates, cost policy, and pre-egress overflow verified. |
| 36-07 | 9 | ✓ | Exact-byte inspectors, first-use disclosure, failure taxonomy, state preservation, and sanitized diagnostics verified; zero/one grammar has a passing test. |
| 36-08 | 22 | ✓ | Full v5 portable inventory, lane reconciliation, Group Event orphan repair, presentation UID remap, and serialized background finalization verified. |
| 36-09 | 9 | ✓ | Five routes and six entries are wired; AI-off state and first-use disclosure are mounted; device navigation and long-row layout passed. |
| 36-10 / Roadmap AICFG-08 addition | 1 | ✓ | Fresh permission-preserving focus projection, payload emphasis, and exact Compose disclosure verified. |
| 36-11 | refinement | ✓ | One-shot loopback OAuth, native lifecycle cleanup, focused tests, native build, and the final two Pixel checks verified without adding a duplicate truth. |

**Score:** 108/108 truths verified (0 behavior-unverified)

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/db/migrations/029-ai-configuration.ts` + `src/db/database.ts` | Complete Phase-36 schema at version 29 | ✓ VERIFIED | Registered last; `TARGET_VERSION` resolves to 29. No migration 030 exists. |
| `src/db/ai-connections-dao.ts` + `src/stores/ai-config-store.ts` | Durable lane configurations and one active lane | ✓ VERIFIED | Unique lane, lane-valued active pointer, transaction-guarded mutations. |
| `src/logic/ai-availability.ts` | Off/Ready/Needs Attention without substitution | ✓ VERIFIED | Custom credential is optional; hosted lanes require it; exact model availability gates Ready. |
| `src/services/ai-key-store.ts` | Secure, endpoint-bound credentials | ✓ VERIFIED | Provider namespace only; Custom value stores `{version, endpoint, credential}` and rejects a different endpoint. |
| `src/ai/openrouter-oauth.ts` + `src/ai/openrouter-catalog.ts` | PKCE/state OAuth and live cached catalog | ✓ VERIFIED | OpenRouter receives only a dynamic `127.0.0.1` callback carrying state; TypeScript independently validates destination/state before one exchange and SecureStore write; catalog remains public/keyless with daily/manual refresh. |
| `modules/orbit-openrouter-loopback/` | One-attempt Android callback listener | ✓ VERIFIED | Native module binds only loopback on an OS-assigned port, validates exact GET/Host/path/query/state, closes before delivery, rejects malformed/duplicate/stale traffic, and uses a credential-free app wake. Six real-socket JVM tests pass. |
| `.planning/phases/36-ai-configuration-prompting/36-UAT.md` | Physical-device and visual acceptance | ✓ VERIFIED | Seven passed, zero blocked; OpenRouter auth/activation ran on the freshly rebuilt Pixel client and the other five previously passed checks were retained without rerun. |
| `src/db/ai-context-read.ts` | Closed permission projection | ✓ VERIFIED | Latest three interactions; notes only for `allow_ai=1`; no Group Event query; permissioned memories/fields only. |
| `src/ai/message-focus.ts` | Permission-preserving focus projection | ✓ VERIFIED | Uses current rows by stable identity, fresh label/value, deduplication and cap; rejects missing, revoked, ineligible and Off Limits selections. |
| `src/ai/prompt-template.ts` | Immutable sole prompt builder | ✓ VERIFIED | Renders bounded/fence-neutralized Message Focus under Orbit-owned emphasis instructions without removing ordinary permitted context. |
| `src/screens/ComposeScreen.tsx` | Exact request assembly and pre-egress check | ✓ VERIFIED | Re-reads Research at request resolution, projects session focus, attaches it to PromptContext, then sends the same capacity-checked resolved payload. |
| `src/db/ai-permissions-dao.ts` + `src/screens/AIPermissionsScreen.tsx` | Central permission manager | ✓ VERIFIED | Type defaults, search/drill-in, explicit bulk actions, confirmation UI; no Off Limits/Group Notes category. |
| `src/db/personalization-dao.ts` + `src/screens/AIPersonalizationScreen.tsx` | Structured style/sections and copied imports | ✓ VERIFIED | Ordered enableable local records; `.txt/.md` picker copies content and stores no source URI. |
| `src/screens/AIPreviewScreen.tsx` + `src/components/AIComposeContextReview.tsx` | Exact-byte Settings and contact-specific transparency | ✓ VERIFIED | Both derive from the same `ResolvedPrompt`; credentials are absent. |
| `src/backup/types.ts`, `backup-schema.ts`, `export-manifest.ts`, `restore-apply.ts` | Closing v5 wire format | ✓ VERIFIED | All new arrays/preferences, UID remaps, interaction gaps, Group Events, presentation and background bytes flow export-to-restore. |
| `src/services/photos/background-finalization.ts` + reconciliation sweep | Crash-consistent background restore | ✓ VERIFIED | Per-UID serialization owns check/copy/CAS/cleanup; pending marker is transaction-owned and sweep-redriven. |
| Settings routes/hub | Reachable AI management | ✓ VERIFIED | Five screens registered; six ordered entries; legacy inline provider editor removed. |

## Key Link and Data-Flow Verification

| From | To | Status | Evidence |
|---|---|---|---|
| Migration 029 | database registry | ✓ WIRED | `migration029` is final registry entry; `TARGET_VERSION` remains 29. |
| Settings switch | SQLite app settings | ✓ FLOWING | Store hydrates/writes the durable singleton; toggle patch contains only `aiEnabled`. |
| Active connection | Compose provider/model | ✓ FLOWING | Compose resolves the active lane, refreshes `AiService`, and passes its exact model/endpoint. |
| Custom endpoint | SecureStore credential | ✓ FLOWING | Read/write normalize and bind the credential to the persisted endpoint; empty credential is valid. |
| OpenRouter auth URL | native loopback callback | ✓ FLOWING | `startAttempt` returns an already-bound `http://127.0.0.1:<port>/openrouter-auth?state=...`; this exact URL becomes `callback_url` while PKCE remains S256. |
| Native callback | TypeScript exchange | ✓ FLOWING | Native closes the server before retaining one canonical callback; browser receives only `orbit://openrouter-auth`; TypeScript revalidates host/port/path/state and exchanges once. |
| OpenRouter exchange | SecureStore/model activation | ✓ FLOWING | Only the returned key crosses `aiKeyStore.setKey`; connection/model rows are persisted before activation, so failure leaves the prior lane active. |
| SQLite contact data | resolved prompt | ✓ FLOWING | Permissioned fields/memories and latest-three interactions reach deterministic DATA blocks. |
| Message Focus store | fresh Research eligibility | ✓ FLOWING | `projectMessageFocus` intersects selected identities with a new `readComposeResearch` result and uses only current row content. |
| Fresh focused projection | resolved prompt/provider/disclosure | ✓ FLOWING | `PromptContext.messageFocus` becomes a dedicated DATA block in `ResolvedPrompt.payload`; provider uses that object and contact review extracts the exact block. |
| Resolved prompt | provider adapter | ✓ FLOWING | The exact frozen payload is capacity-checked at the final local boundary and transmitted unchanged. |
| Backup exporter | schema/reconciliation/restore | ✓ FLOWING | v5 arrays and portable prefs are emitted, validated, reconciled, and written using portable UIDs. |
| Restored background bytes | pending marker/canonical file | ✓ FLOWING | Stage-before-transaction, row marker in transaction, serialized post-commit finalizer, launch re-drive to `profile-backgrounds/<uid>.jpg`. |

## Non-Negotiable Decision Checks

- `TARGET_VERSION` is 29 and migration 029 is last; no migration 030 exists.
- `BACKUP_FORMAT_VERSION` is 5 with a `4 -> 5` upgrader.
- No background kind was added to `restore_photo_journal`.
- Canonical background paths remain `profile-backgrounds/<uid>.jpg`.
- Off Limits never enters the prompt context, permission surface, or egress; ADR-107 remains enforced.
- No network dependency was introduced into the local read/dashboard path.
- OpenRouter's provider callback is now temporary on-device HTTP loopback only; the retained `orbit://openrouter-auth` intent carries no OAuth material and exists solely to foreground Orbit after native acceptance.
- Decision-coverage verifier reported 15/15 trackable CONTEXT decisions honored. Graph-first queries found the pre-existing governing edges but no nodes for most new Phase-36 files (stale graph); those decisions were therefore checked directly against ADR-049, ADR-051, ADR-078/ADR-107, ADR-079, code, migrations, and every writer of shared tables.

### Decision Coverage

All 15 trackable `36-CONTEXT.md` decisions are honored by shipped artifacts. This gate is non-blocking by contract; it reported no unhonored decision.

## Post-Review Fix Verification

| Fix | Status | Semantic evidence |
|---|---|---|
| Exact OpenRouter model | ✓ | Readiness requires exact cached model id, not merely a nonempty selection. |
| Complete Settings availability | ✓ | Settings derives lane/model/credential/catalog state using the same availability contract. |
| Structured recent interactions | ✓ | Date/channel/tone always project for the latest three; note appears only for `allow_ai=1`. |
| Pre-egress overflow | ✓ | `assertPromptFitsContext` checks the exact resolved payload and selected model immediately before provider fan-out. |
| Custom optional credential + compensation | ✓ | Empty key is accepted; failed configuration deletes a newly stored credential before leaving the prior lane active. |
| Custom endpoint binding | ✓ | Stored credential is bound to the normalized endpoint and fails closed on endpoint mismatch. |
| Lane reconciliation | ✓ | Backup reconciliation normalizes `ai_connections` by lane rather than treating distinct UIDs as distinct lanes. |
| Background transaction ownership/finalization | ✓ | Restore commits the exact pending marker; per-UID lock serializes ownership read, canonical swap, row CAS, and pending cleanup. |
| Message Focus gap closure | ✓ | Fresh current eligibility replaces stale session values; revoked/missing/Off Limits entries are excluded; the bounded focus block changes the exact payload while ordinary permitted context remains. |
| OpenRouter localhost gap closure | ✓ | The listener binds `127.0.0.1:0`, embeds mandatory state in the provider callback, validates it natively and in TypeScript, closes on success/cancel/timeout/destroy/finally, and emits no OAuth material through the wake or HTTP response. |

## Behavioral Spot-Checks

| Check | Result | Status |
|---|---|---|
| `npx tsc --noEmit --pretty false` | exit 0 | ✓ PASS |
| Migration/connections/availability/key/OAuth/catalog (6 files) | 62 tests | ✓ PASS |
| Prompt/context/permissions/personalization/estimate/lifecycle integration (6 files) | 65 tests | ✓ PASS |
| Hub/background/schema/restore group (5 discovered files) | 96 tests | ✓ PASS |
| Export/reconciliation/portable preferences (3 files) | 45 tests | ✓ PASS |
| Connection/permission/settings/lifecycle logic (4 files) | 57 tests | ✓ PASS |
| AiService/model/personalization/diagnostics/background/key-backup group (6 files) | 75 tests | ✓ PASS |
| Message Focus re-verification (6 files) | 73 tests | ✓ PASS |
| Repository regression supplied for this re-verification | 369 files / 3,534 tests passed, excluding only `src/components/orrery/orrery-controls-render.test.tsx` | ✓ PASS; excluded Phase-30 collection failure is pre-existing and not attributed to Phase 36 |
| `npx vitest run src/ai/openrouter-oauth.test.ts` | 18 tests | ✓ PASS |
| Native `:orbit-openrouter-loopback:testDebugUnitTest` report | 6 tests, 0 skipped/failures/errors | ✓ PASS; existing droid XML independently inspected at `2026-09-14T18:25:29Z` |
| Final native debug APK | SHA-256 `ac96562d…2c66ed4` | ✓ PASS; droid artifact, pulled APK, and Pixel-installed package match byte-for-byte |
| Targeted Biome check | 6 files, no fixes | ✓ PASS |

Initial focused verifier execution totaled **30 test files / 400 tests passed**. The Message Focus re-verification independently ran six linked files (**73 tests passed**). This final focused re-verification ran only the permitted OAuth file (**18 tests**) plus a clean TypeScript compile and targeted Biome check; it did not repeat the repository suite, backup/restore gates, broad review, or five prior UAT checks. No `.skip`/`.todo`, circular fixture generation, or debt marker was found in the Plan 36-11 files.

### Probe Execution

No probe script is declared by Plan 36-11, and no conventional Phase-36 probe applies to this user-facing/native gap. Focused TypeScript tests, native JVM socket tests, APK identity, and physical-device UAT provide the execution evidence.

## Physical Device Acceptance

| Check | Evidence | Status |
|---|---|---|
| OpenRouter localhost authorization | OpenRouter presented authorization for the signed-in account, returned through the loopback listener without manual code entry, and opened model selection on Pixel 6 Pro `1A071FDEE002BU`. | ✓ PASS |
| Failure/success activation ordering | The prior OpenAI lane remained active before completion; after validated callback and key persistence, selecting `Cohere: North Mini Code (free)` made OpenRouter active. | ✓ PASS |
| Credential-free wake | Visible completion wake, Orbit UI, Metro delta, and sanitized logcat delta contained no callback code/state. | ✓ PASS |
| Remaining five backstops | Long connection/hub values, personalization layout, imported-copy durability after source deletion/relaunch, Compose repair navigation, and long Settings rows are recorded passed. | ✓ PASS |
| Installed native client | The final droid APK hash matches `/tmp/orbit-phase36-11-debug.apk` and the currently installed `com.bwales.orbit` base APK; manifest contains the exact `orbit://openrouter-auth` wake filter. | ✓ PASS |

## Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| AICFG-01 | ✓ SATISFIED | Durable master toggle, preservation, off-state hub and management escape hatch. |
| AICFG-02 | ✓ SATISFIED | OpenRouter, direct BYOK, and validated Custom lanes; one active lane. |
| AICFG-03 | ✓ SATISFIED | Inactive configurations/models retained; activation occurs only after setup success. |
| AICFG-04 | ✓ SATISFIED | PKCE browser auth, cached live catalog/pricing, curated-first dynamic picker. |
| AICFG-05 | ✓ SATISFIED | Exact selection validation and explicit Needs Attention; no substitution. |
| AICFG-06 | ✓ SATISFIED | Immutable system contract plus structured style and ordered copied local sections. |
| AICFG-07 | ✓ SATISFIED | No arbitrary total ceiling; local estimates/cost and explicit selected-model overflow. |
| AICFG-08 | ✓ SATISFIED | Permissioned context and latest-three interactions are gated as before; Message Focus now adds emphasis only after fresh eligibility revalidation, while Off Limits and Group Notes remain excluded. |
| AICFG-09 | ✓ SATISFIED | Quick/freeform Adjust is ephemeral and returns through the three-variant path. |
| AICFG-10 | ✓ SATISFIED | Defaults/search/drill-in/bulk controls and creation writers are wired; Group Notes absent. |
| AICFG-11 | ✓ SATISFIED | Whole prompt in Settings and contact-specific Compose disclosure use the exact resolved payload. |
| AICFG-12 | ✓ SATISFIED | One-time first-use disclosure is mounted; retired exact-prompt acknowledgement does not gate generation. |
| AICFG-13 | ✓ SATISFIED | Categorized failures, deliberate repair, preserved Compose state, no failover. |
| AICFG-14 | ✓ SATISFIED | Structured diagnostic event copies only safe allowlisted metadata. |
| AICFG-15 | ✓ SATISFIED | Credentials remain in SecureStore and outside settings/backups/logs. |
| AICFG-16 | ✓ SATISFIED | Nonsecret configuration/permissions roundtrip; missing local credentials yield Needs Attention; orphan repair works. |
| AICFG-17 | ✓ SATISFIED | v5 closes milestone inventory, including Group Events, presentation/background bytes, portable preferences, and explicit legacy defaults. |

## Anti-Patterns and Test Quality

- Scanned all 104 source/test files changed from the first Phase-36 implementation commit through `fe1c563`; no unreferenced `TBD`, `FIXME`, or `XXX` blocker marker was found.
- No placeholder/static-return path was found in the required artifacts. Dynamic values trace to SQLite, SecureStore, local files, or provider responses as appropriate.
- The prior hollow Message Focus link is closed through a focused, current-permission projection and the sole immutable builder.
- No circular test was accepted as sole proof for the critical restore, egress, or transaction invariants; focused tests invoke real exported behavior and SQLite operations.
- Plan 36-11's TypeScript tests use value/behavioral assertions for PKCE, exact destination/state, sanitized wake, failure cleanup, one exchange, and one key write. Its six JVM tests use real sockets to prove loopback binding, malformed/slow/oversized rejection, one-time consumption, cleanup, retry, and duplicate-await behavior; none are disabled.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|---|---|---:|---:|---:|---|---|
| `src/ai/openrouter-oauth.test.ts` | AICFG-03/04 | 18 | 0 | 0 | Behavioral/value | ✓ PASS |
| `OrbitOpenRouterLoopbackModuleTest.kt` | AICFG-03/04 | 6 | 0 | 0 | Real-socket behavioral/value | ✓ PASS |

Disabled requirement tests: 0. Circular patterns: 0. Insufficient assertions: 0.

## Advisory Prohibition Review

The 11 prior judgment-tier prohibition notes are preserved in frontmatter as transparent, non-authoritative code-audit advisories. No contrary code or UAT evidence was found, and none represents an observed failure or remaining acceptance check.

## Human Verification Required

None. All seven device/visual checks are passed in `36-UAT.md`.

## Deferred Items

None.

## Gaps Summary

No automated, implementation, or UAT gaps remain. Commit `fcd060d` closes the AICFG-08 Message Focus gap, and Plan 36-11 replaces the unsupported provider callback with the approved loopback listener while retaining PKCE, mandatory exact state, one-time cleanup, SecureStore-only persistence, and activate-on-success ordering. `36-UAT.md` closes all seven retained device/visual observations.

---

_Verified: 2026-09-14T18:55:00Z_
_Verifier: the agent (gsd-verifier)_
