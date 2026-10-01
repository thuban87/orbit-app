# Lab A — owner decisions log

| Date | Decision | Scope | Notes |
|---|---|---|---|
| 2026-09-30 | Lab A installs as its own package `com.bwales.orbit.laba`, builds on droid in `orbit-lab-a`, Metro :8083, device = whatever adb reports | Lab infra | Stop-gate `git worktree list` replaced by read-only rev-parse verification (hook blocks `git worktree`); owner accepted. |
| 2026-10-01 | Share droid with Experiment B: check droid is idle before any build; hold off if busy | Lab infra | Probe: scratchpad `droid-busy.sh` (wmic absent on droid). |
| 2026-10-01 | **K — keep 45° tilted Home (`LAB_HOME_TILT_DEG = 45`) as the lab default for testing** | Lab only | Reverses dossier milestone-2 phase-08 §C/§P + 29-UI-SPEC ORRC-04/05 ("Home/Recenter top-down"). Owner approved for testing only; **production adoption remains a separate owner decision**. |
