---
phase: 09-compose-screen-sms-handoff
reviewed: 2026-08-16T09:30:59Z
depth: deep
files_reviewed: 10
files_reviewed_list:
  - package.json
  - src/db/contact-read.ts
  - src/db/contact-read.test.ts
  - src/logic/compose-logic.ts
  - src/logic/compose-logic.test.ts
  - src/navigation/types.ts
  - src/navigation/RootNavigator.tsx
  - src/screens/ComposeScreen.tsx
  - src/screens/ContactProfileScreen.tsx
  - src/services/fuel-kind-label.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: fixed
fix_applied: 2026-08-16
---

# Phase 9: Code Review Report

> **FIX STATUS (2026-08-16):** All 3 warnings addressed on `main`, committed in place (no worktree).
> - **WR-01 — FIXED** (commit `01679fa`): compose Header now carries `archived_at`; load routes Home (screenState=missing) when `row.archived_at !== null`, under the same `!cancelled` guard as the missing-contact branch. Enforces the Phase-4 archive-hides-everywhere commitment for entry-agnostic re-entry (Phases 11/12/14). Requires human verification of the archive-load path on-device.
> - **WR-02 — FIXED** (commit `7352ae1`): the probe-pending (`smsAvailable === null`) interim controls are folded into `resolveComposeControls` (now `boolean | null`); ComposeScreen calls the resolver unconditionally, so no capability arithmetic is re-derived inline. Node tests added for the null case across `hasPhone` true/false.
> - **WR-03 — COVERED BY WR-02**: the capability decision now lives entirely in the node-tested pure module (interim + settled cases). The `.tsx` cancelled-flag / latch / focus-reset race paths remain device-UAT per this repo's `-logic`/`.tsx` split — no brittle `.tsx` unit tests / test renderer added, by design.
> - **IN-01 — SKIPPED (intentional):** post-`await` `setCopied`/`setSending` unmount guard is a harmless consistency note on React 18/19 (no unmounted-setState warning); the latches are allowed to settle post-unmount.
> - **IN-02 — SKIPPED (intentional, owner taste):** showing Send with an empty draft is intended — the user can still type in the OS SMS app, and empty Copy is equally benign.
>
> Verification after fixes: `npx tsc --noEmit` clean, `npm test` 675/675 pass, `npm run check:colors` exit 0.

**Reviewed:** 2026-08-16T09:30:59Z
**Depth:** deep
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the new entry-agnostic Compose surface and its supporting slice: the pure
`resolveComposeControls` capability gate, the additive `phone` widening on
`getContactHeader`, the `Compose` route wiring, the `fuelKindLabel` helper, and the
`ContactProfileScreen` "Message" entry point. I read the code on disk plus the
subsystem the guardrails flagged — `fuel-read.ts` (`getRankedFuel` /
`RANKED_FUEL_EXCLUSIONS`), the two other `getContactHeader` callers
(`EditContactScreen.refreshPhoto`, `ContactProfileScreen`), `fuel-age.ts`, and
`database.localDateTime`.

The load-bearing security invariants hold and I could not break them:

- **Fuel is read only through `getRankedFuel`.** ComposeScreen imports and calls
  `getRankedFuel` (ComposeScreen.tsx:56,131) — never `listFuelForEditor`, never a
  component-side `.filter()`. off_limits + unconfirmed `source='ai'` + blank/NULL
  text are excluded structurally in SQL (`RANKED_FUEL_EXCLUSIONS`), so the
  never-transmitted guarantee is upheld. All returned rows are rendered unfiltered.
- **Compose writes nothing to the DB.** No DAO writer, no touchpoint/interaction
  row, no `contacts.last_contact` touch on Send or Copy. DATA-04 single-writer
  invariant intact.
- **SMS handoff uses `expo-sms.sendSMSAsync`** (native address+body marshalling) —
  no hand-rolled `sms:` URI.
- **Send is correctly latched** (`if (sending) return;` + `if (phone === null)
  return;` + `finally` reset); **Copy is never gated by `sending`**.
- **Both Back paths route home** — the software pill and the Android hardware
  `BackHandler` override both call the `useCallback`-wrapped `goHome` (reset fires
  inside the callback body, never at render).
- **Theme tokens only** (every colour via `useTheme().colors.*`, incl. the Send
  disabled styling); **`localDateTime`** for the fuel-age "now"; **no network** on
  any read path.
- **The `getContactHeader` phone widening is purely additive** — verified the two
  other callers: `EditContactScreen.refreshPhoto` reads only `photo`/`modified_at`
  (EditContactScreen.tsx:203-205), `ContactProfileScreen` destructures a local
  `Header` type, and `contact-read.test.ts` asserts fields individually. Neither
  typecheck nor test breaks; the light header seek is preserved (not switched to
  `getContactForEdit`).

The findings below are correctness-adjacent robustness gaps and test-coverage holes,
not security breaches. No blockers.

## Warnings

### WR-01: ComposeScreen renders a full compose surface for an ARCHIVED contact

**File:** `src/screens/ComposeScreen.tsx:138-149` (and the discarded field at 143-149)
**Issue:** The load treats only `row === null` as "unavailable" and routes home;
it never inspects `archived_at`. `getContactHeader` **intentionally does not filter
`archived_at IS NULL`** (contact-read.ts:59-64) — it returns archived rows — and the
compose `Header` type at ComposeScreen.tsx:72-80 drops `archived_at` entirely, so an
archived contact loads a fully functional Send/Copy/fuel surface.

Today this is unreachable (the only entry, ContactProfileScreen's "Message" button,
is reached for live contacts), so it is **latent, not currently exploitable**. But
this screen's entire stated design goal is entry-agnostic reuse by Phase 11
(notification), Phase 12 (widget) and Phase 14 (AI), which "open it with just
`{ contactId }`" (ComposeScreen.tsx:1-7). A notification or widget for a
since-archived contact would surface that contact's fuel and offer to text them —
directly against the product commitment that archiving "hides the contact from every
live surface." contact-read.ts:62-63 itself warns: "Any NEW live/list surface must
still filter `archived_at IS NULL`." Compose is exactly such a new surface and does
not.
**Fix:** Carry `archived_at` into the local `Header` (or check it off `row`) and
treat an archived contact like a missing one:
```ts
if (row === null || row.archived_at !== null) {
  setScreenState("missing");
  goHome();
  return;
}
```
If composing to archived contacts is instead an intended future capability, that is a
product/risk-posture call for the owner (archive semantics), not an implementation
detail — flag it rather than silently allowing it.

### WR-02: Interim (probe-pending) control logic is inlined and untested — drift risk on a transmittable surface

**File:** `src/screens/ComposeScreen.tsx:287-295`
**Issue:** When `smsAvailable === null` the screen builds a `ComposeControls` object
by hand instead of calling the pure `resolveComposeControls`. This is real
capability-gating decision logic (Send hidden, Copy sole primary,
`addNumber: !hasPhone`, no helper) living inline in the component, so it is **not**
covered by `compose-logic.test.ts` (which only exercises the two-boolean resolver).
The pure resolver was extracted precisely so "no capability arithmetic leaks into
ComposeScreen" (compose-logic.ts:7-9); the interim branch reintroduces exactly that,
and it can silently drift from the resolver on a future edit. The `addNumber:
!hasPhone` expression in particular re-derives the no-phone affordance a second time.
**Fix:** Fold the pending state into the pure module so it is node-tested — e.g.
accept `smsAvailable: boolean | null` (or a dedicated `resolvePendingControls()`),
add the null-branch cases to `compose-logic.test.ts`, and have the screen call it
unconditionally. This keeps all capability arithmetic in one tested place.

### WR-03: ComposeScreen's stateful core has no automated test coverage

**File:** `src/screens/ComposeScreen.tsx:118-251`
**Issue:** The most bug-prone logic in this phase — the focus-effect per-run reset,
the `cancelled`-flag stale-write guard across two awaits + a separate SMS probe, the
`sending` latch/`finally`, and the copy-timer teardown — is the file's own declared
"load-bearing" state machine (header comment lines 28-38) yet has **zero** automated
coverage. Only the extracted pure resolver (`compose-logic.test.ts`) and the DB read
(`contact-read.test.ts`) are tested; no `ComposeScreen.test.*` exists (confirmed:
`src/screens/*.test.*` holds only `create-contact-logic` and `edit-contact-logic`).
A regression in the stale-write guard or the latch would surface only on-device.
**Fix:** Extract the load/probe orchestration and the interim-vs-settled control
selection into a pure/hook-testable unit and unit-test the branches (missing row →
home, superseded focus → no stale write, probe reject → `smsAvailable = false`,
double-tap Send → single composer). At minimum add the interim-controls cases noted
in WR-02. On-device UAT alone does not exercise the race/cancellation paths.

## Info

### IN-01: setState after `await` in onCopy/onSend lacks the unmount guard used elsewhere in the file

**File:** `src/screens/ComposeScreen.tsx:242` (setCopied) and `230-231` (setSending in finally)
**Issue:** `onCopy` calls `setCopied(true)` after `await Clipboard.setStringAsync`,
and `onSend` toggles `setSending` around `await SMS.sendSMSAsync`, neither guarded by
a `cancelled`/mounted check — inconsistent with the deliberate unmount discipline the
rest of the file applies (the focus-effect `cancelled` flag, the copy-timer cleanup
effect at 196-203). Harmless on React 18/19 (no unmounted-setState warning), so this
is a consistency note, not a defect.
**Fix:** Either accept it explicitly (a brief comment noting these UI latches are
allowed to settle post-unmount) or gate them with a mounted ref, matching the
file's own convention.

### IN-02: Send is shown with an empty draft, opening the OS composer with a blank body

**File:** `src/screens/ComposeScreen.tsx:210-232, 454-479`
**Issue:** Send visibility depends only on phone + SMS capability, not on draft
content, so tapping Send with an empty message opens the SMS composer with an empty
body. This is plausibly intended (the user can still type in the SMS app, and Copy
of an empty string is equally benign), so it is noted only for confirmation.
**Fix:** If an empty send is undesired, disable Send when `draft.trim() === ""`;
otherwise no change — record it as intended.

---

_Reviewed: 2026-08-16T09:30:59Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
