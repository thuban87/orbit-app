---
status: testing
phase: 36-ai-configuration-prompting
source: [36-VERIFICATION.md]
started: 2026-09-14T10:18:00-05:00
updated: 2026-09-14T10:18:00-05:00
---

## Current Test

number: 1
name: OpenRouter physical-device redirect
expected: |
  Browser authorization returns through orbit://openrouter-auth; the callback is accepted once and produces a usable connection without exposing the code or state.
awaiting: user response

## Tests

### 1. OpenRouter physical-device redirect
expected: Browser authorization returns through orbit://openrouter-auth; the callback is accepted once and produces a usable connection without exposing the code or state.
result: [pending]

### 2. Long connection and hub values
expected: Long endpoint, model, and provider values wrap or truncate without overlap or lost actions.
result: [pending]

### 3. OpenRouter authorization state and activation ordering
expected: Connect shows progress; cancellation/failure preserves the prior active lane; successful authorization activates OpenRouter.
result: [pending]

### 4. Long personalization content
expected: Long section titles, bodies, and custom guidance remain readable and editable without overlapping controls.
result: [pending]

### 5. Imported personalization copy durability
expected: An imported .txt/.md section remains intact and editable after the source is moved or deleted and Orbit relaunches.
result: [pending]

### 6. Compose repair navigation
expected: Compose's Needs Attention repair action opens the reachable AI connection-management surface.
result: [pending]

### 7. Long AI Settings rows
expected: AI Settings rows with long provider, endpoint, and model names remain unclipped and navigable.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

No automated gaps remain. Phase completion is pending only these device/visual checks.
