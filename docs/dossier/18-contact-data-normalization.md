# Dossier 18 — Contact Data Normalization & Bound/Unbound Lifecycle

**Status:** draft-complete from owner interrogation · 2026-08-25
**Purpose:** decision dossier for the future GSD Phase 18 planning/discuss flow.
**Scope:** normalize phone/email storage, establish Bound/Unbound contact lifecycle, prepare local provenance/linkage foundations for system-contact import, and audit downstream implications.
**Out of scope:** actual Android/iOS contact picker implementation (Phase 19), Interaction Assist (Phase 20), Android notification-listener experiment (post-v1).

---

## Product Boundary

**[DECIDED] Orbit is an intentional personal relationship-management product, not a general address-book replacement or business-networking CRM.**

The product is aimed at helping users intentionally maintain their personal social circles and reduce the friction of initiating/remembering contact. Unbound contacts exist to preserve useful social context and history around intentionally added people without requiring active cadence management.

Supporting Unbound contacts must **not** turn import into a “dump your entire address book into the app” workflow. Phase 19 should favor intentional selection/import rather than positioning wholesale address-book ingestion as the normal use case.

**[DECIDED] Working user-facing lifecycle terminology is `Bound` / `Unbound`.**

- **Bound:** the contact participates in active cadence/status/reminder behavior.
- **Unbound:** the contact remains a full relationship record but is excluded from active cadence management.

Possible UI language:
- “Bind contact to an orbit”
- “Unbind this contact from your orbits”

The app name is still a working title and may change; this terminology must not depend on the final product name.

**[DECIDED] Internal implementation terminology may remain technical**, e.g. `tracking_enabled`.

---

## Cluster A — Contact Method Types

**[DECIDED] Phase 18 supports multiple communication methods of two types only:**
- phone
- email

Social handles, postal addresses, websites, messaging-provider identities, and other identity types are deferred.

**[DECIDED] Phone and email methods support standard labels plus arbitrary custom labels.**

Examples:
- Mobile
- Home
- Work
- Main
- Other
- custom user/imported label

**[DECIDED] One contact may have zero, one, or many phone/email methods.**

A contact with no communication methods is still a valid Orbit contact.

---

## Cluster B — Primary Methods and Ordering

**[DECIDED] Each contact may have at most one primary phone and one primary email.**

Primary methods provide the default endpoint for low-friction actions such as Call, Text, and Email.

**[DECIDED] If a contact has exactly one method of a given type, that method is effectively primary.**

**[DECIDED] Removing the current primary method automatically promotes the next ordered method of that type when one exists.**

The user should not be forced through an additional selection flow merely to delete an obsolete method.

**[DECIDED] Contact methods have durable display ordering.**

The data model should support ordering in Phase 18 even if explicit drag-to-reorder UI is deferred.

---

## Cluster C — Duplicate Method Semantics

**[DECIDED] Duplicate normalized methods on the same contact collapse into one logical method.**

Example:
- `312-555-1234`
- `(312) 555-1234`

If both normalize to the same canonical phone identity, Orbit should not show them as two endpoints.

**[DECIDED] The same normalized phone number or email address may belong to multiple Orbit contacts.**

Examples include shared home numbers or shared email addresses.

Therefore canonical method identity is **not globally unique**.

**[DECIDED] A shared phone/email is duplicate evidence, not proof of duplicate identity.**

Phase 19 duplicate detection should use an evidence/confidence ladder. Matching communication methods are one strong signal among others.

**[DECIDED] Duplicate resolution must be conservative.**

When equality is uncertain, Orbit should preserve information rather than falsely merge data.

---

## Cluster D — Phone Normalization and Validation

**[DECIDED] Phone matching/equality uses a canonical normalized representation, never the human-formatted display string.**

Example equivalents with appropriate region context:
- `+442079460958`
- `+44 20 7946 0958`
- `020 7946 0958`

These may represent the same number even though their display strings differ.

**[DECIDED] Orbit should normalize confidently parseable numbers to E.164 for machine identity.**

Example:
- display: `(312) 555-1234`
- canonical: `+13125551234`

**[DECIDED] Human-facing phone formatting is derived and region-aware.**

Orbit should display numbers in a familiar human format appropriate to the number/locale rather than displaying E.164 everywhere.

Formatting is presentation only and changing formatting must not constitute a data identity change.

**[DECIDED] Orbit has a default phone region for parsing national-format numbers that omit an explicit country code.**

- Default from device region.
- User-overridable in Settings.
- Explicit international numbers beginning with `+` do not depend on the default region.

**[DECIDED] A communication method may be storable without being actionable.**

Orbit must not reject useful relationship data solely because it cannot confidently execute a Call/Text/Email action against it.

Examples:
- incomplete local number
- malformed/partial email
- unusual number that cannot be confidently canonicalized

Such methods should:
- remain stored,
- be visibly identified as incomplete/invalid where appropriate,
- have unsupported actions disabled.

**[DECIDED] Phone extensions are supported in the Phase 18 data shape.**

The extension should be represented separately from the canonical base phone number. Automatic dialing of extensions may be deferred.

---

## Cluster E — Email Normalization and Validation

**[DECIDED] Emails use a conservative normalized form for equality/matching.**

At minimum:
- trim surrounding whitespace,
- normalize case as appropriate for comparison.

Do not implement provider-specific transformations such as Gmail dot stripping or `+tag` removal.

**[DECIDED] Clearly malformed/incomplete email values may still be stored.**

They should be visibly flagged and Email actions disabled rather than rejected outright.

The same principle applies to phones:

> storable does not imply actionable.

---

## Cluster F — Interaction Granularity

**[DECIDED] Phase 18 does not make interaction history endpoint-specific.**

Interaction history remains high-level:
- Call
- Text
- Email
- In person
- Other / existing taxonomy

Example:
- `2026-08-25 — Call`

not:
- “Called work number”
- “WhatsApp call”
- “Signal message”
- specific phone/email endpoint

**[DECIDED] WhatsApp, Signal, SMS, Messenger, etc. are not first-class user-facing interaction types in Phases 18–20.**

The architecture should avoid unnecessarily blocking future provider/endpoint granularity, but no historical endpoint tracking is built now.

**[DECIDED] Removing a phone/email method does not require temporal/history semantics.**

No “former phone”, `valid_from`, `valid_until`, or historical endpoint reconstruction in Phase 18.

Deleted obsolete methods may be truly removed.

---

## Cluster G — Bound / Unbound Lifecycle

**[DECIDED] Orbit contacts may exist as Unbound.**

An Unbound contact remains a complete relationship record and may retain:

- name/category
- custom fields
- phone/email
- photo
- birthday
- fuel
- events
- interactions/history
- relationship measurements that do not require active cadence
- archive/purge lifecycle
- search visibility

Unbound means **not actively managed against a cadence**, not “incomplete contact”.

**[DECIDED] Manual contact creation defaults to Bound, but the user may change that during setup.**

The product should continue nudging toward its primary use case: active relationship maintenance.

**[DECIDED] Existing contacts are migrated as Bound.**

All existing contacts already have valid positive cadence values, so Phase 18 must preserve current behavior for them.

**[DECIDED] Unbinding does not alter relationship history.**

It does not:
- reset `last_contact`,
- fabricate an interaction,
- pause time,
- snapshot a status,
- erase interactions.

**[DECIDED] Status is not meaningfully surfaced while Unbound.**

When a contact becomes Bound, its status is immediately derived from:
- current cadence,
- current time,
- existing interaction history / `last_contact`.

Example:
- dormant cadence = 14 days
- interaction logged while Unbound 5 days ago
- rebind today
- contact immediately has the normal status corresponding to 5/14 days.

**[DECIDED] Historical relationship measurements do not begin a new epoch when a contact becomes Bound.**

Existing history applies immediately.

---

## Cluster H — Gravity and Intensity

**[DECIDED] Gravity remains independent of Bound state and cadence assignment.**

Current gravity is derived from age-decayed eligible interaction history. An Unbound contact may accumulate and derive gravity normally.

**[DECIDED] Intensity is cadence-dependent and is meaningful only once a cadence exists / active evaluation is applicable.**

When a contact is Bound, intensity should immediately evaluate existing interaction history using the current assigned interval. It does not start counting from the date the contact became Bound.

**[DECIDED] “Rarely responds” remains meaningful while Unbound.**

Its existing effect on gravity/eligible interactions remains intact.

---

## Cluster I — Cadence Nullability and Lifecycle

**[DECIDED] `interval_days` becomes nullable.**

**[DECIDED] `interval_days = NULL` has one meaning only:**
> this contact has never been assigned a cadence.

It does **not** mean “Unbound”.

Bound/Unbound is represented separately.

**[DECIDED] An Unbound contact may have `interval_days = NULL` only if no cadence has ever been assigned.**

**[DECIDED] Becoming Bound requires a positive cadence.**

A Bound contact may never have a NULL cadence.

**[DECIDED] Once a cadence has ever been assigned, it may be edited but never cleared back to NULL.**

Cadence assignment is therefore a one-way lifecycle:
- unset → set
- never set → unset again

**[DECIDED] Unbinding preserves an assigned cadence as dormant configuration.**

Rebinding may reuse the existing cadence immediately.

---

## Cluster J — Never Contacted

**[DECIDED] Unbound contacts are excluded from the Never Contacted screen by default.**

**[DECIDED] Add a global setting allowing users to include Unbound contacts in Never Contacted.**

Rationale: a user may intentionally want Never Contacted to operate as an audit of people added to Orbit but never interacted with.

Bound + no interaction history continues to participate normally in the existing Never Contacted behavior.

---

## Cluster K — Favourites

**[DECIDED] Unbound contacts do not meaningfully participate in Favourites.**

The app should not encourage an Unbound contact to occupy the same quick-access/active-management role as a Bound favourite.

**[OPEN — implementation detail]** Whether unbinding:
- clears `favourite_rank`, or
- preserves it dormant but hides/ignores it

must be resolved during implementation planning/downstream audit.

Product behavior is settled: an Unbound contact is not presented as a Favourite.

---

## Cluster L — Notifications and Birthdays

**[DECIDED] Bound/Unbound and `reminders_off` remain independent concepts.**

Example:
- Bound + reminders off = still evaluated for cadence/status/UI, but no push reminder.
- Unbound = not actively evaluated/presented as cadence-managed.

**[DECIDED] Birthday notifications for Unbound contacts remain enabled by default.**

Birthday reminders are factual/event reminders rather than cadence reminders.

**[DECIDED] Add a global setting allowing users to suppress birthday notifications for Unbound contacts.**

**[DECIDED] Existing contact-specific notification decisions must continue to be honored whether Bound or Unbound.**

---

## Cluster M — Dedicated Unbound Screen

**[DECIDED] Unbound contacts receive their own dedicated dashboard submenu/sibling population screen.**

This should be conceptually parallel to existing special populations such as:
- Never Contacted
- Archived

Rationale:

Search is retrieval, not discovery.

A user who imports many contacts as Unbound may remember one person to bind but forget others. A dedicated catch-all Unbound screen allows browsing the population and can naturally encourage additional intentional binding.

This supports the product goal that Bound contacts remain the primary point of the app without losing useful untracked relationship records.

**[DECIDED] The primary actionable dashboard and Orrery remain Bound-only.**

**[DECIDED] Search/all-contact management may include both Bound and Unbound.**

---

## Cluster N — AI Behavior

**[DECIDED] Explicit person-level AI features remain available for Unbound contacts.**

If the user opens an Unbound contact and deliberately asks for message assistance, Orbit may use that contact’s permitted context as normal.

**[DECIDED] Proactive cadence-driven AI excludes Unbound contacts.**

Unbound should not become a hidden route for proactive relationship management through AI.

---

## Cluster O — Contact Method Schema Migration

**[DECIDED] The old singular `contacts.phone` and `contacts.email` columns are retired after migration.**

Existing values migrate into the normalized method model as primary methods.

Do not retain duplicate authoritative values in both:
- `contacts.phone` / `contacts.email`
- normalized child rows

Rationale: one source of truth and avoidance of multi-writer drift.

**[DECIDED] Contact method rows require stable local identity suitable for future multi-device sync.**

Exact schema is for GSD planning, but normalized contact methods should be treated as first-class mergeable user-data entities rather than anonymous embedded values.

---

## Cluster P — System Contact Linkage Foundation

**[DECIDED] Orbit contact identity remains independent of Android/iOS system-contact identity.**

External IDs are provenance/linkage only.

**[DECIDED] One Orbit contact may link to multiple system-contact records.**

This supports real-world cases where one person appears in multiple local address-book records.

Phase 18 should permit this structurally. Phase 19 does not need elaborate multi-link management UI unless implementation proves it necessary.

**[DECIDED] A system/external contact link may become stale/missing without deleting Orbit data.**

If the source system contact disappears:
- Orbit data remains,
- external linkage remains as missing/stale provenance until explicitly relinked or removed.

**[DECIDED] Orbit does not implement per-field synchronization history in Phase 18.**

No miniature sync state such as:
- user-overrode-at timestamp,
- source-changed-at timestamp,
- per-field source-authority state.

Phase 19 refresh compares current Orbit state with current source state and presents differences.

**[DECIDED] Contact methods may retain source-specific external identifiers where available.**

These are provenance/matching aids only and never become Orbit identity.

The disappearance/change of a source identifier must never destroy the Orbit method.

---

## Cluster Q — Refresh / Destructive Intent

**[DECIDED] Source-contact refresh never assumes destructive intent.**

If a value existed in the previously linked system contact but is now absent, Orbit must not silently delete the local value.

Example refresh presentation:
- “No longer present in Contacts: old@company.com”
- Keep in Orbit / Remove

Newly discovered values may similarly be offered for addition.

**[DECIDED] User/local Orbit edits are not silently overwritten by refreshed source data.**

Conflicts/differences are presented for user choice.

Orbit is a one-way import/update consumer:
- System Contacts → Orbit
- never automatic Orbit → System Contacts

---

## Cluster R — Backup and Export

**[DECIDED] Lossless backup must include the full normalized data model.**

This includes, where applicable:
- all phone/email methods
- canonical values
- labels/custom labels
- primary flags
- ordering
- extensions
- Bound/Unbound state
- dormant cadence
- external links/provenance
- other existing Orbit-owned data

**[DECIDED] Full/lossless backup remains the default recovery artifact.**

**[DECIDED] Also support a streamlined human-oriented export path.**

The streamlined form may expose only the most important/simple contact fields, such as primary phone/email, while the robust export/backup retains all normalized rows.

To avoid misleading recovery expectations, this reduced artifact should preferably be called a **Streamlined Export**, not a backup.

A full export package may include a separate `contact_methods` table/file (e.g. CSV) so portability does not discard secondary phones/emails.

Exact Phase 17/backup integration mechanics are planning details.

---

## Cluster S — Widget / Quick Actions

**[DECIDED] Unbound contacts do not participate in normal cadence widgets or active favourite-driven surfaces.**

Existing widget/quick-action targets that become Unbound must refresh/fail gracefully rather than continue presenting them as active cadence-managed contacts.

---

## Cross-Domain Invariants

1. **Bound controls proactive cadence management; it does not control data ownership.**
2. **Unbinding never deletes relationship history.**
3. **NULL cadence means never assigned, not untracked.**
4. **Once assigned, cadence is never cleared.**
5. **System Contacts is a source, never Orbit’s authority.**
6. **Refresh is non-destructive without explicit user approval.**
7. **Canonical phone identity is separate from human presentation.**
8. **Invalid/incomplete methods may be stored but unsupported actions must be disabled.**
9. **Interaction history stays coarse in v1; endpoint/provider granularity is deferred.**
10. **Normalized contact methods become the sole source of truth for phone/email.**
11. **Orbit remains intentionally personal/social-circle focused, not a general CRM/address book.**
12. **Phase 18 must prepare clean first-class entities before the later multi-device sync milestone.**

---

## Explicitly Deferred

- Actual Android/iOS contact-picker APIs and permissions — Phase 19.
- Single/bulk import UI — Phase 19.
- Duplicate-resolution UI and final evidence-tier weights — Phase 19.
- Refresh/diff UI details — Phase 19.
- Interaction Assist durable intent table and UX — Phase 20.
- WhatsApp/Signal/SMS/provider-specific analytics.
- Persistent historical endpoint tracking.
- Former phone/email validity periods.
- Rich system-contact merge-management UI.
- Android notification listener / passive candidate detection — post-v1 experiment.
- Reorder UI polish — may land in later UI/UX work.
- Final app name.

---

## Remaining Phase 18 Planning Details

These are implementation/planning questions rather than unresolved product direction:

- Exact `contact_methods` SQL schema and constraints.
- Exact external-link/provenance SQL schema.
- Exact `tracking_enabled` naming/representation.
- Whether Favourite rank is cleared or preserved dormant on Unbind.
- Exact phone-number library / parsing integration.
- Canonical fallback behavior for non-normalizable phone methods.
- Exact actionable-validation rules for Call/Text/Email.
- Migration numbering after current Phase 17 migrations.
- Query updates required across dashboard, Orrery, Never Contacted, notifications, widgets, AI context, CRUD, Compose, backup/export, and sync-readiness.
- Testing matrix for Bound/Unbound × cadence-set/unset × contacted/never-contacted × archived.
