---
phase: 04-contact-crud-lifecycle
reviewed: 2026-08-15T00:00:00Z
depth: deep
files_reviewed: 22
files_reviewed_list:
  - src/db/contacts-dao.ts
  - src/db/purge-dao.ts
  - src/db/contact-links-dao.ts
  - src/db/contact-read.ts
  - src/db/recency-dao.ts
  - src/db/field-values-dao.ts
  - src/db/transaction.ts
  - src/screens/CreateContactScreen.tsx
  - src/screens/create-contact-logic.ts
  - src/screens/EditContactScreen.tsx
  - src/screens/edit-contact-logic.ts
  - src/screens/ContactProfileScreen.tsx
  - src/screens/ArchivedContactsScreen.tsx
  - src/screens/SettingsScreen.tsx
  - src/screens/HomeScreen.tsx
  - src/components/FrequencyPicker.tsx
  - src/components/frequency-picker-logic.ts
  - src/components/TriStateLastSpoke.tsx
  - src/components/tri-state-last-spoke-logic.ts
  - src/components/LinksEditor.tsx
  - src/components/OverflowMenu.tsx
  - src/navigation/RootNavigator.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-08-15
**Depth:** deep (cross-file, subsystem-level per CLAUDE.md "review the code, not the diff")
**Files Reviewed:** 22
**Status:** issues_found

## Summary

The data layer is the strongest part of this phase and I could not break its core
invariants. I read every writer of the shared tables (`contacts`, `interactions`,
`contact_custom_values`, `contact_links`, and the purge fan-out) and traced the
composition contract through `transaction.ts`. The non-reentrant mutex is entered
exactly once per composed operation (`createContactFull`, `updateContactFull`,
`applyLinkDiff`, `purgeContact`); every `*Core` is only ever called inside an
already-open transaction; `last_contact` is written only by `recomputeLastContactCore`;
the metadata UPDATE SET-lists omit `last_contact`; the rarely-responds flip recomputes in
the same transaction after the flag is written; purge re-checks `archived_at IS NOT NULL`
inside the transaction, fans out to `field_history` (which has no FK), asserts a single
row deleted, and runs the extension hook post-commit outside the mutex in its own
try/catch. The link-open allowlist (`/^https?:\/\//i` + scheme-strip) is a genuine
positive allowlist and I could not construct a `file:`/`intent:`/`javascript:` bypass.
Migration 001 confirms every table the purge and edit paths touch actually exists with the
columns the DAOs bind. No hardcoded colours outside `theme-presets.ts`; timestamps go
through `localDateTime()`/`formatLocalDate()`, never `toISOString()`.

No BLOCKERs. The findings below are UI-layer robustness gaps: a stale profile after edit,
a corner-case in the two-transaction partial-save recovery, and a couple of minor items.

## Warnings

### WR-01: Profile scaffold shows stale name / "Rarely responds" after an edit

**File:** `src/screens/ContactProfileScreen.tsx:56-68`, `src/screens/EditContactScreen.tsx:276`
**Issue:** `ContactProfileScreen` loads its header only on mount — `useEffect(() => { void load() }, [load])`, and `load` is memoised on `contactId`, which never changes for a given profile. No screen in the phase uses `useFocusEffect`/`useIsFocused` (confirmed by grep). The only route into `Edit` is the profile's "Add details" (`navigation.navigate("Edit", { contactId })`, ContactProfileScreen.tsx:132), so `Edit` always sits directly above `Profile` in the stack. On save, `EditContactScreen` calls `navigation.navigate("Profile", { contactId })` (line 276). With a native-stack, navigating to a route already in the stack with unchanged params pops back to the *existing* Profile instance without remounting it or re-running its effect. Result: after renaming a contact (or toggling "Rarely responds") and saving, the user lands on the profile still showing the pre-edit name and the stale rarely-responds label — the two pieces of data this scaffold actually renders. Data is persisted correctly; only the view is stale.
**Fix:** Reload on focus instead of on mount:
```ts
import { useFocusEffect } from "@react-navigation/native";
// ...
useFocusEffect(
  useCallback(() => {
    void load();
  }, [load]),
);
```
(Applying the same on `ArchivedContactsScreen` would future-proof it, though its current mutators already call `load()` explicitly.)

### WR-02: Partial-save recovery can wedge the edit form on the never-contacted first-interaction path

**File:** `src/screens/EditContactScreen.tsx:203-218, 256-274`
**Issue:** On a never-contacted contact, saving with last-spoke = Today first commits `updateContactFull` (which inserts the first interaction and sets `last_contact`), then applies links in a *separate* transaction. If the links transaction throws, the handler calls `reseedMetadataAfterPartialSave()`, whose whole purpose is to flip the in-memory `neverContacted` to false so a retry won't re-log the interaction. But that reseed is best-effort inside its own try/catch (lines 215-217): if `getContactForEdit`/`listDefs` throws there, `neverContacted` stays `true` and `form.lastSpoke` stays `Today`. On retry, `buildEditInput` re-emits `firstInteraction` (edit-contact-logic.ts:196-206); `updateContactFull` re-reads the now-non-null `last_contact` and throws "firstInteraction rejected …" (contacts-dao.ts:339-343), rolling back the entire retry. The DAO guard correctly protects the single-writer invariant — but the screen is now stuck showing the generic "Couldn't save contact" and cannot persist further metadata edits until it is unmounted and reopened. Low probability (requires a second, independent failure), but it is a concrete dead-end.
**Fix:** Don't depend on a successful reseed to clear the double-log risk. Track that the first interaction was already committed and stop re-emitting it, e.g. clear the never-contacted intent locally the moment metadata commits:
```ts
await updateContactFull(exec, input);
if (neverContacted && input.firstInteraction) {
  setNeverContacted(false);
  setField("lastSpoke", { kind: "not-yet" });
}
// ...then attempt links; reseed remains best-effort but is no longer load-bearing
```

### WR-03: Edit save always rewrites a `contact_custom_values` row even when the contact has no custom data

**File:** `src/screens/EditContactScreen.tsx:240`, `src/db/contacts-dao.ts:320-333`
**Issue:** `buildEditInput` maps *every* non-quarantined column into `customValues` (edit-contact-logic.ts:189-192), so whenever any custom field is defined, `updateContactFull` enters the upsert loop and INSERTs a `contact_custom_values` row (of all-nulls) for a contact that never had one — minting a fresh `rowUid` each save (line 238). It is functionally harmless (the UID CONTRACT holds: `ON CONFLICT(contact_id) DO UPDATE` never rewrites the uid, so the first write wins and subsequent saves no-op the uid), but it means an untouched save materialises an empty values row and bumps its `modified_at`, which will feed the Phase-16 newest-wins merge with spurious churn. Worth confirming this is intended rather than a side effect.
**Fix:** Skip writing a value that is null when there is no existing row, or gate the upsert loop on at least one non-null value:
```ts
const dirty = input.customValues?.filter((cv) => cv.value !== null) ?? [];
if (dirty.length > 0) { /* upsert loop */ }
```
If the always-write behaviour is deliberate for merge semantics, add a one-line comment saying so.

## Info

### IN-01: `impactSummaryLines` takes a `name` it never uses

**File:** `src/db/purge-dao.ts:136-152`
**Issue:** `name` is accepted then discarded (`void name;`). The caller already owns the surrounding sentence in `purgeBody` (ArchivedContactsScreen.tsx:81-84). The parameter is dead surface area that invites a future caller to assume the name is interpolated into the parts.
**Fix:** Drop the parameter and update the single caller, or keep it only if a future signature needs it.

### IN-02: Custom "every N" can silently alias onto a preset, losing the unit on re-edit

**File:** `src/components/FrequencyPicker.tsx:41,60-65`
**Issue:** Custom entries collapse to `interval_days` (e.g. "26 weeks" → 182 == Bi-Annually; "1 week" → 7 == Weekly). On the next edit, `PRESET_VALUES.includes(value)` is true, so the picker reopens showing the preset, not the custom unit the user typed. Semantically identical (same day count), purely cosmetic, but the user's "weeks/months" intent is not preserved.
**Fix:** Acceptable for v1; note it. If unit memory is wanted later it needs a stored unit column, which is out of scope here.

### IN-03: `normaliseLinkUrl` turns dedicated-scheme input into odd https URLs

**File:** `src/components/LinksEditor.tsx:67-74`
**Issue:** A user who types `mailto:foo@bar.com` or `tel:123` into the *links* field (they have dedicated inputs elsewhere) gets `https://foo@bar.com` / `https://123` after scheme-strip. Not a security issue — the allowlist guarantees an https result and the OS open failure is caught — just a confusing transform.
**Fix:** Optional: detect `mailto:`/`tel:` and either preserve them or hint the user to the dedicated phone/email fields. Not required for correctness.

---

_Reviewed: 2026-08-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
