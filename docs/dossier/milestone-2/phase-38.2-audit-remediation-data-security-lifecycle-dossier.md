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

**[SUPERSEDED by D-23 (owner, 2026-09-23)]** Orbit has no shipped users, so work whose only purpose is pre-38.2 state is cut.
No reachability investigation or harness runs; a stored Custom
credential that is not a bound record is never used (reads fail closed)
and the user re-enters it.

~~**RG-005:** reproduce legacy-key → migration/restore → readiness →
generation with synthetic keys and recording transport. If disproven,
document and close; if confirmed, remediate here.~~

## Owner Decisions (discuss session)

-   **[DECIDED · 2026-09-23] RG-007 retrospective consent --- leave
    existing rows as-is.** New imports (single, bulk, consolidated)
    start AI-off regardless of the general Memory default. No migration
    or sweep changes `allow_ai` on already-stored imported notes; the
    per-item toggle is the correction path.
-   **[SUPERSEDED by D-23 (owner, 2026-09-23)]** Orbit has no shipped users, so work whose only purpose is pre-38.2 state is cut.
    No legacy adoption or re-entry marker; unbound stored Custom keys
    are simply never used (fail closed) and overwritten on re-entry.
    Original entry, kept for the record:
    **[DECIDED · 2026-09-23] RG-005 if confirmed --- preserve
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

## Owner Decisions (plan-phase research batch, 2026-09-23)

-   **[DECIDED · 2026-09-23] RG-014:** retire a handed-off export at the
    first foreground sweep at least 24 h after creation, or on the next
    manual export. Never touch user-owned backups.
-   **[DECIDED · 2026-09-23] RG-012:** minimal photo-retry surface.
    Reuse the ImportComplete Retry with photo-only eligibility, plus one
    "Skip remaining photos" discard.
-   **[DECIDED · 2026-09-23] RG-043:** multi-option birthday/name fields
    are excluded from bulk apply. The card stays partial for per-field
    review.
-   **[DECIDED · 2026-09-23] RG-013:** scope is derivatives plus the
    contact-picker raw copies. The image-picker and photo-dl copies are
    follow-ups.
-   **[SUPERSEDED by D-23 (owner, 2026-09-23)]** Orbit has no shipped users, so work whose only purpose is pre-38.2 state is cut.
    No legacy alias re-home sweep; aliases left by pre-fix merges are
    not repaired (test devices are reset). Original entry, kept for the
    record: **[DECIDED · 2026-09-23] RG-010:** a one-shot, bounded,
    journaled, idempotent foreground sweep re-homes legacy aliased
    custom-photo references. ADR-021 filenames are unchanged.
-   **[DECIDED · 2026-09-23] RG-016:** within each pass, recovery runs
    before auto-backup. There is no state-based indefinite backup hold.
-   **[DECIDED · 2026-09-23] RG-002:** measure real export sizes and
    parse memory, propose the ingress cap, and get owner sign-off at a
    decision checkpoint before enforcing it.
-   **[DECIDED · 2026-09-23] RG-003/RG-004:** a third-party public HTTPS
    test host may be used for device proof, with synthetic payloads
    only.

**[SUPERSEDED by D-23 (owner, 2026-09-23)]** Orbit has no shipped users, so work whose only purpose is pre-38.2 state is cut.
No repair migration (no 031); runtime pair completion inside each
restore keeps D-21's deterministic identity. Original text, kept for
the record: Planner discretion (enforcement, not reversal): a
forward-only migration may seed missing NULL global custom-field pairs
in databases already damaged by Merge (RG-009), preserving existing
pair UIDs.

## Owner Decisions (plan review, 2026-09-23)

-   **[DECIDED · 2026-09-23] D-23 --- no legacy-state repair.** Orbit
    has no shipped users; the only existing installs are the owner's two
    test phones. Work whose sole purpose is repairing or adopting state
    written by pre-38.2 builds is out of scope; test phones carrying
    pre-38.2 damage are reset or re-seeded by the owner. Forward
    correctness (preventing new damage, crash safety, locking,
    cancellation, honest reporting, restart cleanup of state future
    crashes can leave) stays. Supersedes the RG-005 investigation gate
    and policy (D-08, D-22, the RG-005 half of D-05), the RG-010 legacy
    alias sweep (D-17), and the RG-009 repair migration (D-11, the
    migration half of D-21).

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
-   2026-09-23 --- plan-phase research batch: recorded owner decisions on
    RG-014 export TTL, RG-012 retry surface, RG-043 bulk exclusion,
    RG-013 scope, RG-010 legacy alias sweep, RG-016 backup hold, RG-002
    ingress cap process, RG-003/004 device test endpoint (38.2 CONTEXT
    D-13..D-21).
-   2026-09-23 --- plan review: recorded owner ruling D-23 (no
    legacy-state repair); marked the RG-005 investigation gate and
    policy, the RG-010 legacy alias sweep and the RG-009 repair
    migration discretion superseded (38.2 CONTEXT D-23).
