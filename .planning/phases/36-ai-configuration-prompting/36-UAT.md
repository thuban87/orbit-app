---
status: testing
phase: 36-ai-configuration-prompting
source: [36-VERIFICATION.md]
started: 2026-09-14T10:18:00-05:00
updated: 2026-09-14T11:07:28-05:00
---

## Current Test

number: 1
name: OpenRouter physical-device redirect
expected: |
  Browser authorization returns through orbit://openrouter-auth; the callback is accepted once and produces a usable connection without exposing the code or state.
awaiting: owner completes OpenRouter sign-in/authorization in Chrome

## Tests

### 1. OpenRouter physical-device redirect
expected: Browser authorization returns through orbit://openrouter-auth; the callback is accepted once and produces a usable connection without exposing the code or state.
result: [blocked] Current native dev client was rebuilt with expo-crypto and installed on the physical Pixel. The OpenRouter CTA now opens the real authorization page in a Chrome custom tab; completing the callback requires the owner's OpenRouter account/sign-in choice.

### 2. Long connection and hub values
expected: Long endpoint, model, and provider values wrap or truncate without overlap or lost actions.
result: [passed] A deliberately long HTTPS endpoint and provider/model id remained contained in the Custom form and saved connection card. The card stayed scrollable and its actions remained reachable.

### 3. OpenRouter authorization state and activation ordering
expected: Connect shows progress; cancellation/failure preserves the prior active lane; successful authorization activates OpenRouter.
result: [blocked] The physical browser transition and cancellation path passed: returning from Chrome showed the failure notice and preserved the prior active lane. Custom and direct setup both activated only after successful persistence. The OpenRouter-success half requires the owner's OpenRouter sign-in/authorization.

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
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 2

## Gaps

No automated or implementation gaps remain. Five device/visual checks pass. The two remaining checks share one external blocker: completing OpenRouter sign-in/authorization in Chrome on the physical Pixel.
