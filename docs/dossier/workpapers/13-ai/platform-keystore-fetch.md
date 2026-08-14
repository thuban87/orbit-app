# Platform verification: API-key storage (Keystore) + requestUrl→fetch port

**Verified:** 2026-08-14. **Current Expo SDK:** 57 (released 2026-06-30; latest at
verification is `expo@57.0.9`, which ships React Native 0.86.2 — per
[Expo SDK 57 changelog](https://expo.dev/changelog/sdk-57)). SDK 57 is the current
stable line; no SDK 58 exists yet. All facts below verified against fetched sources;
where a source did not confirm something, it is marked as unverified.

Every claim is tied to a source that was actually fetched. Community/blog sources are
labelled as such and are NOT treated as authoritative.

---

## TOPIC 1 — Secure storage of API keys on Android (expo-secure-store)

Source (official): https://docs.expo.dev/versions/latest/sdk/securestore/ (SDK v57.0.0)
Source (official, plugin backup detail): same page + the mdx on GitHub
(https://github.com/expo/expo/blob/main/docs/pages/versions/unversioned/sdk/securestore.mdx)

### 1. Exists / maintained / Android mechanism
- **Exists and is maintained** as a first-party Expo module at SDK 57 (docs page is
  versioned v57.0.0).
- **Android mechanism:** values are stored in **SharedPreferences, encrypted with
  Android's Keystore system.** (Verified — exact doc phrasing: values are "encrypted
  using Android's Keystore system" and stored in SharedPreferences.) So it is the
  encrypted-SharedPreferences-with-a-Keystore-key pattern the question guessed.

### 2. Value size limit / sync vs async / dev client
- **Value size:** doc states "Large payloads can be rejected by the underlying
  platform. Historically, some iOS releases refused values above roughly **2048
  bytes**." No hard documented Android byte cap. **API keys (tens–hundreds of bytes)
  are far under any limit — non-issue.**
- **API:** both **async** (`setItemAsync`, `getItemAsync`, `deleteItemAsync`) and
  **sync** (`setItem`, `getItem`) methods exist.
- **Custom dev client / bare:** works. It also works in Expo Go (with the caveat that
  `requireAuthentication` is unsupported in Expo Go). Since this app already uses a
  custom dev client, full functionality is available. (Verified.)

### 3. Special Android config
- Requires the **config plugin** (added to `plugins` in app config) primarily to wire
  up **Android Auto Backup exclusion**. No special runtime Android *permission* is
  required. The plugin exposes `configureAndroidBackup` (default `true`). (Verified on
  docs page; corroborated by search of the same docs.)

### 4. Data-loss caveats — THE IMPORTANT ONE
- **Uninstall:** on Android, "Data saved using `expo-secure-store` **will not be
  preserved upon app uninstallation**." (iOS differs — persists across reinstall.)
- **Backup/restore:** The Keystore key that decrypts the SharedPreferences blob **is
  deleted from the Android Key Store when the app is uninstalled**, so a backed-up copy
  of the encrypted values **is impossible to decrypt after a restore.** That is exactly
  why the config plugin *excludes* SecureStore from Auto Backup by default
  (`configureAndroidBackup: true` injects `<exclude domain="sharedpref"
  path="SecureStore"/>`). (Verified via docs page + search of the same docs.)
  - **Consequence for this app:** the API key **cannot** survive a device migration /
    backup-restore regardless of `android:allowBackup`. The app's existing
    `android:allowBackup=false` is therefore consistent with, and not defeated by,
    secure-store — but note it also means **the user must re-enter the key after
    reinstall or new device.** Plan the key-entry UX to expect a missing key at any
    launch; never assume it persists across a reinstall.
- **Biometric changes:** any value written with `requireAuthentication: true` "will
  become inaccessible if there are changes to the user's biometric settings, such as
  adding a new fingerprint." (Verified.) → If we use `requireAuthentication`, a
  fingerprint change silently invalidates the stored key. For a low-friction API key,
  storing WITHOUT `requireAuthentication` avoids this failure mode.

### 5. Is plaintext-in-SQLite an accepted Expo fallback for secrets?
No. Expo's guidance treats **expo-secure-store as the mechanism for secrets/keys**
(the module's stated purpose is to "encrypt and securely store key–value pairs
locally"); the docs offer no plaintext-storage fallback for sensitive values. Plaintext
in the SQLite settings row (as inherited from the Obsidian plugin's JSON settings file)
is **not** an Expo-endorsed pattern for an API key. Recommendation: store the key via
expo-secure-store, not in the `contacts`/settings SQLite tables.
Source: https://docs.expo.dev/versions/latest/sdk/securestore/

---

## TOPIC 2 — requestUrl → fetch port (RN 0.86 / Hermes, Expo SDK 57)

### 1. Global fetch available + recommended
- **Yes.** React Native networking doc: "React Native provides the **Fetch API** for
  your networking needs." XMLHttpRequest is also built in (axios etc. work). Fetch is
  presented as the primary/recommended mechanism. (Verified.)
  Source: https://reactnative.dev/docs/network
- **Expo nuance (decision-relevant):** In Expo SDK 57, **`expo/fetch` is installed as
  the global `fetch`** on Android/iOS by default — a **WinterCG-compliant** Fetch
  implementation "that works consistently across web and mobile environments" — unless
  `EXPO_PUBLIC_USE_RN_FETCH=1` is set. So on this app the global `fetch` is Expo's
  WinterCG fetch, not the bare-RN whatwg-fetch polyfill. (Verified.)
  Source: https://docs.expo.dev/versions/latest/sdk/expo/ (SDK v57.0.0)

### 2. AbortController / AbortSignal for cancelling a fetch
- **Standard Fetch semantics:** aborting via `AbortController.abort()` is the spec
  mechanism; MDN documents the resulting `AbortError` DOMException.
  Source: https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch
- **BUT bare React Native's implementation has had real, documented defects.** Open RN
  issue #50015 (filed against **RN 0.76.1**, 2025-03-13, still **open**,
  "Needs: Attention / Needs: Repro") reports: `DOMException` type doesn't exist;
  `abortController.abort()` appears to have no effect and `signal.reason` stays
  undefined; `signal.throwIfAborted()` missing; reporter "haven't fully verified …
  but it looks like AbortController doesn't actually fully abort `fetch` requests."
  Separately, `AbortSignal.timeout()` throws "is not a function" on Hermes (RN issue
  #42042). Source: https://github.com/facebook/react-native/issues/50015
- **Net assessment:** AbortController is *present* but historically unreliable on
  bare-RN/Hermes. **Because this app runs Expo SDK 57 where the global fetch is
  `expo/fetch` (WinterCG-compliant), abort support is more likely to behave to spec** —
  but I could NOT fetch an explicit statement in the Expo docs confirming
  `expo/fetch` honors `AbortSignal`. **UNVERIFIED for `expo/fetch` specifically;
  verify empirically on-device before relying on the Cancel button** (fire a request,
  call `abort()`, confirm the promise rejects with an AbortError and the socket
  closes). Do not assume the RN-core defects are fixed just because RN is now 0.86 —
  the issue is still open.

### 3. Timeouts
- **No built-in fetch timeout.** MDN's fetch page documents no timeout option; RN's
  networking doc does not mention timeouts. Timeout must be implemented with
  **AbortController + setTimeout** (call `abort()` when the timer fires). Note the
  `AbortSignal.timeout()` convenience helper is reported broken on Hermes (issue
  #42042) — use the manual `new AbortController()` + `setTimeout(() => c.abort(), ms)`
  pattern, not `AbortSignal.timeout()`. (Verified: absence in both docs;
  `AbortSignal.timeout` breakage from search of RN issues.)
  Sources: https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch ,
  https://reactnative.dev/docs/network

### 4. fetch does NOT reject on HTTP 4xx/5xx — CONFIRMED
- MDN, exact wording: "A `fetch()` promise only rejects when the request fails, for
  example, because of a badly-formed request URL or a network error. A `fetch()`
  promise **does not** reject if the server responds with HTTP status codes that
  indicate errors (`404`, `504`, etc.). Instead, a `then()` handler must check the
  `Response.ok` and/or `Response.status` properties."
  Source: https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch
- **Impact on the port:** the Obsidian plugin used `requestUrl()`, which (unlike fetch)
  **throws on non-2xx**. Code ported by swapping `requestUrl → fetch` that relies on a
  thrown error to detect a bad API key / rate-limit / 500 **will silently treat an HTTP
  error as success** and try to parse an error body as a completion. The ported layer
  MUST add an explicit `if (!response.ok) { throw ... }` (reading status + body) at
  every call site. This is the highest-risk item in the port.

### 5. Streaming (ReadableStream) reliability — app uses stream:false today
- The app's non-streaming (`stream:false`) requests are unaffected. For any *future*
  token-streaming: **bare-RN/Hermes global fetch has historically NOT exposed a real
  WHATWG `ReadableStream` on `response.body`** (RN core issue #27741, long-standing;
  Hermes ships a minimal fetch polyfill without WHATWG streams — corroborated by
  community write-ups, treat as indicative not authoritative). **However, Expo SDK 57's
  `expo/fetch` explicitly demonstrates streaming via `resp.body.getReader()`** in its
  official docs, so on THIS app streaming is plausible through `expo/fetch`.
  If streaming is ever adopted, prototype against `expo/fetch` specifically and verify
  on-device.
  Sources (official): https://docs.expo.dev/versions/latest/sdk/expo/ ;
  (RN gap) https://github.com/facebook/react-native/issues/27741

### 6. Android network security / cleartext gotchas
- **HTTPS to api.openai.com / api.anthropic.com / generativelanguage.googleapis.com:**
  no cleartext concern — all HTTPS, permitted by the default base-config. No special
  config needed for these. (Verified via Android default base-config below.)
- **Default cleartext policy (release build):** Android developer docs — "Starting with
  Android 9 (API level 28), cleartext support is **disabled by default**." Default
  base config is `cleartextTrafficPermitted="false"`. So a **user-entered custom/LAN
  endpoint over plain `http://192.168.x.x:1234` WILL be blocked** by default in a
  release build (the fetch fails with a cleartext-not-permitted error).
  Source: https://developer.android.com/privacy-and-security/security-config
- **What it takes to allow a plain-http LAN endpoint:**
  - Coarse: enable cleartext globally. In Expo, the official mechanism is the
    **`expo-build-properties`** config plugin, `android.usesCleartextTraffic: true`
    ("For Android 9 and above, the default platform-specific value is `false`").
    Requires a native rebuild (custom dev client / prebuild) — not an OTA/JS-only
    change. Source: https://docs.expo.dev/versions/latest/sdk/build-properties/
    (Note: there is **no** top-level `android.usesCleartextTraffic` in the Expo *app
    config* reference — https://docs.expo.dev/versions/latest/config/app/ — the
    supported route is the build-properties plugin.)
  - Granular (preferred if we must support http LAN): ship a
    `network_security_config.xml` with a `<domain-config
    cleartextTrafficPermitted="true">` for just that host, keeping global default
    HTTPS-only. Android docs give this exact per-domain pattern. **Caveat:** a
    user-typed arbitrary LAN IP can't be pre-listed in a static XML, so supporting
    arbitrary http endpoints effectively forces the coarse global-cleartext switch —
    a security-posture tradeoff that is an **owner decision**, not an engineering one.
    Source: https://developer.android.com/privacy-and-security/security-config

---

## Sources (all fetched on 2026-08-14)
- Expo SDK 57 changelog — https://expo.dev/changelog/sdk-57
- expo-secure-store (SDK v57) — https://docs.expo.dev/versions/latest/sdk/securestore/
- expo-secure-store mdx — https://github.com/expo/expo/blob/main/docs/pages/versions/unversioned/sdk/securestore.mdx
- RN networking — https://reactnative.dev/docs/network
- expo/fetch (SDK v57) — https://docs.expo.dev/versions/latest/sdk/expo/
- MDN Fetch — https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch
- RN issue #50015 (AbortController) — https://github.com/facebook/react-native/issues/50015
- RN issue #27741 (fetch streams) — https://github.com/facebook/react-native/issues/27741
- Android network security config — https://developer.android.com/privacy-and-security/security-config
- expo-build-properties — https://docs.expo.dev/versions/latest/sdk/build-properties/
- Expo app config reference (no usesCleartextTraffic) — https://docs.expo.dev/versions/latest/config/app/

## Explicitly UNVERIFIED (do not report as fact)
- Whether `expo/fetch` honors `AbortSignal` correctly on-device — no official doc
  statement fetched. Verify empirically.
- Exact hard byte cap for Android secure-store values — only the ~2048-byte historical
  iOS figure is documented; no Android number given. Irrelevant for API keys.
- Whether RN-core AbortController defects (#50015) are fixed in RN 0.86 — issue still
  open; not confirmed fixed.
