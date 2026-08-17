---
phase: 13
slug: orrery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-17
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `13-RESEARCH.md` §Validation Architecture. Per-task rows are populated by the planner/executor once PLAN task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`vitest run`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/logic/orrery-geometry-logic.test.ts` (swap for the touched `*-logic.ts`) |
| **Full suite command** | `npm test` |
| **Migration harness** | in-memory `node:sqlite` via `@/db/__testkit__/node-sqlite` (`nodeSqliteExecutor`, `openTestDb`) — same as `runner.test.ts` / `001-initial.test.ts` |
| **Extra gates** | `npm run check:colors` (no hex outside `theme-presets.ts`, incl. Skia) + `npx tsc --noEmit` |
| **Estimated runtime** | ~seconds (pure logic) / node:sqlite migration tests ~1–2s |

---

## Sampling Rate

- **After every task commit:** the quick run for the touched `*-logic.ts` module + `tsc --noEmit` + `check:colors`.
- **After every plan wave:** `npm test` (full node suite).
- **Before `/gsd-verify-work`:** full suite green **and** physical-Pixel UAT (render, morph, gestures, `file://` decode, pause-on-blur) — perf claims are Pixel-only.
- **Max feedback latency:** < 30 seconds for the pure-logic quick run.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _populated by planner_ | — | — | ORR-01..06 | — | N/A (offline read; no network) | unit | see Wave 0 files below | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. The planner maps each task to one of the Wave-0 test files below.*

---

## Wave 0 Requirements

- [ ] `src/logic/orrery-geometry-logic.test.ts` — ORR-01/02/03/04: `progressToAngle` (0→top, 0.5→bottom, wraps), `polarToXY` clockwise, `ringRadius`, `drawnRadius` drift bands + `DRIFT_MAX` clamp, `hitTest` nearest-wins/outside→null/sun-hit, morph endpoints (statusAngle vs evenSpread; full vs muted token; shortest-path delta)
- [ ] `src/logic/orrery-ring-logic.test.ts` — ORR-01/04: status→stroke style vocabulary (solid→dashed→faded→faint-trace), reusing `ringVisual` colour
- [ ] `src/logic/ring-reorder-logic.test.ts` — ORR-06: `computeRingReorder` (move-to-rank; bounds clamp; identity/permutation invariance)
- [ ] `src/logic/sun-occupant-logic.test.ts` — ORR-05: NULL→self, live id→contact status glow, archived/missing→self fallback
- [ ] `src/db/migrations/003-orrery-settings.test.ts` — additive migration 003 (node:sqlite): adds both columns, defaults NULL, **v1→v3 AND v2→v3 both land clean**
- [ ] `src/db/app-settings-dao.test.ts` — **widen existing** for `sun_contact_id` + `self_sun_colour` read/write + validation
- [ ] `src/db/ring-seq-dao.test.ts` — `rewriteRingSeq` 3 guards (unique ids / count-match / scoped `changes===1`), node:sqlite, cloned from `rewriteFavouriteRanks`
- [ ] `src/db/orrery-read.test.ts` — orbiting scan excludes never-contacted (`last_contact IS NOT NULL`), archived, AND the sun occupant; dense rank by `ring_seq`
- [ ] Font asset: add `assets/<font>.ttf` (Inter/Roboto, weight 600) for the Skia initials Paragraph fallback — build-phase asset, verified on device (no OS default inside Skia)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canvas render (rings/planets/sun/starfield), correct status colours | ORR-01 | Skia render surface — UI-observable only | Build via desktop pipeline → Pixel; open orrery; confirm rings/planets/sun render, statuses coloured |
| Two-view morph feel (~500ms, angle+colour, radius fixed) | ORR-02 | Animation feel is subjective + off-JS-thread | Toggle Status｜Relationship; confirm smooth morph, radius unchanged |
| Ambient layer + pause-on-blur | ORR-03 | Skia clock + focus/AppState behavior | Confirm subtle twinkle/pulse; background the app / navigate away → `<Canvas>` unmounts (no loop) |
| Tap→profile, drag→ring_seq | ORR-03/06 | Coordinate hit-test + gesture on real touch surface | Tap a planet → profile; drag a planet radially → ring reorders on release |
| `file://` photo decode happy-path (Skia `useImage`) | ORR-01 | Documented-by-contract; needs one-off device confirm | Confirm a contact photo renders in a planet on the Pixel; fallback swatch+initials when absent |
| Perf/battery (Skia render loop) | ORR-03 | Emulator cannot assess Skia render path | Physical-Pixel only; observe smoothness of ambient layer + morph |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (9 files above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
