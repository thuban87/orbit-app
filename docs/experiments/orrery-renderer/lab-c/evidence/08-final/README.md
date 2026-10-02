# 08-final — Checkpoint F evidence (RELEASE build, Pixel 6 Pro, 2026-10-01)

All shots from the arm64 release APK installed over the seeded debug app (see RUNBOOK §8). Galaxy/Dark unless named.

| File | What |
|---|---|
| `01-dense-overview.png` | Lab C Dense (120 + star), Home pose |
| `02-inner-overview.png` | Lab C Inner (17 + star), Home pose |
| `03-dense-near-x2.2.png`, `04-dense-close-x3.4.png` | Dense, lab presets 1/2 (bounded dolly: only modestly closer) |
| `03b-inner-near-x2.2.png`, `04b-inner-close-x3.4.png` | Inner, presets 1/2 after the stale-home fix (4a82ae85) |
| `05a-dense-focus-fly-in-ava-abara.png` | focus fly-in end state, docked card |
| `05b-dense-focus-chloe-with-moons-dana-cy.png` | focused parent with two moons (Dana, Cy) + relationship context in the card |
| `06-dense-orbit-swung-tilt1.2-yaw3.8.png` | orbit-swung angle (preset 3) |
| `07a-galaxy-light-dense-overview.png`, `07b-galaxy-light-dense-focus-ava-abara.png` | Galaxy/Light. Body night sides read near-black in light mode (known E.4 weakness) |
| `rec-01-system-switch-inner-to-dense-12s.mp4` | selector → Dense: Inner bodies fall away, 110 enter |
| `rec-02-orbit-drag-then-focus-fly-in-14s.mp4` | two one-finger orbit drags, then contacts sheet → Focus in Orrery → fly-in |
| `a11y-*` | see `_notes/A11Y.md` |
| `f2-*`, `f2b-*` | release perf logs (PERFORMANCE.md "Release (final)") |

**Reduced motion:** not re-shot in release. Same JS path as the debug verification in
`evidence/07-checkpoint-e/s4-*` (DECISIONS.md E.3): Android "Remove animations" → `reducedMotion=true`, moon
revolution / twinkle / sun pulse stop (two frames 5 s apart pixel-identical), switch = 180 ms crossfade. The
hook (`src/theme/use-reduced-motion.ts`) is not `__DEV__`-gated. Animation scales were left at 1 throughout F.

**Seen only in release vs debug:** nothing broken. `uiautomator dump` now succeeds while the Orrery animates.
Focus was cleared after leaving the Orrery tab (to Settings) and returning; not compared against debug.
