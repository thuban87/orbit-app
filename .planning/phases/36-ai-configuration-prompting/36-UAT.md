---
status: passed
phase: 36-ai-configuration-prompting
source: [36-VERIFICATION.md]
started: 2026-09-14T10:18:00-05:00
updated: 2026-09-14T13:40:53-05:00
---

## Tests

### 1. OpenRouter physical-device localhost callback
expected: Browser authorization returns through the temporary `http://127.0.0.1:<dynamic>/openrouter-auth` listener, then a credential-free `orbit://openrouter-auth` wake foregrounds Orbit; the callback is accepted once and produces a usable connection without exposing the code or state.
result: [passed] A clean native debug client was installed on the physical Pixel 6 Pro (`1A071FDEE002BU`, raven). OpenRouter presented authorization for the signed-in account using the dynamic localhost callback, authorization returned to Orbit without manual code entry, and the provider model picker opened. The visible completion wake, Orbit UI, Metro delta, and sanitized logcat delta contained no `code` or `state` callback parameters. The JVM report contained 6 tests with zero failures/errors, and the clean debug build completed successfully.

### 2. Long connection and hub values
expected: Long endpoint, model, and provider values wrap or truncate without overlap or lost actions.
result: [passed] A deliberately long HTTPS endpoint and provider/model id remained contained in the Custom form and saved connection card. The card stayed scrollable and its actions remained reachable.

### 3. OpenRouter authorization state and activation ordering
expected: Connect shows progress; cancellation/failure preserves the prior active lane; successful authorization activates OpenRouter.
result: [passed] The prior OpenAI lane remained active before the real browser authorization completed. After the validated localhost callback and key persistence, Orbit opened model selection; choosing `Cohere: North Mini Code (free)` then made OpenRouter the Active lane. No Draft, Rewrite, or other AI generation request was invoked.

### 4. Long personalization content
expected: Long section titles, bodies, and custom guidance remain readable and editable without overlapping controls.
result: [passed] Long custom guidance plus a long section title/body wrapped, remained editable, could be scrolled clear of the persistent FAB, and retained reachable Save controls.

### 5. Imported personalization copy durability
expected: An imported .txt/.md section remains intact and editable after the source is moved or deleted and Orbit relaunches.
result: [passed] Imported orbit-phase36-import.txt through Android DocumentsUI, deleted the source from Downloads, force-stopped/relaunched Orbit, and confirmed the copied title/body plus Section options still rendered.

### 6. Compose repair navigation
expected: Compose's Needs Attention repair action opens the reachable AI connection-management surface.
result: [passed] Activated OpenAI with a selected model, removed its local credential to create Needs Attention, opened Compose for Andrew Wales, and followed Open AI settings directly to AI Connections with the broken active lane visible.

### 7. Long AI Settings rows
expected: AI Settings rows with long provider, endpoint, and model names remain unclipped and navigable.
result: [passed] The long saved Custom model wrapped within its connection card without colliding with the Saved state; scrolling exposed the full row and it remained a navigable button.

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

No automated, implementation, or UAT gaps remain. Checks 1 and 3 were rerun against the freshly built native client and passed through the localhost callback contract. The other five already-passed checks were not rerun.
