---
phase: 21-interaction-assist-reach-out
reviewed: 2026-09-01T01:32:53Z
depth: deep
files_reviewed: 21
files_reviewed_list:
  - src/db/migrations/014-interaction-assists.ts
  - src/db/interaction-assist-dao.ts
  - src/db/interaction-assist-read.ts
  - src/logic/assist-eligibility.ts
  - src/services/reach-out/handoff.ts
  - src/services/interaction-assist-sweep.ts
  - src/stores/assist-store.ts
  - src/components/AssistBanner.tsx
  - src/components/AssistConfirmation.tsx
  - src/components/EndpointSelector.tsx
  - src/components/PendingConfirmationsSheet.tsx
  - src/components/ReachOutRouter.tsx
  - src/screens/ContactProfileScreen.tsx
  - src/screens/ComposeScreen.tsx
  - src/db/app-settings-dao.ts
  - src/db/merge-dao.ts
  - src/db/purge-dao.ts
  - src/db/recency-dao.ts
  - src/navigation/widget-linking.ts
  - src/services/widget/widget-quick-action-guard.ts
  - src/services/widget/widget-render.tsx
findings:
  critical: 0
  warning: 1
  info: 5
  total: 6
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-09-01T01:32:53Z
**Depth:** deep (subsystem-level: every writer of interaction_assists, interactions, contacts, contact_methods, app_settings read on disk)
**Files Reviewed:** 21
**Status:** issues_found

## Summary

The core correctness spine of Phase 21 is sound. I traced the four requirements and confirm:

- **IAS-03 last_contact discipline holds.** `markAssistLogged` logs one outbound interaction at `handoff_at` and recomputes via `recomputeLastContactCore`; there is no bespoke `contacts.last_contact` write anywhere in the phase. DATA-04 intact.
- **TOCTOU / atomicity in `markAssistLogged` is correct.** The pre-read only applies the LOG-06 guard; the row is re-read *inside* the shared-mutex transaction and re-checked `status === 'pending'`, so a concurrent merge (reparent) or purge (cascade) cannot leave a stale FK, and a double-confirm is idempotent (second call re-reads `logged` and no-ops → exactly one interaction).
- **Merge reparents `interaction_assists`** inside the merge txn (merge-dao.ts:153); **purge removes assists via the migration-014 `ON DELETE CASCADE`** with `PRAGMA foreign_keys = ON` set per-connection.
- **The `orbit://reach/<id>` allow-list** is anchored digits-only with `Number.isSafeInteger`/`>0`, rejects non-strings, and resets onto `[Home, target]`; `openReachOut` is consumed-once via `setParams(undefined)`.
- **Time math cancels the UTC offset.** Both the SQL `strftime('%s',...)` differences and the JS `localDateTimeMs` path subtract two local wall-clock strings, so the constant offset cancels; no `toISOString().split` anywhere. `newUid()` is Hermes-guarded.

One genuine concurrency defect and several robustness/UX gaps are below. No CRITICAL and no data-corruption defect found.

## Narrative Findings (AI reviewer)

### WR-01 (HIGH): `markAssistDismissed` / `markAssistFailed` bypass the shared write mutex

**File:** `src/db/interaction-assist-dao.ts:129-156`
**Issue:** Both writers issue a bare `exec.runAsync("UPDATE interaction_assists ...")` with **no `inWriteTransaction` wrapper**, unlike every sibling writer in this module (`createPendingAssist`, `markAssistLogged`) and the established codebase discipline — even the single-statement `archiveContact` (contacts-dao.ts:521-526) and `updateAppSettings` wrap their one UPDATE in `inWriteTransaction`. On the shared single connection, SQLite has one transaction state: a bare UPDATE issued while another operation holds the mutex with an open `BEGIN` executes *inside that unrelated transaction* and is committed or rolled back with it (the exact "captures unrelated writes" hazard transaction.ts warns about).

**Failure scenario:** Assists surface right after a background→active return — precisely when App.tsx fans out the launch sweep, the widget sweep, and the assist refresh. The user taps "Don't log" while `interactionAssistSweep`/another sweep holds the mutex mid-transaction. The dismiss UPDATE lands inside that sweep's `BEGIN`. If that transaction later rolls back (any error in the sweep), the dismiss is silently lost and the assist re-surfaces as still-`pending`; conversely `markAssistFailed` on a failed native handoff can be lost, leaving a failed launch as a live prompt. Not corruption, but a lost-write against the module's stated single-writer contract.
**Fix:** Wrap both in `inWriteTransaction(exec, async () => { await exec.runAsync(...); })`, matching `createPendingAssist`/`markAssistLogged` (and consider bumping `data_revision` on dismiss for parity with the logged path).

### IN-01 (MEDIUM): Banner surfaces pending assists for archived contacts

**File:** `src/db/interaction-assist-read.ts:28-47` (and `countPending` :50-62)
**Issue:** `ELIGIBILITY_SQL` gates on `status='pending'` + the 15s–24h window and `JOIN contacts`, but never checks `c.archived_at IS NULL`. The widget path deliberately blocks archived targets (`guardWidgetIntent` → reason `archived`), yet the app-global banner does not.
**Failure scenario:** User reaches out, then archives the contact within 24h. On next foreground the banner asks "Did you reach {archived name}?"; confirming logs an interaction and recomputes `last_contact` for a contact the user has intentionally hidden. Data stays consistent, but an archived contact re-appears in an app-global surface.
**Fix:** Add `AND c.archived_at IS NULL` to `ELIGIBILITY_SQL` (covers both `listEligiblePendingAssists` and `countPending`).

### IN-02 (MEDIUM): Widget LARGE "Contact" button offered for contacts with no reachable method

**File:** `src/services/widget/widget-render.tsx:452-459` → `src/screens/ContactProfileScreen.tsx:316-324`
**Issue:** `LargeTile` renders the `orbit://reach/<id>` "Contact" action unconditionally; the tile data carries no method-availability signal. The guard only checks live/archived/tracking, not whether the contact has an actionable phone/email.
**Failure scenario:** A favourite with no phone/email is tapped "Contact" on the widget → deep-link resolves → Profile opens with `openReachOut:true`, but `hasReachRoute` is false so the reach sheet never opens (`ReachOutRouter` returns null on `routes.hidden`). The user sees nothing happen, and because the open branch never runs, `route.params.openReachOut` is **never cleared** — it lingers on that Profile instance and can spuriously fire later if the deps re-evaluate.
**Fix:** Either gate the widget "Contact" button on a has-reachable-method flag surfaced in the tile, or in `ContactProfileScreen` clear `openReachOut` unconditionally once consumed (clear the param even when `hasReachRoute` is false).

### IN-03 (LOW): Confirm/dismiss handlers have no error handling

**File:** `src/components/AssistBanner.tsx:42-59`, `src/components/PendingConfirmationsSheet.tsx:42-59`
**Issue:** `confirm`/`dismiss` `await markAssistLogged/Dismissed` with no try/catch, invoked via `void onConfirm(...)`. Any rejection (a DB error, or the LOG-06 guard tripping if the device clock rolled back so `handoff_at > now`) is an unhandled rejection: no alert, queue not refreshed. This is inconsistent with `doLogContact` (ContactProfileScreen.tsx:355-358) which alerts on failure.
**Fix:** Wrap in try/catch with an `Alert.alert` fallback, mirroring `doLogContact`.

### IN-04 (LOW): 5-pending cap can expire a still-eligible assist under rapid reach-outs

**File:** `src/db/interaction-assist-dao.ts:51-63`
**Issue:** Every `createPendingAssist` expires all but the newest 5 pending rows. The cap ignores each row's own eligibility window, so >5 reach-outs inside 15s would expire an assist before it was ever shown. Realistically unreachable (each reach-out launches an external app and returns), so LOW.
**Fix:** None required; note only. If ever tuned, cap by eligible-and-pending rather than all-pending.

### IN-05 (LOW): `launch()` silently returns on a null canonical value; purge relies on FK cascade against the module's stated design

**File:** `src/components/ReachOutRouter.tsx:36-40`; `src/db/purge-dao.ts:76-87,244-249`
**Issue (a):** `launch` returns silently when `endpoint` (canonical_value) is null; an actionable method with a null canonical value gives the user no feedback. `is_actionable=1` should imply a non-null canonical, so this is defensive-dead in practice.
**Issue (b):** `interaction_assists` is absent from `PURGE_CHILDREN` and the explicit fan-out, so purge removes assists only via the migration-014 `ON DELETE CASCADE`. This works, but it contradicts purge-dao's documented "EXPLICIT FAN-OUT, NOT FK CASCADE ... auditable" principle, and assists vanish with no tombstone (acceptable — assists are device-local, transient, and excluded from the portable/merge schema).
**Fix:** Optional. For (b), either add `interaction_assists` to the explicit fan-out for consistency or add a one-line comment in purge-dao documenting the intentional cascade exception.

---

_Reviewed: 2026-09-01T01:32:53Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---

## Orchestrator disposition (2026-08-31)

- **WR-01 (HIGH) — FIXED.** `markAssistDismissed` and `markAssistFailed` now run inside `inWriteTransaction` (DATA-04 shared mutex/txn), matching every sibling writer, so a status flip can no longer be captured/lost by a concurrent launch-sweep transaction. Callers are top-level UI handlers (banner dismiss; `performReachOut`'s catch, which runs after `createPendingAssist`'s txn has committed) — verified no re-entrancy/deadlock. Node gate re-run green (191 files / 1,812 tests, tsc, check:colors). `interaction-assist-dao.ts`.
- **IN-01 (MEDIUM) — NOT A DEFECT (by design).** The eligibility read intentionally omits an `archived_at IS NULL` gate: dossier **Cluster Z `[DECIDED]`** — "if a contact becomes archived while an assist is pending, confirmation/logging is still allowed." Device UAT R16 verified this. Adding the filter would reverse a decided behavior; left as-is. (The widget-guard's archived block is a different lifecycle point — blocking a NEW reach, not an already-pending assist.)
- **IN-02 (MEDIUM) — deferred to owner (batched).** Widget deep-link to a method-less contact leaves the router unopened and `openReachOut` stranded (`ContactProfileScreen.tsx:319` clears the param only when `hasReachRoute`). Real but narrow latent edge with a product dimension (what a method-less widget tap should show). Recommended small robustness fix: clear the param unconditionally when `openReachOut` is set. Left for owner priority call (fix-now vs backlog).
- **IN-03 / IN-04 / IN-05 (LOW) — deferred (backlog).** try/catch on confirm/dismiss handlers; cap-vs-eligibility interaction (realistically unreachable); silent null-canonical return + purge cascade-vs-explicit-fanout style. Non-blocking; recorded for a future hardening pass.
