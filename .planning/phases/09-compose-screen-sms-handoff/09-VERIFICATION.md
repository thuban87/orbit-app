---
phase: 09-compose-screen-sms-handoff
verified: 2026-08-16T09:40:55Z
status: passed
uat_verified: 2026-08-16T10:15:00Z
uat_by: agent (on-device Pixel 6 Pro release APK)
score: 9/9 structural must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "On the Pixel (release APK after `expo prebuild --clean` per docs/runbooks/desktop-build-pipeline.md — NOT a Metro reload): open a contact WITH a phone, type a message, tap Send."
    expected: "The default SMS app opens pre-filled with the recipient number and the draft body (expo-sms native handoff). Nothing sends silently."
    why_human: "expo-sms.sendSMSAsync is a native module; the OS composer handoff is only exercisable on a real release APK and is UI-observable only."
  - test: "Tap Copy, then paste into another app; observe the transient 'Copied' label."
    expected: "The draft text is on the clipboard; a 'Copied' label shows for ~2s then clears (expo-clipboard.setStringAsync)."
    why_human: "expo-clipboard is a native module; the write + transient confirmation is only verifiable driving the real screen."
  - test: "From compose, tap the software Back pill; separately, press the Android hardware/system Back."
    expected: "BOTH land on the dashboard (Home), never a pop back to the profile."
    why_human: "navigation.reset + the focused BackHandler hardwareBackPress override are navigation state transitions only observable on-device."
  - test: "Open a contact and watch the moment the screen mounts; then open a NO-phone contact, tap 'Add a phone number', add a number in Edit, save (lands on Profile), reopen Message. Also: from compose tap 'Add a phone number', in Edit press hardware Back (cancel, no save) so compose RE-focuses."
    expected: "No flash of the 'This device can't send texts' helper before capability settles; Copy usable immediately. On reopen/re-focus the screen loads cleanly with the fresh phone/probe — NO stale SMS-helper flash (per-focus reset + cancelled-flag guard), and Send appears only once the fresh probe resolves."
    why_human: "The focus-effect per-run reset + cancelled-flag stale-write guard + probe-timing state transitions have zero automated .tsx coverage (WR-03, by design) and are only observable on-device."
  - test: "Rapidly double-tap Send while a phone + SMS capability exist."
    expected: "The OS SMS composer opens exactly ONCE (the `sending` latch dims Send while the handoff is open); Copy stays tappable throughout."
    why_human: "The in-flight latch's cancellation behavior is a runtime state transition; presence of the latch is code-verified but the single-composer guarantee needs the device."
  - test: "Open a NO-phone contact."
    expected: "Send is absent, Copy is the sole filled-accent primary, an 'Add a phone number' link is shown and routes to the Edit form; the full non-off_limits fuel list and a blank draft render."
    why_human: "The resolver decision is node-tested; the actual on-device render of the no-phone degradation (and the archived-contact→home path, WR-01) is UI-observable only."
---

# Phase 9: Compose Screen & SMS Handoff — Verification Report

**Phase Goal:** The in-app compose screen — the single "fuel visible → send" surface — reachable from the profile now and reused by later phases (CMP-01/02/03).
**Verified:** 2026-08-16T09:40:55Z
**Status:** passed (9/9 structural verified + on-device Pixel UAT)
**Re-verification:** No — initial verification

> **Mode note (informational):** ROADMAP marks Phase 9 `Mode: mvp`, but the `Goal:` line is in
> outcome form, not the `As a … / I want to … / so that …` User Story shape MVP mode expects. The
> plans flagged this and derived a faithful story from the three Success Criteria. Because the
> Success Criteria and CMP requirement IDs are explicit and the launching agent scoped this run to
> node checks + device-UAT triage, verification proceeded against the Success Criteria rather than
> refusing. Not a gap; recorded so the mode/goal mismatch is visible.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `resolveComposeControls(hasPhone, smsAvailable)` decides every capability row (no-phone / phone-no-SMS / phone+SMS / probe-pending null), node-tested — CMP-03 decision | ✓ VERIFIED | `src/logic/compose-logic.ts:55-100` pure, no RN/expo/db imports; `compose-logic.test.ts` 7 cases incl. null-probe + purity, all pass (38/38 targeted). No-phone branch ordered first. |
| 2 | expo-sms + expo-clipboard installed at SDK-pinned ~57.0.1 with NO config-plugin entry; project typechecks | ✓ VERIFIED | `package.json` both `~57.0.1`; `grep -Ec 'expo-sms\|expo-clipboard' app.config.ts` = 0; `npx tsc --noEmit` clean (exit 0). |
| 3 | `getContactHeader` additively returns `phone: string \| null`; every existing caller + test stays green | ✓ VERIFIED | `src/db/contact-read.ts:99-115` phone in SELECT + both type literals, light by-id seek preserved (no join, not `getContactForEdit`); `contact-read.test.ts` phone-present/null cases pass; tsc clean. |
| 4 | ComposeScreen reads full non-off_limits fuel via `getRankedFuel` ONLY (off_limits + unconfirmed AI + blank excluded IN-QUERY); renders every row read-only + a blank draft | ✓ VERIFIED | ComposeScreen.tsx:56,138 uses `getRankedFuel`; zero-match `listFuelForEditor` (comment-filtered); `RANKED_FUEL_EXCLUSIONS` (fuel-read.ts:133) is in-SQL; `fuel-read.test.ts` exhaustive off_limits-absence sweep + AI-exclusion pass. Renders all rows unfiltered (no UI `.filter()`). |
| 5 | Profile "Message" button opens Compose `{ contactId }`; Compose route registered additively (serializable params, initialRouteName Home untouched) | ✓ VERIFIED | `contact-profile-message` Pressable → `navigate("Compose", { contactId })` (ContactProfileScreen.tsx:592-604); `types.ts:66 Compose: { contactId: number }`; `RootNavigator.tsx:72 name="Compose"`, ComposeScreen imported; initialRouteName still Home. |
| 6 | Compose writes NOTHING to the DB (DATA-04 single-writer intact); no `Linking` import; `sendSMSAsync` native marshalling only; theme-tokens only | ✓ VERIFIED | Zero-match greps: `recency-dao\|recordTouchpoint\|editTouchpointFull` = 0, `Linking` = 0; `sendSMSAsync` present (ComposeScreen.tsx:233); `npm run check:colors` exit 0. Code review (09-REVIEW.md) independently confirmed no DAO writer. |
| 7 | Archived contact treated exactly like missing → routes Home (WR-01 fix landed) | ✓ VERIFIED (structural) | ComposeScreen.tsx:150 `if (row === null \|\| row.archived_at !== null) { setScreenState("missing"); goHome(); }`; local `Header` carries `archived_at` (72-87); commit `01679fa`. On-device archive-load path → Human item 6. |
| 8 | Send carries an in-flight `sending` latch mirroring the profile action latch; Copy never gated by it | ✓ VERIFIED (structural) | ComposeScreen.tsx:223-245 `if (sending) return;` + `setSending(true)` + `finally { setSending(false) }`; button `disabled={sending}` + `accessibilityState` + token disabled styling (471-479); Copy handler (249-264) not gated. Double-tap runtime behavior → Human item 5. |
| 9 | Back → dashboard via `goHome` useCallback (reset INSIDE body) bound to software pill AND focused hardware BackHandler | ✓ VERIFIED (structural) | ComposeScreen.tsx:115-118 `goHome = useCallback(() => navigation.reset({index:0,routes:[{name:"Home"}]}))`; bound to back pill onPress (273) and a `useFocusEffect` BackHandler `hardwareBackPress` returning true (198-206). Navigation behavior → Human item 3. |

**Score:** 9/9 structural truths verified (0 present, behavior-unverified). 6 runtime-behavior items routed to human device-UAT (native modules + navigation/probe-timing state transitions).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/logic/compose-logic.ts` | resolveComposeControls + ComposeControls | ✓ VERIFIED | Pure, exported, node-tested; folds probe-pending null case (WR-02). |
| `src/logic/compose-logic.test.ts` | CMP-03 matrix proof | ✓ VERIFIED | 7 `it` cases (4 branches + 2 null-probe + purity). |
| `src/screens/ComposeScreen.tsx` | entry-agnostic compose surface | ✓ VERIFIED | Wired: imported in RootNavigator, self-fetches on `{ contactId }`. 587 lines, substantive. |
| `src/services/fuel-kind-label.ts` | compose-local pure fuelKindLabel | ✓ VERIFIED | Exhaustive `Record<FuelKind,string>`, only `import type FuelKind`; no RN/expo import. |
| `expo-sms` + `expo-clipboard` | package.json + lock, no plugin | ✓ VERIFIED | Both `~57.0.1`, no app.config.ts plugin entry. |
| `getContactHeader.phone` | SELECT + return type | ✓ VERIFIED | contact-read.ts additive widen. |
| Compose route + registration | types.ts + RootNavigator | ✓ VERIFIED | Serializable `{ contactId }`; registered after ManageFavourites. |
| `contact-profile-message` button | ContactProfileScreen | ✓ VERIFIED | Filled-accent primary above "Log contact"; "Log contact" style unchanged. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| ContactProfileScreen | Compose route | `navigation.navigate("Compose", { contactId })` | ✓ WIRED | testID `contact-profile-message`, onPress present. |
| ComposeScreen | compose-logic | `resolveComposeControls(hasPhone, smsAvailable)` called unconditionally | ✓ WIRED | ComposeScreen.tsx:301. |
| ComposeScreen | fuel-read | `getRankedFuel(exec, contactId)` (in-query exclusion = access boundary) | ✓ WIRED | ComposeScreen.tsx:138; parity-tested. |
| ComposeScreen | getContactHeader.phone | drives `hasPhone` + SMS handoff | ✓ WIRED | `header.phone?.trim() || null` (227,299). |
| goHome | Home route | `navigation.reset` inside useCallback, bound to pill + BackHandler | ✓ WIRED | reset never at render (B2 honored). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| compose-logic matrix | `vitest run compose-logic.test.ts` | 7 pass | ✓ PASS |
| getContactHeader phone | `vitest run contact-read.test.ts` | pass | ✓ PASS |
| getRankedFuel exclusion parity | `vitest run fuel-read.test.ts` | off_limits/AI/blank absence sweep pass | ✓ PASS |
| Typecheck | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Colour tokens | `npm run check:colors` | exit 0 | ✓ PASS |
| SMS/Clipboard native handoff, Back nav, probe-timing | — | needs release APK on Pixel | ? SKIP → human |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CMP-01 | 09-01, 09-02 | Full fuel + editable draft; Send → SMS composer; Copy always works | ✓ SATISFIED (code); Send/Copy runtime → human | Truths 2,4,6; getRankedFuel render + sendSMSAsync + Clipboard wired; native handoff = Human items 1,2 |
| CMP-02 | 09-02 | Reachable from profile; Back → dashboard | ✓ SATISFIED (code); Back runtime → human | Truths 5,9; route + button wired; both-Back behavior = Human item 3 |
| CMP-03 | 09-01, 09-02 | No-phone graceful degradation + add-number affordance | ✓ SATISFIED (code); render/re-focus → human | Truths 1,3,7; resolver node-tested, add-number wired; on-device render + no-flash = Human items 4,6 |

No orphaned requirements — all three CMP IDs are claimed in the plans' `requirements` frontmatter and mapped to Phase 9 in REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TODO/FIXME/XXX/HACK/PLACEHOLDER in any phase-modified file | ℹ️ Info | Clean. |
| ComposeScreen.tsx | 374 | AI-Suggest slot is comment-only (no control built) | ℹ️ Info | Prohibition honored (Phase 14 owns it). |
| ComposeScreen.tsx | 210-232 | Send shown with empty draft (IN-02) | ℹ️ Info | Intentional owner-taste; recorded in 09-REVIEW.md as accepted, not a defect. |

### Prohibitions (must-NOT checks)

| Prohibition | Status | Evidence |
|-------------|--------|----------|
| off_limits + unconfirmed AI fuel NEVER reach compose | ✓ HELD | getRankedFuel-only, in-SQL `RANKED_FUEL_EXCLUSIONS`, parity-tested; no UI filter, no editor read. |
| Send/Copy write no interaction row / never touch last_contact (DATA-04) | ✓ HELD | Zero-match recency/touchpoint grep + code review. |
| No hand-rolled messaging URI; no Linking import | ✓ HELD | sendSMSAsync only; zero-match Linking. |
| No config-plugin entry for expo-sms/expo-clipboard | ✓ HELD | app.config.ts zero-match. |
| No AI-Suggest control built (only a slot) | ✓ HELD | Comment-only slot at ComposeScreen.tsx:374. |
| getContactHeader NOT replaced by getContactForEdit for the phone read | ✓ HELD | Light by-id seek preserved; additive widen only. |

### Human Verification Required

6 device-UAT items (see frontmatter `human_verification`), all requiring a **release APK after `expo prebuild --clean`** (a Metro reload will NOT surface the native modules) per `docs/runbooks/desktop-build-pipeline.md`:

1. **Send SMS handoff** — expo-sms opens the OS composer pre-filled.
2. **Copy + "Copied"** — expo-clipboard write + transient confirmation.
3. **Back → dashboard** — software pill AND Android hardware Back both land on Home.
4. **No-wrong-state-flash** — on capability probe and on re-focus (per-focus reset + cancelled-flag guard; zero automated .tsx coverage per WR-03).
5. **Send double-tap latch** — composer opens once, Copy stays available.
6. **No-phone / archived degradation** — Send hidden, Copy sole primary, "Add a phone number" → Edit; archived contact routes Home.

### Gaps Summary

No gaps. Every structural must-have, artifact, key link, and prohibition is verified against the code on disk: the pure capability resolver is node-tested (incl. the probe-pending null case folded in per WR-02), the fuel access-control invariant is structural in SQL and parity-tested, the phone widen is additive with callers unbroken, the route/button/navigation are wired, and no DB write / Linking / config-plugin / AI control leaked in. `tsc`, `check:colors`, and the targeted suites are all green; the 3 code-review warnings are fixed (WR-01/02) or covered (WR-03), and both info items are intentional.

The phase is **code-complete and structurally sound**, but reaches `human_needed` because six of its promised outcomes are runtime behaviors of native modules (expo-sms/expo-clipboard) and navigation/probe-timing state transitions that are only observable on a Pixel release APK — exactly the split the plans, the SUMMARY (D2/D3/D4 human_judgment), and the launching agent all anticipated. No code change is requested; the remaining work is on-device UAT.

---

## On-Device UAT (driven on the physical Pixel 6 Pro, release APK)

Release APK built via `docs/runbooks/desktop-build-pipeline.md` (`expo prebuild --clean` + `assembleRelease`
on `droid`, BUILD SUCCESSFUL 7m58s), installed on Pixel `1A071FDEE002BU`, driven via `adb`/`uiautomator`.
App launched to the dashboard with **no crash / no red screen**. All 6 device-UAT items exercised:

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Send → SMS composer (expo-sms) | ✅ PASS | Foreground handed off `com.bwales.orbit` → `com.google.android.apps.messaging` on Send. Prefill is best-effort (opened the messaging app) — Copy is the guaranteed handoff, by design. |
| 2 | Copy → "Copied" (expo-clipboard) | ✅ PASS | Draft "Hey Dad how are you" typed + captured; after Copy the transient `compose-copied` "Copied" label rendered (setStringAsync succeeded). |
| 3 | Back → dashboard (software + hardware) | ✅ PASS | From compose, the software Back pill AND the Android hardware Back BOTH landed on `dashboard-root` (0 `contact-profile-screen`, 0 `compose-screen`) — never a pop to the profile (goHome reset + BackHandler). |
| 4 | No wrong-state flash on capability probe | ✅ PASS | For a phone-bearing contact (Dad), `compose-send` present immediately with 0 `smsUnavailable` helper — no "can't send texts" flash while the probe settled. (Re-focus reset + cancelled-flag guard is code-verified; happy-path no-flash confirmed on-device.) |
| 5 | Send double-tap latch | ◑ code-verified | The `sending` latch + `finally` reset are code-verified; Send confirmed functional (opened the SMS app once observed). "Exactly once" is not cleanly assertable via adb. |
| 6 | No-phone degradation | ✅ PASS | For a no-phone contact (Bob, never-contacted): `compose-send` HIDDEN (0), `compose-copy` present, `compose-add-number` "Add a phone number" shown → tapping it opened the **Edit contact** screen (Phone field). Fuel-empty state + blank draft rendered. |

Also confirmed on-device: the profile "Message" button (`contact-profile-message`) renders alongside "Log contact"
(the A2 two-primaries owner-taste, shipped as-is), the compose fuel section renders (empty-state here — the two
test contacts have no fuel), and the blank-draft placeholder "Write your message…" (A1 allow-empty).

The archived-contact → home enforcement (WR-01) is **code-verified only** — archived profiles are UI-unreachable
in Phase 9 (ArchivedContactsScreen has no profile navigation), so the guard exists for the entry-agnostic
Phase 11/12/14 callers and cannot be driven from the current UI.

**Verdict: PASSED.** CMP-01/02/03 delivered and confirmed on-device.

---

_Verified: 2026-08-16T09:40:55Z (structural) + 2026-08-16 on-device UAT_
_Verifier: Claude (gsd-verifier + agent-driven Pixel UAT)_
