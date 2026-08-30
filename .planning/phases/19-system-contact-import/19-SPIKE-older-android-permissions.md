# Spike: Permissionless contact reads on older Android (14/15) — for the Android-17-only reversal

**Date:** 2026-08-29 · **Question:** If we reverse the "Android 17+ picker only" decision to support the Pixel 3a (Android 14/15), can we still keep the locked "**no `READ_CONTACTS`**" posture and get a *rich* contact import (multiple phones/emails, birthday, photo, multi-select)?
**Method:** Authoritative-docs research (official Android docs + current 2026 migration writeups). **Not** empirically tested — the 3a isn't connected and the connected Pixel 6 Pro's `ACTION_PICK` routes through the broken Android-17 trampoline. Empirical confirmation of the single-field path is deferred to the 3a.

## Bottom line

**No.** A *rich* permissionless contact import is **not possible below Android 17.** That capability is exactly what Android 17's picker was created to provide — its absence on older Android is the whole reason the picker exists.

## What the sources establish

1. **Official Android docs (Contacts Provider — Retrieve Details):** *"To read from the Contacts Provider, your app must have `READ_CONTACTS` permission."* Applies to **all** retrievals — full details, specific fields (phones/emails/events/photo), **any** content URI **regardless of how it was obtained**. There is **no documented URI-grant exception** for an `ACTION_PICK`-selected contact. [official]
2. **The one permissionless path is single-FIELD, not rich:** `ACTION_PICK` with `Phone.CONTENT_TYPE` / `Email.CONTENT_TYPE` returns a URI to **one data row** (one phone, or one email — plus the display name on that row), and the OS grants read to *"that single piece of data"* only. You **cannot** enumerate a contact's multiple methods, birthday, or photo this way. [CommonsWare; WeblineGlobal]
3. **Multi-select is unavailable permissionlessly on older Android**, and even the multi-select extra is unreliable: *"many OEM contact apps on Android 10–13 ignore this extra, falling back to single selection."* [WeblineGlobal]
4. **Android 17 auto-upgrades `ACTION_PICK`** to the new permissionless picker for apps targeting API 37 (which is why classic `ACTION_PICK` on the 6 Pro hit `com.android.contactspicker`). [official / Android Developers Blog]
5. **Google Play Contacts policy** (announced 2026-04-15, effective **2027-01-27**): apps targeting API 37+ may request `READ_CONTACTS` **only if the Contact Picker is insufficient for core functionality.** orbit targets API 37 and is built for distribution, so a blanket `READ_CONTACTS` is a real Play-Store risk. [Capawesome; Android docs]

## What this means for the reversal — three real options

| Option | Older Android (3a) behavior | Privacy | Play-policy | Rich import (methods/birthday/photo)? |
|---|---|---|---|---|
| **A — pure no-permission** | Single-field `ACTION_PICK`: **name + one phone (or one email) per pick.** No birthday, no photo, no multi-method, one contact at a time. | ✅ absolute | ✅ fine | ❌ **No** — guts the feature; birthday-validation / photo-staging / consolidation become largely moot on older devices |
| **B — broad `READ_CONTACTS` everywhere** | Full rich + multi-select via custom picker | ❌ broad permission on all versions | ⚠️ **risk** — API-37 target requesting `READ_CONTACTS` hits the Jan-2027 policy | ✅ Yes |
| **HYBRID (industry standard)** | **17+**: permissionless system picker (no permission). **≤16**: `READ_CONTACTS` **scoped with `android:maxSdkVersion="36"`** + a custom picker for full fields/multi-select | ✅ permission only on old devices, never on 17+ | ✅ compliant — permission is inert on API-37 devices, so the "targeting 37" restriction is satisfied | ✅ Yes on all versions |

**The reframing:** the owner's lean was "Path A — do it right, no `READ_CONTACTS`." But on older Android, "no `READ_CONTACTS`" means a **thin single-field import** (name + one number), not the rich import the whole 19-13→19-16 pipeline is built for. The genuine "do it right" for *cross-version* is the **HYBRID**: keep the permissionless picker on 17+, and add a `maxSdkVersion="36"`-scoped `READ_CONTACTS` + custom picker only on older devices. That preserves the privacy posture where it matters, stays Play-policy-compliant, and is the pattern the migration guides recommend.

## Caveats / to confirm empirically on the 3a
- The exact fields returned by single-field `ACTION_PICK` (does the display name always come with the phone row?) — minor, only matters if Option A is chosen.
- Whether the 3a's OEM contacts app honors any multi-select extra (docs say usually not).
- That a `maxSdkVersion="36"`-scoped `READ_CONTACTS` + a custom picker actually reads the rich fields on the 3a (expected yes — this is the standard pre-17 path).

## Sources
- Android docs — Retrieve contact details (READ_CONTACTS required): developer.android.com/training/contacts-provider/retrieve-details
- Android 17 Contact Picker (auto-upgrade, permissionless): developer.android.com/about/versions/17/features/contact-picker
- CommonsWare — Runtime Permissions, ACTION_PICK, and Contacts
- WeblineGlobal — READ_CONTACTS Deprecation: Hybrid Migration Strategy (maxSdkVersion fallback; OEM multi-select unreliability)
- Capawesome — Google Play Contacts Policy 2027
