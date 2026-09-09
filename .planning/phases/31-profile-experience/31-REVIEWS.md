---
phase: 31
reviewers: [codex, claude]
reviewed_at: 2026-09-09T05:26:25-05:00
plans_reviewed: [31-01-PLAN.md, 31-02-PLAN.md, 31-03-PLAN.md, 31-04-PLAN.md, 31-05-PLAN.md, 31-06-PLAN.md, 31-07-PLAN.md, 31-08-PLAN.md, 31-09-PLAN.md, 31-10-PLAN.md]
models:
  codex: "gpt-5.6-sol (reasoning=low)"
  claude: "sonnet (reasoning=low)"
model_sources:
  codex: "banner"
  claude: "pinned"
---

# Cross-AI Plan Review — Phase 31

## Codex Review

# Cross-AI Plan Review — Phase 31 Profile Experience

## Overall assessment

The ten-plan decomposition is thoughtful, requirement-complete, and unusually strong on decision preservation, local-first privacy, transaction boundaries, accessibility, and cross-phase seams. The order generally moves correctly from persistence to read models to renderers and editors.

I would not approve execution unchanged, however. Three source-verified issues need plan revisions:

1. Plan 03’s retry/idempotency requirement conflicts with the established unconditional snooze/unsnooze event contract.
2. Plan 04 cannot pass the proposed `ReadOnlyExecutor` through several existing readers without changing their signatures or adding adapters.
3. Plan 09 introduces a second recoverable file namespace without integrating it into the launch reconciliation path.

Overall risk: **HIGH until those three concerns are resolved**, then **MEDIUM**, primarily due to the phase’s large UI surface and reliance on late physical-device validation.

`graph:ask` was attempted first as required, but every query failed because `tsx` could not create its IPC socket (`EPERM` under `/tmp/tsx-1000`). The findings below therefore rely on direct source, migration, DAO, query, and test inspection rather than graph edges.

---

# Plan 31-01 — Presentation schema and collapse tracer

## Summary

A good vertical tracer with an appropriate human checkpoint for the irreversible migration. It proves persistence through a real Profile interaction before expanding the presentation system. The main weakness is sequencing: durable JSON-bearing schema is approved and shipped before Plan 02 defines the closed layout document and semantic registry that give those columns meaning.

## Strengths

- Migration 024 is correctly derived as head+1. The live registry ends at migration 023 and `TARGET_VERSION` is 23 in [database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:47) and [database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:58).
- Registering migration 024 in the single authoritative `MIGRATIONS` array matches the current bootstrap architecture at [database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:60).
- The transaction/revision design follows the established non-reentrant write contract: one outer transaction and no nested wrapper, as documented in [transaction.ts](/home/bwales/projects/orbit-app/src/db/transaction.ts:12).
- The Unbound-status requirement is grounded in the existing guard: inactive or never-contacted contacts return null status/progress rather than entering cadence SQL at [contact-status-read.ts](/home/bwales/projects/orbit-app/src/db/contact-status-read.ts:72).
- Removing the existing AI-draft entry is source-grounded; it currently exists separately from Message at [ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:1096).

## Concerns

- **MEDIUM — Schema precedes its persisted contract.** Plan 01 creates the complete tables, including layout/freeform/collapse storage, while the canonical semantic IDs, layout parser, version field behavior, and canonical JSON representation do not land until Plan 02. This creates avoidable uncertainty at the one-way migration checkpoint.
- **MEDIUM — Tracer work is knowingly added to the monolithic screen and later removed.** The current Profile already combines loading, mutation, navigation, and presentation; its unified load and many independent state setters are visible at [ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:260). The tracer is valuable, but it should be implemented through a small component seam that Plan 05 can retain.
- **LOW — Migration coverage should include live PRAGMA behavior.** Foreign keys are connection-local and deliberately enabled before migrations at [database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:153). The migration tests should explicitly run with foreign keys enabled when asserting category/contact fallout.

## Suggestions

- Move the minimal persisted type vocabulary—document version, semantic module-ID grammar, and collapse-map shape—into Plan 01, while leaving full parser/resolver behavior in Plan 02.
- Make the tracer’s Overview header a retained component rather than temporary inline JSX.
- Add migration tests for foreign-key enforcement, malformed JSON fallback, and deletion behavior with `PRAGMA foreign_keys = ON`.

## Risk assessment

**MEDIUM.** The vertical approach is sound, but irreversible schema should not precede the minimum stable persisted vocabulary.

---

# Plan 31-02 — Presentation contracts, resolver, and DAOs

## Summary

This is the architectural center of the phase and is mostly well designed. Definitions, assignments, freeform overrides, collapse state, and independent layout/background resolution are properly separated. It needs sharper handling of restore-accepted settings whose referenced entities are intentionally absent from backup format 4.

## Strengths

- The proposed precedence model correctly avoids materializing inherited state onto contacts. Existing contacts store only a category row reference at [001-initial.ts](/home/bwales/projects/orbit-app/src/db/migrations/001-initial.ts:61), so resolving category presentation at read time is the correct extension.
- Separate layout and background axes directly support independent fallthrough and prevent a layout choice from overwriting a background override.
- Public-wrapper/core composition matches the non-reentrant mutex rule at [transaction.ts](/home/bwales/projects/orbit-app/src/db/transaction.ts:19).
- The backup boundary is correctly recognized. The current allowlist already distinguishes “accepted by validation” from “actually emitted,” as explained for theme/dashboard/Orrery settings at [backup-schema.ts](/home/bwales/projects/orbit-app/src/backup/backup-schema.ts:156).
- Keeping format-4 emission unchanged is testable against the pinned exact key list in [export-manifest.test.ts](/home/bwales/projects/orbit-app/src/backup/export-manifest.test.ts:14).
- Resetting only presentation state is materially safer than routing through the broad contact writer, which changes semantic contact fields at [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:380).

## Concerns

- **MEDIUM — Restore-accepted global UIDs will reference entities format 4 cannot carry.** Adding global template UIDs to `PORTABLE_SETTINGS_KEYS` permits imported settings containing those values, while the corresponding templates remain absent. Resolver fallthrough prevents crashes, but restore will silently discard the intended presentation until Phase 36.
- **MEDIUM — Invalid-reference behavior is split between database cleanup and resolver fallback.** SQLite cannot enforce references embedded in JSON, and app-settings references added with `ALTER TABLE` may also lack FK enforcement. The plan mentions both transactional cleanup and read fallback, but does not define which corruption states are observable versus silently normalized.
- **LOW — Case-insensitive uniqueness needs an explicit schema mechanism.** “Case-insensitive uniqueness” is not guaranteed by a normal SQLite `UNIQUE` column. The migration must use `COLLATE NOCASE`, a normalized-name column, or a unique index over a defined expression.

## Suggestions

- Add a test proving that format-4 import accepts a missing global UID, resolves through category/factory safely, and does not rewrite the stored UID.
- Specify an explicit `missingReference` diagnostic in the resolver output so management UI can explain a broken assignment.
- State the exact case-insensitive uniqueness mechanism in Plan 01’s schema approval.
- Test each axis independently during deletion: deleting a layout must not clear background state and vice versa.

## Risk assessment

**MEDIUM.** The model is strong, but backup-era dangling references and normalization behavior need explicit contracts.

---

# Plan 31-03 — Metrics and relationship actions

## Summary

The metric half is strong and directly respects ADR-062. The write half contains a high-severity contradiction with the current immutable event contract: the plan demands same-state retry idempotency, while the existing snooze DAO intentionally records every unsnooze invocation, even when the contact was already unsnoozed.

## Strengths

- Existing intensity already returns a tagged unavailable result before cadence arithmetic at [impact.ts](/home/bwales/projects/orbit-app/src/services/impact.ts:134), so wrapping it in a Profile-specific view model is safe.
- The impact reader obtains contact policy and interaction history in one joined statement, avoiding mixed inputs at [impact-read.ts](/home/bwales/projects/orbit-app/src/db/impact-read.ts:42).
- Gravity and intensity remain derived rather than stored, consistent with the existing contract at [impact-read.ts](/home/bwales/projects/orbit-app/src/db/impact-read.ts:7).
- Frequency validation already rejects null, non-integer, and non-positive values in [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:360).
- Custom snooze requires no schema because `snooze_until` already stores a local date and the existing core accepts a resolved date at [snooze-dao.ts](/home/bwales/projects/orbit-app/src/db/snooze-dao.ts:63).

## Concerns

- **HIGH — Retry idempotency contradicts the existing audit-trail contract.** Plan 03 says same-state retries must not duplicate immutable events. The live DAO says `clearSnoozeCore` must **always** insert an unsnooze event, with an unconditional insert even when already unsnoozed, because the event log is the audit trail ([snooze-dao.ts](/home/bwales/projects/orbit-app/src/db/snooze-dao.ts:136)). Suppressing a repeated operation in a new wrapper would reverse that behavior. This is an owner escalation unless idempotency is achieved using the same caller-minted event UID for the same logical request.
- **MEDIUM — “Frequency side effects” are underspecified.** The existing `setContactFrequencyCore` only updates `interval_days` and `modified_at` ([contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:369)). The plan references lifecycle and notification side effects without identifying the exact existing cores or expected state transitions.
- **LOW — Month-boundary semantics require timezone-change coverage.** Local calendar-month windows should be tested across DST, year rollover, and a timezone change between persisted interaction time and viewing time.

## Suggestions

- Replace “same-state retries do not duplicate immutable events” with one of two explicit contracts:

  - reuse a stable operation UID so replay of the same logical request conflicts harmlessly; or
  - preserve the existing unconditional-event behavior and prevent UI double submission only while pending.

- Do not add a value-state predicate that suppresses `unsnooze` without owner approval.
- Name the lifecycle/notification cores the frequency wrapper must compose, or narrow the acceptance criteria to the actual established side effects.
- Add month tests for December→January, leap February, DST boundaries, and local-date parsing.

## Risk assessment

**HIGH.** The proposed idempotency behavior can silently reverse a load-bearing immutable event decision.

---

# Plan 31-04 — Coherent Profile snapshot

## Summary

The semantic aggregation is well conceived, especially the narrow Off Limits reader and replaceable history projection. As currently scoped, however, it has a compile-time/API mismatch: several readers it intends to invoke with `ReadOnlyExecutor` still require a full `SqlExecutor`, and the plan does not include those files for signature changes.

## Strengths

- `inReadSnapshot` is the correct consistency primitive; it provides a deliberately narrowed executor inside one mutex-held transaction at [transaction.ts](/home/bwales/projects/orbit-app/src/db/transaction.ts:74).
- The narrow Off Limits query is the right way to expose owner-facing caution data without weakening ranked/search/AI exclusions. Those exclusions are centralized at [fuel-read.ts](/home/bwales/projects/orbit-app/src/db/fuel-read.ts:133).
- Keeping semantic sources separate respects the real schemas: Memories carry explicit `allow_ai` at [memories-read.ts](/home/bwales/projects/orbit-app/src/db/memories-read.ts:25), while fuel does not at [fuel-read.ts](/home/bwales/projects/orbit-app/src/db/fuel-read.ts:31).
- The custom-field history reader already provides the exact contact/definition key and deterministic newest-first order at [value-history-dao.ts](/home/bwales/projects/orbit-app/src/db/value-history-dao.ts:54).
- Capping interim history at three is a good guard against accidentally implementing Phase 32.

## Concerns

- **HIGH — The shared read-only executor cannot be passed to several current readers.** `ReadOnlyExecutor` exposes only `getFirstAsync` and `getAllAsync` ([transaction.ts](/home/bwales/projects/orbit-app/src/db/transaction.ts:42)), but the existing readers are typed against full `SqlExecutor`, including:

  - `getImpactInputs` at [impact-read.ts](/home/bwales/projects/orbit-app/src/db/impact-read.ts:52)
  - `listContactMethodGroups` at [contact-methods-read.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-read.ts:22)
  - Memory readers at [memories-read.ts](/home/bwales/projects/orbit-app/src/db/memories-read.ts:56)
  - `listValueHistory` at [value-history-dao.ts](/home/bwales/projects/orbit-app/src/db/value-history-dao.ts:55)

  Plan 04 says to pass the same `ro` to every reader but does not list these implementation files for signature widening.
- **MEDIUM — “Independent section errors” conflict with a single all-or-nothing snapshot unless explicitly caught.** Any child error escaping the callback causes the entire snapshot transaction to roll back and rethrow at [transaction.ts](/home/bwales/projects/orbit-app/src/db/transaction.ts:84). Section-local result types therefore require deliberate per-reader catches inside the callback.
- **MEDIUM — The current impact read is unbounded.** It loads every interaction for the contact at [impact-read.ts](/home/bwales/projects/orbit-app/src/db/impact-read.ts:64). Acceptable for tens of contacts, but Profile latency will grow with relationship age; the plan has no performance fixture for a long-lived contact.

## Suggestions

- Add all affected read modules and their tests to Plan 04, changing read-only functions to accept `ReadOnlyExecutor`.
- Define which errors are recoverable section-local errors and which abort the entire snapshot—missing schema/table errors should not be silently converted into empty content.
- Add an integration test that passes the actual callback `ro` without casts.
- Add a realistic large-history benchmark or at least a test fixture with thousands of interactions to establish acceptable Profile-load behavior.

## Risk assessment

**HIGH.** The plan’s central composition mechanism is not type-compatible with the existing reader interfaces.

---

# Plan 31-05 — Hero, Overview, and module host

## Summary

This plan provides a strong component spine and good interaction-state modeling. Its principal risk is verification: most release-critical behavior is native UI behavior, but the automated plan mainly tests pure models and relies on source inspection until the final device gate.

## Strengths

- The Hero action model can use the existing deterministic actionable-primary selection, including fallback from malformed primary rows, at [contact-methods-read.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-read.ts:10).
- The current Profile already derives reach routes from loaded method groups without a second query at [ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:308), giving the extraction a proven seam.
- The deterministic packer keeps persisted documents free of device-specific x/y positions.
- Textual state alongside Gravity/Intensity visuals directly addresses the accessibility requirement.
- The stable renderer identity for Interaction History is a clean Phase 32 handoff.

## Concerns

- **MEDIUM — Native interaction semantics are weakly automated.** Disabled actions, sheet focus containment, pending isolation, accessibility labels, and large-font reflow cannot be established by the listed Node-pure tests.
- **MEDIUM — Call and Message behavior needs separate capability projections.** The current `hasReachRoute` merges call, text, and email into one boolean at [ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:310). The new Hero must not accidentally enable Call because only email exists, or Message because only a non-message-capable route exists.
- **LOW — “No avoidable holes” needs a formal invariant.** Mixed Compact/Wide packing can have multiple equally valid layouts. Without an exact rule, tests may encode unstable aesthetic expectations.

## Suggestions

- Define separate `HeroActionState` values for Call and Message, each with its own reason and route.
- Add render-free component contract helpers for accessibility props and action-state derivation.
- Specify the exact packing algorithm and the definition of “avoidable hole.”
- Schedule an early device smoke after Plan 05 rather than waiting until Plan 10 for the first integrated Hero/Overview validation.

## Risk assessment

**MEDIUM.** The architecture is good; native behavior remains largely unproven until late.

---

# Plan 31-06 — Things to Remember and Contact Methods

## Summary

The plan accurately respects the heterogeneous knowledge model and the ten current custom-field types. It is comprehensive, but much of the UI behavior is validated only indirectly, and management actions need a clearer ownership matrix to prevent Profile from bypassing existing history and soft-delete rules.

## Strengths

- The ten-member `FieldType` union is correctly enumerated in [types.ts](/home/bwales/projects/orbit-app/src/schemas/types.ts:23); a `never` guard is appropriate.
- Memory visibility is already explicitly presentation-only and fail-visible for unknown types at [memories-read.ts](/home/bwales/projects/orbit-app/src/db/memories-read.ts:95).
- AI permission remains an explicit Memory property rather than an inference, enforced by `MEMORY_AI_ELIGIBILITY` at [memories-read.ts](/home/bwales/projects/orbit-app/src/db/memories-read.ts:29).
- Off Limits separation is correct: ranked projections exclude it in SQL at [fuel-read.ts](/home/bwales/projects/orbit-app/src/db/fuel-read.ts:137), while owner-facing retrieval can remain contact-bound.
- Contact-method rows already preserve malformed data while exposing actionability at [contact-methods-read.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-read.ts:26).

## Concerns

- **MEDIUM — Action ownership is described but not enumerated.** “Delegate actions to owners” is insufficient for Edit/Pin/Hide across Memories, relationships, current-state fields, custom fields, imported notes, and legacy fuel. Each has different mutation/history semantics.
- **MEDIUM — No dedicated component behavior tests are planned.** Long press parity, View All counts, Show hidden, detail sheets, disabled method actions, and absence of permanent destructive controls are accepted largely through source inspection.
- **LOW — “Hidden filtering after pinning” is confusing.** The existing read order is pinned-first, while visibility is applied afterward at [memories-read.ts](/home/bwales/projects/orbit-app/src/db/memories-read.ts:116). The resulting presentation should explicitly filter hidden items before calculating visible caps and remaining counts.

## Suggestions

- Add a source-type/action matrix to the task: action, owning DAO/route, whether available, and refresh behavior.
- Add pure UI-state model tests for long-press/accessibility parity, hidden counts, and View All counts.
- Specify the sequence as: load → resolve visibility → derive pinned projection/dedupe → cap/count.
- Add a regression proving hidden `allow_ai=1` Memories remain AI-eligible unless the owning permission changes; Profile hiding must not change egress semantics.

## Risk assessment

**MEDIUM.** Domain boundaries are correct, but action wiring and native interaction coverage need more precision.

---

# Plan 31-07 — Layout editor

## Summary

The pure reducer and atomic draft model are excellent choices. The plan’s largest risk is modifying the shared `Sheet` primitive without directly testing existing consumers or fully specifying accessibility focus containment.

## Strengths

- Canonical dirty comparison avoids false changes from gesture transients.
- One reducer for drag and accessible move actions is the right way to guarantee parity.
- Explicit Save/Cancel aligns with the database’s transaction architecture.
- Rejecting illegal moves rather than silently repairing them preserves predictable persisted state.
- Using the existing discard guard is consistent with the project’s navigation behavior.

## Concerns

- **MEDIUM — Shared `Sheet` modification has broad regression scope.** The current primitive supports only `compact` and `detail`, with fixed maximum heights and a plain body container at [Sheet.tsx](/home/bwales/projects/orbit-app/src/components/ui/Sheet.tsx:19). Adding expansion/internal scrolling can affect every current sheet consumer, yet no existing-consumer regression test is listed.
- **MEDIUM — “Underlying Profile inert” requires more than a visual scrim.** The shell currently relies on full-screen scrims to intercept pointer input, while accessibility/back behavior has known child-screen caveats at [RootNavigator.tsx](/home/bwales/projects/orbit-app/src/navigation/RootNavigator.tsx:143). Focus containment and accessibility hiding need explicit implementation contracts.
- **LOW — Save-as-template is only an intent here.** Ensure failure or dismissal cannot accidentally persist the freeform draft before Plan 08 handles template creation.

## Suggestions

- Prefer an additive `expanded` variant with default behavior unchanged.
- Add tests for existing compact/detail sizing and dismissal behavior.
- Require `accessibilityViewIsModal`/equivalent modal semantics and explicit underlay accessibility hiding.
- Define Android Back precedence when the editor has an internal page plus dirty state.

## Risk assessment

**MEDIUM.** The editor state model is strong; the shared overlay and focus behavior are cross-application risks.

---

# Plan 31-08 — Layout template management

## Summary

The workflows cover all required assignment scopes and deletion fallout. The plan is UI-heavy but has no dedicated reducer/model test artifact, so many state transitions are only verified by DAO tests that cannot prove manager behavior.

## Strengths

- Usage-aware deletion and atomic reference cleanup are appropriate for changes affecting many Profiles.
- Explicitly distinguishing inherited and overridden values prevents misleading assignment UI.
- Saving a freeform layout as a template without silently reassigning it preserves PROF-03 semantics.
- Successful commit followed by resolver reload matches the publish-after-success posture used elsewhere.

## Concerns

- **MEDIUM — No pure state model or tests for a complex manager.** Create, rename, edit, assignment, remove, delete confirmation, retry, draft retention, and nested page navigation all live in one TSX file, while verification runs only DAO/parser/resolver tests.
- **MEDIUM — Template deletion and rename race states are unspecified.** Even locally, rapid repeated presses or stale usage counts can produce confusing results unless pending state disables the affected object and deletion rechecks references transactionally.
- **LOW — “No separate navigation screen” increases sheet complexity.** Internal pages need a defined back stack and dirty behavior, especially when editing a template inside the manager.

## Suggestions

- Add `profile-template-manager-model.ts` with render-free transition tests.
- Recompute usage inside the delete transaction rather than trusting the displayed count.
- Define pending isolation per template and disable duplicate submissions.
- Specify internal Back behavior for list → preview → edit → confirmation.

## Risk assessment

**MEDIUM.** Persistence is covered well; the manager’s substantial interaction state is not.

---

# Plan 31-09 — Background pipeline and manager

## Summary

The background design correctly avoids abusing avatar storage and is strong on safe paths and crash-safe replacement. It is incomplete at the application lifecycle level: the current photo system’s `.tmp`/`.bak` safety depends on a launch reconciliation hook, but the plan adds neither a background reconciliation registration nor `App.tsx` integration.

## Strengths

- A separate namespace and UID-derived filenames avoid collisions with the avatar contract.
- Crash-safe replacement mirrors the current established sequence: staged file, backup, canonical move, best-effort backup deletion at [photo-storage.ts](/home/bwales/projects/orbit-app/src/services/photos/photo-storage.ts:430).
- Safe-relative-path validation before deletion follows the current posture at [photo-storage.ts](/home/bwales/projects/orbit-app/src/services/photos/photo-storage.ts:446).
- Post-commit obsolete-file cleanup avoids filesystem I/O inside SQLite transactions.
- Crop geometry and gesture state remain separated from React per-frame state.

## Concerns

- **HIGH — No launch reconciliation integration for the new namespace.** Existing crash recovery is not inherent in `.tmp`/`.bak`; it depends on `reconcilePhotoWrites` scanning the avatar directory at launch ([photo-storage.ts](/home/bwales/projects/orbit-app/src/services/photos/photo-storage.ts:509)) and `App.tsx` registering that sweep ([App.tsx](/home/bwales/projects/orbit-app/App.tsx:232)). Plan 09 adds new background storage files but modifies neither `App.tsx` nor a background reconciliation sweep. Interrupted swaps may therefore leave stale temp/backup files or a missing canonical background indefinitely.
- **MEDIUM — DB/file atomicity remains asymmetric without a journal.** A derivative can be written before the DB reference commits, leaving an orphan on a DB failure or process death. “Best effort after commit” handles obsolete files but not every pre-commit orphan.
- **MEDIUM — Background deletion is not integrated with broader purge/restore lifecycle.** The current app has explicit photo purge cleanup and restore-finalization infrastructure. Plan 09 defers backup bytes to Phase 36, but it still needs local orphan and deletion recovery now.
- **LOW — “Release source/preview resources” is not directly verifiable through the proposed Node tests.** This needs physical memory observation or instrumentation.

## Suggestions

- Add a background reconciliation planner/sweep and register it in `App.tsx`, or deliberately generalize the current photo sweep to scan both allowlisted namespaces.
- Add a durable file-operation journal or an idempotent launch orphan sweep keyed against live background-template paths.
- Test interrupted states at every boundary: temp written, old renamed, new moved, DB failed, DB committed, obsolete delete failed.
- Add background templates to contact/category/template deletion and app-uninstall-independent purge reasoning.
- Include a physical-device memory smoke specifically for repeated large-image choose/cancel/save cycles.

## Risk assessment

**HIGH.** The storage pipeline claims crash recovery but omits the launch mechanism that makes the existing pattern recoverable.

---

# Plan 31-10 — Host integration, documentation, and device acceptance

## Summary

This is a strong final integration gate with unusually thorough manual acceptance criteria. It properly protects origin-aware navigation, local-only reads, Off Limits, and backup handoffs. Its weakness is that too much native validation is deferred to this final plan, making late discoveries likely and expensive.

## Strengths

- The host retains the three actual Profile route owners: Dashboard, Orrery, and Settings at [types.ts](/home/bwales/projects/orbit-app/src/navigation/types.ts:45), [types.ts](/home/bwales/projects/orbit-app/src/navigation/types.ts:125), and [types.ts](/home/bwales/projects/orbit-app/src/navigation/types.ts:164).
- Removing only the Profile AI-draft entry while preserving Compose compatibility is correct. `requestAiSuggestion` remains consumed by Compose and can remain in route types for other callers at [types.ts](/home/bwales/projects/orbit-app/src/navigation/types.ts:74).
- Focus reload is necessary because the current screen returns from Edit to the existing Profile instance rather than remounting, as documented at [ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:316).
- The backup documentation accurately distinguishes format-4 acceptance from emission; exact current output is pinned in [export-manifest.test.ts](/home/bwales/projects/orbit-app/src/backup/export-manifest.test.ts:27).
- Physical-device acceptance is appropriate for crop gestures, screen reader behavior, large text, and real performance.

## Concerns

- **MEDIUM — First full native gate comes too late.** Plans 05–09 add Hero geometry, responsive packing, multiple nested sheets, focus containment, drag/accessibility reordering, image processing, and crop gestures. Discovering a foundational Sheet or navigation problem only after all five plans land will cause broad rework.
- **MEDIUM — Device prerequisites require an earlier owner checkpoint.** Repository instructions require confirming the Orbit package and Metro session with the owner before first device use. The final task says to use confirmed values but contains no explicit pre-device confirmation checkpoint.
- **MEDIUM — The automated host assertion is partly textual.** Checking that imports or forbidden symbols are absent does not prove runtime sheet precedence, origin-aware Back, or correct reach-route behavior.
- **LOW — Documentation is bundled with a potentially volatile host rewrite.** If device UAT finds gaps, system docs may be written before behavior stabilizes and then require correction.

## Suggestions

- Add incremental physical smoke gates after Plans 05, 07, and 09:

  - Hero/Overview/reflow;
  - editor focus, Back, and accessible reorder;
  - crop/storage/relaunch and memory smoke.

- Add a blocking prerequisite to confirm package name, Metro session, and exactly one authorized physical target.
- Add navigation integration tests for each stack origin and topmost-sheet Back precedence.
- Write final system docs after gap closure or explicitly require a post-UAT doc reconciliation pass.
- Verify that removing the Profile AI entry does not remove `requestAiSuggestion` from Compose route contracts while it still has consumers.

## Risk assessment

**MEDIUM.** The final gate is comprehensive, but the phase waits too long to test its riskiest native seams.

---

# Consolidated required revisions

Before approving execution, I recommend these plan changes:

1. **Plan 03:** Resolve the snooze/unsnooze idempotency conflict without suppressing the established unconditional immutable event. If behavior must change, escalate it to the owner.
2. **Plan 04:** Add every affected read module to `files_modified` and widen read-only reader signatures to `ReadOnlyExecutor`, with a real no-cast integration test.
3. **Plan 09:** Add background launch reconciliation and application registration, covering interrupted replacement and orphan states.
4. **Plans 05–09:** Add earlier physical-device smoke checkpoints instead of concentrating all native validation in Plan 10.
5. **Plans 08–09:** Introduce pure manager state models and tests for their complex internal sheet workflows.
6. **Plan 01:** Define the minimum persisted document/ID vocabulary before approving irreversible schema.

# Final risk assessment

**Overall: HIGH pending revision.**

The product and architecture coverage is excellent, and no plan introduces a network Profile read path or widens AI egress. The rating is driven by three concrete execution/correctness blockers—not by general scope anxiety:

- a proposed write contract conflicts with the live immutable event behavior;
- the central snapshot composition is not compatible with current reader types;
- the new background storage namespace lacks the recovery hook required by the pattern it claims to reuse.

Once those are incorporated, the phase becomes **MEDIUM risk**: large and native-interaction-heavy, but sensibly decomposed with strong persistence, privacy, and decision safeguards.

---

## Claude Review

# Cross-AI Plan Review — Phase 31: Profile Experience

## Summary

This is a well-decomposed, dossier-faithful ten-wave plan set that correctly sequences contracts → schema/DAOs → metrics → aggregate reads → renderers → focused editors → backgrounds → integration, and it visibly internalizes every locked decision (D-01…D-12, ADR-062/078/079/081) with explicit per-plan guards. The plans are unusually careful about atomicity, precedence resolution, and the Off Limits no-sparkle/no-inference boundary. The most serious risks are not in architecture but in verification integrity: several tasks claim `tdd="true"` red-before-green ordering that the actual file/task sequencing cannot deliver, migration numbering is asserted (024) without an on-disk head+1 recheck baked into an automated gate, and Plan 01's tracer wires a production collapse-write path whose target row (`profile_contact_presentation`) doesn't exist until Plan 02 defines the full schema — meaning Plan 01's migration 024 must anticipate Plan 02's shape or Plan 01 is under-scoped for what it claims to deliver end-to-end.

## Strengths

- **Correct separation of definitions/assignments/overrides** (31-02 Task 1/3): matches dossier §AO's explicit call for separate template/assignment/override storage so template edits propagate while freeform snapshots don't (`docs/dossier/...phase-10...md:161-175`). The plan's `profile_layout_templates` / `profile_category_presentation` / `profile_contact_presentation` split is architecturally sound and traceable to D-07.
- **ADR-062 guard discipline**: D-05/D-06 are enforced with a single shared `resolveProfileIntensityWindow` helper (31-03 Task 1) explicitly reused by Phase 32, avoiding the "two different Unbound fallbacks" trip-wire called out in planning-notes.md R-15. Verified against live code: `src/services/impact.ts` returns `{available:false}` and `interval_days` is nullable per `011-contact-lifecycle-schema.ts` — the plan's guard requirement is grounded in a real, not hypothetical, hazard.
- **Off Limits boundary respected end-to-end**: 31-06 Task 1 and 31-COVERAGE.md both correctly cite that `FuelItem`/`fuel-read.ts` has no `allow_ai` column and commit to omitting the sparkle without adding schema — consistent with D-12's 2026-09-09 owner ruling and ADR-078/081's exclusion boundary. The plan explicitly forbids editing `RANKED_FUEL_EXCLUSIONS`, which is the right regression guard.
- **AI-draft removal is treated as a real deletion task, not an assumption**: 31-10 Task 1 explicitly requires removing the AI-draft block at the known line reference and confirms ADR-079 supersedes ADR-052, matching D-04.
- **Backup/wire-format boundary honored**: every plan touching `app_settings`/backup explicitly restricts itself to the portable-settings allowlist and defers entity emission to Phase 36, consistent with D-03's "v4 is spent" ruling — this is repeated consistently rather than drifting plan-to-plan.
- **Transaction discipline is explicit and testable**: repeated call-outs ("one outer `inWriteTransaction`", "never nest") map onto the real `src/db/transaction.ts` contract (`ReadOnlyExecutor`, mutex, single BEGIN/COMMIT) rather than an invented pattern.

## Concerns

- **HIGH — Migration number is hardcoded to 024 in nine plan files but only checked by one brittle regex gate.** Plan 01 Task 1's `<verify>` is `test "$(rg -n 'TARGET_VERSION = 23' src/db/database.ts | wc -l)" -eq 1`, which only confirms the *current* value is 23 at plan-authoring time — it does not re-verify at *execution* time, and every other plan (02 through 10) hardcodes `024-profile-presentation.ts` and `migration024`/`TARGET_VERSION 24` as file paths and identifiers baked into `files_modified` frontmatter. If any other phase lands a migration between now and Plan 01's execution (a real risk across a 10-wave, multi-session phase touching a shared `src/db/migrations/` head), Plan 01 is the only place that would notice, and Plans 02-10 already carry the stale number in their `files_modified` lists and prose — this is a distributed hardcoded assumption, not a single verified fact, which is exactly the D-03 trip-wire the CONTEXT.md warns about ("Never assume a migration number... numbers drift every schema phase"). The dossier's own research notes independently re-derived 024 by reading `src/db/database.ts:25-58` at research time, confirming this is a real moving target, not paranoia.
- **HIGH — Plan 01's "clickable tracer" claims a durable collapse write, but the full presentation schema (templates, assignments, contact overrides) is not designed until Plan 02.** Plan 01 Task 3 must implement migration 024 with "the complete approved schema" per its own behavior spec ("Fresh 001→024 and 023→024 create the complete approved schema") — yet Task 1's checkpoint decision is about approving "the four-entity shape" and Plan 02's objective is to *design* `profile-presentation-schema.ts`, `resolve-presentation.ts`, and the full DAO surface. This means Plan 01 either (a) has to fully design and freeze the migration-024 table shape in Task 1's checkpoint before Plan 02 exists to define the closed parser/registry that shape must serialize, or (b) Plan 01 ships a schema that Plan 02 must not alter (since migrations are forward-only/immutable per AGENTS.md), locking in column shapes before the parser/resolver contracts that should drive them. This is a real ordering hazard: schema-first-then-contracts risks a mismatch that can only be fixed with a *new* migration, which is expensive. The dossier's own architecture note (§AO) says "Templates should reference semantic module IDs" — but the module ID registry (`PROFILE_MODULE_REGISTRY`) isn't built until Plan 02 Task 1, after Plan 01 Task 1's schema is already locked by owner approval. Recommend: swap the order so closed module IDs/parser exist (or at minimum are drafted) before the one-way migration checkpoint, or explicitly scope Plan 01's migration to a subset (e.g., only the collapse-override table) and defer template/assignment tables to Plan 02's migration — but Plan 02 has no migration file in its `files_modified`, meaning all schema must land in migration 024 in Plan 01. This should be flagged to the owner as a sequencing risk before Plan 01's blocking checkpoint is approved.
- **MEDIUM — TDD ordering claims are asserted in frontmatter (`tdd="true"`) but not always achievable given task boundaries.** E.g., 31-04 Task 3 says tests must "extend the precise 31-04-T1/T2 read tests red before composition" but Task 3's own `<files_modified>` only lists `src/db/profile-read.ts` (no test file) — there's no test file for `profile-read.ts` at all in this plan (`src/db/profile-read.ts` has no companion `.test.ts` in `files_modified`), so the "TDD" claim for Task 3 has no artifact to be red against. 31-VALIDATION.md's own per-task map (`31-04-T3`) also lists no dedicated test file, just re-running upstream tests — this is "integration by reuse," not TDD for the new snapshot composition logic itself. This should be called out as a coverage gap, not a blocking one, but the `tdd="true"` characterization is inaccurate for this specific task.
- **MEDIUM — Plan 05's scope-sanity justification bundles three large surfaces (packing, relationship sheets, host) into one wave citing shared test-file convergence, but the estimate (68,000 tokens, 3 tasks) is the largest in the whole plan set and covers PROF-01/08/09/10/11/12/18/19/20 — nine requirements in one wave.** This is a legitimate call per the stated size-vs-restructure tradeoff, but it concentrates risk: if Task 2 (Hero + Overview tiles + concrete `ProfileRelationshipSheets` with Frequency/Snooze/custom-date logic) fails integration, the whole wave blocks Waves 6-10. Given this is the single highest-estimate, highest-requirement-density plan, consider whether Task 2 alone (relationship sheets with real writers) could be its own plan boundary — it has its own `relationship-sheet-model.test.ts` and consumes Plan 03's writers directly, so it's more separable than the scope-sanity note claims.
- **MEDIUM — Category-deletion fallout (D-10 trip-wire) is planned but the actual FK/cascade mechanism is only described in prose ("Category delete cascades assignment row"), never verified against Phase 37's ownership boundary or an actual `categories` table schema.** Since Phase 37 owns Category CRUD and hasn't executed yet, Plan 02 Task 3's cascade behavior can only be exercised against a *hypothetical* deletion path (there's no live Category-delete DAO to integration-test against yet, per `src/db/systems-dao.ts`/whatever the current Category delete implementation is — this wasn't verified from source in this review since the file wasn't in the provided plan bundle). This is flagged as an open verification item: confirm whether a live Category-delete code path exists today that Plan 02's tests can genuinely exercise, or whether this is being tested against a mock/synthetic delete only.
- **LOW — Plan 09's crash-safety claims for background storage rely on `photo-storage.ts`'s tmp/bak pattern by analogy, but the plan doesn't require verifying that pattern's actual behavior under concurrent Profile background writes (e.g., two rapid template switches).** The existing photo pipeline is single-target (one avatar per contact); backgrounds are now shared across multiple contacts via templates, so a template's image file could be referenced by many `profile_contact_presentation`/`profile_category_presentation` rows simultaneously — the "delete only after DB commit, best-effort cleanup" pattern is correct for the single-owner avatar case but the plan should more explicitly test the multi-referrer case (deleting a template's file while another entity still references its UID) doesn't get short-circuited by a naive single-referrer assumption ported from the avatar pipeline.
- **LOW — COVERAGE.md's "50 = 43 + 7" flagged-assumption count is self-consistent but PROF-05's flagged assumption ("Category change includes change to no Category") is a genuine product ambiguity that touches D-05/inheritance correctness, not just an edge-probe nuance — it probably deserves an explicit owner confirmation rather than being silently carried as a flagged assumption, since getting it wrong breaks the inheritance fallback contract that PROF-05 is graded against.**

## Suggestions

- Before executing Plan 01 Task 1 (the one-way migration checkpoint), re-run `rg -n 'TARGET_VERSION' src/db/database.ts` and `ls src/db/migrations/` fresh at execution time — do not trust the number baked into this review or the plan frontmatter, since drift is explicitly called out as the norm in D-03.
- Resolve the Plan 01/Plan 02 schema-vs-contract ordering conflict explicitly before starting Plan 01 Task 3: either (a) draft the closed module registry/parser first as a zero-migration precursor task, or (b) scope migration 024 in Plan 01 to only the pieces Plan 01's tracer actually needs (collapse override on a minimal table), and have Plan 02 add a second migration for templates/assignments — but confirm this against D-03's "one migration" planning-notes guidance (`phase-10...planning-notes.md:75-77` says "Implies one migration"), which conflicts with splitting across 01 and 02. This is worth a direct owner check since two authoritative sources (dossier planning notes vs. this plan's wave split) are in tension.
- For 31-04 Task 3, either add a dedicated `profile-read.test.ts` or downgrade the `tdd="true"` claim to reflect that it's integration-composition over already-tested readers, not new TDD surface.
- Flag PROF-05's "Category change to *no* Category" case for explicit owner confirmation rather than carrying it as a silent flagged assumption, since it's load-bearing for inheritance correctness.

## Risk Assessment: **MEDIUM**

The domain modeling, requirement traceability, and decision compliance (D-01–D-12, ADR-062/078/079/081) are excellent and clearly grounded in verified source facts. The risk is concentrated in two execution-integrity issues: (1) migration-number hardcoding distributed across nine files with only one re-verification gate, and (2) a plausible schema/contract sequencing conflict between Plan 01's one-way migration checkpoint and Plan 02's closed-registry/parser design that should be resolved — ideally with the owner — before Plan 01's blocking Task 1 is approved.

---

## Consensus Summary

Both reviewers found the phase unusually strong on decision fidelity, local-first/privacy boundaries, transaction discipline, Unbound cadence guards, Off Limits handling, and separation of presentation definitions, assignments, overrides, and independent layout/background resolution. Neither found a proposal to widen AI egress or add a network Profile read path.

The plan set is not ready to execute unchanged. Five unique unresolved HIGH concerns remain: the Plan 01 schema/semantic-contract ordering hazard (raised by both reviewers), distributed hardcoding of migration 024 without an execution-time head+1 gate, Plan 03 retry language conflicting with the established unconditional snooze/unsnooze event contract, Plan 04 reader signatures being incompatible with the proposed ReadOnlyExecutor composition, and Plan 09 lacking launch reconciliation for the new recoverable background namespace. The snooze item is an owner escalation if the revision would suppress the recorded audit event; a safe stable-operation-UID approach may preserve the decision.

There are also 33 unique actionable MEDIUM/LOW findings. These mainly require sharper contracts and tests for restore-era dangling template UIDs, invalid references, case-insensitive uniqueness, section-local snapshot errors, long-history performance, action capability separation, knowledge-action ownership, sheet focus/inert behavior, manager state/races, background file lifecycle, earlier native smoke coverage, and genuine TDD/integration coverage. None is currently incorporated or explicitly deferred/rejected in the plans.

### Agreed Strengths

- Strong fidelity to D-01…D-12 and ADR-062/078/079/081, including no Profile AI-draft action and no inferred Off Limits AI permission.
- Correct local-first architecture, non-reentrant transaction boundaries, and no widened Profile network/AI egress.
- Sound separation of presentation definitions, category/contact assignments, freeform overrides, collapse state, and independent layout/background inheritance.
- Correct recognition that Unbound contacts require a single shared cadence fallback contract.
- Careful backup-format-v4 boundary: portable setting keys only, with entity/file emission deferred to Phase 36.

### Agreed Concerns

- The irreversible schema is sequenced before the closed semantic module-ID/parser/persisted-document contract that gives its JSON columns meaning.
- Native interaction, sheet, accessibility, and crop behavior is validated too late and too weakly before the final physical-device gate.
- Complex presentation managers and background lifecycle paths need stronger state/recovery tests than the current plan set specifies.

### Divergent Views

- Codex rated the overall plan HIGH pending three concrete correctness fixes; Claude rated it MEDIUM while separately identifying two HIGH execution-integrity issues. The difference is severity aggregation, not disagreement that revisions are required.
- Only Codex identified the immutable snooze-event conflict, ReadOnlyExecutor signature mismatch, and missing background launch reconciliation through direct source tracing.
- Only Claude classified migration-number drift as HIGH and called for explicit owner confirmation on the no-Category inheritance assumption.
