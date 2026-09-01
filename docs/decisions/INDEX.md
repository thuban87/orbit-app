# ADR Index

**GENERATED FILE — DO NOT EDIT.** Regenerate with `npm run gen:adr-index`.

Source of truth: the individual `ADR-NNN-*.md` files. This index is *derived*. If a row
here disagrees with the underlying ADR, **the ADR wins** — do not "fix" the row, fix the
generator.

## Do not machine-read this file

An earlier version of this index (on the owner's other project) carried a hand-written
"Key file globs" column. It was a lossy summary: one ADR's four exact files were recorded
as `src/components/**/*.tsx` — the whole component tree. Anything that consumed that
column concluded every store was governed by the same 71 ADRs.

**The ADR bodies' `**Key files:**` blocks are the contract.** They are what
`scripts/synthesize-adr-edges.ts` turns into the graph's `code -> ADR` edges, and what
`npm run audit:adr-key-files` validates. This file is a human navigation aid — nothing
more. The "Key files" column below is a *count* and the real directories, deliberately
not something you can pattern-match against.

## How to use this

- **Is a decision still live?** Check the `Superseded by` column. 1 of
  34 ADRs are superseded in whole or in part.
- **Which decisions govern a file?** Don't grep this file — ask the graph:
  `npm run graph:ask -- governs src/db/field-values-dao.ts`, or follow the
  `governed_by` edges.

## Index

| # | Title | Status | Phase | Supersedes | Superseded by | Subsystems | Key files | Directories |
|---|-------|--------|-------|------------|---------------|------------|-----------|-------------|
| 001 | Normalize Custom-Field Values | — | — | — | — | — | — | — |
| 002 | Cross-Version Contact Import — Hybrid Two-Picker | — | — | — | — | — | — | — |
| 003 | `READ_CONTACTS` on API 37+ for the Reconcile feature | — | — | — | — | — | — | — |
| 004 | Flat Single-App Repository | Accepted | 01-project-scaffold-portable-code | — | — | — | 1 | `src/db` |
| 005 | AiService Port Omits the Local/LAN (Ollama) Provider | Accepted | 01-project-scaffold-portable-code | — | — | — | 3 | `src/services` |
| 006 | Theme-Token Architecture | Accepted | 01-project-scaffold-portable-code | — | — | — | 7 | `scripts`, `src/screens`, `src/stores` +1 |
| 007 | Cross-Machine Android Build Pipeline & Physical-Pixel FND-01 Proof | Accepted | 01-project-scaffold-portable-code | — | — | — | 3 | `docs/runbooks`, `src/constants` |
| 008 | Initial Contact Schema as a Cross-Phase Data Contract | Accepted | 02-data-foundation-status-engine | — | — | — | 3 | `src/db`, `src/db/migrations` |
| 009 | Crash-Safe Forward-Only SQLite Migrations | Accepted | 02-data-foundation-status-engine | — | — | — | 4 | `src/db`, `src/db/migrations` |
| 010 | Single-Writer Interaction Recency Spine | Accepted | 02-data-foundation-status-engine | — | — | — | 3 | `src/db`, `src/db/migrations` |
| 011 | Query-Time Status and Never-Contacted Segregation | Accepted | 02-data-foundation-status-engine | — | — | — | 3 | `src/db` |
| 012 | Opt-Out Android Backup for Third-Party PII | Accepted | 02-data-foundation-status-engine | — | — | — | 1 | `src/db` |
| 013 | Runtime Two-Table Custom Fields with Whitelist-Constructed DDL | Accepted | 03-custom-fields | — | — | — | 6 | `src/db` |
| 014 | Read-Time Custom-Field Type Semantics and a Single Sort Expression | Accepted | 03-custom-fields | — | — | — | 5 | `src/components`, `src/db` |
| 015 | Lossless Field Changes with Quarantine and Launch-Time Retention Sweep | Accepted | 03-custom-fields | — | — | — | 5 | `src/db`, `src/services` |
| 016 | Fixed-First Contact Forms and Atomic Contact Creation | Accepted | 04-contact-crud-lifecycle | — | — | — | 5 | `src/components`, `src/db`, `src/screens` |
| 017 | Multi-Link Contact Reachability | Accepted | 04-contact-crud-lifecycle | — | — | — | 4 | `src/components`, `src/db`, `src/screens` |
| 018 | Archive-Gated Contact Purge with Explicit Fan-Out | Accepted | 04-contact-crud-lifecycle | — | — | — | 5 | `src/db`, `src/screens`, `src/theme` |
| 019 | Native Stack Contact Lifecycle Navigation | Accepted | 04-contact-crud-lifecycle | — | — | — | 4 | `src/navigation`, `src/screens` |
| 020 | Library-Only Photo Capture with Themed In-App Cropping and One-Time URL Download | Accepted | 05-photos | — | — | — | 5 | `src/components`, `src/screens`, `src/services/photos` |
| 021 | Durable Relative-Path Photo Masters with Crash-Safe Lifecycle Cleanup | Accepted | 05-photos | — | — | — | 7 | `src/components/field-widgets`, `src/db`, `src/services/photos` |
| 022 | Tokenized Deterministic Initials Avatars | Accepted | 05-photos | — | — | — | 5 | `src/components`, `src/stores`, `src/theme` |
| 023 | Structured Touchpoints and One-Tap Defaults | Accepted | 06-interaction-log-status-impact | — | — | — | 4 | `src/components`, `src/db`, `src/screens` |
| 024 | Editable Touchpoint History and Recomputed Recency | Accepted | 06-interaction-log-status-impact | — | — | — | 5 | `src/components`, `src/db`, `src/screens` |
| 025 | Immutable Lifecycle Events in a Unified Timeline | Accepted | 06-interaction-log-status-impact | — | — | — | 5 | `src/components`, `src/db` |
| 026 | Rogue Status for Unresponsive or Far-Overdue Contacts | Accepted | 06-interaction-log-status-impact | — | — | — | 5 | `src/db`, `src/screens`, `src/theme` |
| 027 | Derived Profile-Only Gravity and Intensity | Accepted | 06-interaction-log-status-impact | — | — | — | 6 | `src/components`, `src/db`, `src/services` |
| 028 | Per-Item Conversational Fuel with Fixed Kinds | Accepted | 07-conversational-fuel | — | — | — | 5 | `src/components`, `src/db`, `src/db/migrations` +1 |
| 029 | In-Query Fuel Eligibility and a Shared Ranked Projection | Accepted | 07-conversational-fuel | — | — | — | 5 | `src/components`, `src/db`, `src/screens` +1 |
| 030 | Explicit Confirmation of AI-Proposed Fuel | Accepted | 07-conversational-fuel | — | — | — | 4 | `src/components`, `src/db`, `src/screens` |
| 031 | Bound Local Fuel Search without FTS5 | Accepted | 07-conversational-fuel | — | ADR-032 (partial) | — | 4/6 live | `src/db`, `src/navigation`, `src/screens` |
| 032 | Flat Dashboard Discovery and In-Query Contact Search | Accepted | 08-dashboard-never-contacted-screen | ADR-031 (partial) | — | — | 6/7 live | `src/db`, `src/navigation`, `src/screens` |
| 033 | Profile Marking and Shared Drag-Reordered Favourites | Accepted | 08-dashboard-never-contacted-screen | — | — | — | 6 | `src/components`, `src/db`, `src/logic` +1 |
| 034 | Birthday Banner and Re-query Dashboard Freshness | Accepted | 08-dashboard-never-contacted-screen | — | — | — | 5 | `src/components`, `src/db`, `src/logic` +1 |
