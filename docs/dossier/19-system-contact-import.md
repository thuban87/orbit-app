# Dossier 19 — System Contact Import

**Status:** draft-complete from owner interrogation · 2026-08-25
**Purpose:** decision dossier for the future GSD Phase 19 planning/discuss flow.
**Scope:** native system-contact selection, single and bulk import, initial duplicate detection/resolution, safe linking to existing Orbit contacts, durable import sessions, and import completion/reporting.
**Out of scope:** ongoing source reconciliation/refresh, remembered conflict state, refresh-all, generic Orbit-to-Orbit merge, Interaction Assist, Android notification-listener experiment.

---

## Product Boundary

**[DECIDED] Phase 19 is an intentional import feature, not a general address-book ingestion system.**

Orbit is designed around intentional personal relationship management and inner-circle maintenance. System Contacts is a convenient source for people the user deliberately chooses to bring into Orbit.

The import UX should not encourage wholesale address-book dumping as the default product behavior, even though large selections are technically supported.

**[DECIDED] Phase 19 and Phase 20 are intended to ship as a tightly coupled two-phase sprint.**

Phase 19 builds safe acquisition/import/linking.
Phase 20 immediately follows with ongoing reconciliation/refresh behavior.

The user does not intend to rely on the feature on their daily-use device until both phases are complete, though Phase 19 will be tested independently on a test device.

---

## Phase Boundary

### Phase 19 — System Contact Import

Owns:
- native contact picker entry points,
- single and multi-contact selection,
- field extraction,
- Orbit import review,
- bulk defaults,
- duplicate evidence/scoring,
- initial link-vs-create decisions,
- conservative multi-source consolidation,
- durable resumable import sessions,
- partial-failure handling,
- import completion reporting.

### Phase 20 — Contact Reconciliation

Owns:
- ongoing `Update from Contacts`,
- full field-level refresh/diff behavior,
- remembered previously-reviewed source discrepancies,
- stale/missing source handling over time,
- refresh-all,
- reconciliation batch review,
- richer multiple-link maintenance,
- generic existing Orbit-contact merge if included.

**[DECIDED] Phase 19 must not grow into a generic synchronization/reconciliation engine.**

It should implement only the minimum initial-link review necessary to import safely.

---

## Cluster A — Entry Points

**[DECIDED] Contact import is available from two places:**

1. **Dashboard FAB / Add flow**
   - Create manually
   - Import from Contacts

2. **Contacts Integration area in Settings**
   - Import contacts
   - later Phase 20 maintenance actions may live here

The dashboard already uses a multi-option FAB, so import should fit into that existing interaction model.

---

## Cluster B — Platform Support

**[DECIDED] iOS uses the native privacy-preserving contact picker.**

**[DECIDED] Android system-contact import targets the modern Android 17+ privacy-preserving Contact Picker path.**

**[DECIDED] Older Android versions may simply not expose system-contact import.**

Orbit should not adopt broad legacy contacts permissions or older implementation patterns solely to preserve feature parity unless a fallback proves unusually simple, clean, and aligned with the existing architecture.

**[DECIDED] Lack of contact import support on older Android versions does not impair the rest of Orbit.**

Suggested unsupported-state messaging:
> Contact import requires Android 17 or later.

Exact platform/API implementation details remain a planning task.

---

## Cluster C — Imported Fields

**[DECIDED] Phase 19 imports only the basic relationship/contact fields needed now:**

- name
- phone numbers
- email addresses
- birthday
- photo

**[DECIDED] The following are not imported in Phase 19 merely because the OS contact store exposes them:**

- postal addresses
- employer/company
- job title
- notes
- websites
- social profiles
- arbitrary system-contact metadata

These can be revisited later if they map cleanly to Orbit product concepts.

---

## Cluster D — Single-Contact Import

**[DECIDED] Picking one system contact never immediately writes an Orbit contact.**

Flow:
1. pick contact,
2. enter Orbit import-review screen,
3. review incoming fields,
4. configure Orbit-specific values,
5. create/link only after confirmation.

**[DECIDED] Single-import review may configure:**
- Bound / Unbound
- cadence if Bound
- category
- selected phone/email methods
- primary phone/email
- birthday
- photo

Exact screen layout is UI planning.

---

## Cluster E — Bulk Import

**[DECIDED] Bulk import is intentionally lighter than single-contact import.**

The system picker is where per-person selection happens.

After selection, Orbit applies one shared set of batch defaults rather than rendering a giant per-person configuration list.

**[DECIDED] No per-person checkbox/exclusion list is shown under bulk defaults.**

Rationale: this becomes unusable for large imports and duplicates the selection work already completed in the system picker.

**[DECIDED] Bulk import defaults to `Unbound`.**

**[DECIDED] Bulk import defaults to the `Uncategorized` category.**

**[DECIDED] Phase 19 adds/uses an `Uncategorized` category.**

**[DECIDED] The user may override the category for the entire batch before import.**

**[DECIDED] Per-contact customization happens after import through normal Orbit contact/profile flows.**

---

## Cluster F — Photos

**[DECIDED] Photos are included in import by default.**

Imported contact photos should ultimately become Orbit-owned local photo assets using the existing Orbit photo pipeline rather than permanent references to external provider URIs.

**[DECIDED] Photo-processing failure should not invalidate an otherwise valid contact import.**

For large batches, photo work may be queued/chunked after core contact rows are safely established.

---

## Cluster G — Duplicate Evidence Model

**[DECIDED] Duplicate detection uses a weighted evidence model beneath a simpler user-facing confidence ladder.**

Candidate signal categories include:
- external system-contact linkage
- canonical phone match
- normalized email match
- name similarity
- birthday

**[DECIDED] Exact existing external linkage bypasses confidence scoring.**

An already-linked external contact is deterministic identity, not an inferred duplicate.

**[DECIDED] Other evidence is weighted by reliability.**

**[OPEN — implementation tuning]** Exact numeric weights and thresholds.

**[DECIDED] Correlated evidence must not be blindly double-counted.**

**[DECIDED] Birthday is supporting evidence only and never sufficient by itself to establish identity.**

**[DECIDED] Name-only similarity never authorizes an automatic merge/link.**

**[DECIDED] Photo similarity is not part of Phase 19 duplicate matching.**

---

## Cluster H — User-Facing Match Outcomes

**[DECIDED] The evidence engine maps to simple user-facing outcomes rather than exposing raw scores.**

Conceptual outcomes:
- deterministic / already linked
- probable match
- possible match
- no meaningful match
- manual review required

**[DECIDED] Orbit may provide a recommended resolution.**

Examples:
- Recommend Link to Existing
- Recommend Import as New
- Manual Review Required

**[DECIDED] Recommendations are advisory, not automatic identity decisions.**

---

## Cluster I — Single Duplicate Resolution

**[DECIDED] If a single imported contact has one strong existing Orbit candidate, interrupt creation and present the match.**

Actions:
- Link to Existing
- Import as New

**[DECIDED] Exact already-linked source contacts are not offered as new Orbit contacts through the normal path.**

**[DECIDED] If one imported source contact matches multiple credible Orbit contacts, Orbit does not guess.**

The user may:
- choose one existing Orbit contact,
- import as new,
- skip.

---

## Cluster J — Generic Orbit-to-Orbit Merge

**[DEFERRED TO PHASE 20 / LATER] Generic merging of multiple existing Orbit contacts.**

Merging existing Orbit contacts is materially more complex because each may already own interactions, fuel, events, custom fields, contact methods, photos, favourites, categories, external links, and lifecycle state.

**[DECIDED] Phase 19 may detect that multiple existing Orbit contacts appear related, but it should not perform generic Orbit-to-Orbit merge.**

---

## Cluster K — Multiple Selected System Contacts Representing One Person

**[DECIDED] Phase 19 may detect that multiple selected system-contact records likely represent the same real person.**

**[DECIDED] When evidence is strong, Orbit may offer to import multiple selected source records as one new Orbit contact with multiple external links.**

**[DECIDED] Such consolidation is never silent.**

The user must explicitly choose:
- combine into one Orbit contact,
- keep separate.

**[DECIDED] Keep this first implementation conservative.**

---

## Cluster L — Bulk Duplicate Review Workspace

**[DECIDED] Bulk duplicate review uses a card grid, not a linear list.**

The grid should support:
- visual candidate cards,
- tap to inspect a candidate in detail,
- long-press to enter multi-select mode,
- bulk resolution actions.

**[DECIDED] Safe imports proceed without being blocked by ambiguous candidates.**

**[DECIDED] Bulk review supports explicit actions such as:**
- Link to Existing
- Import as New
- Skip

**[DECIDED] Orbit may let the user apply recommendations in bulk to selected candidate cards.**

**[DECIDED] Candidates requiring genuine manual judgment are not silently included in bulk recommendation acceptance.**

---

## Cluster M — Initial Linking in Phase 19

**[DECIDED] Phase 19 linking to an existing Orbit contact is deliberately minimal.**

It may:
- establish the external link,
- present the minimum initial conflict/addition review needed to avoid destructive behavior,
- allow clearly safe, user-confirmed additions.

It must not build:
- remembered per-field conflict state,
- ongoing source-change history,
- refresh-all,
- mature reconciliation workflows.

Those belong to Phase 20.

**[DECIDED] Names are never silently overwritten during initial linking.**

**[DECIDED] Non-conflicting additive data may be preselected for import, but the user may deselect it.**

---

## Cluster N — Already-Linked Contacts During Bulk Import

**[DECIDED] Already-linked source contacts encountered during bulk import are skipped rather than refreshed.**

They are reported in the completion summary.

---

## Cluster O — Partial / Sparse Source Records

**[DECIDED] A system contact with only partial data may still be imported.**

**[DECIDED] If the source record does not provide a usable name, Orbit requires the user to supply one before creation.**

---

## Cluster P — Partial Batch Failure

**[DECIDED] Bulk import is not all-or-nothing.**

If a large batch contains individual failures:
- import the safe contacts,
- report failures afterward,
- do not roll back the entire batch solely because one record or photo failed.

**[DECIDED] A fundamental database/integrity failure may abort affected work if Orbit cannot guarantee consistency.**

---

## Cluster Q — Cancellation and Back Navigation

**[DECIDED] Canceling the native picker before Orbit owns the selection writes nothing.**

**[DECIDED] Backing out of an untouched Orbit review flow writes nothing.**

**[DECIDED] Once the user has made meaningful review/import choices or a batch has partially progressed, navigating away requires confirmation.**

If some contacts are already safely committed, they remain committed.

---

## Cluster R — Durable Import Sessions

**[DECIDED] Import/review sessions are durable and resumable once Orbit has accepted the picker result into its own workflow.**

Unresolved review state must survive:
- app termination
- process death
- reboot
- long periods away from Orbit

On return, Orbit should offer:
- Resume Import
- Discard Import

**[DECIDED] Successfully committed contacts remain committed independently of unresolved session state.**

Discarding a resumable session discards only unresolved/pending import state.

---

## Cluster S — Large Imports and Practical Limits

**[DECIDED] Orbit imposes no arbitrary application-level maximum contact count for normal storage.**

**[DECIDED] Large contact selections are supported without a hard import cap unless a platform API imposes one.**

**[DECIDED] Large imports should be processed incrementally/chunked to avoid UI freezes and oversized transactions.**

The user experiences one logical import with overall progress even if Orbit internally processes smaller chunks.

**[DECIDED] Product positioning—not an arbitrary technical cap—should discourage indiscriminate address-book dumping.**

Suggested engineering scale target for later testing:
- normal intended use: tens to hundreds,
- comfortably support: several thousand,
- stress-test around 10,000 contacts plus realistic child data.

This is a testing target, not a product promise/limit.

---

## Cluster T — Import Completion Summary

**[DECIDED] Bulk import ends on an explicit summary/report screen.**

Example categories:
- imported
- already linked / already in Orbit
- need review
- failed/skipped

Possible actions:
- Review possible matches
- View Unbound contacts
- Done

**[DECIDED] The summary should provide a direct bridge to the dedicated Unbound-contact screen.**

---

## Cross-Domain Invariants

1. **System-contact import is optional and user initiated.**
2. **System Contacts is a source, never Orbit’s authority.**
3. **Phase 19 imports safely; Phase 20 maintains/reconciles over time.**
4. **No destructive overwrite is inferred from source data.**
5. **Exact external linkage is deterministic; all other duplicate detection is evidence-based.**
6. **Duplicate recommendations are advisory.**
7. **Ambiguous candidates never block safe imports in the same batch.**
8. **Bulk review is a card grid with multi-select support.**
9. **Bulk import defaults to Unbound + Uncategorized.**
10. **Single import gets detailed review; bulk import gets shared defaults.**
11. **Photos are included but may fail independently.**
12. **Large imports are resumable and incrementally processed.**
13. **Already-committed contacts remain committed if unresolved review remains.**
14. **Generic Orbit-to-Orbit merge is not a Phase 19 responsibility.**
15. **Android import prioritizes the modern Android 17+ privacy model over legacy compatibility.**

---

## Explicitly Deferred to Phase 20

- Ongoing `Update from Contacts`.
- Full field-by-field reconciliation workflow.
- Remembering previously reviewed discrepancies.
- “Source changed since last review” detection.
- Refresh all linked contacts.
- Batch reconciliation after refresh.
- Mature stale/missing source-contact workflows.
- Relinking after source recreation.
- Rich management of multiple external links.
- Generic merge of two or more existing Orbit contacts.
- Any generic sync/conflict engine.

**Important boundary:** Phase 20 may store narrowly-scoped source provenance/last-seen source state, but must not build generic multi-device sync machinery.

---

## Explicitly Deferred Beyond Phases 19–20

- Interaction Assist.
- Provider-specific interaction tracking.
- Android notification-listener experiment.
- Automatic address-book-wide monitoring.
- Photo-similarity duplicate matching.
- Professional CRM/networking features.
- Import of arbitrary contact-store metadata.

---

## Remaining Phase 19 Planning Details

These are implementation/planning questions rather than unresolved product direction:

- exact native picker wrappers and API integration,
- exact Android unsupported-state detection,
- exact import-session schema,
- chunk size / concurrency strategy,
- photo-processing concurrency,
- exact duplicate-scoring weights/thresholds,
- exact candidate-card visual design,
- exact progress-screen stages,
- exact transaction boundaries,
- exact retry semantics for failed records,
- exact category/default controls shown in bulk setup,
- exact minimal initial-link diff surface,
- test matrix for single/bulk, match confidence, partial data, process death, large batches, multiple source records, and partial commits.
