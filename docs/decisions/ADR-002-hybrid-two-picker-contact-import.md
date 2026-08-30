# ADR-002: Cross-Version Contact Import — Hybrid Two-Picker

- **Status:** Accepted — 2026-08
- **Decision scope:** Phase 19.1 / contact acquisition (reverses the Phase-19 "Android 17+ picker only, no `READ_CONTACTS`" locked decision)

## Context

Phase 19's contact acquisition was built on a **locked decision** (recorded in `HANDOFF.md` and the phase-19 research, never a formal ADR): use the **Android 17+ privacy-preserving system Contact Picker exclusively**, with **no `READ_CONTACTS`** permission, and show an "unsupported" state on older Android. The stated rationale was privacy.

First device UAT (2026-08-29) invalidated that plan on two fronts:

1. **The Android 17 system picker is non-functional on the owner's real Android 17 device** (Pixel 6 Pro, `raven:17/CP2A.260705.006`, API 37, a genuine release build). The app correctly launches `com.android.contactspicker/.ContactsPickerActivity` (after fixing package visibility in 19-19), but that system trampoline logs `No PreferredActivity Found` and dead-ends in an empty chooser (`PICK_CONTACTS is not supported`, 0 targets). It reproduces for the classic `ACTION_PICK` too, for any app. orbit's usage matches the official Android 17 docs. This is an OS/device-state issue, not app code. See `.planning/phases/19-system-contact-import/19-DEVICE-UAT-FINDINGS.md`.
2. **Older-device support is wanted** — for development/testing (the owner's Pixel 3a on Android 14/15) and reach.

A spike (`19-SPIKE-older-android-permissions.md`) established, against official Android docs, that **rich permissionless contact reads are impossible below Android 17**: the Contacts Provider requires `READ_CONTACTS` for detail reads, with no `ACTION_PICK` URI-grant exception; the only permissionless path is a **single-field** `ACTION_PICK` (name + one phone/email). A permissionless import on older Android would therefore be too thin to be useful.

The owner also clarified a mistaken premise baked into the original decision: **zero-permissions was over-inferred, not the owner's stance.** A runtime *read* permission does **not** violate local-first — local-first means contact data never leaves the device, and `READ_CONTACTS` only reads the phone's contacts *into* orbit, on-device. Permissions are acceptable where they earn their place and clear app-store policy.

## Decision

Adopt a **hybrid two-picker** acquisition layer, gated on `Build.VERSION.SDK_INT`:

- **Android 17+ (API ≥ 37):** the existing permissionless system Contact Picker (`orbit-contact-picker` module). **No `READ_CONTACTS`.**
- **Android ≤ 16 (API < 37):** declare `READ_CONTACTS` scoped with **`android:maxSdkVersion="36"`** (so it is inert on API-37 devices) + an **in-app custom picker** (browse / search / multi-select over `ContactsContract`) that reads full fields — multiple phones/emails, **birthday only from `Event.TYPE == TYPE_BIRTHDAY`**, and photo — and maps them to the same `PickedContact[]` shape.
- **Routing** selects the picker by SDK level. The **entire downstream import pipeline is shared and unchanged**: import sessions, review, cluster consolidation, completion, resume/discard, photo staging, and birthday validation (Phase-19 plans 19-13→19-16) consume `PickedContact[]` regardless of source.
- The "Contact import requires Android 17+" unsupported state is **retired** — older versions are now supported.

## Rejected Alternatives

### Android 17+ picker only (the reversed decision)
Rejected. Non-functional on the owner's real Android 17 hardware today, excludes all older devices, and blocked development/testing entirely.

### Pure no-permission on every version
Rejected. Below Android 17 this yields only a single-field import (name + one phone/email, one contact at a time, no multiple methods / birthday / photo / multi-select), which guts the feature and renders the rich downstream pipeline moot on older devices.

### Broad `READ_CONTACTS` on all versions (active on API 37)
Rejected. Simplest to build, but requesting `READ_CONTACTS` on an API-37 target violates the **Google Play Contacts policy** (announced 2026-04-15, effective **2027-01-27**), which permits `READ_CONTACTS` for API-37 apps only when the system picker is insufficient — a real distribution risk. The `maxSdkVersion="36"` scoping in the chosen decision avoids this by keeping the permission inert on modern devices.

## Consequences

- **`READ_CONTACTS` is requested only on Android ≤ 16** (inert on 17+ via `maxSdkVersion="36"`), so the Google Play Contacts policy is satisfied and the permissionless posture is preserved on modern devices.
- **Local-first is preserved** — no network on any import path; the permission only reads on-device.
- The `HANDOFF.md` "Android 17+ / no `READ_CONTACTS`" locked decision is **superseded by this ADR.** A follow-up should update `HANDOFF.md`/CLAUDE.md references accordingly.
- **Scope split:** the older-Android picker is built in a new **Phase 19.1**. The Android-17 path (19-12→19-19) stays in Phase 19 and is *finished* once its device blocker is resolved.
- The **Android-17 picker on-device failure is a separate device/OS thread** (candidate remediations tracked in the findings doc); this decision makes orbit functional **regardless** via the ≤16 path, unblocking device UAT on the Pixel 3a now.
- The Phase-19 code-review defects in the Android-17 Kotlin module (Events stored as birthday with no `Event.TYPE` filter; a picker read-exception silently discarding the selection) are **docketed to the Phase-19 finish**; the new ≤16 custom reader must implement `Event.TYPE` filtering correctly from the start so the same class of bug is not reintroduced.
- Because import sessions are picker-agnostic, the 19.1 device UAT on the 3a will **also** verify the shared downstream behaviors that Phase-19's 19-17 Tasks 2–3 cover; only the Android-17-picker-specific launch/snapshot (Task 1 on API 37) remains gated on resolving the 17 device blocker.
