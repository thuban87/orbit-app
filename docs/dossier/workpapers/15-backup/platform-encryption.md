# Platform verification — encrypting a JSON backup on Expo SDK 57

**Scope:** Can Orbit optionally encrypt a few-MB JSON backup file with a user-supplied
passphrase, on Expo SDK 57 / RN 0.86, in a prebuilt (custom dev client) Android app?
**Method:** current official docs + primary sources (Expo docs, expo-crypto CHANGELOG,
npm registry, margelo docs). NOT training data.
**Date:** 2026-08-14. **Verifier:** platform verifier agent.

> Context that is already decided (not re-litigated here): the app already ships a custom
> dev client / prebuild (the widget forces it), so third-party native modules and Expo
> config plugins are on the table. API keys live in expo-secure-store and are excluded
> from the backup.

---

## Headline correction to the stated prior belief

The task stated a belief that `expo-crypto` is "hashing/digest + random bytes + UUID
only, with NO symmetric cipher." **That is now out of date.** As of **expo-crypto
v55.0.0 (2026-01-21)** the library ships **AES-256-GCM authenticated encryption**, and
it is present in the SDK 57 line.

- Source: expo-crypto CHANGELOG — "Added support for AES-GCM encryption" (PR #41249),
  v55.0.0, 2026-01-21. Later fix v55.0.3 (2026-01-27). SDK 57 releases: 57.0.0
  (2026-06-25), 57.0.1 (2026-07-15).
  https://raw.githubusercontent.com/expo/expo/main/packages/expo-crypto/CHANGELOG.md
- Source (API): https://docs.expo.dev/versions/v57.0.0/sdk/crypto/ and
  https://docs.expo.dev/versions/latest/sdk/crypto/

---

## 1. expo-crypto — actual SDK 57 API surface

Verified against the official SDK 57 docs and the raw unversioned `crypto.mdx`.

**Hashing / random / id (the classic surface):**
- `digest()` — digest of a TypedArray
- `digestStringAsync(algorithm, data, options)` — string hash, HEX/BASE64 out
- `getRandomBytes(byteCount)` / `getRandomBytesAsync(byteCount)` — CSPRNG bytes,
  `byteCount` range **0–1024** (fine for a 16-byte salt and 12-byte GCM nonce)
- `getRandomValues(typedArray)` — fills a TypedArray
- `randomUUID()` — UUIDv4
- Enums: `CryptoDigestAlgorithm` (MD2/MD4/MD5/SHA1/SHA256/SHA384/SHA512),
  `CryptoEncoding` (HEX/BASE64)

**Symmetric encryption (NEW, present in SDK 57):**
- `aesEncryptAsync(...)` / `aesDecryptAsync(...)` — AES-GCM
- `AESEncryptionKey` — `AESEncryptionKey.generate(size)` (random key), `.import()`
  (raw/encoded key material), `.encoded()` (export hex/base64)
- `AESSealedData` — `.combined()` / `.fromCombined()` / `.fromParts()` (packs
  nonce + ciphertext + auth tag)
- `AESKeySize` enum: 128 / 192 / 256

**What expo-crypto does NOT provide:**
- **No PBKDF2 / scrypt / Argon2 — no password-based key derivation of any kind.** Keys
  are either randomly generated (`AESEncryptionKey.generate`) or imported as raw bytes.
  This is the one real gap for a *passphrase*-encrypted backup. (Confirmed against both
  the SDK 57 and unversioned docs — no KDF function documented.)
- No RSA / asymmetric, no HMAC helper beyond hashing.

**Note on a bad third-party claim:** a blog result
(codingeasypeasy.com) asserts expo-crypto uses "AES-256-CBC with HMAC-SHA256." That is
**wrong** — official docs say **AES-GCM**. Discard the blog; trust the Expo docs.

---

## 2. Realistic options for AES-256-GCM (authenticated) of a string/file, 2026

### (a) expo-crypto AES-GCM — first-party, likely already in tree
- Native (Android/iOS), on-device, no network → respects local-first.
- Gives the cipher for free. **Missing piece: the passphrase → key KDF.** You would have
  to source a KDF elsewhere (see §3). Hand-rolling PBKDF2 out of `digestStringAsync` in
  JS (looping SHA-256 for 100k+ iterations on Hermes) is slow and a foot-gun — not
  recommended.

### (b) react-native-quick-crypto (RNQC) — one maintained native dep, Node parity
- **Latest: 1.1.6, published 2026-07-09** (npm registry `dist-tags.latest`).
- Peer deps (v1.1.6): `react-native-nitro-modules >=0.31.2`,
  `react-native-quick-base64 >=3.0.0`, **`expo >=48.0.0`**, `expo-build-properties`,
  `react: *`, `react-native: *`.
- Architecture: **v1.x is New Architecture / bridgeless, built on Nitro Modules (C++/JSI).
  Minimum RN 0.75.** RN 0.86 is well above that, and SDK 57 has the New Architecture
  always-on — so it is a match. (v0.x = old-arch bridge line, not relevant.)
  https://github.com/margelo/react-native-quick-crypto ,
  https://crypto.margelo.com/docs/introduction/quick-start
- **Expo config plugin exists.** Add to `app.json`:
  `"plugins": [["react-native-quick-crypto", { "sodiumEnabled": true }]]`, then
  `npx expo prebuild`. Requires a dev build (not Expo Go) — which Orbit already is.
- Capabilities (WebCrypto `subtle` docs + Node `crypto` parity): **PBKDF2, HKDF, Argon2
  (d/i/id), scrypt (Node API), AES-GCM / AES-CBC / AES-CTR, ChaCha20-Poly1305, HMAC,
  randomBytes.** `crypto.subtle.deriveBits/deriveKey` with `"PBKDF2"` and
  `encrypt/decrypt` with `"AES-GCM"`, `importKey` raw/jwk.
  https://margelo.github.io/react-native-quick-crypto/docs/api/subtle
- Trade-off: one more native module + config plugin + Nitro dependency chain. Marginal
  cost is low *because the app is already prebuilt with config plugins for the widget.*

### (c) Pure-JS (crypto-js / WebCrypto polyfill)
- **Hermes has NO native `crypto.subtle`.** RN 0.86 / Hermes does not implement the Web
  Crypto API; `crypto.getRandomValues` and `crypto.subtle` must be polyfilled. Confirmed
  by multiple current sources. (A padosoft/laravel-iam doc claims "Web Crypto available
  on Hermes from RN 0.71+" — this is **contradicted** by the authoritative statement
  "the Hermes JavaScript engine does not natively implement the crypto Web API"; the
  0.71+ claim refers to *polyfills being importable*, not native support. Treat padosoft
  as unreliable.)
  https://www.callstack.com/blog/increase-speed-and-security-with-native-crypto-libraries
- `crypto-js` works but is pure-JS: AES + PBKDF2 in JS is **slow** for a multi-MB file
  and PBKDF2 at safe iteration counts, and crypto-js is widely regarded as low-assurance
  / maintenance-light. Acceptable only as a last resort; not recommended when a native
  option is already available.

### (d) expo-secure-store — NOT an option for the file
- Small key/value secrets only, **Android hard limit ~2048 bytes per value** (SharedPreferences
  encrypted by Android Keystore). A few-MB backup does not fit. Correct role: hold the
  API keys (already does) — not the backup blob.
  https://docs.expo.dev/versions/latest/sdk/securestore/
- **No first-party Expo module for file/blob encryption exists.** expo-crypto AES-GCM is
  the closest first-party primitive; there is no `expo-file-encryption` equivalent.
  (Confirmed — nothing of the sort in the SDK.)

---

## 3. Passphrase → key derivation (the actual crux)

A passphrase-encrypted backup **requires a real KDF** (salt + high iteration count /
memory-hard) so the passphrase can't be brute-forced offline. This is the deciding
factor, because the *cipher* is now essentially free (expo-crypto) but the *KDF* is not
in expo-crypto.

| Source | PBKDF2 | scrypt | Argon2 | Notes |
|---|---|---|---|---|
| expo-crypto | ✗ | ✗ | ✗ | only `digestStringAsync` (raw SHA) + random bytes |
| react-native-quick-crypto 1.1.6 | ✓ | ✓ (Node API) | ✓ (subtle) | native, fast, correct |
| crypto-js (pure JS) | ✓ | ✗ | ✗ | slow at safe iterations |

**Recommendation:** use **PBKDF2-HMAC-SHA256** (widely supported, FIPS-y, simplest) or
Argon2id (stronger, memory-hard) with a random 16-byte salt from
`getRandomBytes`/`randomBytes`, ≥ a few-hundred-thousand PBKDF2 iterations, deriving a
256-bit key, then AES-256-GCM with a fresh 12-byte nonce. Store `salt || nonce ||
ciphertext || tag` in the file header. RNQC gives all of this in one native library.

---

## 4. Bottom line — feasibility verdict

**Buildable in v1. The only real design choice is where the passphrase KDF comes from.**

Two clean routes:

- **Route A — RNQC (recommended, one dependency, correct end-to-end).**
  `react-native-quick-crypto@1.1.6` gives PBKDF2/scrypt/Argon2 **and** AES-256-GCM in one
  maintained, native, Node-parity library with a working Expo config plugin. RN 0.86 ≥
  its min RN 0.75; New-Arch/Nitro requirement is satisfied (SDK 57 is New-Arch-only). The
  app is already prebuilt with config plugins, so the marginal native-integration risk is
  **Moderate** (one Nitro module + `expo prebuild` + a smoke test on the physical Pixel).
  **Verdict: Moderate.**

- **Route B — expo-crypto AES-GCM + a KDF you source separately.**
  If you want to avoid a heavyweight native crypto dep, expo-crypto already does the
  AES-256-GCM half at **zero** added dependency. But you must still get a real KDF from
  somewhere, and the only *safe* choices are (i) RNQC anyway (defeats the point) or (ii) a
  small pure-JS PBKDF2 — slow, lower assurance. Hand-rolling PBKDF2 from `digestStringAsync`
  is discouraged. **Verdict if you accept a pure-JS KDF: Moderate–Heavy (correctness
  risk in the KDF, not the cipher).**

- **Not viable:** relying on native Hermes WebCrypto (doesn't exist), expo-secure-store
  for the blob (2 KB cap), or a first-party file-encryption module (none exists).

**Single recommended dependency:** `react-native-quick-crypto@1.1.6` (PBKDF2/Argon2 +
AES-256-GCM, Expo config plugin, New-Arch/Nitro, RN ≥ 0.75). This is the lowest-risk way
to ship *optional passphrase-encrypted backup* correctly.

**Owner-bucket note:** the *shape* of the crypto (KDF choice, iteration count, whether to
add a native crypto dependency at all vs. shipping backups unencrypted in v1) is a
risk/security-posture decision, i.e. the owner's call — this workpaper only establishes
that it is technically feasible and at what cost.

---

## Flags / unverifiable

- The margelo **implementation-coverage** page 404'd at the two URLs tried; PBKDF2/AES-GCM
  support was instead confirmed from the RNQC **subtle** API docs and Node-parity claims.
  Exact per-algorithm coverage table not directly captured — verify the coverage doc
  before committing to Argon2 vs PBKDF2 specifically.
- RNQC's own docs page did not state a min-RN number; the **RN ≥ 0.75 / New-Arch-only**
  requirement for the 1.x line comes from the npm page + GitHub README summary. Re-confirm
  against the RNQC README at pin time.
- `sodiumEnabled: true` in the config-plugin example pulls in libsodium (needed for some
  algorithms). Confirm whether PBKDF2+AES-GCM alone need it, to keep the native footprint
  minimal.

## Sources
- expo-crypto API (SDK 57 / latest): https://docs.expo.dev/versions/v57.0.0/sdk/crypto/ , https://docs.expo.dev/versions/latest/sdk/crypto/
- expo-crypto CHANGELOG (AES-GCM added v55.0.0, 2026-01-21): https://raw.githubusercontent.com/expo/expo/main/packages/expo-crypto/CHANGELOG.md
- expo-secure-store (2 KB Android limit): https://docs.expo.dev/versions/latest/sdk/securestore/
- react-native-quick-crypto npm (1.1.6, 2026-07-09, peer deps): https://registry.npmjs.org/react-native-quick-crypto
- RNQC repo + quick-start (Nitro, RN ≥0.75, Expo config plugin): https://github.com/margelo/react-native-quick-crypto , https://crypto.margelo.com/docs/introduction/quick-start
- RNQC subtle/WebCrypto (PBKDF2, AES-GCM, Argon2, importKey): https://margelo.github.io/react-native-quick-crypto/docs/api/subtle
- Hermes lacks native Web Crypto (polyfill required): https://www.callstack.com/blog/increase-speed-and-security-with-native-crypto-libraries
