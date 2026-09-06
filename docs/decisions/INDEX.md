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

- **Is a decision still live?** Check the `Superseded by` column. 22 of
  91 ADRs are superseded in whole or in part.
- **Which decisions govern a file?** Don't grep this file — ask the graph:
  `npm run graph:ask -- governs src/db/field-values-dao.ts`, or follow the
  `governed_by` edges.

## Index

| # | Title | Status | Phase | Supersedes | Superseded by | Subsystems | Key files | Directories |
|---|-------|--------|-------|------------|---------------|------------|-----------|-------------|
| 001 | Normalized Custom-Field Values | Accepted | 16-custom-field-value-normalization | ADR-013; ADR-014 (partial); ADR-015 (partial) | — | — | 9 | `src/db`, `src/db/migrations` |
| 002 | Cross-Version Contact Import — Hybrid Two-Picker | Accepted | 19.1-older-android-contact-picker-hybrid-two-picker-adr-002 | — | ADR-003 (partial) | — | 11/12 live | `modules/orbit-contact-picker`, `modules/orbit-contact-picker/android/src/main`, `modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker` +5 |
| 003 | `READ_CONTACTS` on API 37+ for Reconcile | Accepted | 20-contact-reconciliation-merge | ADR-002 (partial) | — | — | 5 | `modules/orbit-contact-picker/android/src/main`, `plugins`, `src/screens` +1 |
| 004 | Flat Single-App Repository | Accepted | 01-project-scaffold-portable-code | — | — | — | 1 | `src/db` |
| 005 | AiService Port Omits the Local/LAN (Ollama) Provider | Accepted | 01-project-scaffold-portable-code | — | — | — | 3 | `src/services` |
| 006 | Theme-Token Architecture | Accepted | 01-project-scaffold-portable-code | — | ADR-083 (partial) | — | 7 | `scripts`, `src/screens`, `src/stores` +1 |
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
| 018 | Archive-Gated Contact Purge with Explicit Fan-Out | Accepted | 04-contact-crud-lifecycle | — | ADR-080 (note — Archived list entry points only; gate unchanged) | — | 5 | `src/db`, `src/screens`, `src/theme` |
| 019 | Native Stack Contact Lifecycle Navigation | Accepted | 04-contact-crud-lifecycle | — | ADR-080 (partial — root shell) | — | 4 | `src/navigation`, `src/screens` |
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
| 030 | Explicit Confirmation of AI-Proposed Fuel | Accepted | 07-conversational-fuel | — | ADR-081 | — | 4 | `src/components`, `src/db`, `src/screens` |
| 031 | Bound Local Fuel Search without FTS5 | Accepted | 07-conversational-fuel | — | ADR-032 (partial) | — | 4/6 live | `src/db`, `src/navigation`, `src/screens` |
| 032 | Flat Dashboard Discovery and In-Query Contact Search | Accepted | 08-dashboard-never-contacted-screen | ADR-031 (partial) | — | — | 5/7 live | `src/db`, `src/navigation`, `src/screens` |
| 033 | Profile Marking and Shared Drag-Reordered Favourites | Accepted | 08-dashboard-never-contacted-screen | — | ADR-075 | — | 4/6 live | `src/components`, `src/db`, `src/screens` |
| 034 | Birthday Banner and Re-query Dashboard Freshness | Accepted | 08-dashboard-never-contacted-screen | — | ADR-076 (partial — banner) | — | 4/5 live | `src/db`, `src/logic`, `src/screens` |
| 035 | Native SMS Handoff with Guaranteed Clipboard Copy | Accepted | 09-compose-screen-sms-handoff | — | ADR-061 (partial) | — | 3 | `src/db`, `src/logic`, `src/screens` |
| 036 | Entry-Agnostic Compose Navigation and Transmittable-Fuel Guardrails | Accepted | 09-compose-screen-sms-handoff | — | ADR-078 (partial — Off Limits visible on the Research side) | — | 5 | `src/db`, `src/navigation`, `src/screens` |
| 037 | Text-Only Android Share Intent Integration | Accepted | 10-share-sheet-capture | — | — | — | 3 | `modules/orbit-share-finish/android/src/main/java/expo/modules/orbitsharefinish`, `patches`, `src/navigation` |
| 038 | Contact-Owned Share Capture Fuel | Accepted | 10-share-sheet-capture | — | — | — | 5 | `src/db`, `src/logic`, `src/screens` |
| 039 | Pre-Scheduled Inexact Decay Reminders | Accepted | 11-actionable-notifications | ADR-029 (partial) | — | — | 5 | `src/db`, `src/services/notifications` |
| 040 | Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing | Accepted | 11-actionable-notifications | — | — | — | 6 | `src/db`, `src/navigation`, `src/services/notifications` |
| 041 | Notification Settings, Privacy Channels, and Birthday Alerts | Accepted | 11-actionable-notifications | — | — | — | 6 | `src/db`, `src/db/migrations`, `src/screens` +1 |
| 042 | Shared Status Palette for Dashboard and Widget Rings | Accepted | 12-home-screen-widget | — | — | — | 5 | `src/components`, `src/services/widget`, `src/theme` |
| 043 | Static Globally Mirrored Favourites Widget | Accepted | 12-home-screen-widget | — | ADR-075 (partial — ordering source only) | — | 3/4 live | `src/db`, `src/services/widget` |
| 044 | Headless Widget Actions and Dashboard-Rooted Deep Links | Accepted | 12-home-screen-widget | — | ADR-074 (partial) | — | 4 | `src/navigation`, `src/services/widget` |
| 045 | Event-Driven Widget Refresh and Boot Recovery | Accepted | 12-home-screen-widget | — | — | — | 4 | `plugins`, `src/services/notifications`, `src/services/widget` |
| 046 | Query-Time Orrery Placement and Transactional Ring Ordering | Accepted | 13-orrery | — | — | — | 4 | `src/db`, `src/logic` |
| 047 | App-Level Assignable Sun and Themed Self Identity | Accepted | 13-orrery | — | — | — | 6 | `src/db`, `src/db/migrations`, `src/logic` +2 |
| 048 | Status-Default Static Orrery with a Single-Canvas Morph | Accepted | 13-orrery | — | ADR-077 (partial — dual view/morph) | — | 7 | `src/components`, `src/components/orrery`, `src/navigation` +1 |
| 049 | BYO-Key AI Configuration and Credential Boundary | Accepted | 14-ai-message-suggestions | — | — | — | 5 | `src/db`, `src/db/migrations`, `src/services` |
| 050 | Closed AI Prompt Egress Allowlist and Opt-In Field Sharing | Accepted | 14-ai-message-suggestions | — | ADR-078 (partial — Off Limits and permitted interaction notes) | — | 5 | `src/ai`, `src/components`, `src/db` |
| 051 | Public-HTTPS Custom AI Egress Guard | Accepted | 14-ai-message-suggestions | — | — | — | 5 | `modules/orbit-secure-fetch/src`, `src/ai`, `src/ai/__fixtures__` +1 |
| 052 | Compose-Owned AI Draft Lifecycle and Acknowledged Egress | Accepted | 14-ai-message-suggestions | — | ADR-079 (partial — acknowledgement and Profile entry) | — | 5 | `src/db`, `src/logic`, `src/navigation` +1 |
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
| 064 | Permissionless Android 17 System-Contact Snapshot Acquisition | Accepted | 19-system-contact-import | — | — | — | 4 | `modules/orbit-contact-picker`, `modules/orbit-contact-picker/android/src/main`, `modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker` +1 |
| 065 | Durable Resumable Contact-Import Sessions with Failure-Isolated Photos | Accepted | 19-system-contact-import | — | — | — | 6 | `src/backup`, `src/db`, `src/db/migrations` +1 |
| 066 | Deliberate Reviewed Import with Unbound Bulk Defaults | Accepted | 19-system-contact-import | — | — | — | 7 | `src/db`, `src/screens`, `src/services/import` |
| 067 | Conservative Advisory Identity Matching and Explicit Source Consolidation | Accepted | 19-system-contact-import | — | — | — | 6 | `src/components`, `src/db`, `src/screens` +1 |
| 068 | User-Triggered, Source-Only Reconciliation with Durable Review | Accepted | 20-contact-reconciliation-merge | — | — | — | 8 | `src/db`, `src/db/migrations`, `src/logic` +2 |
| 069 | Atomic Tombstone-Backed Orbit Contact Merge | Accepted | 20-contact-reconciliation-merge | — | — | — | 7 | `src/components`, `src/db`, `src/db/migrations` +1 |
| 070 | Durable Pending Interaction-Assist Lifecycle and Portable Opt-Out | Accepted | 21-interaction-assist-reach-out | — | — | — | 11 | `src/backup`, `src/components`, `src/db` +5 |
| 071 | User-Attested Handoff-Time Interaction Logging Through the Sole Recency Writer | Accepted | 21-interaction-assist-reach-out | — | — | — | 3 | `src/components`, `src/db` |
| 072 | Shared Actionable Reach Out Router with Native Channel Handoff | Accepted | 21-interaction-assist-reach-out | — | — | — | 6 | `src/components`, `src/db`, `src/screens` +1 |
| 073 | Merge-Reparented, Purge-Cascaded Interaction Assists | Accepted | 21-interaction-assist-reach-out | — | — | — | 3 | `src/db`, `src/db/migrations` |
| 074 | Widget Contact Supersession and Strict Reach Deep-Link Fail-Safe | Accepted | 21-interaction-assist-reach-out | ADR-044 (partial) | — | — | 5 | `src/navigation`, `src/screens`, `src/services/widget` |
| 075 | Binary Favourite Membership Without a User-Facing Order | Accepted | milestone-2 | ADR-033 (full); ADR-043 (partial — ordering source only) | — | — | 4/6 live | `src/db`, `src/screens`, `src/services/widget` |
| 076 | Population-Reached Birthdays Without a Dashboard Banner | Accepted | milestone-2 | ADR-034 (partial — banner) | — | — | 3/4 live | `src/db`, `src/logic`, `src/screens` |
| 077 | Single Canonical Orrery with a Constrained Inspection Camera | Accepted | milestone-2 | ADR-048 (partial — dual view/morph) | — | — | 4 | `src/components`, `src/components/orrery`, `src/screens` |
| 078 | Negative-Constraint Off Limits and Gated Recent-Interaction AI Context | Accepted | milestone-2 | ADR-050 (partial — Off Limits and permitted interaction notes); ADR-036 (partial — Off Limits visible on the Research side) | — | — | 5 | `src/ai`, `src/db`, `src/screens` |
| 079 | On-Demand AI Transparency and Compose-Only Three-Suggestion Invocation | Accepted | milestone-2 | ADR-052 (partial — acknowledgement and Profile entry) | — | — | 5 | `src/db`, `src/logic`, `src/navigation` +1 |
| 080 | Four-Tab Bottom Navigation Shell with Per-Tab Stacks | Accepted | milestone-2 | ADR-019 (partial — root shell); ADR-018 (note — Archived list entry points only; gate unchanged) | — | — | 4 | `src/navigation`, `src/screens` |
| 081 | Retire AI-Proposed Fuel for Explicit Per-Item Permission | Accepted | 24.2-contact-knowledge-egress-search-types | ADR-030 | — | — | 2 | `src/db`, `src/db/migrations` |
| 082 | Universal Capture FAB, Canonical Picker, and Truthful Quick Log | Accepted | 22-app-shell-navigation | — | — | — | 6 | `src/components`, `src/db` |
| 083 | Durable Multi-Package Theme Configuration and Restore-Before-Paint | Accepted | 23-theme-visual-system | ADR-006 (partial) | — | — | 7 | `src/backup`, `src/db`, `src/db/migrations` +2 |
| 084 | Four Semantic Theme Palettes, Curated Accents, and Contrast Validation | Accepted | 23-theme-visual-system | — | — | — | 6 | `src/screens`, `src/theme` |
| 085 | Live Reduced-Motion Signal for Skia Ambient Animation | Accepted | 23-theme-visual-system | — | — | — | 4 | `src/components/orrery`, `src/theme`, `src/theme/tokens` |
| 086 | Semantic Icons and Accessible Interaction Primitives | Accepted | 23-theme-visual-system | — | — | — | 8 | `src/components`, `src/components/icons`, `src/components/ui` +1 |
| 087 | Bundled Background Presets and Package-Specific Surface Treatment | Accepted | 23-theme-visual-system | — | — | — | 6 | `assets/backgrounds`, `src/components/ui`, `src/components/ui/__dev__` +2 |
| 088 | Additive Contact-Knowledge Schema and Application-Owned Memory Registry | Accepted | 24.1-contact-knowledge-foundation | — | — | — | 10 | `src/db`, `src/db/migrations` |
| 089 | Recoverable Memory Lifecycle and Contact-Operation Integrity | Accepted | 24.1-contact-knowledge-foundation | — | — | — | 7 | `src/db`, `src/screens`, `src/services` |
| 090 | Additive Custom-Field Value History and Deferred Contact Scope | Accepted | 24.2-contact-knowledge-egress-search-types | — | — | — | 7 | `src/db`, `src/db/migrations` |
| 091 | Imported Contact Notes as AI-Off Typed Memories | Accepted | 24.2-contact-knowledge-egress-search-types | — | — | — | 7 | `modules/orbit-contact-picker`, `modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker`, `src/db` +1 |
