# Phase 18: Contact Data Normalization - Research

**Researched:** 2026-08-26
**Domain:** SQLite contact-model migration, React Native contact UI, local provenance, lifecycle query enforcement
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Read the canonical dossier in full. Its `[DECIDED]`, `[REJECTED]`, `[SUPERSEDES]`, phase-boundary, invariant, and explicit-deferral statements are locked product decisions, not prompts to reopen.
- Normalized phone/email methods are the sole source of truth: support zero-to-many ordered methods, per-type primaries, canonical matching separate from presentation, and storable-but-not-actionable incomplete values. Shared canonical methods are evidence, never global identity proof.
- Bound/Unbound is independent of cadence and does not erase or restart relationship history. `interval_days = NULL` means only never assigned; Bound requires a positive cadence; once assigned, cadence is never cleared.
- Orbit identity stays independent of system-contact identity. Source links can be stale/missing without deleting Orbit data, and source refresh is never destructive or silently authoritative.
- Preserve all explicit deferrals in the dossier, including picker/import/reconciliation work, endpoint/provider interaction history, rich merge management, passive notification-listener detection, and reorder UI polish.

### the agent's Discretion

Leave exact schema, migration mechanics, parsing/actionability rules, Favourite dormant-state handling, and cross-surface query implementation to research/planning within those constraints.

### Deferred Ideas (OUT OF SCOPE)

No separate `## Deferred Ideas` section is present in CONTEXT.md. The locked decisions above explicitly defer picker/import/reconciliation work, endpoint/provider interaction history, rich merge management, passive notification-listener detection, and reorder UI polish.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CDN-01 | Phone/email become ordered first-class methods with stable identity, per-type primaries, canonical equality, extensions, and no duplicate authoritative storage. | Child-entity schema, migration-rebuild pattern, normalization boundary, method DAO, and form/Compose replacement audit below. |
| CDN-02 | Bound/Unbound is independent of cadence, preserves history, migrates current contacts Bound, and makes assigned cadence one-way. | `tracking_enabled` lifecycle invariant, nullable-cadence migration, write guards, and status/impact behavior below. |
| CDN-03 | Bound-only surfaces exclude Unbound while dedicated Unbound, optional Never Contacted, birthday, explicit AI, and independent system identity retain their behavior. | Query-owner map and complete consumer audit below. |
| CDN-04 | Backup/export keeps the normalized model and source provenance; source disappearance/refresh never silently destroys Orbit data. | Mergeable-entity/backup integration and provenance-only design below. |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Local Git commits are authorized; use the repository Git identity. [VERIFIED: AGENTS.md:3]
- Do not add `Co-authored-by`, `Signed-off-by`, or Codex/AI attribution trailers unless the user asks. [VERIFIED: AGENTS.md:4]
- Do not push, create a PR, or perform GitHub writes unless the user explicitly asks in this conversation. [VERIFIED: AGENTS.md:5]

## Summary

Phase 18 is primarily a controlled data-model migration. Replace the two legacy scalar contact endpoints with sync-ready child rows, then make `tracking_enabled`—not cadence nullability—the sole Bound/Unbound switch. This needs a table rebuild because the shipped `contacts` definition has the verbatim columns `"interval_days  INTEGER NOT NULL,"`, `"phone          TEXT,"`, and `"email          TEXT,"`. [VERIFIED: src/db/migrations/001-initial.ts:63-86] A post-migration contact owns zero or more methods; a valid canonical value governs equality/actionability while the stored display/raw value preserves user information.

Existing behavior is highly query-centric: status, dashboard, Orrery, notification eligibility, widget favorites, profile impact, compose, backup export, and restore directly depend on the legacy columns or on an always-positive interval. The safe plan is to introduce a normalization/DAO boundary first, migrate and prove data, then route every consumer through Bound-aware read chokepoints and method reads. Do not add picker, import review, source refresh, reconciliation, or Interaction Assist; those belong to later phases. [VERIFIED: docs/dossier/18-contact-data-normalization.md:503-527]

**Primary recommendation:** Build migration 009 around a rebuilt `contacts` table plus mergeable `contact_methods`, external-contact-link, and method-provenance children; enforce lifecycle invariants in SQL/DAO guards and use `tracking_enabled = 1` in every cadence-owned projection.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Contact-method persistence, primary/order invariants, and lifecycle enforcement | Database / Storage | API / Backend (DAO) | SQLite owns durable relationships; DAOs provide the sole transactional write boundary. [VERIFIED: src/db/types.ts:13-38] |
| Phone parsing, canonicalization, and display formatting | API / Backend (local domain module) | Browser / Client | A pure TypeScript module keeps the same result in migrations, forms, and future imports. [CITED: https://github.com/catamphetamine/libphonenumber-js/blob/master/README.md] |
| Bound-only dashboard, Orrery, notification, and widget populations | Database / Storage | Browser / Client | SQL population predicates prevent a UI-side filter from leaking Unbound contacts into proactive surfaces. [VERIFIED: src/db/dashboard-read.ts:136-144] |
| Dedicated Unbound and Never Contacted screens | Browser / Client | Database / Storage | React Native renders the population; a dedicated query owns the classification. [VERIFIED: src/screens/NeverContactedScreen.tsx:1-15] |
| Default region and user choices | Database / Storage | Browser / Client | Portable settings persist user overrides; UI reads device region only as a default. [VERIFIED: src/db/app-settings-dao.ts:120-150] |
| System-contact provenance foundation | Database / Storage | — | Local links are future import/reconciliation evidence and never Orbit identity. [VERIFIED: docs/dossier/18-contact-data-normalization.md:385-426] |
| Backup/restore and tombstones | Database / Storage | — | The existing restore engine reconciles UID-bearing entities and explicit tombstones. [VERIFIED: src/backup/reconciliation.ts:7-18] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLite via existing `expo-sqlite` | `~57.0.1` (installed) | Forward-only migration, FKs, child rows, and transactional enforcement. | The project already exposes a node-testable `SqlExecutor` and a strict per-version transaction runner. [VERIFIED: package.json:19-32] [VERIFIED: src/db/migrations/runner.ts:39-72] |
| `libphonenumber-js` [WARNING: flagged as suspicious — verify before using.] | `1.13.11`, published 2026-08-14 | Parse with a default region, derive E.164 canonical values, format display values, retain extensions, and classify possible/valid phone methods. | Official documentation supports parsing, E.164, national/international formatting, extensions, and `isPossible()`/`isValid()`. [CITED: https://github.com/catamphetamine/libphonenumber-js/blob/master/README.md] |
| `expo-localization` | `57.0.1`, modified 2026-08-25 | Obtain device `regionCode` only as the initial default for national-format phone parsing. | `getLocales()[0]` exposes the system locale and `regionCode`; the user override remains the durable parsing policy. [CITED: https://docs.expo.dev/guides/localization/] [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `expo-sms` | `~57.0.1` | Current Compose SMS handoff. | Replace its scalar `phone` input with the selected actionable primary phone only; do not build general Call/Text/Email routing in this phase. [VERIFIED: package.json:29-31] [VERIFIED: src/screens/ComposeScreen.tsx:426-440] |
| Existing Expo Linking | Existing Expo runtime | Later Call/Email handoff support through `tel:` / `mailto:` schemes. | Do not implement the shared Reach Out router until Phase 21; this phase only produces correct actionability data. [CITED: https://docs.expo.dev/linking/into-other-apps/] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A tested phone parser | Custom digit stripping/E.164 logic | Rejected: regional prefixes, extensions, possible-vs-valid distinctions, and presentation formatting are not safe to recreate. [CITED: https://github.com/catamphetamine/libphonenumber-js/blob/master/README.md] |
| Normalized child entities | JSON arrays on `contacts` | Rejected: child UIDs, tombstones, provenance, per-type primary/order constraints, and backup reconciliation need independently mergeable rows. [VERIFIED: src/backup/reconciliation.ts:38-69] |
| SQL read predicates | UI-only `filter()` | Rejected: notification/widget/headless/backup callers bypass a screen-level filter. [VERIFIED: src/services/notifications/decay-suppression.ts:18-29] |

**Installation:**

```bash
npx expo install expo-localization
# checkpoint:human-verify — legitimacy seam marked libphonenumber-js SUS because its current release is recent.
npm install libphonenumber-js@1.13.11
```

**Version verification:** `expo-localization` is `57.0.1` from the npm registry and has an `OK` legitimacy verdict. `libphonenumber-js` is `1.13.11`, but its legitimacy result is `SUS` solely because the latest release is new; it has about 25M weekly downloads, a repository, and no `postinstall` script. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `expo-localization` | npm | 7+ years; current `57.0.1` modified 2026-08-25 | ~2.4M/week | `github.com/expo/expo` | OK | Approved. [VERIFIED: npm registry] |
| `libphonenumber-js` | npm | 9+ years; current `1.13.11` published 2026-08-14 | ~25M/week | `gitlab.com/catamphetamine/libphonenumber-js` | SUS (`too-new` current release) | Flagged — planner must insert `checkpoint:human-verify` before install; no postinstall was reported. [VERIFIED: npm registry] |

**Packages removed due to [SLOP] verdict:** none.

**Packages flagged as suspicious [SUS]:** `libphonenumber-js` — human verification is required before installation.

## Architecture Patterns

### System Architecture Diagram

```text
Existing contacts.phone / contacts.email / interval_days
                         |
                         v
        Migration 009 preflight + one write transaction
        - rebuild contacts (nullable cadence + tracking state)
        - insert primary contact_methods
        - create external-link/provenance children
        - prove copy + FK/invariant checks
                         |
          +--------------+---------------+
          |                              |
          v                              v
Contact-method DAO                 Lifecycle DAO
raw display -> normalize ->        Bind/Unbind -> SQL guards -> data revision
canonical/actionable/extension
          |                              |
          +--------------+---------------+
                         v
               Bound-aware read chokepoints
 Dashboard / Unbound / Never Contacted / Orrery / notifications / widget
                         |
                         v
          Profile/Edit/Compose/Backup/Restore consumers

Future Phase 19 source picker/import ---> external links + method provenance
Future Phase 20 refresh/reconcile ------> user-reviewed, never destructive diffs
```

### Recommended Project Structure

```text
src/
├── db/
│   ├── migrations/009-contact-data-normalization.ts  # forward migration + proofs
│   ├── contact-methods-dao.ts                        # transactional methods writes
│   ├── contact-methods-read.ts                       # method/primary projections
│   ├── contact-lifecycle-dao.ts                      # bind/unbind invariant writes
│   └── unbound-read.ts                               # dedicated population read
├── logic/
│   └── contact-method-normalization.ts               # pure parsing/actionability result
├── screens/
│   └── UnboundContactsScreen.tsx                     # dedicated sibling population
└── components/
    └── ContactMethodsEditor.tsx                      # reusable ordered type groups
```

### Pattern 1: Rebuild a shipped SQLite parent table in one forward migration

**What:** Create a replacement `contacts` table with the new nullable cadence/state shape, copy all non-retired columns, atomically replace the old table, create new children/indexes/triggers, migrate scalar methods, and run explicit proofs before the migration returns. The runner will then commit both DDL/data and the version bump together. [VERIFIED: src/db/migrations/runner.ts:55-72]

**When to use:** This is required here because shipped columns cannot be edited in place: the legacy table says `"interval_days  INTEGER NOT NULL,"` and retains the obsolete scalar endpoint columns. [VERIFIED: src/db/migrations/001-initial.ts:63-86]

**Why not `DROP COLUMN`:** SQLite documents that a drop fails if the column is referenced by a constraint, index, trigger, view, or foreign key, and it rewrites stored table content. [CITED: https://sqlite.org/lang_altertable.html] A purpose-built rebuild gives the planner one auditable place to retain all legacy fields and rebuild required constraints.

### Pattern 2: Normalization is a pure boundary, not a UI validation gate

**What:** Persist a raw/display value for every nonblank method, then calculate nullable canonical/actionability fields. An unparseable/incomplete method remains a row; only its action controls are disabled. For valid phones, store E.164 in `canonical_value`, store the extension separately, and derive the localized display text from canonical data. For email, canonical equality is trimmed ASCII case-folded input only—no Gmail dot or plus-tag rewriting. [VERIFIED: docs/dossier/18-contact-data-normalization.md:97-161]

**When to use:** On migration, manual create/edit, future import, and later merge. Keep all those callers behind the same pure function so dedupe semantics cannot drift. [VERIFIED: docs/dossier/18-contact-data-normalization.md:62-91]

**Example:**

```ts
// Source: https://github.com/catamphetamine/libphonenumber-js/blob/master/README.md
import parsePhoneNumber from "libphonenumber-js";

const parsed = parsePhoneNumber(input, defaultCountry);
const canonical = parsed?.isPossible() ? parsed.number : null;
const extension = parsed?.ext ?? null;
const display = parsed ? parsed.formatNational() : input.trim();
```

The official package API returns a parsed number or `undefined`; its `number` is E.164, `ext` is available separately, and `formatNational()` is presentation. [CITED: https://github.com/catamphetamine/libphonenumber-js/blob/master/README.md]

### Pattern 3: Make lifecycle transitions explicit transactional operations

**What:** Keep `tracking_enabled` as the technical Bound flag. Make `interval_days` nullable and require a positive interval for `tracking_enabled = 1`; reject transitions from a previously assigned cadence to `NULL`. A Bind operation either reuses a dormant positive cadence or requires a new one; Unbind writes only the tracking state (and possibly hides the favourite projection), never history. [VERIFIED: docs/dossier/18-contact-data-normalization.md:218-264]

**When to use:** Create, Edit, Unbind, Bind, restore, backup restore, and any future import must share the same DAO-level validation. Existing `createContactFull` and `updateContactFull` presently reject every non-positive interval before opening a transaction, so those input contracts must be replaced rather than patched around. [VERIFIED: src/db/contacts-dao.ts:101-123] [VERIFIED: src/db/contacts-dao.ts:281-301]

**Recommended durable SQL rules:**

- `interval_days IS NULL OR interval_days > 0`.
- `tracking_enabled = 0 OR interval_days IS NOT NULL`.
- A `BEFORE UPDATE OF interval_days` trigger aborts only `OLD.interval_days IS NOT NULL AND NEW.interval_days IS NULL`; it permits NULL → positive assignment and preserves dormant positive cadence on Unbind. [ASSUMED]
- Existing rows migrate to `tracking_enabled = 1`; migration proof must reject a legacy non-positive interval rather than manufacture a cadence. [ASSUMED]

### Pattern 4: Bound-only behavior belongs in read owners

**What:** Add `tracking_enabled = 1` directly to every cadence/status/reminder/favourite/widget query owner, not to components after data is fetched. Add a dedicated `listUnbound` read and a Never Contacted option that conditionally includes `tracking_enabled = 0`. [VERIFIED: docs/dossier/18-contact-data-normalization.md:266-357]

**Consumer audit:**

| Surface / owner | Current source behavior | Phase 18 change |
|---|---|---|
| Dashboard default | Uses the exact quoted predicate `"c.archived_at IS NULL\n     AND c.last_contact IS NOT NULL\n     AND (c.snooze_until IS NULL OR date(c.snooze_until) <= date('now','localtime'))"`. [VERIFIED: src/db/dashboard-read.ts:142-144] | Add Bound predicate to default, needs-attention, category/battery, search, and favourites branches as required by their product rules; search/all-contact can include both. |
| Never Contacted/count | Uses `"archived_at IS NULL AND last_contact IS NULL"`. [VERIFIED: src/db/dashboard-read.ts:257-280] | Default to Bound only; read the portable global include-Unbound setting to widen only this screen/count. |
| Orrery | Uses `"archived_at IS NULL AND last_contact IS NOT NULL"`. [VERIFIED: src/db/orrery-read.ts:87-99] | Add Bound predicate; no UI-side filter. |
| Decay scheduling | Existing predicate is verbatim `"last_contact IS NOT NULL\n     AND rarely_responds = 0\n     AND reminders_off = 0\n     AND archived_at IS NULL\n     AND (${PROGRESS_SQL}) < ${ROGUE_K}"`. [VERIFIED: src/services/notifications/decay-suppression.ts:58-62] | Add Bound predicate; keep `reminders_off` independent. |
| Birthday banner/notification | Existing reads intentionally use every non-archived birthday contact. [VERIFIED: src/db/dashboard-read.ts:335-343] [VERIFIED: src/db/notification-read.ts:84-97] | Keep Unbound included by default; the new global birthday-Unbound setting only narrows notification eligibility, not factual relationship data. |
| Favourites/widget | Existing favourite reads use `"archived_at IS NULL AND favourite_rank IS NOT NULL"`; widget consumes that projection. [VERIFIED: src/db/dashboard-read.ts:285-294] [VERIFIED: src/services/widget/widget-data.ts:72-90] | Preserve `favourite_rank` dormant on Unbind but add Bound to all favourite/widget reads. This is the recommended non-destructive resolution of the dossier's open implementation detail. [ASSUMED] |
| Profile impact | Current `getImpactInputs` reads `c.interval_days` and interactions in one statement. [VERIFIED: src/db/impact-read.ts:53-87] | Continue gravity for either state; return `tracking_enabled` and nullable interval; show intensity only for Bound. |
| AI context | Current context already deliberately omits phone/email from egress. [VERIFIED: src/db/ai-context-read.ts:11-19] | Explicit, user-initiated person-level AI remains usable for Unbound; do not add proactive selection work. |

### Pattern 5: Treat system references as provenance child data

**What:** Use mergeable local rows such as `external_contact_links` (contact → provider/local source record) and `contact_method_provenance` (method → source link/source method identifier). They require their own `uid`, timestamps, contact/method FKs, backup projections, and tombstone types. Store external IDs as opaque matching/provenance data; do not make them a `contacts` identity column or use source absence to cascade delete. [VERIFIED: docs/dossier/18-contact-data-normalization.md:385-445]

**When to use:** Establish only schema/DAO capability now. Phase 19 writes links from an explicit picker/import flow; Phase 20 performs user-triggered refresh/review. [VERIFIED: docs/dossier/18-contact-data-normalization.md:503-516]

### Anti-Patterns to Avoid

- **Keeping `contacts.phone` / `contacts.email` as caches:** creates two authoritative writers and violates CDN-01. [VERIFIED: docs/dossier/18-contact-data-normalization.md:364-381]
- **Globally unique canonical method values:** rejects legitimate shared household endpoints and turns evidence into identity proof. [VERIFIED: docs/dossier/18-contact-data-normalization.md:62-91]
- **Making invalid data impossible to save:** contradicts storable-but-not-actionable handling and loses useful context. [VERIFIED: docs/dossier/18-contact-data-normalization.md:122-161]
- **Using NULL cadence as Unbound:** loses the never-assigned lifecycle meaning. [VERIFIED: docs/dossier/18-contact-data-normalization.md:236-264]
- **Deleting/downgrading local data when a source disappears:** source absence is provenance state, not destructive authority. [VERIFIED: docs/dossier/18-contact-data-normalization.md:405-445]
- **Extending interactions with endpoint/provider IDs:** explicitly deferred; keep `channel` coarse. [VERIFIED: docs/dossier/18-contact-data-normalization.md:165-193]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| International phone parsing/formatting | Regex/digit-strip E.164 implementation | `libphonenumber-js` after human legitimacy check | Supports default-country parsing, E.164, extensions, possible/valid checks, and regional formatting. [CITED: https://github.com/catamphetamine/libphonenumber-js/blob/master/README.md] |
| Device region detection | Locale parsing from arbitrary strings | `expo-localization.getLocales()[0].regionCode` | Expo exposes the device region; it must remain only an initial default because users can override it. [CITED: https://docs.expo.dev/guides/localization/] |
| Phone/email data as packed JSON | A custom serialized methods blob | SQLite child rows with FKs/UIds/tombstones | Backup restore already reconciles child entities by UID and parent-survivor policy. [VERIFIED: src/backup/reconciliation.ts:38-69] |
| Cross-surface lifecycle filtering | Repeated React `.filter()` logic | Bound-aware SQL read chokepoints | Headless notification and widget paths do not pass through screen components. [VERIFIED: src/db/notification-read.ts:73-81] [VERIFIED: src/services/widget/widget-data.ts:79-90] |

**Key insight:** correctness here is a data-lifecycle problem; a parser or UI alone cannot protect backup/restore, scheduled notifications, and future sync identity.

## Common Pitfalls

### Pitfall 1: Migrating data but not every data consumer

**What goes wrong:** Forms, Compose, backup export, or restore still select/write retired scalar columns after the migration.

**Why it happens:** Current direct references exist in create/edit DAO input, profile header/Compose, export manifest, and restore application. [VERIFIED: src/db/contacts-dao.ts:76-94] [VERIFIED: src/db/contact-read.ts:62-125] [VERIFIED: src/backup/export-manifest.ts:45-55] [VERIFIED: src/backup/restore-apply.ts:57-69]

**How to avoid:** Maintain a `rg`-backed ledger of every `contacts.phone`/`contacts.email` selection and make compilation plus node migration/backup tests part of the phase gate.

**Warning signs:** Any `SELECT ... phone`, `phone=?`, or backup fixture still mentioning a retired contacts column after migration 009. [ASSUMED]

### Pitfall 2: Breaking status SQL with NULL interval

**What goes wrong:** A NULL cadence reaches `PROGRESS_SQL` and changes status calculations unexpectedly.

**Why it happens:** The existing SQL divides by bare `interval_days`: `"CAST(julianday(date('now','localtime')) - julianday(date(last_contact)) AS REAL) / interval_days"`. [VERIFIED: src/db/status.ts:49-59]

**How to avoid:** Every status/decay/Orrery/dashboard owner must require Bound (therefore positive cadence) before composing `PROGRESS_SQL`; profile status must return null while Unbound.

**Warning signs:** An Unbound contact appears in status-sorted lists, gets a decay schedule, or is rendered in the Orrery. [ASSUMED]

### Pitfall 3: Clearing cadence on Unbind

**What goes wrong:** Rebinding loses dormant cadence and contradicts the one-way assignment rule.

**Why it happens:** Treating unbinding as “set all cadence-related state to NULL” conflates two independent axes.

**How to avoid:** Encode the lifecycle SQL guard and exercise all four state cells: Bound+positive, Unbound+positive, Unbound+NULL, and prohibited Bound+NULL. [VERIFIED: docs/dossier/18-contact-data-normalization.md:236-264]

### Pitfall 4: Treating source metadata as remote authority

**What goes wrong:** A future source refresh silently removes an Orbit method or overwrites a local edit.

**Why it happens:** A simplistic foreign-key/cascade or import-upsert model mistakes source disappearance for user deletion.

**How to avoid:** Never cascade from source-link/provenance rows to contact-method rows; only explicit local method deletion creates a tombstone. [VERIFIED: docs/dossier/18-contact-data-normalization.md:405-445]

### Pitfall 5: Premature endpoint action work

**What goes wrong:** The phase grows a Call/Text/Email router or interaction-assist record and accidentally changes historical interaction granularity.

**Why it happens:** Contact methods make new actions technically possible before the Phase 21 contract exists.

**How to avoid:** Limit Phase 18 to method selection/actionability data and update existing Compose SMS to use the primary actionable phone; keep routing/assistance entirely out of scope. [VERIFIED: .planning/ROADMAP.md:657] [VERIFIED: docs/dossier/18-contact-data-normalization.md:165-193]

## Code Examples

### Normalize without rejecting stored values

```ts
// Source: https://github.com/catamphetamine/libphonenumber-js/blob/master/README.md
const phone = parsePhoneNumber(rawValue, defaultCountry);
return {
  displayValue: phone ? phone.formatNational() : rawValue.trim(),
  canonicalValue: phone?.isPossible() ? phone.number : null,
  extension: phone?.ext ?? null,
  actionable: phone?.isPossible() === true,
};
```

This is a recommended composition of documented parser operations, not an external schema contract. Preserve a trimmed nonblank `rawValue` even when parsing fails. [CITED: https://github.com/catamphetamine/libphonenumber-js/blob/master/README.md] [VERIFIED: docs/dossier/18-contact-data-normalization.md:122-161]

### Existing migration registration seam

```ts
// Source: src/db/database.ts
export const TARGET_VERSION = 8;
export const MIGRATIONS: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
];
```

The exact existing values are quoted verbatim above; Phase 18 appends migration 009 and increments the target in the same change. [VERIFIED: src/db/database.ts:30-47]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Singular `contacts.phone` / `contacts.email` | First-class child methods with local merge identity | Phase 18 | Enables ordered multi-value data, safe future sync, and method-specific provenance. [VERIFIED: docs/dossier/18-contact-data-normalization.md:364-381] |
| Every contact has a positive cadence | Separate Bound state plus nullable never-assigned cadence | Phase 18 | Keeps Unbound history without accidental proactive cadence treatment. [VERIFIED: docs/dossier/18-contact-data-normalization.md:218-264] |
| Source contact could be modeled as owner | Source-link provenance, local data authoritative | Phase 18 foundation / Phase 19-20 consumers | Prevents destructive source disappearance or overwrite. [VERIFIED: docs/dossier/18-contact-data-normalization.md:385-445] |

**Deprecated/outdated:** Scalar `contacts.phone` and `contacts.email` become retired authoritative storage after their migration; no compatibility cache should remain. [VERIFIED: docs/dossier/18-contact-data-normalization.md:364-381]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Name the internal Bound flag `tracking_enabled` and store it as integer 0/1. | Architecture Patterns | A different approved name requires mechanical schema/DAO/query updates. |
| A2 | Preserve `favourite_rank` while Unbound and hide it from all favourite/widget reads, restoring its rank on Bind. | Consumer audit | Owner could instead want destructive rank clearing; behavior needs a product confirmation before locking UI copy. |
| A3 | Use a contacts-table rebuild rather than bare `DROP COLUMN` to make the migration auditable and retain all constraints. | Pattern 1 | More migration code/tests than a platform-specific direct alteration. |
| A4 | Use a trigger plus DAO validation to enforce never-clearing an assigned cadence. | Pattern 3 | Trigger shape must be proven against Expo SQLite / node SQLite versions. |
| A5 | Introduce separately mergeable external-link and method-provenance child rows now. | Pattern 5 | The exact Phase 19 source payload may need an additional opaque-provider field. |

## Open Questions

1. **Favourite dormant-state resolution**
   - What we know: Unbound contacts must not appear as Favourites; the dossier leaves clear-versus-preserve rank open. [VERIFIED: docs/dossier/18-contact-data-normalization.md:286-299]
   - Recommendation: Preserve rank dormant and scope all favourite/widget queries to Bound; it is reversible and preserves the user’s manual order on rebinding. [ASSUMED]

2. **External link uniqueness policy**
   - What we know: One Orbit contact can own multiple system-contact links and source identity must remain independent. [VERIFIED: docs/dossier/18-contact-data-normalization.md:385-404]
   - What's unclear: Whether `(provider, external_contact_id)` must be unique among active links or whether duplicate references are permitted until Phase 19 review.
   - Recommendation: Make it unique for deterministic exact-link lookup while retaining stale rows; have the planner surface this as an explicit schema decision before implementation. [ASSUMED]

3. **Actionability threshold**
   - What we know: Methods can be stored while non-actionable; the parser distinguishes possible from valid and its default metadata is less strict than `/max`. [CITED: https://github.com/catamphetamine/libphonenumber-js/blob/master/README.md]
   - Recommendation: Treat a parser result with `isPossible()` as action-ready in v1, retain malformed input as non-actionable, and lock representative country/extension tests before UI work. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | tests, TypeScript, package install | ✓ | `v22.22.2` | — [VERIFIED: local environment] |
| npm | package install/test | ✓ | `10.9.7` | — [VERIFIED: local environment] |
| `expo-localization` | device-region default | ✗ (not installed) | registry `57.0.1` | User must choose a region before first national-format parse if no device default is available. [VERIFIED: npm registry] |
| `libphonenumber-js` | parsing/canonicalization | ✗ (not installed) | registry `1.13.11` | No safe implementation fallback; add human legitimacy checkpoint before install. [VERIFIED: npm registry] |
| Physical Pixel / desktop build pipeline | migration and UI release UAT | Available through established owner-gated pipeline | Pixel-only UAT | Node migration/DAO gates before device validation. [VERIFIED: .planning/STATE.md:305-317] |

**Missing dependencies with no fallback:** `libphonenumber-js` must be human-verified and installed before canonical international phone behavior is implemented.

**Missing dependencies with fallback:** `expo-localization` has a product-safe first-run fallback only if the user explicitly selects their default phone region before national-format normalization.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` [VERIFIED: package.json:43-49] |
| Config file | No standalone Vitest config found; source-adjacent `*.test.ts` / `*.test.tsx` is the established convention. [VERIFIED: repository file inventory] |
| Quick run command | `npm test -- src/db/migrations/009-contact-data-normalization.test.ts src/db/contact-methods-dao.test.ts` [ASSUMED] |
| Full suite command | `npm test && npx tsc --noEmit && npm run check:colors` [VERIFIED: package.json:46-49] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CDN-01 | Migration copies scalar methods once as primary, drops scalar authority, preserves malformed input, dedupes same-contact canonical values, retains extension/order/UID. | Node SQLite migration + DAO unit | `npm test -- src/db/migrations/009-contact-data-normalization.test.ts src/db/contact-methods-dao.test.ts` | ❌ Wave 0 |
| CDN-02 | All lifecycle transitions enforce Bound-positive cadence, Unbound history preservation, never-clear assigned cadence, and existing Bound migration. | Node SQLite DAO/constraint | `npm test -- src/db/contact-lifecycle-dao.test.ts src/db/migrations/009-contact-data-normalization.test.ts` | ❌ Wave 0 |
| CDN-03 | Every population query includes/excludes Unbound correctly; gravity remains, intensity/status cadence surfaces do not. | Read/logic unit | `npm test -- src/db/dashboard-read.test.ts src/db/orrery-read.test.ts src/db/notification-read.test.ts src/db/impact-read.test.ts` | Existing files require extension |
| CDN-04 | Export/parse/restore round-trip carries methods, links, provenance, tracking, nullable/dormant cadence, and tombstones without destructive source semantics. | Backup integration | `npm test -- src/backup/export-manifest.test.ts src/backup/restore-apply.test.ts src/backup/backup-schema.test.ts` | Existing files require extension |

### Sampling Rate

- **Per task commit:** targeted Vitest command plus `npx tsc --noEmit` for changes to DAOs/types.
- **Per wave merge:** `npm test && npx tsc --noEmit && npm run check:colors`.
- **Phase gate:** full suite green, then owner-gated Android release UAT for migration-on-device, method UI, Bound/Unbound transitions, and refresh of widget/notifications.

### Wave 0 Gaps

- [ ] `src/db/migrations/009-contact-data-normalization.test.ts` — start from a real v8 fixture and prove all scalar/method/lifecycle migration cases.
- [ ] `src/db/contact-methods-dao.test.ts` — canonical same-contact collapse, primary promotion, shared cross-contact canonical value, invalid storage, ordering, and provenance.
- [ ] `src/db/contact-lifecycle-dao.test.ts` — complete lifecycle matrix and SQL trigger rollback.
- [ ] Extend `src/backup/export-manifest.test.ts`, `src/backup/restore-apply.test.ts`, and `src/backup/backup-schema.test.ts` before changing backup wire format.
- [ ] Extend every query-owner test listed in the requirements map; test that Unbound never reaches a derived status SQL projection.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Fully local phase; no account/session flow. [VERIFIED: docs/dossier/18-contact-data-normalization.md:385-445] |
| V3 Session Management | No | No session mechanism in scope. [VERIFIED: docs/dossier/18-contact-data-normalization.md:503-527] |
| V4 Access Control | No | Contact data remains local to the app. [VERIFIED: docs/dossier/18-contact-data-normalization.md:385-445] |
| V5 Input Validation | Yes | Bound parameters, DAO validation, parser result classification, SQL checks/triggers, and strict limited labels/types. [VERIFIED: src/db/types.ts:13-38] |
| V6 Cryptography | No new control | Existing encrypted backup remains outside this phase; do not hand-roll cryptography. [VERIFIED: src/backup/types.ts:23-45] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection through labels/method values | Tampering | Bind every runtime value through `SqlExecutor`; do not interpolate user method data into SQL. [VERIFIED: src/db/types.ts:13-38] |
| Loss of relationship data on migration | Tampering / Availability | One migration transaction, pre/post copy proofs, FK checks, and a v8 fixture test. [VERIFIED: src/db/migrations/runner.ts:55-72] |
| PII leakage to AI/logging | Information disclosure | Keep phone/email excluded from existing AI context and avoid logging raw contact methods. [VERIFIED: src/db/ai-context-read.ts:11-19] |
| Malformed method used for handoff | Elevation / Tampering | Action controls derive only from actionability classification; raw values remain displayable but are never passed to a URI/SMS launcher. [VERIFIED: docs/dossier/18-contact-data-normalization.md:122-161] |
| Source disappearance deletes local data | Tampering | No cascade from source provenance to Orbit method/contact; only explicit local delete tombstones data. [VERIFIED: docs/dossier/18-contact-data-normalization.md:405-445] |

## Sources

### Primary (HIGH confidence)

- [Phase 18 product dossier](../../docs/dossier/18-contact-data-normalization.md) — locked lifecycle, method, provenance, backup, and deferral decisions. [VERIFIED: docs/dossier/18-contact-data-normalization.md:1-543]
- [SQLite ALTER TABLE documentation](https://sqlite.org/lang_altertable.html) — supported alteration and DROP COLUMN limitations. [CITED: https://sqlite.org/lang_altertable.html]
- [libphonenumber-js README](https://github.com/catamphetamine/libphonenumber-js/blob/master/README.md) — parser, E.164, formatting, extension, and validity APIs. [CITED: https://github.com/catamphetamine/libphonenumber-js/blob/master/README.md]
- [Expo localization guide](https://docs.expo.dev/guides/localization/) — `getLocales()` and device `regionCode`. [CITED: https://docs.expo.dev/guides/localization/]
- [Expo Linking guide](https://docs.expo.dev/linking/into-other-apps/) — `tel:` and `mailto:` schemes. [CITED: https://docs.expo.dev/linking/into-other-apps/]

### Secondary (MEDIUM confidence)

- Current codebase migrations, DAOs, query owners, backup/restore, and app settings (cited inline with line ranges).
- npm registry package metadata and package-legitimacy seam for versions, publication dates, scripts, and legitimacy status. [VERIFIED: npm registry]

### Tertiary (LOW confidence)

- The assumed internal naming and detailed new table/trigger shape recorded in the Assumptions Log.

## Metadata

**Confidence breakdown:**

- Standard stack: MEDIUM — official library docs and current registry metadata were checked; `libphonenumber-js` remains legitimacy-gated as SUS.
- Architecture: HIGH — locked dossier decisions were traced against the concrete migration, query, DAO, and backup seams.
- Pitfalls: HIGH — each high-risk behavior follows a current direct column/predicate consumer or a locked product invariant.

**Research date:** 2026-08-26
**Valid until:** 2026-09-02 for package versions; product/codebase findings are valid until the next schema change.
