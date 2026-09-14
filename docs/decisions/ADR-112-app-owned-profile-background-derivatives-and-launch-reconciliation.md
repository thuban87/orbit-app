# ADR-112: App-Owned Profile Background Derivatives and Launch Reconciliation

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 31-profile-experience
**Source decisions:** dossier `phase-10-profile-experience-dossier.md` §§D, AL, AM; 31-CONTEXT.md D-09, D-10; 31-09, 31-12, 31-13, and 31-15 summaries; 31-BACKGROUND-ART-REVIEW.md
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Profile backgrounds need reusable local custom images, independent assignment from layouts, predictable readability, and crash recovery. Picker cache URIs are temporary and unsafe to persist, while shared background templates can have multiple referrers and therefore cannot reuse the single-owner avatar deletion assumption.

## Decision

Custom Profile backgrounds are user-invoked, device-local assets. The app crops against the actual Profile aspect, encodes one bounded JPEG derivative with a maximum 2048-pixel long edge, and stores only an app-owned safe relative path of the form `profile-backgrounds/<uid>.jpg`. Replacement uses staged temporary and backup files. Database references commit before obsolete files are deleted, and deletion occurs only when no live template references the path.

A database-aware reconciliation sweep runs after migration readiness at launch/foreground registration. It resolves interrupted replacements, removes proven orphans, and prefers a bounded leak over deleting a possibly referenced image. Missing or failed images latch a tokenized theme fallback rather than retrying decode on every render. Bundled Galaxy and Standard slots retain ADR-087's stable IDs and brightness/contrast contract; Phase 31 replaces their approved art without introducing downloads or network reads.

## Alternatives Considered

- **Persist picker or cache URIs** — Rejected because the source may disappear or expose unsafe filesystem locations.
- **Store original-resolution source images** — Rejected because Profile needs one bounded derivative, not an archival photo library.
- **Delete a template file after checking only one assignment** — Rejected because templates may have global, Category, and multiple contact referrers.
- **Perform filesystem work inside the SQLite transaction** — Rejected because file operations cannot participate atomically and would hold the database mutex.
- **Use a background timer for cleanup** — Rejected because reconciliation is a launch/foreground sweep, consistent with local lifecycle policy.
- **Expose manual blur, brightness, or overlay controls** — Rejected in favor of automatic package-aware readability treatment.
- **Download background packs** — Rejected because appearance remains local-only.

## Consequences

### Positive

- User-selected backgrounds survive picker-cache eviction and relaunch without leaving the device.
- Interrupted writes and deletion failures are safely retryable.
- Shared templates cannot lose a still-referenced file through naive cleanup.

### Negative

- SQLite and filesystem state require an idempotent reconciliation boundary.
- Cancelled or failed operations may temporarily leave bounded staging debris until the next sweep.

### Risks

- Incorrect safe-path validation could delete unrelated app files; every destructive target must remain inside the dedicated namespace.
- A crop preview/output geometry mismatch can save a different composition than the user approved.
- Repeated decode failure can cause a render loop unless failure is latched to a solid/theme fallback.
- Large-image memory pressure remains a release-hardening concern.

## Implementation

**Key files:**
- `src/services/photos/profile-background-target.ts` — derives and validates UID-owned relative paths.
- `src/services/photos/background-crop-geometry.ts` — defines bounded source selection and Profile-aspect crop geometry.
- `src/services/photos/background-pipeline.ts` — creates the bounded JPEG derivative.
- `src/services/photos/background-storage.ts` — performs staged replacement and safe local cleanup.
- `src/services/photos/background-reconcile-sweep.ts` — plans and executes DB-aware interrupted-write and orphan recovery.
- `src/components/profile/ProfileBackgroundManager.tsx` — owns local choose, crop, save, cancel, assignment, and clear workflows.
- `src/components/ui/BackgroundHost.tsx` — renders local assets with latched tokenized fallback.
- `src/db/profile-presentation-dao.ts` — commits templates and independent background assignments before cleanup.
- `App.tsx` — registers reconciliation only after database migration readiness.
- `assets/backgrounds/README.md` — records bundled-art provenance and declared brightness bounds.

**Depends on:** ADR-021 (Durable Relative-Path Photo Masters with Crash-Safe Lifecycle Cleanup); ADR-087 (Bundled Background Presets and Package-Specific Surface Treatment); ADR-108 (Durable Independent-Axis Profile Presentation and Inheritance)
**Required by:** None
