# ADR-017: Multi-Link Contact Reachability

**Status:** Accepted
**Date:** 2026-08-14
**Phase:** 04-contact-crud-lifecycle
**Source decisions:** dossier `06-crud` Cluster B and exported data constraints; 04-CONTEXT Area 2
**Reversibility:** one-way
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

One scalar contact link cannot represent the several web identities a person commonly has. Phone and email remain dedicated single-value reach fields, while links need stable identities and ordered, independently editable rows.

## Decision

The system uses the `contact_links` child table for many actionable web links per contact. Each link has a stable UID, optional label, and display order; the edit surface manages repeatable rows and opens web links through a normalized URL.

## Alternatives Considered

- **One grouped scalar link** — Rejected because it preserves the earlier fixed-column shape but does not meet the owner’s need for multiple links.
- **Treat phone and email as links** — Rejected because their dedicated inputs and `tel:`/`mailto:` affordances remain clearer and use appropriate keyboards.
- **Drag-to-reorder links in v1** — Rejected because insertion order is sufficient while the durable order column preserves a future extension point.

## Consequences

### Positive

- Contacts can retain multiple web destinations without weakening phone and email usability.
- Link rows can participate in a future export/restore merge through their stable identities.

### Negative

- Contact save and purge must account for a child collection rather than one scalar value.

### Risks

- Untrusted URLs must be normalized before `Linking.openURL`; failures are caught and shown to the user.

## Implementation

**Key files:**
- `src/db/contact-links-dao.ts` — reads and applies scoped add, edit, and remove operations for ordered link rows.
- `src/db/contacts-dao.ts` — coordinates a full contact edit with its link collection.
- `src/screens/EditContactScreen.tsx` — hosts the dedicated phone/email inputs and repeatable links area.
- `src/components/LinksEditor.tsx` — captures link URL and optional label rows.

**Depends on:** ADR-008 (Initial Contact Schema as a Cross-Phase Data Contract).
**Required by:** None.
