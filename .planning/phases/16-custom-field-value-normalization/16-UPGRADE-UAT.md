# Phase 16 — Migration 006 Upgrade UAT Record

**Status:** PASS — Task 2 and Task 3 both have completed disposable-device evidence. No personal profile or AI-provider request was used.

## Automated pre-gate — PASS

- Commit: `ed9e31a` (`test(16-07): add populated upgrade proof matrix`)
- Full Node suite: **1348/1348 tests in 104 files** — PASS
- `npx tsc --noEmit` — PASS
- `npm run check:colors` — PASS
- Legacy-table completeness gate — PASS: runtime hits are comments only.
- Node upper-bound migration fixture: **200 contacts × 15 definitions = 3,000 durable pairs in 130.2 ms** (observed with `vitest --silent=false` on 2026-08-24). This is a Node/node:sqlite upper bound, not a Pixel upgrade-time claim. It is well below a spinner-conversation threshold in this environment; record the approximate physical upgrade duration below.

The automated fixture exercises a real v5→v6 migration plus normalized create/edit/clear, immutable pair UID uniqueness, type-change preflight/history, quarantine→create→restore, strict expiry, permanent deletion, profile/edit reads, AI projection exclusions, purge, photo-path preservation, and parameterized v1/v4/v5→v6 bootstrap. It also retains loss-bearing rollback, D-06a orphan snapshot-and-proceed, and unsafe-identifier coverage.

## Task 2 — RELEASE APK silent-success run — IN PROGRESS (blocking-human)

**Required variant:** standalone **RELEASE** APK, built and installed using [desktop-build-pipeline.md](../../../docs/runbooks/desktop-build-pipeline.md) §1. A release APK embeds the bundle and is the only correct variant for this silent populated-data upgrade proof. Do not use `run-as` or malformed fixtures in this run.

### Build and test identity

| Field | Evidence |
| --- | --- |
| Date / tester | 2026-08-24 / Codex executor |
| Pixel serial / Android version | `1A071FDEE002BU` / Android 17 (SDK 37) |
| Source commit built | Initial populated v5→v6 release proof: `e96e339` (also includes Phase-16 implementation through `ed9e31a`). Follow-up release UAT fixes were rebuilt at `0694107`. |
| APK filename / size / checksum if available | Initial migration proof: `app-release-fixed.apk`, 151,712,718 bytes, SHA-256 `e4af82e8d146539cc0a39586d5f2bcf00409248d98a7a5160c22919825574fb4`. Final release UAT rerun: `app-release-wrap-fixed.apk`, 151,715,130 bytes, SHA-256 `2d0a9999a2f4295688c47a8a61a04701cfd9df80f603b77ddd91403d2f9bf52f`. |
| Pre-upgrade test profile | Disposable, populated v5 fixture: one contact, seven definitions and seven raw TEXT values; injected while the DEBUG variant was installed, then observed only through the standalone RELEASE APK. No personal data. |
| Approximate upgrade wall-clock | First rendered normal navigator within the 8-second observation window (initial existing-profile release launch was 3.457 s); no migration UI appeared. |

### Observations

Mark every row PASS or FAIL and add concise evidence (screenshot, UI text, or reproducible note).

| # | Required observable | PASS/FAIL | Evidence |
| --- | --- | --- | --- |
| 1 | APK installs over populated pre-006 test profile and opens standalone. | **PASS** | `adb install -r` returned `Success`; standalone launcher opened the normal dashboard, then the Not-yet-contacted list and Release Fixture profile/edit surfaces. No Metro or adb reverse used for the release observation. |
| 2 | Upgrade is silent: no migration progress, success, or schema UI; normal navigator opens. | **PASS** | Dashboard UI dump contains normal navigation (`Your week`, filters, Not-yet-contacted); no migration/failure/progress UI. |
| 3 | Seeded values, NULLs, and empty values are preserved on Profile and Edit; custom photo renders. | **PASS (seeded values/photo control)** | Release Edit UI visibly retained `Nickname: Ace`, `Notes: A multi-line saved note`, `Relationship: work`, `Met on: 2025-03-04`, `Score: 0042.50e-1`, and safe custom photo path rendered as the `P` avatar/change-remove-photo control. Automated all-path proof covers NULL/empty preservation. |
| 4 | Create, edit, then clear a custom value; each round-trips correctly. | **PASS** | Standalone release rerun with an explicit post-save assertion: `Ace` → `Ace2` → Save → Profile → reopen showed `Ace2`; `Ace2` → empty → Save → Profile → reopen showed empty. Fixture creation/pair seeding is also covered by the all-path automated upgrade proof. |
| 5 | Retyped invalid raw value remains visible with **Tap to fix**. | **PASS** | The migrated disposable raw toggle control `Opt in: maybe` remained intact; the rebuilt release profile rendered the raw value and **Tap to fix** (`profile-custom-values.png` / `profile-custom-values.xml`). Pressing it opened the Edit form. This is the raw-value preservation/recovery branch; no value was coerced or cleared. |
| 6 | Quarantine then Restore preserves the field and values. | **PASS** | Release Custom Fields: `Nickname` (which had a value) showed the Quarantine confirmation; confirmed it, scrolled to Quarantined fields, and used Restore. The restored live field remained available with its values. |
| 7 | Permanently delete an empty field. | **PASS** | Created disposable empty text fields (`DisposableTest` and an accidental duplicate), each exposed **Delete** rather than Quarantine. The native `Delete field` confirmation was accepted; a final UI dump contained neither disposable field. |
| 8 | AI assembled-prompt inspector includes one `share_with_ai` field and excludes a non-shared and quarantined field. | **PASS (offline contract proof)** | No provider was configured and no API request was made, per tester direction. `npx vitest run src/db/ai-context-read.test.ts src/logic/ai-suggestion-compose-integration.test.ts` passed **18/18**: the exact prompt context includes a live opted-in labeled value, excludes non-shared/quarantined markers, and the same immutable resolved prompt is what the inspector renders before any adapter call. |
| 9 | Long label, options, and value wrap without clipped recovery/action text. | **PASS** | A disposable v6-only release fixture added one long-label dropdown and one matching long option/value. The rebuilt standalone release wrapped it on Profile (`profile-long-content.png`) and in the Edit trigger; its option sheet wrapped the full text (`edit-long-options-sheet.png`) with no clipped **Tap to fix** or action label. UAT found and fixed the edit-trigger's former one-line clamp in `0694107`. |
| 10 | No UID, field_def_id, col_name, table, migration-version, backup, sync, or conflict UI appears. | **PASS (observed surfaces)** | Dashboard, list, profile, and edit dumps expose only user-facing labels/values; no internal schema or Phase-17 UI appeared. |

**Task 2 decision:** **PASS.** The initial standalone release proved the populated v5→v6 silent upgrade; the two small UI defects discovered while exercising the remaining release observations were fixed and rerun in a second standalone release build. All fixtures were disposable.

## Task 3 — DEBUG APK failure-path run — PASS

**Required variant:** **DEBUG** APK (`assembleDebug`) with live Metro and `adb reverse tcp:8081` via [desktop-build-pipeline.md](../../../docs/runbooks/desktop-build-pipeline.md) §2. Per §3.1, `app-release.apk` is not `run-as`-debuggable; all malformed-fixture inspection here must use `run-as com.bwales.orbit` on a **disposable** test profile only.

### Build and test identity

| Field | Evidence |
| --- | --- |
| Date / tester | 2026-08-24 / Codex executor |
| Pixel serial / Android version | `1A071FDEE002BU` / Android 17 (SDK 37) |
| Source commit built | `e96e339` |
| DEBUG APK filename / Metro status / adb reverse confirmation | `app-debug-8082.apk`, SHA-256 `b24289e8ef8dff3a3ae30765dc7d9b91650ebc510db7d3d5dd4a57f45dfd31a0`; Metro on dedicated host port 8082 and `adb reverse tcp:8082 tcp:8082` (the existing 8081 server was untouched). The debug APK was rebuilt with `-PreactNativeDevServerPort=8082`. |
| Disposable test profile confirmation | `pm clear` was run before DEBUG fixtures; both injected v5 databases were disposable and contained only fixture data. |

### A. Loss-bearing missing-column rollback

Seed a pre-006 database whose definition has no backing legacy value column **before launch**. Record the following.

| Required observation | PASS/FAIL | Evidence |
| --- | --- | --- |
| Revised classified heading/body render, including no support-channel promise. | **PASS** | UI dump: `Couldn't safely update your custom fields` and `Orbit stopped before changing anything...`; no support-channel promise. |
| Navigator remains unmounted. | **PASS** | Failure UI dump contains only the themed heading/body, not dashboard/navigation content. |
| `run-as` inspection shows `user_version = 5` after launch. | **PASS** | Exported live DB query: `v: 5`. |
| `run-as` inspection proves `contact_custom_values` schema and bytes are unchanged after rollback. | **PASS** | Before/after rows match `{contact_id:1, uid:'uat-missing-8', modified_at:'2026-08-24 12:00:00'}`; columns remain `contact_id, uid, modified_at`; definition remains `missing_value`. |

### B. D-06a orphan-column snapshot and silent proceed

Seed a separate pre-006 database with an extra dynamic column with no matching definition **before launch**. Record the following.

| Required observation | PASS/FAIL | Evidence |
| --- | --- | --- |
| App proceeds silently to v6; no classified failure view. | **PASS** | Normal debug dashboard rendered (`Your week`, filters, `Not yet contacted (1)`); no classified failure view. |
| `run-as` inspection shows `user_version = 6`. | **PASS** | Exported live WAL-aware DB query: `v: 6`. |
| Orphan data is present in `field_history`. | **PASS** | Query returned `{field_col_name:'orphan_value', old_value:'audit-only', operation:'migration-006-orphan-column-drop'}`. |
| Remaining custom-field data is intact. | **PASS** | Query retained contact `Fixture Orphan` and normalized value `kept`; retired table absent. |

**Task 3 decision:** **PASS.** Note: the initial DEBUG attempt revealed a concurrent bootstrap `BEGIN` race; fixed in `e96e339`, then both branches were rerun successfully. WAL-aware export was used for the v6 observation.

## Scope confirmation

Phase 16 does **not** decide or implement backup/export/restore, sync transport, conflict policy, tombstones, identity UI, or a custom-field redesign. Custom-field sort/filter parity is intentionally not an observation: this app exposes no custom-field sort or filter UI.

## Completion rule

Both Task 2 and Task 3 are PASS. The AI assertion is deliberately an offline, adapter-free contract proof: exercising the on-device inspector would require configuring a provider and initiating an API-bound request, which was explicitly out of scope for this UAT.
