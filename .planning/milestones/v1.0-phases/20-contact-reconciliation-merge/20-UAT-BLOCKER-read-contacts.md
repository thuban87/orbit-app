---
phase: 20-contact-reconciliation-merge
type: device-UAT blocker (real defect + planning gap)
found: 2026-08-31 (first device UAT of Phase 20)
device: Pixel 6 Pro (1A071FDEE002BU, API 37)
status: ESCALATED — owner decision required (ADR-002 reversal / product scope / Play policy)
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-02
  gap_snapshot: "escalated — owner decision required (adr-002 reversal / product scope / play policy)::scenarios=0"
---

# Phase 20 reconcile is non-functional on API 37+ (READ_CONTACTS unavailable)

## Symptom (device-observed, DB-verified)

- Scenario 3 "Update from Contacts" → **"Could not read Contacts right now."**
- Scenario 4 "Check linked contacts" → **"Could not check linked contacts right now."**
- Fails before any write: `reconciliation_sessions`/`_cards`/`reconcile_source_snapshot` all 0. No partial state.
- logcat: `Permission Denial: opening provider …ContactsProvider2 from …com.bwales.orbit… requires android.permission.READ_CONTACTS`.

## Root cause (code-verified)

- The reconcile screens read linked contacts' LIVE state directly from ContactsProvider:
  - `ReconcileGridScreen.tsx:143` and `ReconcileDetailScreen.tsx:43` call `readAllContacts(links.map(l => l.external_contact_id))` → `readContactsByLookupKeys` → `context.contentResolver.query(ContactsContract…)` (OrbitContactPickerModule.kt). This is a direct provider read that **requires runtime `READ_CONTACTS`**.
- Per **ADR-002** (hybrid two-picker), `READ_CONTACTS` is declared with **`android:maxSdkVersion="36"`** (`modules/orbit-contact-picker/android/src/main/AndroidManifest.xml:2-4`) so it is **inert on API 37+**. The installed build's requested-permissions list is empty on this API-37 device (verified via `dumpsys package`).
- Import (Scenario 0) works because it uses the **ephemeral intent picker** (`pickContacts`, per-selection URI grant, no manifest permission). Merge (1,2) and birthday review (7) touch only Orbit-internal/import-row data. Only the reconcile **live re-read** path needs `READ_CONTACTS`, which is absent on API 37.

## Why this is a planning gap, not just a bug

Phase 20 (20-03/20-04 plans) built reconcile assuming `readAllContacts` "just works" as a Phase-19 native artifact, without reconciling against ADR-002's decision that API 37+ is **permissionless (no READ_CONTACTS)**. The two are irreconcilable as built: reconcile needs an on-demand read of specific linked contacts; the permissionless picker only returns what the user explicitly re-picks. Automated tests mock the native module, so this was invisible until the first device UAT.

## Governing decision — ADR-002 (do NOT reverse without owner)

ADR-002 Decision: API ≥37 = permissionless system picker, **no READ_CONTACTS**; API <37 = READ_CONTACTS `maxSdkVersion=36` + in-app custom picker.
ADR-002 **Rejected Alternative**: *"Broad READ_CONTACTS on all versions (active on API 37)"* — rejected because requesting READ_CONTACTS on an API-37 target violates the **Google Play Contacts policy** (announced 2026-04-15, effective **2027-01-27**), a distribution risk. The `maxSdkVersion=36` cap deliberately keeps it inert on modern devices.

Making READ_CONTACTS active on API 37 to "fix" reconcile == implementing ADR-002's rejected alternative. That is an owner decision (security/permission posture + Play policy + ADR reversal), not a bug fix.

## Options (owner's call — not implemented)

1. **Reverse/amend ADR-002** to allow READ_CONTACTS on API 37 (accept the Play-policy path/justification) + add a runtime permission request before reconcile reads.
2. **Re-architect reconcile** to refresh linked contacts via the system picker (user re-picks) — major UX change; feasibility uncertain (picker returns user-picked set, not arbitrary linked contacts).
3. **Scope reconcile to API ≤36** — headline feature inert on modern Android; product-scope decision.
4. **Defer** — land Phase 20 with reconcile known-broken on API 37, tracked, decision later.

## Blast radius

- BLOCKED on this device: Scenarios **3, 4, 5, 6** (all reconcile live-read).
- PASS (DB-verified): **0** (import), **1** (clean merge), **2** (conflict merge), **7a** (birthday Fix).
- Independent / still doable: **7b** (birthday Ignore) — operates on an existing import row, no contact read.
