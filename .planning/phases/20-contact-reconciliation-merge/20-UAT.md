---
phase: 20-contact-reconciliation-merge
doc: device-UAT evidence log + fixture registry
device: Pixel 6 Pro (serial 1A071FDEE002BU, API 37)
package: com.bwales.orbit (DEBUGGABLE build, installed 2026-08-30 23:15)
started: 2026-08-31
status: in-progress
---

# Phase 20 — Consolidated Device UAT

Runbook/navigation source: `20-UAT-RUNBOOK-RESEARCH.md` (code-verified).
Baseline snapshot + integrity manifest: scratchpad `baseline/PRE-UAT-BASELINE.md`.

## Isolation guarantee
- All fixtures use device-contact + Orbit name prefix **`ZZ-UAT-`**.
- Pre-existing rows that must remain UNTOUCHED: contacts id 1–6 (id 3–6 are the owner's
  real family PII), external_contact_links id 1–5, import_sessions id 1–4,
  import_session_rows id 1–6, contact_methods id 1–22, interactions id 1–2.
- Every destructive step resolves IDs from the DB by the `ZZ-UAT-` prefix before acting.

## Verified device-driving procedure (learned this session)
- **Create device-local contacts:** on-device shell script via ContactsProvider `content insert` (null account = device-only, never synced). Host-side `--where` quoting mangles; push `.sh` to `/data/local/tmp`. Real contacts are `account_type=com.google` — never touched.
- **adb input by control type:** plain `input tap` for RN chips/rows; **`input touchscreen tap`** for gesture-handler buttons (gear/FAB/import buttons/action bars); **`input touchscreen swipe X Y X Y 800`** (long-press) to SELECT CandidateCardGrid cards (a plain tap = onInspect). Settings gear must be tapped at its LOWER strip (y≈172) to clear the status bar.
- **Import path:** FAB → "Import from Contacts" → picker (search `ZZ-UAT`, tap rows, Done) → "Resume import" → BulkImportSetup "Import N contacts" → ImportComplete → "Review possible matches" → long-press cards → "Choose action" → "Import as New" → Done.
- **DB read:** `run-as com.bwales.orbit cat files/SQLite/orbit.db{,-wal,-shm}` then open WAL-aware with node:sqlite.

## Fixture registry
device raw_contact id ↔ Orbit contact id ↔ external_contact_link id

| Fixture (name) | Device raw_id | Orbit contact id | ext_link id | Role |
|---|---|---|---|---|
| ZZ-UAT-Smoke-Ada | 1130 | 7 | 6 | smoke / spare Bound (bday 1992-06-15) |
| ZZ-UAT-Bday-Flag | 1131 | 8 | 7 | Scenario 7 Fix (bday 2021-02-29 → flagged → fixed to 1990-05-14) |
| ZZ-UAT-Clean (phone) | 1132 | 9 (survivor, live) | — | Scenario 1 survivor |
| ZZ-UAT-Clean (email) | 1133 | 10 (merged→tombstone) | — | Scenario 1 absorbed |
| ZZ-UAT-M-Ann | 1134 | 11 (survivor, live) | — | Scenario 2 survivor |
| ZZ-UAT-M-Anne | 1135 | 12→tombstone (id reused) | — | Scenario 2 absorbed |
| ZZ-UAT-R3-Solo | 1136 | 12 (id reused) | link12 | Scenario 3 (blocked); device-edited (+phone, renamed) |
| ZZ-UAT-B4a-Add | 1137 | 13 | link13 | Scenario 4 additive (blocked); +phone added |
| ZZ-UAT-B4b-Conf | 1138 | 14 | link14 | Scenario 4 conflict (blocked); renamed |
| ZZ-UAT-B4c-Same | 1139 | 15 | link15 | Scenario 4 unchanged (blocked) |
| ZZ-UAT-Ignore | 1140 | 16 | link16 | Scenario 7b Ignore (bday 2021-02-29 → ignored) |
| ZZ-UAT-Filler | 1141 | 17 | link17 | 7b bulk-path filler |

## Scenario evidence
Status legend: ⬜ not started · 🟡 in progress · ✅ pass · ❌ fail · ⚠ pass-with-note

| # | Scenario | Status | Evidence |
|---|---|---|---|
| 0 | Toolchain smoke (device→Orbit import→DB) | ✅ | Contacts 7,8 imported as Bound; import row 8 flagged unreadable-birthday. DB-verified. |
| 1 | Merge atomic → survivor + tombstone | ✅ | c10 merged into c9: c10 absent, tombstone{contact,028d25cb}, methods reparented. Independently DB-verified. |
| 2 | Merge with name/birthday/primary conflicts | ✅ | c12→c11: 4 conflict groups shown; survivor kept name/bday, absorbed primary-phone won (+…0422 is_primary=1); tombstone{contact,2e5f9b39}. Independently DB-verified. |
| — | ADR-003 permission fix (READ_CONTACTS on API 37) | ✅ | Rebuilt; APK ships READ_CONTACTS uncapped, granted on device; "Update from Contacts" prompts + reads. Independently verified. |
| 3 | Per-contact Update from Contacts (additive/conflict/no re-nag) | 🟡 PARTIAL | Additive path VERIFIED (c13). Name-conflict + no-re-nag need a non-rename fixture (Finding A). |
| 4 | Bulk Check linked (only-changed / partial / counts / no Use-Contact-Values on conflict) | ⛔ BUG B | Bulk scan crashes on full 14-contact set → "Could not check linked contacts". See 20-UAT-FINDINGS-reconcile-bugs.md. |
| 5 | Kill mid-review → Resume preserves applied | ⬜ | Needs a working bulk session (Bug B). |
| 6 | Deleted source → Source missing → Relink | ⬜ | Not yet attempted (independently runnable). |
| 7a | Review flagged items — **Fix** | ✅ | contact 8 bday→1990-05-14; bulk_review_resolutions{row8,birthday,fixed}; UI "Nothing to review". DB-verified. |
| 7b | Review flagged items — **Ignore** | ✅ | contact 16 ZZ-UAT-Ignore: bulk_review_resolutions{row17,birthday,ignored}; birthday stays NULL, no other change. Independently DB-verified. |

Accepted v1 limitation to record (not a failure): after a merge, the survivor's
notification refresh is eventually-consistent (reconciled at the next foreground
launch sweep), per 20-06-PLAN.md.

## Execution notes / evidence detail
(chronological)
