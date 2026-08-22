# Phase 14 Validation Matrix

This file is the execution-time evidence record for Phase 14. Populate status and sanitized notes only after the listed checks run; do not record API keys, prompts, endpoint URLs, request bodies, headers, contact data, or raw provider responses.

## Multi-source coverage audit

Every Phase 14 plan (01–07) appears below; no unplanned source item is present.

| Source | Required item | Covered by |
|---|---|---|
| Goal | Optional BYO-key providers, secure keys, editable Compose draft, and privacy-bounded structured prompt | Plans 01–05 |
| REQ AI-01 | Four provider choices, SecureStore-only keys, dynamic models/free-text fallback, default-off/no entitlement, save-time + native egress enforcement | Plans 01, 02, 04, 07 |
| REQ AI-02 | Compose/profile AI Suggest returns only an editable draft while Copy/SMS stay intact | Plan 05 |
| REQ AI-03 | Ranked fuel, aggregate-only interactions, permitted fields, first-use prompt preview, ongoing inspection | Plans 03–05 |
| REQ AI-04 | Default-off per-field sharing and no assembled-prompt diagnostics | Plans 02–04 |
| RESEARCH | Additive migration; Custom public-HTTPS/no redirects; cancellation/no automatic retry; response validation; Pixel UAT | Plans 01, 02, 05, 06, 07 |
| RESEARCH / CONTEXT | Native connection-time egress enforcement for the user-controlled Custom provider — single-resolution resolved-address allowlist (IPv4/IPv6, IPv4-mapped + NAT64 unwrap, ULA fc00::/7), numeric-IP-literal pre-check, native redirect refusal, `Proxy.NO_PROXY`, sanitized distinct error codes | Plan 07 (`orbit-secure-fetch` native Expo module) |
| CONTEXT | Provider/key choices, outbound allowlist, prompt/truncation disclosure, Compose-only workflow, sharing controls/sanitized errors | Plans 01–06 |

No source item is intentionally deferred by this plan set; the deferred ideas in 14-CONTEXT.md remain excluded.

| Requirement | Automated evidence | Release-build / UAT evidence | Status |
|---|---|---|---|
| AI-01 | `004-ai-settings.test.ts`, `runner.test.ts`, `app-settings-dao.test.ts`, `ai-key-store.test.ts`, `custom-endpoint.test.ts`, `AiService.test.ts`, `ai-service-guards.test.ts`, `secure-fetch.test.ts` (Plan 07 native wrapper, native module mocked) | Pixel verifies all configured provider paths, masked key entry, manual model fallback, rejected Custom paths, and the native HTTPS→private-address / redirect / IP-literal / proxy egress fixtures (step 3). | Pending (Task 2) |
| AI-02 | `ai-suggestion-logic.test.ts`, `compose-logic.test.ts`, `ai-suggestion-navigation.test.ts` | Pixel verifies Compose/profile entry, Cancel, confirmed replacement, Copy, and SMS handoff. | Pending (Task 2) |
| AI-03 | `ai-context-read.test.ts`, `prompt-template.test.ts`, `AiService.test.ts`, `ai-suggestion-compose-integration.test.ts` (M1 — strict `===` prompt identity across inspector/ack/adapter) | Pixel verifies first-use acknowledgement and subsequent inspector show the same bounded prompt. | Pending (Task 2) |
| AI-04 | `field-def-form-logic.test.ts`, `field-defs-dao.test.ts`, `settings-ai-logic.test.ts`, `ai-context-read.test.ts`, `prompt-template.test.ts` | Pixel verifies default-off field sharing (create + edit) and sanitized diagnostics. | Pending (Task 2) |

## Required automated commands

```bash
npx vitest run
npx tsc --noEmit
npm run check:colors
```

## Automated gate results (Task 1 — 2026-08-21, main working tree)

| Gate | Command | Result | Sanitized notes |
|---|---|---|---|
| Test suite | `npx vitest run` | PASS | 95 test files, 1255 tests passed, 0 failed |
| Typecheck | `npx tsc --noEmit` | PASS | exit 0 — whole-repo typecheck clean |
| Colour tokens | `npm run check:colors` | PASS | exit 0 — no hardcoded colours |

Boundary coverage confirmed by the suites above: schema/registration (migration 004 + runner), secret isolation (SecureStore-only, no credential column), provider + Custom URL + error behavior, native-egress wrapper, privacy-context/prompt identity (incl. M1), field-sharing create+edit persistence, and the Compose lifecycle/navigation/ack.

## Plan 07 native compile + unit-test gate (transferred verbatim from 14-07-SUMMARY.md)

Ran on the desktop build host (LIVING-ROOM / `droid`) per `docs/runbooks/desktop-build-pipeline.md` (transport = tar-over-ssh / scp; never `git push`), 2026-08-21. A mocked JS test cannot establish native transport; this is the authoritative native evidence.

| Native gate | Command | Result |
|---|---|---|
| Compile + link (module inside autolinked Expo/RN app) | `:app:compileDebugKotlin` | **BUILD SUCCESSFUL** (48s) |
| Kotlin address-predicate unit tests | `:orbit-secure-fetch:testDebugUnitTest` | **BUILD SUCCESSFUL** (22s); `syncNonPublicVectors` byte-identity task ran; JUnit report `TEST-expo.modules.orbitsecurefetch.OrbitSecureFetchModuleTest.xml`: **tests="4" skipped="0" failures="0" errors="0"** (non-zero, all green — not a zero-test false pass) |

Gate status (C3-L2 / C4-L1): **PASSED**. The full-build compile/link gate is `:app:compileDebugKotlin` (proves the module compiles and links inside the app); no separate `:app:assembleDebug` was required to prove the module, and ABSENT/FAILED native evidence would have been release-blocking. Recorded as PASSED.

## Evidence log

| Date | Command or UAT step | Result | Sanitized notes |
|---|---|---|---|
| 2026-08-21 | `npx vitest run` (full suite) | PASS | 95 files, 1255 tests passed |
| 2026-08-21 | `npx tsc --noEmit` | PASS | exit 0, whole-repo typecheck clean |
| 2026-08-21 | `npm run check:colors` | PASS | exit 0 |
| 2026-08-21 | `:app:compileDebugKotlin` (desktop `droid`, Plan 07) | PASS | BUILD SUCCESSFUL (48s) — module compiles + links in autolinked app |
| 2026-08-21 | `:orbit-secure-fetch:testDebugUnitTest` (desktop `droid`, Plan 07) | PASS | BUILD SUCCESSFUL (22s); JUnit tests=4 failures=0 errors=0 |
| Pending | Task 2 — Pixel release-build UAT (steps 1–6, incl. native egress-escape fixtures) | PENDING | Owner-performed blocking checkpoint; no evidence retained yet |

## Release block conditions

- Any API key, prompt, contact note/detail, raw provider response, request body/header, or full endpoint reaches a log, export, UI error, or this evidence file.
- A Custom request reaches a non-public HTTPS destination or follows a redirect.
- A cancelled/stale request changes the draft, a suggestion records a touchpoint or modifies `last_contact`, or a non-empty draft is replaced without confirmation.

---

## 14-06 Task 2 — Device UAT result: ⚠ BLOCKED (2026-08-21)

Physical-Pixel UAT on debug (Metro, console) + release builds. **Result: BLOCKED — a release-blocking hang was found; the phase is NOT shippable.**

**BLOCKER — AI suggestion hangs forever.** Triggering "AI Suggest" (profile→Compose) stalls on "Drafting a message…" indefinitely and never returns a suggestion. Traced (instrumented debug console) to the lifecycle **`resolving`** state: `resolvePrompt()` → `readPromptContext` (an expo-sqlite async read chain) **never settles** — not a rejection (`begin()` catches those → error), a true hang. **Reproduces on the RELEASE build** (not a dev-mode artifact). The `resolving` state has **no timeout** (the 20 s timer is armed only in `egress`, after resolving), so it hangs unbounded. Root cause not yet pinpointed (which sub-read never settles; an uncaught `NativeDatabase.execAsync` NPE was seen on debug). Passed every unit/JVM gate because `node:sqlite` (sync) cannot reproduce the `expo-sqlite` (async) hang.

**Fix scope (resume):** pinpoint + fix the hanging read; add a `resolving`-state timeout/guard so it can never hang; regression test; re-UAT.

**Device-verified GOOD before the blocker (record for reuse):**
- Migration 004 live — `user_version = 4` (read from the on-device DB).
- **No key/secret column** in `app_settings` (DB schema) — API key only in `expo-secure-store`, shown masked (`•••• (saved)`), raw key **0 occurrences** in the UI tree.
- Real Gemini model **discovery works** — live model list returned over authenticated HTTPS (with a valid key).
- Custom endpoint **rejects cleartext at save** — `http://…` → "The endpoint must use https://.".
- **DATA-04 held** — the suggestion attempt left Alice/Dad `last_contact` unchanged (no touchpoint).

**Not yet exercised** (blocked by the hang or needing infra): the first-send acknowledgement gate + exact-prompt inspector, a returned suggestion / editable draft, cancel/replace, sanitized error paths, and the native egress-escape fixtures (private-DNS / redirect / proxy).

---

## 14-11 — Device UAT checklist (PENDING — owner's pass, nothing device-verified yet)

The 14-11 model-layer bundle (frontier = 3 latest-per-tier per provider; artificial
output cap removed) is proven node-side only (`npm test`, `tsc`, `check:colors`,
biome). The following require the owner's on-device pass and are **NOT** verified:

**Model picker (14-10 + 14-11) — orchestrator-driven on the physical Pixel release build (2026-08-22):**
- [x] PASS — Frontier scope shows EXACTLY three chips per provider: Gemini `gemini-3.1-pro-preview` / `gemini-3.7-flash` / `gemini-3.5-flash-lite`; Anthropic `claude-opus-5` / `claude-sonnet-5` / `claude-haiku-4-5`; OpenAI `gpt-5.6-sol` / `gpt-5.6-terra` / `gpt-5.6-luna`. (uiautomator-confirmed, exactly 3 each.)
- [x] PASS — "All models" toggle expands to the full catalog (Gemini → the full deprecation-filtered chat set incl. 2.5 line / latest aliases / computer-use; count returns to 3 on toggle back).
- [x] PASS — "Refresh models" tap fetched the live LiteLLM catalog on-device; status line `settings-ai-status` read "Model list updated (17 available)." (keyless public GET, no crash).
- [x] PASS — Offline (airplane mode) cold relaunch: dashboard renders and the picker still shows the 3 seed-backed frontier chips + "no API key needed" copy (bundled seed fallback works with zero network).
- [~] PRESENT (not exercised) — the "Advanced options — discover or enter a model id" free-text/discover affordance is present; typing a free-text id was not driven (owner can confirm).
- Note: the API key field renders masked (`•••••••• (saved)`) — SecureStore-backed, no raw key in the UI tree.

**Full-length drafts, cap removed (14-11):**
- [x] OWNER-CONFIRMED (2026-08-22) — owner tested generation on-device via the new picker and confirmed it works ("it's all working, including the generation using the new picker"). Per-tier breakdown (Pro vs Flash vs Flash-lite) not separately itemized by owner; no truncation reported.

---

## 14-06 egress guard — on-device SMOKE TEST (2026-08-22, release build, orchestrator-driven)

Per owner decision, the release-gating egress matrix was scoped to a **single on-device smoke test** proving the native `orbit-secure-fetch` guard is wired and fires end-to-end, resting exhaustive vector coverage on the already-green JVM/Kotlin address-predicate tests (`secure-fetch.test.ts` + `OrbitSecureFetchModuleTest`, 4 green over the shared `non-public-vectors.json`).

**Method:** Custom provider, controlled-DNS via `nip.io` (a real HTTPS hostname that passes save-time validation, so egress reaches the native `Dns` check at connection time — a raw IP-literal is rejected earlier by the URL validator). Gemini key removed first so no real/paid provider call was possible. Evidence is sanitized (no keys/prompts/endpoints/contact data retained).

**Result — PASS:**

| Endpoint | Resolves to | Outcome | Evidence |
|---|---|---|---|
| `10-0-0-1.nip.io` | `10.0.0.1` (private) | **fail-closed** — "That endpoint was refused. Check it in Settings." (~3s, no draft, no delivery) | native `expo.modules.orbitsecurefetch.OrbitSecureFetchModule` invoked (logcat); fast pre-connection rejection |
| `8-8-8-8.nip.io` | `8.8.8.8` (public — CONTROL) | passes the address guard, fails later with a **different** generic error ("Couldn't draft a message. Try again?") | distinct error proves the block is address-specific, not a blanket custom-endpoint failure |

**Incidental PASS** — first-send acknowledgement gate + exact-prompt inspector: before any egress, the dialog showed the exact bytes ("This exact text will be sent to Custom endpoint. Nothing else leaves your device.") containing only Alice's allowlisted fuel, with Send-to-provider / Not-now actions.

**Not covered (accepted per owner's smoke-test scope):** the full 7-case matrix with active zero-delivery listeners (redirect, IPv6-ULA, IPv4-mapped, proxy, direct IP-literal). Rests on the green JVM/Kotlin vector tests. The final release-approval decision line remains the owner's to record.

**Cleanup note:** a throwaway Custom config was left on the device (endpoint `8-8-8-8.nip.io`, dummy model/key; the gemini key was removed for safety). Reset before real use.
