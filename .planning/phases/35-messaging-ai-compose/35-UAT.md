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
