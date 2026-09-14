---
phase: 36-ai-configuration-prompting
plan: 10
subsystem: ai-prompting
tags: [message-focus, privacy, prompt, compose]
requires:
  - phase: 35-messaging-ai-compose
    provides: Session-only Message Focus selection and normalized Research projection
  - phase: 36-ai-configuration-prompting
    provides: Closed PromptContext and immutable prompt/provider path
provides:
  - Fresh-permission Message Focus projection at generation time
  - Dedicated bounded Message Focus emphasis in the exact immutable payload
  - Exact Message Focus block in Compose's contact-specific disclosure
affects: [compose, ai-egress, prompt-preview, phase-36-verification]
actuals:
  tasks: 3
  commits: 2
key-files:
  created:
    - src/ai/message-focus.ts
    - src/ai/message-focus.test.ts
  modified:
    - src/ai/prompt-types.ts
    - src/ai/prompt-template.ts
    - src/screens/ComposeScreen.tsx
    - src/stores/compose-session-store.ts
    - src/screens/settings-ai-logic.ts
    - src/screens/settings-ai-logic.test.ts
key-decisions:
  - "A stored Message Focus selection is never trusted for egress; its stable identity is intersected with a fresh normalized Research read and only the current label/value survives."
  - "Focus is represented as a dedicated DATA block plus Orbit-owned emphasis instruction, leaving ordinary permitted context intact."
requirements-completed: [AICFG-08]
status: complete
completed: 2026-09-14
---

# Phase 36 Plan 10: Message Focus Gap Closure Summary

**Message Focus now changes the exact AI payload while preserving the permission boundary.**

## Accomplishments

- Revalidates each session selection against current normalized Research eligibility immediately before prompt construction; missing, revoked, ineligible, Off Limits, duplicate, and over-cap entries cannot egress.
- Uses only the fresh permitted label/value and serializes it through the sole bounded, fence-neutralized immutable prompt builder.
- Adds explicit stronger-relevance semantics without removing other permitted context or mechanically copying focused data into the draft.
- Includes the exact Message Focus DATA block in Compose's contact-specific disclosure.

## Commits

1. `b8c4f95` — plan the focused AICFG-08 gap closure
2. `fcd060d` — implement and test Message Focus prompt wiring

## Verification

- Focused: 6 test files / 73 tests passed; `npx tsc --noEmit` passed; Biome and `git diff --check` passed.
- Full regression: 369 test files / 3,534 tests passed, excluding only the already-documented Phase 30 collection failure in `orrery-controls-render.test.tsx`.
- Phase re-verification: AICFG-08 closed; 17/17 requirements satisfied; seven device/visual backstops remain.
