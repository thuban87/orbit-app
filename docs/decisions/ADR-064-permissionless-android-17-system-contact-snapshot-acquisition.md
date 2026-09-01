# ADR-064: Permissionless Android 17 System-Contact Snapshot Acquisition

**Status:** Accepted
**Date:** 2026-08-26
**Phase:** 19-system-contact-import
**Source decisions:** dossier `19-system-contact-import` clusters A–C; 19-CONTEXT.md; 19-02, 19-12, 19-19, and 19-20 summaries
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Orbit needs a deliberate way to acquire selected system-contact data without making its normal contact surfaces depend on the device address book. Broad contacts access conflicts with the phase's privacy boundary, while the Android picker grant is temporary and cannot be treated as durable application state.

## Decision

The system uses an Android-17-gated, in-repository Expo module to launch the privacy-preserving system Contact Picker without `READ_CONTACTS` or broad package visibility. The module copies only the selected name, phone, email, birthday, and photo snapshot into app-owned cache before JavaScript receives it; unsupported Android versions leave manual Orbit creation available.

## Alternatives Considered

- **`expo-contacts` or a community contacts library** — Rejected because Android use requires broad `READ_CONTACTS` access.
- **Legacy Android contact APIs for feature parity** — Rejected because the phase prioritizes the Android 17 privacy model over older-platform coverage.
- **Retain picker URIs for later reads** — Rejected because the platform grant is temporary and cannot support resumable import.

## Consequences

### Positive

- System contact access stays optional, user initiated, and permissionless on the supported platform.
- Later review and import run from Orbit-owned snapshots rather than a live provider read.

### Negative

- Contact import is unavailable below Android 17 in this phase.

### Risks

- API-37 picker intent construction and device package visibility require native rebuild and physical-device verification.

## Implementation

**Key files:**
- `modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/OrbitContactPickerModule.kt` — launches the picker, snapshots granted fields, and enforces the API gate.
- `modules/orbit-contact-picker/android/src/main/AndroidManifest.xml` — declares scoped contact-picker package visibility without a broad permission.
- `modules/orbit-contact-picker/index.ts` — exposes the typed picker snapshot contract.
- `src/services/import/import-acquire.ts` — accepts picker snapshots into Orbit's import workflow.

**Depends on:** ADR-059 (Normalized Contact Methods, Canonical Actionability, and Local Provenance)
**Required by:** None.
