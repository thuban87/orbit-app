# Phase 20: Contact Reconciliation & Merge - Research

**Researched:** 2026-08-30
**Domain:** Local-first SQLite data-layer — durable reconciliation sessions, one-way source→Orbit field reconciliation, atomic Orbit-to-Orbit contact merge, tombstone/retire lifecycle
**Confidence:** HIGH (all findings read from source on disk this session; no new external packages)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (from `20-CONTEXT.md` "Locked Invariants" — copied verbatim)

- Read the canonical dossier in full. Its `[DECIDED]`, `[REJECTED]`, `[SUPERSEDES]`, phase-boundary, invariant, and explicit-deferral statements are locked product decisions, not prompts to reopen.
- Reconciliation is only user-triggered and System Contacts remains source-only. Additions may be recommended, but conflicting, removed, or missing source data never silently overwrites or destroys Orbit data.
- Reuse the Phase 19 card-grid review-workspace foundation. Narrowly remember unchanged reviewed discrepancies, keep unresolved work durable/resumable, and reconcile multiple source links into one Orbit-person review card without source authority guessing.
- Merge is explicit, serious, atomic, and has no simple undo: the user chooses the survivor, scalar conflicts are reviewed, compatible child data/methods consolidate, and derived values are recomputed through their existing authoritative paths.
- An absorbed identity is retired/tombstoned—not archived—and must not be resurrected. Preserve all deferrals, notably background monitoring, generic sync/versioning, source write-back, visual-similarity matching, and Interaction Assist.

> Exact snapshot/session representations, source-photo fingerprinting, survivor recommendation, merge ordering, tombstone/redirect shape, and UI mechanics remain research/planning choices within these decisions. (These are the questions this document answers.)

### Claude's Discretion (delegated by dossier §"Remaining Phase 20 Planning Details")

Snapshot schema, photo-fingerprint representation, reconciliation-session schema, relink lifecycle representation, merge transaction ordering, absorbed-contact tombstone/redirect representation, custom-field conflict renderer reuse, survivor recommendation heuristic, impact-summary counts, grid-component reuse strategy, retry/error behavior, and the test matrix.

### Deferred Ideas (OUT OF SCOPE — dossier §"Explicitly Deferred")

Background contact-store polling · passive change monitoring · automatic periodic refresh · generic multi-device sync/conflict machinery (version vectors, field clocks, sync journals, remote/local authority) · full per-field audit/version history · Orbit→system write-back · visual-similarity photo matching · generic automatic source-authority selection · Interaction Assist · Android notification-listener experiment.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **RCN-01** | User-triggered per-contact + refresh-all reconciliation compares only name, phones, emails, birthday, photo from System Contacts into Orbit; additions may be recommended, conflicts/removals/missing sources never silently overwrite/delete Orbit data. | Source snapshot re-derives from `PickedContact` (`modules/orbit-contact-picker/index.ts:14`); reads current source via `readContactsByLookupKeys`. Diff classification (additive/conflict/removed) per field family. Never-destroy is enforced structurally by applying only user-selected values through existing writers (`updateContactMetadataCore`, `applyContactMethodDiffCore`). |
| **RCN-02** | Reconciliation reuses a durable card-grid review workspace, combines multiple source links into one Orbit-person card, narrowly remembers unchanged reviewed discrepancies, reports resolved/unresolved without background monitoring or write-back. | `CandidateCardGrid` reused unchanged (`onInspect`/`apply-recommendation`/`recommendationExcludes`). Durable session pattern mirrors `import_sessions`/`import_session_rows` (migration 012) + launch-time resume sweep (`contact-import-resume-sweep.ts`). "Narrow memory" = a last-reviewed-source snapshot keyed by external link + field family (new table — see Architecture). |
| **RCN-03** | Explicit merge: choose survivor, review scalar conflicts, auto-consolidate compatible methods + child data, recompute derived values, confirm atomic no-simple-undo. | Merge txn modeled on `purge-dao.purgeContact`'s single-transaction fan-out but **reparents** children (`UPDATE contact_id`) instead of deleting. Derived `last_contact` via `recomputeLastContactCore`; gravity/intensity/status are query-time (auto). Method dedupe via canonical equality + partial unique indexes. |
| **RCN-04** *(infra)* | Absorbed contact retired/tombstoned rather than archived, future-sync-compatible, without generic sync/conflict machinery. | Generic `tombstones` table (migration 007) with `entity_type='contact'` is already resurrection-proof through `backup/reconciliation.ts` (`compareRowAndTombstone`). Survivor-redirect representation is the one genuinely open schema decision (see Architecture §Tombstone/Retire). |
</phase_requirements>

## Summary

Phase 20 is a **data-layer-heavy** phase whose UI contract is already locked (`20-UI-SPEC.md`, approved 2026-08-30, gsd-ui-checker VERIFIED). The research value is therefore concentrated in the SQLite schema and transaction design, not the stack: **no new npm packages are required or wanted**, and the entire feature composes from primitives shipped across Phases 17–19.

Two capabilities live here. **(1) One-way reconciliation** re-reads the current System-Contacts state for a linked Orbit contact, diffs the five reconciled field families (name, phones, emails, birthday, photo) against Orbit, classifies each difference (additive / conflicting / removed-from-source / missing-source), recommends conservatively, and applies **only the user's selection** through the existing authoritative writers. It runs in a durable, resumable session that mirrors the shipped `import_sessions` model and reuses the `CandidateCardGrid` review workspace unchanged. **(2) Explicit Orbit-to-Orbit merge** consolidates two contacts into one survivor in a single atomic transaction that reparents child rows, dedupes methods by canonical equality, recomputes derived values through the single-writer recency path, and retires the absorbed identity as a generic tombstone that future sync cannot resurrect.

Three findings materially shape planning. First, **the current migration head is 012 (`TARGET_VERSION = 12`); Phase 20's migration is `013`** — verified on disk, not assumed. Second, **there is no stable source-photo fingerprint available today**: `PickedContact` exposes only an evictable `photoTempUri` cache path and the app computes no photo hash anywhere, so the dossier's Cluster-Q side-by-side manual fallback is the *practical primary* path, not the exception. Third, **the merge transaction has two hard SQLite integrity constraints** — the partial unique index on `(contact_id, method_type) WHERE is_primary=1` and on `external_contact_links(provider, external_contact_id) WHERE is_active=1` — that will `ABORT` a naive reparent unless primaries and duplicate source links are resolved *before* the `UPDATE contact_id`.

**Primary recommendation:** Add migration `013` introducing (a) a durable reconciliation-session store and (b) a narrow last-reviewed-source snapshot table keyed by `external_contact_link_id` + field family; build a single `mergeContacts(exec, {survivorId, absorbedId, resolutions, now})` writer modeled on `purge-dao`'s atomic fan-out (reparent, not delete) that resolves primaries/duplicate-source-links first, tombstones the absorbed `contact`, then calls `recomputeLastContactCore`; reuse `CandidateCardGrid`, `ResumeImportPrompt`, `ImportComplete` footer idiom, `ContactMethodsEditor`, and the six net-new components the UI-SPEC already names. Do not hand-roll a second grid, a second session store, a second recency writer, or a second tombstone mechanism.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read current source contact state | Native module (`orbit-contact-picker`) | — | Only the Kotlin picker/provider bridge can read Android Contacts; no network, on-device only. |
| Diff + classify field changes | Pure logic (`src/logic/`) | — | Node-testable, deterministic; no I/O. Mirrors `duplicate-evidence.ts` / `picked-contact-map.ts`. |
| Durable session + snapshot persistence | DB DAO (`src/db/`) | Migration 013 | SQLite is the only durable store; forward-only migration. |
| Apply reconciliation selections | DB DAO (existing writers) | — | Must route through `updateContactMetadataCore` / `applyContactMethodDiffCore` / recency writer — never a new write path. |
| Atomic merge | DB DAO (new `merge-dao`) | Migration 013 (redirect shape) | One `inWriteTransaction`; models `purge-dao`. |
| Recompute derived values | DB DAO (`recency-dao`) + query-time reads | — | `last_contact` is the only materialized derived value; gravity/intensity/status compute at read. |
| Review workspace / detail / merge UI | Screens + components (`src/screens`, `src/components`) | — | Reuse `CandidateCardGrid` + 6 net-new components per UI-SPEC. |
| Launch-time session resume | Service (`launch-sweep` hook) | — | "Nothing watches a timestamp" — resume offered on foreground launch, never a timer. |

## Standard Stack

**No new dependencies.** Every capability composes from shipped infrastructure. This is a locked expectation, not a preference: `20-UI-SPEC.md` §"Registry Safety" and the dossier both mandate reuse over new systems.

### Core (all already installed and proven)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-sqlite` | (shipped) | On-device DB; migrations via `PRAGMA user_version` | The app's sole datastore; 12 migrations shipped. `[VERIFIED: src/db/database.ts]` |
| `expo-image` | (shipped) | Photo render from resolved `file://` URIs (photo-choice surface) | UI-SPEC mandates it with `Avatar` fallback. `[VERIFIED: CandidateCardGrid.tsx:1]` |
| React Native / Expo | (shipped) | Portrait-locked Android UI | 19 phases shipped on it. |
| Zustand | (shipped) | Any transient screen state | Existing store pattern (`src/stores/`). |

### Supporting (existing modules this phase consumes directly)
| Module | Purpose | Reuse note |
|--------|---------|------------|
| `modules/orbit-contact-picker` | `readContactsByLookupKeys(keys)` re-reads live source state for reconciliation | `PickedContact` is the source snapshot shape. `[VERIFIED: modules/orbit-contact-picker/index.ts:14-25,69-74]` |
| `src/db/recency-dao.ts` | `recomputeLastContactCore` — THE single writer of `contacts.last_contact` | Merge must call this after reparenting interactions; never write `last_contact` directly. `[VERIFIED: recency-dao.ts:2,427]` |
| `src/db/tombstones-dao.ts` | `insertTombstoneCore` — durable deletion/retirement evidence | Absorbed contact retired as `entity_type='contact'`. `[VERIFIED: tombstones-dao.ts:8-18,53]` |
| `src/db/purge-dao.ts` | Atomic contact fan-out reference pattern (`purgeContact`) | Copy the *structure* (one txn, tombstone-then-mutate, assert-one-row), invert delete→reparent. `[VERIFIED: purge-dao.ts:204-268]` |
| `src/db/contact-methods-dao.ts` | `applyContactMethodDiffCore`, canonical dedupe | Method consolidation during merge. `[VERIFIED: contact-methods-dao.ts:47-54,99]` |
| `src/db/import-session-dao.ts` + `import-session-read.ts` | Durable/resumable session model + row-status state machine | Reconciliation-session store mirrors this. `[VERIFIED: import-session-dao.ts, import-session-read.ts:109-127]` |
| `src/services/import/contact-import-resume-sweep.ts` | Launch-time resume-prompt backstop | Reconciliation resume sweep mirrors this registration. `[VERIFIED: contact-import-resume-sweep.ts:113-122]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing `import_sessions` shape for reconciliation | A brand-new session table | Import sessions carry import-only columns (`mode`, `batch_category_id`, `match_outcome`). A separate `reconciliation_sessions` table is cleaner than overloading; but the *pattern* (durable rows + row-status + launch resume sweep) must be copied, not reinvented. **Recommend a dedicated table**, same shape idioms. |
| Reparent-on-merge | Copy-then-delete | Copy-then-delete loses stable child `uid`s (breaks future-sync tombstone identity) and doubles the write. Reparent (`UPDATE contact_id`) preserves `uid`s. **Recommend reparent.** |
| Generic `contact` tombstone for retirement | New `merges`/`contact_redirects` table with `survivor_uid` | Generic tombstone is already resurrection-proof (see §Tombstone). A survivor-redirect pointer is additive future-proofing for sync reference-rewriting — the one open decision. |

**Installation:** none — `npm install` adds nothing this phase.

## Package Legitimacy Audit

> No external packages are introduced by Phase 20. All code composes from already-installed, already-audited dependencies (SQLite, expo-image, React Native) and in-repo modules.

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| *(none — zero new packages)* | — | N/A | No install step; nothing to audit. |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
RECONCILIATION (one-way, user-triggered, System Contacts → Orbit)
─────────────────────────────────────────────────────────────────
 [Profile ⋯ "Update from Contacts"]      [Settings "Check linked contacts"]
              │                                        │
              ▼ (one contact)                          ▼ (all linked contacts)
     read active external_contact_links (is_active=1) for target(s)
              │
              ▼
   orbit-contact-picker.readContactsByLookupKeys(externalContactId[])   ← live source re-read
              │
              ▼
   diff-classify (pure logic) per field family {name,phones,emails,birthday,photo}
   compare source-canonical vs Orbit vs LAST-REVIEWED SNAPSHOT
              │
     ┌────────┼───────────────┬──────────────────┬───────────────────┐
     ▼        ▼               ▼                  ▼                   ▼
  additive  conflict     removed-from-src   missing-source      unchanged-since-review
  (recommend (manual     (keep Orbit,       (distinct state:    (SUPPRESS — Cluster D;
   source)    choice)     never delete)      relink/unlink)       not a review card)
     │        │               │                  │
     ▼        ▼               ▼                  ▼
   persist unresolved rows → reconciliation session (DURABLE, migration 013)
              │
              ▼
   CandidateCardGrid (REUSED) → onInspect → ReconcileDetailScreen (FieldChoiceGroup/PhotoChoice)
              │  user resolves
              ▼
   APPLY selection via EXISTING writers (updateContactMetadataCore / applyContactMethodDiffCore
     / birthday UPDATE) + WRITE last-reviewed snapshot  ── all in one inWriteTransaction
              │
              ▼
   completion summary (ImportComplete footer idiom) · resume via launch sweep

MERGE (explicit, atomic, no simple undo, Orbit ↔ Orbit)
─────────────────────────────────────────────────────────────────
 [Reconcile/duplicate detail]  or  [Profile ⋯ "Merge with another contact"]
              │
              ▼
   SurvivorSelect (recommend by continuity signals — advisory)
              │
              ▼
   detect scalar conflicts (name,birthday,category,photo,scalar custom) → FieldChoiceGroup
   + primary-method contention (only when both contribute competing primary)
              │
              ▼
   MergeImpactSummary (counts) → accent "Merge contacts" → OS destructive Alert guard
              │
              ▼  ONE inWriteTransaction (mergeContacts):
   1. resolve competing primaries + duplicate source links (avoid partial-unique ABORT)
   2. reparent children UPDATE contact_id: interactions,events,fuel,custom_field_values,
      contact_links,contact_methods,external_contact_links (+ provenance via method_id)
   3. apply survivor scalar resolutions (updateContactMetadataCore + custom values)
   4. redirect app_settings.sun_contact_id if it pointed at absorbed
   5. insertTombstoneCore(entity_type='contact', absorbed.uid)  ← RETIRE (resurrection-proof)
   6. delete absorbed contacts row (assert exactly one)
   7. recomputeLastContactCore(survivorId)  ← derived recompute
              │
              ▼  on commit → survivor profile · on throw → nothing changed, "Try again"
```

### Recommended Project Structure
```
src/db/migrations/013-reconciliation-and-merge.ts   # new tables (session, snapshot, redirect?)
src/db/reconcile-session-dao.ts                     # durable session CRUD (mirror import-session-dao)
src/db/reconcile-session-read.ts                    # reads/counts (mirror import-session-read)
src/db/reconcile-snapshot-dao.ts                    # last-reviewed source snapshot per link+field
src/db/merge-dao.ts                                 # mergeContacts atomic writer (model purge-dao)
src/logic/reconcile-diff.ts                         # pure classify additive/conflict/removed
src/logic/survivor-recommendation.ts                # pure continuity-signal heuristic
src/services/import/reconcile-resume-sweep.ts       # launch-time resume backstop (mirror import sweep)
src/screens/ReconcileDetailScreen.tsx               # net-new (UI-SPEC #4)
src/screens/SurvivorSelectScreen.tsx / SurvivorSelect
src/components/FieldChoiceGroup.tsx                 # net-new (UI-SPEC #5) — reused by reconcile + merge
src/components/PhotoChoice.tsx                       # net-new (UI-SPEC #6)
src/components/MergeImpactSummary.tsx                # net-new (UI-SPEC #13)
src/screens/BulkReviewScreen.tsx                     # net-new (UI-SPEC #14, carried from 19.1)
```

### Pattern 1: Atomic merge modeled on `purge-dao` (reparent, not delete)
**What:** One `inWriteTransaction` that tombstones + mutates in a strict order, asserting exactly one contacts row affected, with all OS side effects post-commit.
**When to use:** The `mergeContacts` writer.
**Example:**
```typescript
// Model: src/db/purge-dao.ts:204-268 (structure) — invert delete→reparent.
// Every child table with an FK to contacts (verified list from migration 011:3-12):
//   app_settings(sun_contact_id), contact_links, custom_field_values, events,
//   fuel, interactions, contact_methods, external_contact_links
//   (+ contact_method_provenance via method_id → contact_methods.contact_id)
export function mergeContacts(exec, { survivorId, absorbedId, resolutions, now }) {
  return inWriteTransaction(exec, async () => {
    // 0. read both uids; assert both live (archived_at IS NULL), assert distinct ids
    // 1. PRE-RESOLVE integrity hazards BEFORE reparent:
    //    - if both contribute is_primary=1 for a method_type → demote one (partial unique idx)
    //    - if both link the SAME (provider, external_contact_id) is_active=1 → retire the dup link
    //    - canonical-duplicate methods → dedupe (collapseCanonicalDuplicate)
    // 2. reparent: UPDATE <child> SET contact_id = survivorId, modified_at = now
    //              WHERE contact_id = absorbedId   (each child table, explicit)
    // 3. apply survivor scalar resolutions via updateContactMetadataCore + custom values;
    //    snapshot any overwritten survivor scalar into field_history (CLAUDE.md destructive-op rule)
    // 4. UPDATE app_settings SET sun_contact_id = survivorId ... WHERE sun_contact_id = absorbedId
    // 5. insertTombstoneCore(exec, {entityType:'contact', entityUid: absorbedUid, deletedAt: now})
    // 6. DELETE FROM contacts WHERE id = absorbedId  → assert changes === 1
    // 7. await recomputeLastContactCore(exec, survivorId, now)  // derived recompute
  }); // post-commit: unlink absorbed photo file best-effort (never inside txn)
}
```
`[VERIFIED: src/db/purge-dao.ts:204-283 for the transaction structure; src/db/migrations/011-contact-lifecycle-schema.ts:3-12 for the exhaustive child-table list]`

### Pattern 2: Durable reconciliation session mirrors `import_sessions`
**What:** A `pending`/`complete`/`discarded` session with per-contact rows carrying resolved/unresolved status; the newest pending session is offered for resume at launch, older ones swept.
**When to use:** `Check linked contacts` (bulk) and any multi-field per-contact review left incomplete.
**Example:**
```sql
-- Model: migration 012 (import_sessions/import_session_rows) + import-session-read.getResumableSession
CREATE TABLE reconciliation_sessions (
  id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','complete','discarded')),
  total_checked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, modified_at TEXT NOT NULL
);
CREATE TABLE reconciliation_session_cards (
  id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
  session_id INTEGER NOT NULL REFERENCES reconciliation_sessions(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  card_status TEXT NOT NULL DEFAULT 'unresolved'
    CHECK (card_status IN ('unresolved','partial','resolved','missing_source')),
  diff_json TEXT NOT NULL,          -- the classified per-field change set for this contact
  unresolved_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, modified_at TEXT NOT NULL,
  UNIQUE(session_id, contact_id)
);
```
`[VERIFIED: src/db/migrations/012-import-sessions.ts:13-54 for the shape idiom; src/db/import-session-read.ts:109-127 for the resume-newest/sweep-older pattern]`

### Pattern 3: Narrow last-reviewed-source memory (Cluster D)
**What:** Suppress a discrepancy that was already reviewed unless the *source* value changed since. Store the reviewed source-canonical value per external link + field family; on next reconcile, only surface the field if the current source value differs from the stored one.
**Example:**
```sql
CREATE TABLE reconcile_source_snapshot (
  id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
  external_contact_link_id INTEGER NOT NULL
    REFERENCES external_contact_links(id) ON DELETE CASCADE,
  field_family TEXT NOT NULL CHECK (field_family IN ('name','phones','emails','birthday','photo')),
  reviewed_value TEXT,        -- canonical value (phones/emails: normalized; photo: fingerprint)
  reviewed_at TEXT NOT NULL,
  UNIQUE(external_contact_link_id, field_family)
);
```
The comparison uses **canonical normalized identity** for phones/emails (Cluster P), so `(312) 555-1234` vs `312-555-1234` is not a change; **label changes ARE meaningful** and must be part of the compared value. `[VERIFIED: dossier Cluster P; contact-methods-dao canonical_value column, migration 011:110]`

### Anti-Patterns to Avoid
- **Writing `contacts.last_contact` directly in the merge.** It is the single-writer recency DAO's exclusive column (DATA-04). Reparent interaction rows, then call `recomputeLastContactCore`. `[VERIFIED: recency-dao.ts:2-8]`
- **Reparenting methods/links before resolving primaries and duplicate source links.** The partial unique indexes `idx_contact_methods_primary_type` and `idx_external_contact_links_active` will `RAISE(ABORT)` mid-transaction. Resolve first. `[VERIFIED: migration 011:178-180]`
- **Copy-then-delete children on merge.** Destroys stable child `uid`s that future sync tombstone-matching depends on. Reparent preserves them.
- **Archiving the absorbed contact.** Dossier Cluster AB is explicit: retired/tombstoned, NOT archived; never restorable through the normal archive lifecycle (`archiveContact`/`restoreContact`/`listArchived`). Do not route merge through those. `[VERIFIED: contacts-dao.ts:521-620; dossier AB]`
- **A bulk `Use Contact Values` over conflict cards.** Cluster J locks it to additive-only selections; `recommendationExcludes:"needs_review"` is the grid's safety seam. `[VERIFIED: CandidateCardGrid.tsx:49-52,96-102]`
- **Forking a second review grid or session store.** Dossier Cluster H + UI-SPEC forbid a parallel UI system.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Card-grid review workspace + multi-select + bulk-action sheet | A new reconciliation grid | `CandidateCardGrid` (reused unchanged) | Already exposes `onInspect`, `apply-recommendation` with `recommendationExcludes` gate, `scoring` state, per-card `failedIds` isolation. `[VERIFIED: CandidateCardGrid.tsx]` |
| Durable/resumable session + launch resume prompt | A bespoke persistence + timer | `import_sessions` pattern + `ResumeImportPrompt` + a launch-sweep hook | Proven durable-across-process-death model; "nothing watches a timestamp". `[VERIFIED: import-session-read.ts:109; contact-import-resume-sweep.ts]` |
| Recompute `last_contact` after merge | A merge-local MAX query | `recomputeLastContactCore` | Single-writer invariant; handles `rarely_responds` connected-only filter. `[VERIFIED: recency-dao.ts:159-172]` |
| gravity / intensity / status after merge | Recompute + store | Nothing — they are query-time derived, not materialized | Auto-correct once children reparent. `[VERIFIED: LOG-03 query-time; DATA-05]` |
| Atomic multi-table consolidation | A hand-rolled transaction | `inWriteTransaction` + the `purge-dao` structure | Shared non-reentrant mutex; assert-one-row discipline. `[VERIFIED: purge-dao.ts]` |
| Method canonical equality + primary dedupe | String compare | `contact-methods-dao` canonical fields + `collapseCanonicalDuplicate` / `choosePrimary` | Canonical normalization + partial-unique-index awareness already implemented. `[VERIFIED: contact-methods-dao.ts:47; contact-methods-editor-model.ts:112,133]` |
| Retire/resurrection-proofing | A new "merged" flag | Generic `tombstones` (`entity_type='contact'`) | `backup/reconciliation.compareRowAndTombstone` already makes a tombstoned contact win over any older row → sync cannot resurrect it. `[VERIFIED: backup/reconciliation.ts:151-155; tombstones-dao.ts]` |
| Impact-summary / completion count rows | New layout | `ImportCompleteScreen` `footerEntry` idiom | UI-SPEC reuse-map mandates it. `[CITED: 20-UI-SPEC.md:80]` |
| Birthday input + normalize + error state (bulk review) | New parser | `normalizeEditedBirthday` + `isBirthdayUnreadable` + the `ImportReview` idiom | Phase 19.1 already flags unreadable birthdays; bulk-review resolves them. `[VERIFIED: import-session-read.ts:277; picked-contact-map.ts:67]` |

**Key insight:** Phase 20 introduces almost no new *mechanism* — only new *compositions* of shipped mechanisms plus one migration. The risk is not "can we build it" but "will a naive merge violate an existing SQLite integrity constraint or the single-writer recency invariant." Both are enumerated above.

## Runtime State Inventory

> This phase both **migrates schema** (adds tables in migration 013) and **mutates stored data** (merge reparents/deletes rows, reconciliation writes values). It is not a rename/refactor, but the state-change surface is large, so the inventory is included.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (schema) | Migration head is **012** / `TARGET_VERSION=12`; Phase 20 adds **migration 013**. New tables only (session, snapshot, optional redirect) — no destructive ALTER on existing tables. `[VERIFIED: src/db/database.ts:47]` | Author `013-*.ts`, register in `MIGRATIONS` + bump `TARGET_VERSION` to 13. Forward-only, irreversible on-device. |
| Stored data (mutation) | Merge reparents rows in 8 child tables and deletes 1 `contacts` row; reconciliation UPDATEs `contacts` scalar fields + methods. Both are **data migrations of live user data**, not schema. | Merge = one atomic txn (Pattern 1). Reconciliation apply = one txn per contact through existing writers. Snapshot to `field_history` on scalar overwrite. |
| Live service config | `app_settings.sun_contact_id` FK may point at the absorbed contact (orrery sun). Notification schedules keyed by `decay:<contactId>` may reference the absorbed id. | Merge step 4 redirects `sun_contact_id` (purge-dao does the same, `purge-dao.ts:253`). Post-commit, reconcile/cancel notifications for the absorbed id (best-effort, outside txn — mirror purge `onPurgeExtensions`). |
| OS-registered state | Photo files: the absorbed contact's photo master under the document dir; staged reconciliation photos in cache. | Post-commit best-effort `unlink` of the absorbed photo (never inside the txn — purge-dao pattern `:25-33`). Reconciliation staged photos swept like import staging. |
| Secrets/env vars | None — no keys or secrets touched. | None. |
| Build artifacts | None. | None. |

**Nothing found:** secrets and build artifacts — verified by scope (no SecureStore, no package rename).

## Common Pitfalls

### Pitfall 1: Partial-unique-index ABORT during merge reparent
**What goes wrong:** `UPDATE contact_methods SET contact_id=survivor WHERE contact_id=absorbed` fails when both contacts have a primary phone (or both link the same source record) — the `WHERE is_primary=1` / `WHERE is_active=1` partial unique indexes reject the second row mid-transaction, rolling the whole merge back.
**Why it happens:** `idx_contact_methods_primary_type` and `idx_external_contact_links_active` are `UNIQUE ... WHERE` partial indexes. `[VERIFIED: migration 011:178-180]`
**How to avoid:** Resolve competing primaries (demote one per type) and dedupe/retire duplicate active source links **before** any reparent UPDATE. The UI-SPEC already routes competing-primary to explicit review (Cluster X).
**Warning signs:** A merge test with two fully-populated contacts throwing `UNIQUE constraint failed`.

### Pitfall 2: Writing `last_contact` outside the single-writer path
**What goes wrong:** A merge that sets `last_contact` directly (e.g. `MAX` of both) defeats DATA-04 and mishandles `rarely_responds` (connected-only) contacts.
**How to avoid:** Reparent interaction rows, then `recomputeLastContactCore(exec, survivorId, now)` — the correlated UPDATE already encodes the `rarely_responds` filter. `[VERIFIED: recency-dao.ts:159-172]`

### Pitfall 3: Treating "missing source" as "all fields removed"
**What goes wrong:** An unresolvable/deleted source contact gets processed as five field-removals and (worse) prompts deletions.
**Why it happens:** The reconciler reads an empty source and naively diffs empty-vs-Orbit.
**How to avoid:** Detect missing source as a **distinct card state** before field diffing (Cluster G); offer only Keep / Relink / Unlink. Never delete/archive/unbind/clear. `[VERIFIED: dossier Cluster G; UI-SPEC #7]`

### Pitfall 4: Re-nagging on an unchanged, already-reviewed discrepancy
**What goes wrong:** Every `Check linked contacts` re-surfaces "Orbit=Allison Smith / source=Allison Jones" the user already chose to keep.
**How to avoid:** Compare current source-canonical against the stored `reviewed_value` snapshot (Pattern 3); suppress if equal, re-surface if the source changed to a new value. Applies to conflicts and source-removals (Cluster D). `[VERIFIED: dossier Cluster D]`

### Pitfall 5: Photo fingerprint assumed available
**What goes wrong:** Planning a hash-based photo diff that silently never fires because no stable source photo token exists.
**Why it happens:** `PickedContact.photoTempUri` is an evictable cache path; the app computes no photo hash anywhere in import/photos. `[VERIFIED: modules/orbit-contact-picker/index.ts:19-25; grep of src/services/import + src/services/photos found no photo hashing]`
**How to avoid:** Treat the **side-by-side manual choice as the primary path** (Cluster Q fallback). If a fingerprint is wanted, it must be computed from the *staged photo bytes* (content hash) each reconcile — a genuine net-new capability, flag as an assumption, not a given.

### Pitfall 6: `field_history` not written on merge scalar overwrite
**What goes wrong:** A merge that overwrites the survivor's name/birthday/category without snapshotting violates CLAUDE.md's "every destructive op snapshots to `field_history` in the same transaction."
**How to avoid:** When a survivor scalar is overwritten by the user's merge resolution, INSERT the old value into `field_history` (`contact_id`, `field_col_name`, `old_value`, `operation`, `created_at`) inside the merge txn. `[VERIFIED: field_history schema, migration 001:156-163]`

## Code Examples

### Re-reading current source state for reconciliation
```typescript
// modules/orbit-contact-picker/index.ts:69 — the live source re-read.
// externalContactId values come from active external_contact_links (is_active=1).
const { contacts, omittedCount } = await readAllContacts(externalContactIds);
// omittedCount > 0 (or a contact absent) → that link is a MISSING SOURCE (Cluster G),
// NOT a set of field removals.
```
`[VERIFIED: modules/orbit-contact-picker/index.ts:69-123]`

### Tombstone-based retirement is already resurrection-proof
```typescript
// backup/reconciliation.ts:151 — a merged-away contact tombstoned now beats any
// older incoming row on a future sync/restore:
export function compareRowAndTombstone(row, tombstone): "row" | "tombstone" {
  return row.modified_at > tombstone.deleted_at ? "row" : "tombstone";
}
```
`[VERIFIED: src/backup/reconciliation.ts:151-155]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Singular `contacts.phone`/`email` columns | Normalized `contact_methods` with canonical equality + primary partial-unique index | Phase 18.1 (migration 009) | Reconciliation/merge must diff/consolidate methods, not columns. `[VERIFIED: migration 011:106-116]` |
| Dynamic custom-value columns | Normalized `custom_field_values` rows (`ADR-001` / migration 006) | Phase 16 | Custom-scalar conflicts diff rows; route sort/filter through `sortExpr()`. `[VERIFIED: migration 011:79-85]` |
| Contacts always Bound | Bound/Unbound lifecycle, `interval_days` nullable, `tracking_enabled` | Phase 18.2 (migration 011) | Merge/reconcile must not clear assigned cadence (trigger `contacts_prevent_cadence_clear` ABORTs). `[VERIFIED: migration 011:181-187]` |
| No system-contact links | `external_contact_links` + `contact_method_provenance` | Phase 18.1/19 | The reconciliation source identity + per-method attribution. `[VERIFIED: migration 011:117-124,228-233]` |

**Deprecated/outdated:** Do not reference `contact_custom_values` (retired, migration 006) or singular phone/email columns (retired, migration 009) — both gone from the v11 schema.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Reconciliation session is best modeled as a **new dedicated table pair** rather than overloading `import_sessions`. | Architecture / Alternatives | Low — either works; overloading adds import-only columns to reconcile rows. Planner/owner may prefer reuse. |
| A2 | Retirement via the **generic `contact` tombstone alone** satisfies RCN-04; a `survivor_uid` redirect is *optional* future-proofing. | Tombstone/Retire | **Medium — owner/sync decision.** Generic tombstone is resurrection-proof, but future sync may need to *rewrite references* to the absorbed uid → a redirect table would then be required and is cheapest to add now in migration 013. Flag for owner: does the future-sync design need a durable `absorbed_uid → survivor_uid` map? |
| A3 | No reliable source-photo fingerprint exists today; **side-by-side manual photo choice is the primary path**. | Pitfall 5 | Low-Medium — if owner expects auto photo-diff, a net-new content-hash capability (hash staged photo bytes) must be planned. |
| A4 | Survivor recommendation uses continuity signals (older `created_at`, more interactions, stronger linkage, more complete data) as **advisory only**. | Architecture | Low — dossier V lists these as examples; exact weighting is delegated. Must remain overridable. |
| A5 | Merge snapshots overwritten survivor scalars to `field_history`; child reparent rows do **not** each snapshot (they move, not destroy). | Pitfall 6 | Low — consistent with CLAUDE.md ("destructive op") since reparent is non-destructive; only scalar overwrite destroys a value. |
| A6 | Phase 20's migration number is **013**. | Runtime State Inventory | Low — verified on disk this session (`TARGET_VERSION=12`), but re-verify at plan time; every schema phase drifts head+1. |

**If any A2/A3 assumption is load-bearing for the owner's future-sync intent, surface it at discuss/plan before locking the migration.**

## Open Questions

1. **Does future sync need an absorbed→survivor redirect map, or is the generic tombstone enough?**
   - What we know: generic `contact` tombstone already blocks resurrection (`compareRowAndTombstone`). Migration 013 is the cheapest moment to add a `contact_redirects(absorbed_uid, survivor_uid, merged_at)` table if sync will rewrite references.
   - What's unclear: the future sync milestone's reference-rewriting model (out of scope, but the schema hook is decided now).
   - Recommendation: **raise with owner** (risk/security posture + a schema decision that is expensive to add later). Default to including a minimal redirect table in 013 unless owner declines — it is additive and future-only.

2. **Reconciliation-session store: dedicated table vs. `import_sessions` reuse?**
   - Recommendation: dedicated `reconciliation_sessions` (Pattern 2) — cleaner status semantics; copy the durability idioms, not the columns. Planner's call (implementation detail).

3. **E3 grid virtualization for a large linked address book** (UI-SPEC's one unresolved item).
   - Recommendation: `FlatList` virtualizes by default; treat an on-screen review-batch cap as a planner decision. Scanning is already one-shot/user-triggered.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `expo-sqlite` | All persistence | ✓ | shipped | — |
| `orbit-contact-picker` native module | Live source re-read | ✓ | in-repo | On API ≤36, legacy `READ_CONTACTS` path (ADR-002) supplies the same `PickedContact`. |
| Android Contacts (device) | Reconciliation source | ✓ (device UAT) | — | Missing-source state handles absent/unresolvable records. |
| Node 24 + vitest/`node:sqlite` | Unit tests | ✓ | Node 24 at `/usr/local/bin` (per MEMORY) | Re-probe if it regresses to system Node 18. |

**Missing dependencies with no fallback:** none. **With fallback:** none blocking.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest with `node:sqlite` in-memory DB (existing DAO test pattern) |
| Config file | project vitest config (existing; 1,510+ tests green as of 18.1) |
| Quick run command | `npx vitest run src/db/merge-dao.test.ts` (per new file) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RCN-01 | additive/conflict/removed classification per field family | unit | `npx vitest run src/logic/reconcile-diff.test.ts` | ❌ Wave 0 |
| RCN-01 | missing-source is distinct; never deletes Orbit data | unit | `npx vitest run src/db/reconcile-*.test.ts` | ❌ Wave 0 |
| RCN-02 | durable session survives "process death" (reopen DB, resume) | unit | `npx vitest run src/db/reconcile-session-read.test.ts` | ❌ Wave 0 |
| RCN-02 | unchanged reviewed discrepancy suppressed; changed-again re-surfaces | unit | `npx vitest run src/logic/reconcile-diff.test.ts` | ❌ Wave 0 |
| RCN-02 | multiple source links → one card | unit | `npx vitest run src/logic/reconcile-diff.test.ts` | ❌ Wave 0 |
| RCN-03 | merge reparents all 8 children; asserts one contacts row deleted | unit | `npx vitest run src/db/merge-dao.test.ts` | ❌ Wave 0 |
| RCN-03 | competing primaries / duplicate source links resolved (no ABORT) | unit | `npx vitest run src/db/merge-dao.test.ts` | ❌ Wave 0 |
| RCN-03 | `last_contact` recomputed (incl. `rarely_responds`) after merge | unit | `npx vitest run src/db/merge-dao.test.ts` | ❌ Wave 0 |
| RCN-03 | merge failure → full rollback, absorbed contact intact (atomic) | unit | `npx vitest run src/db/merge-dao.test.ts` | ❌ Wave 0 |
| RCN-04 | absorbed contact tombstoned as `contact`, not archived; not in `listArchived` | unit | `npx vitest run src/db/merge-dao.test.ts` | ❌ Wave 0 |
| RCN-04 | tombstone beats older row on reconciliation (resurrection-proof) | unit | `npx vitest run src/backup/reconciliation.test.ts` (extend) | ⚠ extend |

### Sampling Rate
- **Per task commit:** the touched DAO/logic test file.
- **Per wave merge:** `npm test`.
- **Phase gate:** full suite green + **device UAT on the Pixel** (debug build, `run-as` DB reads per MEMORY device-UAT pattern) for merge atomicity + durable resume across process death.

### Wave 0 Gaps
- [ ] `src/db/merge-dao.test.ts` — RCN-03/04 (reparent, integrity, recompute, rollback, tombstone-not-archive)
- [ ] `src/db/reconcile-session-dao.test.ts` + `reconcile-session-read.test.ts` — RCN-02 durability
- [ ] `src/db/reconcile-snapshot-dao.test.ts` — RCN-02 narrow memory
- [ ] `src/logic/reconcile-diff.test.ts` — RCN-01 classification + Cluster D/M
- [ ] `src/logic/survivor-recommendation.test.ts` — Cluster V heuristic
- [ ] `src/db/migrations/013-*.test.ts` — v12→v13 forward migration + FK integrity
- [ ] Extend `src/backup/reconciliation.test.ts` — merged-contact resurrection-proofing

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` in `.planning/config.json`. Local-first, no network on any Phase 20 path.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface; on-device only. |
| V3 Session Management | no | No server session; "session" here is a local DB row. |
| V4 Access Control | no | Single local user; no multi-tenant boundary. |
| V5 Input Validation | **yes** | All values `?`-bound; **no identifier interpolation** (table names are literals in constant SQL — the purge-dao rule). Birthday via `isValidStoredBirthday`; method values via canonical normalizer. `[VERIFIED: purge-dao.ts:35; imported-contact-dao.ts]` |
| V6 Cryptography | no | No new crypto (photo content-hash, if added, is integrity-only, not security). |
| V7 Data Protection | **yes** | Reconciliation reads Android Contacts locally, never transmits (local-first). Absorbed contact's data is consolidated, not leaked. Tombstones/`field_history` excluded from portable export (existing rule). |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via a custom-field or contact identifier in ORDER BY / merge SQL | Tampering | Route custom-field sort through `sortExpr()`; all merge/reconcile SQL uses `?`-bound values and literal table names. `[VERIFIED: FLD-06; purge-dao pattern]` |
| Partial merge leaving corrupt half-consolidated state | Tampering / DoS | Single `inWriteTransaction`, assert-one-row, rollback-on-throw (Cluster AC atomicity). |
| Resurrection of a merged identity via restore/future sync | Tampering | Generic `contact` tombstone + `compareRowAndTombstone` (RCN-04). |
| Silent contact-data destruction from source disagreement | Repudiation / Tampering | Apply only user-selected values; removed/missing-source never auto-deletes; `field_history` snapshot on scalar overwrite. |

## Sources

### Primary (HIGH confidence — read on disk this session)
- `src/db/database.ts` — `TARGET_VERSION=12`, migration registration
- `src/db/migrations/011-contact-lifecycle-schema.ts` — full v11 schema, child-table list, partial unique indexes, cadence-clear trigger
- `src/db/migrations/012-import-sessions.ts`, `007-tombstones.ts`, `001-initial.ts` (field_history)
- `src/db/purge-dao.ts` — atomic fan-out reference pattern
- `src/db/tombstones-dao.ts`, `src/backup/reconciliation.ts` — retirement/resurrection-proofing
- `src/db/recency-dao.ts` — single-writer `last_contact` recompute
- `src/db/contact-methods-dao.ts`, `src/components/contact-methods-editor-model.ts` — canonical dedupe / primary
- `src/db/imported-contact-dao.ts`, `import-session-dao.ts`, `import-session-read.ts` — link + durable session model
- `src/db/contacts-dao.ts` — archive/restore (NOT the merge path), `updateContactMetadataCore`
- `src/components/CandidateCardGrid.tsx`, `ConfidenceChip.tsx` — reused UI
- `modules/orbit-contact-picker/index.ts` — `PickedContact` source shape, live re-read
- `.planning/phases/20-contact-reconciliation-merge/20-UI-SPEC.md` — approved UI contract
- `docs/dossier/20-contact-reconciliation-merge.md` — authoritative product decisions

### Secondary (MEDIUM)
- `src/services/import/contact-import-resume-sweep.ts`, `source-consolidation.ts`, `duplicate-evidence.ts` (grepped signatures)

### Tertiary (LOW)
- None — no web search needed; a closed local-first codebase with locked product decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; every reused module opened on disk.
- Architecture: HIGH — merge/reconcile patterns grounded in shipped `purge-dao`/`import-session`/`recency` code and the v11 schema; the two open items (redirect shape, photo fingerprint) are explicitly flagged.
- Pitfalls: HIGH — each derived from a verified schema constraint or invariant, not memory.

**Research date:** 2026-08-30
**Valid until:** ~2026-09-30 (stable local codebase; re-verify `TARGET_VERSION`/migration head at plan time — it drifts every schema phase).
</content>
</invoke>
