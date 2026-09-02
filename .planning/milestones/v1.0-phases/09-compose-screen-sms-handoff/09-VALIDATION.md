---
phase: 9
slug: compose-screen-sms-handoff
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-16
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (node environment; `*.test.ts` — react-native `.tsx` screens are device-UAT, not unit-tested) |
| **Config file** | repo-root Vitest config (existing — no Wave 0 install needed) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test && npx tsc --noEmit && npm run check:colors` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (plus `npx tsc --noEmit` when types changed)
- **After every plan wave:** Run `npm test && npx tsc --noEmit && npm run check:colors`
- **Before `/gsd-verify-work`:** Full suite green + on-device Pixel UAT (native-dep change → `expo prebuild --clean` + release APK)
- **Max feedback latency:** ~60 seconds (node tests); on-device UAT is end-of-phase

---

## Per-Task Verification Map

> Filled by the planner from the produced PLAN.md tasks. Correctness-critical logic (e.g. the CMP-03
> Send/Copy capability resolver, any phone/draft formatting) MUST be extracted into a pure
> node-tested `*-logic.ts` module (repo convention) so it has an `<automated>` verify; `.tsx`
> screens (ComposeScreen, the profile Message button) are Pixel-UAT.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _pending planner_ | — | — | CMP-01/02/03 | — | — | unit / device-UAT | `npm test` | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements (Vitest is installed; the repo has an established
  `*-logic.ts` node-test convention). No framework install required.
- New node test file(s) for any extracted `compose-logic.ts` (CMP-03 capability resolver) land with their plan, not a separate Wave 0.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Send opens the Android SMS composer pre-filled | CMP-01 | `expo-sms` opens the OS SMS app; result is `unknown` on Android — not observable in a unit test | On the Pixel: open a contact with a phone → Message → Send → confirm the SMS app opens with recipient + draft body |
| Copy writes the draft to the clipboard | CMP-01 | `expo-clipboard` native side-effect | On the Pixel: Copy → paste elsewhere → confirm draft text |
| Back (software + hardware) → dashboard | CMP-02 | Navigation/BackHandler behavior on-device | On the Pixel: from Compose, tap Back pill AND press the hardware Back — both land on the dashboard, not the profile |
| No-phone degradation | CMP-03 | Rendering + routing on-device (logic core is node-tested) | On the Pixel: open a contact with no phone → Send hidden, Copy works, "Add a phone number" → Edit |

*The Send/Copy capability decision (which controls hidden/shown + affordance) is node-tested via the pure logic module; the native side-effects and navigation are device-UAT.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are explicitly device-UAT (native side-effect / navigation)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (none expected — infra exists)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
