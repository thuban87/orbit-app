---
phase: 22
slug: app-shell-navigation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-02
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **Critical constraint (RESEARCH):** the vitest env is `environment: "node"`, render-free (no jsdom). Tests exercise PURE LOGIC only — they never render a component or mount a navigator. Every navigation *decision* lives in a pure resolver (reset-intents, back-intent, focused-route-classification, contact-picker-order, universal-fab-logic) tested on the intent/shape; the navigator wiring, FAB/picker/snackbar rendering, insets, keyboard, haptics, and a11y focus are verified ON-DEVICE (Pixel UAT), never in vitest.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 (installed) |
| **Config file** | `vitest.config.ts` — `environment: "node"`, `globals: true`, `include: src/**/*.test.ts(x)`, `passWithNoTests: true` |
| **Quick run command** | `npx vitest run <file>` (single file, node env, sub-second) |
| **Full suite command** | `npm test` (→ `vitest run`) |
| **Estimated runtime** | full suite ~a few seconds (render-free) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <the touched pure-logic test file>` (sub-second) plus `npx tsc --noEmit` + `npm run check:colors` for the chrome/nav tasks.
- **After every plan wave:** Run `npm test` (full render-free suite; `passWithNoTests` safe).
- **Before `/gsd-verify-work`:** `npm test` green PLUS on-device UAT of the manual rows (tab switching, hardware Back == visible Back with a transient open, keyboard/focused nav+FAB hide, Quick Log commit-truth, deep-link/notification landing on Dashboard).
- **Max feedback latency:** < 60s for the automated rows.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | SHELL-01/04/15 | T-22-04 | tab navigator stays behind the migration gate | build | `npx tsc --noEmit && npm run check:colors` | n/a (compile) | ⬜ pending |
| 22-01-02 | 01 | 1 | SHELL-05 | T-22-01/02 | deep-link acceptance logic byte-for-byte unchanged; nested reset shape | unit | `npx vitest run src/navigation/reset-intents.test.ts src/navigation/widget-linking.test.ts src/services/notifications/notification-nav.test.ts` | ❌ W0 (reset-intents.test) / ✅ (widget-linking, notification-nav — update) | ⬜ pending |
| 22-02-01 | 02 | 2 | SHELL-02/03/04/06 | T-22-05 | back handler never traps the user; origin-aware back preserved | unit | `npx vitest run src/navigation/back-intent.test.ts src/navigation/focused-route-classification.test.ts` | ❌ W0 | ⬜ pending |
| 22-02-02 | 02 | 2 | SHELL-02/06 | T-22-06 | focused/keyboard nav-bar hide from an explicit allow-list | build | `npx tsc --noEmit && npm run check:colors` | n/a (on-device UAT) | ⬜ pending |
| 22-02-03 | 02 | 2 | SHELL-03 | T-22-05 | shell BackHandler returns true only to dismiss transient | build | `npx tsc --noEmit` | n/a (on-device UAT) | ⬜ pending |
| 22-03-01 | 03 | 2 | SHELL-05 | T-22-09 | container/ShareIntent navigates resolve to nested tab targets | build | `npx tsc --noEmit` | n/a (on-device UAT) | ⬜ pending |
| 22-03-02 | 03 | 2 | SHELL-03/04/05 | T-22-07 | completion resets → Dashboard; Backup-local stay; no edit replay | build | `npx tsc --noEmit && npm run check:colors` | n/a (on-device UAT) | ⬜ pending |
| 22-03-03 | 03 | 2 | SHELL-07 | T-22-08 | Discard/Keep fires only on a real delta; never autosaves | build | `npx tsc --noEmit && npm run check:colors` | n/a (on-device UAT) | ⬜ pending |
| 22-04-01 | 04 | 2 | SHELL-13/14 | T-22-11 | app-bar chrome carries no status hue; a11y labels | build | `npx tsc --noEmit && npm run check:colors` | n/a (on-device UAT) | ⬜ pending |
| 22-04-02 | 04 | 2 | SHELL-13 | — | content clearance from useBottomTabBarHeight, not hardcoded | build | `npx tsc --noEmit && npm run check:colors` | n/a (on-device UAT) | ⬜ pending |
| 22-04-03 | 04 | 2 | SHELL-12 | T-22-10 | single Archived destructive surface; not a fifth tab | build | `npx tsc --noEmit && npm run check:colors` | n/a (on-device UAT) | ⬜ pending |
| 22-05-01 | 05 | 3 | SHELL-08/09 | T-22-13 | exactly six fixed-order actions; Group Log direct | unit | `npx vitest run src/components/universal-fab-logic.test.ts` | ❌ W0 | ⬜ pending |
| 22-05-02 | 05 | 3 | SHELL-06/08/14 | T-22-12/14 | scrim inert when collapsed; a11y-modal; no per-frame setState | build | `npx tsc --noEmit && npm run check:colors` | n/a (on-device UAT) | ⬜ pending |
| 22-05-03 | 05 | 3 | SHELL-08 | — | placeholder routes are real semantic routes | build | `npx tsc --noEmit && npm run check:colors` | n/a (on-device UAT) | ⬜ pending |
| 22-06-01 | 06 | 4 | SHELL-10 | T-22-17 | picker read local-only; archived via search only | unit | `npx vitest run src/logic/contact-picker-order.test.ts` | ❌ W0 | ⬜ pending |
| 22-06-02 | 06 | 4 | SHELL-10/14 | T-22-17 | a11y-modal picker; no status hue | build | `npx tsc --noEmit && npm run check:colors` | n/a (on-device UAT) | ⬜ pending |
| 22-06-03 | 06 | 4 | SHELL-11/09 | T-22-15/16 | success only on committed txn; Undo via existing deleteTouchpoint | unit | `npx vitest run src/db/recency-dao.test.ts` | ✅ (extend/assert) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New pure-logic test files to create alongside their modules (each `<automated>` above marked ❌ W0):

- [ ] `src/navigation/reset-intents.test.ts` — nested-reset builder shapes (SHELL-05), Plan 01
- [ ] `src/navigation/back-intent.test.ts` — dismiss-transient-vs-default resolution (SHELL-02/03), Plan 02
- [ ] `src/navigation/focused-route-classification.test.ts` — focused/browse allow-list (SHELL-06), Plan 02
- [ ] `src/components/universal-fab-logic.test.ts` — six fixed-order actions + context→target (SHELL-08/09), Plan 05
- [ ] `src/logic/contact-picker-order.test.ts` — ordering + archived-via-search + markers (SHELL-10), Plan 06
- [ ] Extend `src/navigation/widget-linking.test.ts` + `src/services/notifications/notification-nav.test.ts` for the nested-reset shape (Plan 01)
- [ ] Assert `src/db/recency-dao.test.ts` covers `deleteTouchpoint` (the existing Undo path) (Plan 06)

No framework install needed (vitest present).

---

## Manual-Only Verifications (on-device Pixel UAT — render-free vitest cannot cover)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Four-tab switch: crossfade, no swipe, per-tab stack memory | SHELL-01/15 | navigator render | Boot; tap each tab; confirm crossfade (no slide), no swipe-between-tabs; leave+return to a tab restores its stack |
| Active-tab retap dismiss-then-root; system Back == visible Back with a transient open | SHELL-02/03 | hardware Back + transient overlay | Open the speed dial; press system Back → dial dismisses, app does NOT exit; press visible Back → same; retap active tab → dismiss, then retap → tab root |
| Origin-aware Back; completed Edit no-replay | SHELL-04/03 | stack history | Dashboard→Profile→Back=Dashboard; Orrery→Profile→Back=Orrery; Profile→Edit→Save→Profile→Back does NOT re-show Edit |
| External entry → Dashboard; missing-contact deep link | SHELL-05 | OS launcher | Fire a notification/widget deep link → lands Dashboard tab; deep link to a deleted contact → Alert + Dashboard, no crash |
| nav+FAB hide on focused workflow + keyboard | SHELL-06 | keyboard + route classification | Open Edit → nav+FAB hidden; focus a text field → both hidden; return → both visible |
| Discard/Keep on unsaved changes | SHELL-07 | form dirty state | Edit a field then Back → "Discard changes?"; Keep editing stays; Discard leaves; unchanged form exits silently |
| Six-action FAB, scrim, light haptic, a11y-modal | SHELL-08/14 | Reanimated + haptics + TalkBack | Open FAB → six labeled actions over a scrim + light haptic; TalkBack treats open dial as modal, restores focus on close |
| Preselect from Profile vs picker from global; Group Log direct | SHELL-09 | route context | Quick Log from a Profile writes immediately; from Dashboard opens the picker; Group Log opens directly (no picker) |
| Picker ordering / archived-via-search / snoozed-marker | SHELL-10 | modal render | Favourites first; type to filter; archived appear only when searched (badge); snoozed marked + selectable |
| Quick Log commit-truth + Undo + error/Retry | SHELL-11 | write timing + haptics | Success "Logged"+Undo only after commit (+success haptic); Undo removes the interaction; forced failure → "Couldn't log"+Retry (+warning haptic) |
| Group Events header+overflow; Archived overflow (single surface, origin-aware) | SHELL-12 | Dashboard chrome | Header Group Events icon+label + redundant overflow → placeholder; Archived from overflow → single screen, Back to Dashboard |
| App bars (root branded/no-back vs child back+title); content clears nav/FAB; large-font reflow | SHELL-13/14 | chrome + font scale | Tab roots titled, no Back; child screens Back+title; last list item scrolls above nav/FAB; large font scale reflows titles/labels |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (compile/build tasks use tsc+check:colors; behavior verified on-device)
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify (every task runs at least tsc; pure tasks run vitest)
- [ ] Wave 0 covers all MISSING (❌ W0) references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (set by validate-phase §6)

**Approval:** pending
