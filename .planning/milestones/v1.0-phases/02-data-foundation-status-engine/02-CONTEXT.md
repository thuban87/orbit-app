# Phase 2: Data Foundation & Status Engine - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — infrastructure phase; dossier 01-data records NO `[OPEN]` items, so no owner grey-area questions)

<domain>
## Phase Boundary

The migration-1 SQLite scaffold — every core table and un-backfillable column, the single-writer
recency DAO, query-time status, and the launch-sweep skeleton — correct and irreversible-safe from
day one.

**In scope (DATA-01…DATA-07, all `(infra)`):**
- DATA-01 — `PRAGMA user_version` migration runner: forward-only, strict order, each step
  transaction-wrapped; `foreign_keys=ON` + WAL + `busy_timeout` set BEFORE any transaction opens.
- DATA-02 — Migration 1 `contacts`: surrogate PK, distinct globally-unique `uid`, `created_at`,
  `modified_at`, `interval_days`, `category_id`, `social_battery`, optional-year `birthday`, `phone`,
  `email`, `photo`, `last_contact`, favourite rank, `ring_seq`, `archived_at`, snooze,
  "Rarely responds", reminders-off — every un-backfillable column from day one.
- DATA-03 — Migration 1 also: `categories` (seeded Family/Friends/Work/Community, editable,
  reorderable), the single-row self/profile record, `contact_links`, `interactions`, a separate
  `events` table; every mergeable table carries `uid` + `modified_at`.
- DATA-04 — EXACTLY ONE DAO function writes `contacts.last_contact` (= MAX over the contact's current
  interaction rows, recomputed after every insert/edit/delete, in a transaction, behind a JS mutex
  shared with headless writers).
- DATA-05 — Status/progress computed at QUERY TIME (never stored) as elapsed ÷ interval, bucketed at
  80%/100%, day-granular resolving at local midnight; SQL uses `date('now','localtime')`.
- DATA-06 — A launch-sweep ENTRY POINT that runs once per real foreground launch (never on module
  import or a headless tap), structured to HOST (later) quarantine expiry, history retention,
  archived-purge, schedule reconcile, backup rotation.
- DATA-07 — On-device benchmark on the Pixel: newest-interaction-per-contact query + status scan
  are acceptably fast.

**IMPORTANT cross-phase carve-in — custom-fields TABLES ship in migration 1 (HANDOFF §15 First moves
#3, §14.10):** migration 1 MUST also create `custom_field_defs` (with a **display-order column** and
`share_with_ai`, per §14.10 / [crud→fields]), `contact_custom_values`, and `field_history` — even
though the custom-fields FEATURE (parsers, `sortExpr`, quarantine sweep, editor) is Phase 3. Every
`contact_custom_values` column is declared TEXT forever (HANDOFF §14.2); never index/UNIQUE them.

**Fuel table ALSO ships in migration 1 (owner decision, 2026-08-14) — created EMPTY.** Resolving the
`[fuel→ai]`/ROADMAP "fuel columns from migration 1" constraint vs FUEL-01's migration-agnostic wording:
migration 1 creates the `fuel` table with FUEL-01's columns (`uid`, `contact_id` NOT NULL, `kind`,
`label`, `text`, `url`, `created_at`, `source`, `modified_at`). It starts EMPTY — the fuel LOGIC/UI
(the 5 kinds incl. never-transmitted `off_limits`, ranked projection, profile editor, cross-contact
search) is **Phase 7**, which adds NO new migration. This locks the fuel schema shape upfront (the
un-backfillable philosophy).

**Explicitly NOT this phase:** the custom-fields LOGIC/UI (Phase 3), contact CRUD/forms (Phase 4),
photos (Phase 5), the interaction-log UI + gravity/intensity/rogue rendering (Phase 6), the actual
sweep RESPONSIBILITIES (they land in their owning phases — Phase 2 builds only the skeleton + hooks).
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion — bounded by `[DECIDED]`
Pure infrastructure phase; dossier `01-data` records **no `[OPEN]` items**, so there are no owner
grey areas. Implementation choices are Claude's discretion **within** the recorded decisions in
HANDOFF §3/§14, CLAUDE.md's data-layer rules, dossier `01-data` + `INDEX.md`, and the ROADMAP
cross-phase constraints. Those are `[DECIDED]` — do NOT reverse them; if a genuine conflict forces
one, STOP and escalate to the owner (as happened with the Ollama decision in Phase 1).

**Load-bearing constraints (not choices — enforce them):**
- **Migrations are forward-only, ship as app code via `user_version`, run in strict order, each
  transaction-wrapped, and are IRREVERSIBLE in production** (no remote DB access — a migration bug is
  permanent for that user). Never assume a starting state; a user may jump v1→v6. `foreign_keys=ON` +
  WAL + `busy_timeout` set before any transaction (CLAUDE.md, HANDOFF §3).
- **Single-writer `last_contact` DAO (DATA-04):** the ONLY writer of `contacts.last_contact`,
  recomputed as MAX over current interaction rows on every insert/edit/delete, in a transaction,
  behind a JS mutex. Every touchpoint route writes through it (headless writers share the mutex). For
  "Rarely responds" contacts the MAX is over **connected rows only** ([log→data] — scopes, doesn't
  reverse, the rule).
- **Status is derived-never-stored (DATA-05):** query-time elapsed ÷ interval; `stable/wobble/decay`
  are 80%/100% thresholds; `rogue` is a 4th threshold + a non-time path; resolves day-granular at
  local midnight; SQL uses `date('now','localtime')`, TS uses `formatLocalDate()` — never
  `date('now')` / `toISOString().split('T')[0]` (UTC off-by-one; already reused in Phase 1).
- **Un-backfillable columns exist from migration 1** (DATA-02/03 list above + interaction
  `recorded_at`/`source`; fuel `kind`/`created_at`/`source`/`url`; `custom_field_defs` display-order +
  `share_with_ai`). Adding them later is impossible against un-reachable devices.
- **`modified_at` + distinct `uid` on every mergeable table** exist for backup's newest-edit-wins
  Merge (Phase 16); `uid` joins as un-backfillable in migration 1 ([restore→data]).
- **The launch sweep is a SWEEP at foreground launch, never a timer/trigger** (SQLite has no
  scheduler; triggers fire only on data events). Runs once per real foreground launch — NOT on module
  import or a headless widget/notification tap ([capture→data]: a cold-start share runs
  migrations + sweep before the picker).
- **Custom value columns are TEXT forever; never indexed/UNIQUE** (HANDOFF §14.2/§14.11 — DROP COLUMN
  needs it for Phase 3 quarantine expiry).

### Claude's Discretion (genuinely open, tunable)
- The DATA-07 benchmark "acceptable" threshold and the exact `rogue` constant (a multiple of the
  interval) are top-of-file tunable constants (CLAUDE.md convention).
- Migration-runner structure, DAO/module layout under `src/db/`, mutex implementation.
</decisions>

<code_context>
## Existing Code Insights

### Existing src/ (Phase 1 output — reuse, don't duplicate)
- `src/types.ts` — `calculateStatus()` + `FREQUENCY_DAYS`/`Frequency`/`OrbitStatus`/`SocialBattery`
  are ported and tested. The query-time status engine (DATA-05) should REUSE this pure logic, not
  re-derive it. `OrbitContact`'s precomputed `status`/`daysSinceContact` are labelled legacy-compat —
  Phase 2 is derived-never-stored, so do NOT persist those as columns.
- `src/utils/dates.ts` — `formatLocalDate()` (keep its comment); the `date('now','localtime')` rule.
- `src/db/` — EMPTY (`.gitkeep` only). This is where schema, the `user_version` migration runner,
  migration 1, and the DAOs land (CLAUDE.md repo layout: "Queries go through DAOs in `src/db/`, never
  inline in components").
- `src/stores/` — Zustand pattern (theme-store) if a DB/session store is useful.
- Stack: `expo-sqlite` (already a dep + config plugin from Phase 1); New Architecture on.

### Plugin analogs (HANDOFF §4 — logic shapes reusable, vault→SQL rewrite; read in place)
- `~/projects/Orbit/src/services/OrbitIndex.ts` (425) — the `statusOrder` sort (`decay` 0, `wobble` 1,
  `stable` 2, `snoozed` 3) is reusable; the vault scanner becomes SQL queries.
- `~/projects/Orbit/src/services/ContactManager.ts` (217) — operation shapes port; `vault.process()` /
  `processFrontMatter()` → SQLite DAO.

### Authoritative spec to read before planning
- `HANDOFF.md` §3 (data layer, `user_version` model, forward-only/irreversible) + §14 (custom-fields
  tables in migration 1) + §15 (First moves #3).
- `docs/dossier/01-data.md` (authoritative, no open items) + `docs/dossier/INDEX.md` cross-domain
  constraint log ([log→data] connected-rows recency; [crud→data] multi-row create transaction +
  NULL-`last_contact` "not yet"; [crud→fields] defs display-order; [fuel→ai] fuel columns from
  migration 1; [data→dashboard] `WHERE last_contact IS NOT NULL`; [restore→data] uid join).
- `CLAUDE.md` "Data layer rules" + "Custom fields — invariants".

### Integration points
- `src/db/` (schema/migrations/DAOs), the app launch path (run migrations + sweep before first
  render — reuse the Phase 1 App entry), `src/services/` (status engine, sweep skeleton).
</code_context>

<specifics>
## Specific Ideas

The DATA-07 device benchmark uses the **now-proven** build/test pipeline (STATE.md: FND-01 done —
`ssh droid` via Tailscale, scp/tar transport, `gradlew assembleRelease`, `adb install` on the Pixel
`1A071FDEE002BU`). No new owner bring-up needed; the package id is `com.bwales.orbit`.

Follow HANDOFF §15 First move #3 literally: stand up the SQLite layer with the `user_version` pattern
in place FROM the first migration, and create `custom_field_defs` + `contact_custom_values` +
`field_history` in that first migration (retrofitting later is impossible against un-reachable
devices). The Obsidian *data* importer is CUT (PROJECT.md Out of Scope) — no vault/markdown import;
the app starts clean. Only *code* shapes port.
</specifics>

<deferred>
## Deferred Ideas

- Custom-fields LOGIC — 7 parsers, `sortExpr()`, quarantine expiry, `field_history` retention sweep,
  the field editor UI → **Phase 3** (only the TABLES are created in migration 1 here).
- Contact CRUD/forms, archive/restore/purge, `contact_links` UI → **Phase 4**.
- The sweep RESPONSIBILITIES (quarantine expiry, archived-purge, schedule reconcile, digest re-register,
  backup rotation) → their owning phases (3, 4, 11, 15, 16); Phase 2 builds only the entry point + hooks.
- gravity/intensity/rogue rendering, the "Rarely responds"/rogue UI → **Phase 6** (the DB flags +
  connected-rows recency scoping exist here; the surfaces do not).
</deferred>
