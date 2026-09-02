---
phase: 12
slug: home-screen-widget
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-17
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from
> `12-RESEARCH.md` § Validation Architecture. Correctness-critical seams are node-testable
> (base64 encoder, `orbit://` URI resolver, tile-data shaper, status→ring mapping, headless
> mark write via the `node:sqlite` harness). The RemoteViews render, `requestPinWidget`, the
> boot receiver, and the killed-app headless round-trip are device-UAT only.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` (node env; `.test.ts` beside source) |
| **Config file** | repo Vitest setup (existing — used by every `-logic.ts`/DAO test) |
| **Quick run command** | `npx vitest run src/services/widget src/navigation/widget-linking.test.ts` |
| **Full suite command** | `npm test` (835/835 green as of Phase 11) |
| **Estimated runtime** | quick ~seconds; full suite ~seconds (835 node tests) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/services/widget src/navigation/widget-linking.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite green **AND** the three device-only UATs passed on the physical Pixel
- **Max feedback latency:** a few seconds (node tests)

---

## Per-Task Verification Map

> Task IDs (`12-NN-MM`) are assigned by the planner. This table is populated during planning
> from the requirement→test map below; each Wave-0 test file is created before the task that
> depends on it. Requirement-level basis (from RESEARCH):

| Requirement | Behavior | Test Type | Automated Command | File | Status |
|-------------|----------|-----------|-------------------|------|--------|
| WDG-01 | base64 encoder returns `data:image/jpeg;base64,…` or null for no-photo | unit | `npx vitest run src/services/widget/widget-photo.test.ts` | ❌ W0 | ⬜ pending |
| WDG-01 | tile shaper maps `listDashboard` favourites → tiles (status/initials/swatchIndex), truncates by rank | unit | `npx vitest run src/services/widget/widget-data.test.ts` | ❌ W0 | ⬜ pending |
| WDG-01 | status→ring colour + weight mapping (stable/wobble/decay/rogue/null) | unit | `npx vitest run src/services/widget/widget-colors.test.ts` | ❌ W0 | ⬜ pending |
| WDG-02 | headless mark writes one `interactions` row, `source='widget'`, via mutexed DAO | integration (node:sqlite) | `npx vitest run src/services/widget/widget-mark.test.ts` | ❌ W0 | ⬜ pending |
| WDG-02/03 | `resolveWidgetUri` maps `orbit://` URIs → reset/navigate intents; malformed → null | unit | `npx vitest run src/navigation/widget-linking.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/widget/widget-photo.test.ts` — WDG-01 encoder (mock the manipulator; assert `data:` prefix + null-path branch)
- [ ] `src/services/widget/widget-data.test.ts` — WDG-01 tile shaping/truncation over a fake `listDashboard`
- [ ] `src/services/widget/widget-colors.test.ts` — WDG-01 ring colour+weight table
- [ ] `src/services/widget/widget-mark.test.ts` — WDG-02 headless write over the `node:sqlite` harness (reuse the recency-dao harness)
- [ ] `src/navigation/widget-linking.test.ts` — WDG-02/03 pure URI resolver
- [ ] Framework install: **none** — Vitest + `node:sqlite` harness already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RemoteViews render (grid, tiles, rings, base64 avatars, empty state) | WDG-01/03 | RemoteViews rasterise off-screen; no node harness | Pixel UAT: add widget, eyeball tiles + status rings + empty state |
| Killed-app headless mark round-trip | WDG-02 | FCM-less headless native path — same path deferred in Phase 11; verify **together** | Pixel: force-stop app → tap tile → `run-as com.bwales.orbit` read the new `interactions` row |
| Grid capacity / bitmap-memory ceiling | WDG-01 | device-only limit; emulator invalid (CLAUDE.md) | Pixel spike: increase favourites, find the max tiles before bitmap OOM |
| Force-stop greying → boot/launch re-push | WDG-03 | Android-15 force-stop cancels PendingIntents until launch | Pixel UAT: `adb shell am force-stop` + reboot → confirm widget re-pushes on launch/BOOT_COMPLETED |
| `requestPinWidget` "Add widget" button + fallback | WDG-03 | native launcher API; false on unsupported launchers / API<26 | Pixel: tap Settings "Add Orbit widget" → confirm pin prompt or graceful fallback |

---

## Validation Sign-Off

- [ ] All correctness-critical tasks have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING (❌ W0) references
- [ ] No watch-mode flags (all `vitest run`)
- [ ] Feedback latency < ~10s
- [ ] `nyquist_compliant: true` set once the planner's per-task map is filled

**Approval:** pending
