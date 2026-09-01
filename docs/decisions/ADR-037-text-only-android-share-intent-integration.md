# ADR-037: Text-Only Android Share Intent Integration

**Status:** Accepted
**Date:** 2026-08-16
**Phase:** 10-share-sheet-capture
**Source decisions:** dossier `10-capture` Cluster 2, Cluster 3, and "Decisions made without you"; `10-CONTEXT.md` binding decisions
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Orbit needs to accept a shared link or text without losing the payload during Android lifecycle changes, while returning the user to the originating app after capture. The maintained Expo integration only exposes Chrome's page title when its Kotlin reader also accepts `EXTRA_SUBJECT`, and it changes the app-wide activity launch mode.

## Decision

The system uses `expo-share-intent` as a `text/plain`-only Android share target, patched with `patch-package` to prefer `EXTRA_SUBJECT` over `EXTRA_TITLE`. A ready-gated, single-owner provider routes a pending intent to Capture, and a local native bridge calls plain `Activity.finish()` to return to the source app.

## Alternatives Considered

- **`text/*` registration** — rejected because non-plain text enters the library's file branch and produces an empty-URI error.
- **Image or multi-item capture** — rejected because images and `ACTION_SEND_MULTIPLE` are outside the v1 scope.
- **A JavaScript-only title fix or config-plugin string replacement** — rejected because `EXTRA_SUBJECT` never reaches JavaScript and a native patch is loud on dependency drift.
- **`BackHandler.exitApp()` or task removal** — rejected because neither guarantees the required return-to-source behavior.
- **Direct Share targets** — rejected for v1 because they require native shortcut work, expose contact data to the OS, and can suppress inactive contacts.

## Consequences

### Positive

- Chrome titles, cold-start intents, and return-to-source behavior have explicit native integration points.
- The narrow MIME filter avoids an unnecessary error and permission surface.

### Negative

- Native dependency updates require the committed patch to be reapplied and device-verified.
- `singleTask` applies to the app activity, so later entry points must handle `onNewIntent` semantics.

### Risks

- Android intent-redirection behavior and task-return semantics require release-APK verification on a physical device.

## Implementation

**Key files:**
- `app.config.ts` — registers the scheme and the exactly-once `text/plain` share-intent plugin tuple.
- `patches/expo-share-intent+8.0.1.patch` — makes the native module read `EXTRA_SUBJECT` before `EXTRA_TITLE`.
- `modules/orbit-share-finish/android/src/main/java/expo/modules/orbitsharefinish/OrbitShareFinishModule.kt` — exposes plain Android `Activity.finish()`.
- `App.tsx` — mounts the provider while retaining the migration-ready navigation gate.
- `src/navigation/linking.ts` — owns ready-gated pending-share navigation to Capture.

**Depends on:** ADR-019 (Native Stack Contact Lifecycle Navigation)
**Required by:** None
