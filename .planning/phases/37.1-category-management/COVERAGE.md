# Phase 37.1 — Multi-Source Coverage Audit

No external API integration exists: category management, search, SQLite mutation, backup/restore, and UAT fixtures remain local-only. The deterministic API detector matched internal TypeScript function surfaces only.

SOURCE | ID | Contract | Plans | Status | Notes
--- | --- | --- | --- | --- | ---
GOAL | — | Category CRUD plus atomic fallout across every consumer | 01–20 | COVERED | Route/add tracer, mutation APIs, deletion aggregate, consumers, backup, audit, UAT
REQ | — | ROADMAP/REQUIREMENTS define no Phase-37.1 IDs | — | EXCLUDED | No requirement namespace invented
CONTEXT | Phase-37 D-03 | Activate reserved CategoryManagement route only when manager exists | 01 | COVERED | Production route and Add tracer land together
DOSSIER | A–B | Single-category/null model; ordinary seeds; zero categories; no reseed | 01, 02, 05, 07, 18 | COVERED | No migration or restoration seed reconciliation
DOSSIER | C–D | Central manager; Add/Rename validation; no inline CRUD | 01, 03, 06, 13, 14 | COVERED | Shared shell feedback split from tracer
DOSSIER | E–F | Stable ID/UID identity; canonical contiguous ordering | 01, 14, 18 | COVERED | Concrete rename/reorder DAO APIs precede manager calls
DOSSIER | G–H | Permanent previewed deletion, reassignment, atomic rollback | 02, 06, 20, 19, 12 | COVERED | Preview/fingerprint/mutation include pending, complete, discarded import sessions
DOSSIER | I–J | Custom-System rule fallout and category-System identity/fallback | 02, 03, 15 | COVERED | Only matching rule/ref state removed
DOSSIER | K | Exact three-group Orrery selector, per-open state, no redesign | 15 | COVERED | Split from System Builder; reduced-motion contract explicit
DOSSIER | L–M | Complete large catalogs; hidden System Builder selections | 07–11, 17 | COVERED | Search at 13+, no cutoff
DOSSIER | N | Profile presentation identity/no-transfer deletion | 02, 10 | COVERED | Stable local ID / portable UID
DOSSIER | O | Backup v5 tombstones, merge deletion, exact replace-all | 04, 05, 16 | COVERED | No format bump; Dashboard token validated in existing v5 field
DOSSIER | P–Q | Complete consumer/writer audit and canonical DAO boundaries | 01–18 | COVERED | Full source audit and no inline component SQL
DOSSIER | R | Accessibility and non-gesture reorder | 06, 07, 15, 17, 12 | COVERED | Includes live reduced motion and physical device evidence
DOSSIER | S | Explicit deferrals | all | EXCLUDED | No tags, icons/colors/descriptions, inline CRUD, broad Orrery redesign, or category maximum
UI-SPEC | 1–3 | Route, manager shell/list, Add/Rename, exact feedback | 01, 06, 13, 14 | COVERED | Tracer remains production route→manager→DAO→committed UI
UI-SPEC | 4–6 | Reorder/menu/delete/reassignment and stale preview | 02, 06, 14, 20, 19, 12 | COVERED | All-status imports visible and rollback UAT safely injectable
UI-SPEC | 7 | Shared ordinary selectors and 13+ search | 07–10, 17 | COVERED | Explicit null/real-only policies
UI-SPEC | 8 | System Builder complete/hidden selection/Needs Attention | 03, 11 | COVERED | Orrery integration split out
UI-SPEC | 9 | Orrery exact groups, fallback, reduced motion | 15 | COVERED | Independent bounded plan
UI-SPEC | 10 | Commit publication, privacy, all dependent cleanup | 02, 06, 13, 18 | COVERED | All import statuses use identical selected target
UI-SPEC | 11 | Consumer integration matrix | 03, 05, 08–11, 15–18 | COVERED | Dashboard filter separated into query/store and UI plans
UI-SPEC | Copy/UI Considerations | Locked copy; empty/loading/error/populated/partial/overflow/long text | 01, 06–13, 15, 17, 19, 12 | COVERED | Status-qualified import rows extend the approved factual count pattern
RESEARCH | Writer inventory | categories, contacts, imports, rules/refs/prefs, settings, Profile, tombstones, restore | 01–05, 14, 16, 18 | COVERED | Migration 012 non-cascading FK drives all-status repair
RESEARCH | Backup safety | Parse-before-mutate, tombstones, dependency order, exact replace-all | 04, 05, 16 | COVERED | Final post-reconciliation local+incoming union validates both cross-kind directions and winner/tombstone variants
RESEARCH | Validation architecture | Fault rollback, 0/1/12/13/many, backups, source contracts, physical device | 02, 04–20, 12 | COVERED | Automated hook remains test-only; device seam is compile-time dev-only, app-wide, and isolated
OWNER RULING | 2026-09-15 | Every referencing import session—pending, complete, discarded—reassigns to the transaction target | 02, 06, 08, 18, 20, 19, 12 | COVERED | Preview, lock fingerprint, update, rollback, docs, audit, and UAT all name every status
OWNER RULING | 2026-09-15 | Development-only category UAT uses exactly `orbit-category-uat.db`; compile-time/memory-only activation throws in production; active UAT never reads/writes/closes/deletes `orbit.db`; exact cleanup; all accessor/cached-reference shapes tested; synthetic evidence only | 20, 19, 12 | COVERED | Normal DB may open during bootstrap; plans make only the narrower approved non-interference claim

## Reachability and prohibition audit

- Route → manager → create DAO → SQLite → committed refresh is Plan 01; actionless shell feedback follows in Plan 13 without weakening the tracer.
- Rename/reorder UI cannot run before Plan 14's concrete public DAO APIs; Plan 06 depends on it.
- Dashboard Uncategorized flows from Plan 16's one closed token through safe SQL/store/backup validation to Plan 17's filter UI.
- Backup final-union validation runs after category/System reconciliation and before candidate staging or transaction work; Plan 05 consumes Plan 04's pure validator.
- Device failure UAT uses Plan 20's fail-closed app-wide database route across `getExecutor()`, `getDb()`, registered callbacks, and cached references, with exact `orbit-category-uat.db` lifecycle, plus Plan 19's compile-time `__DEV__` controls. Plan 12 navigates from an explicitly active synthetic banner into ordinary app routes, forbids destructive work before activation, and records deactivation, exact-file close/delete absence, normal-routing restoration, inactive-on-restart proof, and exact reduced-motion baseline/restoration.
- No migration 030, TARGET_VERSION change, backup-format bump, field_history/category history, Undo, quarantine, reseed, network/telemetry, inline component SQL, hardcoded color, worktree, branch, or push is planned.

All source items are covered; there are no deferred or missing implementation items hidden by this audit.
