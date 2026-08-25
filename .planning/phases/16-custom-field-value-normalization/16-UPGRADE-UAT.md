# Phase 16 — Migration 006 Upgrade UAT Record

**Status:** PENDING — Task 2 (release success) and Task 3 (debug failure paths) both require physical Pixel evidence.

## Automated pre-gate — PASS

- Commit: `ed9e31a` (`test(16-07): add populated upgrade proof matrix`)
- Full Node suite: **1348/1348 tests in 104 files** — PASS
- `npx tsc --noEmit` — PASS
- `npm run check:colors` — PASS
- Legacy-table completeness gate — PASS: runtime hits are comments only.
- Node upper-bound migration fixture: **200 contacts × 15 definitions = 3,000 durable pairs in 130.2 ms** (observed with `vitest --silent=false` on 2026-08-24). This is a Node/node:sqlite upper bound, not a Pixel upgrade-time claim. It is well below a spinner-conversation threshold in this environment; record the approximate physical upgrade duration below.

The automated fixture exercises a real v5→v6 migration plus normalized create/edit/clear, immutable pair UID uniqueness, type-change preflight/history, quarantine→create→restore, strict expiry, permanent deletion, profile/edit reads, AI projection exclusions, purge, photo-path preservation, and parameterized v1/v4/v5→v6 bootstrap. It also retains loss-bearing rollback, D-06a orphan snapshot-and-proceed, and unsafe-identifier coverage.

## Task 2 — RELEASE APK silent-success run — PENDING (blocking-human)

**Required variant:** standalone **RELEASE** APK, built and installed using [desktop-build-pipeline.md](../../../docs/runbooks/desktop-build-pipeline.md) §1. A release APK embeds the bundle and is the only correct variant for this silent populated-data upgrade proof. Do not use `run-as` or malformed fixtures in this run.

### Build and test identity

| Field | Evidence |
| --- | --- |
| Date / tester | **PENDING** |
| Pixel serial / Android version | **PENDING** |
| Source commit built | **PENDING** |
| APK filename / size / checksum if available | **PENDING** |
| Pre-upgrade test profile | **PENDING:** populated pre-006 data only; never personal data |
| Approximate upgrade wall-clock | **PENDING** |

### Observations

Mark every row PASS or FAIL and add concise evidence (screenshot, UI text, or reproducible note).

| # | Required observable | PASS/FAIL | Evidence |
| --- | --- | --- | --- |
| 1 | APK installs over populated pre-006 test profile and opens standalone. | **PENDING** | |
| 2 | Upgrade is silent: no migration progress, success, or schema UI; normal navigator opens. | **PENDING** | |
| 3 | Seeded values, NULLs, and empty values are preserved on Profile and Edit; custom photo renders. | **PENDING** | |
| 4 | Create, edit, then clear a custom value; each round-trips correctly. | **PENDING** | |
| 5 | Retyped invalid raw value remains visible with **Tap to fix**. | **PENDING** | |
| 6 | Quarantine then Restore preserves the field and values. | **PENDING** | |
| 7 | Permanently delete an empty field. | **PENDING** | |
| 8 | AI assembled-prompt inspector includes one `share_with_ai` field and excludes a non-shared and quarantined field. | **PENDING** | |
| 9 | Long label, options, and value wrap without clipped recovery/action text. | **PENDING** | |
| 10 | No UID, field_def_id, col_name, table, migration-version, backup, sync, or conflict UI appears. | **PENDING** | |

**Task 2 decision:** **PENDING.** A failure stops this record for remediation; do not begin Task 3 until Task 2 is PASS.

## Task 3 — DEBUG APK failure-path run — PENDING (blocking-human)

**Required variant:** **DEBUG** APK (`assembleDebug`) with live Metro and `adb reverse tcp:8081` via [desktop-build-pipeline.md](../../../docs/runbooks/desktop-build-pipeline.md) §2. Per §3.1, `app-release.apk` is not `run-as`-debuggable; all malformed-fixture inspection here must use `run-as com.bwales.orbit` on a **disposable** test profile only.

### Build and test identity

| Field | Evidence |
| --- | --- |
| Date / tester | **PENDING** |
| Pixel serial / Android version | **PENDING** |
| Source commit built | **PENDING** |
| DEBUG APK filename / Metro status / adb reverse confirmation | **PENDING** |
| Disposable test profile confirmation | **PENDING** |

### A. Loss-bearing missing-column rollback

Seed a pre-006 database whose definition has no backing legacy value column **before launch**. Record the following.

| Required observation | PASS/FAIL | Evidence |
| --- | --- | --- |
| Revised classified heading/body render, including no support-channel promise. | **PENDING** | |
| Navigator remains unmounted. | **PENDING** | |
| `run-as` inspection shows `user_version = 5` after launch. | **PENDING** | |
| `run-as` inspection proves `contact_custom_values` schema and bytes are unchanged after rollback. | **PENDING** | |

### B. D-06a orphan-column snapshot and silent proceed

Seed a separate pre-006 database with an extra dynamic column with no matching definition **before launch**. Record the following.

| Required observation | PASS/FAIL | Evidence |
| --- | --- | --- |
| App proceeds silently to v6; no classified failure view. | **PENDING** | |
| `run-as` inspection shows `user_version = 6`. | **PENDING** | |
| Orphan data is present in `field_history`. | **PENDING** | |
| Remaining custom-field data is intact. | **PENDING** | |

**Task 3 decision:** **PENDING.** Attach the relevant `run-as` inspection output or transcribe it above.

## Scope confirmation

Phase 16 does **not** decide or implement backup/export/restore, sync transport, conflict policy, tombstones, identity UI, or a custom-field redesign. Custom-field sort/filter parity is intentionally not an observation: this app exposes no custom-field sort or filter UI.

## Completion rule

Do not mark this record complete until both Task 2 and Task 3 are PASS with the physical-device evidence requested above. A final `16-07-SUMMARY.md` is intentionally absent until then.
