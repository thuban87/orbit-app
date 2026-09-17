# Dossier --- Category Management

**Status:** ready for planning · Interrogated through 2026-09-15 · Phase
37.1 product contract settled against the current Milestone 2 roadmap
and repository snapshot.

## Decision Legend

-   **\[DECIDED\]** explicitly chosen by the owner.
-   **\[DERIVED\]** implementation/architecture consequence.
-   **\[DEFERRED\]** intentionally postponed.
-   **\[PLANNING NOTE\]** repository finding to verify at execution
    time.

## Scope

Phase 37.1 turns Orbit's seeded, effectively read-only `categories`
catalog into a fully user-managed organizational taxonomy while
preserving the existing one-category-per-contact model and
category-dependent behavior.

It owns centralized Category CRUD, user ordering, safe rename/delete
semantics, dependent-state cleanup, a durable-identity audit, scalable
category selectors, a limited Orrery System-picker grouping cleanup, and
backup/restore compatibility.

It does **not** add tags, multi-category contacts, category
icons/colors/descriptions, inline CRUD throughout Orbit, or a broad
Orrery picker redesign.

# A. Product Model

**\[DECIDED\]** Categories are open-ended user organizational groupings.
Names such as Family, Friends, Work, and Community have no protected
semantic meaning.

**\[DECIDED\]** Contacts remain single-category assignment: one
`category_id` or `NULL`.

**\[DEFERRED\]** Tags/multi-category membership are a future concept.

**\[DECIDED\]** `NULL` remains the permanent **Uncategorized** state. It
is not a `categories` row and cannot be renamed, reordered, or deleted.

**\[DECIDED\]** Zero real categories is valid.

# B. Seed & Upgrade Semantics

**\[DECIDED\]** Family, Friends, Work, and Community are ordinary
user-owned rows after initial creation and may be renamed, reordered, or
deleted.

**\[DECIDED\]** Seeds are creation-time defaults, not reconciliation
targets. Fresh databases receive them once; existing databases retain
exactly their current taxonomy.

**\[DERIVED\]** No migration may resurrect a deleted/renamed seed. An
upgraded database with zero categories stays at zero.

# C. Canonical Management Surface

**\[DECIDED\]** CRUD lives at:

`Settings → Contacts & Relationships → Relationship Structure → Categories`

using Phase 37's reserved `CategoryManagement` route.

**\[DECIDED\]** Other surfaces remain consumers/selectors only; no
inline Add/Rename/Delete is added to Add Contact, Edit Contact, imports,
Orrery, etc.

**\[DECIDED\]** The manager uses Phase 37's straightforward Settings
visual language: ordered rows, drag handles, Rename/Delete affordance,
`+ Add Category`, and a separated informational Uncategorized fallback.

# D. Create & Rename

**\[DECIDED\]** Create/Rename are lightweight single-field dialog/sheet
flows, not dedicated edit screens.

**\[DECIDED\]** New categories append to the end of user-defined order,
before Uncategorized wherever Uncategorized is rendered.

**\[DECIDED\]** Names are trimmed, must contain non-whitespace content,
allow Unicode, use a reasonable Orbit-consistent length bound, and
cannot duplicate another category case-insensitively.

**\[DECIDED\]** Renaming the same category with different capitalization
is valid; duplicate checking excludes the edited row.

# E. Stable Identity Contract

**\[DECIDED\]** Display names must not be durable relational identity.

**\[DECIDED\]** 37.1 includes a repository-wide **category identity
audit**.

**\[DERIVED\]** Durable relationships use stable category identity
appropriate to the layer (local row ID and/or stable UID), never display
name.

A rename must preserve contact assignment, category-System identity,
custom-System rules, profile category presentation, backup identity, and
any other durable category-linked state.

**\[DERIVED\]** Name usage remains legitimate for display, search,
labels, import matching, and other intentionally textual operations. Do
not mechanically remove every `category.name` query.

**\[PLANNING NOTE\]** The current tree already uses category UID in
Orrery/backup paths, but System DAO code also contains name lookups.
Planning must classify name usage as legitimate matching vs improper
durable identity.

# F. Ordering

**\[DECIDED\]** Existing `display_order` becomes canonical user-defined
order everywhere categories are presented unless a surface has an
explicit product reason otherwise.

**\[DECIDED\]** Drag-to-reorder is supported. New rows append. Reorder
and deletion normalize positions to a contiguous sequence.

**\[DECIDED\]** Uncategorized is outside `display_order` and remains
pinned last where applicable.

**\[DERIVED\]** Do not silently alphabetize categories against the
user's chosen order.

# G. Delete UX & Reassignment

**\[DECIDED\]** Unused-category deletion still confirms, but may use a
lightweight message.

**\[DECIDED\]** Used-category confirmation summarizes fallout with
counts rather than enumerating records, including affected contacts and
custom Systems/rules where applicable.

**\[DECIDED\]** Contacts assigned to the deleted category are reassigned
during deletion to either: - **Uncategorized** (default), or - another
existing category.

**\[DECIDED\]** The target is transaction-specific; Orbit does not
remember a deletion target or create persistent category-merge behavior.

# H. Atomic Delete Contract

**\[DECIDED\]** Category deletion, contact reassignment, custom-System
rule cleanup, category-profile presentation cleanup, order
normalization, and other directly dependent writes discovered by the
audit must commit **atomically** or all roll back.

**\[DERIVED\]** Partial deletion states are unacceptable.

**\[PLANNING NOTE\]** The roadmap's current "destructive forward-only
SQLite migration" wording must be interpreted carefully. Any schema
migration is forward-only per repository discipline, but a user's later
deletion of "Dog Park" is a runtime application transaction, not a
migration.

# I. Custom-System Fallout

**\[DECIDED\]** Deleting a category removes only the affected category
rule/reference from a custom System. It does not delete the System or
alter unrelated rules.

Example: `Category = Dog Park AND Gravity = Inner` becomes
`Gravity = Inner`.

**\[DECIDED\]** If the remaining System is valid, it continues normally.
If removal leaves no meaningful/valid membership definition (for
example, the deleted category was its only rule), preserve the System
and surface **Needs Attention**.

**\[DERIVED\]** Use the canonical System validity/broken-rule model
rather than inventing a Category-specific definition.

# J. Orrery Category Systems

**\[DECIDED\]** Category Systems continue to derive from stable category
identity. Rename changes the visible label while preserving identity.

**\[DERIVED\]** Deleting a category removes its derived category System
from the catalog. Existing missing-System fallback behavior should be
reused for any stale session selection.

# K. Orrery System Selector --- Limited Cleanup

**\[DECIDED\]** 37.1 groups the current flat selector into three
independently collapsible sections:

1.  **Built-in**
2.  **Categories**
3.  **Custom Systems**

**\[DECIDED\]** Preserve existing selection semantics and ordering
within each class, while Categories honor canonical `display_order`.

**\[DECIDED\]** Empty Categories/Custom Systems sections remain visible
with simple empty states and no creation affordances.

**\[DECIDED\]** The section containing the selected System opens by
default. Expansion state need not become persisted preference state.

**\[DEFERRED\]** Search placement, favorites/recents, built-in cleanup,
richer selector IA, and the broader Orrery picker redesign.

**\[DECIDED\]** Do not add temporary top-level search or inaccessible
hard truncation in 37.1.

# L. Large Category Catalogs

**\[DECIDED\]** Orbit imposes no arbitrary maximum category count.

**\[DECIDED\]** Ordinary category selectors follow progressive
behavior: - small catalog → normal complete list; - large catalog →
complete list plus search/filter; - canonical order retained; -
Uncategorized pinned last.

No category may become inaccessible because it falls below a cutoff.

**\[DERIVED\]** The threshold for adding search is an
implementation/UI-tuning constant, not a user setting.

**\[DERIVED\]** Category-consuming surfaces should share consistent
search/order/Uncategorized behavior and shared helpers/components where
practical.

# M. System Builder Category Rule

**\[DECIDED\]** System Builder always exposes the complete category set.
Small catalogs keep the straightforward checkbox/multi-select list;
larger catalogs add search/filter above that full list.

**\[DECIDED\]** Search filters visible rows only. Hidden matches remain
selected.

**\[DERIVED\]** Preserve awareness of existing selections while
filtering (for example, a selected count) without expanding into a new
chip/modal management system.

# N. Profile Category Presentation

**\[DECIDED\]** Rename preserves category-specific layout/background
assignments through stable identity.

**\[DECIDED\]** Delete removes the deleted category's presentation
assignment.

**\[DECIDED\]** Presentation configuration is not transferred to the
contact reassignment target. Contacts moved from Dog Park to Friends
thereafter use Friends' presentation behavior.

**\[PLANNING NOTE\]** Current `profile_category_presentation` is keyed
locally by category ID and serialized by category UID; preserve that
identity model.

# O. Backup & Restore

**\[DECIDED\]** Backup represents the user's actual taxonomy, not
factory defaults. Full restore reproduces the backed-up category
set/order rather than merging missing seeds back in.

**\[PLANNING NOTE\]** Current backup v5 already serializes category
UID/name/display order/timestamps, contact `categoryUid`, and profile
category presentation by category UID.

**\[DECIDED\]** Do not bump backup format merely because Category
Management exists. A bump is allowed only if implementation discovers
genuinely unrepresentable persisted semantics.

# P. Consumer Audit

**\[DERIVED\]** Planning/implementation must inventory every category
path in the execution-time repository, not only the consumers named in
the roadmap.

The current snapshot shows category participation in at least
Create/Edit Contact, Dashboard/filtering, bulk import setup, import
review, bulk actions, merge/reconciliation, profile reads, Profile
Template/Background managers, Orrery category Systems, Systems
Management, System Builder, AI/knowledge/search context, and backup
export/restore.

For each consumer classify: 1. identity representation (ID / UID /
name); 2. rename behavior; 3. delete behavior; 4. ordering expectations;
5. large-catalog UI behavior if user-facing; 6. backup implications if
persisted.

# Q. Data-Layer Guardrails

**\[DERIVED\]** Prefer the smallest SQLite/data-layer change that safely
enables runtime CRUD on the repository's pinned Expo 57 / React Native
0.86 stack.

**\[DERIVED\]** Do not redesign Categories into tags/join tables or add
icon/color metadata.

**\[DERIVED\]** Runtime CRUD should sit behind canonical DAO/service
operations rather than screen-local SQL so validation and atomic
deletion have one source of truth.

**\[DERIVED\]** Transaction rollback behavior needs explicit automated
coverage.

**\[PLANNING NOTE\]** Verify exact `expo-sqlite` transaction patterns
already used in the execution-time tree rather than importing
assumptions from a different library/version.

# R. Accessibility & Interaction Quality

**\[DERIVED\]** Inherit Phase 37's Settings accessibility baseline:
labeled actions, adequate touch targets, readable Standard/Galaxy
presentation, clear validation/error states, and accessible semantics
for collapsible sections.

**\[DERIVED\]** Reordering must not be usable only through an unlabeled
drag gesture; use the best accessible behavior supported by the current
component/tooling conventions.

**\[DERIVED\]** Large-catalog search must not obscure already-selected
System Builder categories or make Uncategorized unreachable.

# S. Explicit Deferrals

**\[DEFERRED\]** Tags / multi-category contacts.

**\[DEFERRED\]** Category icons, colors, descriptions, or
category-specific feature settings.

**\[DEFERRED\]** Inline Category CRUD from contact forms or other
consumers.

**\[DEFERRED\]** Broad Orrery System selector redesign, including search
placement, recents/favorites, built-in cleanup, and other navigation
concepts.

**\[DEFERRED\]** Any arbitrary product maximum on category count.

# T. GSD / Planning Guardrails

**\[DERIVED\]** Do not decompose 37.1 into one plan per screen. The core
problem is safe category mutability; plans should be sliced around
coherent data contracts and integration waves.

A sensible planning shape is likely: - category mutation/data contract
and identity audit; - Settings manager + ordering; - dependent
cleanup/System validity/profile presentation; - scalable consumer
integration + Orrery selector grouping; -
backup/regression/physical-device verification.

This is guidance, not a mandated plan count.

**\[DERIVED\]** Reuse existing category reads, System validity
machinery, Settings IA, profile-presentation DAO, and backup UID model
rather than forking Phase-37.1-specific copies.

**\[DERIVED\]** Keep the phase narrow even though the audit is broad.
Fix category-mutability correctness; do not opportunistically redesign
every consumer encountered.

# U. Planning-Time Verification Checklist

Before GSD decomposes Phase 37.1 against the execution-time repository:

1.  Inventory the `categories` schema, indexes/constraints, seed
    behavior, and all current writers/readers.
2.  Determine whether schema change is actually necessary; separate
    schema migration work from runtime deletion.
3.  Audit every durable category relationship for ID/UID vs display-name
    identity.
4.  Confirm all foreign-key/dependent behavior for contacts, System
    rules, profile presentation, and any additional tables discovered.
5.  Confirm canonical custom-System validity/Needs Attention behavior
    and how an emptied rule set is represented.
6.  Confirm Orrery category-System identity and missing-selected-System
    fallback.
7.  Inventory every user-facing category picker and identify which
    require large-catalog search behavior.
8.  Verify `display_order` is honored consistently and define one
    normalization helper/contract.
9.  Verify backup v5 round-trips arbitrary renamed/deleted/reordered
    categories without reseeding defaults; bump only if a real
    representational gap exists.
10. Add focused tests for rename preservation, duplicate validation,
    reorder normalization, delete-to-Uncategorized, delete-to-category,
    dependent cleanup, rollback, empty taxonomy, large catalogs, backup
    round-trip, and fresh-vs-upgraded seed behavior.
11. Exercise the manager and Orrery grouped selector on the physical
    Android UAT path used by the milestone, including Standard/Galaxy
    presentation and long category lists.

------------------------------------------------------------------------

## Dossier Summary

Phase 37.1 makes Categories genuinely user-owned without changing what a
Category fundamentally is. The four original rows become ordinary seeds;
Uncategorized remains the permanent null fallback; contacts stay
single-category; users gain create/rename/reorder/delete; rename is
identity-safe; delete is explicit and atomic; dependent custom-System
and profile state is repaired deliberately; ordering becomes canonical;
large catalogs remain fully accessible; and backup restores the user's
taxonomy rather than factory assumptions.

The only adjacent Orrery work admitted is the permanent, low-risk
grouping of the existing System selector into Built-in / Categories /
Custom Systems collapsible sections. The broader selector redesign
remains deferred.

The planning priority is therefore not "build a CRUD screen." It is:
**make a core lookup entity safely mutable across Orbit without breaking
the semantics already built on top of it.**
