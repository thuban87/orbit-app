# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-09-01
**Phases:** 21 (1–21, incl. sub-phases 18.1/18.2/19.1) | **Plans:** 181 | **Timeline:** 2026-08-11 → 2026-09-01 (~21 days) | **Commits:** 1,711 (368 `feat`)

### What Was Built
- A complete local-first Android personal-CRM: on-device SQLite (migrations to `user_version` 14, ~90,800 LOC TS), contacts + custom fields + photos + interaction log + Conversational Fuel, the dashboard, the two-view Skia orrery, share-sheet capture, actionable notifications, and a home-screen widget.
- The full friction loop end-to-end: compose screen → SMS/Call/Text/Email handoff → durable Interaction Assist that logs the touchpoint at handoff time through the single recency writer.
- System-contact acquisition + reconciliation: hybrid two-picker import (ADR-002), one-way source reconciliation and explicit atomic Orbit-to-Orbit merge with tombstoning (ADR-003), the Bound/Unbound lifecycle, and the load-bearing backup/export/restore.

### What Worked
- **Foundation-first paid off.** Every un-backfillable column landed in migration 1, and the single-writer `last_contact` DAO was enforced from Phase 2 — the plugin's four-writer recency drift never reappeared.
- **Dossier-as-ground-truth + `[DECIDED]`/`[REJECTED]` discipline** kept 21 phases coherent; decisions were implemented, not relitigated.
- **Real device UAT on the physical Pixel caught what mocked tests could not** — the Hermes `globalThis.crypto` undefined crash and the API-37 `READ_CONTACTS` reconcile gap were both invisible to green unit suites.
- **Cross-AI plan convergence + deep code review gates** before execution repeatedly caught HIGH findings pre-merge.
- **The KB substrate was built and fully backfilled** — 24 phase KB manifests, ADRs, and the graphify bridge — so the decision record is queryable, not just archived prose.

### What Was Inefficient
- **The legacy STATE.md format silently desynced the tracking tooling.** At milestone close, the ROADMAP checkboxes, `init.manager`, the REQUIREMENTS traceability table, and ROADMAP's own Progress table all disagreed with each other and with reality; readiness had to be reconstructed from the STATE narrative + on-disk artifacts. Pure tracking cost, avoidable with a format migration.
- **Pre-existing Biome / `check:colors` drift accumulated as deferred items** across Phases 5/10/14/18.1/18.2/21 instead of being fixed at the source, then all surfaced together at milestone close.
- **A native-boundary planning gap shipped undetected until device UAT.** Phase 20 reconcile assumed `readAllContacts` "just works" as a Phase-19 artifact, unreconciled against ADR-002's `maxSdkVersion=36` cap — invisible because tests mock the native module. It forced an owner-level ADR-003 decision mid-UAT.

### Patterns Established
- **Device-UAT with WAL-aware `run-as` DB verification** is the real gate for data-invariant phases — seeing a screen render is not proof the invariants hold.
- **Hermes guards for WebCrypto** (`globalThis.crypto` is absent on-device; Node/vitest has it, so tests never catch the gap).
- **Desktop-build → Pixel pipeline via rsync/scp over SSH**, never `git push` — keeps the global no-push rule intact while still shipping APKs to a real device.
- **Batch human decisions at close** — run every review/audit lane, then surface owner decisions once, not per-reviewer.

### Key Lessons
1. **Mocked native modules hide device-only failures.** Any phase touching a native boundary or a data invariant needs real device UAT with DB-level verification, not just a green unit suite.
2. **Trust the STATE narrative + on-disk artifacts over checkbox/CLI projections** on this repo — the legacy STATE.md format makes the derived trackers drift; verify readiness against the code, not the counters.
3. **Capping or removing a permission by ADR can strand a later consumer.** A permission decision (ADR-002's `READ_CONTACTS maxSdkVersion=36`) must be cross-checked against every feature that reads through it before it ships.

### Cost Observations
- Model mix: not instrumented this milestone. Work ran predominantly on Opus for orchestration/execution with codex + a read-only Claude subagent for cross-AI review.
- Sessions: not tracked precisely (multi-session, autonomous per-phase execution, sequential / parallelization off).
- Notable: device-UAT cycles were the highest-value spend — each one that ran on the physical Pixel surfaced correctness bugs that no amount of unit testing had.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | (not tracked) | 21 | Baseline: dossier-driven planning, cross-AI review, device-UAT gating, KB extraction substrate built + backfilled. |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 1,812 (Phase 21 node gate) | (not measured) | Many (pure node-tested logic modules throughout) |

### Top Lessons (Verified Across Milestones)

1. *(Established v1.0 — awaits a second milestone to confirm.)* Device UAT catches what mocked tests miss.
2. *(Established v1.0 — awaits confirmation.)* Legacy STATE.md format desyncs tracking; verify against artifacts.
