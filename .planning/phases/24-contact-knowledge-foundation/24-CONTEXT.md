# Phase 24: Contact Knowledge Foundation - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning (shim — phase pre-discussed externally; the dossier is the decision record)

<domain>
## Phase Boundary

Define and build Orbit's durable contact-knowledge model — first-class contact fields, typed Memory items, structured relationships, current-state history, and custom fields — presented as one unified "Things to Remember" surface. It is the foundation later consumed by Profile, Search, Update Contact, AI Compose, Import, Backup/Restore, and future Sync.

This phase was fully interrogated outside GSD (milestone-2 dossier process, amended per the 2026-09-01 cross-dossier audit). The dossier in canonical_refs is the authoritative decision record; this CONTEXT.md is a shim pointing at it, not a substitute.
</domain>

<decisions>
## Implementation Decisions

### Ground truth and process
- **D-01:** Read the phase dossier (canonical_refs) IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. [DECIDED] and [REJECTED] items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02:** Read the phase planning-notes file (canonical_refs) as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask. This dossier carries no dated amendment section — its audit outcomes live in the planning notes as owner resolutions of 2026-09-01, which are therefore load-bearing.
- **D-03:** This phase ships SQLite schema — the milestone's **largest migration cluster**. Never assume a migration number — verify head+1 against `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` on disk at plan time (numbers drift every schema phase). Whether it is one migration or several is the plan's call, but the sequence must be strictly ordered, forward-only, and must assume no particular starting state. Milestone order is schema → consumers → backup; the backup v4 bump is Phase 36's final plan. All new durable preferences are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage.

### Phase-specific constraints
- **D-04 (R-01 REPLAN):** The Contact Knowledge model is **almost entirely unbuilt** — no type registry, no Custom type, no notes/dates/pinning/visibility/outdated flags, hard DELETE instead of soft-delete, `source` is a string only, **no relationships table at all** (Phase 8/Orrery's assumed "existing structured relationship model" does not exist), no Last Talked About or Location history, no per-item AI permission, no note import, and search limited to name + eligible `fuel.text`. Plan against the code on disk, not the assumed model.
- **D-05 (ADR-028 ESCALATE trip-wire):** A **Custom type with a user label** is compatible only while the kind set stays application-owned. **User-created system types would reverse ADR-028 → stop and ask the owner.** Users get flexibility via the Custom type only.
- **D-06 (ADR-001 ESCALATE trip-wire):** Any plan relaxing `UNIQUE(contact_id, field_def_id)` or `custom_field_values.uid UNIQUE` reverses ADR-001 → stop and ask. History-retained custom fields get a **new additive value-history table** (R-08 resolution) — `field_history` is destructive-op-only, unread, pruned at 30 days and excluded from backup, so it cannot host a value timeline. Route every custom-field sort/filter through `sortExpr()`; `custom_field_values.value` stays raw TEXT and is never rewritten to satisfy a type; failing values are flagged, not coerced.
- **D-07 (ADR-031 ESCALATE trip-wire, R-10):** Typo tolerance is **TypeScript scoring over the already-filtered eligible set** — prefix/substring plus edit distance ≤ 1 per term (≤ 2 for terms of six or more characters). **No FTS5, no new search index**; FTS5 would reverse ADR-031 → stop and ask. This phase exposes the corpus and its searchability metadata; the Dashboard Data phase consumes it.
- **D-08 (E-05):** Build the sibling **per-item AI permission model** for knowledge items — it does not exist today (egress is decided by `kind`/`source` in SQL; `share_with_ai` exists only per custom-field definition). Per-item permission defaults **OFF**, behind two gates (AI globally enabled, then per-field/per-item). **Group Notes are never sent — no toggle, no exception.** The per-interaction "Allow AI" toggle (default OFF) is owned by the Interaction/Rapid-Capture and AI-Configuration phases, not here.
- **D-09 (E-05 trip-wire):** The Off Limits transmission outcome is recorded in the dossier and `docs/decisions/`, not the notes. Check for a superseding ADR before changing `fuel-read.ts`'s exclusions; absent one, the SQL-level exclusion stands (ADR-050, ADR-036). Off Limits stays a separate control from AI permission, and when sent to AI carries the semantic "avoid mentioning this topic".
- **D-10 (R-01 resolutions):** This phase **owns the Recently Deleted / Trash surface** (reassigned from a possible Phase 15 owner — no longer an orphan); share-sheet capture rows migrate onto the new model as default-type Memories; the **ADR-030 AI-proposed-fuel path is retired** by this migration and needs a superseding ADR written as part of the phase.
- **D-11 (R-01 trip-wires):** Nothing watches a timestamp — Trash expiry and history retention run as a **launch sweep**, never a background timer. And confirm **"Memory" as final terminology with the owner** before naming schema after it; the default/general built-in Memory type name is an open reconciliation item needed before the Rapid Capture phase plans.
- **D-12 (R-08 trip-wire):** A per-contact **scope** column is additive, but the seeding writers change — ADR-013 / HANDOFF §14 specify "one global definition row per field, seeded for every contact". Enumerate every writer of the custom-field tables before altering seeding. Going from 7 to 10 `FieldType` members is additive; ADR-014 requires one parser per type — never pairwise converters.

### Claude's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decision record (ground truth)
- `docs/dossier/milestone-2/phase-03-contact-knowledge-foundation-dossier.md` — the phase's full decision record; the 2026-09-01 amendment section (where present) overrides older text
- `docs/dossier/milestone-2/planning-notes/phase-03-planning-notes.md` — REPLAN findings, trip-wires, migration/sequencing constraints (binding appendix; this phase's audit resolutions live here, not in the dossier)

### Milestone context
- `docs/dossier/milestone-2/orbit-ui-ux-working-roadmap-v1.0.md` — cross-phase seams, exported constraints (§6–7)
- `docs/dossier/milestone-2/orbit-ui-ux-master-handoff-v1.0.md` — milestone-wide decisions and watch items

### Decisions (ADRs)
- `docs/decisions/ADR-028-per-item-conversational-fuel-with-fixed-kinds.md` — the kind set stays application-owned; a user-labelled Custom type is compatible, user-created system types are not (escalate).
- `docs/decisions/ADR-031-bound-local-fuel-search-without-fts5.md` — search stays bound and local with no FTS5; typo tolerance is TypeScript scoring over the eligible set.
- `docs/decisions/ADR-001-normalized-custom-field-values.md` — the normalized `custom_field_values` model and its uniqueness constraints; relaxing them is an owner escalation.

*(Optional local cross-check, gitignored and possibly absent: `docs/dossier/milestone-2/audit/LEDGER.md` — the audit's lossless decision ledger.)*
</canonical_refs>

<deferred>
## Deferred Ideas

See the dossier's [DEFERRED] and out-of-scope sections — they are boundaries, not gaps; do not plan them. Explicitly do-not-build here: **automatic derivation/extraction of Memories from interaction notes** and **AI classification of imported phone-contact notes** (both deferred — this phase consumes user-authored knowledge only). Also out: rich attachments (images, files, documents — links and notes only), arbitrary user-created Memory *system* types, tags, full immutable provenance/audit/version history, and full freeform ordering of every Memory.
</deferred>

---
*Phase: 24-contact-knowledge-foundation*
*Context gathered: 2026-09-02 (shim; source: milestone-2 dossier set)*
