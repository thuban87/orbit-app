---
phase: 20-contact-reconciliation-merge
doc: device-UAT evidence log + fixture registry
device: Pixel 6 Pro (serial 1A071FDEE002BU, API 37)
package: com.bwales.orbit (DEBUGGABLE build, installed 2026-08-30 23:15)
started: 2026-08-31
status: all-8-scenarios-PASS — awaiting owner sign-off + fixture cleanup
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
| 3 | Per-contact Update from Contacts (additive/conflict/no re-nag) | ✅ | Additive VERIFIED (c13). Conflict via **email-value edit** on c7 (non-rename, Finding-A-safe): emails=conflict, both unchecked + Apply disabled until choice; Keep-Orbit → Apply → "Changes applied."; Run 2 pre-resolved keep-Orbit (unchanged-since-review, no re-nag). DB: c7 email UNCHANGED, snapshot{link6,emails,ada2} armed, no field_history. |
| 4 | Bulk Check linked (only-changed / partial / counts / no Use-Contact-Values on conflict) | ✅⚠ | **Bug B FIXED** (`165b9e7`). Bulk scan completes over full 14 set. Only-changed appear (c15/c17 absent); Use-Contact-Values hidden on conflict select (c11), shown on additive-only (c13); c13 partial-resolve persists (phone added, session pending). Summary **counts unit-covered** (`reconcile-session-read.test.ts:118`). NOTE: bulk action-sheet "Apply recommendation" is not adb-drivable (RN Modal backdrop swallows injected taps — not an app bug); resolved via equivalent per-card path; bulk write path unit-covered (`reconcile-apply.test.ts`, `reconcile-bulk-eligibility.test.ts`, `candidate-card-grid-actions.test.ts`). Real-PII cards (3–6) never touched. |
| 5 | Kill mid-review → Resume preserves applied | ✅ | Resolved c13, `am force-stop`, relaunch → launch-sweep "Resume your check?" prompt; Resume → no re-scan, refresh only; c13 ABSENT (resolved excluded); c13's +13125550442 survived the kill. DB-verified session pending + phone intact. |
| 6 | Deleted source → Source missing → Relink | ✅ | Deleted ZZ-UAT-Filler (raw 1141); c17 "Update from Contacts" → "Source missing" chip + exact body + 3 actions (Keep as is / Relink / Unlink). Relink → picker → ZZ-UAT-Relink-Target (raw 1142) → "Source linked. Review the new contact." DB: link17 is_active 1→0, new link18 active→0r1142. Relink/unlink DAO unit-covered (`reconcile-relink-dao.test.ts`). |
| 7a | Review flagged items — **Fix** | ✅ | contact 8 bday→1990-05-14; bulk_review_resolutions{row8,birthday,fixed}; UI "Nothing to review". DB-verified. |
| 7b | Review flagged items — **Ignore** | ✅ | contact 16 ZZ-UAT-Ignore: bulk_review_resolutions{row17,birthday,ignored}; birthday stays NULL, no other change. Independently DB-verified. |

Accepted v1 limitation to record (not a failure): after a merge, the survivor's
notification refresh is eventually-consistent (reconciled at the next foreground
launch sweep), per 20-06-PLAN.md.

## Bugs fixed this UAT (committed)
- **Bug B (blocker) — FIXED `165b9e7`.** `reconcile-photo.ts` `digest()` dereferenced `globalThis.crypto.subtle` unguarded; `globalThis.crypto` is undefined in Hermes → threw on the first linked contact with a source photo (c3), swallowed at `ReconcileGridScreen.tsx:229`. Now guards WebCrypto (Node/tests) and falls back to RNQC (device). Verified on-device + DB (14-scan, 10 cards, c3 photo staged).
- **Bug C — FIXED `eecea73`.** `FieldChoiceGroup` keyed rows by `option.id`; multi-value families share `id="source"` → duplicate React key. Keyed by `id+value`; selection identity (binary orbit|source) unchanged.

## Minor findings (non-blocking, follow-up candidates)
- **Finding A (robustness, real users):** Orbit stores the Android **lookup key** as `external_contact_id` and matches by exact string; renaming/re-aggregating a LOCAL device contact changes its lookup key → orphans the link ("Source missing"). Fragile vs. Android's recommended `lookupContact` refresh. Edge case; worth a hardening follow-up (backlog), out of Phase 20 scope.
- **Cosmetic:** methods-family conflict renders the Orbit option as a serialized value (`email␟…zzuat.ada@…`) instead of a clean address (Scenario 3, `s3-06`). Display-only.
- **Cosmetic:** a Bound contact whose source is deleted shows an "Unbound" badge / "Bind contact" affordance in the list while its link is still `is_active=1` (Scenario 6). Overflow "Update from Contacts" still drives the missing-source flow correctly. Display-only.

## Execution notes / evidence detail
(chronological)
