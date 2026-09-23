# Phase 38.2 --- Data Integrity, Security & Lifecycle Hardening Dossier

## Objective

Harden Orbit's persistence, native trust boundaries, restore/merge
behavior, file ownership, import/export lifecycle, notification
lifecycle, and transactional edit semantics across failure, retry,
deletion, restore, and process lifecycle boundaries.

## Scope Principles

-   Preserve local-first/offline behavior and established
    privacy/security decisions.
-   Do not weaken restore completeness guards, deletion evidence,
    SecureStore separation, endpoint binding, or native destination
    controls.
-   Treat SQL, filesystem, native Android, and live app state as
    distinct ownership boundaries.
-   Shipped migrations remain immutable; any schema change is
    forward-only.
-   INVESTIGATE findings must be reproduced before remediation.
-   Do not broaden into sync, mandatory encryption, generic dependency
    upgrades, or unrelated release work.

## Workstream A --- Native Trust and Resource Boundaries

**RG-001--007.** Restrict widget snapshot access; defensively bound
Android backup/share ingress; cancel rejected photo transfers; own
Custom AI native response bodies through cancellation/settlement with
size bounds; investigate legacy credential binding after restore;
prevent credential drafts crossing providers; enforce AI-off defaults
for imported notes.

## Workstream B --- Restore, Merge and Graph Integrity

**RG-009--011.** Preserve required custom-field pairs, deletion
evidence, and newer local writes; keep merged results
exportable/restorable; safely restore and own canonical photos across
restore/merge/deletion/recovery; publish committed restored appearance
state; report partial recovery honestly.

RG-009 and RG-010 are coordinated but not interchangeable. Do not solve
media ownership by weakening graph integrity or vice versa.

## Workstream C --- Import, Temporary Copies and Notification Lifecycle

**RG-012--015.** Preserve imported-photo retry input; purge sensitive
workflow copies only when no longer needed; bound generated-image
derivative lifetime; retire app-owned export staging without deleting
user-owned backups; make notification scheduling/readback match actual
Android behavior and remove scheduled/presented reminders for purged
contacts.

## Workstream D --- Startup and Maintenance Failure Boundaries

**RG-016.** Recoverable maintenance faults must not block healthy
relationship data or starve unrelated foreground work. Preserve
fail-closed integrity/migration behavior and required sequencing.

## Workstream E --- Transactional Editing and Reconciliation

**RG-017, RG-018, RG-043.** Preserve retained-value and Bind/Unbind
history semantics; prevent retry from replaying already-committed
additions/link diffs; preserve the exact selected source birthday/name
so ambiguity never becomes an unintended NULL/clear.

## Investigation Gate

**RG-005:** reproduce legacy-key → migration/restore → readiness →
generation with synthetic keys and recording transport. If disproven,
document and close; if confirmed, remediate here.

## Owner Decisions (discuss session)

-   **[DECIDED · 2026-09-23] RG-007 retrospective consent --- leave
    existing rows as-is.** New imports (single, bulk, consolidated)
    start AI-off regardless of the general Memory default. No migration
    or sweep changes `allow_ai` on already-stored imported notes; the
    per-item toggle is the correction path.
-   **[DECIDED · 2026-09-23] RG-005 if confirmed --- preserve
    provenance, else require re-entry.** Bind a legacy unbound Custom
    key to its original endpoint before restore replaces endpoint
    metadata; when that endpoint cannot be established, the key fails
    closed and must be re-entered. No blanket credential deletion. If
    disproven, document and close.
-   **[DECIDED · 2026-09-23] RG-010 keeps ADR-021 identity-derived
    photo filenames.** Merge re-homes absorbed photo bytes into the
    survivor's derived paths with crash-safe swap/reconcile. Any naming
    change comes back to the owner.
-   **[DECIDED · 2026-09-23] No backup format bump pre-approved.** Plan
    RG-009/RG-010 within `BACKUP_FORMAT_VERSION` 7; if a bump proves
    necessary, stop and escalate.
-   **[DECIDED · 2026-09-23] Triage selection.** This dossier's
    Coverage list is the owner's remediation selection for 38.2
    (recorded in the audit `TRIAGE.md`).

Planner discretion (enforcement, not reversal): a forward-only
migration may seed missing NULL global custom-field pairs in databases
already damaged by Merge (RG-009), preserving existing pair UIDs.

## Explicitly Out of Scope

RN-013 Assist write-failure feedback remains deferred. Also excluded:
cloud/self-hosted sync implementation, mandatory encryption, blanket
credential or AI-permission resets without owner decision, generic
filesystem sweeps, and Phase 38.4 UI/accessibility polish.

## Verification

Carry forward each RG's original STATIC/RUNTIME/DEVICE requirements.
Exercise real restore/export flows, controlled providers, filesystem
ownership, failure injection, and commit → failed read/recovery → retry
sequences.

## Coverage

RG-001, RG-002, RG-003, RG-004, RG-005, RG-006, RG-007, RG-009, RG-010,
RG-011, RG-012, RG-013, RG-014, RG-015, RG-016, RG-017, RG-018, RG-043.

## GSD Planning Guidance

Treat this as one phase with several plans, not eighteen mini-phases.
RG-009/RG-010 are the most sensitive cluster and require explicit
regression coverage. Preserve original RG/finding IDs in plans for later
verification.

## Revision Log

-   2026-09-23 --- discuss session: recorded owner decisions on RG-007
    retrospective consent, RG-005 remediation policy, RG-010 filename
    policy, backup format, and triage selection (38.2 CONTEXT D-07..D-12).
