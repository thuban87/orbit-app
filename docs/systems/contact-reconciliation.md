# Contact Reconciliation

**Last updated:** 2026-10-18
**Updated by phase:** 38.12-lifecycle-import-settings-ux
**Owners:** `src/db/reconcile-apply.ts`, `src/db/reconcile-memory-read.ts`, `src/db/merge-conflicts-read.ts`, `src/db/reconcile-session-dao.ts`, `src/db/reconcile-session-read.ts`, `src/db/reconcile-snapshot-dao.ts`, `src/db/reconcile-relink-dao.ts`, `src/db/merge-dao.ts`, `src/logic/reconcile-diff.ts`

## Purpose

Contact reconciliation lets a person deliberately compare linked Android system contacts with Orbit's local copy without making the source authoritative. It also provides a serious local merge path for duplicate Orbit identities, preserving compatible relationship data on-device and requiring an explicit choice where meaningful values conflict.

## Architecture

### Data Model

Migration 013 keeps reconciliation state in local SQLite; migration 034 widened the review-memory families and added the resume marker. It does not create a generic synchronization journal, source authority model, or cross-device conflict mechanism.

**Tables:**
- `reconciliation_sessions` — one durable user-triggered linked-contact review run.
  - `status` (`TEXT`) — `pending`, `complete`, or `discarded` session state.
  - `resume_prompted_at` (`TEXT`, nullable) — when the one "Resume your check?" prompt was shown (migration 034, ADR-237).
  - `checked_count` (`INTEGER`) — number of linked contacts considered by the scan.
- `reconciliation_session_cards` — one changed Orbit contact's durable review state in a session.
  - `diff_json` (`TEXT`) — persisted actionable differences and their disposition.
  - `card_status` (`TEXT`) — pending, partial, resolved, or missing-source review state.
  - `staged_photo_rel_path` (`TEXT`, nullable) — safe private source-photo staging reference.
- `reconcile_source_snapshot` — the last reviewed canonical source value per active external link and field family.
  - `field_family` (`TEXT`) — name, phones, emails, birthday, photo, or `source` (a missing source kept as is, `MISSING_SOURCE_KEPT`; migration 034).
  - `reviewed_value` (`TEXT`, nullable) — narrow source-memory value used only to suppress an unchanged re-nag. For `photo` it is the phone photo's fingerprint (`photoFingerprint`, SHA-256 of the thumbnail bytes), recorded at import and on review (ADR-236, ADR-240).
- `bulk_review_resolutions` — durable `fixed` or `ignored` dispositions for import rows with unreadable birthdays.
- `tombstones` — existing generic contact retirement evidence; merge writes one for its absorbed identity instead of archiving it.
- `memories`, `relationships`, `current_state_entries` and `off_limits` — contact-owned knowledge rows that merge reparents explicitly before retiring the absorbed identity.

**Types** (`src/logic/reconcile-diff.ts`, `src/db/merge-dao.ts`):
- `ReconcileDiffResult` — classified five-family source comparison and actionable options.
- `MergeResolutions` — typed user selections for scalar, photo, and per-method-type primary conflicts.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|-------|------|----------------|
| Diff logic | `src/logic/reconcile-diff.ts` | Classifies canonical source changes and serializes method-family source memory. |
| Apply DAO | `src/db/reconcile-apply.ts` | Applies selected reconciliation fields with stale-value protection through existing writer cores. |
| Session DAO | `src/db/reconcile-session-dao.ts` | Creates, transitions, finalizes, and discards durable review sessions and cards. |
| Memory read | `src/db/reconcile-memory-read.ts` | `loadReviewMemory`, `classifyLinkedContact`, `scanLinkedContacts`: one review-memory read for the grid and the detail. |
| Session read | `src/db/reconcile-session-read.ts` | Reads the newest resumable session without side effects, cards, and exclusive completion buckets. |
| Merge conflicts read | `src/db/merge-conflicts-read.ts` | `readMergeConflictData` with a photo/text kind per custom conflict. |
| Relink DAO | `src/db/reconcile-relink-dao.ts` | Replaces or retires only an external source link without changing Orbit data. |
| Merge DAO | `src/db/merge-dao.ts` | Performs the atomic survivor/absorbed merge and tombstone retirement. |
| Photo service | `src/services/photos/reconcile-photo.ts` | Stages source photos and promotes a chosen photo after commit. |
| Resume service | `src/services/import/reconcile-resume-sweep.ts` | Surfaces newest pending work once (ADR-237) and cleans discarded staging on foreground launch. |

### Key Files

| File | Role |
|------|------|
| `src/db/migrations/013-reconciliation-and-merge.ts` | Defines reconciliation session, snapshot, and bulk-review durable state. |
| `src/logic/reconcile-diff.ts` | Implements additive, conflict, removed, and missing-source classification. |
| `src/db/reconcile-apply.ts` | Composes safe local writes and reviewed snapshots. |
| `src/db/reconcile-session-dao.ts` | Owns session/card state transitions. |
| `src/db/reconcile-relink-dao.ts` | Implements non-destructive relink and unlink. |
| `src/db/merge-dao.ts` | Owns transactional merge order, child reparenting, and tombstoning. |
| `src/screens/ReconcileDetailScreen.tsx` | Renders per-contact review, missing-source actions, and permission-gated source reads. |
| `src/screens/ReconcileGridScreen.tsx` | Runs a Settings-launched scan and hosts durable bulk review. |
| `src/components/MergeImpactSummary.tsx` | Displays the typed same-event collision remediation. |

## How It Works

### Reviewing linked-contact changes

1. A user taps `Check with phone Contacts…` in a linked person's Profile ⋯ (38.12 D-100) or `Check linked contacts` in Settings; the API-37+ read requests Contacts access in context before querying the linked source records.
2. `classifyReconciliation()` compares name, methods, birthday, and photo identity against Orbit using canonical method equality. It emits additive, conflict, removed-from-source, or distinct missing-source outcomes. The grid and the detail read review memory the same way (`reconcile-memory-read`, region `override ?? device`), drop `unchanged-since-review` fields, and store only actionable fields on a card, so a reviewed, unchanged difference never returns (ADR-236). A phone photo is compared by its fingerprint, never by the stored master, so a full-size import is not a difference; an unreadable phone birthday is dropped at classify time.
3. The detail flow applies only selected values. The Orbit option lists readable methods one per line; each phone option shows the phone's own label ("Work · (312) 555-0122", `pickedMethodLabel`). Apply adds only the options chosen, with their labels. A picked phone value becomes the primary and the old Orbit value stays as a secondary; nothing is deleted. Pre-ticked new values are still added, but only a field the person tapped can change Orbit's primary, and unticking a pre-ticked value is not a choice (`buildReconcileSelections`, ADR-236). Every choice row shows a radio or checkbox, and a choice shown selected enables Apply. The keep-photo option reads "Keep Orbit photo", or "Keep no photo" when Orbit has none. A successful Apply returns to the grid with a snackbar ("Kept Orbit values for <name>" when nothing changed) and records its completion disposition. It re-reads scalar baselines before writing, snapshots overwritten local values, and records the source value reviewed for that link and family.
   Each source option has a stable ID. The selected birthday or name reaches the writer exactly, while the reviewed snapshot records the comparable for all linked source options. A null source scalar is rejected as stale and cannot clear an Orbit value.
4. A batch scan persists only changed contacts as cards in one session. Additive, non-photo selections can use a safe bulk source-values action; conflict and removed cases remain manually reviewed. There is no "Apply recommendation" on this grid (ADR-236). The grid's card writes go through `setCardCompletionDisposition`, not in-screen SQL.
   Bulk source-value actions also leave name or birthday fields with multiple source options for explicit detail review; those cards remain partial.
5. A card remains until all actionable differences resolve. Completion ("Check complete") reports exclusive contact counts with `plural()`: a missing-source card counts once, under "Not in phone Contacts". Its Done, header Back and system Back finish through the flow host, back on Settings → Contacts & Relationships for a Settings-started check (ADR-241). Pending work survives process death; the next launch or foreground asks "Resume your check?" once, and afterwards the Settings row reads "Finish your check (N left)" (ADR-237).
6. The grid and detail share one flow name, "Check linked contacts" (`CHECK_LINKED_CONTACTS`), and plain labels: "Not in phone Contacts", "Needs your choice", "Link to a different phone contact" and "Unlink from phone contact" (red, with its Galaxy Dark backing). "Not in phone Contacts" cards show no differences-left line.
7. The `CandidateCardGrid` review card (Reconcile Grid only since 38.12; Duplicate Review has its own list, ADR-238) has an accessible representation equal to what it shows (RG-031, ui-accessibility/AUD-UIA-008). `buildCandidateCardAccessibility` (`src/components/candidate-card-a11y.ts`) labels the card with the person's name, the displayed chip text (reconciliation advisory copy, or the import confidence label), the evidence line, and the per-card failure copy when it is shown. While the grid is selecting, the card exposes `accessibilityState.selected` and a filled/outline `select` glyph, so selection is not shown by border alone. A Select/Deselect custom action calls the same toggle as long-press. Tap keeps its meaning: inspect when not selecting, toggle when selecting. The chip stays advisory, and stable internal IDs are never helper inputs.

### Handling a missing source

1. An unavailable linked source becomes `missing_source`, never a synthetic set of removals.
2. Keep leaves the Orbit contact untouched and is remembered in the `source` review family, so that link is left out of later comparisons (ADR-236); Unlink retires only its active external link.
3. Relink preflights globally active source identity, retires the stale link, attaches the selected source, and runs normal reconciliation review without resetting Orbit data.

### Merging duplicate Orbit contacts

1. A user begins from the Profile ⋯ `Merge with another contact…` (any live person, never a binned one; 38.12 D-99, D-34) or a reconciliation duplicate path. Step one embeds the shared `ContactPickerList` with search and a ✕ Cancel, shows this person first, never lists Bin contacts, and has its own loading and error states (ADR-235). The user then chooses a survivor (Survivor select's second step is a guard sub-editor: Back returns to the picker, ADR-200), and resolves genuine scalar, photo, and competing-primary conflicts. The candidate grid and merge-conflict photo choice render each Orbit photo by passing its stored relative path to `Avatar` (`CandidateItem.photo`, `PhotoChoiceOption.photo`), so they follow the display revision. Staging previews keep their own URI with `cachePolicy="none"` (ADR-180).
2. `mergeContacts()` resolves method and active-link collisions before reparenting compatible children — including any pending `interaction_assists` — to the survivor inside one write transaction, so a later assist confirmation logs against the survivor with no survivor lookup.
3. The writer preserves field-history snapshots for overwritten or dropped meaningful values, recomputes `last_contact` through the recency core, deletes the absorbed row, and writes a generic contact tombstone.
4. It reparents knowledge rows (including `off_limits`) before deletion and clears links that would become a self-link. Current state needs no demotion step: Most Recent follows date order (ADR-210). Interaction links stay same-contact.
4a. The merge review counts come from `readMergeImpactCounts` (`src/db/merge-impact-read.ts`) over every table the merge reparents: interactions, events, methods, external links, memories, relationships, current state, non-blank custom values and pending assists. Each line shows only when non-zero (`mergeImpactLines`). The survivor keeps its own Profile layout, background and Orrery overrides; what of the absorbed person's is dropped is listed under "Not kept from <absorbed name>:" (`mergeDroppedLines`, ADR-235).
4b. Merge conflicts read through `readMergeConflictData`. A photo-type custom conflict is a photo choice only when both values are stored photo paths; any text makes it a text choice, where a stored path reads "Photo". During the merge only a stored path is rehomed; text in a photo field moves as an ordinary raw custom value (ADR-235).
5. The merge impact summary is a confirm-or-abandon screen with a ✕ Cancel header, and Merge is a themed destructive confirm (ADR-198, ADR-201). The UI lands on the survivor only after the transaction succeeds; an error leaves both contacts intact. A merge started from a Profile ends on the survivor's Profile (replacing the launching Profile by route key); one started in Settings ends back on Settings (ADR-241).

### Resolving same-Group-Event merge collisions

Before reparenting interaction rows, `mergeContacts` checks whether survivor and absorbed contact share a non-null Group Event membership inside its existing write transaction. A collision throws `GroupMergeCollisionError`; the complete merge rolls back with both contacts, children, and deletion evidence intact. `MergeImpactSummary` displays the typed guidance to remove one membership from the shared event before retrying.

A no-collision merge preserves existing child reparenting, Group Event reference, and survivor recency recomputation. The writer never picks a destructive child survivor or reconciles competing participant notes automatically.

## Configuration

| Constant | Value | File | Purpose |
|----------|-------|------|---------|
| Reconciled families | name, phones, emails, birthday, photo | `src/logic/reconcile-diff.ts` | Keeps source comparison narrowly scoped. |
| Bulk source-values rule | additive-only, non-photo | `src/logic/reconcile-bulk-eligibility.ts` | Prevents a bulk source overwrite of conflicts. |

## Decisions

- **ADR-207:** Knowledge Homes After Fuel — Off Limits rows reparent with the other knowledge.
- **ADR-210:** Dated Last Talked About and Current Location — no demotion on merge.
- **ADR-003:** `READ_CONTACTS` on API 37+ for Reconcile — gates current-source reads behind an in-context permission request.
- **ADR-068:** User-Triggered, Source-Only Reconciliation with Durable Review — defines bounded one-way reconciliation and resumable review.
- **ADR-069:** Atomic Tombstone-Backed Orbit Contact Merge — defines explicit atomic consolidation and absorbed-contact retirement.
- **ADR-073:** Merge-Reparented, Purge-Cascaded Interaction Assists — extends the merge reparent loop to the pending-assist child table so redirect needs no lazy lookup.
- **ADR-089:** Recoverable Memory Lifecycle and Contact-Operation Integrity — extends merge reparenting to typed contact-knowledge rows and their collision rules.
- **ADR-160:** Committed-Identity Contact Edits and Exact-Source Reconciliation — carries stable source-option identity through review and snapshots the exact comparable that the user selected.
- **[ADR-090: Additive Custom-Field Value History and Deferred Contact Scope](../decisions/ADR-090-additive-custom-field-value-history-and-deferred-contact-scope.md)** — governs `src/db/merge-dao.ts`.
- **[ADR-128: Same-Group Contact Merge Refusal with Remediation](../decisions/ADR-128-same-group-contact-merge-refusal-with-remediation.md)** — governs `src/db/merge-dao.ts`.
- **[ADR-166: Typed Cross-Tab Entry, Settings-Hosted Profile Contract, and Latest-Wins Notification Ingress](../decisions/ADR-166-typed-cross-tab-entry-settings-hosted-profile-contract-and-latest-wins-notification-ingress.md)** — routes the reconcile resume prompt through the typed cross-tab entry helper.
- **[ADR-168: Truthful Read Phases for Import, Review, and Settings Screens](../decisions/ADR-168-truthful-read-phases-for-import-review-and-settings-screens.md)** — gives ReconcileComplete a loading branch and a summary-only Retry.
- **ADR-169:** Standard-Light Glass Foreground Scope, Both-Extrema Contrast Proof, and Accent Role Contract — foregrounds on glass read through the glass scope, and `accentText` / `onAccent` / `accent` roles are enforced by AST contracts.
- **ADR-174:** Fit-to-Width Heatmaps and Large-Text Reachability for Dialogs and Sheets — measured, centred heatmaps with capped tap zones; dialog, sheet and prompt actions stay reachable at maximum text.
- **ADR-179:** Owner-Ruled Art Treatments Beyond the Signed Table — the Reconcile detail "Unlink source" string and the merge impact "{absorbed} will be retired." line sit on an opaque root-`background` backing in Galaxy Dark (`persistentDangerScrim`), clearing 4.5:1 over the art.

- **ADR-180:** Display-Revision Photo URIs and Current Photos on Every Existing-Contact Surface — the candidate grid, merge conflicts and the keep-Orbit-photo card show Orbit photos.
- **ADR-181:** One Square WebP Master up to 1024 px with Bounded Orrery Textures from Cache Copies — a promoted source photo is mastered by the shared encoder.
- **ADR-198:** Themed Dialogs Through One Imperative Host, an Overlay Registry, and Snackbars Above Overlays — the reconcile and merge prompts are themed confirms, notices or snackbars.
- **ADR-201:** Shared Child Header with a Chevron Back and a Person Line on Every Pushed Screen — the reconcile and merge screens carry the child header; Check complete's Back acts like Done; Merge impact summary uses ✕ Cancel.
- **ADR-233:** The Profile ⋯ Follows Lifecycle State — the per-person `Check with phone Contacts…` and `Merge with another contact…` entries.
- **ADR-235:** Merge Starts from the Profile — the searchable picker, complete counts, photo/text conflicts, kept presentation.
- **ADR-236:** Check Linked Contacts Never Re-Asks a Reviewed Difference — review memory, tapped values, primary election, plain words (partially supersedes ADR-179's "Unlink source" string).
- **ADR-237:** A Paused Import or Check Asks Once — the resume marker and Settings row.
- **ADR-240:** Import Takes Full-Size Phone Photos — the photo fingerprint and thumbnail-only Check.
- **ADR-241:** Flows Carry a Flow Host — check and merge endings.

## Gotchas

1. **Missing is not removed.** A missing source must never delete, archive, unbind, or clear Orbit data.
2. **Do not re-nag an unchanged source discrepancy.** Snapshot the canonical source value actually reviewed; a changed-again source must surface again.
3. **Stage before, promote after commit.** A failed photo promotion leaves its snapshot unwritten so the source photo remains reviewable later.
4. **Do not nest the transaction mutex.** Session and apply helpers expose non-mutexed cores for composition inside their owning transaction.
5. **Merge has no simple undo.** Never use the normal archive lifecycle for the absorbed identity; tombstoning prevents resurrection.
6. **Reconciled method additions have no v1 provenance row.** Imported methods retain stronger source attribution than reconciliation-added methods.
7. **Every contact-owned child must join the reparent loop.** The merge reparents children explicitly (not by cascade); a new child table — like `interaction_assists` in phase 21 — that is not added to `mergeContacts()` would be stranded on the absorbed identity. Do not rely on `ON DELETE CASCADE` for merge.
8. **Clear prospective relationship self-links before reparenting.** The migration-level CHECK is a backstop, not permission to let a merge fail after other choices were resolved.
9. **Do not collapse source options to a display value.** Selection must retain the stable source-option ID through apply, then snapshot the comparable for that exact option; name or birthday duplicates can otherwise apply or suppress the wrong source value.

10. **Compare photos by the phone's fingerprint.** Comparing the stored master would re-ask every person whose photo was imported full-size (ADR-240); keep `photoFingerprint` as the photo family's reviewed value.
11. **Check stays at thumbnail size.** `readContactsByLookupKeys` defaults `preferFullSize` to false; only import passes true. Passing it from Check would grow backups with no size warning (ADR-240).
12. **Every table a merge reparents belongs in `MergeImpactCounts`.** Otherwise the summary undercounts again (ADR-235).

- **Remediation must reach the screen.** The original generic catch discarded typed guidance and encouraged an ineffective retry. The corrected merge summary displays the collision-specific message and keeps generic fallback for unrelated failures.

## Related Systems

- **Contacts** — owns contact identity, field history, recency, and external links that reconciliation reads or consolidates.
- **Contact methods** — supplies canonical endpoint identity and primary-method semantics.
- **Photos** — supplies durable source-photo staging and post-commit mastering.
- **Contact import** — establishes the linked source records and owns the selected-contact native bridge.
- **Persistence core** — runs migration 013 and the shared transaction boundary.
- **Interaction Assist & Reach Out** — its pending assists are reparented to the survivor inside the merge transaction.
- **Contact Knowledge** — reparents Memories, relationships, and current-state history through the same atomic merge seam.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-08-26 | 20 | Created user-triggered durable reconciliation, safe relinking, and atomic tombstone-backed merge documentation. |
| 2026-08-31 | 21 | Extended the merge reparent loop to pending `interaction_assists` so a merged target's later confirmation logs against the survivor. |
| 2026-09-03 | 24.1 | Extended merge reparenting with typed contact-knowledge rows, self-link safety, and current-state collision preservation. |
| 2026-09-02 | 33 | Added owner-locked same-event merge refusal before reparenting and user-visible membership remediation. |
| 2026-09-23 | 38.2 | Preserved source-option identity through reconciliation, recorded the complete reviewed comparable, and excluded ambiguous scalars from bulk source apply. |
| 2026-09-25 | 38.3 | Reconcile summary loading vs error (RG-035): Reconcile Complete shows a real loading state during its read and "Couldn't load the check summary" with a read-only Retry only after the read fails. |
| 2026-09-26 | 38.4 | Review-card accessibility (RG-031 AUD-UIA-008): review cards announce name, advisory chip, evidence and failure copy; expose `selected` while selecting, with a non-border selected glyph; and offer a Select/Deselect action equivalent to long-press. |
| 2026-09-27 | 38.4 | Resume-check prompt scrolls its body at large text; its Resume label uses `onAccent` (D-49, OA-D3). |
| 2026-09-26 | 38.5 | In Galaxy Dark, the Reconcile detail "Unlink source" string and the merge impact "{absorbed} will be retired." line sit on an opaque backing over the art (D-50; ADR-179). |
| 2026-09-30 | 38.6 | Candidate grid and merge-conflict photo choice render Orbit photos through `Avatar` (no screen imports `resolvePhotoUri`); Update from Contacts' "keep Orbit photo" option is a card with the current Orbit photo beside the phone photo (`PhotoChoice` `keepPhoto`, `ScanState.orbitPhoto`); reconcile promotion encodes through `encodeMaster` (ADR-180, ADR-181). |
| 2026-10-11 | 38.9 | Reconcile and merge screens use the shared child header; Check complete's Back acts like Done (D-73); Merge impact summary has a ✕ Cancel; Survivor select's second step returns to the picker on Back; native alerts became themed confirms (ADR-198, ADR-200, ADR-201). |
| 2026-10-15 | 38.10 | Merge reparents Off Limits rows; no current-state demotion; the review screen's counts come from `readMergeImpactCounts` without a fuel line (ADR-207, ADR-210). |
| 2026-10-18 | 38.12 | KB extraction: review memory that never re-asks (fingerprinted photos, `source` family, migration 034), tapped-only apply with labels and primary election, plain-word labels, no Apply recommendation, exclusive counts, ask-once resume; merge picker, complete counts, photo/text conflicts, kept presentation, host endings (ADR-235–ADR-237, ADR-240, ADR-241). |
| 2026-10-18 | 38.12 | The per-person check and merge start from the Profile ⋯ (`Check with phone Contacts…` when linked, `Merge with another contact…`) in any tab (D-99, D-100, D-91). In the detail, pre-ticked phone/email values are added but only a field the person tapped can change Orbit's primary (D-144). |
