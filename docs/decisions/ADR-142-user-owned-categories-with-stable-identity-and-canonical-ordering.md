# ADR-142: User-Owned Categories with Stable Identity and Canonical Ordering

**Status:** Accepted
**Date:** 2026-09-15
**Phase:** 37.1-category-management
**Source decisions:** dossier `phase-37.1-category-management-dossier.md` §§A–F
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Seeded categories were effectively read-only even though many local and portable relationships depended on them. Category display names could not safely become identity, and a mutable taxonomy must preserve zero categories and the permanent NULL Uncategorized state without reseeding old databases.

## Decision

The system uses user-owned, single-category rows with stable local IDs and portable UIDs; names are display and matching data only. Categories have canonical contiguous `display_order`, initial seeds are creation-time defaults only, and CRUD is centralized in the Settings manager and category DAO.

## Alternatives Considered

- **Protected factory categories** — rejected because initial seed names have no protected semantic meaning.
- **Tags or multi-category membership** — deferred because this phase preserves the one `category_id` or NULL model.
- **Name-based relationships** — rejected because a rename must preserve every durable category-linked relationship.
- **Launch-time seed reconciliation** — rejected because a user may deliberately retain a renamed, deleted, or empty taxonomy.

## Consequences

### Positive

- Users can create, rename, and order categories without changing relationship identity.
- All consumers can share one ordered catalog and consistent Uncategorized policy.

### Negative

- Writers must validate normalized visible-name collisions and use local ID or UID/ref identity by layer.

### Risks

- An identity path that uses display names can silently sever relationships on rename.

## Implementation

**Key files:**
- `src/logic/category-logic.ts` — defines normalized visible-name, ordering, search-threshold, and Uncategorized policies.
- `src/db/categories-dao.ts` — owns serialized category reads, create, rename, and reorder operations.
- `src/db/systems-dao.ts` — applies symmetric visible-name collision validation for Systems.
- `src/screens/CategoryManagementScreen.tsx` — provides the centralized Settings CRUD surface.
- `src/navigation/settings-routes.ts` — registers the live Category Management route.

**Depends on:** ADR-009 (Crash-Safe Forward-Only SQLite Migrations)
**Required by:** ADR-143 (Lock-Time-Revalidated Atomic Category Deletion and System Fallout); ADR-144 (Complete Category Selection and Grouped Orrery System Discovery); ADR-145 (Category-Aware Portable Backup Format v6 and Exact Taxonomy Restore)
