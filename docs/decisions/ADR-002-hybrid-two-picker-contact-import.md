# ADR-002: Cross-Version Contact Import — Hybrid Two-Picker

**Status:** Accepted
**Date:** 2026-08-29
**Phase:** 19.1-older-android-contact-picker-hybrid-two-picker-adr-002
**Source decisions:** Dossier 19 §Platform Support; 19.1 CONTEXT D-01–D-14b
**Reversibility:** one-way
**Migration:** None
**Supersedes:** None
**Superseded by:** ADR-003 (partial)

## Context

Phase 19 only exposed selected-contact import on Android 17+ and left older devices unsupported. Rich pre-17 contact reads require `READ_CONTACTS`, but the permission must stay inert on API 37 to retain the modern picker posture and avoid the documented distribution risk.

## Decision

The system uses an SDK-routed hybrid acquisition layer: Android 17+ uses the existing permissionless system picker, while Android 16 and below use a token-driven custom `ContactsContract` picker behind `READ_CONTACTS maxSdkVersion="36"`. Both readers produce the same `PickedContact[]` boundary; the custom picker reads only birthday Event rows, preserves a local-only pipeline, and surfaces read errors rather than treating them as cancellation.

## Alternatives Considered

- **Android-17-only picker** — rejected because it leaves older Android unsupported.
- **Single-field permissionless `ACTION_PICK` fallback** — rejected because it loses multi-method, birthday, photo, and multi-select support.
- **Broad `READ_CONTACTS` on API 37+** — rejected because it creates Play-policy distribution risk.
- **Separate native module or JS contacts reader** — rejected because extending the existing native module preserves the shared snapshot contract and avoids duplicate reader logic.

## Consequences

### Positive

- Older Android gains full-field, multi-select contact import without a new downstream path.
- Denial, permanent denial, nameless bulk rows, unreadable birthdays, and already-linked single imports have explicit recoverable outcomes.

### Negative

- The custom picker and permission state require native rebuilding and physical-device verification.

### Risks

- Scoped permission packaging and API-37 absence are release gates; the phase's Pixel 3a and Pixel 6 UAT passed them.

## Implementation

**Key files:**
- `modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/OrbitContactPickerModule.kt` — reads and maps provider contacts through the native bridge.
- `modules/orbit-contact-picker/android/src/main/AndroidManifest.xml` — scopes `READ_CONTACTS` through API 36.
- `modules/orbit-contact-picker/index.ts` — exposes the shared picker snapshot contract and selected-read wrapper.
- `src/screens/LegacyContactPickerScreen.tsx` — provides the standalone searchable multi-select picker and permission states.
- `src/services/import/start-contact-import.ts` — sends each entry point through the SDK-routed acquisition seam.
- `src/services/contacts/use-read-contacts-permission.ts` — requests, rechecks, and recovers Android permission state.
- `src/services/import/import-driver.ts` — terminalizes nameless bulk rows during incremental import.
- `src/db/import-session-read.ts` — reports terminal skips and unreadable-birthday completion counts.
- `src/logic/picked-contact-map.ts` — canonicalizes supported birthday input without coercing unreadable values.
- `src/screens/ImportCompleteScreen.tsx` — renders durable terminal outcomes and an already-linked exit.
- `src/components/AddSpeedDialFab.tsx` — starts the shared import route from the dashboard.
- `src/screens/SettingsScreen.tsx` — starts the shared import route from Settings.

**Depends on:** None
**Required by:** ADR-003 (`READ_CONTACTS` on API 37+ for Reconcile)
