---
phase: 14-ai-message-suggestions
plan: 07
subsystem: ai-egress-guard
status: complete
tags: [security, native-module, okhttp, ssrf, egress, android]
requires:
  - "src/ai/custom-endpoint.ts (validateCustomEndpoint + canonical CIDR tables, Plan 01)"
  - "src/ai/__fixtures__/non-public-vectors.json (shared vector manifest, Plan 01)"
  - "modules/orbit-share-finish (native-module idiom)"
provides:
  - "secureCustomFetch(input): Promise<SecureFetchResult> — the symbol Plan 02's Custom adapter calls"
  - "SecureFetchResult / SecureFetchError / SecureFetchErrorCode types"
  - "orbit-secure-fetch native Expo module (Kotlin OkHttp egress guard)"
affects:
  - "Plan 02 (Custom adapter routes exclusively through secureCustomFetch)"
  - "Plan 06 (on-device native transport fixtures)"
tech-stack:
  added: ["okhttp 4.9.2 (module implementation dep, matches RN)", "junit 4.13.2 (module testImplementation)"]
  patterns: ["local Expo native module (autolinked)", "allowlist-shaped address predicate", "table-driven shared-vector test"]
key-files:
  created:
    - modules/orbit-secure-fetch/expo-module.config.json
    - modules/orbit-secure-fetch/index.ts
    - modules/orbit-secure-fetch/src/OrbitSecureFetchModule.ts
    - modules/orbit-secure-fetch/src/OrbitSecureFetchModule.web.ts
    - modules/orbit-secure-fetch/android/build.gradle
    - modules/orbit-secure-fetch/android/src/main/AndroidManifest.xml
    - modules/orbit-secure-fetch/android/src/main/java/expo/modules/orbitsecurefetch/OrbitSecureFetchModule.kt
    - modules/orbit-secure-fetch/android/src/test/java/expo/modules/orbitsecurefetch/OrbitSecureFetchModuleTest.kt
    - modules/orbit-secure-fetch/android/src/test/resources/non-public-vectors.json
    - src/ai/secure-fetch.ts
    - src/ai/secure-fetch.test.ts
  modified: []
decisions:
  - "Kotlin isNonPublic mirrors the JS canonical table exactly; IPv4-mapped + NAT64 unwrap-and-recheck, ULA fc00::/7 handled explicitly (not via isSiteLocalAddress)."
  - "No globally-reachable carve-outs added (owner declined) — deliberate over-block."
  - "Address predicate extracted into internal object NonPublicAddresses so the JVM test drives it without OkHttp/server."
metrics:
  tasks_completed: 2
  files_created: 11
  duration_minutes: 20
  completed_date: 2026-08-21
---

# Phase 14 Plan 07: orbit-secure-fetch Native Egress Guard Summary

Airtight, connection-time egress guard for the user-controlled Custom AI provider: a Kotlin/OkHttp Expo native module (`orbit-secure-fetch`) that resolves the endpoint host once, rejects any non-public resolved address or numeric literal against an IANA-complete allowlist-shaped table, pins the vetted IP, refuses redirects natively, and pins `Proxy.NO_PROXY` — plus a typed, fully-tested JS wrapper (`secureCustomFetch`) that Plan 02's Custom adapter calls instead of raw RN `fetch`.

## What was built

### Task 1 — Native module (`commit de86cc0`, gradle fix `09ee103`)
- **`OrbitSecureFetchModule.kt`**: Expo `Module` with `AsyncFunction("request")` + `Function("cancel")`, backed by one lazily-built `OkHttpClient`:
  - `.proxy(Proxy.NO_PROXY)` (C3-H2), `.followRedirects(false)` + `.followSslRedirects(false)`, custom `okhttp3.Dns`.
  - Custom `Dns.lookup` resolves via `InetAddress.getAllByName`, rejects the whole request (throws `PrivateAddressException`) unless EVERY resolved address is globally reachable, and returns the vetted addresses so OkHttp connects to exactly the resolved IP while keeping the hostname for TLS SNI (single-resolution path — closes DNS-rebinding/TOCTOU).
  - **Numeric-IP-literal pre-check** before the `Call` (C3-H1b): `isRejectedLiteralHost(HttpUrl.host)` runs the same predicate directly, since OkHttp does not consult a custom `Dns` for literal hosts. `https://100.64.0.1`, `https://[fd00::1]`, IPv4-mapped literals all fail closed.
  - **`NonPublicAddresses`** (internal object, same file): the canonical predicate as byte-array CIDR **table constants** mirroring `custom-endpoint.ts` exactly — IPv4 (0/8, 10/8, CGNAT 100.64/10, 127/8, 169.254/16, 172.16/12, 192.0.0/24, TEST-NETs, 192.88.99/24, 192.168/16, 198.18/15, 224/4, 240/4, 255.255.255.255/32) and IPv6 (::, ::1, 64:ff9b:1::/48, 100::/64, 100:0:0:1::/64, 2001:2::/48, 2001:db8::/32, 3fff::/20, 5f00::/16, ULA fc00::/7, fe80::/10, ff00::/8). IPv4-mapped `::ffff:0:0/96` and NAT64 `64:ff9b::/96` unwrap the embedded IPv4 and re-check. Unknown address family → fail closed.
  - **Sanitized distinct error codes** (no body/headers/URL/exception text): `ERR_INVALID_URL`, `ERR_PRIVATE_ADDRESS`, `ERR_REDIRECT`, `ERR_TIMEOUT`, `ERR_TRANSPORT`, `ERR_CANCELLED`. A 3xx (surfaced because redirects are off) maps to `ERR_REDIRECT`.
  - **Cancellation (C2-M1)**: in-flight `Call`s keyed by `requestId` in a `ConcurrentHashMap` + a synchronized cancelled-`requestId` tombstone set; tombstone checked before enqueue AND after `Call` registration (a cancel racing ahead of registration still aborts); entry/tombstone cleared on settlement; `Call.isCanceled()` → `ERR_CANCELLED`.
- **`OrbitSecureFetchModuleTest.kt`** (JVM unit test): reads the shared manifest, asserts the module's committed test-resource copy is **byte-identical** to `src/ai/__fixtures__/non-public-vectors.json` (located by walking up from the JVM working dir), and iterates EVERY `{address, expect}` row through `isNonPublic` (reject → true, accept → false), plus explicit C5-H1 additions (`192.88.99.1`, `64:ff9b:1::1`, `100:0:0:1::1`, `2001:2::1`, `3fff::1`, `5f00::1`) and the numeric-literal pre-check.
- **`build.gradle`**: mirrors `orbit-share-finish` plugin set (`com.android.library` + `expo-module-gradle-plugin`; Kotlin applied by the expo plugin), adds `implementation okhttp:4.9.2` (the exact version RN bundles), `testImplementation junit:4.13.2`, a `src/test/java` + `src/test/resources` source set, and a `syncNonPublicVectors` Copy task keeping the committed manifest byte-identical to canonical on each build.
- **`expo-module.config.json`** registers `expo.modules.orbitsecurefetch.OrbitSecureFetchModule` for android; **`AndroidManifest.xml`** minimal (relies on the app's existing INTERNET grant).
- **TS refs**: `src/OrbitSecureFetchModule.ts` (`requireNativeModule`) + `.web.ts` stub (fails closed with `unsupported_platform`).

### Task 2 — Typed JS wrapper + tests (RED `1bc0965`, GREEN `797c135`)
- **`modules/orbit-secure-fetch/index.ts`**: thin typed `request`/`cancel` pass-through over the native ref (mirrors `orbit-share-finish/index.ts`).
- **`src/ai/secure-fetch.ts`**: `secureCustomFetch(input)` composes `validateCustomEndpoint` (imported from `@/ai/custom-endpoint`) up front; refuses non-HTTPS/credentialed/`.local`/private-literal before touching native; generates a `requestId`; wires `AbortSignal` → native `cancel` with `{ once: true }` and removes the listener in `finally` (post-settlement abort issues no cancel — C3-M4); an already-aborted signal issues no native request; re-checks `finalUrlHost` vs the requested host (bracket/case-normalized) as defense-in-depth; maps native codes to stable sanitized `SecureFetchError` codes (message IS the code — no leakage); a post-abort native rejection is consumed and normalized to `cancelled` with no unhandled rejection.
- **`src/ai/secure-fetch.test.ts`**: native module fully MOCKED; 17 tests covering every behavior above; top-of-file comment states node tests cannot prove native transport (deferred to Plan 06).

## JS gate outcomes (run by this agent)
- `npx vitest run src/ai/secure-fetch.test.ts` → **PASS** (17/17).
- `npx tsc --noEmit` → **PASS** (exit 0).
- `npm run check:colors` → **PASS** (exit 0).

## Native compile + test gate — ✅ PASSED (orchestrator-driven, 2026-08-21, host LIVING-ROOM/`droid`)

**Result (verified before Plan 02):** clean tar-over-ssh sync → `npm ci` → `npx expo prebuild --platform android --clean` → gradle, all on `droid` per the runbook:
- `:app:compileDebugKotlin` — **BUILD SUCCESSFUL** (48s) — the Kotlin module compiles + links inside the autolinked Expo/RN app.
- `:orbit-secure-fetch:testDebugUnitTest` — **BUILD SUCCESSFUL** (22s); the `syncNonPublicVectors` byte-identity task ran. JUnit report `TEST-expo.modules.orbitsecurefetch.OrbitSecureFetchModuleTest.xml`: **tests="4" skipped="0" failures="0" errors="0"** (non-zero, all green — not a zero-test false pass).

Gate status for 14-VALIDATION.md (Plan 06, C3-L2): **PASSED**.

<details><summary>Gate commands (as run)</summary>

Per the plan's division of labor, the executor did NOT run the desktop Android toolchain; the orchestrator ran the required exit gate on the desktop build host per `docs/runbooks/desktop-build-pipeline.md` (transport = tar-over-ssh / scp, NEVER `git push`):

```bash
DEST='C:\Users\bwales\projects\orbit-app'
# 1. Sync source (tar-over-ssh; excludes node_modules/android/.planning) — see runbook §1b
# 2. Install + prebuild (regenerates android/, autolinks local modules):
ssh -o BatchMode=yes droid "cd /d \"$DEST\" & npm ci"
ssh -o BatchMode=yes droid "cd /d \"$DEST\" & set \"CI=1\" & npx expo prebuild --platform android --clean --no-install"
# 3. Prove the module compiles + links inside the app:
ssh -o BatchMode=yes droid "cd /d \"$DEST\\android\" & gradlew.bat :app:compileDebugKotlin --console=plain"
# 4. Run the module's Kotlin address-predicate unit tests:
ssh -o BatchMode=yes droid "cd /d \"$DEST\\android\" & gradlew.bat :orbit-secure-fetch:testDebugUnitTest --console=plain"
```

Notes for the orchestrator:
- The autolinked gradle project for a local `modules/<name>` module is named after the directory; the unit-test task is expected to be `:orbit-secure-fetch:testDebugUnitTest`. If that path does not resolve, discover it with `gradlew.bat projects` (or `gradlew.bat :app:dependencies`) and run `<resolved-project>:testDebugUnitTest`.
- The `syncNonPublicVectors` Copy task refreshes the test-resource manifest before tests; the committed copy is already byte-identical, so a clean checkout also passes.
- Autolinked project resolved as expected to `:orbit-secure-fetch` (no name-discovery fallback needed).

</details>

## Deviations from Plan

### Auto-added (mandated by acceptance criteria, not in frontmatter `files_modified`)
**1. [Rule 2 — required test fixture] `modules/orbit-secure-fetch/android/src/test/resources/non-public-vectors.json`**
- The acceptance criteria mandate the Kotlin test read a byte-identical copy of the shared manifest from the module's test resources. Copied byte-for-byte from `src/ai/__fixtures__/non-public-vectors.json` (verified with `cmp`); a `build.gradle` Copy task keeps it in sync. Committed in `de86cc0`.

### Auto-fixed
**2. [Rule 3 — blocking build config] gradle plugin double-apply risk** (`commit 09ee103`)
- Initial `build.gradle` declared `org.jetbrains.kotlin.android` explicitly. The `orbit-share-finish` analog compiles Kotlin WITHOUT it (the `expo-module-gradle-plugin` applies Kotlin), so an explicit declaration risks a "plugin already applied" failure in the desktop native build. Removed it to mirror the working analog exactly. No JS/behavior impact.

No recorded owner decisions were reversed. The owner-directed "airtight native enforcement, no carve-outs" posture (14-REVIEWS.md) is implemented exactly; no globally-reachable `/32` carve-outs were added.

## Known Stubs
- `modules/orbit-secure-fetch/src/OrbitSecureFetchModule.web.ts` intentionally fails closed with `unsupported_platform` (Android-only feature). Documented, not a data stub.

## Self-Check: PASSED
- All 11 created files present on disk (verified).
- All 4 plan commits present in `git log` (de86cc0, 1bc0965, 797c135, 09ee103).
- JS gates green; native gate correctly left PENDING for the orchestrator.
