---
phase: 10-share-sheet-capture
reviewed: 2026-08-16T14:59:43Z
depth: deep
files_reviewed: 15
files_reviewed_list:
  - src/logic/capture-logic.ts
  - src/db/capture-read.ts
  - src/db/capture-dao.ts
  - src/screens/CaptureScreen.tsx
  - src/navigation/linking.ts
  - src/navigation/types.ts
  - src/navigation/RootNavigator.tsx
  - App.tsx
  - app.config.ts
  - modules/orbit-share-finish/index.ts
  - modules/orbit-share-finish/src/OrbitShareFinishModule.web.ts
  - modules/orbit-share-finish/android/src/main/java/expo/modules/orbitsharefinish/OrbitShareFinishModule.kt
  - patches/expo-share-intent+8.0.1.patch
  - src/db/fuel-dao.ts
  - src/db/transaction.ts
findings:
  blocker: 0
  warning: 2
  suggestion: 3
  total: 5
status: issues_found
---

# Phase 10: Code Review Report — Share-Sheet Capture

**Reviewed:** 2026-08-16T14:59:43Z
**Depth:** deep (cross-file, subsystem-level per CLAUDE.md)
**Files Reviewed:** 15 (10 changed + 5 subsystem dependencies read to verify invariants)
**Status:** issues_found

## Summary

I reviewed the full Phase 10 surface — the pure payload resolver, the picker read, the
two write fan-outs, the CaptureScreen state machine, the ShareIntentGate navigation
wiring, the native finish() module, the config plugin, and the EXTRA_SUBJECT patch —
and read the shared writers they depend on (`fuel-dao.ts`, `transaction.ts`,
`contacts-dao.ts`) to verify the claimed invariants against the real code, not the diff
or the comments.

**Every load-bearing correctness invariant in scope holds:**

- **Capture never touches `last_contact`/interactions.** `capture-dao.ts` imports only
  `addFuelCore`/`editFuelCore`; `CaptureScreen`'s inline-create calls `createContactFull`
  *without* `firstInteraction`, and I confirmed in `contacts-dao.ts:106-182` that the
  omitted-`firstInteraction` path leaves `last_contact` NULL and never calls
  `recomputeLastContactCore`. Single-writer DATA-04 is intact.
- **No mutex nesting.** `captureMultiAttach` / `captureMultiNote` each open exactly ONE
  `inWriteTransaction` and compose the non-mutexed cores N times — verified against the
  non-reentrancy contract in `transaction.ts:11-29` and the core/wrapper split in
  `fuel-dao.ts`. A throw mid-loop rolls back all N. Ids are accumulated inside the txn
  and threaded correctly.
- **Picker read** is `WHERE c.archived_at IS NULL` only (never-contacted included, does
  not import BASE_WHERE), MRU derived from a LEFT JOIN on existing `fuel.created_at` with
  no new column/index/migration, single static string, no interpolation, async read only.
- **`isCommittingRef`** is declared in the component body, set synchronously before the
  first `await` and cleared in `finally` on all four commit paths (single-tap, multi
  Done, inline create, note-Done). Back/Close split is correct (Back exits multi-select
  when active else cancels; Close always cancels). Done is guarded and disabled at N=0;
  the inline empty-name guard runs first; `{ contactId }` is destructured correctly.
- **`resolveCapturePayload`**: note leads, base is appended and never discarded, url is
  `webUrl ?? null` and never overwritten. Boundary trim matches the fuel-read exclusion
  set. Pure and total.
- Theme tokens only (no hex/color literals), no network on any read path,
  `localDateTime()` used throughout (no `toISOString` off-by-one), confirmation uses
  `setState` + a `useRef` `setTimeout` cleared on unmount — never per-frame React-state
  animation. Hook deps and timer cleanup are correct.

No blockers. Two warnings and three suggestions, all in `CaptureScreen.tsx`, concern the
post-commit confirmation window and one contract/comment divergence.

## Warnings

### WR-01: Grid stays tappable during the auto-return window — a second face tap silently captures to a different contact

**File:** `src/screens/CaptureScreen.tsx:283-286` (finally), `:646-656` (`disabled={committing}`), `:240-249` (`armAutoReturn`)
**Issue:** After a single-tap commit resolves, `finally` sets `committing = false`, so
every face in the FlatList is re-enabled (`disabled={committing}`). The confirmation
surface is an absolute-positioned bottom sheet (`styles.confirmSurface`, left/right/bottom 16)
that does **not** cover the grid, and the 1500 ms `armAutoReturn` timer has not yet fired.
For that ~1.5 s a stray or mistaken tap on **another** face re-enters `onPickFace`
(now un-latched), writes a *second* `source:'share'` fuel row to a *different* contact,
replaces `writtenRows`, updates the toast, and re-arms the timer — then auto-returns to
the source app. The extra write lands on the wrong person with only a fleeting toast
change as feedback, and the optional note then applies only to the last row.

The `isCommittingRef` latch and `disabled={committing}` correctly stop a *rapid same-tick
double-tap* (the header's B2/C2 claim), but neither covers a tap that arrives *after* the
first commit has resolved and before auto-return fires. This is a real gap on a flow whose
entire premise is one-tap, low-attention capture.
**Fix:** Once a commit has succeeded, keep the grid inert until the screen finishes. Gate
the faces on the confirmation state, not just in-flight state — e.g. disable when a save
has landed:
```tsx
// derive a "locked after save" flag
const locked = committing || savedLabel !== null;
// ...on the face Pressable and the ＋ tile:
disabled={locked}
// and defensively at the top of onPickFace:
if (savedLabel !== null) return;
```

### WR-02: A blank/whitespace note is not skipped — it rewrites `text` to the same value and bumps `modified_at`, contradicting the documented contract

**File:** `src/screens/CaptureScreen.tsx:372-400`
**Issue:** The `onNoteDone` header comment states "A blank/whitespace note leaves the base
untouched → treated as Skip." The code does not implement that. It calls
`resolveCapturePayload({ ..., note: noteText })`; when `noteText` is blank/whitespace the
resolver returns `base` (the originally written display text, non-null on the normal
share path), so `composed !== null` is true and it proceeds to `editFuel` /
`captureMultiNote`, rewriting `text` to the identical value and bumping `modified_at`.
The data is not corrupted (same text), but the row *is* touched on a latency-sensitive
return path, and the behavior diverges from its own stated contract — a maintainer trusting
the comment would be wrong. (Skip is only actually reached when `base` is null, i.e. the
url-only edge, which cannot arise from a real share since `webUrl` is extracted from `text`.)
**Fix:** Guard on the trimmed note before composing/writing, so a blank note is a true
no-op that just re-arms the return:
```tsx
const note = noteText.trim();
if (note.length === 0) {
  setNoteOpen(false);
  armAutoReturn();
  return;
}
// ...then compose with { note } and write.
```

## Suggestions

### SG-01: The ＋ "New contact" tile stays active during multi-select

**File:** `src/screens/CaptureScreen.tsx:621-642`
**Issue:** In multi-select mode, tapping a face toggles selection, but the ＋ tile's
`onPress` is always `onOpenInlineCreate` (only `disabled={committing}`). So mid–multi-select
the user can open the single-contact inline-create sheet, an incoherent mixed state
(the pending selection is neither cancelled nor included). Not a data bug — inline-create
writes its own row correctly — but the two modes shouldn't overlap.
**Fix:** In multi-select, either hide the ＋ tile or make its tap a no-op / a "add the new
contact to the selection" action; simplest is to disable it while `multiSelect` is true.

### SG-02: Skipped/retained note text can reappear on a later "Add a note"

**File:** `src/screens/CaptureScreen.tsx:401`, `:414-417`
**Issue:** Neither `onNoteDone` (on the blank path) nor `onNoteSkip` clears `noteText`.
Because the "Add a note" affordance reappears after Skip, re-opening the note field
resurfaces the previous draft. Cosmetic, but surprising.
**Fix:** `setNoteText("")` when dismissing the note (in `onNoteSkip`, and after a
successful `onNoteDone`).

### SG-03: `savedLabel` count copy is not singular-aware

**File:** `src/screens/CaptureScreen.tsx:340`
**Issue:** `Saved to ${written.length} contacts` always pluralizes. A multi-select Done
that resolves to exactly one selected contact reads "Saved to 1 contacts." Multi-select
requires a long-press + at least one selection, so N=1 here is reachable (long-press one
face, immediately Done).
**Fix:** Pluralize conditionally, e.g. `Saved to ${n} ${n === 1 ? "contact" : "contacts"}`.

---

_Reviewed: 2026-08-16T14:59:43Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
