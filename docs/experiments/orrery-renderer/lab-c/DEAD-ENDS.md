# Orrery Lab C — dead ends

## 2026-10-01 — Whole-disc Home fit for large Systems (Checkpoint C.5)

**Tried:** for Systems with > 24 contacts, Home/destination pose = tilt 0.9 and the largest zoom at which
the whole outer ring projects inside the usable rect (MIN_ZOOM lowered 0.25 → 0.08 to allow it).
**Evidence:** `evidence/04-checkpoint-c/10-dense-overview-whole-disc-fit.png`, `11-dense-near-after-fit.png`
(vs the previous framing `07-dense-overview.png`).
**Result:** all 120 bodies technically on screen, but they are pinpricks and ~120 concentric rings form a
moiré; no contact is identifiable. Worse than the previous framing.
**Lesson:** fitting the full extent at 120 contacts destroys legibility. A dense System needs (1) a minimum
on-screen body size (impostor/clamped billboard), (2) ring thinning / density-based ring opacity (the ring
density fade from C.5 is kept — it is inert at normal zoom), and (3) framing to the populated core rather
than the outermost ring.
**State:** code kept behind `LAB_FIT_ALL_ENABLED = false` in `src/logic/orrery-camera-logic.ts`; MIN_ZOOM
restored to 0.25. Default Home is the previous (readability-floor + B.3 strategy) framing again.
