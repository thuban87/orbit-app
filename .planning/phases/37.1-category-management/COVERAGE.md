# Phase 37.1 — Replacement Multi-Source Coverage Audit

The replacement batch derives nine cohesive plans from the implementation inventory. It deliberately avoids both one-plan-per-consumer fragmentation and oversized seven-task plans. The archived 20-plan batch remains non-executable reference history.

SOURCE | ID | Contract | Plan(s) | Status
--- | --- | --- | --- | ---
GOAL | — | Category CRUD plus safe fallout across every consumer | 01–09 | COVERED
REQ | — | ROADMAP/REQUIREMENTS assign no Phase-37.1 IDs | — | EXCLUDED — no IDs invented
CONTEXT | Phase-37 D-03 | Activate reserved route only with the real manager | 01 | COVERED
DOSSIER | A–F | Single-category/null model, ordinary seeds, centralized CRUD, stable identity, canonical order | 01, 04 | COVERED
DOSSIER | G–J | Permanent previewed deletion, atomic reassignment/fallout, System validity and fallback | 02, 04, 07 | COVERED
DOSSIER | K–M | Three Orrery groups, complete large catalogs, System Builder hidden selections | 05–07 | COVERED
DOSSIER | N–O | Profile presentation identity and backup/restore | 03, 06 | COVERED
DOSSIER | P–R | Full consumer audit, DAO boundaries, accessibility and rollback evidence | 02, 04–09 | COVERED
DOSSIER | S | Tags, icons/colors/descriptions, inline CRUD, broad Orrery redesign, category maximum deferred | all | EXCLUDED
UI-SPEC | 1–5 | Settings route, manager states, Add/Rename/Reorder, AnchoredMenu, Snackbar | 01, 04 | COVERED
UI-SPEC | 6 | Complete delete/reassignment UX and lock-time revalidation | 02, 04 | COVERED
UI-SPEC | 7–8 | Shared ordinary selectors and System Builder | 05–07 | COVERED
UI-SPEC | 9 | Exact bounded three-group Orrery selector | 07 | COVERED
UI-SPEC | 10–11 | Commit-first sync/privacy and every integration-matrix consumer | 02–08 | COVERED
RESEARCH | Writer inventory | categories, contacts, all-status imports, Systems, settings, Profile, tombstones, restore | 01–03, 08 | COVERED
RESEARCH | Backup safety | v6 tombstones, survivor union, dependency order, exact zero replace-all | 03 | COVERED
RESEARCH | Validation | rollback matrix, manager rejection state, boundaries, physical device | 02, 04, 08, 09 | COVERED
OWNER | 2026-09-15 | Pending/complete/discarded imports use one interactive target; backup merge nulls all statuses | 02–04, 08 | COVERED
OWNER | 2026-09-15 supersession | No database substitution/fault route; automated rollback/UI rejection plus ordinary physical UAT | 02, 04, 09 | COVERED

## Task inventory and grouping rationale

| Plan | Substantive tasks | Cohesive boundary |
|---|---:|---|
| 01 | 2 | Production Add tracer plus the same DAO's non-destructive CRUD/order contract |
| 02 | 2 | One atomic deletion invariant and the transaction-composable System/fallout semantics it requires |
| 03 | 3 | One backup-v6 pipeline: schema/export → reconciliation → apply/replace-all |
| 04 | 3 | One centralized manager interaction state machine and its admitted shared UI primitives |
| 05 | 2 | One shared category-choice contract plus tightly related Contact/Import consumers |
| 06 | 2 | Dashboard and Profile consumers whose live durable state must follow category mutation |
| 07 | 2 | Orrery System authoring/catalog/selector integration over stable category UIDs |
| 08 | 2 | Final full-tree audit, living-doc synchronization, and automated phase gate |
| 09 | 2 | Owner-gated physical-device setup and ordinary successful UAT |

## Explicit prohibitions

No migration 030 or TARGET_VERSION change; a v6 backup-format bump (no v5→v6 legacy migration); no category history/field_history, Undo, quarantine, recovery UI, seed reconciliation, network/telemetry, inline component SQL, hardcoded colors, alternate database file, executor override, file cleanup route, dev-only category UAT screen, worktree, branch, or push is planned.
