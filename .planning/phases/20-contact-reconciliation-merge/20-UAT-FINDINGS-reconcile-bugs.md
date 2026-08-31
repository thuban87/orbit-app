---
phase: 20-contact-reconciliation-merge
type: device-UAT findings (post-ADR-003 — reconcile now reads)
found: 2026-08-31
device: Pixel 6 Pro (1A071FDEE002BU, API 37)
---

# Reconcile bugs surfaced once READ_CONTACTS worked (ADR-003)

The ADR-003 permission fix is verified working: the single-contact additive reconcile
path works end-to-end (contact 13, `+13125550442` recommended addition + Apply).
Exercising the now-readable reconcile then surfaced three issues. Automated tests mock
the native contact read, so none were catchable without device UAT.

## Bug B — bulk "Check linked contacts" scan crashes on the full linked set (BLOCKER)
- Symptom: `ReconcileGrid` → "Could not check linked contacts right now." Reproduced 3×.
- The scan iterates **all 14 active-linked contacts** (incl. real Google contacts c3–c6 and merge survivors c4/c9/c11 with 2 links each), stages source photos, classifies, and inserts a session — all inside one `try/catch` (`ReconcileGridScreen.tsx:150-225`) that re-throws to the `useEffect` **silent `.catch()`** (`:229-230`). One contact's scan throws and aborts the whole sweep; the swallow means no console/logcat trace.
- Per-contact path (profile → "Update from Contacts") works, so it is grid/full-set-specific. Root cause not pinned — needs on-device instrumentation (a debug build that logs the throwing contact / un-swallows the catch). Suspects: source-photo staging on a real contact, or multi-link (2-source) handling.
- No data risk: the scan writes nothing on failure (reconcile tables = 0). Blocks Scenario 4 and (transitively) Scenario 5 (needs a live bulk session).

## Bug C — duplicate React key `source` in FieldChoiceGroup (real, small)
- `FieldChoiceGroup.tsx:60` renders `key={option.id}`. A field family with ≥2 source values (e.g. contact 13's two source phones) builds multiple options all with `id="source"` → React "Encountered two children with the same key, `source`" on every reconcile render; can drop/duplicate option rows.
- Fix: make option keys unique (include the value or index). Small, my-bucket.

## Finding A — renaming a LOCAL device contact orphans the Orbit link (fixture flaw + minor robustness)
- Orbit stores the source's Android **lookup key** as `external_contact_id` and matches by exact string (`OrbitContactPickerModule.kt:366-378`; `ReconcileDetailScreen.tsx:54,64`). Local (no-account) Android contacts embed the display-name hash in the lookup key, so **renaming** RID 1136 changed its key → the stored key no longer resolves → `omittedCount>0` → "Source missing" instead of a name conflict.
- Mostly a **fixture-design flaw**: my scenario-3/4 "name conflict" fixtures renamed *local* contacts, which breaks the link before any conflict can show. To test a real name/method conflict, edit a **method value** (e.g. change a phone number) rather than rename, or use a Google-account contact (stable key).
- Minor real robustness note: Android says lookup keys can change (on aggregation); Orbit's exact-string match is fragile vs. the recommended `lookupContact` refresh. Edge case for real users; worth a follow-up, not a blocker.

## UAT scoreboard impact
- Scenario 3: additive path VERIFIED (c13); the name-conflict + no-re-nag parts need a non-rename fixture.
- Scenario 4: BLOCKED by Bug B.
- Scenario 5 (resume): BLOCKED — needs a working bulk session.
- Scenario 6 (source-missing/relink): independently runnable (deleting a source is the intended trigger); not yet attempted.
