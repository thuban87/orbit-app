---
status: resolved
trigger: "Release Pixel UAT custom-value clear appears not to persist"
created: 2026-08-24
updated: 2026-08-24
---

# Release custom-value clear

## Symptoms

- Expected: changing `Nickname` from `Ace` to `Ace2`, saving, then clearing and saving should round-trip on the standalone release APK.
- Actual: the reopened Edit form shows the original `Ace` after the attempted save/clear sequence.
- Reproduction: populated v5 fixture → release upgrade → Edit Contact → custom `Nickname` → Save changes → reopen.
- Environment: Pixel 6 Pro `1A071FDEE002BU`, release APK built from `e96e339`; fixture only, no personal data.

## Current Focus

- hypothesis: Resolved — no release persistence defect in the custom-field save path; the reported reversion was caused by an unverified UI-automation save action.
- test: Focused form-shaping and DAO test suites completed after the successful two-step Pixel release reproduction.
- expecting: Met — source-level and physical-device results agree that nonempty edits and clear-to-empty edits both round-trip.
- bug_class: bohrbug (the reported sequence is deterministic so far)
- next_action: UAT executor should mark the Release row-4 edit/clear round-trip PASS and continue rows 5–9.

## Evidence

- timestamp: 2026-08-24 — migrated `Nickname` visibly renders as `Ace` on the release Edit screen.
- timestamp: 2026-08-24 — ADB text edit showed `Ace2` in the field, but reopening after the attempted save/clear showed `Ace`.
- timestamp: 2026-08-24 — Source investigation started with two competing branches: UI automation/submit activation (environment) and empty-value normalization (code). No product defect is assumed from the prior ADB observation.
- timestamp: 2026-08-24 — `buildEditInput` maps missing/null custom form entries to `null`; `updateContactFull` passes that value to `upsertValueCore`, whose conflict update writes `value = excluded.value`. The DAO test exercises an existing value cleared with `null` and verifies the retained row's value becomes NULL. This supports the writer branch but does not yet exercise device input.
- timestamp: 2026-08-24 — `TextFieldWidget` calls `onChange` with the raw `TextInput` string, so a cleared text field becomes `""`, not `null`; `buildEditInput` preserves that string. This is a potential representation mismatch, but it cannot explain an old nonempty value reappearing after a confirmed save because an empty string would round-trip as empty.
- timestamp: 2026-08-24 — The release package `com.bwales.orbit` is installed on Pixel `1A071FDEE002BU`; `run-as` correctly fails because it is non-debuggable. The active Edit hierarchy contains `edit-contact-custom-nickname` with text `Ace` and enabled `edit-contact-save` / accessibility label `Save changes` at bounds `[56,2895][1384,3064]`.
- timestamp: 2026-08-24 — On the actual standalone release flow, controlled `Ace` -> `Ace2` input was visible in `edit-contact-custom-nickname`; an explicit post-keyboard-dismiss tap on `edit-contact-save` navigated to `contact-profile-screen`. Reopening Edit showed `Ace2`, proving the release product submit/write/read path works for a nonempty change.
- timestamp: 2026-08-24 — On the same standalone release flow, controlled `Ace2` -> empty input was visibly confirmed, then an explicit tap on enabled `edit-contact-save` navigated to Profile. Reopening Edit showed the Nickname field empty. The actual product clear round-trips correctly; no Metro server or adb reverse was used.
- timestamp: 2026-08-24 — Focused source verification passed: `npx vitest run src/screens/edit-contact-logic.test.ts src/db/contacts-dao.test.ts` — 53/53 tests passed in 2 files.

## Eliminated

- hypothesis: The normalized custom-value writer fails to persist a clear in the standalone release APK.
  evidence: An explicit Pixel release `Ace2` -> empty edit, confirmed Save changes tap, Profile navigation, and Edit reopening resulted in an empty Nickname field.
  timestamp: 2026-08-24

## Resolution

- root_cause: No product persistence defect. The prior UAT observation did not establish that its automated Save changes interaction completed; the verified release interaction does persist both a replacement and a clear.
- fix: No code change required.
- verification: Physical standalone-release verification passed: `Ace` -> `Ace2` -> empty each navigated through Profile and reopened with the expected value. Focused form/DAO suite passed 53/53. No code fix was needed.
- files_changed: [".planning/debug/release-custom-value-clear.md"]
