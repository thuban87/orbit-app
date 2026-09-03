---
phase: 23
slug: theme-visual-system
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-03
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `23-RESEARCH.md` §Validation Architecture (verified against disk). Task IDs are
> assigned by the planner; the map below is requirement-level until PLAN.md waves exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (node env) — verified in package.json devDependencies |
| **Config file** | none — vitest run via `npm test` (package.json `scripts.test = "vitest run"`) |
| **Quick run command** | `npx vitest run src/theme` (targeted to changed path) |
| **Full suite command** | `npm test` |
| **Colour gate** | `npm run check:colors` (scripts/check-colors.sh) — must stay green |
| **Estimated runtime** | ~15–30 seconds (targeted); full suite longer |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed src/theme|src/db path>` + `npm run check:colors` on changed files
- **After every plan wave:** Run `npm test` + `npm run check:colors`
- **Before `/gsd-verify-work`:** Full suite + `check:colors` must be green
- **Max feedback latency:** ~30 seconds (targeted run)

---

## Per-Requirement Verification Map

> Task IDs TBD by planner; each row maps a phase requirement to its automated verification.
> "File Exists" reflects disk state at research time; ❌ W0 = created in Wave 0.

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| THEME-01 | `resolveMode`/`resolvePalette` across 4 combos + package axis | unit | `npx vitest run src/theme/theme-presets.test.ts` | ⚠️ extend (add package axis + 4 palettes) |
| THEME-11 | Every accent/text/status passes AA in all 4 combos | unit | `npx vitest run src/theme/contrast.test.ts` | ❌ W0 (new `contrast.ts` + test) |
| THEME-08 | `statusGlyph(status)` distinct per status; ring visual unchanged | unit | `npx vitest run src/components/contact-card-ring.test.ts` | ⚠️ add glyph-map test (W0) |
| THEME-06 | reduced-motion hook seeds + subscribes; no setState in worklet path | unit (mock `AccessibilityInfo`) + device UAT | `npx vitest run src/theme/use-reduced-motion.test.ts` | ❌ W0 |
| THEME-13 | migration 015 additive; DAO read/write; `PORTABLE_SETTINGS_KEYS` carries new keys | unit + migration test | `npx vitest run src/db/migrations/015-*.test.ts src/db/app-settings-dao.test.ts` | ⚠️ add migration 015 test + portable-keys assertion (W0) |
| THEME-03 | restore-before-paint gating; `orbit-theme` → columns mapper (pure fn) | unit | `npx vitest run src/theme/orbit-theme-migration.test.ts` | ❌ W0 |
| THEME-09 | registry maps every semantic name; screens use names only | unit | `npx vitest run src/components/icons/icon-registry.test.ts` | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/theme/contrast.ts` + `contrast.test.ts` — THEME-11
- [ ] `src/theme/use-reduced-motion.ts` + test (mock `AccessibilityInfo`) — THEME-06
- [ ] `src/db/migrations/015-*.ts` + test (migration number re-verified head+1 on disk) — THEME-13
- [ ] `src/theme/orbit-theme-migration.ts` (pure `orbit-theme` → columns mapper) + test — THEME-03 / D-08
- [ ] `src/components/icons/icon-registry.ts` + test — THEME-09
- [ ] Extend `theme-presets.test.ts` for the package axis + 4 required palettes — THEME-01
- [ ] Extend `src/db/migrations/full-chain.test.ts` migration chain to 015 (file exists) — THEME-13
- [ ] Framework install: none — Vitest already present.

---

## Manual-Only Verifications

> Device UAT on the physical Pixel — the emulator cannot assess Skia render-loop perf (CLAUDE.md).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reduced-motion live toggle halts ambient/Orrery motion without jank | THEME-06 / D-07 | Skia render-loop behavior + OS a11y setting; JS-thread perf not observable in unit tests | On the Pixel, toggle OS "Remove animations" while a Galaxy background + Orrery are on-screen; confirm ambient drift/twinkle stops and manual camera control remains |
| No wrong-theme flash on cold start | THEME-03 / D-10 | First-paint timing; not observable without a real cold boot | Force-stop the app, relaunch; confirm the correct package×mode paints on first frame (no flash of the default/other theme) |
| All-four-combo visual pass | THEME-01 / THEME-11 | Human visual confirmation of contrast/legibility across palettes | On the Pixel, cycle Galaxy/Standard × Light/Dark and confirm surfaces, accents, and status glyphs are legible and AA-comfortable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
