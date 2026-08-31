# ADR-003: `READ_CONTACTS` on API 37+ for the Reconcile feature

- **Status:** Accepted — 2026-08-31
- **Decision scope:** Phase 20 contact reconciliation / merge — the on-device contact **re-read** path. **Supersedes in part [ADR-002](./ADR-002-hybrid-two-picker-contact-import.md)**: specifically its "**Android 17+ (API ≥ 37): … No `READ_CONTACTS`**" clause and the `android:maxSdkVersion="36"` scoping, *for the reconcile feature only*. ADR-002's two-picker **import** design is unchanged.

## Context

ADR-002 established a hybrid two-picker **import** layer: API 37+ uses the permissionless system Contact Picker; API ≤ 36 uses an in-app custom picker backed by `READ_CONTACTS` scoped `android:maxSdkVersion="36"` (inert on API 37). Its rejected-alternatives list turned down "broad `READ_CONTACTS` active on API 37" on Google-Play-Contacts-policy grounds.

Phase 20 then built **reconciliation** (`Update from Contacts`, `Check linked contacts`) on top of `orbit-contact-picker`'s `readAllContacts(lookupKeys)` → `readContactsByLookupKeys` → a **direct `ContactsContract` provider query** (`OrbitContactPickerModule.kt`). That query requires runtime `READ_CONTACTS`. Because the permission is capped at `maxSdkVersion=36`, it is **absent on API 37+**, so on the owner's Pixel 6 Pro (API 37) both reconcile entry points fail: *"Could not read Contacts right now."* / *"Could not check linked contacts right now."* (logcat: `Permission Denial … requires android.permission.READ_CONTACTS`).

This was invisible until the **first Phase-20 device UAT** (2026-08-31): automated tests mock the native module, and import/merge/birthday-review don't hit the reconcile re-read. See `.planning/phases/20-contact-reconciliation-merge/20-UAT-BLOCKER-read-contacts.md`.

The reconcile feature fundamentally needs to re-read the **current state of an already-linked set** of contacts to detect drift (additive / conflict / removed / missing) and sync it into Orbit. The system Contact Picker cannot serve this: it returns a fresh user *selection*, not a diff of previously-linked contacts, and forcing the user to re-pick their entire linked set on every `Check linked contacts` sweep is not a technical equivalent of ongoing change-detection.

## Current Google Play Contacts policy (verified 2026-08-31)

Announced 2026-04-15; declaration prompts begin ~Sept 2026; **mandatory compliance ~Jan 2027** (30-day extensions available). Apps targeting API 37+ **may** request `READ_CONTACTS` via a **Play Console declaration** that (a) names the user-facing feature from Google's list — which **explicitly includes "CRM"** (plus Contact Management, Backup/Restore, Friend Matching), and (b) technically justifies why the Contact Picker is insufficient. Google is explicit that a *custom picking UI alone does not qualify* — the justification must rest on functionality the picker **cannot technically support**.

Orbit is a social CRM whose reconcile/`Check linked contacts` feature is ongoing change-detection across a linked set — a named qualifying category (CRM / Contact Management) and a genuine picker-incompatible use case.

## Decision

1. **Lift the `maxSdkVersion="36"` cap** on `READ_CONTACTS` at **both** enforcement points so the permission applies on API 37+: (a) `modules/orbit-contact-picker/android/src/main/AndroidManifest.xml` (the library manifest), and (b) **`plugins/withContactPickerPermission.js`** — the Expo config plugin that writes `READ_CONTACTS` into the prebuild-generated *app* manifest. The app manifest wins the Gradle manifest-merge, so the plugin is the decisive one; a fix to the library manifest alone is silently overridden (discovered during the ADR-003 build verification, 2026-08-31).
2. **Gate the reconcile reads behind an in-context runtime request.** `ReconcileDetailScreen` and `ReconcileGridScreen` call `ensureReadContactsPermission()` (check → request via the existing `use-read-contacts-permission` machinery) **before** `readAllContacts`. The request fires in-context of the user's own tap on `Update from Contacts` / `Check linked contacts` (Android-recommended). On denial the screens surface a calm "needs Contacts access" state with an Open-Settings action — never a silent failure.
3. **Import is unchanged.** Acquisition still uses the permissionless system picker on API 37 and the in-app picker on ≤36. Only the reconcile **re-read** consumes `READ_CONTACTS`.
4. **Play declaration is a release-gate obligation.** Before Play submission, file the Contacts declaration: category **CRM / Contact Management**; justification = ongoing reconcile/change-detection across an already-linked set, which the one-shot Contact Picker cannot technically provide.

## Rejected Alternatives

- **Re-architect reconcile onto the system picker (user re-picks to refresh).** Rejected for the bulk `Check linked contacts` sweep: re-picking the entire linked set on every check is not ongoing change-detection and guts the feature's value; it also would not clearly satisfy the policy's "picker cannot technically support" test any better than the honest CRM declaration.
- **Scope reconcile to API ≤ 36 only.** Rejected — leaves the headline feature inert on modern Android.
- **Keep ADR-002's cap and treat reconcile-on-API-37 as a known gap.** Rejected by the owner (2026-08-31) in favor of shipping the feature under a legitimate declaration.

## Consequences

- On API 37+, Orbit now requests `READ_CONTACTS` the first time the user enters a reconcile flow. This is a real, user-visible permission prompt and a Play Data-safety / declaration obligation (tracked as a release checklist item).
- The "permissionless on API 37" property from ADR-002 no longer holds for reconcile; it still holds for import.
- Reverts none of ADR-002's import behavior. The cap lives in TWO places (library manifest + `withContactPickerPermission.js` config plugin); both must drop it, and the config plugin is decisive because the app manifest wins the merge.
- Reconcile now depends on an OS-owned permission that the user can revoke; the screens must always handle the ungranted state (they do, per decision #2).
