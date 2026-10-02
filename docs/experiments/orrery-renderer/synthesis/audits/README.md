# Synthesis audits (evidence)

Five read-only verification reports were written on 2026-10-02 for the Prototype D synthesis. Each agent read the lab branches and `main` at `34920925`, and checked file:line claims against code on disk. Nothing was built or edited. They are kept verbatim as evidence.

| File | Scope |
|---|---|
| [LAB-A-AUDIT.md](LAB-A-AUDIT.md) | Lab A: architecture, harvest for owner picks, main-line fixes, dead ends, tilt at 62°, perf facts |
| [LAB-B-AUDIT.md](LAB-B-AUDIT.md) | Lab B: architecture vs A, harvest, why the switch was janky, main-line fixes, false or misleading package claims |
| [LAB-C-AUDIT.md](LAB-C-AUDIT.md) | Lab C: camera and layout ideas portable to Skia 2.5D, causes of owner dislikes, 3D stack costs |
| [PROD-GROUNDING.md](PROD-GROUNDING.md) | Production Orrery inventory, recorded decisions V2 touches (REVERSES / AMENDS / ENFORCES), the five main-line bugs verified on main, 38.7 constraints |
| [PORTABILITY.md](PORTABILITY.md) | iOS and web portability of Skia 2.5D vs three.js WebGPU; dependency maturity; Android-only choices to isolate |

**Corrections made after the audits were written:**
- **D17 (moons):** the moon picture the owner described in Lab A was a stack pip. The owner then ruled M1 (build the moon bump as a new feature, and keep the pips).
- **Questions the audits left open for the owner** were all resolved in chat: 38.5 D-12 scrim vs ADR-149 glass, and the initials fallback. See [../OWNER-REVIEW.md](../OWNER-REVIEW.md).
