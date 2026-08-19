# Phase 14 Validation Matrix

This file is the execution-time evidence record for Phase 14. Populate status and sanitized notes only after the listed checks run; do not record API keys, prompts, endpoint URLs, request bodies, headers, contact data, or raw provider responses.

## Multi-source coverage audit

| Source | Required item | Covered by |
|---|---|---|
| Goal | Optional BYO-key providers, secure keys, editable Compose draft, and privacy-bounded structured prompt | Plans 01–05 |
| REQ AI-01 | Four provider choices, SecureStore-only keys, dynamic models/free-text fallback, default-off/no entitlement | Plans 01, 02, 04 |
| REQ AI-02 | Compose/profile AI Suggest returns only an editable draft while Copy/SMS stay intact | Plan 05 |
| REQ AI-03 | Ranked fuel, aggregate-only interactions, permitted fields, first-use prompt preview, ongoing inspection | Plans 03–05 |
| REQ AI-04 | Default-off per-field sharing and no assembled-prompt diagnostics | Plans 02–04 |
| RESEARCH | Additive migration; Custom public-HTTPS/no redirects; cancellation/no automatic retry; response validation; Pixel UAT | Plans 01, 02, 05, 06 |
| CONTEXT | Provider/key choices, outbound allowlist, prompt/truncation disclosure, Compose-only workflow, sharing controls/sanitized errors | Plans 01–06 |

No source item is intentionally deferred by this plan set; the deferred ideas in 14-CONTEXT.md remain excluded.

| Requirement | Automated evidence | Release-build / UAT evidence | Status |
|---|---|---|---|
| AI-01 | `004-ai-settings.test.ts`, `runner.test.ts`, `app-settings-dao.test.ts`, `ai-key-store.test.ts`, `AiService.test.ts`, `ai-service-guards.test.ts` | Pixel verifies all configured provider paths, masked key entry, manual model fallback, and rejected Custom paths. | Pending |
| AI-02 | `ai-suggestion-logic.test.ts`, `compose-logic.test.ts`, `ai-suggestion-navigation.test.ts` | Pixel verifies Compose/profile entry, Cancel, confirmed replacement, Copy, and SMS handoff. | Pending |
| AI-03 | `ai-context-read.test.ts`, `prompt-template.test.ts`, `AiService.test.ts` | Pixel verifies first-use acknowledgement and subsequent inspector show the same bounded prompt. | Pending |
| AI-04 | `field-def-form.test.tsx`, `field-defs-dao.test.ts`, `ai-context-read.test.ts`, `prompt-template.test.ts` | Pixel verifies default-off field sharing and sanitized diagnostics. | Pending |

## Required automated commands

```bash
npx vitest run
npx tsc --noEmit
npm run check:colors
```

## Evidence log

| Date | Command or UAT step | Result | Sanitized notes |
|---|---|---|---|
| Pending | Pending | Pending | Pending |

## Release block conditions

- Any API key, prompt, contact note/detail, raw provider response, request body/header, or full endpoint reaches a log, export, UI error, or this evidence file.
- A Custom request reaches a non-public HTTPS destination or follows a redirect.
- A cancelled/stale request changes the draft, a suggestion records a touchpoint or modifies `last_contact`, or a non-empty draft is replaced without confirmation.
