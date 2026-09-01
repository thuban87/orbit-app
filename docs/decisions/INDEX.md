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

- **Is a decision still live?** Check the `Superseded by` column. 9 of
  63 ADRs are superseded in whole or in part.
- **Which decisions govern a file?** Don't grep this file — ask the graph:
  `npm run graph:ask -- governs src/db/field-values-dao.ts`, or follow the
  `governed_by` edges.

## Index

| # | Title | Status | Phase | Supersedes | Superseded by | Subsystems | Key files | Directories |
|---|-------|--------|-------|------------|---------------|------------|-----------|-------------|
| 001 | Normalized Custom-Field Values | Accepted | 16-custom-field-value-normalization | ADR-013; ADR-014 (partial); ADR-015 (partial) | — | — | 9 | `src/db`, `src/db/migrations` |
| 002 | Cross-Version Contact Import — Hybrid Two-Picker | — | — | — | — | — | — | — |
| 003 | `READ_CONTACTS` on API 37+ for the Reconcile feature | — | — | — | — | — | — | — |
| 004 | Flat Single-App Repository | Accepted | 01-project-scaffold-portable-code | — | — | — | 1 | `src/db` |
| 005 | AiService Port Omits the Local/LAN (Ollama) Provider | Accepted | 01-project-scaffold-portable-code | — | — | — | 3 | `src/services` |
| 006 | Theme-Token Architecture | Accepted | 01-project-scaffold-portable-code | — | — | — | 7 | `scripts`, `src/screens`, `src/stores` +1 |
| 007 | Cross-Machine Android Build Pipeline & Physical-Pixel FND-01 Proof | Accepted | 01-project-scaffold-portable-code | — | — | — | 3 | `docs/runbooks`, `src/constants` |
| 008 | Initial Contact Schema as a Cross-Phase Data Contract | Accepted | 02-data-foundation-status-engine | — | ADR-059 (partial) | — | 3 | `src/db`, `src/db/migrations` |
| 009 | Crash-Safe Forward-Only SQLite Migrations | Accepted | 02-data-foundation-status-engine | — | — | — | 4 | `src/db`, `src/db/migrations` |
| 010 | Single-Writer Interaction Recency Spine | Accepted | 02-data-foundation-status-engine | — | — | — | 3 | `src/db`, `src/db/migrations` |
| 011 | Query-Time Status and Never-Contacted Segregation | Accepted | 02-data-foundation-status-engine | — | — | — | 3 | `src/db` |
| 012 | Opt-Out Android Backup for Third-Party PII | Accepted | 02-data-foundation-status-engine | — | — | — | 1 | `src/db` |
| 013 | Runtime Two-Table Custom Fields with Whitelist-Constructed DDL | Accepted | 03-custom-fields | — | ADR-001 | — | 6 | `src/db` |
| 014 | Read-Time Custom-Field Type Semantics and a Single Sort Expression | Accepted | 03-custom-fields | — | ADR-001 (partial) | — | 5 | `src/components`, `src/db` |
| 015 | Lossless Field Changes with Quarantine and Launch-Time Retention Sweep | Accepted | 03-custom-fields | — | ADR-001 (partial) | — | 5 | `src/db`, `src/services` |
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
| 029 | In-Query Fuel Eligibility and a Shared Ranked Projection | Accepted | 07-conversational-fuel | — | ADR-039 (partial) | — | 5 | `src/components`, `src/db`, `src/screens` +1 |
| 030 | Explicit Confirmation of AI-Proposed Fuel | Accepted | 07-conversational-fuel | — | — | — | 4 | `src/components`, `src/db`, `src/screens` |
| 031 | Bound Local Fuel Search without FTS5 | Accepted | 07-conversational-fuel | — | ADR-032 (partial) | — | 4/6 live | `src/db`, `src/navigation`, `src/screens` |
| 032 | Flat Dashboard Discovery and In-Query Contact Search | Accepted | 08-dashboard-never-contacted-screen | ADR-031 (partial) | — | — | 6/7 live | `src/db`, `src/navigation`, `src/screens` |
| 033 | Profile Marking and Shared Drag-Reordered Favourites | Accepted | 08-dashboard-never-contacted-screen | — | — | — | 6 | `src/components`, `src/db`, `src/logic` +1 |
| 034 | Birthday Banner and Re-query Dashboard Freshness | Accepted | 08-dashboard-never-contacted-screen | — | — | — | 5 | `src/components`, `src/db`, `src/logic` +1 |
| 035 | Native SMS Handoff with Guaranteed Clipboard Copy | Accepted | 09-compose-screen-sms-handoff | — | ADR-061 (partial) | — | 3 | `src/db`, `src/logic`, `src/screens` |
| 036 | Entry-Agnostic Compose Navigation and Transmittable-Fuel Guardrails | Accepted | 09-compose-screen-sms-handoff | — | — | — | 5 | `src/db`, `src/navigation`, `src/screens` |
| 037 | Text-Only Android Share Intent Integration | Accepted | 10-share-sheet-capture | — | — | — | 3 | `modules/orbit-share-finish/android/src/main/java/expo/modules/orbitsharefinish`, `patches`, `src/navigation` |
| 038 | Contact-Owned Share Capture Fuel | Accepted | 10-share-sheet-capture | — | — | — | 5 | `src/db`, `src/logic`, `src/screens` |
| 039 | Pre-Scheduled Inexact Decay Reminders | Accepted | 11-actionable-notifications | ADR-029 (partial) | — | — | 5 | `src/db`, `src/services/notifications` |
| 040 | Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing | Accepted | 11-actionable-notifications | — | — | — | 6 | `src/db`, `src/navigation`, `src/services/notifications` |
| 041 | Notification Settings, Privacy Channels, and Birthday Alerts | Accepted | 11-actionable-notifications | — | — | — | 6 | `src/db`, `src/db/migrations`, `src/screens` +1 |
| 042 | Shared Status Palette for Dashboard and Widget Rings | Accepted | 12-home-screen-widget | — | — | — | 5 | `src/components`, `src/services/widget`, `src/theme` |
| 043 | Static Globally Mirrored Favourites Widget | Accepted | 12-home-screen-widget | — | — | — | 4 | `src/db`, `src/screens`, `src/services/widget` |
| 044 | Headless Widget Actions and Dashboard-Rooted Deep Links | Accepted | 12-home-screen-widget | — | — | — | 4 | `src/navigation`, `src/services/widget` |
| 045 | Event-Driven Widget Refresh and Boot Recovery | Accepted | 12-home-screen-widget | — | — | — | 4 | `plugins`, `src/services/notifications`, `src/services/widget` |
| 046 | Query-Time Orrery Placement and Transactional Ring Ordering | Accepted | 13-orrery | — | — | — | 4 | `src/db`, `src/logic` |
| 047 | App-Level Assignable Sun and Themed Self Identity | Accepted | 13-orrery | — | — | — | 6 | `src/db`, `src/db/migrations`, `src/logic` +2 |
| 048 | Status-Default Static Orrery with a Single-Canvas Morph | Accepted | 13-orrery | — | — | — | 7 | `src/components`, `src/components/orrery`, `src/navigation` +1 |
| 049 | BYO-Key AI Configuration and Credential Boundary | Accepted | 14-ai-message-suggestions | — | — | — | 5 | `src/db`, `src/db/migrations`, `src/services` |
| 050 | Closed AI Prompt Egress Allowlist and Opt-In Field Sharing | Accepted | 14-ai-message-suggestions | — | — | — | 5 | `src/ai`, `src/components`, `src/db` |
| 051 | Public-HTTPS Custom AI Egress Guard | Accepted | 14-ai-message-suggestions | — | — | — | 5 | `modules/orbit-secure-fetch/src`, `src/ai`, `src/ai/__fixtures__` +1 |
| 052 | Compose-Owned AI Draft Lifecycle and Acknowledged Egress | Accepted | 14-ai-message-suggestions | — | — | — | 5 | `src/db`, `src/logic`, `src/navigation` +1 |
| 053 | Local-First LiteLLM AI Model Catalog | Accepted | 14-ai-message-suggestions | — | — | — | 5 | `scripts`, `src/ai`, `src/screens` |
| 054 | Live Weekly Digest Retrospective and Overlooked Relationship Read | Accepted | 15-weekly-digest | — | — | — | 4 | `src/db`, `src/logic`, `src/screens` |
| 055 | Dedicated Weekly Digest Scheduling and Persisted Notification Policy | Accepted | 15-weekly-digest | — | — | — | 7 | `src/db`, `src/db/migrations`, `src/screens` +1 |
| 056 | Tombstone-Backed UID Reconciliation for Portable Restores | Accepted | 17-backup-export-restore | — | ADR-060 (partial) | — | 6 | `src/backup`, `src/db`, `src/db/migrations` |
| 057 | Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots | Accepted | 17-backup-export-restore | — | — | — | 7 | `src/backup`, `src/services`, `src/services/backup` |
| 058 | Optional Encrypted Backups and Previewed Local Restoration | Accepted | 17-backup-export-restore | — | — | — | 7 | `src/backup`, `src/db/migrations`, `src/screens` +2 |
| 059 | Normalized Contact Methods, Canonical Actionability, and Local Provenance | Accepted | 18.1-contact-method-normalization | ADR-008 (partial) | — | — | 9 | `src/db`, `src/db/migrations`, `src/logic` +1 |
| 060 | Versioned Portable Method Graph and Collision-Normalized Restoration | Accepted | 18.1-contact-method-normalization | ADR-056 (partial) | ADR-063 (partial) | — | 7 | `src/backup`, `src/db` |
| 061 | DAO-Selected Actionable Primary SMS Handoff | Accepted | 18.1-contact-method-normalization | ADR-035 (partial) | — | — | 5 | `src/db`, `src/logic`, `src/screens` |
| 062 | Bound/Unbound Lifecycle and One-Way Cadence Assignment | Accepted | 18.2-bound-unbound-lifecycle | — | — | — | 7 | `src/db`, `src/db/migrations`, `src/services` +1 |
| 063 | Versioned Lifecycle Backup and Dormant-Cadence Restore | Accepted | 18.2-bound-unbound-lifecycle | ADR-060 (partial) | — | — | 5 | `src/backup`, `src/db/migrations` |
