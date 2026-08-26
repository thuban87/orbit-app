# Dossier 20 — Contact Reconciliation & Merge

**Status:** draft-complete from owner interrogation · 2026-08-26
**Purpose:** decision dossier for the future GSD Phase 20 planning/discuss flow.
**Scope:** user-triggered reconciliation of linked system contacts, durable review sessions, source-change memory, multi-source reconciliation, stale-link handling, and explicit Orbit-to-Orbit merge.
**Out of scope:** background polling, generic multi-device sync/conflict resolution, Interaction Assist, Android notification-listener experiment.

---

## Phase Boundary

### Phase 19 — System Contact Import

Phase 19 acquires and initially links/imports selected system contacts.

### Phase 20 — Contact Reconciliation & Merge

Phase 20 maintains those links over time and resolves duplicate Orbit identities when the user explicitly chooses to merge.

**[DECIDED] Phase 20 is reconciliation, not generic synchronization.**

It may retain narrowly scoped source-provenance / last-reviewed source state sufficient to detect whether the external source changed since the user last reviewed a discrepancy.

It must not implement:
- generic field-version clocks,
- device-to-device conflict resolution,
- version vectors,
- generic sync journals,
- remote/local authority tracking,
- generic multi-device merge policy.

The later sync milestone remains authoritative for Orbit-to-Orbit/device synchronization.

---

## Cluster A — Reconciled Field Scope

**[DECIDED] Phase 20 reconciles only the same field families supported by Phase 19 import:**

- name
- phone numbers
- email addresses
- birthday
- photo

Phase 20 does not expand source reconciliation into employer, title, addresses, notes, websites, social profiles, or arbitrary OS-contact metadata.

---

## Cluster B — Direction and Authority

**[DECIDED] Reconciliation remains strictly one-way:**
- System Contacts → Orbit

Orbit does not write changes back to Android/iOS Contacts.

**[DECIDED] System Contacts is a source, never Orbit's authority.**

Orbit owns its local copy.

No source-side disappearance or disagreement silently destroys or overwrites Orbit data.

---

## Cluster C — Change Classification

**[DECIDED] Detected source changes are classified into three primary categories:**

1. **Additive**
   - source contains a value Orbit does not currently have.

2. **Conflicting**
   - source and Orbit both have a value for the same logical field but disagree.

3. **Removed from source**
   - Orbit retains a value that was previously associated with the linked source but is no longer present there.

**[DECIDED] Default review behavior:**
- additive → recommend/use source, preselected but deselectable,
- conflicting → explicit manual choice,
- removed from source → recommend keeping Orbit value, never auto-delete.

---

## Cluster D — Remembering Prior Review Decisions

**[DECIDED] Orbit remembers the last-reviewed source state narrowly enough to suppress repeated prompts for the exact same unchanged discrepancy.**

Example:
- Orbit name: Allison Smith
- source name: Allison Jones
- user chooses Keep Orbit

If source remains Allison Jones:
- do not ask again.

If source later becomes Allison Brown:
- surface the discrepancy again.

**[DECIDED] This memory applies to conflicts and source removals.**

**[DECIDED] This is not a full audit trail or generic sync history.**

The purpose is only:
> Has the external source changed since the user last reviewed this discrepancy?

---

## Cluster E — Reconciliation Triggers

**[DECIDED] Phase 20 reconciliation is completely user-triggered.**

No background polling.
No passive monitoring.
No scheduled source refresh.

Primary entry points:

1. **Per-contact**
   - `Update from Contacts`

2. **Settings**
   - `Check linked contacts`

**[DECIDED] Lack of background checking is intentional for privacy, predictability, and scope control.**

---

## Cluster F — Refresh All

**[DECIDED] `Check linked contacts` scans all linked Orbit contacts and produces one summary/review workflow.**

Example summary:
- 84 linked contacts checked
- 12 changed
- 5 additions only
- 4 conflicts
- 3 source records missing

**[DECIDED] Unchanged contacts do not appear as review cards.**

Their count may appear in the summary only.

---

## Cluster G — Missing Source Contact

**[DECIDED] A missing/unresolvable linked system contact is a distinct state, not equivalent to all source fields being removed.**

A missing source contact never:
- deletes the Orbit contact,
- archives it,
- unbinds it,
- clears its fields.

Available actions include:
- Keep Orbit contact as-is
- Relink to another system contact
- Unlink source

---

## Cluster H — Reconciliation Grid

**[DECIDED] Phase 20 reuses the Phase 19 review-workspace foundation.**

The reconciliation workspace is a **card grid**, not a simple list.

Each card can show:
- contact identity,
- number/type of detected changes,
- recommendation state,
- unresolved count.

Interactions:
- tap card → detailed review,
- long press → multi-select,
- bulk actions where safe.

**[DECIDED] One reusable review-workspace architecture should serve import and reconciliation rather than creating parallel UI systems.**

---

## Cluster I — Reconciliation Recommendations

**[DECIDED] Orbit provides conservative reconciliation recommendations.**

Examples:
- additive value → recommend Add / Use Contact Value
- direct conflict → Manual Review
- disappeared source value → recommend Keep Orbit

**[DECIDED] Recommendations are advisory.**

No destructive source preference is silently applied.

---

## Cluster J — Bulk Reconciliation Actions

**[DECIDED] Supported bulk actions include:**
- Apply Recommendations
- Keep Orbit Values

**[DECIDED] `Use Contact Values` is only available for additive-only cards/selections.**

Reason:
A bulk source-wins action over arbitrary conflicting cards could silently overwrite names, birthdays, and other important Orbit choices.

**[DECIDED] Candidates requiring genuine manual review remain unresolved.**

---

## Cluster K — Partial Card Resolution

**[DECIDED] A reconciliation card remains in the review workspace until all actionable differences for that contact are resolved.**

Example:
- 3 differences detected
- 2 resolved
- 1 unresolved

Card remains visible as partially resolved.

---

## Cluster L — Relinking

**[DECIDED] Relinking preserves the Orbit contact completely.**

When a stale/missing external source is replaced:
1. retain all Orbit-owned data,
2. retire/remove the stale external link,
3. attach the newly selected source record,
4. immediately run reconciliation review against the new source.

No Orbit relationship data is reset by relinking.

---

## Cluster M — Multiple Active Source Links

**[DECIDED] One Orbit contact may have multiple active linked system-contact records.**

**[DECIDED] Refresh All reconciles all source records for one Orbit person into a single Orbit-contact reconciliation card.**

Do not create separate cards such as:
- Sarah — source A
- Sarah — source B

when both are linked to the same Orbit identity.

**[DECIDED] Detailed review may indicate which source record contributed each proposed value.**

---

## Cluster N — Conflicting Source Records

**[DECIDED] If multiple linked source contacts disagree with each other, Orbit never chooses source authority automatically.**

Example:
- source A: Sarah Jones
- source B: Sarah Smith
- Orbit: Sarah Jones

The detail view surfaces the disagreement and the user decides what Orbit keeps.

Orbit does not attempt to repair or write back to the external contact stores.

---

## Cluster O — Source Snapshot Scope

**[DECIDED] Last-reviewed source snapshots are limited to the five reconciled field families:**

- name
- phones
- emails
- birthday
- photo identity/fingerprint

Orbit does not persist complete OS-contact records solely for reconciliation memory.

---

## Cluster P — Phone / Email Snapshot Semantics

**[DECIDED] Phone and email comparison uses canonical normalized identity, not display formatting or ordering.**

Examples:
- `(312) 555-1234`
- `312-555-1234`

are not a source change if they represent the same canonical number.

**[DECIDED] Label changes are meaningful source changes.**

Example:
- Mobile → Personal

should be eligible for reconciliation review.

---

## Cluster Q — Photo Reconciliation

**[DECIDED] Photo reconciliation uses a stable source-image fingerprint/hash when reliable comparison data is available.**

If the source fingerprint changes:
- surface the new source photo for review.

**[DECIDED] No visual-similarity AI/computer-vision matching is required.**

**[DECIDED] If reliable automatic fingerprint comparison is unavailable, Orbit presents the current Orbit photo and source photo side-by-side for explicit user choice.**

The user determines whether:
- there is effectively no meaningful change,
- keep Orbit photo,
- use source photo.

---

## Cluster R — Durable Reconciliation Sessions

**[DECIDED] Reconciliation sessions are durable and resumable.**

If Refresh All finds many changed contacts and the user only resolves some before leaving, unresolved review state survives:
- app termination,
- process death,
- reboot,
- long periods away.

**[DECIDED] Already-applied resolutions remain applied.**

Only unresolved reconciliation work resumes.

---

## Cluster S — Reconciliation Completion Summary

**[DECIDED] Refresh All ends on an explicit completion/report screen.**

Example:
- 84 checked
- 12 changed
- 9 updated
- 2 kept Orbit values
- 1 source missing

Possible actions:
- View unresolved
- Done

Exact visual design is a planning/UI detail.

---

# Orbit-to-Orbit Merge

## Cluster T — Merge Ownership

**[DECIDED] Phase 20 includes generic explicit merge of existing Orbit contacts.**

Reason:
Phase 19 duplicate detection and Phase 20 reconciliation can expose existing duplicates. Deferring merge indefinitely would identify a real data problem without providing a resolution path.

**[DECIDED] Merge is a local explicit data-consolidation operation, not a generic sync feature.**

Future sync must understand the resulting retired identity, but Phase 20 does not implement multi-device sync.

---

## Cluster U — Merge Entry Points

**[DECIDED] Merge is accessible from:**

1. duplicate/reconciliation candidate detail,
2. contact profile overflow/menu via an action such as:
   - `Merge with another contact`

Users may therefore resolve duplicates discovered outside import/reconciliation flows.

---

## Cluster V — Survivor Identity

**[DECIDED] The user chooses the surviving Orbit contact identity.**

**[DECIDED] Orbit provides a recommended survivor.**

Recommendation may use continuity signals such as:
- older creation date,
- richer interaction history,
- stronger existing external linkage,
- more complete relationship data.

Recommendation is advisory.

**[DECIDED] Merge must result in exactly one surviving Orbit identity.**

Absorbed identities are retired/tombstoned.

---

## Cluster W — Field Conflicts

**[DECIDED] Non-conflicting fixed-field data combines automatically.**

**[DECIDED] Conflicting fixed fields are presented for explicit per-field selection.**

Examples:
- name
- birthday
- category
- photo
- other scalar fixed metadata

The user chooses which value survives.

---

## Cluster X — Contact Methods During Merge

**[DECIDED] Identical canonical phone/email methods dedupe automatically.**

**[DECIDED] Distinct phone/email methods from both contacts are preserved.**

**[DECIDED] Primary phone/email selection requires explicit review only when both contacts contribute competing primary methods.**

Otherwise existing deterministic promotion/order rules apply.

---

## Cluster Y — Child Data Consolidation

**[DECIDED] Additive child data moves to the survivor automatically without per-row review.**

Includes:
- interactions
- fuel
- events
- external links
- other additive owned child rows

Merge should not make the user inspect individual interaction/event rows.

---

## Cluster Z — Custom Fields

**[DECIDED] Scalar custom-field conflicts use the same per-field A-vs-B review model as fixed fields.**

Non-conflicting custom values combine automatically where valid.

More complex future multi-value custom-field types may define their own merge behavior later.

---

## Cluster AA — Derived Values

**[DECIDED] Derived/materialized relationship values are not selected from either source contact.**

After merge, recompute from the newly combined underlying data.

Examples:
- `last_contact`
- gravity
- intensity
- status
- other derived aggregates

Existing single-writer / recomputation invariants remain authoritative.

---

## Cluster AB — Absorbed Contact Lifecycle

**[DECIDED] The absorbed Orbit contact is retired/tombstoned as merged into the survivor.**

It does **not** move to Archived.

It is not independently restorable as a normal contact through the standard archive lifecycle.

Reason:
Restoring the absorbed identity would recreate the duplicate that merge intentionally resolved.

**[DECIDED] Merge retirement must be represented in a way compatible with future synchronization so another device cannot later resurrect the absorbed identity.**

Exact future sync semantics remain out of scope.

---

## Cluster AC — Merge Safety

**[DECIDED] Merge has no simple undo.**

It is treated as a serious consolidation operation.

**[DECIDED] Merge requires explicit confirmation with an impact summary.**

Example:
- Merge Allison B into Allison A
- 23 interactions
- 6 fuel items
- 4 events
- 3 contact methods
- 2 external links
- Allison B will be retired
- This cannot be simply undone

**[DECIDED] Merge must be atomic/transactional.**

Either:
- the full consolidation succeeds,

or:
- nothing changes.

No partially merged contact state is acceptable.

---

## Cross-Domain Invariants

1. **Phase 20 reconciles external source changes; it does not implement generic sync.**
2. **All reconciliation is user-triggered.**
3. **System Contacts remains one-way input only.**
4. **Unchanged discrepancies already reviewed do not repeatedly nag the user.**
5. **Source changes after review become actionable again.**
6. **Additions may be recommended; destructive replacement/removal requires explicit choice.**
7. **Missing source contacts never destroy Orbit contacts.**
8. **Multiple source links reconcile into one Orbit-person review card.**
9. **Conflicting source records never gain automatic authority.**
10. **Reconciliation uses the shared card-grid workspace.**
11. **Durable sessions preserve unresolved work across process death/reboot.**
12. **Generic Orbit merge is explicit and user initiated.**
13. **Merge survivor is user-selected, with recommendation only.**
14. **Additive child data consolidates automatically; scalar conflicts are reviewed.**
15. **Derived values are recomputed, never manually merged.**
16. **Absorbed Orbit identities are retired/tombstoned, not archived.**
17. **Merge is atomic and has no simple undo.**

---

## Explicitly Deferred

- Background contact-store polling.
- Passive contact change monitoring.
- Automatic periodic refresh.
- Generic multi-device sync/conflict machinery.
- Full per-field audit/version history.
- Writing Orbit changes back to system Contacts.
- Visual-similarity photo matching.
- Generic automatic source-authority selection.
- Interaction Assist.
- Android notification-listener experiment.

---

## Remaining Phase 20 Planning Details

These are implementation/planning questions rather than unresolved product direction:

- exact last-reviewed source snapshot schema,
- exact source-photo fingerprint representation,
- exact reconciliation-session schema,
- exact relink stale-link lifecycle representation,
- exact merge transaction ordering,
- exact absorbed-contact tombstone/redirect representation,
- exact custom-field conflict renderer reuse,
- exact survivor recommendation heuristic,
- exact impact-summary counts,
- exact duplicate/reconciliation grid component reuse strategy,
- exact retry/error behavior,
- test matrix for:
  - unchanged reviewed discrepancy,
  - changed-again source state,
  - additive/conflict/removal combinations,
  - missing/relinked source,
  - multiple active source links,
  - conflicting source records,
  - photo hash/no-hash cases,
  - partially resolved durable session,
  - merge fixed-field conflicts,
  - merge contact-method dedupe,
  - merge child-row consolidation,
  - merge failure rollback,
  - absorbed-contact retirement.
