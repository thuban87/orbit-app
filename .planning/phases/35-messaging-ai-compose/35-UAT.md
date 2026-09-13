---
status: testing
phase: 35-messaging-ai-compose
source: [35-VERIFICATION.md]
started: 2026-09-13T18:25:00Z
updated: 2026-09-13T18:25:00Z
---

## Current Test

number: 1
name: External handoff — Transmit opens the OS composer pre-filled; Orbit never claims delivery (COMP-04/05)
expected: |
  In Text and Email mode, tapping Transmit on the Pixel opens the OS SMS composer /
  email composer pre-filled with the resolved recipient (and Subject + Body for email).
  Orbit never claims it sent the message. Returning shows the compact "Did you send it?"
  panel; "Yes, log interaction" logs a canonical Message interaction, "Not yet" preserves
  the draft, and Copy never triggers the panel.
awaiting: user response

## Tests

### 1. External handoff — Transmit opens the OS composer pre-filled (COMP-04/05)
expected: External SMS/email composer opens with the right destination and body (Subject+Body for email); Orbit never claims delivery; returning shows the "Did you send it?" panel; "Yes, log interaction" logs a Message, "Not yet" preserves the draft, Copy never triggers it.
result: [pending]

### 2. Origin-aware return + Back-stack (COMP-14)
expected: Launch Compose from a Profile, complete a Transmit-confirmed log, press Back — return lands toward the launch origin and Back does not resurrect the finished draft (completed Compose route gone from history). Repeat from Dashboard / deep-link. Non-finished exits (Back, "Not yet", Copy) preserve the in-memory session.
result: [pending]

### 3. Session survival across backgrounding vs relaunch (COMP-07)
expected: Type a draft, add a Message Focus item, background the app (Home) and foreground it — body, subject, mode, destination, and Message Focus all survive. After a full kill + relaunch the draft is gone (session-only; no durable draft, no drafts table, no backup contract).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

## Orchestrator-driven device evidence (Pixel 3a, serial 943AY0JR4P, 2026-09-13)

Driven on-device by the orchestrator against a fresh Metro (:8083) serving current phase-35 code.

**CONFIRMED on-device (data layer):**
- **Migration 028 ran on the real device.** `PRAGMA user_version = 28`; `app_settings` has both
  new columns (`default_message_mode`, `remembered_message_mode`); the singleton row holds the
  exact migration-028 defaults: `default_message_mode='remember'`, `remembered_message_mode='text'`.
  This exercises the irreversible schema path (COMP-02 durable half) end-to-end on hardware.
- App builds and launches current phase-35 JS (home shell renders; 3 contacts / 4 methods in DB).

**NOT completed via automated driving (tests 1–3 remain pending human confirmation):**
The three interaction UATs need the Compose screen, reachable only from a non-archived, usable
contact. The 3 fixtures are dormant (`tracking_enabled=0`, `last_contact=null`) so the default
"Active Contacts" population hides them, and automated navigation to Compose was blocked by
fragile adb UI interaction (racy population dropdown, sticky search filter, back-press exits).
Observing OS cross-app composer pre-fill (test 1) and OS process-lifecycle survival (test 3) also
genuinely benefit from a human eye — the reason the verifier classified all three as
human_verification. Recommend running `/gsd-verify-work 35` on the device (set population to
"All Contacts", open contact "Orbit Fixture Birthday" — it has both a phone and an actionable
email — then Compose), or confirming them by hand. Contact 2's email is actionable; its phones
are `is_actionable=0`, which is itself a useful check of the usable-no-destination Text path.
