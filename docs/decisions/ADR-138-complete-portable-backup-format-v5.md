# ADR-138: Complete Portable Backup Format v5

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 36-ai-configuration-prompting
**Source decisions:** milestone-2 dossier backup boundary; 36-CONTEXT D-03b, D-12, D-14
**Reversibility:** one-way
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Format 4 intentionally deferred the coordinated portable representation of milestone preferences, Systems, Group Events, personalization, and Profile presentation. A backup that carries connection metadata but credentials, or presentation assignments but not their background bytes, would either misrepresent readiness or silently lose user-owned local state.

## Decision

The backup manifest advances to format 5 and exports/restores the complete non-secret milestone preference and entity graph, including AI connection metadata, personalization, interaction permission and Group Event data, Profile presentation assignments, and staged Profile background bytes. References use durable UIDs and restore remaps parents before children against destination row IDs; missing Group Event parents repair affected interactions to ordinary history. Credentials and other device-local secret state remain excluded.

## Alternatives Considered

- **Keep format 4 and restore only existing entities** — rejected because it silently loses committed milestone state.
- **Export API keys with their connection records** — rejected because ADR-049 makes credentials device-local SecureStore material.
- **Restore presentation by source row ID** — rejected because a valid destination can assign different local IDs.
- **Reuse the contact photo journal for Profile backgrounds** — rejected because UID-derived background staging has its own recoverable path without altering the journal constraint.

## Consequences

### Positive

- A portable restore preserves the complete supported local configuration without falsely reporting usable AI credentials.
- Background bytes survive the same restore and crash-recovery path as their presentation references.

### Negative

- The versioned manifest and every restore policy need synchronized validation and one-way forward migration.

### Risks

- Parent ordering, orphan repair, and post-commit background finalization must remain atomic from the user's perspective across interrupted restores.

## Implementation

**Key files:**
- `src/backup/types.ts` — declares backup format 5 and portable entity types.
- `src/backup/backup-schema.ts` — validates manifests, migrations, and portable settings.
- `src/backup/export-manifest.ts` — creates the coherent UID-based export projection.
- `src/backup/restore-apply.ts` — remaps and applies the restored entity graph.
- `src/services/photos/background-storage.ts` — stages and finalizes restored background bytes.

**Depends on:** ADR-058 (Optional Encrypted Backups and Previewed Local Restoration)
**Required by:** None
