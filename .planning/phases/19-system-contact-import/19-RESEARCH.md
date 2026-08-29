# Phase 19: System Contact Import - Research

**Researched:** 2026-08-28
**Domain:** Android privacy-preserving contact acquisition (Android 17 Contact Picker) · durable/resumable SQLite import sessions · conservative duplicate assessment on Phase 18.1's normalized-method + external-linkage model · Orbit-owned photo import
**Confidence:** HIGH on the in-repo data-layer foundations (read on disk this session); MEDIUM on the Android 17 Contact Picker API (brand-new, 2026, verified against official Android docs but not against a device); LOW on picker granular field support for **birthday** and **photo** (undocumented — device tracer required)

---

<user_constraints>
## User Constraints (from CONTEXT.md + owner rulings)

### Locked Decisions (from 19-CONTEXT.md, the dossier, and the UI-SPEC owner round)
- **Read the dossier as authoritative.** Every `[DECIDED]`/`[REJECTED]`/`[DEFERRED]` line in `docs/dossier/19-system-contact-import.md` is a locked product decision, not a prompt to reopen.
- **ANDROID-ONLY for Phase 19** (owner ruling 2026-08-28, UI-SPEC "Open dependencies RESOLVED" #1). The dossier's `[DECIDED] iOS uses the native privacy-preserving contact picker` is honored as design intent for a LATER iOS milestone and is OUT OF SCOPE now (HANDOFF §11 iOS deferral). **Do not build a cross-platform picker abstraction this phase.** Structure the Android path so a future iOS path *could* slot behind a thin interface, but build only Android.
- **Import is deliberate, not address-book dumping.** Single import = full review before any write. Bulk import = shared defaults **Unbound + Uncategorized**, **no** per-person checkbox list after the picker returns.
- **System Contacts is source-only, never Orbit's authority.** Exact external linkage is deterministic; every other duplicate signal is advisory evidence. Ambiguity never silently links, merges, or blocks safe imports.
- **Imported review/session state is durable** once Orbit accepts the picker result. Safe partial commits stand; photo failures do not invalidate otherwise-valid records; cancellation/back preserves the locked no-write/confirmation boundaries.
- **Imported fields are exactly:** name, phone numbers, email addresses, birthday, photo. Postal/employer/title/notes/websites/social/arbitrary metadata are explicitly NOT imported this phase.
- **Speed-dial FAB** (owner-decided): the single `+` FAB expands into `Import from Contacts` / `Create manually`, Reanimated shared values only, no new library.
- **Confidence ladder is colourless** (owner-decided): advisory outcomes render as neutral `surfaceElevated` chips; NO new caution token this phase.
- **Preserve every Phase 20 / post-20 deferral:** ongoing refresh, remembered reconciliation state, refresh-all, generic Orbit-to-Orbit merge, source monitoring, provider-specific interaction tracking, notification-listener work.

### Claude's Discretion (delegated — research recommends, planner decides)
- Exact native picker wrapper / module boundary, unsupported-state detection mechanism, import-session schema, chunk size / concurrency, duplicate-scoring weights + thresholds (dossier marks weights `[OPEN — implementation tuning]`), transaction boundaries, retry semantics, E5 grid virtualization/paging strategy at thousands of candidates (UI-SPEC "Unresolved (1) — planner assumption").

### Deferred Ideas (OUT OF SCOPE — ignore completely)
- Ongoing `Update from Contacts`, field-by-field reconciliation, remembered discrepancies, "source changed" detection, refresh-all, batch reconciliation, stale/missing-source workflows, relinking after source recreation, rich multi-link management, generic Orbit-to-Orbit merge, any sync/conflict engine, photo-similarity matching, arbitrary metadata import, iOS.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **IMP-01** | Import begins from Add-flow or Settings via the privacy-preserving platform picker; Android targets the Android 17+ Contact Picker **without** broad legacy contacts permission; unsupported older Android leaves Orbit usable. | §Standard Stack (in-repo native module, no `expo-contacts`), §Pitfall 1 (API-37 gate), §Code Example 1 (native module), §Environment Availability (Android 17 device requirement). |
| **IMP-02** | Single contact → review before create/link; bulk → shared Unbound+Uncategorized defaults; import only name/phones/emails/birthday/photo; process large selections incrementally with no arbitrary app cap. | §Architecture Patterns (per-contact transaction + chunked driver), §Pitfall 5 (platform 100-cap ≠ app cap), `createContactFull` reuse (contacts-dao.ts:112), §Code Example 3. |
| **IMP-03** | Exact external linkage deterministic; every other duplicate signal conservative + advisory; ambiguity never silently merges/links or blocks safe batch imports; generic Orbit merge out of scope. | §Architecture Patterns (duplicate engine over `external_contact_links` + `contact_methods.canonical_value`), §Don't Hand-Roll (canonical match), §Pitfall 4. |
| **IMP-04** | Import review durable + resumable; cancellation before Orbit owns selection writes nothing; safe partial commits remain; photo failures don't invalidate contacts; completion reports bridge to Unbound contacts. | §Architecture Patterns (migration 012 session tables + launch-sweep resume), §Pitfall 2 (snapshot before the temporary grant expires), §Pitfall 3 (photo post-commit), §Runtime State Inventory. |
</phase_requirements>

---

## Summary

Phase 19 sits on an unusually well-prepared foundation. Phase 18.1 already shipped the two tables this feature's *deterministic* half needs: **`external_contact_links`** (`provider`, `external_contact_id`, `is_active`, with a partial-unique index enforcing one active link per external id) and **`contact_method_provenance`** [VERIFIED: src/db/migrations/011-contact-lifecycle-schema.ts:117-124, 228-233]. Phase 18.1 also normalized phone/email into `contact_methods` with a precomputed `canonical_value` [VERIFIED: src/db/migrations/011-contact-lifecycle-schema.ts:106-116], which is the deterministic-match key for canonical phone/email evidence. The contact create path (`createContactFull`) already accepts normalized method drafts and a Bound/Unbound `trackingEnabled` flag [VERIFIED: src/db/contacts-dao.ts:83-231], and the photo pipeline (`persistCroppedMaster` → `persistMaster` → `contactPhotoRelPath`) already produces Orbit-owned 512px masters [VERIFIED: src/services/photos/photo-storage.ts:83-86, 227-230]. **The genuinely net-new work is the acquisition layer and the session/duplicate orchestration on top of these primitives.**

The acquisition layer is the one high-risk unknown. The owner's locked decision — Android 17+ privacy-preserving Contact Picker, no `READ_CONTACTS` — **rules out `expo-contacts`**, whose `presentContactPickerAsync` still requires the broad `READ_CONTACTS` permission in the manifest on Android [CITED: docs.expo.dev/versions/latest/sdk/contacts]. The correct path is a **new in-repo Expo native module** (mirroring `modules/orbit-backup-document-picker/`) that launches `Intent.ACTION_PICK_CONTACTS` [CITED: developer.android.com/about/versions/17/features/contact-picker], reads the returned **session URI** with a `ContentResolver` projection, and copies the payload (including the photo blob) into Orbit's own storage before the temporary grant expires. This API is Android 17 / **API level 37** only [CITED: developer.android.com/about/versions/17/features/contact-picker] and brand-new (public docs dated March 2026), so its behavior — especially granular **birthday** and **photo** field support — must be proven on a real Android 17 device in the tracer slice, not assumed.

**Primary recommendation:** Build a thin in-repo native module `modules/orbit-contact-picker/` exposing `isContactPickerAvailable(): boolean` (gate on `Build.VERSION.SDK_INT >= 37`) and `pickContacts({ multiple, requestedFields }): Promise<PickedContact[]>` that returns a fully self-contained snapshot (name, phones, emails, birthday, a temp-file photo URI copied out of the grant). Persist that snapshot into new migration-**012** session tables the instant Orbit accepts it, then drive review/import purely from Orbit's own durable rows — never re-reading the expired picker URI. Reuse `createContactFull`, `external_contact_links`, `contact_method_provenance`, and the photo pipeline verbatim; add exactly one composed writer that wraps a contact + its methods + its external link + its provenance in **one** `inWriteTransaction` per contact, with the photo persisted **post-commit**.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Launch system picker, read session URI, copy payload+photo out of the temporary grant | Native (new Expo module, Kotlin) | — | `ACTION_PICK_CONTACTS` + `ContentResolver` are Android-native; the temporary grant lives only in the native activity result. JS cannot query the session URI. |
| Version/unsupported detection | Native (`SDK_INT` read) | JS (entry-point gating) | Only native sees `Build.VERSION.SDK_INT`; JS hides/disables the import entry from the result. |
| Durable import session + per-row review state | Data (SQLite, migration 012) | Service (session orchestration) | Must survive process death → SQLite, not in-memory/AsyncStorage. Local-first: no network. |
| Duplicate evidence + confidence ladder | Service (pure logic module, node-tested) | Data (reads `external_contact_links`, `contact_methods.canonical_value`) | Deterministic bypass is a DB lookup; advisory scoring is pure, tunable, testable logic. |
| Contact create/link write | Data (compose `createContactFull` + link/provenance in one txn) | — | Reuse the single-writer, mutex-guarded transaction contract. |
| Photo import (Orbit-owned master) | Service (`persistCroppedMaster`/`persistMaster`) | Data (`setContactPhoto`) | Reuse Phase 5 pipeline; independent post-commit failure handling. |
| Review UI, speed-dial FAB, card grid, progress, summary | Screen/Component (RN) | — | Per the approved UI-SPEC; all colours via theme tokens. |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **In-repo Expo native module** (new: `modules/orbit-contact-picker`) | n/a (local) | Launch `ACTION_PICK_CONTACTS`, read session URI, copy payload+photo to app cache, expose `SDK_INT` availability | The repo already ships three local native modules; `orbit-backup-document-picker` is a near-exact template (activity-result + `copyToCache`) [VERIFIED: modules/orbit-backup-document-picker/android/src/main/java/expo/modules/orbitbackupdocumentpicker/OrbitBackupDocumentPickerModule.kt:97-164] |
| `expo-sqlite` | ~57.0.1 (installed) | Migration 012 session tables; all reads/writes | Existing data layer [VERIFIED: package.json dependencies] |
| `react-native-reanimated` | 4.5.1 (installed) | Speed-dial FAB expand/collapse (shared values only, per CLAUDE.md animation rule) | Already a dependency; owner-decided no new lib [VERIFIED: package.json] |
| `libphonenumber-js` | 1.13.11 (installed) | Canonical phone normalization for imported numbers + duplicate match | Already the canonicalization engine behind `contact_methods.canonical_value` [VERIFIED: package.json; src/db/migrations/009-...ts:187] |
| `expo-image-manipulator` | ~57.0.10 (installed) | Resize imported photo blob → 512px JPEG master | The Phase-5 `persistCroppedMaster` pipeline [VERIFIED: package.json; STATE.md 05-04] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-file-system` | ~57.0.4 (installed) | Stage the picker photo temp file → durable session dir; `persistMaster` swap | Photo import path |
| `@react-native-picker/picker` | 2.11.4 (installed) | Batch **Category override** control + single-review category select | Reuse `CreateContactScreen` `pickerShell` idiom [VERIFIED: UI-SPEC reuse map] |
| `react-native-quick-base64` | 3.0.1 (installed) | If the picker returns the photo as a base64 blob (DATA15), decode → bytes | Only if native returns base64 rather than a temp-file URI (recommend the module return a temp-file URI, matching `copyToCache`) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-repo native module | **`expo-contacts.presentContactPickerAsync`** | **REJECTED for this phase:** requires `android.permission.READ_CONTACTS` in the manifest on Android [CITED: docs.expo.dev/versions/latest/sdk/contacts]. That is the exact broad legacy permission the dossier (Cluster B) and REQUIREMENTS.md line 204 (`READ_CONTACTS … Declined`) forbid. Do not add it. |
| In-repo native module | `react-native-contacts` / community pickers | Same READ_CONTACTS problem; unmaintained relative to the Android 17 privacy model; adds an unvetted dep. |
| Hand-rolled name similarity | `fastest-levenshtein` / `string-similarity` npm | Advisory-only + conservative + name-never-auto-links means a small **node-tested pure normalization + token-overlap** module is sufficient for MVP and avoids a new dep + legitimacy gate. Recommend hand-rolled logic here (it is *not* the "don't hand-roll" category — see below). Revisit a lib only if the owner wants richer fuzzy matching (tuning is `[OPEN]`). |

**Installation:** No new npm packages. The native module is local (`modules/orbit-contact-picker/`), registered via its `expo-module.config.json` exactly like the existing three modules. **Native change ⇒ the Plan's device UAT needs `expo prebuild --clean` + a release/debug APK via the desktop pipeline** (STATE.md build-pipeline note; run-as UAT needs a debug build per the device-UAT memory).

**Version verification:** `expo-contacts` confirmed NOT installed [VERIFIED: package.json — absent]. All reused libs confirmed present at the versions above [VERIFIED: package.json].

## Package Legitimacy Audit

> No external packages are installed by this phase. The picker is an **in-repo native module**, and all supporting libraries are already-vendored, already-audited dependencies.

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| (none — in-repo native module + existing deps only) | — | — | No install; no audit required |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

*If the planner later chooses to add a fuzzy-match npm library for name similarity (discretionary, not recommended for MVP), that install MUST pass the Package Legitimacy Gate and be gated behind a `checkpoint:human-verify` task — consistent with the repo's native-dep checkpoint precedent (react-native-android-widget, react-native-reorderable-list).*

---

## Architecture Patterns

### System Architecture Diagram

```
 [Dashboard speed-dial FAB]        [Settings ▸ Contacts Integration]
        │ "Import from Contacts"            │ "Import contacts"
        └───────────────┬───────────────────┘
                        ▼
        isContactPickerAvailable()  ── false (SDK_INT < 37) ──▶ Unsupported state
                        │ true                                   ("requires Android 17+")
                        ▼
   NATIVE MODULE  pickContacts({multiple, requestedFields})
        launch ACTION_PICK_CONTACTS ─▶ system Contact Picker UI ─▶ user selects 1..N
        RESULT_OK + session URI ─▶ ContentResolver.query(projection)
        copy name/phones/emails/birthday + PHOTO BLOB → app cache temp file
                        │  (grant is temporary — copy NOW)
                        ▼
   JS receives PickedContact[]  (fully self-contained snapshot)
                        │
        ┌───────────────┴────────────────┐
        ▼ single (N==1)                    ▼ bulk (N>1)
  BEGIN import_session (mode=single)   BEGIN import_session (mode=bulk,
  + 1 import_session_row                   batch_category, defaults Unbound/Uncat)
        │                                + N import_session_rows (photo bytes → session dir)
        ▼                                     │
  Single review screen                        ▼
  (edit name/Bound/cadence/                Duplicate engine scores each row
   category/methods/bday/photo)            (deterministic bypass → advisory ladder)
        │                                     │
        ▼                                     ▼
  Duplicate interrupt?                     Chunked import driver (incremental):
   ├ Link to Existing                       for each safe row → ONE inWriteTransaction:
   └ Import as New                            createContactFull(trackingEnabled=false,
        │                                       intervalDays=null, methodDrafts=…)
        ▼                                       + INSERT external_contact_links
  ONE inWriteTransaction (create OR link)       + INSERT contact_method_provenance
  + external_contact_links + provenance       COMMIT ─▶ post-commit: persist photo master
        │                                     (photo failure ⇒ row 'imported', logged)
        ▼                                     ambiguous rows stay in the card grid
  photo persisted post-commit                   │
        │                                        ▼
        └──────────────┬────────────────────  Completion summary
                       ▼                        (Imported / Already in Orbit /
        Session status=complete                  Need review / Failed-skipped)
        (durable across process death;           → bridge to UnboundContacts route
         launch sweep offers Resume/Discard)
```

### Recommended Project Structure

```
modules/orbit-contact-picker/            # NEW native module (mirror orbit-backup-document-picker)
  index.ts                               # PickedContact type + JS surface
  expo-module.config.json
  src/OrbitContactPickerModule.ts        # requireNativeModule wrapper
  src/OrbitContactPickerModule.web.ts    # web no-op (parity with existing modules)
  android/.../OrbitContactPickerModule.kt# ACTION_PICK_CONTACTS + ContentResolver + copyToCache

src/db/
  migrations/012-import-sessions.ts      # NEW: import_sessions + import_session_rows
  import-session-dao.ts                  # NEW: session/row writers (own inWriteTransaction)
  import-session-read.ts                 # NEW: node-tested read chokepoint (counts, resumable)
  imported-contact-dao.ts               # NEW: composed create/link + external link + provenance
src/services/import/
  duplicate-evidence.ts                  # NEW: pure, node-tested scoring → confidence ladder
  import-driver.ts                       # NEW: chunked bulk driver, partial-failure handling
  contact-import-resume-sweep.ts         # NEW: launch-sweep hook (offer Resume/Discard)
src/logic/
  picked-contact-map.ts                  # NEW: pure map PickedContact → CreateContactFullInput
src/screens/                             # per UI-SPEC §Screen-by-screen (10 surfaces)
src/components/CandidateCardGrid.tsx     # NEW reusable FlatList numColumns={2} (Phase 20 reuses)
```

### Pattern 1: Snapshot-then-drive (the temporary-grant rule)
**What:** The moment the native module returns, the picker's session URI grant is temporary and will not survive process death; on Android 17 the session provider table is capped and account metadata is stripped [CITED: source.android.com/docs/core/permissions/contacts-picker]. Copy **everything** — including photo bytes — into Orbit's own durable storage at acceptance, then drive all review/import from Orbit's rows.
**When to use:** Always, for both single and bulk. This is the load-bearing correctness rule for IMP-04's durability.
**Example:** native `copyToCache` (photo) + `INSERT import_session_rows(source_payload JSON)` in the acceptance transaction; never re-query the picker URI later.

### Pattern 2: One transaction per imported contact (partial-batch safety)
**What:** Each contact is created/linked in its **own** `inWriteTransaction`, composing `createContactFull` + `external_contact_links` INSERT + `contact_method_provenance` INSERT. The photo is persisted **after** commit.
**When to use:** Every import write. Gives Cluster P partial-batch safety for free: one bad row (or photo) rolls back only itself; the batch continues.
**Example:**
```typescript
// Source: composition contract from src/db/contacts-dao.ts:148-231 (createContactFull)
// and the external-link schema at src/db/migrations/011-...ts:117-124.
// Pseudocode — one contact, one transaction:
await inWriteTransaction(exec, async () => {
  const { contactId, methods } = await createContactFull(exec, {
    uid: newUid(), name, intervalDays: null, trackingEnabled: false, // Unbound default (bulk)
    categoryId: batchCategoryId ?? null, now, methodDrafts, methodNormalization,
  });
  const link = await exec.runAsync(
    `INSERT INTO external_contact_links (uid, contact_id, provider, external_contact_id, is_active, created_at, modified_at)
     VALUES (?, ?, 'android', ?, 1, ?, ?)`,
    [newUid(), contactId, sourceLookupKey, now, now]);
  // Optionally thread provenance from each imported method back to this link.
});
// POST-COMMIT (never inside the txn): resize photo blob → persistMaster → setContactPhoto.
```
Note: `createContactFull` opens its own `inWriteTransaction`; the shared mutex is **non-reentrant** [VERIFIED: src/db/contacts-dao.ts:5-15]. The composed importer must **either** call `createContactFull` directly (one mutex entry) **or** compose the non-mutexed cores — never nest. Recommend a dedicated `imported-contact-dao.ts` that mirrors `createContactFull`'s own body (calling the cores) and adds the two INSERTs, so the link + provenance land in the *same* transaction as the contact.

### Pattern 3: Deterministic bypass → advisory ladder (duplicate engine)
**What:** First check `external_contact_links` for an **active** row matching `(provider='android', external_contact_id=<lookup key>)` — the UNIQUE partial index guarantees at most one [VERIFIED: src/db/migrations/011-...ts:180]. A hit = *deterministic identity* ("Already in Orbit"), skip in bulk, never offered as new. Only if there is no deterministic hit do you run the weighted advisory engine (canonical phone match via `contact_methods.canonical_value`, normalized email match, name similarity, birthday) that maps to the 5 colourless outcomes.
**When to use:** Every candidate, deterministic check first.
**Anti-pattern:** Feeding an already-linked external contact into the fuzzy scorer — it is identity, not evidence.

### Pattern 4: Bound/Unbound + category defaults are explicit inputs
**What:** Bulk import writes `trackingEnabled=false` (Unbound) and `intervalDays=null`. The v11 schema CHECK permits Unbound-with-NULL cadence but forbids Bound-with-NULL [VERIFIED: src/db/migrations/011-...ts:36-37]. Single import lets the user choose Bound (then a positive cadence is required) or Unbound.
**When to use:** All imports. The `Uncategorized` category (dossier Cluster E) must be seeded/looked-up — see Open Question 2.

### Anti-Patterns to Avoid
- **Re-querying the picker session URI after the fact** — the grant is temporary; this fails on resume. (Pattern 1.)
- **Requesting `READ_CONTACTS`** — forbidden; the whole point of the Android 17 path.
- **One giant transaction for the batch** — violates Cluster P; one bad row aborts everyone. Use per-contact transactions.
- **Persisting the photo inside the contact transaction** — a photo/codec failure would roll back a valid contact (Cluster F). Photo is post-commit, independent.
- **Driving the FAB expand/collapse from React state** — CLAUDE.md animation rule; Reanimated shared values only.
- **Interpolating a source string into SQL** — all lookup keys/values are `?`-bound (repo-wide invariant).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phone canonicalization for match/dedup | A custom digit-stripper | `libphonenumber-js` via the existing `normalizeContactMethod` → `canonical_value` | Extensions, regions, and E.164 edge cases already handled; `contact_methods.canonical_value` is the stored match key [VERIFIED: src/db/migrations/009-...ts:187; 011-...ts:110] |
| Contact create + first-interaction + methods atomicity | A new INSERT sequence | `createContactFull` | Already composes the mutex-guarded single-writer transaction with the Bound/Unbound + method-diff contract [VERIFIED: src/db/contacts-dao.ts:112-231] |
| Deterministic external identity | A new "seen contacts" table | `external_contact_links` + its partial-unique index | Already exists with exactly the right shape and integrity constraint [VERIFIED: src/db/migrations/011-...ts:117-124, 180] |
| 512px Orbit-owned photo master | Manual decode/resize/copy | `persistCroppedMaster` / `persistMaster` + `contactPhotoRelPath` | Crash-safe `.tmp`/`.bak` swap, returns the relative path the DB stores [VERIFIED: src/services/photos/photo-storage.ts:83-86, 227-256] |
| Reading a granular contact field without full permission | A `READ_CONTACTS` query | `ACTION_PICK_CONTACTS` session URI + projection | The OS grants temporary per-field access to only the picked contacts [CITED: developer.android.com/about/versions/17/features/contact-picker] |
| Launch-once-per-foreground work (resume prompt) | A background timer/listener | `registerSweepHook` on the launch sweep | SQLite has no scheduler; the sweep is the repo's single launch entry point [VERIFIED: src/services/launch-sweep.ts:45] |

**Key insight:** The deterministic half of duplicate detection and the entire write/photo path already exist on disk. The only thing that must be built from scratch at the systems level is the **native acquisition module** and the **durable session orchestration**. Name-similarity scoring is the *one* place a small hand-rolled pure module is the right call (advisory-only, node-testable, no new dep).

## Runtime State Inventory

> Phase 19 is additive (new tables + a native module), not a rename/migration of existing state. It nonetheless *introduces* durable runtime state and OS-level surfaces that the plan must account for.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (new) | `import_sessions` + `import_session_rows` (migration 012); staged photo bytes in a new session-scoped document subdir (mirror `restore-pending/` staging) | Migration 012 (forward-only, irreversible); a cleanup path for staged photos of discarded/failed sessions (reuse `deleteRestorePending` idiom) |
| Stored data (existing, written by this phase) | `external_contact_links`, `contact_method_provenance`, `contacts`, `contact_methods`, `interactions` (none — imports are never-contacted), photo files | Compose writes per Pattern 2; **read every existing writer** of `contacts`/`contact_methods`/`external_contact_links` before asserting invariants (done: see Sources) |
| Live service / OS-registered state | The Android 17 Contact Picker is an OS activity; the returned **session URI grant is temporary and OS-owned** and is NOT persistable | Snapshot everything at acceptance (Pattern 1); never store or re-open the session URI |
| Secrets / env vars | None — no network, no keys, local-first | None |
| Build artifacts | New native module ⇒ prebuild regenerates `android/`; `compileSdk`/`targetSdk` must reach **API 37** to reference the new constants (or use string-literal action/extras — see Pitfall 1) | Plan a `expo prebuild --clean` + desktop APK build; verify SDK level on the build host |

**Nothing found in category (Secrets/env vars):** None — verified by the local-first architecture (no network on any read/write path) and the absence of any key material in the import flow.

## Common Pitfalls

### Pitfall 1: The Android 17 Contact Picker is API 37+ and brand-new — build-host AND device both gate it
**What goes wrong:** The `ACTION_PICK_CONTACTS` action and its `EXTRA_PICK_CONTACTS_*` extras are defined in the Android 17 SDK (API level 37) [CITED: developer.android.com/about/versions/17/features/contact-picker]. Referencing the Kotlin constants requires `compileSdk 37`. Running the picker requires an Android 17 **device**. The repo's Expo 57 / RN 0.86 toolchain likely compiles against a lower SDK by default (no `targetSdk`/`compileSdk` pin found in app.config.ts [VERIFIED: grep app.config.ts — absent]).
**Why it happens:** New-API adoption ahead of the toolchain's default SDK.
**How to avoid:** Two levers, both recommended: (a) In the native module, reference the picker via **raw string literals** for the action and extra keys (verify the literal values against the SDK on-device) so the module compiles without `compileSdk 37`; **and/or** (b) bump `compileSdk`/`targetSdk` to 37 via `expo-build-properties`. Use `EXTRA_USE_SYSTEM_CONTACTS_PICKER=true` so an Android 17 device shows the new picker even if the app targets lower [CITED: developer.android.com/about/versions/17/features/contact-picker]. Gate the entire feature on `Build.VERSION.SDK_INT >= 37` returned from native.
**Warning signs:** Compile errors on unresolved `ACTION_PICK_CONTACTS`; the picker never appearing on a pre-17 device; a crash instead of the calm unsupported state.

### Pitfall 2: The session URI grant expires — resume after process death breaks if you didn't snapshot
**What goes wrong:** You store the session URI (or lean on it lazily) and, after app kill/reboot, `ContentResolver.query` on it throws or returns nothing — the durable session is now missing its source data.
**Why it happens:** The grant is temporary; Android strips account metadata and caps the session provider table [CITED: source.android.com/docs/core/permissions/contacts-picker].
**How to avoid:** Pattern 1 — copy name/phones/emails/birthday **and the photo bytes** into `import_session_rows` (+ a staged photo file) inside the acceptance transaction, before returning control. Also note session URIs **do not support custom `selection`/`selectionArgs`** — the exception is raised if you try [CITED: developer.android.com/about/versions/17/features/contact-picker]; project the whole cursor and group in native/JS by `LOOKUP_KEY`.
**Warning signs:** Resume works in a warm session but not after a real kill; missing photos on resumed rows.

### Pitfall 3: A photo failure must not invalidate a contact
**What goes wrong:** Photo decode/resize throws and rolls back the contact insert (or the batch), violating Cluster F/P.
**Why it happens:** Persisting the photo inside the contact transaction.
**How to avoid:** Persist the photo **post-commit** via an idempotent step that rebuilds the filename from `contactId` (mirror the purge-cleanup post-commit idiom [VERIFIED: STATE.md 05-07 buildPhotoPurgeCleanup]). On failure: leave the contact `imported`, record a per-row photo-failure flag, surface it in the summary's `Failed / skipped` only if the *contact* failed — a photo-only failure keeps the contact imported (dossier Cluster F).
**Warning signs:** A single unreadable avatar aborting an otherwise-valid import.

### Pitfall 4: Correlated evidence double-counting / name-only auto-link
**What goes wrong:** Phone + email that both came from the *same* source record are counted as two independent strong signals; or a name-only match crosses the link threshold.
**Why it happens:** Naive additive scoring.
**How to avoid:** Dossier Cluster G is explicit: correlated evidence must not be blindly double-counted; birthday is supporting-only; name-only never authorizes auto-link. Keep the scorer pure + node-tested with these as invariants (tests, not just intent). Weights/thresholds are `[OPEN — implementation tuning]` — surface them as top-of-file tunable constants per repo convention.
**Warning signs:** A test where two same-source methods produce a "probable" link; any path where name similarity alone recommends Link.

### Pitfall 5: The platform picker cap (≤100/selection) is NOT the app cap
**What goes wrong:** Planning a single-picker "import 10,000 contacts" flow. The Android 17 picker multi-select **defaults to 50 and maxes at 100** per invocation, with a 5000-row session provider ceiling [CITED: source.android.com/docs/core/permissions/contacts-picker].
**Why it happens:** Conflating the dossier's *storage/processing* scale target (tens→thousands→10k stress test) with a *single picker selection*.
**How to avoid:** Dossier Cluster S already permits "unless a platform API imposes one." Orbit imposes no app cap on stored contacts and processes incrementally; a user importing many people simply runs the picker multiple times (each ≤100). Document this clearly in the plan; do not build UI implying one picker call can grab thousands.
**Warning signs:** A progress screen designed for N in the thousands from a single pick; `EXTRA_PICK_CONTACTS_SELECTION_LIMIT` set above 100.

### Pitfall 6: `formatLocalDate` / local wall-clock for imported birthdays and timestamps
**What goes wrong:** Using `toISOString().split('T')[0]` for a birthday or `created_at`, reintroducing the fixed UTC evening off-by-one.
**Why it happens:** Instinct.
**How to avoid:** Use `formatLocalDate()` / `localDateTime()` [VERIFIED: src/db/database.ts:70; CLAUDE.md]. Imported birthdays arrive as an OS string (often `--MM-DD` for year-less, or `YYYY-MM-DD`); reuse the Phase-8 birthday parser's strict validation (`daysUntilBirthday` accepts both `MM-DD` and `YYYY-MM-DD`, rejects `02-30` etc. [VERIFIED: STATE.md 08-02]) — map the OS birthday format into that stored shape, don't invent a new one.

## Code Examples

### Native module surface (JS) — mirror the existing document-picker
```typescript
// Source: pattern from modules/orbit-backup-document-picker/src/OrbitBackupDocumentPickerModule.ts:1-15
import { NativeModule, requireNativeModule } from "expo";

export interface PickedMethod { type: "phone" | "email"; value: string; }
export interface PickedContact {
  lookupKey: string;            // ContactsContract.Contacts.LOOKUP_KEY → external_contact_id
  displayName: string | null;
  methods: PickedMethod[];
  birthday: string | null;      // OS Event(TYPE_BIRTHDAY) DATA1 — MAY be absent (see Assumptions)
  photoTempUri: string | null;  // file:// copied out of the temporary grant — MAY be null
}
declare class OrbitContactPickerModule extends NativeModule<Record<never, never>> {
  isContactPickerAvailable(): boolean;                 // Build.VERSION.SDK_INT >= 37
  pickContacts(opts: { multiple: boolean }): Promise<PickedContact[]>; // [] on cancel
}
export default requireNativeModule<OrbitContactPickerModule>("OrbitContactPicker");
```

### Native (Kotlin) — launch + read session URI (shape; verify constants on device)
```kotlin
// Source: developer.android.com/about/versions/17/features/contact-picker (API 37)
// Activity-result + copyToCache pattern from OrbitBackupDocumentPickerModule.kt:97-164.
val intent = Intent("android.intent.action.PICK_CONTACTS").apply {   // literal ⇒ no compileSdk 37 needed
  putExtra("android.provider.extra.USE_SYSTEM_CONTACTS_PICKER", true)
  putStringArrayListExtra("android.provider.extra.PICK_CONTACTS_REQUESTED_DATA_FIELDS",
    arrayListOf(
      ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE,
      ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE,
      ContactsContract.CommonDataKinds.Event.CONTENT_ITEM_TYPE,   // birthday — VERIFY returned
      ContactsContract.CommonDataKinds.Photo.CONTENT_ITEM_TYPE,   // photo   — VERIFY returned
    ))
  if (multiple) putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)       // default single
}
// On RESULT_OK: contentResolver.query(sessionUri, projection, null, null, null)  // no selection args!
// projection: LOOKUP_KEY, DISPLAY_NAME_PRIMARY, Data.MIMETYPE, Data.DATA1  (+ DATA15 for photo blob)
// group rows by LOOKUP_KEY; copy photo bytes to cacheDir temp file → return file:// uri.
```
> ⚠ The exact string literal values for `USE_SYSTEM_CONTACTS_PICKER` / `PICK_CONTACTS_REQUESTED_DATA_FIELDS` and whether Event/Photo are honored are **[ASSUMED]** — the tracer slice must confirm them against the real API 37 constants on an Android 17 device before the module is finalized.

### Chunked bulk driver (partial-failure, incremental)
```typescript
// Pure orchestration; each row is its own transaction (Pattern 2). Photo post-commit.
for (const chunk of chunksOf(pendingRows, CHUNK_SIZE /* top-of-file tunable, e.g. 25 */)) {
  for (const row of chunk) {
    try {
      const contactId = await importOneContact(exec, row, batchCategoryId, now); // one txn
      await tryPersistPhotoPostCommit(contactId, row).catch(() => markPhotoFailed(row));
      await markRowImported(exec, row.id, contactId);
    } catch (err) {
      await markRowFailed(exec, row.id, classify(err)); // batch continues (Cluster P)
    }
    onProgress(++done, total); // "Importing… X of N"
  }
  await yieldToUi(); // keep the JS thread responsive between chunks (Cluster S)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `READ_CONTACTS` + full-provider query (or `expo-contacts` picker with the permission) | Android 17 **Contact Picker** `ACTION_PICK_CONTACTS`, per-field temporary grant, no broad permission | Android 17 / API 37, public docs Mar 2026 | Enables the dossier's privacy posture; ties the feature to API 37+ devices |
| Legacy `ACTION_PICK` returning one contact URI | Same intent **auto-upgraded** to the new picker on API 37+; `EXTRA_USE_SYSTEM_CONTACTS_PICKER` forces it on lower targets | API 37 | Backward-compat testing lever; still 17+-only at runtime |
| Scalar `contacts.phone` / `contacts.email` | Normalized `contact_methods` with `canonical_value` + `external_contact_links` provenance | Phase 18.1 (migration 009→011) | Phase 19's dedup + linkage foundation already exists |

**Deprecated/outdated:**
- `expo-contacts` for this phase — its Android picker still needs `READ_CONTACTS` [CITED: docs.expo.dev/versions/latest/sdk/contacts]; do not use it.
- Scalar phone/email columns — retired by migration 009 [VERIFIED: src/db/contacts-dao.ts:149].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Android 17 picker returns **birthday** (`Event`/`TYPE_BIRTHDAY`) as a requestable granular field | Native module, Code Example 2 | Birthday import silently empty; fall back to importing name/methods/photo only, flag birthday as unavailable. Verify in tracer. |
| A2 | The picker returns a **photo** blob (`Photo.CONTENT_ITEM_TYPE` / DATA15) for picked contacts | Photo import | Photo import unavailable via picker; contacts import without avatars (initials fallback already exists). Verify in tracer. |
| A3 | The extra-key **string literals** (`USE_SYSTEM_CONTACTS_PICKER`, `PICK_CONTACTS_REQUESTED_DATA_FIELDS`, selection-limit) match the shipped API 37 constants | Native module | Picker launches without field grants or ignores extras; must switch to `compileSdk 37` + real constants. Verify in tracer. |
| A4 | Multi-select cap is default 50 / max 100 per pick; session table ≤5000 | Pitfall 5 | If lower, chunk the UX expectation; if there's no multi-select at all, bulk = repeated single picks. Verify in tracer. |
| A5 | The repo build host can reach **compileSdk/targetSdk 37** (Android 17 SDK) via the desktop pipeline | Environment | If the SDK isn't installed on `droid`, native compile fails; owner must install the Android 17 platform. |
| A6 | An **Android 17 test device** is available for UAT (the Pixel 6 Pro must be on Android 17) | Environment | Feature is untestable end-to-end; only the unsupported-state path is verifiable on a pre-17 device. Owner decision. |
| A7 | `provider` value `'android'` is the intended external-link provider tag (18.1 test used `"android"`) | Pattern 2/3 | Cosmetic/consistency; pick a stable constant and use it everywhere. [VERIFIED: migration 011 test uses `"android"` — src/db/migrations/011-...test.ts:170] lowers this risk. |

**If this table looks long:** it is concentrated entirely in the *acquisition* layer (a 2026 API with thin public docs). The data-layer claims are VERIFIED against files read this session and carry no assumptions.

## Open Questions

1. **Does the Android 17 picker expose birthday and photo granularly?** (A1/A2)
   - What we know: name/phone/email are documented; the result is a `ContactsContract.Data` cursor so standard MIME types are requestable in principle.
   - What's unclear: whether the *new picker* honors `Event`/`Photo` field requests and returns their `DATA1`/blob.
   - Recommendation: make birthday + photo **best-effort** in the tracer slice; the vertical slice must prove name+methods first (the guaranteed fields), then add birthday/photo behind device verification. Import stays valid without them.

2. **How is the `Uncategorized` category created?** (dossier Cluster E "Phase 19 adds/uses an `Uncategorized` category")
   - What we know: categories are seeded Family/Friends/Work/Community, user-editable [VERIFIED: REQUIREMENTS DATA-03]; a contact's `category_id` is nullable.
   - What's unclear: whether `Uncategorized` is a real seeded category row or simply `category_id = NULL` rendered as "Uncategorized".
   - Recommendation: prefer a real seeded category row for clarity + Phase-20 reuse; if seeding, it is a data change **inside migration 012** (forward-only). Confirm with owner during discuss/plan — this touches the categories vocabulary.

3. **E5 grid virtualization/paging at thousands of candidates** (UI-SPEC unresolved-1, delegated to planner)
   - Recommendation: `FlatList numColumns={2}` is virtualized by default; cap the *review* set per session to what a single picker can return (≤100), which makes thousands-of-candidates review a non-issue in practice (Pitfall 5). Document the windowing choice.

4. **Multiple-source-records-as-one-person consolidation (Cluster K)** — conservative first cut.
   - Recommendation: MVP tracer should NOT build consolidation; add it as a later slice within the phase only if the tracer + single/bulk slices land cleanly. It is explicitly "keep conservative."

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Android 17 SDK (API 37) on build host (`droid`) | Native module compile (constants or `compileSdk 37`) | ✗ unknown (not verified on host) | — | String-literal intent + extras to avoid `compileSdk 37`; else owner installs the platform |
| Android 17 **device** for UAT | End-to-end picker verification | ✗ unknown (Pixel 6 Pro OS version not confirmed) | — | Pre-17 device verifies only the unsupported-state path; owner must confirm/flash Android 17 for full UAT |
| `expo-sqlite`, `expo-file-system`, `expo-image-manipulator`, `libphonenumber-js`, `react-native-reanimated` | Sessions, photo, dedup, FAB | ✓ | installed | — |
| Desktop build pipeline (`ssh droid` → APK → Pixel) | Any native change | ✓ | proven (FND-01) | — |

**Missing dependencies with no fallback:** An Android 17 device for full end-to-end UAT (owner decision — A6). Without it, the plan can still land + node-verify the data layer and duplicate engine, and device-verify the unsupported state, but the happy-path picker flow stays unproven.
**Missing dependencies with fallback:** Android 17 build SDK — avoidable via string-literal constants (A3), verified in the tracer.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`vitest run`) — node harness [VERIFIED: package.json] |
| Config file | vitest (project convention: pure `.ts` logic + `node:sqlite` DAO tests; `.tsx`/native are device-UAT) |
| Quick run command | `npx vitest run <file>` |
| Full suite command | `npm test` (currently ~1,510 tests green per 18.1 close-out) |
| Colour gate | `npm run check:colors` (bash scripts/check-colors.sh) [VERIFIED: package.json] |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMP-01 | `isContactPickerAvailable` gate hides entry on SDK<37 | unit (pure) | `npx vitest run src/logic/picked-contact-map.test.ts` | ❌ Wave 0 |
| IMP-02 | `createContactFull(trackingEnabled=false,intervalDays=null)` writes Unbound + methods; batch category applied | node:sqlite | `npx vitest run src/db/imported-contact-dao.test.ts` | ❌ Wave 0 |
| IMP-02 | Chunked driver processes N incrementally, emits progress | unit (pure) | `npx vitest run src/services/import/import-driver.test.ts` | ❌ Wave 0 |
| IMP-03 | Deterministic bypass on active `external_contact_links`; advisory ladder; no name-only auto-link; no correlated double-count | node:sqlite + unit | `npx vitest run src/services/import/duplicate-evidence.test.ts` | ❌ Wave 0 |
| IMP-04 | Migration 012 up from v11 preserves rows; session survives (re-read) simulated process death; partial commit stands; photo-fail keeps contact | migration + node:sqlite | `npx vitest run src/db/migrations/012-import-sessions.test.ts` | ❌ Wave 0 |
| IMP-04 | Resume/Discard sweep offers pending session; discard clears only unresolved state | node:sqlite | `npx vitest run src/services/import/contact-import-resume-sweep.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched file>` + `npm run check:colors`
- **Per wave merge:** `npm test` (full suite green)
- **Phase gate:** Full suite green + tsc + biome + **Android 17 device UAT** (picker happy path, unsupported state on a pre-17 device, process-death resume) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/db/migrations/012-import-sessions.ts` + `.test.ts` — v11→v12, `import_sessions` + `import_session_rows`; register in `MIGRATIONS` and bump `TARGET_VERSION = 12` [VERIFIED: src/db/database.ts:46,49-61]
- [ ] `src/db/imported-contact-dao.ts` (+test) — composed create/link + external link + provenance, one txn
- [ ] `src/services/import/duplicate-evidence.ts` (+test) — deterministic bypass + advisory ladder
- [ ] `src/services/import/import-driver.ts` (+test) — chunked partial-failure driver
- [ ] `src/logic/picked-contact-map.ts` (+test) — `PickedContact` → `CreateContactFullInput` + birthday mapping
- [ ] Native module has **no node test** — device-UAT only (repo convention for native/`.tsx`)

*Framework install: none needed (Vitest present).*

## Security Domain

> `security_enforcement: true`, ASVS L1, block-on high [VERIFIED: .planning/config.json].

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | **yes** | The picker payload is **untrusted external input**. Validate/normalize every field: names via existing contact-name rules; phones/emails through `normalizeContactMethod`; birthday through the strict Phase-8 parser (rejects `02-30` etc.); `?`-bound SQL everywhere; `lookupKey` treated as opaque text, never interpolated. |
| V6 Cryptography | no | No secrets in this flow; local-first, no keys. |
| V8 Data Protection | **yes** | Imported contact data never leaves the device (no network on any import path — reaffirm CLAUDE.md local-first). Staged photo temp files live in app-private storage and are cleaned for discarded/failed sessions. |
| V12 File/Resource | **yes** | Photo temp file from the picker: copy via app-private cache (mirror `copyToCache` [VERIFIED: OrbitBackupDocumentPickerModule.kt:152-164]); never surface a provider path into JS; validate/resize before persisting a master. |
| V2/V3/V4 (auth/session/access) | no | No auth surface. |

### Known Threat Patterns for {Android native intent + SQLite import}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious/oversized photo blob from a crafted contact | Tampering/DoS | Resize through `expo-image-manipulator` with the existing pipeline caps; failure is caught post-commit and never aborts the contact (Pitfall 3). |
| SQL injection via imported name/`lookupKey`/method value | Tampering | `?`-bound parameters only (repo-wide invariant); `lookupKey` stored as opaque text. |
| Session URI leaking a provider path or over-broad grant into JS | Info disclosure | Native copies bytes out of the grant and returns only app-owned `file://` temp URIs (never the content URI); grant is temporary + per-field by design. |
| Birthday/date parsing off-by-one / overflow | Tampering (data integrity) | Reuse the strict `daysUntilBirthday` parser + `formatLocalDate`/`localDateTime` (Pitfall 6). |
| Resumed session referencing an expired grant | DoS (feature break) | Snapshot-then-drive (Pattern 1); an unreadable session offers **Discard**, never a crash (UI-SPEC backstop-3). |

## Sources

### Primary (HIGH confidence — read on disk this session)
- `src/db/migrations/011-contact-lifecycle-schema.ts` — v11 schema for `contacts`, `contact_methods`, `external_contact_links`, `contact_method_provenance`, indexes (lines 16-38, 106-124, 175-188, 227-240)
- `src/db/migrations/009-contact-method-normalization.ts` — creation of `external_contact_links` + `contact_method_provenance`, `normalizeContactMethod` usage (lines 183-250)
- `src/db/contacts-dao.ts` — `createContactFull` composition contract + Bound/Unbound + method drafts (lines 5-15, 83-231)
- `src/db/contact-lifecycle-dao.ts` — bind/unbind semantics (whole file)
- `src/db/contact-methods-dao.ts` — `ContactMethodDraft`, `applyContactMethodDiffCore` (lines 28-45, 99+)
- `src/services/photos/photo-storage.ts` — `contactPhotoRelPath`, `persistMaster` crash-safe swap (lines 83-118, 227-262)
- `src/db/database.ts` — `TARGET_VERSION = 11`, `MIGRATIONS` array, `localDateTime` (lines 46-61, 70)
- `src/services/launch-sweep.ts` — `registerSweepHook` (line 45)
- `modules/orbit-backup-document-picker/.../OrbitBackupDocumentPickerModule.kt` — activity-result + `copyToCache` native template (lines 97-175)
- `.planning/config.json`, `package.json`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, dossier, CONTEXT, UI-SPEC

### Secondary (MEDIUM confidence — official docs, not device-verified)
- developer.android.com/about/versions/17/features/contact-picker — `ACTION_PICK_CONTACTS`, `EXTRA_PICK_CONTACTS_REQUESTED_DATA_FIELDS`, `EXTRA_USE_SYSTEM_CONTACTS_PICKER`, `EXTRA_ALLOW_MULTIPLE`, session URI + projection, no `READ_CONTACTS`, API 37
- source.android.com/docs/core/permissions/contacts-picker — selection limits (default 50 / max 100), 5000-row session table, no custom selection args
- android-developers.googleblog.com/2026/03/contact-picker-privacy-first-contact.html — privacy model, single vs multiple
- docs.expo.dev/versions/latest/sdk/contacts — `presentContactPickerAsync` requires `READ_CONTACTS` on Android (basis for rejecting expo-contacts)

### Tertiary (LOW confidence — must verify on device)
- Granular birthday/photo field support and exact extra-key string literals for the Android 17 picker (A1/A2/A3) — no authoritative constant reference located; tracer-verify.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — reuse of already-installed, already-audited libs + an in-repo native template read on disk.
- Architecture (sessions/dedup/write/photo): HIGH — every foundation table, writer, and pipeline verified in source this session.
- Acquisition layer (Android 17 picker): MEDIUM — official docs consistent, but the API is new (2026) and unverified against a device; birthday/photo/constant details LOW.
- Pitfalls: HIGH for the data-layer ones (grounded in code + dossier); MEDIUM for the picker ones (doc-grounded).

**Research date:** 2026-08-28
**Valid until:** 2026-09-27 for the data-layer findings (stable); **2026-09-04** for the Android 17 picker findings (fast-moving new API — re-verify constants against the shipped SDK before finalizing the native module).
