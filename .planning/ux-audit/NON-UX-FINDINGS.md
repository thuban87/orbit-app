# Orbit — Non-UX Findings (from the UX audit)

Date: 2026-10-10. Companion to the Orbit hands-on UX audit report.

These are crashes and bugs noticed during a UX audit. They were not the subject of the audit. Owner rule (2026-10-10): when an agent hit a crash or other non-UX problem, it noted the steps, evidence and logcat, retried the same steps up to about 3 times, recorded how often it reproduced, and moved on. **None of them was investigated.** Any cause given below comes from a short read-only look at the code and is marked that way; treat it as a lead, not a diagnosis.

**Setup.** The device was a Pixel 6 Pro. The app was a debug build of local `main` (HEAD `05b85252`) loaded from Metro. Area A only also used a release build, for one retest. Area A ran on the phone's full data (~1,016 visible contacts). Every other area ran on a 100-contact subset (88 visible).

There are seven items:

| Id | Type | Reproduced | Title |
|---|---|---|---|
| A-X01 | CRASH | debug 3/3 (+1 in retest); release 0 | Memory grows with List view; debug build crashes out of memory |
| A-X02 | PERF | 3/3 | Taps land late in List view |
| A-X03 | BUG | 1/3 | Population taps silently dropped while a change is saving |
| B-X01 | BUG | 1/4 | Events search can show results for an older search term |
| D-X01 | BUG | 2/2 | Debug LogBox "VirtualizedLists should never be nested…" in Profile Layout / Edit layout |
| E-X01 | BUG | 2/2 | `ref.measureLayout` warning on a blocked Save; the form doesn't scroll to the error |
| J-X01 | BUG | 4/4 | Duplicate React key `Memory` in Compose → Things to Remember |

Areas C, F, G, H, I and K have no non-UX items. F says so explicitly. G, H and I list only automation artifacts under "Could not check": stray `adb input text` reloaded the debug bundle, and Clock came to the front.

Two problems that look non-UX were filed as UX findings in the area files, so they are not repeated below:
- **K-22 (High).** Favourites (`favourite_rank`) are not in the backup format, so any Replace restore silently unfavourites everyone. The orchestrator first logged this as a candidate non-UX item. Area K confirmed it from code (`src/backup/export-manifest.ts:149`), and from the real subset restore, where favourites had to be re-marked by hand.
- **H-01 (High).** Restore and Delete on a stale Archived row fail forever with "Please try again". No data is harmed: the DAO refuses a contact that is no longer archived.

---

## Area A — Contacts tab (ran on ~1,016 contacts)

Evidence paths are relative to `untracked/artifacts/ux-audit/A-contacts/`.

### A-X01 · CRASH · reproduced 3/3 on debug (plus 1 more in retest); 0 on release — Memory grows with List view; debug build crashes out of memory
- Where: Contacts tab (`Home`), list view: switching to it, sorting in it, entering Select Contacts from it.
- Steps: open the Contacts tab in card view → switch to List view → change Sort a few times, or switch back to card view, or open ⋯ → Select Contacts.
- What happens (release build, retest R1, total PSS):
  - Card view stays flat at about 344–411 MB, even after 10 Sort pairs.
  - Switching to List view jumps to about 1,610 MB (956 MB native). The memory is not given back on returning to card view (1,604–1,731 MB).
  - Five Sort pairs in list view climb 1,176 → 1,672 MB, and trim-memory (RUNNING_CRITICAL) does not reclaim it.
  - A fresh launch with list view persisted starts at about 1.42–1.46 GB.
  - The release build did not crash.
- What happens (debug build): fresh card view is 823 MB, and it reaches 2.2–2.8 GB. The audit crashed three times: a `std::bad_alloc` redbox on entering Select Contacts (twice), and one native "Scudo ERROR: internal map failure (Out of memory)" that vanished to the launcher. The retest crashed once more (signal 6 on `mqt_v_js`, Scudo OOM plus `std::bad_alloc`) during list → card.
- Note: `onSelectContacts` (`src/screens/HomeScreen.tsx:1551-1578`) switches list → card before entering selection mode.
- Evidence: 42-select-mode.png, 100-bad-alloc-select-mode-repro.png, 42-meminfo-at-bad-alloc.txt, 43-memory-growth.txt, 92-native-crash-logcat.txt; retest/R1-rel-M9-full-meminfo.txt, retest/R1-rel-list-after5pairs-meminfo.txt, retest/R1-crash-logcat.txt, retest/R1-debug-crash-full-logcat.txt
- Possibly linked UX findings: A-01 (blank list), A-08 (stale "1 match" rows during slow search), A-23 (swiped row / Undo gone); also the unexplained launcher exit in `findings.md` "Could not check".

### A-X02 · PERF · reproduced 3/3 — Taps land late in List view
- Where: Contacts tab, list view.
- Steps: Contacts → List view → tap Population (or any control).
- What happens (release, tap → panel visible, from screenrecord timestamps): 0.20 s in card view, 1.98 s in fresh list view, 1.74 s in list view after reloads. The delay follows List view, not memory growth.
- What happens (debug): taps and Back land 3–10 s late. A queued tap fell through onto a list row and opened Luca Fairbanks' profile; in the audit, an intended menu tap twice opened a contact profile.
- Evidence: retest/R1-rel-lat-fresh.mp4, retest/R1-rel-lat-fresh-tile.png, retest/R1-rel-lat-fresh-tile2.png, retest/R1-rel-lat-grown.mp4, retest/R1-rel-lat-grown-tile.png, retest/R1-rel-lat-fresh-card.mp4, retest/R1-rel-lat-fresh-card-tile.png, retest/R2-tile-b.png
- Possibly linked UX findings: A-01 (blank list), A-03 (population taps seem not to respond), A-23 (Undo gone before the tap).

### A-X03 · BUG · reproduced 1/3 (dropped at 0.15 s; not dropped in 2 tries at 0.6 s) — Population taps silently dropped while a change is saving
- Where: Contacts → Population panel. `src/components/control-surface/DashboardControlRow.tsx:116` `if (pending) return;`.
- Steps: open Population → tap Favourites → tap Birthdays 0.15 s later.
- What happens: Birthdays is silently ignored, with no feedback. At 0.6 s apart both taps registered, with plain `input tap` and with `input touchscreen tap`. On a fresh card-view process the window is under 0.6 s; under list-view lag (A-X02) it may be longer.
- Evidence: retest/R4-03-fav-then-birthdays-fast.png, retest/R4-04-touchscreen-fast.png, retest/R4-05-fast-150ms.png
- Possibly linked UX findings: A-03 (population options add up / appear to do nothing).

### What A-X01's memory numbers do and do not establish

- **Where the numbers come from.** They come from an audit and retest on the full data (~1,016 visible contacts, 1,028 in the database). The crashes all happened on the **debug** build: three in the audit and one more in the retest. Debug carries extra memory overhead, and fresh card view on debug already used 823 MB.
- **Established on that data:**
  - Switching the Contacts tab to List view sharply raises the process's total PSS, to about 1.6 GB on a release build.
  - Returning to card view, or trimming memory, does not give the memory back.
  - On the debug build, the same pattern ends in native out-of-memory crashes (`std::bad_alloc`, Scudo OOM), seen 4 times in all.
  - The release build did **not** crash in the retest.
  - In List view, taps land about 1.7–2 s late on release (A-X02).
- **Not established:**
  - Why List view uses this memory. Nothing was investigated.
  - Whether a release build can crash under longer use.
  - Whether the growth scales with contact count. Nothing was measured on the 100-contact subset.
  - Whether the size-marked UX findings (A-01, A-08, A-23, A-34) are partly this problem. They were all seen at ~1,016 contacts.
  - Performance and memory are outside the UX audit's scope [owner, 2026-10-10]. These numbers are recorded here only so the owner can decide whether to look into them.

---

## Area B — Events tab

### B-X01 · BUG · reproduced 1/4 — Events search can show results for an older search term
- Where: Events tab → search.
- Steps: with "Synthetic" in the search box, tap the field, move to end, delete the text with ~10 Backspace key events, then immediately type "shared".
- What happens: the field read "shared" but the list showed all four events. "shared" matches no event title or participant name; a later edit to "sharedx" and back to "shared" correctly showed "No events match "shared"." Three further tries with the same steps showed the correct empty state.
- Evidence: 54-search-note.png, 55-search-note-settled.png (3 s later, still wrong); 56-search-sharedx.png, 57-search-shared-again.png (correct); 58-race-try1..3 (not reproduced).
- Likely cause (read only, not investigated): `src/screens/GroupEventsScreen.tsx:43-57` starts a new load on every keystroke with no latest-request guard; an earlier, slower query (the empty-term full list) can resolve last and overwrite the newer result. The detail/edit screens already use `createLatestRequestAuthority` for this.
- Possibly linked UX findings: B-14 (search state).

No crashes, redboxes or ReactNativeJS errors during the pass (logcat checked; only deprecation warnings).

---

## Area D — Profile

### D-X01 · BUG · reproduced 2/2 — Debug LogBox warning "VirtualizedLists should never be nested inside plain ScrollViews" when opening Profile Layout / Edit layout
- Where: Profile → ⋯ → Profile Layout → Edit layout (and again on reopening Profile Layout)
- Steps: open any Profile → ⋯ More actions → Profile Layout → Edit layout
- What happens: the debug LogBox toast appears at the bottom of the sheet, partly covering "Save as template" / "Save layout" until dismissed. Release builds won't show the toast, but the nesting can break list scrolling and virtualization.
- Evidence: 77-edit-layout.png, 77-edit-layout.xml (toast in dump) [verifier correction: 90-layout-templates.xml does not contain the toast]
- Possibly linked UX finding ids: D-11

---

## Area E — Add, Edit and Update Contact

### E-X01 · BUG · reproduced 2/2 — "ref.measureLayout must be called with a ref to a native component" on a blocked Save
- Where: Add Contact and Edit Contact.
- Steps: Add Contact → leave Name empty → Save contact (also after Show More, scrolled down). Edit Contact → clear Name → Save changes.
- What happens: The debug LogBox shows "Warning: ref.measureLayout must be called with a ref to a native component". The form does not scroll to the erroring section.
- Evidence: 03-save-empty-name.png, 30-save-no-name-full.xml (Add); 96-edit-save-empty-name.xml (Edit, warning node in dump).
- Code pointer (read only): `src/screens/CreateContactScreen.tsx:256-262` and `src/screens/EditContactScreen.tsx:498` call `node.measureLayout(findNodeHandle(scroll), …)`.
- Linked UX finding: E-02.

---

## Area J — Compose and confirmations

### J-X01 · BUG · reproduced 4/4 — "Encountered two children with the same key, `Memory`" every time Compose → Things to Remember opens
- Where: Compose → "Things to Remember · 18" (ComposeResearch) for Zz UX Full Profile.
- Steps: open Zz UX Full Profile → Message → tap "Things to Remember · 18".
- What happens: the debug LogBox toast "Encountered two children with the same key, `Memory`. Keys should be unique…" appears every time (seen in Galaxy dark, Galaxy light, Standard dark, Standard light). The screen renders, but two separate "Memory" groups are drawn (see UX finding J-09).
- Evidence: J-compose/16-research.png (toast at bottom; dump 16-research.xml), 57-galaxy-light-research.png, 57-standard-dark-research.png, 57-standard-light2-research.png.
- Cause (read-only look): `groupItems()` in src/screens/ComposeResearchScreen.tsx:77-87 folds only *consecutive* items into a group, so the same group name can appear twice; the group View is keyed by `group.name` (ComposeResearchScreen.tsx:183).
- Possibly linked UX finding: J-09.

---

## Non-UX ↔ UX links

From the cross-cutting comparison (§4 §5). For each non-UX item, it lists the UX findings that may share a cause or a fix, and says whether to test them together when the UX fix is made.


| Non-UX item | What it is | Possibly linked UX findings | Test together with a UX fix session? |
|---|---|---|---|
| **A-X01** CRASH (debug 3/3 + 1; release 0) | List view memory grows to ~1.6 GB release / 2.8 GB debug; debug OOM | A-01 (blank list, no loading indicator), A-08 (stale "1 match" rows during slow search), A-23 (Undo gone before the tap), A-34 (Reset keeps scroll), the unexplained launcher exit (A "Could not check"); indirectly A-09 → A-02 | **Yes.** A-01 and A-08 were seen at ~1,016 contacts and may be partly the same memory/latency cause. Before fixing A-01/A-08 as pure UX, re-check them on the 100-contact set in list and card view on a release build; then verify any A-01/A-08 fix with list view on, since the fix (keep old rows dimmed, searching state) adds rendering in exactly that view. |
| **A-X02** PERF (3/3) | Taps land 1.7–2 s late in list view (release), 3–10 s on debug; a queued tap opened a profile | A-03 (population taps seem to do nothing), A-01, A-23, F-21/X-05 (6 s Undo window shrinks under lag), F-26 (late tap selects a card), A-X03 | **Yes, for X-05.** Any snackbar/Undo change (X-05, A-23) must be tested in list view, where lag eats the 6 s window. Also re-check A-03 after A-X02 is understood. |
| **A-X03** BUG (1/3) | Population taps dropped while a change saves (`DashboardControlRow.tsx:116` `if (pending) return;`) | A-03 (same handler, `togglePopulation` `:114-134`) | **Yes — same file and handler.** A-03's fix (make All Contacts exclusive) rewrites this function; fix the silent drop (queue or show pending) in the same change and test fast double-taps. |
| **B-X01** BUG (1/4) | Events search shows results for an older term (no latest-request guard, `GroupEventsScreen.tsx:43-57`) | B-14 (closing search keeps the filter), B-15 (Back), X-09; same family as A-08 | **Yes.** B-14 and B-15 change the same screen's search state; add the latest-request guard (`createLatestRequestAuthority`, already used on detail/edit) in the same session and test type-delete-type sequences. |
| **D-X01** BUG (2/2) | Nested VirtualizedList warning in Profile Layout / Edit layout; LogBox toast covers "Save layout" on debug | D-11 (layout save collapses sections; editor mislabels state), D-12 (layout copy) | **Yes, lightly.** Restructure the layout editor's scroll container while touching D-11; check list scrolling and that Save is reachable. Release builds hide the toast, so test on debug. |
| **E-X01** BUG (2/2) | `measureLayout` with a non-native ref on a blocked Save (`CreateContactScreen.tsx:256-262`, `EditContactScreen.tsx:498`) | E-02 (empty-name Save shows nothing) — same fix; pattern also behind K-08 and F-12 (X-29) | **Yes — it is half of E-02's fix.** Test E-02 on Add and Edit, scrolled to the bottom, in one session; consider K-08 and F-12 in the same validation pass (X-29). |
| **J-X01** BUG (4/4) | Duplicate React key "Memory" in Compose → Things to Remember | J-09 (doubled "Memory" groups, repeated labels) — same `groupItems()` fix | **Yes — one fix.** Grouping by name in `groupItems()` removes both. Test with J-10 (raw values on the same screen). |
